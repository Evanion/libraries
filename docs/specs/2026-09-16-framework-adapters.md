# Framework adapters: what gets built, and what does not

Status: approved, not implemented
Packages: adds `@evanion/vue-widget` and `@evanion/svelte-widget` now, then
`@evanion/vue-acl` and `@evanion/svelte-acl` once `@evanion/acl` publishes. Nine to
twelve packages were asked for; four are specified here and the other eight carry the
evidence that would start them.
Depends on: `docs/specs/2026-09-13-widget-api-unification.md`, shipped. `@evanion/widget`
0.1.0 is in `libs/widget`, `@evanion/react-widget` and `@evanion/astro-widget` both name
it `"0.1.0"` in `dependencies`, and `scripts/verify-packaging.mjs:417-444` holds the pin.
The core-plus-adapters shape, the exact core pin, and its decision 9 are load-bearing
here. Also `docs/specs/2026-09-16-documentation-standard.md` (decision 14, item 8),
`docs/superpowers/specs/2026-09-14-acl-design.md` (the acl core and `@evanion/react-acl`
are unpublished workspace packages), `scripts/verify-packaging.mjs`,
`tools/repo-checks/src/adapter-parity.astro.test.ts`
Related: `docs/specs/2026-09-11-feature-toggles.md` (whose `@evanion/feature/react`
subpath is repackaged by decision 6, and only if a second `feature` framework ever
appears)
Read against: `main` at `6b256c5`, except where a citation names `libs/acl`,
`libs/react-acl`, `apps/docs/app/navigation.ts`'s family comment, or a row marked
`feat/acl` in § 8's table. Those read `feat/acl`, which carries the acl packages, the
acl packaging checks and 122 commits `main` does not have. Where a line number here
differs from the one a reader finds, `main` is the tree this spec is written to merge
into and `feat/acl` is the tree the acl half of it describes.
Prior art: TanStack Query's per-framework packages, already measured in
`2026-09-13-widget-api-unification.md` § 2. Read from the registry on 2026-09-13 it
ships `react-query`, `vue-query`, `solid-query`, `svelte-query` and
`angular-query-experimental`, and no `nuxt-query` — after seven majors.

## The question, sized

The ask is Angular, Svelte and Vue/Nuxt bindings for three libraries. Taken literally
that is nine packages, twelve with Nuxt split out. Two of the three libraries are not
published: `@evanion/acl` and `@evanion/react-acl` are `private: true` in the workspace,
and `@evanion/feature` has one binding and no second-framework consumer.

Counted by what the packages actually do, the nine collapse to two shapes and the
build order collapses to four packages. Most of this document is the argument for the
eight that are not built, because that is the part that is not obvious from the ask.

## Decisions

1. Naming stays `{framework}-{package}`: `@evanion/svelte-widget`, `@evanion/vue-acl`.
   The folder basename equals the unscoped package name, so `libs/svelte-widget`. That
   is the rule `nx.json`'s `release.projects` glob and `commitlint.config.js`'s
   `scope-enum` both already assume, and the glob now reads `["libs/*"]` at
   `nx.json:135`. `cb9acb7` moved `nestjs-correlation-id` out of `nest/` into `libs/`
   and `4726c5a` moved `baize-ui` into `internal/`, so the one negation the glob carried
   is gone and the directory a package sits in decides whether it is released.
   `tools/repo-checks/src/project-folder-name.test.ts` holds the basename half.
2. An adapter has one of exactly two roles. A **renderer** resolves a type to a
   component, spreads `props` and answers the framework's nesting question — that is
   `widget`. A **distributor** puts one root object into the framework's context and
   reads it back, memoised, in a leaf — that is `acl` and `feature`. The packaging
   contract is shared across both. No runtime code is.
3. There is no cross-framework abstraction package. § 2.
4. The one thing that generalises as code is the parity harness,
   `tools/repo-checks/src/adapter-parity.astro.test.ts`. It becomes table-driven, one
   table per package family, and it stays in `tools/repo-checks`. § 3.
