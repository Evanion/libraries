# A test statistics section on the docs site

Status: proposed. Research and design. The owner asked for a section showing
this project's test statistics, explaining the major classes of case it tests
against, with an interactive interface reading the coverage reports. Two of
those three arrive intact. The third, the coverage report as the thing a reader
looks at, is answered differently in § 7, and § 6 declines the OWASP framing the
question offered as an example. Three decisions arrive already settled by the
owner and are recorded here with their consequences worked out: the scope is the
published libraries and nothing else (§ 0), the coverage numbers are generated
at deploy time from a fresh run (§ 4.1), and the security material is organised
by the register (§ 6).
Packages: `apps/docs` gains a section and a build step. `tools/repo-checks`
gains two checks. `libs/acl` loses one duplicated table;
`libs/astro-widget/vite.config.ts` gains the `coverage` block it is missing
(§ 8.5). No published library changes its runtime or its types.
Depends on: `nx.json:146-151` (`release.projects` is `["libs/*"]`, which is the
scope § 0 adopts, and the comment above it is the reason it can be adopted
without writing a list), `apps/docs/next.config.ts:53` (`output: 'export'`, which
decides § 4 entirely), `apps/docs/next.config.ts:19-50` (the three MDX loaders a
new page passes through), `.github/workflows/docs.yml:54-67` (the deploy job,
which today installs and builds and runs no test),
`.github/workflows/ci.yml:105` (`nx run-many -t lint test build typecheck
check`, which runs no coverage), `libs/acl/SECURITY.md` (the register, 36
entries in three tiers),
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
section has to be wired), `tools/repo-checks/src/doc-export-coverage.test.ts:54`
and `:80-85` (one existing reader of the package list, imported from
`navigation.ts`), `tools/repo-checks/src/docs-navigation.test.ts:88-109` (the
other reader, computing the same set from `release.projects` through the Nx
project graph, which is what § 0 reuses), `:154-163` and `:502-517` (the
assertion a new content directory has to satisfy),
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
from their own sources on 2026-09-21 and listed in § 14 with the page beside
each claim. Two of the five publish a coverage percentage and three do not, and
the one whose security document is closest in shape to this repository's
register publishes 95%. OWASP's own two documents settle § 6: the Top 10 is
built from prevalence counts over tested applications and never proposes that a
library map its tests onto it, and ASVS, which does propose exactly that
mapping, defines the thing being verified as an application. Sources the
research could not reach are named at the end of § 14, along with one limit on
how the research was done.

## What is actually being asked

**The page is a trust signal.** The owner's reason, in his words: this project
uses AI heavily for development, and users become sceptical. The reader is an
engineer deciding whether to depend on an authorization library largely written
by a machine, and that reader arrives already doubting. Everything below is
derived from that, and the derivation changes several answers a page written for
a maintainer would give.

Three consequences, and they are the spine of this document.

**A number a sceptic cannot reproduce is worth less than nothing.** It reads as
marketing to exactly the reader the page exists for, and it confirms the prior
the reader came with. So every figure on the page carries the command that
produces it and the commit it was produced at (§ 5), and the numbers are
generated by the deploy (§ 4.1). A stale figure in front of this reader costs
more than an absent one.

**A statistic and a case each answer the doubt the other raises, so the page
pairs them.** This is the owner's argument and it is the page's organising
principle. A number is verifiable in principle and anecdotal to nobody, so a
count standing alone invites the reader to wonder whether the tests behind it
are filler. A case is concrete and proves only itself, so a case standing alone
invites them to wonder whether it was cherry-picked. The case shows the suite is
real; the count shows the case is not the only one. Neither is laid out in its
own section: every count on the page sits next to a case rendered from a test
that produced it, and § 8.1 is the layout that follows.

That principle is also what keeps the coverage figures on the page. They are the
weakest evidence here standing alone, and a rendered case beside them changes
what they are worth. What survives of the caution is narrow and absolute: the
page says what the number measures, because a reader who later discovers that a
coverage figure counted lines and not cases has been told something untrue by a
page built to be trusted. § 7.

**The strongest signals here are not statistics.** § 1 ranks them for this
reader. The top of that list is that the documentation's examples are executed,
compiled and rendered from the files the tests run, which answers the specific
fear that the prose was invented. Below it is a security register that publishes
what the package does not defend, which nobody fabricates. The page is built
from the top of that list down. The statistics support that material and never
lead it.

A trust page that lists only its strengths is the genre the reader is
suspicious of. § 12 is what the page cannot prove, written for them.

The owner asked for three things in one section: the statistics, an explanation
of the classes of case, and an interface over the coverage reports. The first
two are supported by material already in the tree and invisible to a reader. The
third has a hard constraint on it and an honesty problem inside it.

The material is real. Running every project's vitest config against `d474dc8`
collected 2,443 test cases over 168 test files in 18 of the 19 configs in the
repository. The eleven libraries hold 1,759 of those cases over 84 files, and
`libs/acl` alone holds 1,095 over 28. 107 of `libs/acl`'s sit in
`libs/acl/src/security`, one group per `SEC-` identifier, under a name that
states what must hold. `libs/acl/SECURITY.md` carries 36 register entries across
three tiers, and the tier decides what the test under it may claim. 95
documentation examples in the libraries execute as tests, 82 of them from
package READMEs and 36 from `libs/acl/README.md` alone, and 126 twoslash fences
in the site's content are compiled against each package's built output. None of
that reaches `docs.evanion.com` as a statement a reader can check.

The owner has since set the scope: the statistics cover the published packages
under `libs/` and nothing else. § 0 works out how to express that without
writing a list, and says what the page gives up by leaving the demo apps out.

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

Thirty-two. Decision A is what the page is for and decision B is how it is
built; every other decision is derived from those two. Decision 0 is the scope
the owner set. Decisions 1 through 6 settle where the numbers come from, 7
through 9 what the security part claims, 10 through 12 the coverage figures, and
13 through 16 the wiring and one defect found while measuring. Decisions C
through I build the page around B, and K through O are its visual design.
Decisions J and O are put to the owner undecided, because they are his to make.

### The two the rest are derived from

A. **The page's audience is a reader who suspects the library was written by a
machine and wants to find out whether it is any good.** Every other decision is
derived from that, and where a maintainer-facing answer and a sceptic-facing
answer differ, the sceptic wins. The page opens with what a reader can check for
themselves, and the statistics follow. "What is actually being asked" is the
derivation, and § 1 is the ranking.

B. **Every count on the page sits beside a case rendered from a test that
produced it, and neither appears alone.** A count alone reads as filler and a
case alone reads as cherry-picked, so each answers the doubt the other
raises. This decides the layout (§ 8.1), it is why the coverage figures stay
(decision 10), and it is why the page shows four cases and not thirty-six
(§ 3A.4).

### The numbered decisions

0. **The page counts the projects `nx.json`'s `release.projects` matches, which
   is the eleven libraries under `libs/`.** The demo apps, the docs app, the
   design system and the repository checks are off the page's numbers. The data
   step resolves the set through the Nx project graph, the way
   `tools/repo-checks/src/docs-navigation.test.ts:88-109` already does, so
   adding a library needs no edit here. What that costs the page is real and
   § 0.3 states it. § 0.

1. **The section is one top-level `/testing` section, and every number on it is
   derived at build time from a run.** Nothing on the page is typed by a person
   and nothing is copied from another file. The page is prerendered into the
   static export, so the reader downloads a page, not a fetch. § 9.
2. **The numbers come from a fresh test run over the libraries during the docs
   build.** The `docs.yml` build job gains a coverage run ahead of
   `nx build docs`, and the build reads the reports that run wrote. Measured
   here: 19.3 s of wall clock for the coverage sweep over the eleven libraries,
   sequential and warm, against 44.7 s for a sweep of all 19 project configs.
   § 4.1 and § 4.4.
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
6. **Every figure on the page carries the command that reproduces it and the
   commit it was measured at.** `npx nx test @evanion/acl` sits beside
   `@evanion/acl`'s counts, the coverage command beside the coverage figures.
   A reader who doubts a number runs the line under it. This is the decision
   that makes the page evidence for the reader decision A names. § 5.
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
10. **The coverage figures stay on the page, beside a case, and never as a
    badge.** They are weak alone and a rendered case beside them changes what
    they are worth, which is decision F. What stays absolute: the sentence
    introducing them says they count lines executed, because a reader who
    discovers that later has been misled by the page built to earn their trust.
    No badge, no sidebar figure, no landing-page number. § 7.1.
11. **Statement and branch percentages appear together, with the uncovered lines
    named.** Measured on `libs/acl`: 98.16% of statements and 94.42% of
    branches, which is 21 statements and 46 branches not executed, in files the
    report names. The gap between the two is the honest part. § 7.2.
