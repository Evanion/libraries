# Making `@evanion/feature` releasable

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@evanion/feature` and `@evanion/react-feature` are two released packages with no entry in `tools/repo-checks/src/doc-export-coverage-allowance.json`, a documentation section a reader can go from a first toggle to a multi-process deployment inside, and a library whose public surface sits in Nest, Express, Next, React Router and Astro without the application writing a workaround.

**Architecture:** `libs/feature/src/react/**` becomes `libs/react-feature`, which is the shape this repository already uses for `acl`/`react-acl` and `widget`/`react-widget`. The 439 lines of decision-set adoption that sit inside that React directory move down into the core first, because every non-React framework needs them and after the extraction the core would hold none of it. The core gains a context-bound caller so a Nest service, an Express handler and an Astro middleware settle one clock per request the way `access.authorize(subject)` lets `apps/storefront-rsc` settle one actor per page view. The documentation allowance empties one subject at a time, each slice a page's worth of `##` headings and reference directives. The guide set then grows from 10 pages to 23, and the release flip moves the whole finished set under `content/next/`.

**Tech Stack:** TypeScript 6, Vitest with `typecheck`, Nx 23.3.0, Nextra, Vite with rolldown for the React package's build and `tsc` for the core's.

**Specs:**

- `docs/specs/2026-09-11-feature-toggles.md`. Decision 1 (framework-free core), § 9 Packaging (the two entries this plan splits into two packages).
- `docs/specs/2026-09-16-framework-adapters.md`. Decision 6 fixes the shape of this extraction: `@evanion/feature/react` is deprecated for `@evanion/react-feature` and the optional React peer in `libs/feature/package.json` goes with it. Decision 1 fixes the folder basename. § 1 names `acl`/`react-acl` as the distributor pattern and lists the eight things a released adapter carries. Decision 16 and § 11 say the trigger is a second framework; the owner has decided to execute decision 6 now, for the release, and decision 6 states what executing it means.
- `docs/specs/2026-09-23-feature-hydration.md`. Decision 5, 6, 7, 9 and 10, § 3, § 4, § 6, § 7 and § 8. § 7 already states that `onDivergence` is an option on a core entry point and not only a provider prop; the `DecisionSet` path shipped with the React provider as its only consumer, and Task 14 lands the core entry point § 7 names.
- `docs/specs/2026-09-23-feature-config-distribution.md`. The envelope, `serializeConfig`, `configDigest`, `validateConfig`, `parseFeatureConfig`, `features.reload`.
- `docs/specs/2026-09-13-released-by-default.md`. Decisions 1, 2, 3 and 5, and § 1's URL grammar. Read before Task 32.
- `docs/specs/2026-09-13-versioned-docs.md`. Decisions 1 through 7. Read before Task 32.
- `docs/specs/2026-09-21-reference-page-budget.md`. The owner's position that a reference page carries no word limit. No task in this plan splits `api.mdx` to satisfy a count.
- `RELEASING.md` § 2. The bootstrap publish, which is the owner's step and not a task.

**Issue:** #423 is what fences the transport out. `libs/feature/src/lib/core-boundary.spec.ts` enforces it.

## Three corrections to the brief this plan makes

**`libs/feature/README.md` holds no provider or hook section to move.** Its eight headings are the problem, the solution, the `cascade` region, Key Features, Installation, Documentation and License. The React surface appears in exactly three places: the `react` keyword in `libs/feature/package.json`, the Key Features bullet at `README.md:70` naming `@evanion/feature/react`, and the compatibility bullet at `README.md:71` naming the optional React peer. Task 2 removes those three and writes `libs/react-feature/README.md` from nothing, which is what the brief's intent amounts to.

**No application in this repository uses `@evanion/feature`.** `@evanion/acl` is integrated in all four demo applications; the grep for `@evanion/feature` outside `libs/` reaches `apps/docs` and nothing else. So five of PIECE FOUR's framework pages have no wiring to cite. Tasks 23, 25, 26 and 27 each wire one application and then write its page, so every fence on a framework page cites a region of code this repository builds and tests, which is what `apps/docs/content/next/acl/nestjs.mdx` does with twelve `file=apps/shop-api/...` fences. Task 24 follows `apps/docs/content/next/acl/express.mdx`, whose one fence cites `libs/acl/docs/examples.md`, because no Express application exists here either.

**Both packages reach 0.1.0 in Task 32 and not before.** `tools/repo-checks/src/released-pins.test.ts` reads every project under `nx.json`'s `release.projects` glob with no filter on `private`, so `@evanion/react-feature` has to pin `@evanion/feature` at exactly the version `libs/feature/package.json` carries from the moment `libs/react-feature/` exists. Task 1 creates it pinning `0.0.1`. Task 32 moves both manifests to `0.1.0` in one edit, matching `@evanion/acl` and `@evanion/react-acl`, which both sit at `0.1.0` unpublished.

**And `@evanion/react-feature` carries `private: true` for as long as the core does.** `nx release publish` skips a private project per project, so a run that versions both and publishes only the binding puts a package on the registry whose one runtime dependency is not there, and `npm install @evanion/react-feature` answers E404 for `@evanion/feature`. `tools/repo-checks/src/publishable-dependencies.test.ts` holds the edge: a package the release run publishes names no dependency it holds back. Task 1 creates the binding private, with `workshop: true` on its navigation entry, and Task 32 drops both flags with the core's.

## Global Constraints

Exact values. Every one of them is read off the tree at `origin/main` `77650ee2`.

- `nx.json:135` sets `release.projects` to `["libs/*"]`. A directory under `libs/` is a released package the moment it exists, so `libs/react-feature/` owes a `commitlint.config.js` scope entry, an `apps/docs/app/navigation.ts` entry and a `docs/examples.md` from its first commit.
- `commitlint.config.js` `scope-enum` gains exactly one member, `react-feature`, sorted into the Nx-projects half of the list beside `react-acl`. `tools/repo-checks/src/commitlint-scope-enum.test.ts` fails the build without it.
- The folder basename equals the unscoped package name: `libs/react-feature` holds `@evanion/react-feature`. `tools/repo-checks/src/project-folder-name.test.ts` holds it.
- `@evanion/react-feature` declares `"@evanion/feature": "0.0.1"` under `dependencies` (exact, no caret) and `"react": "^18.0.0 || ^19.0.0"` under `peerDependencies`, non-optional. `tools/repo-checks/src/released-pins.test.ts` holds the first; decision 9 of `docs/specs/2026-09-13-widget-api-unification.md` and decision 6 of the adapters spec hold the second.
- `libs/feature/package.json` loses `peerDependencies`, `peerDependenciesMeta`, the `./react` entry of `exports`, and the `react` keyword. After Task 1 it declares no peer at all.
- `libs/feature/src/lib/core-boundary.spec.ts` asserts `Object.keys(manifest().peerDependencies ?? {})` equals `['react']` and that `sources(ROOT)` contains `react/index.tsx`. Task 1 rewrites both, and the `describe('the react entry')` block and the `react` exemption in `unallowedImports` come out with them. The fixture cases under `describe('the exemption the scan allows')` that prove the exemption's path handling go with the exemption.
- `scripts/verify-packaging.mjs` carries the two-entry assertions for `@evanion/feature` at lines 744 to 810. Task 1 replaces them with the pair assertions the acl block at 812 to 843 already makes, and adds `['libs/react-feature', '@evanion/react-feature']` to `LIBS` at line 42. The fixture import lines at 189 and 408 change specifier. It lands in Task 1 and not after it: `.github/workflows/ci.yml` runs `npm run verify:packaging` as its own job on every pull request, so a commit that drops the `./react` entry and leaves the script naming it cannot go green on its own.
- `tools/repo-checks/src/doc-export-coverage.test.ts` asserts four things per published name: an `##` heading on the package's API reference spelling the name, a `twoslash` fence, a `file=` fence or a `<!-- reference … example=… -->` directive that names a callable export, a docblock on the declaration, and no allowance entry that is no longer needed. Its heading regex is `/^##\s+`([^`]+)`/gm`and it takes the name up to the first`(`, `<`or space. Its directive regex requires`example=` to count a name as exercised.
- The reference directive grammar is `/^<!--\s*reference\s+(@?[\w./-]+)#([\w$]+)(?:\s+example=([\w-]+))?\s*-->\s*$/`, one per line, under the heading. `tools/doc-examples/src/mdx-reference-loader.mjs` resolves the name through the package's `dist/`, so `npx nx run-many -t build` runs before a page carrying a new directive is checked.
- `tools/repo-checks/src/doc-behaviour.test.ts` requires a `describe` spelling every non-error callable export exactly, at any depth, and carries no allowance. The six React names already have theirs in `libs/feature/src/react/react.spec.tsx` and `entry-surface.spec.tsx`; they travel with the files.
- `tools/repo-checks/src/doc-fence-allowance.json` records `{"feature": 12}`, and all 12 are bare ` ```ts ` blocks in `apps/docs/content/feature/api.mdx`, at lines 10, 186, 315, 331, 348, 375, 421, 471, 492, 502, 533 and 751. The number only goes down, and `doc-fence.test.ts` fails on an allowance above the real count, so Task 3 takes it to 11 and Tasks 5, 6 and 7 take it down from there. Every fence a new page adds is a `file=… region=…` reference to a region under `libs/feature/docs/examples.md`, `libs/react-feature/docs/examples.md` or an `apps/` source, a `twoslash` fence, a `mermaid` fence, a shell fence, or a block tagged `signature`, `no-run`, `anti-example`, `fails-type-check` or `elided`. `libs/react-feature` opens its own entry at `0` by having no unexplained fence.
- `tools/repo-checks/src/doc-domain.test.ts` fails a section whose fenced code names `post`, `comment`, `invoice`, `article` or `blog` as a domain object. Every example is set in the game shop. `doc-domain-allowance.json` is `{}` and stays `{}`.
- `tools/repo-checks/src/doc-floor.test.ts` requires an overview, a `getting-started`, an `api` and a demonstration page of every `documented: true` section, and a section of more than five pages owes the demonstration role a page of its own. `feature`'s demonstration is `rollouts`; `react-feature`'s is `getting-started`, which the five-page allowance permits and which `react-acl` already takes.
- `tools/repo-checks/src/docs-navigation.test.ts` asserts `workshop` equals `private` in the manifest, one `familyId` per group, no `familyId` of one package, exactly one `framework: 'universal'` member per family, a hue from `categorical` in `@evanion/baize-ui/tokens` distinct across groups, and `documented` against the content directory.
- `@evanion/feature` becomes `framework: 'universal'` and `familyId: 'feature'`; `@evanion/react-feature` becomes `framework: 'React'`, `familyId: 'feature'`, `group: 'standalone'`, `hue: 'amber'`. All nine hues in `internal/baize-ui/src/tokens/categorical.ts` are taken, and a family shares one hue, which is the rule the hue case states and which `navigation.ts` already cites `feature` for.
- `apps/docs/components/landing/platforms.ts` maps `React`, `Astro`, `NestJS` and `universal`. Both new `framework` strings resolve.
- `tools/repo-checks/src/typecheck-config.test.ts` requires `typecheck: { … enabled: true }` in the Vite config of any released library holding a `*.test-d.*` file. `libs/react-feature/vite.config.ts` carries it, copied from `libs/feature/vite.config.ts`.
- `tools/repo-checks/src/coverage-config.test.ts` requires `reportsDirectory: './test-output/vitest/coverage'` with a `json` reporter at `./test-output/vitest/coverage/report.json` and a `json-summary` coverage reporter.
- `tools/repo-checks/src/engines-floor.test.ts` requires `engines.node` to admit every peer's own floor. `">=20"` is what every other package carries.
- `tools/repo-checks/src/test-assert-boundary.test.ts` requires a blank line before the first `expect` in a case body that arranges anything above it.
- `tools/repo-checks/src/exported-type-closure.test.ts` requires that no published declaration names a type its own file keeps private.
- `tools/repo-checks/src/react-pair.test.ts` requires one `react-dom` in the lock file and the same spec for `react` and `react-dom` in any manifest naming both.
- `.gitignore:128-132` ignores `apps/docs/content/*` and un-ignores `_meta.ts`, `next/`, `testing/` and `feature/`. Task 32 removes the `feature/` line.
- `apps/docs/tools/redirects.mjs` holds `movedPages` as old path to new, both without slashes and without a `/next/` prefix. `tools/repo-checks/src/doc-redirects.test.ts` fails on an entry whose target does not resolve, so an entry lands in the same task as the page that answers it.
- `apps/docs/components/WorkshopNotice.tsx` renders nothing once `workshop` is false. `apps/docs/components/ReleaseNotice.test.tsx:37` asserts the "Not on npm yet" heading with `slug="feature"`, so Task 32 rewrites that case.
- Every page is drafted by the implementer and written by Gemma: `node /Volumes/projects/Personal/open-source/.git/governor-tools/gemma.mjs <draft> > <out>`, one page at a time, from inside a git checkout. Her output is read against the code and only factual errors are changed. Her prose is not restyled, not shortened and not re-housed in a style.
- Tested regions live in `libs/<pkg>/docs/examples.md`. A README carries one example of its own and nothing a page cites.
- A commit message uses a conventional type and a scope from `commitlint.config.js`. `feature` for core work, `react-feature` for the new package, `docs` for a documentation-site edit, `repo-checks` for a check, `shop-api`, `storefront`, `storefront-rsc` and `admin` for the demo applications, `packaging` for `scripts/verify-packaging.mjs`, `release` or `releasing` for the flip.
- While working: `npx nx run-many -t lint test typecheck -p <project>`. The full uncached affected sweep runs once, in Task 32.
- The pre-commit hook runs lint and is slow. `--no-verify` is allowed only after the scoped check has been run by hand.
- Never push to `main`, never merge locally, never force-push, never `--admin`.
- Prose in docblocks, `.mdx` drafts and commit messages: no em-dashes, no "X rather than Y", no "instead of", no bold lead-ins on a paragraph, every sentence names who or what acts, no gerund phrase as a subject, no metaphor verb for a technical fact, no rhythmic three-item list.
- CI runs `npx prettier --check .` as its own job.

## The cross-framework audit, and what it found

Answered against `apps/shop-api` (Nest 11), `apps/storefront` (Astro SSR), `apps/storefront-rsc` (Next App Router) and `apps/admin` (React Router 8), each read for how it integrates `@evanion/acl`, and against `@evanion/nestjs-correlation-id` for how a per-request value reaches deep code in Nest.

**Does a per-request evaluation context reach the call site without the application threading it?** Partly, and the gap is the clock. Each framework already has the mechanism that carries the value: `apps/shop-api/src/acl/subject.service.ts` holds an `AsyncLocalStorage<ShopSubject>` in a plain singleton and `SubjectMiddleware` opens it per route, following `CorrelationService`; `apps/storefront/src/middleware.ts:31` writes `context.locals.subject`, `locals.api`, `locals.cart` and `locals.access`; `apps/storefront-rsc/app/access.ts` wraps the fetch and the subject in React's `cache`; `apps/admin/app/page-context.ts` declares `subjectContext` and `accessContext` as `createContext` from `react-router` and the shell's middleware fills them. So the application owns the plumbing in every one of the four, which is the position `docs/superpowers/specs/2026-09-14-acl-design.md:756-757` states and the adapters spec quotes: the package supplies the evaluator and not the principal. What acl adds on top is `access.authorize(subject)` at `libs/acl/src/hydrate-policy.ts:275`, which returns an `Authorized` whose `can`, `canMany`, `canFields` and `capabilities` take no subject and settle one clock instant. `apps/storefront-rsc/app/access.ts` uses it to give three independently rendered widgets one actor at one instant. `Features` has no counterpart: `resolve`, `isEnabled`, `variantOf`, `valueOf`, `plan`, `snapshot` and `toggle` each take `context?`, and `features.ts:922` fills `now` from `new Date()` per call, so two calls inside one request can straddle a window boundary. `docs/specs/2026-09-23-feature-hydration.md` § 6 names the unbounded clock as the thing to remove and removes it on the client, through `DecisionSet.now`. Task 15 removes it on the server. **Library.**

**Does a store built once at boot serve a request-scoped context?** Yes. `createFeatures` deep-clones and freezes the configuration, `resolve` writes nothing, and the one mutating entry points are `toggle` and `reload`, which are process-wide by design. Nothing forces a store per request. A store per tenant is the application's own composition and stays there. **No change.**

**Does a decision cross the server-to-client boundary intact under RSC and under Astro islands?** Under RSC and under Astro's `devalue`, yes for a store built from a document and nearly for a store built from a literal. `DecisionSet` is plain data: `version`, `now` as an ISO string, `origin`, and `decisions`. The one non-JSON value a decision can hold reaches it through the explanation array. `Decision.rules?: readonly RuleOutcome[]` carries `RuleOutcome.failed?: Condition`, `WindowCondition.value` is `Instant = string | number | Date`, and `libs/feature/src/lib/document-copy.ts:231` copies a `Date` as a `Date`, so a literal store that wrote `value: new Date('2026-10-01')` produces a set holding a `Date`. React's flight serializer and `devalue` both carry a `Date`. `JSON.stringify` into a `<script type="application/json">` does not, and the client then holds a string where its own `Condition` type promises a `Date`. `snapshot` already takes the position that it is the wire producer: `features.ts:1033` refuses a `context.now` naming no instant "because a decision set states its instant as an ISO 8601 string", while `resolve`, `plan` and `toggle` carry the same `Date` through and stay total. Task 16 extends that position to the one member that breaks it. A variant `value` holding something no wire format carries is the application's own choice of value type and belongs on the pitfalls page. **Library, narrowly.**

**Does anything in the public surface assume a runtime?** The core imports no module outside itself, starts no timer and opens no socket, and `core-boundary.spec.ts` proves all three off the syntax. Three host reads exist. `libs/feature/src/lib/document-copy.ts:285` tests `typeof globalThis.structuredClone === 'function'` and falls back to its own walk. `libs/feature/src/lib/observe.ts:293` guards with `typeof process !== 'undefined'` and gates a `console.warn`. `libs/feature/src/react/hydrate.ts:76` reads `process.env.NODE_ENV` inside a `try` and answers `true` when the read raises, and that read gates work: the development diff does not run in an edge runtime, in a browser loading unbundled ESM, or under a runtime with no `process` shim. The docblock states it and the reasoning holds for a React package whose bundler substitutes the text. It does not hold for the core, which Task 14 moves the adoption into, so the core function takes the decision as a parameter and `@evanion/react-feature` supplies the read. `libs/feature/src/lib/zones.ts` writes `process.env.TZ` and is a test helper that `package.json`'s `files` negates. **Library, as part of Task 14.**

**Does the type surface hold when a framework erases generics across a boundary?** The React erasure is already handled: `AnyDecisions` in `libs/feature/src/react/index.tsx:76` is the widened form a `createContext` can hold, `erased` and `atSchema` are the two casts, and `config-types.test-d.tsx` holds each re-exported name to the core's declaration. The gap is the other direction, where a framework asks the application to _name_ the type in a declaration. `Features` declares no default for `S`, so `declare const a: Features` is `TS2707: Generic type 'Features<S, Frozen>' requires between 1 and 2 type arguments`, and `Decisions` is `TS2314: requires 1 type argument(s)`. acl defaults all three parameters of `Access` to the open forms a JSON document carries, which is why `apps/storefront/src/env.d.ts` writes `access: Access | undefined` in `App.Locals` and `apps/admin/app/page-context.ts` writes `createContext<ReadAccess>`. A Nest provider token, an Astro `App.Locals` slot, a React Router `createContext` and a `cache()` return annotation are four declarations per application that would each have to write `Features<Schema>`. Task 17 gives `Features`, `Decisions` and `Plan` the same defaults `DecisionSet` already has. **Library.**

**Does a non-React framework have any way to adopt a `DecisionSet`?** No, and this is the largest finding. `libs/feature/src/react/hydrate.ts` holds `publishedDecisions`, `compared`, `sufficiency`, `pinSufficiency`, `diff`, `instantOf`, `production` and `VersionMismatchPolicy`: 439 lines that compare two config versions with `!==`, report `'unversioned'` and `'config-version'`, name every shipped decision this process could not reproduce and why, run the development diff, and choose between the shipped set and a local re-resolution. The core exports `DecisionSet`, `DecisionOrigin`, `SnapshotOptions`, `DivergenceObserver`, `DivergenceReport` and `DivergenceSide` as types and no function that consumes any of them. `resolvePlan` has an `onDivergence` option; the `DecisionSet` path has none. So an Astro island written in Svelte, a Vue application, a Nest process hydrating a template and a plain-DOM storefront each reimplement all of it, and `docs/specs/2026-09-23-feature-hydration.md` § 7 already says `onDivergence` belongs on a core entry point. Task 14 moves it down. **Library.**

### What stays with the application

- The principal. Who the request runs as, and how that value reaches deep code, is the application's: `AsyncLocalStorage` in Nest, `locals` in Astro, `cache` in RSC, a router context in React Router. The acl design spec refuses this for acl and the refusal carries.
- The source of the document. The library's contract ends at the document, which is issue #423 and `core-boundary.spec.ts`. A poller, a websocket, a database adapter and a scheduler stay outside, and no page in PIECE FOUR teaches one.
- The administration surface. How an operator edits a document is the reader's design problem, and no page teaches a control plane or a dashboard.
- A store per tenant. The application composes it.
- Exposure recording. `FeatureOptions.observe`'s docblock argues that `resolve` decides every configured feature and an exposure counted from it measures the wrong denominator. The render site writes the record.

### No framework adapter package

`@evanion/react-feature` exists because a React package is this repository's convention and `'use client'` is a per-module directive. `@evanion/acl` ships no Nest and no Astro package and documents both, and § 1 of the adapters spec explains why a distributor needs no package: a context write, a context read and a memo is what the framework supplies, and `apps/shop-api/src/acl/acl.module.ts` is 60 lines of application code. The same holds here. Nothing in this plan creates a second framework package.

## Rulings this plan makes where a spec is silent

1. **The core entry point is `adoptDecisions`.** § 7 of the hydration spec names `hydrateFeatures` as the carrier of `onDivergence`, and `hydrateFeatures` shipped as `parseFeatureConfig`, which builds a store from a document and knows nothing about a decision set. The two jobs are separate, so the decision-set side gets its own name. `adopt` is the verb `apps/admin/app/access.ts` and `apps/storefront-rsc/app/access.ts` both already use for taking in something another process produced.
2. **`adoptDecisions` takes `compare?: boolean` and reads no host global.** The React provider passes `onDivergence !== undefined && !production()`, which is the condition `hydrate.ts:313` computes today, and `production()` stays in `@evanion/react-feature`, where a bundler's `define` substitutes the literal text `process.env.NODE_ENV`. The core then answers the same way in Node, in a browser, in an edge runtime and under Deno.
3. **The bound caller is `features.for(context?)` and memoises nothing.** `acl`'s `Authorized` evaluates on every `can`, so a `toggle` or a `reload` between two calls is visible through the handle. A handle that cached its decisions would hide both.
4. **`features.for` settles `now` once and carries no other state.** `context.now ?? new Date()` is read at the `for` call, and every method on the handle resolves at that instant. An explicit `now` on the context passed to `for` wins, which keeps the precedence at `features.ts:922` unchanged and keeps a test able to pin the clock. Task 17b widens the field to an `Instant`, after which the read is `contextEpoch(context.now)` at both settling sites and the precedence is unchanged.
5. **`snapshot` writes a `Date` at a window condition's `value` as its ISO 8601 string and refuses nothing.** `serializeConfig` converts there and throws for a `Date` at any other member, which is ruling 4 of `docs/superpowers/plans/2026-09-29-feature-config-distribution.md`. A throw inside `snapshot` would fail a request over an explanation field, so `snapshot` converts the one member a document can carry and leaves every other value alone. The pitfalls page names the variant `value` a reader chose.
6. **`@evanion/react-feature` re-exports the document types, `VersionMismatchPolicy`, and every core type its own public declarations name.** `libs/feature/src/react/index.tsx:50-71` re-exports 20 document types so a component file imports one specifier, and `entry-surface.spec.tsx` holds the parity. The rule carries across the package boundary unchanged, and `VersionMismatchPolicy` joins it because the type names a provider prop while the core owns the behaviour.

   The rule reaches further than the entry does today. `FeatureProviderProps`, `BoundFeatureProviderProps`, `BoundVariant`, `FeatureContext`, `AnyDecisions`, `createFeatureContext`, `useFeature` and `useVariant` name `Features`, `EvaluationContext`, `Decisions`, `Decision`, `FeatureKey`, `VariantInfo`, `FrozenWhenObserved` and `Schema` between them, and the react entry re-exports none of the eight. Today that costs nothing, because both entries belong to one package. After Task 1 a reader writing one `FeatureProviderProps` annotation imports two specifiers. `libs/react-acl/src/index.tsx:16-33` re-exports exactly the core types its own declarations name, 20 of them, which is why its `api.mdx` carries 27 `##` headings for nine own declarations. Task 3 adds the eight named clauses and their headings, which takes `@evanion/react-feature`'s published surface from 37 names to 45.

7. **The names half of the entry parity check moves to `tools/repo-checks`.** `libs/feature/src/react/entry-surface.spec.tsx` reads `../index.ts` and `../lib/config.ts` off disk with the TypeScript parser. After the split those files belong to another project, and a cross-project disk read is what `tools/repo-checks` is for. Task 1b carries it. The runtime half, which reads the module namespace a bundler builds, stays in `libs/react-feature`.
8. **Every slice of the allowance work edits `apps/docs/content/feature/api.mdx` and removes exactly the names it documented.** The ratchet case `carries no allowance entry that is no longer needed` makes a slice that documents more than it removes fail, and `records no allowance for a package that has none` makes the last slice delete the key.
9. **`@evanion/react-feature` opens an allowance entry in Task 1 holding its 37 names, and Task 3 deletes the entry whole.** The check's own failure message says to record a name whose entry is not written yet, and the ratchet forces the removal. Opening it is what lets Task 1 land green without the documentation section.

## Review Focus

Input classes a happy-path test reaches none of. Each is assigned to the task that owns the code.

- **A `DecisionSet` adopted with no React in the program.** The adoption's whole test suite today runs under `jsdom` through `@testing-library/react`. A core function whose tests render nothing is the one that proves the move. Pinned in Task 14, Step 4.
- **A shipped decision for a feature the local store does not declare.** `sufficiency` reports it with no `local` side, and the message tells the reader to reload the store. `hydrate.ts:276-285` is the branch; nothing outside the React suite reaches it. Pinned in Task 14, Step 5.
- **A pinned assignment whose rule the local context cannot read, where the rule reads `now`.** `pinSufficiency` filters `now` out of the unreadable list because every entry point fills it, so a rule reading only a date window reports nothing. A test that passed a rule with a single `before` condition would prove the filter and a test with two fields would not. Pinned in Task 14, Step 6.
- **`'re-resolve'` under an `'unversioned'` outcome.** `hydrate.ts:321-323` resolves only for `'config-version'`, because discarding a shipped set over a literal store with no version would diverge on every mount. Pinned in Task 14, Step 7.
- **A `features.for` handle whose context carries an invalid `Date` at `now`.** `snapshot` throws `FeatureConfigError` and `resolve` stays total, so one handle holds a context two of its own methods answer differently. Pinned in Task 15, Step 5.
- **A `features.for` handle read after a `toggle` and after a `reload`.** Ruling 3 says both are visible. A handle built before the write and read after it is the case that proves it. Pinned in Task 15, Step 6.
- **A window condition whose `value` is already an ISO string or an epoch number, inside a `rules[].failed` outcome.** Every fixture an implementer writes carries a `Date`, so the pass-through is the path no happy-path test reaches. Pinned in Task 16, Step 4.
- **A `Date` nested inside an `AttributeCondition.value` in a failed outcome.** Ruling 5 leaves it, and a test that asserted a whole-set JSON round trip would fail on it. Pinned in Task 16, Step 5.
- **`Features`, `Decisions` and `Plan` named with no type argument, holding a store built from a document.** The defaults are only useful if the open forms accept what `parseFeatureConfig` returns. Pinned in Task 17, Step 3.
- **A context whose `now` crossed JSON and arrived as the ISO 8601 string.** Every fixture in the suite writes `new Date(...)`, and the one case that reached the string asserted that every clock condition answers false, which is the defect issue #451 reports. Pinned in Task 17b, Step 7.
- **A reference directive naming a type alias, an interface, a class and a constant.** `mdx-reference-loader.mjs` renders a different entry shape per kind and `readReference` resolves through `dist/`, so a slice that documented only interfaces would prove nothing about the others. Pinned in Task 4, Step 3.
- **A numeric `FeatureKey` on a page's fence.** `FeatureKey` is `string | number`, and a page that only ever writes string keys documents half the type. Pinned in Task 5, Step 4.
- **A store built from a literal whose variant `value` holds a `Date`.** The pitfalls page claims it does not survive `JSON.stringify`, and a page that claims an output has been run to get it. Pinned in Task 29, Step 3.
- **The `feature` section's page count crossing five.** `doc-floor.test.ts` requires a demonstration page of its own above five pages, and the section has eleven today, so the bound is already met and no page task may move `demo` off `rollouts`. Pinned in Task 18, Step 2.
- **`apps/docs/content/feature/` un-ignored while `content/next/feature/` exists.** Two copies of the section would both be authored pages, and `sectionOf` maps both to `feature`, so every per-section ratchet would double. Pinned in Task 32, Step 3.

---

# PIECE ONE: extract `@evanion/react-feature`

Task 1 is one commit and it is the largest task in this plan. It cannot be split four ways, because `releasedExports()` in `tools/repo-checks/src/released-exports.ts` builds one TypeScript program over every entry every manifest names and throws `is not in the program` for an entry file that does not exist, so a scaffold commit carrying a manifest and no `src/index.tsx` fails `repo-checks` on its own. The same holds in the other direction: the moment `libs/feature/src/react/index.tsx` leaves, `libs/feature/vite.config.ts`'s `@evanion/feature:react` project and `core-boundary.spec.ts`'s two React cases fail, and the moment `libs/react-feature` exports 37 undocumented names, `doc-export-coverage.test.ts` fails without its allowance key. The scaffold, the move, the core's own edits and the allowance land together or the tree is red.

One piece of Task 1 does separate, and it is Task 1b: the names half of the entry parity check moves into `tools/repo-checks`, which nothing fails without.

## Task 1: Scaffold the package and move the React adapter into it

**Deliverable:** `libs/react-feature` is a released package carrying `@evanion/react-feature`, `@evanion/feature` publishes one entry and declares no peer, and `npx nx run-many -t lint test typecheck build -p feature react-feature repo-checks docs` is green.

**Generator.** `@nx/react:library`, which is the generator `@nx/react` 23.3.0 provides and the one `nx.json`'s `generators` block already configures with `unitTestRunner: 'vitest'`:

```bash
npx nx g @nx/react:library libs/react-feature \
  --name=react-feature \
  --importPath=@evanion/react-feature \
  --bundler=vite \
  --unitTestRunner=vitest \
  --linter=eslint \
  --compiler=babel \
  --publishable \
  --component=false \
  --style=none \
  --useProjectJson=false \
  --skipFormat
```

**What to delete from its output**, so the tree matches `libs/react-acl`, which is the released React package this repository already has:

| From the generator                               | What happens to it                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `project.json`, or an `nx` key in `package.json` | Deleted. `libs/react-acl` has neither, and the `@nx/vite` and `@nx/vitest` plugins in `nx.json` infer `build`, `test` and `typecheck` from `vite.config.ts`.                                                                                                                                                                                                                                           |
| `src/index.ts`                                   | Deleted. `src/index.tsx` arrives from `libs/feature/src/react/index.tsx`.                                                                                                                                                                                                                                                                                                                              |
| `src/lib/`                                       | Deleted whole. `--component=false` leaves it empty or holding a stub.                                                                                                                                                                                                                                                                                                                                  |
| `README.md`                                      | Deleted. Task 2 writes the landing page.                                                                                                                                                                                                                                                                                                                                                               |
| `vite.config.ts`                                 | Replaced with `libs/react-acl/vite.config.ts`, with `react-acl` changed to `react-feature` in `cacheDir` and in `test.name` and `build.lib.name`.                                                                                                                                                                                                                                                      |
| `tsconfig.lib.json`                              | Kept, with `references` added for `../../tools/doc-examples` and `../feature/tsconfig.lib.json`.                                                                                                                                                                                                                                                                                                       |
| `tsconfig.spec.json`                             | Kept, with a `references` entry for `../../tools/doc-examples`. No `examples/**/*.tsx` entry: see the row below.                                                                                                                                                                                                                                                                                       |
| `eslint.config.mjs`                              | Replaced with `libs/react-acl/eslint.config.mjs`, minus the `examples/**/*.tsx` boundary exemption. This plan creates no `libs/react-feature/examples/`. `libs/react-acl/examples/` holds the seven components `libs/react-acl/src/examples.test.tsx` mounts and its guide pages cite by region; `@evanion/react-feature`'s three pages mount `apps/docs/components/probes/feature-probe.tsx` instead. |
| `.babelrc`                                       | Kept as the generator writes it; `libs/react-acl/.babelrc` is the same file.                                                                                                                                                                                                                                                                                                                           |
| `package.json`                                   | Every generator field replaced. The result is `libs/react-acl/package.json` with the name, description, keywords, `repository.directory` and the dependency changed.                                                                                                                                                                                                                                   |
| `src/test-setup.ts`                              | Copied from `libs/react-acl/src/test-setup.ts`, which carries the vitest 5 `Matchers<R, T>` augmentation.                                                                                                                                                                                                                                                                                              |
| `LICENSE`                                        | Copied from `libs/react-acl/LICENSE`. The generator writes none.                                                                                                                                                                                                                                                                                                                                       |

**Files:**

- `libs/react-feature/package.json`, `vite.config.ts`, `eslint.config.mjs`, `.babelrc`, `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `LICENSE` (new)
- `libs/react-feature/src/index.tsx` (moved from `libs/feature/src/react/index.tsx`)
- `libs/react-feature/src/hydrate.ts` (moved from `libs/feature/src/react/hydrate.ts`)
- `libs/react-feature/src/react.spec.tsx`, `hydrate.spec.tsx`, `hydrate-boundaries.spec.tsx`, `entry-surface.spec.tsx`, `types.test-d.tsx`, `config-types.test-d.tsx`, `hydrate-boundaries.test-d.tsx` (moved)
- `libs/react-feature/src/test-setup.ts` (new)
- `libs/react-feature/docs/examples.md` (new, holding the six `react-*` regions and `observe-exposure`)
- `libs/react-feature/doc-examples.preamble.ts` (new)
- `libs/feature/docs/examples.md` (edit: the six `react-*` regions, the `observe-exposure` region at line 1110, and the prose above each come out)
- `libs/feature/package.json` (edit: `exports`, `peerDependencies`, `peerDependenciesMeta`, `keywords`)
- `libs/feature/vite.config.ts` (edit: the `@evanion/feature:react` project and the `react()` plugin come out)
- `libs/feature/src/index.ts` (edit: `reportDivergence` and `ruleFields` are exported, and the header docblock's last sentence names the package)
- `libs/feature/src/lib/core-boundary.spec.ts` (edit)
- `libs/feature/tsconfig.spec.json` (edit: `"jsx": "react-jsx"` and `"react"` in `types` come out, and so do the `src/**/*.test-d.tsx`, `src/**/*.test.tsx`, `src/**/*.spec.tsx` and `src/test-setup.ts` entries of `include`)
- `libs/feature/src/test-setup.ts` (deleted: after the move no project in `libs/feature` renders anything, and the file carries the `@testing-library/jest-dom` matcher augmentation)
- `apps/docs/content/feature/api.mdx` (edit: `## reportDivergence` and `## ruleFields` entries, and the new specifier)
- `apps/docs/content/feature/react.mdx` (edit: the six fences point at `libs/react-feature/docs/examples.md`)
- `apps/docs/content/feature/observing.mdx` (edit: the `observe-exposure` fence at line 102 points at `libs/react-feature/docs/examples.md`)
- `tools/repo-checks/src/released-manifests.ts` (new: the released-package manifest reader `released-pins.test.ts` inlined, now that a second rule reads it)
- `tools/repo-checks/src/publishable-dependencies.ts`, `publishable-dependencies.test.ts` (new)
- `tools/repo-checks/src/released-pins.ts`, `released-pins.test.ts` (edit: both take the manifests from the shared reader)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit: `@evanion/feature` goes from 88 `undocumented` names to 77 and loses three entries across `unexercised` and `unexplained`, and a `@evanion/react-feature` key opens with 37)
- `commitlint.config.js` (edit)
- `apps/docs/app/navigation.ts` (edit)
- `scripts/verify-packaging.mjs` (edit)
- `package-lock.json` (edit, from `npm install`)

