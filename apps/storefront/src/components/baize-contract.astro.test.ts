import {
  AvailabilityPill as ReactAvailabilityPill,
  BoxArtPlaceholder as ReactBoxArt,
  Card as ReactCard,
  Figure as ReactFigure,
  MechanismTag as ReactMechanismTag,
  Stat as ReactStat,
  StatLine as ReactStatLine,
  TagRow as ReactTagRow,
  Text as ReactText,
  Title as ReactTitle,
  ComplexityRamp as ReactComplexityRamp,
} from '@evanion/baize-ui';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { createElement as h, Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Game } from '../lib/shop-api.js';
import AvailabilityPill from './AvailabilityPill.astro';
import BoxArt from './BoxArt.astro';
import GameCard from './GameCard.astro';
import MechanismTags from './MechanismTags.astro';
import StatLine from './StatLine.astro';
import ComplexityRamp from './ComplexityRamp.astro';

/**
 * The storefront renders no React, so its `.astro` components are a second
 * implementation of the library's primitives. This is what holds the two in step.
 *
 * Each case renders the Astro component and the React tree it stands for, for the
 * same props, and compares the `(tag, class)` pairs in document order. Keying the
 * CSS on one stylesheet is not enough on its own: a class this app emits and the
 * library renamed styles nothing, and nothing else in either project would fail.
 *
 * **What it catches.** A changed class name, a dropped modifier, a modifier in
 * the wrong order, an extra or missing element, two elements swapped, and a
 * swapped tag name.
 *
 * **What it does not.** Anything outside `class` and the element name:
 * `aria-label`, `role`, `href`, `data-*`, and the text inside an element. An
 * Astro component rendering the right classes around the wrong words passes here;
 * the per-component tests and the page itself are what catch that. It also says
 * nothing about how a class resolves -- the stylesheet is the library's, and the
 * library's own tests cover it.
 *
 * **Tag names are included, and the cost is real.** Without them, an Astro
 * component that drifted from `<span>` to `<div>` with identical classes passes,
 * which silently turns an inline box into a block one. With them, a markup change
 * in a library component fails here until the Astro side makes the same change --
 * which is the point rather than the price: the pair is the contract, and a change
 * to one half the other half has not made is the divergence this file reports.
 *
 * `createElement` rather than JSX, with children in the props object rather than
 * as trailing arguments: this app has no React integration and is not getting one
 * -- `@astrojs/react` to serve one of four consumers is the wrong trade -- so
 * there is no JSX transform here, and `astro check` does not accept the rest
 * parameter as satisfying a required `children` prop.
 */

/** One element, as the comparison sees it. */
interface Node {
  tag: string;
  classes: string;
}

/**
 * Every element in document order, with the classes it carries.
 *
 * A regex over the markup rather than a DOM parse: both sides produce a string of
 * HTML and the comparison is positional, so a parser would only normalise away
 * the differences a mismatch here is reported as.
 */
function nodes(html: string): Node[] {
  return [...html.matchAll(/<([a-z][a-z0-9]*)((?:\s[^>]*)?)>/gi)].map(
    (match) => ({
      tag: (match[1] as string).toLowerCase(),
      classes: /class="([^"]*)"/.exec(match[2] as string)?.[1] ?? '',
    }),
  );
}

async function astro(
  component: Parameters<AstroContainer['renderToString']>[0],
  props: Record<string, unknown>,
): Promise<Node[]> {
  const container = await AstroContainer.create();
  return nodes(await container.renderToString(component, { props }));
}

function react(tree: ReactNode): Node[] {
  return nodes(renderToStaticMarkup(tree));
}

const wingspan: Game = {
  urn: 'urn:game:wingspan',
  title: 'Wingspan',
  mechanisms: ['engine building', 'set collection'],
  players: '1-5',
  playtime: '40-70 min',
  complexity: 2.4,
  price: 59900,
  availability: 'in-stock',
  expansions: [
    {
      urn: 'urn:expansion:wingspan:europe',
      title: 'European Expansion',
      price: 29900,
    },
  ],
};

/** The three stat cells a game card and the feature both render. */
const statCells = [
  h(ReactStat, { figure: '1-5', key: 'p', label: 'players' }),
  h(ReactStat, { figure: '40-70 min', key: 't', label: 'playtime' }),
  h(ReactStat, {
    children: h(ReactComplexityRamp, { label: 'complexity 2.4 of 5', stop: 3 }),
    figure: 'Midweight',
    key: 'w',
    label: 'complexity 2.4 / 5',
  }),
];