5. Vue and Nuxt are one package. There is no `@evanion/nuxt-*`. § 6 and § 11.
6. If `feature` ever gains a second framework it takes the package-per-framework shape:
   `@evanion/feature/react` is deprecated in favour of `@evanion/react-feature`, and the
   optional React peer in `libs/feature/package.json` goes with it. A subpath entry
   cannot declare a non-optional peer, and non-optional is decision 9 of
   `2026-09-13-widget-api-unification.md`.
7. An Angular adapter is standalone provider functions returning `EnvironmentProviders`
   through `makeEnvironmentProviders`, an `InjectionToken` holding the root object, and
   signals. No NgModule, and no RxJS in the public surface. § 4.
8. Angular peers are `">=22.0.0"` — an open lower bound, not a caret list. § 4.
9. A Svelte adapter is runes-only, peer `svelte ^5.0.0`. No store surface. § 5.
10. A Svelte adapter publishes its `.svelte` components as source, plus `.svelte.ts`
    runes modules emitted by tsc to `.svelte.js` with the rune calls intact, reached
    through a `svelte` export condition. No `svelte-package`. § 5.
11. A Vue adapter ships no `.vue` file. The renderer is a functional component written
    with `h()`, so a Vue package builds on the existing tsc pipeline unchanged. § 6.
12. `@evanion/acl` needs a serialization contract before any non-React adapter, and it
    has one. The envelope, `access.matrix` and the `Instant` widening all shipped on
    `feat/acl`; what this spec adds is that every adapter forwards them identically. § 7.
13. `scripts/verify-packaging.mjs` splits its single consumer fixture into one throwaway
    project per framework group. The family-wide assertions stay global. § 8.
14. An adapter is done when it carries eight things, one of which is a documentation
    section at the floor `docs/specs/2026-09-16-documentation-standard.md` sets. § 9.
15. Built now: `@evanion/vue-widget`, then `@evanion/svelte-widget`. Then, after `acl`
    publishes and its field contract settles, `@evanion/vue-acl` and
    `@evanion/svelte-acl`. § 10.
16. Not built: every Angular package, every Nuxt package, every `feature` adapter. Each
    carries the evidence that would change the answer. § 11.

## 1. Two roles, and what that buys

`@evanion/react-widget` and `@evanion/astro-widget` are renderers. `@evanion/react-acl`
is a distributor: `libs/react-acl/src/index.tsx` is a `createContext`, a `PolicyProvider`
that `useMemo`s `{ access, subject, now }` into it, and three hooks that read it back.
Its own docblock says "Nothing here decides anything; this layer supplies the context and
reads decisions."

The two roles differ in what the framework has to supply.

|                                    | Renderer                                                          | Distributor                             |
| ---------------------------------- | ----------------------------------------------------------------- | --------------------------------------- |
| Needs from the framework           | dynamic component resolution, prop spreading, a nesting mechanism | a context write, a context read, a memo |
| Framework-specific surface         | large                                                             | small                                   |
| Can be written without a component | no                                                                | yes, everywhere except React's provider |
| Blocked by a toolchain question    | Angular only                                                      | nowhere                                 |

That asymmetry is why the build order in decision 15 puts a renderer first and why the
Angular cut in § 11 lands on the renderer specifically. A distributor in any framework is
a file of plain TypeScript plus whatever that framework calls `provide`. A renderer has
to render.

What the two roles share is the packaging contract and nothing else: an exact core pin,
one non-optional framework peer, a `@evanion/source` condition on the `.` entry, the
`files` list, `publishConfig`, a parity row, a `verify-packaging` group, a commitlint
scope and a docs-nav entry. That is the shared part, it is already enforced by repo
checks, and it is not code.

## 2. Why there is no cross-framework abstraction package

The obvious move at nine packages is one `@evanion/adapter-kit` holding "provide a value,
read a value, memoise" and nine thin bindings over it. It is the wrong move, and the
reason is that the four primitives are not four spellings of one thing.

| Framework | Provide                        | Read              | Derive       |
| --------- | ------------------------------ | ----------------- | ------------ |
| Angular   | `InjectionToken` + `providers` | `inject(TOKEN)`   | `computed()` |
| Vue       | `provide(key, value)`          | `inject(key)`     | `computed()` |
| Svelte 5  | `setContext(key, value)`       | `getContext(key)` | `$derived`   |
| React     | `<Context.Provider>`           | `useContext`      | `useMemo`    |

