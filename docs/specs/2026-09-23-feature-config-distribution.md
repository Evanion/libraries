# @evanion/feature: configuration distribution

Status: proposed
Packages: `@evanion/feature` gains four exports (`serializeConfig`,
`parseFeatureConfig`, `validateConfig`, `configDigest`), five envelope types
(`FeatureConfig`, `FeatureSchema`, `ContextSchema`, `FeatureShape`,
`SerializedInstant`), three result types (`ValidationResult`, `ConfigIssue`,
`ReloadResult`), six envelope members (`version`, `digest`, `schema`,
`schemaVersion`, `maxStale`, `features`), one `FeatureDefinition` field
(`visibility`), two `Features` members (`reload`, `version`), one `Reason`
member (`stale-config`) and two construction errors
(`MissingFreshnessBudgetError`, `InvalidFreshnessError`).
`@evanion/feature/react` re-exports the types and changes no runtime. A new
sibling package `@evanion/feature-source` holds every adapter that reads
configuration from somewhere, and § 10 argues why the core holds none.
Depends on: `docs/specs/2026-09-11-feature-toggles.md` (decision 5, the store
holds intent and resolution is never written back, which § 7 is bounded by; its
"Static and runtime evaluation" split, which § 10 keeps; its OpenFeature section,
which § 3 maps `stale-config` onto);
`docs/specs/2026-09-23-feature-variants.md` (its "Determinism across processes"
point 5, which § 4 obeys, and its "Typing" section, which states the requirement
§ 5 and § 6 answer);
`docs/specs/2026-09-16-published-policy-contracts.md` (decisions 2 to 9 and 13
to 16, and §§ 1, 4, 5, 8, 9 and 13, which this document ports one at a time and
diverges from twice, at § 3 and § 8);
`libs/feature/src/lib/types.ts` (`Instant` at `:16`, the round-trip defect § 9
repairs; `FeatureDefinition` at `:78-104`, which gains one field; `Reason` at
`:117-127`, which gains one member; `Decision` at `:159-171`);
`libs/feature/src/lib/features.ts` (`createFeatures` at `:86-94`, whose clone
and freeze § 7 reuses; `resolve` at `:109-124`, which reads the store once per
call; `toggle` at `:142-168`, the only writer today and the one § 7 has to
reconcile with a reload);
`libs/feature/src/lib/errors.ts` (`:3-11`, whose docblock states that every
error is raised by `createFeatures` and that `resolve`, `plan` and `toggle` are
total, which § 8 keeps true);
`libs/feature/src/lib/graph.ts` (`:38`, `:46` and `:62`, the three throws § 8
converts into issues);
`libs/feature/src/lib/conditions.ts` (`toEpoch` at `:18-22`, which already
accepts all three `Instant` forms);
`libs/acl/src/types.ts` (`Matrix` at `:220-234`, the envelope § 1 copies;
`FieldType` at `:157-171` and `ObjectSchema` at `:180-183`, the vocabulary § 5
reuses for context fields; `MatrixSchema` at `:204-207`);
`libs/acl/src/serialize.ts` (`isPublic` at `:50-52`, `published` at `:55-59`,
`projectSchema` at `:75-92` and the reduced branch at `:159-180`, which § 4
ports);
`libs/acl/src/hydrate-policy.ts` (`expiryOf` at `:197-215` and the `stale` check
at `:484-491`, which § 3 ports and then inverts);
`libs/acl/src/canonical.ts` (`:17-25`, the sorted-key text § 2 derives the
digest from and § 9 derives the `Date` rule from);
`libs/acl/src/parse-matrix.ts` (`:43-49`, the foreign-document entry point § 8
names itself after and diverges from);
`apps/shop-api/src/acl/policy.controller.ts` (`:36-40`, the only endpoint in
this repository that publishes a policy document, and the shape § 10 copies);
`nx.json:151` (`"projects": ["libs/*"]`, so a directory under `libs/` publishes
and the sibling package of § 10 needs no configuration edit).
Not yet written, and cross-referenced here so this document does not design
them: `docs/specs/2026-09-23-feature-hydration.md` owns hydrating a config or a
decision into a running client, the decision-version check at hydration and the
SSR mismatch; `docs/specs/2026-09-23-feature-observation-seam.md` owns the
observation seam and exposure tracking.
Prior art: HTTP conditional requests, whose `ETag` is an opaque validator a
client compares for equality and never orders, which is what § 2 makes `version`;
JSON Schema 2020-12 and the quicktype and openapi-generator emitters, which § 5
recommends for variant value shapes; Unleash's client-spec test suite, which
proves a non-JavaScript SDK agrees with the reference, and which the variants
spec already commits `bucketOf` to.

## The problem

`createFeatures` at `features.ts:86-94` takes an array of definitions, clones
and deep-freezes each one, and builds a graph that throws on a duplicate key, an
unknown dependency or a cycle (`graph.ts:38`, `:46`, `:62`). That is the right
shape for a literal a TypeScript build compiles. It is the wrong shape for every
other place this package is about to run.

A backend service reads its features from a Postgres table and polls it. A web
client fetches them over HTTP. A native client caches them on disk between
launches. A control plane serves all three. Four things break at once.

A service whose row changed has no way to swap it. The only writer is `toggle`
at `features.ts:142-168`, which replaces one entry's `enabled` and leaves the
rest of the store alone.

A bad row takes the service down. `buildGraph` throws, `createFeatures` throws,
and a poller that calls it on an interval turns one malformed row into a crash
loop.

Two processes cannot tell whether they agree. The configuration carries no
version, so a browser on last week's bundle and a server on this morning's
database row both answer confidently and differently, and nothing anywhere
notices. The configuration also carries no freshness bound, so a client that
lost its poller keeps a killed feature on forever.

The configuration does not round-trip through JSON. `Instant` is
`string | number | Date` at `types.ts:16`, and a `Date` in a window condition
comes back as a string, so a digest over the two forms disagrees and two
processes holding one configuration compute two versions of it.

