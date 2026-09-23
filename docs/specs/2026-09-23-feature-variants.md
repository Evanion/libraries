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

1. A variant carries a name always and a value optionally. The name is what
   calling code switches on; the value is configuration a variant needs.
2. Weights sit on the feature. A rule may pin a variant when it matches, and
   may not redefine the split.
3. Variant assignment reuses `bucketOf`, seeded separately from the rollout so
   the two buckets are independent.
4. The first declared variant is the control, and is what a context missing the
   bucketing field gets.
5. A feature that resolves off carries no variant.
6. `createFeatures` infers the variant types from the definitions, and a second
   overload takes an explicit schema for configuration loaded at runtime.
7. `PlanEntry` may carry a `decision` while `resolved` is `'deferred'`, for a
   feature whose enablement is settled and whose variant is not.
8. A context may carry prior assignments, which win over the weights. The
   library holds no storage.
9. The declared order of `variants` is part of the assignment contract. No
   serialization reorders or drops a variant.
10. `bucketOf` becomes a cross-language contract with published test vectors,
    because the same subject must get the same variant on a server, in a
    browser and in a native client.
11. A variant `value` round-trips through JSON.
12. Exposure tracking is out of scope, and no seam in this library can hold it.
    The application emits an exposure at the render site, reading the decision
    it already holds.

## Shape

```ts
export interface VariantSpec {
  name: string;
  /** Relative. Weights are normalised, so they need not sum to 100. */
  weight: number;
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

A single variant is legal. That is how a value flag is written: one name, one
value, everybody gets it.

## Assignment

Normalise the weights across the declared variants and lay them out as
cumulative ranges over [0, 1) in declaration order. The bucket selects the range
it falls in.

The seed defaults to `${definition.seed ?? key}:variant`, and the separation
from the rollout seed is the correctness point of this whole document. Hashing
the same `(key, targetingKey)` pair for both puts the members of a 20% rollout
in the lowest 20% of the variant space, so a 50/50 split hands every one of them
the control and the experiment measures nothing. MurmurHash3's finalisation
mixes the whole word, so a different seed string produces an independent bucket.
`libs/feature/src/lib/bucketing.spec.ts` gains the test that holds this.

One property of rollout bucketing does not carry over. A percentage rollout is
monotonic, because the bucket does not depend on the percentage and raising it
only admits more buckets. Reweighting variants moves the range boundaries, so
every subject above a changed boundary is reassigned. Declaration order with
cumulative ranges bounds the damage: appending a variant and taking its weight
from the last declared one reassigns subjects only between those two. The
`bucketing.ts` doc comment states this alongside the three properties it
already documents.

A context carrying no usable value at `variantBy` gets the first declared
variant, reported with `source: 'fallback'`. The feature resolved on, so calling
code needs a variant to render, and the control admits nobody to the experiment.
`evaluateRule` already treats a rollout with no bucketing value as not matching,
for the same reason: an incomplete context must not ramp anybody in.

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
  { key: 'cta', enabled: true, variants: [
    { name: 'control', weight: 50 },
    { name: 'blue', weight: 50, value: { label: 'Get it' } },
  ]},
]);

features.variantOf('cta');  // 'control' | 'blue' | undefined
features.valueOf('cta');    // { readonly label: 'Get it' } | undefined
features.variantOf('nope'); // error: unknown key
```

The two overloads cover a TypeScript consumer and reach no further. Inference
needs a literal, a configuration served by a control plane carries none, and
Swift and Kotlin infer nothing at all. So the explicit schema is not a fallback
for the awkward case; it is the path every platform but a TypeScript literal
takes, and something has to produce it.

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
is a reader over it. `FeatureProvider` does not change.

## Determinism across processes

The package runs in backend services, in browsers and in native clients, and
the same subject must get the same variant in all of them at one moment. Five
things have to agree, and this document owns the first and the last:

1. The hash. `bucketOf` becomes a published contract with test vectors, so a
   Swift or Kotlin implementation proves it agrees. A subject who gets `blue`
   on the web and `control` on iOS breaks the experiment silently, and nobody
   reads that from a dashboard.
2. The configuration version. Owned by the config distribution spec.
3. The `targetingKey` value. One process holding it and another not means one
   buckets and the other takes the control, which `assignment.source` reports
   as `'fallback'` so the divergence is readable.
4. `now`, for a feature whose rules carry a window. Clock skew near a boundary
   is bounded and unavoidable.
5. The declared order of `variants`. Assignment lays the weights out as
   cumulative ranges in declaration order, so a serialization that reorders the
   array reassigns everybody. Reduced serialization may drop a variant's
   `value` and may never drop or reorder a variant.

Point 5 constrains what a public configuration can hide. A client computing its
own assignment holds every variant's name and weight, so a variant's existence
cannot be secret from a process that decides it.
`docs/specs/2026-09-16-published-policy-contracts.md` § 8 settled the same
question for `@evanion/acl`: a consumer that needs to decide something holds
the public document for it, and internal means no consumer decides it. A
feature whose payloads must not reach a client is internal, the client never
evaluates it, and a trusted process renders the result.

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

## Ordering

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
- Locality. Appending a variant and reducing the last declared weight
  reassigns subjects only between those two.
- A pinned rule wins over the weights.
- A feature resolving off carries no variant, for each of the three off paths.
- A context missing `variantBy` gets the control with `source: 'fallback'`.
- `plan()` defers on the variant field and carries the enablement decision.
- `reason-is-output-only` covers `assignment`.
- `expectTypeOf` over the inferred variant union, the inferred value type, the
  explicit schema overload, and an unknown key.

## Documentation

`apps/docs/content/feature/` gains a Variants page, listed in `_meta.ts` after
Rollouts, because variant assignment reuses the bucketing a reader meets there.

Pages that change: Configuration (`variants`, `variantBy`, `variantSeed`,
`Rule.variant`), Decisions (`variant`, `value`, `assignment`), Build-time
Planning (a deferred entry carrying a decision), React (`useVariant`), API
Reference.

`tools/repo-checks/src/doc-exports.test.ts` holds G5: no fence imports a name
its package does not export. Documentation lands with the exports, or the build
fails.
