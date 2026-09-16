# The documentation standard

Status: proposed
Depends on: `2026-09-13-interactive-examples.md` (the probe, the three kinds of
example, and the per-package verdict this standard promotes from a one-off
judgement into a rule), `tools/doc-examples` (the region loader and the
`// -> value` rewriter, shipped), `tools/repo-checks/src/docs-navigation.test.ts`
and `src/doc-regions.test.ts` (the two guards this extends),
`2026-09-13-versioned-docs.md` (the archive the page-presence guard must not
fight), `2026-09-10-demo-apps.md` and `apps/storefront` (the board game shop the
examples are set in, section 6)
Measured against: `origin/feat/acl` at 63 pages, which is where the docs content
lives. `main` carries `tools/` and the packages.
Prior art, read for this document and marked VERIFIED or INFERRED in sections 3
and 3a: diataxis.fr (foundations, compass, map, the four type pages, quality,
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

So the first defect is uniform and it is not distribution. `acl` is the only
section that executes a meaningful fraction of its code and it still ships no
interactive control; `compose`, `feature`, `astro-widget`,
`nestjs-correlation-id` and `react-widget` execute nothing at all. A standard
aimed at page counts would fix none of this. This one is aimed at the 347
unexecuted fences and the 59 inert pages.

The site also carries no diagrams: zero `mermaid` fences and zero images across
all 63 pages. Prose and fences are the whole of the teaching layer, on pages
whose subjects are a two-tenant topology, a trust boundary and a build-time
transform. That is the teaching layer's hole and section 5 is where it is
answered.

The second defect is navigation, and it is worse than it looks. Six of nine
sections have no `_meta.ts`, so Nextra orders them by filename: `luhn` opens on
`api`, then `dictionaries`, then `index`, then `migration`. `acl/_meta.ts`
carries a paragraph explaining where `integrations/` belongs and does not list
it, so the five platform guides are appended below the Reference band.
`urn/_meta.ts` does not list `components`, which is the page carrying the URN
probe. Every one of these is machine-detectable and nothing detects it.

The third defect is that no section has an order anyone chose. Filename order is
not a reading order, and where a `_meta.ts` does exist it records a grouping
rather than a path: a reader who opens `urn/index` is not told what to read next
and a reader who opens `feature/build-time` is not told what it assumes. Six
sections have no first page. `acl` is the exception and its Setup band —
Simple, Intermediate, Advanced — is the only stretch of this site that teaches
one thing at a time.

The fourth defect is the domain. The examples are set in five unrelated worlds:
a blog CMS (`comment`, `article`, `draft`/`published` — 32 occurrences of
`'comment'` in `libs/acl/README.md`'s nineteen regions alone), a generic SaaS
(`checkout-v2`, `plan: 'pro'`), a news-and-weather dashboard (`react-widget`'s
`news`, `userInfo`, `weather`, a revenue chart), a marketing page (`hero`,
`cards`), and no world at all (`compose`, `nestjs-correlation-id`). The demo
apps are in a sixth, and it is the real one: `apps/storefront` is a board game
shop, `apps/storefront/src/data/landing.json` opens on `"lede": "on the table
tonight"` over `urn:game:brass-birmingham`, the design system is named Baize for
the felt of a card table, and the shop's catalogue carries seven games by URN.
The products are demonstrated in a shop the documentation never enters.

## Decisions

1. A section's pages are split by what the reader arrives with. A **teaching
   page** is entered by someone learning, in sequence. A **reference page** is
   entered by someone who already has the thing in mind and wants the detail.
   Everything in section 2 follows from that one split.
2. Teaching is cumulative. A teaching page may build freely on every teaching
   page before it in `_meta.ts` order, and may not silently require anything
   introduced after it. The order is what states the prerequisites; a page that
   lists its own is in the wrong place. Section 2.
3. A reference page is outside the sequence. It may use any concept in the
   section, assumes nothing about what the reader has read, and links to the
   teaching page that introduces a concept rather than re-teaching it. Section 2.
4. Diátaxis is a diagnostic applied to a page someone already decided to write.
   It is not a template that generates pages, it does not license splitting one
   good page into four thin ones, and no guard enforces it. Section 3.
5. Every section has four page types and may have four more kinds of page, from
   a closed vocabulary. Nothing else is a page. Section 4.
6. A section's ceiling is four bands and `acl` at 22 pages is at it. The ceiling
   is named as the maximum legal shape, not as a target, and page count is not
   the defect this document was called to fix. Section 4.
7. An API reference page has one heading per exported symbol, spelled as the
   symbol. Task-shaped headings belong on question pages. Section 4.
8. Prose budget: 1,200 words a page. Over that the page is two questions.
   Section 4.
9. A code fence executes unless it falls in one of five named exemptions, and
   the exemption is written on the fence rather than left to inference.
   Section 5.
10. `file=… region=…` is the only way a TypeScript example reaches a page. A
    hand-written `ts` fence in `content/` is a defect, including in an API
    reference. Section 5.
11. A teaching page has two layers. Prose, diagrams and code blocks teach the
    concept and show how to work it, and stand complete on their own. The
    playground makes it practical: the reader takes what was taught and feels
    it. The playground is additive and never substitutive, so a page whose
    prose says only "try changing the value" has failed at teaching. Section 5.
12. A diagram is a `mermaid` fence, never an image file, and it never carries
    information the prose does not. Nothing holds it to the code it describes,
    which is the one place this standard tolerates a rot it refuses everywhere
    else. Section 5.
13. Every section ships at least one control a reader can operate, on the
    demonstration page named in section 4, and the choice between a probe, live code and a specimen
    is made by what the reader's question is — not by what is easiest to build.
    A demo leads with the consequence and shows the code second; its editable
    surface takes the gesture that suits it; its source stays short enough to
    read without scrolling; and it renders the package's own return shape only
    where that shape is the thing the reader came for. Otherwise it is a
    diagnostic and belongs on a reference page. Section 5.
14. One domain across all nine sections: the board game shop the demo apps
    already run. Both front-page demos are re-themed into it. A package may
    record an exemption with a reason; `compose` takes the only one. Section 6.
15. The region loader learns `// #region` markers in `.ts`/`.tsx` sources, so a
    type-level claim asserted in a `*.test-d.ts` file can be rendered as the
    example. This is what makes `compose` documentable under decision 9.
    Section 10.
16. Separators, never folders, at every level. `acl/integrations/` is the one
    folder on the site and it is wrong; it becomes five pages under a
    `Platforms` separator. Section 8.
17. Every section directory has a `_meta.ts` naming every page in it, in reading
    order. Under decision 2 that order is a claim about what a reader has met,
    so the file is load-bearing rather than a convenience. Section 8.
18. Nothing runnable exists only on the front page. Every landing specimen has a
    counterpart inside the section it advertises, and `AccessDemo` moves into
    MDX. Section 9.
19. An API reference's signature blocks are generated from the package's emitted
    declarations, not written. Until that generator exists they carry a
    `signature` tag and a guard holds every identifier in them to the package's
    exports. Section 3a, section 5.
20. Nine guards in `tools/repo-checks` (section 12). Seven of them fail today;
    the other two have not been run. Three rules here have no guard behind them
    — the teaching order, whether a teaching layer stands alone, and whether a
    diagram is still true — and section 12 names them rather than letting the
    document read as uniformly binding.
21. Nothing here is retrofitted in one pass. The order is section 13.

Decision 14 is the expensive one: it re-themes nineteen doctested regions, a
22-page section and two front-page demos, one of which the owner has said he
loves. Decision 10 is the one this document was originally written to argue.
Decision 6 is the one most likely to be disputed, because it declines to call 22
pages a defect. Decision 15 is the only one that needs code outside `apps/docs`.

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

## 2. The journey

### The split, and it is by what the reader arrives with

Two kinds of page, and the difference is the reader's state on arrival, not the
content type.

A **reference page** is entered by someone who already has the thing in mind and
wants the detail: a signature, an option, the meaning of an error. They arrive
from search, from an error message, from their own history six weeks later. They
may have read nothing else in the section, so the page assumes nothing.

A **teaching page** is entered by someone learning, in sequence. They arrived
at the section to be taught the library, and they are working through it. So the
page may assume everything the earlier teaching pages taught.

That split is the whole of this section. It is cleaner than any content-type
taxonomy, because it is answerable about a page in one question: _does a reader
open this already knowing what they want out of it?_

### Teaching is cumulative, not narrative

A section's teaching pages are ordered the way a game teaches its own rules: the
first move is one the reader cannot get wrong, one mechanic arrives at a time,
and nothing is asked for that has not been taught.

The owner's framing, which is the one to hold to:

> I'm not saying that it should be written like a novel, I just lean that the
> documentation should build on the earlier documentation that the user have
> already gone through.

So this asks for no connective prose, no callbacks, no voice, and no running
scenario carried for its own sake. A teaching page is not a chapter. What the
rule gives and takes is one permission and one obligation:

- **The permission:** a teaching page may use anything an earlier teaching page
  introduced, without reintroducing it, without an aside, and without a link.
  That is what makes a section shorter than nine independent pages.
- **The obligation:** a teaching page may not silently require anything a later
  teaching page introduces. A concept that arrives on page four cannot be used
  casually on page two to explain something else.

Everything else about order — how long each page is, how many there are, how
they read — is section 4's business and not this rule's.

### The order is the prerequisite

`_meta.ts` order is the sequence, which is why decision 17 makes that file
mandatory rather than convenient. `index.mdx` is the entry point: the one page
that may assume nothing, and the only page a reader can be expected to arrive at
cold.

A teaching page does not list its prerequisites. If a page needs a line saying
_read X first_, either the order is wrong or the page is in the wrong band, and
the line is covering for it. This is the difference between a journey and a pile
of pages with cross-references: in a sequence the position is the statement, and
an annotation restating it is a smell rather than a service.

The consequence is that moving a teaching page in `_meta.ts` is a real change.
It changes what every page after it may assume and what every page before it may
use. The ordering work is load-bearing rather than tidying.

The floor's teaching sequence is fixed: `index` → `getting-started` → the
demonstration. A setup tier extends it — `acl`'s Simple → Intermediate →
Advanced is exactly this and is the model for the rest of the site.

### Familiarity before the next concept

A concept introduced on one page is used again on the next without being
re-explained. That is what "let the player get familiar with it" means in a
document: the second appearance is the practice, and it is why the setup tiers
are worth three pages while three tiers named Beginner, Intermediate and
Advanced would not be. `acl`'s tiers are staged by one decision — whether a
condition reads the object — and each tier uses the previous tier's answer
rather than restating it.

The converse is a real cut: a concept introduced once and never used again did
not need a page. It needed a paragraph on the page that would have used it.

### One concept a page

A teaching page introduces one thing. The page names it in its first two
sentences, and the name is the same one the rest of the section uses.

This is a constraint on introduction, not on content. A page may mention
anything already introduced as often as it needs to. What it may not do is
teach two new mechanics at once, which is the failure that makes a tutorial
feel like a specification.

Where a page seems to need two, one of them is usually not needed at all: the
second concept is arriving because the example was built to show off rather
than to answer a question the reader has yet.

### Reference sits outside the sequence

`api.mdx`, `acl/matrix`, `acl/security`, `luhn/standards`, `token/entropy` and
every other format or contract page are reference, and this is not a concession
— it is what they are for.

Because the reader arrives already knowing what they want:

- It may use any concept in the section, at any depth, with no ordering rule.
  The cumulative rule does not bind it in either direction: it may name a
  concept no teaching page has reached, and a teaching page may not treat it as
  the place a concept was introduced.
- It assumes nothing about what has been read. Where a symbol needs a concept
  explained, the reference links to the teaching page that introduces it and
  does not repeat the explanation inline. That link is the only navigation a
  reference page owes.
- It is exhaustive over its subject, which is the one place Diátaxis prescribes
  a structure and it is right to (section 3).

The practical consequence for `_meta.ts` is that the Reference band comes last
and is never on the path. A reader following the section top to bottom reaches
it after the teaching is over, which is exactly when a reference becomes useful.

Question pages and platform guides are the interesting middle. A reader enters
them with a goal already formed, which makes them reference by the arrival test,
and section 4 places them off the sequence for that reason. Where one of them
does have to teach, it links rather than re-teaches.

### Between sections

The site has an order too, and it is the front page: the tile grid is where a
reader chooses a package. Sections do not otherwise depend on each other, with
one exception the navigation already records — `navigation.ts`'s Identifiers
group says "Token is built on Luhn". A section may name another section as
background and link to it. It may not use another package's concepts in an
example without introducing them, because a reader arriving at `token` from npm
has not read `luhn`.

### What this does to the rest of the document

The journey is what decides which pages exist and in what order. Diátaxis
(section 3) is applied afterwards, to a page already decided on, to catch a page
doing two jobs. The domain (section 6) is what lets the journey carry vocabulary
across a section boundary instead of resetting at each one. Section 5's two
layers are how a page does its share: the teaching layer explains the concept
and the playground is where the reader becomes familiar with it before the next
one arrives.

## 3. Diátaxis, as a diagnostic

Diátaxis is a guideline here and not a rule. Nothing in `tools/repo-checks`
enforces it, no page is created because a quarter of the compass was empty, and
a section with no explanation page needs no explanation page. What follows is
the reading that arrives at that, because the framework is more often adopted
as a directory layout than as what its own authors describe.

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
`/start-here/`). That is decision 7 — an API reference page whose headings are
the exported symbols — and it arrives from the framework rather than from taste.
It is also the one part of the framework this document treats as binding, and
that is not a coincidence: reference is the one page type with no journey in it
(section 2), so a structural rule can hold over it without fighting an order.

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

That last sentence is the one that decides this section. A framework whose
remedy for mixing is a link, applied to a reader who does not click links, is a
framework that loses the material rather than organising it. A journey does not
have that failure mode: the explanation is not behind a link, it is the next
page, and the reader arrives at it by continuing.

The API-docs version of it, VERIFIED on HN 49141184: "Please do not make me
click on 'reference' to get to 'API docs'. … it tends to turn 1-click docs into
2-click docs", and 49143640: "Some projects, when they move to diataxis, will
create a top level section called 'reference' and have a single item under it
called 'API'." That is decision 16's argument arriving from outside this repo.

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
it is the reason overview is a fifth page type in section 4.

So Diátaxis is kept, and kept in one direction only. It runs **after** the
decision to write a page, never before it:

- It may not be used to justify creating a page. A page exists because the
  journey needs a step there, or because section 4 names a kind it belongs to.
  "The section has no explanation page" is not a finding.
- It may not be used to split a page that works. Fragmentation is the
  documented failure and a working page is the thing being traded away.
- It is applied to a page that already exists, as one question: **is this page
  doing two jobs?** A page that is a tutorial for half its length and a
  reference for the other half is two reader intents sharing a URL, and that is
  worth acting on — which is the same finding the prose budget (section 4)
  reaches by counting.

The vocabulary, used as names and not as boxes:

- **Getting started** is a tutorial. It is the one page that may assume nothing
  beyond `index`, and it must work if followed from the top. It does not
  explain why.
- **A question page** is a how-to. Titled as the question, entered by a reader
  who already has a goal.
- **API reference** is reference. Exhaustive over exports, organised by the
  API's own shape, no narrative, no journey.
- **An explanation page** — `acl/decisions`, `acl/security`, `luhn/standards`,
  `token/entropy` — carries the theory. It is the only page type allowed to have
  no example of its own.

`acl/index` today is an overview plus a when-to-use-it plus a trust-boundary
explanation, which is the mix Diátaxis warns about; it is also the right mix for
an entry point, which is why overview is a fifth type in section 4 rather than a
Diátaxis category and why the diagnostic does not fire on it.

What is rejected outright: the four-folder layout, and the instinct to complete
the set.

## 3a. What the good docs do, and what of it survives one maintainer

Stripe has a documentation team, a hosted API and a per-reader account. React
has a company. This repo has one maintainer and some agents. The table is what
each site does, and whether the mechanism survives being reproduced by a static
export on GitHub Pages with no server and no per-reader state.

| Site      | Mechanism                                                                | Here?                                                           |
| --------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Stripe    | Reference generated from OpenAPI, the one source of truth                | **Yes** — the TypeScript types are the equivalent. Section 5    |
| Stripe    | Request and response stacked in a persistent right rail                  | **Yes, at small scale** — this is what a probe already is       |
| Stripe    | Snippets copy-pasteable with no placeholders                             | **Yes** — an authoring rule, costs nothing                      |
| Stripe    | A `.md` sibling per page plus `llms.txt`                                 | Yes, cheap, out of scope here                                   |
| Stripe    | Your own test key and your own object ids interpolated into every curl   | **No.** Needs auth, an account and a test-mode data plane       |
| Stripe    | Seven-language switcher, per-version SDK pinning, dated version trains   | **No.** One language, semver, and versioned docs is the ceiling |
| react.dev | 600+ editable Sandpack sandboxes, roughly a third of all code blocks     | **No** at that price; the probe is the cheap third of it        |
| react.dev | Fixed page skeleton: what you'll learn → body → recap → challenges       | **Yes** — section 4's floor is the same idea, smaller           |
| react.dev | Reference pages are Reference → Usage → Troubleshooting                  | **Partly** — decision 7 takes the first, section 4 declines     |
| react.dev | Troubleshooting headings phrased as the symptom                          | **Yes** — `acl/pitfalls` is already this and should say so      |
| Rust      | Examples in doc comments are tests, run by the normal test command       | **Already shipped**, and it is this repo's best asset           |
| Rust      | Named escape hatches: `ignore`, `no_run`, `compile_fail`, `should_panic` | **Yes** — this is where section 5's tag list comes from         |
| Rust      | Ferris icons marking a listing that does not compile                     | **Yes, and required** — section 5's rendered marks              |
| Rust      | API Guidelines C-EXAMPLE: every public item has an example               | **Yes** — decision 10 applied to `api.mdx`                      |
| Tailwind  | A lookup table above the prose, answering "which do I type"              | **Yes** for `api.mdx`; scanning and reading in separate blocks  |
| Tailwind  | Algolia DocSearch                                                        | No — this site is pagefind, and that is fine                    |
| Astro     | A written style guide: no "we", no "let's", imperatives, neutral prose   | Yes, and this repo already writes that way                      |
| Astro     | A scope fence: document how to use X _in Astro_, not how X works         | **Yes** — kills half the length of the acl platform guides      |
| Astro     | Every sample carries its filename and is complete and copy-pasteable     | **Yes** — and `file=` already carries the filename              |
| Svelte    | The unit of learning is a diff to seeded code, not a blank editor        | **Yes** — this is why `AccessDemo` clicks a literal             |
| Svelte    | The tutorial owns the runtime, so there is no install before lesson 1    | **Yes** — a probe is the small version of this                  |
| Svelte    | Lessons are numbered, ordered, and each one adds one thing               | **Yes** — this is section 2, arrived at independently           |

Five of these change what this document says, so they are called out rather than
left in a table.

**Svelte's tutorial is the journey, already built.** Its chapters are an order a
reader walks, each lesson is a diff to the previous lesson's code, and the
runtime is supplied so nothing is installed before lesson one. Section 2 is that
shape applied to a package section, and section 5's interactable examples are
what stands in for the supplied runtime. What this repo cannot copy is the
continuity of the editor across lessons: a static export has no per-reader
state, so each page's control starts from its own seed rather than from what the
reader left on the page before.

**Generate the reference from the types.** Stripe's own account of how its docs
stay correct is that the API description is the source of truth and the docs,
the SDKs and the CLI are all generated from it. The analogue here is exact: each
package has one `.` entry in its exports map and emits declarations. An
`api.mdx` that hand-writes `can(subject, key, action, object?, now?): Decision`
is a second copy of a signature the compiler already knows, and section 5's
`signature` tag is a weaker answer than generating the block. The `signature`
tag stays in the standard as the fallback, and the guessing section says so.

**Rust is the closest prior art and this repo already has it.** `cargo test`
running the doc examples is `docExamples()` running the README fences, and the
Rust book's stated reason is the one that applies here: "nothing is worse than
examples that don't work because the code has changed since the documentation
was written". What Rust has that this repo does not is the vocabulary for the
examples that cannot run — `no_run`, `ignore`, `compile_fail` — and the visual
mark on the listing that says so. Section 5 takes both.

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

## 4. The section shape

### The floor: four page types

Every documented package has these, and a section missing one is incomplete
whatever else it has. The first three are the teaching sequence.

| Page                  | Diátaxis  | Teaching    | Must carry                                                                                                               |
| --------------------- | --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `index.mdx`           | —         | entry point | What it is in two sentences, one executed region, when to reach for it, when not to, and links to the other three pages. |
| `getting-started.mdx` | tutorial  | yes         | The install command, and one path that works end to end, every step executed.                                            |
| A **demonstration**   | how-to    | yes         | The section's interactive control, over an example the reader can change.                                                |
| `api.mdx`             | reference | **no**      | One heading per exported symbol, one executed region per symbol that can be called.                                      |

The demonstration page is the one that does not exist today for six sections.
Its name is the package's own: `usage`, `examples`, `components`, `playground`,
`validation`. It is where decision 13 lands, and it comes before
the reference because it is the last step of learning rather than the first step
of looking something up.

Nine sections, four floor pages: 36 pages. The site has 63, so the floor is not
the constraint. What the floor does is make `compose` at three pages illegal and
`astro-widget` at four legal-but-empty.

### What earns a fifth page and beyond

Four kinds, and nothing else. The first is teaching; the other three are
entered with a goal already formed and sit outside the sequence.

**A setup tier.** Teaching, and the clearest case of section 2's shape.
Only when the package has one decision that changes the meaning of the rest of
the API. `acl` has exactly one — whether a condition reads the object — and it
is worth three pages because the answer changes whether `unevaluable` can occur,
whether an instance must be fetched, and how many arguments `can` takes. Each
tier uses the previous tier's answer rather than restating it. Cap: three tiers.
A fourth tier means the tiers are tracking difficulty rather than a decision,
and difficulty is not a document boundary.

**A question page.** Outside the sequence. Titled as the question a reader types, not
as the method. `acl` has five and all five pass the test: "Can this user do
this?", "What can they do at all?", "Which fields may they write?", "Why was
this refused?", "A policy from another service". Earned when the answer is a
method the reader cannot guess the name of. It assumes nothing about what has
been read, because the reader arrived from search, and where it needs a concept
explained it links to the teaching page that introduces it.

**A format or contract page.** Outside the sequence, and reference by every test in section 2.
`acl/matrix` (the document), `acl/security` (the trust boundary),
`acl/pitfalls` (the caveat list), `luhn/standards`, `token/entropy`. Earned when
there is material a reader checks their code against rather than reads once.

**A platform guide.** Outside the sequence. One per framework the package ships an
adapter for or documents an integration with. `acl` has four. This is the page
type with the strongest bound on it: no adapter, no guide. A guide for a
framework the repo does not test against is a maintenance liability with no test
behind it.

### The ceiling

A section has at most four bands. A band is a separator in `_meta.ts` with at
least two pages under it. Below five pages a section has no bands at all and the
the teaching order is the order.

`acl` has three bands — Setup, Questions, Reference — plus a fourth grouping,
`integrations/`, currently expressed as a folder. Under decision 16 that becomes
a `Platforms` band: Simple, Intermediate and Advanced stay under Setup, and
Many Services joins the four platform guides under Platforms, which is where a
topology belongs anyway. Four bands, 22 pages, at the ceiling.

The bands are also where the teaching ends. `acl` teaches through `index` →
Setup's three tiers → its demonstration; Questions, Platforms and Reference are
entered sideways by a reader who already knows what they want. A section whose
bands do not resolve into that shape has a grouping rather than an order.

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
point at the wrong half. It is also the countable version of the Diátaxis
diagnostic in section 3 and of the one-concept rule in section 2: a teaching page
over budget is usually a page that introduced two things. The five `acl` pages
on the list are the clearest cases, and four of them are platform guides
carrying the framework tutorial Astro's scope fence would have cut.

Reference pages are the exception the budget must not break: an exhaustive
reference over a 55-export package is long because the package is wide, and
under decision 19 most of its length is generated rather than written. The
budget counts prose, not generated signatures.

### Headings

An API reference page has one heading per exported symbol, spelled as the
symbol, in backticks. `compose/api.mdx` does this — its headings are
`ComposeProvider` and `provider(component, props)`. `acl/api.mdx` does not: its
headings are "Construction", "Querying", "The write path", which is a how-to's
vocabulary on a reference page, and it makes `canFields` unfindable by search or
by the table of contents.

Question pages take the opposite rule: the heading is the question, and the
method name is in the first line of the answer. `acl/_meta.ts` already states
this and it is right.

## 5. The runnable requirement, per page type

### The rule

Every fence in `apps/docs/content/` is one of:

1. A `file=… region=…` reference to a doctested region. **The default for every
   TypeScript, TSX and JavaScript example.**
2. A shell command.
3. A fence carrying an exemption tag from the closed list below.

There is no fourth case. A hand-written `ts` fence with no `file=` and no
exemption tag is a defect, and decision 10 means that includes API reference
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
package. The guard in section 12 counts them per section and fails a section
where they outnumber executed regions.

The rendered mark matters and is not decoration. A reader cannot currently tell
`acl/pitfalls`'s nine hand-written fences from `acl/index`'s one executed one.
Rust solves this with the Ferris icons on non-compiling listings; this site has
no equivalent and needs one before the exemptions are safe to grant.

### Per page type

| Page type       | Executed regions           | Interactive control | May be prose-only |
| --------------- | -------------------------- | ------------------- | ----------------- |
| Overview        | at least 1                 | no                  | no                |
| Getting started | every step                 | **required**        | no                |
| Demonstration   | at least 1                 | **required**        | no                |
| Setup tier      | at least 1                 | **required**        | no                |
| Question        | at least 1                 | optional            | no                |
| API reference   | 1 per callable export      | no                  | no                |
| Format/contract | at least 1, or link to one | no                  | **yes**           |
| Platform guide  | at least 1                 | no                  | no                |

The three requirements are decision 11's playground layer. A section is not
obliged to build three separate controls — one control that a later page
re-enters with a different seed is the same control and counts. What a page may
not do is introduce a concept, leave the reader nothing to work it with, and say
nothing about why: it takes one of the named exemptions below rather than
staying silent.

The one "yes" is deliberate. `acl/security` has 1,393 words and zero fences and
is right to: it is the trust boundary argued in prose, and an example of a
correct boundary is not a thing a fence can show. What it owes is a link to the
page that does execute, which it has.

### The two layers of a teaching page

A teaching page has two layers and they do different jobs. The requirement is
the owner's:

> text, diagrams, code examples/blocks teaches a concept, the kinestetic
> playground makes it practical for the user

**The teaching layer: prose, diagrams, code blocks.** This explains the concept
and shows how to work it. It is load-bearing and it is complete on its own. A
reader who never touches a control — because they are scanning, because they
are on a phone, because the script did not load, because they are reading the
rendered text and not operating it — gets the whole explanation.

**The playground layer: the control.** The reader takes the concept that was
just taught and feels it. Changing the deny and watching the button leave the
bar is not a second explanation of precedence; it is the reader's own hands on a
rule they have already read.

The playground is additive. It never carries meaning the teaching layer did not
state, which gives the rule its test:

**A page whose prose says only "try changing the value" has failed at teaching.**
Not at interactivity — at teaching, and for every reader, including the ones
using the control. The instruction is a confession that the text was never
written: the meaning was left in a widget and the page is hoping the reader
reconstructs it. That failure is nameable in review.

This also settles what a chunk of this site is worth on its own. An agent, a
search result, a copied paragraph, an RSS reader, a `.md` sibling — each gets
the teaching layer and each gets the complete explanation, because the teaching
layer was required to stand alone in the first place. No second surface is built
for them and none is needed.

Which mechanism serves which layer, because the repo already has both and a
writer needs to know which to reach for:

| Layer      | Mechanism                                 | What it is for                                                 |
| ---------- | ----------------------------------------- | -------------------------------------------------------------- |
| Teaching   | Prose                                     | The concept, and how to work it                                |
| Teaching   | A `mermaid` fence                         | A shape prose is bad at: a topology, a lifecycle, a boundary   |
| Teaching   | A doctested region (`file=… region=…`)    | The concept in real code, at values CI has checked             |
| Teaching   | A `signature` or `fails-type-check` fence | What the compiler holds the caller to                          |
| Playground | A probe                                   | One argument, free-form, the package's own export on every key |
| Playground | A landing specimen                        | A rendered consequence the reader reconfigures                 |
| Playground | Live code                                 | The reader writes the snippet. Section 1's weakest guarantee   |

A code block is teaching, not playground. This is the line that matters most in
practice: an executed fence showing the shape of a call is how the concept is
shown in real code, and a reader who reads only fences has still been taught. A
control is playground, and a section that has fences and no control has a
complete explanation and no practice.

**Where a playground is not achievable, and the page says so.** Pretending
otherwise produces a toy control, and a toy is worse than nothing because it
costs a reader the time to discover it teaches nothing. Every page below still
owes a full teaching layer; what it does not owe is a control. The cases,
named:

- **A trust boundary.** `acl/security`. The failure happens in another process,
  and a control cannot show a boundary being crossed without simulating an
  attacker. A simulated attacker is theatre and proves nothing about the real
  one.
- **A build-time transform.** `feature/build-time`. The concept is that a flag
  read becomes a constant and the branch leaves the bundle. Both the before and
  the after are build artifacts; the honest presentation is two executed fences
  and the bundler's own output, not a button.
- **A compile step with no browser runtime.** `.astro` components (section 11),
  and every `no-run` fence. There is no runtime for these in a page.
- **A cross-process concern.** `nestjs-correlation-id`. The demonstrable unit is
  two running services and one header between them.
- **An argument.** `acl/decisions`, `feature/decisions`, `token/entropy`'s
  reasoning. A page whose subject is why a choice was made has no state to put
  under a reader's hand.

Four of those five are exactly the pages a diagram serves best, which is the
next subsection and not a coincidence: where a concept cannot be put under a
reader's hand it is usually because its shape is spatial or temporal rather than
a value, and that is what a diagram draws.

Type-level guarantees are the interesting middle case. A type error is not
operable, but a `fails-type-check` fence renders the compiler's own verdict
against an asserted `@ts-expect-error`. It is teaching rather than playground,
and the page calls it that.

Arithmetic is the other middle case and the answer is the opposite: a control
over `token`'s code length that recomputes the collision estimate is a
calculator, and a calculator is a legitimate playground precisely because the
number **is** what the reader came for. The boundary is the same one the demo
rules draw below — render the output where the output is the product.

**How to recognise a toy**, before building it. Any of these and the control is
not worth the page weight:

- Every state it can reach is predictable from the sentence above it.
- Its output is its input restated in the library's vocabulary.
- It demonstrates that the library works rather than what it does.

A page failing all three keeps its teaching layer and takes the exemption above.

### Diagrams, and the rot nothing catches

Zero of the site's 63 pages carry a diagram. That is the teaching layer's
largest hole and it is wider than the fence count suggests: `acl/security` at
1,393 words is a trust boundary with no picture of a boundary, `acl/federation`
is a two-tenant topology described in sentences, and `feature/build-time` is a
transform from one artifact to another.

**A diagram is a `mermaid` fence.** Never a PNG, never an SVG committed as an
asset, never a screenshot. Nextra 4 runs `remarkMermaid` in its compile pipeline
unconditionally and `mermaid` is already in the dependency tree, so a ` ```mermaid `
fence renders today with no component, no configuration and no new dependency.

The reasons are the ones this document gives everywhere else. A fence is text:
it diffs, so a reviewer sees a diagram change in the pull request rather than a
binary blob; it is searched by pagefind; it re-themes with the site instead of
shipping one palette into both; and it cannot silently be a screenshot of an API
that no longer exists.

**What that does not fix, stated rather than papered over.** Nothing holds a
diagram to the thing it describes. A `mermaid` fence rots exactly the way an
untested code sample rots, and section 5's entire argument is that this repo
refuses untested code samples for that reason. The asymmetry is real and it is
the one place this standard tolerates what it forbids elsewhere.

Two things make it survivable, and neither is a guard:

- **A diagram never carries information the prose does not.** This is decision
  12 and it is the load-bearing half. A stale diagram can then mislead, which is
  bad, but it can never be the only statement of a fact, which would be worse.
  It also follows from the two-layer rule rather than being a separate
  restriction: a diagram is a second presentation of the teaching layer, and a
  reader who cannot see it loses nothing.
- **A diagram whose nodes are the code's identifiers is partly checkable.** G5
  already extracts `@evanion/…` identifiers from fences and holds them to the
  package's exports; running the same extraction over `mermaid` fences catches a
  diagram naming a symbol that no longer exists. That is an extension of an
  existing guard rather than new machinery, and it is worth having because it is
  free. It catches renames and nothing else.

What neither addresses is a diagram that is structurally wrong — an arrow that
points the wrong way now, a boundary in the wrong place. That is caught by
review or it is not caught. A writer reaching for a diagram is choosing to
maintain it, and that choice is worth making deliberately rather than by
reflex.

**Where a diagram earns its place.** The shapes prose is bad at, which are
largely the pages section 5 just exempted from a playground: a topology
(`acl/federation`), a trust boundary (`acl/security`), a lifecycle or a state
machine (a listing's `draft` → `published`, and the deny that follows it), a
build-time transform (`feature/build-time`), and a request crossing processes
(`nestjs-correlation-id`). Where a diagram would only restate a list, the list
is better.

### Which control, per package

The choice is made by the reader's question, which is the rule
`2026-09-13-interactive-examples.md` § 1 already sets. Restated as a table over
every package, because that spec predates `acl` and predates `widget`:

| Package                 | Control                     | Why                                                                                                      |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `luhn`                  | probe (exists)              | The check character changing as the order number is retyped is the documentation.                        |
| `token`                 | probe (exists)              | `validate` separates `check-failed` from `outside-alphabet` only when a reader mistypes a pickup code.   |
| `urn`                   | probe (exists)              | RFC 8141 component splitting, shown in one call.                                                         |
| `react-widget`          | live code (exists)          | Its examples define components. Only evaluation shows that.                                              |
| `acl`                   | **specimen** (`AccessDemo`) | The question is "what does this person see", which is a rendered UI, not a returned value. Section 9.    |
| `feature`               | probe                       | `inRollout(customerId, 10, flagKey)` being stable per customer rather than random is invisible in prose. |
| `compose`               | **specimen**                | Its runtime claim — flat array, nested tree, order preserved — is a rendered tree. Section 10.           |
| `astro-widget`          | **specimen**, built once    | `.astro` compiles at build time. The control is the storefront's own output, embedded. Section 11.       |
| `nestjs-correlation-id` | none                        | The demonstrable unit is a running server. The demonstration page links `apps/` instead.                 |

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
listing with a status chip and an action bar where every control is a `can()`
answering. The policy on the right, seven statements, with the line that
answered lit as the role changes. The literals inside the policy are buttons:
strike `'bookseller'` out of a grant and the corresponding control disappears
while you watch. A second beat on Publish — the status flips, a deny rule fires,
and Edit leaves every role's bar.

Three rules follow, and they bind every control added under decisions 11 and 13.
They govern the inside of a control and not the page around it: the teaching
layer has already done its work by the time a reader reaches one.

1. **Consequence first, code second.** Inside the control, the reader sees the
   interface change before reading the source beside it. A demo that leads with
   a listing is a listing.
2. **The source is short enough to read at a glance.** If it needs scrolling it
   is evidence against whatever ease the package claims. This is the rule that
   killed the JSON editor, and it is the strongest of the three because it is
   the only one that can veto a design outright.
3. **The edit gesture suits the thing edited.** `DataDemo` uses move controls
   because the editable thing is an order and a nesting, and nobody retypes a
   layout. `AccessDemo` uses clickable literals because the editable thing is a
   small closed set — no parse errors, nothing to crash, and the policy stays
   short. A probe's single `<input>` is the third case: one argument, free-form,
   and the error path is the library's own exception.

And a fourth rule, with a boundary on it: **a demo that shows the package's own
output shape is a diagnostic.** A `Decision` object, a validation result, a
parse tree — these belong on reference pages, where a reader is checking their
code against the shape. The first `AccessDemo` design was exactly this and it is
why it sold nothing.

The boundary is that this only bites where the output is consumed by something
else. A `Decision` is not the product; the interface it configures is. But
`Luhn.generate('order-2026-0042')` returning a check character **is** the
product — a check character is what the caller wanted, not a description of what
the caller wanted — and the same holds for a generated pickup code and for a
parsed URN's components. So the three existing probes are demos rather than
diagnostics, and the rule is stated as: render the output shape only when the
output is the thing the reader came for. Where a package's return value is a
report about something else, the demo shows the something else.

`acl`'s section already places its diagnostics correctly: `acl/refusals` and
`acl/api` render `Decision` key for key, which is where that belongs.

## 6. One domain: the shop

### The shop already exists

`apps/storefront` is a board game shop called Baize. Its landing data opens with
`"lede": "on the table tonight"` over `urn:game:brass-birmingham` and a New In
row featuring `urn:game:spirit-island`; its cards say "Play before you buy —
four tables at the back, a library of 300 titles, no charge" and "Complexity,
not hype"; `src/lib/catalogue.ts` gives a game a title, a mechanism, a
complexity from 1 to 5, an availability state and a price, and carries seven
games by URN: `azul`, `brass-birmingham`, `crokinole`, `hive`, `root`,
`spirit-island`, `wingspan`. The design system is named Baize after the felt of
a card table.

The documentation is not in it. Counted on `origin/feat/acl` and on the package
READMEs: `acl` is a blog CMS (`comment` 32 times in nineteen doctested regions,
plus `article`, `authorId`, `draft`/`published`, roles `editor` and `staff`),
`feature` is a SaaS (`checkout-v2`, `plan: 'pro'`), `react-widget` is a
news-and-weather dashboard, `astro-widget` is a marketing page (`hero`,
`cards`), `compose` and `nestjs-correlation-id` are nothing at all. Three
sections already touch the shop without meaning to: `urn/examples.mdx` builds
`urn:game:Brass%3A%20Birmingham` to demonstrate percent-encoding, `token` mints
`ORD-a4kp-9mxa`, and `luhn/usage` signs `order-2026-0042`.

The two front-page demos are in two further worlds: the widget demo is a bike
workshop's dashboard and the acl specimen is a document editor with a publish
action.

### The rule

Every example in `apps/docs/content/` and every doctested region a page renders
is set in the shop. One domain, nine sections.

What that buys is the thing a journey cannot buy inside one section: vocabulary
that survives crossing a section boundary. A reader who met
`urn:game:spirit-island` in `urn` recognises it as the listing key in `acl`, as
the item id the shop page is composed from in `widget`, and as the line on the
order that `nestjs-correlation-id` follows across three services. Each crossing
is one less thing to learn, and the reader who has been through two sections
arrives at the third already holding half of the example. Section 2 makes a
section teach one thing at a time; the domain is what makes the site do it.

It also buys a place to stand when writing a new example. "What would the shop
call this" is answerable. "What noun should this example use" is not, which is
how a site ends up in five domains without anyone choosing.

What it costs is set out in full below, because it is not small.

### The vocabulary

The canonical names. An example draws from this list rather than inventing a
neighbour, and the list is short on purpose — a reader should be able to hold
it after one section.

| Thing         | The name                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| The shop      | Baize. A board game shop with four tables at the back and a library to play from.                                       |
| A game        | `urn:game:<slug>`, from the catalogue's seven: azul, brass-birmingham, crokinole, hive, root, spirit-island, wingspan.  |
| A listing     | A game's page in the shop: title, mechanism, complexity 1–5, availability, price. Its status is `draft` or `published`. |
| A question    | What a customer asks under a listing. Replaces `comment`.                                                               |
| People        | `customer`, `bookseller` (shop staff), `owner`. Three roles, which is what a role switch can show.                      |
| An order      | `order-2026-0042`, signed with a check character by `luhn`.                                                             |
| A pickup code | `ORD-a4kp-9mxa`, minted by `token`, read back over the counter or the phone.                                            |
| Services      | `storefront` → `orders` → `stock`. The three processes one order crosses.                                               |
| A flag        | `new-checkout`, `demo-night-booking`. Named for what the shop is rolling out.                                           |

`urn:game:` is already the storefront's namespace and is not invented here.
`order-2026-0042` and the `ORD` prefix are already in `luhn` and `token`.

### Where it binds, and where it does not

**Binding** on every teaching page: overviews, getting-started, setup tiers,
demonstrations, question pages and platform guides. These are the pages that
carry a narrative, and a narrative in a domain the reader is learning is the
whole point.

**The default, not a requirement,** on reference pages. An `api.mdx` example's
job is to show the shape of a call, and where a shop noun makes the example
longer than the point, the minimal example wins: `urn:example:a123` on the page
that documents NSS encoding is clearer than a game title, and RFC 8141's own
examples are already `urn:example:`. A reference page is entered from anywhere
(section 2) and builds no vocabulary, so it owes the domain nothing.

**Never forced** where the domain would have to invent a system this repo does
not have. The shop supplies nouns; it does not supply an excuse to describe a
warehouse that was never built. Where a package's subject has no shop object in
it, the exemption below applies rather than a coat of paint.

An exempt package records it on its `navigation.ts` entry as
`domainExempt: 'reason'`, the same mechanism as `demoExempt`, and G9 reads it.

### The mapping

| Package                                    | In the shop                                           | The example                                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `widget` / `react-widget` / `astro-widget` | The shop page, composed from data                     | `landing.json` is already it. The demonstration composes a listing page and the counter's own back-office view from items.                                                   |
| `urn`                                      | Naming a game and its editions                        | `urn:game:brass-birmingham`, an edition as a q-component, a rules section as an f-component. Already half-written.                                                           |
| `luhn`                                     | A check character on an order number                  | `order-2026-0042` plus its character; the dictionary is the alphabet that drops the glyphs a customer mis-hears.                                                             |
| `token`                                    | A pickup code a customer reads back over the phone    | `ORD-a4kp-9mxa`. `validate` separating `check-failed` from `outside-alphabet` is the counter staff's two different problems.                                                 |
| `acl`                                      | Who may edit a listing, publish it, answer a question | `comment` → `question`, `article` → `listing`, `editor`/`staff` → `bookseller`/`owner`. `draft`/`published` and the whole field-permission story survive unchanged.          |
| `feature`                                  | Rolling a new checkout out to some customers          | `inRollout(customerId, 10, 'new-checkout')`, stable per customer, which is what a shop needs and a coin flip is not.                                                         |
| `nestjs-correlation-id`                    | Following one order across services                   | `storefront` → `orders` → `stock`, one `X-Correlation-Id`, one order. Fits the nouns; the repo has no such services, so the example describes them rather than running them. |
| `compose`                                  | —                                                     | Exempt. Below.                                                                                                                                                               |

`acl` is the largest single job in this document. The rename touches nineteen
doctested regions in `libs/acl/README.md`, the worked matrix documents in
`matrix.mdx`, `authoring.mdx`, `writing.mdx` and `fields.mdx`, and four platform
guides built around an `order` that already fits. It is mechanical — the
permission keys, the field lists, the deny rules and every decision the pages
assert all keep their shape — and it is 22 pages of mechanical.

### `compose` is the package that resists

`compose` composes React providers. Its subject is the nesting of a provider
tree and the type relationship between a component and its props tuple, and
there is no shop object anywhere in that. The domain can supply the provider
names — the storefront does nest a theme, a cart and a currency — but the thing
a reader is learning is not the cart. It is that `provider(ThemeProvider, {
primaryColor: 'blue' })` fails to compile because `'blue'` is not
`'light' | 'dark'`, and that claim reads worse, not better, with a shop noun in
it. `compose/type-checking.mdx` asserts eight distinct type failures; wrapping
each in a cart would add a word per line and no meaning.

So `compose` takes `domainExempt: 'the subject is the provider tree; a shop
object appears nowhere in it'`, and its examples stay `ThemeProvider` and
`primaryColor`. Its demonstration (section 10) may name the storefront's real
provider stack, because there the nesting is the point and the providers are the
shop's own.

`nestjs-correlation-id` is the near miss and is not exempt. The nouns fit — an
order crossing three services is exactly what a correlation id is for — but the
repo has no such services, so the example is written rather than run. That is a
`no-run` problem, which section 5 already has a tag for, not a domain problem.

### The two front-page demos

Both are re-themed. The arguments are different and the second one needs making
rather than asserting.

**The widget dashboard, re-themed.** It is a bike workshop's back office: a
figures row and two tables — jobs on the stands, parts on order — inside an app
shell, composed from seven items with move controls in the gutter. Its beat is
nesting: moving `desk` above `week` carries two boards and three figures as one
block, which is the thing a flat `items.map` cannot describe.

Nothing structural changes when the shop takes it over. A shop counter has the
same shape: a figures row (games in, sold this week, turnaround), and two boards
— tonight's tables, and reprints on order. The widget types rename, the rows
change, and the tree walk, the move controls, the listing and `tree.test.ts`'s
structural assertions are untouched. It is an hour of copy. The demo was
committed as work in progress and has not been looked at in a browser, which
means the change lands before anyone has formed an attachment to the bikes.

**The acl specimen, re-themed, and this is the one that needs an argument.**
The owner has said he loves it, and a re-theme of something loved has to be
shown not to touch the part that is loved.

What it does: a role switch over three people, an action bar where every control
is a `can()` answering rather than a hand-written condition, policy statements
whose literals are buttons so that striking a role out of a grant removes the
control while the reader watches, and a second beat where publishing fires a
deny rule and takes Edit away from everyone.

None of that is the noun. The mechanism is the same four moves over a listing as
over a document, and each one lands at least as well:

- The three actions map without strain. Comment on a document becomes a customer
  question under a listing; edit becomes edit; publish becomes publish, and a
  shop listing has a genuine draft state — a game that has arrived but is not
  priced yet.
- The deny beat survives exactly. A published listing carrying a deny over
  `edit` is a rule a shop would actually write.
- The roles get better. `viewer`/`editor`/`owner` are software words. A
  customer, a bookseller and the shop's owner are three people a reader can
  picture, and picturing them is what makes the role switch mean something.
- The question the demo answers gets sharper. "Who may publish this listing" is
  a question a shop has. "Who may publish this Q3 retrospective" is a question
  the reader has to take on trust.

The cost is the copy in `AccessDemo.tsx`, the grants and role names in
`access.ts`, and the expected strings in `access.test.tsx`. No state, no layout,
no animation and no assertion about `@evanion/acl` changes.

**What is not done:** the refund action does not go in the specimen. A shop's
refund is the sharpest permission question the domain offers and it is tempting
as a third beat, but the demo has three actions and two beats and the second
demo rule — the source is short enough to read at a glance — vetoes a fourth.
Refund belongs in `acl/asking` and on the field-permission pages, where the
reader is reading rather than watching.

**If this is judged wrong,** the acl specimen is the one to leave alone, and the
decision is recorded here rather than left to whoever picks up the work: the
coherence is worth more than one demo's copy, and the copy is all that is at
risk.

## 7. What "done" means for a page

A page ships when all of these hold. This is the list an agent is handed.

1. It is listed in its section's `_meta.ts`, in reading order, with an
   editorial title.
2. It has exactly one `# ` heading, and it is not the package name unless the
   page is the overview.
3. If it teaches, it introduces one concept, named in its first two sentences,
   and it does not list its prerequisites — its position in `_meta.ts` is the
   statement.
4. If it teaches, it uses no symbol, option or concept a later teaching page
   introduces. This is the item with no guard behind it (section 12) and it is
   checked by whoever reviews the page.
5. Its teaching layer is complete on its own: read with every control removed,
   the prose, diagrams and fences still explain the concept and show how to work
   it. No sentence directs the reader to a control for a meaning the text does
   not state.
6. If it introduces a concept, it carries a control, or it carries one of
   section 5's named exemptions, stated on the page.
7. Every diagram in it is a `mermaid` fence and says nothing the prose does not.
8. Every example in it is set in the shop, or the section carries a recorded
   `domainExempt`, or it is a reference page taking section 6's minimal-example
   allowance.
9. Every TypeScript fence is a `file=… region=…` reference or carries an
   exemption tag.
10. Every region it references exists and executes in the package's test run.
11. It is under 1,200 words of prose, counting neither fences nor generated
    signatures.
12. It is one kind of page from section 4, and the Diátaxis diagnostic in
    section 3 does not fire on it.
13. If it is the demonstration page, it mounts the section's control.
14. Every `@evanion/…` symbol it names is exported from that package's entry.
15. Every internal link it makes resolves to a page that exists.

## 8. Ordering: separators, not folders

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

There is a second reason, and under decision 2 it is the stronger one. A
`_meta.ts` is now the section's teaching order, and an order has to be one list.
A folder hides part of it in another file, so what a reader walks is assembled
from two places and nobody reviewing a page can see from one file what that page
is allowed to assume.

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
section 3: "Please do not make me click on 'reference' to get to 'API docs'… it
tends to turn 1-click docs into 2-click docs", and "Some projects, when they
move to diataxis, will create a top level section called 'reference' and have a
single item under it called 'API'." A separator with the same title costs
nothing and hides nothing.

## 9. The front page and the section

The landing page is `app/page.tsx`, rendered as a `@evanion/react-widget`
region: every section of it is an item, placed by `items.ts`, rendered by the
component its `type` names. It sells. A reader arrives from npm or from a link,
scans tiles, and leaves for a section.

It is also the site's only entry point that is not a section, which under
section 2 makes it the one place the reader chooses a journey rather than
walking one.

**Belongs on the front page only:** the tile grid, the group lines, the platform
chips, the unreleased ribbon, the one-sentence description per package. All of
it is comparative — it exists to help a reader choose between packages, which is
a question no section can answer.

**Belongs in the section only:** installation, every API detail, every caveat,
anything with a version on it.

**Must appear in both:** every runnable control. This is decision 18 and it is
the one the current site breaks worst.

`AccessDemo` is the best thing on the site, and the only control anyone has
said so about. It renders a document with comments, switches the signed-in role
between three people, and lights up the policy literals that produced what is on
screen — and it is reachable from exactly one place: the landing page, above the
fold, for a package whose 22-page section contains nothing clickable. A reader
who follows the tile into `/acl` gets 21,847 words and 119 fences and never sees
it again.

The same holds, less severely, for `LuhnSpecimen`, `TokenSpecimen` and
`UrnSpecimen`: the section has a probe, which is a different and smaller thing
than the card, and `DataDemo` — the widget demo the owner named as the model —
appears nowhere under `/react-widget`.

The rule: a component under `components/landing/` that a reader can operate is
registered in `mdx-components.js` and mounted on the demonstration page of the
package it advertises. The landing page keeps its copy. They are the same
component with the same test.

Both are re-themed into the shop first; the argument is section 6 and it is made
there because it is a domain decision rather than a placement one.

What this costs: `AccessDemo` is a `'use client'` component importing
`@evanion/acl`, which the docs app already depends on. Mounting it in MDX is a
map entry and a tag. `DataDemo` is the same. The landing CSS is imported by
`app/page.tsx` rather than by the components, so the two that are mounted
outside the landing page need their styles to follow them — that is the only
real work in decision 18.

## 10. `compose`, concretely

Three pages, 2,038 words, 21 fences, none executed, no `_meta.ts`, no control,
and the one section exempt from the domain (section 6).
What it needs, in order:

1. **`_meta.ts`**: `index` → `getting-started` → `type-checking` → `api`. That
   is the teaching order: what it is, one working tree, the type relationship that is the
   package's actual claim, then the reference off the end of it. Today the
   section has no getting-started page at all and Nextra orders what exists
   alphabetically, so it opens on `api`.
2. **Doctest wiring**: `docExamples()` into `libs/compose/vite.config.ts`, the
   way `libs/urn` does it. The package's runtime surface is `ComposeProvider`
   and `provider`, both of which render React, and the doctest setup does not
   render React today. This is the same gap `libs/widget` has and it is the one
   blocking item. Either the doctest environment gains
   `@testing-library/react` — `libs/compose/src/test-setup.ts` already has it —
   or `compose`'s regions come from `Compose.test.tsx` rather than from the
   README under decision 15.
3. **`getting-started.mdx`**: install, the flat-array-to-nested-tree conversion
   the overview currently opens with, one executed region, and one concept — that
   a list becomes a tree in the order written. Nothing about types.
4. **The control**, built to section 5's four rules, and on `getting-started`
   rather than only on the demonstration, because that is the page that
   introduces the concept. `compose`'s claim is that a flat array becomes a
   nested tree in the order written. The consequence is a rendered tree of
   labelled boxes; the code is a seven-line `providers` array beside it; and the
   editable thing is an ordering, which is a small closed set, so the gesture is
   moving a chip rather than typing into an editor. React-live is the wrong
   mechanism here for the same reason the JSON editor was wrong for `acl`: it
   makes the source long and gives the reader a way to produce a syntax error in
   a demo that has nothing to parse.

   The providers in it may be the storefront's own — a theme, a cart, a currency
   — because there the nesting is the point and the stack is the shop's. That is
   the extent to which the domain reaches this package.

   `2026-09-13-interactive-examples.md` § 2 ruled `compose` out on the grounds
   that "the runtime result of composing three functions is not surprising". It
   is right that the result is unsurprising and wrong that this makes it not
   worth showing: the reader's question is "does my provider order survive", and
   a nested box that visibly reorders answers it in one move. The same spec's
   objection that "a type error is not renderable" is answered by step 5.

5. **`type-checking.mdx` under decision 15.** This is the interesting one, and
   under section 2 it is the second concept rather than an appendix: the reader
   has a working tree from step 3 and now learns what the compiler holds it to.
   `libs/compose/src/Compose.test-d.tsx` already asserts eight distinct type
   failures with `@ts-expect-error`, each with a written reason —
   "primaryColor is required by ThemeProvider", "'blue' is not assignable to
   'light' | 'dark'", "the second tuple entry must be props, not another
   component" — and `vitest typecheck` executes them against
   `tsconfig.spec.json`. `content/compose/type-checking.mdx` hand-writes its
   type-error examples instead, so the page's claims about the type system are
   the one part of the section with a working test right next to it and no link
   between them.

   Decision 15 closes that: the region parser learns `// #region name` and
   `// #endregion name` in `.ts`/`.tsx` sources, taking the lines between the
   markers rather than requiring a fence, and `type-checking.mdx` renders
   `file=libs/compose/src/Compose.test-d.tsx region=missing-prop` with the
   `fails-type-check` tag. The page then shows the eight failures the compiler
   is asserted to produce. Under section 5 this is evidence rather than
   interaction, and the page says so.

   This is the general answer to "a type error is not renderable", and it
   applies to `libs/urn/src/lib/urn.test-d.ts` and
   `libs/widget/src/define-widgets.test-d.ts` as well.

Result: four pages, one teaching order, one control, every fence executed or tagged.

## 11. `astro-widget`, concretely

Four pages, 2,600 words, 27 fences, none executed, no `_meta.ts`, no control.
It is the hardest section on the site, because 8 of its fences are `.astro`
components and nothing in this repo executes an `.astro` fence.

1. **`_meta.ts`**: `index` → `getting-started` → `validation` → `api`. The floor
   is met on page types; `validation` becomes the demonstration and moves ahead
   of the reference, which is where the teaching order wants it.
2. **Doctest wiring for the half that is TypeScript.** 13 of 27 fences are `ts`
   or `js`: the registry, the item shape, the context object, the validation
   errors. `libs/astro-widget` has a parity harness already —
   `tools/repo-checks/src/adapter-parity.astro.test.ts` — and the item shape it
   documents is `@evanion/widget`'s, which is where those regions belong. The
   items are the shop's page, which is what the storefront already feeds it.
3. **The `.astro` fences stay static, tagged `no-run`,** and this is the correct
   answer rather than a concession. An `.astro` component is compiled by Astro's
   own compiler against a project; there is no runtime for one in a browser and
   no bundler in scope will produce one. Section 5 names this as one of the
   cases where a control is not achievable, and the page says so.
4. **The control is `apps/storefront`.** The demo app already renders this
   package's output, it is already built in CI, its output is static HTML, and
   it is already the shop. Two options, and the cheap one is right: embed the
   storefront's rendered section markup in `validation.mdx` beside the
   `page.json` that produced it, generated at docs build time from the
   storefront's own build output, with a control that edits the JSON and
   re-fetches the matching prebuilt variant — this is `DataDemo`'s pattern with
   a fixed set of outputs instead of a live renderer. The expensive option is
   running the Astro compiler in the browser, and it is not worth it for one
   section.

   If the cheap option is judged too clever, the fallback is a link to the
   deployed storefront with a screenshot, and `astro-widget` becomes the second
   section exempt from decision 13. That is a real possibility and the guard
   in section 12 must take an explicit per-section exemption rather than
   special-casing a slug.

5. **`validation.mdx` gains the executed error cases.** The package's validation
   errors are thrown by TypeScript, not by Astro — `0f164d4` is a fix to exactly
   this path — so they are doctestable today with no new machinery.

Result: four pages, one control or a recorded exemption, 13 fences executed and
8 tagged `no-run`.

## 12. What a guard can enforce

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
about fifteen lines in the existing file. Under decision 2 it is also the
closest thing the journey has to enforcement: it cannot check that the order
teaches, but it can guarantee that the order exists and that no page is outside
it.

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
`demoExempt: 'reason'`. Fails today on six sections. It holds the section floor
only. It says nothing about the two layers: a guard can see that a control is
mounted and cannot see whether the prose around it teaches, which is the half
decision 11 actually turns on.

**G5 — no doc names an unexported symbol.** Every `import { A, B } from
'@evanion/x'` in a fence is checked against what `libs/x/src/index.ts` exports.
42 such statements today across the site. Cheap, because every package has a
single `.` entry in its exports map, and it catches the failure that makes a
copy-pasted example fail for a reader in the most confusing way. Two extensions,
both free once the extraction exists: every identifier in a `signature` fence is
an exported type or value, and every `@evanion/…` identifier in a `mermaid`
fence is too, which catches a diagram left naming a renamed symbol. Neither
extension sees whether a diagram is still true.

**G6 — every landing specimen is reachable from a section.** Every component
under `components/landing/` that takes an interaction is in
`mdx-components.js`'s map and appears in at least one `.mdx` page. Fails today
on `AccessDemo` and `DataDemo`.

**G7 — internal links resolve.** Every `](/…)` in `content/` names a page in the
content tree or a route the app defines. Nextra does not check this and a
renamed page leaves a 404 behind. Cheap, and it is what makes decision 16's URL
move safe.

**G8 — the word budget.** A word count per page, over the prose only. Fails
today on nine pages. Trivial to compute, and the least valuable of the nine:
over-length is a symptom and the guard cannot say which half to move.

**G9 — the abandoned domain stays abandoned.** No fence in `content/` and no
region a page renders names `post`, `comment`, `invoice`, `article` or `blog` as
a domain object, unless the section carries `domainExempt: 'reason'`. Fails
today on `acl` most of all. It is a ratchet like G3 and its limit is honest: a
deny list can prove an example left the old domain and can never prove it
arrived in the new one. Whether an example is set in the shop is a reading.

G1, G2, G3, G4, G6, G8 and G9 fail on the current content, counted. G5 and
G7 have not been run — the site's 42 package imports and its internal links have
not been resolved by hand, and either could pass clean.

### What is enforced, and what rests on a reviewer

Most of this document has machinery behind it. Executed examples have G3 and G5,
a demonstration page has G2 and G4, the ordering files have G1, the domain has
G9, the length has G8, the links have G7. Three things have nothing, and they
are the three a reader most needs to know are conventions.

**The teaching order.** Decisions 1 to 3 are a rule a writer follows and a
reviewer checks, and a section whose order teaches badly will build clean. A
guard over it was considered and rejected. The obvious shape is a term list per
teaching page, checked so that no page uses a term or an API no earlier page
introduced. It was ruled out as too noisy to be worth having: a term list is a
second document to maintain beside every page, it drifts the moment prose is
edited, and a check that fires on ordinary writing trains people to silence it.
A bad guard is worse than none, because it converts a rule people follow into a
rule people route around.

**Whether the teaching layer stands alone.** G4 sees a control mounted. It
cannot read the paragraph above it, so "try changing the value" in place of an
explanation builds clean. This is the test decision 11 actually turns on and it
is a reading every time.

**Whether a diagram is still true.** G5's extension catches a renamed symbol in
a `mermaid` fence. Nothing catches an arrow pointing the wrong way. Decision 12
— a diagram never carries information the prose does not — is what keeps that
failure from being load-bearing.

So the honest statement of this standard's enforcement, and a reader should be
able to tell these apart:

| Rule                                    | Fails     |
| --------------------------------------- | --------- |
| Ordering files, page-type presence      | the build |
| Executed fences, exemption tags         | the build |
| A control per section, specimen reach   | the build |
| Exported symbols, internal links        | the build |
| Prose budget, the abandoned domain      | the build |
| Cumulative order, one concept a page    | review    |
| Whether the teaching layer stands alone | review    |
| Whether a diagram is still true         | review    |
| Diátaxis as a diagnostic                | review    |
| Whether a control teaches               | review    |
| Whether an example is set in the shop   | review    |

The bottom six are the ones that will quietly rot, and knowing which they are is
the point of writing them down this way.

### Judgement, and no guard should pretend otherwise

- **Whether a page introduces one concept or two.** No count reaches this. "A
  deny beats an allow" is introduced by a sentence and used by an example that
  imports nothing new.
- **Whether the order is the right order.** A guard reads `_meta.ts` and holds
  the content to it. It cannot tell an order that teaches from a list that
  happens to be consistent.
- **Whether a control teaches or is a toy.** Section 5's three tests are
  written for a person. A guard can assert `AccessDemo` renders and agrees with
  `@evanion/acl`; it cannot tell whether lighting up the policy literals is what
  teaches the reader the matrix.
- **Whether a page leaves its meaning in a widget.** The failure is a sentence
  that instructs rather than explains, and it is invisible to every count.
- **Whether a diagram says more than the prose.** Decision 12 forbids it and no
  extraction compares the two.
- **Whether an example is in the shop.** G9 sees the nouns that left. Naming a
  variable `game` proves nothing.
- **Whether a page is one kind or two.** Section 3's diagnostic is a reading and
  is deliberately unenforced.
- **Whether an extra page is earned.** Section 4 gives four kinds, and deciding
  that a given page is a question page rather than a second reference page is a
  reading.
- **Whether the prose is any good.** Out of scope for machinery, permanently.
- **Whether an exemption tag is honest.** `no-run` on a fence that could run is
  invisible to a guard. G3's ratchet is a proxy: it makes the count visible and
  makes it go one way.

## 13. Order

Nothing here is a single pass over 63 pages.

1. **G1 and the `_meta.ts` files.** Six files, one guard, and it fixes the
   reading order of two thirds of the site. It is also the prerequisite for
   everything in section 2: an order that is not written down cannot be
   cumulative, and nothing else in this document can be reviewed against it.
   Independent of everything else.
2. **Decision 16**: `acl/integrations/` becomes a `Platforms` band. Before
   `@evanion/acl` publishes, which is what makes the URL change free.
3. **The two front-page demos into the shop** (section 6), then decision 18 and
   G6: `AccessDemo` and `DataDemo` into `mdx-components.js`, mounted on `acl`'s
   and `react-widget`'s demonstration pages. Re-theming first, so the components
   are moved once. This is the largest gain per hour of work in the document.
4. **G5 and G7.** Both cheap, both catch real breakage, neither needs content
   to change first.
5. **Diagrams where the teaching layer has the hole** (section 5). `acl/security`,
   `acl/federation`, `feature/build-time`, `nestjs-correlation-id`, and a
   listing's draft-to-published lifecycle. Nothing is built: Nextra renders a
   `mermaid` fence today. The cheapest teaching-layer gain in the document, and
   it is early because those five pages are the ones a playground cannot reach.
6. **Decision 15**: `// #region` in source files. One parser change in
   `tools/doc-examples/src/regions.mjs`, plus the `fails-type-check` tag.
7. **`compose`** (section 10), as the pilot for the whole standard. It is the
   smallest section, it exercises every new mechanism, and being the one
   domain-exempt package it separates the journey work from the re-theming work.
8. **Doctest wiring** for `feature`, then `astro-widget`, then `react-widget`,
   each one moved into the shop as it is wired, because a region is cheaper to
   write in the right domain than to rewrite. G3's ratchet starts here, per
   section, as each one lands.
9. **`acl` into the shop**, and G9 behind it. Nineteen regions and 22 pages,
   and the largest single job in this document. It is late because it is
   mechanical and because everything before it teaches what the rename should
   look like.
10. **Decision 19**: pick a declaration-to-MDX generator and put `acl`'s API
    reference on it, which is the single largest movement of the site-wide 14%
    and the one item here that is an evaluation before it is a task.
11. **`astro-widget`** (section 11), last, because its control is the one that
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
- G5's `mermaid` extension fails on a diagram naming an `@evanion/…` symbol the
  package no longer exports, and passes on a diagram whose nodes are the shop's
  own nouns.
- A `mermaid` fence in an MDX page renders under `output: 'export'` and reads in
  both themes, which is the one thing about the mechanism that has not been
  looked at.
- G9 fails on a fixture fence naming `comment` as an object kind, and passes on
  the same fence in a section carrying `domainExempt`.
- `AccessDemo` renders in an MDX page under `output: 'export'`, agrees with
  `@evanion/acl` on every decision it draws, and its chunk is absent from the
  landing page's chunk list — the assertion `specimens.test.tsx` already makes,
  extended to the second mount point. Its re-theming changes the expected
  strings in `access.test.tsx` and no assertion about the package.
- `tree.test.ts` holds the widget demo's listing to parsing back to what
  rendered, and the move to carrying nested items and span. Neither assertion
  changes when the demo moves into the shop, which is the check that the
  re-theming was copy.
- Every page passing section 7's list is asserted for one real page per section
  before the guard for that item is turned on.

## Where I am guessing

- **That the teaching order survives contact with `acl`.** Section 2 is tested
  against nothing. `acl` is the only section long enough for an order to matter,
  its Setup band is the one stretch of the site that already teaches
  cumulatively, and the other 19 pages were written without one. Whether they
  resolve into a teaching run plus three sideways bands, or into something a
  fourth band cannot express, is not known until someone writes the `_meta.ts`.
- **That an unenforced rule holds.** Decisions 1 to 3, the teaching layer's
  completeness and a diagram's truth are conventions, by section 12. Every other
  convention this repo has kept has a guard behind it, and the ones that do not
  have historically drifted. The mitigation is that the teaching order is
  visible in one file per section, so that review at least is a file
  read rather than a site read — which is a reason to expect it to hold and not
  evidence that it will.
- **That a control on every concept-introducing page is affordable.** Section 5
  raises the floor from nine controls to somewhere between fifteen and twenty-
  five, and the site has four. The named exemptions are an attempt to keep that
  honest rather than a measurement of how many pages will take them.
- **That writers will keep the two layers separate under deadline.** The cheap
  failure is to build the control, see it explain the concept, and let the prose
  thin out around it. That is the one this document names and it is also the one
  that feels like progress while it happens. Nothing but a reviewer stands
  against it.
- **That a `mermaid` fence is enough of a diagram.** Nextra 4 renders one with
  no work, which settles the mechanism and not the medium. A topology and a
  lifecycle are what Mermaid is good at; a trust boundary may want a drawing
  Mermaid cannot make, and the answer if so is not a committed PNG. What it is
  instead is not decided here, because no page has hit the limit yet.
- **That diagrams will be maintained at all.** The site has zero today, so the
  standard is asking for a kind of content nobody here has yet had to keep
  current, held to a weaker bar than everything around it. Decision 12 bounds
  the damage and does not make the upkeep happen.
- **That the `acl` re-theme is as mechanical as section 6 claims.** `comment`
  appears 32 times in nineteen regions and the field-permission story is built on
  `title`/`body`/`status`/`visibility`, which a listing carries as
  title/description/status/availability. The mapping looks clean on paper and I
  have read the regions rather than run the rename.
- **That one domain holds for nine packages.** `compose` was found to resist
  before anyone tried to write in it. A second may turn up when someone writes
  `feature/build-time` or `astro-widget`'s registry in a shop, and the exemption
  mechanism exists because I expect at least one more.
- **That re-theming `AccessDemo` costs what section 6 says.** I have read the
  component and `access.ts` and have not run either, and the claim that no
  layout or animation changes rests on the copy being the only thing the shop
  touches.
- **That `astro-widget`'s prebuilt-variant control is buildable.** Section 11
  step 4 describes generating markup from the storefront's build output at docs
  build time. I have not checked whether the storefront's Nx build output is
  reachable from the docs build, or whether the two builds can be ordered. If
  they cannot, `astro-widget` takes the exemption and decision 13 covers eight of
  nine packages rather than nine.
- **That `compose` can be doctested without a new test environment.**
  `libs/compose/src/test-setup.ts` exists and the package's own tests render
  React, so the pieces are there. Whether `docExamples()`'s vitest workspace
  picks that setup up for a README fence is not something I traced.
- **The 1,200-word budget.** It is the median of the current pages rounded down,
  not a measurement of what a reader tolerates. It is the number in this
  document I would most expect to be moved, and moving it changes which seven
  pages fail rather than whether the rule is right.
- **That four bands is the right ceiling** rather than three. Section 4 arrives
  at four by resolving `acl`'s own shape, which is reasoning from the one
  example, and the one example was written without a standard.
- **Decision 19's generator.** `acl`'s API reference fences are grouped
  signatures — a whole `interface Access` in one block — rather than calls, and
  a signature is not a doctest. Stripe generates the equivalent from OpenAPI and
  Diátaxis asks for the same thing in different words ("the structure of the
  documentation should mirror the structure of the product"), so the direction is
  not in doubt. What is: whether TypeDoc or api-extractor can emit blocks that
  drop into MDX without dragging their own page layout in, and what that does to
  the docs build. I have not evaluated either. Until one is chosen, the
  `signature` tag plus G5 is the fallback, and it is weaker than decision 10
  claims — it checks the names, not the types.
- **That the four demo rules generalise.** They are extracted from one artifact
  and two of its discards. `AccessDemo` is a policy engine configuring a UI,
  which is the case where consequence and code are two different things on the
  screen. Whether "consequence first" means anything for `urn` — where the
  consequence _is_ the parsed components — is not something one example can
  settle, and section 5's boundary clause is my attempt to draw the line rather
  than a line anyone has tested.
- **Whether the landing specimens survive being mounted twice.** `AccessDemo`
  reads `landing.css`, which `app/page.tsx` imports. Moving the import into the
  component is the obvious fix and I have not checked what it does to the
  landing page's 6.7 kB client chunk.
