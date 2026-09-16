# The documentation standard

Status: proposed
Depends on: `2026-09-13-interactive-examples.md` (the probe, the three kinds of
example, and the per-package verdict this standard promotes from a one-off
judgement into a rule), `tools/doc-examples` (the region loader and the
`// -> value` rewriter, shipped), `tools/repo-checks/src/docs-navigation.test.ts`
and `src/doc-regions.test.ts` (the two guards this extends),
`2026-09-13-versioned-docs.md` (the archive the page-presence guard must not
fight)
Measured against: `origin/feat/acl` at 63 pages, which is where the docs content
lives. `main` carries `tools/` and the packages.
Prior art, read for this document and marked VERIFIED or INFERRED in sections 2
and 2a: diataxis.fr (foundations, compass, map, the four type pages, quality,
how-to-use, and the deleted complex-hierarchies page), plus Procida's own
concessions on Hacker News; the published criticism, chiefly Hillel Wayne and
the pigweed.dev rollback; Stripe's rendered API reference and quickstart markup
and its engineering posts on Markdoc and on generating everything from OpenAPI;
react.dev's launch post, contributing guide and Learn/Reference page anatomy;
the Rust book's publishing chapter, the rustdoc documentation-tests reference
and the Rust API Guidelines; Tailwind's utility pages; Astro's contributor
writing-style and code-sample guides; Svelte's tutorial.

## What is actually wrong

The complaint is that sections differ in size: `acl` has 22 pages and `compose`
has 3. Counted, size is not the defect.

Measured on `origin/feat/acl` on 2026-09-16, across 63 `.mdx` pages:

| Section                 | Pages | Words  | Fences | Executed | Interactive |
| ----------------------- | ----- | ------ | ------ | -------- | ----------- |
| `acl`                   | 22    | 21,847 | 119    | 47       | 0           |
| `feature`               | 7     | 5,183  | 58     | 0        | 0           |
| `react-widget`          | 6     | 5,806  | 38     | 0        | 1           |
| `luhn`                  | 6     | 3,607  | 32     | 1        | 1           |
| `urn`                   | 5     | 4,649  | 63     | 9        | 1           |
| `token`                 | 5     | 3,249  | 23     | 1        | 1           |
| `astro-widget`          | 4     | 2,600  | 27     | 0        | 0           |
| `nestjs-correlation-id` | 4     | 2,348  | 24     | 0        | 0           |
| `compose`               | 3     | 2,038  | 21     | 0        | 0           |

405 code fences on the site. 58 of them execute — 14%. Four pages of 63 carry
anything a reader can touch: `luhn/usage`, `token/usage`, `urn/components` and
`react-widget/playground`. The other 59 are text.

So the defect is uniform and it is not distribution. `acl` is the only section
that executes a meaningful fraction of its code and it still ships no
interactive control; `compose`, `feature`, `astro-widget`,
`nestjs-correlation-id` and `react-widget` execute nothing at all. A standard
aimed at page counts would fix none of this. This one is aimed at the 347
unexecuted fences and the 59 inert pages.

The second defect is navigation, and it is worse than it looks. Six of nine
sections have no `_meta.ts`, so Nextra orders them by filename: `luhn` opens on
`api`, then `dictionaries`, then `index`, then `migration`. `acl/_meta.ts`
carries a paragraph explaining where `integrations/` belongs and does not list
it, so the five platform guides are appended below the Reference band.
`urn/_meta.ts` does not list `components`, which is the page carrying the URN
probe. Every one of these is machine-detectable and nothing detects it.

## Decisions

1. Diátaxis is adopted as a test applied to a page, and rejected as a directory
   layout. Section 2.
2. Every section has four page types and may have four more kinds of page,
   from a closed vocabulary. Nothing else is a page. Section 3.
3. A section's ceiling is four bands and `acl` at 22 pages is at it. The ceiling
   is named as the maximum legal shape, not as a target, and page count is not
   the defect this document was called to fix. Section 3.
4. A code fence executes unless it falls in one of five named exemptions, and
   the exemption is written on the fence rather than left to inference.
   Section 4.
5. `file=… region=…` is the only way a TypeScript example reaches a page. A
   hand-written `ts` fence in `content/` is a defect, including in an API
   reference. Section 4.
6. Every section ships at least one control a reader can operate, on a page
   named in section 5, and the choice between a probe, live code and a specimen
   is made by what the reader's question is — not by what is easiest to build.
   A demo leads with the consequence and shows the code second; its editable
   surface takes the gesture that suits it; its source stays short enough to
   read without scrolling; and it renders the package's own return shape only
   where that shape is the thing the reader came for. Otherwise it is a
   diagnostic and belongs on a reference page. Section 4, last subsection.
7. The region loader learns `// #region` markers in `.ts`/`.tsx` sources, so a
   type-level claim asserted in a `*.test-d.ts` file can be rendered as the
   example. This is what makes `compose` documentable under decision 4.
   Section 8.
8. Separators, never folders, at every level. `acl/integrations/` is the one
   folder on the site and it is wrong; it becomes five pages under a
   `Platforms` separator. Section 6.
9. Nothing runnable exists only on the front page. Every landing specimen has a
   counterpart inside the section it advertises, and `AccessDemo` moves into
   MDX. Section 7.
10. Every section directory has a `_meta.ts` naming every page in it, in
    reading order. Section 6.
11. An API reference page has one heading per exported symbol, spelled as the
    symbol. Task-shaped headings belong on question pages. Section 3.
12. Eight guards in `tools/repo-checks` (section 10). Six of them fail today;
    the other two have not been run.
13. Prose budget: 1,200 words a page. Over that the page is two questions.
    Section 3.
14. Nothing here is retrofitted in one pass. The order is section 11.
15. An API reference's signature blocks are generated from the package's emitted
    declarations, not written. Until that generator exists they carry a
    `signature` tag and a guard holds every identifier in them to the package's
    exports. Section 2a, section 4.

Decision 5 is the expensive one and the one this document exists to argue.
Decision 3 is the one most likely to be disputed, because it declines to call
22 pages a defect. Decision 7 is the only one that needs code outside
`apps/docs`.

## 1. What runnable means here, and the four mechanisms

The requirement is the owner's, quoted because the rest of this is downstream of
it:

> we should make sure that our docs have plenty of runnable code demos, like the
> widget one on the frontpage, in order to cater to Kinesthetic learners

