# Released by default

Status: proposed
Supersedes: `2026-09-13-versioned-docs.md` decisions 2, 4, 5, 6, 7 and 11. Its
decisions 1, 3, 8, 9, 10 and 12 stand unchanged. Decision 11 deferred everything
but the labelling; this document ends that deferral, and section 5 is why — the
deferral rested on archives costing nothing to postpone, which is true of
archives and false of the default view. Read it first; this document is an
amendment, not a replacement, and it repeats none of its arguments.
Depends on: `apps/docs/app/navigation.ts`, `tools/doc-examples` (the region
loader), `tools/repo-checks/src/docs-navigation.test.ts`,
`2026-09-13-interactive-examples.md` (merged as #166, adds the probes an archived
page has to handle), `.github/workflows/docs.yml`, `.github/workflows/release.yml`
Prior art: Docusaurus versioning (`docs/` → `/docs/next/`, newest release at the
bare path, older at `/docs/1.0.0/` — the same inversion, site-wide) and its
multi-instance plugin (the only prior art anywhere for per-package independent
version sets), Read the Docs (`stable` = highest semver tag, `latest` = default
branch), `docs.rs` (`/latest/` served as a real path). Nextra has no versioning
and no site that versions it was found.

## Why

The prior spec's decision 2 keeps `main` at the bare path, and its section 6
argues the alternative is unavailable:

> Changing it to "the newest release" is not available: the packages are tagged
> independently, so "the site at the newest release" is eight different commits
> and there is no tree that is all of them at once.

That argument is sound and it refutes something nobody wants. It assumes the site
has one default resolved from one tree. The site does not need one. Its own
decision 1 already establishes that the version axis is per package and scoped to
the section; the default is a point on that axis, so it is per package too.
`/luhn/` serves luhn's release and `/urn/` serves urn's, from two different
commits, for the same reason their switchers offer different numbers. There is no
tree that is all of them at once and none is required.

What remains of the objection is real and is handled in section 4: the site
chrome, the landing page and the cross-package guides belong to no package and
therefore have no version. They build from `main` and always will.

The reason to invert is that the current default states the weaker claim under
the stronger label. A reader who installs `@evanion/luhn@3.0.0` and lands on
`/luhn/api` is reading `main`. Decision 2 of the prior spec labels that
accurately, which is a real improvement and ships in #165, but a correct label on
the wrong content is a worse outcome than the right content: the overwhelmingly
common reader is on the released version, and the page they get by default should
be about the thing they installed.

## Decisions

1. The bare path serves the package's newest release. `main` moves to
   `/next/<slug>/…`. Supersedes decision 2.
2. The version segment is the caret-compatible one: `v<major>` at or above 1.0.0,
   `v0.<minor>` below it. Supersedes decision 4's "major granularity", which is
   wrong for the four packages still on 0.x.
3. `content/next/<slug>/` is the only committed content. Everything else under
   `content/` is generated and gitignored. Supersedes decision 6.
4. A committed pin file, `apps/docs/archives.json`, is the source of truth for
   what each version directory is cut from. The build generates content from git
   at the pinned SHA. Supersedes decision 5's "read out of the release tags",
   which cannot survive decision 7 below.
5. A package whose current release is not yet documented is seeded: its bare path
   is cut from `main` at cut time, but only when `nx release` computes no bump for
   it. A package that would bump is not seeded and keeps serving `/next/` content
   under a notice until its next release.
6. An archived page keeps its values frozen and states the commit that produced
   them. Probes freeze rather than strip; playgrounds strip. Amends decision 7.
7. A `workflow_dispatch` re-cuts one pinned version by opening a pull request that
   changes one line of the pin file. It never pushes.
8. Internal links within a package section are relative. The 63 absolute ones are
   fixed at the source before any version directory exists.
9. The two widget renderers stay at flat sibling slugs.

Decision 5 is the one that makes the inversion deliverable rather than aspirational,
and section 5 is where it is argued. Decision 6 is where I expect disagreement,
for the same reason decision 7 of the prior spec did.

