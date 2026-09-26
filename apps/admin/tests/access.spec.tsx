import { renderToStaticMarkup } from 'react-dom/server';
import {
  RouterContextProvider,
  StaticRouter,
  createRoutesStub,
} from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickAllowedFields, policy, type Action } from '@evanion/acl';
import type { Matrix } from '@evanion/acl';
import { PolicyProvider, adoptMatrix } from '../app/access.js';
import type { AdminObjects, AdminSubject } from '../app/access.js';
import {
  accessContext,
  correlationContext,
  shelfContext,
  subjectContext,
} from '../app/page-context.js';
import { CartProvider, SessionProvider } from '../app/providers.js';
import {
  clearShelfPolicy,
  readShelfPolicy,
} from '../app/shelf-policy.server.js';
import { SUBJECT_HEADER, listGames } from '../app/shop-api.server.js';
import type { Game } from '../app/shop-api.server.js';
import Shell from '../app/shell.js';
import Title, { action } from '../app/routes/title.js';
import { defineNavItems } from '../app/regions/nav.js';
import { defineSidebarItems } from '../app/regions/sidebar.js';

/**
 * The claim the back office makes about access control: the browser toggles and
 * the React Router server enforces.
 *
 * The load-bearing case is the one where the two disagree. A subject whose shop
 * does not list a title never sees the availability form, and calling the action
 * directly is exactly what a caller who ignored that does -- a `curl` at the
 * route's URL reaches the same function with the same arguments. The action has
 * to refuse it and write nothing, or the form was the only thing holding the
 * shelf shut.
 *
 * Every case decides on a real document through `parseMatrix`, the same call the
 * app makes on what shop-api served. A stubbed decision would assert that the
 * action called something; a real document asserts that the rules say what the
 * back office thinks they say.
 */

/**
 * The contract shop-api publishes, restated.
 *
 * It is not imported from that app: the API is the contract, and a back office
 * that compiled against shop-api's own modules would make it a build dependency
 * of every app in the chain. The rules here are the ones `GET /api/policy`
 * serves, and shop-api's own suite is what holds its copy to them.
 */
const CATALOGUE_STATES = [
  'in-stock',
  'preorder',
  'reprint-pending',
  'out-of-print',
];

const SERVED_MATRIX: Matrix = policy<
  AdminSubject,
  AdminObjects,
  { game: Action | 'declare' | 'reprice' }
>({
  version: 'shop-api@1',
  schema: {
    subject: { fields: { id: 'string', roles: 'string[]', shop: 'string' } },
    objects: {
      game: {
        fields: {
          urn: 'string',
          title: 'string',
          mechanisms: 'string[]',
          players: 'string',
          playtime: 'string',
          complexity: 'number',
          price: 'number',
          availability: 'string',
          shop: 'string',
        },
      },
      order: { fields: { shop: 'string' } },
      telemetry: {
        fields: {
          id: 'number',
          timestamp: 'instant',
          correlationId: 'string?',
          source: 'string',
          type: 'string',
        },
      },
    },
  },
})
  .for('game', (p) =>
    p
      .allow('read', p.always)
      .allow(
        'declare',
        p.contains('subject.roles', 'operator'),
        p.eq('object.shop', 'subject.shop'),
      )
      .allow(
        'declare',
        p.contains('subject.roles', 'manager'),
        p.eq('object.shop', 'subject.shop'),
      )
      .fields({
        fields: ['availability'],
        availability: { targets: CATALOGUE_STATES },
      })
      .allow(
        'reprice',
        p.contains('subject.roles', 'manager'),
        p.eq('object.shop', 'subject.shop'),
      )
      .fields({
        fields: ['availability', 'price'],
        availability: { targets: CATALOGUE_STATES },
      }),
  )
  .for('order', (p) =>
    p.allow('create', p.contains('subject.roles', 'customer')),
  )
  .for('telemetry', (p) =>
    p.allow('read', p.contains('subject.roles', 'manager')),
  ).matrix;

const access = adoptMatrix(SERVED_MATRIX);

const operator: AdminSubject = {
  id: 'staff:ines',
  roles: ['operator'],
  shop: 'stockholm',
};

