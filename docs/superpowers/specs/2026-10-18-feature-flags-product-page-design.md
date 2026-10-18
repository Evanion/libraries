# Feature flags product page (`/feature-flags/`)

Status: approved by the owner (2026-10-18). Project 2 of `2026-10-18-libs-site-and-product-pages-design.md`. The
first family page; it sets the pattern the authorization and rendering pages
reuse.

## Outcome

A page at `https://libs.evanion.com/feature-flags/` that wins search traffic and
lets a developer who has never seen `@evanion/feature` understand, by using it,
what it does and why to choose it: fun, low-technical, interactive. It hands the
reader to the docs to implement.

Success means: a fresh cold reader using only the browser can say in their own
words what the library is and why they would pick it, and names at least one
scene that made a capability click; every demo answers from the real library;
the page is in the sitemap with its own title, description and structured data.

## Angle (shared with the frontpage, the docs overview and the README)

Feature definitions are a plain document you own. One library decides them in a
Node.js API, a build and the browser; a build decides what it already knows and
leaves the rest for the visitor. The page never mentions running, hosting or
paying for a flag service, and never names or compares other products.

## Page, top to bottom

1. **Hero.** Bold promise in the angle above, one supporting line, buttons:
   "Get started" (`/docs/feature/getting-started/`), npm, GitHub. Below them the
   existing frontpage demo (`components/landing/FeatureDemo.tsx`), reused
   unchanged.
2. **Scene: ship on a schedule.** A clock the reader scrubs forward past a launch
   time. `new-checkout` has a rule with a window condition (on after a launch
   instant); it turns on at that instant for everyone, with no deploy. Caption
   fact: the answer depends only on the instant passed in, so the server and the
   browser agree. Link: `/docs/feature/configuration/` (conditions).
3. **Scene: one switch, everything that depends on it.** A tree: new checkout →
   express pickup → demo-night booking. Switching the parent off first shows a
   confirm step listing what goes with it (`toggle()`'s `willDisable`, computed
   before the write against a copy of the store, so cancel changes nothing);
   confirming darkens the branch and each node states why in plain words
   ("off because new checkout is off"). Link: `/docs/feature/decisions/`.
4. **Scene: A/B tests that stay put.** Two variants, a weight slider, 24 visitors
   coloured by variant (`resolve` with `targetingKey`). Moving the weight
   recolours only visitors at the boundary; a visible count says how many moved.
   A toggle adds a rule pinning booksellers to variant B; three of the 24 are
   booksellers and are marked. Link: `/docs/feature/variants/`.
5. **Scene: no flicker on load.** Two small browser frames and a Replay button.
   Left, labelled "decided in the browser after load": paints the old checkout,
   then swaps after a short delay (a labelled simulation of the client-only
   pattern). Right, labelled "decided on the server, adopted by the browser":
   the server's `DecisionSet` arrives with the page and `adoptDecisions` makes
   first paint correct. The right side runs the real library. Respects
   `prefers-reduced-motion` (no animation; both end states shown with a caption).
   Link: `/docs/feature/hydration/`.
6. **Use it in React.** One short snippet whose text is an existing tested
   region of `libs/react-feature/docs/examples.md`, read at build time; never
   hand-written code on the page. Link: `/docs/react-feature/`.
7. **Install and next steps.** `npm install @evanion/feature`; links to Getting
   started, the API reference and GitHub.

Every scene: an H2 that names the benefit, a two-sentence lede, the demo, a
one-line caption, and a "How it works" link into the docs page above. Copy is
plain words; library names (`toggle`, `targetingKey`) appear only inside the
demo's code view, never in headings or ledes.

## Structure (built for reuse across every product page)

Adding the authorization or rendering page must mean writing a definition and
its demos, not a new page component, layout or metadata code.

- **One route for every product page:** `apps/docs/app/(product)/[product]/page.tsx`
  with `generateStaticParams` and `generateMetadata` read from a registry. The
  `(product)` route group has its own layout (site header and footer, no docs
  sidebar) and sits outside the content tree, so the archive cutter and the docs
  version machinery never touch it. Product slugs never collide with docs paths
  (`/docs/...`) or the root tools (`/matrix-explorer/`).