"Runnable" is four different things in this repo and they are not
interchangeable. What follows is what each one actually guarantees, which is the
only basis on which a page can be told which to use.

**A doctested region.** A fenced block in a package README between
`<!-- #region name -->` markers, executed by Vitest through
`docExamples()`, pulled into a page by an empty fence naming it:

````mdx
```ts file=libs/urn/README.md region=equality

```
````

which the `@evanion/doc-examples/mdx-region-loader` Turbopack rule fills at
build time.
`tools/doc-examples/src/expect-comments.ts` rewrites `EXPR; // -> VALUE` into
`expect(EXPR).toEqual(VALUE)` in memory, so the README ships the readable form
and CI checks the claim.

What it guarantees: the code compiled and ran, and every value printed beside it
is the value it produced. What it does not give the reader: anything to do. It
is inert on the page.

Wired today in `libs/luhn`, `libs/token`, `libs/urn` and `libs/acl`. Not wired
in `libs/compose`, `libs/feature`, `libs/react-widget`, `libs/widget`,
`libs/astro-widget`, `nest/correlation-id`.

**A probe.** `apps/docs/components/Probe.tsx` plus one module per package under
`components/probes/`. The code is the region's code, one argument is an
`<input>`, and the package's own export runs on every keystroke. Nothing is
transpiled and nothing is evaluated. It renders its documented value on the
server, so the static export is correct before hydration, and
`probes/claims.ts` seeds it from the same region the page quotes.

What it guarantees: everything the region guarantees, plus the reader can change
the input. What it cannot do: let the reader change the call.

Exists for `luhn`, `token`, `urn`. Three pages.

**Live code.** `WidgetPlayground` / `PlaygroundExamples`, react-live in
`noInline` mode against a fixed scope. The reader writes arbitrary JSX and it is
transpiled by sucrase and run with `new Function`.

What it guarantees: much less. Nothing typechecks the snippet strings;
`playground-examples.test.tsx` evaluates each shipped snippet and asserts on the
DOM, which is a test of the snippet rather than of the README. It costs 78 kB
gzipped and it is the one mechanism that runs reader-supplied code in the site's
origin.

Exists for `react-widget`. One page.

**A landing specimen.** `components/landing/` — `DataDemo`, `AccessDemo`,
`LuhnSpecimen`, `TokenSpecimen`, `UrnSpecimen`. Each calls the real package and
`specimens.test.tsx` holds the card to the value the package returns. These are
the best interactions on the site and none of them are reachable from a package
section, because `mdx-components.js` does not map them.

**A static fence.** No execution, no guarantee, and no warning to the reader
that there is none. 347 of the site's 405 fences.

The ladder is: a static fence guarantees nothing, a region guarantees the values,
a probe guarantees the values and hands the reader the input, live code hands
the reader the whole snippet and guarantees the least. The standard's job is to
push every fence up at least one rung and to say which rung each page type
lands on.

## 2. Diátaxis, honestly

### The axes, as the framework actually states them

VERIFIED at `diataxis.fr/foundations/` and `/compass/`. The axes are properties
of a craft, not of documents: **action and cognition** — "knowing _how_, what we
do" against "knowing _that_, what we think" — and **acquisition and
application**, being at study against being at work. The compass crosses them:
informs action + acquisition = tutorial; informs action + application = how-to;
informs cognition + application = reference; informs cognition + acquisition =
explanation.

The framework claims the map is exhaustive: "There are only two dimensions, and
they don't just cover the entire territory, they define it. This is why there
are necessarily four quarters to it, and there could not be three, or five."

### What it says about mixing types, and what it does not

VERIFIED, and this is the premise this document was handed that turns out to be
wrong: **Diátaxis states no one-type-per-page rule.** Its unit is content, mode
and material — not page, not file. Searching the site for statements about pages
turns up only "nothing bigger than a page" as a unit of _work_.

What it does say, VERIFIED: the kinds "bleed into each other" when the
distinctions blur, worst case "a complete or partial collapse of tutorials and
how-to guides into each other" (`/map/`); on reference, "It can be tempting to
introduce instruction and explanation… Instead, link to how-to guides,
explanation and introductory tutorials" (`/reference/`); on how-to guides,
"Anything else that's added distracts both you and the user and dilutes the
useful power of the guide" (`/how-to-guides/`); and on tutorials, that a
sentence of inline explanation is fine but the rest belongs behind a link
(`/tutorials/`).

INFERRED: the prescription is _link out, don't inline_, and Diátaxis is silent
on whether the target of that link is a heading on the same page or a separate
page. That silence is where the framework hands its adopters the problem.

### The structure advice is the opposite of the convention

VERIFIED, `/how-to-use-diataxis/`, and it is blunt:

> Getting started with Diátaxis does not require you to think about dividing up
> your documentation into four sections. It certainly does not mean that you
> should create empty structures for tutorials/howto guides/reference/explanation
> with nothing in them. **Don't do that. It's horrible.**

> At a certain point, the changes you have made will appear to demand that you
> move material under a certain Diátaxis heading — and that is how your top-level
> structure will form. In other words, Diátaxis changes the structure of your
> documentation from the inside.

> Although structure is key to documentation, using Diátaxis means not spending
> energy trying to get its structure correct.

The one place it does prescribe a tree is reference: "the structure of the
documentation should mirror the structure of the product" (`/reference/`,
`/start-here/`). That is decision 11 — an API reference page whose headings are
the exported symbols — and it arrives from the framework rather than from taste.

### Where the authors concede limits

VERIFIED. `/quality/` has a section headed "Understanding the limits":
"Diátaxis cannot address functional quality in documentation", "Diátaxis offers
a set of principles — it doesn't offer a formula", "Using Diátaxis does not
guarantee deep quality". `/compass/` says to use its terms flexibly and not to
fixate on the names. `/explanation/` concedes that explanation alone has no
defined boundary: "It's not always easy to write good explanatory material.
Where does one start? It's also not clear where to conclude."

Procida has conceded more in public than the site says. On Hacker News
(36613213) the four "are modes of documentation. They are not an exhaustive
list of every kind of content… Diátaxis is not a list of four boxes into which
all content should be mercilessly shoved whether it fits or not." And in August
2026 (49139331) he deleted his own page on complex hierarchies: "Ugh, I don't
like that page and I have actually deleted it… There is a real problem there,
and that page doesn't do a good enough job of dealing with it."
`diataxis.fr/complex-hierarchies/` now 404s, VERIFIED. So the framework
currently offers no guidance at all on hierarchies past one level, which is
exactly the question a 22-page section asks.

