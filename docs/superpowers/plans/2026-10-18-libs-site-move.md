# libs.evanion.com Site Move Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the docs site at `https://libs.evanion.com` with the frontpage at `/` and every documentation page under `/docs`, and keep every `docs.evanion.com` URL working through a permanent redirect.

**Architecture:** One Next app (`apps/docs`). Nextra's `contentDirBasePath: '/docs'` puts every content page and every page-map route under `/docs`; the app routes move under `app/docs/`; one module (`tools/docs-path.mjs`) owns the prefix for every link the code builds. Links written in MDX are rewritten once; links in pages cut from older commits are prefixed by the archive cutter. Old root paths on the new host get redirect files; the old host is redirected by a Cloudflare Worker.

**Tech Stack:** Next.js 16 static export, Nextra 4.6.1, Vitest, Nx, GitHub Pages (Actions deployment), Cloudflare Worker (wrangler 4).

**Spec:** `docs/superpowers/specs/2026-10-18-libs-site-move-design.md` (approved 2026-10-18).

## Global Constraints

- New origin: `https://libs.evanion.com`. Docs prefix: `/docs`. Unreleased docs stay at `/docs/next/`.
- Frontpage stays at `/`. `/_next/`, `/_pagefind/`, `/sitemap.xml`, `/robots.txt`, `/code-classes.css` stay at the root.
- Matrix explorer moves to `/docs/acl/matrix-explorer/`.
- No module other than `apps/docs/tools/docs-path.mjs` spells `/docs` as a literal path prefix.
- Specs and plans under `docs/specs/` and `docs/superpowers/` are history: their `docs.evanion.com` links stay.
- npm `homepage` fields are out of scope.
- Every redirect is permanent; no entry of `movedPages` in `tools/redirects.mjs` is removed.
- One branch and one PR for Tasks 1–7; Task 8 is the switch-over after merge. Conventional commits (`feat(docs)`, `fix(docs)`, `build(repo)`, `docs(<lib>)`), each ending with the session's Co-Authored-By line. A commit that changes only tooling is `build(repo)` or `test(repo)`, never `feat`/`fix` (the CI tooling-commit check refuses it).
- Comments describe the code as it is, never its history.
- Verification uses `npx nx run-many -t test lint typecheck -p docs repo-checks --parallel=2 --skip-nx-cache` and `npx nx run docs:build --skip-nx-cache`. Never run `docs:build` in a worktree where `docs:dev` is running.

## Review Focus

1. A root link with a hash or query (`/acl/errors/#reasons`, `/urn/?q=1`) keeps its hash and query after prefixing, in the rewrite script, the cutter and the Worker. Pinned in Tasks 1, 4 and 7.
2. A link that already starts with `/docs/` is never prefixed twice, in the cutter and in a page cut after this lands. Pinned in Tasks 1 and 4.
3. A request to the old host without a trailing slash (`docs.evanion.com/acl`) or for a `.md` sibling (`docs.evanion.com/urn/getting-started.md`) lands on the matching `/docs` URL. Pinned in Task 7.
4. A path that is not a docs page (`/feature-flags/`, `/_next/...`, `/code-classes.css`, external `https://` links, links inside code fences and inline code) is never prefixed. Pinned in Tasks 1 and 4.
5. `docs.evanion.com/` and `libs.evanion.com/docs/` both reach a page, not a 404. Pinned in Tasks 5 and 7.

---

### Task 1: The docs prefix module

**Files:**

- Create: `apps/docs/tools/docs-path.mjs`
- Create: `apps/docs/tools/docs-path.test.mjs`

**Interfaces:**

- Produces:
  - `export const DOCS = '/docs'`
  - `export function docsHref(path: string): string` — `''` gives `/docs/`; `'acl/errors/'` or `'/acl/errors/'` gives `/docs/acl/errors/`; keeps `#hash` and `?query`; returns a path already under `/docs/` (or equal to `/docs`) unchanged.
  - `export function isDocsRoot(segment: string, roots: ReadonlySet<string>): boolean` — whether a first path segment belongs to the docs tree.
  - `export function prefixDocsLink(href: string, roots: ReadonlySet<string>): string` — a root-absolute href whose first segment is in `roots` gets `docsHref`; every other href is returned unchanged.

- [ ] **Step 1: Write the failing test** in `apps/docs/tools/docs-path.test.mjs`:

```js
import { describe, expect, it } from 'vitest';
import { DOCS, docsHref, prefixDocsLink } from './docs-path.mjs';

const roots = new Set(['acl', 'urn', 'next', 'testing']);

describe('docsHref', () => {
  it('puts a path under /docs', () => {
    expect(DOCS).toBe('/docs');
    expect(docsHref('')).toBe('/docs/');
    expect(docsHref('acl/errors/')).toBe('/docs/acl/errors/');
    expect(docsHref('/acl/errors/')).toBe('/docs/acl/errors/');
  });
  it('keeps the hash and the query', () => {
    expect(docsHref('/acl/errors/#reasons')).toBe('/docs/acl/errors/#reasons');
    expect(docsHref('/urn/?q=1')).toBe('/docs/urn/?q=1');
  });
  it('leaves a path already under /docs alone', () => {
    expect(docsHref('/docs/acl/')).toBe('/docs/acl/');
    expect(docsHref('/docs')).toBe('/docs');
  });
});

describe('prefixDocsLink', () => {
  it('prefixes a root link into the docs tree', () => {
    expect(prefixDocsLink('/acl/errors/', roots)).toBe('/docs/acl/errors/');
    expect(prefixDocsLink('/next/urn/', roots)).toBe('/docs/next/urn/');
    expect(prefixDocsLink('/urn', roots)).toBe('/docs/urn');
  });
  it('leaves everything else alone', () => {
    for (const href of [
      '/feature-flags/',
      '/_next/static/x.js',
      '/code-classes.css',
      '/',
      'https://example.com/acl/',
      '../rollouts',
      './api',
      '#top',
      '/docs/acl/',
    ])
      expect(prefixDocsLink(href, roots)).toBe(href);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd apps/docs && npx vitest run tools/docs-path.test.mjs`
Expected: FAIL, `Failed to load url ./docs-path.mjs`.

- [ ] **Step 3: Implement** `apps/docs/tools/docs-path.mjs`:

```js
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
```

- [ ] **Step 4: Run it and see it pass**

Run: `cd apps/docs && npx vitest run tools/docs-path.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/tools/docs-path.mjs apps/docs/tools/docs-path.test.mjs
git commit -m "feat(docs): name the path the documentation is served under"
```

---

### Task 2: Serve the content and the app routes under /docs

**Files:**

- Modify: `apps/docs/next.config.ts` (the `nextra({...})` options)
- Move: `apps/docs/app/(site)/[...mdxPath]/` → `apps/docs/app/docs/(site)/[...mdxPath]/`
- Move: `apps/docs/app/(next)/` → `apps/docs/app/docs/(next)/` (so the page is `app/docs/(next)/next/[...mdxPath]/page.tsx`)
- Move: `apps/docs/app/(tool)/matrix-explorer/page.tsx` → `apps/docs/app/docs/(tool)/acl/matrix-explorer/page.tsx`
- Modify: `apps/docs/app/page-maps.ts`, the `(next)` layout, `apps/docs/app/sections.ts`, `apps/docs/app/sidebar.ts`, `apps/docs/app/content-page.tsx`, `apps/docs/components/landing/sections.tsx`, `apps/docs/components/ScopedSearch.tsx`, `apps/docs/components/explorer/ExplorerScreen.tsx`, `apps/docs/content/_meta.ts` (only if it spells a docs path)
- Test: the existing `app/*.test.ts` and `components/**/*.test.tsx`; add `apps/docs/app/sections.test.ts` cases if the file exists, otherwise assert in the existing test that covers `versionOptions` (find it with `grep -rln "versionOptions\|option('main'" apps/docs/app apps/docs/components`)

**Interfaces:**

- Consumes: `DOCS`, `docsHref` from `apps/docs/tools/docs-path.mjs`.
- Produces: every route of the docs tree is served at `/docs/...`; `getPageMap` routes start with `/docs`.

- [ ] **Step 1: Write the failing test.** In the test that covers the version switcher in `app/sections.ts` (located above), assert the hrefs:

```ts
expect(options.map((o) => o.href)).toEqual([
  '/docs/urn/',
  '/docs/urn/v1/',
  '/docs/next/urn/',
]);
```

using the same fixture section the file already builds (urn with a `v1` line); keep its existing setup. And in the landing sections test (or `platforms.test.ts` if that is where hrefs are asserted) assert a documented family links to `/docs/<slug>`.

- [ ] **Step 2: Run and see it fail**

Run: `npx nx test docs --skip-nx-cache -- sections`
Expected: FAIL, hrefs lack `/docs`.

- [ ] **Step 3: Configure Nextra.** In `apps/docs/next.config.ts`:

```ts
import { DOCS } from './tools/docs-path.mjs';

const withNextra = nextra({
  contentDirBasePath: DOCS,
  defaultShowCopyCode: true,
  latex: true,
  search: {
    codeblocks: false,
  },
});
```