12. **Coverage is never summed into one workspace number.** Measured across the
    libraries: three sit at 100% on all four metrics and `libs/acl`, the package
    with the most tests in the repository by a factor of five, sits lowest of
    the four largest. A workspace average would move when a 42-statement package
    changes. § 7.3.
13. **`apps/docs/content/acl/register.mdx` stops being typed and starts being
    generated from `libs/acl/SECURITY.md` and the run.** The two files agree
    today, entry for entry and identifier for identifier. § 3.
14. **The guard holding the register against its suite and its published page is
    PR #259, open as this is written, and decision 13 builds on it.**
    `libs/acl/SECURITY.md:4-6` claimed the adversarial suite was checked against
    the register and nothing checked it. That PR adds
    `tools/repo-checks/src/security-register.test.ts`, 208 lines, holding the
    identifiers in both directions, the tier each is proved in, the stated
    counts, and the identifiers on the published page. This document specifies
    nothing about that check and references it. § 3.
15. **The section's data module is built by a script under `apps/docs/tools/`
    and is not checked in.** The raw vitest JSON for the eleven libraries is
    530 KB, of which `libs/acl` alone is 313 KB, so the build reduces it before
    any of it reaches a page. § 8.2.
16. **`libs/astro-widget/vite.config.ts` gains the `coverage` block the other
    ten libraries carry.** It has none, so a coverage run writes to
    `libs/astro-widget/coverage/`, which `.gitignore:30-34` does not catch. Found
    by running it, and `git status` reported the directory as untracked. § 8.5.

### How the page is built around them

C. **The four cases are chosen by a rule, and the rule is printed above them.**
The lowest-numbered entry in each tier, plus every entry whose test
constructs the seeded generator, which selects SEC-001, SEC-019, SEC-101 and
SEC-201 today. Cases chosen by taste are cherry-picked whether or not the
author meant them to be, and a sceptic assumes they were. § 3A.4 states what
the rule excludes and what it rests on.

D. **Every one of the thirty-six entries is one click from the page, as a row
naming its tier, its identifiers and the test that proves it.** A selection
stays honest when the unselected are reachable, and PR #259's check is what
guarantees the link resolves to a test that runs. § 3A.4.

E. **The cases are rendered as `file=…region=…` fences over
`libs/acl/src/security`, so the page shows the text of a test CI ran.**
Marking regions in the tier files costs two comment lines per case and
changes no behaviour, and a region always encloses a complete `it(...)` block
and never a fragment assembled for display. § 3A.1 and § 3A.2.

F. **The page shows cases carrying OWASP and CWE identifiers, and claims no
OWASP category coverage.** Showing SEC-001's attack and refusal claims that
this named class has a real case that runs, and nothing about API3:2023 as a
category. 8 of the 36 entries carry an OWASP identifier, and the page says
so. § 3A.6, which is how § 6's refusal and the owner's instruction are the
same page.

G. **The page opens with the executed documentation, and it is the largest thing
on it.** 95 documentation examples in the libraries run as tests, 82 from
package READMEs, 36 from `libs/acl/README.md` alone, and 126 twoslash fences
compile against each package's built output. For a reader afraid the prose
was invented, an example that cannot be wrong is the strongest answer this
repository has. § 1.1.

H. **The page publishes the guards' recorded debt beside the guards.** The
export-coverage allowance records 115 undocumented and 29 unexercised exports
across nine packages, and the fence allowance records 242 fences that are not
region references. A guard that reports its own backlog is the evidence; a
guard quoted without it is the marketing the reader expects. § 1.3 and § 12.

I. **The page carries a section on what it cannot prove, and that section is not
at the bottom.** A suite covers the cases somebody thought of, the guards
check shape and not correctness, and § 12 says both plainly. Omitting this is
what makes a trust page read as marketing.

J. **Whether the page states the AI involvement outright is the owner's
decision, and this document does not make it.** § 11 works both options
through and recommends stating it. Nothing else in this specification changes
either way, which is the reason it can be left open.

K. **The page is built from `internal/baize-ui` and invents no palette.** Six
ground roles, two families, the kit's components. A trust page in a foreign
visual identity is the last thing this project can afford. § 8A.

L. **The hero is a rendered refused attack, not a figure.** SEC-001's `it(...)`
block above the fold, under one sentence of frame and above its provenance line.
No `StatLine` above the fold. § 8A.1.

M. **`AvailabilityPill` carries the tier, and `ComplexityRamp` is refused.**
`inStock`, `preorder` and `outOfPrint` map onto prevented, primitive supplied
and out of scope without stretching; `reprintPending` stays unused. A ramp is
ordinal and tier is nominal, and rendering the eight non-defences as the far end
of a scale is the most misleading thing available here. § 8A.3 and § 8A.4.

N. **One blocker before any of this is built: the availability colours have no
checked contrast on the docs site's light ground.**
`internal/baize-ui/src/tokens/tokens.test.ts:206-215` holds them against dark
`felt`, and `apps/docs/app/global.css:66` rebinds it. `categorical` and
`platform` carry `on-light` variants and `availability` carries none. § 8A.3 and
§ 8A.8.

O. **Where § 12 sits is put to the owner with three arrangements and a
recommendation.** A short limits block in the hero band, the full section in
place. § 8A.2 argues against moving it whole and says what to take if the owner
disagrees.

## 0. The scope, and how it is expressed

The owner set it: the statistics cover the published packages under `libs/`. The
demo apps, the docs app itself, the design system under `internal/` and the
repository checks under `tools/` are off the page's numbers.

### 0.1 The list already exists, twice

`nx.json:151` is `"projects": ["libs/*"]`, and the comment above it at `:146-150`
gives the reason the scope can be adopted without writing anything down: "The
directory decides: everything under `libs/` is a published library and every
other project sits elsewhere... so nothing here needs an exclusion, and adding a
library needs no edit."

Two files in the repository already resolve that set.
`tools/repo-checks/src/docs-navigation.test.ts:88-109` reads `release.projects`
from `nx.json` with the comment-tolerant parser, expands the globs against the
Nx project graph with `findMatchingProjects`, and returns each project's name
and root. `tools/repo-checks/src/doc-export-coverage.test.ts:54` and `:80-85`
take the same set from the other end, importing `packages` from
`apps/docs/app/navigation.ts`, and `docs-navigation.test.ts:175-218` is what
holds those two in agreement in both directions.

The data step takes the first form. It resolves `release.projects` through the
project graph, then reads each matched project's vitest config and coverage
output. That makes the page's scope the same predicate as the release scope, and
a twelfth library appears on the page the day it is released, with no edit to
`apps/docs` and none here.

Taking the second form instead would read `navigation.ts`, which carries
editorial fields the statistics have no use for, and which is already a
derivation of the first. Either resolves to the same eleven projects today,
because `docs-navigation.test.ts` fails when they stop matching.

### 0.2 What the page counts, measured

Run against `d474dc8`, one `vitest run --reporter=json` per project config,
after `nx run-many -t build --skip-nx-cache`:

| Package                          | Test cases | Test files |
| -------------------------------- | ---------: | ---------: |
| `@evanion/acl`                   |      1,095 |         28 |
| `@evanion/urn`                   |        139 |          5 |
| `@evanion/react-widget`          |        108 |         16 |
| `@evanion/feature`               |         90 |          7 |
| `@evanion/luhn`                  |         75 |          5 |
| `@evanion/token`                 |         74 |          5 |
| `@evanion/widget`                |         48 |          5 |
| `@evanion/nestjs-correlation-id` |         46 |          5 |
| `@evanion/react-acl`             |         35 |          3 |
| `@evanion/compose`               |         30 |          3 |
| `@evanion/astro-widget`          |         19 |          2 |
| **On the page**                  |  **1,759** |     **84** |

### 0.3 What the page gives up

The same run collected 684 cases over 84 further files in seven projects the
page will not count:

| Project                | Test cases | Test files |
| ---------------------- | ---------: | ---------: |
| `@evanion/repo-checks` |        224 |         32 |
| `@evanion/baize-ui`    |        183 |          7 |
| `storefront`           |        114 |         10 |
| `shop-api`             |         84 |         18 |
| `@evanion/docs`        |         62 |         14 |
| `storefront-rsc`       |         14 |          2 |
| `@evanion/nx-astro`    |          3 |          1 |
| **Off the page**       |    **684** |     **84** |

So the page counts 72% of the repository's cases and half of its test files.
Three things go with the other half, and two of them are losses worth stating on
the page.

**The demo apps are where a library is exercised end to end, and a reader could
reasonably expect them counted.** `shop-api`'s 84 cases and `storefront`'s 114
run the policy engine through a NestJS service and an Astro renderer, and
`apps/shop-api/src/orders/orders.e2e.spec.ts` is one of only two end-to-end
files in the repository. A reader told that `@evanion/acl` has 1,095 tests has
not been told that an application enforcing a policy through it also passes. The
page says so in a sentence and links the apps' directories. It does not count
them, and it does not imply they do not exist.

