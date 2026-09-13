import { memo } from 'react';
import type {
  RenderableWidgetItem,
  WidgetComponentMap,
  WidgetItem,
  WidgetItemComponent,
  WidgetItemProblem,
  WidgetMeta,
  WidgetsConfig,
  WidgetsProps,
} from './types.js';
import { DefaultItem, DefaultWrapper } from './widgets.js';
import { renderWidget } from './utils.js';
import { validateItems } from './validate-items.js';
import { ERROR_MESSAGES } from './constants.js';
import { warnOnce } from './warn.js';

/**
 * Builds a widget set from a component map.
 *
 * The map drives inference: each item's `type` must be a key of it, and that
 * item's `props` must match the corresponding component's props.
 *
 * Call it once at module scope. There is no provider and no hook, because
 * React's `react-server` export condition has neither `createContext` nor
 * `useContext` and this package has to be importable from a Server Component.
 *
 * The item `meta` vocabulary is inferred from `chrome.item`. Annotate that
 * component with the shape it reads and every item's `meta` is checked against
 * it; leave it unannotated, or pass no chrome, and `meta` stays any object.
 * There is no type argument to pass by hand: `chrome.item` is the only thing
 * that reads `meta`, so a set with no such chrome has nothing to check against,
 * and naming `M` explicitly would cost the inference of `C`.
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
export function createWidgets<
  const C extends WidgetComponentMap,
  M = WidgetMeta,
>(config: WidgetsConfig<C, M>) {
  const { components: defaultComponents, chrome: defaultChrome } = config;

  const Widgets = memo(function Widgets({
    items,
    components: instanceComponents,
    chrome,
    ctx,
  }: WidgetsProps<C, M>) {
    const Wrapper = chrome?.wrapper ?? defaultChrome?.wrapper ?? DefaultWrapper;
    const ItemWrapper = chrome?.item ?? defaultChrome?.item ?? DefaultItem;
    const suspenseFallback =
      chrome?.suspenseFallback ?? defaultChrome?.suspenseFallback;
    // Not memoised. `useMemo` exists under the react-server condition but
    // calling a hook from a Server Component does not, and merging a handful of
    // map entries is cheaper than the hazard.
    const components = instanceComponents
      ? { ...defaultComponents, ...instanceComponents }
      : defaultComponents;

    if (!Array.isArray(items)) {
      warnOnce(ERROR_MESSAGES.MALFORMED_ITEMS);
      return null;
    }

    return (
      <Wrapper>
        {/* The single, documented widening from the checked WidgetItem<C, M>
            union to the renderer's erased view. See RenderableWidgetItem.
            The item chrome is erased with it: the renderer hands it whatever
            `meta` the item carried, and M is what checked that it was the
            right shape. */}
        {(items as unknown as RenderableWidgetItem[]).map((item) =>
          renderWidget(
            item,
            components,
            ItemWrapper as WidgetItemComponent,
            ctx,
            suspenseFallback,
          ),
        )}
      </Wrapper>
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
  const defineItems = (items: WidgetItem<C, M>[]): WidgetItem<C, M>[] => items;

  /**
   * `validateItems` bound to this factory's component map, for data that never
   * met the type checker. `Widgets` does not call it: validation is a loud,
   * explicit gate run at ingestion or build time, and the renderer is the
   * safety net underneath it.
   */
  const boundValidateItems = (items: unknown): WidgetItemProblem[] =>
    validateItems(items, defaultComponents);

  return { Widgets, defineItems, validateItems: boundValidateItems };
}
