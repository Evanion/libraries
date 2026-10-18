# Move the docs site to libs.evanion.com, with the docs under /docs

Status: approved by the owner (2026-10-18). Unreleased docs keep the `next`
label at `/docs/next/`. Project 1 of
`2026-10-18-libs-site-and-product-pages-design.md`; the product pages are
project 2 and start after this lands.

## Outcome

One site at `https://libs.evanion.com`. The frontpage stays at `/`. Every
documentation page moves under `/docs`. The root is left free for the family
product pages (`/feature-flags/`, `/authorization/`, `/rendering/`). Every URL
that `docs.evanion.com` serves today keeps working through a permanent redirect
to the same page under `libs.evanion.com/docs`.

Success means: no reader or crawler following an old link gets a 404; search
engines see one canonical host; the docs build, the archive cuts and every
docs check pass with the new paths.

## Approach

One Next app (`apps/docs`), routes moved. Chosen over a second root app with
`basePath: '/docs'` on the docs app, which would prefix links for free but
would move the landing demos, `app/navigation.ts` and the release state across
an app boundary and split the deploy into two builds.

## URL map

| Now (`docs.evanion.com`)                                | After (`libs.evanion.com`)                         |
| ------------------------------------------------------- | -------------------------------------------------- |
| `/`                                                     | `/` (frontpage, unchanged)                         |
| `/<slug>/...` (released section)                        | `/docs/<slug>/...`                                 |
| `/<slug>/v<line>/...` (superseded line)                 | `/docs/<slug>/v<line>/...`                         |
| `/next/<slug>/...`                                      | `/docs/next/<slug>/...`                            |
| `/testing/...`                                          | `/docs/testing/...`                                |
| `/matrix-explorer/`                                     | `/matrix-explorer/` (tool page, stays at the root) |
| `/<path>.md` siblings                                   | `/docs/<path>.md`                                  |
| `/_pagefind/`, `/_next/`, `/sitemap.xml`, `/robots.txt` | unchanged, at the root                             |

## Changes in the app

1. Routes: `app/(site)/[...mdxPath]` and `app/(next)/next/[...mdxPath]` move
   under `app/docs/`; `(tool)/matrix-explorer` stays at the root, a
   standalone tool and not a docs page. `(home)` stays at the root. Every route stays
   statically generated.
2. Links built in code: `content-page.tsx` (`releaseHref`), `navigation.ts`,
   `page-maps.ts`, `sidebar.ts`, `versions.ts`, `release-state.ts` and the 6
   hard-coded `href="/..."` in components take one shared docs prefix
   (`DOCS = '/docs'`), so no module spells the prefix itself.
3. Content links: the 70 root-absolute links in `content/next/**/*.mdx`
   (`](/acl/...)`) are rewritten to `/docs/...` once, by a script run in the PR
   and then deleted. Relative links (`../rollouts`) need no change.
4. Archive cuts: pages cut from older commits carry the old root links and
   cannot be edited. `tools/cut.mjs` gains one transform: a root-absolute link
   into the docs tree is prefixed with `/docs` at cut time, the same way the
   cut already replaces live demos and freezes probes. A link that already
   starts with `/docs/` is left alone, so a page cut after this lands is not
   prefixed twice.
5. Redirects on the new host: `tools/redirects.mjs` keeps its per-page map and
   gains a prefix rule. Every old docs path (`/<slug>/...`, `/next/...`,
   `/testing/...`) gets a redirect file at its old path on
   `libs.evanion.com`, pointing at `/docs/...`. The existing per-page entries are
   re-pointed straight at their `/docs` targets so no reader walks two
   refreshes. A product path (`/feature-flags/` etc.) never collides with a
   package slug.
6. Search and metadata: `metadataBase` in `app/layout.tsx` becomes
   `https://libs.evanion.com`; `public/CNAME` becomes `libs.evanion.com`, which
   the sitemap and `robots.txt` already read their host from. Pagefind indexes
   the export as before; result URLs carry the `/docs` paths.
7. Repository references: the 33 `docs.evanion.com` links in READMEs,
   `libs/acl/SECURITY.md`, `internal/baize-ui/README.md`, the root README,
   `apps/storefront/src/lib/catalogue.ts` and `sitemap.test.mjs` move to
   `libs.evanion.com/docs/...` (the frontpage link to `libs.evanion.com/`).
   Specs under `docs/specs/` are history and keep their old links.
8. CI: `.github/workflows/docs.yml`'s artefact check expects
   `CNAME = libs.evanion.com` and the moved sample paths
   (`docs/urn/getting-started.md`, `docs/next/urn/getting-started.md`,
   `docs/testing/index.html`).

## Checks that must stay green

`doc-links.test.ts` (every root link resolves to a page, route or redirect),
`doc-redirects.test.ts`, `docs-archive.test.ts`, `docs-navigation.test.ts`,
`doc-specimen.test.ts`, `sitemap.test.mjs`, `surface.test.ts`, the docs build
and `docs:archives`. New tests: the cut prefixes a root docs link once and
leaves a `/docs/` link alone; every old docs path has a redirect file to the
same page under `/docs`.

## Switch-over (in this order)

1. Owner adds DNS in the Cloudflare dashboard: `libs` CNAME
   `evanion.github.io`, proxied. (The wrangler OAuth token cannot edit DNS.)
2. Merge the PR. The docs workflow deploys the export with the `/docs` paths.
3. Set the Pages custom domain:
   `gh api repos/Evanion/libraries/pages -X PUT -f cname=libs.evanion.com`
   (the deployment uses the Pages API domain, not the CNAME file). Wait for
   GitHub's certificate.
4. Deploy the redirect Worker with wrangler on route `docs.evanion.com/*`:
   `301` to `https://libs.evanion.com/docs/<path>`, query kept;
   `docs.evanion.com/` goes to `https://libs.evanion.com/`. The Worker lives in
   the repo (`tools/docs-redirect-worker/`) so the rule is reviewed and
   versioned.
5. Verify: a sample of old URLs (a released page, a `/next/` page, a `.md`
   sibling, a superseded line, the explorer) answers `301` to the right new URL,
   and each new URL answers `200`.

Between steps 2 and 3, `docs.evanion.com` serves the new export, whose old
paths are covered by the redirect files from change 5, so no link breaks. Step
3 moves GitHub Pages off `docs.evanion.com`, and until step 4's Worker answers
that host, its requests fail. Steps 3 and 4 run back to back, with the Worker
prepared and dry-run (`wrangler deploy --dry-run`) beforehand, so the gap is
the minutes GitHub takes to issue the certificate for `libs.evanion.com`.

## Out of scope

The product pages (project 2), any copy change, and moving the npm package
`homepage` fields (they point at GitHub and stay).