const manager: AdminSubject = {
  id: 'staff:ada',
  roles: ['manager'],
  shop: 'stockholm',
};

const STOCKHOLM_URN = 'urn:game:wingspan';
const GOTHENBURG_URN = 'urn:game:gloomhaven';

const catalogue: Game[] = [
  {
    urn: STOCKHOLM_URN,
    title: 'Wingspan',
    mechanisms: ['engine building'],
    players: '1-5',
    playtime: '40-70 min',
    complexity: 2.4,
    shop: 'stockholm',
  },
  {
    urn: GOTHENBURG_URN,
    title: 'Gloomhaven',
    mechanisms: ['co-op', 'legacy', 'tactical combat'],
    players: '1-4',
    playtime: '60-120 min',
    complexity: 3.9,
    shop: 'gothenburg',
  },
];

// #region calling-the-action
/** The request context the shell's middleware would have built. */
function contextFor(subject: AdminSubject): RouterContextProvider {
  const context = new RouterContextProvider();
  context.set(correlationContext, 'admin-test');
  context.set(subjectContext, subject);
  context.set(accessContext, async () => access);
  context.set(shelfContext, async () => ({ rows: [] }));
  return context;
}

/** A form submission at the availability form's URL, whoever sent it. */
function declaring(urn: string, fields: Record<string, string>): Request {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  return new Request(`http://admin.test/shelf/${urn}`, {
    method: 'POST',
    body,
  });
}

/**
 * Calls the route's action the way the router would, and the way anything else
 * that reaches the URL does.
 *
 * The cast goes through `unknown` because the generated argument type carries
 * the route's match tree, which the action itself reads none of. What it does
 * read is stated in full: the request, the urn, and a context the middleware
 * would have filled.
 */
function callAction(subject: AdminSubject, urn: string, request: Request) {
  return action({
    request,
    params: { urn },
    context: contextFor(subject),
  } as unknown as Parameters<typeof action>[0]);
}
// #endregion calling-the-action

