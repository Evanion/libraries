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

import { DOCS } from './docs-path.mjs';

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
  ['urn/examples', 'urn/namespaces'],
  ['react-widget/examples', 'react-widget/validation'],
  ['feature/react', 'react-feature/getting-started'],
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
 * `href` is site-absolute with a trailing slash, matching what `trailingSlash`
 * emits for every other page, so the redirect does not send a reader through a
 * second hop.
 */
export function redirectDocument(href) {
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

/** A path inside the docs tree, without leading or trailing slash. */
const under = (path) => `${DOCS.slice(1)}/${path}`;

/**
 * The moved pages, in every tree a section is served in. Keys and values are
 * paths under `docs/`: the stub is written where the page was inside the docs
 * tree, and `legacyPaths` carries the same entries from the old root.
 *
 * A package section is served at its bare path and again under `/next/`, and
 * a link to a moved path can be written in either: a page under `/next/` links
 * its own section relatively, so an old path it links resolves under `/next/`.
 * So a moved package page answers in both trees. A page outside a package
 * section has one copy, and one stub.
 *
 * `main` is where a page is renamed, so under `/next/` the old path always
 * answers with the new one. The bare path serves the newest release, which can
 * still have the page under its old name: that path is the release's page and
 * gets no stub until a release ships without it. A release that has neither
 * name sends the old path to the page under `/next/`.
 *
 * @param {Record<string, { current: { pages: readonly string[] } }>} sections
 *   what `content/versions.json` records, by slug
 */
export function movedPaths(sections) {
  const paths = new Map();

  for (const [from, to] of movedPages) {
    const slug = from.split('/')[0];
    const section = sections[slug];

    if (!section) {
      paths.set(under(from), under(to));
      continue;
    }

    paths.set(under(`next/${from}`), under(`next/${to}`));

    const released = new Set(section.current.pages);
    const page = (path) => path.slice(slug.length + 1);

    if (released.has(page(from))) continue;
    paths.set(under(from), under(released.has(page(to)) ? to : `next/${to}`));
  }

  return paths;
}

/**
 * The pages a section has under `/next/` and not at its bare path, each
 * pointing at its copy under `/next/`.
 *
 * A bare path serves what a release shipped, and a release that shipped fewer
 * pages than `main` has leaves the rest out: `@evanion/urn` 2.0.0 has no
 * `components` page, and `main` does. The path is one a search engine already
 * holds and other pages link, so it answers with the page that exists rather
 * than with a 404, and the notice on that page says it documents `main`.
 *
 * @param {Record<string, { current: { pages: string[] }, next: { pages: string[] } }>} sections
 *   what `content/versions.json` records, by slug
 */
export function unreleasedPaths(sections) {
  const paths = new Map();

  for (const [slug, section] of Object.entries(sections)) {
    const released = new Set(section.current.pages);

    for (const page of section.next.pages) {
      if (page !== '' && !released.has(page))
        paths.set(under(`${slug}/${page}`), under(`next/${slug}/${page}`));
    }
  }

  return paths;
}

/**
 * The paths the site served before the documentation moved under `/docs`, each
 * with the page that answers it now.
 *
 * The old host served every docs page at the root: `/acl/errors/`,
 * `/next/urn/`, `/testing/`. The new host serves them under `/docs`, and a
 * bookmark or an index entry still names the root path. So every served
 * `docs/<p>` gets a stub at `<p>`. A moved page's old root path goes to its
 * current page (`movedPaths` decides which tree has it). The matrix explorer
 * stays at its root path and needs no stub.
 *
 * A key is never empty: the root is the frontpage. A product page at the root
 * (`/feature-flags/`) is not a docs path and never appears here.
 *
 * @param {Iterable<string>} served every `docs/...` path the export serves
 * @param {Record<string, { current: { pages: readonly string[] } }>} sections
 *   what `content/versions.json` records, by slug
 */
export function legacyPaths(served, sections = {}) {
  const prefix = `${DOCS.slice(1)}/`;
  const moved = movedPaths(sections);
  const paths = new Map();

  for (const [from, to] of movedPages)
    paths.set(from, moved.get(under(from)) ?? under(to));
  for (const path of served)
    if (path.startsWith(prefix)) paths.set(path.slice(prefix.length), path);

  return paths;
}

/**
 * Every file a build owes, as a map from path under `out/` to its contents.
 *
 * @param {Record<string, { current: { pages: string[] }, next: { pages: string[] } }>} sections
 *   what `content/versions.json` records, by slug
 * @param {Iterable<string>} served every `docs/...` path the export serves
 */
export function redirectFiles(sections = {}, served = []) {
  const moved = movedPaths(sections);
  const unreleased = [...unreleasedPaths(sections)].filter(
    ([from]) => !moved.has(from),
  );
  const legacy = legacyPaths(served, sections);

  return new Map([
    ...[...moved, ...unreleased, ...legacy].map(([from, to]) => [
      `${from}/index.html`,
      redirectDocument(`/${to}/`),
    ]),
    [`${DOCS.slice(1)}/index.html`, redirectDocument('/')],
  ]);
}
