import data from './renders.json';

/**
 * What `Widgets.astro` and `validateItems` made of each payload the
 * `/astro-widget/validation` control offers, written by
 * `apps/docs/tools/widget-renders.mjs` during the build that produces the page.
 *
 * The file this imports is a build output and is not in the repository, for
 * the reason `components/testing/statistics.ts` gives: a committed render is
 * right until a widget changes, and the page would go on showing the old HTML.
 * `apps/docs/package.json` orders the generator ahead of this app's build, its
 * lint and its tests.
 */

/** One entry of the list `validateItems` returned. */
export interface Problem {
  index: number;
  id: string;
  type: string;
  message: string;
}

/** One payload, the call the README region makes, and what came back. */
export interface Render {
  /** The README region the payload came from. */
  region: string;
  /** What the picker calls it. */
  label: string;
  /** The first argument, as the region wrote it. Not always a list. */
  items: unknown;
  /** The type names the check and the registry held. */
  known: string[];
  /** Whether the region passed a registry rather than a list of names. */
  registry: boolean;
  /** The third argument, or `null` where the region passed none. */
  required: Partial<Record<string, string[]>> | null;
  problems: Problem[];
  /** What `container.renderToString(Widgets, …)` returned. */
  html: string;
  /** What `Widgets.astro` printed through `console.warn` while rendering. */
  warnings: string[];
}

export const renders: Render[] = data.payloads;
