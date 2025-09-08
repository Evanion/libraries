import { createContext, useContext, useMemo, memo, useCallback } from 'react';
import type { WidgetProps, WidgetsConfig, WidgetsProps } from './types';
import { DefaultItem, DefaultWrapper } from './widgets';
import { renderWidget } from './utils';

export function createWidgets<
  Items extends Record<string, WidgetProps<string>>
>(config: WidgetsConfig<Items>) {
  const {
    components: defaultComponents,
    chrome: defaultChrome,
    context,
  } = config;

  const WidgetsContext = context || createContext(defaultComponents);

  const WidgetsProvider = WidgetsContext.Provider;
  const useWidgets = () => useContext(WidgetsContext);

  const Widgets = memo(function Widgets({
    items,
    components: instanceComponents,
    chrome,
  }: WidgetsProps<Items>) {
    const Wrapper = chrome?.wrapper || defaultChrome?.wrapper || DefaultWrapper;
    const ItemWrapper = chrome?.item || defaultChrome?.item || DefaultItem;
    const components = useMemo(
      () => ({ ...defaultComponents, ...instanceComponents }),
      [instanceComponents]
    );

    // Memoize the Output component creation to prevent unnecessary re-renders
    const createOutputComponent = useCallback(
      (children: WidgetProps<string>[]) => () => <Output items={children} />,
      []
    );

    return (
      <WidgetsProvider value={components}>
        <Wrapper>
          {items.map((item) => {
            const OutputComponent = createOutputComponent(item.children);
            return renderWidget(
              item,
              components,
              ItemWrapper as any,
              OutputComponent
            );
          })}
        </Wrapper>
      </WidgetsProvider>
    );
  });

  // Output component that renders nested widgets using context
  const Output = memo(function Output({
    items,
  }: {
    items?: WidgetProps<string>[];
  }) {
    const components = useWidgets();
    const ItemWrapper = defaultChrome?.item || DefaultItem;

    if (!items || items.length === 0) {
      return null;
    }

    return (
      <>
        {items.map((item) =>
          renderWidget(item, components, ItemWrapper as any)
        )}
      </>
    );
  });

  return { Widgets, WidgetsProvider, useWidgets, Output };
}
