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
conditions 2 and 3, whose decision 9 fixes that a `PlanEntry` may carry a
`decision` while `resolved` is `'deferred'`, whose decision 11 puts an explicit
`order` on every variant, and whose decision 12 is the fixture obligation § 9
below points at;
`docs/specs/2026-09-23-feature-config-distribution.md` for the envelope and its
`version`, `digest`, `schema`, `schemaVersion` and advisory `maxStale` members,
for `configDigest`, for the control plane's ownership of the identity that
travels in the document (`rule.id` and `VariantSpec.order`), for atomic reload,
the non-throwing validator and the adapter package;
`docs/specs/2026-09-23-feature-observation-seam.md`, which this document's
`onDivergence` folds into once it lands;
`docs/specs/2026-09-16-published-policy-contracts.md` § 8, which fixes that a
decision never crosses a service boundary and a document does.
Prior art: `libs/acl/src/hydrate-policy.ts` and `libs/acl/src/parse-matrix.ts`,
which draw the same line between a document an author wrote in this process and
a document a control plane served.

The package is unpublished (`libs/feature/package.json:4`, `private: true`), so
the `decisions` prop changes shape with no migration path.

## The premise: every process evaluates

`@evanion/feature` hands the rules to every process that asks a question, and
each process computes its own answer. A browser holds the document a backend
service holds and runs the same code over it. The owner fixed this for two
reasons. One library serves both sides, so an application writes one definition
and reads one decision type. An offline client re-evaluates when its context
changes, and a client holding pre-evaluated answers cannot do that.

Most of the field decided the other way. LaunchDarkly's client and mobile SDKs
receive one pre-evaluated result per flag and hold no rules, salts or segments;
`boolVariation` there is a map lookup into that payload
(`docs/research/2026-09-23-launchdarkly.md:316`, `:330`, `:864`). PostHog's
browser SDK POSTs `/flags` and receives an evaluated map. PostHog offers local
evaluation only in its server SDKs, behind a secret key
(`docs/research/2026-09-23-openfeature-posthog.md:841`, `:706`). An Unleash
frontend token reads "enabled flags for a given context", and the frontend
payload carries no rule configuration at all, so Edge or the proxy evaluates
(`docs/research/2026-09-23-unleash-flagsmith.md:1210`, `:1268`). Flagsmith's
client-side SDKs default to remote evaluation, where the SDK POSTs the identity
and traits and gets back one subject's answers
(`docs/research/2026-09-23-unleash-flagsmith.md:669`). GrowthBook is the one
product that hands a browser the full payload and lets the browser decide.

OpenFeature wrote the split into its specification. The static-context paradigm
sets the subject once globally, and its client method signatures carry no
context parameter. The dynamic-context paradigm passes the subject per
evaluation call
(`docs/research/2026-09-23-openfeature-posthog.md:320`, `:276`). A product that
serves both writes two provider classes against two SDK packages
(`docs/research/2026-09-23-openfeature-posthog.md:987`). The owner refuses that
outcome.

The premise has a price, and this document is what the price pays for.
LaunchDarkly gets cross-process agreement at no cost, because only its backend
computes an assignment and no second implementation can disagree with it. This
library takes a permanent conformance obligation: every implementation, in every
language, produces the same answer for the same document and the same context.
The outcome fixture suite that the variants spec defines is what holds that
obligation, and § 9 and the Testing section below name the cases this document
contributes to it.

Everything below follows from the premise. A client that evaluates can disagree
with the server that rendered the page it is hydrating, so this document fixes
what the client receives, what it checks and what it reports.

## Decisions

1. `hydrateFeatures` takes the serialized envelope. `createFeatures` keeps its
   definitions array, because the `const` type parameter that infers variant
   unions needs a literal and a served document has none.
2. The library evaluates the document it was handed and holds no policy about
   the document's age. `hydrateFeatures` reads no `maxStale` and no fetch
   instant. The platform binding decides when to refetch and when to reload.