`@evanion/acl` answered all four for policy documents, and
`docs/specs/2026-09-16-published-policy-contracts.md` is the argument. This
document ports those answers. Two of them do not survive the port, and § 3 and
§ 8 say why.

## Decisions

1. Configuration travels as an envelope, `FeatureConfig`, with the members
   `version`, `digest`, `schema`, `schemaVersion`, `maxStale` and `features`. It
   mirrors `Matrix` at `libs/acl/src/types.ts:220-234`, with `features` in place
   of `permissions` and two members added. § 1.
2. `version` is an opaque `string | number` a consumer compares with `!==` and
   never orders. `configDigest(config)` derives one from the canonical text of
   the serialized document, for a publisher with no version scheme of its own.
   The envelope also carries `digest`, separate from `version`, and a holder
   that finds one verifies the document against it. One document-wide digest
   covers variant order, rule order and every value, so this document carries no
   per-feature variant digest. `docs/specs/2026-09-23-feature-hydration.md`
   proposes the variant-specific form, and § 2 records the disagreement. § 2.
3. `maxStale` is a duration in milliseconds the owner sets as a ceiling. A
   holder reports its last successful freshness validation as `fetchedAt` and
   may shorten the bound locally. Past `fetchedAt + min(the two)` every feature
   answers `{ enabled: false, reason: 'stale-config' }`. § 3.
4. **Expiry turns features off.** `@evanion/acl` expires into a refusal and
   accepts that a stale holder over-shows, because the owner re-enforces on
   every call. No second party re-enforces a feature decision, so this package
   expires into the off state, which is the direction an operator's kill switch
   points. § 3.
5. `Reason` gains `'stale-config'`, alongside the five members `decide` emits
   today. A feature that answers it carries no `variant` and no `value`, under
   the variants spec's rule that a feature resolving off carries no variant.
   § 3.
6. Visibility is a field on the definition: `visibility?: 'public' | 'internal'`.
   An absent `visibility` is internal. § 4.
7. `serializeConfig(features, mode)` takes `'full'` or `'reduced'`. `full` emits
   the stored document with `visibility` intact. `reduced` keeps the public
   definitions, drops `visibility` from each kept copy, and edits nothing else.
   § 4.
8. **Reduction removes whole features and never edits one.** A kept feature's
   `variants` array travels entire: every name, every weight, every `value`, in
   declaration order. The variants spec permits reduction to drop a `value`.
   This document declines that permission, and § 4 is the argument. A feature
   whose payloads must not reach a client is internal, and the client does not
   evaluate it.
9. The `schema` describes the context fields rules read and, per feature, the
   variant names and the shape of their values. It uses two vocabularies. A
   context field is a flat `FieldType` string, ported from
   `libs/acl/src/types.ts:157-171`. A variant value shape is a JSON Schema
   2020-12 object, fenced to a subset. § 5.
10. A schema is immutable at its `schemaVersion`. The envelope may carry
    `schema` inline or carry `schemaVersion` alone, and a holder that already
    has the schema at that version fetches nothing. § 6.
11. `features.reload(config)` validates a candidate whole, installs it by
    swapping one reference, and otherwise keeps the current configuration
    untouched and reports why. It replaces intent and writes no resolved value.
    § 7.
12. A reload discards a local `toggle`. The store's truth is the configuration
    source, and a toggle is a local write against it. § 7.
13. `createFeatures` keeps throwing. `parseFeatureConfig(config, options)` is
    the reload-shaped entry point and returns a result. Both call one checker,
    `validateConfig`. § 8.
14. A serialized configuration carries an `Instant` as an ISO 8601 string or as
    epoch milliseconds, never as a `Date`. `serializeConfig` converts. § 9.
15. Every adapter that reads configuration from a database, an HTTP endpoint or
    a disk cache lives in `@evanion/feature-source`. The core imports no driver,
    opens no socket and starts no timer. § 10.
16. **No endpoint ever answers which variant a subject gets.** A control plane
    serves a version probe and the two documents a changed version points at,
    the configuration and the schema. § 10.

## 1. The envelope

```ts
export interface FeatureConfig<F extends FeatureKey = string> {
  /** Compared with `!==`. Opaque and unordered. § 2. */
  readonly version?: string | number;
  /** `configDigest` of this document, for a holder that verifies it. § 2. */
  readonly digest?: string;
  /** The typing contract. Inline, or named by `schemaVersion` alone. § 5, § 6. */
  readonly schema?: FeatureSchema;
  /** The schema's own version. Immutable at a value. § 6. */
  readonly schemaVersion?: string;
  /** The freshness ceiling in milliseconds. § 3. */
  readonly maxStale?: number;
  readonly features: readonly FeatureDefinition<F>[];
}
```

`Matrix` at `libs/acl/src/types.ts:220-234` carries `version`, `schema`,
`maxStale` and `permissions`, and its docblock states why there is no bare-array
form: a foreign producer emitting JSON states the version and the schema, and one
document crosses a boundary without a wrapper assembled at the call site. Both
reasons hold here word for word. Two members answer questions `@evanion/acl`
never had. `schemaVersion` is § 6, and `digest` is the second half of § 2.

The envelope states no validity window. It carries no `notBefore` and no
`notAfter`, and `maxStale` is measured from the holder's own `fetchedAt` and
never from an instant the author wrote down. A document that expired on the
author's clock would put two clocks in one decision, and the base spec's Time
section already settles that `now` is injected at the call and read from no
ambient source. A feature that should stop at an instant says so in a
`WindowCondition`, which is a rule the engine evaluates and explains, not a
property of the transport.

`createFeatures` keeps its array signature. A literal has no version, no schema
and no freshness claim, and a TypeScript author writing four flags in a file
owes none of them. `createFeatures` gains one overload taking a `FeatureConfig`,
so a process that starts from a document its poller already fetched does not
unwrap it by hand.