The rows line up. The lifetimes do not.

- An Angular injector is hierarchical and outlives any one component. An
  `EnvironmentProviders` set installed at the application or route level is there before
  the first component that reads it and after the last one is destroyed.
- A Svelte context can only be set during component initialisation. There is no
  "set it later", no "set it conditionally after an await", and a `getContext` outside
  init is a runtime error rather than a stale read.
- Vue's `provide` is bound to the current component instance, so it is init-scoped like
  Svelte's but resolves up the component tree rather than through a separate injector
  hierarchy.
- React's `useContext` is a render-time read. The value is whatever the nearest provider
  rendered this pass, and changing it re-renders every consumer.

An interface that admits all four has to be the intersection, which is "set at init, read
in a descendant, no updates" — weaker than any of the four individually, and weaker than
what `@evanion/react-acl` already does, since its provider updates `now` on re-render.
Anything richer than the intersection leaks: the abstraction would have to expose
Angular's injector hierarchy to Svelte, which has none, or Svelte's init constraint to
Angular, which does not have it.

The size argument runs the same way. A distributor is the smaller of the two roles and
is roughly a provider function, a token, and two or three readers. Four of those are
smaller than one abstraction plus four bindings plus the documentation explaining which
of the four lifetimes the abstraction pretends everyone has. The renderer half is not
even a candidate — `2026-09-13-widget-api-unification.md` already established that the
renderer is the unshareable part and the data is the shared part, and every adapter
already shares `@evanion/widget`.

So the abstraction that exists is the one that already exists: a framework-free core per
library, and per-framework packages over it.

## 3. The parity harness is the one thing that generalises as code

`tools/repo-checks/src/adapter-parity.astro.test.ts` renders one item array through the
React adapter and the Astro adapter and asserts three things: the same widget types in
the same order, the same props delivered to the widget, and the unknown type skipped with
exactly one warning in each. Its docblock (lines 12-24) already names its own job:

> it is the test a new adapter has to pass before it ships -- which is what keeps the
> family from diverging again.

Generalising it means replacing the two hand-written `renderThroughAstro` /
`renderThroughReact` functions with a table:

```ts
interface Renderer {
  name: string;
  render(items: AnyWidgetItem[]): string | Promise<string>;
}

const renderers: Renderer[] = [/* astro, react, vue, svelte */];
```

and running the three existing cases as `describe.each`. The assertions do not change;
only the arity does. A distributor family gets its own table with its own three cases —
provide a root object, read a decision in a leaf, read the same decision twice and get
the same object — over the same shape.

It stays in `tools/repo-checks` for the reason it is already there, which lines 21-23
give: an Astro library must not carry React in its project graph, and a React one must
not carry Astro. That reason multiplies rather than weakening. A Svelte library must not
carry Vue, and the harness is the only place in the workspace where every adapter is a
legitimate dependency at once.

The cost is a vitest project per framework that needs its own compiler.
`tools/repo-checks/vitest.config.ts:37-50` already carries a `projects` array, and
`vitest.astro.config.ts` is already a second project existing because "compiling an
`.astro` module needs Astro's own vite plugin" and loading it for the filesystem checks
costs a second per run. Vue and Svelte each add one more entry on that pattern. That is
the precedent and it is the whole mechanism.

## 4. Angular: providers, signals, and an open peer floor

Decided even though no Angular package is built now, because the shape decides whether
one is cheap later.

A provider function returning `EnvironmentProviders` from `makeEnvironmentProviders`,
with an `InjectionToken` holding the root object, and signals for anything read in a
template. `providePolicy(access, subject)` rather than `PolicyModule.forRoot(...)`. An
NgModule buys backwards compatibility with a bootstrap style Angular itself has moved
off, and `EnvironmentProviders` is the type that cannot be misused — it does not fit in a
component's `providers` array by construction, which is the mistake a root-only provider
wants to prevent.

No RxJS anywhere in the public surface. Nothing in any of these three libraries is async:
`can()` is a pure function of a frozen matrix and a context, and a widget registry lookup
is a property read. An `Observable` return type would add an `rxjs` peer to every Angular
package to serve a consumer who wants one, and that consumer writes
`toObservable(signal)` from `@angular/core/rxjs-interop` in one line. One line in the
consumer beats a peer in the package.

