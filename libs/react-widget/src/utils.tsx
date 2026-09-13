import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { ERROR_MESSAGES, warnOnce } from '@evanion/widget';
import type {
  AnyWidgetComponent,
  RenderableWidgetItem,
  WidgetItemComponent,
  WidgetSuspenseMode,
} from './types.js';

/**
 * Renders one item and, recursively, its nested items as that item's children.
 *
 * Internal: not re-exported from the package barrel, so the nesting mechanism
 * stays free to change without a breaking release.
 *
 * The `<Suspense>` boundary lives here rather than in the item chrome, so a
 * custom `chrome.item` cannot silently remove it. `suspense` decides whether
 * there is one to remove; it comes from the chrome, which is the only place
 * that knows whether the region's widgets suspend.
 */
export function renderWidget(
  item: RenderableWidgetItem,
  components: Record<string, AnyWidgetComponent>,
  ItemWrapper: WidgetItemComponent,
  ctx: Record<string, unknown> | undefined,
  suspenseFallback: ReactNode,
  suspense: WidgetSuspenseMode,
): ReactNode {
  if (
    item == null ||
    typeof item !== 'object' ||
    typeof item.type !== 'string'
  ) {
    warnOnce(ERROR_MESSAGES.MALFORMED_ITEM(item?.id, item?.type));
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
    warnOnce(ERROR_MESSAGES.UNKNOWN_WIDGET(item.type, item.id));
    return null;
  }

  let children: RenderableWidgetItem[] = [];
  if (item.children !== undefined) {
    if (Array.isArray(item.children)) {
      children = item.children;
    } else {
      warnOnce(ERROR_MESSAGES.MALFORMED_CHILDREN(item.id));
    }
  }

  const body = (
    // `ctx` follows the spread, so the renderer's value wins over anything an
    // item carries under that name -- including when the renderer has none and
    // the widget is handed undefined. `ctx` is page-level data from
    // `<Widgets ctx={…}>` and items are untrusted input, so a payload naming a
    // `ctx` prop does not get to supply one. `WidgetDataProps` omits `ctx`, so
    // a typed item cannot express this at all.
    <Component {...item.props} ctx={ctx}>
      {children.map((child) =>
        renderWidget(
          child,
          components,
          ItemWrapper,
          ctx,
          suspenseFallback,
          suspense,
        ),
      )}
    </Component>
  );

  return (
    <ItemWrapper
      key={item.id}
      data-widget-id={item.id}
      data-widget-type={item.type}
      meta={item.meta}
    >
      {suspense === 'none' ? (
        body
      ) : (
        <Suspense fallback={suspenseFallback}>{body}</Suspense>
      )}
    </ItemWrapper>
  );
}
