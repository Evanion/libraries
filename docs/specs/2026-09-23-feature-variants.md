# @evanion/feature: named variants

Status: approved, not implemented
Extends: `docs/specs/2026-09-11-feature-toggles.md`
Tracks: https://github.com/Evanion/libraries/issues/274

A feature resolves to a boolean today. This adds a second answer: which of
several named versions a subject gets, so an application can render one of 2+
variants and run an A/B test on the difference.

The package is unpublished (`private: true`, 404 on npm), so the signature of
`createFeatures` changes without a migration path.

## Decisions

1. Local evaluation is the default, and the library optimises for it. Every
   process holds the rules and evaluates them. One library covers a backend and
   a frontend, and an offline client re-evaluates its own context without
   reaching anything. A deployment that would rather have a server evaluate and
   ship the answers passes them to `FeatureProvider`'s existing `decisions` prop
   (`react/index.tsx:49`).
2. The library evaluates the document it is handed. It owns no policy about
   where that document came from, how a caller fetched it, or how old it is.
   The caller settles all three.
3. A variant carries a name always and a value optionally. The name is what
   calling code switches on; the value is configuration a variant needs.
4. Weights sit on the feature. A rule may pin a variant when it matches, and
   may not redefine the split.
5. Variant assignment reuses `bucketOf`, seeded separately from the rollout so
   the two buckets are independent.
6. The variant first in the bucketing order is the control, and is what a
   context missing the bucketing field gets.
7. A feature that resolves off carries no variant.
8. `createFeatures` infers the variant types from the definitions, and a second
   overload takes an explicit schema for configuration loaded at runtime.
9. `PlanEntry` may carry a `decision` while `resolved` is `'deferred'`, for a
   feature whose enablement is settled and whose variant is not.
10. A context may carry prior assignments, which win over the weights. The
    library holds no storage.
11. Every variant carries an `order`, and assignment walks the variants in
    ascending `order`. The array index supplies the default, and the array's own
    sequence binds nothing.
12. `bucketOf` and everything downstream of it become a cross-language
    contract, proved by outcome fixtures that every implementation runs.
13. No capability negotiation in this package may silently downgrade
    correctness. A payload trimmed for an older consumer either keeps the fields
    the algorithm reads, or that consumer fails loudly.
14. A variant `value` round-trips through JSON.
15. Exposure tracking is out of scope, and no seam in this library can hold it.
    The application emits an exposure at the render site, reading the decision
    it already holds.

## Shape

```ts
export interface VariantSpec {
  name: string;
  /** Relative. Weights are normalised, so they need not sum to 100. */
  weight: number;
  /** Position in the bucketing walk. Defaults to the index in `variants`. */
  order?: number;
  value?: unknown;
}

export interface FeatureDefinition<F extends FeatureKey = string> {
  // ... existing fields
  variants?: readonly VariantSpec[];
  /** The context field variant assignment buckets on. Defaults to `targetingKey`. */
  variantBy?: string;
  /** The variant bucketing seed. Defaults to `${seed ?? key}:variant`. */
  variantSeed?: string;
}

export interface Rule {
  // ... existing fields
  /** Pins the variant when this rule matches. Names a configured variant. */
  variant?: string;
}
```

A worked example:

```ts
{
  key: 'checkout-cta',
  enabled: true,
  variants: [
    { name: 'control', weight: 50 },
    { name: 'blue', weight: 50, value: { label: 'Get it' } },
  ],
  rules: [
    { when: [{ field: 'group', op: 'eq', value: 'staff' }], variant: 'blue' },
    { rollout: { percent: 20 } },
  ],
}
```

Staff take the first rule and are pinned to `blue`. Everyone else is gated by
the 20% rollout, and whoever falls inside it is split 50/50.

## Naming

The field is named `variants`. LaunchDarkly and GrowthBook call them
variations, Unleash calls them variants, and the experiment literature calls
them treatments. `variant` reads correctly in both the configuration and the
decision, and OpenFeature uses it in `ResolutionDetails`.

`variantSeed` and `variantBy` mirror `seed` and `rollout.by`, so a reader who
has met rollouts already knows what they do.

## Validation