**The repository checks drop off the count, and § 1.3 is why that does not
matter here.** 224 cases over 32 files hold the workspace and its documentation
to invariants. They are strong evidence for the reader decision A names, and
they are evidence about the repository's process, so the page presents them as
process and not as a test statistic. § 1.3 does that, § 2 names them as a kind
of test, and no number of theirs joins § 0.2's table.

**`internal/baize-ui`'s 183 cases are no loss.** It is `private: true` and
`npm install` does not resolve it, which is the same reason
`docs-navigation.test.ts:209-218` keeps it off the site's package list.

### 0.4 What the narrow scope buys

A test failure in `apps/shop-api` no longer stops the documentation publishing,
because the docs build never runs it. That was the open question this document
left in its first draft. The scope answers it, and no policy about which
failures are tolerable is needed.

`apps/admin` is the nineteenth config and collected nothing here. Its
`vite.config.mts:3` imports `@react-router/dev/vite`, and that package is absent
from the installed `node_modules`, so the config fails to load and the Nx project
graph fails with it. That is a stale install in this checkout, and "Measured" at
the end records it as a gap in the measurement. Under decision 0 it is also off
the page, so the same stale install would no longer break a deploy. The data step
still treats a matched library that collects nothing as an error, for the reason
decision 5 gives.

The brief this document answers put the count of repo checks at "30+". Measured:
`tools/repo-checks/src` holds 32 `.test.ts` files carrying 224 cases, run as two
vitest projects, one of which loads Astro's vite plugin to compile `.astro`
components (`tools/repo-checks/vitest.config.ts:37-52`).

## 1. What a sceptic can check, ranked

Decision A says the page is built from the top of this list down. The ranking
criterion is what the reader can verify without trusting the author, and how
directly the evidence answers the fear that a machine wrote the library and
nobody checked.

### 1.1 The documentation's examples are executed, and that is the strongest

thing here

The specific fear about machine-written software is plausible prose over wrong
code. A README that explains an API the package does not have, an example that
would throw, a signature that drifted three releases ago. Every one of those is
a thing this repository makes impossible, by three separate mechanisms, and a
reader can confirm each one by running a command.

**A README region runs as a test.** `tools/doc-examples/src/vite-config.ts:25-28`
wires `vite-plugin-doctest` and `:54-55` collects `README.md` and every
non-test source into `includeSource`, so a fenced block in a package's README is
executed by that package's own suite. Measured over the eleven libraries: 95
executed documentation examples across 11 source files, 82 of them from READMEs,
36 from `libs/acl/README.md` alone. A reader who doubts a README snippet runs
`npx nx test @evanion/acl` and watches it run.

**A `// -> value` claim in an example becomes an assertion.**
`tools/doc-examples/src/vite-config.ts:25-26` rewrites it before doctest
extracts the block, and `tools/repo-checks/src/expect-comments.test.ts` holds
the rewriter to firing on value claims and on nothing else. So the value a
README says a call returns is the value the test compares against.

**A page's code block is rendered from the README region the tests ran.** The
MDX loader at `apps/docs/next.config.ts:19-50` fills every `file=… region=…`
fence from the named region of the package's own README, and a renamed region
fails the site build. `tools/repo-checks/src/doc-regions.test.ts` fails earlier,
in `nx test`, for the same reason. Measured: 150 `region=` references across 81
MDX pages. The snippet on the page is not a copy of the tested one; it is the
tested one.

**A `twoslash` fence is compiled.**
`tools/repo-checks/src/doc-twoslash.test.ts:13-35` compiles every twoslash fence
in the site's content and in the package READMEs against each package's built
`dist/`, under Twoslash's strict defaults, and fails when an `@errors:` code a
fence declares stops being produced. Measured: 126 twoslash fences.

That is the top of the page. Four mechanisms, each with its file, each with a
number, each with a command. None of it is a statistic about quantity.

### 1.2 The register publishes what the package does not defend

Second, because it is the one claim on the site that costs the author something
to make. `libs/acl/SECURITY.md` holds 8 tier 3 entries stating that no defence
exists: a forged subject (SEC-201), complete mediation (SEC-202), client-side
enforcement (SEC-205), a caller-supplied clock (SEC-207) and four more. Each is
held in place by a test asserting the README clause that states the gap
(`libs/acl/src/security/fixtures.ts:136-151`).

Nobody fabricates their own gaps. A reader who finds a published list of the
attacks a library does not stop has found the one thing a marketing page never
contains, and § 6 is the argument for keeping the register's shape intact rather
than flattening it into categories.

### 1.3 The claims are guarded, and the guards carry their backlog

Third. `tools/repo-checks/src` holds 32 test files carrying 224 cases at
`d474dc8`, and PR #259 adds a thirty-third, taking it to 231. They check the
repository's claims about itself, and two of them are directly about the fear in
§ 1.1: `doc-export-coverage.test.ts` refuses a published export with no
documentation heading and no example exercising it, and `doc-exports.test.ts`
refuses a fence importing or naming a symbol its package does not export.

The honest presentation is the guard together with what it has not yet caught
up on, which is decision C. Measured from the allowance files:
`doc-export-coverage-allowance.json` records 115 undocumented and 29 unexercised
exports across nine packages, and `doc-fence-allowance.json` records 242 fences
that are not region references. Those are recorded debts that a new addition
cannot grow, because both allowances default an unlisted entry to zero
(`doc-export-coverage.test.ts:441` and `:461`, `doc-fence.test.ts:205`).

A page that says "every documented export has a working example" is false and a
reader can check that it is false. A page that says "115 exports are documented
nowhere, recorded in a file the build reads, and no new one can be added" is
true, checkable, and better evidence.

### 1.4 The security register is now checked against its own suite

Fourth, and newly true. `libs/acl/SECURITY.md:4-6` stated that the adversarial
suite is checked against the register, and until PR #259 nothing checked it. That
PR adds `tools/repo-checks/src/security-register.test.ts`, holding the
identifiers in both directions, the tier file each identifier is proved in, the
stated counts at `:24`, and the identifiers on the published page at
`apps/docs/content/acl/register.mdx`. Decision 13 builds the page's register on
top of it.

This ranks below § 1.3 for one reason a sceptic will appreciate: it is a day
old, and the failure it fixes is exactly the failure this page is about. The
page says so.

### 1.5 The counts, last

`libs/acl` holds 62% of the 1,759 cases the page counts. 107 of its 1,095 sit in
`libs/acl/src/security` over three files of 1,169, 471 and 247 lines, one group
per `SEC-` identifier.

The distribution is uneven in a way the page shows and never averages:
`@evanion/react-widget` carries 108 cases over 16 files, `@evanion/urn` 139 over
5, `@evanion/astro-widget` 19 over 2. A file count beside a case count tells a
reader which packages have many small suites and which have a few large ones,
and both numbers come from the same report.

A count of tests says how much was tested and nothing about how well, which is
why decision B never lets one stand alone. 1,095 beside SEC-019's seeded
generator is a different claim from 1,095 on its own: the count says the case is
not the only one, and the case says the count is not filler.

### 1.6 Coverage, last

Weakest of the six, for the reason § 7.1 gives, and on the page for the reason
decision B gives. It ranks last and it is not dropped. § 7.

## 2. The kinds of test, and how the page derives the list

The brief listed nine kinds. Reading the tree finds eleven distinguishable ones,
and the difference matters because the page's list has to be derived from the
configuration and not typed under it.

Seven of the eleven run inside the libraries and carry a number on the page.
Four sit wholly or partly outside § 0's scope, and each is marked below with
where it runs. The page names all eleven, because the list is a statement about
method and a reader looking for "does this project compile its documentation
examples" wants an answer whichever project the examples live in. Only the seven
carry counts.

1. **Behaviour tests.** `src/**/*.{test,spec}.ts` in every project config, the
   bulk of the 1,759 the page counts.
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
6. **Repository checks.** 32 files, 224 cases, described in § 0.4. Outside the
   scope: they live in `tools/repo-checks`, so the page names them and counts
   nothing.
7. **Astro container tests.** `.astro` components rendered in a second vitest
   project that loads Astro's own vite plugin. Inside the scope in
   `libs/astro-widget/vite.config.ts:56-71`, and outside it in
   `tools/repo-checks/vitest.astro.config.ts`.
8. **End-to-end tests.** Two files, one in each. Inside:
   `libs/nestjs-correlation-id/src/correlation.e2e.spec.ts`. Outside:
   `apps/shop-api/src/orders/orders.e2e.spec.ts`, which is the one § 0.3 says
   the page gives up.
