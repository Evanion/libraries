import type { ComponentProps, ComponentType, Context, ReactNode } from 'react';

/**
 * The prop every widget component receives so it can render its own children.
 * Injected by the renderer; it is never part of the item data.
 */
export interface WidgetOutputProps {
  Output: ComponentType;
}

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
 * The props a widget component accepts as *data*, i.e. everything except the
 * injected {@link WidgetOutputProps.Output}.
 */
export type WidgetDataProps<C extends AnyWidgetComponent> = Omit<
  ComponentProps<C>,
  keyof WidgetOutputProps
>;

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
    /** Props for that component, minus the injected `Output`. */
    props: WidgetDataProps<C[K]>;
    /** Nested items, rendered by the item's injected `Output`. */
    children?: WidgetItem<C>[];
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
  children?: RenderableWidgetItem[];
}

/** Chrome wrapped around the whole widget set. */
export type WidgetsWrapperComponent = ComponentType<{ children?: ReactNode }>;

/** Chrome wrapped around each individual widget. */
export type WidgetItemComponent = ComponentType<{
  children?: ReactNode;
  'data-widget-id': string;
  'data-widget-type': string;
}>;

export interface WidgetsChrome {
  wrapper?: WidgetsWrapperComponent;
  item?: WidgetItemComponent;
}

/**
 * Configuration for {@link createWidgets}.
 */
export interface WidgetsConfig<C extends WidgetComponentMap> {
  /** The component map. Its shape drives inference for the whole set. */
  components: C;
  chrome?: WidgetsChrome;
  /** Supply your own context to share a component map across widget sets. */
  context?: Context<C>;
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
}