`createFeatures` validates variants where it already validates the dependency
graph, because every case below is a configuration error with no sensible
evaluation result:

- Two variants sharing a name. `DuplicateVariantError`.
- A `rule.variant` naming a variant the feature does not declare.
  `UnknownVariantError`.
- A weight that is negative, `NaN` or infinite. `FeatureConfigError`.
- Every weight zero, which leaves no variant to assign. `FeatureConfigError`.
- `variants: []`, which declares no variant to assign and which no author
  intends. `FeatureConfigError`.
- Two variants sharing an `order`, which leaves the walk undefined between
  them. `FeatureConfigError`.
- An `order` that is not a non-negative integer. `FeatureConfigError`.
- Some variants declaring `order` and others leaving it out, which mixes two
  orderings and reads as a typo either way. `FeatureConfigError`.

A single variant is legal. That is how a value flag is written: one name, one
value, everybody gets it.

## Assignment

Normalise the weights across the declared variants and lay them out as
cumulative ranges over [0, 1) in ascending `order`. The bucket selects the range
it falls in, and a bucket landing exactly on a boundary falls in the upper
band.

The seed defaults to `${definition.seed ?? key}:variant`, and the separation
from the rollout seed is the correctness point of this whole document. Hashing
the same `(key, targetingKey)` pair for both puts the members of a 20% rollout
in the lowest 20% of the variant space, so a 50/50 split hands every one of them
the control and the experiment measures nothing. MurmurHash3's finalisation
mixes the whole word, so a different seed string produces an independent bucket.
`libs/feature/src/lib/bucketing.spec.ts` gains the test that holds this.

Three vendors reached the same separation independently. Unleash hashes a
rollout with seed 0 and a variant with seed 86028157, in the node client
(`unleash-client-node/src/strategy/util.ts`), in the Rust engine
(`yggdrasil/unleash-yggdrasil/src/lib.rs:43`) and in Go
(`unleash-client-go/internal/strategies/helpers.go`). PostHog salts the rollout
check with `""` and variant selection with `"variant"`
(`posthog-python/posthog/feature_flags.py`, `_hash(key, value, salt)`, and
`rust/feature-flags/src/flags/flag_matching.rs`). GrowthBook replaced its hash
between v1 and v2 for this, and published one sentence about it
(`docs/lib/build-your-own.mdx:293`): "The original hash version (1) had a flaw
that caused bias when running experiments in parallel." That sentence and a
two-word code comment are the whole public explanation, so nobody outside
GrowthBook can check which correlation they fixed.

### The length prefix

`encodePair` writes `${seed.length}:${seed}${value}` (`bucketing.ts`), and no
vendor surveyed does anything equivalent. GrowthBook v2 hashes `seed + value`
with no separator at all, so `("ab", "c")` and `("a", "bc")` are one input
(`packages/sdk-js/src/util.ts:94`). Statsig joins the spec salt, the rule salt
and the unit id with literal dots (`statsig-io/go-sdk: evaluator.go:693`).
LaunchDarkly concatenates the flag key, the salt and the bucketing value with
dots (`go-server-sdk-evaluation/evaluator_bucketing.go`, and
`js-core/packages/shared/sdk-server/src/evaluation/Bucketer.ts`, which builds
the same string). PostHog formats `f"{key}.{bucketing_value}{salt}"`, one dot
and then nothing.

A dot is ambiguous the moment a key or a targeting value contains a dot, which
an email address and a namespaced flag key both do. The PostHog form is
ambiguous with no dot involved: flag `k`, identifier `xvariant`, salt `""`
hashes the same string as flag `k`, identifier `x`, salt `"variant"`, which
collides a rollout draw with a variant draw on the same subject. A length prefix
is unambiguous for every input. No separator character can be, because any
character chosen may itself occur in a key or a value. This is the strongest
claim the package makes, and the fixtures below are what hold it across
implementations.

### Normalisation