### The criticism, and the part of it that applies here

The fragmentation failure is documented as a rollback rather than as an essay.
Kayce Basques, who ran `pigweed.dev`'s docs, VERIFIED on HN 42341033:

> We tried adopting Diataxis on pigweed.dev as a literal blueprint and it
> resulted in too much fragmentation. E.g. the explanations for a Pigweed module
> were on one page, but the tutorial was on another. Users and teammates found it
> annoying to have to jump back-and-forth so much. … If you only link to
> explanations from the tutorial, some (most?) users won't click those links, and
> therefore may never get exposed to the theoretical foundations.

The API-docs version of it, VERIFIED on HN 49141184: "Please do not make me
click on 'reference' to get to 'API docs'. … it tends to turn 1-click docs into
2-click docs", and 49143640: "Some projects, when they move to diataxis, will
create a top level section called 'reference' and have a single item under it
called 'API'." That is decision 8's argument arriving from outside this repo.

Hillel Wayne's essay (hillelwayne.com, 2023-07-05) is the substantive written
critique: the model is designed for tools rather than for frameworks or
languages, and it has no home for a conceptual overview — the "what is this for"
a reader wants _before_ any tutorial — or for worked snippets that show how
something is done rather than how to do a thing. Peter Williams (newton.cx,
2023-11-02) adds that it has no theory of finding aids or indices.

Two premises handed to this document are false and are corrected here: Tom
Johnson is not a Diátaxis critic — his 2023 piece is favourable and its
reservations are withdrawn in it — and Fabrizio Ferri-Benedetti has published no
critique; his Seven-Action model explicitly calls itself compatible with
Diátaxis.

### The verdict for this repo

The known failure mode is real and this repo would hit it. A small package has
one tutorial's worth of material, one how-to's worth, a short reference and
almost no explanation. Split four ways, that is four thin pages where one good
page belonged, and a reader who has to visit three of them to do one thing. This
is what `compose` at 3 pages would become: `compose/tutorial`,
`compose/how-to`, `compose/reference`, `compose/explanation`, each 500 words.
Worse than the 3 pages it has.

Hillel Wayne's missing conceptual overview is this site's `index.mdx`, which
every section already has and which the compass has no quarter for. That is one
ninth of the site's pages sitting outside a map its authors call complete, and
it is the reason overview is a fifth page type below.

So: Diátaxis is adopted as a test, not as a shape — which is what its own
authors ask for and not a departure from it. The test is applied to a page, and
the page passes when it can be named:

- **Getting started** is a tutorial. It is the one page that may assume nothing
  and must work if followed from the top. It does not explain why.
- **A question page** is a how-to. Titled as the question, entered by a reader
  who already has a goal.
- **API reference** is reference. Exhaustive over exports, organised by the
  API's own shape, no narrative.
- **An explanation page** — `acl/decisions`, `acl/security`, `luhn/standards`,
  `token/entropy` — carries the theory. It is the only page type allowed to have
  no example of its own.

A page that is two of these is split or the weaker half is cut. `acl/index`
today is an overview plus a when-to-use-it plus a trust-boundary explanation,
which is the mix Diátaxis warns about; it is also the right mix for an overview,
which is why overview is a fifth type below rather than a Diátaxis category.

What is rejected: the four-folder layout, and the instinct to complete the set.
A section with no explanation page needs no explanation page.

## 2a. What the good docs do, and what of it survives one maintainer

Stripe has a documentation team, a hosted API and a per-reader account. React
has a company. This repo has one maintainer and some agents. The table is what
each site does, and whether the mechanism survives being reproduced by a static
export on GitHub Pages with no server and no per-reader state.

| Site      | Mechanism                                                                | Here?                                                           |
| --------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Stripe    | Reference generated from OpenAPI, the one source of truth                | **Yes** — the TypeScript types are the equivalent. Section 4    |
| Stripe    | Request and response stacked in a persistent right rail                  | **Yes, at small scale** — this is what a probe already is       |
| Stripe    | Snippets copy-pasteable with no placeholders                             | **Yes** — an authoring rule, costs nothing                      |
| Stripe    | A `.md` sibling per page plus `llms.txt`                                 | Yes, cheap, out of scope here                                   |
| Stripe    | Your own test key and your own object ids interpolated into every curl   | **No.** Needs auth, an account and a test-mode data plane       |
| Stripe    | Seven-language switcher, per-version SDK pinning, dated version trains   | **No.** One language, semver, and versioned docs is the ceiling |
| react.dev | 600+ editable Sandpack sandboxes, roughly a third of all code blocks     | **No** at that price; the probe is the cheap third of it        |
| react.dev | Fixed page skeleton: what you'll learn → body → recap → challenges       | **Yes** — section 3's floor is the same idea, smaller           |
| react.dev | Reference pages are Reference → Usage → Troubleshooting                  | **Partly** — decision 11 takes the first, section 3 declines    |
| react.dev | Troubleshooting headings phrased as the symptom                          | **Yes** — `acl/pitfalls` is already this and should say so      |
| Rust      | Examples in doc comments are tests, run by the normal test command       | **Already shipped**, and it is this repo's best asset           |
| Rust      | Named escape hatches: `ignore`, `no_run`, `compile_fail`, `should_panic` | **Yes** — this is where section 4's tag list comes from         |
| Rust      | Ferris icons marking a listing that does not compile                     | **Yes, and required** — section 4's rendered marks              |
| Rust      | API Guidelines C-EXAMPLE: every public item has an example               | **Yes** — decision 5 applied to `api.mdx`                       |
| Tailwind  | A lookup table above the prose, answering "which do I type"              | **Yes** for `api.mdx`; scanning and reading in separate blocks  |
| Tailwind  | Algolia DocSearch                                                        | No — this site is pagefind, and that is fine                    |
| Astro     | A written style guide: no "we", no "let's", imperatives, neutral prose   | Yes, and this repo already writes that way                      |
| Astro     | A scope fence: document how to use X _in Astro_, not how X works         | **Yes** — kills half the length of the acl platform guides      |
| Astro     | Every sample carries its filename and is complete and copy-pasteable     | **Yes** — and `file=` already carries the filename              |
| Svelte    | The unit of learning is a diff to seeded code, not a blank editor        | **Yes** — this is why `AccessDemo` clicks a literal             |
| Svelte    | The tutorial owns the runtime, so there is no install before lesson 1    | **Yes** — a probe is the small version of this                  |