**Interfaces consumed:**

```ts
// libs/feature/src/index.ts
export { createFeatures } from './lib/features.js';
export { resolvePlan } from './lib/resolve-plan.js';
export type { Features } from './lib/features.js';
export type {
  DecisionOrigin,
  DecisionSet,
  SnapshotOptions,
} from './lib/decision-set.js';
export type {
  DivergenceObserver,
  DivergenceReport,
  DivergenceSide,
} from './lib/divergence.js';
export type { DeepReadonly, FrozenWhenObserved } from './lib/observe.js';
// Added by this task, because `@evanion/source` resolves `@evanion/feature` to
// this file and to no deeper path.
export { reportDivergence } from './lib/divergence.js';
export { ruleFields } from './lib/evaluate.js';
export type {
  Decision,
  Decisions,
  EvaluationContext,
  FeatureDefinition,
  FeatureKey,
  Schema,
  VariantInfo,
} from './lib/types.js';
```

**Interfaces produced:**

```ts
// libs/react-feature/src/index.tsx — the eleven own declarations and the
// re-exported `VersionMismatchPolicy`, unchanged in shape. The other 26 of the
// 37 are the `config.ts`, `decision-set.ts` and `divergence.ts` re-exports.
export type AnyDecisions = Readonly<Record<FeatureKey, Decision<FeatureKey>>>;
export type { VersionMismatchPolicy } from './hydrate.js';

export interface FeatureProviderProps<
  S extends Record<keyof S, VariantInfo | never> = Schema,
> {
  features: Features<S>;
  context?: EvaluationContext;
  decisions?: DecisionSet<S>;
  onDivergence?: DivergenceObserver<keyof S & FeatureKey>;
  onVersionMismatch?: VersionMismatchPolicy;
  children?: ReactNode;
}

export interface BoundFeatureProviderProps<
  S extends Record<keyof S, VariantInfo | never>,
  Frozen extends boolean = boolean,
> {
  features?: Features<S, Frozen>;
  context?: EvaluationContext;
  decisions?: DecisionSet<S, Frozen>;
  onDivergence?: DivergenceObserver<keyof S & FeatureKey>;
  onVersionMismatch?: VersionMismatchPolicy;
  children?: ReactNode;
}

export type BoundVariant<
  S extends Record<keyof S, VariantInfo | never>,
  K extends keyof S,
> = [S[K]] extends [never]
  ? { variant?: undefined; value?: undefined }
  : Decisions<S>[K] extends { variant?: infer V; value?: infer T }
    ? { variant?: V; value?: T }
    : never;

export interface FeatureContext<
  S extends Record<keyof S, VariantInfo | never>,
  Frozen extends boolean = boolean,
> {
  FeatureProvider(props: BoundFeatureProviderProps<S, Frozen>): ReactElement;
  useFeatures(): FrozenWhenObserved<Frozen, Decisions<S>>;
  useFeature<K extends keyof S & FeatureKey>(
    key: K,
  ): FrozenWhenObserved<Frozen, Decisions<S>[K]>;
  useFeatureEnabled<K extends keyof S & FeatureKey>(key: K): boolean;
  useVariant<K extends keyof S & FeatureKey>(key: K): BoundVariant<S, K>;
}

export function FeatureProvider<S extends Record<keyof S, VariantInfo | never>>(
  props: FeatureProviderProps<S>,
): ReactElement;
export function createFeatureContext<
  S extends Record<keyof S, VariantInfo | never>,
  Frozen extends boolean = boolean,
>(features: Features<S, Frozen>): FeatureContext<S, Frozen>;
export function useFeatures(): AnyDecisions;
export function useFeature(key: FeatureKey): Decision<FeatureKey>;
export function useFeatureEnabled(key: FeatureKey): boolean;
export function useVariant(
  key: FeatureKey,
): Pick<Decision, 'variant' | 'value'>;
```

