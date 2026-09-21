# A test statistics section on the docs site

Status: proposed. Research and design. The owner asked for a section showing
this project's test statistics, explaining the major classes of case it tests
against, with an interactive interface reading the coverage reports. Two of
those three arrive intact. The third, the coverage report as the thing a reader
looks at, is answered differently in § 7, and § 6 declines the OWASP framing the
question offered as an example.
Packages: `apps/docs` gains a section and a build step. `tools/repo-checks`
gains three checks. `libs/acl` gains a `coverage` block nowhere and loses one
duplicated table; `libs/astro-widget/vite.config.ts` gains the `coverage` block
it is missing (§ 8.4). No published library changes its runtime or its types.
Depends on: `apps/docs/next.config.ts:53` (`output: 'export'`, which decides
§ 4 entirely), `apps/docs/next.config.ts:19-50` (the three MDX loaders a new
page passes through), `.github/workflows/docs.yml:54-67` (the deploy job, which
today installs and builds and runs no test), `.github/workflows/ci.yml:105`
(`nx run-many -t lint test build typecheck check`, which runs no coverage),
`libs/acl/SECURITY.md` (the register, 36 entries in three tiers),
`libs/acl/src/security/tier1-prevented.test.ts`,
`tier2-primitives.test.ts` and `tier3-contract.test.ts` (the tests those
entries name), `libs/acl/src/security/fixtures.ts:136-151` (the README clause
reader tier 3 asserts against), `libs/acl/src/security/generator.ts` (the
seeded generator behind SEC-019), `apps/docs/content/acl/register.mdx` (a
hand-typed copy of the register, checked by nothing),
`apps/docs/content/acl/security.mdx:1-80` (the contract, which already carries
the owner's position in the words § 6.1 quotes), `libs/acl/vite.config.ts:25-28`
(the per-package coverage configuration every library but one repeats),
`apps/docs/app/navigation.ts` and `apps/docs/content/_meta.ts:49-52` (where a
section has to be wired), `tools/repo-checks/src/docs-navigation.test.ts:154-163`
and `:502-517` (the assertion a new content directory has to satisfy),
`tools/repo-checks/src/doc-fence.test.ts:205`,
`tools/repo-checks/src/doc-domain.test.ts:169` and
`tools/repo-checks/src/doc-twoslash.test.ts` (three of the checks a new page
meets), `apps/docs/components/probes/islands.tsx:25-30` (the prerendered island
pattern § 8 reuses), `.gitignore:30-34` (which does not catch one package's
coverage output), `docs/specs/2026-09-16-documentation-standard.md` and
`docs/specs/2026-09-20-documentation-prose-craft.md` (the rules the page's prose
sits under).
Measured against: this worktree at `d474dc8`, Node v24.16.0, TypeScript 6.0.3,
macOS 26.6.2, Apple M1 Pro. Every count, percentage and duration below was
derived by running something against that tree in this session. The evidence sections at the end list what I ran and what I could not
run here.
Prior art: five security-sensitive libraries and two OWASP documents, fetched
from their own sources on 2026-09-21 and listed in § 12 with the page beside
each claim. Two of the five publish a coverage percentage and three do not, and
the one whose security document is closest in shape to this repository's
register publishes 95%. OWASP's own two documents settle § 6: the Top 10 is
built from prevalence counts over tested applications and never proposes that a
library map its tests onto it, and ASVS, which does propose exactly that
mapping, defines the thing being verified as an application. Sources the
research could not reach are named at the end of § 12, along with one limit on
how the research was done.

## What is actually being asked

The owner asked for three things in one section: the statistics, an explanation
of the classes of case, and an interface over the coverage reports. The first
two are supported by material already in the tree and invisible to a reader. The
third has a hard constraint on it and an honesty problem inside it.

The material is real. Running every project's vitest config against `d474dc8`
collected 2,443 test cases over 168 test files in 18 of the 19 configs in the
repository. `libs/acl` alone holds 1,095 of those over 28 files, and 107 of them
sit in `libs/acl/src/security`, one group per `SEC-` identifier, under a name
that states what must hold. `libs/acl/SECURITY.md` carries 36 register entries
across three tiers, and the tier decides what the test under it may claim. None
of that reaches `docs.evanion.com` except through one page,
`apps/docs/content/acl/register.mdx`, which restates the register by hand and
which no check holds against the file it restates.

The constraint is `apps/docs/next.config.ts:53`. The site is `output: 'export'`,
a directory of static files served by GitHub Pages, with no server to ask
anything at request time. A page that reads a coverage report reads it while
the site is being built, and § 4 works out the three places the bytes could come
from.

The honesty problem is two problems. A coverage percentage counts lines the test
run executed, and a reader takes it as a count of cases covered; § 7 measures
how far apart those are in this repository. An OWASP category with a passing
test beside it reads as a category handled, and the register's own tier 3 exists
to say the opposite about classes it names; § 6 works that through and concludes
that the register is already the right unit and OWASP is the wrong frame.

## Decisions

Sixteen, and four of them are refusals. Decisions 1 through 6 settle where the
numbers come from. Decisions 7 through 9 settle what the security part of the
page claims. Decisions 10 through 12 settle the coverage percentage. The rest
are the wiring and one defect found while measuring.

1. **The section is one top-level `/testing` section, and every number on it is
   derived at build time from a run.** Nothing on the page is typed by a person
   and nothing is copied from another file. The page is prerendered into the
   static export, so the reader downloads a page, not a fetch. § 9.
2. **The numbers come from a fresh test run during the docs build.** The
   `docs.yml` build job gains a coverage run ahead of `nx build docs`, and the
   build reads the reports that run wrote. The sweep over every project cost
   44.7 s of wall clock here, sequential and warm, and the coverage sweep over
   the eleven libraries cost 19.3 s. § 4.1 and § 4.4.
3. **No coverage summary is committed to the repository.** A committed file is
   reviewable in a diff, which is the argument for it, and it is right only
   until somebody lands a change without regenerating it. The failure is silent
   and the page keeps rendering. § 4.2.
4. **No artifact is fetched from a CI run.** `ci.yml` and `docs.yml` are
   separate workflows on separate triggers, and `docs.yml` also runs on
   `workflow_dispatch`, where no matching CI run need exist. The failure mode is
   a docs build that finds an artifact belonging to a different commit and
   publishes its numbers under this one. § 4.3.
5. **A missing or unreadable report fails the docs build.** It never renders as
   an empty state, a dash, or a number from an earlier run. Measured in § 4.4: a
   failing test run writes no coverage summary at all, so the absent file is
   already the signal, and the build has to treat it as one.
6. **Every number on the page carries the commit it was measured at, and the
   page says what the run covered and what it did not.** A reader who wants to
   know whether the figure is current compares one short SHA against the
   repository. § 5.
7. **The register is the unit, and the page is organised by tier.** Tier 1, tier
   2 and tier 3 each say a different thing about what a passing test proves, and
   no category scheme this project could adopt carries that distinction. § 6.2.
8. **The OWASP column stays a cross-reference and never becomes a coverage
   claim.** Eight of the 36 register entries carry an OWASP identifier and 28
   carry only a CWE. Of the four entries under A01:2021, two are tier 3, where
   the entry exists to say no defence is offered. A page that grouped by OWASP
   category would render A01:2021 as half-defended and a checkmark cannot say
   that. § 6.3.
9. **ASVS is the frame OWASP offers a library, and this project does not adopt
   it in this change.** ASVS asks a verifier to state scope and exclusions,
   which the register already does better per class, and ASVS defines the
   verified artifact as an application. Adopting it means claiming requirement
   identifiers this package satisfies on an application's behalf, which is a
   separate document and a larger claim. § 6.4.
10. **No coverage percentage appears as a headline, a badge, or a number beside
    a package name in the sidebar or on the landing page.** § 7.1.
11. **Where a coverage figure appears, statement and branch percentages appear
    together and the uncovered lines are named.** Measured on `libs/acl`: 98.16%
    of statements and 94.42% of branches, which is 21 statements and 46 branches
    not executed, in files the report names. § 7.2.
12. **Coverage is never summed into one workspace number.** Measured across the
    libraries: three sit at 100% on all four metrics and `libs/acl`, the package
    with the most tests in the repository by a factor of five, sits lowest of
    the four largest. A workspace average would move when a 42-statement package
    changes. § 7.3.
13. **`apps/docs/content/acl/register.mdx` stops being typed and starts being
    generated from `libs/acl/SECURITY.md` and the run.** The two files agree
    today, entry for entry and identifier for identifier, and nothing in the
    repository would report it if they stopped. § 3.
14. **A repo check holds the register against the tests.** Every `SEC-` in the
    register has a group in the tier file it names, every group in a tier file
    has an entry, and the stated counts equal the counted ones. § 10.1.
15. **The section's data module is built by a script under `apps/docs/tools/`
    and is not checked in.** The raw vitest JSON for all 18 collected projects
    is 784 KB, of which `libs/acl` alone is 313 KB, so the build reduces it
    before any of it reaches a page. § 8.2.
16. **`libs/astro-widget/vite.config.ts` gains the `coverage` block the other
    ten libraries carry.** It has none, so a coverage run writes to
    `libs/astro-widget/coverage/`, which `.gitignore:30-34` does not catch. Found
    by running it, and `git status` reported the directory as untracked. § 8.4.

## 1. What this repository already tests, measured

Run against `d474dc8`, one `vitest run --reporter=json` per project config,
after `nx run-many -t build --skip-nx-cache`:

| Project                          | Test cases | Test files |
| -------------------------------- | ---------: | ---------: |
| `@evanion/acl`                   |      1,095 |         28 |
| `@evanion/repo-checks`           |        224 |         32 |
| `@evanion/baize-ui`              |        183 |          7 |
| `@evanion/urn`                   |        139 |          5 |
| `storefront`                     |        114 |         10 |
| `@evanion/react-widget`          |        108 |         16 |
| `@evanion/feature`               |         90 |          7 |
| `shop-api`                       |         84 |         18 |
| `@evanion/luhn`                  |         75 |          5 |
| `@evanion/token`                 |         74 |          5 |
| `@evanion/docs`                  |         62 |         14 |
| `@evanion/widget`                |         48 |          5 |
| `@evanion/nestjs-correlation-id` |         46 |          5 |
| `@evanion/react-acl`             |         35 |          3 |
| `@evanion/compose`               |         30 |          3 |
| `@evanion/astro-widget`          |         19 |          2 |
| `storefront-rsc`                 |         14 |          2 |
| `@evanion/nx-astro`              |          3 |          1 |
| **Total**                        |  **2,443** |    **168** |

`apps/admin` is the nineteenth config and collected nothing here. Its
`vite.config.mts:3` imports `@react-router/dev/vite`, and that package is absent
from the installed `node_modules`, so the config fails to load and the Nx
project graph fails with it. That is a stale install in this checkout rather
than a defect in the repository, and "Measured" at the end records it as a gap
in the measurement. The page's data step has to treat a project that collects nothing
as an error for the same reason decision 5 gives.

The brief this document answers put the count of repo checks at "30+". Measured:
`tools/repo-checks/src` holds 32 `.test.ts` files carrying 224 cases, run as two
vitest projects, one of which loads Astro's vite plugin to compile `.astro`
components (`tools/repo-checks/vitest.config.ts:37-52`).

## 2. The kinds of test, and how the page derives the list

The brief listed nine kinds. Reading the tree finds eleven distinguishable ones,
and the difference matters because the page's list has to be derived from the
configuration and not typed under it.

1. **Behaviour tests.** `src/**/*.{test,spec}.ts` in every project config, the
   bulk of the 2,443.
2. **Type tests.** `*.test-d.ts` under `typecheck.include`, enabled per package.
   Four files: `libs/acl/src/authoring.test-d.ts`, `libs/acl/src/types.test-d.ts`,
   `libs/urn/src/lib/urn.test-d.ts`, `libs/widget/src/define-widgets.test-d.ts`.
   `libs/astro-widget/vite.config.ts:37-48` explains why they are a separate
   file kind: an `expectTypeOf` assertion inside a `.test.ts` is never
   type-checked and passes whatever it says.
3. **Doctests.** README regions and `@example` blocks executed as tests through
   `vite-plugin-doctest` and `includeSource`
   (`tools/doc-examples/src/vite-config.ts:25-28`, `:54-55`). `libs/acl/README.md`
   carries 72 lines matching a region marker.
4. **Expectation comments.** A `// -> value` line in a documented example is
   rewritten into an assertion before doctest extracts the block around it
   (`tools/doc-examples/src/vite-config.ts:25-26`), and
   `tools/repo-checks/src/expect-comments.test.ts` holds the rewriter to firing
   on value claims and on nothing else.
5. **Twoslash compile checks.** Every `twoslash` fence in the docs content and in
   the package READMEs is compiled under Twoslash's strict defaults against each
   package's built `dist/`, and every `@errors:` code a fence declares has to
   still be produced (`tools/repo-checks/src/doc-twoslash.test.ts:13-35`). The
   content holds 126 twoslash fences and 150 `region=` references across 81 MDX
   pages.
6. **Repository checks.** 32 files, 224 cases, described in § 1.
7. **Astro container tests.** `.astro` components rendered in a second vitest
   project that loads Astro's own vite plugin, in
   `tools/repo-checks/vitest.astro.config.ts` and in
   `libs/astro-widget/vite.config.ts:56-71`.
8. **End-to-end tests.** Two files: `apps/shop-api/src/orders/orders.e2e.spec.ts`
   and `libs/nestjs-correlation-id/src/correlation.e2e.spec.ts`.
9. **Build-output assertions.** `apps/storefront/src/build.test.ts` reads what
   `astro build` emitted, which is why `nx.json:119-127` orders a project's own
   build ahead of its tests.
10. **Packaging verification.** `scripts/verify-packaging.mjs` packs every
    publishable library, installs the tarballs into a throwaway project outside
    the workspace, and checks a consumer can import them. It is its own CI job
    (`.github/workflows/ci.yml:125-139`) and belongs to no Nx project, so it is
    the one kind on this list that `nx run-many -t test` does not reach.
11. **The adversarial suite.** `libs/acl/src/security`, 107 cases over three tier
    files, one group per register entry, including seeded property tests drawing
    from `libs/acl/src/security/generator.ts`. § 3 is about this one.

The page derives 1, 2, 3, 7 and 11 by reading each project's resolved vitest
configuration, which is what the data step already loads to run the tests. It
derives 5, 6 and 9 from the test file paths in the run. It derives 4 and 10 from
a short list in the data script naming the two things that live outside a vitest
config, with a comment saying why each is there. A kind added to a config
appears on the page with no edit; a kind added outside one does not, and § 10.3
is the check that reports it.

## 3. The register, and the copy of it already on the site

`libs/acl/SECURITY.md` is the strongest material this repository has for the
section the owner asked for, and it is already the right shape.

It holds 36 entries. Each carries an identifier, a class of attack, a CWE and
sometimes an OWASP entry, the mechanism, and the test that proves it. Each sits
in exactly one of three tiers, and the table at `libs/acl/SECURITY.md:15-19`
states what the tier licenses the test to claim. Its three rows say that a tier
1 test asserts a construction error or a decision that does not grant, that a
tier 2 test asserts the primitive is correct and that the idiom it replaces is
visibly wrong against the same decision, and that a tier 3 test asserts
"Nothing. The contract clause exists, and where the behaviour reads like a
defence, what the engine actually does."

And `:21-22`: "Tier 3 entries carry no passing defence, because a passing test
there would imply one. Where an entry names a gap with no defence at all, it
says so."

Measured against the tests: 20 distinct `SEC-0xx` identifiers in
`tier1-prevented.test.ts`, 8 `SEC-1xx` in `tier2-primitives.test.ts`, 8
`SEC-2xx` in `tier3-contract.test.ts`, which is the 20, 8 and 8 that
`libs/acl/SECURITY.md:24` states. The three files are 1,169, 471 and 247 lines
and carry 107 cases in the run.

The tier 3 tests assert a README clause. None of them asserts a behaviour.
`libs/acl/src/security/fixtures.ts:136-151` reads the package README once and
hands it to the tier 3 file, whose docblock at `tier3-contract.test.ts:11-13`
says why: "the register in `libs/acl/SECURITY.md` names the clause, so moving
the contract is a change to the register too." A class with no defence is held
in place by the sentence that says it has none.

**The site already publishes this, typed a second time.**
`apps/docs/content/acl/register.mdx` carries all 36 identifiers, the same 23
distinct CWEs, and the same eight OWASP references in the same distribution, in
three tables with the Class column reworded to fit the page width. The two files
agree today, which I checked by extracting the identifier sets and the
CWE and OWASP sets from each and comparing them.

Nothing in the repository holds them together. `libs/acl/SECURITY.md:4-6` claims
"the adversarial suite in `src/security` is checked against this file: one entry
per class, one identifier, and the test that proves the entry", and no code does
that either. The only references to the register from the tests are two
docblocks, `tier1-prevented.test.ts:6` and `tier3-contract.test.ts:12`, which
describe the arrangement and check nothing. The counts on
`apps/docs/content/acl/register.mdx:5`, `:29`, `:56` and `:71` are English words
typed by hand: "thirty-six", "Twenty entries", "Eight entries", "Eight entries".

So the register is three copies of one fact, and the fact is maintained by
attention. Decision 13 makes the page a projection of the file, decision 14
makes the file a projection of the tests, and § 10.1 is the check.

## 4. The static export, and the three places the numbers could come from

`apps/docs/next.config.ts:53` is `output: 'export'`, and the comment above it
says why: the site is published to GitHub Pages, which serves static files only.
`images: { unoptimized: true }` at `:56` is there for the same reason. There is
no request-time anything. A number on the page was put there by the build.

Three sources are possible. Each is stated with its cost and with what a reader
sees when the number is wrong.

### 4.1 Generated during the docs build, from a fresh run

The `docs.yml` build job today is checkout, setup-node, `npm ci`
(`:54`), configure-pages, `nx build docs` (`:60`), `npm run postbuild` (`:67`),
an artefact check (`:74-81`), and upload. It runs no test at all. This option
adds a coverage run between the install and the build, and the build reads what
that run wrote.

**Cost.** Wall clock, measured here: the full sweep of 19 project configs took
44.7 s, sequential, with a warm Vite cache and after a full build. The coverage
sweep over the eleven libraries took 19.3 s. A cold CI runner is slower than
both, and `npm ci` already dominates this job. The coupling is the real cost:
the deploy now depends on the whole suite passing, so a deploy can fail for a
reason that has nothing to do with the documentation. `docs.yml:5-21` already
triggers on `libs/**` and `internal/**`, so the deploy already moves with the
libraries, and `tools/repo-checks/src/docs-trigger.test.ts` holds that path list
against what the docs project depends on.

**When the number is wrong.** It cannot be stale, because there is no earlier
number to keep. It can be absent, which is § 4.4.

### 4.2 Committed to the repository as data

A generated JSON file under `apps/docs/`, imported by the page.

**Cost.** The file is reviewable in a pull request diff, which is the real
argument for it, and it is the only option where a reviewer sees a coverage
change as part of the change that caused it. Against that: the file is right
until somebody lands a change without regenerating it, and nothing makes them.
A check that regenerates and compares turns this option into § 4.1 with an
extra file, because it has to run the tests to compare.

**When the number is wrong.** The page renders a percentage from whenever
somebody last remembered. Nothing on the page or in the build says so. This is
the failure the owner named, and it is why decision 3 refuses it.

### 4.3 Fetched from a CI artifact

`ci.yml` uploads a coverage artifact; `docs.yml` downloads it.

**Cost.** The two workflows are separate, triggered separately, and
`docs.yml:22` also allows `workflow_dispatch`. Downloading another workflow's
artifact needs that workflow's run id for this commit, which means an API call
and a decision about what to do when there is no such run. A re-run of the
deploy after a CI artifact expires finds nothing. `ci.yml` does not produce a
coverage artifact today, so this option also adds a coverage run, to the other
workflow, and then adds the fetch on top.

**When the number is wrong.** This is the worst of the three. The naive fetch
takes the latest artifact, which belongs to whichever commit ran CI last, and
publishes its numbers under this commit's documentation. The page looks current
and describes other code. Decision 4 refuses it.

### 4.4 What happens when the report is missing

Measured, and it decides decision 5. I ran a coverage sweep over the eleven
libraries. Four wrote no `coverage-summary.json`: `libs/compose`,
`libs/react-acl` and `libs/react-widget` because their runs failed, and
`libs/astro-widget` because it has no `coverage` block at all and wrote to a
different directory (§ 8.4). Vitest printed "Coverage enabled with v8" in all
four logs and produced no summary for the three that failed.

So a failing test run already deletes the page's input. The docs build has to
read that as an error and stop. A page that renders a dash where a percentage
should be, or that falls back to a checked-in value, converts a red build into a
quiet one. The artefact check at `docs.yml:74-81` is the pattern to follow: it
already fails the job when a file the site needs is missing from the export, and
it names the file.

## 5. Freshness, and how a reader tells

Decision 2 makes staleness impossible for the coverage numbers, and a reader has
no way to know that by looking. The page has to say it.

The section carries, once, near the top: the short commit the run was measured
at, the date of that commit, the Node version the run used, and one sentence
saying the numbers were produced by the build that produced the page. Those four
come from the environment the data step runs in, so none of them is typed.

That sentence is checkable. A reader compares the SHA against the repository's
history. If the deploy ever stops running the tests, the SHA stops moving with
the site, and the mismatch is visible from the page.

The page also states what the run did not cover, because the interesting
omissions are real. `scripts/verify-packaging.mjs` runs in a separate CI job and
belongs to no Nx project, so a coverage run does not reach it. A project whose
config fails to load collects nothing, which is what `apps/admin` did here. The
page names both categories and counts them. An absent project otherwise looks
on the page like a project with no tests.

## 6. What the OWASP section may claim

The owner's example was OWASP, and the brief asked whether it is the right
frame. It is not, and the register the repository already has is a better
instrument than the one OWASP would supply.

### 6.1 The position the page has to preserve

The owner's standing position is that browser-side authorization toggles
visibility, that enforcement belongs in a trusted environment, and that every
layer evaluates for itself. It is already published, as a panel heading at
`apps/docs/content/acl/security.mdx:5` and its body at `:7-11`:

> In a browser, `can` decides what the user sees.
>
> The control disappears; the data behind it stays, and so does the request the
> control would have sent. Enforcement happens in a trusted environment, and a
> page that hid the button does not excuse the handler the button posts to.

And at `:31`: "Every app in the chain evaluates for itself and trusts no
earlier layer."

That position is a claim about scope, and every honest security statement this
project makes depends on it. A category scheme that reports a category as
covered erases it, because the reader who sees "A01:2021 Broken Access Control:
covered" has been told the opposite of "this library is one layer and the layer
below it must decide again".

### 6.2 Why the register is the better unit

The register's entry is a class of attack, and its tier is a claim about what
the project does with that class. Three claims are available, and the third is
the one no category scheme can express: `libs/acl/SECURITY.md:21-22` puts the
whole argument in one sentence, that a passing test in tier 3 would imply a
defence that does not exist.

Count what that buys. Of the 36 entries, 8 are tier 3. SEC-201 is a forged
subject, SEC-202 is complete mediation, SEC-205 is client-side enforcement,
SEC-207 is a caller-supplied clock. Those four are the owner's position,
enumerated, with the README clause that states each one held in place by a test.
A page that presents them as categories with tests beside them tells a reader
that a forged subject is handled. The register tells them the library cannot
see where the subject came from and names where to fix it.

So the page groups by tier first. Tier 3 is not a footnote on the page; it is a
third of the register and it is the part a reader most needs.

### 6.3 What the OWASP column does, and what it must not do

The register already carries OWASP identifiers, alongside CWEs, and the
distribution is the argument against promoting them. Counted across
`libs/acl/SECURITY.md`:

- 23 distinct CWEs across the 36 entries.
- 8 OWASP references across 6 entries: A01:2021 on SEC-004, SEC-010, SEC-201 and
  SEC-202; API1:2023 on SEC-011 and SEC-103; API3:2023 on SEC-001 and SEC-101.
- 30 entries carry no OWASP identifier at all.

Group that by category and A01:2021 has four entries under it, of which SEC-201
and SEC-202 are tier 3. Half of the category's rows say the library does not
defend it. A category-level mark has one bit and the rows have three states, so
the mark has to round, and every rounding of that set is a lie in one direction
or the other.

The design that follows: the OWASP identifier is a cross-reference on a row, the
way the CWE is. A reader may filter by it. A filter that selects A01:2021 shows
four rows with their tiers, and shows a count per tier above them, so a
selection that returns only tier 3 rows reads as four classes named and not
defended. No count of categories appears anywhere, because a count of categories
is the claim § 6.1 forbids.

### 6.4 ASVS, which fits better and is still not this change

OWASP has a document built for stating verifiable requirements, and it is not
the Top 10. The Top 10's own 2025 introduction describes its method as counting
applications tested and applications found with at least one instance of a CWE,
which makes it a prevalence ranking over applications. Nothing in the Top 10
project proposes that a library map its test suite onto the categories.

ASVS does propose that mapping. Its "How to use the ASVS" chapter names "as a
guide for automated unit and integration tests" as an intended use, and its
assessment chapter requires a verification report to state scope, requirements
checked, and exceptions. A pass mark on its own does not satisfy it. That is the
same instrument as
the register's tiers, written by somebody else.

Two things stop it being this change. ASVS defines an application as "the
software product being developed, into which security controls must be
integrated", and carves out component-level use only for things like a WAF or a
proxy acting for that specific purpose. A library claiming ASVS requirements is
claiming them on an application's behalf, which needs a statement of what the
application must do for the claim to hold. That statement exists here in prose,
across `apps/docs/content/acl/security.mdx` and the tier 2 and tier 3 entries,
and mapping it to numbered requirements is a document of its own. Second, ASVS's
levels are proportions of a requirement set, roughly 20% at L1 and roughly 70%
cumulative at L2, so a partial mapping invites a level claim that a single
component cannot support.

The recommendation: say on the page, in one sentence, that the register's
classes are drawn from CWE and cross-referenced to OWASP where an entry applies,
and that the project makes no ASVS level claim. Revisit ASVS when a consumer
asks for it, and treat the answer as a separate specification that starts from
what the consuming application has to do.

## 7. Whether a coverage percentage belongs on a docs site

The brief asked this directly. The answer is that it belongs in the section, in
one place, with enough beside it that it cannot be read as a quality score, and
nowhere else.

### 7.1 What the number measures and what a reader takes from it

A v8 line-coverage percentage counts statements the run executed. It counts
nothing about assertions. A suite that imports every module and asserts nothing
reaches a high number. The reader takes it as "this library is well tested",
which is a claim about assertions.

Two of the five libraries in § 12 publish a coverage percentage: OpenFGA at 80%
and rustls at 95%. `libs/acl` measures 98.16% of statements here. Putting that
number where a reader compares it against those two is the specific dishonesty
this section has to avoid, because `libs/acl` is a few thousand lines of pure
functions over frozen JSON with no network, no cryptography, no unsafe code and
no parser for a wire format, and rustls is a TLS implementation. The number is
higher because the code is smaller and simpler, and a reader has no way to see
that from the number.

So: no badge, no sidebar figure, no landing-page number, no per-package
percentage on the package's own pages. One place, inside the section, framed.

### 7.2 What appears beside it

Measured on `libs/acl` at `d474dc8`, with type checking disabled so the run
completes:

| Metric     | Percentage |     Counted |
| ---------- | ---------: | ----------: |
| Statements |     98.16% | 1,126/1,147 |
| Branches   |     94.42% |     779/825 |
| Functions  |     97.91% |     235/240 |
| Lines      |     98.63% | 1,014/1,028 |

Branch coverage is nearly four points below statement coverage, and the gap is
the honest part of the report. 46 branches in this package were not taken by
2,443 tests. The v8 report names where: `errors.ts` at 50% of branches,
`diff-matrix.ts` at 76.66% with lines 314, 456 and 486 uncovered,
`canonical.ts` at 83.33% with lines 19 and 23. Those are facts a reader can act
on, and a maintainer can too.

So the page shows all four metrics with their counted numerators and
denominators, and the uncovered line list per file behind an expander. A number
with its own shortfall listed underneath is a measurement. A number on its own
is a badge.

The coverage report also omits files nothing imported, which the page has to
state, because "98.16% of what the run loaded" is a different sentence from
"98.16% of the package". The `libs/acl` report covers 25 files, and the package
has 18 non-test modules directly under `src/` plus the `src/testing` and
`src/security` entries.

### 7.3 Why there is no workspace number

Measured across the libraries, one coverage run each:

| Package                          | Statements | Branches | Functions |  Lines |
| -------------------------------- | ---------: | -------: | --------: | -----: |
| `@evanion/luhn`                  |       100% |     100% |      100% |   100% |
| `@evanion/token`                 |       100% |     100% |      100% |   100% |
| `@evanion/nestjs-correlation-id` |       100% |     100% |      100% |   100% |
| `@evanion/urn`                   |     98.88% |   97.45% |      100% | 99.38% |
| `@evanion/acl`                   |     98.16% |   94.42% |    97.91% | 98.63% |
| `@evanion/feature`               |     96.64% |   89.94% |      100% | 99.61% |
| `@evanion/widget`                |     96.29% |   90.19% |    84.61% | 96.07% |

`@evanion/astro-widget` measures 100% of statements and 80% of branches over 5
files, and § 8.4 is why its report lands somewhere else.
`@evanion/compose`, `@evanion/react-acl` and `@evanion/react-widget` produced no
summary in this checkout, for the reason § 4.4 gives.

The three packages at 100% have 86, 95 and 42 statements between the three
metrics that count them. `@evanion/acl` has 1,147 statements and 1,095 tests.
Averaging those into one figure produces a number that moves when a
42-statement package changes and barely moves when the package holding 45% of
the repository's tests does. Per package, or not at all.

## 8. The interactive part

### 8.1 What the reader does with it

Three things, and all three are filtering over data that is already in the page.

The register, filtered. By tier, by CWE, by OWASP identifier, and by free text
over the class and the mechanism. A row expands to show the test names that ran
under that identifier in this build's run, and the file and line they live in.
The count above the table always breaks down by tier, so no filtered view
reports a total without saying how much of it is tier 3.

The test inventory, per project. The 18-row table in § 1, sortable, with each
row expanding into its test files and their case counts, and a tag per kind from
§ 2 so a reader can see that `@evanion/acl`'s 1,095 includes 107 adversarial
cases and two type-test files.

The coverage, per package. The table in § 7.3, with the per-file breakdown and
the uncovered lines behind an expander.

### 8.2 How the data reaches the page

The existing pattern is at `apps/docs/components/probes/islands.tsx:25-30`: a
client component doing the dispatch, one lazily loaded chunk per package, and
the comment at `:22-23` states the rule the section follows, that the static
export has to carry the value before anything is fetched. The section's tables
are prerendered into the HTML with every row present, and the island sorts and
filters what is already there. A reader with no JavaScript reads the tables. A
crawler indexes them, which matters because `docs.yml:67` runs Pagefind over the
exported HTML and `apps/docs/tools/md-siblings.mjs` writes a `.md` sibling of
every page for agents.

The data itself is too large to ship raw. The vitest JSON for the 18 collected
projects is 784 KB, `libs/acl` alone being 313 KB, because each report carries
every assertion's full name, ancestor titles, duration and status. The eight
`coverage-summary.json` files total 23 KB, `libs/acl` being 9,085 bytes of that.
So a script under `apps/docs/tools/` runs the sweep, reduces both into one
module holding per-project counts, per-file counts, the register joined to the
test names that matched each identifier, and the coverage summaries, and writes
it where the page imports it. That module is a build output and is not checked
in, which is decision 15.

### 8.3 What the page's prose has to satisfy

A new page under `apps/docs/content/` passes the checks in
`tools/repo-checks/src`, and three of them decide how the page is written.

`doc-fence.test.ts:205` defaults an unlisted section's allowance to 0, so every
fence on the page is a `file=…region=…` reference, a shell command, a mermaid
diagram, a twoslash fence, or carries an exemption tag. A hand-written sample
fence fails. `doc-domain.test.ts:169` defaults to 0 the same way, so examples
use the shop domain. `doc-twoslash.test.ts` compiles every twoslash fence
against each package's built `dist/`, so a fence on this page showing how to run
a coverage report is a shell fence and not a TypeScript one.

The prose checks apply as they do everywhere: no `not X but Y` pair inside a
sentence (`doc-antithesis.test.ts`), none of the refused words
(`doc-refused-words.test.ts`), no metaphor verb stating a technical fact
(`doc-figures.test.ts`), and a `caption` on every mermaid fence
(`diagram-captions.test.ts`). `doc-prose-budget.test.ts` warns over 1,200 words
and fails nothing.

### 8.4 The defect found while measuring

`libs/astro-widget/vite.config.ts` has no `coverage` block. The other ten
libraries all carry the same three lines, `libs/acl/vite.config.ts:25-28` being
the copy the rest follow, writing to `./test-output/vitest/coverage`. Without
it, Vitest's default `reportsDirectory` applies and the run writes to
`libs/astro-widget/coverage/`.

`.gitignore:30` ignores `/coverage`, anchored at the repository root.
`.gitignore:34` ignores `test-output` everywhere, and the comment at `:31-33`
states the assumption the anchored entry rests on: "Every project writes to its
own `<project>/test-output/vitest/coverage`, so the anchored `/coverage` above
does not catch them." One project does not, so `git status` after a coverage run
reports `?? libs/astro-widget/coverage/`. I ran it, saw that line, and deleted
the directory.

Decision 16 adds the block. A check would be better than a convention here, and
§ 10.2 is that check.

## 9. Where the page lives

The section is `/testing`, top level, beside the packages and inside none of
them. The inventory in § 1 and the kinds in § 2 are properties of the repository,
and the register is a property of `@evanion/acl`, so the register's own page
stays at `/acl/register` where `apps/docs/content/acl/security.mdx:66-70`
already links to it, generated per decision 13, and the `/testing` section links
to it.

Wiring it takes two edits and the second is the one to be careful about.
`apps/docs/content/testing/_meta.ts` orders the section's own pages.
`apps/docs/content/_meta.ts:49-52` gains a key for the directory, and that file
is today a derivation with one literal key:

```ts
export default {
  index: { title: 'All packages', href: '/' },
  ...Object.assign({}, ...groups.map((it) => group(it.id, it.title))),
} satisfies MetaRecord;
```

`tools/repo-checks/src/docs-navigation.test.ts:154-163` counts every
subdirectory of `content/` as a key the parent `_meta` must carry, and `:502-517`
fails with `content: testing` listed if the key is missing. So the section
cannot be added by dropping in a directory, which is the behaviour that file
exists to produce.

Nothing else blocks it. The two assertions at `docs-navigation.test.ts:175-218`
are about `navigation.packages` against `nx.json`'s `release.projects`, and a
section that is not a package never enters that list. `doc-floor.test.ts`
requires `index`, `getting-started`, `api` and a demo page of a documented
package's section, and reads the same package list, so it does not reach here.

The section's own pages: an index carrying § 1's inventory and § 2's kinds, and
a coverage page carrying § 7. Two pages, and the register's page stays where it
is.

## 10. What the checks have to gain

Three, all in `tools/repo-checks/src`. Each one reads files, and none of them
runs a build.

### 10.1 The register against the tests

Reads `libs/acl/SECURITY.md` and the three tier files. Asserts that the set of
`SEC-` identifiers in the register equals the set in the tests, that each
identifier's tier matches the file it appears in, that each register row's Test
column names that file, and that the counts stated at
`libs/acl/SECURITY.md:24` equal the counted ones.

This is the check `libs/acl/SECURITY.md:4-6` already claims exists. Without it,
decision 13's generated page projects an unverified file, which moves the drift
from two files to one and does not remove it.

### 10.2 Every library configures coverage the same way

Reads each library's resolved vitest configuration and asserts a `coverage`
block with `reportsDirectory: './test-output/vitest/coverage'`. One package
fails it today (§ 8.4), and decision 16 is the fix. This one is cheap and it
protects the data step in § 8.2, which globs those directories.

### 10.3 The kinds list is derived, and its exceptions are declared

§ 2 derives nine of the eleven kinds from the configs and names two in a short
list in the data script. That list is the thing that goes stale. The check reads
the list, asserts each entry names a file that exists, and asserts that no
vitest project config carries an include pattern the derivation does not
recognise. A new kind wired into a config appears on the page; a new kind wired
outside one fails this check until somebody declares it.

## 11. What should not be built

**A coverage badge in any README.** § 7.1.

**A trend line.** Coverage over time needs a stored series, which needs either
the committed file § 4.2 refuses or a database the static site cannot read. A
percentage that moved from 98.1 to 98.2 is noise, and drawing it invites a
reader to treat it as signal.

**A threshold that fails the build.** A coverage minimum makes the number the
target, and the first thing it buys is a test written to execute a line. The
register's counts are the thing worth gating, and § 10.1 gates them.

**A per-package coverage figure on the package's own pages.** Decision 10. A
reader on `/luhn` seeing 100% has learned that `@evanion/luhn` is 86 statements.

**An OWASP category page, an OWASP count, or an ASVS level claim.** § 6.3 and
§ 6.4.

**Publishing the raw vitest JSON.** 784 KB of assertion names, durations and
file paths, describing the build machine, for no reader.

## 12. The landscape, read for this document

Fetched on 2026-09-21 from each project's own repository or documentation, with
the page named beside each claim. The question asked of each was whether it
publishes a coverage percentage and how it presents its security testing.

**Cedar (`cedar-policy`).** No coverage percentage and no coverage badge. Its
README badges are crates.io, docs.rs, two build badges, cargo-audit and OpenSSF
Best Practices; `codecov.yml` returns 404 in that repository. Its security page,
`docs.cedarpolicy.com/other/security.html`, describes a formal model implemented
in Lean, "a differential testing engine that can test automatically that #1 and
#2 have the same semantics", and property-based testing, and states that
security is "a shared responsibility between Cedar and its users". The
verification work is a separate repository, `cedar-policy/cedar-spec`. The
closest thing to a published test statistic is a sentence in Amazon Science's
article on the project: "we run DRT for six hours nightly and execute on the
order of 100 million total tests". That is a count of executions, and it comes
with the mechanism that makes it meaningful.

**OpenFGA.** Publishes a coverage percentage, as a Codecov badge on the GitHub
README, reading 80% when queried on 2026-09-21. No security-model or
threat-model page exists in the `openfga.dev` documentation tree; the security
posture is a GitHub security policy stating a contact address, a five-business-day
reply target, and a scope that includes the server, stable SDKs, CLI and
official tooling and excludes experimental features. Conformance-style suites
live in-repo under `tests/` as Go packages with no narrative page around them.

**libsodium.** No coverage badge. README badges are CI, Coverity Scan, Azure and
CodeQL. The security story is one sentence in the documentation's introduction
linking a sponsored third-party audit, and the documentation's table of contents
carries no security, testing or audits chapter.

**rustls.** Publishes a coverage percentage, as a Codecov badge reading 95% when
queried on 2026-09-21. Its `SECURITY.md` is the closest published document to
this repository's register, and it is organised differently: three trust
boundaries, each with named threats and the mitigations against them, plus an
explicit scope statement. The network-originated-input boundary names integer
overflow, buffer over-read, infinite loops, reachable panics, authentication
bypass, protocol downgrade and memory exhaustion, and answers them with
`forbid(unsafe_code)`, OSS-Fuzz registration and the TLS 1.3 downgrade sentinel.
The public-API boundary treats callers as semi-trusted and explicitly excludes
"callers who deliberately work to undermine their own security". The scope
statement names what is out of scope by directory. A companion manual page walks
historical TLS vulnerability classes, Heartbleed and Apple's "goto fail" among
them, and says what in rustls' design prevents each. Its BoGo conformance suite
and its fuzzing targets each have a README, and no page states a count of tests.

**Tink.** No coverage badge. Its `docs/SECURITY-USABILITY.md` is organised as
named design goals, security, easiness, hard-to-misuse and others, and describes
testing qualitatively.

**OWASP Top 10.** The 2025 introduction describes the method: "we asked for the
number of applications tested for a given year... and the number of applications
with at least one instance of a CWE found in testing". It is a prevalence
ranking built from application testing data. Nothing in the project's
introduction, methodology or next-steps chapters proposes that a library map its
own test suite onto the categories.

**OWASP ASVS 5.0.** Defines an application as "the software product being
developed, into which security controls must be integrated", with a
component-level carve-out only for things like WAFs, load balancers and proxies
used for those specific purposes. Names "as a guide for automated unit and
integration tests" as an intended use. States that OWASP "does not certify any
vendors, verifiers, or software" and requires a verification report to state
scope, requirements checked and exceptions. Its levels are proportions of the
requirement set: L1 around 20% of requirements, L2 around 70% cumulative, L3 the
remaining 30%.

**What the five say together.** Two of five publish a percentage and three do
not, so there is no convention to follow. The two that do are a Go server and a
TLS implementation, both far larger than anything here. The two richest security
documents in the set, Cedar's and rustls', publish a mechanism and a scope and
no percentage: Cedar publishes what its differential testing compares, rustls
publishes what each trust boundary excludes. This repository's register is the
same kind of artifact as rustls' `SECURITY.md`. Its unit is a class of attack,
where rustls' unit is a trust boundary, and it is already more granular than
either.

### Not reached

- `doc.libsodium.org/bindings_for_other_languages/security`, 404.
- `owasp.org/www-project-application-security-verification-standard`, 404; the
  ASVS claims above come from the `OWASP/ASVS` repository's 5.0 English
  chapters, which is the canonical source.
- `top10.owasp.org`, which resolves to a client-side redirect with no
  extractable content; the Top 10 claims come from the `OWASP/Top10`
  repository's 2025 introduction.
- Two Cedar URLs on `aws.amazon.com` that 404; the Amazon Science article was
  used instead.
- BoringSSL, `ring` and `age` were on the list and were not reached.
- The research ran without web search, which was unavailable for that session,
  and used direct fetches and GitHub's read API instead. So the survey covers
  what is hosted on GitHub or fetchable by a URL guessed in advance, and it
  found no independent commentary on any of these projects' testing claims.

## Testing

The section's own tests, beyond the three repo checks in § 10.

The data step is a module with a pure reduction at its centre: vitest JSON plus
coverage summaries in, the page's data module out. That reduction is tested
against fixture reports committed under `apps/docs/tools/__fixtures__`, covering
a passing project, a project with a failing file, a project that collected
nothing, and a package with no coverage summary. The last two assert that the
reduction throws, which is decision 5.

The register join is tested the same way: a fixture register and a fixture run,
asserting that every identifier in the register found its tests, and that an
identifier with no matching test is an error.

The rendered page is tested in `apps/docs`'s own vitest project, which holds 62
cases over 14 files today. The assertions worth writing are that every register
row is in the prerendered markup before any client code runs, which is what
`apps/docs/components/probes/tested-region.test.tsx` already does for the probe
regions, and that a filter selecting only tier 3 rows renders the tier
breakdown.

## The evidence, and what it does not cover

### Measured

Against this worktree at `d474dc8`, Node v24.16.0, TypeScript 6.0.3, macOS
26.6.2, Apple M1 Pro, after `npx nx run-many -t build --skip-nx-cache`:

- The per-project counts in § 1, from one `npx vitest run --config <config>
--reporter=json` per project config, summed from the JSON reports: 2,443 cases
  over 168 files across 18 configs.
- That `apps/admin/vite.config.mts` fails to load here, with
  `Cannot find package '@react-router/dev'`, and that the same failure breaks
  the Nx project graph, which is why `npx nx test @evanion/acl` also failed.
- 44.7 s of wall clock for the sequential sweep of all 19 configs, warm, and
  19.3 s for the coverage sweep over the eleven libraries.
- The coverage table in § 7.2 and the per-package table in § 7.3, from
  `--coverage --coverage.reporter=json-summary` with `--typecheck.enabled=false`.
- The per-file figures quoted in § 7.2, from the same run's text reporter:
  `errors.ts` 50% branches, `diff-matrix.ts` 76.66% with lines 314, 456 and 486,
  `canonical.ts` 83.33% with lines 19 and 23.
- That `libs/compose`, `libs/react-acl` and `libs/react-widget` wrote no
  `coverage-summary.json` when their runs failed, with "Coverage enabled with
  v8" in each log.
- That `libs/astro-widget` wrote `libs/astro-widget/coverage/coverage-summary.json`,
  that `git status` then reported the directory as untracked, and that its
  figures are 100% statements over 19, 80% branches, 100% functions, 100% lines,
  over 5 files.
- Report sizes: 784 KB of vitest JSON over 18 projects, `libs/acl` 313,168 bytes
  of it; 23,268 bytes of `coverage-summary.json` over seven packages,
  `libs/acl` 9,085 bytes of it.
- The register counts: 20, 8 and 8 distinct `SEC-` identifiers in the three tier
  files, 36 in `libs/acl/SECURITY.md`, 36 in
  `apps/docs/content/acl/register.mdx`, 23 distinct CWEs in each of the two
  files, and the same 8 OWASP references in the same distribution in each. The
  two files agree today.
- 107 cases in `libs/acl/src/security` in the run, over three files of 1,169,
  471 and 247 lines.
- 32 `.test.ts` files in `tools/repo-checks/src` carrying 224 cases.
- Four `*.test-d.ts` files in the repository, from `git ls-files`.
- 126 twoslash fences and 150 `region=` references across 81 MDX pages under
  `apps/docs/content`.
- That `libs/acl`'s coverage report names 25 files, and that `libs/acl/src` holds
  18 non-test modules directly under it.

### Read here and not run

- `apps/docs/next.config.ts:29-77`, the three MDX loaders and the three static
  export settings. Nothing here rebuilt the site; § 4's argument is from what
  that file configures.
- `.github/workflows/docs.yml` in full and `.github/workflows/ci.yml:105-139`.
  No workflow was run. The claim that neither runs coverage today is from
  reading their steps.
- `tools/repo-checks/src/docs-navigation.test.ts:154-163` and `:502-517`, which
  § 9's wiring requirement rests on, and `:175-218`, which is why a non-package
  section is permitted.
- `tools/repo-checks/src/doc-fence.test.ts:205` and
  `doc-domain.test.ts:169`, the two allowances that default to 0 for an unlisted
  section.
- `tools/doc-examples/src/vite-config.ts` in full, for § 2's items 3 and 4.
- `apps/docs/components/probes/islands.tsx` and
  `apps/docs/components/probes/tested-region.test.tsx`, for § 8.2's pattern.
- `libs/acl/src/security/fixtures.ts:136-151` and the docblocks at
  `tier1-prevented.test.ts:1-8` and `tier3-contract.test.ts:1-14`.
- `scripts/verify-packaging.mjs:1-50`, for § 2's item 10.

### Quoted from a source outside this repository

Each fetched on 2026-09-21, with the page named in § 12: Cedar's security page
and the Amazon Science article, OpenFGA's GitHub security policy and its Codecov
badge endpoint, libsodium's documentation introduction, rustls' `SECURITY.md`
and its manual page on vulnerability classes, Tink's `SECURITY-USABILITY.md`,
the `OWASP/Top10` 2025 introduction, and the `OWASP/ASVS` 5.0 chapters
`0x03-What-is-the-ASVS.md` and `0x04-Assessment_and_Certification.md`.
Everything else about a project in § 12 is a summary in this document's own
words of a page named beside it.

### Asserted here and not measured

- That a reader takes a coverage percentage as a claim about assertions. § 7.1
  rests on it entirely and no reader of this site has been asked. The
  counter-evidence is that two of five surveyed projects publish one, so
  maintainers of serious security libraries evidently think it communicates
  something.
- That the docs deploy can afford the test run. 44.7 s is this machine, warm,
  after a full build. A GitHub-hosted runner with a cold cache is slower and I
  did not measure it, because no workflow ran here at all.
- That generating `/acl/register` from `libs/acl/SECURITY.md` is affordable. The
  register's Class column is reworded on the page to fit the width, so the
  generation either reuses the file's wording, which changes the page, or
  carries a second column in the file, which changes the file. § 3 names the
  choice and does not make it.
- That `apps/admin`'s absence from the measurement changes nothing structural. I
  read its `package.json` and its targets and assumed its tests are ordinary
  behaviour tests, and nothing here ran them.
- That the two kinds § 2 cannot derive are the only two. I enumerated by reading
  the configs and the CI workflows, and a kind wired somewhere I did not look
  would not have appeared.
- That 46 uncovered branches in `libs/acl` are worth showing a reader. They are
  worth showing a maintainer. Whether a consumer does anything with a list of
  line numbers is untested.
- Every claim about another project in § 12 is what that project's own
  documentation or repository said on the date recorded. Nothing was deployed
  and no behaviour was observed.

## Where I am guessing

- That the owner wants a section a reader chooses to open. The brief says
  section and says interactive, and § 7's refusals depend on that destination.
  If the intent was a trust signal on the front page, § 7 answers it in a
  paragraph and this document is longer than it needs to be.
- That the register generalises past `@evanion/acl`. It is the only package with
  one. `@evanion/token` mints codes a person reads over the phone and
  `@evanion/urn` signs identifiers, and both have classes worth registering.
  Whether the `/testing` section should hold one register or a register per
  package is a question this document settles for one package and not for the
  shape.
- That the tier system survives a second package. Tier 3's meaning depends on
  the library being one layer of an application's defence, which is true of
  `@evanion/acl` in a way it may not be of a checksum.
- That the right failure mode for a missing report is a failed deploy. It means
  a broken test in `apps/shop-api` stops the documentation from publishing. The
  alternative is a docs build that runs only the libraries' tests, which is a
  narrower coupling and a narrower page, and I did not work out where the line
  falls.
- That the 784 KB of vitest JSON reduces cleanly. I measured its size and read
  its shape. I did not write the reduction, and the join from a register
  identifier to the tests that ran under it depends on the identifier appearing
  in a `describe` title, which is a convention today and not a check.
- That ASVS is worth revisiting at all. § 6.4's argument is about
  what ASVS is for, and it would take a consumer asking to tell whether the
  mapping is wanted at all.
- That no reader wants the coverage percentage as a badge badly enough to matter.
  Decision 10 costs this project whatever a badge is worth to somebody
  evaluating it in ten seconds, and I have not tried to find out what that is.
