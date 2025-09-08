import React from 'react';
import { ERROR_MESSAGES } from './constants';
import type { WidgetProps } from './types';

export function renderWidget<Items extends Record<string, WidgetProps<string>>>(
  item: WidgetProps<string>,
  components: { [K in keyof Items]: React.ComponentType<Items[K]['props']> },
  ItemWrapper: any,
  OutputComponent?: () => React.ReactElement
) {
  if (!(item.type in components)) {
    console.warn(ERROR_MESSAGES.UNKNOWN_WIDGET(item.type, item.id));
    return null;
  }

  const Component = components[item.type satisfies keyof Items];

  return (
    <ItemWrapper
      key={item.id}
      data-widget-id={item.id}
      data-widget-type={item.type}
    >
      <Component
        {...item.props}
        {...(OutputComponent && { Output: OutputComponent })}
      />
    </ItemWrapper>
  );
}