`createFeatures` normalises the weights, so a set summing to 90 or to 1000
covers the range and every subject reaches a variant. Three vendors leave the
gap open. Flagsmith walks cumulative bands and never renormalises, so
allocations summing to 90 leave a tenth of traffic on the control the loop
started with (`flag_engine/segments/evaluator.py`). PostHog returns no variant
at all and holds a test asserting it,
`incomplete_variant_weights_leave_the_remainder_unassigned`
(`rust/feature-flags/src/flags/v1_bucketing.rs`). GrowthBook discards the
author's weights and substitutes equal ones when the sum misses 1 by more than
a hundredth (`packages/sdk-js/src/util.ts:216`). Unleash renormalises to 1000
on the server before a document reaches any client
(`src/lib/features/feature-toggle/feature-toggle-service.ts:2432`,
`fixVariantWeights`). Unleash's answer is the one taken here, moved into
evaluation because decision 2 gives this library no server to do it on.

One property of rollout bucketing does not carry over. A percentage rollout is
monotonic, because the bucket does not depend on the percentage and raising it
only admits more buckets. Reweighting variants moves the range boundaries, so
every subject above a changed boundary is reassigned. An explicit order with
cumulative ranges bounds that: appending a variant above every existing `order`
and taking its weight from the variant currently last reassigns subjects only
between those two. The `bucketing.ts` doc comment states this alongside the
three properties it already documents.

A context carrying no usable value at `variantBy` gets the variant first in the
bucketing order, reported with `source: 'fallback'`. The feature resolved on,
so calling code needs a variant to render, and the control admits nobody to the
experiment.
`evaluateRule` already treats a rollout with no bucketing value as not matching,
for the same reason: an incomplete context must not ramp anybody in.

## Bucketing order

Assignment walks the variants in ascending `order`, and `order` defaults to the
index in `variants`. An author writing a TypeScript literal declares nothing and
gets the order they wrote, because the literal is the document. A control plane
serialising a document writes `order` on every variant, and any serializer
downstream may then permute the array.

Raw array order was the earlier decision, and it makes a JSON array's sequence
part of the assignment contract. Every store and every code generator the
document passes through has to preserve it, which no schema states and no
consumer checks. A sibling spec wanted a digest over the document for exactly
this. An explicit `order` puts the sequence in the data, a permuted array
assigns identically, and no digest is needed.

Sorting the variant names is the other serialization-proof answer, and Unleash
takes it. The server stores variants sorted by `name.localeCompare`
(`src/lib/features/feature-toggle/feature-toggle-service.ts:2432`) and the node
client walks cumulative weight in array order
(`unleash-client-node/src/variant.ts`), so authoring order is irrelevant there.
Two consequences rule it out here. Adding a variant named `aqua` to a set of
`blue` and `control` puts it first in the walk and shifts both existing bands,
so appending is safe only when the new name happens to sort last. And renaming a
variant reassigns every subject, which also breaks reconciliation against
exposure data already recorded under the old name.

Flagsmith's model is the one adopted. A variant carries a stable slug `key` and
an explicit `priority` derived from creation order
(`api/util/engine_models/context/mappers.py`), and the engine sorts on
`priority` before the cumulative walk (`flag_engine/segments/evaluator.py`). A
new variant lands last, takes a band at the top of the range, and leaves the
earlier bands alone. `order` is that `priority`, written by whoever authors the
document.

Decision 11 therefore holds the property the raw-order decision held: appending
a variant with an `order` above every existing one, and taking its weight from
the variant currently last, moves subjects only between those two. That holds
for every name. Under a name sort it holds only when the name sorts last.

## Sticky assignment

```ts
export interface EvaluationContext {
  now?: Date;
  targetingKey?: string;
  /** Prior assignments, keyed by feature. Checked before the weights. */
  stickyVariants?: Readonly<Record<string, string>>;
  [field: string]: unknown;
}
```

Reweighting a running experiment moves subjects. A rollout percentage is
monotonic and raising it only admits more buckets, so nobody who was in leaves.
Weights are boundaries, so changing one reassigns every subject above it. At
build time that lands at a deploy. In a service reading its configuration from a
database, an operator moves a slider and subjects who already saw `control` see
`blue` on their next render, which is the cohort whose exposure data is now
worthless.

Statsig and GrowthBook hold subjects still by storing each assignment in a
datastore. This library performs no I/O at evaluation and holds no storage, for
the same reason it does no network call, so it cannot do that itself.