### Steps

- [ ] Run the generator with the flags above, then delete what the table says to delete.

- [ ] Write `libs/react-feature/package.json`:

```json
{
  "name": "@evanion/react-feature",
  "version": "0.0.1",
  "description": "The React binding for @evanion/feature: a provider and hooks over an already-built feature store.",
  "keywords": [
    "react",
    "feature-flags",
    "feature-toggles",
    "rollout",
    "variants",
    "hooks",
    "typescript"
  ],
  "homepage": "https://github.com/Evanion/libraries/tree/main/libs/react-feature#readme",
  "bugs": { "url": "https://github.com/Evanion/libraries/issues" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Evanion/libraries.git",
    "directory": "libs/react-feature"
  },
  "license": "MIT",
  "author": "Mikael Pettersson",
  "type": "module",
  "sideEffects": false,
  "engines": { "node": ">=20" },
  "types": "./dist/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "@evanion/source": "./src/index.tsx",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "!dist/**/*.tsbuildinfo",
    "src",
    "!src/**/*.test.*",
    "!src/**/*.spec.*",
    "!src/**/*.test-d.*",
    "!src/test-setup.ts",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "publishConfig": { "access": "public", "provenance": true },
  "dependencies": { "@evanion/feature": "0.0.1" },
  "peerDependencies": { "react": "^18.0.0 || ^19.0.0" },
  "devDependencies": { "@evanion/doc-examples": "*" }
}
```

- [ ] Write `libs/react-feature/vite.config.ts` from `libs/react-acl/vite.config.ts`, changing three literals and the external list:

```ts
  cacheDir: '../../node_modules/.vite/libs/react-feature',
  // build.lib
    lib: {
      entry: 'src/index.tsx',
      name: '@evanion/react-feature',
      fileName: 'index',
      formats: ['es' as const],
    },
    rolldownOptions: {
      // React and the core are peers/dependencies, so they resolve to the
      // consumer's copies. Bundling them would put a second React in the graph
      // and inline the core into every adapter.
      external: ['react', 'react-dom', 'react/jsx-runtime', '@evanion/feature'],
    },
  // test.name
    name: '@evanion/react-feature',
```

- [ ] Add `export { reportDivergence } from './lib/divergence.js';` and `export { ruleFields } from './lib/evaluate.js';` to `libs/feature/src/index.ts`. `libs/react-feature/src/hydrate.ts` needs both and `libs/react-feature/src/index.tsx` calls `reportDivergence` at what is `libs/feature/src/react/index.tsx:269` today, to deliver the memo's collected reports to the provider's observer. `tsconfig.base.json:48` sets `customConditions: ["@evanion/source"]` and `libs/feature/package.json` publishes `"."` and `"./package.json"` only, so `@evanion/source` resolves `@evanion/feature` to `src/index.ts` and to nothing else. No deep path to `src/lib/` exists, in the typechecker or in the published package. Give each name an `##` entry with a reference directive on `apps/docs/content/feature/api.mdx` in this task, and record neither in the allowance. `reportDivergence` carries the thenable-rejection handler and the swallowed throw that `libs/feature/src/lib/divergence.ts:45-62` argues for, so a copy inlined into `libs/react-feature` would drift from the core's.

- [ ] Move the two source modules and rewrite their relative imports to the package specifier. `libs/react-feature/src/hydrate.ts` opens with:

```ts
import {
  reportDivergence,
  ruleFields,
  ruleId,
  assignVariant,
} from '@evanion/feature';
```

- [ ] Move the seven test and type-test files. In each, `../index.js` becomes `@evanion/feature`, `../lib/...` becomes `@evanion/feature`, and `./index.js` stays. `libs/react-feature/src/entry-surface.spec.tsx` keeps every case for now, including the two that read `../index.ts` and `../lib/config.ts` off disk, with their paths changed to `../../feature/src/index.ts` and `../../feature/src/lib/config.ts`. Task 1b is what moves those two to `tools/repo-checks`, per ruling 7.

- [ ] Write `libs/react-feature/doc-examples.preamble.ts`:

```ts
import * as React from 'react';
import { useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createFeatures } from '@evanion/feature';
import {
  createFeatureContext,
  FeatureProvider,
  useFeature,
  useFeatureEnabled,
  useFeatures,
  useVariant,
} from '@evanion/react-feature';
```

- [ ] Move the six `react-*` regions and the `observe-exposure` region out of `libs/feature/docs/examples.md` (lines 1110, 1179, 1211, 1261, 1299, 1357, 1403 and the prose above each) into `libs/react-feature/docs/examples.md`, with the import lines changed to `@evanion/react-feature`. Keep the region names: `react-provider`, `react-memo`, `react-strict-key`, `react-decisions`, `react-bound`, `react-server`, `observe-exposure`.

  `observe-exposure` is a seventh React region and it moves for the same reason the six do. Its fence writes `import { createFeatureContext } from '@evanion/feature/react';`, renders JSX and calls `renderToStaticMarkup`, and the moment this task deletes the `./react` entry of `libs/feature/package.json`'s `exports` that import resolves to nothing: `doc-exports.test.ts` reads the named bindings of every `import … from '@evanion/…'` in any fence against the package's export list, and `npx nx run docs:build` compiles the fence with twoslash. Leaving it in the core's examples file with its import changed to `@evanion/react-feature` would put a `@evanion/react-feature` import in the core package's own examples file, which is a dependency edge the wrong way round.

- [ ] Repoint the six fences in `apps/docs/content/feature/react.mdx` at lines 19, 29, 52, 62, 70 and 82, and the `observe-exposure` fence in `apps/docs/content/feature/observing.mdx` at line 102, at `file=libs/react-feature/docs/examples.md`. The region loader throws on a region that is not in the file it names, and this task's own verification runs `-p docs`. Task 3 is what deletes `react.mdx`; `observing.mdx` stays in the core's section and keeps the repointed fence.

- [ ] Edit `libs/feature/package.json`: delete the `./react` entry of `exports`, `peerDependencies`, `peerDependenciesMeta`, and the `"react"` keyword.

- [ ] Edit `libs/feature/vite.config.ts`: delete the `@evanion/feature:react` project, the `react()` plugin, the `@vitejs/plugin-react` import and the comment about plugin order. The remaining `projects` array holds one entry; collapse it into the top-level `test` block with `name: '@evanion/feature'`, keeping `typecheck.include` at `src/lib/**/*.test-d.{ts,tsx}` and `includeSource: docExampleSources()`.

- [ ] Edit `libs/feature/tsconfig.spec.json` and delete `libs/feature/src/test-setup.ts`. The spec config drops `"jsx": "react-jsx"`, `"react"` from `types`, and the `src/**/*.test.tsx`, `src/**/*.spec.tsx`, `src/**/*.test-d.tsx` and `src/test-setup.ts` entries of `include`. After the move no file under `libs/feature/src` renders anything, so the `@testing-library/jest-dom` matcher augmentation the setup file carries has no suite to serve.

- [ ] Document the two new exports in this task, because the allowance only ever shrinks and `doc-export-coverage.test.ts` asks four things of every published name:
  - A `##` entry with a reference directive on `apps/docs/content/feature/api.mdx` for each. Both are callables, so both directives carry `example=`.
  - A `divergence-report` region and a `rule-fields` region in `libs/feature/docs/examples.md`. `divergence-report` calls `reportDivergence` with an observer that pushes into an array and then with `undefined`, and shows that an observer which throws alters nothing. `rule-fields` calls `ruleFields` over a rule with two conditions and a rollout and prints the sorted list. `libs/feature/src/lib/divergence.spec.ts:46` holds the first's expected values; read them rather than guessing the second's.
  - A `describe('ruleFields')` suite in `libs/feature/src/lib/conditions.spec.ts`, which is where the rest of `evaluate.ts`'s field reading is covered. `tools/repo-checks/src/doc-behaviour.test.ts` requires a `describe` spelling every non-error callable export exactly and carries no allowance, and `ruleFields` has none today. `reportDivergence` already has one at `libs/feature/src/lib/divergence.spec.ts:46`.
  - Docblocks are already on both declarations, at `libs/feature/src/lib/divergence.ts:30-51` and `libs/feature/src/lib/evaluate.ts:31`.

- [ ] Edit `libs/feature/src/lib/core-boundary.spec.ts`:
  - `it('keeps react its only peer')` becomes `it('declares no peer')`, asserting `Object.keys(manifest().peerDependencies ?? {})` equals `[]`.
  - `unallowedImports` loses the `react` exemption and becomes `foreignImports`.
  - `describe('the react entry')` comes out whole.
  - `describe('the exemption the scan allows')` comes out whole, with its five fixture cases.
  - `it('reaches every entry the package publishes')` drops the `react/index.tsx` assertion and keeps `index.ts`, `lib/config.ts` and `lib/features.ts`.
  - The `describe('the core')` comment about `react` being the one peer is rewritten to say the package declares none.
  - A `leadingDirective` reader and a `directiveOffences` scan over `sources(ROOT)` join the import and timer scans, with `it('opens no published module with a directive')` in `describe('the core')` and a `describe('the directives the scan reports')` block of fixture cases. The whole-tree scan is the rule, not an entry check: `tsc` emits this package file-per-file, so a `'use client'` on `src/lib/features.ts` ships as `dist/lib/features.js` and pulls the Nest service, the build-time pass and every Server Component that calls `createFeatures` into the client bundle. `libs/react-feature/src/client-directive.spec.ts` keeps the half about its own entry and drops its single read of the core's, which is a cross-project disk read ruling 7 refuses.

- [ ] Repoint every consumer an nx target reads:
  - `libs/feature/src/index.ts`'s header docblock: the last sentence names `@evanion/react-feature`.
  - `libs/feature/src/react/index.tsx:121`'s error message, which travels to the new package, becomes `'useFeatures must be called inside a <FeatureProvider> (from @evanion/react-feature)'`.
  - `apps/docs/content/feature/api.mdx`, `index.mdx` and `react.mdx` name the new specifier. Task 3 moves `react.mdx`; this step only changes the specifier in the two that stay.

- [ ] Add `'react-feature'` to `commitlint.config.js`'s `scope-enum`, between `'react-acl'` and the repository-scopes comment.

- [ ] Add the navigation entry to `apps/docs/app/navigation.ts`, after the `@evanion/feature` entry, and change the `@evanion/feature` entry's `framework` to `'universal'` and add `familyId: 'feature'`:

```ts
  {
    name: '@evanion/react-feature',
    root: 'libs/react-feature',
    slug: 'react-feature',
    title: 'React Feature',
    group: 'standalone',
    familyId: 'feature',
    framework: 'React',
    // One hue for the whole family, the way the rendering family carries `sky`.
    hue: 'amber',
    documented: false,
    workshop: true,
  },
```

Update the `framework` docblock, which cites `@evanion/feature` as the "universal + React" case, so it names the family instead.

- [ ] Edit `tools/repo-checks/src/doc-export-coverage-allowance.json`. `@evanion/react-feature` publishes 37 names, not twelve: `libs/feature/src/react/index.tsx:47` re-exports 20 types from `lib/config.ts`, line 87 re-exports `DecisionOrigin` and `DecisionSet`, line 88 re-exports `DivergenceObserver`, `DivergenceReport` and `DivergenceSide`, and eleven declarations are the entry's own. `exportsOf` in `tools/repo-checks/src/released-exports.ts` calls `checker.getExportsOfModule`, which lists a re-exported name under the re-exporting package, which is why `apps/docs/content/next/react-acl/api.mdx` carries 27 `##` headings for nine own declarations.
  - Open a `@evanion/react-feature` key holding all 37 names under `undocumented`, sorted. The file's keys stay sorted, so `@evanion/react-feature` follows `@evanion/feature`.
  - Put `FeatureProvider`, `createFeatureContext`, `useFeature`, `useFeatures`, `useFeatureEnabled` and `useVariant` under `unexercised`. `executableCode` in `doc-export-coverage.test.ts` keys the fence body by `entry.slug` and reads `code.get(entry.slug) ?? ''`, so with no page under the `react-feature` slug every one of the six callables is unexercised, and not `useFeatures` alone.
  - Put `FeatureProvider` and `FeatureProviderProps` under `unexplained`. Neither carries a docblock.
  - Remove eleven names from `@evanion/feature`'s `undocumented` list, not twelve. `FeatureProvider` is not in it, because `apps/docs/content/feature/react.mdx:15` already gives it a heading. The list goes from 88 names to 77.
  - Remove `FeatureProvider` and `FeatureProviderProps` from `@evanion/feature`'s `unexplained` list, and `useFeatures` from its `unexercised` list. `doc-export-coverage.test.ts`'s `carries no allowance entry that is no longer needed` fails on a name the package no longer exports.

- [ ] Repoint `scripts/verify-packaging.mjs`, which `npm run verify:packaging` runs as the `packaging` job on every pull request and which no nx target reads. Nothing packs or checks the new package until `LIBS` names it, and the three fixtures still name the entry `libs/feature/package.json` dropped:
  - `LIBS` gains `['libs/react-feature', '@evanion/react-feature'],`.
  - The consumer's `@evanion/feature/react` import becomes `@evanion/react-feature`, and a second line imports `FeatureProviderProps` and `AnyDecisions` as types. Both get an annotated binding, the way the `react-acl` block annotates `PolicyProviderProps`. No backtick in the comment above them: the consumer source is a template literal.
  - The runtime pass's `@evanion/feature/react` import becomes `@evanion/react-feature`.
  - The two-entry assertions become the pair assertions the acl block makes: every module under `@evanion/feature`'s `dist` imports nothing from `react` and opens with no `'use client'` or `'use server'`, `@evanion/react-feature`'s `dist/index.js` carries `'use client'` as its first line, and the core's `exports` holds `.` and no `./react`. The `dist/react` filter on the core's module list goes with the entry. The directive scan reads every core module and not `dist/index.js` alone, for the reason the import scan already does: `tsc` emits the core file-per-file, the entry only re-exports, and a directive on `dist/lib/features.js` is the one a consumer's bundler reads.

- [ ] `npm install`, then `npx nx run-many -t lint test typecheck build -p feature react-feature repo-checks docs`, then `npm run verify:packaging`.

**Verification:** `npx nx run-many -t lint test typecheck build -p feature react-feature repo-checks docs` passes, `node -e "const p=require('./libs/feature/package.json'); console.log(Object.keys(p.exports), p.peerDependencies)"` prints `[ './package.json', '.' ] undefined`, and `npm run verify:packaging` passes.

---

## Task 1b: The entry parity check moves to `tools/repo-checks`

**Deliverable:** the names half of the old `entry-surface.spec.tsx` reads both packages' sources from `tools/repo-checks`, and `libs/react-feature/src/entry-surface.spec.tsx` holds only the runtime half.

Ruling 7 is why. `libs/feature/src/react/entry-surface.spec.tsx` read `../index.ts` and `../lib/config.ts` off disk with the TypeScript parser. After Task 1 those two files belong to another project, and a cross-project disk read is what `tools/repo-checks` is for.

**Files:**

- `tools/repo-checks/src/feature-entry-parity.test.ts` (new)
- `libs/react-feature/src/entry-surface.spec.tsx` (edit: the two disk-reading cases come out)

### Steps

- [ ] Write `tools/repo-checks/src/feature-entry-parity.test.ts`: every type `libs/feature/src/lib/config.ts` publishes through `libs/feature/src/index.ts` is re-exported by `libs/react-feature/src/index.tsx` in a named clause, and `libs/react-feature/src/index.tsx` re-exports no `config.ts` type the core keeps to itself. Carry the original docblock's reasoning, with the two paths updated.

- [ ] Delete the two cases from `libs/react-feature/src/entry-surface.spec.tsx` that the new check now makes, and keep every case that reads the module namespace a bundler builds.

- [ ] `npx nx run-many -t lint test typecheck -p react-feature repo-checks`.

**Verification:** `npx nx run-many -t test -p repo-checks react-feature` passes, and deleting one name from `libs/react-feature/src/index.tsx`'s `config.ts` re-export clause by hand fails `feature-entry-parity.test.ts`.

---

## Task 2: The two READMEs

**Deliverable:** `libs/react-feature/README.md` is an npm landing page with one tested example, and `libs/feature/README.md` names no React surface.

**Files:**

- `libs/react-feature/README.md` (new)
- `libs/feature/README.md` (edit)

### Steps

- [ ] Draft `libs/react-feature/README.md` with the structure `libs/react-acl/README.md` uses: an H1, a bold one-line claim, a Pain to Cure section naming the prop-drill the hooks remove, a solution section, one tested region, Key Features, Installation, Documentation, License. The region is `server-render`-shaped: a server resolves a `DecisionSet` with `features.snapshot`, a provider publishes it, and a component reads one variant. Set it in the game shop.

- [ ] Write the region as a `tsx @import.meta.vitest` fence inside the README, with the preamble's imports above a `// ---cut---` line, so `includeSource: docExampleSources('tsx')` runs it and the page shows the provider and the hook. Every `// ->` claim is a value produced by running it.

- [ ] Run the draft through Gemma, read her output against `libs/react-feature/src/index.tsx`, and change only factual errors.

- [ ] Edit `libs/feature/README.md`: the Key Features bullet at line 70 drops `@evanion/feature/react` and names the API and the build script; the compatibility bullet at line 71 says the package is ESM only, needs Node 20 or newer, has no dependencies and imports no framework, and names `@evanion/react-feature` as the React binding under Documentation. Run the two edited sections through Gemma.

- [ ] `npx nx run-many -t lint test -p feature react-feature repo-checks`.

**Verification:** both packages' doctest suites run the README regions, and `npx nx run-many -t test -p repo-checks` passes, which includes `doc-md-siblings.test.ts` and `prettier-formatting.test.ts`.

---

## Task 3: `@evanion/react-feature`'s documentation section

**Deliverable:** `apps/docs/content/next/react-feature/` holds an overview, a getting-started page that doubles as the demonstration, and an API reference with 45 `##` entries, and the allowance's `@evanion/react-feature` key is gone.

45, not twelve. 37 names arrive with Task 1, and this task adds the eight core types ruling 6 extends the re-export rule to. `exportsOf` lists a re-exported name under the re-exporting package, so every one of the 45 owes a heading before the allowance key can come out.

**Files:**

- `apps/docs/content/next/react-feature/_meta.ts`, `index.mdx`, `getting-started.mdx`, `api.mdx` (new)
- `libs/react-feature/src/index.tsx` (edit: the eight core-type re-exports of ruling 6, and docblocks on `FeatureProvider` and `FeatureProviderProps`)
- `apps/docs/content/feature/react.mdx` (deleted)
- `apps/docs/content/feature/_meta.ts` (edit: the `react` key comes out)
- `apps/docs/content/feature/api.mdx` (edit: the `React exports` section at line 749 comes out)
- `apps/docs/content/feature/index.mdx` (edit: `Two Entry Points` becomes the core and the React package, and the `[React](./react)` link becomes `/react-feature/`)
- `apps/docs/content/feature/variants.mdx` (edit: the `[React](../react)` link becomes `/react-feature/`)
- `apps/docs/app/navigation.ts` (edit: `documented: true`, `demo: 'getting-started'`)
- `apps/docs/tools/redirects.mjs` (edit)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit: the `@evanion/react-feature` key is deleted)
- `tools/repo-checks/src/doc-fence-allowance.json` (edit: `feature` goes to 11)

**Interfaces consumed:** the 37 names Task 1 moved, plus the eight core types this task re-exports.

### Steps

