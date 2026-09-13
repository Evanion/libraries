import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CartProvider } from '../app/providers.js';
import { Dashboard, defineDashboardItems } from '../app/regions/dashboard.js';
import {
  Ledger,
  defineLedgerItems,
  ledgerColumns,
} from '../app/regions/ledger.js';
import { Nav, defineNavItems } from '../app/regions/nav.js';
import { Sidebar, defineSidebarItems } from '../app/regions/sidebar.js';

/**
 * The claim this app exists to make: `@evanion/react-widget` renders on the
 * server, in a mainstream framework, with no `'use client'` anywhere in the
 * package and no provider or class error boundary around it.
 *
 * `renderToStaticMarkup` is the same renderer React Router's SSR build calls, so
 * HTML produced here is HTML the server produces. What it does not cover is the
 * document around it, which is why the README also records a `curl` against the
 * running server.
 *
 * Resolution matters as much as rendering: these tests reach the package through
 * its exports map, which means the built `dist/`, not the TypeScript source.
 * Nothing in the repo's own typecheck does that -- `tsconfig.base.json` sets
 * `customConditions: ["@evanion/source"]` -- so a packaging defect would be
 * invisible to every other suite here.
 */

function ssr(element: React.ReactElement): string {
  // A StaticRouter, because the nav and the ledger contain <NavLink> and <Link>.
  // Without a router in scope they throw, which would make a failure here look
  // like a widget problem.
  return renderToStaticMarkup(
    <StaticRouter location="/">{element}</StaticRouter>,
  );
}