### The peer range

`">=22.0.0"`, open above.

A caret list — `"^18.0.0 || ^19.0.0 || ^20.0.0"` — has to be widened and republished on
every Angular major, forever, for a package whose API surface stopped moving. That is a
release per major per package with no code change in it, and the failure mode while it is
pending is a consumer who cannot install at all.

Honestly: on API usage alone the floor could be far lower. `makeEnvironmentProviders` is
Angular 15, `signal` and `computed` are 16, and `inject` is 14. `>=16.0.0` is defensible
and would be true. 22 is chosen anyway, because the number a peer range states is a claim
about what is tested, and the test suite would back exactly one major — the current one.
Claiming 16 while testing 22 is the same lie as claiming 22 while testing nothing, and
the cheaper one to correct later is the tighter one.

## 5. Svelte: runes only, and source in the tarball

Peer `svelte ^5.0.0`, runes only. No store surface: a consumer who needs a store writes
`toStore(() => value)` in one line, the same trade as `toObservable` in § 4.

The publishing shape is the load-bearing decision. A Svelte adapter publishes:

- its `.svelte` components **as source**, unbuilt;
- its `.svelte.ts` runes modules compiled by tsc to `.svelte.js`, with the rune calls
  left intact for the consumer's Svelte compiler to process;
- both reached through a `svelte` export condition.

No `svelte-package`.

This is not novel in this repository. `libs/astro-widget/package.json` already does the
same thing for the same reason: `"./components/*": "./src/components/*"` (line 40) maps
the subpath straight at the source tree, and `"src"` is in the `files` list (line 45) so
the `.astro` files are what ships. There is no build step for `Widgets.astro` and there
never was. The consumer's Astro toolchain compiles it.

Svelte is the identical situation — a `.svelte` file is compiled by the consumer's
bundler, and shipping a precompiled one bakes in a compiler version the consumer did not
choose. Adding a whole packaging tool to reach the outcome the Astro adapter reaches with
two lines of `package.json` is not warranted. The part that needs care is the `.svelte.ts`
modules: tsc must strip the types without touching `$state` / `$derived`, which are
ordinary call expressions to it, and the emitted file must keep the `.svelte.js` suffix
so Svelte's own tooling recognises it.

## 6. Vue is one package, and it is the cheap one

No `.vue` file. The renderer is a functional component written with `h()`:

```ts
const Widgets = (props: WidgetsProps) =>
  props.items.map((item) => h(props.registry[item.type], item.props));
```

A single-file component would need `@vitejs/plugin-vue` in the build, a `vue-tsc`
typecheck pass, and a decision about whether to ship the `.vue` source or a compiled
render function. `h()` needs none of it: the file is `.ts`, the existing tsc pipeline
emits it, and the existing vitest config runs it. After React, Vue is the cheapest
framework in this whole document, which is exactly why it goes first.

Nuxt gets no package of its own. § 11 has the argument.

## 7. The serialization contract every adapter implements identically

This section records a crossing that has shipped. `Matrix` is an envelope,
`access.matrix` is a readonly member of `Access`, and every entry point takes an
`Instant`, all three on `feat/acl` today. What is specified here is that every adapter
forwards the same two values in the same shape.

`createPolicy` (`libs/acl/src/create-policy.ts:296`) adopts the matrix through `adopt`
(line 125), which rebuilds the envelope and deep-freezes it (`deepFreeze`, line 29),
then builds a graph and an index and returns an object of closures over all of it.
`Access` (lines 188-249) is that closure set. It does not serialize. `structuredClone`
of it throws on the functions; `JSON.stringify` of it yields `{"matrix":…,"version":…}`
and silently drops every method.

That is fine for React today, because both consumption shapes in the acl design build the
`Access` on whichever side needs it. It stops being fine the moment a framework wants to
hand a server-built value to the client through its own transport: Angular's
`TransferState`, Nuxt's payload, and SvelteKit's `data` are all serialize-on-the-server,
deserialize-on-the-client channels, and all three would receive an object with no `can`.

