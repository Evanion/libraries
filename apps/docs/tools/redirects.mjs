/**
 * The paths this site used to serve, and the paths that answer them now.
 *
 * `next.config.ts` sets `output: 'export'`, so Next's own `redirects()` never
 * runs: it is a server feature, and GitHub Pages serves files. A reader with a
 * bookmark and a search engine with an index both get a 404 from a renamed
 * page. So a redirect here is a file, written at the old path, carrying a meta
 * refresh for the reader and a canonical link for the crawler.
 *
 * A file, not a Next route, for the reason `md-siblings.mjs` gives:
 * `app/(site)/[...mdxPath]/page.tsx` is a required catch-all and owns every
 * path on this site, so a second route at a path the catch-all matches fails
 * the build. Under `output: 'export'` the deployed site is the contents of
 * `out/`, so writing the file is what serving it means, and this module runs
 * from `postbuild` beside the sibling writer.
 *
 * The map lives here rather than in `app/redirects.ts` or in the guard, and the
 * reason is who has to read it. Three callers do: this module writes the files,
 * `tools/repo-checks/src/doc-redirects.test.ts` asserts every entry still
 * resolves, and `tools/repo-checks/src/doc-links.test.ts` counts a link to a
 * moved path as resolving. A `.ts` module would need a build step before
 * `node tools/redirects.mjs` could import it, and a map inside the guard would
 * be invisible to the build that has to write the files. Plain ESM beside
 * `libraries.mjs` and `statistics.mjs` is what all three can import unchanged.
 *
 * `trailingSlash: true` is on, so each entry needs `<old>/index.html`.
 *
 * An entry is permanent. A reader's bookmark does not expire, so a path that
 * once answered keeps answering, and nothing is removed from this map because a
 * later rename happened. A page renamed twice gets its first path pointed
 * straight at the current one, so no reader walks two refreshes.
 */

/** Old site path to current site path, both without leading or trailing slash. */
export const movedPages = new Map([
  ['acl/simple', 'acl/subject-rules'],
  ['acl/intermediate', 'acl/object-rules'],
  ['acl/interface', 'acl/ui-checks'],
  ['acl/platforms', 'acl/choosing-an-integration'],
  ['acl/next-rsc', 'acl/nextjs'],
  ['acl/capabilities', 'acl/listing-permissions'],
  ['acl/changes', 'acl/rule-changes'],
  ['acl/register', 'acl/attacks'],
  ['acl/decisions', 'acl/decision-object'],
]);

/**
 * The redirect document for one entry.
 *
 * `http-equiv="refresh"` with a zero delay is what a static host can offer, and
 * every browser honours it. `rel="canonical"` tells a crawler which path holds
 * the content, so the index moves to the new path rather than splitting between
 * the two. The anchor is for a reader whose browser blocks the refresh, and the
 * `noindex` keeps the stub itself out of a search result.
 *
 * `to` is site-absolute with a trailing slash, matching what `trailingSlash`
 * emits for every other page, so the redirect does not send a reader through a
 * second hop.
 */
export function redirectDocument(to) {
  const href = `/${to}/`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=${href}" />
    <link rel="canonical" href="${href}" />
    <meta name="robots" content="noindex" />
    <title>Moved</title>
  </head>
  <body>
    <p>This page is now at <a href="${href}">${href}</a>.</p>
  </body>
</html>
`;
}

/** Every file a build owes, as a map from path under `out/` to its contents. */
export function redirectFiles() {
  return new Map(
    [...movedPages].map(([from, to]) => [
      `${from}/index.html`,
      redirectDocument(to),
    ]),
  );
}