describe('the package as the app resolves it', () => {
  it('resolves to built output and that output carries no client directive', () => {
    const resolved = import.meta.resolve('@evanion/react-widget');
    expect(resolved).toMatch(/libs\/react-widget\/dist\/index\.js$/);

    const entry = readFileSync(fileURLToPath(resolved), 'utf-8');
    expect(entry).not.toMatch(/['"]use client['"]/);
    expect(entry).not.toMatch(/\bcreateContext\b/);
    expect(entry).not.toMatch(/\buseContext\b/);
  });
});

describe('the dashboard region', () => {
  const items = defineDashboardItems([
    {
      id: 'stock',
      type: 'stock',
      props: {
        rows: [
          {
            urn: 'urn:game:wingspan',
            title: 'Wingspan',
            mechanism: 'engine building',
            quantity: 12,
            complexity: 2.4,
            availability: 'in stock',
          },
        ],
      },
      meta: { lane: 'main' },
    },
    {
      id: 'shelf',
      type: 'shelf',
      props: { counts: [{ state: 'in stock', titles: 1 }] },
      meta: { lane: 'aside' },
    },
    {
      // A second aside panel, below the first rather than below whatever the
      // main lane's next panel happens to be.
      id: 'trail',
      type: 'trail',
      props: { correlationId: 'cid-1', events: [] },
      meta: { lane: 'aside' },
    },
    {
      id: 'stray',
      type: 'orders',
      props: { orders: [] },
      // Both halves of the guarantee in one item. `DashboardMeta` makes a lane
      // the bed does not declare a compile error, which is why this needs the
      // directive; the region still has to place such an item when it arrives
      // from a payload that never met the type checker, which is what the
      // assertions below check.
      // @ts-expect-error 'left-hand-side' is not a lane the bed declares
      meta: { lane: 'left-hand-side' },
    },
    {
      id: 'memo',
      type: 'memo',
      props: { body: 'Keep twenty Azul on the shelf.' },
      children: [
        {
          id: 'memo-figures',
          type: 'figures',
          props: { figures: [{ label: 'floor', value: '20' }] },
        },
      ],
    },
  ]);

  const html = ssr(
    <Dashboard items={items} ctx={{ shop: 'Baize', asOf: '—' }} />,
  );

  it('renders every widget into the markup', () => {
    expect(html).toContain('data-widget-type="stock"');
    expect(html).toContain('data-widget-type="shelf"');
    expect(html).toContain('data-widget-type="memo"');
    expect(html).toContain('Wingspan');
    expect(html).toContain('Keep twenty Azul on the shelf.');
  });

  it('places each widget from its meta, not from its props', () => {
    expect(html).toContain('grid-column:main');
    expect(html).toContain('grid-column:aside');
    // The stock widget receives no `lane`, so nothing leaks onto a DOM node.
    expect(html).not.toContain('lane="main"');
  });

  it('spans the bed for an item nobody positioned', () => {
    expect(html).toContain('grid-column:full');
  });

  /**
   * Two panels in one lane share one column, so the short one does not hold a
   * row open under itself while the tall one beside it runs on. The bed can
   * only do this because the wrapper is handed the region's items and can read
   * `meta` off them; with children alone it has nothing to group by.
   */
  it('stacks a lane rather than placing each panel on its own row', () => {
    expect([...html.matchAll(/grid-column:aside/g)]).toHaveLength(1);

    const lane = html.slice(
      html.indexOf('grid-column:aside'),
      html.indexOf('grid-column:full'),
    );
    expect(lane).toContain('data-widget-id="shelf"');
    expect(lane).toContain('data-widget-id="trail"');
  });

  /**
   * The point of naming lanes rather than counting columns. Every placement the
   * bed emits is a lane it declares, so no panel can land on a seam of its own
   * or reach past the bed's last line, whatever `meta` holds.
   */
  it('emits only lanes the bed declares, never a line number', () => {
    const placements = [...html.matchAll(/grid-column:([^;"]+)/g)].map(
      (match) => match[1],
    );

    // One band of the fixture is a main/aside pair and two are full-width, so a
    // placement that stopped being emitted at all fails here rather than
    // passing vacuously.
    expect(placements).toHaveLength(4);
    for (const placement of placements) {
      expect(['main', 'aside', 'full']).toContain(placement);
    }
  });

  it('renders a nested item inside its parent', () => {
    const memoAt = html.indexOf('data-widget-type="memo"');
    const nestedAt = html.indexOf('data-widget-type="figures"');
    expect(memoAt).toBeGreaterThan(-1);
    expect(nestedAt).toBeGreaterThan(memoAt);
  });

  it('hands page context to a widget that asks for it', () => {
    expect(html).toContain('Baize');
  });
});

describe('the small regions', () => {
  it('renders the nav with its own chrome', () => {
    const html = ssr(
      <Nav
        items={defineNavItems([
          { id: 'mark', type: 'wordmark', props: { shop: 'Baize' } },
          {
            id: 'operator',
            type: 'operator',
            props: { name: 'Ines Halvard' },
            meta: { align: 'end' },
          },
        ])}
      />,
    );

    expect(html).toContain('aria-label="Sections"');
    expect(html).toContain('margin-inline-start:auto');
    expect(html).toContain('Ines Halvard');
  });

  it('renders the sidebar, including the one widget holding client state', () => {
    const html = ssr(
      <CartProvider>
        <Sidebar
          items={defineSidebarItems([
            { id: 'h', type: 'heading', props: { label: 'Shop' } },
            {
              id: 'states',
              type: 'states',
              props: { counts: [{ state: 'out of print', titles: 1 }] },
              meta: { group: 'start' },
            },
            { id: 'basket', type: 'basket', props: {} },
          ])}
        />
      </CartProvider>,
    );

    expect(html).toContain('aria-label="Shop summary"');
    expect(html).toContain('out of print');
    expect(html).toContain('Nothing to reorder');
  });
});

describe('the ledger region', () => {
  /** One head row, `count` records, one total row. */
  function ledgerOf(count: number) {
    return defineLedgerItems([
      {
        id: 'head',
        type: 'head',
        props: { cells: ['order', 'units'] },
        meta: { emphasis: 'head' },
      },
      ...Array.from({ length: count }, (_unused, index) => ({
        id: `order-${index}`,
        type: 'orderRow' as const,
        props: {
          urn: `urn:order:${index.toString(16).padStart(6, '0')}`,
          correlationId: `admin-${index}`,
          at: '2026-09-12T09:41:07.000Z',
          lines: [{ urn: 'urn:game:azul', quantity: 2 }],
          units: 2,
          outcome: 'confirmed' as const,
          inventoryChecks: 1,
        },
      })),
      {
        id: 'total',
        type: 'total',
        props: { label: `${count} orders`, value: String(count * 2) },
        meta: { emphasis: 'total' },
      },
    ]);
  }

  const Table = ({ children }: { children?: React.ReactNode }) => (
    <div role="table" style={ledgerColumns('1fr auto')}>
      {children}
    </div>
  );

  it('takes its column template from the per-instance chrome override', () => {
    const html = ssr(
      <Ledger items={ledgerOf(1)} chrome={{ wrapper: Table }} />,
    );
    expect(html).toContain('--ledger-columns:1fr auto');
    expect(html).toContain('role="row"');
  });

  /**
   * The size the virtualization spec measured its crossover at. A region this
   * large is the case that spec says needs no package of its own, because
   * `chrome.wrapper` is already the seam a windowed list would replace.
   */
  it('renders 200 records server-side', () => {
    const html = ssr(
      <Ledger items={ledgerOf(200)} chrome={{ wrapper: Table }} />,
    );
    expect(html.match(/data-widget-type="orderRow"/g)).toHaveLength(200);
    expect(html).toContain('200 orders');
  });
});