/** The two mechanism tags Wingspan carries, each inside its category link. */
const mechanismTags = [
  h(
    'a',
    { className: 'tag-link', href: '/c/engine-building', key: 'a' },
    h(ReactMechanismTag, { label: 'engine building' }),
  ),
  h(
    'a',
    { className: 'tag-link', href: '/c/set-collection', key: 'b' },
    h(ReactMechanismTag, { label: 'set collection' }),
  ),
];

describe('the complexity ramp', () => {
  it('renders the library markup for a mid-scale stop', async () => {
    expect(
      await astro(ComplexityRamp, { label: 'complexity 2.4 of 5', stop: 3 }),
    ).toEqual(
      react(h(ReactComplexityRamp, { label: 'complexity 2.4 of 5', stop: 3 })),
    );
  });

  it('leaves the same pips unfilled at the ends of the scale', async () => {
    for (const stop of [1, 5] as const) {
      expect(
        await astro(ComplexityRamp, { label: `stop ${stop}`, stop }),
      ).toEqual(react(h(ReactComplexityRamp, { label: `stop ${stop}`, stop })));
    }
  });
});

describe('the availability pill', () => {
  it('renders the library markup for every state the catalogue uses', async () => {
    const states = [
      ['in-stock', 'inStock'],
      ['preorder', 'preorder'],
      ['reprint-pending', 'reprintPending'],
      ['out-of-print', 'outOfPrint'],
    ] as const;

    for (const [wire, token] of states) {
      expect(await astro(AvailabilityPill, { availability: wire })).toEqual(
        react(
          h(ReactAvailabilityPill, {
            availability: token,
            label: String(wire),
          }),
        ),
      );
    }
  });
});

describe('the stat line', () => {
  it('renders the library markup, ramp included, at both sizes', async () => {
    for (const size of ['base', 'lg'] as const) {
      expect(
        await astro(StatLine, {
          players: '1-5',
          playtime: '40-70 min',
          size,
          complexity: 2.4,
        }),
      ).toEqual(react(h(ReactStatLine, { children: statCells, size })));
    }
  });
});

describe('the mechanism tags', () => {
  /**
   * The link is the app's and is in both trees: the library carries no router, so
   * a tag that wrapped itself in an anchor would need one.
   */
  it('renders one unhued tag per mechanism, mapped or not', async () => {
    expect(
      await astro(MechanismTags, { mechanisms: wingspan.mechanisms }),
    ).toEqual(react(h(ReactTagRow, { children: mechanismTags })));
  });
});

describe('the box-art placeholder', () => {
  it('renders the library markup for a mapped game', async () => {
    expect(
      await astro(BoxArt, { title: 'Wingspan', urn: wingspan.urn }),
    ).toEqual(react(h(ReactBoxArt, { label: 'Wingspan', palette: 'sky' })));
  });

  it('falls back to the neutral gradient for a game nobody mapped', async () => {
    expect(
      await astro(BoxArt, { title: 'Hive', urn: 'urn:game:hive' }),
    ).toEqual(react(h(ReactBoxArt, { label: 'Hive' })));
  });
});

describe('the game card', () => {
  /**
   * `Fragment` for the head and foot slots, not a wrapping div: `Card` renders
   * each slot inside a row of its own, so a wrapper here would be an element the
   * Astro card does not have and the mismatch would be this file's rather than the
   * card's.
   */
  it('renders the library card, head and foot included', async () => {
    expect(await astro(GameCard, { game: wingspan })).toEqual(
      react(
        h(ReactCard, {
          children: [
            h(ReactTagRow, { children: mechanismTags, key: 'tags' }),
            h(ReactStatLine, { children: statCells, key: 'stats' }),
          ],
          foot: h(Fragment, {
            children: [
              h(ReactFigure, { children: '599 kr', key: 'price' }),
              h(ReactText, {
                as: 'span',
                children: '1 expansion',
                key: 'expansions',
                size: 'sm',
              }),
            ],
          }),
          head: h(Fragment, {
            children: [
              h(ReactTitle, {
                as: 'h3',
                children: h(
                  'a',
                  { className: 'title-link', href: '/g/x' },
                  'Wingspan',
                ),
                complexity: 3,
                key: 'title',
                size: 'sm',
              }),
              h(ReactAvailabilityPill, {
                availability: 'inStock',
                key: 'pill',
                label: 'in stock',
              }),
            ],
          }),
        }),
      ),
    );
  });
});
