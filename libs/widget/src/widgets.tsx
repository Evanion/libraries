import type { HTMLProps } from 'react';

/**
 * Default chrome around the whole set: a `<section>` carrying whatever props it
 * is handed.
 *
 * `<section>` rather than `<div>` because a named section maps to the `region`
 * landmark role (HTML-AAM), so a caller who passes `aria-label` gets a widget
 * region that is reachable by landmark navigation and one who does not is no
 * worse off than with a `<div>`.
 */
export function DefaultWrapper(props: HTMLProps<HTMLDivElement>) {
  return <section {...props} />;
}

/**
 * Default chrome around one widget: a `<div>` carrying the `data-widget-*`
 * attributes that CMS click-to-edit overlays, analytics and E2E selectors key
 * off.
 *
 * `meta` is dropped rather than forwarded. It is arbitrary consumer data with
 * no meaning to the DOM, and React warns about an unknown attribute on every
 * key of it that reaches an element. A custom `chrome.item` is where meta is
 * read.
 */
export function DefaultItem({
  meta: _meta,
  ...props
}: HTMLProps<HTMLDivElement> & { meta?: Record<string, unknown> }) {
  return <div {...props} />;
}
