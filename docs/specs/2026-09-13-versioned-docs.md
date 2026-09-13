# Versioned documentation

Status: proposed
Depends on: `apps/docs/app/navigation.ts` (the package list both halves derive
from), `tools/doc-examples` (the region loader, which is where the executed-example
conflict lives), `tools/repo-checks/src/docs-navigation.test.ts` (the guard the
navigation axis has to survive), `2026-09-13-interactive-examples.md` (proposed;
adds a second kind of live element that has to be handled on an archived page)
Prior art: Docusaurus `docs:version` (copies the tree at release, site-wide),
VitePress (no versioning, maintainers recommend separate deployments), Nextra
(no versioning; its own site deploys v2 and v3 as separate sites), The Guild's
GraphQL Mesh (Nextra, one site, `/docs` and `/v1` as route subtrees with a navbar
dropdown and a banner on the old pages), Rust's `docs.rs` (per-crate,
per-version, rebuilt from the published crate — the only prior art here with
independent versions), React Router (one site, a version menu, one thing
documented)

## Why

`nx.json` sets `projectsRelationship: "independent"`. Today `@evanion/luhn` is
3.0.0, `@evanion/urn` 2.0.0, `@evanion/compose` 2.0.0,
`@evanion/nestjs-correlation-id` 2.0.0, `@evanion/token` 0.1.0, both widget
packages 0.2.0. There is no site version and there never will be one, so the
switcher every other docs site puts in the navbar has nothing to switch.

Two separate requests get called "versioning" and they have almost nothing in
common here.

A reader on `@evanion/luhn@2.0.1` wants 2.x docs. Those docs do not exist and
cannot be made to exist: at the `@evanion/luhn@3.0.0` tag, `content/luhn/`
contains zero files. Every one of the six luhn pages was first committed on
2026-09-13, a day after the tag. Section 2 has the same count for every package.

A reader evaluating an unreleased change wants docs for code that is not on npm.
Those docs exist and are deployed right now — the site builds from `main`, which
is 103 commits past the luhn tag and 136 past the urn one — and nothing on the
page says so. That is not a snapshot problem. It is a labelling problem, and it
is live today.

So the two halves land at different times, and most of this document is about
the first one being unbuildable rather than expensive.

## Decisions

1. The version selector is per package and scoped to the section the reader is
   in. A site-wide switcher names nothing here and is not built.
2. The default view is `main`, as today. Every package section states which
   published version it corresponds to and whether `main` is ahead of it.
3. That statement is a component on the page, not only a control in the chrome,
   on the `WorkshopNotice` pattern — a reader arriving from a search result sees
   neither sidebar nor switcher.
4. Archived versions live at `/<slug>/v<major>/…`, at major granularity. `v\d+`
   becomes a reserved first segment inside a package section.
5. Archives are produced by the docs build from git tags. `release.yml` is not
   touched, so a dry run has no docs effect by construction.
6. The build materialises archived content into `content/<slug>/v<major>/` before
   `next build`. Nextra renders it through the route that already exists.
7. An archived page keeps the values the tag shipped, marked as frozen, and every
   live element is removed from it at snapshot time — the region references
   inlined, the probes and playgrounds replaced with a link to the current page.
   Archives are not re-executed against old installs.
8. Search keeps one index. Archived pages are tagged with a Pagefind filter and
   the default query is scoped to the current version.
9. No backports. An archived page is what the tag shipped and is not edited.
10. Retention is the current major plus one.
11. Decisions 2 and 3 are built now. Decisions 4 through 10 are specified and
    deferred until a tag exists whose content directory is not empty.

Decision 11 is the one this document exists to argue. Decision 7 is the one I
expect disagreement on. Decision 1 is the only one that is not a trade-off.

## 1. There is no site version, so the switcher moves into the section

React, Vue, Astro and Docusaurus all version the whole site, and all four
document one thing. "v2 of the docs" is a sentence about React. Here it would
have to mean eight numbers at once, and the reader asking for it is asking about
exactly one of them.

