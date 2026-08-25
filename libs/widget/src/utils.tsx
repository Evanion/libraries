import React from 'react';
import { ERROR_MESSAGES } from './constants.js';
import type {
  AnyWidgetComponent,
  RenderableWidgetItem,
  WidgetItemComponent,
} from './types.js';

/**
 * Context carrying the current widget's children down to the injected `Output`
 * component, together with the chrome resolved for this render.
 *
 * Passing children through context (rather than closing over them in a
 * freshly-created component) is what keeps `Output` a single stable component
 * type, and what lets nesting recurse to arbitrary depth.
 */
export interface NestedWidgets {
  items: RenderableWidgetItem[];
  ItemWrapper: WidgetItemComponent;
}

const DefaultNestedItemWrapper: WidgetItemComponent = (props) => (
  <div {...props} />
);

export const NestedWidgetsContext = React.createContext<NestedWidgets>({
  items: [],
  ItemWrapper: DefaultNestedItemWrapper,
});

export function renderWidget(
  item: RenderableWidgetItem,
  components: Record<string, AnyWidgetComponent>,
  ItemWrapper: WidgetItemComponent,
  Output: React.ComponentType,
) {
  // `in` walks the prototype chain, so a CMS-supplied type of "constructor",
  // "toString" or "__proto__" would pass this guard and hand React something
  // off Object.prototype. Items are explicitly untrusted input.
  //
  // The truthiness check is not redundant: an own key can still hold undefined,
  // and noUncheckedIndexedAccess makes that possibility explicit.
  const Component = Object.prototype.hasOwnProperty.call(components, item.type)
    ? components[item.type]
    : undefined;

  if (!Component) {
    console.warn(ERROR_MESSAGES.UNKNOWN_WIDGET(item.type, item.id));
    return null;
  }

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