Four of these change what this document says, so they are called out rather than
left in a table.

**Generate the reference from the types.** Stripe's own account of how its docs
stay correct is that the API description is the source of truth and the docs,
the SDKs and the CLI are all generated from it. The analogue here is exact: each
package has one `.` entry in its exports map and emits declarations. An
`api.mdx` that hand-writes `can(subject, key, action, object?, now?): Decision`
is a second copy of a signature the compiler already knows, and section 4's
`signature` tag is a weaker answer than generating the block. The `signature`
tag stays in the standard as the fallback, and the guessing section says so.

**Rust is the closest prior art and this repo already has it.** `cargo test`
running the doc examples is `docExamples()` running the README fences, and the
Rust book's stated reason is the one that applies here: "nothing is worse than
examples that don't work because the code has changed since the documentation
was written". What Rust has that this repo does not is the vocabulary for the
examples that cannot run — `no_run`, `ignore`, `compile_fail` — and the visual
mark on the listing that says so. Section 4 takes both.

**react.dev's ratio is the target and its mechanism is not.** Counted on eight
Learn sources, roughly a third of code blocks are the entry file of an editable
sandbox. That is the number worth aiming at. Sandpack is not the way to get
there: `2026-09-13-interactive-examples.md` § 4 measures it at ~350 kB plus an
iframe plus a bundler resolving packages from npm rather than from the
workspace, which breaks the one guarantee this site has that react.dev does not
— that the code on the page is the code that was tested.

**Astro's scope fence is the length cut nobody has made.** "It is not our role
to document how React, Tailwind, or JavaScript works. It **is** our role to
document how to use a UI framework component **in Astro**." Applied here:
`acl/integrations/react-router.mdx` at 1,560 words and `acl/integrations/nestjs.mdx`
at 1,451 are partly teaching React Router loaders and Nest guards. A platform
guide documents how `@evanion/acl` is wired into that platform and links out for
the platform itself.

## 3. The section shape

### The floor: four page types

Every documented package has these, and a section missing one is incomplete
whatever else it has.

| Page                  | Diátaxis  | Must carry                                                                                                               |
| --------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `index.mdx`           | —         | What it is in two sentences, one executed region, when to reach for it, when not to, and links to the other three pages. |
| `getting-started.mdx` | tutorial  | The install command, and one path that works end to end, every step executed.                                            |
| `api.mdx`             | reference | One heading per exported symbol, one executed region per symbol that can be called.                                      |
| A **demonstration**   | how-to    | The section's interactive control, over an example the reader can change.                                                |

The demonstration page is the one that does not exist today for six sections.
Its name is the package's own: `usage`, `examples`, `components`, `playground`,
`validation`. It is where decision 6 lands.

Nine sections, four floor pages: 36 pages. The site has 63, so the floor is not
the constraint. What the floor does is make `compose` at three pages illegal and
`astro-widget` at four legal-but-empty.

### What earns a fifth page and beyond

Four kinds, and nothing else:

**A setup tier.** Only when the package has one decision that changes the
meaning of the rest of the API. `acl` has exactly one — whether a condition
reads the object — and it is worth three pages because the answer changes
whether `unevaluable` can occur, whether an instance must be fetched, and how
many arguments `can` takes. Cap: three tiers. A fourth tier means the tiers are
tracking difficulty rather than a decision, and difficulty is not a document
boundary.

**A question page.** Titled as the question a reader types, not as the method.
`acl` has five and all five pass the test: "Can this user do this?", "What can
they do at all?", "Which fields may they write?", "Why was this refused?",
"A policy from another service". Earned when the answer is a method the reader
cannot guess the name of.

**A format or contract page.** `acl/matrix` (the document), `acl/security` (the
trust boundary), `acl/pitfalls` (the caveat list), `luhn/standards`,
`token/entropy`. Earned when there is material a reader checks their code
against rather than reads once.

**A platform guide.** One per framework the package ships an adapter for or
documents an integration with. `acl` has four. This is the page type with the
strongest bound on it: no adapter, no guide. A guide for a framework the repo
does not test against is a maintenance liability with no test behind it.

### The ceiling

A section has at most four bands. A band is a separator in `_meta.ts` with at
least two pages under it. Below five pages a section has no bands at all and the
floor's reading order is the order.

`acl` has three bands — Setup, Questions, Reference — plus a fourth grouping,
`integrations/`, currently expressed as a folder. Under decision 8 that becomes
a `Platforms` band: Simple, Intermediate and Advanced stay under Setup, and
Many Services joins the four platform guides under Platforms, which is where a
topology belongs anyway. Four bands, 22 pages, at the ceiling.

The honest statement is that `acl` defines the ceiling rather than being
measured against one that existed first. That is acceptable and it is worth
being explicit about: 22 pages is the largest section this site may have, and a
tenth package arriving with 25 pages is a review conversation, not a merge.

### The prose budget

1,200 words a page. Nine pages exceed it today: `react-widget/api` (1,920),
`acl/pitfalls` (1,567), `urn/api` (1,561), `acl/integrations/react-router`
(1,560), `acl/decisions` (1,557), `acl/integrations/nestjs` (1,451),
`acl/integrations/next-rsc` (1,393), `acl/security` (1,393),
`react-widget/advanced` (1,388).

The budget is not a style preference. A page over it is two reader questions
sharing a URL, which means the search result and the table of contents both
point at the wrong half. The five `acl` pages on the list are the clearest
cases, and four of them are platform guides carrying the framework tutorial
Astro's scope fence would have cut.

Reference pages are the exception the budget must not break: an exhaustive
reference over a 55-export package is long because the package is wide, and
under decision 15 most of its length is generated rather than written. The
budget counts prose, not generated signatures.

### Headings

An API reference page has one heading per exported symbol, spelled as the
symbol, in backticks. `compose/api.mdx` does this — its headings are
`ComposeProvider` and `provider(component, props)`. `acl/api.mdx` does not: its
headings are "Construction", "Querying", "The write path", which is a how-to's
vocabulary on a reference page, and it makes `canFields` unfindable by search or
by the table
of contents.

