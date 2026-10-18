# libs.evanion.com: one site, product pages at the root, docs under /docs

Status: project 1 (site move) shipped 2026-10-18 (#503, #504). Project 2 (product pages) not started. Decisions
below are the owner's unless marked open.

## Why

The frontpage links straight into the docs. The owner wants room to explain the
families' features and benefits to potential users in a fun, low-technical,
interactive way, and to win search traffic. A possible hosted service built on
the libraries would be introduced from the same pages later.

## Decided

- One unified site, one domain. No split across hosts.
- Domain: `libs.evanion.com`. Product pages at the root, docs under `/docs`.
  Chosen over `docs.evanion.com/docs`, which reads redundant.
- Product pages are per family, not per package: `/feature-flags/`,
  `/authorization/`, `/rendering/`. Adapters (react-acl, react-feature,
  react-widget, astro-widget) appear on their family page as "use it in React
  or Astro". Identifiers and standalone packages keep the frontpage card into
  the docs.
- Goals: search traffic, and room to explain features and benefits in a fun,
  low-technical, interactive way.

## Proposed split of jobs (to confirm)

| Surface           | Job                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Frontpage section | one line and the demo: the hook                                                                         |
| Family page       | why it exists, capability tour with small interactive pieces, use cases, use it in React/Astro, install |
| Docs overview     | the mental model and how it works, shorter, links to the family page for the why                        |
| README            | the npm window: hero, first example, link to the family page                                            |

The family page owns the pitch; the other surfaces link to it rather than
restate it. Marketing angle must stay aligned across all four (see the
2026-10-17/18 alignment work: feature = "a plain document you own, decided in
your API, build and browser; a build settles what it knows and leaves the rest
for the visitor").

## Two projects, in order

1. Site move: Pages custom domain `docs.evanion.com` to `libs.evanion.com`;
   every docs route gains `/docs` (`/acl/...` to `/docs/acl/...`, `/next/...` to
   `/docs/next/...`, archive cuts included); frontpage stays at `/`;
   `docs.evanion.com/<path>` redirects to `libs.evanion.com/docs/<path>` at
   Cloudflare (GitHub Pages serves one custom domain). Update the 33
   `docs.evanion.com` references (READMEs, `metadataBase` in
   `apps/docs/app/layout.tsx`, SECURITY.md links, the CNAME check in
   `.github/workflows/docs.yml`). One switch-over.
2. Product pages in a `(product)` route group (precedent: `(tool)/matrix-explorer`,
   outside the versioned docs so the archive cutter never touches them), with
   per-page metadata for search.

## Current infrastructure (verified 2026-10-18)

- Static export (`output: 'export'`, `trailingSlash: true`) deployed to GitHub
  Pages by `.github/workflows/docs.yml`; `CNAME` is `docs.evanion.com`.
- DNS for `evanion.com` on Cloudflare; `docs.evanion.com` CNAME to
  `evanion.github.io`, proxied.
- Cloudflare CLI: `npx wrangler` (4.151.1) logged in by OAuth on 2026-10-18,
  account `evanion@icloud.com` (314494abccacb8bfe11e5a10b913cc58), zone
  `evanion.com` d06db6c90369b4d719ae0d0e19e9fd91 (Free). The OAuth scopes cover
  workers, workers_routes and pages, and zone read only: no DNS edit, no
  redirect rules.
  - Redirect `docs.evanion.com/*` to `libs.evanion.com/docs/*`: a small Worker on
    that route returning 301 with the path kept; doable from the CLI.
  - DNS `libs` CNAME `evanion.github.io` (proxied): one manual record in the
    dashboard, or an API token with DNS edit.

## Open

- Build both designs now, or move the site first and design product pages
  after.
- What the matrix explorer tool's URL becomes (`/matrix-explorer/` at the root
  or under `/docs`).
- Product page content and interactive pieces per family.
- Whether `/next/` stays the label for unreleased docs under `/docs/next/`.
