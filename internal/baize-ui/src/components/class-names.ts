/**
 * The class-name resolvers the components render through.
 *
 * One definition, on `./tokens`, because an `.astro` template needs the same
 * names and must not pull React in to get them. This module is the components'
 * view of it.
 *
 * The lookups only. A component's own modifier classes are the variants of its
 * `cva` recipe, and `modifier()` is what `apps/storefront` resolves the same
 * names with from frontmatter.
 */
export {
  classNames,
  hueClass,
  ladderClass,
  paletteClass,
  platformClass,
  stateClass,
} from '../tokens/class-names.js';