## 2. `version`, and what a consumer does with two of them

`version` is opaque. A consumer compares two with `!==` and does nothing else
with them, which is exactly the contract `libs/acl/src/types.ts:221` already
states and `apps/shop-api/src/acl/policy.controller.ts:9-10` already documents
at the one endpoint that publishes a policy.

Opacity is the whole design, and monotonicity is what it refuses. A consumer
that could order two versions would be tempted to act on the order, and every
action available to it is wrong. Declining a lower version blocks a rollback,
which is the operation an operator reaches for at 3am. Accepting only a higher
version breaks a control plane that serves two shards whose counters diverged.
A consumer holding a version different from the one it wants has one move, which
is to fetch the document that version names.

`string | number`, following `types.ts:221`, so a publisher with a monotonic
counter uses one and a publisher composing several inputs uses a string.
`'flags@41+overrides@7'` is legal, and § 10 of the policy-contracts document
works out why a composite has to be a string: summing two components collides,
and taking the maximum hides a rollback on the other one.

A publisher with no version scheme calls `configDigest`:

```ts
export function configDigest(config: FeatureConfig): string;
```

It returns a hex digest over the canonical text of the serialized document.
`libs/acl/src/canonical.ts:17-25` already defines that text: object keys sorted,
array order preserved, `undefined` properties dropped, a `Date` written as
`JSON.stringify` writes it. Its docblock gives the reason, and it is the reason
here too. Two documents differing in key order or whitespace state one
configuration, and a digest over raw bytes would change when nothing did. The
function is small enough to port. `@evanion/feature` depends on `@evanion/acl`
in neither direction.

A digest states one useful thing beyond difference. Two processes computing one
digest from documents they fetched separately have proved they hold the same
configuration, which is what the variants spec's determinism point 2 asks for.
`configDigest` runs over the serialized form, so § 9's `Date` rule is what makes
that comparison hold across a JSON hop.

### `digest` is a second member, and it covers variant order

`version` is opaque, so a publisher may set `'flags@41'` and a holder learns
nothing from it about the bytes. The envelope therefore carries a second member:

```ts
readonly digest?: string;
```

`digest` is always `configDigest` of the document that carries it. A holder that
finds one recomputes it and refuses a document that disagrees, which
`validateConfig` reports as a `digest-mismatch` issue. A publisher that has no
version scheme sets both members to the digest, and a publisher with a counter
sets `version` to the counter and `digest` to the digest.

That closes the variant-order question, which the variants spec's determinism
point 5 raises and `docs/specs/2026-09-23-feature-hydration.md` proposes a
separate answer to. Its proposal is a digest over the ordered variant names,
carried in the envelope, so a hydrating client verifies the array it was handed.
This document disagrees with the scope and agrees with the need.

The threat is real and it is a re-serialization, not a malicious producer. A
control plane rebuilding a feature's variants from a `variants` table with no
`ORDER BY` hands back the same names in a different order, and a client that
computed its own assignment from that array assigns every subject differently
with no error anywhere.

A variant-name digest detects that and nothing else, and it is not the only
order the document depends on. `ruleId` at
`libs/feature/src/lib/evaluate.ts:17-19` falls back to the rule's index as `#0`,
`#1`, so a reordered `rules` array renames every rule that declared no `id`, and
`Decision.rule`, `RuleOutcome.rule` and the variants spec's `assignment.rule`
all carry the renamed value. Issue #245 replaces that fallback with a content
hash, per the variants spec's Ordering section, and until it lands the rule order
is load-bearing too.

`configDigest` covers both, because `canonical` preserves array order by
construction and states the reason at `libs/acl/src/canonical.ts:8-11`. So a
holder verifying `digest` has verified variant order, rule order and every value
in one comparison, and a second per-feature digest would add a field, a second
producer obligation and a second thing to keep in sync, for a subset of what the
first already proves. The hydration spec's client performs the same check against
`digest`, and this document asks the two specs to reconcile on that member.

## 3. `maxStale`, and what a stale feature answers

§ 13 of the policy-contracts document settles four things about a freshness
budget, and three of them port unchanged.

It is measured from the holder's last successful freshness validation, which the
holder reports as `fetchedAt`. Not from the moment a holder noticed a mismatch.
A budget starting at detection bounds nothing when detection itself fails, and
detection is the holder's own code: a poller that quietly stopped, a probe
answering 200 from a cache, a deploy that dropped the timer. Such a holder
believes it is fresh and starts no clock. A successful validation is a response
that confirms a version, whether or not the version changed, so a matching
version moves the instant as much as a completed refetch does.

The owner sets it as a ceiling. A holder may shorten it and may not extend it,
so the effective budget is `min(config.maxStale, options.maxStale)`. The owner
knows how fast an operator has to be able to kill a feature. A holder choosing
its own bound optimises for its own availability, which is the wrong party's
interest.

A holder that reports no `fetchedAt` makes no freshness claim and no budget
applies, which is every `createFeatures` call in the repository today. A holder
that reports one against a document carrying no `maxStale` is refused at
construction with `MissingFreshnessBudgetError`, and a `fetchedAt` or a
`maxStale` that does not parse is refused with `InvalidFreshnessError`.
`libs/acl/src/hydrate-policy.ts:197-215` is that function, and this is a port of
it. An earlier ACL draft read an absent `maxStale` as a budget of zero, which
expires at the instant after `fetchedAt` and refuses for the life of the
process. The refusal is loud, it fires once, and it names the field the owner
owes.

The check needs no timer. The expiry instant is
`fetchedAt + min(the two)`, constant for the life of the store, and `resolve`
already settles `now` once per call at `features.ts:104-107`. Expiry is
`settled > expiresAt` against that same settled instant, so evaluation stays
pure and total. A `now` that does not parse is NaN, the comparison is false, and
the call proceeds as an unbudgeted store does today.

