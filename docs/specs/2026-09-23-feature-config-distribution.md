# @evanion/feature: configuration distribution

Status: proposed
Packages: `@evanion/feature` gains four exports (`serializeConfig`,
`parseFeatureConfig`, `validateConfig`, `configDigest`), five envelope types
(`FeatureConfig`, `FeatureSchema`, `ContextSchema`, `FeatureShape`,
`SerializedInstant`), three result types (`ValidationResult`, `ConfigIssue`,
`ReloadResult`), six envelope members (`version`, `digest`, `schema`,
`schemaVersion`, `maxStale`, `features`) and two `Features` members (`reload`,
`version`). `@evanion/feature/react` re-exports the types and changes no
runtime. A new sibling package `@evanion/feature-source` holds every adapter
that reads configuration from somewhere, and § 9 argues why the core holds none.
Depends on: `docs/specs/2026-09-11-feature-toggles.md` (decision 5, the store
holds intent and resolution is never written back, which § 6 is bounded by; its
"Static and runtime evaluation" split, which § 9 keeps);
`docs/specs/2026-09-23-feature-variants.md` (its "Determinism across processes"
section, whose condition 2 this document owns; its decision 11 and "Bucketing
order" section, whose `VariantSpec.order` § 2 carries in the envelope; its
decision 13, whose no-silent-downgrade rule § 3 implements; and its "Typing"
section, which states the requirement § 4 and § 5 answer);
`docs/specs/2026-09-16-published-policy-contracts.md` (its § 9, the envelope
§ 1 copies; its decision 8 and § 8, that evaluation is always local, which § 9
ports and extends; its § 13 freshness budget, which decision 2 declines; and
`parseMatrix`, whose name § 7 takes and whose throw § 7 refuses);
`libs/feature/src/lib/types.ts` (`Instant` at `:16`, the round-trip defect § 8
repairs; `FeatureDefinition` at `:78-104`; `Reason` at `:117-127`, which gains
no member; `Decision` at `:159-171`);
`libs/feature/src/lib/features.ts` (`createFeatures` at `:86-94`, whose clone
and freeze § 6 reuses; `resolve` at `:109-124`, which reads the store once per
call; `toggle` at `:142-168`, the only writer today and the one § 6 has to
reconcile with a reload);
`libs/feature/src/lib/errors.ts` (`:3-11`, whose docblock states that every
error is raised by `createFeatures` and that `resolve`, `plan` and `toggle` are
total, which § 7 keeps true);
`libs/feature/src/lib/graph.ts` (`:38`, `:46` and `:62`, the three throws § 7
converts into issues);
`libs/feature/src/lib/evaluate.ts` (`ruleId` at `:17-19`, the positional rule
name § 2 replaces from the envelope's side);
`libs/feature/src/lib/conditions.ts` (`toEpoch` at `:18-22`, which already
accepts all three `Instant` forms);
`libs/acl/src/types.ts` (`Matrix` at `:220-234`, the envelope § 1 copies;
`FieldType` at `:157-171` and `ObjectSchema` at `:180-183`, the vocabulary § 4
reuses for context fields; `MatrixSchema` at `:204-207`);
`libs/acl/src/canonical.ts` (`:17-25`, the sorted-key text § 2 derives the
digest from and § 8 derives the `Date` rule from);
`libs/acl/src/parse-matrix.ts` (`:43-49`, the foreign-document entry point § 7
names itself after and diverges from);
`apps/shop-api/src/acl/policy.controller.ts` (`:36-40`, the only endpoint in
this repository that publishes a policy document, and the shape § 9 copies);
`nx.json:151` (`"projects": ["libs/*"]`, so a directory under `libs/` publishes
and the sibling package of § 9 needs no configuration edit).
Research read for this revision: `docs/research/2026-09-23-launchdarkly.md`,
`docs/research/2026-09-23-unleash-flagsmith.md`,
`docs/research/2026-09-23-growthbook-statsig.md` and
`docs/research/2026-09-23-openfeature-posthog.md`.
Not yet written, and cross-referenced here so this document does not design
them: `docs/specs/2026-09-23-feature-hydration.md` owns hydrating a config or a
decision into a running client, the decision-version check at hydration and the
SSR mismatch; `docs/specs/2026-09-23-feature-observation-seam.md` owns the
observation seam and exposure tracking. The hydration document's dependency
block names a `visibility` field and a reduced serialization. Decision 2 removes
both, and nothing in that document's own body reads either one.
Prior art: HTTP conditional requests, whose `ETag` is an opaque validator a
client compares for equality and never orders, which is what § 2 makes `version`;
JSON Schema 2020-12 and the quicktype and openapi-generator emitters, which § 4
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
notices.

The configuration does not round-trip through JSON. `Instant` is
`string | number | Date` at `types.ts:16`, and a `Date` in a window condition
comes back as a string, so a digest over the two forms disagrees and two
processes holding one configuration compute two versions of it.

`@evanion/acl` answered all four for policy documents, and
`docs/specs/2026-09-16-published-policy-contracts.md` is the argument. This
document ports those answers. Two of them do not survive the port. § 7 takes
`parseMatrix`'s name and refuses its throw, and this document carries no reduced
serialization at all, for the reason decision 2 states.

## Decisions

1. Configuration travels as an envelope, `FeatureConfig`, with the members
   `version`, `digest`, `schema`, `schemaVersion`, `maxStale` and `features`. It
   mirrors `Matrix` at `libs/acl/src/types.ts:220-234`, with `features` in place
   of `permissions` and two members added. § 1.
2. The library evaluates the document it is handed. It owns no policy about
   where that document came from, who was allowed to receive it, or how old it
   is. The control plane selects an audience, the platform binding fetches and
   holds the clock, and this package decides features. § 1.
3. `maxStale` travels in the envelope as an advisory value for the party that
   fetches. No entry point in this library reads it, and no decision depends on
   it. § 1.
4. `version` is an opaque `string | number` a consumer compares with `!==` and
   never orders. `configDigest(config)` derives one from the canonical text of
   the serialized document, for a publisher with no version scheme of its own.
   The envelope also carries `digest`, separate from `version`, and a holder
   that finds one verifies the document against it. § 2.
5. Identity a control plane assigned travels in the envelope. `rule.id` and
   `VariantSpec.order` are emitted verbatim, and the content hash of issue #245
   covers a rule a hand-authored document declares with no id. The hash excludes
   `rollout.percent`, so an operator moving a ramp does not rename a rule. § 2.
6. Version and capability negotiation never downgrades correctness silently. A
   holder that meets a member it cannot read refuses the whole document, and no
   member carrying a bucketing parameter has a default. § 3.
7. The `schema` describes the context fields rules read and, per feature, the
   variant names and the shape of their values. It uses two vocabularies. A
   context field is a flat `FieldType` string, ported from
   `libs/acl/src/types.ts:157-171`. A variant value shape is a JSON Schema
   2020-12 object, fenced to a subset. § 4.
8. A schema is immutable at its `schemaVersion`. The envelope may carry
   `schema` inline or carry `schemaVersion` alone, and a holder that already
   has the schema at that version fetches nothing. § 5.
9. `features.reload(config)` validates a candidate whole, installs it by
   swapping one reference, and otherwise keeps the current configuration
   untouched and reports why. It replaces intent and writes no resolved value.
   § 6.
10. A reload discards a local `toggle`. The store's truth is the configuration
    source, and a toggle is a local write against it. § 6.
11. `createFeatures` keeps throwing. `parseFeatureConfig(config)` is the
    reload-shaped entry point and returns a result. Both call one checker,
    `validateConfig`. § 7.
12. A serialized configuration carries an `Instant` as an ISO 8601 string or as
    epoch milliseconds, never as a `Date`. `serializeConfig(features)` converts.
    § 8.
13. Every adapter that reads configuration from a database, an HTTP endpoint or
    a disk cache lives in `@evanion/feature-source`. The core imports no driver,
    opens no socket and starts no timer. § 9.
14. Local evaluation is the default and this package optimises for it. Every
    process holds the rules and computes its own answer, browsers and mobile
    clients included. § 9.
15. No endpoint ever answers which variant a subject gets. A control plane
    serves a version probe and the two documents a changed version points at,
    the configuration and the schema. § 9.

## 1. The envelope

```ts
export interface FeatureConfig<F extends FeatureKey = string> {
  /** Compared with `!==`. Opaque and unordered. § 2. */
  readonly version?: string | number;
  /** `configDigest` of this document, for a holder that verifies it. § 2. */
  readonly digest?: string;
  /** The typing contract. Inline, or named by `schemaVersion` alone. § 4, § 5. */
  readonly schema?: FeatureSchema;
  /** The schema's own version. Immutable at a value. § 5. */
  readonly schemaVersion?: string;
  /** Advisory, for whoever fetches. This library never reads it. § 1. */
  readonly maxStale?: number;
  readonly features: readonly FeatureDefinition<F>[];
}
```

`Matrix` at `libs/acl/src/types.ts:220-234` carries `version`, `schema`,
`maxStale` and `permissions`, and its docblock states why there is no bare-array
form: a foreign producer emitting JSON states the version and the schema, and one
document crosses a boundary without a wrapper assembled at the call site. Both
reasons hold here word for word. Two members answer questions `@evanion/acl`
never had. `schemaVersion` is § 5, and `digest` is the second half of § 2.

`createFeatures` keeps its array signature. A literal has no version, no schema
and no freshness claim, and a TypeScript author writing four flags in a file
owes none of them. `createFeatures` gains one overload taking a `FeatureConfig`,
so a process that starts from a document its poller already fetched does not
unwrap it by hand.

### What this library decides, and what it declines to decide

The library evaluates the document a caller handed it. Two questions about that
document belong to other parties, and this package answers neither.

The first is who was allowed to receive it. The control plane selects an
audience, serves the document that audience gets, and this library evaluates
whatever arrives. There is no `visibility` field on a definition, no reduced
serialization mode and no rule about what a projection may edit. The field puts
that control in the service. Flagsmith carries a per-flag `is_server_key_only`
that filters the feature out of a client payload in a queryset
(`docs/research/2026-09-23-unleash-flagsmith.md:1226-1244`). LaunchDarkly calls
it Client-side availability, two booleans spelled
`clientSideAvailability.usingMobileKey` and
`clientSideAvailability.usingEnvironmentId` in its REST API, settable per flag
or as a project default (`docs/research/2026-09-23-launchdarkly.md:799`,
`:833`). Both products implement the filter in the service, and neither one puts
a reduction step in the evaluation SDK. This document takes the same split. A
feature toggle library is not a security boundary, and the ceremony
`@evanion/acl` spends on projection correctness answers a question nobody is
asking here.

The second is how old the document is, which is the next section.

### `maxStale` travels and this library never reads it

`maxStale` is a duration in milliseconds the control plane sets, and it states
how long the publisher believes a holder may keep this document. `resolve`,
`plan`, `toggle`, `reload` and `validateConfig` all ignore it. `Reason` gains no
member for it, and no decision this library returns mentions it.

The party that fetches is the party that acts on it. A platform binding in
`@evanion/feature-source` holds the poller, knows the fetch instant because it
performed the fetch, and can shorten its interval, log, refuse to start or serve
a fallback document. This library holds no clock authority and performs no
fetch. It could only compare two numbers a caller handed it and then impose one
policy on every holder, and both available policies are wrong for somebody.
Answering off for every key breaks a native client that went offline for a
flight. Answering the last known value breaks the kill switch an operator just
pulled.

No product in the research fails closed on age. Unleash bounds the age of cached
data nowhere: its backup file has no expiry, and its `stale` field appears
exactly once in the Node SDK source, as a type declaration no evaluation code
reads (`docs/research/2026-09-23-unleash-flagsmith.md:745`, `:758`). Flagsmith's
JS client defaults `cacheOptions.ttl` to `0`, which means no expiry, and a
configured ttl makes the SDK prefer the network while `loadStale` keeps serving
the old cache during the request
(`docs/research/2026-09-23-unleash-flagsmith.md:795-820`). LaunchDarkly's mobile
SDKs bound the number of cached contexts with `maxCachedContexts` and evict the
oldest, and its server-side documentation states that cached flag data has no
expiration or TTL (`docs/research/2026-09-23-launchdarkly.md:454`, `:878`).

The envelope also states no validity window. It carries no `notBefore` and no
`notAfter`. A document that expired on the author's clock would put two clocks in
one decision, and the base spec's Time section already settles that `now` is
injected at the call and read from no ambient source. A feature that should stop
at an instant says so in a `WindowCondition`, which is a rule the engine
evaluates and explains.

## 2. `version`, `digest`, and rule identity

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

The field agrees on the shape. LaunchDarkly's server-side polling sends
`if-none-match` with a cached ETag and honours 304
(`docs/research/2026-09-23-launchdarkly.md:320`, `:411-415`). Unleash carries an
ETag on the config payload, plus delta polling and an SSE stream of the
configuration itself (`docs/research/2026-09-23-unleash-flagsmith.md:597-605`,
`:1290`). PostHog serves its definitions endpoint with ETag and 304 on a 30
second default poll (`docs/research/2026-09-23-openfeature-posthog.md:897-906`,
`:706`). Flagsmith is the one product with no validator on the document: its SSE
carries `{"updated_at": <ms>}` and nothing else, and the researcher found no
ETag on the environment document
(`docs/research/2026-09-23-unleash-flagsmith.md:679`, `:685`, `:1320`). A
timestamp orders, and an ordering is the thing this document refuses a consumer.

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
configuration, which is what the variants spec's determinism condition 2 asks
for. `configDigest` runs over the serialized form, so § 8's `Date` rule is what
makes that comparison hold across a JSON hop.

### `digest` is a second member

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

What the digest covers is every byte of the document, because `canonical`
preserves array order by construction and states the reason at
`libs/acl/src/canonical.ts:8-11`.

An earlier draft gave the digest a second duty. A control plane rebuilding a
feature from a table with no `ORDER BY` hands the same variants back in a
different order, which moved every band boundary and reassigned every subject
with no error anywhere, and a document-wide digest was the only thing that saw
it. The variants spec removed the duty. Its decision 11 puts an `order` on every
variant and walks the variants in ascending `order`, its "Bucketing order"
section says a control plane writes `order` on every variant it serialises, and
a permuted array then assigns identically. So the digest carries nothing on
variant order, and no variant-specific digest is needed anywhere.

One array's sequence still decides an answer, and it is `rules`. The next
section is what the envelope does about that.
`docs/specs/2026-09-23-feature-hydration.md` verifies this `digest` and defines
no digest of its own.

### Rule ids come from the control plane

`ruleId` at `libs/feature/src/lib/evaluate.ts:17-19` returns `rule.id` or the
rule's index spelled `#0`, `#1`. So a document whose rules arrive reordered
renames every rule that declared no `id`, and `Decision.rule`,
`RuleOutcome.rule` and the variants spec's `assignment.rule` all carry the
renamed value. A dashboard keyed on that name reports two rules as one.

LaunchDarkly assigns each rule a random `_id` when an author creates it, and its
`feature` event `reason` carries `ruleId` and `ruleIndex` together. The
documentation states the property in one line: `ruleId` "stays the same even if
you rearrange the order of the rules", while `ruleIndex` is "the positional
index of the matched rule" (`docs/research/2026-09-23-launchdarkly.md:651-653`,
`:664`). An analysis keyed on the id still names one rule after a reorder, and
one keyed on the index names a different rule
(`docs/research/2026-09-23-launchdarkly.md:627`).