So the crossing carries data and the far side rebuilds the `Access` from it:

```ts
// server
const payload = {
  matrix: access.matrix,
  subject,
  decisions: access.capabilities(subject), // optional
};

// client
const access = createPolicy(payload.matrix);
```

`createPolicy` is the name on `feat/acl`. #220 decision 22 renames it `hydratePolicy`,
on the argument that after that PR's part B the call creates no policy and takes a
document that already exists. This section assumes neither outcome, because neither
touches it: the contract is `access.matrix` in and an `Access` out, and the identifier
between them is one token an adapter changes with a rename if #220 lands. Read every
`createPolicy` in this document as `hydratePolicy` once it does.

The matrix is an envelope carrying its own `version`, and `createPolicy` writes the
version it constructed with into the frozen document it exposes. So `access.matrix`
crosses losslessly on its own: a version composed at the construction site, from a
document a producer shipped and an overlay the producer cannot know about, is the one
that arrives. Carrying `version` beside the matrix would carry it twice and let the two
disagree.

`access.matrix` is a public readonly member of `Access` (`create-policy.ts:194`). Nothing
new is exported; what is new is that this is written down as the contract every adapter
implements identically.

The optional `decisions` field is the server-resolved snapshot from
`capabilities(subject, now)`, which returns `Record<string, Decision>`, and `Decision`
(`libs/acl/src/types.ts:242-250`) is plain fields with no function among them, so
it is JSON by construction. #220 part A removes two of those fields and the rest stay
plain, so the JSON claim holds either way. It carries the same meaning `feature`'s `decisions` prop
already has: `libs/feature/src/react/index.tsx:49` takes `decisions?: Decisions<F>` and
its docblock says supplied decisions are used as they are. Same word, same semantics,
same reason.

### The clock crosses as data

`Instant` is `string | number | Date`, and every entry point taking a `now` argument
accepts it: `EvaluationContext.now`, and `can`, `canMany`, `canFields`, `capabilities`
and `authorize` on the `Access` interface. A `now` that crossed JSON arrives as an ISO
string and is passed straight through, so an adapter writes no `new Date(payload.now)`
at a call site and reaches for no cast.

The engine settles an instant once per call rather than per condition, and an
unparseable one makes the conditions reading it fail rather than throw. So a hydrated
clock is ordinary data on the same footing as the subject and the object, which is what
lets an adapter forward it without knowing what it is.

## 8. `scripts/verify-packaging.mjs` splits its fixture per framework group

The script packs every publishable library, installs every tarball into **one**
`mkdtempSync` directory (line 58), writes **one** `consumer.ts` naming every public
export of every package (lines 130-224), and typechecks it with **one** plain
`npx tsc -p tsconfig.json` (line 248) against a tsconfig whose `include` is exactly
`['consumer.ts']` (line 123).

That breaks on the second framework family, not the twelfth package. The count is
irrelevant: what matters is that `tsc` is the only compiler in the directory.

- A `.svelte` file is not TypeScript. `tsc` cannot parse it, cannot resolve an import of
  it, and has no plugin interface that would let it. Verifying `@evanion/svelte-widget`'s
  published entry means compiling a Svelte component, which means `svelte-check` or a
  Vite build.
- An Angular component in a consumer needs `ngtsc`, not `tsc`. A decorated class
  typechecks under plain `tsc` and produces `__decorate` calls, which is the whole
  problem § 11 is about.
- Vue with `h()` alone survives plain `tsc`, which is another point in Vue's favour, but
  a Vue consumer exercising a template needs `vue-tsc`.

So one directory cannot hold the fixture for two frameworks whose consumers need
different type checkers. The fix is one throwaway project per framework group, each with
its own tsconfig, its own consumer entry, and its own checker — `tsc` for the universal
and React groups, `vue-tsc` for Vue, `svelte-check` for Svelte. The tarballs are packed
once and installed into each group that names them.

The family-wide assertions stay global, over the packed tarballs rather than inside any
one fixture project:

| Assertion                                       | Lines today          | Change                                                                                                                   |
| ----------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Every adapter pins the core exactly             | 417-444              | The adapter list at line 426 is hardcoded `['react-widget', 'astro-widget']` and becomes a loop over the packed adapters |
| `@evanion/widget` imports no framework          | 372-415              | Unchanged; the framework list at line 397 already names svelte and vue                                                   |
| `@evanion/acl` imports no framework             | 568-602 (`feat/acl`) | Unchanged; same list inline at line 587                                                                                  |
| `@evanion/feature` core imports no react        | 510-554              | Unchanged                                                                                                                |
| `'use client'` placement, react-widget          | 446-471              | Unchanged                                                                                                                |
| `'use client'` placement, feature's two entries | 556-578              | Unchanged                                                                                                                |
| tslib declared by exactly the importers         | 743-788              | Unchanged; already loops `LIBS`                                                                                          |

Every row reads `main` except the `acl` one, which reads `feat/acl`, where the acl
packages and this check exist. `feat/acl` also carries the same rows at higher line
numbers, the pin loop among them at line 616.

The hardcoded adapter list at line 426 is the only one that must change to add a package,
and it is the reason it must: a new adapter that nx failed to re-pin would be checked by
nothing.

## 9. What "done" means for an adapter

Eight things. A missing one fails CI, except where noted.

1. A row in the parity harness table (§ 3).
2. A `.test-d.ts` inside the package's typecheck include — `libs/acl/tsconfig.lib.json`
   and `tsconfig.spec.json` both list `src/**/*.test-d.ts`, and `libs/react-acl` lists
   both the `.ts` and `.tsx` forms.
3. A server-render test. Every one of these frameworks has an SSR path and a distributor
   that reads context during SSR is exactly where a lifetime assumption from § 2 breaks.
4. README doctests through `@evanion/doc-examples` for every example that is plain
   TypeScript. The mechanism is the one `libs/luhn/src/lib/docs.spec.ts:11-21` describes:
   every `// -> value` in a block marked `@import.meta.vitest` becomes an assertion at
   transform time. A `.svelte` file and an Angular template cannot be doctested — they
   are not TypeScript blocks — so each gets a rendered test instead, and the split is the
   one luhn already documents between the README's executable claims and the spec file
   holding the rest.
5. A `verify-packaging` fixture-group entry (§ 8) and a `LIBS` row.
6. A commitlint scope in `commitlint.config.js` and a docs-nav entry in
   `apps/docs/app/navigation.ts`. Both are checked:
   `tools/repo-checks/src/commitlint-scope-enum.test.ts` fails when a releasable project
   has no scope, and `docs-navigation.test.ts` holds the nav against the manifests.
7. The framework-free assertion on its core, which already exists for `@evanion/widget`
   and `@evanion/acl` and does not change when an adapter is added.
8. A documentation section at the floor in
   `docs/specs/2026-09-16-documentation-standard.md` § 4, under that document's
   decisions 15, 16 and 19. The standard states what the floor is and this list does not
   restate it: four page roles, the demonstration role filled and named in `_meta.ts`, a
   control on the page that fills it, the shop domain, and the prose budget.

   Three parts of it bind an adapter specifically. A section of five pages or fewer may
   carry the demonstration role on `getting-started`, which is the shape a first adapter
   section takes. The adapter's platform guide is one of the standard's four extra page
   types and the bound on it is "no adapter, no guide", so the guide ships in the same
   release as the adapter and never ahead of it. And the section's control is the
   adapter's own renderer or provider driving the shop items, so the parity row in item 1
   and the control assert the same thing at two altitudes.

   The two branches carry different halves of this, which matters for planning. `main`
   carries the standard and almost none of its implementation:
   `doc-floor.test.ts`, `doc-control.test.ts` and the rest of
   decision 22's nine are in `tools/repo-checks/src/` on `feat/acl`, 122 commits ahead. A
   `vue-widget` branched from `main` today passes `nx test repo-checks` with a one-page
   section and fails it the day `feat/acl` merges, so the section is built to the floor
   from the first commit of the package.

## 10. What gets built

Four packages, in this order.

1. **`@evanion/vue-widget`.** First because it needs no new build infrastructure and no
   new test infrastructure (§ 6). That isolates the renderer question — what does the
   third rendering model do about nesting — from the toolchain question. Answering one
   unknown at a time is the point of the ordering.