- [ ] **Step 4: Move the routes** with `git mv` (keep each file's content; fix only relative import depths, which gain one `../`):

```bash
cd apps/docs/app
mkdir -p 'docs/(tool)/acl'
git mv '(site)' 'docs/(site)'
git mv '(next)' 'docs/(next)'
git mv '(tool)/matrix-explorer' 'docs/(tool)/acl/matrix-explorer'
```

Then in each moved `page.tsx`/`layout.tsx`, change `'../../content-page'` to `'../../../content-page'` (and the analogous `chrome`, `page-maps`, `components` imports) until `npx nx run docs:typecheck --skip-nx-cache` is clean. In the moved explorer page, update its doc comment's URL to `/docs/acl/matrix-explorer/`.

- [ ] **Step 5: Page maps.** In the `(next)` layout: `getPageMap(docsHref('next'))` instead of `getPageMap('/next')`. In `app/page-maps.ts`, `sitePageMap` reads `(await getPageMap(DOCS))` and filters out the `next` folder as before. Print one route from each to confirm the prefix during development:

```ts
// temporary check, removed before commit
console.log((await getPageMap(DOCS)).slice(0, 2));
```

Expected routes like `/docs/acl`. Remove the log.

- [ ] **Step 6: Links built in code.**
  - `app/sections.ts`: the three bases become `docsHref(`${slug}/`)`, `docsHref(`${slug}/${line.segment}/`)`, `docsHref(`next/${slug}/`)`.
  - `app/sidebar.ts:26`: `href: docsHref(`${item.slug}/`)`.
  - `app/content-page.tsx:96`: `releaseHref={documented ? docsHref(`${section.entry.slug}/`) : undefined}`.
  - `components/landing/sections.tsx:21`: `return entry.documented ? docsHref(entry.slug) : readmeUrl(entry);`
  - `components/ScopedSearch.tsx:23`: `pathname.startsWith(docsHref('next/'))`.
  - `components/explorer/ExplorerScreen.tsx:272,454`: `href={docsHref('acl/explorer/')}`, `href={docsHref('acl/errors/')}`.
  - `app/sections.ts` route parsing: wherever it reads `mdxPath[0] === 'next'` it stays (the catch-all params do not include `docs`); where it parses a `pathname` string, strip `DOCS` first. Find these with `grep -n "pathname\|startsWith('/" apps/docs/app/*.ts apps/docs/components/*.tsx`.

- [ ] **Step 7: Run the tests and the build**

Run: `npx nx run-many -t test lint typecheck -p docs --parallel=2 --skip-nx-cache`
Expected: PASS.
Run: `npx nx run docs:build --skip-nx-cache`
Expected: exit 0; `ls apps/docs/out/docs/urn/index.html apps/docs/out/docs/next/urn/index.html apps/docs/out/docs/acl/matrix-explorer/index.html apps/docs/out/index.html` all exist; `ls apps/docs/out/urn/index.html` does not exist yet (Task 5 adds a redirect there).

- [ ] **Step 8: Commit**

```bash
git add -A apps/docs/next.config.ts apps/docs/app apps/docs/components
git commit -m "feat(docs): serve the documentation under /docs"
```

---

### Task 3: Rewrite the root links written in MDX and teach the link check the prefix

**Files:**

- Create then delete: `apps/docs/tools/prefix-content-links.mjs` (one-off; not committed)
- Modify: every `apps/docs/content/next/**/*.mdx` and `apps/docs/content/testing/**/*.mdx` with a root link (70 links on 2026-10-18)
- Modify: `tools/repo-checks/src/docs-content.ts` (`urlOf`, `servedPaths`), `tools/repo-checks/src/doc-links.test.ts` (`appRoutes`, the resolution check)

**Interfaces:**

- Consumes: `prefixDocsLink`, `DOCS` from Task 1.
- Produces: `urlOf(page)` returns `/docs/...`; `servedPaths()` returns paths starting with `docs/`.

- [ ] **Step 1: Make the link check see the new world first (failing).** In `tools/repo-checks/src/docs-content.ts`:

```ts
export function urlOf(page: string): string {
  const path = relative(CONTENT, page)
    .split(sep)
    .join('/')
    .replace(/\.mdx?$/, '')
    .replace(/(^|\/)index$/, '');

  return path === '' ? '/docs/' : `/docs/${path}/`;
}
```

and in `servedPaths()` build every entry under `docs/` (`docs/${slug}`, `docs/${slug}/${page}`, `docs/${slug}/${line.segment}/...`). In `doc-links.test.ts` `appRoutes()` already walks route groups and real directories, so `app/docs/...` yields `/docs/acl/matrix-explorer` without change; leave it.

- [ ] **Step 2: Run the link check and see the root links fail**

Run: `npx nx test repo-checks --skip-nx-cache -- doc-links`
Expected: FAIL listing about 70 `content/next/...: /acl/...` links.

- [ ] **Step 3: Write the one-off rewrite** `apps/docs/tools/prefix-content-links.mjs`:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { prefixDocsLink } from './docs-path.mjs';
import { packages } from '../app/navigation.ts';

const roots = new Set([
  ...packages.map((p) => p.slug),
  'next',
  'testing',
  'matrix-explorer',
]);
const FENCE = /^\s*(`{3,}|~{3,})/;

const files = execFileSync(
  'git',
  ['ls-files', 'content/next', 'content/testing'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter((f) => f.endsWith('.mdx'));

let changed = 0;
for (const file of files) {
  let fence = null;
  const out = readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => {
      const marker = line.match(FENCE);
      if (marker) {
        if (fence === null) fence = marker[1];
        else if (marker[1].startsWith(fence)) fence = null;
        return line;
      }
      if (fence !== null) return line;
      return line
        .split(/(`[^`]*`)/)
        .map((part, i) =>
          i % 2 === 1
            ? part
            : part
                .replace(
                  /\]\((\/[^)\s]*)\)/g,
                  (_, h) => `](${prefixDocsLink(h, roots)})`,
                )
                .replace(
                  /(href=)(['"])(\/[^'"\s]*)\2/g,
                  (_, a, q, h) => `${a}${q}${prefixDocsLink(h, roots)}${q}`,
                ),
        )
        .join('');
    })
    .join('\n');
  if (out !== readFileSync(file, 'utf8')) {
    writeFileSync(file, out);
    changed++;
  }
}
console.log(`rewrote root links in ${changed} files`);
```

Run from `apps/docs` with `node --experimental-strip-types tools/prefix-content-links.mjs` (navigation.ts is TypeScript). If that import fails on this Node, replace the `packages` import with the slug list from `ls content/next`. `matrix-explorer` maps to `/docs/matrix-explorer/`, which is wrong: after the run, `grep -rn "/docs/matrix-explorer" content` and change each to `/docs/acl/matrix-explorer/` by hand.

- [ ] **Step 4: Run the link check and see it pass**

Run: `npx nx test repo-checks --skip-nx-cache -- doc-links`
Expected: PASS. `git diff --stat apps/docs/content` shows only link changes (`git diff apps/docs/content | grep '^[-+]' | grep -v '/docs/'` lists only the removed lines).

- [ ] **Step 5: Delete the one-off script, run prettier, commit**

```bash
rm apps/docs/tools/prefix-content-links.mjs
npx prettier --write apps/docs/content
git add apps/docs/content tools/repo-checks/src/docs-content.ts tools/repo-checks/src/doc-links.test.ts
git commit -m "docs(docs): link the documentation under /docs"
```

---

### Task 4: Prefix root links in pages the archive cutter cuts

**Files:**

- Modify: `apps/docs/tools/cut.mjs` (new export `docsLinks`, called from `cutPage`; `context` gains `roots`)
- Modify: `apps/docs/tools/archives.mjs:701` (the `live` link) and `:883` (the section `href`), and the call site of `cutPage` to pass `roots`
- Test: `apps/docs/tools/cut.test.mjs`

**Interfaces:**

- Consumes: `prefixDocsLink`, `docsHref` from Task 1.
- Produces: `export function docsLinks(source: string, roots: ReadonlySet<string>): string`; `cutPage(source, { ..., roots })`.

- [ ] **Step 1: Write the failing tests** in `apps/docs/tools/cut.test.mjs` (add `docsLinks` to its import from `./cut.mjs`):

````js
describe('docsLinks', () => {
  const roots = new Set(['acl', 'urn', 'next']);

  it('prefixes a root link into the docs tree once', () => {
    expect(docsLinks('See [errors](/acl/errors/#reasons).', roots)).toBe(
      'See [errors](/docs/acl/errors/#reasons).',
    );
    expect(docsLinks('<a href="/urn/api/">api</a>', roots)).toBe(
      '<a href="/docs/urn/api/">api</a>',
    );
  });

  it('leaves a /docs link, a product link, relative links and code alone', () => {
    const page = [
      '[a](/docs/acl/) [b](/feature-flags/) [c](../api) `[d](/acl/)`',
      '```md',
      '[e](/acl/)',
      '```',
    ].join('\n');
    expect(docsLinks(page, roots)).toBe(page);
  });
});
````

