import { createContext, useContext, useMemo, memo } from 'react';
import type {
  RenderableWidgetItem,
  WidgetComponentMap,
  WidgetItem,
  WidgetsConfig,
  WidgetsProps,
} from './types.js';
import { DefaultItem, DefaultWrapper } from './widgets.js';
import { renderWidget, NestedWidgetsContext } from './utils.js';

/**
 * Builds a widget set from a component map.
 *
 * The map drives inference: each item's `type` must be a key of it, and that
 * item's `props` must match the corresponding component's props.
 *
 * @example
 * ```tsx
 * const { Widgets } = createWidgets({
 *   components: { news: NewsTeaser, profile: UserSidebar },
 * });
 *
 * <Widgets items={[
 *   { id: '1', type: 'news', props: { title: 'Hello' } },
 *   { id: '2', type: 'nope', props: {} },  // ← compile error: unknown type
 * ]} />
 * ```
 */
export function createWidgets<const C extends WidgetComponentMap>(
  config: WidgetsConfig<C>,
) {
  const {
    components: defaultComponents,
    chrome: defaultChrome,
    context,
  } = config;

  const WidgetsContext = context || createContext<C>(defaultComponents);

  const WidgetsProvider = WidgetsContext.Provider;
  const useWidgets = () => useContext(WidgetsContext);

  /**
   * Renders the children of whichever widget is currently rendering.
   *
   * Defined once per `createWidgets` call, so its component type is stable for
   * the lifetime of the factory. Previously a new component was built on every
   * render, and because React compares element types by identity that
   * unmounted and remounted every nested subtree on each parent render --
   * discarding child state, effects and focus.
   */
  const Output = memo(function Output() {
    const { items, ItemWrapper } = useContext(NestedWidgetsContext);
    const components = useWidgets();

    if (!items || items.length === 0) {
      return null;
    }

    return (
      <>
        {items.map((item) =>
          renderWidget(item, components, ItemWrapper, Output),
        )}
      </>
    );
  });

  const Widgets = memo(function Widgets({
    items,
    components: instanceComponents,
    chrome,
  }: WidgetsProps<C>) {
    const Wrapper = chrome?.wrapper || defaultChrome?.wrapper || DefaultWrapper;
    const ItemWrapper = chrome?.item || defaultChrome?.item || DefaultItem;
    const components = useMemo(
      () => ({ ...defaultComponents, ...instanceComponents }),
      [instanceComponents],
    );

    return (
      <WidgetsProvider value={components}>
        <Wrapper>
          {/* The single, documented widening from the checked WidgetItem<C>
              union to the renderer's erased view. See RenderableWidgetItem. */}
          {(items as unknown as RenderableWidgetItem[]).map((item) =>
            renderWidget(item, components, ItemWrapper, Output),
          )}
        </Wrapper>
      </WidgetsProvider>
    );
  });

  /**
   * Identity function that supplies the contextual type for an item array.
   *
   * A bare `const items = [{ type: 'news', ... }]` infers `type: string`, which
   * will not narrow to the component map's keys, so the check is lost. Passing
   * the array through here gives TypeScript the contextual type it needs:
   *
   * ```ts
   * const items = defineItems([
   *   { id: '1', type: 'news', props: { title: 'Hello' } },
   *   { id: '2', type: 'nope', props: {} },  // ← compile error
   * ]);
   * ```
   *
   * Not needed when the array is written inline in JSX -- that is already
   * contextually typed. `satisfies WidgetItem<typeof components>[]` works too.
   */
  const defineItems = (items: WidgetItem<C>[]): WidgetItem<C>[] => items;

  return { Widgets, WidgetsProvider, useWidgets, Output, defineItems };
}
