import {
  createFeatures,
  type Decision,
  type EvaluationContext,
} from '@evanion/feature';
import { crowdIds } from '../product/primitives/crowd';

/**
 * The document behind the feature-flag demonstration, and the two moments it is
 * decided: before deploy, for a page, and when a visitor arrives.
 *
 * One flag. The team is rolling out a new product-image gallery, starting on
 * strategy-game pages, to a share of visitors. A build renders many pages, so
 * the build context is the page: it knows the category and no visitor. A
 * strategy page waits for its visitors and any other page is answered before
 * deploy. Every answer on the screen comes from `plan()` and `resolve()` on a
 * store built here by `createFeatures`; `FeatureDemo` renders them and decides
 * nothing. `rollout.test.ts` holds both lanes to direct calls on the same store.
 *
 * Shared by the server, which renders the opening state, and the client island,
 * which renders every state after it.
 */

/** One page of the build. */
export interface Page {
  id: 'brass' | 'azul';
  /** What the picker and the page mock call it. */
  label: string;
  /** The game the page is about. */
  game: string;
  /** The category the build and the request both carry. */
  category: 'strategy' | 'family';
}

/** The pages the picker offers. The gallery's rule names the first one's category. */
export const pages: readonly [Page, Page] = [
  {
    id: 'brass',
    label: 'Brass: Birmingham',
    game: 'urn:game:brass-birmingham',
    category: 'strategy',
  },
  { id: 'azul', label: 'Azul', game: 'urn:game:azul', category: 'family' },
];

/** The two values the reader edits. */
export interface RolloutState {
  /** The page the build is rendering. */
  page: Page['id'];
  /** The `percent` of the gallery's rollout, 0 to 100. */
  percent: number;
}

/** What the demonstration opens on. */
export const openingState: RolloutState = { page: 'brass', percent: 25 };

/** The page a state names. */
export function pageOf(id: Page['id']): Page {
  return pages.find((page) => page.id === id) ?? pages[0];
}

/** The document as a store, built the way the package's docs build one. */
export function buildFeatures(percent: number) {
  return createFeatures([
    {
      key: 'new-gallery',
      enabled: true,
      rules: [
        {
          when: [{ field: 'category', op: 'eq', value: pages[0].category }],
          rollout: { percent, by: 'targetingKey' },
        },
      ],
    },
  ]);
}

/** The store `buildFeatures` returns. */
export type Store = ReturnType<typeof buildFeatures>;

/** What the build knows about a page: its game and category, and no visitor. */
export function pageContext(page: Page): EvaluationContext {
  return { game: page.game, category: page.category };
}

/** What the build leaves for a page. */
export interface BuildLane {
  /** Whether the build still has to leave the gallery to the visitor. */
  waits: boolean;
  /** Whether no visitor of this page can get the new gallery. */
  settledOff: boolean;
}

/** `plan()` for one page. */
export function buildLane(store: Store, page: Page): BuildLane {
  const entry = store.plan(pageContext(page))['new-gallery'];
  return {
    waits: entry.resolved === 'deferred',
    settledOff: entry.resolved === false,
  };
}

/** One visitor and what the document decided for them on this request. */
export interface Visitor {
  id: string;
  gallery: Decision;
}

/** The context a request carries: the page it asked for, and the visitor. */
export function requestContext(page: Page, id: string): EvaluationContext {
  return { ...pageContext(page), targetingKey: id };
}

/** `resolve()` once per visitor. */
export function crowd(store: Store, page: Page): Visitor[] {
  return crowdIds.map((id) => ({
    id,
    gallery: store.resolve(requestContext(page, id))['new-gallery'],
  }));
}

/** How many visitors see the new gallery. */
export function tally(visitors: readonly Visitor[]): number {
  return visitors.filter((visitor) => visitor.gallery.enabled).length;
}

/** What a visitor's dot says on hover, on focus and to a screen reader. */
export function describeVisitor(visitor: Visitor): string {
  return `Visitor ${visitor.id} ${
    visitor.gallery.enabled ? 'sees the new gallery' : 'sees the old gallery'
  }`;
}

/** A run of the document's text, or a value the reader changes. */
export type Segment = { text: string } | { value: 'category' | 'percent' };

/** One line of the document, and the control that writes it, if one does. */
export interface SourceLine {
  segments: readonly Segment[];
  writtenBy?: 'category' | 'percent';
}

/**
 * The document and the two calls that read it, as text.
 *
 * The component fills each `value` with the current state. A line that a control
 * writes is lit while that control is the last one moved, which is how the
 * reader sees which words of the code a control changed.
 */
export const source: readonly SourceLine[] = [
  { segments: [{ text: 'createFeatures([' }] },
  {
    segments: [
      {
        text: `  { key: 'new-gallery', enabled: true,\n    rules: [{\n      when: [{ field: 'category', op: 'eq', value: '${pages[0].category}' }],\n      rollout: { percent: `,
      },
      { value: 'percent' },
      { text: ", by: 'targetingKey' },\n    }] }," },
    ],
    writtenBy: 'percent',
  },
  { segments: [{ text: '])' }] },
  {
    segments: [
      {
        text: "\n// before deploy: one call per page\nfeatures.plan({ game, category: '",
      },
      { value: 'category' },
      { text: "' })" },
    ],
    writtenBy: 'category',
  },
  {
    segments: [
      {
        text: '// when a visitor arrives: one call per request\nfeatures.resolve({ game, category, targetingKey: visitor.id })',
      },
    ],
  },
];