- [ ] **Step 2: Run and see them fail**

Run: `cd apps/docs && npx vitest run tools/cut.test.mjs -t docsLinks`
Expected: FAIL, `docsLinks is not a function`.

- [ ] **Step 3: Implement** in `apps/docs/tools/cut.mjs`, beside `relativeLinks`, reusing the module's `FENCE`:

```js
import { prefixDocsLink } from './docs-path.mjs';

/**
 * Every root link into the documentation, under the docs prefix.
 *
 * A page cut from a commit spells its links to other sections from the site
 * root. The site serves the documentation under `/docs`, so each of those links
 * is prefixed; a link the page already spells under `/docs` is left as it is.
 * Code fences and inline code are code, not links.
 *
 * @param {string} source
 * @param {ReadonlySet<string>} roots the first path segments of the docs tree
 */
export function docsLinks(source, roots) {
  let fence = null;

  return source
    .split('\n')
    .map((line) => {
      const marker = line.match(FENCE);
      if (marker) {
        if (fence === null) fence = marker[2];
        else if (marker[2].startsWith(fence)) fence = null;
        return line;
      }
      if (fence !== null) return line;

      return line
        .split(/(`[^`]*`)/)
        .map((part, index) =>
          index % 2 === 1
            ? part
            : part
                .replace(
                  /\]\((\/[^)\s]*)\)/g,
                  (_, href) => `](${prefixDocsLink(href, roots)})`,
                )
                .replace(
                  /(['"])(\/[a-z0-9-]+[^'"\s]*)\1/g,
                  (_, quote, href) =>
                    `${quote}${prefixDocsLink(href, roots)}${quote}`,
                ),
        )
        .join('');
    })
    .join('\n');
}
```

In `cutPage`, run it after `relativeLinks` (which turns own-section links relative first):

```js
page = relativeLinks(page, context.own, context.page.replace(/\.mdx$/, ''));
page = docsLinks(page, context.roots);
```

and add `roots: ReadonlySet<string>` to the `@param` context type.

- [ ] **Step 4: Pass `roots` and prefix the cutter's own links** in `apps/docs/tools/archives.mjs`:
  - build once per run: `const roots = new Set([...sections.map((s) => s.slug), 'next', 'testing'])` from the same section list the file already iterates (use the variable it already has for all sections);
  - at the `cutPage(source, {...})` call add `roots,`;
  - line 701: `const live = docsHref(`next/${section.slug}/${nextPages.has(route) && route !== '' ? `${route}/` : ''}`);`
  - line 883: `href: docsHref(`${section.slug}/`),`
  - import `docsHref` from `./docs-path.mjs`.

- [ ] **Step 5: Run the cutter tests and the archive build**

Run: `cd apps/docs && npx vitest run tools/cut.test.mjs tools/archives.test.mjs`
Expected: PASS (update any `archives.test.mjs` expectation that asserts a `live` or section href to the `/docs` form).
Run: `npx nx run docs:archives --skip-nx-cache` then `grep -rhoE '\]\(/[a-z][^)]*\)' apps/docs/content --include=*.mdx | grep -v '](/docs/' | sort -u`
Expected: no output (no generated page keeps a root docs link).

- [ ] **Step 6: Commit**

```bash
git add apps/docs/tools/cut.mjs apps/docs/tools/cut.test.mjs apps/docs/tools/archives.mjs apps/docs/tools/archives.test.mjs
git commit -m "feat(docs): cut older pages with their links under /docs"
```

---

### Task 5: Redirect files for every old root path on the new host

**Files:**

- Modify: `apps/docs/tools/redirects.mjs` (`redirectDocument`, `movedPaths`, `unreleasedPaths`, `redirectFiles`, new `legacyPaths`)
- Modify: `apps/docs/tools/write-redirects.mjs` (pass the served paths)
- Test: `tools/repo-checks/src/doc-redirects.test.ts`, `tools/repo-checks/src/doc-links.test.ts` (its `redirected` set)

**Interfaces:**

- Consumes: `docsHref` from Task 1; `servedPaths()` shape from Task 3 (paths start with `docs/`).
- Produces:
  - `redirectDocument(to: string)` where `to` is a full site path (`'/docs/acl/'`, `'/'`).
  - `movedPaths(sections)` and `unreleasedPaths(sections)` return keys and values under `docs/` (e.g. `docs/acl/simple` → `docs/acl/subject-rules`).
  - `legacyPaths(served: Iterable<string>)` returns, for every served `docs/<p>`, the key `<p>` → `docs/<p>`, plus every `movedPaths` key without `docs/` → its `docs/` target, plus `matrix-explorer` → `docs/acl/matrix-explorer`.
  - `redirectFiles(sections, served)` writes `<from>/index.html` for all of these and `docs/index.html` → `/`.

- [ ] **Step 1: Write the failing tests** in `tools/repo-checks/src/doc-redirects.test.ts` (import the module the way the file already does):

```ts
it('sends every old root path to the same page under /docs', async () => {
  const { legacyPaths } = await loadRedirects();
  const legacy = legacyPaths([
    'docs/acl',
    'docs/acl/errors',
    'docs/next/urn/api',
  ]);
  expect(legacy.get('acl')).toBe('docs/acl');
  expect(legacy.get('acl/errors')).toBe('docs/acl/errors');
  expect(legacy.get('next/urn/api')).toBe('docs/next/urn/api');
  expect(legacy.get('acl/simple')).toBe('docs/acl/subject-rules');
  expect(legacy.get('matrix-explorer')).toBe('docs/acl/matrix-explorer');
});

