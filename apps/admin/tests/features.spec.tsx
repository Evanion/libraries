import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFeatures, serializeConfig } from '@evanion/feature';
import type { SerializedDefinition } from '@evanion/feature';
import { policy } from '@evanion/acl';
import type { Action } from '@evanion/acl';
import { PolicyProvider, adoptMatrix } from '../app/access.js';
import type { AdminObjects, AdminSubject } from '../app/access.js';
import {
  FeatureProvider,
  adoptFeatures,
  featureContext,
  pageFeatures,
} from '../app/features.js';
import type { AdminFlags } from '../app/features.js';
import { readFeatures } from '../app/features.server.js';
import {
  accessContext,
  correlationContext,
  featuresContext,
  shelfContext,
  subjectContext,
} from '../app/page-context.js';
import { loadFeatures, loadPageView } from '../app/page-view.server.js';
import { CartProvider, SessionProvider } from '../app/providers.js';
import {
  clearShelfPolicy,
  readPickupOffers,
  setPickupOffer,
} from '../app/shelf-policy.server.js';
import Title, { action } from '../app/routes/title.js';
import { loader as shellLoader } from '../app/shell.js';

/**
 * The claim the back office makes about feature flags: the React Router server
 * resolves them from the document shop-api serves, the browser toggles a control
 * from the answers it was shipped, and the action asks again.
 *
 * The cases that matter are the last two groups. A browser that was shipped
 * `express-pickup: true` draws the control, and a POST at the route's URL from a
 * subject the flag resolves off for reaches the action without the control ever
 * having been drawn. The action has to refuse it and write nothing.
 */

const operator: AdminSubject = {
  id: 'staff:ines',
  roles: ['operator'],
  shop: 'stockholm',
};

const shopper: AdminSubject = {
  id: 'cust-0042',
  roles: ['customer'],
  shop: '',
};

/**
 * A customer of the shop that lists the title. The contract lets this actor
 * declare there, so a refusal in a case below is the flag's.
 */
const stockholmShopper: AdminSubject = { ...shopper, shop: 'stockholm' };

const STOCKHOLM_URN = 'urn:game:wingspan';
const GOTHENBURG_URN = 'urn:game:gloomhaven';

/**
 * The definitions shop-api serves, with the ramp at zero so a customer is
 * outside it whatever their id hashes to.
 */
const DEFINITIONS: SerializedDefinition<keyof AdminFlags>[] = [
  {
    key: 'new-checkout',
    enabled: true,
    rules: [
      {
        id: 'staff',
        when: [{ field: 'roles', op: 'contains', value: 'operator' }],
      },
      { id: 'ramp', rollout: { percent: 0, by: 'targetingKey' } },
    ],
  },
  { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
];

/** The body `GET /api/features` answers with, at this version. */
function featuresDocument(version: string) {
  const config = serializeConfig(
    createFeatures<AdminFlags>({ version, features: DEFINITIONS }),
  );
  return { version: config.version, config };
}

const SERVED = featuresDocument('fixture@1');

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

/** Stands in for shop-api and records the paths it was asked for. */
function stubShopApi(version = 'fixture@1'): string[] {
  const paths: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname.replace(/^\/api/, '');
    paths.push(path);
    if (path === '/features') return json(featuresDocument(version));
    if (path === '/policy') {
      return json({
        version: 'fixture@1',
        matrix: { version: 'fixture@1', permissions: [] },
      });
    }
    if (path === '/games') return json([]);
    return new Response('not stubbed', { status: 404 });
  });
  return paths;
}

beforeEach(() => {
  stubShopApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const urn of [STOCKHOLM_URN, GOTHENBURG_URN]) {
    clearShelfPolicy(urn);
    setPickupOffer(urn, false);
  }
});

describe('the server, which resolves the flags', () => {
  it('resolves them for the subject the request runs as', async () => {
    const forOperator = await readFeatures('admin-test', operator);
    const forShopper = await readFeatures('admin-test', shopper);

    expect(forOperator.flags.isEnabled('express-pickup')).toBe(true);
    expect(forShopper.flags.isEnabled('express-pickup')).toBe(false);
  });

  it('turns every flag off when shop-api cannot be reached', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('connect ECONNREFUSED');
    });

    const { flags } = await readFeatures('admin-test', operator);

    expect(flags.isEnabled('new-checkout')).toBe(false);
    expect(flags.isEnabled('express-pickup')).toBe(false);
  });

  it('reuses the store while the document version holds', () => {
    const first = adoptFeatures(featuresDocument('fixture@2').config);
    const again = adoptFeatures(featuresDocument('fixture@2').config);
    const replaced = adoptFeatures(featuresDocument('fixture@3').config);

    expect(again).toBe(first);
    expect(replaced).not.toBe(first);
  });

  it('refuses a document it cannot install', () => {
    const broken = { ...SERVED.config, features: 'none' } as never;

    expect(() => adoptFeatures(broken)).toThrow(/cannot install/);
  });
});

/** Runs the shell's two middleware in the order the route lists them. */
async function runMiddleware(context: RouterContextProvider): Promise<void> {
  const args = { context } as unknown as Parameters<typeof loadPageView>[0];
  const next = (async () => new Response()) as never;
  await loadPageView(args, next);
  await loadFeatures(args, next);
}

describe('the middleware, which fills the context', () => {
  it('fetches the document once however many loaders ask', async () => {
    const paths = stubShopApi();
    const context = new RouterContextProvider();

    await runMiddleware(context);
    const read = context.get(featuresContext);
    const [first, second] = await Promise.all([read(), read()]);

    expect(second).toBe(first);
    expect(paths.filter((path) => path === '/features')).toHaveLength(1);
  });
});

