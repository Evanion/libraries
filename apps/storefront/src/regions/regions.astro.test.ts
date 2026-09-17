import Widgets from '@evanion/astro-widget/components/Widgets.astro';
import { validateItems, type AnyWidgetItem } from '@evanion/astro-widget';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import landing from '../data/landing.json';
import navigation from '../data/navigation.json';
import sidebar from '../data/sidebar.json';
import type { Game } from '../lib/shop-api.js';
import Probe from './__fixtures__/Probe.astro';
import ContentSection from './content/ContentSection.astro';
import { groupRegistry, groupRequired } from './content/group.registry.js';
import { contentRegistry, contentRequired } from './content/registry.js';
import GridCell from './listing/GridCell.astro';
import {
  listingItems,
  listingRegistry,
  listingRequired,
} from './listing/registry.js';
import NavItem from './navigation/NavItem.astro';
import {
  navigationRegistry,
  navigationRequired,
} from './navigation/registry.js';
import SidebarPanel from './sidebar/SidebarPanel.astro';
import { sidebarRegistry, sidebarRequired } from './sidebar/registry.js';

/**
 * The storefront's regions, rendered through Astro's container API.
 *
 * Each region is a registry, a chrome pair and a list of items, and what this
 * file asserts is the seam between them: that placement reaches the chrome and
 * not the widget, that page context reaches the widget, and that a type a
 * region's registry does not hold renders nothing.
 */

const games: Game[] = [
  {
    urn: 'urn:game:brass-birmingham',
    title: 'Brass: Birmingham',
    mechanisms: ['economic', 'network building'],
    players: '2-4',
    playtime: '60-120 min',
    complexity: 3.9,
    price: 74900,
    availability: 'reprint-pending',
    shop: 'gothenburg',
    expansions: [],
  },
  {
    urn: 'urn:game:spirit-island',
    title: 'Spirit Island',
    mechanisms: ['co-op', 'area control'],
    players: '1-4',
    playtime: '90-120 min',
    complexity: 4,
    price: 84900,
    availability: 'in-stock',
    shop: 'stockholm',
    expansions: [
      {
        urn: 'urn:expansion:spirit-island:jagged-earth',
        title: 'Jagged Earth',
        price: 89900,
      },
    ],
  },
];

const ctx = { games, cartCopies: 3, path: '/c/co-op', category: 'co-op' };

async function render(props: Record<string, unknown>) {
  const container = await AstroContainer.create();
  return container.renderToString(Widgets, { props });
}

describe('the authored region data', () => {
  it.each([
    ['navigation', navigation.items, navigationRegistry, navigationRequired],
    ['sidebar', sidebar.items, sidebarRegistry, sidebarRequired],
  ] as const)(
    '%s validates against its registry',
    (_name, items, registry, required) => {
      expect(
        validateItems(items as AnyWidgetItem[], registry, required),
      ).toEqual([]);
    },
  );

  it('landing validates except for the types it deliberately holds', () => {
    // Two unknown types on purpose, one nested: the landing data is the case
    // that proves an unrecognised item is skipped rather than fatal, which is
    // what a CMS sending a type the deploy does not have yet looks like.
    const problems = validateItems(
      landing.items as AnyWidgetItem[],
      { ...contentRegistry, ...groupRegistry },
      { ...contentRequired, ...groupRequired },
    );

    expect(problems).toEqual([
      {
        index: 3,
        id: 'skipped-nested',
        type: 'kort',
        message: 'unknown widget type',
      },
      {
        index: 5,
        id: 'skipped',
        type: 'nyhetsbrev',
        message: 'unknown widget type',
      },
    ]);
  });
});

describe('the navigation region', () => {
  it('renders one item per link, wrapped in the nav chrome', async () => {
    const html = await render({
      items: navigation.items,
      registry: navigationRegistry,
      ctx,
      chrome: { item: NavItem },
    });

    expect([...html.matchAll(/data-nav="([a-z]+)"/g)].map((m) => m[1])).toEqual(
      ['link', 'link', 'cart'],
    );
  });

  it('places the cart item by its meta, which the blocks never see', async () => {
    const html = await render({
      items: navigation.items,
      registry: navigationRegistry,
      ctx,
      chrome: { item: NavItem },
    });

    expect(html).toContain('data-align="end"');
  });

  it('takes the cart count from ctx, because no editor can author it', async () => {
    const html = await render({
      items: navigation.items,
      registry: navigationRegistry,
      ctx,
      chrome: { item: NavItem },
    });

    expect(html).toContain('cart (3)');
  });

  it('marks the current path, so the nav follows the request', async () => {
    const html = await render({
      items: navigation.items,
      registry: navigationRegistry,
      ctx,
      chrome: { item: NavItem },
    });

    expect(html).toContain('href="/c/co-op" aria-current="page"');
  });
});