`stickyVariants` is the seam that lets an application do it. The application
stores the assignment wherever it already keeps session state and hands it back
in the context. A name the feature does not declare falls through to the
weights, because a variant removed from the configuration must not pin a
subject to something that no longer exists, and throwing would take down a
render over stale session data.

The value is checked after a rule pin and before the weights, so an operator
pinning staff to a variant overrides a subject's history, and the history
overrides the split.

GrowthBook falls through the same way. A stored assignment naming a variation
absent from the current `meta` array is discarded and the subject re-buckets,
under the comment "invalid assignment, treat as 'no assignment found'"
(`packages/sdk-js/src/core.ts:1145-1148`). Statsig stores a whole frozen
evaluation and replays it: `fromStickyValues` rebuilds the value, the rule id,
the group name and the parameters with no check against the current ruleset, so
a group an operator deleted keeps serving until someone deactivates the whole
experiment. This fall-through matches the better of the two.

### The alternative considered: allocation discipline

LaunchDarkly stores nothing. "LaunchDarkly does not need to store a record of
which variation each context received. It recalculates the assignment on every
evaluation." It holds subjects still through where new traffic comes from.
100,000 buckets split into tracked and untracked, and an operator raising the
allocation takes the new tracked buckets from the untracked pool first, so
contexts already in the experiment keep their variation. The platform then
"writes the bucket assignments into your flag's targeting rule as a percentage
rollout" and the SDKs evaluate that rollout.

Two limits are documented. The discipline holds only while allocation
increases: 5% to 20% to 60% preserves assignments, and 20% to 5% to 60% may
reassign. It also ends when the untracked pool empties, at which point
LaunchDarkly generates a new seed and reshuffles everybody, or refuses to, on
one checkbox whose default a `Stop` button ignores.

It composes with `stickyVariants`, because the two act in different places.
Allocation discipline is a property of the bands a control plane writes, and
decision 2 puts those outside this library. `stickyVariants` is a property of
the context an application hands in, and `decide` reads it before it reads any
band. A control plane emitting bands that preserve existing members and an
application storing assignments both work, and neither one needs to know about
the other.

The recommendation: this library implements no allocation discipline. The
configuration distribution spec may adopt it as a control-plane technique, and
`stickyVariants` remains the application-side answer.

## Precedence

The existing order in `decide` is unchanged. Variant assignment hangs off the
points where a feature resolves on:

1. `enabled === false`. Off, no variant.
2. A parent resolved off. Off, no variant.
3. No rules. On, `default-on`, assignment.
4. A rule matched and carries `variant`. On, `rule-match`, pinned.
5. A rule matched without `variant`. On, `rule-match`, assignment.
6. No rule matched. Off, no variant.

Assignment at steps 3 and 5 reads, in order: `stickyVariants[key]` when it names
a declared variant, then the weights, then the control when the context carries
no bucketing value.

A feature that resolves off has no variant. Returning a control for an off
feature would make the two states indistinguishable at the call site, and the
kill switch is the one thing an operator must be able to read unambiguously.

## Result

```ts
export interface Decision<
  F extends FeatureKey = string,
  V extends string = string,
  T = unknown,
> {
  // ... existing fields
  /** Present when the feature resolved on and declares variants. */
  variant?: V;
  /** The variant's configured value, when it declares one. */
  value?: T;
  /** How the variant was chosen. Output only. */
  assignment?: {
    source: 'weighted' | 'pinned' | 'sticky' | 'fallback';
    by: string;
    /** Absent when the context did not carry the bucketing field. */
    bucket?: number;
    /** The pinning rule, on `'pinned'`. */
    rule?: string;
  };
}
```

`assignment` is explanation. Nothing in the library reads it back to decide
anything, which is the invariant
`libs/feature/src/lib/reason-is-output-only.spec.ts` holds today, and that spec
grows a case covering the new field.

The two variant parameters default to the loose types, so a `Decision` written
without them keeps the shape it has today. `Decisions<S>` maps each key to its
own narrowed `Decision`, which is what gives `useFeature('cta').variant` the
union `'control' | 'blue'`.