## 1. The URL grammar

```
/                             landing, no version
/guides/…                     cross-package, no version
/luhn/usage                    @evanion/luhn 3.0.0 — the release
/luhn/v2/usage                 @evanion/luhn 2.x as it shipped
/react-widget/v0.1/getting-started   @evanion/react-widget 0.1.x as it shipped
/next/luhn/usage               main
```

Every segment is fixed-length and `<slug>` is exactly one segment:

```
[/next] /<slug> [/v<seg>] /<page>
```

The current release is served only at the bare path and never additionally at
`/luhn/v3/`. Two URLs for identical bytes splits inbound links and returns both
from Pagefind. Docusaurus makes the same choice.

`identity()` in `apps/docs/app/[...mdxPath]/page.tsx` keys on `mdxPath[0]`, which
stops being the slug under this grammar. Generalise it once, to
`packageFor(mdxPath)` returning the slug, the version segment and whether the
path is `next`, and route every version-aware decision through that one function
before anything else is built.

## 2. Granularity is the caret-compatible segment

`nx.json` sets `adjustSemverBumpsForZeroMajorVersion: true`, so below 1.0.0 the
minor is the breaking bump. Four of the eight packages are there today
(`react-widget` 0.2.0, `astro-widget` 0.2.0, `token` 0.1.0, and `widget` when it
publishes at 0.1.0). Major-only granularity would file every 0.x release of a
package into one `v0` bucket that mixes mutually incompatible versions, which is
the opposite of what the segment is for.

The unit a reader is actually pinned to is the caret range npm resolves —
`^0.2.0` gives 0.2.x only, `^1.2.0` gives 1.x — so that is the archive key:

```
major > 0   →  v<major>        /luhn/v2/
major == 0  →  v0.<minor>      /react-widget/v0.1/
```

The reserved-segment rule from the prior spec's decision 4 widens to
`/^v\d+(\.\d+)?$/`. The tag glob for resolving a line's newest tag is
`{name}@{major}.*` at or above 1.0.0 and `{name}@0.{minor}.*` below it.

Full-semver URLs were considered and rejected. There are thirteen tags today,
each of which would be a complete section copy through the rewrite pass and an
entry needing its own allow-list check, and the retention rule would have nothing
meaningful to cut on. The reader on 2.0.1 and the reader on 2.0.0 want the same
page. Where the full version belongs is the label: the switcher shows `3.0.0` and
links to `v3`, so the reader sees the number they were looking for.

This also retires the prior spec's section 8 rule that packages below 1.0.0 get no
archives. Under the inversion every documented package needs a version identity
for its default view, 0.x included. Retention stays current-plus-one uniformly,
which today preserves `@evanion/react-widget@0.1.0`'s six pages.

## 3. Content layout

```
content/next/<slug>/**      authored, committed, watched by the dev server
content/<slug>/**           generated: the newest release
content/<slug>/v<seg>/**    generated: superseded lines
```

One git move, `content/<slug>/` → `content/next/<slug>/`, and everything else
under `content/` joins `.gitignore`.

The layout is forced by the dev loop rather than chosen. Nextra 4.6.1 resolves its
content root once, at config load, from a module-level `fg.sync(['{src/,}content'])`;
`contentDirBasePath` is a URL prefix and not a second source directory, and a
second `nextra()` call does not give a second tree. So every version must be a
directory under the one `content/`. Given that, authored MDX has to live where the
Turbopack watcher already sees it, because writing docs on `main` is the daily
workflow and any layout that copies authored content into place kills hot reload
on it. `content/next/<slug>/` is the only position satisfying both.

Consequences:

- `content/_meta.ts` needs `next: { display: 'hidden' }`, or Nextra appends a
  "Next" entry to the package sidebar. A `content/next/_meta.ts` mirrors the root
  one so the sidebar inside `/next/*` lists packages the same way.
- `docs-navigation.test.ts`'s `documented === existsSync(content/<slug>/index.mdx)`
  becomes `content/next/<slug>/index.mdx`. Authored content is the truth for
  `documented`; a generated snapshot must never satisfy that assertion.