### Where this diverges from `@evanion/acl`

A holder past its budget in `@evanion/acl` answers
`{ allowed: false, reason: 'stale-contract' }` for every key, and § 13's security
argument accepts the window before expiry because a stale contract is
stale-permissive against an owner that re-decides on every call. The consumer's
answer was never the boundary.

Nothing re-decides a feature. A browser that resolves `checkout-v2` on and
renders the new checkout has made the decision, and the server it calls has no
second copy of that rule to disagree with. The variants spec's determinism
section already names the consequence: a subject who gets `blue` on the web and
`control` on iOS breaks an experiment silently.

So the asymmetry the base spec cares about decides the expiry behaviour. A stale
rollout that keeps ramping at yesterday's percentage is a measurement error. A
stale kill switch that keeps a feature on after an operator killed it is the
incident the kill switch exists to stop, and
`docs/specs/2026-09-11-feature-toggles.md` states in its Result section that
`enabled === false` short-circuits before rules run, because the kill switch is
the one signal an operator must be able to read unambiguously.

Expiry therefore turns features off:

```ts
{ key: 'checkout-v2', enabled: false, reason: 'stale-config' }
```

Every feature the document carries, and every key it does not, because a
document past its budget carries no claim about the present and that includes
its claim about which features exist. The check runs ahead of the graph walk in
`resolve` at `features.ts:115-119`, so no dependency ordering runs against a
document with nothing to say.

`Reason` gains `'stale-config'`. Neither existing off reason carries the
meaning. `explicitly-off` says an operator set `enabled` to false, which a UI
renders as a deliberate act nobody performed. `no-rule-matched` says the rules
ran and none passed, and it carries a per-rule breakdown that would be empty
forever. `stale-config` says the document this would have been decided against
is too old to trust, and its remedy is a configuration fetch, which is a
different action by a different part of the holder.

The decision carries no `variant` and no `value`, under the variants spec's rule
that a feature resolving off carries no variant. A control returned for an
expired document would make expiry indistinguishable from a live control
assignment at the call site.

`plan()` answers `stale-config` too, with `resolved: false` and an empty `needs`.
A build-time pass reading an expired document has nothing to defer.

### A frozen build decision is not covered by this budget

`freezeTimeAtBuild` at `libs/feature/src/lib/types.ts:97-103` lets one feature
opt in to having its `now`-dependent rules resolved during `plan()`, and the
field's docblock says why it is off by default: whether a date window may be
frozen into a build is a deploy-cadence decision belonging to whoever owns the
feature. `docs/specs/2026-09-23-feature-hydration.md` carries a shipped decision
set whose `now` records `origin: 'render' | 'build'`, and the `'build'` case is
that opt-in.

`maxStale` does not reach it, and the reason is that the two bound different
things. `maxStale` bounds how long a holder may keep deciding from a document.
A frozen decision has already been decided, so no document is deciding and there
is nothing for the budget to expire. The base spec's "store holds intent" section
names what a frozen decision is: a snapshot with known staleness, outside the
store, a cache that is never read back as truth. Bounding that snapshot is the
hydration spec's, and the version it inherits is the `version` of the document
`plan()` read, which is what a hydrating client compares.

One rule this document does own. A `plan()` run against a store that is past its
budget produces `stale-config` entries and freezes nothing, so an expired
document cannot become a frozen decision that outlives its own expiry.

`toggle` keeps working and keeps writing intent. Staleness is a property of the
document's claim about the present, and an operator writing intent into a local
store is making a claim of their own. The `ToggleResult.willDisable` list comes
out of two `resolve` calls that both answer `stale-config`, so it is empty, which
is the honest answer.

OpenFeature's `STALE` reason maps onto this directly, and the base spec's
OpenFeature section already notes that the OpenFeature enum is a superset of
this package's. The provider package emits `STALE` with `enabled` false.

The cost is stated and accepted. A native client that has been offline past its
budget renders every feature off, which for a feature gating a screen means the
screen disappears. The remedy available to an owner is a `maxStale` long enough
for its own offline story, and the remedy available to a holder is a cached
document whose `fetchedAt` it refreshes when it validates. An owner that sets no
`maxStale` gets no budget at all, which is the pre-existing behaviour and stays
the default.

## 4. `visibility`, and what reduction may touch

```ts
export interface FeatureDefinition<F extends FeatureKey = string> {
  // ... existing fields
  /** Whether a reduced serialization keeps this feature. Absent is internal. */
  visibility?: 'public' | 'internal';
}
```

The marking sits on the definition, so an author deciding a feature's rules
decides its audience in the same edit. An absent `visibility` is internal,
porting decision 3 of the policy-contracts document. An author who marks nothing
publishes nothing and notices. An author whose omission defaulted to public
publishes a feature whose rules name an internal cohort and does not notice
until somebody reads the document.

```ts
export type SerializeMode = 'full' | 'reduced';

export function serializeConfig<F extends FeatureKey>(
  features: Features<F>,
  mode: SerializeMode,
): FeatureConfig<F>;
```

`full` emits the stored document as it stands, `visibility` included, so a full
round trip through `parseFeatureConfig` comes back the same document. Stripping
the marking there would return every feature unmarked, which reads as internal,
and the round trip would silently unpublish the whole configuration.
`libs/acl/src/serialize.ts:120-150` records that argument.

`reduced` keeps a feature whose `visibility` is `'public'`, drops the marking
from the copy, carries `version`, `maxStale` and `schemaVersion` through, and
projects the `schema` to the features it kept plus the context fields those
features read. `libs/acl/src/serialize.ts:159-180` is the shape.

### What reduction may not touch

Decision 7 of the policy-contracts document says reduction removes whole
permissions and never edits one, and § 7 derives it from the monotonicity of
`sideOutcome`. The derivation for features is shorter and the conclusion is the
same.