- [ ] Add the eight core-type re-exports to `libs/react-feature/src/index.tsx`, per ruling 6, in one named clause beside the `config.ts` clause: `Decision`, `Decisions`, `EvaluationContext`, `Features`, `FeatureKey`, `FrozenWhenObserved`, `Schema`, `VariantInfo`, all from `@evanion/feature`. Carry the `config.ts` clause's docblock argument, with the sentence that names which declaration needs which type.

- [ ] Write `apps/docs/content/next/react-feature/api.mdx` with one `##` heading per published name and a reference directive under each, 45 in all. The six callables carry `example=`:

```md
## `FeatureProvider`

<!-- reference @evanion/react-feature#FeatureProvider example=react-provider -->

## `createFeatureContext`

<!-- reference @evanion/react-feature#createFeatureContext example=react-bound -->

## `useFeature`

<!-- reference @evanion/react-feature#useFeature example=react-decisions -->

## `useFeatures`

<!-- reference @evanion/react-feature#useFeatures example=react-decisions -->

## `useFeatureEnabled`

<!-- reference @evanion/react-feature#useFeatureEnabled example=react-provider -->

## `useVariant`

<!-- reference @evanion/react-feature#useVariant example=react-decisions -->

## `AnyDecisions`

<!-- reference @evanion/react-feature#AnyDecisions -->

## `FeatureProviderProps`

<!-- reference @evanion/react-feature#FeatureProviderProps -->

## `BoundFeatureProviderProps`

<!-- reference @evanion/react-feature#BoundFeatureProviderProps -->

## `BoundVariant`

<!-- reference @evanion/react-feature#BoundVariant -->

## `FeatureContext`

<!-- reference @evanion/react-feature#FeatureContext -->

## `VersionMismatchPolicy`

<!-- reference @evanion/react-feature#VersionMismatchPolicy -->
```

Then one entry per re-exported type: the 20 `config.ts` document types, `DecisionOrigin`, `DecisionSet`, `DivergenceObserver`, `DivergenceReport`, `DivergenceSide`, and the eight core types of ruling 6. Each carries a reference directive with no `example=`, and each carries editorial prose that says what the React surface uses it for and links the core's own entry for the rest, which is what `apps/docs/content/next/react-acl/api.mdx` does for its 20.

All six callables sit in `unexercised`, and not `useFeatures` alone: `executableCode` reads `code.get(entry.slug) ?? ''` and there is no page under the `react-feature` slug until this task writes one. So all six directives need `example=`, and each cited region's shown lines below the `// ---cut---` have to name the function. Check all six and add the call where a region does not make it.

- [ ] `FeatureProviderProps` carries no docblock of its own and `FeatureProvider` carries none either; both sit in the `unexplained` list. Write the two docblocks in `libs/react-feature/src/index.tsx` beside the declarations, and keep the per-member prose that is already on `FeatureProviderProps`'s fields.

- [ ] Write `index.mdx` as the section overview: what the binding does, what it decides (nothing), which side of a render a decision counts on, and a link to `/feature/` for everything a rule is made of. Follow `apps/docs/content/next/react-acl/index.mdx`, whose comment in `navigation.ts` states the division.

- [ ] Write `getting-started.mdx` as stage 2 of a reader's journey and as the demonstration: prerequisites, `npm install @evanion/react-feature @evanion/feature`, the smallest provider that runs, and one result the reader sees. `doc-success-moment.test.ts` requires the result, and `doc-control.test.ts` requires a mounted control on the demonstration page, so mount the existing `feature-probe` control from `apps/docs/components/probes/`, or register a provider-shaped control beside it.

- [ ] Write `_meta.ts` with `index`, `getting-started`, `api`, and the docblock saying why that order.

- [ ] Delete `apps/docs/content/feature/react.mdx`, drop the `react` key from `apps/docs/content/feature/_meta.ts`, and move what it taught into the new section's three pages.

- [ ] Cut the `React exports` section out of `apps/docs/content/feature/api.mdx` (line 749 to the end), and change its opening paragraph at line 5 so it names one entry point and links `/react-feature/api`.

- [ ] Lower `feature` in `tools/repo-checks/src/doc-fence-allowance.json` from 12 to 11. All 12 of the section's unexplained fences are bare ` ```ts ` blocks in `apps/docs/content/feature/api.mdx`, at lines 10, 186, 315, 331, 348, 375, 421, 471, 492, 502, 533 and 751, and the one at 751 is inside the `React exports` section this task cuts. `doc-fence.test.ts`'s `leaves no allowance larger than the section needs` fails on an allowance above the real count.

- [ ] Add `['feature/react', 'react-feature/getting-started']` to `movedPages` in `apps/docs/tools/redirects.mjs`.

- [ ] Repoint every in-repo link to `/feature/react` at the new section, because `doc-redirects.test.ts`'s `pages still linking a moved path > are the ones the allowance names` declares `const allowance: string[] = []` and fails on an authored page whose link resolves to a `movedPages` key. The two are `apps/docs/content/feature/index.mdx`, whose `Two Entry Points` section links it, and `apps/docs/content/feature/variants.mdx`, which hands these decisions to a component tree. `apps/docs/content/feature/api.mdx` links it too, inside the `React exports` section this task cuts.

- [ ] Set `documented: true` and `demo: 'getting-started'` on the `@evanion/react-feature` entry in `apps/docs/app/navigation.ts`.

- [ ] Delete the whole `@evanion/react-feature` key from `tools/repo-checks/src/doc-export-coverage-allowance.json`.

- [ ] Run each of the three pages through Gemma, one page at a time, and read her output against `libs/react-feature/src/index.tsx`.

- [ ] `npx nx run docs:archives`. `docs-archive.test.ts`'s `are exactly the directories the plan names` asserts `Object.keys(versions.json.sections)` equals the documented, non-unversioned slugs, and `have a /next/ tree exactly where they have a bare path` asserts `content/react-feature/` exists. `apps/docs/package.json` makes `docs:test` depend on `archives`, `tools/repo-checks/package.json` carries no `nx` key and so no `dependsOn`, and `docs-archive.test.ts` lives in `tools/repo-checks`. Nothing runs `archives` for you here.

- [ ] `npx nx run-many -t build -p feature react-feature` then `npx nx run-many -t lint test typecheck -p docs repo-checks react-feature`.

**Verification:** `npx nx run-many -t test -p repo-checks` passes with no `@evanion/react-feature` entry in the allowance, `node -p "Object.keys(require('./apps/docs/content/versions.json').sections)"` lists `react-feature`, and `npx nx run docs:build` renders every reference directive.

---

# PIECE TWO: empty the documentation allowance

Each task edits `apps/docs/content/feature/api.mdx`, writes a docblock where the `unexplained` list names one, adds or cites a region in `libs/feature/docs/examples.md` where the `unexercised` list names one, and removes exactly the names it documented from `tools/repo-checks/src/doc-export-coverage-allowance.json`. The standard is `apps/docs/content/next/acl/api.mdx`: 107 `##` headings, 105 reference directives, a `<ApiFilter />` at the top, and editorial prose under each entry that the loader never touches.

Every task in this piece runs `npx nx run-many -t build -p feature` first, because `readReference` resolves through `dist/`.

| Task | Subject                              | Names | Needs a region                                 | Needs a docblock         |
| ---- | ------------------------------------ | ----- | ---------------------------------------------- | ------------------------ |
| 4    | Error classes                        | 6     | `DuplicateVariantError`, `UnknownVariantError` | none                     |
| 5    | Definitions, conditions and instants | 12    | `evaluateCondition`                            | `Condition`              |
| 6    | Variants, rollout and bucketing      | 10    | `assignVariant`, `variantSeedOf`, `murmur3`    | none                     |
| 7    | Decisions and the plan               | 9     | `resolvePlan`                                  | `Reason`, `ToggleResult` |
| 8    | The two schema vocabularies          | 7     | none                                           | none                     |
| 9    | Typed construction                   | 6     | none                                           | none                     |
| 10   | The distribution surface             | 8     | `canonical`, `ruleId`                          | none                     |
| 11   | The serialized document types        | 7     | none                                           | none                     |
| 12   | Hydration and agreement              | 6     | none                                           | none                     |
| 13   | The observation seam                 | 6     | none                                           | none                     |

## Task 4: The error classes

**Deliverable:** six `##` headings with reference directives, two of them exercised, and six names out of the allowance.

**Names:** `DuplicateFeatureError`, `DuplicateVariantError`, `FeatureConfigError`, `FeatureCycleError`, `UnknownDependencyError`, `UnknownVariantError`.

**Files:**

- `apps/docs/content/feature/api.mdx` (edit: the `Errors` section at line 737 becomes six entries)
- `libs/feature/docs/examples.md` (edit: two regions)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)

### Steps

- [ ] Replace the `## Errors` section with six entries, each an `##` heading spelling the class name and a reference directive. `DuplicateVariantError` and `UnknownVariantError` carry `example=`:

```md
## `FeatureCycleError`

<!-- reference @evanion/feature#FeatureCycleError example=config-errors -->

## `DuplicateVariantError`

<!-- reference @evanion/feature#DuplicateVariantError example=variant-errors -->
```

- [ ] Add a `variant-errors` region to `libs/feature/docs/examples.md` holding a `ts @import.meta.vitest` fence that constructs a store with a duplicate variant name and one with a rule naming a variant the definition does not declare, catching each and reading `error.name`. Model it on the existing `config-errors` region at line 107, which already covers `FeatureCycleError`, `UnknownDependencyError` and `DuplicateFeatureError`.

- [ ] **Review Focus, Step 3.** The six names are four kinds between them as `readReference` reads them: `FeatureConfigError` is the base class, the other five extend it. Build `feature` and run `npx nx run docs:build` to confirm every entry renders with the `error` kind chip, because `mdx-reference-loader.mjs` maps `error` and `class` to different labels and a class the loader reads as a plain `class` renders the wrong chip.

- [ ] Remove the six names from `undocumented` and `DuplicateVariantError` and `UnknownVariantError` from `unexercised`.

- [ ] Run the six entries' editorial prose through Gemma.

- [ ] `npx nx run-many -t build -p feature` then `npx nx run-many -t lint test typecheck -p feature docs repo-checks`.

**Verification:** `npx nx run-many -t test -p repo-checks` passes, and `tools/repo-checks/src/doc-export-coverage.test.ts`'s ratchet case confirms no removed entry is still needed.

---

## Task 5: Definitions, conditions and instants

**Deliverable:** twelve entries, one region, one docblock, twelve names out of the allowance.

**Names:** `FeatureDefinition`, `Rule`, `RuleOutcome`, `Condition`, `AttributeCondition`, `DayOfWeekCondition`, `WindowCondition`, `Weekday`, `Instant`, `EvaluationContext`, `FeatureKey`, `evaluateCondition`.

**Files:**

- `apps/docs/content/feature/api.mdx` (edit: the `### FeatureDefinition<F>`, `### Rule and RolloutSpec`, `### Condition`, `### EvaluationContext`, `### RuleOutcome` and `### FeatureKey and Instant` subsections become `##` entries)
- `libs/feature/src/lib/types.ts` (edit: a docblock on `Condition`. Task 7 edits this file for `Reason` and `ToggleResult`, and Task 17 edits the `Decisions` and `Plan` declarations in it)
- `libs/feature/docs/examples.md` (edit: one region)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)
- `tools/repo-checks/src/doc-fence-allowance.json` (edit: `feature` comes down)

### Steps

- [ ] Promote the six `###` subsections to `##` headings, one per name, splitting `### Rule and RolloutSpec` so `RolloutSpec` stays for Task 6 and `### FeatureKey and Instant` so both get their own heading. The heading regex takes the name up to the first space, so a heading naming two types documents only the first.

- [ ] Write the `Condition` docblock in `libs/feature/src/lib/types.ts` above the union, one paragraph naming the three members and why the union is closed.

- [ ] Add an `evaluate-condition` region to `libs/feature/docs/examples.md` calling `evaluateCondition` directly for an attribute condition that matches, a window condition at an instant inside the window, and a day-of-week condition in a named zone. The function is exported for a caller who holds a condition and a context and wants the engine's own answer, so the region shows exactly that.

- [ ] **Review Focus, Step 4.** `FeatureKey` is `string | number`. The `FeatureKey` entry's editorial prose and at least one fence in the section write a numeric key, so the page documents the whole type. `features.spec.ts` already proves a numeric key resolves.

- [ ] Recount the section's unexplained fences and lower `feature` in `tools/repo-checks/src/doc-fence-allowance.json` to the new number. Five of the twelve sit in the subsections this task rewrites: bare ` ```ts ` blocks at `apps/docs/content/feature/api.mdx` lines 315, 331, 348, 375 and 471, under `### FeatureDefinition<F>`, `### Rule and RolloutSpec`, `### Condition`, `### EvaluationContext` and `### RuleOutcome`. A reference directive renders the signature out of `dist/`, so a hand-written fence restating the same type comes out with the promotion. `doc-fence.test.ts`'s `leaves no allowance larger than the section needs` fails on an allowance above the real count.

- [ ] Remove the twelve names from `undocumented`, `evaluateCondition` from `unexercised`, and `Condition` from `unexplained`.

- [ ] Run the twelve entries' prose through Gemma.

- [ ] `npx nx run-many -t build -p feature` then `npx nx run-many -t lint test typecheck -p feature docs repo-checks`.

---

## Task 6: Variants, rollout and bucketing

**Deliverable:** ten entries, three regions or three cited regions, ten names out of the allowance.

**Names:** `VariantInfo`, `VariantSpec`, `VariantAssignment`, `RolloutSpec`, `DEFAULT_ROLLOUT_FIELD`, `assignVariant`, `variantSeedOf`, `bucketOf`, `inRollout`, `murmur3`.

**Files:**

- `apps/docs/content/feature/api.mdx` (edit)
- `libs/feature/docs/examples.md` (edit)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)
- `tools/repo-checks/src/doc-fence-allowance.json` (edit, if the rewrite removes a fence)

### Steps

- [ ] Promote `### VariantInfo, Schema and InferSchema` into `## VariantInfo` here and leave `Schema` and `InferSchema` for Task 9, and give `VariantSpec`, `VariantAssignment` and `RolloutSpec` their own `##` entries.

- [ ] `bucketOf` and `inRollout` are already exercised by the `bucket-stable`, `bucket-decorrelated` and `primitives` regions, which `rollouts.mdx` cites. Their entries carry `example=primitives`.

- [ ] Add a `variant-primitives` region calling `assignVariant` over a definition and a context, `variantSeedOf` over a definition, and `murmur3` over a string, with every `// ->` claim produced by running it. `variants.spec.ts` and `bucketing.spec.ts` hold the expected values; read them rather than guessing.

- [ ] `DEFAULT_ROLLOUT_FIELD` is a plain value and needs the heading alone, which the check's docblock states for `CRUD_ACTIONS` and `CORRELATION_ID_HEADER`.

- [ ] Recount the section's unexplained fences and lower `feature` in `tools/repo-checks/src/doc-fence-allowance.json` to the new number. `### VariantInfo, Schema and InferSchema` at `apps/docs/content/feature/api.mdx:384` carries none, and the fence at line 331 is `### Rule and RolloutSpec`'s, which Task 5 splits. Lower the number if this task's rewrite removes a fence and leave it where it is if it does not.

- [ ] Remove the ten names from `undocumented` and `assignVariant`, `murmur3` and `variantSeedOf` from `unexercised`.

- [ ] Run the prose through Gemma, then `npx nx run-many -t build -p feature` and `npx nx run-many -t lint test typecheck -p feature docs repo-checks`.

---

## Task 7: Decisions and the plan

**Deliverable:** nine entries, one cited region, two docblocks, nine names out of the allowance.

**Names:** `Decision`, `Decisions`, `Cause`, `Reason`, `ToggleResult`, `Plan`, `PlanEntry`, `resolvePlan`, `ResolvePlanOptions`.

**Files:**

- `apps/docs/content/feature/api.mdx` (edit)
- `libs/feature/src/lib/types.ts` (edit: docblocks on `Reason` and `ToggleResult`. Task 5 writes the `Condition` docblock in this file, and Task 17 edits the `Decisions` and `Plan` declarations in it)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)
- `tools/repo-checks/src/doc-fence-allowance.json` (edit: `feature` comes down)

### Steps

- [ ] Split `### Decision<F, V, T> and Decisions<S>`, `### Cause<F>`, `### PlanEntry<F, V, T> and Plan<S>` and `### ToggleResult<F>` into one `##` entry per name, and add `## Reason`, `## resolvePlan` and `## ResolvePlanOptions`.

- [ ] `resolvePlan`'s entry carries `example=resolve-plan`. The region exists at `libs/feature/docs/examples.md:464` and no page cites it today, which is why `resolvePlan` sits in `unexercised`.

- [ ] Write the `Reason` docblock above the union in `libs/feature/src/lib/types.ts:230`, naming what each member says about the decision and that the field is output only, which `reason-is-output-only.spec.ts` holds. Write the `ToggleResult` docblock naming the write and the dependants that go off with it.

- [ ] Recount the section's unexplained fences and lower `feature` in `tools/repo-checks/src/doc-fence-allowance.json` to the new number. Four sit in the subsections this task rewrites: bare ` ```ts ` blocks at `apps/docs/content/feature/api.mdx` lines 421, 492, 502 and 533, under `### Decision<F, V, T> and Decisions<S>`, `### Cause<F>`, `### PlanEntry<F, V, T> and Plan<S>` and `### ToggleResult<F>`.

- [ ] Remove the nine names from `undocumented`, `resolvePlan` from `unexercised`, and `Reason` and `ToggleResult` from `unexplained`.

- [ ] Run the prose through Gemma, then build and check.

---

## Task 8: The two schema vocabularies

**Deliverable:** seven entries, seven names out of the allowance.

**Names:** `ContextSchema`, `FeatureSchema`, `FeatureShape`, `FieldType`, `BaseFieldType`, `ValueShape`, `JsonValue`.

**Files:**

- `apps/docs/content/feature/api.mdx` (edit)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)

### Steps

- [ ] Add seven `##` entries with reference directives. The editorial prose under `FeatureSchema` names the distinction `distribution.mdx:161` already teaches: `ContextSchema` types the fields a condition may read and `ValueShape` types a variant's value, and the two are the two vocabularies a document carries.

- [ ] `FieldType` is a template-literal union over `BaseFieldType`; write the one sentence that says which combinations it admits, with the four base names, the `[]` suffix and the trailing `?`.

- [ ] None of the seven is callable, so none needs a fence. All seven carry docblocks in `libs/feature/src/lib/config.ts`.

- [ ] Remove the seven names from `undocumented`, run the prose through Gemma, build and check.

---

## Task 9: Typed construction

**Deliverable:** six entries, six names out of the allowance.

**Names:** `Schema`, `AsSchema`, `InferSchema`, `Definitions`, `DefinitionsOf`, `DefinitionsOrConfig`.

**Files:**

- `apps/docs/content/feature/api.mdx` (edit)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)

### Steps

- [ ] Add six `##` entries. The prose under `Definitions` carries the `as const satisfies Definitions<Flag>` rule the `createFeatures` entry already states at line 57, as a cross-link rather than a second copy.

- [ ] `DefinitionsOrConfig` and `DefinitionsOf` are the two halves of `createFeatures` taking a document as well as an array. Link each to the `createFeatures` entry.

- [ ] Remove the six names, run the prose through Gemma, build and check.

---

## Task 10: The distribution surface

**Deliverable:** eight entries, two regions, eight names out of the allowance.

**Names:** `ConfigEnvelope`, `FeatureConfig`, `ConfigIssue`, `ConfigIssueCode`, `ValidationResult`, `ReloadResult`, `canonical`, `ruleId`.

**Files:**

- `apps/docs/content/feature/api.mdx` (edit)
- `libs/feature/docs/examples.md` (edit: one region)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)

### Steps

- [ ] Add eight `##` entries. `ConfigEnvelope` and `FeatureConfig` cite `example=config-document`; `ReloadResult` cites `example=config-reload`; `ValidationResult`, `ConfigIssue` and `ConfigIssueCode` cite `example=config-validate`.