- The "edit this page" link resolves against a generated path on every default
  page. It has to be rewritten to point at the authored file under
  `content/next/`, or hidden on generated pages. Left alone it offers to edit a
  file that is not in git.

## 4. What has no version

The landing page (`app/page.tsx`, outside Nextra), the cross-package guides, the
navbar, the footer and the search index build from `main`, unversioned. This is
the residue of the prior spec's section 6 objection and it is correct: those
surfaces belong to no package, so there is no tag to cut them at.

One consequence worth stating rather than discovering: the landing page's live
specimens (`LuhnSpecimen`, `TokenSpecimen`, `UrnSpecimen`) execute against the
workspace packages on every build and stay live. So the page every visitor arrives
at is the live-execution showcase, and the version pages carry frozen evidence
with a named commit. That ordering is right — a reader inside `/luhn/` wants what
3.0.0 does, not what `main` does.

## 5. Seeding

Measured today, per package: commits touching the package root since its newest
tag, and how many of those change behaviour rather than comments or formatting.

| package                 | src commits | behavioural | what the source commits are            |
| ----------------------- | ----------- | ----------- | -------------------------------------- |
| `luhn`                  | 2           | 0           | prettier, comment rewrites             |
| `compose`               | 2           | 0           | comment rewrites                       |
| `nestjs-correlation-id` | 3           | 0           | prettier, comment rewrites             |
| `astro-widget`          | 3           | 1           | prototype-chain own-key fix            |
| `urn`                   | 3           | 1           | r-, q- and f-components (RFC 8141 2.3) |
| `token`                 | 3           | 1           | web crypto for browser support         |
| `widget`                | 8           | 5           | ctx/props, meta typing, suspense       |

and, at each package's newest tag, the pages that exist in its own content
directory against the pages on `main`:

| package                 | at tag | on main |
| ----------------------- | ------ | ------- |
| `widget`                | 6      | 6       |
| `urn`                   | 4      | 5       |
| `compose`               | 1      | 3       |
| `astro-widget`          | 0      | 4       |
| `luhn`                  | 0      | 6       |
| `token`                 | 0      | 5       |
| `nestjs-correlation-id` | 0      | 4       |

Cutting the bare path from the tag alone would serve an empty `/luhn/` — the
package released two days ago, with the probe #166 just added. Thirty-three pages
become eleven. The inversion would be announced and not delivered.

So a package is seeded — its bare path cut from `main` rather than from the tag —
when `main` is not ahead of the release in any way that matters. The predicate:

> A package seeds iff `nx release version --dry-run --projects=<p>` computes the
> version the package's newest tag already names, and every workspace dependency
> of it also seeds.

Run the dry run; do not reimplement the bump. `nx release` attributes a commit by
its scope rather than by the files it touched (`conventionalCommits.packages` in
`nx.json`), so "commits touching the package root" and "commits nx counts" are
already different sets, and a second parser of the same commits would drift from
the pipeline it is supposed to agree with. The dependency clause follows from
`updateDependents: "always"`: a package bumps when a workspace dependency bumps,
so a seed is only honest if its dependencies are unchanged too. `@evanion/token`
depends on `@evanion/luhn`; luhn seeds, so the clause changes nothing today and
will matter at the next cut.

Applied today: `luhn`, `compose` and `nestjs-correlation-id` seed. `urn`, `token`,
`astro-widget` and `widget` do not, and until their next release their bare path
serves `content/next/` content under a notice naming the published version and
stating that no documentation was published for it. Three of seven is a real
day-one inversion; the remaining four complete themselves at their next release
without further work.

The predicate is evaluated once, at cut, and frozen in the pin file with the
dry-run output recorded in `reason`. It is deliberately not a repo-check: the
moment a `fix` lands on luhn the predicate goes false, and a check asserting it
would start failing about an already-cut seed, which is the wrong question asked
at the wrong time.