A rule array is OR-ed and a `when` array is AND-ed, per the base spec's
Precedence section. Removing a rule can only move a feature toward
`no-rule-matched`, and removing a `when` condition can only move a rule toward
matching. The first direction is conservative and unequal, the second is
permissive and unsound. Either way a client stops agreeing with the server, which
is the one property a published configuration has.

A variant is the case the variants spec constrains directly, and it constrains
this document by name. Assignment lays the normalised weights out as cumulative
ranges over `[0, 1)` in declaration order. A serialization that drops a variant
moves every boundary after it. A serialization that reorders two variants swaps
the subjects in their ranges. So reduction carries `variants` entire, in order.

That leaves the permission the variants spec grants and this document declines:
reduction may drop a variant's `value`. Three things argue against using it.

A client holding a variant name and no value cannot render the variant. The
value is the configuration the variant needs, per decision 1 of the variants
spec, and `valueOf(key)` returning `undefined` for a variant that declares one
is a lie the type system already forbids, because the inferred schema types
`valueOf` as the declared value.

Dropping a value edits a feature, which is the operation ACL § 7 spent its whole
argument refusing. A variant array with a value removed from one element is not
the array the owner evaluates.

The variants spec already answers the case the permission was for. A feature
whose payloads must not reach a client is internal, the client never evaluates
it, and a trusted process renders the result. That is the same sentence as ACL
decision 9: internal means no consumer decides this, and an internal key at a
consumer is a dead end and never a fallback path.

So the cost lands on the owner, the same way ACL § 7 puts it there. A feature is
publishable with its variant values attached, or it is not publishable. An owner
holding a public experiment whose treatment payload is a secret marks the feature
internal and renders it server-side.

## 5. The `schema`, and why it carries two vocabularies

The variants spec's Typing section states the requirement this section answers.
TypeScript inference works on a literal, a configuration served by a control
plane carries no literal, and Swift and Kotlin infer nothing at all. So the
explicit-schema overload of `createFeatures` is the path every platform but a
TypeScript literal takes, and one versioned source has to produce the types those
platforms compile against.

```ts
export interface FeatureSchema {
  /** The context fields rules read. */
  readonly context?: ContextSchema;
  /** Per feature, the variant names and the shape of their values. */
  readonly features?: Readonly<Record<string, FeatureShape>>;
}

export interface ContextSchema {
  readonly fields?: Readonly<Record<string, FieldType>>;
}

export interface FeatureShape {
  /** Keyed by variant name, in no significant order. The config holds the order. */
  readonly variants?: Readonly<Record<string, ValueShape>>;
}

/** A JSON Schema 2020-12 object, fenced by the subset this section names. */
export type ValueShape = Readonly<Record<string, unknown>>;
```

### Context fields take ACL's flat strings

`FieldType` at `libs/acl/src/types.ts:157-171` is
`'string' | 'number' | 'boolean' | 'instant'` with optional `[]` and `?`
suffixes, and its docblock gives the reason: a flat string is JSON a producer in
any language emits by reflection.

An `AttributeCondition` at `libs/feature/src/lib/types.ts:39-43` compares one
context field against a literal with `eq`, `ne`, `in`, `not-in` or `contains`.
A `WindowCondition` and a `DayOfWeekCondition` both read `now`. Every field a
rule reads is a scalar or an array of scalars, and the operator set is closed,
so four base types and two suffixes describe the whole surface. `instant` is
already the type `toEpoch` at `conditions.ts:18-22` accepts.

The declaration gives the engine a check to run. A `contains` over a declared
`boolean` is a configuration error, and § 8's validator reports it against a
document that arrived from a database. Nothing checks it today.

### Variant values take JSON Schema

A variant `value` is arbitrary JSON the application renders. The worked example
in the variants spec is `{ label: 'Get it' }`, and a real one carries nested
objects, arrays of objects, enums and optional members.

A bespoke vocabulary for that shape means defining objects, arrays, unions,
optionality, enums and literals, writing a validator, and then writing a
TypeScript emitter, a Swift emitter and a Kotlin emitter for it. JSON Schema
2020-12 already defines all of it, ajv already validates it, and quicktype and
openapi-generator already emit TypeScript interfaces, Swift structs and Kotlin
data classes from it. The recommendation is JSON Schema, and the reason is the
emitters, and no property of the notation.

Two vocabularies in one document needs a defence, and it is that the two describe
different things at different times. The engine reads a context field, compares
it with a closed operator set, and checks it against the declared type at
validation. The engine never reads a variant `value` at all: `valueOf` hands it
to the caller untouched. So the context half is a constraint the library
enforces, and the variant half is a shape only a generator and an optional
validator care about. A single vocabulary would either weaken the context check
to what JSON Schema expresses about operators, which is nothing, or push variant
values into a type language this repository would then own.

### The fence

An unfenced JSON Schema produces generated code nobody wants. The subset a
`ValueShape` may use:

- `type`, `properties`, `required`, `items`, `enum`, `const`, `additionalProperties`
- `$defs` and `$ref` naming a `$defs` entry in the same document
- `title` and `description`, which the emitters turn into doc comments

Refused, and reported by `validateConfig` as an issue: a `$ref` to any URL or
file outside the document, `allOf`, `anyOf`, `oneOf` and `not`, and
`unevaluatedProperties`. A remote `$ref` makes the config a document a generator
cannot resolve offline, and the combinators produce Swift and Kotlin output that
a reader cannot map back to the schema. An owner needing a union writes an
`enum` over a discriminant.

## 6. Fetching the schema apart from the configuration

Weights change often, shapes change rarely. A config push to a phone carrying a
reweighted experiment has no reason to carry a JSON Schema describing payloads
nobody changed.

The variants spec's Typing section raises the objection: a schema travelling
inside the document it describes cannot drift from it, which a schema published
as a separate file can. That objection is correct about a schema published as a
mutable file, and `schemaVersion` is what removes it.

