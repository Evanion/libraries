/**
 * Where a request to docs.evanion.com belongs on libs.evanion.com.
 *
 * The documentation is served under /docs on the new host. The frontpage, the
 * built assets and the site files stay at the root. The matrix explorer moved
 * into the acl section.
 */
const ORIGIN = 'https://libs.evanion.com';
const ROOT_FILES =
  /^\/(?:_next|_pagefind|behaviour)\/|^\/(?:sitemap\.xml|robots\.txt|code-classes\.css|favicon[^/]*)$/;

/** The absolute URL on libs.evanion.com that the old `url` redirects to. */
export function target(url) {
  const { pathname, search } = url;

  if (pathname === '/') return `${ORIGIN}/${search}`;
  if (ROOT_FILES.test(pathname)) return `${ORIGIN}${pathname}${search}`;
  if (
    pathname === '/matrix-explorer' ||
    pathname.startsWith('/matrix-explorer/')
  )
    return `${ORIGIN}/docs/acl${pathname}${search}`;

  return `${ORIGIN}/docs${pathname}${search}`;
}