3. A malformed document produces no store. `hydrateFeatures` reports every
   invalid row at once and the caller keeps whatever store it already held.
4. A hydrated decision set carries the config version that produced it, the
   instant it was resolved at, and where it came from.
5. `FeatureProvider` compares the shipped version against the version its
   `features` holds, with `!==`.
6. A version mismatch renders the shipped decisions and reports. An application
   that wants the opposite passes `onVersionMismatch: 're-resolve'`.
7. The provider names a shipped decision the client could not have reproduced,
   before React reports the DOM difference it causes.
8. `resolvePlan` honours a `PlanEntry` that carries a `decision` under
   `resolved: 'deferred'`: it takes the enablement from the entry and computes
   the variant locally.
9. `now` travels with a decision set. A set from a per-request render supplies
   the default `now` for the deferred remainder. A set from a build does not.
10. Divergence is reported through one callback with one report type, and the
    library never throws out of it and never lets it alter a decision.
11. `murmur3` encodes UTF-8 itself. `bucketOf` then calls no host global, which
    is what a Swift or Kotlin port matches against.

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

### Freshness is not this library's duty

`HydrateOptions` carries no fetch instant and `hydrateFeatures` reads no
`maxStale`. The store evaluates the document it was handed. A store that refused
to answer, or answered differently, because a number in the envelope said the
document was old would give an application two failure modes for one
configuration and no way to tell them apart at the call site.

The platform binding in `@evanion/feature-source` owns the refetch schedule and
the decision to reload. It performed the fetch, so it knows the fetch instant,
and the envelope's `maxStale` reaches it as the advisory value the distribution
spec § 1 makes it. The transport every product in the research uses for this is
a conditional request. LaunchDarkly's server-side
polling requestor sends `if-none-match` with the cached ETag and honours 304
(`docs/research/2026-09-23-launchdarkly.md:320`, `:411-420`). Unleash polls with
an ETag and 304, and adds delta polling and an SSE stream of the config itself
(`docs/research/2026-09-23-unleash-flagsmith.md:597-605`, `:589`, `:595`).
PostHog serves flag definitions with ETag and 304 on a 30-second default poll
(`docs/research/2026-09-23-openfeature-posthog.md:897-906`, `:706`).

### What the wire format check covers

The distribution spec owns the envelope and its validator. This document fixes
what the consumer requires of that validator:

- It reports every invalid row, keyed by the row's `key` when the row has a
  readable one and by its index when it does not. One error per call would make
  an operator fix a broken push one row at a time.
- When the envelope carries a `digest`, `hydrateFeatures` recomputes
  `configDigest` over the document and reports a `digest-mismatch` issue when
  the two differ (`docs/specs/2026-09-23-feature-config-distribution.md` § 2).
  One comparison covers every value the document carries.
