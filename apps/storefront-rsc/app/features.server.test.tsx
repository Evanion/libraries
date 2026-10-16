import { afterEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import {
  createFeatures,
  serializeConfig,
  type DecisionSet,
  type SerializedDefinition,
} from '@evanion/feature';

import { inOneRequest } from './in-one-request';
import { currentFeatures, store, type ShopFlags } from './features';
import RootLayout from './layout';
import { Spotlight } from './spotlight';
import { SHOP_SUBJECT_COOKIE, type ShopSubject } from './subject';

/**
 * Holds this app to the feature-flag claim: the flags are resolved on the
 * server, once per page view, from a document shop-api serves, and the client
 * tree receives the answers as plain data.
 *
 * It runs under the `react-server` condition for the reason
 * `access.server.test.tsx` states. The client module the layout mounts is
 * replaced below, because `@evanion/react-feature` creates a context at module
 * scope and React's server build exports no `createContext`.
 */

type Element = React.ReactElement<Record<string, unknown>>;

/** The cookie jar the mocked `next/headers` reads. */
const jar = vi.hoisted(() => new Map<string, string>());

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

vi.mock('next/font/google', () => ({
  Bricolage_Grotesque: () => ({ variable: 'title' }),
  Public_Sans: () => ({ variable: 'text' }),
}));

vi.mock('./feature-shell', () => ({
  FeatureShell: function FeatureShell() {
    return null;
  },
}));

/** Renders the page view for this actor; no cookie is an anonymous visitor. */
function visiting(subject: ShopSubject | null): void {
  jar.clear();
  if (subject) jar.set(SHOP_SUBJECT_COOKIE, JSON.stringify(subject));
}

const OPERATOR: ShopSubject = {
  id: 'staff:ada',
  roles: ['operator'],
  shop: 'stockholm',
};

const SHOPPER: ShopSubject = { id: 'cust-0042', roles: ['customer'], shop: '' };

/**
 * The definitions shop-api serves, with the ramp at zero so a customer is
 * outside it whatever their id hashes to.
 */
const DEFINITIONS: SerializedDefinition<keyof ShopFlags>[] = [
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
    createFeatures<ShopFlags>({ version, features: DEFINITIONS }),
  );
  return { version: config.version, config };
}

const WINGSPAN = {
  urn: 'urn:game:wingspan',
  title: 'Wingspan',
  mechanisms: ['engine building'],
  players: '1-5',
  playtime: '40-70 min',
  complexity: 2.4,
  price: 59900,
  availability: 'in-stock',
  shop: 'stockholm',
  expansions: [],
};

/**
 * Stands in for shop-api. The policy answer is a refusal-free matrix stub, so
 * the spotlight's access gate opens and what is asserted is the flag.
 */
function stubShopApi(version = 'fixture@1') {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      const body = path.endsWith('/features')
        ? featuresDocument(version)
        : path.includes('/games/')
          ? WINGSPAN
          : { urn: WINGSPAN.urn, quantity: 3 };
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}

vi.mock('./access', () => ({
  authorized: async () => ({
    can: () => ({ allowed: true }),
  }),
}));