`Reason` gains no member. A reason explains whether a feature is on. Which
variant a subject got is a separate question, and `assignment.source` answers
it. OpenFeature's `SPLIT` reason maps onto `reason: 'rule-match'` with
`assignment.source: 'weighted'` when the provider package is written.

## Typing

Two overloads on one name, verified against TypeScript 6.0.3:

```ts
export function createFeatures<const D extends readonly FeatureDefinition[]>(
  definitions: D,
): Features<InferSchema<D>>;
export function createFeatures<
  S extends Record<keyof S, { variant: string; value?: unknown }>,
>(definitions: readonly FeatureDefinition[]): Features<S>;
```

The first overload infers, and the `const` type parameter removes the `as
const` a consumer would otherwise write. The second takes an explicit schema,
for configuration that arrives as JSON and carries no literal types to infer
from. TypeScript performs no partial type argument inference, so one signature
cannot do both, and overload resolution selects on the type-argument count.

The constraint on `S` is self-referential. `S extends Schema` where `Schema`
declares `[k: string]` rejects an `interface`
with `Index signature for type 'string' is missing`, because an interface
carries no implicit index signature. A consumer writing the obvious
`interface MyFlags` would hit that on their first attempt.

```ts
const features = createFeatures([
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
]);

features.variantOf('cta'); // 'control' | 'blue' | undefined
features.valueOf('cta'); // { readonly label: 'Get it' } | undefined
features.variantOf('nope'); // error: unknown key
```

The two overloads cover a TypeScript consumer and reach no further. Inference
needs a literal, a configuration served by a control plane carries none, and
Swift and Kotlin infer nothing at all. So the explicit schema is the path every
platform but a TypeScript literal takes, and something has to produce it.

That producer is a `schema` in the configuration envelope, describing the
context fields the rules read and, per feature, the variant names and the shape
of their values. `Matrix` carries `schema` for the same reason at
`@evanion/acl`'s `types.ts:206-210`, and a schema travelling inside the document
it describes cannot drift from it, which a schema published as a separate file
can. A generator then emits TypeScript types, Swift structs and Kotlin data
classes from one versioned source, and the second overload consumes the
TypeScript it emits.

The envelope, the schema's own shape, and whether a mobile client fetches it
separately to keep a config push small belong to the configuration distribution
document. What this document fixes is the requirement: the variant names and
value shapes are part of the published contract, and a consumer that cannot
infer them reads them from the schema.

Inferred values are literal and readonly. `createFeatures` deep-freezes every
definition it stores, so a readonly type states what the runtime provides, and
literal values make a `switch` over `valueOf` exhaustive. A consumer needing a
mutable copy clones it.

`Features<F extends FeatureKey>` becomes `Features<S>` over a schema. A plain
key union remains a valid schema, so a definition set declaring no variants
keeps the types it has today.

## Build-time planning

`plan()` can settle whether a feature is on while its variant still needs
`targetingKey`. `PlanEntry` carries a `decision` in that case, with `resolved`
at `'deferred'` and `needs` naming the outstanding field:

```ts
{
  key: 'cta',
  resolved: 'deferred',
  needs: ['targetingKey'],
  decision: { key: 'cta', enabled: true, reason: 'rule-match', rule: 'rule-a3f1' },
}
```

The alternative was a `resolved` that answers enablement alone with a separate
field for the variant. It fails in the wrong direction. A build-time pass
written as `if (entry.resolved === true) emitStatic(entry.decision)` would then
emit a static decision carrying a variant nothing computed, silently. Under
`'deferred'` the same call site skips the entry and resolves per request, and a
caller wanting the enablement shortcut reads `decision.enabled` deliberately.

The JSDoc on `PlanEntry.decision` and `PlanEntry.needs` changes accordingly: a
decision no longer implies that `resolved` is a boolean.

A feature declaring variants adds its `variantBy` field to `needs` unless a
pinned rule settles the variant without it, or the feature resolves off.

## API

`Features` gains two readers over the decision it already computes:

```ts
variantOf<K extends keyof S>(key: K, context?: EvaluationContext): S[K]['variant'] | undefined;
valueOf<K extends keyof S>(key: K, context?: EvaluationContext): S[K]['value'] | undefined;
```

