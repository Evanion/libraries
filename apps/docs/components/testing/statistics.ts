import data from './statistics.json';

/**
 * The numbers the `/testing` section renders, written by
 * `apps/docs/tools/test-statistics.mjs` during the build that produces the
 * page.
 *
 * The file this imports is a build output and is not in the repository. That
 * is the point: a committed figure is right until somebody lands a change
 * without regenerating it, and the page keeps rendering the old one with
 * nothing to say so. A missing file fails the build instead, which is the
 * signal a failing test run already gives -- a run that fails writes no
 * coverage summary at all.
 *
 * `apps/docs/package.json` orders the generator ahead of this app's build, its
 * lint and its tests.
 */
export const statistics = data;

/** One library's line: what ran, and how much of the package it reached. */
export type Library = (typeof data.libraries)[number];

/** One register entry as `libs/acl/SECURITY.md` states it. */
export type RegisterEntry =
  (typeof data.register.cases)[keyof typeof data.register.cases];

/**
 * The tier's pill state, and the words the pill carries.
 *
 * The shop's stock vocabulary maps onto the register's three tiers without
 * stretching: tier 1 is there and works, tier 2 is available once the consumer
 * does something, tier 3 is not available and saying so is the whole point of
 * the entry. `reprintPending` stays unused, because four states against three
 * tiers would invent a degree the register does not have.
 *
 * The label is the whole accessible name -- the pill's dot is drawn by the
 * stylesheet -- so the words are the register's own.
 */
export const TIERS = {
  '1': { availability: 'inStock', label: 'prevented' },
  '2': { availability: 'preorder', label: 'primitive supplied' },
  '3': { availability: 'outOfPrint', label: 'out of scope' },
} as const;

/** How a count is written wherever the page writes one. */
export function count(value: number): string {
  return value.toLocaleString('en-GB');
}

/** A percentage as the report states it, to two places. */
export function percent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/** The command a reader runs to reproduce one library's counts. */
export function command(library: Library): string {
  return `npx nx test ${library.name}`;
}
