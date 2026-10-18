/**
 * Where the documentation lives on the site, and the one place that says so.
 *
 * The site serves its frontpage and the product pages at the root and every
 * documentation page under `DOCS`. The app, the archive cutter, the redirect
 * writer and the link check all build docs paths through this module, so the
 * prefix is spelled once. Plain ESM, so `node` and Vitest import it unchanged
 * and the TypeScript app imports it through `allowJs`.
 */

/** The path every documentation page is served under. */
export const DOCS = '/docs';

/** `path` under `DOCS`, keeping its hash and query. A path already there is returned as is. */
export function docsHref(path) {
  if (path === DOCS || path.startsWith(`${DOCS}/`)) return path;
  return `${DOCS}/${path.replace(/^\//, '')}`;
}

/** Whether `segment`, the first segment of a root path, is a section of the docs tree. */
export function isDocsRoot(segment, roots) {
  return roots.has(segment);
}

/** A root-absolute `href` into the docs tree, under `DOCS`; any other `href` unchanged. */
export function prefixDocsLink(href, roots) {
  const match = href.match(/^\/([a-z0-9-]+)(?=[/?#]|$)/);
  if (!match || !isDocsRoot(match[1], roots)) return href;
  return docsHref(href);
}