it('answers /docs/ with the frontpage', async () => {
  const { redirectFiles } = await loadRedirects();
  expect(redirectFiles({}, []).get('docs/index.html')).toContain('url=/"');
});
```

- [ ] **Step 2: Run and see them fail**

Run: `npx nx test repo-checks --skip-nx-cache -- doc-redirects`
Expected: FAIL, `legacyPaths is not a function`.

- [ ] **Step 3: Implement** in `apps/docs/tools/redirects.mjs`:

```js
import { DOCS } from './docs-path.mjs';

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

const under = (path) => `${DOCS.slice(1)}/${path}`;

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

export function legacyPaths(served) {
  const paths = new Map();
  for (const path of served) {
    if (path.startsWith(`${DOCS.slice(1)}/`))
      paths.set(path.slice(DOCS.length), path);
  }
  for (const [from, to] of movedPages) paths.set(from, under(to));
  paths.set('matrix-explorer', under('acl/matrix-explorer'));
  return paths;
}

export function redirectFiles(sections = {}, served = []) {
  const moved = movedPaths(sections);
  const unreleased = [...unreleasedPaths(sections)].filter(
    ([from]) => !moved.has(from),
  );
  const legacy = [...legacyPaths(served)].filter(([from]) => !moved.has(from));

  return new Map([
    ...[...moved, ...unreleased, ...legacy].map(([from, to]) => [
      `${from}/index.html`,
      redirectDocument(`/${to}/`),
    ]),
    [`${DOCS.slice(1)}/index.html`, redirectDocument('/')],
  ]);
}
```

Keep the module's comments and update them to describe the two kinds of path (moved pages inside `/docs`; old root paths). A legacy key must never be `''` (that is the frontpage): the `startsWith('docs/')` guard ensures it.

- [ ] **Step 4: Pass the served paths.** In `apps/docs/tools/write-redirects.mjs`, compute the served docs paths from the export itself, after the build has written it:

```js
import { readdirSync } from 'node:fs';