Not seeding at all was considered. For an indeterminate period seven of eight
packages would serve identical bytes at `/luhn/api` and `/next/luhn/api`, Pagefind
would index every page twice, and every inbound link would split. That duplicate
state is the concrete failure, not the softness of the seed's claim.

## 6. The pin file and the cut

`apps/docs/archives.json`, committed. One entry per (slug, version segment):

```json
{
  "luhn": {
    "current": {
      "version": "3.0.0",
      "tag": "@evanion/luhn@3.0.0",
      "sha": "115516f",
      "reason": "seed: nx release version --dry-run computes 3.0.0 at this SHA"
    },
    "v2": { "version": "2.0.1", "tag": "@evanion/luhn@2.0.1", "sha": "29f6c2a" }
  }
}
```

The docs build reads the pin, resolves content out of git at that SHA
(`git show <sha>:apps/docs/content/<slug>/…` — no worktree needed; reading eight
tags this way measured 0.01s against a 45 MB `.git`), and materialises
`content/<slug>/` and `content/<slug>/v<seg>/` before `next build`. The generated
directories are gitignored.

Pure generation from the newest tag, which the prior spec's decision 5 specifies,
cannot survive decision 7: a re-cut would have nowhere to live and the next build
would silently revert it. Committing the generated MDX instead — the Docusaurus
model — puts roughly forty files per version into every code review and makes the
`main` ruleset's deploy-key bypass carry content commits. The pin is the third
option: the repo stays clean, the snapshot stays reproducible from git, and a
re-cut is a one-line reviewable diff that permanently records that a re-cut
happened.

Both per-section `_meta.ts` files (`content/urn/`, `content/widget/`) import only
`MetaRecord` from `nextra` and are otherwise self-contained, so copying a section
from a pinned SHA carries its `_meta.ts` for free. A check keeps that true: a
`_meta.ts` under `content/` may not import from outside its own directory and may
not import a workspace runtime package. Without it, a `_meta.ts` that reads
`app/navigation.ts` silently makes every snapshot's sidebar track current
navigation.

Nothing in `release.yml` changes. The release push to `main` already triggers
`docs.yml`, and the new tags are present in that same push, so the existing
trigger sees a world where the tag exists. A separate tag-triggered workflow would
add a second build racing the first for the `pages` concurrency group; it is not
built. (The `GITHUB_TOKEN` event-suppression rule does not apply here: `nx release`
pushes over SSH with `RELEASE_SSH_KEY`. Verified — release commit `360f5bf7`
produced a `Docs` run eight seconds later.)

One prerequisite, and it is a live bug independent of this document:
`docs.yml`'s paths filter lists `apps/docs/**`, `libs/**` and the two package
files, and omits `nest/**`. A `@evanion/nestjs-correlation-id`-only release
touches nothing in that list, so the docs never rebuild. Today that is a stale
page; under the inversion it means a released package serves its previous release
indefinitely, silently.

## 7. The re-cut

`workflow_dispatch` with `slug`, `segment`, `sha` (default: current `main`) and a
required non-empty `reason`. It opens a pull request changing one line of
`archives.json`. It does not push.

That is the integrity answer. The ruleset's pull-request requirement becomes the
control, no deploy-key bypass is involved, and the diff is the audit record —
GitHub's own history says who asked, when, and why.

Guards on the input:

- The new SHA is a descendant of the tag's SHA and an ancestor of `main`. Stops
  pinning released documentation to an unrelated or unreviewed commit.
- `(slug, segment)` names a version that was actually released.
- The PR body renders `git diff <pinned-sha> <new-sha> -- apps/docs/content/<slug>/`
  inline. This is the part that stops a quiet rewrite: a reviewer sees exactly how
  the released documentation is about to change without going to look, and a
  re-cut whose diff is 400 lines is visibly not a typo fix.
- A repo-check asserts every pin whose SHA is not its tag's SHA carries a
  non-empty `reason`, and that reasons are unique — a copy-pasted justification is
  the failure mode.