beforeEach(() => {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith('/games')) {
      return new Response(JSON.stringify(catalogue), {
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not stubbed', { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearShelfPolicy(STOCKHOLM_URN);
  clearShelfPolicy(GOTHENBURG_URN);
});

describe('the subject on the way to shop-api', () => {
  it('states who the back office is on every call', async () => {
    const seen: Headers[] = [];
    vi.stubGlobal('fetch', async (_input: unknown, init?: RequestInit) => {
      seen.push(new Headers(init?.headers));
      return new Response('[]', {
        headers: { 'content-type': 'application/json' },
      });
    });

    await listGames('admin-test', operator);

    expect(seen).toHaveLength(1);
    expect(JSON.parse(seen[0]?.get(SUBJECT_HEADER) ?? 'null')).toEqual(
      operator,
    );
  });
});

describe('the action, which is where the back office enforces', () => {
  it('declares a title the subject’s own shop lists', async () => {
    const result = await callAction(
      operator,
      STOCKHOLM_URN,
      declaring(STOCKHOLM_URN, {
        intent: 'declare',
        availability: 'out of print',
      }),
    );

    expect(result).toEqual({ declared: 'out of print' });
    expect(readShelfPolicy()[STOCKHOLM_URN]).toBe('out of print');
  });

  /**
   * The case the whole arrangement rests on. The tree never drew this form for
   * this subject, and calling the action is what ignoring that looks like.
   */
  // #region refusing-the-post
  it('refuses a title another shop lists, and writes nothing', async () => {
    const result = await callAction(
      operator,
      GOTHENBURG_URN,
      declaring(GOTHENBURG_URN, {
        intent: 'declare',
        availability: 'out of print',
      }),
    );

    expect(result).toMatchObject({ refused: true });
    expect(readShelfPolicy()[GOTHENBURG_URN]).toBeUndefined();
  });
  // #endregion refusing-the-post

  it('refuses a clear on a title another shop lists', async () => {
    const result = await callAction(
      operator,
      GOTHENBURG_URN,
      declaring(GOTHENBURG_URN, { intent: 'clear' }),
    );

    expect(result).toMatchObject({ refused: true });
  });
});

describe('the contract itself', () => {
  const ownRow = catalogue[0] as Game;

  it('reserves repricing for a manager', () => {
    expect(access.can(operator, 'game', 'reprice', ownRow).allowed).toBe(false);
    expect(access.can(manager, 'game', 'reprice', ownRow).allowed).toBe(true);
  });

  it('reserves the order history for a manager', () => {
    expect(access.capabilities(operator)['telemetry.read']?.allowed).toBe(
      false,
    );
    expect(access.capabilities(manager)['telemetry.read']?.allowed).toBe(true);
  });

  /**
   * A form post carries whatever the sender put a `name` on, so the price a
   * declare form never drew is the shape the write axis exists for.
   */
  it('withholds a price smuggled into a declaration', () => {
    const proposed = { availability: 'out-of-print', price: 1 };
    const decision = access.canFields(
      manager,
      'game',
      'declare',
      ownRow,
      'write',
      proposed,
    );

    expect(decision.fields['price']).toBe('denied');
    expect(pickAllowedFields(decision, proposed)).toEqual({
      availability: 'out-of-print',
    });
  });
});

/**
 * The browser half. Every assertion here is about what a reader is shown, and
 * none of it stops anything: the cases above are what stops a write.
 */
describe('the tree, which toggles what is shown', () => {
  function shellFor(subject: AdminSubject): string {
    return renderToStaticMarkup(
      <StaticRouter location="/">
        <Shell
          {...({
            loaderData: {
              session: {
                operator: 'Ines',
                shop: 'Baize',
                correlationId: 'admin-test',
                subject,
              },
              matrix: SERVED_MATRIX,
              now: '2026-09-17T09:00:00.000Z',
              navItems: defineNavItems([
                { id: 'mark', type: 'wordmark', props: { shop: 'Baize' } },
                {
                  id: 'orders',
                  type: 'section',
                  props: { label: 'Orders', to: '/orders' },
                },
                {
                  id: 'shelf',
                  type: 'section',
                  props: { label: 'Shelf', to: '/shelf' },
                },
              ]),
              sidebarItems: defineSidebarItems([
                {
                  id: 'h-availability',
                  type: 'heading',
                  props: { label: 'Availability' },
                },
                {
                  id: 'states',
                  type: 'states',
                  props: { counts: [{ state: 'in stock', titles: 1 }] },
                },
                { id: 'basket', type: 'basket', props: {} },
              ]),
            },
          } as Parameters<typeof Shell>[0])}
        />
      </StaticRouter>,
    );
  }

  it('hides the order history from a subject the contract refuses it', () => {
    expect(shellFor(operator)).not.toContain('Orders');
    expect(shellFor(manager)).toContain('Orders');
  });

  it('shows the availability rail to a subject who declares somewhere', () => {
    expect(shellFor(operator)).toContain('Availability');
    expect(
      shellFor({ id: 'shopper', roles: ['customer'], shop: '' }),
    ).not.toContain('Availability');
  });

  // #region routes-stub
  /**
   * A stub router rather than a `StaticRouter`, because the availability form is
   * a `<Form>` and that component reads the data router's submit.
   */
  function titleFor(subject: AdminSubject, row: Game): string {
    const Stub = createRoutesStub([
      {
        path: '/shelf/:urn',
        Component: () => (
          <PolicyProvider
            access={access}
            subject={subject}
            context={{ now: '2026-09-17T09:00:00.000Z' }}
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
                      row: {
                        urn: row.urn,
                        title: row.title,
                        mechanisms: row.mechanisms,
                        players: row.players,
                        playtime: row.playtime,
                        complexity: row.complexity,
                        quantity: 3,
                        availability: 'in stock',
                        declared: false,
                        shop: row.shop,
                      },
                    },
                  } as Parameters<typeof Title>[0])}
                />
              </CartProvider>
            </SessionProvider>
          </PolicyProvider>
        ),
      },
    ]);

    return renderToStaticMarkup(<Stub initialEntries={['/shelf/x']} />);
  }
  // #endregion routes-stub

  it('draws the availability form only on a row the subject may declare', () => {
    expect(titleFor(operator, catalogue[0] as Game)).toContain('Save state');

    const other = titleFor(operator, catalogue[1] as Game);
    expect(other).not.toContain('Save state');
    expect(other).toContain('gothenburg');
  });
});