An assigned id is the better mechanism, and the reason is that the control plane
already writes the row and can write an id into it at the same moment. Issue
#245 replaces the positional fallback with a content hash, and the hash exists
for the case where no party assigns anything: a rules array a TypeScript author
wrote in a file. This document owns the envelope's side of that work.
`FeatureConfig` carries whatever `id` the control plane wrote, `serializeConfig`
emits it untouched, and `validateConfig` reports `duplicate-rule-id` for two
rules in one feature declaring the same one. The hash applies to a rule the
document carries with no `id`, and its input excludes `rollout.percent`, so an
operator moving a ramp from 20 to 30 does not rename the rule and orphan every
event already attached to it.

`VariantSpec.order` travels for the same reason and by the same route. A control
plane that holds a feature's variants as rows writes an `order` on each one,
`serializeConfig` emits it, and `validateConfig` reports
`duplicate-variant-order` and `invalid-variant-order` for the cases the variants
spec's Validation section names. Flagsmith is where that model comes from: a
variant there carries a stable slug `key` and an explicit `priority` derived
from creation order, and the engine sorts on `priority` before the cumulative
walk. So the envelope carries two values a control plane assigns, `rule.id` and
`VariantSpec.order`, and a re-serialization that permutes either array then
renames nothing and reassigns nobody.