The switcher therefore belongs to the package section, and it is visible only
inside one. On `/luhn/api` it offers luhn's versions. On the landing page, which
is `app/page.tsx` and outside Nextra entirely, it offers nothing, because the
question has no subject there.

### The URL

```
/luhn/api          the current view — main
/luhn/v3/api       @evanion/luhn 3.x as it shipped
/luhn/v2/api       @evanion/luhn 2.x, if it had ever had pages
```

The version segment goes after the package slug because that is where the scope
is. A `/v3/luhn/api` prefix reads as a site version and reintroduces the problem
decision 1 removes; it would also force a reader following a link from luhn 3.x
into urn's pages to carry a `3` that means nothing there.

Major granularity, not patch. There are thirteen release tags in this repository
already. One archive per patch means thirteen copies of a section that would
differ by a changelog line; the reader on 2.0.1 is asking about the 2.x API, and
the migration page is where a patch-level difference gets described. Majors also
match the retention rule in section 8 — they are what goes end-of-life.

`v\d+` becomes reserved as the first segment inside `content/<slug>/`. A page
named `v2.mdx` and an archive directory named `v2` are the same URL, and a static
export resolves that by whichever wrote the file last. `tools/repo-checks` fails
on a content file or directory directly under a package slug matching `/^v\d+$/`,
which is the same shape as the assertions it already makes.

### Nextra's own answer, and why it does not survive here