describe('the content region', () => {
  it('renders each known widget in order', async () => {
    const html = await render({
      items: landing.items,
      registry: contentRegistry,
      ctx,
      chrome: { item: ContentSection },
    });

    // Scoped to the region's own chrome: the nested group region and the
    // listing region inside the catalogue widget write `data-block` too.
    expect(
      [...html.matchAll(/class="section" data-block="([a-z]+)"/g)].map(
        (m) => m[1],
      ),
    ).toEqual(['feature', 'catalogue', 'group', 'mechanisms', 'prose']);
  });

  it('skips a type its registry does not hold', async () => {
    const html = await render({
      items: landing.items,
      registry: contentRegistry,
      ctx,
      chrome: { item: ContentSection },
    });

    expect(html).not.toContain('Not a registered type');
  });

  it('hands meta to the chrome', async () => {
    const html = await render({
      items: landing.items,
      registry: contentRegistry,
      ctx,
      chrome: { item: ContentSection },
    });

    expect(html).toContain('data-width="measure"');
    expect(html).toContain('data-first="true"');
  });

  it('never spreads meta into a widget', async () => {
    // No chrome here on purpose: the chrome legitimately renders the meta it was
    // given, and this is an assertion about what the block did not receive.
    const html = await render({
      items: [
        {
          id: 'p1',
          type: 'probe',
          props: { heading: 'Seen' },
          meta: { width: 'measure' },
        },
      ],
      registry: { probe: Probe },
    });

    expect(html).toContain('&quot;heading&quot;:&quot;Seen&quot;');
    expect(html).not.toContain('meta');
    expect(html).not.toContain('measure');
  });

  it('renders the group widget nested region, with its own cell chrome', async () => {
    const html = await render({
      items: landing.items,
      registry: contentRegistry,
      ctx,
      chrome: { item: ContentSection },
    });

    expect([
      ...html.matchAll(/class="group__cell"[^>]*data-block="card"/g),
    ]).toHaveLength(3);
  });

  it('skips an unregistered type inside the nested region too', async () => {
    const html = await render({
      items: landing.items,
      registry: contentRegistry,
      ctx,
      chrome: { item: ContentSection },
    });

    expect(html).not.toContain('Not a registered nested type');
  });
});

describe('the sidebar region', () => {
  it('wraps every item in the sidebar chrome, not the content chrome', async () => {
    const html = await render({
      items: sidebar.items,
      registry: sidebarRegistry,
      ctx,
      chrome: { item: SidebarPanel },
    });

    expect(
      [...html.matchAll(/sidebar__panel[^>]*data-block="([a-z]+)"/g)].map(
        (m) => m[1],
      ),
    ).toEqual(['filter', 'hours', 'promo']);
  });

  it('pins the panel meta says to pin', async () => {
    const html = await render({
      items: sidebar.items,
      registry: sidebarRegistry,
      ctx,
      chrome: { item: SidebarPanel },
    });

    expect(html).toContain('data-sticky="true"');
  });

  it('marks the open category from ctx', async () => {
    const html = await render({
      items: sidebar.items,
      registry: sidebarRegistry,
      ctx,
      chrome: { item: SidebarPanel },
    });

    expect(html).toContain('href="/c/co-op" aria-current="page"');
  });
});

describe('the listing region', () => {
  it('renders one cell per game', async () => {
    const html = await render({
      items: listingItems(games, '/'),
      registry: listingRegistry,
      chrome: { item: GridCell },
    });

    expect([...html.matchAll(/baize-card-grid__cell/g)]).toHaveLength(2);
  });

  it('widens the cell of the featured urn and no other', async () => {
    const html = await render({
      items: listingItems(games, '/', 'urn:game:spirit-island'),
      registry: listingRegistry,
      chrome: { item: GridCell },
    });

    expect([...html.matchAll(/data-span="(\d)"/g)].map((m) => m[1])).toEqual([
      '1',
      '2',
    ]);
  });

  it('builds items every widget type in its registry can render', () => {
    expect(
      validateItems(listingItems(games, '/'), listingRegistry, listingRequired),
    ).toEqual([]);
  });

  it('titles each game on its complexity rung, and nowhere else', async () => {
    const html = await render({
      items: listingItems(games, '/'),
      registry: listingRegistry,
      chrome: { item: GridCell },
    });

    // The rung is a class the library's stylesheet binds, not an inline colour.
    // Both of these titles are rated 3.9 or over, which is the top tier.
    expect(html).toContain('baize-ladder-5');
    expect(html).toContain('Brain-burner');

    // The colour ladder carries complexity and nothing else: a mechanism reaches
    // a card as a tag with a name on it and no hue of its own.
    expect(html).not.toContain('baize-hue-');
  });
});
