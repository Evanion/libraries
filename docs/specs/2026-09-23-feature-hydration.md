# @evanion/feature: hydration and cross-process agreement

Status: proposed
Packages: `@evanion/feature`. No new package. Adds one core entry point
(`hydrateFeatures`), one plan resolver (`resolvePlan`), one producer method
(`Features.snapshot`), one readonly field (`Features.version`), two wire types
(`DecisionSet`, `DivergenceReport`), one error (`InvalidConfigDocumentError`)
and two `FeatureProvider` props (`onDivergence`, `onVersionMismatch`). The
`decisions` prop changes type.
Depends on: `docs/specs/2026-09-11-feature-toggles.md` (the store, `plan()`,
the two package entries); `docs/specs/2026-09-23-feature-variants.md`, whose
"Determinism across processes" assigns this document the consumer side of
conditions 2 and 3, and whose decision 7 fixes that a `PlanEntry` may carry a
`decision` while `resolved` is `'deferred'`;
`docs/specs/2026-09-23-feature-config-distribution.md` for the envelope, its
`version`, `maxStale`, `visibility`, reduced serialization, the `schema` entry,
atomic reload, the non-throwing validator and the database adapter;
`docs/specs/2026-09-23-feature-observation-seam.md`, which this document's
`onDivergence` folds into once it lands;
`docs/specs/2026-09-16-published-policy-contracts.md` § 8, which fixes that a
decision never crosses a service boundary and a document does.
Prior art: `libs/acl/src/hydrate-policy.ts` and `libs/acl/src/parse-matrix.ts`,
which draw the same line between a document an author wrote in this process and
a document a control plane served.

The package is unpublished (`libs/feature/package.json:4`, `private: true`), so
the `decisions` prop changes shape with no migration path.

## Decisions

1. `hydrateFeatures` takes the serialized envelope. `createFeatures` keeps its
   definitions array, because the `const` type parameter that infers variant
   unions needs a literal and a served document has none.
2. A malformed document produces no store. `hydrateFeatures` reports every
   invalid row at once and the caller keeps whatever store it already held.
3. A hydrated decision set carries the config version that produced it, the
   instant it was resolved at, and where it came from.
4. `FeatureProvider` compares the shipped version against the version its
   `features` holds, with `!==`.
5. A version mismatch renders the shipped decisions and reports. An application
   that wants the opposite passes `onVersionMismatch: 're-resolve'`.
6. The provider names a shipped decision the client could not have reproduced,
   before React reports the DOM difference it causes.
7. `resolvePlan` honours a `PlanEntry` that carries a `decision` under
   `resolved: 'deferred'`: it takes the enablement from the entry and computes
   the variant locally.
8. `now` travels with a decision set. A set from a per-request render supplies
   the default `now` for the deferred remainder. A set from a build does not.
9. Divergence is reported through one callback with one report type, and the
   library never throws out of it and never lets it alter a decision.
10. `murmur3` encodes UTF-8 itself. `bucketOf` then depends on no host global,
    which is what a Swift or Kotlin port matches against.

## 1. What a client actually receives

Two payloads arrive at a client, and they answer different questions.

The configuration envelope holds intent for every feature. The control plane
serves it, a client caches it, and every process holding it computes its own
decisions from it. § 8 of the published policy contracts spec settled that a
document crosses a service boundary and a decision does not, and that constraint
holds here without change.

The decision set holds one subject's answers for one instant. A server render
produces it and hands it to the client that renders the same tree. It crosses no
service boundary, because the process that produced it and the process that
consumes it are two halves of one page load.

`createFeatures` today takes a definitions array (`libs/feature/src/lib/features.ts:86-88`)
and `FeatureProvider` today takes a bare `Decisions<F>`
(`libs/feature/src/react/index.tsx:49`). Neither one validates a wire format and
neither one carries a version, so the two payloads are indistinguishable from
objects an author wrote by hand in the same process.

## 2. Config hydration

`hydrateFeatures` is a separate entry point on the core:

```ts
export function hydrateFeatures<S>(
  document: unknown,
  options?: HydrateOptions,
): HydrateResult<S>;

export interface HydrateOptions {
  /** Overrides the document's own `version`. */
  version?: string | number;
  /** When this holder last confirmed the document was current. */
  fetchedAt?: Instant;
  /** Notified for every divergence this store detects later. */
  onDivergence?: (report: DivergenceReport) => void;
}
```

