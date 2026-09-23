# Unleash and Flagsmith: source-level research

Date: 2026-09-23
Method: I cloned the repositories below and read the evaluation code. Documentation prose is cited only where no source answers the question.

Repositories read (all cloned at `--depth 1` on 2026-09-23):

| Repo | Used for |
|---|---|
| `Unleash/unleash-client-node` | Node backend SDK: bucketing, variants, metrics, impressions, bootstrap |
| `Unleash/unleash-client-go` | Go backend SDK: cross-check of the hash |
| `Unleash/yggdrasil` | The Rust engine Unleash is consolidating SDKs onto |
| `Unleash/client-specification` | Cross-SDK conformance fixtures |
| `Unleash/unleash` (sparse, `src/lib`) | Server: OpenAPI schemas, variant weight normalisation |
| `Flagsmith/flagsmith` | Server: models, mappers, SDK contract schemas |
| `Flagsmith/flagsmith-engine` | Python evaluation engine (the reference implementation) |
| `flagsmith/engine-test-data` | Cross-SDK conformance fixtures |
| `Flagsmith/flagsmith-python-client` | Server-side SDK: polling, offline, analytics, exposure events |
| `Flagsmith/flagsmith-js-client` | Client-side SDK: caching, analytics, typing |

---

## 1. Multivariate flags

### Unleash

A flag carries a `variants` array. Each variant has `name`, `weight`, an optional `weightType`, optional `stickiness`, an optional `payload`, and optional `overrides`.

Weight is an integer 0–1000 on the wire. The UI presents it as 0–100 with one decimal.

`src/lib/openapi/spec/variant-schema.ts`:

```
weight: {
    type: 'number',
    description:
        'The weight is the likelihood of any one user getting this variant. It is a number between 0 and 1000. ...',
    minimum: 0,
    maximum: 1000,
},
weightType: {
    description:
        'Set to fix if this variant must have exactly the weight allocated to it. If the type is variable, the weight will adjust so that the total weight of all variants adds up to 1000',
    type: 'string',
    example: 'variable',
    enum: ['variable', 'fix'],
},
```

The fixed/variable split is real and the server enforces it. `src/lib/features/feature-toggle/feature-toggle-service.ts:2432`:

```ts
fixVariantWeights(variants: IVariant[]): IVariant[] {
    let variableVariants = variants.filter((x) => {
        return x.weightType === WeightType.VARIABLE;
    });

    if (variants.length > 0 && variableVariants.length === 0) {
        throw new BadDataError(
            'There must be at least one "variable" variant',
        );
    }
    ...
    const averageWeight = Math.floor(
        (1000 - fixedWeights) / variableVariants.length,
    );
    let remainder = (1000 - fixedWeights) % variableVariants.length;
    ...
    return variableVariants
        .concat(fixedVariants)
        .sort((a, b) => a.name.localeCompare(b.name));
}
```

Note the final `.sort((a, b) => a.name.localeCompare(b.name))`. The server stores variants in alphabetical name order. That matters for question 8.

Payload is a typed `{type, value}` pair where `value` is always a string:

```
payload: {
    type: 'object',
    required: ['type', 'value'],
    ...
    type: {
        description:
            'The type of the value. Commonly used types are string, number, json and csv.',
        type: 'string',
        enum: ['json', 'csv', 'string', 'number'],
    },
    value: {
        description: 'The actual value of payload',
        type: 'string',
    },
},
```

The node SDK mirrors those four types (`src/variant.ts`):

```ts
export enum PayloadType {
  STRING = 'string',
  JSON = 'json',
  CSV = 'csv',
  NUMBER = 'number',
}
```

Two mechanisms force a specific variant.

Overrides pin a variant to a context value. `src/variant.ts`:

```ts
function findOverride(
  variants: VariantDefinition[],
  context: Context,
): VariantDefinition | undefined {
  return variants
    .filter((variant) => variant.overrides)
    .find((variant) => variant.overrides?.some(overrideMatchesContext(context)));
}
```

Overrides are checked before the weight walk, so they win.

Strategy variants attach a separate variant set to one activation strategy. `src/lib/openapi/spec/strategy-variant-schema.ts`:

```
description:
    "This is an experimental property. It may change or be removed as we work on it. Please don't depend on it yet. A strategy variant allows you to attach any data to strategies instead of only returning `true`/`false`. Strategy variants take precedence over feature variants.",
required: ['name', 'weight', 'weightType', 'stickiness'],
```

Segments do not carry variants. A segment attaches to a strategy (`featureStrategySchema.segments` is a list of numeric ids), and the strategy carries the variants.

### Flagsmith

A flag becomes multivariate when someone adds a `MultivariateFeatureOption`. `api/features/multivariate/models.py`:

```python
class MultivariateFeatureOption(...):
    """
    This class holds the *value* for a given multivariate feature
    option. This value is the same for every environment, but the
    percent allocation is set in MultivariateFeatureStateValue
    which varies per-environment.
    """
    ...
    key = models.CharField(
        max_length=255,
        null=True,
        validators=[validate_slug],
        help_text="A stable, human-readable identifier for the variant.",
    )
    default_percentage_allocation = models.FloatField(
        default=100,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
```

Per-environment weight lives on `MultivariateFeatureStateValue`:

```python
percentage_allocation = models.FloatField(
    validators=[MinValueValidator(0), MaxValueValidator(100)],
)
```

Weight is a float 0–100. Flagsmith has no fixed/variable distinction. Nothing in the model forces the allocations to sum to 100, and the engine handles a shortfall by falling through to the control value (see the loop quoted in question 2).

There is no separate payload. The variant value *is* the flag value. `MultivariateFeatureOption` extends `AbstractBaseFeatureValueModel`, which stores one of three types (`api/features/feature_states/models.py`):

```python
type = models.CharField(
    max_length=10,
    choices=FEATURE_STATE_VALUE_TYPES,
    default=STRING,
    ...
)
boolean_value = models.BooleanField(null=True, blank=True)
integer_value = models.IntegerField(null=True, blank=True)
string_value = models.CharField(...)
```

So the payload types are string, integer, boolean. No JSON type on the server side; the JS SDK will `JSON.parse` a string value on request (`flagsmith-core.ts`, `getValue(key, {json: true})`).

A segment can force a specific variant, indirectly. A segment override is a whole `FeatureContext` with its own `variants` array, and it replaces the default one. `flag_engine/segments/evaluator.py`:

```python
for feature_context in features.values():
    feature_name = feature_context["name"]
    if segment_override := segment_overrides.get(feature_name):
        flags[feature_name] = get_flag_result_from_context(
            context=context,
            feature_context=segment_override["feature_context"],
            reason=f"TARGETING_MATCH; segment={segment_override['segment_name']}",
        )
        continue
```

To pin one variant at 100%, the operator sets that override's allocations accordingly. An identity override (per-user feature state) sets a plain value and skips variants entirely.

### Difference

Unleash separates the variant's payload from the flag's boolean. Flagsmith merges them: a multivariate flag's variant *is* its value, so `enabled` and `value` stay independent. Unleash has fixed vs variable weight and server-side renormalisation to 1000; Flagsmith has neither, and a bad sum silently means "some traffic gets control".

