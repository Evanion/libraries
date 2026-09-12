/**
 * `@evanion/astro-widget` -- CMS block rendering for Astro.
 *
 * This entry carries the registry helper, the validator and the types.
 * `Widgets.astro` is not among them: an `.astro` module has to be compiled by
 * Astro's own vite plugin, which runs in the consumer's project and not in this
 * package's build, so package.json publishes it as source under
 * `@evanion/astro-widget/components/Widgets.astro`.
 */
export { defineBlocks } from './define-blocks';
export { validateBlocks } from './validate-blocks';
export type { BlockItem, BlockRegistry, BlockProblem } from './types';
