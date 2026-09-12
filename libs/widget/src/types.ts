import type { ComponentProps, ComponentType, ReactNode } from 'react';

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
 * A map of widget type name -> component.
 *
 * This is the type that drives inference for a whole widget set: pass a literal
 * object to {@link createWidgets} and every item's `type` and `props` are
 * checked against it.
 */
export type WidgetComponentMap = Record<string, AnyWidgetComponent>;

/**
 * The props a widget component accepts as *data*, i.e. everything except
 * `children`, which the renderer supplies from the item's nested items.
 *
 * A component that declares no data props resolves to `Record<string, never>`
 * rather than `{}`. TypeScript assigns any object to `{}` without an
 * excess-property check, so `props: { totally: 'bogus' }` on a zero-prop widget
 * would compile clean -- a hole in the "mismatched props is a compile error"
 * guarantee, opening exactly where the component is simplest. An index
 * signature of `never` closes it while still admitting `props: {}`.
 */
export type WidgetDataProps<C extends AnyWidgetComponent> = [
  keyof Omit<ComponentProps<C>, 'children'>,
] extends [never]
  ? Record<string, never>
  : Omit<ComponentProps<C>, 'children'>;

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
  C extends WidgetComponentMap,
  K extends keyof C,
> = 'children' extends keyof ComponentProps<C[K]> ? WidgetItem<C>[] : never;

/**
 * A single item in a widget set, discriminated on `type`.
 *
 * Distributing over the keys of the component map is what makes this checked:
 * `type: 'news'` forces `props` to the props of the `news` component, and an
 * unknown `type` is a compile error rather than a runtime `console.warn`.
 */
export type WidgetItem<C extends WidgetComponentMap> = {
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
     */
    meta?: Record<string, unknown>;
    /**
     * Nested items, rendered as the component's `children`.
     *
     * Typed `never` when the mapped component does not accept `children`, so
     * nesting under a widget that would drop them is a compile error.
     */
    children?: WidgetChildren<C, K>;
  };
}[keyof C & string];

/**
 * Loose item shape, for callers that build item data before a component map
 * exists (a CMS payload, a fixture, a network response).
 *
 * Prefer {@link WidgetItem}, which is checked against the component map.
 */
export interface WidgetProps<Type extends string = string, Props = object> {
  id: string;
  type: Type;
  props: Props;
  meta?: Record<string, unknown>;
  children?: WidgetProps[];
}

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

/** Chrome wrapped around the whole widget set. */
export type WidgetsWrapperComponent = ComponentType<{ children?: ReactNode }>;

/** Chrome wrapped around each individual widget. */
export type WidgetItemComponent = ComponentType<{
  children?: ReactNode;
  'data-widget-id': string;
  'data-widget-type': string;
  /** The item's {@link WidgetItem.meta}, if it has any. */
  meta?: Record<string, unknown>;
}>;

export interface WidgetsChrome {
  wrapper?: WidgetsWrapperComponent;
  item?: WidgetItemComponent;
  /**
   * Rendered while a widget suspends.
   *
   * The `<Suspense>` boundary itself lives in the renderer rather than in
   * `chrome.item`, so replacing the item chrome cannot silently remove it.
   * Defaults to nothing, which is what React renders for a missing fallback.
   */
  suspenseFallback?: ReactNode;
}

/**
 * Configuration for {@link createWidgets}.
 */
export interface WidgetsConfig<C extends WidgetComponentMap> {
  /** The component map. Its shape drives inference for the whole set. */
  components: C;
  chrome?: WidgetsChrome;
}

/**
 * Props of the `Widgets` component returned by {@link createWidgets}.
 */
export interface WidgetsProps<C extends WidgetComponentMap> {
  items: WidgetItem<C>[];
  /** Per-instance component overrides, merged over the factory's map. */
  components?: Partial<C>;
  /** Per-instance chrome overrides. */
  chrome?: WidgetsChrome;
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

/** A problem found by `validateItems`. Mirrors astro-widget's `BlockProblem`. */
export interface WidgetItemProblem {
  /** Index within the item's own sibling list; -1 when the root is not a list. */
  index: number;
  /** The item's `id`, or `-` when it has none usable. */
  id: string;
  /** The item's `type`, or `-` when it has none usable. */
  type: string;
  message: string;
}