What this cannot do is stop a maintainer with bypass rights from rewriting
history. What it does is make doing so quietly require deliberately defeating a
guard, and leave a record that survives.

## 8. The executed-example claim

The prior spec's section 4 sets out the conflict and resolves it for archives.
The inversion moves the conflict onto the default path, because the bare path
becomes a snapshot: the page every reader lands on is frozen and not
re-executed, and the live guarantee applies only to `/next/`.

The claim is restated rather than weakened. In one sentence, true of the default
path, the archives and `/next/` alike:

> Every stated value on this site was produced by running the package version the
> page documents, in CI, at a named commit.

A value produced by running `@evanion/luhn@3.0.0` is better evidence for a page
about 3.0.0 than a value produced by running `main`. Today's page offers the
weaker evidence wearing the stronger label; that is the thing being fixed, not a
cost being paid.

Provenance renders beside the release notice at the top of every section page:

- tag-cut: "`@evanion/luhn 3.0.0`. Values on this page were produced by running
  3.0.0 in CI at `a1b2c3d` and are not re-executed."
- seeded: "`@evanion/luhn 3.0.0`. Values on this page were produced by running the
  source at `115516f`, which `nx release` versions as 3.0.0, and are not
  re-executed." The SHA is `main`'s and differs from the tag's; the clause after
  it is the seed predicate, stated. A reader who diffs the two finds prettier and
  comment rewrites, which is what the sentence already told them.
- `/next/`: "These pages document unreleased changes. Values are produced by
  running the current source on every build." No SHA, because it is live.

Probes freeze rather than strip, amending decision 7 of the prior spec. A probe is
a call and a result, and CI produced that result at the pinned commit; the frozen
form keeps the affordance and the shipped values with the input disabled, under
"Produced by `@evanion/luhn` 3.0.0 at `a1b2c3d`. Not re-executed.", and links to
the same page under `/next/` to run it live. `WidgetPlayground` and
`PlaygroundExamples` evaluate live React against the workspace package and have no
value to freeze, so those still strip to a link.

The region loader runs on `content/next/**` only. Generated content has its
regions inlined at cut time from the README at the pinned SHA, so the loader has
nothing to fill and a later rename cannot reach it. The prior spec's test — that
no `file=…region=…` attribute survives in generated output — now has to hold for
the default path as well as for archives. The eight occurrences in
`content/next/urn/` are the fixture.

The minimum component surface a generated page may use: prose primitives from
`@evanion/baize-ui` (`Panel`, `Text`, `Callout`, `Tabs`, `Steps`), `FrozenProbe`,
`ArchiveNotice`. The defining constraint is no import from `app/navigation.ts`, no
import of a workspace `@evanion/*` runtime package, and no state beyond
presentation. `WorkshopNotice` is deliberately outside the set — it throws on a
slug absent from current navigation, which is a correct guard on authored content
and must not be weakened to serve generated pages that are not permitted to
contain it. Chrome that reads repo state resolves to a literal at cut time: at
snapshot time you know whether the package was private, so write the outcome.

Three mechanisms pin the surface, in order of importance:

1. The cut parses the emitted MDX and fails if any JSX element name falls outside
   the allow-list. This puts the failure at cut time, when a human is present,
   rather than two years later during an unrelated refactor. It is the mechanism
   that would have caught the Docusaurus MDX v1→v3 breakage.
2. A repo-check applies the same assertion to every file under a generated
   directory.
3. The archive components live in `apps/docs/components/archive/` with a test
   asserting the two import constraints, so a future refactor trips over it.

Re-executing the default path against the published package was reconsidered
under the inversion and rejected again. It is N×1 rather than the N×M the prior
spec turned down, so it is not absurd, but it adds a second resolution graph to
`apps/docs`, makes the docs build depend on the registry, and for a seeded package
it re-executes code the predicate has already proved identical.

## 9. Links

Every cross-page link in `content/` is absolute — 63 of them, written
`](/urn/components)`, with no relative ones. Served from `/next/` or `/luhn/v2/`,
all 63 silently leave their version and land on the current one with a 200. A
reader on a v2 page clicks through to the API reference and gets v3.

