import { createContext, useContext, useMemo, memo } from 'react';
import type { WidgetProps, WidgetsConfig, WidgetsProps } from './types';
import { DefaultItem, DefaultWrapper } from './widgets';
import { renderWidget, NestedWidgetsContext } from './utils';

export function createWidgets<
  Items extends Record<string, WidgetProps<string>>,
>(config: WidgetsConfig<Items>) {
  const {
    components: defaultComponents,
    chrome: defaultChrome,
    context,
  } = config;

  const WidgetsContext = context || createContext(defaultComponents);

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
  }: WidgetsProps<Items>) {
    const Wrapper = chrome?.wrapper || defaultChrome?.wrapper || DefaultWrapper;
    const ItemWrapper = chrome?.item || defaultChrome?.item || DefaultItem;
    const components = useMemo(
      () => ({ ...defaultComponents, ...instanceComponents }),
      [instanceComponents],
    );

    return (
      <WidgetsProvider value={components}>
        <Wrapper>
          {items.map((item) =>
            renderWidget(item, components, ItemWrapper, Output),
          )}
        </Wrapper>
      </WidgetsProvider>
    );
  });

  return { Widgets, WidgetsProvider, useWidgets, Output };
}