- It runs the graph and variant validation `createFeatures` already runs
  (`libs/feature/src/lib/features.ts:95`, and the eight variant cases in the
  variants spec's Validation section, three of which are `order` cases), as
  reported errors. A served document reaching a consumer with a duplicate or
  partial `order` is the case that matters most here, because that consumer
  buckets on it.

### The per-feature variant-order digest is dropped

An earlier draft of this document proposed a digest over each feature's ordered
variant names, on the grounds that a consumer holding only the array cannot tell
a reorder from the author's own order. The variants spec removed the premise
that check rested on.

`VariantSpec` now carries `order`, an integer defaulting to the variant's index
in `variants`, and assignment walks the variants in ascending `order` (variants
decision 11 and its Bucketing order section). A control plane serialising a
document writes `order` on every variant, so the array's own sequence binds
nothing and a permuted array assigns identically. Validation rejects a duplicate
`order`, an `order` that is not a non-negative integer, and a document where
some variants carry one and others do not, so a consumer never reads a
half-ordered array and guesses.

The check this document needed was a check that nothing reordered the array in
transit. A reordered array now changes no answer, so the check has nothing left
to detect and no envelope member carries a per-feature variant digest. The
document-wide `digest` stays where the distribution spec put it, holding the two
duties it earns on its own: two processes that computed it separately have
proved they hold the same bytes, and the digest catches a permuted `rules`
array, which still renames every rule declaring no explicit `id` until issue
#245 lands.

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

The comparison relies on one of the two duties the distribution spec's
`configDigest` keeps, that two processes computing it from documents they
fetched separately have proved they hold the same bytes
(`docs/specs/2026-09-23-feature-config-distribution.md` § 2). A publisher with no
version scheme sets `version` to the digest, and the `!==` above then means byte
equality. The digest's other duty, catching a permuted `rules` array that
renames every rule declaring no explicit `id`, belongs to that spec until issue
#245 replaces the positional fallback, and nothing in this document reads it.

Four outcomes:

| shipped   | store               | outcome                              |
| --------- | ------------------- | ------------------------------------ |
| a version | the same version    | agreed, no report                    |
| a version | a different version | `kind: 'config-version'`, reported   |
| a version | none                | `kind: 'unversioned'`, reported      |
| none      | any                 | `kind: 'unversioned'`, reported once |

Every one of the four renders the shipped decisions.

### Why a mismatch renders the shipped decisions

The server already rendered HTML from the shipped decisions, and the subject is
looking at it. A client that re-resolves produces a third answer, one the server
never rendered and one no exposure record names. The variant the analytics
pipeline recorded is the shipped one, because the server recorded it when it
resolved. A client that quietly renders a different variant makes every
experiment result wrong by an amount nobody can measure from the data.

Two products in the research built machinery against the neighbouring failure,
which is evidence that the failure is real. GrowthBook and Statsig both emit an
exposure at evaluation, so a server render and a browser hydration each produce
one. GrowthBook answers with a deferred tracking bridge: the documented pattern
sets no `trackingCallback` in the constructor, queues the calls, and fires them
when `setTrackingCallback` runs, so one server-rendered view produces one event
(`docs/research/2026-09-23-growthbook-statsig.md:599`, `:638`). Statsig answers
with a client SDK that drops every event in a Node environment,
`loggingEnabled` defaulting to `'browser-only'`, and that default is the only
thing preventing a double count there
(`docs/research/2026-09-23-growthbook-statsig.md:678`, `:915`).

PostHog built no such guard. Its browser SDK dedupes `$feature_flag_called` on
`(flag key, String(value))` in localStorage, its Node SDK dedupes on a different
key in a per-`distinctId` set in process memory, and neither suppresses the
other, so one page view emits two exposures
(`docs/research/2026-09-23-openfeature-posthog.md:725`, `:727`, `:728`,
`:1044`).

A double count is at least visible to an analyst reading the events. A client
that silently resolves a different variant writes nothing at all, and the
shipped exposure then names a variant the subject never saw.

The provider also cannot tell which side is stale. A version mismatch means the
client's envelope and the server's envelope differ, and the client's copy is the
older one as often as it is the newer one. A client that re-resolves picks its
own copy on the grounds that it is local, which is not a reason.

The cost is a kill switch that does not take effect until the subject loads the
page again. That cost is real and this document does not argue it away. An
operator who turns a feature off during a session wants it off, and a page
holding shipped decisions renders it for the life of that page. The platform
binding shortens the other half of that latency, because it decides how often
the client refetches the document, and this library decides nothing about it
(decision 2).

`onVersionMismatch: 're-resolve'` is the escape hatch, and an application that
runs no experiments and cares about revocation latency sets it. The default is
`'use-shipped'`, because a wrong experiment result is the failure that produces
no error, no warning and no way to notice after the fact, and a stale kill switch
produces a complaint within minutes.

## 4. The SSR mismatch case

A server resolves with `targetingKey: 'u-7741'` and assigns `blue`. The client
mounts a provider whose context carries no `targetingKey`, so the client would
assign the control (the variants spec: a context carrying no usable value at
`variantBy` gets the variant first in the bucketing order, with
`source: 'fallback'`). React reports a text content difference between two
button labels. The message names the DOM node and says nothing about
`targetingKey`.

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
`libs/feature/src/lib/types.ts:176-184`, and decision 9 of the variants spec):

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