The fix goes in the authored content, before any version directory exists, not in
a rewrite pass at cut time:

- A link from a page to another page in the same package section is relative.
- A link to another package's section stays absolute and deliberately escapes to
  that package's current version, because `/luhn/v2/` has no urn v2 to point at.

Repo-check: no absolute link inside `content/next/<slug>/` whose first path
segment equals its own slug. Fixing the 63 at the source means the cut performs no
link rewriting at all, which removes a pass and its failure modes rather than
adding one.

## 10. Search and SEO

One Pagefind index, filtered. Pagefind runs postbuild over the built HTML and the
client hardcodes `/_pagefind/`, so N builds would mean N indexes and no
cross-version search. Pages carry `data-pagefind-filter="pkg:<slug>"` and
`version:<segment|current|next>`, and a client wrapper reads the route and passes
`{ filters: { … } }` through `<Search searchOptions>`. The default query is scoped
to `current`.

This has a failure mode that must be guarded, not reviewed: today's build reports
`Indexed 0 filters`. If the attribute is misspelled or lands outside the indexed
body, Pagefind indexes zero filters and a filtered query returns zero results for
every term, site-wide, with a green build. Section 11 asserts it.

SEO, following the standard handling: the bare path is canonical and indexed;
`/v<seg>/` and `/next/` carry `noindex,follow` and stay out of the sitemap.
`follow` matters — it keeps link equity flowing back to the default pages.
Archived pages are not blanket-canonicalled to the current one, because the
content genuinely differs; a canonical goes on only where an archived page is
byte-identical to the current one.

Bandwidth is a nearer ceiling than size. At the target shape the site is about
80 MB and the Pages bandwidth allowance is 100 GB/month, so archives triple what a
crawler pulls for content nobody reads. That is a second argument for `noindex`
beyond ranking.

## 11. Guards

Ordered by how silently the failure ships. The first four would deploy broken.

1. **Pagefind filters exist.** After the build, `out/_pagefind/filter/` is
   non-empty and its filter values are exactly the expected set.
2. **Every exported page carries exactly one `version` value.** A page with none
   is invisible to the default filtered query: it exists, it is linked, and it
   cannot be found.
3. **The bare path corresponds to the newest tag.** For each documented package,
   the content serving `/<slug>/` was cut from that package's newest release line.
   A release that publishes to npm but whose docs cut did not fire leaves the site
   claiming an old version as current, with no error anywhere. This is the check
   that catches the `nest/**` paths hole in section 6.
4. **Every generated directory is non-empty and complete.** At least one page,
   `index.mdx` present, page count at least the count in the source tree at the
   pinned SHA. Catches a copy step that silently dropped files.
5. Pin ↔ disk both ways: every pin has a directory, every generated directory has
   a pin.
6. Every path the switcher can offer exists in `out/` as `index.html`. Asserted
   over the export, because `generateStaticParams` is what decides.
7. `/next/` exists for exactly the packages that have a bare section, and the
   converse.
8. Reserved segments: nothing committed under `content/next/<slug>/` matching
   `/^v\d+(\.\d+)?$/` or named `next`.
9. `noindex,follow` on every `/v<seg>/` and `/next/` page and absent from every
   bare page; `sitemap.xml` contains exactly the bare set.
10. Pin integrity: SHA is a descendant of the tag and an ancestor of `main`,
    `reason` present and unique where the SHA is not the tag's, and
    `nx release version --dry-run` at that SHA computes the version the pin
    records. That last assertion validates tag-cuts and seeds with the same code.
11. No `file=…region=…` attribute survives in generated output; no JSX element
    outside the allow-list; no `_meta.ts` importing outside its directory.
12. The existing "Check deploy artefacts" step gains `_pagefind/filter/` and
    per-version non-zero file counts, alongside the `.nojekyll` and `CNAME`
    assertions it already makes.

## 12. Widget slugs

