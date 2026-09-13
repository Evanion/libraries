import type { ComponentProps, ComponentType, ReactNode } from 'react';
import type { WidgetMeta, WidgetRegistry } from '@evanion/widget';

// `WidgetRegistry<AnyWidgetComponent>` is this package's component map, and it
// is written out at each use below rather than aliased to a name of its own.
// One noun for the registry across the family is the point of the core; an
// alias per adapter is what the family had before.

/**
 * Any widget component, for use in a generic *constraint*.
 *
 * `any` is load-bearing here and cannot be tightened. `ComponentType<unknown>`
 * would reject a component with concrete props, because component props are
 * contravariant -- a `ComponentType<{title: string}>` is not assignable to a
 * `ComponentType<unknown>`. TypeScript offers no "some component, props
 * unknown" type for this position.
 *
 * This does not weaken inference: `ComponentProps<C[K]>` below resolves against
 * the concrete component that was actually passed, not against this constraint.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWidgetComponent = ComponentType<any>;

/**
 * The props a widget component accepts as *data*: everything except `children`,
 * which the renderer supplies from the item's nested items, and `ctx`, which it
 * supplies from `<Widgets ctx={…}>`.
 *
 * Both are the renderer's to provide, so neither belongs in an item. Leaving
 * `ctx` in made a component that declares it required uneditable from data --
 * every item had to repeat a value the renderer was going to overwrite anyway
 * (TS2322) -- and made an item look able to supply one when it could not.
 *
 * A component that declares no data props resolves to `Record<string, never>`
 * rather than `{}`. TypeScript assigns any object to `{}` without an
 * excess-property check, so `props: { totally: 'bogus' }` on a zero-prop widget
 * would compile clean -- a hole in the "mismatched props is a compile error"
 * guarantee, opening exactly where the component is simplest. An index
 * signature of `never` closes it while still admitting `props: {}`.
 */
export type WidgetDataProps<C extends AnyWidgetComponent> = [
  keyof Omit<ComponentProps<C>, 'children' | 'ctx'>,
] extends [never]
  ? Record<string, never>
  : Omit<ComponentProps<C>, 'children' | 'ctx'>;

/**
 * The item's nested items when `C[K]` accepts `children`, and `never` when it
 * does not.
 *
 * `never` is what makes `children` unwritable on such an item. The alternative
 * -- `WidgetItem<C>[]` on every variant of the union -- admits nesting under a
 * widget that never renders `children`, and the renderer then drops the whole
 * nested subtree with no compile error and nothing logged.
 */
export type WidgetChildren<
  C extends WidgetRegistry<AnyWidgetComponent>,
  K extends keyof C,
  M = WidgetMeta,
> = 'children' extends keyof ComponentProps<C[K]> ? WidgetItem<C, M>[] : never;

/**
 * A single item in a widget set, discriminated on `type`.
 *
 * Distributing over the keys of the component map is what makes this checked:
 * `type: 'news'` forces `props` to the props of the `news` component, and an
 * unknown `type` is a compile error rather than a runtime `console.warn`.
 *
 * `M` is the set's `meta` vocabulary, inferred from `chrome.item`. It does not
 * distribute over `keyof C`: one chrome reads every item's `meta`, so there is
 * one `M` per set rather than one per widget type, and `meta?: M` adds no
 * members to the union above.
 */
export type WidgetItem<
  C extends WidgetRegistry<AnyWidgetComponent>,
  M = WidgetMeta,
> = {
  [K in keyof C & string]: {
    /** Stable identity for this item; used as the React key. */
    id: string;
    /** Which component to render. Must be a key of the component map. */
    type: K;
    /** Props for that component, minus `children`. */
    props: WidgetDataProps<C[K]>;
    /**
     * Placement and presentation data for the item chrome: grid column, span,
     * ordering, CMS edit affordances. Handed to `chrome.item` and never
     * spread into the widget's own props, because where a widget sits is not
     * something the widget should know, and an unknown key spread onto a DOM
     * element draws a React unknown-attribute warning.
     *
     * Typed `M`, the vocabulary `chrome.item` declares, so a key that chrome
     * does not read is a compile error rather than an item that renders in a
     * place its author did not choose.
     */
    meta?: M;
    /**
     * Nested items, rendered as the component's `children`.
     *
     * Typed `never` when the mapped component does not accept `children`, so
     * nesting under a widget that would drop them is a compile error.
     */
    children?: WidgetChildren<C, K, M>;
  };
}[keyof C & string];

/**
 * Type-erased view of an item, used internally by the renderer.
 *
 * The checked {@link WidgetItem} union is widened to this exactly once, at the
 * boundary between the public props and the render loop. Spreading the
 * discriminated union directly onto a component makes TypeScript give up with
 * "union type that is too complex to represent" (TS2590), and the renderer
 * gains nothing from the discrimination -- it looks the type up at runtime.
 */
export interface RenderableWidgetItem {
  id: string;
  type: string;
  props: Record<string, unknown>;
  meta?: Record<string, unknown>;
  children?: RenderableWidgetItem[];
}