Question pages take the opposite rule: the heading is the question, and the
method name is in the first line of the answer. `acl/_meta.ts` already states
this and it is right.

## 4. The runnable requirement, per page type

### The rule

Every fence in `apps/docs/content/` is one of:

1. A `file=… region=…` reference to a doctested region. **The default for every
   TypeScript, TSX and JavaScript example.**
2. A shell command.
3. A fence carrying an exemption tag from the closed list below.

There is no fourth case. A hand-written `ts` fence with no `file=` and no
exemption tag is a defect, and decision 5 means that includes API reference
pages, which today hold 100% hand-written signatures for `acl`, `feature`,
`luhn`, `token`, `react-widget`, `astro-widget`, `compose` and
`nestjs-correlation-id`.

### The exemptions

Named on the fence, borrowing the vocabulary from rustdoc, which is the closest
prior art and already solved this:

| Tag                | Means                                                                                                                          | Renders as                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `signature`        | A type signature, not a call. Held against the emitted `.d.ts`.                                                                | nothing; it is already reference       |
| `no-run`           | Real code with no runner here: an HTTP server, a Nest module, an `.astro` component, a build config.                           | a quiet "not executed" mark            |
| `anti-example`     | Deliberately wrong. The thing the page is telling the reader not to.                                                           | a red rule down the left edge          |
| `fails-type-check` | Compiles nowhere and must not. Pulled from a `@ts-expect-error` assertion in a `*.test-d.ts` file, so the failure is asserted. | the same mark, plus the expected error |
| `elided`           | An excerpt with `…` in it, for orientation only.                                                                               | a quiet "excerpt" mark                 |

`anti-example` and `no-run` are the two that will be abused, because they are
the two a writer reaches for when the alternative is wiring doctest into a
package. The guard in section 10 counts them per section and fails a section
where they outnumber executed regions.

The rendered mark matters and is not decoration. A reader cannot currently tell
`acl/pitfalls`'s nine hand-written fences from `acl/index`'s one executed one.
Rust solves this with the Ferris icons on non-compiling listings; this site has
no equivalent and needs one before the exemptions are safe to grant.

### Per page type

| Page type       | Executed regions           | Interactive control | May be prose-only |
| --------------- | -------------------------- | ------------------- | ----------------- |
| Overview        | at least 1                 | no                  | no                |
| Getting started | every step                 | no                  | no                |
| API reference   | 1 per callable export      | no                  | no                |
| Demonstration   | at least 1                 | **required**        | no                |
| Setup tier      | at least 1                 | optional            | no                |
| Question        | at least 1                 | optional            | no                |
| Format/contract | at least 1, or link to one | no                  | **yes**           |
| Platform guide  | at least 1                 | no                  | no                |

The one "yes" is deliberate. `acl/security` has 1,393 words and zero fences and
is right to: it is the trust boundary argued in prose, and an example of a
correct boundary is not a thing a fence can show. What it owes is a link to the
page that does execute, which it has.

### Which control, per package

The choice is made by the reader's question, which is the rule
`2026-09-13-interactive-examples.md` § 1 already sets. Restated as a table over
every package, because that spec predates `acl` and predates `widget`:

| Package                 | Control                     | Why                                                                                                   |
| ----------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `luhn`                  | probe (exists)              | The check character changing as the phrase is retyped is the documentation.                           |
| `token`                 | probe (exists)              | `validate` separates `check-failed` from `outside-alphabet` only when a reader mistypes a code.       |
| `urn`                   | probe (exists)              | RFC 8141 component splitting, shown in one call.                                                      |
| `react-widget`          | live code (exists)          | Its examples define components. Only evaluation shows that.                                           |
| `acl`                   | **specimen** (`AccessDemo`) | The question is "what does this person see", which is a rendered UI, not a returned value. Section 7. |
| `feature`               | probe                       | `inRollout(userId, 10, flagKey)` being stable per user rather than random is invisible in prose.      |
| `compose`               | **specimen**                | Its runtime claim — flat array, nested tree, order preserved — is a rendered tree. Section 8.         |
| `astro-widget`          | **specimen**, built once    | `.astro` compiles at build time. The control is the storefront's own output, embedded. Section 9.     |
| `nestjs-correlation-id` | none                        | The demonstrable unit is a running server. The demonstration page links `apps/` instead.              |

Eight of nine, against three today. The one exemption is
`nestjs-correlation-id`, and a section granted it must say so on its
demonstration page rather than leaving the reader to notice nothing is
clickable.

### What makes a demo work, from the one that does

`AccessDemo` is the only control on the site that has been confirmed to land —
the owner's words are "I LOVE the ACL demo in itself .. it really gets the point
across". Two earlier designs for the same specimen were built and discarded, and
the discards say more than the survivor.

The first was a decision panel: `Decision` rendered key for key, with `missing`,
the reason glosses and an advisory pill. Accurate, complete, sold nothing. The
second was a matrix JSON editor in the `DataDemo` idiom, with `parseMatrix`
construction errors surfaced. Cut because the canonical document for three
permissions plus a schema runs to about 36 lines, and a demo whose source needs
scrolling is arguing against the library's own claim of ease.

What shipped: a rendered interface on the left — app chrome, a role switch, a
post with a status chip and an action bar where every control is a `can()`
answering. The policy on the right, seven statements, with the line that
answered lit as the role changes. The literals inside the policy are buttons:
strike `'editor'` out of a grant and the corresponding control disappears while
you watch. A second beat on Publish — the status flips, a deny rule fires, and
Edit leaves every role's bar.

Three rules follow, and they bind every control added under decision 6:

1. **Consequence first, code second.** The reader sees the interface change
   before reading any source. A demo that leads with the listing is a listing.
2. **The source is short enough to read at a glance.** If it needs scrolling it
   is evidence against whatever ease the package claims. This is the rule that
   killed the JSON editor, and it is the strongest of the three because it is
   the only one that can veto a design outright.
3. **The edit gesture suits the thing edited.** `DataDemo` uses a textarea
   because free-form JSON can be half-typed and wants a parse error.
   `AccessDemo` uses clickable literals because the editable thing is a small
   closed set — no parse errors, nothing to crash, and the policy stays short.
   A probe's single `<input>` is the third case: one argument, free-form, and
   the error path is the library's own exception.