- [ ] Add an `identity-primitives` region calling `canonical` over a value with keys in two orders, to show that the text is the same, and `ruleId` over a rule declaring an `id` and a rule declaring none. `canonical.spec.ts` and `rule-id.spec.ts` hold the expected values.

- [ ] Remove the eight names from `undocumented` and `canonical` and `ruleId` from `unexercised`.

- [ ] Run the prose through Gemma, build and check.

---

## Task 11: The serialized document types

**Deliverable:** seven entries, seven names out of the allowance.

**Names:** `SerializedAttributeCondition`, `SerializedCondition`, `SerializedDefinition`, `SerializedInstant`, `SerializedRule`, `SerializedVariantSpec`, `SerializedWindowCondition`.

**Files:**

- `apps/docs/content/feature/api.mdx` (edit)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)

### Steps

- [ ] Add seven `##` entries. The prose under `SerializedInstant` states the rule the distribution spec's decision 12 fixes: a serialized instant is an ISO 8601 string or epoch milliseconds and never a `Date`. Link the `serializeConfig` entry, which is what converts.

- [ ] Each `Serialized*` entry links the live type it is the wire form of, so a reader holding a `Condition` finds `SerializedCondition` and the other way round.

- [ ] Remove the seven names, run the prose through Gemma, build and check.

---

## Task 12: Hydration and agreement

**Deliverable:** six entries, six names out of the allowance.

**Names:** `DecisionSet`, `DecisionOrigin`, `SnapshotOptions`, `DivergenceObserver`, `DivergenceReport`, `DivergenceSide`.

**Files:**

- `apps/docs/content/feature/api.mdx` (edit)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)

### Steps

- [ ] Add six `##` entries. `DecisionSet` and `SnapshotOptions` cite `example=snapshot`, which exists at `libs/feature/docs/examples.md:421` and which no page cites today.

- [ ] The prose under `DecisionOrigin` states what the consumer does with each member, which `decision-set.ts:30-37` already argues: a `'render'` set's instant is the default for the remainder and a `'build'` set's is not.

- [ ] The prose under `DivergenceReport` names the four `kind` members and says the report is output only.

- [ ] Remove the six names, run the prose through Gemma, build and check.

---

## Task 13: The observation seam, and the allowance key

**Deliverable:** six entries, the `@evanion/feature` key deleted from the allowance, and the file holding no entry at all.

**Names:** `FeatureEvent`, `FeatureOptions`, `UnobservedOptions`, `DeepReadonly`, `FrozenWhenObserved`, `ReadonlyDate`.

**Files:**

- `apps/docs/content/feature/api.mdx` (edit)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit: the file becomes `{}`)

### Steps

- [ ] Split `### FeatureOptions<S> and UnobservedOptions<S>` and `### FrozenWhenObserved<Frozen, T>, DeepReadonly<T> and ReadonlyDate` into one `##` entry per name, and promote `### FeatureEvent<S>`.

- [ ] `FeatureOptions` cites `example=observe-install`, `FeatureEvent` cites `example=observe-one-key`.

- [ ] The prose under `FrozenWhenObserved` states the asymmetry `FeatureOptions.observe`'s docblock argues: a store carrying an observer freezes what it answers and a store carrying none freezes nothing.

- [ ] Recount the section's unexplained fences. This task's three subsections carry none: `apps/docs/content/feature/api.mdx` holds no bare ` ```ts ` block between line 533 and line 751, so `### FeatureEvent<S>` at 539, `### FeatureOptions<S> and UnobservedOptions<S>` at 588 and `### FrozenWhenObserved<Frozen, T>, DeepReadonly<T> and ReadonlyDate` at 640 move no number. Leave `feature` in `tools/repo-checks/src/doc-fence-allowance.json` where Tasks 3, 5, 6 and 7 left it, and remove the entry if it reached zero.

- [ ] Delete the `@evanion/feature` key, leaving `tools/repo-checks/src/doc-export-coverage-allowance.json` as `{}`.

- [ ] Run the prose through Gemma, then `npx nx run-many -t build -p feature react-feature` and `npx nx run-many -t lint test typecheck -p feature react-feature docs repo-checks`.

**Verification:** `cat tools/repo-checks/src/doc-export-coverage-allowance.json` prints `{}` and `npx nx run-many -t test -p repo-checks` passes.

---

# PIECE THREE: the library changes the audit found

Each task documents its own new names on `apps/docs/content/feature/api.mdx` in the same commit, because the allowance is empty from Task 13 onward and `doc-export-coverage.test.ts` gives a new export nowhere to hide.

## Task 14: `adoptDecisions` moves into the core

**Deliverable:** the core adopts a `DecisionSet` against a store, compares the two config versions, reports every divergence, and answers in a program holding no React. `@evanion/react-feature` calls it and keeps the `process.env.NODE_ENV` read.

**Files:**

- `libs/feature/src/lib/adopt.ts` (new, from `libs/react-feature/src/hydrate.ts`)
- `libs/feature/src/lib/adopt.spec.ts` (new)
- `libs/feature/src/lib/adopt.test-d.ts` (new)
- `libs/feature/src/index.ts` (edit: `adoptDecisions`, `AdoptOptions`, `VersionMismatchPolicy`)
- `libs/react-feature/src/hydrate.ts` (reduced to `production()` and the call)
- `libs/react-feature/src/index.tsx` (edit: `usePublished` calls `adoptDecisions`)
- `libs/react-feature/src/hydrate.spec.tsx`, `hydrate-boundaries.spec.tsx`, `hydrate-boundaries.test-d.tsx` (edit: the cases that test the moved functions move to `adopt.spec.ts`; the cases that test the provider stay)
- `apps/docs/content/feature/api.mdx` (edit: three entries)
- `libs/feature/docs/examples.md` (edit: one region)

**Interfaces consumed:**

```ts
// libs/feature/src/lib/divergence.ts
export function reportDivergence<F extends FeatureKey>(
  observer: DivergenceObserver<F> | undefined,
  report: DivergenceReport<F>,
): void;
// libs/feature/src/lib/evaluate.ts
export function ruleFields(rule: Rule): readonly string[];
// libs/feature/src/lib/rule-id.ts
export function ruleId(rule: Rule): string;
// libs/feature/src/lib/variants.ts
export function assignVariant(
  definition: FeatureDefinition<FeatureKey>,
  context: EvaluationContext,
): VariantAssignment | undefined;
```

**Interfaces produced:**

```ts
// libs/feature/src/lib/adopt.ts

/** What a consumer does when the shipped version is not the store's. */
export type VersionMismatchPolicy = 'use-shipped' | 're-resolve';

/** What a caller passes `adoptDecisions` beyond the set itself. */
export interface AdoptOptions<F extends FeatureKey = string> {
  /**
   * The evaluation context this process holds. A `'render'` set's instant is
   * the default for `now` where the context states none.
   */
  context?: EvaluationContext;
  /** What to do about a version mismatch. Defaults to `'use-shipped'`. */
  onVersionMismatch?: VersionMismatchPolicy;
  /** Notified for every divergence. Alters no decision. */
  onDivergence?: DivergenceObserver<F>;
  /**
   * Whether to resolve locally and report every decision that differs.
   *
   * A second resolution costs a `'resolve'` event on a store built with
   * `observe`, so a caller states the answer and this function reads no host
   * global to guess it. `@evanion/react-feature` passes the development read.
   */
  compare?: boolean;
}

/**
 * The decisions a process publishes from a set another process resolved, with
 * every divergence reported before the caller reads one.
 */
export function adoptDecisions<
  S extends Record<keyof S, VariantInfo | never> = Schema,
>(
  features: Features<S>,
  shipped: DecisionSet<S> | undefined,
  options?: AdoptOptions<keyof S & FeatureKey>,
): Decisions<S> | DeepReadonly<Decisions<S>>;
```

### Steps

- [ ] Move `instantOf`, `erasedSet`, `compared`, `carries`, `pinSufficiency`, `sufficiency`, `diff` and `publishedDecisions` out of `libs/react-feature/src/hydrate.ts` into `libs/feature/src/lib/adopt.ts`, with every relative import pointing inside the core. Rename `publishedDecisions` to `adoptDecisions` and change its parameter list to `(features, shipped, options?)`.

- [ ] Replace `production()` inside the moved code with `options?.compare === true`. The `reResolve || diffing` condition becomes:

```ts
const reResolve =
  diverged === 'config-version' &&
  (options?.onVersionMismatch ?? 'use-shipped') === 're-resolve';
const comparing = observer !== undefined && options?.compare === true;
const local = reResolve || comparing ? features.resolve(settled) : undefined;
```

Keep the whole docblock that argues why one local resolution at most and why an absent observer resolves for nobody, and add the sentence that says the caller decides `compare` because the core reads no host global.

- [ ] `libs/react-feature/src/hydrate.ts` keeps `production()` with its docblock unchanged, because the bundler-`define` argument is a fact about a React bundle, and exports nothing else. `libs/react-feature/src/index.tsx`'s `usePublished` becomes:

```ts
const policy = onVersionMismatch ?? ON_MISMATCH;
const installed = onDivergence !== undefined;
const compare = !production();
const published = useMemo(() => {
  const reports: DivergenceReport<keyof S & FeatureKey>[] = [];
  const value: FeatureContextValue = {
    decisions: erased(
      adoptDecisions(features, decisions, {
        context,
        onVersionMismatch: policy,
        onDivergence: installed ? (report) => reports.push(report) : undefined,
        compare,
      }),
    ),
  };
  return { value, reports };
}, [features, context, decisions, policy, installed, compare]);
```

`compare` joins the dependency list because it is a value the render reads, and `production()` answers the same thing on every render in one process, so the memo re-runs no more often than it does today.

- [ ] **Review Focus, Step 4.** Write `libs/feature/src/lib/adopt.spec.ts` under the core's `node` project, which renders nothing and holds no React in its program. Its outer block is `describe('adoptDecisions')`, spelled exactly: `tools/repo-checks/src/doc-behaviour.test.ts` requires a `describe` naming every non-error callable export and carries no allowance, and it also refuses a `describe` naming one export nested inside a `describe` naming another, so no inner block spells `reportDivergence`, `ruleFields` or `resolvePlan`. The suite covers what `hydrate.spec.tsx` covers today: a set adopted with matching versions publishes the shipped decisions; an absent set resolves locally; `'unversioned'` reports once; `'config-version'` reports and publishes the shipped set under `'use-shipped'`; the same mismatch resolves locally under `'re-resolve'`; `compare: true` with an observer reports every `'decision-differs'`; `compare: false` resolves nothing a second time, asserted through a store built with `observe` that emits one `'resolve'` event and not two.

- [ ] **Review Focus, Step 5.** A case where the shipped set names a feature the local store does not declare, asserting one `'missing-field'` report carrying `shipped` and no `local`, and a message naming the reload.

- [ ] **Review Focus, Step 6.** A case where the shipped decision's assignment is `'pinned'` off a rule whose only condition reads `now`, asserting no report, and a second case where the rule also reads `plan` and the context carries none, asserting one report naming `plan` and not `now`.

- [ ] **Review Focus, Step 7.** A case where one side carries no version and `onVersionMismatch: 're-resolve'` is passed, asserting the shipped decisions are published and the store is resolved once at most.

- [ ] Export `adoptDecisions`, `AdoptOptions` and `VersionMismatchPolicy` from `libs/feature/src/index.ts`. `libs/react-feature/src/index.tsx` keeps re-exporting `VersionMismatchPolicy` as a type, per ruling 6, and `tools/repo-checks/src/feature-entry-parity.test.ts` keeps holding the parity.

- [ ] Add an `adopt-decisions` region to `libs/feature/docs/examples.md`: a server resolves a set with `features.snapshot`, the set crosses as JSON, a second store built from the same document adopts it with `adoptDecisions`, and an `onDivergence` that pushes into an array reports nothing. Then a second store built from a different document adopts the same set and the array holds one `'config-version'` report whose `message` the fence prints.

- [ ] Add three `##` entries to `apps/docs/content/feature/api.mdx`: `## adoptDecisions` with `example=adopt-decisions`, `## AdoptOptions`, `## VersionMismatchPolicy`.

- [ ] Run the three entries' prose through Gemma, then `npx nx run-many -t build -p feature react-feature` and `npx nx run-many -t lint test typecheck -p feature react-feature docs repo-checks`.

**Verification:** `npx nx run-many -t test -p feature` runs `adopt.spec.ts` under the `node` environment, and `npx nx run-many -t test -p repo-checks` passes with the allowance still `{}`.

---

## Task 15: `features.for(context)`, the context-bound caller

**Deliverable:** a handle that settles one instant and takes no context per call, so a Nest service, an Express handler and an Astro middleware ask one question at a time without threading the context or re-reading the clock.

**Files:**