A schema is immutable at its `schemaVersion`. A publisher that changes any shape
publishes a new `schemaVersion` and serves the old one unchanged for as long as
any holder compiles against it. So a configuration naming `s7` and a schema
published at `s7` cannot disagree, because nothing rewrites `s7`.

The envelope therefore has two legal forms. A document carrying `schema` inline
states its version in `schemaVersion` and needs no second fetch, which is what a
backend service and a full publish use. A document carrying `schemaVersion` and
no `schema` names a schema a holder fetches once and caches forever, which is
what an incremental push to a phone uses.

`validateConfig` refuses a document carrying `schema` and no `schemaVersion`,
because an inline schema nobody can name cannot be cached, compared or fetched
again. A document carrying neither declares no shapes, which is what a
configuration with no variant values looks like.

The runtime needs the schema for one thing only, and it is optional. Generated
types are compiled into the holder long before a configuration arrives, so the
only run-time consumer of a schema is § 8's validator checking a candidate's
variant values against their declared shapes. A holder that skips that check
never fetches a schema at all, and a holder that runs it fetches one per
`schemaVersion` for the life of the process.

## 7. Atomic reload

```ts
export interface Features<S> {
  // ... existing members
  /** The installed document's version, lifted for convenience. */
  readonly version: string | number | undefined;
  /** Validates a candidate and installs it, or keeps the current one and reports. */
  reload(config: FeatureConfig, options?: FreshnessOptions): ReloadResult;
}

export type ReloadResult =
  | {
      ok: true;
      version: string | number | undefined;
      previousVersion: string | number | undefined;
      /** Keys whose stored intent differs from the previous document. */
      changed: readonly FeatureKey[];
    }
  | {
      ok: false;
      /** The version that stayed installed. */
      version: string | number | undefined;
      /** The candidate's version, so a log names what was refused. */
      rejected: string | number | undefined;
      issues: readonly ConfigIssue[];
    };
```

The order inside `reload` is what makes it atomic. It validates the candidate
whole through `validateConfig`, clones and deep-freezes every definition the way
`createFeatures` does at `features.ts:92-94`, builds the candidate graph, and
only then assigns the three internal references the store reads. A candidate that
fails at any step leaves every reference where it was, and the failure path
touches no state at all.

`resolve` at `features.ts:109-124` reads the store once at the top of the call
and walks `graph.order` from there. A swap that happens during a `resolve` cannot
be observed by it, because the swap replaces the reference and the running call
holds the previous frozen array. So a reload never produces a decision computed
half from one document and half from another, which is the cascade correctness
property the base spec's Cascade section depends on.

`changed` is a diff over stored intent, not over resolved values. Decision 5 of
the base spec says the store holds intent and resolution is computed on read and
never written back, so a reload replaces intent and computes nothing. A feature
whose rules changed appears in `changed`; a feature whose resolved answer changed
because its window expired does not, because nothing about it changed.

### A reload discards a local toggle

`toggle` at `features.ts:158` writes `config[at] = deepFreeze({ ...current,
enabled })`. That write is local to one process, and a reload from a database row
overwrites it, silently, on the next poll.

The honest position is that a toggle is a local write against a store whose truth
is elsewhere, and this document states that in the `toggle` docblock. An
operator who wants a durable toggle writes the row and lets the poller bring it
back, which is what `@evanion/feature-source` exposes at
§ 10. The core's `toggle` keeps its meaning for a process whose configuration is
a literal, which is every use of it today.

Merging a local toggle into an incoming document was considered and refused. A
merge means the store answers from two authorities with no record of which one
decided, which is the audit-log failure the base spec's "store holds intent"
section lists as a reason not to mutate.

## 8. Validation without a throw

```ts
export interface ConfigIssue {
  code:
    | 'duplicate-feature'
    | 'unknown-dependency'
    | 'cycle'
    | 'duplicate-variant'
    | 'unknown-variant'
    | 'invalid-weight'
    | 'empty-variants'
    | 'zero-weights'
    | 'invalid-instant'
    | 'unknown-context-field'
    | 'field-type-mismatch'
    | 'unfenced-schema'
    | 'missing-schema-version'
    | 'digest-mismatch';
  message: string;
  /** The feature the issue is about, when it is about one. */
  key?: FeatureKey;
  /** A JSON pointer into the document, so a UI can highlight the row. */
  path?: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: readonly ConfigIssue[] };

export function validateConfig(config: FeatureConfig): ValidationResult;

export function parseFeatureConfig<F extends FeatureKey>(
  config: FeatureConfig<F>,
  options?: FreshnessOptions,
): { ok: true; features: Features<F> } | { ok: false; issues: readonly ConfigIssue[] };
```

`validateConfig` reports every issue it finds, not the first. A poller showing an
operator one error per deploy cycle is a poor tool when the row has four.

### `createFeatures` keeps throwing

Changing both entry points to return a result was the alternative, and four
things argue against it.

The library already states the rule. `errors.ts:3-11` says every error is raised
by `createFeatures` and that `resolve`, `plan` and `toggle` are total, and it
gives the reason: constraints are enforced where configuration is supplied, so a
store a caller holds cannot fail mid-evaluation. A result-returning `reload` and
a throwing `createFeatures` both honour that sentence. The two entry points
differ in who supplied the configuration, and nothing else.

A literal that fails validation is a programming error the author reads in a
stack trace, at the line that wrote it. The same failure delivered as a result
object is a failure the author must remember to check, and the checks that get
forgotten are the ones that never fire in development.

Every documentation fence and every call site would grow an unwrap. `createFeatures`
appears in the README, in `apps/docs/content/feature/`, and in the docblock at
`features.ts:75-84`, and `tools/repo-checks` holds G5, which fails the build when
a fence imports a name the package does not export. Four flags in a fence
followed by an `if (!result.ok) throw` reads as ceremony for a failure a literal
cannot have at runtime.