Stable rule identity is not the field's default. A PostHog release condition is
a positional `FlagPropertyGroup` carrying no id, referenced in the evaluation
reason by `condition_index`, and a PostHog variant is identified by its `key`
string alone with no stable id behind it
(`docs/research/2026-09-23-openfeature-posthog.md:847`). Renaming a variant key
there changes bucketing, and reordering conditions breaks every reason reference
pointing at them.

## 3. Negotiation never downgrades correctness

GrowthBook's payload builder filters rule keys by the capabilities an SDK
Connection declares (`packages/shared/src/sdk-versioning/sdk-payload.ts:26`,
read at `docs/research/2026-09-23-growthbook-statsig.md:150-164`). A connection
that does not declare `bucketingV2` receives rules with `hashVersion` stripped
out, and the SDK reads `experiment.hashVersion || 1`, which puts that traffic
back on the hashing GrowthBook's own documentation calls biased
(`docs/research/2026-09-23-growthbook-statsig.md:905`). The operator sees a
compatibility version in a dropdown, and no warning reaches them from either
side.

Two properties combine to produce that. The producer removes a member the
consumer needs, and the consumer defaults the missing member to a value that
changes an answer.

This envelope refuses both. A producer that cannot emit a member this document
requires emits a document `validateConfig` refuses, and the issue names the
member. A holder that meets a member it does not understand reports
`unknown-member` and refuses the whole document; it drops nothing and evaluates
nothing.