And a fourth rule, with a boundary on it: **a demo that shows the package's own
output shape is a diagnostic.** A `Decision` object, a validation result, a
parse tree — these belong on reference pages, where a reader is checking their
code against the shape. The first `AccessDemo` design was exactly this and it is
why it sold nothing.

The boundary is that this only bites where the output is consumed by something
else. A `Decision` is not the product; the UI it configures is. But
`Luhn.generate('foo')` returning `'5'` **is** the product — a check character is
what the caller wanted, not a description of what the caller wanted — and the
same holds for a generated token and for a parsed URN's components. So the three
existing probes are demos rather than diagnostics, and the rule is stated as:
render the output shape only when the output is the thing the reader came for.
Where a package's return value is a report about something else, the demo shows
the something else.

`acl`'s section already places its diagnostics correctly: `acl/refusals` and
`acl/api` render `Decision` key for key, which is where that belongs.

## 5. What "done" means for a page

A page ships when all of these hold. This is the list an agent is handed.

1. It is listed in its section's `_meta.ts`, in reading order, with an
   editorial title.
2. It has exactly one `# ` heading, and it is not the package name unless the
   page is the overview.
3. Every TypeScript fence is a `file=… region=…` reference or carries an
   exemption tag.
4. Every region it references exists and executes in the package's test run.
5. It is under 1,200 words of prose, counting neither fences nor generated
   signatures.
6. Its Diátaxis type is one of the five in section 3, and it is only one.
7. If it is the demonstration page, it mounts the section's control.
8. Every `@evanion/…` symbol it names is exported from that package's entry.
9. Every internal link it makes resolves to a page that exists.

## 6. Ordering: separators, not folders

`content/_meta.ts` already makes this argument for the top level and it is
right:

> A separator rather than a folder. Nesting the packages under a Nextra folder
> would put a group between a reader and every page inside it — one more click,
> and a collapsed group hides the package someone came for.

It generalises, and the generalisation is sharper than the original argument.
A folder costs a click. That click is worth paying when the folder's contents
are a set the reader chooses from — which is the case exactly when the reader
knows the name of the thing inside before they open it. A reader looking for
"NestJS" knows they want NestJS. So `acl/integrations/` is the one case on this
site where a folder could be defended.

It is still wrong, for a reason the click argument misses. Nextra appends a page
its `_meta.ts` does not list, and a folder is a page. `acl/_meta.ts` carries a
paragraph saying `integrations/` belongs between Many Services and the Questions
band, and does not list it, so five pages sit below the Reference band where the
comment says they must not. A separator cannot fail this way: its members are
keys in the same file, and the guard that checks keys resolve to pages already
runs over them.

So: separators at every level, and `content/acl/integrations/*.mdx` moves to
`content/acl/` under a `Platforms` separator. `acl/integrations/index.mdx`
becomes `acl/platforms.mdx`, the band's overview.

The URL changes, from `/acl/integrations/nestjs` to `/acl/nestjs`. Nothing
external links to these yet — the section is on a branch and the package is
`private: true`. Doing it after `@evanion/acl` publishes means redirects, and a
static export on GitHub Pages has no redirect mechanism short of a meta refresh
page per URL.

The one thing a folder still buys is a URL segment that groups, and it is not
worth a click. `/acl/nestjs` reads fine.

The generalisation is corroborated from outside this repo, and specifically
against the Diátaxis-shaped layout this standard declines. From the criticism in
section 2: "Please do not make me click on 'reference' to get to 'API docs'… it
tends to turn 1-click docs into 2-click docs", and "Some projects, when they
move to diataxis, will create a top level section called 'reference' and have a
single item under it called 'API'." A separator with the same title costs
nothing and hides nothing.

## 7. The front page and the section

The landing page is `app/page.tsx`, rendered as a `@evanion/react-widget`
region: every section of it is an item, placed by `items.ts`, rendered by the
component its `type` names. It sells. A reader arrives from npm or from a link,
scans tiles, and leaves for a section.

**Belongs on the front page only:** the tile grid, the group lines, the platform
chips, the unreleased ribbon, the one-sentence description per package. All of
it is comparative — it exists to help a reader choose between packages, which is
a question no section can answer.

**Belongs in the section only:** installation, every API detail, every caveat,
anything with a version on it.

**Must appear in both:** every runnable control. This is decision 9 and it is the
one the current site breaks worst.

`AccessDemo` is the best thing on the site, and the only control anyone has
said so about. It renders a document with comments,
switches the signed-in role between three people, and lights up the policy
literals that produced what is on screen — and it is reachable from exactly one
place: the landing page, above the fold, for a package whose 22-page section
contains nothing clickable. A reader who follows the tile into `/acl` gets
21,847 words and 119 fences and never sees it again.

The same holds, less severely, for `LuhnSpecimen`, `TokenSpecimen` and
`UrnSpecimen`: the section has a probe, which is a different and smaller thing
than the card, and `DataDemo` — the widget demo the owner named as the model —
appears nowhere under `/react-widget`.

The rule: a component under `components/landing/` that a reader can operate is
registered in `mdx-components.js` and mounted on the demonstration page of the
package it advertises. The landing page keeps its copy. They are the same
component with the same test.

What this costs: `AccessDemo` is a `'use client'` component importing
`@evanion/acl`, which the docs app already depends on. Mounting it in MDX is a
map entry and a tag. `DataDemo` is the same. The landing CSS is imported by
`app/page.tsx` rather than by the components, so the two that are mounted
outside the landing page need their styles to follow them — that is the only
real work in decision 9.

## 8. `compose`, concretely

Three pages, 2,038 words, 21 fences, none executed, no `_meta.ts`, no control.
What it needs, in order:

1. **`_meta.ts`**: `index` → `getting-started` → `api` → `type-checking`.
   Today the section has no getting-started page at all and Nextra orders what
   exists alphabetically, so it opens on `api`.
2. **Doctest wiring**: `docExamples()` into `libs/compose/vite.config.ts`, the
   way `libs/urn` does it. The package's runtime surface is `ComposeProvider`
   and `provider`, both of which render React, and the doctest setup does not
   render React today. This is the same gap `libs/widget` has and it is the one
   blocking item. Either the doctest environment gains
   `@testing-library/react` — `libs/compose/src/test-setup.ts` already has it —
   or `compose`'s regions come from `Compose.test.tsx` rather than from the
   README under decision 7.
3. **`getting-started.mdx`**: install, the flat-array-to-nested-tree conversion
   the overview currently opens with, one executed region.