`createFeatures` keeps the signature the variants spec gave it. Its first
overload carries a `const` type parameter so a literal definitions array infers
its variant unions and value types, and a document parsed out of JSON carries no
literal types for that overload to read. A third overload taking an envelope
would also have to resolve against the two that exist, and TypeScript selects an
overload on the type-argument count. `hydrateFeatures` takes the explicit schema
as its one type parameter, which is the path the variants spec already names for
every consumer that cannot infer.

The two entry points also differ in how they refuse. `createFeatures` throws
(`libs/feature/src/lib/errors.ts:3-11`), which is correct for a definitions array
a developer wrote in the file above the call. A document a control plane served
arrives at boot, and a throw there takes down the client for a configuration
change nobody at the client made. So `hydrateFeatures` returns a result and
never throws.

`libs/acl/src/hydrate-policy.ts` and `libs/acl/src/parse-matrix.ts` draw this
same line: `hydratePolicy` adopts a document an author composed locally, and
`parseMatrix` adopts foreign JSON under `closed: true`.

### What the wire format check covers

The distribution spec owns the envelope and its validator. This document fixes
what the consumer requires of that validator:

- It reports every invalid row, keyed by the row's `key` when the row has a
  readable one and by its index when it does not. One error per call would make
  an operator fix a broken push one row at a time.
- It checks that `variants` arrived in the order its author declared. Condition
  5 of the variants spec makes declaration order part of the assignment contract, so
  a document whose variants arrived reordered assigns different subjects to
  different variants than the document its author wrote. The consumer cannot
  detect a reorder from the array alone, so the envelope carries a digest over
  the ordered variant names per feature and `hydrateFeatures` recomputes it.