---

## 2. Bucketing

### Unleash

MurmurHash3 x86 32-bit over `"{groupId}:{id}"`, modulo a normaliser, plus one. Two seeds: 0 for rollout, 86028157 for variants.

`unleash-client-node/src/strategy/util.ts`, in full:

```ts
import * as murmurHash3 from 'murmurhash3js';

function normalizedValue(id: string, groupId: string, normalizer: number, seed = 0): number {
  const hash = murmurHash3.x86.hash32(`${groupId}:${id}`, seed);
  return (hash % normalizer) + 1;
}

const STRATEGY_SEED = 0;

export function normalizedStrategyValue(id: string, groupId: string): number {
  return normalizedValue(id, groupId, 100, STRATEGY_SEED);
}

const VARIANT_SEED = 86028157;

export function normalizedVariantValue(id: string, groupId: string, normalizer: number): number {
  return normalizedValue(id, groupId, normalizer, VARIANT_SEED);
}
```

Hash input: group id, then a literal `:`, then the stickiness id. Rollout uses 100 buckets, numbered 1..100. Variant selection uses `totalWeight` buckets, so with weights summing to 1000 there are 1000 buckets.

The Rust engine agrees byte for byte. `yggdrasil/unleash-yggdrasil/src/strategy_parsing.rs:44`:

```rust
pub fn normalized_hash(
    group: &str,
    identifier: &str,
    modulus: u32,
    seed: u32,
) -> std::io::Result<u32> {
    let mut reader = Cursor::new(format!("{}:{}", &group, &identifier));
    murmur3_32(&mut reader, seed).map(|hash_result| hash_result % modulus + 1)
}
```

and `yggdrasil/unleash-yggdrasil/src/lib.rs:43`: `const VARIANT_NORMALIZATION_SEED: u32 = 86028157;`

The Go SDK agrees and says explicitly that it is matching the other SDKs. `unleash-client-go/internal/strategies/helpers.go`:

```go
var VariantNormalizationSeed uint32 = 86028157
...
// We're gonna do something a little different from other SDKs here to avoid allocations
// Typically an SDK concatenates a bunch of strings and applies a murmur3 hash to the result
// That's surprisingly expensive in Go. So for cases where we know the input fits into
// a 256 byte buffer, we can avoid allocations entirely and just use a stack buffer.
func NormalizedVariantValue(id, groupId string, normalizer int, seed uint32) uint32 {
	n := len(groupId) + 1 + len(id)
	if n <= 256 {
		var buf [256]byte
		i := copy(buf[:], groupId)
		buf[i] = ':'
		i++
		i += copy(buf[i:], id)
		x := murmur3.SeedSum32(seed, buf[:i])
		return (x % uint32(normalizer)) + 1
	}
	...
}
```

Rollout comparison is inclusive. `unleash-client-node/src/strategy/flexible-rollout-strategy.ts`:

```ts
const normalizedUserId = normalizedStrategyValue(stickinessId, groupId as string);
return percentage > 0 && normalizedUserId <= percentage;
```

Variant selection walks the variants in array order, accumulating weight until it reaches the target. `unleash-client-node/src/variant.ts`:

```ts
const target = normalizedVariantValue(getSeed(context, stickiness), groupId, totalWeight);

let counter = 0;
const variant = variants.find((v: VariantDefinition): VariantDefinition | undefined => {
  if (v.weight === 0) {
    return undefined;
  }
  counter += v.weight;
  if (counter < target) {
    return undefined;
  }
  return v;
});
```

`groupId` for feature-level variants is the feature name (`selectVariant` passes `feature.name`). For strategy rollout it is `parameters.groupId || context.featureToggle`.

Is it a contract? Yes. Fixtures carry it; no written spec does. `Unleash/client-specification` README:

> "we want the clients to follow specific platform and language conventions, but at the same time we want the clients to adhere to the unleash contract, and give predictable results across platforms."
>
> "This project tries to define the expected results of certain predefined set of feature toggles, using the built-in activation strategies and with a given unleash context."

Entry point is `specifications/index.json`; SDKs parse it to discover the suite. 22 files as of this clone, including `03-gradual-rollout-user-id-strategy.json`, `04-gradual-rollout-session-id-strategy.json`, `05-gradual-rollout-random-strategy.json`, `08-variants.json`, `10-flexible-rollout-strategy.json`, `12-custom-stickiness.json`, `16-strategy-variants.json`, plus constraint operators, semver, CIDR, regex, dependent features, UTF-8 flag names and the delta API. Each file carries a `state` (a `/client/features` response), `tests` (isEnabled cases) and `variantTests` (getVariant cases). It asserts outcomes for given contexts, so a wrong hash fails the suite; it does not publish raw hash vectors.

The suite is outcome-level, not hash-level. There is also `contracts/impact-metrics.md` and JSON schemas under `schema/` for the fixture format itself.

Unleash is additionally consolidating SDK logic onto one Rust core, Yggdrasil, which collapses the algorithm to one implementation. N reimplementations no longer have to agree.

### Flagsmith

MD5 over a comma-joined list of ids, taken as a big integer, mapped to `[0, 100)`. `flagsmith-engine/flag_engine/utils/hashing.py`, in full:

```python
def get_hashed_percentage_for_object_ids(
    object_ids: typing.Iterable[SupportsStr], iterations: int = 1
) -> float:
    """
    Given a list of object ids, get a floating point number between 0 (inclusive) and
    100 (exclusive) based on the hash of those ids. This should give the same value
    every time for any list of ids.
    """

    to_hash = ",".join(str(id_) for id_ in list(object_ids) * iterations)
    hashed_value = hashlib.md5(to_hash.encode("utf-8"))
    hashed_value_as_int = int(hashed_value.hexdigest(), base=16)
    value = ((hashed_value_as_int % 9999) / 9998) * 100

    if value == 100:
        # since we want a number between 0 (inclusive) and 100 (exclusive), in the
        # unlikely case that we get the exact number 100, we call the method again
        # and increase the number of iterations to ensure we get a different result
        return get_hashed_percentage_for_object_ids(
            object_ids=object_ids, iterations=iterations + 1
        )

    return value
```

Separator is `,`. Effectively 9999 buckets, mapped onto a float scale of 0–100 by `/ 9998`. Note that `% 9999` gives 0..9998 and dividing by 9998 gives 0..100 inclusive, which is why the `== 100` retry exists.

For multivariate selection the input list is `[feature_key, identity_key]`, in that order. `flag_engine/segments/evaluator.py`:

```python
if key is not None and (variants := feature_context.get("variants")):
    # Default to the control bucket; a matched named variant overrides this.
    variant = "control"

    percentage_value = get_hashed_percentage_for_object_ids(
        [feature_context["key"], key]
    )

    start_percentage = 0.0

    for feature_value in sorted(
        variants,
        key=operator.itemgetter("priority"),
    ):
        limit = (weight := feature_value["weight"]) + start_percentage
        if start_percentage <= percentage_value < limit:
            reason = f"SPLIT; weight={weight}"
            value = feature_value["value"]
            variant = feature_value.get("key")
            break

        start_percentage = limit
```

Variants are sorted by an explicit `priority` field, then walked as cumulative half-open bands `[start, limit)`.