Case 3 needs the assignment inputs and nothing else: the feature's `variants`
with the `order` and `weight` on each, its `variantBy` field out of the client
context, its `variantSeed`, and `context.stickyVariants`. All four are in the
store the client hydrated, which is what decision 1 of the variants spec
guarantees a deciding process holds.

The cascade still runs in dependency order, because a deferred parent puts its
`needs` on its dependants (`libs/feature/src/lib/evaluate.ts:243-245`) and a
dependant resolved before its parent would read an empty parent map.

When an entry's `needs` names a field the client context still lacks,
`resolvePlan` reports `kind: 'missing-field'` naming the feature and the field,
then falls back the way the engine already does. A rollout with no bucketing
value does not match (`libs/feature/src/lib/evaluate.ts:66-75`) and a variant with
no bucketing value takes the variant first in the bucketing order.

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
proves which Hermes version provides which global. Decision 11 removes the
question for the half that matters: `murmur3` walks the string and emits UTF-8
bytes itself, in about fifteen lines, and `bucketOf` then calls nothing the host
provides.

Decision 11 now answers two needs with one change. `bucketOf` reaches any
JavaScript host, Hermes included, because it asks that host for nothing beyond
arithmetic and string indexing. A Swift or Kotlin port also matches an encoder
it can read against an encoder it can read, which is what the premise's
conformance obligation requires of every implementation. The distribution spec
endorses the same change and states the sharper version of the second point: a
call to a host global specifies "whatever this runtime does", and the runtimes
disagree on a lone surrogate.

`structuredClone` stays in `createFeatures`, which runs in a build or in a
service. `hydrateFeatures` does not call it. It walks the document once, copies
what it validates as it validates it, and freezes the copy, which is the shape
`libs/acl/src/hydrate-policy.ts` uses at `rebuild` and `cloneNode` for a
different reason (validation and evaluation must read the same bytes, and a
getter on a caller's object can answer two reads differently). Both reasons point
at the same implementation, so `hydrateFeatures` gets it.

## 9. What holds the agreement conditions

The variants spec lists the things that have to agree across processes.
Condition 2, the configuration version, is the comparison in § 3 of this
document. Conditions 1 and 3 need an artifact that sits outside any one package,
and the variants spec's decision 12 defines it.

Condition 1 is the hash and the assignment path above it. The variants spec
commits both to shared outcome fixtures. A fixture carries a context, a document
and an expected decision; the suite is checked into this repository under a
version of its own; a Swift or Kotlin port runs the same file. Three vendors
publish a suite of this shape. GrowthBook's `packages/sdk-js/test/cases.json`
holds about 527 cases at `specVersion` 0.8.1, under the rule "All SDKs must pass
100% of these test cases" (`docs/research/2026-09-23-growthbook-statsig.md:166`,
`:168`). Unleash's `client-specification` holds 22 files, each a
`/client/features` state plus `tests` and `variantTests` asserting outcomes for
given contexts. Flagsmith's `engine-test-data` holds 219 cases, 109 of them
carrying a `variants` array, consumed as a submodule pinned to a tag
(`docs/research/2026-09-23-unleash-flagsmith.md:312`, `:436-440`, `:1316`).

An outcome fixture covers more of this document's surface than a hash vector
does. A vector proves `murmur3` agrees on one pair of inputs. A case proves the
served document parsed the same way, the cascade ran in the same order, the
bands came out at the same edges and the subject got the same variant. The
variants spec keeps raw vectors under the fixtures as a second layer, on
LaunchDarkly's model, and those vectors localise a failure to the hash when a
case fails.

