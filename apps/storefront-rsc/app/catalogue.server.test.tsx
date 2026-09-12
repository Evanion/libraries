import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { Catalogue } from './catalogue';
import { Widgets, items } from './widgets';

/**
 * Holds this app to the one claim it exists to make: the widget is an async
 * Server Component that fetches its own data, and nothing in its path needs a
 * client directive.
 *
 * It runs under the `react-server` export condition, set in vitest.config.mts,
 * which is the condition Next resolves react under while rendering a Server
 * Component. Rendering is driven by invoking the component functions and
 * walking the tree they return, because under this condition
 * `react-dom/server` resolves to a module whose only statement throws "not
 * supported in React Server Components". Awaiting the component is what React's
 * server renderer does with the promise it returns, and the fetch has happened
 * by the time the tree exists -- which is the whole assertion.
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

/** Stands in for shop-api, and records what the widget asked it for. */
function stubShopApi(): string[] {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      const path = new URL(url).pathname;
      const urn = decodeURIComponent(path.split('/').at(-1) ?? '');
      const body = path.endsWith('/games')
        ? CATALOGUE
        : { urn, quantity: STOCK[urn] };
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

describe('the catalogue widget', () => {
  it('is an async component, and its item carries no data for it', () => {
    expect(Catalogue.constructor.name).toBe('AsyncFunction');
    expect(items.map((item) => Object.keys(item.props))).toEqual([['heading']]);
  });

  it('fetches the catalogue and the stock during render', async () => {
    const calls = stubShopApi();

    const rendered = text(await Catalogue({ heading: 'On the table' }));

    expect(calls[0]).toMatch(/\/games$/);
    expect(calls.slice(1)).toEqual([
      expect.stringContaining('/inventory/urn%3Agame%3Awingspan'),
      expect.stringContaining('/inventory/urn%3Agame%3Abrass-birmingham'),
    ]);
    expect(rendered).toContain('Wingspan');
    expect(rendered).toContain('40-70 min');
    expect(rendered).toContain('2.4');
    expect(rendered).toContain('in stock');
    expect(rendered).toContain('out of stock');
  });

  it('is reached through the widget renderer, inside its Suspense boundary', async () => {
    stubShopApi();

    const elements = flatten(renderMemo(Widgets, { items }));
    expect(elements.some((element) => element.type === React.Suspense)).toBe(
      true,
    );

    const widget = elements.find((element) => element.type === Catalogue);
    if (!widget) throw new Error('the renderer did not reach the widget');

    const rendered = await Catalogue(widget.props as { heading: string });
    expect(text(rendered)).toContain('Wingspan');
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