Every member the assignment algorithm reads travels whole or the document is
refused. No negotiation layer may strip `VariantSpec.order`, a variant `weight`,
a `variantSeed` or a `variantBy`, because a holder that fills the gap with a
default computes a different assignment and reports nothing while it does. A
bucketing parameter this package adds later, a hash version among them, travels
as a required member with no default at all, so an old holder refuses a new
document and the operator reads one refusal at the first poll.

Decision 13 of the variants spec states this from the algorithm's side and hands
the mechanism here: a consumer that cannot read `order` or the variant seed
produces no decision at all. `unknown-member` and a refused document are that
mechanism.

The cost is availability, and § 6 already bounds it. A holder that refuses a
document keeps the one it already installed and reports the issues, so a
correctness-preserving refusal never leaves a process with no configuration.

## 4. The `schema`, and why it carries two vocabularies

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
`boolean` is a configuration error, and § 7's validator reports it against a
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

## 5. Fetching the schema apart from the configuration

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
only run-time consumer of a schema is § 7's validator checking a candidate's
variant values against their declared shapes. A holder that skips that check
never fetches a schema at all, and a holder that runs it fetches one per
`schemaVersion` for the life of the process.

## 6. Atomic reload

```ts
export interface Features<S> {
  // ... existing members
  /** The installed document's version, lifted for convenience. */
  readonly version: string | number | undefined;
  /** Validates a candidate and installs it, or keeps the current one and reports. */
  reload(config: FeatureConfig): ReloadResult;
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

`changed` diffs stored intent. It never diffs resolved values. Decision 5 of
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
back, which is what `@evanion/feature-source` exposes at § 9. The core's
`toggle` keeps its meaning for a process whose configuration is a literal, which
is every use of it today.

Merging a local toggle into an incoming document was considered and refused. A
merge means the store answers from two authorities with no record of which one
decided, which is the audit-log failure the base spec's "store holds intent"
section lists as a reason not to mutate.

## 7. Validation without a throw

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
    | 'duplicate-rule-id'
    | 'duplicate-variant-order'
    | 'invalid-variant-order'
    | 'invalid-instant'
    | 'unknown-context-field'
    | 'field-type-mismatch'
    | 'unfenced-schema'
    | 'missing-schema-version'
    | 'unknown-member'
    | 'digest-mismatch';
  message: string;
  /** The feature the issue is about, when it is about one. */
  key?: FeatureKey;
  /** A JSON pointer into the document, so a UI can highlight the row. */
  path?: string;
}

export type ValidationResult =
  { ok: true } | { ok: false; issues: readonly ConfigIssue[] };

export function validateConfig(config: FeatureConfig): ValidationResult;

export function parseFeatureConfig<F extends FeatureKey>(
  config: FeatureConfig<F>,
):
  | { ok: true; features: Features<F> }
  | { ok: false; issues: readonly ConfigIssue[] };
```