9. **Build-output assertions.** `apps/storefront/src/build.test.ts` reads what
   `astro build` emitted, which is why `nx.json:119-127` orders a project's own
   build ahead of its tests. Outside the scope, and the only kind with no
   instance inside it.
10. **Packaging verification.** `scripts/verify-packaging.mjs` packs every
    publishable library, installs the tarballs into a throwaway project outside
    the workspace, and checks a consumer can import them. Its subject is exactly
    § 0's eleven packages, and it runs as its own CI job
    (`.github/workflows/ci.yml:125-139`) belonging to no Nx project, so
    `nx run-many -t test` does not reach it and neither does the docs build.
    The page names it and counts nothing.
11. **The adversarial suite.** `libs/acl/src/security`, 107 cases over three tier
    files, one group per register entry, including seeded property tests drawing
    from `libs/acl/src/security/generator.ts`. § 3 is about this one.

The page derives 1, 2, 3, 7 and 11 by reading each matched library's resolved
vitest configuration, which is what the data step already loads to run the
tests. It derives 5 from the test file paths in the run. It derives 4, 6, 8, 9
and 10 from a short list in the data script naming the kinds that live outside a
matched library's vitest config, with a comment saying why each is there and
whether it carries a count. A kind added to a library's config appears on the
page with no edit; a kind added elsewhere does not, and § 10.2 is the check that
reports it.

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

Until PR #259 nothing in the repository held them together.
`libs/acl/SECURITY.md:4-6` claims "the adversarial suite in `src/security` is
checked against this file: one entry per class, one identifier, and the test
that proves the entry", and no code did that. The only references to the
register from the tests were two docblocks, `tier1-prevented.test.ts:6` and
`tier3-contract.test.ts:12`, which describe the arrangement and check nothing.
The counts on `apps/docs/content/acl/register.mdx:5`, `:29`, `:56` and `:71` are
English words typed by hand: "thirty-six", "Twenty entries", "Eight entries",
"Eight entries".

PR #259 adds `tools/repo-checks/src/security-register.test.ts` and closes it:
identifiers in both directions, the tier file each is proved in, the stated
counts, and the identifiers on the published page. Decision 13 makes the page a
projection of the register on top of that check, and this document specifies
nothing further about it.

## 3A. Showing the cases, from the tests that ran

The owner's instruction is show, not tell. A reader who is told the library
tests mass assignment has learned nothing that a page could not have invented. A
reader who sees the malformed write, the decision the engine returned, and the
file that produced both has seen it.

The mechanism for that already exists in this repository and is already pointed
at a test file.

### 3A.1 A region in a test file is an existing, used pattern

`tools/doc-examples/src/regions.mjs:44-47` matches `// #region name` and
`// #endregion name` in any file whose path matches `/\.(?:tsx?|astro)$/`, which
a `.test.ts` satisfies. Its docblock at `:18-28` says the case was designed for:
"`expectTypeOf` and `@ts-expect-error` live in a `*.test-d.ts` file, which has no
README fence to sit in, and the claim the page renders is then the one `tsc`
checked." And at `:38-40`: "The extracted block is executed, because the file it
comes from is executed."

The pattern is in use. `apps/docs/content/acl/react-router.mdx:222`, `:229` and
`:238` render three regions of `apps/admin/tests/access.spec.tsx`. The middle
one, marked at `access.spec.tsx:264-278`, is a whole `it(...)` block with its two
`expect` calls inside the region, and the page around it at `:232-233` says
"Every case decides on a real document, because a stubbed decision only asserts
that the action called something."

So the page can render `libs/acl/src/security/tier1-prevented.test.ts` directly,
region by region, and what a reader sees is the text of a test that CI ran.

### 3A.2 The cost of marking the security tests, stated

The tier files are the register's proof, and adding comment markers to them
touches a security-sensitive file for a documentation reason. The trade, both
sides:

**What it costs.** Three things. A marker pair is two lines per shown case in a
file whose whole value is that it is easy to audit. A region boundary becomes a
thing a later edit can break, since moving an assertion out of a region changes
the page without changing the test. And a rendered case invites an author to
write the test for the page, which is how an example stops being the honest
minimum and starts being a demonstration.

**What it costs nothing.** `// #region` is TypeScript's and VS Code's own
folding marker and means nothing to the compiler
(`tools/doc-examples/src/regions.mjs:24-26`), so no test behaviour changes, no
import moves, and the file runs identically. `doc-regions.test.ts` fails in
`nx test` when a region is renamed or removed, so a broken boundary is a red
test and never a quietly empty fence. A `file=…region=…` fence is the sanctioned
fence form, so the 36 the page could add cost nothing against
`doc-fence-allowance.json`.

**The recommendation is to mark them**, and to answer the third cost by a rule
by a rule: a region encloses a complete `it(...)` block, never a fragment
assembled for display. A reader can then check the rendered case
against the file and find the same text, and an author gains nothing by writing
for the page because the page shows whatever the test says.

### 3A.3 The engine's answer is already in the region

Showing the attack is half of it. The half a sceptic wants is what the engine
returned, and in a test file it is already visible, because the assertion states
it. `tier1-prevented.test.ts:53-60` reads
`expect(decision.fields['role']).toBe('denied')` and
`expect(decision.allowed).toBe(false)`. A region around that block renders the
hostile write and the refusal together, in the form CI checked.

So the `// -> value` rewriting is not needed here, and the page should not use
it. It exists for README prose where no assertion is in scope
(`tools/doc-examples/src/vite-plugin.ts:4-12`). `expectComments` does transform
any `.ts` file the pipeline touches (`vite-plugin.ts:18-22`), so a `// -> value`
in a tier file would become an assertion and would work. It would be a second
way of saying what `expect` already says, in the one file where a reader is
counting on being able to read the assertions as written.

One thing the region cannot show is the decision object in full, because a test
asserts the members it cares about. Where a case turns on the shape of the
answer, the page's prose names the other members and links the file. It does not
paste an object nothing checked.

### 3A.4 All thirty-six cases, ranked by a printed rule

The owner's instruction is to feature as many high-value cases as the page can
hold, and the indexing constraint in § 8.2 says every case has to be in the
exported HTML whether or not it is on screen. Those agree, so the answer is not
a selection at all.

**All thirty-six cases are rendered into the page at build time, ordered by a
rule the page prints above them.** The rank decides what a reader meets first
and what sits collapsed below. Nothing is cut, and no case is fetched or
rendered on demand, for the reason § 8.2 gives.

That removes the cherry-picking doubt entirely. A reader who thinks the order
was arranged scrolls, and the case they wanted is on the same page.

**The rank, and every criterion is read off the register's own columns.**

1. **Tier 3, the eight entries publishing a non-defence.** Least fakeable, so
   first. SEC-201's forged subject leads the page: `tier3-contract.test.ts:32-40`
   asserts the engine "authorizes a forged subject exactly as it would a real
   one", with the comment "No defence. The engine has no channel to ask where
   the bag came from, and this is what that costs."
2. **Tier 2, the eight entries where the register states the wrong idiom beside
   the right one.** These are the mistakes a competent engineer actually makes,
   which is the property separating a real case from a filler test. SEC-101's
   entry says filtering by hand on `!== 'denied'` writes the unevaluable fields
   and every key the decision does not carry, and the rendered case shows both
   calls against one decision.
3. **Tier 1 whose defence acts when a decision is made, which is eighteen of the
   twenty.** A wrong grant with no error is the failure a reviewer never catches
   by reading, so the engine getting it right is the whole of the defence.
   Within this group, the entries carrying a CWE and an OWASP identifier come
   first, then the entry drawing from the seeded generator, then the rest by
   identifier.
4. **Tier 1 refused at construction, which is SEC-009 and SEC-020.** Last,
   because a construction error is loud: the first developer to run the code
   sees a thrown exception, so the case demonstrates a guard. No silent failure
   was avoided.

