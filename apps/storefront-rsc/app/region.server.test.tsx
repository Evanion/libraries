import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { Activity } from './activity';
import { Catalogue } from './catalogue';
import { Spotlight } from './spotlight';
import { Widgets, items } from './widgets';

/**
 * Holds this app to the one claim it exists to make: every widget in its region
 * is an async Server Component that fetches its own data, and nothing in their
 * path needs a client directive.
 *
 * It runs under the `react-server` export condition, set in vitest.config.mts,
 * which is the condition Next resolves react under while rendering a Server
 * Component. Rendering is driven by invoking the component functions and
 * walking the tree they return, because under this condition
 * `react-dom/server` resolves to a module whose only statement throws "not
 * supported in React Server Components". Awaiting a component is what React's
 * server renderer does with the promise it returns, and the fetches have
 * happened by the time the tree exists -- which is the assertion.
 */

type Element = React.ReactElement<Record<string, unknown>>;

/** `memo(fn)` is an object, not callable; its `.type` is the render function. */
function renderMemo<P>(
  component: React.MemoExoticComponent<React.ComponentType<P>>,
  props: P,
): React.ReactNode {
  return (component.type as (props: P) => React.ReactNode)(props);
}

function flatten(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...flatten(element.props['children'] as React.ReactNode)];
}

/** Every string the tree renders, concatenated in document order. */
function text(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  if (React.isValidElement(node)) {
    return text((node as Element).props['children'] as React.ReactNode);
  }
  return '';
}

const CATALOGUE = [
  {
    urn: 'urn:game:wingspan',
    title: 'Wingspan',
    mechanisms: ['engine building', 'set collection'],
    players: '1-5',
    playtime: '40-70 min',
    weight: 2.4,
  },
  {
    urn: 'urn:game:brass-birmingham',
    title: 'Brass: Birmingham',
    mechanisms: ['network building'],
    players: '2-4',
    playtime: '60-120 min',
    weight: 3.9,
  },
];

const STOCK: Record<string, number> = {
  'urn:game:wingspan': 12,
  'urn:game:brass-birmingham': 0,
};

const EVENTS = [
  {
    id: 1,
    timestamp: '2026-09-12T08:15:42.000Z',
    correlationId: 'c0ffee-1',
    source: 'inventory',
    type: 'inventory.checked',
  },
];

/**
 * Stands in for shop-api, recording what each widget asked for and when.
 *
 * `delay` is how the region's fetches are timed: without it every response
 * resolves in the same microtask queue drain and a waterfall is
 * indistinguishable from parallel requests.
 */
function stubShopApi(delay = 0) {
  const calls: { path: string; at: number }[] = [];
  const start = performance.now();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const path = new URL(String(input)).pathname;
      calls.push({ path, at: performance.now() - start });
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const urn = decodeURIComponent(path.split('/').at(-1) ?? '');
      const body = path.endsWith('/games')
        ? CATALOGUE
        : path.includes('/games/')
          ? CATALOGUE.find((game) => game.urn === urn)
          : path.includes('/telemetry')
            ? EVENTS
            : { urn, quantity: STOCK[urn], correlationId: 'c0ffee-1' };
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the react-server export condition', () => {
  it('really is active, or every other test in this file proves nothing', () => {
    const react = React as unknown as Record<string, unknown>;
    expect(react['createContext']).toBeUndefined();
    expect(react['useState']).toBeUndefined();
    expect(react['Component']).toBeUndefined();
    expect(React.Suspense).toBeDefined();
  });
});

describe('every widget in the region', () => {
  it('is an async component, and its item carries no data for it', () => {
    for (const widget of [Spotlight, Catalogue, Activity]) {
      expect(widget.constructor.name).toBe('AsyncFunction');
    }
    expect(items.map((item) => Object.keys(item.props))).toEqual([
      ['urn'],
      ['heading'],
      ['heading'],
    ]);
  });

  it('fetches its own endpoint during render', async () => {
    const calls = stubShopApi();

    const spotlight = text(await Spotlight({ urn: 'urn:game:wingspan' }));
    const catalogue = text(await Catalogue({ heading: 'On the table' }));
    const activity = text(await Activity({ heading: 'Asked of shop-api' }));

    expect(calls.map((call) => call.path)).toEqual([
      '/api/games/urn%3Agame%3Awingspan',
      '/api/inventory/urn%3Agame%3Awingspan',
      '/api/games',
      '/api/inventory/urn%3Agame%3Awingspan',
      '/api/inventory/urn%3Agame%3Abrass-birmingham',
      '/api/telemetry',
    ]);
    expect(spotlight).toContain('Wingspan');
    expect(spotlight).toContain('12 in stock');
    expect(catalogue).toContain('Brass: Birmingham');
    expect(catalogue).toContain('40-70 min');
    expect(catalogue).toContain('out of stock');
    expect(activity).toContain('inventory.checked');
    expect(activity).toContain('08:15:42');
  });

  it('is reached through the renderer, each inside its own Suspense boundary', async () => {
    stubShopApi();

    const elements = flatten(renderMemo(Widgets, { items }));
    const boundaries = elements.filter(
      (element) => element.type === React.Suspense,
    );
    expect(boundaries).toHaveLength(items.length);

    for (const component of [Spotlight, Catalogue, Activity]) {
      const widget = elements.find((element) => element.type === component);
      if (!widget)
        throw new Error(`the renderer did not reach ${component.name}`);
      // Each boundary wraps one widget, so the fallback replaces that widget
      // alone rather than the region.
      expect(
        boundaries.some((boundary) =>
          flatten(boundary.props['children'] as React.ReactNode).includes(
            widget,
          ),
        ),
      ).toBe(true);
    }
  });
});

describe('the region under latency', () => {
  /**
   * Where the region's waits are. The test above is what shows React reaching
   * all three widgets in one render pass -- the renderer returns every element
   * synchronously -- and this one shows that none of their fetches waits on
   * another widget once it has. Four of the six requests are in flight before
   * any response has come back. The only wait is the catalogue's second leg,
   * and the data forces it: the urns to ask about come out of its first
   * response.
   *
   * A widget that needed another widget's data would be the finding this test
   * would surface, because the count below would drop. There is no mechanism in
   * the package for one widget to await another, which is the design: a region
   * is siblings, not a graph.
   */
  it('waits only where the data forces it', async () => {
    const delay = 50;
    const calls = stubShopApi(delay);

    await Promise.all([
      Spotlight({ urn: 'urn:game:wingspan' }),
      Catalogue({ heading: 'On the table' }),
      Activity({ heading: 'Asked of shop-api' }),
    ]);

    const first = calls.filter((call) => call.at < delay / 2);
    expect(first).toHaveLength(4);
    const second = calls.filter((call) => call.at >= delay / 2);
    expect(second.map((call) => call.path)).toEqual([
      '/api/inventory/urn%3Agame%3Awingspan',
      '/api/inventory/urn%3Agame%3Abrass-birmingham',
    ]);
  });
});

describe('the app source', () => {
  it('carries no client directive', () => {
    const dir = import.meta.dirname;
    // A directive is the first thing in a module and is written at column 0;
    // anchoring on that is what keeps a comment mentioning it from failing.
    const directive = /^['"]use client['"]/m;
    const offenders = readdirSync(dir)
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => directive.test(readFileSync(join(dir, file), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