/**
 * Chrome wrapped around the whole widget set.
 *
 * It is handed the region's items as well as the rendered children, because a
 * container that decides where things go has to know what they are. Without
 * them a wrapper can only reach its children through `Children.toArray`, whose
 * positional `.$` keys lose item identity across a reorder -- and which walks
 * the `<Suspense>` elements `renderWidget` creates rather than the items, so an
 * item cannot be recovered from its child even positionally.
 */
export type WidgetsWrapperComponent = ComponentType<{
  children?: ReactNode;
  /**
   * The region's items, type-erased, in the order they render.
   *
   * Positionally aligned with `children`: `Widgets` drops an item the renderer
   * skipped -- malformed, or a type the registry does not hold -- from both at
   * once, so index `i` of one is always index `i` of the other. A wrapper may
   * therefore key, size, group or window by item.
   *
   * Optional, so a wrapper that does not care declares nothing and
   * {@link DefaultWrapper} ignores it. Only the region's top-level items: a
   * nested item's siblings belong to whatever widget opened a region over them.
   */
  items?: readonly RenderableWidgetItem[];
}>;

/**
 * Chrome wrapped around each individual widget.
 *
 * Annotating one of these with a `meta` vocabulary is what types the whole
 * set's `meta`: `createWidgets` infers its `M` from the `chrome.item` it is
 * given, so an item's `meta` is checked against what this component reads.
 */
export type WidgetItemComponent<M = WidgetMeta> = ComponentType<{
  children?: ReactNode;
  'data-widget-id': string;
  'data-widget-type': string;
  /** The item's {@link WidgetItem.meta}, if it has any. */
  meta?: M;
}>;

/**
 * How many `<Suspense>` boundaries a region gets.
 *
 * `per-item` gives every widget its own, so one slow widget does not hold up
 * its siblings. `none` gives the region none at all, for a region whose widgets
 * are all synchronous.
 *
 * React's streaming SSR outlines a boundary it has not finished by the time the
 * shell passes `progressiveChunkSize` (12,800 bytes by default), whether or not
 * anything in it suspended: the content goes into a trailing `<div hidden>` and
 * an inline `$RC` script moves it into place. A client that does not run that
 * script -- scripts off, or a CSP rejecting inline script without a nonce --
 * never sees it.
 *
 * There is no region-wide setting, because one boundary around the whole set
 * outlines the whole set: measured over 150 synchronous items, `per-item` keeps
 * 5 of them in the shell and a single region boundary keeps none. A caller who
 * wants one boundary writes `<Suspense>` around `<Widgets>` and sets `none`.
 */
export type WidgetSuspenseMode = 'per-item' | 'none';

export interface WidgetsChrome<M = WidgetMeta> {
  wrapper?: WidgetsWrapperComponent;
  item?: WidgetItemComponent<M>;
  /**
   * Whether each widget gets its own `<Suspense>` boundary. Defaults to
   * `per-item`.
   *
   * Only the region's author knows whether its widgets suspend. The renderer
   * cannot tell: a component calling `use(promise)` is indistinguishable from a
   * synchronous one, and `memo()` and downlevelled `async` hide the rest, so a
   * guess would drop the boundary from widgets that do suspend.
   *
   * Under `none` a widget that suspends anyway suspends whatever boundary is
   * above the region, up to the page.
   */
  suspense?: WidgetSuspenseMode;
  /**
   * Rendered while a widget suspends.
   *
   * The `<Suspense>` boundary itself lives in the renderer rather than in
   * `chrome.item`, so replacing the item chrome cannot silently remove it.
   * Defaults to nothing, which is what React renders for a missing fallback.
   * The library has no shape to draw here: a region is a dashboard grid or a
   * table of rows depending on the consumer, and one generic skeleton would be
   * wrong in both.
   */
  suspenseFallback?: ReactNode;
}

/**
 * Configuration for {@link createWidgets}.
 */
export interface WidgetsConfig<
  C extends WidgetRegistry<AnyWidgetComponent>,
  M = WidgetMeta,
> {
  /** The component map. Its shape drives inference for the whole set. */
  components: C;
  chrome?: WidgetsChrome<M>;
}

/**
 * Props of the `Widgets` component returned by {@link createWidgets}.
 */
export interface WidgetsProps<
  C extends WidgetRegistry<AnyWidgetComponent>,
  M = WidgetMeta,
> {
  items: WidgetItem<C, M>[];
  /** Per-instance component overrides, merged over the factory's map. */
  components?: Partial<C>;
  /**
   * Per-instance chrome overrides.
   *
   * Typed against the factory's `M`, so an override may replace the item
   * chrome but not the `meta` vocabulary the set's items were checked against.
   */
  chrome?: WidgetsChrome<M>;
  /**
   * Page-level data handed to every widget as a `ctx` prop.
   *
   * The counterpart to `@evanion/astro-widget`'s `ctx`. There is no context
   * provider doing this, deliberately: React's `react-server` condition has no
   * `createContext`, and this package has to be importable from a Server
   * Component.
   */
  ctx?: Record<string, unknown>;
}
