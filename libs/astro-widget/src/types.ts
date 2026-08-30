/** One section, as written by the CMS. */
export interface BlockItem {
  /** Discriminator; must be a key in the registry. */
  type: string;
  /** Optional stable id, useful as a DOM anchor. */
  id?: string;
  /** Nested blocks, forwarded to the component as ordinary prop data.
      The renderer does NOT recurse — Astro projects child content through
      <slot />, not through a `children` prop. A block that wants nesting
      renders <Widgets items={children} registry={registry} /> itself. */
  children?: BlockItem[];
  /** Everything else is passed to the component as props. */
  [key: string]: unknown;
}

/**
 * Maps a block type to an Astro component.
 *
 * Values are deliberately `unknown`: Astro components are opaque at the type
 * level, so unlike @evanion/react-widget we cannot infer each block's props
 * from the component. `validateBlocks` covers that ground at build time.
 */
export type BlockRegistry = Record<string, unknown>;

/** A problem found by `validateBlocks`. */
export interface BlockProblem {
  index: number;
  type: string;
  message: string;
}