`key` here is the identity key, which is derived, not supplied:

```python
if identity_context := context.get("identity"):
    if not identity_context.get("key"):
        context = context.copy()
        context["identity"] = {
            **identity_context,
            "key": (
                f"{context['environment']['key']}_{identity_context['identifier']}"
            ),
        }
```

So the identity key is `{environment_api_key}_{identifier}` when the server does not send a numeric one. Environment key is in the hash input transitively, which is why the same user buckets differently per environment.

For percentage-split segment conditions the input list is `[segment_key, context_value]` and the comparison is `<=`:

```python
if condition_operator == constants.PERCENTAGE_SPLIT:
    if context_value is None:
        return False

    object_ids = [segment_key, context_value]

    try:
        float_value = float(condition["value"])
    except ValueError:
        return False
    return get_hashed_percentage_for_object_ids(object_ids) <= float_value
```

The Django server has its own copy of the multivariate walk for remote evaluation, importing the same hashing function. `api/features/models.py:807`:

```python
def get_multivariate_feature_state_value(
    self, identity_hash_key: str
) -> AbstractBaseFeatureValueModel:
    mv_options = list(self.multivariate_feature_state_values.all())

    percentage_value = get_hashed_percentage_for_object_ids(
        [self.mv_hashing_seed, identity_hash_key]
    )
    ...
    start_percentage = 0
    for mv_option in sorted(mv_options, key=lambda o: o.id):
        limit = getattr(mv_option, "percentage_allocation", 0) + start_percentage
        if start_percentage <= percentage_value < limit:
            return mv_option.multivariate_feature_option

        start_percentage = limit

    # if none of the percentage allocations match the percentage value we got for
    # the identity, then we just return the default feature state value
    return getattr(self, "feature_state_value", None)
```

Contract and conformance: Flagsmith publishes a JSON Schema for the evaluation context at `flagsmith/sdk/evaluation-context.json` (plus `evaluation-result.json` and `openapi.yaml`), and a shared fixture repo `flagsmith/engine-test-data` described as:

> "E2E tests for all Flagsmith Engine implementations."

The Python engine consumes it as a git submodule pinned to a tag (`.gitmodules`: `url = https://github.com/flagsmith/engine-test-data.git`, `branch = v3.11.0`). The clone has 219 test cases, 109 of which contain a `variants` array, so multivariate bucketing is covered. Each case is `{context, result}` and the test harness asserts `get_evaluation_result(context) == result`. The schema itself documents the bucketing inputs:

`sdk/evaluation-context.json`, `EnvironmentContext.key`:

> "Unique environment key. May be used for selecting a value for a multivariate feature, or for % split segmentation."

`FeatureContext.key`:

> "Unique feature key used when selecting a variant if the feature is multivariate. Set to an internal identifier or a UUID, depending on Flagsmith implementation."

Neither product publishes raw hash test vectors. Both publish outcome fixtures.

### Difference

Unleash hashes `"group:id"` with MurmurHash3 into integer buckets. Flagsmith hashes `"a,b"` with MD5 into a float percentage. Unleash keys the rollout hash on a `groupId` the operator controls, so an operator can deliberately reshuffle. Flagsmith keys it on a feature-state identifier the operator does not control, so reshuffling is not an operator action.

Unleash's variant hash input is the *feature name* (a string an operator can rename). Flagsmith's is a numeric feature-state seed (renaming the flag does not move anyone).

---

## 3. Sticky bucketing

### Unleash

Stickiness names the context field that feeds the hash. It is a selector, not stored state.

Strategy stickiness, `unleash-client-node/src/strategy/flexible-rollout-strategy.ts`:

```ts
resolveStickiness(stickiness: string, context: Context): string | undefined {
    switch (stickiness) {
      case STICKINESS.default:
        return context.userId || context.sessionId || this.randomGenerator();
      case STICKINESS.random:
        return this.randomGenerator();
      default:
        return resolveContextValue(context, stickiness);
    }
}
```

Variant stickiness, `unleash-client-node/src/variant.ts`:

```ts
const stickinessSelectors = ['userId', 'sessionId', 'remoteAddress'];

function getSeed(context: Context, stickiness: string = 'default'): string {
  if (stickiness !== 'default') {
    const value = resolveContextValue(context, stickiness);
    return value ? value.toString() : randomString();
  }
  let result: string | undefined;
  stickinessSelectors.some((key: string): boolean => {
    const value = context[key];
    if (typeof value === 'string' && value !== '') {
      result = value;
      return true;
    }
    return false;
  });
  return result || randomString();
}
```

Note the default selector order differs between rollout (`userId`, `sessionId`) and variants (`userId`, `sessionId`, `remoteAddress`). Also note `feature.variants?.[0]?.stickiness` in `selectVariant`: the whole variant set takes its stickiness from the first variant.

Does it survive a weight change? No. The target is `hash % totalWeight`, and the walk is cumulative over an alphabetically sorted array. Change any weight and both the modulus and the band boundaries move, so subjects are reassigned. Nothing is stored anywhere.

The docs say the same, and say the only deliberate reshuffle lever is the group id:

> "Variant stickiness is derived from the stickiness defined on the activation strategy" and "ensures that the same user consistently sees the same variant." Reassignment occurs by modifying the strategy's `groupId` parameter.
> (https://docs.getunleash.io/reference/strategy-variants)

### Flagsmith

Also stateless. The percentage value is deterministic from `[feature_key, identity_key]`, and the bands are cumulative in `priority` order. Change a weight and the bands move, so subjects are reassigned. No assignment is persisted.

But Flagsmith went further on one specific instability, and this is the most interesting thing I found. The bucketing input used to be the feature state's database id, so recreating a feature state (a new version, a restored segment override) rerolled everyone. They added a lineage-stable seed. `api/features/models.py:772`:

```python
@property
def mv_hashing_seed(self) -> int:
    """The seed for multivariate variant bucketing: a lineage constant — the
    id of the first state created for this (environment, feature, segment)
    lineage, carried forward on every recreation so enrolled identities keep
    their variant (#7913). States predating the salt column fall back to
    their own id, the seed used until now.
    """
    return self.mv_hashing_salt or self.id
```

and the hook that carries it forward, `api/features/models.py:872`:

```python
@hook(BEFORE_CREATE)
def inherit_mv_hashing_salt(self):
    """Keep multivariate bucketing stable across recreation: a new row
    superseding a live state in its lineage adopts that state's seed
    (#7913). Identity overrides have no versioned lineage; the feature type
    check confines the lineage query to rows where bucketing matters.
    """
    if (
        self.mv_hashing_salt is not None
        or self.identity_id is not None
        or self.feature.type != MULTIVARIATE
    ):
        return

    if superseded := self.get_superseded_live_feature_state():
        self.mv_hashing_salt = superseded.mv_hashing_seed
```

The mapper then feeds that seed to the engine in the field the engine already hashed on, so no schema change was needed. `api/util/mappers/engine.py:155`:

```python
# The engine and SDKs seed multivariate variant allocation on django_id,
# so feeding it the bucketing seed keeps variant assignment stable when
# a feature state is recreated, without changing the engine model or
# environment document schema. See issue #7913.
django_id=feature_state.mv_hashing_seed,
```

This makes assignment stable across *version* changes, not across *weight* changes. A weight change still moves the bands.

### Difference

Neither product stores an assignment. Both reassign on a weight change. Flagsmith has invested in keeping the hash *input* stable across operational churn (versioning, recreation); Unleash's variant hash input is the feature name and its rollout hash input is an operator-editable `groupId`, so Unleash treats reshuffling as a lever, not a hazard.

---

## 4. Config distribution

### Unleash

Backend SDKs fetch the full configuration and evaluate locally. Node defaults, `unleash-client-node/src/unleash.ts:65`:

```ts
refreshInterval = 15 * 1000,
metricsInterval = 60 * 1000,
...
experimentalMode = { type: 'polling', format: 'full' },
```

15 second poll, 60 second metrics push. Three transport modes, `src/unleash-config.ts`:

```ts
export type Mode = { type: 'polling'; format: 'delta' | 'full' } | { type: 'streaming' };
```

Streaming is SSE against `/client/streaming` (`src/repository/streaming-fetcher.ts:175`):

```ts
return new EventSource(resolveUrl(this.url, './client/streaming'), { ... });
```

Delta polling applies incremental events (`feature-updated`, `feature-removed`, `segment-updated`, `segment-removed`, `hydration`). No whole document crosses the wire. See `applyFeatureResponse` in `src/repository/index.ts`.

Revision: ETag with conditional requests. `src/repository/polling-fetcher.ts`:

```ts
if (res.status === 304) {
  ...
  if (res.headers.get('etag') !== null) {
    this.etag = res.headers.get('etag') as string;
  } else {
    this.etag = undefined;
  }
```

Frontend SDKs get something different: evaluated results only. `src/lib/openapi/spec/frontend-api-feature-schema.ts`:

```
required: ['name', 'enabled', 'impressionData'],
...
enabled: {
    type: 'boolean',
    example: true,
    description: 'Always set to `true`.',
},
```

No strategies, no constraints, no weights, no disabled flags. `enabled` is literally always `true`, so the payload is "the list of flags on for this context, with the variant already chosen".

Two components serve that path. The Frontend API is built into the server:

> "The Unleash Frontend API simplifies connecting client-side applications to Unleash. It has a straightforward setup and is built directly into Unleash."
> Endpoint: `<your-unleash-instance>/api/frontend`. Default refresh 10 seconds plus a random offset, tunable via `FRONTEND_API_REFRESH_INTERVAL_MS`.
> (https://docs.getunleash.io/reference/front-end-api)

Unleash Edge is the scalable version:

> "A lightweight caching layer designed to improve scalability, performance, and resilience" that "sits between your application SDKs and the Unleash API, functioning as a read replica."
>
> Backend SDKs "Fetch the full feature flag configuration from Edge and evaluate flags locally using activation strategies."
>
> Frontend SDKs "Send evaluation requests to Edge, which evaluates flags server-side and returns only the results."
> (https://docs.getunleash.io/reference/unleash-edge)

The justification given is data residency, not just payload size:

> Edge "evaluates feature flags for frontend SDKs directly on the Edge node, ensuring that sensitive user data required for evaluation is never sent upstream to Unleash."
> (https://docs.getunleash.io/reference/unleash-edge)

Token types enforce the split. From https://docs.getunleash.io/concepts/api-tokens-and-client-keys:

> Backend tokens: "Reading feature flag information, Registering applications with the Unleash server, Sending usage metrics". "Backend tokens are secrets and must not be exposed to end users."
>
> Frontend tokens: "Reading enabled flags for a given context, Registering applications with the Unleash server, Sending usage metrics". "Frontend tokens are not considered secret and are safe to expose client-side."

### Flagsmith

Two evaluation modes, chosen by SDK configuration.

Local evaluation: the SDK pulls an environment document and evaluates in-process. Python default, `flagsmith/flagsmith.py:76`:

```python
environment_refresh_interval_seconds: typing.Union[int, float] = 60,
```

Docs confirm:

> "When running in Local Evaluation Mode, the SDK requests the Environment Document from the Flagsmith API. This contains all the information required to make flag evaluations."
> "Every 60 seconds (by default), it will repeat this asynchronous request to ensure that the environment information it has is up to date."
> (https://docs.flagsmith.com/clients/server-side)

with a caveat that matters for identity evaluation:

> "Only the traits provided to the SDK at runtime will be used. Local Evaluation mode, by design, does not make any network requests to the Flagsmith API when evaluating flags for an identity."

Remote evaluation: the SDK POSTs the identity and traits and gets back a per-user answer. This is the default for client-side SDKs and the only mode the Edge Proxy serves to clients:

> "The Edge Proxy connects to the Flagsmith API to download environment documents, and your Flagsmith client applications connect to it using remote flag evaluation."
> (https://docs.flagsmith.com/deployment-self-hosting/edge-proxy)

> "The Edge API provides a datastore and Edge compute API that is replicated across 8 AWS regions, with latency-based routing and global failover in the event of a region outage." "calls need[] an environment key supplied with each request as an HTTP header named X-Environment-Key."
> (https://docs.flagsmith.com/performance/edge-api)

Streaming exists. It carries a change *signal*, not a payload. `flagsmith-python-client/flagsmith/streaming_manager.py` opens an SSE connection and maps events; the docs describe the content:

> Each event message is "a JSON object containing a Unix epoch timestamp of the environment's last update" in this format: `{ "updated_at": 3133690620000}`.
> "Real-time flag updates require an Enterprise subscription."
> (https://docs.flagsmith.com/advanced-use/real-time-flags)

So the SSE stream tells the SDK to refetch; it does not carry the config.

Revision on the payload: not found for the environment document. I looked in `flagsmith-python-client/flagsmith/flagsmith.py` (`update_environment`), `flagsmith-js-client/flagsmith-core.ts`, and `flagsmith/api/environments/` for ETag or If-None-Match handling and found none. The nearest thing is the SSE `updated_at` timestamp, and the JS client's local cache timestamp `json.ts`.

Client-side keys are public by design:

> Client-side SDKs: "The Environment Key is public."
> (https://docs.flagsmith.com/clients/overview)

### Difference

Unleash's frontend path returns pre-evaluated results and nothing else, and Unleash gives a privacy argument for it (user data stays at the edge). Flagsmith's remote-evaluation path returns pre-evaluated results too, but the identity and traits land in Flagsmith's datastore by default (see question 9), which is the opposite privacy posture.

Unleash has an ETag/304 on the config payload. Flagsmith, as far as I could find, does not; it uses a timestamp over SSE to trigger a refetch.

Unleash's streaming carries the config deltas. Flagsmith's streaming carries only "something changed at time T".

---

## 5. Offline and stale config

### Unleash

Three fallbacks, applied on start in parallel. `unleash-client-node/src/repository/index.ts:170`:

```ts
async start(): Promise<void> {
    await Promise.all([this.fetcher.start(), this.loadBackup(), this.loadBootstrap()]);
}
```

Backup is a file on disk, written on every successful save. Default storage provider is `new FileStorageProvider(backupPath)`, file name `unleash-backup-${safeName(key)}.json` (`src/repository/storage-provider-file.ts:19`). `loadBackup` bails if the repository is already ready, so live data wins.

Bootstrap can come from inline data, a URL or a file. `src/repository/bootstrap-provider.ts`:

```ts
async readBootstrap(): Promise<ClientFeaturesResponse | undefined> {
    if (this.data) {
      return { version: 2, segments: this.segments, features: [...this.data] };
    }
    if (this.url) {
      return this.loadFromUrl(this.url);
    }
    if (this.filePath) {
      return this.loadFromFile(this.filePath);
    }

    return undefined;
}
```

Bootstrap never overwrites live data unless `bootstrapOverride` is set. `src/repository/index.ts:210`:

```ts
} else if (!this.connected) {
  // Only allow bootstrap if not connected
  this.applyFeatureResponse(response);
}
```

Per-call fallback: `isEnabled(name, context, fallbackFunction | fallbackValue)`, used when the SDK is not ready.

TTL or staleness bound: none. There is no expiry on the backup file and no clock that stops the SDK serving. I checked `src/repository/index.ts`, `src/unleash.ts` and `src/unleash-config.ts`; nothing bounds the age of cached data.

Unleash's `stale` field is a lifecycle marker, not an evaluation input. `src/lib/openapi/spec/client-feature-schema.ts`:

```
stale: {
    description:
        'If this is true Unleash believes this feature flag has been active longer than Unleash expects a flag of this type to be active',
    type: 'boolean',
    example: false,
},
```

In `unleash-client-node/src`, `stale` appears exactly once, as a field declaration in `feature.ts:17`. No evaluation code reads it. A stale flag keeps serving.

### Flagsmith

Server-side SDK has an explicit offline mode plus two handler hooks. `flagsmith-python-client/flagsmith/flagsmith.py:85`:

```python
offline_mode: bool = False,
offline_handler: typing.Optional[OfflineHandler] = None,
```

with validation:

```python
if offline_mode and not offline_handler:
    raise ValueError("offline_handler must be provided to use offline mode.")
elif default_flag_handler and offline_handler:
    raise ValueError("Cannot use both default_flag_handler and offline_handler.")
```

The shipped handler reads an environment document from a file, `flagsmith/offline_handlers.py`:

```python
class LocalFileHandler:
    """
    Handler to load evaluation context from a local JSON file containing the environment document.
    The JSON file should contain the environment document as returned by the Flagsmith API.
    """
```

Docs:

> "To run the SDK in a fully offline mode, you can set the client to offline mode. This will prevent the SDK from making any calls to the Flagsmith API."
> "It can be used alongside Offline Mode to evaluate flags in environments with no network access" or "as a means of defining the behaviour for evaluating default flags, when something goes wrong."
> "Default flags are configured by passing in a function that is called when a flag cannot be found or if the network request to the API fails."
> (https://docs.flagsmith.com/clients/server-side)

The JS client has an actual TTL, and this is the one place either product bounds staleness. `flagsmith-js-client/flagsmith-core.ts`:

```ts
cacheOptions = {ttl:0, skipAPI: false, loadStale: false, storageKey: undefined as string|undefined}
```

and the check at line 498:

```ts
if (this.cacheOptions.ttl) {
    if (!json.ts || (new Date().valueOf() - json.ts > this.cacheOptions.ttl)) {
        ...
        this.log("Ignoring cache, timestamp is too old ts:" + json.ts + " ttl: " + this.cacheOptions.ttl + " time elapsed since cache: " + (new Date().valueOf()-json.ts)+"ms")
    ...
        this.log("Loading stale cache, timestamp ts:" + json.ts + " ttl: " + this.cacheOptions.ttl + ...)
```

Default `ttl: 0` means no expiry. Setting a ttl makes the SDK *ignore* the cache and go to the API, unless `loadStale` is set, in which case the stale cache is used while the API request is in flight. There is a warning for the footgun combination:

```ts
if (!this.cacheOptions.ttl && this.cacheOptions.skipAPI) {
    console.warn("Flagsmith: you have set a cache ttl of 0 and are skipping API calls, this means the API will not be hit unless you clear local storage.")
}
```

Does a stale configuration stop serving? No, in both products. Flagsmith's TTL expiry makes the SDK prefer the network. If the network fails, the SDK falls back to `defaultFlags` (`flagsmith-core.ts:562`) and still answers.

### Difference

Flagsmith's JS client has a configurable cache TTL with explicit stale-while-revalidate (`loadStale`). Unleash has no TTL anywhere. Unleash's backup file is automatic and always on; Flagsmith's offline document is something you must wire up.

Neither product ever fails closed on age.

---

## 6. Exposure events

### Unleash

The SDK emits an impression event at evaluation, inside `isEnabled` and `getVariant`, and only for flags marked `impressionData`. `unleash-client-node/src/client.ts:120`:

```ts
isEnabled(name: Name, context: Context, fallback: () => boolean): boolean {
    const feature = this.repository.getToggle(name);
    const enabled = this.isFeatureEnabled(feature, context, fallback).enabled;

    if (feature?.impressionData) {
      this.emit(
        UnleashEvents.Impression,
        createImpressionEvent({
          featureName: name,
          context,
          enabled,
          eventType: 'isEnabled',
        }),
      );
    }

    return enabled;
}
```

and at `client.ts:215` the same for `getVariant`, adding `variant: variant.name`.

The event shape, `src/events.ts`:

```ts
export interface ImpressionEvent {
  eventType: 'isEnabled' | 'getVariant';
  context: Context;
  enabled: boolean;
  featureName: string;
  variant?: string;
}
```

It is a local EventEmitter event. Unleash does not ship it anywhere. The application subscribes and forwards it to its own analytics.

Per-flag opt-in:

> "Impression data is strictly an opt-in feature and must be enabled on a per-flag basis." "Unleash will not emit impression events for flags not marked as such."
> (https://docs.getunleash.io/concepts/impression-data)

Deduplication: none in the SDK. Every `isEnabled` call on a flagged feature emits. The docs do not mention dedup either. Turning it off means clearing `impressionData` on the flag.

Separately, Unleash has aggregate usage metrics, which are a different thing. `src/metrics.ts` keeps a bucket of `{yes, no, variants: {name: count}}` per flag name, POSTed to `/client/metrics` every `metricsInterval` (default 60s). No context, no user. Disabled with `disableMetrics`.

### Flagsmith

Two mechanisms.

Flag analytics is a counter, not an event. `flagsmith-python-client/flagsmith/analytics.py`:

```python
def track_feature(self, feature_name: str) -> None:
    self.analytics_data[feature_name] = self.analytics_data.get(feature_name, 0) + 1
    if (datetime.now() - self._last_flushed).seconds > ANALYTICS_TIMER:
        self.flush()
```

with `ANALYTICS_TIMER: typing.Final[int] = 10` and endpoint `analytics/flags/`. The JS client does the same, keyed by environment api key (`flagsmith-core.ts:965`), flushed on a 10 second interval (`this.ticks = 10000`). It fires at evaluation, inside `getValue` and `hasFeature`, and can be skipped per call:

```ts
if (!options?.skipAnalytics && !skipAnalytics) {
    this.evaluateFlag(key, "VALUE");
}
```

Off by default:

> "Flag analytics are disabled by default in our SDKs. You need to explicitly enable it when you initialize the Flagsmith client."
> (https://docs.flagsmith.com/advanced-use/flag-analytics)

Exposure events are the newer, experiment-grade mechanism, and they are deduplicated. `flagsmith-python-client/flagsmith/analytics.py`:

```python
FLAG_EXPOSURE_EVENT: typing.Final[str] = "$flag_exposure"

class ExposureKey(typing.NamedTuple):
    feature_name: typing.Optional[str]
    identifier: typing.Optional[str]
    value: typing.Optional[str]
```

```python
if event == FLAG_EXPOSURE_EVENT:
    # An exposure is defined by who saw which variant of which
    # feature; equal exposures within one flush interval add no
    # information, so only the first is buffered.
    exposure_key = ExposureKey(
        feature_name=feature_name,
        identifier=identifier,
        value=str(value) if value is not None else None,
    )
    if exposure_key in self._buffered_exposure_keys:
        logger.debug(...)
        return
    self._buffered_exposure_keys.add(exposure_key)
```

Dedup key: `(feature_name, identifier, value)`. Scope: one flush interval, since `flush()` does `self._buffered_exposure_keys.clear()`. Config: `EventProcessorConfig(events_api_url=DEFAULT_EVENT_API_URL, max_buffer_items=1000, flush_interval_seconds=10.0)`, posting to `{events_api_url}v1/events`.

Emission is explicit and narrow. `flagsmith/flagsmith.py:360`:

```python
def get_experiment_flag(self, feature_name, identifier, traits=None):
    """
    Resolve a flag for an identity and record an exposure event.

    The exposure event's ``value`` is the flag's variant key. It is only
    sent when the flag exists, is enabled and the identity is enrolled in
    the feature's experiment (``flag.experiment.in_experiment``) with a
    variant; any other outcome is logged and skipped to keep experimentation data
    clean. A `DefaultFlag` served via the `default_flag_handler` counts
    as the feature not existing.
    """
```

and it refuses to send without an identifier:

```python
if not identifier:
    logger.warning(
        "Not sending %s for feature %s: an exposure requires an"
        " identifier to reconcile with conversion events.",
        FLAG_EXPOSURE_EVENT,
        feature_name,
    )
    return
```

Both are at evaluation, not at render. Neither product has a render hook.

### Difference

Unleash's impression event never leaves the process; the application is the transport. Flagsmith ships both mechanisms to Flagsmith's own endpoints.

Unleash has no deduplication at all. Flagsmith dedupes exposures on `(feature, identifier, variant)` per flush window, and its flag analytics is a counter so dedup is moot.

Unleash opts in per flag, by an operator, in the flag config. Flagsmith opts in per client, by a developer, at SDK init, plus per call via `skipAnalytics`.

---

## 7. Typing and codegen

### Unleash

Not found. I searched `Unleash/unleash` (`src/lib`), the client-specification repo, and the docs via web search for "code generation", "typed flag accessors" and "generate types". The docs recommend hand-written constants:

> it's recommended to centralize flag name definitions using constants or enums, which establishes a single source of truth for all flag names in an application.
> (https://docs.getunleash.io/guides/manage-feature-flags-in-code)

The Node SDK types `isEnabled(name: Name, ...)` where `Name` is a plain string type.

The only generation in the Unleash codebase is OpenAPI-driven API client typing, which is about the admin API surface, not about flag names.

### Flagsmith

Not found as a code generator. The JS SDK does offer type parameters you supply yourself. `flagsmith-js-client/types.d.ts`:

```ts
export declare type IFlags<F extends string = string> = Record<F, IFlagsmithFeature>;
export declare type ITraits<T extends string = string> = Record<T, IFlagsmithTrait>;
```

So `flagsmith<'my_flag' | 'other_flag', 'age'>` narrows flag and trait names, but the union is hand-written.

There is an open issue asking for generated types, and it is about the OpenAPI schema, not flag names: https://github.com/Flagsmith/flagsmith/issues/6627 ("Auto-generate Typescript types from OpenAPI schema").

Nothing for Swift or Kotlin in either product. I searched the docs and the GitHub organisations for both.

The adjacent thing that does exist is the OpenFeature CLI, which generates typed accessors from a flag manifest for TypeScript, Go, C# and others. It is vendor-neutral and neither product ships it. It reads a manifest file you maintain, not a live flag configuration. See https://github.com/orgs/open-feature/discussions/383.

### Difference

Neither ships codegen. Flagsmith at least threads a flag-name type parameter through its JS SDK types; Unleash does not.

---

## 8. Flag and rule identity

### Unleash

Strategies have a stable uuid. `src/lib/openapi/spec/feature-strategy-schema.ts`:

```
id: {
    type: 'string',
    description: 'A uuid for the feature strategy',
    example: '6b5157cb-343a-41e7-bfa3-7b4ec3044840',
},
...
sortOrder: {
    type: 'number',
    description: 'The order of the strategy in the list',
    example: 9999,
},
```

Segments have numeric ids; the strategy references them as `segments: [1, 2]`, and the SDK builds `Map<number, Segment>` from them (`unleash-client-node/src/repository/index.ts:205`).

Variants have no id. They are identified by `name`, which is also the sort key (`fixVariantWeights` ends with `.sort((a, b) => a.name.localeCompare(b.name))`).

Consequences:

Reordering strategies changes nothing in evaluation. Strategies are ORed: "Evaluation strategies for this flag. Each entry in this list will be evaluated and ORed together" (`client-feature-schema.ts`). `sortOrder` is display only.

Inserting a variant moves everyone. The array is alphabetical by name and the walk is cumulative, so a new variant named `aaa` shifts every existing variant's band. Adding a variant also changes `totalWeight`, which changes the modulus, which rerolls the hash target for every subject.

Changing a rollout percentage is monotone and safe. `normalizedStrategyValue` is independent of the percentage, and the test is `normalizedUserId <= percentage`, so raising the percentage only adds subjects and never removes one. Changing the *variant* weights is not safe, per above.

The one thing downstream that depends on identity is the hash input. Rollout hashes on `parameters.groupId`, so renaming the group reshuffles the rollout. Feature-level variants hash on the feature name, so renaming the flag reshuffles the variants.

### Flagsmith

Variants carry two stable identifiers. `MultivariateFeatureOption` has a `uuid` (via `AbstractBaseExportableModel`) and a `key`:

```python
key = models.CharField(
    max_length=255,
    null=True,
    validators=[validate_slug],
    help_text="A stable, human-readable identifier for the variant.",
)

class Meta:
    unique_together = ("feature", "key")
```

That `key` is what the engine reports as the chosen variant (`variant = feature_value.get("key")` in `evaluator.py`), so downstream analytics reconcile on it.

Ordering is by an explicit `priority`, derived from the database id. `api/util/engine_models/context/mappers.py`:

```python
sorted_mv_values = sorted(
    multivariate_feature_state_values,
    key=_get_multivariate_feature_state_value_id,
)
feature_context["variants"] = [
    {
        "value": mv_value.multivariate_feature_option.value,
        "weight": mv_value.percentage_allocation,
        "priority": idx,
    }
    for idx, mv_value in enumerate(sorted_mv_values)
]
```

So ordering is creation order, not name order, and an operator cannot reorder variants from the UI at all. A newly added variant lands last, which means it takes a band at the top of the range and does not shift the variants before it, provided their weights are unchanged. That is a materially better insertion story than Unleash's alphabetical sort.

Segments have a `key` and a `priority` on the override; ties go to context order. `flag_engine/segments/evaluator.py`:

```python
def _wins_over(candidate, incumbent) -> bool:
    """
    Whether a segment override takes precedence over the one held so far.

    Lower priority wins, and the first seen wins a tie, so that precedence
    follows context order rather than the order segments happen to be
    evaluated in.
    """
    return incumbent is None or candidate.get(
        "priority", constants.DEFAULT_PRIORITY
    ) < incumbent.get("priority", constants.DEFAULT_PRIORITY)
```

Feature states carry `uuid` and `django_id`, and the bucketing seed is a *lineage* identifier, not a row identifier, as quoted in question 3. So recreating a feature state does not reroll assignments.

Changing a percentage allocation moves the band boundaries and reassigns, same as Unleash.

### Difference

Flagsmith gives variants a stable slug (`key`) and orders them by creation. Unleash identifies variants only by name and orders them alphabetically, so the *name you choose* determines where a variant sits in the cumulative walk.

Unleash gives strategies a uuid but evaluation does not use it. Flagsmith makes the feature-state lineage id the bucketing seed and has gone to some trouble to keep it stable.

---

## 9. PII in events

### Unleash

Aggregate metrics carry no user data. The bucket is `{toggles: {name: {yes, no, variants: {variantName: count}}}, start, stop}` plus registration data. `src/metrics.ts:427`:

```ts
getClientData(): RegistrationData {
    return {
      appName: this.appName,
      instanceId: this.instanceId,
      sdkVersion: this.sdkVersion,
      strategies: this.strategies,
      started: this.started,
      interval: this.metricsInterval,
      connectionId: this.connectionId,
      platformName: this.platformData.name,
      platformVersion: this.platformData.version,
      yggdrasilVersion: null,
      specVersion: SUPPORTED_SPEC_VERSION,
      sdkFlavor: this.sdkFlavor,
      sdkFlavorVersion: this.sdkFlavorVersion,
    };
}
```

`instanceId` defaults to a hostname, which is infrastructure identity, not user identity.

Impression events carry the *entire* Unleash context, including `userId`, `sessionId`, `remoteAddress` and all custom properties (`ImpressionEvent.context: Context` in `src/events.ts`). No hashing, no redaction, no opt-out short of disabling impression data for the flag. It never leaves the process though, so the application decides what to do with it.

The frontend path is where context crosses the wire: a frontend SDK sends its context to the Frontend API or Edge as request parameters so the server can evaluate. Edge's stated purpose is to stop that context going further:

> Edge "evaluates feature flags for frontend SDKs directly on the Edge node, ensuring that sensitive user data required for evaluation is never sent upstream to Unleash."
> (https://docs.getunleash.io/reference/unleash-edge)

I found no hashing or anonymisation option anywhere in the Unleash SDK or server code I read.

### Flagsmith

Flag analytics carries `{feature_name: count}` and an environment key header. No identifiers. `flagsmith/analytics.py`:

```python
session.post(
    self.analytics_endpoint,
    data=json.dumps(self.analytics_data),
    ...
    headers={
        "X-Environment-Key": self.environment_key,
        "Content-Type": "application/json",
    },
)
```

Exposure events carry the identifier and the traits, verbatim:

```python
self._buffer.append(
    {
        "event": event,
        "feature_name": feature_name,
        "identifier": identifier,
        "value": str(value) if value is not None else None,
        "traits": dict(traits) if traits else None,
        "metadata": {**(metadata or {}), "sdk_version": __version__},
        "timestamp": int(datetime.now().timestamp() * 1000),
    }
)
```

No hashing. The identifier is required, as quoted in question 6, and the stated reason is reconciliation with conversion events.

The larger PII surface is remote evaluation itself, because identities and traits are *persisted*, not just transmitted:

> "Identities are persisted within the Flagsmith platform, along with any traits that have been assigned to them."
> (https://docs.flagsmith.com/basic-features/managing-identities)

Flagsmith offers an opt-out per request:

> "In some privacy-sensitive cases, you may want to evaluate flags based on traits without persisting those traits in Flagsmith long term. Transient traits and identities let you send data for evaluation while avoiding long-lived storage in the platform."
> (https://docs.flagsmith.com/basic-features/managing-identities)

Transient is opt-in, so persistence is the default. There is also the per-environment `hide_sensitive_data` flag (`api/environments/models.py:149`, applied in `api/environments/sdk/serializers_mixins.py`), which strips fields from SDK responses; that is about outbound data, not about what is stored.

### Difference

Unleash's default is that no user identifier reaches Unleash from a backend SDK, and Edge exists specifically so none reaches the control plane from a frontend SDK either. Flagsmith's default is that remote evaluation persists the identity and its traits in Flagsmith, and you opt out per request with transient traits.

Unleash's impression event is rich in PII but stays in your process. Flagsmith's exposure event is rich in PII and is shipped to Flagsmith.

---

## 10. Withholding flags from clients

### Unleash

Yes, structurally. The Frontend API returns only enabled flags, with no configuration. `frontend-api-feature-schema.ts` lists exactly four properties: `name`, `enabled` (documented as "Always set to `true`"), `impressionData`, and an optional resolved `variant` with its payload. There are no strategies, no constraints, no segments, no weights, no disabled flags.

A frontend token cannot reach `/api/client/features`. From https://docs.getunleash.io/concepts/api-tokens-and-client-keys, a frontend token permits "Reading enabled flags for a given context" while a backend token permits "Reading feature flag information".

Unleash presents the split as both security and operational:

> "Backend tokens are secrets and must not be exposed to end users."
> "Frontend tokens are not considered secret and are safe to expose client-side."

The security framing is real: the token type is an authorisation boundary enforced by the server, and the payload difference is a consequence.

What I could not find is a per-flag "hide from frontend" switch. The granularity is the whole environment via token type. If a flag is on for a context, a frontend SDK sees its name and its variant payload.

### Flagsmith

Yes, and per flag. `api/features/models.py:129`:

```python
is_server_key_only = models.BooleanField(default=False)
```

It is a filter applied at the API boundary, not a payload transform. `api/features/views.py:1091`:

```python
return filters & Q(feature__is_server_key_only=False)
```

and `api/environments/identities/views.py:281`:

```python
return Q(feature__is_server_key_only=False)
```

and it is also honoured when building the environment document for the engine, `api/util/mappers/engine.py:323`:

```python
if (feature := feature_state.feature).is_server_key_only
```

Two related controls exist:

`hide_disabled_flags` (`api/environments/models.py:133`) omits disabled flags from SDK responses, per environment with a project-level default:

```python
def get_hide_disabled_flags(self) -> bool:
    if self.hide_disabled_flags is not None:
        return self.hide_disabled_flags
    return self.project.hide_disabled_flags
```

`hide_sensitive_data` (`api/environments/models.py:149`) strips fields from SDK responses, applied in `api/environments/sdk/serializers_mixins.py`.

The docs frame the client/server split operationally and factually. They claim no security guarantee:

> Client-side SDKs: "Fast UI updates, easy to implement for UI-related features", "The Environment Key is public."
> Server-side SDKs: "Secure environment, full access to all targeting rules."
> (https://docs.flagsmith.com/clients/overview)

### Difference

Flagsmith has a per-flag switch (`is_server_key_only`) and Unleash does not. Unleash's control is coarser (token type, whole environment) but structurally stronger for the flags that do ship, because the frontend payload contains no rule configuration at all. Flagsmith's client-side SDKs in remote evaluation also receive no rules, since the server evaluated them, so the practical gap is smaller than the model suggests; the real gap is that Flagsmith lets you keep a specific flag's *existence* off the client.

---

## Where Unleash and Flagsmith disagree with each other

Hash function. Unleash uses MurmurHash3 x86 32-bit over `"group:id"` with two seeds (0 and 86028157) into integer buckets. Flagsmith uses MD5 over `"a,b"` into a float in `[0, 100)` via `% 9999 / 9998 * 100`. Flagsmith's choice makes float weights natural; Unleash's makes integer-thousandths natural.

What is in the hash input. Unleash hashes a name an operator can edit: `groupId` for rollout, the feature name for variants. Flagsmith hashes a database-derived seed the operator cannot touch. Unleash treats reshuffling as a feature; Flagsmith treats it as a bug and spent a schema column (`mv_hashing_salt`) making the seed survive feature-state recreation.

Variant ordering. Unleash sorts variants alphabetically by name, so adding a variant named early in the alphabet shifts every other variant's band. Flagsmith orders by creation, so a new variant appends and (weights held constant) does not disturb the ones before it.

Weight model. Unleash has fixed vs variable weights, renormalises to 1000 server-side, and rejects a variant set with no variable member. Flagsmith has plain 0–100 floats, no renormalisation, and silently serves control for any uncovered range.

Payload. Unleash's variant payload is a typed `{type, value}` with a string value and four types (json, csv, string, number), orthogonal to the flag's boolean. Flagsmith's variant *is* the flag value, typed string/integer/boolean, with JSON parsed client-side on request.

Variant identity. Flagsmith variants have a uuid and a slug `key`, and `key` is what the engine returns. Unleash variants have only a name.

PII posture. Unleash's Edge exists to keep user context from reaching the control plane. Flagsmith's remote evaluation persists identities and traits by default, with transient traits as an opt-out.

Exposure events. Unleash emits an in-process EventEmitter event and ships nothing; the application is the pipeline. Flagsmith ships `$flag_exposure` with identifier, variant and traits to its own events endpoint, deduped on `(feature, identifier, value)` per flush window.

Config revision. Unleash uses ETag plus 304 on the config payload, and offers delta polling and SSE streaming of the config itself. Flagsmith's SSE carries only `{"updated_at": <ms>}` and I found no ETag on the environment document.

Withholding. Flagsmith has a per-flag `is_server_key_only`. Unleash has no per-flag equivalent, only the frontend token's structurally reduced payload.

Staleness. Flagsmith's JS client has a cache TTL with explicit stale-while-revalidate. Unleash has no TTL and no staleness bound anywhere I looked.

Shared engine. Unleash is consolidating all SDKs onto one Rust core (Yggdrasil). Flagsmith reimplements the engine per language against a shared fixture suite.

## What surprised me

Flagsmith's `mv_hashing_salt`. A whole column, two lifecycle hooks and a lineage query, added so that recreating a feature state does not reroll every enrolled identity. That is the bug you only find after running experiments in anger. The comment naming the issue number is at `api/features/models.py:772`.

Unleash sorting variants alphabetically. `fixVariantWeights` ends with `.sort((a, b) => a.name.localeCompare(b.name))`, and the SDK's cumulative walk depends on array order. So the variant name is load-bearing for bucket assignment. Renaming `control` to `a_control` reassigns traffic.

Unleash's two different default stickiness selector lists. Rollout falls back through `userId`, `sessionId`. Variants fall through `userId`, `sessionId`, `remoteAddress`. A context with only `remoteAddress` gets a random rollout answer and a sticky variant answer.

Unleash's `stale` field is inert. It appears once in the whole Node SDK source, as a type declaration. It never reaches evaluation.

Flagsmith's flag "analytics" is not events. It is a `{name: count}` map POSTed every 10 seconds. The thing that behaves like an exposure event (`$flag_exposure`) is separate, newer, gated on `enable_events`, and refuses to fire without an identifier.

Flagsmith's identity key is `f"{environment_key}_{identifier}"` when no numeric id is supplied, which means the environment key is inside the bucketing hash. Promoting a config between environments moves everyone.

Flagsmith's engine has flag-to-flag dependencies with cycle detection, including a `cycle_hits` counter so the engine discards a segment whose verdict rested on an unresolvable flag and does not count it as a non-match. That is more machinery than I expected in a flag engine.

The Go SDK's murmur implementation writes into a 256-byte stack buffer with a heap fallback, with a comment specifically warning future maintainers not to "simplify" it. Cross-SDK hash agreement is apparently fragile enough to need a comment.

Both products' conformance suites assert outcomes, not hashes. Neither publishes raw hash vectors. A third-party SDK author validates by running ~220 (Flagsmith) or 22-file (Unleash) fixture sets and checking the answers match.

## Where I could not verify

ETag or revision on the Flagsmith environment document. I read `flagsmith-python-client/flagsmith/flagsmith.py` (`update_environment`, `_get_json_response`), `flagsmith-js-client/flagsmith-core.ts`, and grepped `flagsmith/api/environments/` for ETag and If-None-Match. Found nothing. Absence of evidence, not evidence of absence; the Edge API or a proxy layer may add one.

Unleash impression event deduplication. The Node SDK has none (verified in source). The docs page on impression data does not mention dedup. I did not check every frontend SDK, and the docs note "Some front-end SDKs emit impression events only when a flag is enabled", which implies per-SDK variation I did not enumerate.

Swift and Kotlin codegen. I searched docs and the GitHub organisations for both products via web search only. I did not clone the iOS or Android SDKs.

Flagsmith Edge Proxy internals. I read the docs page but did not clone `Flagsmith/edge-proxy`, so my claims about what it serves rest on documentation prose, not source.

Whether Flagsmith validates that percentage allocations sum to 100. The model validators only bound each value to 0–100, and I did not find a serializer-level sum check. I did not read every serializer in `api/features/multivariate/`.

Unleash Edge's frontend evaluation code path. I read the Rust engine (`Unleash/yggdrasil`) and the docs for Edge, but did not clone `Unleash/unleash-edge` itself, so the claim that Edge evaluates with Yggdrasil rests on the blog post and the Edge docs.

The exact `variant` field semantics in Flagsmith's older environment documents. `engine-test-data` fixtures show `variants` entries with `priority` values that are raw database ids (3402, 3404) while the current mapper emits `enumerate` indices. Both sort the same way, but I did not confirm every SDK tolerates both shapes.
