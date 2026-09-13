/**
 * Maps a widget type name to whatever the adapter resolves it to.
 *
 * `T` is the adapter's component type. `@evanion/react-widget` instantiates it
 * as a `ComponentType`, which is what drives its compile-time prop check.
 * `@evanion/astro-widget` leaves it at the default: an `.astro` module's
 * default export is an `AstroComponentFactory` carrying no prop types at all --
 * the props of a `.astro` file live in its frontmatter `Props` interface and
 * are not reachable from the factory's type -- so there is nothing there to
 * infer from and {@link validateItems} covers that ground at build time.
 */
export type WidgetRegistry<T = unknown> = Record<string, T>;

/**
 * The `meta` vocabulary of a widget set whose chrome declares none.
 *
 * Any object, so an item may carry whatever placement data it likes and a
 * chrome that reads `meta` narrows it by hand.
 */
export type WidgetMeta = Record<string, unknown>;

/**
 * Loose item shape, for data built before a registry exists: a CMS payload, a
 * fixture, a network response.
 *
 * This is the whole item model, and every adapter renders exactly this. A
 * renderer that can type its components against the registry offers a checked
 * counterpart -- `@evanion/react-widget`'s `WidgetItem<C>` -- and this is what
 * that one widens to.
 */
export interface AnyWidgetItem<Type extends string = string, Props = object> {
  /** Stable identity for this item, and the key a renderer lists it under. */
  id: string;
  /** Which component to render. Must be a key of the registry. */
  type: Type;
  /**
   * Props for that component.
   *
   * A named field rather than "every key the renderer does not claim for
   * itself". The renderer's own fields would otherwise be reserved words in
   * the CMS's vocabulary, and adding one later would silently take a prop
   * away from every payload already written.
   */
  props: Props;
  /**
   * Placement and presentation data for the item chrome: grid column, span,
   * ordering, CMS edit affordances.
   *
   * Handed to the chrome and never spread into the widget's own props, because
   * where a widget sits is not something the widget should know.
   */
  meta?: WidgetMeta;
  /**
   * Nested items.
   *
   * What a renderer does with them is the runtime's business, and the two
   * runtimes genuinely differ: React renders them as the component's
   * `children`, while an Astro component receives child content through
   * `<slot />` and so is handed them as data to open its own region over.
   */
  children?: AnyWidgetItem[];
}

/** A problem found by {@link validateItems}. */
export interface WidgetProblem {
  /** Index within the item's own sibling list; -1 when the root is not a list. */
  index: number;
  /** The item's `id`, or `-` when it has none usable. */
  id: string;
  /** The item's `type`, or `-` when it has none usable. */
  type: string;
  message: string;
}

/**
 * The set of widget types a list may use.
 *
 * A plain list of names is accepted alongside a registry so that a webhook
 * handler or a CI script can validate CMS payloads without importing the
 * components it will never render.
 */
export type KnownWidgetTypes = WidgetRegistry | readonly string[];