`@evanion/acl` draws the same line at a different place and the divergence is
deliberate. `parseMatrix` at `libs/acl/src/parse-matrix.ts:43-49` throws, because
an ACL consumer fetches a contract at boot and a malformed contract is a deploy
failure the consumer wants loudly. A feature service reloads on a thirty-second
interval inside a process that is serving traffic, and a malformed row there must
report and let the previous document keep deciding. This document takes the name
and refuses the behaviour.

So there is one checker and two envelopes. `createFeatures` calls
`validateConfig` and throws the first issue as its existing typed error, which
keeps `FeatureCycleError`, `UnknownDependencyError` and `DuplicateFeatureError`
firing exactly as they do today from `graph.ts:38`, `:46` and `:62`.
`parseFeatureConfig` and `reload` call it and return the issues.

Each issue code maps onto the error the literal path throws, so a message written
once reads the same in a stack trace and in an operator's console.

## 9. JSON round-tripping and `Instant`

`Instant` is `string | number | Date` at `types.ts:16`, and `toEpoch` at
`conditions.ts:18-22` accepts all three. A `Date` in a `WindowCondition.value`
survives `structuredClone`, which is what `createFeatures` uses at
`features.ts:93`, and does not survive JSON. `JSON.stringify` writes the ISO
string and `JSON.parse` hands back a string, so a configuration that made one hop
through a transport holds a different value than the one that authored it.

The value still evaluates the same, because `toEpoch` reads both forms to the
same epoch. What breaks is identity. `configDigest` over the authoring process's
document and over the receiving process's document computes two digests, so two
processes holding one configuration report different versions of it, which is
exactly the disagreement § 2 exists to detect.

```ts
/** An `Instant` that round-trips: ISO 8601 or epoch milliseconds. */
export type SerializedInstant = string | number;
```

`FeatureDefinition` keeps `Instant` with its `Date` member, because
`new Date('2026-10-01')` in a literal is what an author writes and
`conditions.ts` already handles it. `FeatureConfig` narrows to
`SerializedInstant`, and `serializeConfig` converts a `Date` to its ISO string on
the way out. `configDigest` runs over the serialized form for the same reason,
which also matches what `libs/acl/src/canonical.ts:19` already does with a `Date`.

`validateConfig` reports `invalid-instant` for a string a `Date` constructor
parses to NaN, which nothing checks today and which decides `false` forever at
evaluation with no explanation.

The rest of the document is JSON by construction. `FeatureDefinition` holds
strings, booleans, numbers, arrays and a variant `value` the variants spec
already requires to round-trip through JSON in its decision 11. `undefined`
members drop on the way out, which is what `canonical.ts:21-22` does and what
keeps an absent key and a key written as `undefined` agreeing.

### Two host globals, and what this adds

`serializeConfig`, `configDigest` and `validateConfig` use `JSON` and nothing
else, so a native client embedding a JavaScript engine with no DOM runs all
three. The package holds two host globals today: `new TextEncoder()` in
`murmur3` at `libs/feature/src/lib/bucketing.ts:57`, and `structuredClone` in
`createFeatures` at `features.ts:93`.

`reload` inherits the second, because § 7 clones the candidate the same way
`createFeatures` does. That is acceptable: `structuredClone` is in Node 17 and in
every browser engine this package targets, and the package already declares
`"node": ">=20"`.

`docs/specs/2026-09-23-feature-hydration.md` proposes replacing `TextEncoder`
with an inline UTF-8 encoder, and this document endorses it for a second reason.
The variants spec commits `bucketOf` to a cross-language contract with published
test vectors, and an encoder written out in the source is a specification a Swift
or Kotlin implementer reads. A call to a host global is a specification that says
"whatever this runtime does", and the runtimes disagree on a lone surrogate.

`EvaluationContext.now` stays a `Date` at `types.ts:111`. A context is not
configuration, it does not travel in this envelope, and
`docs/specs/2026-09-23-feature-hydration.md` owns whatever crosses a boundary
per request.

## 10. Where the adapter lives, and what no endpoint answers

The core reads no database, opens no socket and starts no timer. Every adapter
lives in a sibling package:

```
libs/feature-source/
```

`nx.json:151` sets `"projects": ["libs/*"]`, so a directory under `libs/`
publishes and this needs no configuration edit.
`docs/specs/2026-09-21-acl-matrix-introspection.md` puts `@evanion/acl-introspect`
in a sibling for the same reason, and the reason is what each package's consumers
can afford to carry. A browser bundle of `@evanion/feature` must not contain a
Postgres driver, and a React Native bundle must not contain a Node `http` import.
The core's dependency list is empty today and stays empty.

The package holds the poller, the freshness bookkeeping that produces
`fetchedAt`, and one adapter per source. Its shape is small, because `reload` and
`parseFeatureConfig` do the work:

```ts
const source = postgresSource({ pool, table: 'features' });
const features = await source.start({ maxStale: 60_000 });
// source polls, calls features.reload(config), and reports a refused candidate.
```

An adapter that fetches over HTTP revalidates against a version probe and
downloads the body only when the version differs, which is what § 13 of the
policy-contracts document works out: a freshness probe is a few bytes and a
version comparison, and the body changes only when the version does. So a
holder can afford a short `maxStale` without a transfer per interval.

### What a control plane serves

A control plane serves a version probe, and the two documents a changed version
points at: the configuration at that version, and the schema at its
`schemaVersion`. `apps/shop-api/src/acl/policy.controller.ts:36-40` is the shape,
one `GET` returning `{ version, matrix }` from `serialize(access, 'reduced')`.

**No endpoint ever answers which variant a subject gets.** § 8 of the
policy-contracts document draws the line this sits on, and it draws it by what
the request varies with. Fetching a document is periodic and subject-independent,
so it happens at boot or on an interval and it caches. Fetching a decision is per
subject, so it is a request per user per origin, it lands in the latency of every
render, and no cache removes it because the answer varies by subject.

