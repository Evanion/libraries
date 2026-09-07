import React, { Suspense } from 'react';
import { ERROR_MESSAGES, DEFAULT_STYLES } from './constants.js';
import type {
  AnyWidgetComponent,
  RenderableWidgetItem,
  WidgetItemComponent,
} from './types.js';
import { WidgetErrorBoundary } from './widgets.js';

const DefaultLoadingFallback = () => (
  <div style={DEFAULT_STYLES.LOADING}>{ERROR_MESSAGES.LOADING}</div>
);

/** Dev-only warning helper that is stripped in production builds. */
function warn(message: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(message);
  }
}

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
  if (item == null || typeof item !== 'object' || typeof item.type !== 'string') {
    warn(ERROR_MESSAGES.MALFORMED_ITEM(item?.id, item?.type));
    return null;
  }

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
    warn(ERROR_MESSAGES.UNKNOWN_WIDGET(item.type, item.id));
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
        <WidgetErrorBoundary
          widgetId={item.id}
          widgetType={item.type}
        >
          <Suspense fallback={<DefaultLoadingFallback />}>
            <Component {...item.props} Output={Output} />
          </Suspense>
        </WidgetErrorBoundary>
      </ItemWrapper>
    </NestedWidgetsContext.Provider>
  );
}