## React

`@evanion/feature/react` gains `useVariant(key)`, returning `{ variant, value }`.
`useFeature` already returns the `Decision`, which now carries both, so the hook
is a reader over it. `FeatureProvider` does not change, and its `decisions` prop
still accepts decisions a server computed, for a deployment that evaluates
centrally.

## Determinism across processes

The package runs in backend services, in browsers and in native clients, and
the same subject must get the same variant in all of them at one moment. Five
things have to agree, and this document owns the first and the last:

1. The hash and the assignment path above it. Both become a published contract
   with fixtures, so a Swift or Kotlin implementation proves it agrees. A
   subject who gets `blue` on the web and `control` on iOS breaks the experiment
   silently, and nobody reads that from a dashboard.
2. The configuration version. Owned by the config distribution spec.
3. The `targetingKey` value. One process holding it and another not means one
   buckets and the other takes the control, which `assignment.source` reports
   as `'fallback'` so the divergence is readable.
4. `now`, for a feature whose rules carry a window. Clock skew near a boundary
   is bounded and unavoidable.
5. The bucketing order of `variants`. Assignment lays the weights out as
   cumulative ranges in ascending `order`, and `order` travels inside the
   document, so a serialization that permutes the array assigns identically.

A process that decides holds every variant's name, weight and `order`, because
the algorithm reads all three. The control plane selects which features and
which variants each audience receives, and decision 2 leaves that selection
outside this library.

## Conformance

`bucketOf` and everything downstream of it become a contract that every
implementation proves against shared fixtures. A fixture is a context, a
document and an expected decision. The suite is checked into this repository,
carries a version of its own, and a Swift or Kotlin port runs the same file.

A fixture proves more than a hash vector. A vector shows that two
implementations compute the same number from the same pair. It says nothing
about weight normalisation, the comparison at a band edge, the seed the variant
path builds, the sticky fall-through, or what a missing `variantBy` produces.
Two implementations that agree on every published hash vector can still hand
one subject two different variants, and a fixture over the whole decision
catches that.

Three vendors publish this. GrowthBook's `packages/sdk-js/test/cases.json`
carries about 527 cases at `specVersion` 0.8.1, covering condition evaluation,
hashing at both versions, bucket-range construction, variation choice,
namespaces, sticky bucket reads and writes, and full feature evaluation, under
the rule "All SDKs must pass 100% of these test cases"
(`docs/lib/build-your-own.mdx:14`). Unleash's `client-specification` holds 22
files behind `specifications/index.json`, each carrying a `/client/features`
response plus `tests` and `variantTests`, so a wrong hash fails on an outcome.
Flagsmith's `engine-test-data` holds 219 cases, 109 of them with a `variants`
array, and the Python engine consumes it as a git submodule pinned to a tag.

LaunchDarkly adds a second layer under the fixtures, and this package takes both
layers. It hard-codes hash vectors (flag key `hashKey`, salt `saltyA`, context
value `userKeyA` produces 0.42157587, in
`go-server-sdk-evaluation/evaluator_bucketing_testdata_test.go`) and runs
`launchdarkly/sdk-test-harness`, which recomputes the expected bucket and drives
each SDK through a small test service. Raw vectors over `murmur3` and
`bucketOf` localise a failure to the hash; the outcome fixtures cover
everything above it.

This obligation is what makes decision 1 safe. A document evaluated in four
processes across three platforms is correct only while all four agree, and the
fixtures are the only thing that checks the agreement. The obligation is
permanent. It holds for every release, and a change that moves any fixture's
expected output is a break in the assignment contract, whatever the version
number says.

### No silent downgrade

GrowthBook's control plane strips `hashVersion`, `ranges`, `meta`, `seed` and
three sibling keys from the payload for any SDK Connection that does not declare
the `bucketingV2` capability
(`packages/shared/src/sdk-versioning/sdk-payload.ts:26`,
`getPayloadAllowedKeys`). The SDK then reads `experiment.hashVersion || 1`
(`packages/sdk-js/src/core.ts:655`) and buckets on the algorithm GrowthBook's
own code comment calls "Original biased hashing algorithm". Nothing throws,
nothing warns, and that traffic runs correlated across parallel experiments.

