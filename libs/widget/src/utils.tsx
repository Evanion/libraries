import React from 'react';
import { ERROR_MESSAGES } from './constants';
import type { WidgetProps } from './types';

/**
 * Chrome component wrapped around every rendered widget.
 */
export type ItemWrapperComponent = React.ComponentType<
  React.PropsWithChildren<{
    'data-widget-id': string;
    'data-widget-type': string;
  }>
>;

/**
 * Context carrying the current widget's children down to the injected `Output`
 * component, together with the chrome that was resolved for this render.
 *
 * Passing children through context (rather than closing over them in a
 * freshly-created component) is what keeps `Output` a single stable component
 * type, and what lets nesting recurse to arbitrary depth.
 */
export interface NestedWidgets {
  items: WidgetProps<string>[];
  ItemWrapper: ItemWrapperComponent;
}

export const NestedWidgetsContext = React.createContext<NestedWidgets>({
  items: [],
  ItemWrapper: (props) => <div {...props} />,
});

export function renderWidget<Items extends Record<string, WidgetProps<string>>>(
  item: WidgetProps<string>,
  components: { [K in keyof Items]: React.ComponentType<Items[K]['props']> },
  ItemWrapper: ItemWrapperComponent,
  Output: React.ComponentType,
) {
  // `in` walks the prototype chain, so a CMS-supplied type of "constructor",
  // "toString" or "__proto__" would pass this guard and hand React something
  // off Object.prototype. Items are explicitly untrusted input.
  if (!Object.prototype.hasOwnProperty.call(components, item.type)) {
    console.warn(ERROR_MESSAGES.UNKNOWN_WIDGET(item.type, item.id));
    return null;
  }

  const Component = components[item.type];
  const children = item.children ?? [];

  return (
    // Each widget provides its own children, so a nested `Output` renders that
    // widget's children rather than its parent's -- at any depth.
    <NestedWidgetsContext.Provider
      key={item.id}
      value={{ items: children, ItemWrapper }}
    >
      <ItemWrapper data-widget-id={item.id} data-widget-type={item.type}>
        <Component {...item.props} Output={Output} />
      </ItemWrapper>
    </NestedWidgetsContext.Provider>
  );
}