Checked against the installed 4.6.1 rather than assumed: neither `nextra` nor
`nextra-theme-docs` exports anything version-shaped, there is no versioned
content directory convention, and there is no equivalent of
`docusaurus docs:version`. The open request is
[shuding/nextra#4170](https://github.com/shuding/nextra/issues/4170), labelled
`enhancement`, opened February 2025, no maintainer reply; its author notes
versioning was planned for Nextra 3 and dropped. The Nextra 5 roadmap
([#3316](https://github.com/shuding/nextra/issues/3316), written by a maintainer)
does not list it. Treat it as not coming.

Nextra's own site handles versioning by deploying v2 and v3 as separate sites,
linked from a nav entry. That is a genuinely good answer for one documented
thing — a frozen deployment is actually frozen, no framework support is required,
and the two builds cannot break each other.

It does not scope down. Nextra deploys the site per version; here the unit is the
section, so the equivalent is a deployment per package per major. Eight packages
retaining one prior major is sixteen Pages sites, sixteen builds, sixteen
domains, and a sidebar that cannot span them — the reader on `luhn-v2.docs…`
either loses every other package from the navigation or gets a sidebar linking
across origins. Worse, the per-page switcher still needs to know which pages
exist in each other version (section 3), which means a build-time manifest
shared between deployments. That manifest is the entire mechanism of the
single-site approach, so the separate-deployment model costs the same work plus
fifteen deployments.

The Guild, who maintain Nextra, do not follow their own site's pattern on their
product docs. GraphQL Mesh runs one Nextra site with `/graphql/mesh/docs` and
`/graphql/mesh/v1` as sibling route subtrees, a navbar dropdown reading
`v1 latest` / `v0`, and a banner on the v0 pages pointing at the migration guide.
That is the shape below, one version axis short.

So this is custom either way, which is the honest framing. The site is a Next 16
App Router app, the landing page already lives outside Nextra on `app/page.tsx`,
and `content/_meta.ts` is derived from `app/navigation.ts` rather than typed out.
Routing and navigation are already ours.

What the theme does give, and it is enough: `<Layout>` takes a `navbar`, and
`<Navbar>` takes `children`, documented as "Extra content after the last icon".
`nextra/components` exports `Select` — `{ selectedOption, value, onChange,
options: { id, name }[] }` — and `nextra-theme-docs` exports `LocaleSwitch`,
which is that `Select` driven by the `i18n` prop. A version switcher is
`LocaleSwitch` with the locale swapped for a path prefix, which is the nearest
thing to a precedent in the codebase and is worth reading before writing one.
`<Layout banner>` takes a ReactNode and is where a site-wide notice would go.

The switcher does not go in the navbar, for the reason decisions 1 and 3 already
imply and the App Router makes concrete: `<Layout>` is mounted in
`app/layout.tsx`, which receives no route params, so navbar children cannot know
which package section the reader is in without becoming a client component that
reads the pathname. `app/[...mdxPath]/page.tsx` already has `params.mdxPath` and
already derives the package from its first segment — that is where `identity()`
gets the hue. The switcher and the notice mount there, beside the content, which
is also where a reader arriving from a search result sees them.

### The seam with Nextra

Nextra keeps rendering every content page, archived ones included. Decision 6 is
what makes that true: a prebuild step writes archived MDX into
`content/<slug>/v<major>/` before `next build` runs, so Nextra's page map,
`generateStaticParams`, the theme frame in `app/[...mdxPath]/page.tsx`, the table
of contents and the breadcrumbs all pick it up as ordinary content and none of
them learn what a version is.

Above the seam: git tags, file copying, MDX rewriting. Below it: Nextra,
unchanged. Two new components — the switcher and the release notice — plus one
generated module are the only version-aware code in the render path.

The generated module is needed because `_meta.ts` is an ES module bundled into
the page map and cannot read the filesystem, which is the same constraint that
produced `app/navigation.ts`. The prebuild writes
`app/archived-versions.generated.ts`:

```ts
export interface ArchivedVersion {
  /** The package slug, as in `app/navigation.ts`. */
  slug: string;
  /** The major, as in the URL segment: `v3` is `3`. */
  major: number;
  /** The tag it was taken from. */
  tag: string;
  /** Page paths relative to the section, so the switcher can map page for page. */
  pages: readonly string[];
}

export const archived: readonly ArchivedVersion[] = [];
```

It is committed empty and gitignored after that, so a fresh checkout builds
before the prebuild has run and a build with no tags available degrades to the
current view rather than failing.

### What `docs-navigation.test.ts` asserts, unchanged

That test holds `app/navigation.ts` against `release.projects`: every released
package appears, nothing unreleased does, roots match the project graph, hues are
unique. The guard was deliberately restored after being loosened, and none of it
weakens here, because an archived version is not a navigation entry. `packages`
stays a list of packages. A version is a second axis over that list, carried in a
generated module the test does not read.

Three assertions are added rather than relaxed:

- Every `slug` in the generated manifest is a slug in `packages`.
- Every `tag` in it resolves in the repository, and its major matches the
  directory it was written to.
- No file or directory directly under `content/<slug>/` matches `/^v\d+$/`.

## 2. The historical half is empty, measured

Every released package, at its own newest tag, against `main`:

| Package                 | Newest tag | Pages at the tag | Pages on `main` |
| ----------------------- | ---------- | ---------------- | --------------- |
| `luhn`                  | 3.0.0      | 0                | 6               |
| `token`                 | 0.1.0      | 0                | 5               |
| `astro-widget`          | 0.2.0      | 0                | 4               |
| `nestjs-correlation-id` | 2.0.0      | 0                | 4               |
| `compose`               | 2.0.0      | 1                | 3               |
| `urn`                   | 2.0.0      | 4                | 5               |
| `react-widget`          | 0.2.0      | 6                | 6               |

`git ls-tree -r --name-only <tag> apps/docs/content/<slug>/`, run on
2026-09-13. Four of seven released packages have no documentation at all at the
version that is on npm. The eleven pages that do exist predate the rewrites that
produced the current ones.

For any tag older than those, the number is zero across the board: the docs app's
first commit is newer than every release except the ones above.

So the archive on day one is not "every version". It is empty, and the earliest
version that can have a snapshot is the next release of each package — a release
that has not happened. Building the machinery in decision 4 now produces a
switcher with one entry, pointing at the page the reader is already on.

The reader this was meant to serve does have something today, and it is better
than a snapshot would be. `content/luhn/migration.mdx` opens with "Every check
character changes", states the 62-to-36 dictionary change, and gives a table
mapping every 2.x call to its 3.x form. A frozen 2.x section would tell that
reader what 2.x did; the migration page tells them what to do, which is the
question they actually have. This is the strongest argument in the document for
decision 11, and it generalises: a breaking change that deserves an archive
deserves a migration page first, and the migration page is cheaper and is read by
more people.

## 3. Switching to a version that does not have the page

The mapping is page for page within the section: `/luhn/dictionaries` →
`/luhn/v3/dictionaries`. Section 2 guarantees this misses often — the archive of
a two-page section next to a six-page current section is the normal case here,
not the edge case.

A static export has no server, so there is nothing to redirect at request time
and every answer has to be decided at build time. The manifest in section 1
carries each version's page list, so the switcher knows before it renders:

- The target has the page. Plain link.
- The target does not have it. The entry links to the target's section index and
  is marked as doing so, and the index it lands on carries a line naming the page
  the reader came from and the version it exists in.
- No archive of that package exists. There is no switcher on the page at all,
  which is the state of every page today.

What is not acceptable is a link that 404s, and what is not acceptable is a
silent landing on the section index with no explanation — the reader concludes
the page moved rather than that it never existed.

## 4. The executed-examples conflict

The site's claim is that every stated value was produced by running the package.
`libs/luhn`, `libs/urn` and `libs/token` wire `docExamples()` into Vitest so their
README fences run as tests; `next.config.ts` registers
`@evanion/doc-examples/mdx-region-loader` as a Turbopack rule on `*.mdx`, so a
block written as

````mdx
```ts file=libs/luhn/README.md region=generate

```
````

is filled from the workspace README at build time, and a renamed region fails
the build. `2026-09-13-interactive-examples.md` extends this to probes that call
the real export in the browser.

A frozen 2.x page cannot honour that claim. `luhn@2` and `luhn@3` emit different
check characters for the same input — the 3.0.0 redesign took the default
dictionary from 62 characters to 36, so every index changed — and the 2.x values
were produced by a package that is no longer installed.

Worse, the default behaviour is the unacceptable one. Copy an archived MDX file
into `content/luhn/v2/` and leave it alone, and the region loader fills its
`file=libs/luhn/README.md` blocks from the current README, and a `<Probe>` on it
imports the workspace `@evanion/luhn` and computes 3.x values. The page would
display 3.x output under a 2.x heading, sourced live, with no notice. That is the
third option the brief rules out, and it is what happens if nobody decides.

### Re-executing against the old version

The honest version of "archives keep executed examples" is: install the old
package alongside the current one, and run its README fences against it.

Concretely, for one package and one major:

- `npm install luhn-v2@npm:@evanion/luhn@2` in `apps/docs`, an alias per archived
  major, so the workspace resolves both.
- The 2.x README is not on disk. It is in the git tag and in the npm tarball, so
  the archived page's regions have to resolve against one of those rather than
  against `libs/luhn/README.md`.
- Executing them needs a Vitest project configured for 2.x. `docExamples()` is
  wired into `libs/luhn/vite.config.ts`, which is the 3.x package's config; the
  2.x equivalent exists only inside the tarball, and its own devDependencies are
  not installed.
- The probes in `2026-09-13-interactive-examples.md` import
  `@evanion/luhn`. An archived probe has to import `luhn-v2`, so the probe module
  becomes parameterised by version and the identity assertion that makes a probe
  the tested example (`probe.call === Luhn.generate`) has to be restated per
  alias.

That is a second test harness keyed by package and major, N × M of them,
re-resolved on every docs build, holding alias entries in `apps/docs/package.json`
for versions of packages this repository has deprecated. It buys a guarantee for
pages nobody is reading, about versions nobody is running.

### The decision

Archives keep frozen values with a notice, and every live element is removed at
snapshot time. Not left in place — removed, because left in place is the silent
failure above.

The prebuild does three things to each archived MDX file, in the same pass that
copies it:

1. Resolves every `file=… region=…` block against the README **at that tag**, and
   writes the code inline as a plain fenced block. The archived file then has no
   live reference, so the region loader has nothing to fill and a later rename in
   the current README cannot reach it.
2. Removes `<Probe>`, `<PlaygroundExamples>` and `<WidgetPlayground>` elements,
   replacing each with a line linking to the same page in the current version,
   where the interactive element is live against the installed package.
3. Prepends an archive notice naming the version, the tag, and the date the
   snapshot was taken, and stating that the values on the page were produced by
   CI at that tag and are not re-executed.

What this costs, stated plainly: an archived page's guarantee drops from "this
value was produced by running this package" to "this value was produced by
running this package at tag X, and has not been re-checked since". The second
sentence is weaker and it is also true, which is the whole requirement. It is
also what every versioned docs site in the prior-art list offers, including
`docs.rs`, which rebuilds from the published crate and still cannot tell you
whether the prose around the rustdoc is right.

The current version keeps the strong guarantee unchanged, because nothing in this
document touches how `content/<slug>/` is built.

## 5. Where snapshots come from

From git tags, read by the docs build. Not from the release pipeline and not by
hand.

`.github/workflows/docs.yml` gains a step before `nx build docs`:

```yaml
# The archive is read out of the release tags, so this needs the full history
# and the tags. The default checkout has neither.
- uses: actions/checkout@…
  with:
    fetch-depth: 0

- name: Snapshot archived versions
  run: node scripts/snapshot-docs.mjs
```

For each package and each retained major, the script resolves the newest tag
matching `{name}@{major}.*` — the same `releaseTag.pattern` as
`nx.json`, `{projectName}@{version}` — adds a detached worktree at it, copies
`apps/docs/content/<slug>/`, applies the three rewrites in section 4, and writes
`app/archived-versions.generated.ts`. A tag whose content directory is empty
produces no archive and no manifest entry, which is what every tag does today.

Three reasons this is not in `release.yml`:

- The release workflow's one job is versioning, tagging and publishing, and it
  pushes to `main` through a deploy key because the main ruleset requires a
  reviewed pull request. Adding committed snapshot content to that push widens
  what the bypass carries.
- A snapshot committed by the release run would have to be produced before
  `nx release` computes the version, so it would not know its own version number.
- The dry-run question answers itself. `release.yml` gets no docs step, so
  `dry-run: true` has exactly the docs effect it has today, which is none.
  Reading from tags means the archive is a pure function of the tags that exist,
  so a dry run — which creates no tag — cannot change it.

The trade is that the docs build now depends on git history. A build outside a
git checkout produces the current view with no archives and no failure, which is
correct for a preview build and is the state the committed empty manifest
encodes.

## 6. The default view, and how a reader knows what they are reading

The default view stays `main`. Changing it to "the newest release" is not
available: the packages are tagged independently, so "the site at the newest
release" is eight different commits and there is no tree that is all of them at
once.

That is the honest technical reason, and it leaves a real problem that exists
today. The site documents `main`, `main` is 103 commits past the luhn tag and 136
past the others, and no page says which released version it corresponds to. The
reader who installs `@evanion/luhn@3.0.0` and reads `/luhn/api` has no way to
know whether what they are reading shipped.

So decision 2 is the half that is worth building now, and it is one derived fact:

```ts
export interface ReleaseState {
  slug: string;
  /** The version on npm: the newest tag matching `{name}@*`. */
  published: string | null;
  /** Whether commits touching the package root have landed since that tag. */
  ahead: boolean;
}
```

`ahead` is `git rev-list --count <tag>..HEAD -- <root>` being non-zero. The
version in `package.json` cannot answer this on its own — `nx release` bumps it
at release time, so it equals the tag until the next release and never says
"ahead".

The notice renders at the top of every page in the section, as a sibling of
`WorkshopNotice` and for its stated reason: "The sidebar's Workshop separator is
invisible to a reader who arrived from a search result, so the page says it too."
That reasoning was written for an agent or a human landing on one page with no
chrome context, and it is the same reader here.

- `ahead` false: one line naming the published version. `@evanion/luhn 3.0.0`.
- `ahead` true: the version, plus that these pages describe unreleased changes,
  plus a link to the archived section when one exists.
- No tag at all — `@evanion/feature` today: `WorkshopNotice` already covers it and
  says more.

That is roughly forty lines and a generated manifest, and it is the only part of
this document that fixes something wrong with the site as deployed.

## 7. Search

`apps/docs/package.json` runs `pagefind --site out --output-path out/_pagefind`
as `postbuild`, and `docs.yml` invokes it explicitly because nx calls
`next build` rather than `npm run build`. Pagefind indexes the exported HTML, so
an archived copy of a page is a second document with nearly identical text, and
a search for "check character" returns one result per retained major.

Archived pages stay in the index and are filtered out of the default query.
Two verified facts make that the cheap option rather than the elaborate one:

- Pagefind reads `data-pagefind-filter="version"` off the page at index time.
  The archive wrapper that already carries decision 4's notice carries the
  attribute, and the current pages carry `version:current` the same way.
- Nextra does not use Pagefind's own UI. `nextra/dist/client/components/search.js`
  imports `/_pagefind/pagefind.js` directly and calls
  `window.pagefind.debouncedSearch(value, searchOptions)`, and `<Search>` takes
  `searchOptions?: PagefindSearchOptions`, which is `{ preload, verbose, filters,
sort }` passed straight through. So
  `<Search searchOptions={{ filters: { version: 'current' } }} />` in the layout
  scopes every query to the current version, with no custom search component and
  no second index.

The reader searching from an archived page therefore gets current-version
results. That is the right default for a site whose archives are frozen: search
is how people arrive, and arriving on a stale page is worse than arriving on a
current one they can switch away from. The switcher in section 3 is the way back.

`data-pagefind-ignore` would also work and is one line shorter. The filter is
preferred because it is reversible: exposing the archives later is changing a
default in one prop, where un-ignoring them is a reindex and a decision about
ranking. Pagefind also supports `mergeIndex` for a per-version index, which
Nextra does not expose — it hardcodes the single `/_pagefind/pagefind.js` path —
so that route needs a replacement search component and is not worth it for a
problem one prop solves.

## 8. Maintenance

Forty MDX files under `content/` today, plus the landing page. Retaining one
prior major for every package roughly doubles that, and the second copy is
content nobody edits and nobody reads.

The policy:

- No backports. An archived page is what the tag shipped. A correction to a
  current page is not carried back, because the archived page is not a statement
  about what is true — it is a statement about what that release documented.
- The one exception is a statement that could cause harm: a wrong security claim,
  a wrong cryptographic guarantee. That is corrected in place and the correction
  is dated on the page, which means the snapshot script has to tolerate an
  archived file that has been hand-edited. It does that by writing only to
  directories that do not exist, so a hand-edited archive survives the next
  build; the repo-check asserts the manifest and the directories agree.
- Retention is the current major plus one. `luhn` at 4.x would keep `v3` and drop
  `v2`. Dropping is deleting a directory and the tag stays, so it is reversible.
- Below 1.0.0 there are no majors to retain. `token` at 0.1.0 and the widget
  packages at 0.2.0 get no archives until they reach 1.0.0, which matches
  `adjustSemverBumpsForZeroMajorVersion` in `nx.json`: a 0.x package is saying
  its API is not stable, and archiving each minor of an unstable API is archiving
  noise.

## 9. Whether to build it now

Split, and the split is not close.

**Build now**: decisions 2 and 3. The site currently presents `main` as though it
were the released version, across eight packages that are between 99 and 136
commits past their tags. That is a wrong statement on forty pages, it costs a
generated manifest and a component, and it needs none of the rest of this
document.

**Defer**: decisions 4 through 10. The measurement in section 2 is the argument.
Four of seven released packages have zero pages at the tag that is on npm, and
the other three have pages that predate the current rewrites. The switcher would
ship with one entry. The first snapshot with anything in it comes from the next
release of each package, so the earliest this machinery does any work is one
release away, and at that point the thing to snapshot is content that has not
been written yet.

Against that, the reader on an old version is served today by a migration page
that answers a better question, and the download counts are mirror traffic on
packages that are days old in this repository.

The trigger to build the deferred half, stated so it is checkable rather than a
feeling: a breaking release lands on a package whose current section has pages,
and either a reader asks for the previous version's docs or the migration page
cannot carry the difference. The first condition will be met by the next major of
`luhn`, `urn` or `react-widget`. The second is the one to actually wait for.

## Sequencing

1. `scripts/release-state.mjs` and the generated release manifest, with
   `docs.yml` fetching tags.
2. `ReleaseNotice`, on every package page, beside `WorkshopNotice`.
3. Repo-checks: the manifest names only known slugs, and every documented package
   has an entry.

Then, when section 9's trigger fires:

4. `scripts/snapshot-docs.mjs`: worktree per tag, copy, region inlining.
5. Live-element stripping and the archive notice.
6. The switcher and the page-for-page mapping.
7. The Pagefind version filter and the layout's default, the reserved-segment
   check, retention.

Steps 1 to 3 are independent of everything after them and are worth doing whether
or not the rest is ever built.

## Testing

- A package with commits since its tag renders the unreleased notice; one with
  none renders the published version alone. Both asserted against a fixture
  repository rather than against this one's live history, which changes daily.
- A package with no tag renders no release notice, and `@evanion/feature` still
  renders `WorkshopNotice`.
- The release manifest names exactly the packages in `app/navigation.ts`, which
  is the third assertion in `docs-navigation.test.ts`'s existing shape.
- Building with no `.git` present produces the site with no release notices and
  exits zero.
- An archived page contains no `file=… region=…` attribute, asserted over the
  emitted MDX, so the region loader cannot reach it.
- An archived page's inlined code equals the region read from the README at that
  tag, not from `libs/<name>/README.md` on disk. The distinguishing fixture is
  luhn: the 2.x region and the 3.x region differ in the check character, so a
  test that would pass under either resolution is not a test.
- An archived page contains no `<Probe>`, `<PlaygroundExamples>` or
  `<WidgetPlayground>` element, and each removal left a link to the current page.
- Switching from a page that exists in the target lands on it; switching from one
  that does not lands on the target's section index with the origin page named.
  No switcher entry resolves to a path absent from `generateStaticParams`.
- Every exported page carries exactly one `data-pagefind-filter` value for
  `version`, and a Pagefind query under the layout's default filter for a string
  appearing in both an archived and a current page returns one result.
- No file or directory directly under `content/<slug>/` matches `/^v\d+$/`.
- A hand-edited archived file survives a rebuild unmodified.
- `release.yml` has no docs step, asserted by the workflow check that already
  reads it, so a dry run cannot produce a snapshot.

## Where I am guessing

- That a detached `git worktree` per tag inside the Pages build is cheap enough
  to ignore. Thirteen tags exist and retention caps it near eight, but I have not
  timed a worktree add against a repository fetched with `fetch-depth: 0`, and
  `docs.yml` currently fetches with the default depth of 1.
- That one default filter serves the whole site. `<Search>` is mounted in the
  root layout, which in the App Router does not receive route params, so the
  default cannot vary per section without moving search into a client component
  that reads the pathname. Setting it to `current` sidesteps that; if a reader on
  an archived page should search their own version by default, this needs
  rethinking and is more than a prop.
- That `data-pagefind-filter` on the archive wrapper tags the whole page rather
  than the subtree under it. Pagefind documents filters as page-level and honours
  them outside `data-pagefind-body`, so it should; I have not run it against this
  export.
- That the prebuild can write into `content/` without confusing Nextra's page
  map. `generateStaticParamsFor('mdxPath')` enumerates what is on disk when the
  build starts, so writing before `next build` should be indistinguishable from
  committing the files. I have not tried it, and if it is wrong, the fallback is
  a second route segment outside `content/`, which costs the theme frame.
- The eleven pages that do exist at a release tag: I counted them with
  `git ls-tree` and did not read them. They may be close enough to the current
  pages that even those archives would be near-duplicates, which would make
  section 2's case stronger than stated.
- That no reader has asked for an old version. I am inferring it from the packages
  being days old in this repository and from the download counts being mirror
  traffic. If someone has asked, that is the trigger in section 9 and it fires
  now.