4. **The control**, built to section 4's four rules. `compose`'s claim is that a
   flat array becomes a nested tree in the order written. The consequence is a
   rendered tree of labelled boxes; the code is a seven-line `providers` array
   beside it; and the editable thing is an ordering, which is a small closed set,
   so the gesture is moving a chip rather than typing into an editor. React-live
   is the wrong mechanism here for the same reason the JSON editor was wrong for
   `acl`: it makes the source long and gives the reader a way to produce a
   syntax error in a demo that has nothing to parse.

   `2026-09-13-interactive-examples.md` § 2 ruled `compose` out on the grounds
   that "the runtime result of composing three functions is not surprising". It
   is right that the result is unsurprising and wrong that this makes it not
   worth showing: the reader's question is "does my provider order survive", and
   a nested box that visibly reorders answers it in one move. The same spec's
   objection that "a type error is not renderable" is answered by step 5.

5. **`type-checking.mdx` under decision 7.** This is the interesting one.
   `libs/compose/src/Compose.test-d.tsx` already asserts eight distinct type
   failures with `@ts-expect-error`, each with a written reason —
   "primaryColor is required by ThemeProvider", "'blue' is not assignable to
   'light' | 'dark'", "the second tuple entry must be props, not another
   component" — and `vitest typecheck` executes them against
   `tsconfig.spec.json`. `content/compose/type-checking.mdx` hand-writes its
   type-error examples instead, so the page's claims about the type system are
   the one part of the section with a working test right next to it and no link
   between them.

   Decision 7 closes that: the region parser learns `// #region name` and
   `// #endregion name` in `.ts`/`.tsx` sources, taking the lines between the
   markers rather than requiring a fence, and `type-checking.mdx` renders
   `file=libs/compose/src/Compose.test-d.tsx region=missing-prop` with the
   `fails-type-check` tag. The page then shows the eight failures the compiler
   is asserted to produce.

   This is the general answer to "a type error is not renderable", and it
   applies to `libs/urn/src/lib/urn.test-d.ts` and
   `libs/widget/src/define-widgets.test-d.ts` as well.

Result: four pages, one control, every fence executed or tagged.

## 9. `astro-widget`, concretely

Four pages, 2,600 words, 27 fences, none executed, no `_meta.ts`, no control.
It is the hardest section on the site, because 8 of its fences are `.astro`
components and nothing in this repo executes an `.astro` fence.

1. **`_meta.ts`**: `index` → `getting-started` → `api` → `validation`. The floor
   is met on page types; only `validation` needs to become the demonstration.
2. **Doctest wiring for the half that is TypeScript.** 13 of 27 fences are `ts`
   or `js`: the registry, the item shape, the context object, the validation
   errors. `libs/astro-widget` has a parity harness already —
   `tools/repo-checks/src/adapter-parity.astro.test.ts` — and the item shape it
   documents is `@evanion/widget`'s, which is where those regions belong.
3. **The `.astro` fences stay static, tagged `no-run`,** and this is the correct
   answer rather than a concession. An `.astro` component is compiled by Astro's
   own compiler against a project; there is no runtime for one in a browser and
   no bundler in scope will produce one.
4. **The control is `apps/storefront`.** The demo app already renders this
   package's output, it is already built in CI, and its output is static HTML.
   Two options, and the cheap one is right: embed the storefront's rendered
   section markup in `validation.mdx` beside the `page.json` that produced it,
   generated at docs build time from the storefront's own build output, with a
   control that edits the JSON and re-fetches the matching prebuilt variant —
   this is `DataDemo`'s pattern with a fixed set of outputs instead of a live
   renderer. The expensive option is running the Astro compiler in the browser,
   and it is not worth it for one section.

   If the cheap option is judged too clever, the fallback is a link to the
   deployed storefront with a screenshot, and `astro-widget` becomes the second
   section exempt from decision 6. That is a real possibility and the guard
   in section 10 must take an explicit per-section exemption rather than
   special-casing a slug.

5. **`validation.mdx` gains the executed error cases.** The package's validation
   errors are thrown by TypeScript, not by Astro — `0f164d4` is a fix to exactly
   this path — so they are doctestable today with no new machinery.

Result: four pages, one control or a recorded exemption, 13 fences executed and
8 tagged `no-run`.

## 10. What a guard can enforce

`tools/repo-checks` is where conventions live in this repo, and the two docs
guards there already —`docs-navigation.test.ts` and `doc-regions.test.ts` —
establish the pattern: read the content tree, hold it against something derived,
fail with a message naming the file and the fix.

### Machine-checkable, and specified here

**G1 — every section has a `_meta.ts` listing every page in it.** Both
directions. `docs-navigation.test.ts` already checks that every `_meta` key
resolves to a page; the missing direction is that every page is a `_meta` key.
Fails today on six sections with no `_meta.ts`, on `acl/integrations`, and on
`urn/components`. This is the highest-value guard in the list and the cheapest:
about fifteen lines in the existing file.

**G2 — the floor.** Every entry in `navigation.ts` with `documented: true` has
`index.mdx`, a getting-started page, an `api.mdx` and a demonstration page.
"Demonstration page" is not derivable from a filename, so it is a field on the
`navigation.ts` entry — `demo: 'usage'` — which also gives G4 its target.
Fails today on `compose` (no getting-started).

**G3 — no unexplained fence.** Every fence in `content/` is `file=`-bearing,
one of the shell languages, or carries a tag from the closed list. Fails today
on 347 fences, which is why this one lands last and behind a per-section
allowance that ratchets down. The ratchet is the mechanism: the guard holds a
recorded count per section and fails when a section's count goes up.

**G4 — every section has a control.** The demonstration page named by G2 mounts
one of `Probe`, `WidgetPlayground`, `PlaygroundExamples`, or a registered
landing specimen, unless `navigation.ts` carries an explicit
`demoExempt: 'reason'`. Fails today on six sections.

**G5 — no doc names an unexported symbol.** Every `import { A, B } from
'@evanion/x'` in a fence is checked against what `libs/x/src/index.ts` exports.
42 such statements today across the site. Cheap, because every package has a
single `.` entry in its exports map, and it catches the failure that makes a
copy-pasted example fail for a reader in the most confusing way. Extension, once
`signature`-tagged fences exist: every identifier in a `signature` fence is an
exported type or value.