/** Every element in the tree for which `match` answers true. */
function findAll(
  node: React.ReactNode,
  match: (element: Element) => boolean,
): Element[] {
  if (node == null || typeof node !== 'object') return [];
  if (Array.isArray(node))
    return node.flatMap((child) => findAll(child, match));
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  const own = match(element) ? [element] : [];
  const nested = Object.values(element.props).flatMap((value) =>
    findAll(value as React.ReactNode, match),
  );
  return [...own, ...nested];
}

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement(node)) {
    return Object.values((node as Element).props)
      .map((value) => textOf(value as React.ReactNode))
      .join('');
  }
  return '';
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the flags for a page view', () => {
  it('resolve for the subject the page view renders for', async () => {
    visiting(OPERATOR);
    stubShopApi();

    const operator = await inOneRequest(() => currentFeatures());
    visiting(SHOPPER);
    const shopper = await inOneRequest(() => currentFeatures());

    expect(operator.isEnabled('new-checkout')).toBe(true);
    expect(shopper.isEnabled('new-checkout')).toBe(false);
    expect(shopper.isEnabled('express-pickup')).toBe(false);
  });

  it('fetch the document once for a render that reads them twice', async () => {
    visiting(OPERATOR);
    const calls = stubShopApi();

    await inOneRequest(async () => {
      await Promise.all([currentFeatures(), currentFeatures()]);
    });

    expect(calls.filter((path) => path.endsWith('/features'))).toHaveLength(1);
  });

  it('hand every read the one handle, so they share its instant', async () => {
    visiting(OPERATOR);
    stubShopApi();

    const [first, second] = await inOneRequest(async () => [
      await currentFeatures(),
      await currentFeatures(),
    ]);

    expect(second).toBe(first);
  });
});

describe('the store', () => {
  it('is built once across page views that share a version', async () => {
    visiting(OPERATOR);
    stubShopApi('fixture@1');

    const first = await inOneRequest(() => store());
    const second = await inOneRequest(() => store());

    expect(second.features).toBe(first.features);
  });

  it('is replaced on the next page view after the version moves', async () => {
    visiting(OPERATOR);
    stubShopApi('fixture@1');
    const before = await inOneRequest(() => store());

    stubShopApi('fixture@2');
    const after = await inOneRequest(() => store());

    expect(after.features).not.toBe(before.features);
    expect(after.config.version).toBe('fixture@2');
  });
});

describe('the spotlight', () => {
  it('offers express pickup where the flag resolves on', async () => {
    visiting(OPERATOR);
    stubShopApi();

    const rendered = await inOneRequest(() => Spotlight({ urn: WINGSPAN.urn }));

    expect(textOf(rendered)).toContain('Express pickup');
  });

  it('leaves the line out where the flag resolves off', async () => {
    visiting(SHOPPER);
    stubShopApi();

    const rendered = await inOneRequest(() => Spotlight({ urn: WINGSPAN.urn }));

    expect(textOf(rendered)).not.toContain('Express pickup');
  });
});

describe('the layout', () => {
  /** The props the layout hands the client module that mounts the provider. */
  async function shipped(): Promise<Record<string, unknown>> {
    const tree = await inOneRequest(() =>
      RootLayout({ children: React.createElement('main') }),
    );
    const [shell] = findAll(
      tree,
      (element) =>
        typeof element.type === 'function' &&
        element.type.name === 'FeatureShell',
    );
    if (!shell) throw new Error('the layout mounted no FeatureShell');
    return shell.props;
  }

  it('ships the set the server resolved, at the instant it states', async () => {
    visiting(OPERATOR);
    stubShopApi('fixture@1');

    const props = await shipped();
    const decisions = props['decisions'] as DecisionSet<ShopFlags>;

    expect(decisions.version).toBe('fixture@1');
    expect(decisions.origin).toBe('render');
    expect(decisions.now).toBe(new Date(decisions.now).toISOString());
    expect(decisions.decisions['new-checkout'].enabled).toBe(true);
  });

  it('ships a set that is plain data', async () => {
    visiting(OPERATOR);
    stubShopApi();

    const { decisions } = await shipped();

    expect(JSON.parse(JSON.stringify(decisions))).toEqual(decisions);
  });

  it('ships the document the client builds its own store from', async () => {
    visiting(OPERATOR);
    stubShopApi('fixture@1');

    const props = await shipped();

    expect(props['config']).toEqual(featuresDocument('fixture@1').config);
  });

  it('ships the fields the server bucketed on and no clock of its own', async () => {
    visiting(OPERATOR);
    stubShopApi();

    const props = await shipped();

    expect(props['targetingKey']).toBe('staff:ada');
    expect(props['roles']).toEqual(['operator']);
    expect(props).not.toHaveProperty('now');
  });
});