Measured, by reading the Mechanism column of every tier 1 row: two entries name
a construction error as the whole of the defence (SEC-009, "an operand the engine
would ignore is refused at construction"; SEC-020, "are all construction
errors"). Two more name both paths and rank with the decision-time group,
because a decision-time defence exists: SEC-011 ("the untrusted path fails closed
on an unknown key; the authored path throws") and SEC-018 ("a condition whose
clock does not parse is `unusable-clock`, not a fail... A boundary that does not
parse is an `InvalidConditionError` at construction").

**What the rank rests on.** Criteria 1, 2 and 4 are read off columns PR #259's
check already holds against the suite. Criterion 3's ordering uses the OWASP and
CWE columns, which are editorial: somebody decided SEC-001 carries API3:2023.
The page says so. It changes which of eighteen tier 1 cases a reader meets
first, and it changes nothing about which cases exist, because all of them do.

**Why this needs a component, which is why the owner asked for one.** Thirty-six
cases with their code is too much to read as a flat page and exactly right as a
filterable set. The statistics sit at the top, the ranked cases below, and the
component filters by tier, by CWE and by OWASP identifier, and by free text over
the class and the mechanism. The case volume is the reason the component exists.
§ 8.1 is the layout and § 8.2 is the constraint on how it filters.

### 3A.5 The build cost, stated so the owner can see it

Marking regions is real work in security-sensitive files, and the owner should
choose with the size visible.

**Thirty-six region pairs, 72 marker lines, across three files.**
`tier1-prevented.test.ts` is 1,169 lines and takes 20 pairs,
`tier2-primitives.test.ts` is 471 lines and takes 8, `tier3-contract.test.ts` is
247 lines and takes 8. The three hold 107 cases between them, so a region marks
one representative `it(...)` per entry and the other 71 cases stay unmarked and
unrendered, reachable through the file link every register row carries.

Choosing that representative is the one judgement in the work, and the rule from
§ 3A.2 bounds it: a region encloses a complete `it(...)` block, never a fragment.
Where an entry's first `it` is the clearest statement of the attack, which is
the pattern in `tier1-prevented.test.ts` throughout, the choice is mechanical.

**What the work does not touch.** No assertion changes, no fixture changes, no
import moves. `// #region` is TypeScript's and VS Code's own folding marker
(`tools/doc-examples/src/regions.mjs:24-26`), so the compiler and the runtime see
nothing. The suite that passes before the marking is the suite that passes
after, which a reviewer confirms by reading a diff of comment lines.

**What it adds to the guard surface.** 36 new `file=…region=…` references, each
checked by `tools/repo-checks/src/doc-regions.test.ts` in `nx test`, so a
renamed or deleted region is a red test in seconds. A `file=…region=…` fence is
the sanctioned fence form, so the 36 cost nothing against
`doc-fence-allowance.json`.

### 3A.6 What the shown cases claim about OWASP, and what they do not

§ 6 refuses to organise the page by OWASP category, and that refusal and the
owner's instruction to lift how the project tests against known issues are the
same page once the claim is stated precisely.

**The page shows cases that carry OWASP and CWE identifiers. It does not claim
to cover an OWASP category.** SEC-001 carries CWE-915 and API3:2023, and
rendering its attack, the engine's refusal and the test behind it claims exactly
one thing: this named class has a real case that runs. It claims nothing about
API3:2023 as a category, and the page never counts categories.

The page says so in its own words, and says the arithmetic: 8 of the 36 entries
carry an OWASP identifier, 30 carry a CWE alone, and the identifiers are a
property of individual entries. A reader looking for an index of the Top 10 is
told there is not one here and why, which is § 6.3 and § 6.4 compressed to a
paragraph.

The three tiers stay on the page and stay visible in every filtered view, for
the reason § 6.2 gives.

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
different directory (§ 8.5). Vitest printed "Coverage enabled with v8" in all
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

**Every figure also carries the command that reproduces it**, which is decision
6 and the thing that turns a claim into evidence for the reader decision A
names. `npx nx test @evanion/acl` sits under `@evanion/acl`'s counts.
`npx nx test @evanion/acl --coverage` sits under its coverage figures. The
commands are derived from the project name, so a twelfth library gets its own
without an edit. A reader who doubts a number runs the line under it and
compares.

One honesty note the page inherits from this document. `npx nx test @evanion/acl`
failed in this worktree, because `apps/admin`'s vite config imports a package
absent from the installed `node_modules` and the Nx project graph fails with it.
The per-project form, `npx vitest run --config libs/acl/vite.config.ts`, is what
produced every figure here. The page prints the `nx` form, which is what a
reader with a clean install runs, and the evidence sections of this document
record the substitution.

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

## 7. The coverage figures, and what makes them worth showing

The brief asked whether a coverage percentage belongs on a docs site at all.
The answer, under decision B: the figures belong on the page, beside a case, and
never as a badge. Alone they are the weakest evidence here. Beside a rendered
test they are a different object, because the case answers the doubt the number
raises.

### 7.1 What the number measures, said on the page

A v8 line-coverage percentage counts statements the run executed. It counts
nothing about assertions. A suite that imports every module and asserts nothing
reaches a high number. The reader takes it as "this library is well tested",
which is a claim about assertions, and a reader who discovers the difference
after trusting the figure has been misled by a page built to be trusted.

So the sentence introducing the figures says what they count, in those words,
and it is not a footnote. This is the one part of the caution that survives
decision B intact.

What the paired case buys, concretely. A reader looking at 94.42% of branches
under `libs/acl` can look immediately below at SEC-001's attack and the engine's
`{ allowed: false }`, and at SEC-019's seeded generator producing writes nobody
enumerated. The number says how much of the file ran. The case says the running
was doing something. Neither sentence is available from the other.

**No badge, no sidebar figure, no landing-page number, no percentage on a
package's own pages.** A badge is the figure with every qualifier stripped and
no case beside it, which is the form decision B exists to refuse. Two of the
five libraries in § 14 publish one: OpenFGA at 80% and rustls at 95%.
`libs/acl` measures 98.16% of statements, and a reader comparing those three has
been invited to conclude something false, because `libs/acl` is a few thousand
lines of pure functions over frozen JSON with no network, no cryptography, no
unsafe code and no wire-format parser, and rustls is a TLS implementation. The
page states that comparison problem in a sentence where a badge cannot.

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
files, and § 8.5 is why its report lands somewhere else.
`@evanion/compose`, `@evanion/react-acl` and `@evanion/react-widget` produced no
summary in this checkout, for the reason § 4.4 gives.

The three packages at 100% have 86, 95 and 42 statements between the three
metrics that count them. `@evanion/acl` has 1,147 statements and 1,095 tests.
Averaging those into one figure produces a number that moves when a
42-statement package changes and barely moves when the package holding 45% of
the repository's tests does. Per package, or not at all.

## 8. The interactive part

### 8.1 The layout, which decision B decides

No count is laid out in its own section. Every count sits beside a case rendered
from a test that produced it, because a count alone reads as filler and a case
alone reads as cherry-picked.

So the page runs in four bands, and each band is a pair.

**The executed documentation, with its numbers.** 95 executed examples, 82 from
READMEs, 126 compiled twoslash fences, beside a rendered README region and the
page fence that renders from it. The reader sees the count and the thing counted
at once. § 1.1.

**The register, with its cases.** 36 entries, 20 and 8 and 8 by tier, beside all
thirty-six rendered cases in the rank § 3A.4 prints. The count above the case
list always breaks down by tier, in every filtered view, so no view reports a
total without saying how much of it is a non-defence.

**The suite, with its adversarial subset.** The per-package table from § 0.2,
sortable, each row expanding into its test files and their case counts with a
tag per kind from § 2, beside the 107 cases in `libs/acl/src/security` that one
of those rows contains. 1,095 is an abstraction; SEC-019's seeded generator is
what 1,095 is made of.

**The coverage, with the case that vouches for it.** The per-package table from
§ 7.3 with its per-file breakdown and uncovered lines, and directly beneath it
the two tier 1 cases whose assertions show the branches being taken. § 7.1 is
why this band exists at all and why it is last.

The component's job in every band is filtering and sorting what the build put
there. It fetches nothing.

§ 8A is the visual design of those bands, in the vocabulary the site already
has.

### 8.2 How the data reaches the page, and the constraint that decides it

**Everything renders into the HTML at build time, and the filter hides rather
than renders.** The agent working on the API reference component measured this
on a fixture page and the finding is recorded in
`docs/specs/2026-09-21-docs-api-reference.md` on branch `docs/api-reference-spec`.
Three parts of it decide this design:

- A `'use client'` component is not disqualified. The string
  `apps/docs/components/probes/urn-probe.tsx` computes appears in the Pagefind
  fragment for `/urn/components/`, so an interactive case explorer can be a
  client component and still be indexed.
- Pagefind indexes `hidden` and `display:none` content. A filter that hides
  non-matching cases keeps all thirty-six in the index.
- A filter that renders only matches after hydration deletes every non-matching
  case from the index while looking correct in a browser.

On a page whose whole purpose is trust, taking thirty-six security cases out of
search while appearing to work is the worst failure available. So the component
never renders on demand.

A second constraint points the same way and is worth recording here, because it
decides how the cases are written, where the first decides how they are
filtered.
`tools/doc-examples/src/md-siblings.mjs:22-26` states it: "The components a page
mounts stay as written." The `.md` sibling of every page is built from the MDX
source with its `file=…region=…` fences expanded, so a case written as a fence
reaches an agent reading the site with its code in it, and a case rendered by a
component reaches that agent as the component's name. That is the argument for
the cases being MDX fences that a component decorates, against a component that
holds the cases itself.

The existing runtime pattern is at
`apps/docs/components/probes/islands.tsx:25-30`, and the comment at `:22-23`
states the rule this section follows: the static export has to carry the value
before anything is fetched.

One measurement trap, from the same agent's work and from the G10 guard that
under-counted for a day: a measurement that reads a `file=` fence takes the info
string off the page as written and the body off the page as expanded.
`tools/repo-checks/src/doc-export-coverage.test.ts:302-311` documents it. The
data step in § 8.3 reads fences, so it inherits the rule.

### 8.3 The data step

The data itself is too large to ship raw. The vitest JSON for the eleven
libraries is 530 KB, `libs/acl` alone being 313 KB, because each report carries
every assertion's full name, ancestor titles, duration and status. The eight
`coverage-summary.json` files total 23 KB, `libs/acl` being 9,085 bytes of that.
So a script under `apps/docs/tools/` runs the sweep, reduces both into one
module holding per-project counts, per-file counts, the register joined to the
test names that matched each identifier, and the coverage summaries, and writes
it where the page imports it. That module is a build output and is not checked
in, which is decision 15.

### 8.4 What the page's prose has to satisfy

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

### 8.5 The defect found while measuring

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
§ 10.1 is that check.

## 8A. The visual design

The site has an identity and this page inherits it. `internal/baize-ui` is a
board-game shop's kit: six ground roles named `ink`, `felt`, `rule`, `chalk`,
`lichen` and `moss` (`src/tokens/ground.ts`), Bricolage Grotesque over Public
Sans (`src/tokens/type.ts:11-13`, which says "Not Inter"), and a dark ground
that the docs site renders on paper in light mode. `apps/docs/app/global.css:46-90`
states that relationship: "light mode is that design on paper rather than a
second design... a card is a different material on the page, not a brighter one."

A trust page in an invented palette would read as a foreign object on the site,
which is the opposite of what a page about this project's credibility can afford.
So every value below is a token that exists.

### 8A.1 The hero is a refused attack

**The page opens with one rendered case, above the fold, before any number.** A
large figure with a small label and a gradient accent is the default treatment
for a statistics page, and for this reader it is the wrong one: it is a claim,
and the reader came doubting claims. The most characteristic thing in this
subject is a real attack meeting a real refusal, so that is the first thing on
the page.

The hero is three parts and nothing else:

- One sentence of frame. Code as the literal first element is noise to a reader
  who does not yet know what they are looking at, which is the one place I would
  amend the direction I was given. The sentence is short and it makes no claim:
  it says what the block below is and where it comes from.
- The case: SEC-001's `it(...)` block, rendered from
  `libs/acl/src/security/tier1-prevented.test.ts` by a `file=…region=…` fence, so
  the hostile write and `expect(decision.allowed).toBe(false)` are both visible
  without scrolling.
- The provenance line, in `Text` at `size="sm"` in the secondary role: the file
  path, the identifier, and the command that runs it. `Figure` is not used here;
  a path is not a number.

No `StatLine` above the fold. The counts start in the second band, which is
where decision B's pairing puts them anyway.

### 8A.2 Where the limits go, specified both ways

The owner has not ruled on whether § 12 moves above the evidence. Both are
specified and the recommendation is a third arrangement.

**High.** § 12 renders in full as the second band, under the hero. A sceptic
scans for the catch, and finding it before the evidence makes everything after
it credible. The cost is that § 12's items are unreadable before the reader
knows what a tier is: "the guards check shape, not correctness" means nothing to
somebody who has not met a guard, and "coverage counts lines executed" arrives
before any coverage figure. A wall of caveats in front of an unprimed reader
reads as throat-clearing, and the page spends its best position on it.

**In place.** § 12 renders after the register band and before coverage. Every
item lands because its subject has been met. The cost is the one the direction
names: a reader who stops early has read only the flattering half, and a reader
scanning for the catch does not find it.

**Split, which is what I recommend.** A short limits block in the hero band,
three sentences in `Panel`, directly under the case: a test suite covers the
cases somebody thought of; nothing here is an audit; the coverage figures count
lines. Each links down to its full treatment in § 12, which stays in place. The
sceptic scanning for the catch finds it in the first screen, in language that
needs no priming, and the full section lands where its items are legible.

This is a real disagreement with the direction, and it is not a hedge. Moving
§ 12 whole is worse than either leaving it or splitting it, because its value is
in the specifics and the specifics are the part that needs context. If the owner
prefers the straight move, take "High" as written; it is the second-best of the
three and not a bad page.

### 8A.3 The vocabulary, and what it costs to use it

**`Stat`, `StatLine` and `Figure` are the counts.** Already built
(`internal/baize-ui/src/components/stat-line.tsx:28-34`, `:66-76`,
`typography.tsx:151`). `Figure` sets tabular figures, which is what keeps a
column of percentages aligned, and its docblock gives the reason a component
exists for it: `font-variant-numeric` set in one app and forgotten in another is
the drift the library is for. `StatLine` takes `size="lg"` when it leads a band.

The props are already-formatted strings, so the data step formats: `figure="1,759"`,
`label="test cases in eleven libraries"`. No `Intl` reaches the library.

**`AvailabilityPill` is the tier, and the mapping is honest.** The shop's stock
vocabulary maps onto the register's three tiers without stretching:

| Tier | Meaning                          | Pill state   | Why it fits                                          |
| ---- | -------------------------------- | ------------ | ---------------------------------------------------- |
| 1    | the library prevents             | `inStock`    | the thing is there and works                         |
| 2    | the primitive exists             | `preorder`   | it is available and the consumer has to do something |
| 3    | structurally in scope for nobody | `outOfPrint` | it is not available, and saying so is the point      |

`reprintPending` stays unused. Four states and three tiers, and pressing the
fourth into service would invent a degree the register does not have.

The pill's label is the whole accessible name, which
`tags.tsx:83-86` states: the dot is decoration drawn by the stylesheet, "and a
reader who cannot see the colour loses nothing". So the labels are the register's
own words: `prevented`, `primitive supplied`, `out of scope`.

**The cost of using it, which is real and checkable.** The four availability
colours are held to 4.5:1 against `ground.felt`, and
`internal/baize-ui/src/tokens/tokens.test.ts:206-215` asserts it against that
literal dark value. The docs site rebinds `felt` in light mode
(`apps/docs/app/global.css:66`, `--docs-raised` as a mix of `chalk` and `rule`),
so the checked ratio is the dark theme's and nothing has checked the light one.

`categorical` and `platform` both carry `on-light` variants
(`internal/baize-ui/src/tokens/custom-properties.ts:62`, `:64`) and `availability`
carries none. The docs site already handles the same problem for two of them, at
`apps/docs/app/global.css:248` and `:256`, with one rule swapping in the
light-ground value. So there are two ways to pay this and both are small: add
`availabilityOnLight` to the token module with the same contrast assertion
against the light ground, or follow the `.docs-identity` precedent with a
docs-side rule. The first is better, because a second app using the pill on
paper inherits it.

**Nothing else in the kit is reached for.** `Chip` takes a `mechanism` or a
`platform` and paints a hue from the shop's categorical systems, which name
nothing here. CWE and OWASP identifiers render as plain `Text` in the secondary
role, monospaced where the surrounding type is not.

### 8A.4 `ComplexityRamp` is refused, and the kit already says why

A ramp is ordinal. `stat-line.tsx:105-113` states its own argument: per-pip
colour "because the ramp is sequential, and a bar that lightens left to right
reads as a scale where a uniform bar reads as a count".

Tier is not a scale. Tier 3 is not more of anything than tier 1; it is a
different kind of statement about what a passing test may claim, which is the
whole of § 6.2. A ramp would render the eight entries the library does not
defend as the far end of a difficulty axis, which is the single most misleading
thing available on this page.

`Title`'s docblock is the same test applied elsewhere and worth following:
"There is no mechanism prop: a game's title must not be coloured by its
category." Before any kit component is used here, the question is whether the
thing it encodes is the thing being shown. Pills, because tier is nominal.

### 8A.5 The case explorer

All thirty-six cases render at build time and the filter hides, which § 8.2
establishes and which is a correctness requirement before it is a design one.

**Controls.** Three tier toggles, an identifier filter, and a text field over
the class and mechanism wording. The tier toggles are `Button` at
`variant="quiet"` with `aria-pressed`, so a pressed state is a state and not a
colour. The kit has no filter control and the boundary table in
`internal/baize-ui/README.md` puts it out on purpose ("filter sidebar... one
app's page layout"), so the control is the docs app's own `'use client'` file
styled with kit classes, which is the pattern that README's "Stateful
primitives" section prescribes.

**Count, always broken down.** The line above the list reads as three `Stat`
cells, one per tier, in every filtered view. A filtered total with no tier
breakdown is the rounding § 6.3 refuses, moved into the interface.

**The empty state is an instruction.** No filter combination should produce it,
because every register entry carries a tier and the text filter is the only way
to reach zero. When it happens the panel says what to do: name the identifier
directly, or clear the text and pick a tier. It does not apologise and it does
not say "no results found".

**Case openings are the only motion on the page.** A case expands with a height
and opacity transition of 150ms on the kit's own easing. Everything else is
static: no per-card hover transition, no scroll-triggered reveal, no gradient
wash. Under `prefers-reduced-motion: reduce` the transition is removed and the
case appears; the disclosure still works, because the motion was never carrying
the meaning.

### 8A.6 Keyboard, focus and no JavaScript

**Every control is a real control.** The tier toggles are `<button>`, the text
filter is `<input type="search">` with a visible `<label>`, and each case's
disclosure is a `<button>` with `aria-expanded` and `aria-controls`. Nothing is
a `<div>` with a click handler, so tab order, Enter and Space are the platform's.

**Focus is visible and is not the hover state.** The kit's focus ring is what
appears, on `--baize-rule` against whichever ground is active. A filter that
hides a case must move focus off it: hiding the element the reader is standing
on drops focus to the body and loses their place, so the component moves focus
to the count line when the active case is filtered out.

**Filtering is announced.** The count line is `aria-live="polite"`, so a reader
using a screen reader hears "12 cases, 4 prevented, 4 primitive supplied, 4 out
of scope". Silence is what they get without it.

**With no JavaScript the reader gets every case and no filter.** The cases are
MDX fences rendered at build time, so they are all present and all open. The
control strip is rendered by the client component and simply is not there. That
is the correct degradation for this page: a sceptic with scripts off sees more
than a sceptic with scripts on, and nothing is broken.

### 8A.7 What the page does not do

No all-caps eyebrow label above a heading. The one uppercase on the page is
inside `AvailabilityPill`, which the kit sets at
`internal/baize-ui/src/styles.css:497-511` with `tracking.loose`, and that is a
pill's own typography, and no decorative label appears on the page.

No `01 / 02 / 03` numbering. The four bands are not a sequence and the thirty-six
cases are ranked, not stepped. The rank's four groups carry their names.

No arrow glyph appended to link text. No per-card hover transition. No gradient
used as decoration anywhere, in a design whose ground is six flat values.

No `PageSheet`. Every `/acl/` page carries one (`apps/docs/components/PageSheet.tsx`)
with a difficulty rung, a reading time and a requires/unlocks pair. This page
teaches nothing and unlocks nothing, and a difficulty rung on a trust page is a
claim about the reader.

### 8A.8 Where the design is uncertain

Three things I would want rendered before committing, and one measurement.

**The measurement, which is a blocker.** The four availability colours against
the docs site's light ground. `tokens.test.ts:206-215` checks them against dark
`felt` only, § 8A.3 explains why that is not the ground here, and if any of the
three used states falls under 4.5:1 on paper then `availabilityOnLight` is not
an improvement, it is a prerequisite.

**The hero, at 400px.** A rendered `it(...)` block is between eight and fifteen
lines with real indentation, and a code fence is the one element the site lets
scroll horizontally. Whether SEC-001's block is legible above the fold on a
phone decides whether the hero is that case or a shorter one, and the rank in
§ 3A.4 would need a clause if the answer is that the hero case is chosen by
length. I would not add that clause before seeing it.

**Thirty-six cases in one column.** The page is long and I have not seen how
long. If it is unreasonable, the answer is collapsing all but the first case per
rank group by default, which costs nothing in the index because Pagefind reads
hidden content (§ 8.2). I would rather decide that against a render than guess
at it now.

**The tier pills beside a code fence.** A pill is a shop's stock badge and a
fence is a wall of monospace. Whether three coloured pills above thirty-six code
blocks reads as a system or as decoration is a judgement I cannot make from the
token values, and it is the one place the borrowed vocabulary might not survive
contact with this content.

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

Two, both in `tools/repo-checks/src`. Each reads files and neither runs a build.
The third one this document originally proposed, holding the register against
its suite, is PR #259 and is not specified here.

### 10.1 Every library configures coverage the same way

Reads each library's resolved vitest configuration and asserts a `coverage`
block with `reportsDirectory: './test-output/vitest/coverage'`. One package
fails it today (§ 8.5), and decision 16 is the fix. This one is cheap and it
protects the data step in § 8.3, which globs those directories.

### 10.2 The kinds list is derived, and its exceptions are declared

§ 2 derives five of the eleven kinds from the libraries' configs and names the
rest in a short list in the data script, each entry saying whether it carries a
count. That list is the thing that goes stale. The check reads it, asserts each
entry names a file that exists, and asserts that no matched library's vitest
config carries an include pattern the derivation does not recognise. A kind
wired into a library's config appears on the page; a kind wired elsewhere fails
this check until somebody declares it.

## 11. Whether the page states the AI involvement

This is the owner's decision and this document does not make it. Both options
are worked through here so it can be made on what each costs, and the
recommendation is at the end.

Nothing else in this specification changes either way. The cases, the counts,
the rank, the guards and the coverage figures are the same page under both
options, which is the reason the question can be left open this long.

### 11.1 Stating it

The page says the project is developed with heavy AI assistance, and then says
what the controls are and what they cannot catch.

**What it costs.** Some readers stop there. A statement like that is a filter,
and the page cannot know how many people it turns away who would otherwise have
evaluated the library on its evidence.

**What it buys.** Two things a page cannot get any other way. First, every
control on the page acquires a reason: a reader who does not know why a project
executes all 95 of its documented examples reads that as thoroughness, and a
reader who does reads it as a specific answer to a specific risk. The controls
are more persuasive with the risk named than without it. Second, it forecloses
the discovery. A reader who learns the library is AI-built after reading a trust
page that did not mention it revises their opinion of everything on that page,
including the parts that were true. The page's own material is what that reader
stops believing.

### 11.2 Not stating it

The page presents the evidence and lets it stand on its own.

**What it costs.** The discovery risk above, which is the whole of it and is
severe. It is also the one cost that grows over time, because the project's
provenance becomes more discoverable every year.

**What it buys.** The page is shorter and reaches every reader who would have
stopped at the disclosure. It is also the option that requires no judgement
about how to phrase something the industry has no settled vocabulary for.

### 11.3 The recommendation, and the honest framing if it is taken

**State it.** The discovery failure is worse than the filter, and the controls
mean something once the reason for them is stated.

If stated, the framing is what the controls are and what they cannot catch, and
the second half is what makes the first half credible:

- What the controls are: every documented example executes, every twoslash
  fence compiles, 33 repository guards hold the claims about the repository, the
  security register is checked against its suite, and the page's own numbers are
  produced by the deploy that produced the page.
- What they cannot catch: § 12, in full and linked from the statement.

One sentence that must not appear: any claim about how much of the code a human
reviewed. It is unmeasurable, unverifiable by a reader, and it is the sentence a
sceptic is most likely to test.

## 12. What this page cannot prove

Not at the bottom of the page, and not a disclaimer. A reader who has just been
shown thirty-six security cases is exactly the reader who should be told what
they do not establish, and this is the section that makes the rest credible.

**A test suite covers the cases somebody thought of.** Every one of the 36
register entries is a class somebody named. The 37th is not in the register, is
not in the suite, and nothing on this page would look any different if it
existed. SEC-019's seeded generator is the narrowest exception and the page
should not overstate it: it generates writes nobody enumerated, within a shape
somebody chose, against a property somebody stated. A generator does not find
the class its author did not think of either.

**The guards check shape, not correctness.** `doc-export-coverage.test.ts`
refuses a published export with no example. It has no opinion about whether the
example is any good, whether the prose around it is true, or whether the export
should exist. `doc-twoslash.test.ts` proves a fence compiles, which is a
different claim from the fence being the right way to use the API. Every guard
on this page is a guard against a documented thing being absent or stale, and
none is a guard against it being wrong.

**The guards carry a recorded backlog, and the page prints it.** 115 exports
documented nowhere and 29 with no example exercising them, across nine packages,
in `doc-export-coverage-allowance.json`; 242 fences that are not region
references in `doc-fence-allowance.json`. Both allowances default an unlisted
entry to zero (`doc-export-coverage.test.ts:441` and `:461`,
`doc-fence.test.ts:205`), so the backlog cannot grow, and it has not been paid
down.

**Coverage counts lines executed.** § 7.1, repeated here because this is the
section a sceptic reads.

**The register describes one library, at one layer.** Tier 3 is eight entries
long and `apps/docs/content/acl/security.mdx:5` is what it means: in a browser
the control disappears and the request it would have sent does not. A reader who
takes this page as evidence that an application using `@evanion/acl` is secure
has drawn a conclusion the page's own tier 3 refutes.

**Nothing here is an audit.** No third party has reviewed this code. § 14 records
that libsodium links a sponsored external audit and rustls publishes an audit
report in-repo, and this project has neither. The page says so in those words,
because a reader comparing this page against those projects should be able to
see the difference from this page.

**The numbers describe the commit the page was built from.** § 5.

## 13. What should not be built

**A coverage badge in any README.** § 7.1.

**A trend line.** Coverage over time needs a stored series, which needs either
the committed file § 4.2 refuses or a database the static site cannot read. A
percentage that moved from 98.1 to 98.2 is noise, and drawing it invites a
reader to treat it as signal.

**A threshold that fails the build.** A coverage minimum makes the number the
target, and the first thing it buys is a test written to execute a line. The
register's counts are the thing worth gating, and PR #259 gates them.

**A per-package coverage figure on the package's own pages.** Decision 10. A
reader on `/luhn` seeing 100% has learned that `@evanion/luhn` is 86 statements.

**An OWASP category page, an OWASP count, or an ASVS level claim.** § 6.3 and
§ 6.4.

**Publishing the raw vitest JSON.** 784 KB of assertion names, durations and
file paths, describing the build machine, for no reader.

## 14. The landscape, read for this document

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

- The per-project counts in § 0.2 and § 0.3, from one `npx vitest run --config
<config> --reporter=json` per project config, summed from the JSON reports:
  2,443 cases over 168 files across 18 configs, of which the eleven libraries
  hold 1,759 over 84 and the seven other collected projects hold 684 over 84.
- That `apps/admin/vite.config.mts` fails to load here, with
  `Cannot find package '@react-router/dev'`, and that the same failure breaks
  the Nx project graph, which is why `npx nx test @evanion/acl` also failed.
  Every figure here therefore comes from the per-project `vitest` form, and the
  page prints the `nx` form a clean install runs. § 5 records the substitution.
- 44.7 s of wall clock for the sequential sweep of all 19 configs, warm, and
  19.3 s for the coverage sweep over the eleven libraries.
- The 95 executed documentation examples in § 1.1, by walking the same JSON
  reports for result files that are not `*.test.ts`, `*.spec.ts` or
  `*.test-d.ts`: 11 source files, 95 cases, 82 of them from a `README.md` and 36
  from `libs/acl/README.md`. This is a floor. `libs/compose`, `libs/react-acl`
  and `libs/react-widget` failed to resolve their `examples/` imports in this
  checkout, so their documented examples collected nothing and are not in the 95.
- The allowance figures in § 1.3 and § 12, by summing the arrays in
  `doc-export-coverage-allowance.json` (115 undocumented, 29 unexercised, 9
  packages) and `doc-fence-allowance.json` (242 across 9 sections).
- The loud and silent split in § 3A.4, by reading the Mechanism column of every
  tier 1 row in `libs/acl/SECURITY.md` and matching "construction error", "at
  construction" and "throws": SEC-009, SEC-011, SEC-018 and SEC-020 match, and
  SEC-011 and SEC-018 also name a decision-time defence in the same cell.
- That exactly one register entry draws from the seeded generator:
  `tier1-prevented.test.ts:36` imports `Gen` and `rng`, and `:1117` is the only
  construction, inside SEC-019's `describe`.
- That a `.test.ts` file qualifies as a region source
  (`tools/doc-examples/src/regions.mjs:46`, `SOURCE_FILE = /\.(?:tsx?|astro)$/`),
  and that the pattern is already in use: `apps/docs/content/acl/react-router.mdx:222`,
  `:229` and `:238` render three regions of `apps/admin/tests/access.spec.tsx`,
  the second of them marked at `access.spec.tsx:264-278` around a complete
  `it(...)` block with both its `expect` calls inside the region.
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
- Report sizes: 784 KB of vitest JSON over 18 projects and 530 KB over the
  eleven libraries, `libs/acl` 313,168 bytes of it; 23,268 bytes of
  `coverage-summary.json` over seven packages, `libs/acl` 9,085 bytes of it.
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
- `nx.json:146-151` and
  `tools/repo-checks/src/docs-navigation.test.ts:88-109`, which § 0.1's scope
  expression rests on. No data step was written, so nothing here resolved the
  project graph through that path.
- `tools/doc-examples/src/regions.mjs:1-47` and
  `tools/doc-examples/src/md-siblings.mjs:1-26`. The second carries § 8.2's
  second constraint, that a component a page mounts stays as written in the
  `.md` sibling, and no sibling was generated here to confirm it.
- `tools/doc-examples/src/vite-plugin.ts:13-25`, for § 3A.3's claim that
  `expectComments` transforms any `.ts` the pipeline touches. Read, not
  exercised against a tier file.
- PR #259's description and its single added file,
  `tools/repo-checks/src/security-register.test.ts`, 208 lines. That branch was
  not checked out here and its check was not run.
- `internal/baize-ui/src/tokens/ground.ts`, `type.ts:1-45` and `availability.ts`
  in full, `src/components/stat-line.tsx`, `tags.tsx` and `typography.tsx`, and
  `internal/baize-ui/README.md`, for § 8A's vocabulary. Nothing was rendered.
- `apps/docs/app/global.css:1-95`, `:248` and `:256`, and
  `apps/docs/app/baize-theme.ts:1-18`, for how the docs site binds the kit and
  how it already swaps a hue for the light ground.
- `internal/baize-ui/src/styles.css:497-521`, the `.baize-pill` rule, for its
  uppercase, its dot and the `color-mix` its label colour comes from.
- `apps/docs/components/PageSheet.tsx:1-30`, for what decision § 8A.7 declines.

### Quoted from a source outside this repository

Each fetched on 2026-09-21, with the page named in § 14: Cedar's security page
and the Amazon Science article, OpenFGA's GitHub security policy and its Codecov
badge endpoint, libsodium's documentation introduction, rustls' `SECURITY.md`
and its manual page on vulnerability classes, Tink's `SECURITY-USABILITY.md`,
the `OWASP/Top10` 2025 introduction, and the `OWASP/ASVS` 5.0 chapters
`0x03-What-is-the-ASVS.md` and `0x04-Assessment_and_Certification.md`.
Everything else about a project in § 14 is a summary in this document's own
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
- That pairing a count with a case changes what the count is worth to a reader.
  This is the page's organising principle and it comes from the owner's
  judgement about his own audience. Nobody has been shown either version.
- That the rank in § 3A.4 produces an order a sceptic accepts. Its criteria are
  read off the register's own columns and are checkable, and no reader has been
  asked whether leading with eight non-defences reads as honesty or as a
  library admitting it does not work.
- That one representative `it(...)` per register entry is enough to carry a
  case. 107 cases sit behind 36 entries, so the rendered case is between a
  quarter and a third of what each entry actually runs, and which third a reader
  needs was not tested.
- That marking 36 regions in the tier files stays a comment-only diff. It is
  true of the pattern and I did not mark any of them, so nothing here confirms
  that every chosen `it(...)` block is self-contained enough to render without
  the fixture setup around it.
- Every visual claim in § 8A. Nothing was rendered, screenshotted or measured in
  a browser. The token values, the class rules and the component signatures were
  read; how three tier pills sit above thirty-six code fences was not seen, and
  § 8A.8 lists the four things I would want rendered before committing.
- That the availability colours clear 4.5:1 on the docs site's light ground.
  `tokens.test.ts:206-215` checks the dark ground only and I ran no contrast
  calculation against the light one. Decision N treats this as a blocker on that
  basis and not on a measurement.
- Every claim about another project in § 14 is what that project's own
  documentation or repository said on the date recorded. Nothing was deployed
  and no behaviour was observed.

## Where I am guessing

- That a sceptical reader reads far enough to reach § 12. Everything about the
  page's credibility rests on what it admits, and the admissions are below the
  evidence. A reader who stops after the first band has read the flattering
  half. I did not work out whether § 12 should be higher, and it is the design's
  most fragile assumption.
- That the disclosure question in § 11 is separable from the rest. I claim
  nothing else changes either way, which is what lets it stay open. If stating
  the AI involvement means the page needs a different opening paragraph and a
  different order, that claim is wrong and § 11 is not a section but a rewrite.
  § 8A.1's hero is where the two would collide: a disclosure sentence and the
  frame sentence are both the first thing on the page, and only one can be.
- That the shop's stock vocabulary survives being borrowed for security tiers.
  `inStock`, `preorder` and `outOfPrint` map cleanly onto the register's three
  claims and the pill's label carries the whole meaning, so the argument is
  sound on paper. Whether a reader who has never seen the shop reads a green
  pill beside a refused attack as "prevented" or as leftover e-commerce is the
  judgement § 8A.8 wants a render for.
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