**G6 — every landing specimen is reachable from a section.** Every component
under `components/landing/` that takes an interaction is in
`mdx-components.js`'s map and appears in at least one `.mdx` page. Fails today
on `AccessDemo` and `DataDemo`.

**G7 — internal links resolve.** Every `](/…)` in `content/` names a page in the
content tree or a route the app defines. Nextra does not check this and a
renamed page leaves a 404 behind. Cheap, and it is what makes decision 8's URL
move safe.

**G8 — the word budget.** A word count per page, over the prose only. Fails
today on nine pages. Trivial to compute, and the least valuable of the eight:
over-length is a symptom and the guard cannot say which half to move.

G1, G2, G3, G4, G6 and G8 fail on the current content, counted. G5 and G7 have
not been run — the site's 42 package imports and its internal links have not
been resolved by hand, and either could pass clean.

### Judgement, and no guard should pretend otherwise

- **Whether a page is one Diátaxis type or two.** A guard can count headings; it
  cannot tell a tutorial that explains too much from a tutorial that explains
  enough.
- **Whether an extra page is earned.** Section 3 gives four kinds, and deciding
  that a given page is a question page rather than a second reference page is a
  reading.
- **Whether the control shows the thing.** A guard can assert `AccessDemo`
  renders and agrees with `@evanion/acl`. It cannot tell whether lighting up the
  policy literals is what teaches the reader the matrix.
- **Whether the prose is any good.** Out of scope for machinery, permanently.
- **Whether an exemption tag is honest.** `no-run` on a fence that could run is
  invisible to a guard. G3's ratchet is a proxy: it makes the count visible and
  makes it go one way.

## 11. Order

Nothing here is a single pass over 63 pages.

1. **G1 and the `_meta.ts` files.** Six files, one guard, and it fixes the
   reading order of two thirds of the site. Independent of everything else.
2. **Decision 8**: `acl/integrations/` becomes a `Platforms` band. Before
   `@evanion/acl` publishes, which is what makes the URL change free.
3. **Decision 9 and G6**: `AccessDemo` and `DataDemo` into `mdx-components.js`,
   mounted on `acl`'s and `react-widget`'s demonstration pages. This is the
   largest gain per hour of work in the document.
4. **G5 and G7.** Both cheap, both catch real breakage, neither needs content
   to change first.
5. **Decision 7**: `// #region` in source files. One parser change in
   `tools/doc-examples/src/regions.mjs`, plus the `fails-type-check` tag.
6. **`compose`** (section 8), as the pilot for the whole standard. It is the
   smallest section and it exercises every new mechanism.
7. **Doctest wiring** for `feature`, then `astro-widget`, then `react-widget`.
   G3's ratchet starts here, per section, as each one lands.
8. **Decision 15**: pick a declaration-to-MDX generator and put `acl`'s API
   reference on it, which is the single largest movement of the site-wide 14%
   and the one item here that is an evaluation before it is a task.
9. **`astro-widget`** (section 9), last, because its control is the one that
   needs a mechanism designed.

## Testing

- The region parser reads `// #region` / `// #endregion` from a `.ts` and a
  `.tsx` source, returns the lines between them with no marker lines, and
  throws on the same malformed cases `parseRegions` already throws on:
  unclosed, mismatched name, defined twice, nested.
- A `fails-type-check` fence whose source region holds no `@ts-expect-error`
  fails the build.
- G1 fails on a fixture section with a page missing from `_meta.ts`, and on one
  with no `_meta.ts`.
- G3's ratchet fails when a fixture section's untagged-fence count rises and
  passes when it falls.
- G5 fails on a fence importing a name the package's entry does not export, and
  passes on a name it exports only as a type.
- G7 fails on a link to a page that does not exist and passes on a link to a
  heading anchor within a page that does.
- `AccessDemo` renders in an MDX page under `output: 'export'`, agrees with
  `@evanion/acl` on every decision it draws, and its chunk is absent from the
  landing page's chunk list — the assertion `specimens.test.tsx` already makes,
  extended to the second mount point.
- Every page passing section 5's list is asserted for one real page per section
  before the guard for that item is turned on.

## Where I am guessing

- **That `astro-widget`'s prebuilt-variant control is buildable.** Section 9
  step 4 describes generating markup from the storefront's build output at docs
  build time. I have not checked whether the storefront's Nx build output is
  reachable from the docs build, or whether the two builds can be ordered. If
  they cannot, `astro-widget` takes the exemption and decision 6 covers eight of
  nine packages rather than nine.
- **That `compose` can be doctested without a new test environment.**
  `libs/compose/src/test-setup.ts` exists and the package's own tests render
  React, so the pieces are there. Whether `docExamples()`'s vitest workspace
  picks that setup up for a README fence is not something I traced.
- **The 1,200-word budget.** It is the median of the current pages rounded down,
  not a measurement of what a reader tolerates. It is the number in this
  document I would most expect to be moved, and moving it changes which seven
  pages fail rather than whether the rule is right.
- **That four bands is the right ceiling** rather than three. Section 3 arrives
  at four by resolving `acl`'s own shape, which is reasoning from the one
  example, and the one example was written without a standard.
- **Decision 15's generator.** `acl`'s API reference fences are grouped
  signatures — a whole `interface Access` in one block — rather than calls, and
  a signature is not a doctest. Stripe generates the equivalent from OpenAPI and
  Diátaxis asks for the same thing in different words ("the structure of the
  documentation should mirror the structure of the product"), so the direction is
  not in doubt. What is: whether TypeDoc or api-extractor can emit blocks that
  drop into MDX without dragging their own page layout in, and what that does to
  the docs build. I have not evaluated either. Until one is chosen, the
  `signature` tag plus G5 is the fallback, and it is weaker than decision 5
  claims — it checks the names, not the types.
- **That the four demo rules generalise.** They are extracted from one artifact
  and two of its discards. `AccessDemo` is a policy engine configuring a UI,
  which is the case where consequence and code are two different things on the
  screen. Whether "consequence first" means anything for `urn` — where the
  consequence _is_ the parsed components — is not something one example can
  settle, and section 4's boundary clause is my attempt to draw the line rather
  than a line anyone has tested.
- **Whether the landing specimens survive being mounted twice.** `AccessDemo`
  reads `landing.css`, which `app/page.tsx` imports. Moving the import into the
  component is the obvious fix and I have not checked what it does to the
  landing page's 6.7 kB client chunk.
