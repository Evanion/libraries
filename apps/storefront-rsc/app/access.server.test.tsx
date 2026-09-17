import { afterEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as React from 'react';
import {
  policy,
  serialize,
  hydratePolicy,
  type Action,
  type MatrixSchema,
} from '@evanion/acl';

import { Activity } from './activity';
import { Catalogue } from './catalogue';
import { currentAccess } from './access';
import { Spotlight } from './spotlight';
import type { Game, TelemetryEvent } from './shop-api';
import { SHOP_SUBJECT_COOKIE, type ShopSubject } from './subject';

/**
 * Holds this app to the access-control claim: every section it renders is
 * decided here, on a document fetched from shop-api and evaluated in this
 * process, and the decision is made before the data behind the section is
 * asked for.
 *
 * It runs under the `react-server` export condition, as `region.server.test.tsx`
 * does and for the same reason, and drives rendering the same way: the component
 * functions are invoked and the returned tree is walked, because `react-dom/server`
 * under this condition is a module whose only statement throws.
 */

type Element = React.ReactElement<Record<string, unknown>>;

/**
 * Every string the tree renders, concatenated in prop order.
 *
 * Element-valued props and not only `children`: `@evanion/baize-ui`'s `Card` takes
 * its head and foot rows as slots, so the staff line the catalogue puts in a foot
 * is text a walk of `children` alone would never reach.
 */
function text(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  if (React.isValidElement(node)) {
    return Object.values((node as Element).props)
      .map((value) => text(value as React.ReactNode))
      .join('');
  }
  return '';
}

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

/** Renders the page view for this actor; no cookie is an anonymous visitor. */
function visiting(subject: ShopSubject | null): void {
  jar.clear();
  if (subject) jar.set(SHOP_SUBJECT_COOKIE, JSON.stringify(subject));
}

const MANAGER: ShopSubject = {
  id: 'staff:ada',
  roles: ['manager'],
  shop: 'stockholm',
};

/**
 * The shapes the fixture matrix's conditions are checked against, as shop-api
 * declares them for the keys it publishes.
 */
const SCHEMA: MatrixSchema = {
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
};

/**
 * What `GET /api/policy` answers with, as the three permissions this app asks
 * about. The rules are shop-api's and its own tests own them; what is asserted
 * here is what this app does with the answers.
 *
 * Authored and serialized rather than written out as JSON, so the document the
 * widgets adopt is a document the library itself produced, marked public the way
 * the published contract is.
 */
const MATRIX = serialize(
  hydratePolicy(
    (() => {
      const authored = policy<
        ShopSubject,
        { game: Game; telemetry: TelemetryEvent },
        { game: Action | 'reprice' }
      >({
        version: 'fixture@1',
        schema: SCHEMA,
      })
        .for('game', (p) =>
          p
            .allow('read', p.always)
            .allow(
              'reprice',
              p.contains('subject.roles', 'manager'),
              p.eq('object.shop', 'subject.shop'),
            ),
        )
        .for('telemetry', (p) =>
          p.allow('read', p.contains('subject.roles', 'manager')),
        ).matrix;
      return {
        ...authored,
        permissions: authored.permissions.map((permission) => ({
          ...permission,
          visibility: 'public' as const,
        })),
      };
    })(),
  ),
  'reduced',
);

const CATALOGUE = [
  {
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
  },
  {
    urn: 'urn:game:brass-birmingham',
    title: 'Brass: Birmingham',
    mechanisms: ['network building'],
    players: '2-4',
    playtime: '60-120 min',
    complexity: 3.9,
    price: 74900,
    availability: 'reprint-pending',
    shop: 'gothenburg',
    expansions: [],
  },
];

const EVENTS = [
  {
    id: 1,
    timestamp: '2026-09-12T08:15:42.000Z',
    correlationId: 'c0ffee-1',
    source: 'inventory',
    type: 'inventory.checked',
  },
];

/** Stands in for shop-api, recording what was asked for and on whose behalf. */
function stubShopApi() {
  const calls: { path: string; subject: string | null }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      const headers = new Headers(init?.headers);
      calls.push({ path, subject: headers.get('x-shop-subject') });
      const urn = decodeURIComponent(path.split('/').at(-1) ?? '');
      const body = path.endsWith('/policy')
        ? { version: MATRIX.version, matrix: MATRIX }
        : path.endsWith('/games')
          ? CATALOGUE
          : path.includes('/games/')
            ? CATALOGUE.find((game) => game.urn === urn)
            : path.includes('/telemetry')
              ? EVENTS
              : { urn, quantity: 12, correlationId: 'c0ffee-1' };
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}

/**
 * React's per-request dispatcher, at the three members this file's rendering
 * reaches. `cache` reads `getCacheForType`, and the development JSX runtime
 * asks the same object for the element owner on every `jsx()` call.
 */
interface CacheDispatcher {
  getCacheForType: <T>(create: () => T) => T;
  cacheSignal: () => null;
  getOwner: () => null;
}

interface ServerInternals {
  A: CacheDispatcher | null;
}

/** Where `cache` looks for the dispatcher, under React's own spelling. */
interface ReactServerBuild {
  __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ServerInternals;
}

/**
 * Runs `render` inside one request's cache scope.
 *
 * `cache(fn)` reads the cache dispatcher off React's server internals and calls
 * `fn` straight through when there is none, so outside a scope like this one it
 * memoises nothing and an assertion about fetching once would hold whatever the
 * app did. Next installs a dispatcher per request; this installs one of the same
 * shape, and restoring the previous value afterwards is what makes two calls to
 * this helper two separate page views.
 */
async function inOneRequest<T>(render: () => Promise<T>): Promise<T> {
  const internals = (React as unknown as ReactServerBuild)
    .__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const store = new Map<unknown, unknown>();
  const previous = internals.A;
  internals.A = {
    getCacheForType: <T2,>(create: () => T2): T2 => {
      if (!store.has(create)) store.set(create, create());
      return store.get(create) as T2;
    },
    cacheSignal: () => null,
    getOwner: () => null,
  };
  try {
    return await render();
  } finally {
    internals.A = previous;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the telemetry widget', () => {
  it('renders nothing for an anonymous visitor, and asks for no events', async () => {
    visiting(null);
    const calls = stubShopApi();

    const rendered = await inOneRequest(() =>
      Activity({ heading: 'Asked of shop-api' }),
    );

    expect(rendered).toBeNull();
    expect(calls.map((call) => call.path)).toEqual(['/api/policy']);
  });

  it('renders for a manager, who the matrix grants telemetry.read', async () => {
    visiting(MANAGER);
    const calls = stubShopApi();

    const rendered = await inOneRequest(() =>
      Activity({ heading: 'Asked of shop-api' }),
    );

    expect(text(rendered)).toContain('inventory.checked');
    expect(calls.map((call) => call.path)).toContain('/api/telemetry');
  });
});

describe('the catalogue', () => {
  it('marks the rows a manager may reprice, and only those', async () => {
    visiting(MANAGER);
    stubShopApi();

    const rendered = await inOneRequest(() =>
      Catalogue({ heading: 'On the table' }),
    );

    // The matrix asks for the row's shop to match the subject's, and the two
    // titles sit in different shops, so one row carries the line and one does
    // not.
    expect(text(rendered).match(/yours to reprice/g)).toHaveLength(1);
  });

  it('marks none of them for a shopper', async () => {
    visiting(null);
    stubShopApi();

    const rendered = await inOneRequest(() =>
      Catalogue({ heading: 'On the table' }),
    );

    expect(text(rendered)).toContain('Wingspan');
    expect(text(rendered)).not.toContain('yours to reprice');
  });
});

describe('the policy document', () => {
  it('is fetched once for a render that mounts every widget', async () => {
    visiting(MANAGER);
    const calls = stubShopApi();

    await inOneRequest(async () => {
      await Promise.all([
        Spotlight({ urn: 'urn:game:wingspan' }),
        Catalogue({ heading: 'On the table' }),
        Activity({ heading: 'Asked of shop-api' }),
      ]);
    });

    const policyCalls = calls.filter((call) => call.path === '/api/policy');
    expect(policyCalls).toHaveLength(1);
  });

  it('is parsed once across page views that share a version', async () => {
    visiting(MANAGER);
    stubShopApi();

    const first = await inOneRequest(() => currentAccess());
    const second = await inOneRequest(() => currentAccess());

    // Two page views, two fetches, one evaluator: the document is frozen and
    // holds no actor, so the second view reuses the parse rather than waiting
    // on its own.
    expect(second).toBe(first);
  });
});

describe('every request this app sends shop-api', () => {
  it('states the subject the page view decided against', async () => {
    visiting(MANAGER);
    const calls = stubShopApi();

    await inOneRequest(() => Spotlight({ urn: 'urn:game:wingspan' }));

    expect(calls).not.toHaveLength(0);
    for (const call of calls) {
      expect(call.subject).toBe(JSON.stringify(MANAGER));
    }
  });
});

describe('@evanion/react-acl', () => {
  /**
   * The constraint the app is built around, asserted rather than assumed.
   *
   * The package opens with `'use client'` and calls `createContext` at module
   * scope. React's `react-server` build exports no `createContext`, so the module
   * throws on evaluation and neither `PolicyProvider` nor a hook is available
   * anywhere in this app's tree. Every gate here therefore calls the core's
   * `can` directly.
   *
   * The source file is imported by path, and the package is nowhere in this
   * app's manifest: a dependency on it is the thing being ruled out, and adding
   * one to test for its absence would make the test the reason the rule is
   * broken.
   */
  it('cannot be evaluated here, because React omits createContext', async () => {
    expect(
      (React as unknown as Record<string, unknown>)['createContext'],
    ).toBeUndefined();

    const source = pathToFileURL(
      join(import.meta.dirname, '../../../libs/react-acl/src/index.tsx'),
    ).href;
    await expect(import(/* @vite-ignore */ source)).rejects.toThrow(
      /createContext/,
    );
  });
});