- `libs/feature/src/lib/bound.ts` (new)
- `libs/feature/src/lib/bound.spec.ts` (new)
- `libs/feature/src/lib/bound.test-d.ts` (new)
- `libs/feature/src/lib/features.ts` (edit: `for` on the `Features` interface and on the object `createFeatures` returns. Task 16 edits `snapshot` in this file, and Task 17 edits the `Features` interface's own type parameter list, which is the same declaration this task adds `for` to)
- `libs/feature/src/index.ts` (edit: `BoundFeatures`)
- `libs/feature/src/lib/features.test-d.ts` (edit)
- `apps/docs/content/feature/api.mdx` (edit: two entries)
- `libs/feature/docs/examples.md` (edit: one region)

**Interfaces produced:**

```ts
// libs/feature/src/lib/bound.ts

/**
 * One context's answers, with the instant settled once.
 *
 * `features.for(context)` returns it. Every method asks the store the question
 * the same-named member of `Features` asks, with the context and the instant
 * already supplied, so a service deep in a call graph holds this and names no
 * context at its call sites. `@evanion/acl`'s `authorize(subject)` binds a
 * subject the same way at `libs/acl/src/hydrate-policy.ts:275`.
 *
 * It memoises nothing. A `toggle` or a `reload` between two calls on one handle
 * is visible through the second, because the store's truth is the store's and a
 * handle that cached decisions would answer from a document the store no longer
 * holds.
 */
export interface BoundFeatures<
  S extends Record<keyof S, VariantInfo | never> = Schema,
  Frozen extends boolean = boolean,
> {
  /** The context every method resolves against, with `now` settled. */
  readonly context: EvaluationContext;
  resolve(): FrozenWhenObserved<Frozen, Decisions<S>>;
  isEnabled(key: keyof S & FeatureKey): boolean;
  variantOf<K extends keyof S>(
    key: K,
  ): Decisions<S>[K] extends { variant?: infer V } ? V | undefined : undefined;
  valueOf<K extends keyof S>(
    key: K,
  ): Decisions<S>[K] extends { value?: infer T } ? T | undefined : undefined;
  plan(): FrozenWhenObserved<Frozen, Plan<S>>;
  snapshot(options?: SnapshotOptions): DecisionSet<S, Frozen>;
}

// libs/feature/src/lib/features.ts, on Features<S, Frozen>
  /**
   * The store bound to one context, with the instant settled at this call.
   *
   * `context.now ?? new Date()` is read here and every method on the handle
   * resolves at it, so two questions asked inside one request cannot straddle a
   * window boundary. An explicit `now` wins, which keeps the precedence
   * `resolve` has and keeps a test able to pin the clock.
   */
  for(context?: EvaluationContext): BoundFeatures<S, Frozen>;
```

### Steps

- [ ] Write `libs/feature/src/lib/bound.ts` holding the interface and a `boundFeatures(features, context)` factory that reads `context?.now ?? new Date()` once into a settled context and returns an object whose six methods delegate to the store with that context.

- [ ] Add `for` to the `Features` interface in `libs/feature/src/lib/features.ts` and to the object `createFeatures` returns, beside `snapshot` at line 1359.

- [ ] `toggle` is deliberately absent from the handle. A toggle writes intent and is not a question about one context; the docblock says so in one sentence.

- [ ] Write `libs/feature/src/lib/bound.spec.ts`:
  - `describe('for')` with a case asserting two `isEnabled` calls on one handle, taken across a window boundary with fake timers, answer the same, and that the same two calls on the store answer differently.
  - A case asserting an explicit `context.now` is the instant the handle holds.
  - A case asserting `handle.snapshot().now` equals the settled instant's ISO string.
  - A case asserting `handle.context` is the settled context and carries the caller's own fields.

- [ ] **Review Focus, Step 5.** A case where the context carries `now: new Date(NaN)`: `handle.resolve()` answers and `handle.snapshot()` throws `FeatureConfigError` naming `context/now`, which is `features.ts:1033`'s refusal reached through the handle.

- [ ] **Review Focus, Step 6.** A case building a handle, calling `features.toggle(key, false)`, then reading `handle.isEnabled(key)` as `false`; and a case building a handle, calling `features.reload(document)` with a document that drops the key, then reading `handle.resolve()` without that key.

- [ ] Write `libs/feature/src/lib/bound.test-d.ts` asserting `variantOf` on a handle from a literal store answers the variant-name union, and that a handle from a store built with `observe` answers the deeply readonly form from `resolve`.

- [ ] Add a `bound-context` region to `libs/feature/docs/examples.md`: a store built once, a handle built per request from the shop's shopper, and three questions asked off the handle with one instant behind all three.

- [ ] Add `## features.for(context?)` under the `Features<S>` entry and `## BoundFeatures` as its own entry, the second citing `example=bound-context`. Export `BoundFeatures` from `libs/feature/src/index.ts`.

- [ ] Run the two entries' prose through Gemma, then build and check `feature`, `react-feature`, `docs`, `repo-checks`.

---

## Task 16: `snapshot` states an instant the wire carries

**Deliverable:** a `DecisionSet` survives `JSON.parse(JSON.stringify(set))` unchanged for every store, and a test says so.

**Files:**

- `libs/feature/src/lib/features.ts` (edit: `snapshot` normalises a window condition value in a failed outcome. Task 15 adds `for` to the `Features` interface and to the returned object in this file, and Task 17 edits the interface's type parameter list)
- `libs/feature/src/lib/snapshot.spec.ts` (edit)
- `apps/docs/content/feature/api.mdx` (edit: the `DecisionSet` entry's prose)

### Steps

- [ ] In `snapshot`, after `resolveAll` and before `frozenWhenObserved`, walk each decision's `rules` and, for a `failed` condition whose `field` is `'now'` and whose `value` is a `Date`, replace the value with its `toISOString()`. Nothing else is touched. The walk copies the outcome rather than writing into the resolved record, because `resolve` and `snapshot` share `resolveAll` and `resolve` stays total with the `Date` in place.

- [ ] Write the docblock on the walk citing `serialize.ts:185-187`, which is the same rule for the document, and `features.ts:1029-1033`, which is the same rule for `now`.

- [ ] Add to `libs/feature/src/lib/snapshot.spec.ts` a case building a store from a literal whose rule carries `{ field: 'now', op: 'after', value: new Date('2027-01-01T00:00:00Z') }`, resolving a set at an instant before that window, and asserting `JSON.parse(JSON.stringify(set))` deep-equals the set.

- [ ] **Review Focus, Step 4.** A case where the same condition's `value` is already `'2027-01-01T00:00:00Z'` and a case where it is `1798761600000`, asserting the set carries the value the definition carried and the round trip holds.

- [ ] **Review Focus, Step 5.** A case where an `AttributeCondition` in a failed outcome carries a `Date` at `value`, asserting the set carries the `Date`, which ruling 5 leaves alone, and that the round trip therefore does not hold there. The case names the ruling and is what Task 29's pitfalls page cites.

- [ ] Add one paragraph to the `DecisionSet` entry's prose naming what the set carries over a wire and the one value it does not.

- [ ] Run that paragraph through Gemma, then build and check `feature`, `docs`, `repo-checks`.

---

## Task 17: `Features`, `Decisions` and `Plan` get the defaults `DecisionSet` has

**Deliverable:** a framework declaration names the type with no type argument, the way `apps/storefront/src/env.d.ts` writes `access: Access | undefined`.

**Files:**

- `libs/feature/src/lib/features.ts` (edit: the `Features` interface's type parameter list and its `./types.js` import. Task 15 adds `for` to the same interface and Task 16 edits `snapshot` in the same file, so land this after both)
- `libs/feature/src/lib/types.ts` (edit: the `Decisions` and `Plan` declarations. Task 5 writes the `Condition` docblock in this file and Task 7 writes the `Reason` and `ToggleResult` docblocks)
- `libs/feature/src/lib/schema.test-d.ts` (edit)
- `apps/docs/content/feature/api.mdx` (edit: the `Features<S>`, `Decisions` and `Plan` entries' prose)

### Steps

- [ ] `libs/feature/src/lib/features.ts`: add `Schema,` to the `import type { … } from './types.js'` block at lines 21 to 32, which does not name it today, then write `export interface Features<S extends Record<keyof S, VariantInfo | never> = Schema, Frozen extends boolean = boolean>`. Without the import the line fails `TS2552: Cannot find name 'Schema'`.

- [ ] `libs/feature/src/lib/types.ts`: `export type Decisions<S extends Record<keyof S, VariantInfo | never> = Schema>` and `export type Plan<S extends Record<keyof S, VariantInfo | never> = Schema>`.

- [ ] Keep the `Features` docblock's existing argument about naming `Frozen` in an annotation, and add one sentence saying what the bare form is for: a declaration a framework demands, where the store's schema arrived at runtime.

- [ ] **Review Focus, Step 3.** Add to `libs/feature/src/lib/schema.test-d.ts`. The file already imports `Decisions` and `Plan` from `./types.js`, which is the same declaration `../index.js` re-exports, so only `Features` and `DecisionSet` are added to the import list; naming all four is four `TS2300: Duplicate identifier` errors, reported at both sites for each name.

```ts
import { parseFeatureConfig } from './parse.js';
import type { Features, DecisionSet } from '../index.js';

// A declaration a framework demands: the slot a Nest token, an Astro `locals`
// member or a React Router context writes, where the store's schema arrived at
// runtime.
declare const slot: Features | undefined;
declare const published: Decisions;
declare const planned: Plan;
declare const shipped: DecisionSet;

it('accepts a store built from a document at the open form', () => {
  const parsed = parseFeatureConfig({ features: [] });

  expectTypeOf(parsed).toExtend<
    { ok: true; features: Features } | { ok: false; issues: unknown }
  >();
  expectTypeOf(slot).toExtend<Features | undefined>();
  expectTypeOf(published).toExtend<Decisions>();
  expectTypeOf(planned).toExtend<Plan>();
  expectTypeOf(shipped).toExtend<DecisionSet>();
});
```

- [ ] Add one paragraph to each of the three entries' prose naming the default and the declaration it is for.

- [ ] Run the three paragraphs through Gemma, then build and check `feature`, `react-feature`, `docs`, `repo-checks`.

---

## Task 17b: `EvaluationContext.now` takes an `Instant`

**Deliverable:** a context round-tripped through `JSON.parse(JSON.stringify(context))` resolves a window and a day-of-week condition the way the context it came from did, which closes issue #451.

`now` is typed `now?: Date` at `libs/feature/src/lib/types.ts:214` and `evaluateCondition` reads it as one at `libs/feature/src/lib/conditions.ts:149-157`: `if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;`. A `Date` does not survive `JSON.stringify`, so a context arriving over an RSC payload, an island's props, a Nest response body or a cookie carries the ISO 8601 string at `now`, and every `before`, `after` and `day-of-week` condition answers false, with no error raised and no reason naming the field. The three applications Tasks 25, 26 and 27 wire each cross such a boundary.

The package already refuses the value on the way out: `snapshot` raises `FeatureConfigError` for a `context.now` naming no instant at `features.ts:1042`. It accepts one on the way in and answers wrong, and that is the inconsistency this task removes.

`Instant = string | number | Date` is the type a window condition's own `value` carries and `instantEpoch` already reads. The field is widened to it and read through the same function, so one instant written in three forms resolves one way.

**What `snapshot` does with a widened `now`.** It refuses the same values and states the instant in the same one form. `withNow` settles the field to a `Date` before anything resolves, so a string naming no instant reaches `snapshot`'s check as an invalid `Date` and raises `FeatureConfigError` naming `context/now` exactly as `new Date(NaN)` does today, and a string naming one is restated in the form a set carries: `features.snapshot({ now: '2026-06-01T00:00:00+01:00' }).now` is `'2026-05-31T23:00:00.000Z'`. Only the message changes, because the value it names is no longer always a `Date`. Task 16 lands first and edits `snapshot`'s walk over a failed outcome, which this task does not touch.

**Every reader of `context.now`, and what this task does to it:**

| Reader                                                     | After this task                                                                                                                                                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `withNow`, `features.ts:922`                               | Settles through `contextEpoch`, so every entry point hands a `Date` downstream and `SettledContext` is unchanged.                                                                                         |
| `envelope`, `features.ts:952`                              | Unchanged. It copies a settled context's `Date`.                                                                                                                                                          |
| `snapshot`, `features.ts:1040` and `:1062`                 | Unchanged in behaviour. The refusal's message stops naming a `Date`.                                                                                                                                      |
| `boundFeatures`, `libs/feature/src/lib/bound.ts` (Task 15) | Settles through `contextEpoch`, which is the handle's own copy of the same read.                                                                                                                          |
| `evaluateCondition`, `conditions.ts:152` and `:159`        | Reads through `contextEpoch` and compares epochs. This is the fix.                                                                                                                                        |
| `planFeature`, `evaluate.ts:388`                           | Unchanged. It tests whether the field is present by name and reads no value.                                                                                                                              |
| `resolvePlan`, `resolve-plan.ts:65`                        | Carries whichever form the caller passed into the settled context, and `ResolvePlanOptions.now` widens with it.                                                                                           |
| `instantOf`, `libs/feature/src/lib/adopt.ts` (Task 14)     | Unchanged, and deliberately. It reads `shipped.now` off a document a broken producer wrote, and its fallback to the local clock is what keeps such a set from resolving at an instant no clock is inside. |

**Files:**

- `libs/feature/src/lib/types.ts` (edit: `EvaluationContext.now`. Task 5 writes the `Condition` docblock in this file, Task 7 the `Reason` and `ToggleResult` docblocks, and Task 17 the `Decisions` and `Plan` declarations)
- `libs/feature/src/lib/instant.ts` (edit: `RANGE` arrives here and `contextEpoch` is added)
- `libs/feature/src/lib/conditions.ts` (edit: the two clock branches of `evaluateCondition`, its docblock, and the local `RANGE` const)
- `libs/feature/src/lib/features.ts` (edit: the `./instant.js` import, `withNow`, `snapshot`'s refusal message, and the `snapshot` docblock on the `Features` interface at lines 135-142, which says "an invalid `Date` describes no instant, so a `context.now` holding one raises a `FeatureConfigError`" and "`resolve`, `plan` and `toggle` state no instant, so they carry that `Date` into the decision". Both sentences narrow to `Date` and both are wrong once the field is an `Instant`; rewrite them to say the value, not the `Date`. Task 15 adds `for` to this file, Task 16 edits `snapshot`, and Task 17 edits the `Features` type parameter list)
- `libs/feature/src/lib/bound.ts` (edit: the settling read Task 15 writes)
- `libs/feature/src/lib/resolve-plan.ts` (edit: `ResolvePlanOptions.now` and its docblock)
- `libs/feature/src/lib/conditions.spec.ts` (edit: one case inverted, four added)
- `libs/feature/src/lib/instant.spec.ts` (edit: a `describe('contextEpoch')`)
- `libs/feature/src/lib/snapshot.spec.ts` (edit: three cases)
- `libs/feature/src/lib/conditions.test-d.ts` (edit: two cases)
- `libs/feature/src/lib/conformance.test-d.ts` (edit: one case)
- `libs/feature/src/lib/resolve-plan-boundaries.test-d.ts` (edit: one case)
- `libs/feature/docs/examples.md` (edit: the prose above the `resolve-plan` region)
- `apps/docs/content/feature/api.mdx` (edit: the `EvaluationContext` entry's prose at line 401)

**Interfaces produced:**

```ts
// libs/feature/src/lib/types.ts
export interface EvaluationContext {
  now?: Instant;
  targetingKey?: string;
  stickyVariants?: Readonly<Record<string, string>>;
  [field: string]: unknown;
}

// libs/feature/src/lib/instant.ts
export const RANGE = 8_640_000_000_000_000;
export function contextEpoch(now: Instant | undefined): number;

// libs/feature/src/lib/resolve-plan.ts
export interface ResolvePlanOptions<F extends FeatureKey = string> {
  now?: Instant;
  onDivergence?: DivergenceObserver<F>;
}
```

`libs/feature/src/index.ts` exports neither `RANGE` nor `contextEpoch`, so neither owes an `api.mdx` heading under `doc-export-coverage.test.ts` nor a `describe` under `doc-behaviour.test.ts`. `EvaluationContext` and `ResolvePlanOptions` are already documented and keep their headings.

### Steps

- [ ] Add the reading to `libs/feature/src/lib/instant.ts`, below `instantEpoch`, and move `RANGE` there from `conditions.ts`, which is the one other reader of it. `instant.ts`'s own docblock already claims to be the single reading of `Instant` in the package, and a second `Math.abs(epoch) > RANGE` in `conditions.ts` would make the bound a property of two files:

```ts
/** The largest instant a `Date` holds, ECMA-262 21.4.1.1. */
export const RANGE = 8_640_000_000_000_000;

/**
 * Epoch milliseconds for the instant a context resolves at, and `NaN` for a
 * context naming none.
 *
 * `EvaluationContext.now` admits every form `Instant` does, because a context
 * that crossed JSON carries the string its `Date` was written as. This reading
 * is what makes the two resolve a window alike.
 *
 * A number outside the range a `Date` holds answers `NaN` here, which no other
 * form reaches: a string is parsed and a `Date` is bounded, and only a
 * caller's own number goes further. `Intl.DateTimeFormat.format` raises
 * `RangeError` for such a value, and a comparison against it holds at every
 * instant or at none, which is what `windowFault` refuses the same number at a
 * boundary for.
 */
export function contextEpoch(now: Instant | undefined): number {
  if (now === undefined) return Number.NaN;

  const epoch = instantEpoch(now);
  return Math.abs(epoch) > RANGE ? Number.NaN : epoch;
}
```

- [ ] `libs/feature/src/lib/conditions.ts`: take `RANGE` off its local `const` and onto the import, `import { contextEpoch, instantEpoch, RANGE } from './instant.js';`, then read both clock branches through the new function. `weekdayIn` keeps its `Date` parameter, because `Intl.DateTimeFormat.format` takes one:

```ts
if (condition.op === 'day-of-week') {
  const now = contextEpoch(context.now);
  if (Number.isNaN(now)) return false;
  const day = weekdayIn(new Date(now), condition.zone);
  return day !== undefined && condition.value.includes(day);
}

if (condition.op === 'before' || condition.op === 'after') {
  const now = contextEpoch(context.now);
  if (Number.isNaN(now)) return false;
  const boundary = instantEpoch(condition.value);
  if (Number.isNaN(boundary)) return false;
  return condition.op === 'before' ? now < boundary : now > boundary;
}
```

- [ ] Rewrite the paragraph in `evaluateCondition`'s docblock that states the old behaviour, the one beginning "A window and a day-of-week condition read" and ending "answers false on every clock condition". It becomes:

```ts
 * A window and a day-of-week condition read `context.now` through
 * `contextEpoch`, so a context that crossed JSON and carries the ISO 8601
 * string in its place resolves the way the context it was built from did. A
 * `now` naming no instant leaves both unevaluable, which is false.
```

- [ ] `libs/feature/src/lib/types.ts`: widen the field and give it the docblock the reference page renders:

```ts
export interface EvaluationContext {
  /**
   * The instant every rule resolves against, in any of the three forms an
   * `Instant` takes.
   *
   * A `Date` does not survive `JSON.stringify`, and a context reaching this
   * library across an RSC payload, an island's props, a response body or a
   * cookie carries the ISO 8601 string in its place. `instantEpoch` reads all
   * three forms, so such a context resolves a window the way the context it
   * was built from did. Every entry point settles the field to a `Date` before
   * it resolves anything.
   */
  now?: Instant;
```

- [ ] `libs/feature/src/lib/features.ts`: add `contextEpoch` to the `./instant.js` import, which reads `import { instantEpoch } from './instant.js';` at line 3 and would otherwise raise `TS2304` on the block below. Then settle the field in `withNow`, and change `snapshot`'s message from `the Date at context/now names no instant` to `the value at context/now names no instant`, keeping the rest of the sentence and the `context/now` the `snapshot.spec.ts` cases match on:

```ts
const withNow = (context: EvaluationContext = {}): SettledContext => ({
  ...context,
  now:
    context.now === undefined
      ? new Date()
      : new Date(contextEpoch(context.now)),
});
```

`SettledContext` stays `EvaluationContext & { now: Date }` and every reader below `withNow` stays as it is, which is what keeps this task off `envelope`, `resolveAll`, `plan` and `toggle`.

- [ ] `libs/feature/src/lib/bound.ts`: the factory Task 15 writes reads `context?.now ?? new Date()` once, which is the second settling site in the package. It becomes the same expression `withNow` holds, and the handle's docblock keeps its sentence about an explicit `now` winning.

- [ ] `libs/feature/src/lib/resolve-plan.ts`: widen `ResolvePlanOptions.now` to `Instant`, adding `Instant` to the `./types.js` type import. Its docblock says a caller passes a `'render'` set's instant here, and `DecisionSet.now` is an ISO 8601 string, so the widening is what lets that caller write `{ now: set.now }` and drop the `new Date` around it. Add that sentence to the docblock, and change the same claim in the prose above the `resolve-plan` region of `libs/feature/docs/examples.md`, which spells the call out as `resolvePlan(features, plan, context, { now: new Date(set.now) })`.

- [ ] **Review Focus, Step 7.** `libs/feature/src/lib/conditions.spec.ts` carries one case that asserts the defect, `does not hold when the context carries now as the string JSON left behind`. It becomes the issue's own case, asserting the round-tripped context answers what the context it came from answers:

```ts
it('answers for a context that crossed JSON what it answers for the one it came from', () => {
  // `JSON.stringify` writes a `Date` as its ISO 8601 string and
  // `JSON.parse` gives the string back, so a context that crossed an RSC
  // payload, an island's props, a response body or a cookie carries `now`
  // as text. `contextEpoch` reads the three forms an `Instant` takes, so
  // the window resolves off the string the way it resolves off the `Date`
  // the string was written from.
  const condition: Condition = {
    field: 'now',
    op: 'after',
    value: '2026-01-01T00:00:00Z',
  };
  const held = at('2026-06-01T00:00:00Z');
  const wire = JSON.parse(JSON.stringify(held)) as EvaluationContext;

  expect(wire.now).toBe('2026-06-01T00:00:00.000Z');
  expect(evaluateCondition(condition, wire)).toBe(
    evaluateCondition(condition, held),
  );
  expect(evaluateCondition(condition, wire)).toBe(true);
});
```

- [ ] Four more cases in the same file. The first two go in the `window` block, the last two in the `day-of-week` block above `reads the weekday in the zone the condition names`, where `instant` is the `at('2026-10-01T03:00:00Z')` the block already holds:

```ts
it('reads an instant stated as epoch milliseconds', () => {
  const condition: Condition = {
    field: 'now',
    op: 'after',
    value: '2026-01-01T00:00:00Z',
  };

  expect(
    evaluateCondition(condition, {
      now: Date.parse('2026-06-01T00:00:00Z'),
    }),
  ).toBe(true);
});

it('does not hold for a now naming no instant, in any form', () => {
  const condition: Condition = {
    field: 'now',
    op: 'after',
    value: '2026-01-01T00:00:00Z',
  };
  const unusable: Instant[] = [
    'the first of June',
    '2026-06-01T00:00:00',
    Number.NaN,
    8_640_000_000_000_001,
    new Date('nonsense'),
  ];

  for (const now of unusable) {
    expect(evaluateCondition(condition, { now })).toBe(false);
  }
});
```

```ts
it('reads the weekday off a context that crossed JSON', () => {
  const condition: Condition = {
    field: 'now',
    op: 'day-of-week',
    zone: 'America/New_York',
    value: ['wed'],
  };
  const wire = JSON.parse(JSON.stringify(instant)) as EvaluationContext;

  expect(evaluateCondition(condition, wire)).toBe(
    evaluateCondition(condition, instant),
  );
  expect(evaluateCondition(condition, wire)).toBe(true);
});

it('does not hold for an epoch number outside the range a Date holds', () => {
  // `Intl.DateTimeFormat.format` raises `RangeError` for an invalid
  // `Date`, so the guard refuses the number before the weekday is read
  // and the condition answers the way every unevaluable one does.
  const condition: Condition = {
    field: 'now',
    op: 'day-of-week',
    zone: 'America/New_York',
    value: ['wed'],
  };

  expect(evaluateCondition(condition, { now: 8_640_000_000_000_001 })).toBe(
    false,
  );
});
```

`'2026-06-01T00:00:00'` is in the unusable list on purpose: it is the one string ECMA-262 reads in the host's zone, `instantEpoch` refuses it for that reason, and a context carrying it would otherwise resolve one way in Stockholm and another in Tokyo. `conditions.spec.ts` already imports `Instant` from `./types.js` for the `validateConditions` cases.

- [ ] Add a `describe('contextEpoch')` to `libs/feature/src/lib/instant.spec.ts` holding the table: `undefined` answers `NaN`, a `Date` and the string it serializes to answer the same number, epoch milliseconds answer themselves, each end of the range answers itself, and a number one past either end answers `NaN`.

- [ ] Three cases in `libs/feature/src/lib/snapshot.spec.ts`. The file's own fixture is `SPLIT`, a variants store carrying no rule, and these cases need a window, so declare one beside it and add the type the third case casts to. `snapshot.spec.ts` imports `Schema` from `./types.js` and nothing else from there, so `EvaluationContext` joins that line:

```ts
import type { EvaluationContext, Schema } from './types.js';

const SALE = [
  {
    key: 'sale',
    enabled: true,
    rules: [{ when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' }] }],
  },
] as const;
```

Then the three cases:

```ts
it('states the instant a string named, in the one form a set carries', () => {
  const features = createFeatures(SALE);

  expect(features.snapshot({ now: '2026-06-01T00:00:00+01:00' }).now).toBe(
    '2026-05-31T23:00:00.000Z',
  );
});

it('resolves a context that crossed JSON as the one it came from', () => {
  const features = createFeatures(SALE);
  const held = { now: new Date('2026-06-01T00:00:00Z') };
  const wire = JSON.parse(JSON.stringify(held)) as EvaluationContext;

  expect(features.snapshot(wire).decisions).toEqual(
    features.snapshot(held).decisions,
  );
  expect(features.snapshot(wire).now).toBe(features.snapshot(held).now);
});

it('names the field for a string naming no instant', () => {
  const features = createFeatures(SALE);

  expect(() => features.snapshot({ now: 'the first of June' })).toThrow(
    FeatureConfigError,
  );
  expect(() => features.snapshot({ now: 'the first of June' })).toThrow(
    /context\/now/,
  );
});
```

- [ ] Four type-test sites assert the old type and fail without this edit. Three of them are `@ts-expect-error` directives that become `TS2578: Unused '@ts-expect-error' directive` the moment the field widens, and the fourth is an equality assertion:
  - `libs/feature/src/lib/conditions.test-d.ts:206`, `expectTypeOf<EvaluationContext['now']>().toEqualTypeOf<Date | undefined>()`, becomes `toEqualTypeOf<Instant | undefined>()`. The file already imports `Instant`. Its case title at line 205 reads `types the clock field as a Date and nothing else` and becomes `types the clock field as an instant`, for the reason the other three are renamed: a title that contradicts its own assertion is read by the next person as the assertion being wrong.
  - `libs/feature/src/lib/conditions.test-d.ts:225`, `refuses the clock field written as the string a wire format carries`, becomes `takes the clock field written as the string a wire format carries` with the directive and the old argument gone from the comment.
  - `libs/feature/src/lib/conformance.test-d.ts:67`, `refuses a fixture instant that arrives as the string the file holds`, becomes `takes a fixture instant that arrives as the string the file holds`.
  - `libs/feature/src/lib/resolve-plan-boundaries.test-d.ts:66`, `takes an instant as a Date and nothing else`, becomes `takes an instant in every form an Instant holds`.

- [ ] Rewrite the `EvaluationContext` paragraph at `apps/docs/content/feature/api.mdx:401`, which states the old behaviour and tells a reader to build the `Date` back:

```md
The `now` property is an `Instant`: a `Date`, the ISO 8601 string `JSON.stringify` writes in a `Date`'s place, or epoch milliseconds. A context that crossed an RSC payload, an island's props, a response body or a cookie therefore resolves every window and day-of-week condition the way the context it was serialized from did, and a caller handing on a parsed body passes it straight through. A `now` that names no instant leaves every clock condition unevaluable, which answers `false`, and `snapshot` refuses it outright, because a decision set states its instant as an ISO 8601 string.
```

- [ ] Run that paragraph through Gemma, then `npx nx run-many -t build -p feature react-feature` and `npx nx run-many -t lint test typecheck -p feature react-feature docs repo-checks`.

**Verification:** `npx nx run feature:typecheck` is green with no `@ts-expect-error` left over any `now` written as a string, `npx nx run feature:test` passes, and `node -e` over a built store answers `true` for `features.isEnabled('sale', JSON.parse(JSON.stringify({ now: new Date() })))` where the rule's window has opened.

---

# PIECE FOUR: the guide set

`@evanion/acl` has 33 pages under `apps/docs/content/next/acl`. `@evanion/feature` has 10 after Task 3 and reaches 23 here: the ten that survive Task 3, plus the thirteen Tasks 19, 20, 22, 23, 24, 25, 26, 27, 28, 29 (two), 30 and 31 write. The order a reader meets them is four bands, following `apps/docs/content/next/acl/_meta.ts`: Setup, Platforms, Questions, Reference.

Every new page in this piece opens with `<WorkshopNotice slug="feature" />` on line 3, which is where all eleven existing pages carry it. Task 32 is what deletes them, once `workshop` is false.

Every page in this piece is drafted by the implementer, run through Gemma one page at a time, and read back against the code. Every fence is a `file=… region=…` reference to a tested region, a `twoslash` fence, a `mermaid` fence, a shell fence, or a block carrying one of § 9's five tags. A page that claims an output has been run to get it.

No page in this piece teaches a feature administration service, a control plane, a dashboard, a poller, a websocket, SSE, a database adapter or a scheduler. A page may say the reader supplies its own source and show the two calls that install a document, `parseFeatureConfig` and `features.reload`, and stops there. `libs/feature/src/lib/core-boundary.spec.ts` is what holds the library to the same line.

## Task 18: Getting started, extended, and the four bands

**Deliverable:** `getting-started.mdx` carries the smallest thing that works and the second thing a reader always needs, and `_meta.ts` holds the four bands every later task adds a key to.

**Files:**

- `apps/docs/content/feature/getting-started.mdx` (edit)
- `apps/docs/content/feature/_meta.ts` (edit)
- `libs/feature/docs/examples.md` (edit, if the second step needs a region)

### Steps

- [ ] Extend `getting-started.mdx`. The page already writes two flags down, resolves them for a customer, reads why one is off and turns the parent off. The second thing a reader always needs is the one they reach for within a day: a rollout to a share of shoppers, which `rollouts.mdx` then takes apart. Cite `region=rollout` rather than writing a second fence.

- [ ] **Review Focus, Step 2.** The section has 10 pages and reaches 23. `doc-floor.test.ts` requires the demonstration role a page of its own above five pages, and `navigation.ts` names `rollouts`. No task in this piece changes `demo`.

- [ ] Restructure `apps/docs/content/feature/_meta.ts` into four bands with separators, following acl's file, and write the docblock that says why each band holds what it holds and why each page sits where it does. A key naming a page that does not exist yet fails the Nextra build, and `docs-navigation.test.ts`'s `names only pages that exist` catches it too, so this step writes exactly the ten pages that exist after Task 3 plus the four separators:

```ts
export default {
  index: 'Overview',

  'group-setup': { type: 'separator', title: 'Setup' },
  'getting-started': 'Getting started',
  configuration: 'Writing a feature down',
  decisions: 'Resolving a feature',
  rollouts: 'Rollouts',
  variants: 'Variants',
  'build-time': 'Build-time planning',

  'group-platforms': { type: 'separator', title: 'Platforms' },

  'group-questions': { type: 'separator', title: 'Questions' },
  distribution: 'How do I serve my configuration?',
  observing: 'What did the engine just answer?',

  'group-reference': { type: 'separator', title: 'Reference' },
  api: 'API Reference',
} satisfies MetaRecord;
```

Each later task inserts its own key at the position the end state gives it. The end state, after Task 31, is 23 page keys and the four separators, in this order: `index`; Setup, holding `getting-started`, `configuration`, `decisions`, `rollouts`, `variants`, `build-time`; Platforms, holding `choosing-an-integration`, `express`, `nestjs`, `astro`, `nextjs`, `react-router`, `microservices`; Questions, holding `distribution`, `hydration`, `observing`, `adopting`, `testing`; Reference, holding `limits`, `pitfalls`, `advanced`, `api`.

- [ ] Run the edited sections through Gemma.

- [ ] `npx nx run-many -t lint test typecheck -p docs repo-checks`.

---

## Task 19: The microservice stack

**Deliverable:** `microservices.mdx`. One service writes a document with `serializeConfig` and stamps `configDigest`; every other process parses it with `parseFeatureConfig`, installs it with `features.reload`, and agrees because the two versions agree.

**Files:**

- `apps/docs/content/feature/microservices.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)
- `libs/feature/docs/examples.md` (edit: the regions the page cites)
- `apps/docs/content/feature/distribution.mdx` (edit: a link out, so the two pages do not teach the same thing twice. Task 28 edits this page's schema and `maxStale` sections to link `advanced.mdx`, and this task edits its `Where the Adapter Lives, and What No Endpoint Answers` section)

### Steps

- [ ] Draft the page as one narrative across three processes of the game shop: `shop-api` holds the authored definitions and writes the document, the storefront and the back office each build a store from it, and all three resolve the same shopper to the same variant. The page names `serializeConfig`, `configDigest`, `parseFeatureConfig`, `features.reload`, `features.version` and `features.envelope`, and cites the existing regions `config-document`, `config-digest`, `config-digest-hop`, `config-install`, `config-reload` and `config-digest-verified`.

- [ ] Add one region, `many-processes`, that runs all three sides in one fence: the publisher serialises, two consumers parse and install, and the three resolutions for one `targetingKey` are asserted equal. This is the fence the page exists for and the one `distribution.mdx` has no room for at 199 reference lines.

- [ ] The page says the reader supplies the source that moves the bytes and stops there, with one sentence naming issue #423's line and a link to `limits.mdx`.

- [ ] Edit `distribution.mdx`'s `Where the Adapter Lives, and What No Endpoint Answers` section so it links this page for the end-to-end story and keeps its own reference material.

- [ ] Add `microservices: 'Many Processes'` to `_meta.ts` in the Platforms band.

- [ ] Run the page through Gemma, read it against `libs/feature/src/lib/serialize.ts`, `digest.ts` and `features.ts`, then `npx nx run-many -t lint test typecheck -p feature docs repo-checks`.

---

## Task 20: Hydration and agreement across processes

**Deliverable:** `hydration.mdx`. `DecisionSet`, `Features.snapshot`, `adoptDecisions`, `resolvePlan`, the divergence report, and what a mismatch means.

**Files:**

- `apps/docs/content/feature/hydration.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)
- `libs/feature/docs/examples.md` (edit, if a region is missing)

### Steps

- [ ] Draft the page in the order the hydration spec argues it: what a client receives, the version comparison with `!==`, why a mismatch publishes the shipped decisions, the two sufficiency checks and the field each names, the four `kind` members of a report, and what `origin` decides about the clock.

- [ ] Cite `region=snapshot` and `region=adopt-decisions` from Task 14, and `region=resolve-plan` for the plan half. Every one of the three already runs in the package's own suite.

- [ ] The page states that `adoptDecisions` is what a non-React process calls and `FeatureProvider` is what a React tree calls, with a link to `/react-feature/api`. This is where the audit's largest finding is explained to a reader.

- [ ] Add `hydration: 'How do two processes agree?'` to `_meta.ts` in the Questions band.

- [ ] Run the page through Gemma, read it against `libs/feature/src/lib/adopt.ts` and `decision-set.ts`, then lint, test and typecheck `feature`, `docs`, `repo-checks`.

---

## Task 21: Build-time and prerendering, extended

**Deliverable:** `build-time.mdx` carries what `plan()` withholds and why, and what a prerendered artefact may and may not bake in.

**Files:**

- `apps/docs/content/feature/build-time.mdx` (edit)
- `libs/feature/docs/examples.md` (edit, if a region is missing)

### Steps

- [ ] Extend the page with the three kinds of `PlanEntry` the hydration spec § 5 names, what `freezeTimeAtBuild` opts a feature into, and the rule a prerendered artefact follows: a decision a build settled is one the build's own context decided, and a decision that reads the subject is deferred and belongs to the request.

- [ ] Add the sentence that answers the question a reader arrives with: a build may bake in an enablement whose rules read no context and may not bake in a variant assignment, because `assignVariant` reads the subject. Cite `region=plan-variant` and `region=plan-split`, which already prove both.

- [ ] Add the `origin: 'build'` half: a set written into a bundle states an instant that may be days old, and `resolvePlan` reads the client's own clock for the remainder. Cite `region=freeze-time`.

- [ ] Run the edited sections through Gemma, then lint, test and typecheck `docs` and `repo-checks`.

---

## Task 22: Choosing an integration

**Deliverable:** `choosing-an-integration.mdx`, the Platforms band's overview, which sends a reader to the right page.

**Files:**

- `apps/docs/content/feature/choosing-an-integration.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)

### Steps

- [ ] Draft the page on the shape `apps/docs/content/next/acl/choosing-an-integration.mdx` uses: the one question that decides which page a reader opens, then a row per platform. For feature the question is where the decision is read, and the three answers are a server that renders, a server that answers an API, and a client that holds decisions a server resolved.

- [ ] The page names the two mechanisms every platform needs and says which page supplies each: the store, built once at boot, and the evaluation context, carried per request by the framework's own mechanism. `features.for(context)` from Task 15 is what turns the second into one handle, and the page names it once.

- [ ] Write this page after Tasks 23 to 27, so each row links a page that exists and `doc-links.test.ts` passes. Add its `_meta.ts` key here, at the head of the Platforms band.

- [ ] Run the page through Gemma, then lint, test and typecheck `docs` and `repo-checks`.

---

## Task 23: NestJS, wired and documented

**Deliverable:** `apps/shop-api` resolves feature flags per request, and `nestjs.mdx` cites its regions.

**Files:**

- `apps/shop-api/src/features/feature.constants.ts`, `shop.features.ts`, `features.module.ts`, `features.service.ts` (new)
- `apps/shop-api/src/features/shop.features.spec.ts`, `features.service.spec.ts` (new)
- `apps/shop-api/src/features/features.controller.ts`, `features.controller.spec.ts` (new)
- `apps/shop-api/src/app/app.module.ts` (edit)
- `apps/shop-api/src/games/games.service.ts` (edit: one flag read)
- `apps/shop-api/src/games/games.service.spec.ts` (edit)
- `apps/shop-api/package.json` (edit: `@evanion/feature`)
- `apps/docs/content/feature/nestjs.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)

### Steps

- [ ] Build the store once at boot, following `apps/shop-api/src/acl/acl.module.ts`: a `FeaturesModule.forRoot()` registered `global: true`, a `SHOP_FEATURES` token holding the `Features` the `createFeatures` call returned, and a `#region features-module` around the class.

- [ ] Reach the evaluation context through the mechanism Nest already uses here. `apps/shop-api/src/acl/subject.service.ts` holds an `AsyncLocalStorage<ShopSubject>` in a plain singleton and the docblock states why `Scope.REQUEST` is wrong: it propagates upward through the injection graph and every provider depending on it is rebuilt per request and never receives `onModuleInit`. `FeaturesService` follows it, reading the subject off `SubjectService`, and answers `features.for(context)`. No correlation id reaches the context: `EvaluationContext` types the fields a condition may read, and no rule in the game shop targets a request id.

```ts
// #region features-service
@Injectable()
export class FeaturesService {
  constructor(
    @Inject(SHOP_FEATURES)
    private readonly features: Features<ShopFlags>,
    private readonly subjects: SubjectService,
  ) {}

  /**
   * The store bound to the request in flight.
   *
   * `for` settles the instant at this call, so two flags read by two services
   * inside one request cannot straddle a window boundary. The subject is read
   * off `SubjectService`, which is the AsyncLocalStorage the middleware opened.
   */
  current(): BoundFeatures<ShopFlags> {
    const subject = this.subjects.current();
    return this.features.for({
      targetingKey: subject?.id,
      roles: subject?.roles,
    });
  }
}
// #endregion features-service
```

- [ ] Serve the document the other two applications build from, following `apps/shop-api/src/acl/policy.controller.ts`: a `GET /api/features` answering `{ version, config }` where `config` is `serializeConfig(features)` and `version` is the document's own, with a `#region serve-the-document` around the handler and a case in `features.controller.spec.ts` asserting the body parses back through `parseFeatureConfig`. Register it in `features.module.ts`'s `controllers` array, the way `apps/shop-api/src/acl/acl.module.ts:53` registers its own, because a controller Nest never sees answers no request. The library ships no transport and this is the application's own endpoint, which is the same line `policy.controller.ts` sits on. Tasks 25 and 27 fetch it.

- [ ] Read one flag where it changes an answer the API already gives: `GamesService` gates the field it adds to a catalogue row, with a `#region flag-on-the-row` around the read and a case in `games.service.spec.ts` that asserts both answers.

- [ ] Add the `@evanion/feature` dependency to `apps/shop-api/package.json` at the exact version `libs/feature/package.json` carries, which `released-pins.test.ts` does not reach for an application and which `@nx/dependency-checks` does.

- [ ] Draft `nestjs.mdx` on the shape of `apps/docs/content/next/acl/nestjs.mdx`, with a `file=apps/shop-api/src/features/...` fence per region, in the order a reader wires them: the definitions, the module, the token, the request service, the read, the test.

- [ ] The page says `@evanion/feature` ships no Nest package and why, in one sentence, with a link to `limits.mdx`.

- [ ] Add `nestjs: 'NestJS'` to `_meta.ts`.

- [ ] Run the page through Gemma, read it against the files it cites, then `npx nx run-many -t lint test typecheck build -p shop-api docs repo-checks`.

---

## Task 24: Express, documented from a tested region

**Deliverable:** `express.mdx`, following `apps/docs/content/next/acl/express.mdx`, whose one fence cites a region of the library's own examples file because no Express application exists in this repository.

**Files:**

- `libs/feature/docs/examples.md` (edit: one region)
- `apps/docs/content/feature/express.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)

### Steps

- [ ] Add an `express-app` region to `libs/feature/docs/examples.md` holding the whole wiring in one fence: a store built at module scope, middleware that reads the shopper off the request and writes `features.for(context)` onto `res.locals`, and a handler that asks one question off the handle. Express is not a dependency of this package and may not become one, so the region types the two parameters structurally and asserts on the handler's own return rather than running a server. `apps/docs/content/next/acl/express.mdx:34` cites a region written the same way.

- [ ] Draft the page: where the store lives, where the context comes from, what `res.locals` holds, and the one thing an Express application has to decide, which is whether a flag read happens before or after the route's own authorization.

- [ ] Add `express: 'Express'` to `_meta.ts`.

- [ ] Run the page through Gemma, then `npx nx run-many -t lint test typecheck -p feature docs repo-checks`.

---

## Task 25: Next.js App Router, wired and documented

**Deliverable:** `apps/storefront-rsc` resolves flags per page view and ships a `DecisionSet` across the server-to-client boundary, and `nextjs.mdx` cites its regions.

**Files:**

- `apps/storefront-rsc/app/features.ts` (new)
- `apps/storefront-rsc/app/features.server.test.tsx` (new)
- `apps/storefront-rsc/app/spotlight.tsx` (edit: one flag read on the server)
- `apps/storefront-rsc/app/layout.tsx` (edit: the provider over the client tree)
- `apps/storefront-rsc/package.json` (edit: `@evanion/feature`, `@evanion/react-feature`)
- `apps/docs/content/feature/nextjs.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)

### Steps

- [ ] Write `apps/storefront-rsc/app/features.ts` on the shape `apps/storefront-rsc/app/access.ts` already uses: a module-scope store keyed on the document version, fetched from shop-api's `GET /api/features` the way `access.ts` fetches `GET /api/policy`, and `cache` from `react` for the per-page-view binding. `cache` is what makes it once per page view and gives two concurrent page views their own, which the `currentAccess` docblock argues:

```ts
// #region per-request-features
export const currentFeatures = cache(
  async (): Promise<BoundFeatures<ShopFlags>> => {
    const [features, shopper] = await Promise.all([store(), currentSubject()]);
    return features.for({ targetingKey: shopper.id, roles: shopper.roles });
  },
);
// #endregion per-request-features
```

- [ ] Resolve a `DecisionSet` once per page view and hand it to the client tree, with a `#region ship-the-set` around the `snapshot` call and the provider mount. The server states the instant, so no client passes `now` by hand, which is the property `DecisionSet.now` exists for.

- [ ] Read one flag on the server, in `spotlight.tsx`, with a `#region gate-on-the-server` around it.

- [ ] Draft `nextjs.mdx` on the shape of `apps/docs/content/next/acl/nextjs.mdx`: the version-keyed store, the `cache` binding, the server read, the set crossing the boundary, and the provider. The page states what crosses and what does not: a `Features` is closures over a frozen document and stays on the server, a `DecisionSet` is plain data and crosses.

- [ ] The page names the one thing a reader has to get right under RSC, which Task 16's test proves: a set crosses the flight boundary intact, and a set a reader hand-serialises with `JSON.stringify` into a `<script>` tag carries no `Date`.

- [ ] Add `nextjs: 'Next.js (React Server Components)'` to `_meta.ts`.

- [ ] Run the page through Gemma, read it against the files it cites, then `npx nx run-many -t lint test typecheck build -p storefront-rsc docs repo-checks`.

---

## Task 26: React Router 8, wired and documented

**Deliverable:** `apps/admin` resolves flags in a loader and toggles a control in the tree, and `react-router.mdx` cites its regions.

**Files:**

- `apps/admin/app/features.ts`, `features.server.ts` (new)
- `apps/admin/app/page-context.ts` (edit: a `featuresContext`)
- `apps/admin/app/page-view.server.ts` (edit: the middleware fills it)
- `apps/admin/app/shell.tsx` (edit: the provider mount)
- `apps/admin/app/routes/title.tsx` (edit: one hook read and one action read)
- `apps/admin/tests/features.spec.tsx` (new)
- `apps/admin/package.json` (edit)
- `apps/docs/content/feature/react-router.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)

### Steps

- [ ] Follow `apps/admin/app/access.ts` and `page-context.ts` exactly. `features.ts` holds the vocabulary both runtimes share and the `createFeatureContext` binding; `features.server.ts` holds the fetch and the store. A router context carries the per-request handle, for the reason `correlationContext`'s docblock gives: one process serves every request concurrently, and nested loaders run in parallel.

- [ ] The action re-decides. `apps/admin/app/routes/title.tsx`'s existing `#region action-decides` is the model: a hook read toggles a control and the action asks again on the server, because a decision a browser reached toggles an element and gates nothing.

- [ ] Draft `react-router.mdx` on the shape of `apps/docs/content/next/acl/react-router.mdx`, with a fence per region in the order a reader wires them.

- [ ] Add `'react-router': 'React Router 8'` to `_meta.ts`.

- [ ] Run the page through Gemma, read it against the files, then `npx nx run-many -t lint test typecheck build -p admin docs repo-checks`.

---

## Task 27: Astro SSR, wired and documented

**Deliverable:** `apps/storefront` resolves flags in middleware and reads them in a page and in an island, and `astro.mdx` cites its regions.

**Files:**

- `apps/storefront/src/lib/features.ts` (new)
- `apps/storefront/src/lib/features.test.ts` (new)
- `apps/storefront/src/middleware.ts` (edit: `locals.features`)
- `apps/storefront/src/env.d.ts` (edit: the `App.Locals` member)
- `apps/storefront/src/pages/cart.astro` (edit: one gate)
- `apps/storefront/src/pages/cart.astro.test.ts` (edit)
- `apps/storefront/package.json` (edit)
- `apps/docs/content/feature/astro.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)

### Steps

- [ ] `apps/storefront/src/lib/features.ts` holds the store the way `policy.ts` holds the matrix: module scope, built from the document shop-api's `GET /api/features` serves (Task 23 adds the endpoint), replaced when the version moves. The page says why module scope is right, which `policyAccess`'s docblock already argues: construction validates, clones and freezes, and every decision after that is a local call over the frozen copy.

- [ ] `middleware.ts` writes `context.locals.features = features.for({ targetingKey: subject.id })` beside the four members it already writes, inside the existing `#region open-context`. `env.d.ts` declares the member, and this is where Task 17's default earns itself: the declaration writes `BoundFeatures` with no type argument.

- [ ] A page reads one flag off `Astro.locals.features`, with a `#region flag-gate` around it.

- [ ] An island is where the audit's third question lands. The storefront is all `.astro` today, so the page documents both answers and the repository proves the first: a server-rendered page reads the flag and emits HTML, which needs nothing to cross; an island that needs a decision receives the `DecisionSet` as a prop, and `adoptDecisions` from Task 14 is what a non-React island calls. The page shows the first from the application's own regions and the second from `region=adopt-decisions`, and says which is which.

- [ ] Draft `astro.mdx` on the shape of `apps/docs/content/next/acl/astro.mdx`.

- [ ] Add `astro: 'Astro SSR'` to `_meta.ts`.

- [ ] Run the page through Gemma, read it against the files, then `npx nx run-many -t lint test typecheck build -p storefront docs repo-checks`.

---

## Task 28: Advanced

**Deliverable:** `advanced.mdx`. Schema typing and the two vocabularies, custom rollout fields, the freshness budget, variant seeds and sticky assignment.

**Files:**

- `apps/docs/content/feature/advanced.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)
- `apps/docs/content/feature/distribution.mdx` (edit: the schema and `maxStale` sections link out. Task 19 edits this page's `Where the Adapter Lives, and What No Endpoint Answers` section)
- `apps/docs/content/feature/variants.mdx` (edit: the seed and sticky sections link out)

### Steps

- [ ] Draft four sections. Schema typing: `ContextSchema` types the fields a condition may read, `FeatureSchema` and `ValueShape` type a variant's value, and `schemaVersion` is what makes a schema immutable. Custom rollout fields: `DEFAULT_ROLLOUT_FIELD`, `rollout.by`, `rollout.seed`, and what changing either does to an existing member's bucket. The freshness budget: `maxStale` travels and no entry point in this library reads it, which decision 3 of the distribution spec fixes, and the party that fetches is the party that acts on it. Variant seeds and sticky assignment: `variantSeed`, `VariantSpec.order`, and `context.stickyVariants`, which `assignVariant` reads before the bucketing field is touched at all.

- [ ] Cite `region=config-schema`, `region=rollout-spec`, `region=variant-seed-shared` and `region=variant-sticky`, all of which already run.

- [ ] Edit `distribution.mdx` and `variants.mdx` so each links here for the advanced half and keeps its own.

- [ ] Add `advanced: 'Advanced'` to `_meta.ts` in the Reference band.

- [ ] Run the page through Gemma, read it against `libs/feature/src/lib/config.ts` and `variants.ts`, then lint, test and typecheck `docs` and `repo-checks`.

---

## Task 29: Limits and pitfalls

**Deliverable:** `limits.mdx` and `pitfalls.mdx`, which `@evanion/acl` has and `@evanion/feature` does not.

**Files:**

- `apps/docs/content/feature/limits.mdx` (new)
- `apps/docs/content/feature/pitfalls.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)
- `apps/docs/content/feature/index.mdx` (edit: `What It Leaves to You` links `limits.mdx`)

### Steps

- [ ] Draft `limits.mdx` as what a reader decides against before writing any code, following `apps/docs/content/next/acl/limits.mdx`. The list is already written down across the specs and the boundary test: no transport, no scheduler, no administration surface, no decision endpoint, no clock authority, no freshness policy, no upward blocking, no exposure counting, and no framework package beyond React. Each row names the file or the spec decision that fixes it.

- [ ] Draft `pitfalls.mdx` as what a reader checks code against once there is some. Each entry names a failure a test in this repository already proves.

- [ ] **Review Focus, Step 3.** One pitfall is the variant `value` a reader chose. Add a region to `libs/feature/docs/examples.md` that builds a store whose variant `value` holds a `Date`, resolves it, and shows what `JSON.parse(JSON.stringify(decision.value))` answers. Run it to get the output; do not write the output from memory. Task 16's spec case proves the condition half and this proves the value half, and the page names the one member the library normalises and the one it leaves.

- [ ] The other pitfalls, each with the file that proves it: an object literal written inline as a provider `context`, which re-resolves on every render (`libs/react-feature/src/index.tsx`'s `context` docblock); `now` left out of a tree that must agree with a server render; `reason` or `assignment` read as input, which `reason-is-output-only.spec.ts` refuses; a context carrying `null` at the bucketing field, which passes a presence test and buckets nothing (`variants.ts:585-589`); a reload discarding a local toggle, which is decision 10 of the distribution spec; a key named `constructor`, which three call sites guard with `hasOwnProperty`; an observer that blocks, which turns observability into an availability incident.

- [ ] Add `limits` and `pitfalls` to `_meta.ts` at the head of the Reference band.

- [ ] Run each page through Gemma, one at a time, then lint, test and typecheck `feature`, `docs`, `repo-checks`.

---

## Task 30: Testing a flag

**Deliverable:** `testing.mdx`, which `@evanion/acl` has and `@evanion/feature` does not.

**Files:**

- `apps/docs/content/feature/testing.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)
- `libs/feature/docs/examples.md` (edit: the regions the page cites)

### Steps

- [ ] Draft the page around the four things a reader tests: a decision for a pinned context and a pinned clock, a rollout's membership at a boundary, a variant assignment for a known `targetingKey`, and the agreement between two processes. The last one is where `libs/feature/conformance/config-decisions.json` and `plan-decisions.json` come in, which `conformance.spec.ts` runs and which no page names today.

- [ ] The page says how to pin the clock: `context.now`, which every entry point honours over its own `new Date()`, and `features.for({ now })`, which settles it for a whole handle. Cite a region that proves both.

- [ ] The page names what a reader does not need to mock: no network call happens inside a decision, so a test needs no server and no fake transport.

- [ ] Add `testing: 'How do I test a flag?'` to `_meta.ts` in the Questions band.

- [ ] Run the page through Gemma, then lint, test and typecheck `feature`, `docs`, `repo-checks`.

---

## Task 31: Adopting

**Deliverable:** `adopting.mdx`. Moving an application that already has flags onto this library.

**Files:**

- `apps/docs/content/feature/adopting.mdx` (new)
- `apps/docs/content/feature/_meta.ts` (edit)

### Steps

- [ ] Draft the page on the shape of `apps/docs/content/next/acl/adopting.mdx`: what a reader already has, what maps onto what, and what has no counterpart. A boolean flag map becomes a definitions array; a percentage rollout becomes a `rollout`; an A/B split becomes `variants`; a dependency between flags, which most flag systems do not have, is the thing this library adds and the reason the move is worth making.

- [ ] The page names the two things that do not map: a flag whose value a service answers per call, which this library refuses because every process holds the rules, and a flag whose value a transport pushes, which the reader keeps and which installs through `parseFeatureConfig` and `features.reload`.

- [ ] The page gives the order to move in: definitions first, read sites second, rollouts third, variants last, with each step leaving the application releasable.

- [ ] Add `adopting: 'How do I move an application onto this?'` to `_meta.ts` in the Questions band.

- [ ] Run the page through Gemma, then lint, test and typecheck `docs` and `repo-checks`.

---

# PIECE FIVE: the release flip

## Task 32: Drop `private`, move the pages under `content/next/`, and assert the end state

**Deliverable:** both packages are releasable at `0.1.0`, both sections are authored under `content/next/`, the allowance file mentions neither, and the whole affected sweep passes uncached.

**Read first:** `docs/specs/2026-09-13-versioned-docs.md` decisions 1 through 7, and `docs/specs/2026-09-13-released-by-default.md` decisions 1, 2, 3 and 5 with § 1's URL grammar. Decision 5 is the one that decides what the bare path serves for a package with no release: a package that `nx release` computes a bump for is not seeded and keeps serving `/next/` content under a notice.

**Files:**

- `libs/feature/package.json` (edit: `private` out, `0.1.0`)
- `libs/react-feature/package.json` (edit: `0.1.0`, and the pin to `0.1.0`)
- `apps/docs/app/navigation.ts` (edit: `workshop: false` and `unversioned` out of the `@evanion/feature` entry)
- `apps/docs/content/next/feature/**` (moved from `apps/docs/content/feature/**`, 23 pages and `_meta.ts`)
- `.gitignore` (edit: the `!apps/docs/content/feature/` line out)
- Every `apps/docs/content/next/feature/*.mdx` (edit: `<WorkshopNotice slug="feature" />` out)
- `apps/docs/components/ReleaseNotice.tsx` (edit: the docblock's sentence about `@evanion/feature`)
- `apps/docs/components/ReleaseNotice.test.tsx` (edit: the `WorkshopNotice` case)
- `libs/feature/src/lib/core-boundary.spec.ts` (edit, if its manifest cases read `private`)

### Steps

- [ ] `git mv apps/docs/content/feature apps/docs/content/next/feature`. `sectionOf` maps both trees to the slug `feature`, so the move changes no section key and every per-section ratchet keeps its number.

- [ ] **Review Focus, Step 3.** Remove the `!apps/docs/content/feature/` line from `.gitignore` in the same commit as the move. `authoredPages()` reads `git ls-files --cached --others --exclude-standard`, so a leftover un-ignore would make the generated copy at `content/feature/` an authored page too and double every count `doc-fence.test.ts`, `doc-domain.test.ts` and `doc-export-coverage.test.ts` make for the section.

- [ ] Remove `unversioned` and set `workshop: false` on the `@evanion/feature` entry in `apps/docs/app/navigation.ts`. `docs-archive.test.ts` then includes the section in `servedSections()`, and `cut-releases.mjs` and `recut.mjs` stop skipping it.

- [ ] Set `"version": "0.1.0"` and remove `"private": true` from `libs/feature/package.json`. Set `"version": "0.1.0"` and remove `"private": true` from `libs/react-feature/package.json`, and change `dependencies["@evanion/feature"]` to `"0.1.0"`. `released-pins.test.ts` holds the pin, and `publishable-dependencies.test.ts` holds the two `private` flags together: the binding installs the core, so the core publishes first or neither does.

- [ ] Set `workshop: false` on both the `@evanion/feature` and the `@evanion/react-feature` entries of `apps/docs/app/navigation.ts`. `docs-navigation.test.ts` holds each one equal to `private` in its own manifest.

- [ ] Delete every `<WorkshopNotice slug="feature" />` from the 23 pages. `apps/docs/content/next/feature/getting-started.mdx` carries children inside the element; move that prose into the page body, because the component renders nothing once `workshop` is false and the prose would vanish with it.

- [ ] Rewrite the `apps/docs/components/ReleaseNotice.tsx` docblock sentence that names `@evanion/feature` as private, so it states the rule without naming a package: the notice renders nothing where no published version exists, and `WorkshopNotice` says more about such a package than this could.

- [ ] Rewrite `apps/docs/components/ReleaseNotice.test.tsx`'s `renders nothing where WorkshopNotice speaks` case. No package carries `private: true` after this task, so the case mocks `../app/navigation` with one entry carrying `workshop: true` and asserts both halves against that entry. Keep the docblock's invariant and change the package it names to the fixture.

- [ ] Run `npx nx run docs:archives`, then `npx nx run-many -t test -p docs repo-checks`, which is what reads `content/versions.json`.

- [ ] Assert the end state:

```bash
cat tools/repo-checks/src/doc-export-coverage-allowance.json   # prints {}
node -p "require('./libs/feature/package.json').private"        # prints undefined
node -p "require('./libs/feature/package.json').version"        # prints 0.1.0
node -p "require('./libs/react-feature/package.json').dependencies['@evanion/feature']"  # prints 0.1.0
npx nx run-many -t lint test typecheck build e2e --all --skip-nx-cache
npm run verify:packaging
npx prettier --check .
```

**Verification:** the uncached sweep over every project passes, `verify:packaging` passes, and the allowance file is `{}`.

---

## The owner's handoff: the first publish of each package

Not a task. Neither package has ever been published, and `RELEASING.md` § 2 states why CI cannot do it: npm will not configure a trusted publisher for a package that does not exist, so each new package needs one manual publish from a maintainer's machine with their own 2FA.

Run it once per package, `@evanion/feature` first, because `@evanion/react-feature` pins it:

```bash
npm login                       # if not already authenticated
npx nx run-many -t build
npm run verify:packaging        # same check CI runs before publishing
cd libs/feature
npm publish --access public --no-provenance --otp=<code-from-your-authenticator>
```

```bash
cd ../..
git tag '@evanion/feature@0.1.0' <sha>
```

Then the same for `@evanion/react-feature`:

```bash
npx nx run-many -t build
npm run verify:packaging
cd libs/react-feature
npm publish --access public --no-provenance --otp=<code-from-your-authenticator>
cd ../..
git tag '@evanion/react-feature@0.1.0' <sha>
```

Both extra flags are needed, for the reasons `RELEASING.md` § 2 gives. `--no-provenance` overrides `publishConfig.provenance: true`, which fails locally with "Automatic provenance generation not supported for provider: null"; the published version carries no attestation and every release after it is attested. `--otp` avoids npm's browser auth flow, which redacts the auth URL to `***` whenever stdout is not a TTY. If the 2FA is web-only rather than TOTP, run the publish in a real terminal rather than through a tool that captures output.

Check where you are before publishing, because `npm publish` from the workspace root fails with `EPRIVATE`:

```bash
node -p "require('./package.json').name"   # must print the package, not @evanion/open-source
```

The registry takes a minute or two to serve a brand new package. A 404 immediately after publishing is propagation.

Then configure the trusted publisher for each package on npmjs.com, per `RELEASING.md` § 1: organization `Evanion`, repository `libraries`, workflow filename `release.yml`, environment empty, allowed action `npm publish`.

## Open questions for the owner

Each is a decision this plan made or declined to make, and each is one the owner may want answered differently.

1. **Executing decision 6 of the adapters spec ahead of its trigger.** Decision 16 and § 11 of `docs/specs/2026-09-16-framework-adapters.md` say every `feature` adapter is not built, and name a second framework as what would change the answer. Decision 6 fixes the shape of the extraction and says it executes in full when that happens. This plan executes it now because `@evanion/feature` is being released and the release is the moment the subpath's optional peer becomes a published promise. If the owner would rather ship `@evanion/feature/react` as it stands and take the migration later, Tasks 1, 1b, 1c, 2 and 3 come out and PIECE TWO documents the 88 names `@evanion/feature`'s `undocumented` list holds today instead of 77.
2. **`features.for` as the name.** `@evanion/acl` calls its binding `authorize`, which names what the handle is for. `for` names the preposition and reads well at the call site (`features.for(context).isEnabled('express-pickup')`). `bound`, `at` and `with` are the other candidates. `for` is a keyword in a statement position and a legal method name, so nothing breaks either way.
3. **Whether `features.for` should carry `toggle`.** This plan leaves it off: a toggle writes intent and is not a question about one context. An operator tool holding a handle would then hold the store as well.
4. **`reportDivergence` and `ruleFields` are published, in Task 1.** Not a question, a decision the extraction forces. `libs/react-feature/src/index.tsx` calls `reportDivergence(onDivergence, report)` at what is `libs/feature/src/react/index.tsx:269` today, to deliver the memo's collected reports to the provider's observer, and `libs/react-feature/src/hydrate.ts` needs both names. `@evanion/source` resolves `@evanion/feature` to `src/index.ts` and to no deeper path, so there is no way for the React package to reach either name unpublished. Publishing `reportDivergence` also serves the author writing a Vue or Svelte binding outside this repository, which is the second reason and not the first. Each costs one line in `libs/feature/src/index.ts`, one `##` entry, one region and, for `ruleFields`, one `describe`.
5. **The variant `value` that no wire format carries.** Ruling 5 normalises a `Date` at a window condition's `value` and leaves `Decision.value` alone, because the application chose the value's type. The alternative is for `snapshot` to refuse a value `JSON.stringify` cannot carry, the way `serializeConfig` refuses one, which would turn an authoring mistake into a request failure. Task 29's pitfalls page documents the current answer.
6. **`libs/feature/tsconfig.lib.json` lists `"node"` in `types` because `observe.ts:293` names `process`.** The package imports no Node built-in and `core-boundary.spec.ts` proves it, so the `types` entry is there for one `typeof` guard. A consumer compiling the package's source through the `@evanion/source` condition without `@types/node` sees `TS2591` on that line. The published `.d.ts` carries none of it. Replacing the guard with a read off `globalThis` would drop the dependency; it would also defeat a bundler's `define` substitution, which the guard's own docblock already accepts for a `console.warn`.
7. **No application in this repository used `@evanion/feature` before this plan.** Tasks 23, 25, 26 and 27 each add wiring to a demo application so the framework pages cite code this repository builds. That is four applications gaining a dependency they did not have, and each one's flag read is a change to what the application renders. If the owner would rather the pages cite only library-owned regions, the four tasks shrink to one region each in `libs/feature/docs/examples.md`, on the shape Task 24 uses for Express, and the pages lose the per-request plumbing that only an application can show.
8. **Whether any framework genuinely needs its own package.** The audit says no. A distributor needs a context write, a context read and a memo, which § 1 of the adapters spec argues the framework supplies, and `apps/shop-api/src/acl/acl.module.ts` is 60 lines of application code that no package could own without also owning the principal. Astro is the one worth a second look: an island receiving a `DecisionSet` has to adopt it, and `adoptDecisions` is what it calls, so the package would hold one call and a prop type. Not planned, and recorded here for the owner.
9. **Friction this plan assigns to the application and does not fix.** The principal and how it reaches deep code; the source that moves the document's bytes; the administration surface; a store per tenant; exposure recording at the render site. Each is refused by a spec decision or by `core-boundary.spec.ts`, and each is named on `limits.mdx` in Task 29.
10. **Whether `apps/docs/content/feature/` should move under `content/next/` before PIECE FOUR rather than after.** This plan moves it last, so the move happens once over the finished 23-page set. The cost is that every page task in PIECE FOUR writes into a tree whose path changes in Task 32, and `git mv` of a directory carries them. The benefit is one move and one `.gitignore` edit.
11. **The section's page count.** `@evanion/acl` has 33 pages and `@evanion/feature` reaches 23. The two bands this plan adds are Platforms, at six pages, and Questions, at five. acl's Reference band has eleven pages to feature's four, and the gap is the pages acl needs for a trust boundary: `security`, `attacks`, `refusals`, `resolution`, `explorer`. A feature flag gates nothing, so none of the five has a counterpart here.
12. **Whether `Features` should default `Frozen` to `false` rather than `boolean`.** This plan leaves it at `boolean`, which is what it is today. The `Features` docblock argues that a declaration naming the type gets the union of both forms and assigns to neither `Decisions<S>` nor `DeepReadonly<Decisions<S>>`, which is a sharp edge Task 17's default makes easier to reach: `Features` with no argument at all now compiles and carries that union. Defaulting `Frozen` to `false` would make the bare form answer one shape and would lie about a store built with `observe`.