2. **`@evanion/svelte-widget`.** Second because it answers the toolchain question with
   the renderer question already settled: publishing `.svelte` source under a `svelte`
   condition, a `svelte-check` fixture group, and a vitest project.
3. **`@evanion/vue-acl`**, after `@evanion/acl` publishes and its field contract settles.
4. **`@evanion/svelte-acl`**, same gate.

3 and 4 wait on `acl` because a distributor's surface is `access`, `subject` and the
decision shape, and the field-level half of that shape is the most recently changed part
of the library. An adapter written against a moving contract is a rewrite.

Nothing here requires a change to `nx.json`: `release.projects` is `["libs/*"]` and each
new package matches it. Nothing requires a change to the docs landing either, per
`apps/docs/app/navigation.ts:134` on `feat/acl`: "Adding a Svelte or Vue adapter to an
existing family only adds a chip and a link, never a card." That comment arrived with the
landing-families work and is not on `main` yet.

## 11. What does not get built

Each with the evidence that would change it.

### `@evanion/angular-widget`

Alone among the nine it needs a build **toolchain** rather than a config file.

It is the only Angular package that must ship a component, and a published Angular
component has to be compiled in partial mode so the consumer's linker can finish it.
Plain tsc emits `__decorate` calls. A consumer's `ngtsc` does not compile `node_modules`,
so it never processes them, and the component arrives at the consumer's AOT build
undeclared. Fixing it means `ng-packagr` or an equivalent, which is a second build system
in a workspace that has one.

What the adapter would have wrapped is six lines in the consumer's own template:

```html
@for (item of items; track item.id) {
<ng-container
  [ngComponentOutlet]="registry[item.type]"
  [ngComponentOutletInputs]="item.props"
/>
}
```

A build toolchain to save six lines is not a trade worth making.

**What would change it:** an Angular consumer in `apps/`, or a measurement showing plain
tsc output does in fact link (§ 12 — it is worth an hour to settle).

### Every Angular adapter

`angular-acl` and `angular-feature` are pure TypeScript — a token, a provider function,
some computed signals — and cheap to write. They are expensive to **test**. The first
assertion requires TestBed, an Angular vitest integration, and a zoneless provider
configuration. None of the three exists in this workspace, and all three are paid before
a single behaviour is checked.

There is also no Angular app in `apps/` to consume one. The workspace has `admin`,
`docs`, `shop-api`, `storefront` and `storefront-rsc`, and every adapter this repository
has shipped had a consumer in-tree before it shipped.

**What would change it:** an Angular consumer appearing. That is the gate, and it gates
the cheap packages as well as the expensive one.

### Every Nuxt package

A Nuxt module buys two things over a plain Vue package: auto-imports and request-lifecycle
integration. Neither is wanted here.

The lifecycle half is refused by design. `docs/superpowers/specs/2026-09-14-acl-design.md`
(lines 756-757) states it outright:

> In both shapes the subject crossing server→client is passed explicitly by the app; the
> package never reaches into request/context plumbing. The adapter supplies the
> evaluator, not the principal.

A Nuxt module whose selling point is resolving the principal from the request is the thing
that sentence says the package does not do. A Nuxt module that does not do it is a Vue
package with extra installation steps.

The auto-import half is worse than neutral for this domain. Auto-import removes the import
line, and the import line is what a reader follows to the documentation. For a decorative
component that is a fine trade. For a call that decides whether a user may edit a record,
an unimportable identifier appearing from nowhere is the wrong default.

The precedent agrees. `@tanstack/vue-query` has shipped through seven majors with no Nuxt
package. Nuxt consumers install the Vue package.

**What would change it:** a Nuxt consumer who hits real friction with the plain Vue
package. § 12 — this is the call to revisit first.

### Every `feature` adapter

`@evanion/feature` is unpublished (`private: true`) and has no second-framework consumer.
Adding one also triggers decision 6: the `./react` subpath is deprecated for
`@evanion/react-feature`, the optional React peer in `libs/feature/package.json` goes,
and every existing consumer changes its import specifier. That is a migration, and it
would be paid for demand that does not exist.

**What would change it:** a second framework wanting feature toggles. Then decision 6
executes, and it executes in full rather than growing a second optional peer.

