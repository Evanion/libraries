import { createWidgets, type WidgetItemComponent } from '@evanion/react-widget';
import type { ReactNode } from 'react';
import { Cards, Colophon, Hero, Pair, Rows } from './sections';

/**
 * What the landing page's item chrome reads off an item's `meta`.
 *
 * Placement, and nothing a section decides for itself: which ground it sits on
 * and whether a hairline separates it from the section above. Annotating the
 * chrome with this shape is what makes every item's `meta` in `items.ts` a
 * compile-time check rather than an object the page hopes it spelt right.
 */
export interface LandingMeta {
  /**
   * `felt` raises the section onto the material the cards are made of, which
   * is what the hero sits on. Omitted, the section is on the page itself.
   */
  ground?: 'felt';
  /** A hairline across the top of the section. */
  rule?: true;
}

/**
 * The chrome around one section: the landmark, the width, the ground.
 *
 * `data-widget-id` and `data-widget-type` arrive from the renderer and go onto
 * the element, which is what a CMS overlay or an end-to-end test keys off.
 * `meta` is read here and goes no further -- the section inside knows nothing
 * about where it was put, which is the whole point of `meta`.
 */
const Section: WidgetItemComponent<LandingMeta> = ({
  children,
  meta,
  ...rest
}) => (
  <section
    {...rest}
    className="landing-section"
    data-ground={meta?.ground}
    data-rule={meta?.rule ? '' : undefined}
  >
    <div className="landing-section__inner">{children}</div>
  </section>
);

/** The chrome around the whole region: the page's main landmark. */
function Region({ children }: { children?: ReactNode }) {
  return <main className="landing">{children}</main>;
}

/**
 * The landing page's widget set: five section types, one chrome.
 *
 * `suspense: 'none'` because every section here is synchronous. Under
 * `per-item`, React's streaming renderer outlines a boundary the shell passed
 * before it finished into a trailing `<div hidden>` plus an inline script that
 * moves it into place; on a static export that is HTML pagefind indexes out of
 * order and a reader with scripts off never sees.
 */
export const { Widgets, defineItems } = createWidgets({
  components: {
    hero: Hero,
    pair: Pair,
    cards: Cards,
    rows: Rows,
    colophon: Colophon,
  },
  chrome: {
    item: Section,
    wrapper: Region,
    suspense: 'none',
  },
});
