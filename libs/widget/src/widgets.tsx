import type { HTMLProps } from 'react';

export function DefaultWrapper(props: HTMLProps<HTMLDivElement>) {
  return <section {...props} />;
}

/**
 * Default item chrome: a plain `<div>` carrying the `data-widget-*` attributes
 * that CMS click-to-edit overlays, analytics and E2E selectors key off.
 *
 * `meta` is deliberately dropped rather than forwarded: it is arbitrary
 * consumer data with no meaning to the DOM, and spreading it onto an element
 * would produce React unknown-attribute warnings. A custom `chrome.item` is
 * where meta is meant to be read.
 */
export function DefaultItem({
  meta: _meta,
  ...props
}: HTMLProps<HTMLDivElement> & { meta?: Record<string, unknown> }) {
  return <div {...props} />;
}
