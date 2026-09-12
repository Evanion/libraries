/** One section, as written by the CMS. */
export interface BlockItem {
  /** Discriminator; must be a key in the registry. */
  type: string;
  /** Optional stable id, useful as a DOM anchor. */
  id?: string;
  /**
   * Nested blocks, handed to the component as ordinary prop data.
   *
   * `Widgets.astro` does not recurse into them. An Astro component receives
   * child content through `<slot />` rather than through a `children` prop, so
   * there is nothing for a renderer to pass nested blocks into; a block that
   * wants nesting renders `<Widgets items={children} registry={registry} />`
   * itself.
   */
  children?: BlockItem[];
  /**
   * Placement and presentation data for `chrome.item`: grid column, span,
   * ordering, CMS edit affordances.
   *
   * Handed to the item wrapper and never spread into the block's own props,
   * because where a block sits is not something the block should know.
   */
  meta?: Record<string, unknown>;
  /** Everything else is passed to the component as props. */
  [key: string]: unknown;
}

/**
 * Maps a block type to an Astro component.
 *
 * The values are `unknown` because an `.astro` module's default export is an
 * `AstroComponentFactory`, which carries no prop types at all -- the props of a
 * `.astro` file live in its frontmatter `Props` interface and are not reachable
 * from the factory's type. So there is nothing to infer a block's props from,
 * the way `@evanion/react-widget` infers them from a `ComponentType`, and
 * `validateBlocks` covers that ground at build time instead.
 */
export type BlockRegistry = Record<string, unknown>;

/** A problem found by `validateBlocks`. Mirrors react-widget's `WidgetItemProblem`. */
export interface BlockProblem {
  /** Index within the block's own sibling list; -1 when the root is not a list. */
  index: number;
  /** The block's `type`, or `-` when it has none usable. */
  type: string;
  message: string;
}