The two renderers stay at `/react-widget/` and `/astro-widget/`. The intent behind
the nested `/widget/react/` shape — that the adapters read as two sides of one
coin — is delivered by the sidebar and the landing page, which every reader sees,
rather than by the address bar, which no reader reads. `groups` in
`app/navigation.ts` already puts both under one "Rendering from data" separator
with nothing between them, and they share one landing card whose body names both
runtimes. The URL nesting would additionally assert something false: the adapters
version independently, so `/widget/react/v0.2/` beside `/widget/astro/v0.1/` under
one `/widget/` prefix implies a shared version line that does not exist, and
`@evanion/widget` would have to be simultaneously a package section and the
container of two others. The grouping is strengthened where it is read instead —
each adapter's overview cross-links the other as the same item shape in a
different runtime, and the shape is documented once in the core `widget` section
and referenced from both.

This also keeps `<slug>` a single segment, which is what lets the URL grammar in
section 1 stay unambiguous.

It has to be settled before the first cut, and it is: renaming a slug afterwards
strands its archive at a dead path, and `output: 'export'` has no rewrite layer to
repair it. `@evanion/react-widget` is both the package being renamed and the only
package with a complete page set at its tag, so it is the worst possible overlap.

## Sequencing

1. Land #165 (the release notice and `release-state.ts`). It fixes a live wrong
   statement and produces the machinery the rest reads.
2. Add `nest/**` to `docs.yml`'s paths filter, with the check that asserts every
   directory matched by `nx.json`'s `release.projects` is covered by it.
3. Generalise `identity()` to `packageFor(mdxPath)`.
4. Fix the 63 absolute links; add the link check and the `_meta.ts` import check.
5. Build `FrozenProbe`, `ArchiveNotice` and the allow-list with its three checks.
6. Move `content/<slug>/` → `content/next/<slug>/`, gitignore the rest of
   `content/`, add the hidden `next` meta key, update `docs-navigation.test.ts`.
7. Build the pin file and the generator: region inlining, chrome resolution, probe
   freezing, playground stripping.
8. Cut the three seeds and `@evanion/react-widget@0.1.0`'s archive.
9. Switcher, page-for-page mapping, Pagefind filters, retention, SEO tags.

Steps 2 through 5 are independently useful and none of them is reversible work: the
links, the checks and the frozen components are all correct with or without the
inversion.

## Cost

Measured, not estimated. Today the site is 44 pages, 20 MB of `out/`, a 19-second
`next build`. A simulated 3× content set — which is exactly the target shape of
8 packages × (released + `/next/` + one retained line) — gives 132 pages, 77 MB,
22.7 seconds. The GitHub Pages published-site limit is 1 GB and the deployment
timeout is 10 minutes.

So scale is not a constraint for years, and nothing breaks at a threshold; it
degrades continuously. Nextra inlines the full page map into every page, so output
is O(n²): 2.8× the pages made each page 78% heavier (194 KB → 345 KB uncompressed,
22 KB → 25.6 KB gzipped), growing about 1.9 KB per page added anywhere on the
site. Every archived page makes every live page bigger, and no check will ever
trip on it. That is the argument for retention being current-plus-one and for
enforcing it rather than letting archives accumulate.

## Where I am guessing

- Nextra resolves its content root at config load. With `content/` reduced to a
  gitignored build output plus a committed `content/next/`, a fresh checkout with
  no prebuild has a `content/` containing only `next/`. Whether `next dev`
  tolerates that, and whether a prebuild writing sibling directories into
  `content/` before `next build` is indistinguishable from committed files, needs
  a spike before this is implemented. If it fails, the fallback is a route segment
  outside `content/`, which costs the theme frame.
- Pagefind filter values are asserted to exist but the client wrapper reading the
  route and passing them through `<Search searchOptions>` is untested against a
  static export with `trailingSlash: true`.
- The "edit this page" rewrite in section 3 is described but not designed; Nextra
  builds that URL from `docsRepositoryBase` and the page path, and whether it can
  be redirected per page without swizzling the theme is unverified.