describe('the shell loader, which ships the answers', () => {
  it('hands the browser the document and the set resolved for the subject', async () => {
    const context = new RouterContextProvider();
    await runMiddleware(context);

    const result = await shellLoader({
      context,
    } as unknown as Parameters<typeof shellLoader>[0]);

    expect(result.features.config.version).toBe('fixture@1');
    expect(result.features.decisions.decisions['express-pickup'].enabled).toBe(
      true,
    );
  });
});

/** An access matrix that lets any subject declare on any title. */
const OPEN = adoptMatrix(
  policy<AdminSubject, AdminObjects, { game: Action | 'declare' }>({
    version: 'fixture@1',
    schema: {
      subject: { fields: { id: 'string', roles: 'string[]', shop: 'string' } },
      objects: { game: { fields: { shop: 'string' } } },
    },
  }).for('game', (p) => p.allow('declare', p.eq('object.shop', 'subject.shop')))
    .matrix,
);

function titleFor(subject: AdminSubject, shop: string): string {
  const { config } = SERVED;
  const Stub = createRoutesStub([
    {
      path: '/shelf/:urn',
      Component: () => (
        <PolicyProvider
          access={OPEN}
          subject={subject}
          context={{ now: '2026-10-16T09:00:00.000Z' }}
        >
          <FeatureProvider
            features={adoptFeatures(config)}
            context={featureContext(subject)}
            decisions={pageFeatures(config, subject).flags.snapshot()}
          >
            <SessionProvider
              session={{
                operator: 'Ines',
                shop: 'Baize',
                correlationId: 'admin-test',
                subject,
              }}
            >
              <CartProvider>
                <Title
                  {...({
                    loaderData: {
                      pickup: false,
                      row: {
                        urn: STOCKHOLM_URN,
                        title: 'Wingspan',
                        mechanisms: ['engine building'],
                        players: '1-5',
                        playtime: '40-70 min',
                        complexity: 2.4,
                        quantity: 3,
                        availability: 'in stock',
                        declared: false,
                        shop,
                      },
                    },
                  } as Parameters<typeof Title>[0])}
                />
              </CartProvider>
            </SessionProvider>
          </FeatureProvider>
        </PolicyProvider>
      ),
    },
  ]);

  return renderToStaticMarkup(<Stub initialEntries={['/shelf/x']} />);
}

describe('the tree, which toggles a control', () => {
  it('draws the pickup control where the flag is on and the shop declares', () => {
    expect(titleFor(operator, 'stockholm')).toContain('Offer express pickup');
  });

  it('leaves it out where the flag resolves off for the subject', () => {
    expect(titleFor(stockholmShopper, 'stockholm')).not.toContain(
      'Offer express pickup',
    );
  });
});

function contextFor(subject: AdminSubject): RouterContextProvider {
  const context = new RouterContextProvider();
  context.set(correlationContext, 'admin-test');
  context.set(subjectContext, subject);
  context.set(accessContext, async () => OPEN);
  context.set(shelfContext, async () => ({ rows: [] }));
  context.set(featuresContext, async () =>
    pageFeatures(SERVED.config, subject),
  );
  return context;
}

function offering(urn: string, intent: string): Request {
  const body = new FormData();
  body.append('intent', intent);
  return new Request(`http://admin.test/shelf/${urn}`, {
    method: 'POST',
    body,
  });
}

describe('the action, which decides again', () => {
  // #region refusing-the-offer
  it('refuses a pickup offer the flag resolves off for, and writes nothing', async () => {
    stubGames();
    const result = await action({
      request: offering(STOCKHOLM_URN, 'offer-pickup'),
      params: { urn: STOCKHOLM_URN },
      context: contextFor(stockholmShopper),
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toMatchObject({ refused: true });
    expect(readPickupOffers().has(STOCKHOLM_URN)).toBe(false);
  });
  // #endregion refusing-the-offer

  it('records the offer when the flag is on for the subject', async () => {
    stubGames();
    const result = await action({
      request: offering(STOCKHOLM_URN, 'offer-pickup'),
      params: { urn: STOCKHOLM_URN },
      context: contextFor(operator),
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toEqual({ pickup: true });
    expect(readPickupOffers().has(STOCKHOLM_URN)).toBe(true);
  });

  it('refuses an offer on a title another shop lists', async () => {
    stubGames();
    const result = await action({
      request: offering(GOTHENBURG_URN, 'offer-pickup'),
      params: { urn: GOTHENBURG_URN },
      context: contextFor(operator),
    } as unknown as Parameters<typeof action>[0]);

    expect(result).toMatchObject({ refused: true });
    expect(readPickupOffers().has(GOTHENBURG_URN)).toBe(false);
  });
});

/** Serves the two titles the action looks its row up in. */
function stubGames(): void {
  vi.stubGlobal('fetch', async () =>
    json([
      {
        urn: STOCKHOLM_URN,
        title: 'Wingspan',
        mechanisms: [],
        players: '1-5',
        playtime: '40-70 min',
        complexity: 2.4,
        shop: 'stockholm',
      },
      {
        urn: GOTHENBURG_URN,
        title: 'Gloomhaven',
        mechanisms: [],
        players: '1-4',
        playtime: '60-120 min',
        complexity: 3.9,
        shop: 'gothenburg',
      },
    ]),
  );
}
