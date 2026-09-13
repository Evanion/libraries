# Widget API unification: a core and one package per framework

Status: approved, not implemented
Packages: `@evanion/react-widget` 0.2.0, `@evanion/astro-widget` 0.2.0 (both published
2026-09-10). Adds `@evanion/widget` as a framework-free core. Svelte, Vue and Solid
adapters are planned and this spec is shaped around five, not two.
Depends on: nothing unimplemented. `docs/specs/2026-09-10-react-widget-rsc.md` is
shipped (#81) and its constraints carry forward unchanged.
Related: `docs/specs/2026-09-11-feature-toggles.md` (whose core-plus-`./react` shape is
the one rejected here, for reasons that do not apply to it),
`docs/specs/2026-09-12-react-widget-virtualization.md` (unaffected; React-adapter work)

## The problem, sized

The two packages present one model under two vocabularies. Nothing is shared, not even
a noun:

| Concept    | `@evanion/react-widget` | `@evanion/astro-widget` |
| ---------- | ----------------------- | ----------------------- |
| factory    | `createWidgets`         | `defineBlocks`          |
| the item   | `WidgetItem`            | `BlockItem`             |
| the map    | `WidgetComponentMap`    | `BlockRegistry`         |
| validation | `validateItems`         | `validateBlocks`        |
| problem    | `WidgetItemProblem`     | `BlockProblem`          |

The divergence goes past naming. The two item shapes are not the same data:

```ts
// react-widget
{ id: 'h1', type: 'hero', props: { heading: 'Hello' }, meta: { column: 1 } }

// astro-widget
{ type: 'hero', id: 'h1', heading: 'Hello', meta: { column: 1 } }
```

A CMS payload authored for one package does not render through the other. The docs
site's rendering group says "the same model in React and in Astro"
(`apps/docs/app/navigation.ts:63`) and that is not true today.

The cost is already paid once. The same prototype-chain bug sat in both validators and
was fixed twice, and `tools/repo-checks/src/inherited-type-keys.test.ts` exists only to
hold the two implementations to one rule. Its docblock argues that factoring the shared
part out would cost a third package or a React peer in an Astro tree. That argument is
re-measured below.

Two divergent implementations is a maintenance cost. Five would be a defect generator:
the prototype-chain bug would have had to be fixed five times, and the contract test
would have to pin five validators against each other.

## What is actually shared

Counted from source, excluding tests and `.d.ts`.

Public exports: react-widget 22, astro-widget 5 plus the `Widgets.astro` subpath.

| Part                                               | Lines |
| -------------------------------------------------- | ----- |
| react-widget total                                 | 738   |
| astro-widget total (incl. 66-line `Widgets.astro`) | 219   |

Splitting react-widget by whether the code names a React type:

| Module                           | Lines | Framework-free |
| -------------------------------- | ----- | -------------- |
| `validate-items.ts`              | 132   | yes            |
| `warn.ts`                        | 38    | yes            |
| `constants.ts`                   | 35    | yes            |
| `types.ts` — item, problem, meta | ~21   | yes            |
| `types.ts` — component-typed     | ~236  | no             |
| `widget.tsx`                     | 126   | no             |
| `utils.tsx`                      | 99    | no             |
| `widgets.tsx`                    | 31    | no             |
| `index.ts`                       | 20    | no             |

226 framework-free lines, and they subsume almost all of astro-widget: its
`validate-blocks.ts` (72) and `types.ts` (48) are the same rules under other names.
4 of react-widget's 15 exported types name no React type; the other 11 name
`ComponentType` or `ReactNode` and are genuinely framework-bound. `WidgetDataProps`,
`WidgetChildren`, `WidgetsChrome` and the `M` meta inference have no Astro counterpart
and cannot have one: an `.astro` module's default export is an `AstroComponentFactory`
carrying no prop types, which is why `BlockRegistry` is `Record<string, unknown>` today.

After extraction: 226 core lines, 512 React-bound, 87 Astro-bound. A Svelte, Vue or
Solid adapter is the same job as the Astro one — resolve a type to a component, spread
`props`, hand `meta` to chrome — so the expectation is 80 to 150 lines each. The core
does not grow with the fourth or fifth adapter; it is already everything that is not a
renderer.

## Decisions

1. A core package plus one package per framework. `@evanion/widget` holds the 226
   framework-free lines; `@evanion/react-widget` and `@evanion/astro-widget` keep their
   published names and become adapters; Svelte, Vue and Solid join as siblings.
2. Adapters pin the core exactly, not by range: `"@evanion/widget": "0.1.0"`. This is
   TanStack Query's answer and the reasoning is in § 3.
3. `nx.json` sets `release.version.versionPrefix: ''` and `updateDependents: 'always'`,
   so a core release rewrites every adapter's pin and republishes them in one run.
4. The vocabulary is widget/item. All five `Block*` names go.
5. The item shape is unified on the React shape — `{ id, type, props, meta?, children? }`
   — in every runtime. This is the change that makes the docs claim true.
6. `id` is required everywhere. It was optional on the Astro side.
7. One validator, in the core. `validateItems` carries both packages' rules, including
   the `required` field map that only astro-widget had.
8. `warnOnce` and `ERROR_MESSAGES` move to the core, and every adapter warns on an
   unknown type instead of skipping in silence.
9. Each adapter declares exactly one framework peer, non-optional.
10. `tools/repo-checks/src/inherited-type-keys.test.ts` is deleted. It pins a rule
    across two implementations; there is one implementation afterwards.

## 1. Why a core and five packages

### The shape the framework count forces

With two runtimes, a single package with `.`, `./react` and `./astro` entries was the
better answer, and an earlier draft of this spec chose it. Five runtimes breaks every
argument that supported it:

- The peer list. One package serving five frameworks declares five peers, all
  `optional`, and every consumer's manifest names four frameworks they do not use. npm
  never warns about an optional peer, so a Vue 2 project installing a Vue-3-only adapter
  gets silence where a real peer errors. The failure mode is silent and it scales with
  the framework count.
- The version stream. A Solid-only fix would publish a new version to every React
  consumer. Across two entries that is tolerable; across five the changelog becomes a
  stream most readers must skip to find their own framework's line.
- The tarball. Every consumer downloads all five adapters' source. Tree-shaking is a
  bundler concern and does nothing for the install.

Measured against this repository's own history, the version-stream cost is the one that
bites. Commits since 2026-08-01 touching React-only modules (`widget.tsx`, `utils.tsx`,
`widgets.tsx`): 12. Touching Astro-only modules (`components/`, `define-blocks.ts`): 8.
Touching the framework-free modules (`validate-items.ts`, `warn.ts`, `constants.ts`,
and astro's `validate-blocks.ts`/`types.ts`): 13. So adapter-local work is already the
majority at two adapters, and the ratio moves further that way with five, because the
core is finished in a way a renderer never is.

### The 87-lines argument, revised

An earlier draft made the decisive argument that astro-widget after extraction is 87
lines, which does not justify a package.json, a CHANGELOG, three tsconfigs, an eslint
config, two vitest configs, a `verify-packaging` row, a commitlint scope, a docs-nav
entry, a trusted-publisher configuration and a version number.

That argument was right about one orphan and wrong as a general rule. Most of that list
is boilerplate identical across this repository's libraries — `libs/luhn/tsconfig.lib.json`
and `libs/urn/tsconfig.lib.json` are byte-identical, as are their `eslint.config.mjs`
files — so it is generator output, and `tools/repo-checks/src/generator-collateral.test.ts`
already exists to clean up what `@nx/js:library` writes. The per-adapter work that is
not boilerplate is a package.json, a README, a `verify-packaging` row, a commitlint
scope, a docs-nav entry, and a one-time npm bootstrap. Five small packages of one shape
amortise that; one orphan does not.

### What the alternatives cost

One package with five entries was rejected on the three counts above, plus the cost of
retiring two published names.

Five packages with no core — the status quo extended — was rejected on the first
paragraph of this spec: it is the shape that produced the same bug twice, and it scales
that to five.

## 2. Precedent: TanStack Query, and the contrast

TanStack Query is this problem at scale, maintained through several majors. Read
from the registry on 2026-09-13, all names under the `@tanstack/` scope:

| Package                      | Version | Core dependency      | Peer            |
| ---------------------------- | ------- | -------------------- | --------------- |
| `query-core`                 | 5.102.8 | —                    | —               |
| `react-query`                | 5.102.8 | `query-core` 5.102.8 | `react`         |
| `vue-query`                  | 5.102.8 | `query-core` 5.102.8 | `vue`           |
| `solid-query`                | 5.102.8 | `query-core` 5.102.8 | `solid-js`      |
| `angular-query-experimental` | 5.102.8 | `query-core` 5.102.8 | `@angular/core` |
| `svelte-query`               | 6.1.48  | `query-core` 5.102.8 | `svelte`        |

Four findings, each of which decides something here.

The core pin is exact, never a range. Every adapter names `5.102.8`, not `^5.102.8`.

Adapters release without the core. `query-core` has 436 published versions;
`react-query` has 532. Those 96 extra releases are adapter-local changes that never
touched the core. This is the independence that the single-package shape cannot offer.

The core never releases without the adapters. An exact pin has to be rewritten when
the core moves, so a core release republishes every adapter. All four packages checked
carry publish timestamps within 60 seconds of each other on 2026-08-27 — one release
run, not four.

An adapter's own version stream can leave the core's. `svelte-query` is on 6.1.48
while pinning core 5.102.8 — a guess as to why, from the peer range `^5.25.0`:
Svelte 5 forced a major on that adapter alone, and it took one without dragging the
other four or the core with it. So "lockstep" means
lockstep on the core pin and on the release run. It does not mean a shared version
number, and an adapter is free to have its own major when its framework forces one.

### The contrast: testing-library

The same fan-out with the opposite answer. `@testing-library/dom` 10.4.1 is a caret
_peer_ of `@testing-library/react` 16.3.3 and `@testing-library/angular` 19.5.0
(`^10.0.0`), and a caret _dependency_ of `@testing-library/vue` 8.1.0 — where the range
is `^9.3.3`, a major behind the current core. Every version number is independent.

That is what adapters lagging the core freely looks like, and the stale `^9.3.3` is the
drift it permits: a consumer with both packages resolves two copies of the core. It
works there because the core is a stable DOM query layer that rarely breaks. A widget
core holding the item shape is not that — the item shape is the contract every adapter
renders, and an adapter compiled against one version of it and running against another
is a rendering bug with no error message. Hence TanStack's exact pin rather than
testing-library's caret.

## 3. Release: pinning, ordering, and a correction

An earlier draft argued that a core-plus-adapters shape pays the `8fc85f9` tax on every
core change — publish the core, raise each adapter's range by hand, publish the
adapters. That was wrong, and the error is worth naming because it was the main argument
against this shape.

What happened in `8fc85f9`: `@evanion/token` depended on `@evanion/luhn` at `^2.0.1`
while its source needed `uniformOverBytes`, which arrived in luhn 3.0.0. The range could
not be written as `^3.0.0` before luhn 3.0.0 existed, because `@nx/dependency-checks`
and `verify-packaging` both reject a range excluding the installed version. That is a
bootstrap problem specific to a caret range naming a version that has not shipped, not a
standing tax on in-repo dependency edges.

Two nx settings dissolve it (`nx/schemas/nx-schema.json`):

- `version.versionPrefix: ''` writes the dependency as an exact pin. An exact pin never
  matches the core's next version, so `preserveMatchingDependencyRanges` — which only
  preserves a range that still matches — never preserves it. nx rewrites it during the
  version step, in the release run, with no follow-up commit.
- `version.updateDependents: 'always'` updates dependents even when a `projects` filter
  excludes them. `'auto'`, the default, would skip an adapter left out of a subset
  release and publish a core that adapter does not reference.

So the answer to whether the core can be published independently with adapters pinned to
a range of it: it can be published independently, and the adapters should not name a
range. A range is what allows the drift `@testing-library/vue` is currently sitting in.

### Do the adapters move in lockstep

Half of it, and the half that matters is the cheap half.

- An adapter-local change versions and publishes that adapter alone. This is the common
  case, measured at roughly 20 of 33 commits since 2026-08-01 and rising with the
  adapter count.
- A core change versions the core and republishes every adapter, as one `nx release`
  run. This is the rare case, measured at 13 of 33 and flat as adapters are added.
- An adapter may take its own major without the others, as `svelte-query` did. Nothing
  in this shape couples adapter version numbers to each other.

This is the measurement the shape turns on. If a core change forced a hand-coordinated
multi-release, the multi-package shape would carry the single package's coupling plus
its own overhead, and the single package would win. It does not: `updateDependents` and
an exact pin make it one run.

### Ordering

1. Land the core and both reworked adapters on `main` in one change. The repository
   resolves in-workspace imports through the `@evanion/source` condition, so the
   adapters compile against the core's source and nothing needs publishing to land.
2. Bootstrap `@evanion/widget` by hand, per `RELEASING.md` § "Bootstrap a package that
   has never been published": `npm publish --access public --no-provenance --otp=…`.
   A trusted publisher cannot be configured for a name that does not exist yet.
   `@evanion/widget` is unregistered on npm (checked 2026-09-13, 404).
3. Tag and push `@evanion/widget@0.1.0`. Without the tag, `nx release` reads commits
   from the beginning of history.
4. Configure its trusted publisher (Evanion / libraries / `release.yml` / `npm publish`).
5. Run the release for `react-widget,astro-widget`. Both take 0.3.0 —
   `adjustSemverBumpsForZeroMajorVersion` makes a breaking change on a 0.x package a
   minor bump.
6. Every release after this is one workflow run. A core change picks up the adapters
   through `updateDependents`; an adapter change ships alone.

Steps 2 to 4 repeat once per new adapter package, and only once.

## 4. Adding the sixth framework

Concretely, because the answer is what justifies the shape.

1. `npx nx g @nx/js:library --directory=libs/qwik-widget`, then delete the collateral
   `generator-collateral.test.ts` describes (the verdaccio target, the
   `preVersionCommand`, the restored nx.json comments).
2. `package.json`: name `@evanion/qwik-widget`, one peer (`@builder.io/qwik`,
   non-optional), one dependency (`"@evanion/widget": "<current core version>"`, exact).
3. Write the renderer. Expect 80 to 150 lines; it resolves a type to a component,
   spreads `props`, and hands `meta` to chrome.
4. Add a row to `LIBS` in `scripts/verify-packaging.mjs` and an import line to its
   consumer fixture.
5. Add `qwik-widget` to `scope-enum` in `commitlint.config.js`, or
   `commitlint-scope-enum.test.ts` fails.
6. Add an entry to `apps/docs/app/navigation.ts`, or `docs-navigation.test.ts` fails.
7. Bootstrap publish, tag, configure the trusted publisher.
8. `nx.json` needs no edit: `release.projects` is `["libs/*", "nest/*", "!libs/baize-ui"]`.

Items 1, 4, 5, 6 and 8 are enforced by existing repo checks, so the checklist is not
tribal knowledge — a missing step fails CI. Item 7 is the only genuinely manual one, and
it is once per package forever.

No existing consumer's version changes, no existing peer list grows, and no React user
downloads a byte of it. Under a single package the same addition would publish a new
version to every consumer of every framework and add a sixth optional peer to everyone's
manifest.

### What the single-package shape would have cost, measured

For the record, since it decided the earlier draft. On npm 11.13.0 / Node 24.16.0, a
package declaring `react` and `astro` as peers with both marked optional in
`peerDependenciesMeta`, installed into a consumer whose only dependency is `react@^19`:
exit 0, no `EBADPEER`, no warning, no `node_modules/astro`. The mechanism works. It is
not the mechanism that was wrong with that shape — it is that optional peers buy silence
for the four frameworks a consumer does not use by giving up the warning for the one it
does.

## Shape

### `@evanion/widget` — core

Framework-free. No import of any framework, so it is usable from a webhook handler, a
Nest service or a CI script validating CMS payloads.

```ts
export type WidgetRegistry<T = unknown> = Record<string, T>;
export type WidgetMeta = Record<string, unknown>;

/** Loose item shape, for data built before a registry exists. */
export interface AnyWidgetItem {
  id: string;
  type: string;
  props: Record<string, unknown>;
  meta?: WidgetMeta;
  children?: AnyWidgetItem[];
}

export interface WidgetProblem {
  index: number;
  id: string;
  type: string;
  message: string;
}

export type KnownWidgetTypes = WidgetRegistry | readonly string[];

export function defineWidgets<R extends WidgetRegistry>(registry: R): R;

export function validateItems(
  items: unknown,
  known: KnownWidgetTypes,
  required?: Record<string, string[]>,
): WidgetProblem[];

export const VALIDATION_MESSAGES: {
  /* … plus MISSING_FIELD, from astro-widget */
};
export const ERROR_MESSAGES: {/* … */};
```

`defineWidgets` is in the core rather than in an adapter: it is an identity function
whose only job is to keep a literal object's key union, which every adapter needs and a
React consumer building a registry before calling `createWidgets` wants too.

`validateItems` gains the third parameter from `validateBlocks`. A React consumer
validating untrusted CMS data wants the required-field check as much as an Astro one
does — `WidgetItem<C>` checks the typed path only, and validation exists for data that
never met the type checker.

### `@evanion/react-widget` — adapter

Unchanged except for the three renamed types and the core import. Still no
`'use client'`, still importable from a Server Component, still on the
`react-server`-safe subset. `createWidgets`, `defineItems`, the bound `validateItems`,
`DefaultWrapper`, `DefaultItem`, the chrome types and the `M` meta inference keep their
current shapes.

```jsonc
{
  "dependencies": { "@evanion/widget": "0.1.0" },
  "peerDependencies": { "react": "^18.0.0 || ^19.0.0" },
}
```

### `@evanion/astro-widget` — adapter

`Widgets.astro` renders the unified item shape:

```astro
const { type, id, props = {}, meta, children } = item;

<Component {...props} id={id} ctx={ctx}>
```

rather than today's `const { type, id, children, meta, ...props } = item`. The
destructure gets simpler, and `props` is a named field the CMS writes rather than
"everything left over".

Nesting stays the consumer's job. An Astro component receives child content through
`<slot />`, not a `children` prop, so there is nothing for the renderer to recurse into;
a widget that wants nesting renders `<Widgets items={children} registry={registry} />`
itself. This is a genuine runtime difference and stays documented as one. The Svelte,
Vue and Solid adapters each have their own version of this question — slots, scoped
slots, JSX children — which is a further argument that the renderer is not shareable and
the data is.

## 5. Why widget, not block

Astro's own package already says widget everywhere except in its TypeScript
identifiers. Its renderer is `Widgets.astro`, its prop is `items`, its package is
`@evanion/astro-widget`, its docs live at `/astro-widget`, and the docs site's group is
titled around widgets. "Block" appears in exactly five exported names inside
`libs/astro-widget/src` and nowhere else in its public surface.

So the count is 5 renames against 22. The flagship keeps its vocabulary and the Astro
side adopts it. With five adapters the argument gets stronger: the noun has to be chosen
once, for a family, and "block" is a CMS word while three of the five frameworks have no
CMS association at all.

The storefront calls them blocks in prose, in `data-block` attributes and in one
filename (`CatalogueBlock.astro`). That does not decide the library's noun. The
storefront's own payload key is already `items`, its registries are named by region, and
a consumer naming its domain differently from the library is normal — the library names
the slot, the consumer names what goes in it. `data-widget-type` is what the renderer
writes; storefront chrome can keep writing `data-block` beside it.

The unit stays `WidgetItem` rather than `Widget`. `Widget` alone is ambiguous between
the data and the component that renders it, and `items` / `WidgetItem` /
`validateItems` is already coherent.

One pre-existing hazard gets fixed in the same pass: `WidgetProps` (the loose item
shape) and `WidgetsProps` (the component's props) differ by one character. `WidgetProps`
becomes `AnyWidgetItem`, the untyped counterpart to `WidgetItem`.

## 6. What breaks

### React consumers

1. `WidgetComponentMap` → `WidgetRegistry`.
2. `WidgetItemProblem` → `WidgetProblem`.
3. `WidgetProps` → `AnyWidgetItem`.

The import specifier does not change: `@evanion/react-widget` keeps its name, and the
core types are re-exported from it, so a consumer who never names the core never installs
it explicitly. `createWidgets`, `defineItems`, `validateItems`, `WidgetItem`,
`WidgetsChrome`, `WidgetsConfig`, `WidgetsProps`, `WidgetItemComponent`,
`WidgetsWrapperComponent`, `WidgetSuspenseMode`, `WidgetDataProps`, `WidgetChildren`,
`WidgetMeta`, `AnyWidgetComponent`, `RenderableWidgetItem`, `DefaultWrapper`,
`DefaultItem`, `ERROR_MESSAGES`, `VALIDATION_MESSAGES` and `KnownWidgetTypes` all keep
their names. No data change. The migration is three renames.

Keeping the published name is worth stating plainly: it is the main practical gain of
this shape over the single-package one, which retired both names.

### Astro consumers

1. All five names: `defineBlocks` → `defineWidgets`, `validateBlocks` →
   `validateItems`, `BlockItem` → `WidgetItem`, `BlockRegistry` → `WidgetRegistry`,
   `BlockProblem` → `WidgetProblem`.
2. `WidgetProblem` gains `id`, so an exact-equality assertion on a problem object
   changes.
3. Two problem messages change: `'unknown block type'` → `'unknown widget type'`,
   `'blocks is not a list'` → `'items is not a list'`.
4. The data. Props move under `props`, and `id` becomes required.

The specifiers do not change either — `@evanion/astro-widget` and
`@evanion/astro-widget/components/Widgets.astro` both keep their paths.

Item 4 is the only one reaching outside the codebase, into whatever the CMS writes. The
migration note carries the transform:

```ts
const toWidgetItem = ({ type, id, children, meta, ...props }) => ({
  id: id ?? crypto.randomUUID(),
  type,
  props,
  meta,
  children: children?.map(toWidgetItem),
});
```

`id ?? …` is the awkward half. Astro items had an optional id; widget items need one, as
the framework key, as the identity in a warning, and as what the duplicate-sibling-id
check is about. A CMS with no per-section id has to supply one — an index-derived value
is fine as long as it is stable across renders.

The Astro side takes almost the whole cost. That allocation is deliberate: 5 exports
against 22, and 155 downloads in the week to 2026-09-11 against 170, on packages three
days old — mirrors and bots, not integrations. This is as cheap as it will ever be, and
every adapter added afterwards raises the price of changing the shared shape.

## 7. Packaging guards

`scripts/verify-packaging.mjs` asserts two things about react-widget: `dist/index.js`
carries no `'use client'`, and it imports no React API the `react-server` condition
withholds. Both stay exactly as they are — this shape keeps the package boundary they
were written against, which is the one part of the guard story that gets simpler than
under a single package.

What is added:

- `@evanion/widget` core imports no framework. A grep for `react`, `astro`, `svelte`,
  `vue` and `solid-js` over its `dist/`, on the pattern the `@evanion/feature` check in
  the same file already uses.
- Every adapter's `dependencies` names `@evanion/widget` at an exact version equal to the
  core's packed version. This is the check that catches a pin nx did not rewrite, and it
  is the one guard this shape needs that the single-package shape did not.
- The adapter rows in `LIBS` grow by one per framework, which the existing count
  assertion after packing already enforces.

The `react-server` condition project (`libs/widget/src/*.server.test.tsx`) is unaffected.

## Testing

- One validator suite in the core, carrying react-widget's 233 lines of cases and
  astro-widget's 113 merged, plus the cases inherited from the deleted
  `inherited-type-keys.test.ts`: `constructor`, `toString`, `valueOf`, `hasOwnProperty`
  and `__proto__` are unknown types rather than registered ones, and no lookup throws.
- Required-field validation runs from the React adapter too, which it could not before.
- One item array renders through every adapter and produces the same type sequence and
  the same `data-widget-type` order. This is the assertion that makes the docs claim
  checkable rather than editorial, and it is the test that could not be written while
  the two item shapes differed. It is also the test that a new adapter has to pass
  before it ships, which is what keeps the family from diverging again.
- The core's `dist/` imports no framework.
- Every adapter pins the core exactly, and the pin equals the packed core version.
- `@evanion/react-widget` ships no `'use client'` and no client-only React API — the two
  existing checks, unchanged.
- The `react-server` condition project still passes.
- Astro container tests still render `Widgets.astro`.
- Every adapter warns once on an unknown type and skips it rather than throwing.
- An item with no `id` is a validation problem in every runtime.
- A release dry run over a core change proposes a version bump for the core and for every
  adapter, with each adapter's pin rewritten. This is the `updateDependents` and
  `versionPrefix` behaviour asserted once rather than discovered during a release.

## 8. Docs

The restructure that was started and stopped can proceed once the vocabulary agrees.
With five adapters the site wants a `/widget` section holding the shared model and one
page per framework under it, rather than one top-level entry per package — otherwise the
landing page grows a card per framework for what is one library.

Current content: `content/widget` 1070 lines across 6 files, `content/astro-widget` 458
lines across 4.

What genuinely merges, estimated rather than measured — the merged pages do not exist
yet:

- Shared, roughly 200 lines: what an item is, the registry, validation and its problem
  list, `meta`, `ctx`. The `meta` and `ctx` prose in the two trees is already close to
  identical, because the two packages made the same decision for the same reason.
- React-only, roughly 700 lines: chrome, Suspense modes, the RSC story, compile-time prop
  inference, the playground, virtualization.
- Astro-only, roughly 200 lines: importing the `.astro` component, why nesting is the
  consumer's job, why there is no prop inference, the build-time story.

The premise the restructure rested on — that a real shared concepts page exists — holds,
but it is one page out of eleven, not half the tree. Most of the React documentation
stays React documentation, and each new adapter adds a page rather than diluting the
shared one. Treat "roughly 200 shared" as the claim to check when the pages are written.

## Risks

- Requiring `id` on the Astro side is the decision most likely to irritate a real CMS.
  The alternative — optional in the core, required by the React adapter — puts the two
  shapes back, which is the thing this spec exists to remove.
- An exact core pin means a consumer who installs two adapters at mismatched versions
  gets two copies of the core. Harmless for this core, which is pure functions and types
  holding no state, but worth knowing before anything stateful is added to it. TanStack
  accepts the same exposure.
- The Svelte, Vue and Solid adapters are unwritten, and the claim that each is 80 to 150
  lines is an extrapolation from the Astro one. If a framework needs something from the
  core that React and Astro did not, the core changes and every adapter republishes —
  which is precisely the case this shape handles least well. Writing one of the three
  before the core's API is frozen would de-risk it.
- The docs line estimates are estimates.
- A bootstrap publish is unattested, by the mechanism `RELEASING.md` describes. One
  version of `@evanion/widget` will carry no provenance, and the same applies once per
  new adapter.