function servedDocs(out) {
  const found = [];
  const walk = (dir, path) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory())
        walk(join(dir, entry.name), `${path}/${entry.name}`);
      else if (entry.name === 'index.html' && path.startsWith('/docs/'))
        found.push(path.slice(1));
    }
  };
  walk(join(out, 'docs'), '/docs');
  return found;
}

export function writeRedirects(out, sections = {}) {
  const files = redirectFiles(sections, servedDocs(out));

  for (const [path, document] of files) {
    const target = join(out, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, document);
  }

  return files;
}
```

In `doc-links.test.ts`, add `...legacyPaths(servedPaths()).keys()` to the `redirected` set so a not-yet-rewritten root link still counts as resolving only if it is a real legacy path (the content rewrite in Task 3 means none should rely on it).

- [ ] **Step 5: Run the tests and a build**

Run: `npx nx test repo-checks --skip-nx-cache -- doc-redirects doc-links`
Expected: PASS.
Run: `npx nx run docs:build --skip-nx-cache` then `grep -o 'url=[^"]*' apps/docs/out/urn/index.html apps/docs/out/docs/index.html apps/docs/out/matrix-explorer/index.html`
Expected: `url=/docs/urn/`, `url=/`, `url=/docs/acl/matrix-explorer/`.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/tools/redirects.mjs apps/docs/tools/write-redirects.mjs tools/repo-checks/src/doc-redirects.test.ts tools/repo-checks/src/doc-links.test.ts
git commit -m "feat(docs): send every old docs path to its page under /docs"
```

---

### Task 6: The new host everywhere it is named

**Files:**

- Modify: `apps/docs/app/layout.tsx` (`metadataBase`), `apps/docs/public/CNAME`, `apps/docs/tools/sitemap.test.mjs`, `.github/workflows/docs.yml` (artefact check), and every non-history file from `git grep -l "docs.evanion.com" -- . ':!docs/specs' ':!docs/superpowers' ':!**/CHANGELOG.md'`
- Test: `apps/docs/tools/sitemap.test.mjs`, the docs workflow check (run its shell loop locally against `apps/docs/out`)

**Interfaces:**

- Consumes: the export from Tasks 2–5.
- Produces: `public/CNAME` is `libs.evanion.com`; sitemap and robots name `https://libs.evanion.com`.