### Solid

Unchanged from `2026-09-13-widget-api-unification.md`, which plans Svelte, Vue and Solid.
Solid stays planned and sequenced behind Svelte.

## 12. Release at twelve adapters

The release mechanism does not degrade with the adapter count. Two things do.

`nx.json` sets `version.versionPrefix: ""` (line 160) and `version.updateDependents:
"always"` (line 164). A core change versions the core, rewrites every adapter's exact
pin, and republishes every adapter in one `nx release` run. That is one run at two
adapters and one run at twelve; `updateDependents` iterates, and iteration is what
computers are for. The exact-pin argument in `2026-09-13-widget-api-unification.md` § 3
holds unchanged, and `scripts/verify-packaging.mjs:417-444` is the check that catches a
pin the run missed.

What actually degrades:

- **Changelog noise.** A one-line patch to `@evanion/widget` produces twelve releases,
  eleven of which say nothing but that a dependency version changed. A reader of any one
  adapter's CHANGELOG sees entries that describe no change to the package they are
  reading. This is real and it is the cost of the exact pin; TanStack pays it too, and it
  is cheaper than the two-copies-of-the-core drift a caret range permits.
- **The bootstrap publish.** `RELEASING.md` § "Bootstrap a package that has never been
  published" is manual by necessity — a trusted publisher cannot be configured for a name
  that does not exist on npm — and it is once per new package: publish by hand with an
  OTP, tag the commit, configure the trusted publisher. Four new packages is four
  bootstraps. Twelve is twelve. It does not compound, but it also never amortises, and
  each one produces a version with no provenance.

Neither is a reason to build fewer packages than are wanted. Both are reasons not to build
packages that are not wanted, which is what § 11 is.

## What is being guessed

- **That a plain-tsc Angular library carrying a component fails a consumer's AOT build.**
  Read off Angular's packaging documentation, not reproduced here. It is the sole reason
  `@evanion/angular-widget` is cut, so it is the highest-value unknown in this document
  and it is worth an hour to settle: scaffold a library with one decorated component,
  emit with plain tsc, consume it from an AOT build, and see what happens. If it links,
  the Angular renderer becomes as cheap as the Angular distributors and the § 11 argument
  reduces to the testing cost alone.
- **That a Svelte renderer is 80-150 lines.** Extrapolated from the Astro one via
  `2026-09-13-widget-api-unification.md`, which extrapolated the same range for Svelte,
  Vue and Solid without writing any of them. Svelte 5 also has a nesting mechanism that is
  neither React's `children` nor Astro's `<slot />`: snippets are parameterised and passed
  explicitly, so "what does the renderer do about nesting" has a third answer, and the
  line estimate is the part of the estimate least likely to survive it.
- **That publishing `.svelte` source under a `svelte` condition types correctly without
  `svelte-package`.** The Astro precedent is real and load-bearing, but Astro's
  `BlockRegistry` was `Record<string, unknown>` precisely because an `.astro` module's
  default export carries no prop types. Whether a consumer's `svelte-check` resolves types
  through the condition as cleanly as `svelte-package`'s generated shims is not verified.
  `@evanion/svelte-widget` going second exists partly to find out.
- **That `>=22.0.0` is the right Angular floor.** § 4 argues the open bound; the number is
  a judgement about what would be tested, not a measurement. `>=16.0.0` is defensible on
  API usage and would serve more consumers.
- **That the `capabilities()` snapshot is worth putting in every provider.** `feature`'s
  equivalent `decisions` prop has no measured consumer. The acl snapshot might be the same
  unused option, added to four packages.
- **That splitting the verify-packaging fixture per framework is enough.** The split is
  the obvious fix and the checkers exist. Whether four throwaway projects install and
  typecheck in a tolerable CI time, and whether `svelte-check` and `vue-tsc` fail as
  loudly as `tsc -p` does on a missing export, is unmeasured.
- **That the Nuxt call is right.** This is the one to revisit first. It is the difference
  between three packages and six, it is argued from TanStack's behaviour and from a
  sentence in the acl design rather than from a Nuxt consumer who tried the Vue package
  and found it wanting, and an argument from someone else's release history is the weakest
  kind in this document.