Condition 3 is the `targetingKey` value. A fixture states the context it
evaluates against, so a case whose context carries no `variantBy` field fixes
what every implementation does without one, which is the variant first in the
bucketing order, reported as `assignment.source: 'fallback'` (variants decision
6). The two checks in § 4 report the divergence when a running client hits it,
and the fixtures are what make the server's answer and the client's answer
comparable at all.

## 10. Ordering

The configuration distribution spec lands first. `hydrateFeatures` consumes its
envelope and its validator, and neither one can be written against a document
whose shape is not fixed.

The variants spec lands before or with this one. `resolvePlan` case 3 reads
`variants`, their `order`, `variantBy` and `assignment`, and `DivergenceReport`
carries `assignment.source`.

The observation seam lands after. `onDivergence` works standalone and folds in
without a signature change to anything this document defines.

## Testing

- `hydrateFeatures` accepts a document `createFeatures` accepts, and the two
  stores resolve identically for the same context.
- A document with two invalid rows reports two errors, both named.
- A document with one invalid row builds nothing, and the caller's previous store
  is untouched.
- A document whose bytes no longer match the `digest` it carries reports a
  `digest-mismatch` issue and builds no store.
- A document whose `variants` arrays were permuted, with every `order` left
  intact, hydrates and resolves every subject to the variant the unpermuted
  document resolves.
- A document whose variants carry no `order` at all hydrates, and the index
  default reproduces the authored walk.
- A document with a duplicate `order`, a fractional `order`, or an `order` on
  some variants of a feature and not others builds no store and reports the
  feature.
- `hydrateFeatures` ignores `maxStale`: a store hydrated from a document
  carrying `maxStale: 1` answers an hour later what it answered at hydration.
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

### What goes into the shared fixture suite

The cases above that assert an outcome for a document and a context belong in
the cross-implementation suite § 9 names, because a Swift or Kotlin
implementation has to reproduce them. Four of them:

- `hydrateFeatures` over a served document resolves what `createFeatures` over
  the same definitions resolves, per case context.
- A permuted `variants` array carrying explicit `order` values resolves every
  subject to the same variant.
- A context carrying no `variantBy` field resolves to the variant first in the
  bucketing order, with `assignment.source: 'fallback'`.
- A `'deferred'` plan entry carrying a `decision` keeps that entry's `enabled`
  and `reason` and computes only the variant.

The rest stay in this package's own suite. `onDivergence` semantics, the
`NODE_ENV` guard on the development diff, the React render path and the
`globalThis` deletion test all assert JavaScript behaviour that no port
reproduces.

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

- Which Hermes versions provide `TextEncoder` and `structuredClone`. I could not
  verify either from this workspace, which contains no React Native project.
  Decision 11 removes the `TextEncoder` dependency regardless, and the
  `structuredClone` claim about `hydrateFeatures` needs a real device before
  anyone writes it in a README.
- `'use-shipped'` as the default for a version mismatch. The research narrowed
  this one. Two products built machinery against a server render and a browser
  hydration disagreeing about an exposure, and the one that built none emits two
  events per view, so the failure the default protects is a failure the field
  has met. What remains open is the population: an application running no
  experiment and holding a tight revocation requirement is worse off under this
  default, and it sets `onVersionMismatch: 're-resolve'` to get what it wants.
- Whether the development-only diff belongs in the library. It doubles the
  resolution work on mount in development and it is the only place this design
  reads `process.env.NODE_ENV`. A separate `@evanion/feature/devtools` entry
  would keep the core free of it, and then every application has to remember one
  more import.
- Whether `Features.version` should be a field or should live on a separate
  handle. A field on the store means a store built from a literal carries an
  `undefined` that every consumer has to check.