`validateConfig` reports every issue it finds. A poller showing an
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

## 8. JSON round-tripping and `Instant`

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

export function serializeConfig<F extends FeatureKey>(
  features: Features<F>,
): FeatureConfig<F>;
```

`serializeConfig` takes no mode. It emits the stored document whole: every
definition, every rule with its `id`, every variant with its name, weight and
value, in the order the store holds them. Its one transformation is the `Date`
conversion below, and a round trip back through `parseFeatureConfig` therefore
produces the document it started from.

The entry point earns its place on two counts. `configDigest` is defined over the
serialized form, so something has to produce that form from a live store, and a
control plane that built its store from rows serializes it to serve it.

`FeatureDefinition` keeps `Instant` with its `Date` member, because
`new Date('2026-10-01')` in a literal is what an author writes and
`conditions.ts` already handles it. `FeatureConfig` narrows to
`SerializedInstant`, and `serializeConfig` converts a `Date` to its ISO string on
the way out, which also matches what `libs/acl/src/canonical.ts:19` already does
with a `Date`.

`validateConfig` reports `invalid-instant` for a string a `Date` constructor
parses to NaN, which nothing checks today and which decides `false` forever at
evaluation with no explanation.

The rest of the document is JSON by construction. `FeatureDefinition` holds
strings, booleans, numbers, arrays and a variant `value` the variants spec
already requires to round-trip through JSON in its decision 14. `undefined`
members drop on the way out, which is what `canonical.ts:21-22` does and what
keeps an absent key and a key written as `undefined` agreeing.

### Two host globals, and what this adds

`serializeConfig`, `configDigest` and `validateConfig` use `JSON` and nothing
else, so a native client embedding a JavaScript engine with no DOM runs all
three. The package holds two host globals today: `new TextEncoder()` in
`murmur3` at `libs/feature/src/lib/bucketing.ts:57`, and `structuredClone` in
`createFeatures` at `features.ts:93`.

`reload` inherits the second, because § 6 clones the candidate the same way
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

## 9. Local evaluation, the adapter package, and what no endpoint answers

Every process that asks this library a question holds the rules and computes its
own answer. A browser, a phone and a backend service run the same evaluation over
the same document. Decision 8 of the policy-contracts document fixed that for
`@evanion/acl` at every tier, this package extends it to a client that a control
plane has never met, and decision 1 of the variants spec states the same premise
from the assignment side.

The owner chose that deliberately, and most of the field chose the other way.
LaunchDarkly's client and mobile SDKs receive one pre-evaluated result per flag
and hold no rules, clauses, segments or salts; `boolVariation` there is a lookup
into a map the backend computed
(`docs/research/2026-09-23-launchdarkly.md:316`, `:864`). PostHog's browser SDK
POSTs `/flags` and receives an evaluated map, and PostHog offers local evaluation
only in its server SDKs behind a secret key
(`docs/research/2026-09-23-openfeature-posthog.md:841`, `:502`). An Unleash
frontend token reads enabled flags for a given context, and the frontend payload
carries no rule configuration at all, so Edge or the proxy does the evaluating
(`docs/research/2026-09-23-unleash-flagsmith.md:609`, `:635`, `:1210`).
GrowthBook is the one product that hands a browser the full ruleset and lets the
browser decide (`docs/research/2026-09-23-growthbook-statsig.md:450`).

Two things pay for the choice. One library serves a backend service and a
browser, so an application writes one definition set and reads one decision type.
An offline client re-evaluates when its context changes, which a client holding
pre-evaluated answers cannot do at all.

The cost is named and accepted. LaunchDarkly gets cross-SDK agreement for
nothing, because one party computes every assignment and no second
implementation exists to disagree with it
(`docs/research/2026-09-23-launchdarkly.md:88`, `:864`). This package takes on a
permanent conformance obligation in exchange: every implementation, in every
language, produces the same answer for the same document and the same context.
The variants spec's published `bucketOf` vectors and this document's
cross-process fixture are what hold that obligation, and every future change to
bucketing, hashing or ordering has to be checked against both.

### Where the adapter lives

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

The package holds the poller, the fetch bookkeeping, whatever the binding does
with the envelope's advisory `maxStale`, and one adapter per source. Its shape is
small, because `reload` and `parseFeatureConfig` do the work:

```ts
const source = postgresSource({ pool, table: 'features' });
const features = await source.start({ interval: 30_000 });
// source polls, calls features.reload(config), and reports a refused candidate.
```

An adapter that fetches over HTTP revalidates against a version probe and
downloads the body only when the version differs, which is what every product in
the research does with an ETag and a 304. A probe is a few bytes and a version
comparison, and the body changes only when the version does.

### What a control plane serves

A control plane serves a version probe, and the two documents a changed version
points at: the configuration at that version, and the schema at its
`schemaVersion`. `apps/shop-api/src/acl/policy.controller.ts:36-40` is the shape,
one `GET` returning `{ version, matrix }`.

No endpoint ever answers which variant a subject gets. § 8 of the
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
A control plane that must keep a feature away from an audience serves that
audience a document without it, which decision 2 places outside this library.

## Testing

- A round trip. `serializeConfig(features)` through `JSON.stringify`,
  `JSON.parse` and `parseFeatureConfig` produces a store whose `config` deep-equals
  the original with every `Date` replaced by its ISO string, and whose
  `configDigest` equals the original's.
- Digest stability. Two documents differing only in object key order, in
  whitespace, in a `Date` against its ISO string, and in an absent key against one
  written `undefined`, produce one digest. A document differing in the order of a
  `rules` array produces a different one.
- `digest` verification. A document whose `rules` array was reordered and whose
  `digest` was left alone is a `digest-mismatch` issue.
- Rule ids. `serializeConfig` emits every authored `rule.id` unchanged, two rules
  in one feature sharing an id is a `duplicate-rule-id` issue, and a document
  whose rules all carry ids resolves to the same `Decision.rule` values after its
  `rules` array is permuted.
- Variant order. `serializeConfig` emits an `order` on every variant it writes,
  and a document whose `variants` arrays are permuted with their `order` values
  intact assigns every subject the same variant as the document it came from.
  Two variants in one feature sharing an `order` is a `duplicate-variant-order`
  issue, and a fractional or negative one is `invalid-variant-order`.
- `maxStale` is inert. A store built from a document carrying `maxStale: 1` and a
  `now` years later answers exactly as a store built from the same document with
  the member absent, for `resolve`, `plan` and `toggle`.
- An unknown envelope member is an `unknown-member` issue, and `reload` keeps the
  installed document.
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
- `validateConfig` reports all four issues in a document carrying four, and
  each code's message matches the message its thrown counterpart carries.
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

- That JSON Schema's generated Swift and Kotlin are good enough. § 4 recommends
  it for the emitters, and the emitters have not been run against a real variant
  value in this repository. quicktype's output for a nested optional object is
  asserted to be acceptable and has not been read.
- The fence in § 4. The refused keyword list is a judgement about generator
  output quality. An owner with a genuine discriminated union writes an `enum` over
  a discriminant, which is a real restriction on what a variant value may be, and no
  consumer has hit it yet.
- That `schemaVersion` fully answers the drift objection. § 5 rests on a
  publisher never rewriting a schema at a version. Nothing in the library enforces
  that, the same way nothing enforces ACL's `origin:kind` spelling convention. A
  publisher that rewrites `s7` breaks every holder that cached it, silently.
- The `changed` diff's granularity. § 6 says it names keys whose stored intent
  differs. Whether a caller wants the field that differed, or a per-feature diff of
  the shape `diffMatrix` produces for `@evanion/acl`, is untested. Key granularity
  is the cheap answer and may be the wrong one for an operator console.
- That refusing a whole document on an unread member is affordable. § 3 argues it
  from GrowthBook's silent `hashVersion` downgrade, and the argument is about
  bucketing parameters. A document that adds a purely descriptive member would then
  also be refused by every older holder, and whether the envelope needs a second
  class of member that a holder may ignore has not been worked out.
- That the control plane really can assign every rule an id. § 2 assumes the
  authoring surface creates rules as rows. A control plane that stores a feature's
  rules as one JSON blob assigns nothing, and every rule in it falls to the content
  hash of issue #245, which this document does not own.
- That one poller in the sibling package serves every adapter. § 9 assumes one
  poller with an adapter behind it. A source pushing over a websocket has no poll
  interval and fits the shape awkwardly, and no push source has been written.