- It runs the graph and variant validation `createFeatures` already runs
  (`libs/feature/src/lib/features.ts:95`, and the five variant cases in the
  variants spec's Validation section), as reported errors.

### A malformed document produces no store

`hydrateFeatures` returns `{ ok: false, errors }` and builds nothing. A store
built from the rows that parsed would turn every dropped feature off, and off is
the same answer a correctly configured kill switch gives. An operator reading a
dashboard cannot separate the two, and the subject sees the feature disappear
either way.

The caller keeps the store it already held. A client that has never hydrated one
has no store, and the distribution spec's atomic reload owns what a client does
with the gap.

## 3. Decision hydration

`FeatureProvider.decisions` becomes a versioned set:

```ts
export interface DecisionSet<F extends FeatureKey = string> {
  /** The config version that produced these. */
  version?: string | number;
  /** The instant they were resolved at, ISO 8601. */
  now: string;
  /** Where they came from. `'build'` is a `plan()` snapshot. */
  origin: 'render' | 'build';
  decisions: Decisions<F>;
}
```

The producer side is one method on the store:

```ts
readonly version?: string | number;
snapshot(context?: EvaluationContext): DecisionSet<F>;
```

`Features.version` is what the envelope carried, or what `HydrateOptions.version`
overrode. A store built by `createFeatures` from a literal has no version, and
`snapshot` omits the field for it.

`snapshot` reads `now` out of the context the same way `resolve` does at
`libs/feature/src/lib/features.ts:104-107`, so the instant the set reports is the
instant the decisions were computed at.

### The comparison

`FeatureProvider` compares `decisions.version` against `features.version` with
`!==`. The acl revalidate contract uses the same operator for the same reason
(`docs/specs/2026-09-16-published-policy-contracts.md`, `AccessOptions.version`):
a digest or a composite string works where an ordered comparison would not.

Four outcomes:

| shipped | store | outcome |
| --- | --- | --- |
| a version | the same version | agreed, no report |
| a version | a different version | `kind: 'config-version'`, reported |
| a version | none | `kind: 'unversioned'`, reported |
| none | any | `kind: 'unversioned'`, reported once |

Every one of the four renders the shipped decisions.

### Why a mismatch renders the shipped decisions

The server already rendered HTML from the shipped decisions, and the subject is
looking at it. A client that re-resolves produces a third answer, one the server
never rendered and one no exposure record names. The variant the analytics
pipeline recorded is the shipped one, because the server recorded it when it
resolved. A client that quietly renders a different variant makes every
experiment result wrong by an amount nobody can measure from the data.

The provider also cannot tell which side is stale. A version mismatch means the
client's envelope and the server's envelope differ, and the client's copy is the
older one as often as it is the newer one. A client that re-resolves picks its
own copy on the grounds that it is local, which is not a reason.

The cost is a kill switch that does not take effect until the subject loads the
page again. That cost is real and this document does not argue it away. An
operator who turns a feature off during a session wants it off, and a page
holding shipped decisions keeps rendering it for the life of that page.

`onVersionMismatch: 're-resolve'` is the escape hatch, and an application that
runs no experiments and cares about revocation latency sets it. The default is
`'use-shipped'`, because a wrong experiment result is the failure that produces
no error, no warning and no way to notice after the fact, and a stale kill switch
produces a complaint within minutes.

## 4. The SSR mismatch case

A server resolves with `targetingKey: 'u-7741'` and assigns `blue`. The client
mounts a provider whose context carries no `targetingKey`, so the client would
assign the control (the variants spec: a context carrying no usable value at
`variantBy` gets the first declared variant with `source: 'fallback'`). React
reports a text content difference between two button labels. The message names
the DOM node and says nothing about `targetingKey`.

The provider runs two checks, and both report before React reconciles. The
library's message reaches the console ahead of React's hydration warning, which
puts the cause immediately above the symptom. The library cannot suppress or
annotate React's own message, and React exposes no API for that.

The first check reads context sufficiency on mount. Every shipped decision carries
`assignment.by`, naming the field it bucketed on, and `assignment.source`. When a
shipped decision reports a source other than `'fallback'` and the provider's own
`context` carries nothing at `assignment.by`, the provider reports:

```
feature "checkout-cta": the server assigned variant "blue" by "targetingKey",
and this provider's context carries no "targetingKey", so a client resolution
would assign "control" (source: fallback). Pass targetingKey to
<FeatureProvider context={...}>.
```

This check reads the shipped decisions and the context, so it runs in production
for one pass over the decision set.

The second check diffs the two decision sets in development. When
`process.env.NODE_ENV !== 'production'`, the provider resolves locally against
its own `features` and `context`, compares key by key, and reports every
difference in `enabled`, `reason` or `variant` as `kind: 'decision-differs'` with
both sides named. It still renders the shipped set. The extra resolution is one
pass per mount and it never reaches a production bundle.

## 5. Partial hydration

`plan()` returns three kinds of entry (`libs/feature/src/lib/evaluate.ts:215-285`,
`libs/feature/src/lib/types.ts:176-184`, and decision 7 of the variants spec):

- `resolved: true | false` with a `decision`. Settled at build.
- `resolved: 'deferred'` with no `decision`. Nothing about it is settled.
- `resolved: 'deferred'` with a `decision`. Enablement is settled and the variant
  is not.

`resolvePlan` turns a plan plus a client context into a full decision set:

```ts
export function resolvePlan<F extends FeatureKey>(
  features: Features<F>,
  plan: Plan<F>,
  context?: EvaluationContext,
  options?: { onDivergence?: (report: DivergenceReport<F>) => void },
): Decisions<F>;
```

Per entry:

1. A boolean `resolved` with a `decision`: the entry's `decision` is the answer.
   `resolvePlan` re-runs nothing. The build already decided, and a client that
   re-decides throws away the point of planning.
2. `'deferred'` with no `decision`: `resolvePlan` calls `decide` for that feature
   against the client context, with the decisions it has already settled in this
   pass as the cascade's parent map.
3. `'deferred'` with a `decision`: `resolvePlan` takes `enabled`, `reason` and
   the explanation fields straight from `entry.decision`, and computes only the
   variant assignment. It does not re-run the rules. The rules were settled at a
   build instant, and a second run against a richer client context can flip
   enablement, which would contradict the entry that says enablement is settled.

Case 3 needs the assignment inputs and nothing else: the feature's `variants`,
its `variantBy` field out of the client context, its `variantSeed`, and
`context.stickyVariants`. All four are in the store the client hydrated.

The cascade still runs in dependency order, because a deferred parent puts its
`needs` on its dependants (`libs/feature/src/lib/evaluate.ts:243-245`) and a
dependant resolved before its parent would read an empty parent map.

When an entry's `needs` names a field the client context still lacks,
`resolvePlan` reports `kind: 'missing-field'` naming the feature and the field,
then falls back the way the engine already does. A rollout with no bucketing
value does not match (`libs/feature/src/lib/evaluate.ts:66-75`) and a variant with
no bucketing value takes the control.

## 6. Clock agreement

`now` defaults to `new Date()` at the call
(`libs/feature/src/lib/features.ts:104-107`), and `FeatureProvider`'s JSDoc
already warns that a tree which must agree with a server render should pass `now`
explicitly (`libs/feature/src/react/index.tsx:39-42`). That warning puts the
whole burden on the application. A `DecisionSet` carries the instant, so the
producer states it once and no application has to.

`DecisionSet.now` is required. The producer knows the instant it resolved at and
the consumer cannot recover it, so an optional field would leave every consumer
asking for the instant out of band.

`origin` decides what the consumer does with it.

For `origin: 'render'`, the set came out of the same request that produced the
HTML, and its `now` is seconds old. `resolvePlan` and `FeatureProvider` use it as
the default `now` for everything they resolve locally, so a window boundary
between the server's instant and the client's mount cannot move half the tree.

For `origin: 'build'`, the set came out of `plan()` at build time, and its `now`
may be days old. `resolvePlan` defaults to `new Date()` for the deferred
remainder. The entries the build settled keep the build's instant, which is
exactly what `freezeTimeAtBuild` opts a feature into
(`libs/feature/src/lib/types.ts:97-103`), and a feature that did not opt in was
deferred and gets the client's clock.

An explicit `context.now` wins over both, which keeps the existing precedence at
`features.ts:104-107` unchanged and keeps every test able to pin the clock.

Clock skew between the two machines stays bounded and unavoidable, as condition 4
of the variants spec states. What this section removes is the unbounded case: a
client whose `now` is the moment a bundle happened to finish loading.

## 7. Divergence reporting

One callback, one report type:

```ts
export interface DivergenceReport<F extends FeatureKey = string> {
  kind: 'config-version' | 'unversioned' | 'missing-field' | 'decision-differs';
  /** The feature, when one feature is at fault. */
  key?: F;
  /** The context field, on `'missing-field'`. */
  field?: string;
  shipped?: {
    version?: string | number;
    enabled?: boolean;
    variant?: string;
    source?: 'weighted' | 'pinned' | 'sticky' | 'fallback';
  };
  local?: {
    version?: string | number;
    enabled?: boolean;
    variant?: string;
    source?: 'weighted' | 'pinned' | 'sticky' | 'fallback';
  };
  /** One sentence naming the cause and the fix. */
  message: string;
}
```

`onDivergence` is a prop on `FeatureProvider` and an option on
`hydrateFeatures` and `resolvePlan`. The library wraps every call in a
`try`/`catch` and discards what the callback throws, because an observer that
takes down a render is worse than the divergence it was reporting. Nothing in
the library reads a report back, which is the invariant
`libs/feature/src/lib/reason-is-output-only.spec.ts` already holds for `reason`
and the variants spec extends to `assignment`.

When `docs/specs/2026-09-23-feature-observation-seam.md` lands, divergence
becomes an event on that seam and `onDivergence` becomes a shorthand that
installs a one-event observer. This document defines the detection and the
report. The seam spec owns installation, the rejection handler and the guarantee
that an observer alters nothing.

An application that installs nothing still has one signal for the most common
cause. `assignment.source: 'fallback'` reports a subject the process could not
bucket, and a missing `targetingKey` is what produces it. An application that
counts the rate of `'fallback'` per feature sees a client fleet losing its
targeting key without comparing anything against anything.

## 8. Platform reach

Two host globals sit under the code that has to agree across processes.

`murmur3` calls `new TextEncoder()` at `libs/feature/src/lib/bucketing.ts:57`.
`createFeatures` calls `structuredClone` at
`libs/feature/src/lib/features.ts:93`, once per definition.

Node 20 is the declared floor (`libs/feature/package.json:29`) and provides both.
Every browser engine that a React 18 application supports provides both.

React Native is the platform this repository contains no evidence about. No
`react-native` dependency exists anywhere in the workspace, so nothing here
proves which Hermes version provides which global. Decision 10 removes the
question for the half that matters: `murmur3` walks the string and emits UTF-8
bytes itself, in about fifteen lines, and `bucketOf` then depends on nothing the
host provides. The cross-language contract the variants spec requires
(`bucketOf` with published test vectors) is better served by an explicit encoder
anyway, because a Swift or Kotlin port matches an encoder it can read against an
encoder it can read.

`structuredClone` stays in `createFeatures`, which runs in a build or in a
service. `hydrateFeatures` does not call it. It walks the document once, copies
what it validates as it validates it, and freezes the copy, which is the shape
`libs/acl/src/hydrate-policy.ts` uses at `rebuild` and `cloneNode` for a
different reason (validation and evaluation must read the same bytes, and a
getter on a caller's object can answer two reads differently). Both reasons point
at the same implementation, so `hydrateFeatures` gets it.

## 9. Ordering

The configuration distribution spec lands first. `hydrateFeatures` consumes its
envelope and its validator, and neither one can be written against a document
whose shape is not fixed.

The variants spec lands before or with this one. `resolvePlan` case 3 reads
`variants`, `variantBy` and `assignment`, and `DivergenceReport` carries
`assignment.source`.

The observation seam lands after. `onDivergence` works standalone and folds in
without a signature change to anything this document defines.

## Testing

- `hydrateFeatures` accepts a document `createFeatures` accepts, and the two
  stores resolve identically for the same context.
- A document with two invalid rows reports two errors, both named.
- A document with one invalid row builds nothing, and the caller's previous store
  is untouched.
- A document whose variant order was permuted reports a digest mismatch.
- `snapshot` carries the store's version, and carries none for a store built from
  a literal.
- `FeatureProvider` renders the shipped decisions on a version mismatch and calls
  `onDivergence` once with `kind: 'config-version'`.
- `onVersionMismatch: 're-resolve'` renders the locally resolved decisions and
  reports the same mismatch.
- A shipped decision with `assignment.source: 'weighted'` and a provider context
  missing `assignment.by` reports `kind: 'missing-field'` naming the field.
- The development diff reports `kind: 'decision-differs'` per differing key, and
  does not run under `NODE_ENV=production`.
- An `onDivergence` that throws does not fail the render.
- `resolvePlan` uses a settled entry's decision without re-running its rules:
  mutate the store's rules between `plan()` and `resolvePlan` and assert the
  settled entries are unchanged.
- `resolvePlan` on a `'deferred'` entry carrying a `decision` keeps `enabled` and
  `reason` from the entry and fills in the variant.
- `resolvePlan` on a `'deferred'` entry with no `decision` resolves the feature in
  full, and a chain deeper than two cascades correctly.
- `origin: 'render'` supplies the default `now`; `origin: 'build'` does not; an
  explicit `context.now` wins over both.
- `murmur3` produces the same digests after the inline encoder replaces
  `TextEncoder`, over the existing vectors in
  `libs/feature/src/lib/bucketing.spec.ts` plus multi-byte and surrogate-pair
  inputs.
- `hydrateFeatures` calls no host global beyond `JSON`, asserted by running it
  with `TextEncoder` and `structuredClone` deleted from `globalThis`.

## Documentation

`apps/docs/content/feature/` gains a Hydration page, listed in `_meta.ts` after
Build-time Planning, because a reader meets `plan()` there and `resolvePlan`
consumes what it produces.

Pages that change: React (`decisions` as a `DecisionSet`, `onDivergence`,
`onVersionMismatch`), Build-time Planning (`resolvePlan` and the three entry
kinds), Decisions (`snapshot`), API Reference.

`tools/repo-checks/src/doc-exports.test.ts` holds G5: no fence imports a name its
package does not export.

## Where I am guessing

- The variant-order digest. Condition 5 of the variants spec forbids a
  serialization that reorders variants, and a consumer holding only the array
  cannot tell a reorder from the author's own order. A digest over the ordered
  names is the cheapest check I found. The distribution spec may already put
  something in the envelope that covers it, and if it does, this defers to that.
- Which Hermes versions provide `TextEncoder` and `structuredClone`. I could not
  verify either from this workspace, which contains no React Native project.
  Decision 10 removes the `TextEncoder` dependency regardless, and the
  `structuredClone` claim about `hydrateFeatures` needs a real device before
  anyone writes it in a README.
- `'use-shipped'` as the default for a version mismatch. The argument above rests
  on experiments being the thing an application loses silently, and an
  application with no experiment and a tight revocation requirement is worse off.
  If the common consumer turns out to be the second kind, the default is wrong
  and the escape hatch is pointing the wrong way.
- Whether the development-only diff belongs in the library. It doubles the
  resolution work on mount in development and it is the only place this design
  reads `process.env.NODE_ENV`. A separate `@evanion/feature/devtools` entry
  would keep the core free of it, and then every application has to remember one
  more import.
- Whether `Features.version` should be a field or should live on a separate
  handle. A field on the store means a store built from a literal carries an
  `undefined` that every consumer has to check.