- [ ] **Step 1: Update the sitemap test first.** In `apps/docs/tools/sitemap.test.mjs`, change every `https://docs.evanion.com` expectation to `https://libs.evanion.com` and every docs path in its fixtures to the `/docs/...` form. Run `cd apps/docs && npx vitest run tools/sitemap.test.mjs`; expected FAIL until Step 2.

- [ ] **Step 2: Change the host.**

```bash
printf 'libs.evanion.com\n' > apps/docs/public/CNAME
```

In `apps/docs/app/layout.tsx`: `metadataBase: new URL('https://libs.evanion.com'),`. Run the sitemap test: expected PASS.

- [ ] **Step 3: Repository links.** For each file from the `git grep` above (READMEs under `libs/` and `internal/`, the root `README.md`, `libs/acl/SECURITY.md`, `apps/storefront/src/lib/catalogue.ts`): replace `https://docs.evanion.com/<path>` with `https://libs.evanion.com/docs/<path>` and a bare `https://docs.evanion.com/` (or without slash) with `https://libs.evanion.com/`. Use:

```bash
git grep -l "docs.evanion.com" -- . ':!docs/specs' ':!docs/superpowers' ':!**/CHANGELOG.md' ':!.github' ':!apps/docs/tools/sitemap.test.mjs' \
  | xargs sed -i '' -E 's#https://docs\.evanion\.com/?([)"'"'"' >]|$)#https://libs.evanion.com/\1#g; s#https://docs\.evanion\.com/([a-z])#https://libs.evanion.com/docs/\1#g'
git grep -n "docs.evanion.com" -- . ':!docs/specs' ':!docs/superpowers' ':!**/CHANGELOG.md'
```

Expected: the second command lists only `.github/workflows/docs.yml` (Step 4). The `SEC-205` test pins the substring `SECURITY.md` and the phrase `security contract`, which the sed does not touch.

- [ ] **Step 4: CI artefact check.** In `.github/workflows/docs.yml`, the `Check deploy artefacts` loop list becomes:

```sh
for f in .nojekyll CNAME index.html _pagefind/pagefind.js docs/urn/getting-started.md docs/next/urn/getting-started.md docs/testing/index.html urn/index.html sitemap.xml robots.txt; do
```

and `[ "$(cat CNAME)" = "libs.evanion.com" ] || { echo "unexpected CNAME: $(cat CNAME)" >&2; exit 1; }`. Update the comment above it that names `docs.evanion.com`. Run the loop locally from `apps/docs/out` after a build: expected every file present.

- [ ] **Step 5: Full verification**

Run: `npx nx run-many -t test lint typecheck -p docs repo-checks acl react-acl feature react-feature widget react-widget astro-widget urn luhn token compose nestjs-correlation-id --parallel=2 --skip-nx-cache`
Expected: PASS (README doctests and `SEC-205` included).
Run: `npx nx run docs:build --skip-nx-cache` and `npx prettier --check $(git diff --name-only origin/main)`
Expected: exit 0.

- [ ] **Step 6: Commit** (tooling and docs only, so `build(repo)` / `docs`):

```bash
git add apps/docs/public/CNAME apps/docs/app/layout.tsx apps/docs/tools/sitemap.test.mjs .github/workflows/docs.yml
git commit -m "build(repo): publish the site at libs.evanion.com"
git add -A libs internal README.md apps/storefront
git commit -m "docs(repo): link the documentation at libs.evanion.com/docs"
```

---

### Task 7: The redirect Worker for docs.evanion.com

**Files:**

- Create: `tools/docs-redirect-worker/src/index.js`, `tools/docs-redirect-worker/src/redirect.js`, `tools/docs-redirect-worker/src/redirect.test.js`, `tools/docs-redirect-worker/wrangler.toml`, `tools/docs-redirect-worker/README.md`
- Check: whether an Nx project file is needed so `nx test` picks it up; follow how `tools/repo-checks` is set up (`project.json` or `package.json` with `nx`), and add the project to the workspace the same way.

**Interfaces:**

- Produces: `export function target(url: URL): string` — the absolute URL on `libs.evanion.com` an old URL redirects to.

- [ ] **Step 1: Write the failing test** `tools/docs-redirect-worker/src/redirect.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { target } from './redirect.js';

const at = (path) => target(new URL(`https://docs.evanion.com${path}`));