For this package the line has a second edge. A variant assignment endpoint would
put the assignment in one process, and the variants spec's determinism section
requires every process to compute the same assignment from the same inputs. A
server that answers assignments becomes the only correct answer, every client
that computes its own is a divergence, and the published `bucketOf` test vectors
the variants spec commits to have nothing left to prove.

So there is no assignment endpoint, no decision-bubbling path and no "ask the
control plane" fallback, and none should be added later without revisiting this
section. A holder that needs a decision holds the configuration that decides it.
A feature a holder must not decide is internal, and § 4 says what that means.

## Testing

- A round trip. `serializeConfig(features, 'full')` through `JSON.stringify`,
  `JSON.parse` and `parseFeatureConfig` produces a store whose `config` deep-equals
  the original with every `Date` replaced by its ISO string, and whose
  `configDigest` equals the original's.
- Digest stability. Two documents differing only in object key order, in
  whitespace, in a `Date` against its ISO string, and in an absent key against one
  written `undefined`, produce one digest. A document differing in the order of a
  `variants` array produces a different one, because order is assignment.
- Reduction keeps a feature whole. For every key in a reduced document, the
  definition deep-equals the stored one with `visibility` deleted. The variants
  array compares element by element, in order, values included.
- An unmarked feature does not publish, and a document whose features are all
  unmarked reduces to an empty `features` array.
- Reduced schema projection. A reduced document's `schema.features` holds exactly
  the keys it published, and `schema.context` holds exactly the fields those
  features' rules read.
- Atomic reload. A candidate carrying a cycle, an unknown dependency, a duplicate
  key and a bad weight returns four issues, and `features.config` is byte-identical
  before and after, asserted the way the base spec's store-is-never-written test
  asserts it.
- A reload during a resolve. A `resolve` started against document A and a `reload`
  to document B interleaved by a synchronous hook produce a decision set entirely
  from A.
- `changed` names the keys whose stored intent differs, and omits a key whose
  resolved answer moved because `now` moved.
- A reload discards a `toggle` the incoming document does not carry, asserted
  explicitly so the behaviour is a decision and not a surprise.
- Freshness. A store past `fetchedAt + maxStale` answers
  `{ enabled: false, reason: 'stale-config' }` for every configured key and for an
  unconfigured one; a store inside the budget answers normally; a store with no
  `fetchedAt` never expires; `fetchedAt` against a document with no `maxStale`
  throws `MissingFreshnessBudgetError`; a local `maxStale` shortens the owner's and
  never extends it; an unparseable `now` proceeds and does not expire.
- An expired decision carries no `variant` and no `value`, and `plan()` against
  an expired store freezes nothing.
- `digest` verification. A document whose `variants` array was reordered and
  whose `digest` was left alone is a `digest-mismatch` issue, and so is one whose
  `rules` array was reordered.
- `validateConfig` reports every issue, not the first, and each code's message
  matches the message its thrown counterpart carries.
- `createFeatures` throws where it throws today, for each of `graph.ts:38`, `:46`
  and `:62`, unchanged.
- Schema fence. A `ValueShape` carrying a remote `$ref`, an `allOf` or a `oneOf`
  is an `unfenced-schema` issue, and an inline `schema` with no `schemaVersion` is
  a `missing-schema-version` issue.
- A context field declared `boolean` and read by a `contains` condition is a
  `field-type-mismatch` issue.
- `expectTypeOf` over `parseFeatureConfig`'s discriminated result, and over
  `reload`'s.
- Cross-process agreement, as a published fixture and no test: one
  serialized document, one context, and the expected `Decisions` map, checked into
  the repository beside the `bucketOf` vectors the variants spec commits to, so a
  Swift or Kotlin implementation proves it agrees.

## Where I am guessing

- **That expiry into the off state is right for every holder.** § 3 argues it from
  the kill switch and accepts that an offline native client loses every feature at
  once. A per-feature `staleBehaviour: 'off' | 'last-known'` would let an owner keep
  a navigation flag on while a kill switch expires, at the cost of a second axis on
  every definition and a decision a reviewer has to get right per feature. Nothing
  here has been measured against a real offline client.
- **That JSON Schema's generated Swift and Kotlin are good enough.** § 5 recommends
  it for the emitters, and the emitters have not been run against a real variant
  value in this repository. quicktype's output for a nested optional object is
  asserted to be acceptable and has not been read.
- **The fence in § 5.** The refused keyword list is a judgement about generator
  output quality. An owner with a genuine discriminated union writes an `enum` over
  a discriminant, which is a real restriction on what a variant value may be, and no
  consumer has hit it yet.
- **That `schemaVersion` fully answers the drift objection.** § 6 rests on a
  publisher never rewriting a schema at a version. Nothing in the library enforces
  that, the same way nothing enforces ACL's `origin:kind` spelling convention. A
  publisher that rewrites `s7` breaks every holder that cached it, silently.
- **That one `maxStale` is enough.** § 13 of the policy-contracts document works
  out why a second, tighter bound for compliance vetoes collapses on arithmetic. The
  feature equivalent, a tighter bound for a kill switch than for a rollout, has the
  same arithmetic problem and a weaker case, and it has not been argued here at
  length.
- **The `changed` diff's granularity.** § 7 says it names keys whose stored intent
  differs. Whether a caller wants the field that differed, or a per-feature diff of
  the shape `diffMatrix` produces for `@evanion/acl`, is untested. Key granularity
  is the cheap answer and may be the wrong one for an operator console.
- **That one document-wide `digest` is what the hydration spec needs.** § 2
  argues the narrower variant-name digest is a subset and refuses it. If a
  hydrating client receives variants through a path that never carries the
  envelope, it has no `digest` to check and the argument does not reach it. The
  two documents have to reconcile on that path before either is implemented.
- **That one poller in the sibling package serves every adapter.**
  § 10 assumes one poller with an adapter behind it. A source pushing over a
  websocket has no poll interval and fits the shape awkwardly, and no push source
  has been written.