Decision 13 forbids that shape here. A consumer that cannot read `order`, or
cannot read the variant seed, takes an error out of `createFeatures` and
produces no decision at all. Which marker a document carries, and which side
refuses, belong to the configuration distribution spec. What this document
fixes is that no negotiated payload may quietly change an assignment.

## Out of scope

Exposure tracking. Recording which variant a subject saw is what turns
assignment into an experiment, and it does not belong in `resolve()`. Decision 5
of the 2026-09-11 spec states that the store holds intent and that resolution is
computed on read and never written back; a callback fired inside `resolve()`
breaks that.

No seam in this library can hold it either, which
`docs/specs/2026-09-23-feature-observation-seam.md` § 1 establishes against the
entry points. `resolve` decides every configured feature, so a 40-feature store
resolves 40 decisions on a request that renders three, and an observer fired
from it records 37 exposures nobody saw. The React path never reaches the
library at the render site: `FeatureProvider` resolves once in a `useMemo`
(`react/index.tsx:59-65`) and `useFeature` reads a plain object (`:90-104`). A
server render and a browser hydration each decide, so two observers report two
exposures for one view. Deduplicating per subject per feature per session needs
storage this library refuses to hold, which is the refusal `stickyVariants`
already makes above.

So the application emits the exposure where it renders the variant, reading
`variant`, `assignment.source`, `assignment.bucket` and `rule` off the decision
it already holds. The observation seam covers decision diagnostics,
configuration version drift, the `toggle` audit and build-time plan evidence.

Sticky storage. `stickyVariants` reads what an application stored. Storing it
is the application's, and no entry point here writes.

## Sequencing

Issue #245 replaces the positional rule-id fallback with a content hash, and it
lands first. It rewrites `evaluate.ts:18`, the `Rule.id` JSDoc and three
documentation pages, all of which this work also touches, and `assignment.rule`
carries the id this change produces.

## Testing

- Distribution. A chi-square over synthetic keys per weight set, including an
  uneven split and a single-variant feature.
- Decorrelation. Measure the variant split inside a rollout cohort and hold it
  near the declared weights. This is the regression guard for the seed
  separation, and it fails against a shared seed.
- Stability. The same key, seed and weights produce the same variant across
  runs and processes.
- Locality. Appending a variant above every existing `order` and reducing the
  weight of the variant below it reassigns subjects only between those two.
- Order independence. A permuted `variants` array carrying explicit `order`
  assigns every synthetic key identically.
- Normalisation. Weight sets summing to 90 and to 1000 both cover the range,
  and every synthetic key reaches a variant.
- Boundaries. A bucket landing exactly on a band edge falls in the upper band,
  asserted at every edge of an uneven split.
- A pinned rule wins over the weights.
- A feature resolving off carries no variant, for each of the three off paths.
- A context missing `variantBy` gets the control with `source: 'fallback'`.
- `plan()` defers on the variant field and carries the enablement decision.
- `reason-is-output-only` covers `assignment`.
- A sticky name the feature no longer declares falls through to the weights.
- `expectTypeOf` over the inferred variant union, the inferred value type, the
  explicit schema overload, and an unknown key.
- A fixture runner over the checked-in conformance suite, plus raw vectors over
  `murmur3` and `bucketOf`. Both run on every release, and both are the
  obligation the Conformance section names.

## Documentation

`apps/docs/content/feature/` gains a Variants page, listed in `_meta.ts` after
Rollouts, because variant assignment reuses the bucketing a reader meets there.

Pages that change: Configuration (`variants`, `variantBy`, `variantSeed`,
`VariantSpec.order`, `Rule.variant`), Decisions (`variant`, `value`,
`assignment`), Build-time Planning (a deferred entry carrying a decision),
React (`useVariant`), API Reference.

The Variants page states the conformance obligation and points at the fixture
suite, because a reader porting this to Swift needs the file before they need
the prose.

`tools/repo-checks/src/doc-exports.test.ts` holds G5: no fence imports a name
its package does not export. Documentation lands with the exports, or the build
fails.
