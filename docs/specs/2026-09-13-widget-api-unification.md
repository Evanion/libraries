# Widget API unification: one package, three entries

Status: approved, not implemented
Packages: `@evanion/react-widget` 0.2.0, `@evanion/astro-widget` 0.2.0 (both published
2026-09-10), retired into a new `@evanion/widget`
Depends on: nothing unimplemented. `docs/specs/2026-09-10-react-widget-rsc.md` is
shipped (#81) and its constraints carry forward unchanged.
Related: `docs/specs/2026-09-11-feature-toggles.md` (the core-plus-`./react` shape this
follows), `docs/specs/2026-09-12-react-widget-virtualization.md` (unaffected; it is
React-entry work)

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
hold the two implementations to one rule. Its own docblock argues that factoring the
shared part out would cost a third package or a React peer in an Astro tree. That
argument is re-measured below and does not survive the measurement.

## What is actually shared

Counted from source, excluding tests and `.d.ts`.

Public exports: react-widget 22, astro-widget 5 plus the `Widgets.astro` subpath.

Source lines:

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
`ComponentType` or `ReactNode` and are genuinely React-bound. `WidgetDataProps`,
`WidgetChildren`, `WidgetsChrome` and the `M` meta inference have no Astro counterpart
and cannot have one: an `.astro` module's default export is an `AstroComponentFactory`
carrying no prop types, which is why `BlockRegistry` is `Record<string, unknown>` in the
first place.

The number that decides the shape:

> Once the framework-free 226 lines are extracted, `@evanion/astro-widget` is 87 lines
> of source — `Widgets.astro` at 66 and `defineBlocks` at 21.

87 lines is not a package. It is a package.json, a README, a CHANGELOG, a LICENSE, three
tsconfigs, an eslint config, two vitest configs, a row in
`scripts/verify-packaging.mjs`, a commitlint scope, a docs-navigation entry, an npm
trusted-publisher configuration, and an independent version number — around 87 lines of
code.

The React side after extraction is 512 lines, all of it React-typed. That asymmetry is
real and the design has to respect it: the React entry is the library, the Astro entry
is a renderer over the same data.

## Decisions

1. One package, three entries: `@evanion/widget` exporting `.`, `./react` and
   `./astro`. `@evanion/react-widget` and `@evanion/astro-widget` are retired.
2. The vocabulary is widget/item. All five `Block*` names go.
3. The item shape is unified on the React shape — `{ id, type, props, meta?, children? }`
   — in both runtimes. This is the change that makes the docs claim true.
4. `id` is required in both runtimes. It was optional on the Astro side.
5. One validator. `validateItems` carries both packages' rules, including the
   `required` field map that only astro-widget had.
6. `warnOnce` and `ERROR_MESSAGES` move to the core, and `Widgets.astro` warns on an
   unknown type instead of skipping in silence.
7. Both peers are optional. Verified below.
8. The packaging guards move from per-package to per-entry.
9. `tools/repo-checks/src/inherited-type-keys.test.ts` is deleted. It pins a rule
   across two implementations; there is one implementation after this, and the rule
   becomes an ordinary case in the validator's own suite.

## 1. Why one package rather than three

Three shapes were weighed.

### A. Three packages

`@evanion/widget` core, with `@evanion/react-widget` and
`@evanion/astro-widget` depending on it. Rejected on two counts.

The first is the release cost, which this repository has already paid. Commit `8fc85f9`
had to raise `@evanion/token`'s range on `@evanion/luhn` in a follow-up commit, because
`@nx/dependency-checks` and `verify-packaging` both reject a range excluding the
installed version, and `nx release` refuses to rewrite a range under
`preserveMatchingDependencyRanges`. Under A that dance runs on every core change, twice
— core publishes, then two ranges are raised by hand, then two packages publish. The
core is the part most likely to change, because it holds the item shape.

The second is that A leaves an 87-line package standing, with the full apparatus listed
above wrapped around it.

### B. One package, three entries

Chosen. `@evanion/feature` already uses this shape
(`libs/feature/package.json`, `.` plus `./react`) and
`docs/specs/2026-09-11-feature-toggles.md:231` gives the reasoning: a single bundle
cannot carry per-module directives, so a client layer needs its own build entry. The
same holds here, with `.astro` source as a third layer. One version, one changelog, one
README, one docs tree, no dependency edges, and the divergence cannot come back because
there is one module.

### C. Two packages, unified vocabulary, no core

Rejected. It renames things and keeps
the duplication the contract test was written to police. The user's instruction is to
keep the APIs as unified as possible; C unifies the spelling and leaves two
implementations of the validator, two versions that drift, and the standing risk that
the next bug is fixed twice. It is the cheapest option and it buys the least.

#### The obstacle, checked rather than assumed

Peer dependencies are package-wide, so a package declaring both `react` and `astro` as
peers would warn at every install. `peerDependenciesMeta` marking both optional is the
usual answer; here is it measured rather than assumed. On npm 11.13.0 / Node 24.16.0, a
package with

```json
"peerDependencies": { "react": "^18.0.0 || ^19.0.0", "astro": "^7.3.1" },
"peerDependenciesMeta": { "react": { "optional": true }, "astro": { "optional": true } }
```

installed into a consumer whose only dependency is `react@^19`: exit code 0, no
`EBADPEER`, no warning on stdout, and no `node_modules/astro`. That is the behaviour the
shape needs, and `verify-packaging` gets a step to keep it (Testing, below).

What optional peers cost: npm never warns about an optional peer, so an Astro 6 project
installing this gets no version warning where `@evanion/astro-widget` gives one today.
`@evanion/feature` already made this trade for React. It is the weakest point of B and
is listed again under Risks.

#### What a React-only consumer pays

The tarball carries the Astro entry: 87 lines of source plus its declarations. Nothing
resolves it, nothing bundles it, and `sideEffects: false` holds per entry. The cost is
a few kilobytes in `node_modules` and no runtime cost at all.

#### No compatibility shim

`@evanion/react-widget` will not be republished as a package re-exporting
`@evanion/widget/react`. That is a dependency edge, which is the thing B exists to
avoid, and it would need a version bump on every core release. Both old names are
deprecated on npm instead.

## 2. Why widget, not block

Astro's own package already says widget everywhere except in its TypeScript
identifiers. Its renderer is `Widgets.astro`, its prop is `items`, its package is
`@evanion/astro-widget`, its docs live at `/astro-widget`, and the docs site's group is
titled around widgets. "Block" appears in exactly five exported names inside
`libs/astro-widget/src` and nowhere else in its public surface.

So the count is 5 renames against 22. The flagship keeps its vocabulary and the Astro
side adopts it.

The storefront calls them blocks in prose, in `data-block` attributes and in one
filename (`CatalogueBlock.astro`). That does not decide the library's noun. The
storefront's own payload key is already `items`, its registries are named by region, and
a consumer naming its own domain differently from the library is normal — the library
names the slot, the consumer names what goes in it. `data-widget-type` is what the
renderer writes; storefront chrome can keep writing `data-block` beside it.

"Widget" also stays because it is the published name of the package with 22 exports and
the title of the docs site. Renaming the flagship to match the 5-export package inverts
the cost for no gain.

The unit stays `WidgetItem` rather than `Widget`. `Widget` alone is ambiguous between
the data and the component that renders it, and `items` / `WidgetItem` /
`validateItems` is already coherent.

One pre-existing hazard gets fixed in the same pass: `WidgetProps` (the loose item
shape) and `WidgetsProps` (the component's props) differ by one character. `WidgetProps`
becomes `AnyWidgetItem`, the untyped counterpart to `WidgetItem`.

## Shape

### Entries

```jsonc
{
  "name": "@evanion/widget",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "@evanion/source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js",
    },
    "./react": {
      "@evanion/source": "./src/react/index.ts",
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js",
      "default": "./dist/react/index.js",
    },
    "./astro": {
      "@evanion/source": "./src/astro/index.ts",
      "types": "./dist/astro/index.d.ts",
      "import": "./dist/astro/index.js",
      "default": "./dist/astro/index.js",
    },
    // Named file, not a pattern. An `.astro` module is compiled by Astro's own
    // vite plugin in the consumer's project, so it ships as source; a pattern
    // would expose whatever else lands in that directory.
    "./astro/Widgets.astro": "./src/astro/Widgets.astro",
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "astro": "^7.3.1",
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "astro": { "optional": true },
  },
}
```

### Core (`.`)

Framework-free. No import of `react` or `astro`, so it is usable from a webhook handler,
a Nest service or a CI script validating CMS payloads.

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

`defineWidgets` sits in the core rather than on `./astro`: it is an identity function
whose only job is to keep a literal object's key union, which a React consumer building
a registry before calling `createWidgets` wants too.

`validateItems` gains the third parameter from `validateBlocks`. A React consumer
validating untrusted CMS data wants the required-field check as much as an Astro one
does — `WidgetItem<C>` checks the typed path only, and validation exists for the data
that never met the type checker.

### React (`./react`)

Unchanged from `@evanion/react-widget` except for the three renamed types. Still no
`'use client'`, still importable from a Server Component, still on the
`react-server`-safe subset. `createWidgets`, `defineItems`, the bound `validateItems`,
`DefaultWrapper`, `DefaultItem`, the chrome types and the `M` meta inference all keep
their current shapes.

### Astro (`./astro`)

`Widgets.astro` renders the unified item shape:

```astro
const { type, id, props = {}, meta, children } = item;

<Component {...props} id={id} ctx={ctx}>
```

rather than today's `const { type, id, children, meta, ...props } = item`. The
destructure gets simpler, and `props` is now a named field the CMS writes rather than
"everything left over".

Nesting stays the consumer's job. An Astro component receives child content through
`<slot />`, not a `children` prop, so there is nothing for the renderer to recurse into;
a widget that wants nesting renders `<Widgets items={children} registry={registry} />`
itself. This is a genuine runtime difference and it stays documented as one.

## 3. What breaks

### React consumers

1. The specifier: `@evanion/react-widget` → `@evanion/widget/react`.
2. `WidgetComponentMap` → `WidgetRegistry` (from `@evanion/widget`).
3. `WidgetItemProblem` → `WidgetProblem`.
4. `WidgetProps` → `AnyWidgetItem`.

Nothing else. `createWidgets`, `defineItems`, `validateItems`, `WidgetItem`,
`WidgetsChrome`, `WidgetsConfig`, `WidgetsProps`, `WidgetItemComponent`,
`WidgetsWrapperComponent`, `WidgetSuspenseMode`, `WidgetDataProps`, `WidgetChildren`,
`WidgetMeta`, `AnyWidgetComponent`, `RenderableWidgetItem`, `DefaultWrapper`,
`DefaultItem`, `ERROR_MESSAGES`, `VALIDATION_MESSAGES`, `KnownWidgetTypes` all keep
their names. No data change. A migration is one import rewrite and three renames.

### Astro consumers

1. The specifiers: `@evanion/astro-widget` → `@evanion/widget/astro`, and
   `@evanion/astro-widget/components/Widgets.astro` →
   `@evanion/widget/astro/Widgets.astro`.
2. All five names: `defineBlocks` → `defineWidgets`, `validateBlocks` →
   `validateItems`, `BlockItem` → `WidgetItem`, `BlockRegistry` → `WidgetRegistry`,
   `BlockProblem` → `WidgetProblem`.
3. `WidgetProblem` gains `id`, so an exact-equality assertion on a problem object
   changes.
4. Two problem messages change: `'unknown block type'` → `'unknown widget type'`,
   `'blocks is not a list'` → `'items is not a list'`.
5. The data. Props move under `props`, and `id` becomes required.

Item 5 is the only one that reaches outside the codebase, into whatever the CMS writes.
The migration note carries the transform:

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
the React key, as the identity in a warning, and as what the duplicate-sibling-id check
is about. A CMS with no per-section id has to supply one — an index-derived value is
fine as long as it is stable across renders.

The Astro side takes almost the whole cost. That allocation is deliberate: 5 exports
against 22, and 155 downloads in the week to 2026-09-11 against 170, on packages three
days old — those are mirrors and bots, not integrations. This is as cheap as it will
ever be, and it gets more expensive with every release.

## 4. Release

No dependency edges exist in this shape, so `preserveMatchingDependencyRanges` never
applies and the `8fc85f9` sequence has no analogue here. That is the release argument
for B stated plainly.

`@evanion/widget` is unregistered on npm (checked 2026-09-13, 404). It is a package that
has never been published, so `RELEASING.md` § "Bootstrap a package that has never been
published" applies in full:

1. Land the combined package on `main`. `libs/widget` becomes `@evanion/widget`;
   `libs/astro-widget` is deleted.
2. Set the on-disk version to `0.3.0` — above both predecessors, so the lineage reads
   in order. `fallbackCurrentVersionResolver: disk` is what makes this the starting
   point for a project with no tag.
3. Bootstrap publish by hand: `npm publish --access public --no-provenance --otp=…`.
   A trusted publisher cannot be configured for a name that does not exist yet.
4. Tag and push `@evanion/widget@0.3.0`. Without the tag, `nx release` reads
   conventional commits from the beginning of history and computes the next bump over
   every commit `libs/widget` ever had.
5. Configure the trusted publisher on npmjs.com (Evanion / libraries / `release.yml` /
   `npm publish`).
6. Deprecate both old names:
   `npm deprecate '@evanion/react-widget@*' 'Moved to @evanion/widget/react'` and the
   same for `@evanion/astro-widget` → `@evanion/widget/astro`. Deprecate rather than
   unpublish: unpublishing breaks existing lockfiles, and npm's 72-hour window closed
   on 2026-09-13 for both.
7. Every release after that goes through the normal workflow, attested. The project
   selector takes `widget`.

Repository edits that follow from the rename:

- `commitlint.config.js`: add `widget`, drop `react-widget` and `astro-widget`.
  `tools/repo-checks/src/commitlint-scope-enum.test.ts` fails until this is done.
- `apps/docs/app/navigation.ts`: two package entries become one.
  `tools/repo-checks/src/docs-navigation.test.ts` fails until this is done.
- `scripts/verify-packaging.mjs`: `LIBS` loses two rows and gains one; the guards move
  per entry (next section).
- `nx.json` needs no edit — `release.projects` is `["libs/*", "nest/*", "!libs/baize-ui"]`
  and deleting a directory removes it.
- `apps/storefront`: five registry files, `regions.astro.test.ts`, `ContentGroup.astro`
  and the payloads under `data/`.

## 5. Packaging guards, per entry

`scripts/verify-packaging.mjs` currently asserts two things about react-widget as a
package: `dist/index.js` carries no `'use client'`, and it imports no React API the
`react-server` condition withholds. Both statements have to become statements about the
`./react` entry, and the core gains one of its own. The pattern already exists in the
file for `@evanion/feature`, which walks `dist/` excluding `dist/react` to prove the
core imports nothing from React.

After this:

- Core `dist/index.js` and every module under `dist/` outside `dist/react` and
  `dist/astro` import neither `react` nor `astro`.
- `dist/react/index.js` carries no `'use client'` directive.
- `dist/react/index.js` imports no client-only React API — the same binding-renaming-safe
  check as today, retargeted.
- All three entries plus `./astro/Widgets.astro` are present in the exports map and
  resolve from the packed tarball, under both a typecheck and a runtime import.
- `./astro/Widgets.astro` resolves to source, not to `dist`.

The `react-server` condition project (`libs/widget/src/*.server.test.tsx`, its own
vitest project) keeps working unchanged; it points at the React entry's modules.

## 6. Docs

The restructure that was started and stopped can proceed once the vocabulary agrees. The
site goes from two package entries to one, at `/widget`, `/widget/react` and
`/widget/astro`, and the rendering group's shared card routes to one package with two
runtime sections rather than to two packages.

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
  consumer's job, why there is no prop inference, the build-time/zero-runtime story.

The premise the restructure rested on — that a real shared concepts page exists — holds,
but it is one page out of eleven, not half the tree. Most of the React documentation
stays React documentation. Treat "roughly 200 shared" as the claim to check when the
pages are written, not as a result.

## Testing

- The dual optional peer install, as a `verify-packaging` step: pack, install into a
  project whose only dependency is React, assert exit 0, no `EBADPEER` on stderr, and
  `node_modules/astro` absent. Then the mirror case with Astro only and React absent.
  Verified by hand on npm 11.13.0; the step is what keeps it true.
- Core imports neither `react` nor `astro`, walking `dist/` on the `@evanion/feature`
  pattern already in the script.
- `./react` ships no `'use client'` and no client-only React API — the two existing
  checks, retargeted per entry.
- The `react-server` condition project still passes against the React entry.
- Astro container tests still render `Widgets.astro` from `./astro/Widgets.astro`.
- One validator suite, carrying react-widget's 233 lines of cases and astro-widget's 113
  merged, plus the inherited-key cases inherited from the deleted
  `inherited-type-keys.test.ts`: `constructor`, `toString`, `valueOf`, `hasOwnProperty`
  and `__proto__` are unknown types rather than registered ones, and no lookup throws.
- Required-field validation runs from the React entry too, which it could not before.
- One item array renders through both entries and produces the same type sequence and
  the same `data-widget-type` order. This is the assertion that makes the docs claim
  checkable rather than editorial, and it is the test that could not be written while
  the two item shapes differed.
- `Widgets.astro` warns once on an unknown type and still skips it rather than throwing.
- An item with no `id` is a validation problem in both runtimes.

## Risks

- Optional peers never warn. An Astro project on a version outside `^7.3.1` gets no
  install warning where `@evanion/astro-widget` gives one today. `@evanion/feature`
  already accepts this for React. No alternative was found that keeps a per-entry peer.
- Requiring `id` on the Astro side is the decision most likely to irritate a real CMS.
  The alternative — optional in the core, required by the React entry — puts the two
  shapes back, which is the thing this spec exists to remove.
- A bootstrap publish is unattested, by the mechanism `RELEASING.md` describes. One
  version of `@evanion/widget` will carry no provenance.
- The docs line estimates are estimates.