describe('target', () => {
  it('sends a docs page to the same page under /docs', () => {
    expect(at('/acl/errors/')).toBe(
      'https://libs.evanion.com/docs/acl/errors/',
    );
    expect(at('/acl')).toBe('https://libs.evanion.com/docs/acl');
    expect(at('/next/urn/api/')).toBe(
      'https://libs.evanion.com/docs/next/urn/api/',
    );
    expect(at('/urn/getting-started.md')).toBe(
      'https://libs.evanion.com/docs/urn/getting-started.md',
    );
  });
  it('keeps the query and the hash', () => {
    expect(at('/urn/?q=1')).toBe('https://libs.evanion.com/docs/urn/?q=1');
  });
  it('sends the root to the frontpage and the explorer to its new place', () => {
    expect(at('/')).toBe('https://libs.evanion.com/');
    expect(at('/matrix-explorer/')).toBe(
      'https://libs.evanion.com/docs/acl/matrix-explorer/',
    );
  });
  it('sends assets and site files to the same path at the root', () => {
    expect(at('/sitemap.xml')).toBe('https://libs.evanion.com/sitemap.xml');
    expect(at('/_next/static/a.js')).toBe(
      'https://libs.evanion.com/_next/static/a.js',
    );
  });
});
```

(The hash never reaches a server, so the Worker cannot see it; the browser re-applies it after a redirect.)

- [ ] **Step 2: Run and see it fail**

Run: `npx vitest run tools/docs-redirect-worker/src/redirect.test.js`
Expected: FAIL, cannot load `./redirect.js`.

- [ ] **Step 3: Implement** `tools/docs-redirect-worker/src/redirect.js`:

```js
/**
 * Where a request to docs.evanion.com belongs on libs.evanion.com.
 *
 * The documentation is served under /docs on the new host; the frontpage, the
 * built assets and the site files stay at the root. The explorer moved into
 * the acl section.
 */
const ORIGIN = 'https://libs.evanion.com';
const ROOT_FILES =
  /^\/(?:_next|_pagefind)\/|^\/(?:sitemap\.xml|robots\.txt|code-classes\.css|favicon[^/]*)$/;

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
```

`tools/docs-redirect-worker/src/index.js`:

```js
import { target } from './redirect.js';

export default {
  fetch(request) {
    return Response.redirect(target(new URL(request.url)), 301);
  },
};
```

`tools/docs-redirect-worker/wrangler.toml`:

```toml
name = "docs-evanion-redirect"
main = "src/index.js"
compatibility_date = "2026-10-01"
account_id = "314494abccacb8bfe11e5a10b913cc58"
workers_dev = false

[[routes]]
pattern = "docs.evanion.com/*"
zone_name = "evanion.com"
```

`README.md`: two lines on what it does and how to deploy (`npx wrangler deploy` from this directory, after the Pages domain moved).

- [ ] **Step 4: Run and see it pass; dry-run the deploy**

Run: `npx vitest run tools/docs-redirect-worker/src/redirect.test.js` — Expected: PASS, 4 tests.
Run: `cd tools/docs-redirect-worker && npx wrangler deploy --dry-run` — Expected: `--dry-run: exiting now.` with no error.

- [ ] **Step 5: Commit**

```bash
git add tools/docs-redirect-worker
git commit -m "build(repo): redirect docs.evanion.com to libs.evanion.com/docs"
```

Then push the branch and open the PR. Do not merge before Task 8 step 1 is done.

---

### Task 8: Switch-over (after the PR is approved; owner and agent together)

**Files:** none (operations). Record the outcome in the PR thread.

- [ ] **Step 1 (owner):** In the Cloudflare dashboard, zone `evanion.com`, add DNS `CNAME libs → evanion.github.io`, proxied. Verify: `dig +short libs.evanion.com` returns Cloudflare addresses.
- [ ] **Step 2:** Merge the PR. Wait for the Docs workflow to deploy (`gh run list --workflow docs.yml --limit 1`). Verify on the old host, which still serves the export: `curl -sI https://docs.evanion.com/docs/urn/ | head -1` → `200`; `curl -s https://docs.evanion.com/urn/ | grep -o 'url=[^"]*'` → `url=/docs/urn/`.
- [ ] **Step 3:** Move the Pages domain: `gh api repos/Evanion/libraries/pages -X PUT -f cname=libs.evanion.com`. Poll `curl -sI https://libs.evanion.com/ | head -1` until `200`.
- [ ] **Step 4:** Immediately deploy the Worker: `cd tools/docs-redirect-worker && npx wrangler deploy`.
- [ ] **Step 5:** Verify with a script, every line expecting the status and location shown:

```bash
for p in / /acl/ /acl /next/urn/api/ /urn/getting-started.md /matrix-explorer/ /sitemap.xml; do
  printf '%-28s ' "$p"; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://docs.evanion.com$p"
done
for p in / /docs/ /docs/acl/ /docs/next/urn/ /docs/acl/matrix-explorer/ /urn/ /sitemap.xml /robots.txt; do
  printf '%-28s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://libs.evanion.com$p"
done
```

Expected: every old-host line `301` to the matching `https://libs.evanion.com/...`; every new-host line `200` (`/docs/` and `/urn/` serve the redirect pages with `200`).