- **The page is data:** a typed `ProductPage` definition per family
  (`components/product/pages/feature-flags.ts`) holding slug, family id (the
  group in `app/navigation.ts`), metadata, hero, an ordered list of scenes,
  the code sample's region, install command and the next-step links. Every
  heading, lede, caption, button and link lives there, so prose changes never
  touch components. `components/product/registry.ts` lists the definitions.
- **One renderer:** `ProductPageView` renders any definition: `ProductHero`,
  each `Scene` (H2, lede, demo slot, caption, "How it works" link),
  `CodeSample`, `InstallBlock`, `NextSteps`. Metadata and JSON-LD are built
  from the definition by one function (`productMetadata`), not per page.
- **Demos by id:** a scene names its demo by id (`'schedule'`, `'cascade'`,
  `'variants'`, `'no-flicker'`, `'rollout'`); `components/product/demos.ts` maps
  ids to client components. A definition references demos; it never imports
  React.
- **Shared demo primitives**, extracted so every family's demos are built from
  the same parts and look alike:
  - `VisitorCrowd`: the grid of focusable visitor dots with a legend, a live
    count and a per-dot reason (used by rollout and variants; the frontpage
    `FeatureDemo` moves onto it).
  - `CodeView`: the document shown as code with the line a control changed lit
    (used by every demo that shows its document; `FeatureDemo` and
    `AccessDemo` move onto it).
  - `Scrubber` (a labelled time slider), `ReplayFrame` (a small browser frame
    with Replay and reduced-motion end states) and `DecisionTree` (nodes with an
    on/off state and a plain-words reason).
    Each primitive is presentation only: it takes values and callbacks, imports
    no library, and has its own render test. The library calls stay in each
    demo's logic module.
- **Each scene's logic:** a pure `.ts` beside its demo that builds a real store
  with `createFeatures` and answers from `resolve`, `plan`, `toggle` or
  `adoptDecisions`.
- **Family links come from the registry:** the frontpage section and the docs
  overview link to a family's product page through the registry (a product slug
  per navigation group), so a new page appears in both by being registered.
- Styling: baize-ui tokens, the landing page's classes and the family hue;
  light and dark; usable at 360px wide with no horizontal scroll.

A registry contract test runs over every registered definition: metadata and
JSON-LD present, at least one scene, every demo id known, every docs link
resolving to a served docs path, the code sample's region existing. A new
product page is covered by being registered.

## Search

`generateMetadata`: title "Feature flags you own | @evanion/feature" (final
wording from Gemma), description, canonical
`https://libs.evanion.com/feature-flags/`, Open Graph title and description.
JSON-LD `SoftwareSourceCode` with name, description, `codeRepository`,
`programmingLanguage: TypeScript`, `license`. The page enters `sitemap.xml`
through the existing export walk; a test asserts it does.

## Links into the page

The frontpage's feature section and the docs overview `content/next/feature/
index.mdx` link to `/feature-flags/`. The README gains the link at the
package's next release (out of scope here).

## Copy

Gemma writes every heading, lede, caption and button through `gemma.mjs`, in
dialogue at page level: the whole page's copy, the reader's situation (never
seen the library; wants to know what it is, whether it is worth it, why choose
it) and feedback she may push back on. Facts only from this spec and the docs;
fact-fix only claims about the library that are wrong.

## Quality gates

- Unit tests per scene logic: schedule (off before the instant, on at and after
  it); cascade (`willDisable` lists exactly the dependants, cancel leaves the
  store unchanged, confirm turns them off with `dependency-off`); variants (a
  weight change moves only boundary visitors; the pin overrides the bucket);
  no-flicker (the adopted first-paint decision equals the server's).
- Render tests per demo (server and client render the same opening state).
- The registry contract test above (links, demo ids, region, metadata).
- Render tests for each shared primitive; `FeatureDemo` and `AccessDemo` keep
  their existing tests green after moving onto `VisitorCrowd` and `CodeView`.
- Sitemap test: every registered product page is in `sitemap.xml`.
- One cold read of the whole page by a fresh agent using only the browser
  before the PR merges; its findings are fixed or ruled on.

## Out of scope

The authorization and rendering pages (they reuse this page's blocks in later
specs), Open Graph images, README links, analytics.
