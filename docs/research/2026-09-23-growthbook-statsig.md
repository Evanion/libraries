# GrowthBook and Statsig: experimentation-first platforms

Research date: 2026-09-23.

Evidence method: I cloned `github.com/growthbook/growthbook` (main, shallow) and `github.com/growthbook/growthbook-js` (the pre-1.0 standalone JS SDK, package version 0.12.0) and read the source and the docs `.mdx` files that ship in the monorepo under `docs/`. Repo paths below are paths inside `growthbook/growthbook` unless marked otherwise. Statsig answers come from docs.statsig.com and the statsig-io GitHub repositories.

---

## 1. Multivariate flags

### GrowthBook

A multi-variant test is declared as an experiment rule on a feature, or as an experiment object passed to `run()`. The rule carries `variations` (an array of values), `weights` (floats), `coverage`, and `meta` (per-variation key and name).

`packages/sdk-js/src/types/growthbook.ts:23`:

```ts
export type FeatureRule<T = any> = {
  id?: string;
  condition?: ConditionInterface;
  force?: T;
  variations?: T[];
  weights?: number[];
  ...
  meta?: VariationMeta[];
  seed?: string;
```

Weights must sum to 1, and the SDK silently replaces them with equal weights when they do not. `packages/sdk-js/src/util.ts:216`:

```ts
  // If weights don't add up to 1 (or close to it), default to equal weights
  const totalWeight = weights.reduce((w, sum) => sum + w, 0);
  if (totalWeight < 0.99 || totalWeight > 1.01) {
    ...
    weights = equal;
  }
```

The same rule applies when the weights array length does not match the variation count (`packages/sdk-js/src/util.ts:207`). The spec states the contract as `docs/lib/build-your-own.mdx:110`: "**weights** (`float[]`) - How to weight traffic between variations. Must add to 1."

A variation carries a typed payload because the variation *is* the feature value. Feature types are boolean, string, number, JSON (`docs/features/basics.mdx:41`): "Features can be a simple ON/OFF flag or a more complex data type (string, number, or JSON)." The SDK's value type is `JSONValue` (`packages/sdk-js/src/types/growthbook.ts:451`), so a variation payload is any JSON value. JSON flags can also be schema-validated (`docs/features/basics.mdx:54`): "**JSON** flags also support JSON Schema validation, which lets you enforce the structure of the value before it reaches your application."

A targeting rule can force a value for a segment, and GrowthBook is explicit that this is a different rule type from an experiment and that it logs nothing. `docs/features/rules.mdx` rule-type table:

```
|                   | Targeting rule                      | Experiment                        |
| **Randomization** | Optional (percentage rollout)       | Random split                      |
| **Tracking**      | No                                  | Yes                               |
```

and `docs/features/rules.mdx:44`: "**Forced value** — everyone who matches gets the value." Rules are ordered and first match wins (`docs/features/rules.mdx:14`): "GrowthBook evaluates them top to bottom and the **first matching rule wins**."

There is also a per-experiment `force` field inside the evaluation algorithm (`packages/sdk-js/src/core.ts:711`, step 11 "Experiment has a forced variation"), plus `forcedVariations` in the SDK context and a query-string override (`getQueryStringOverride`, `packages/sdk-js/src/util.ts:233`).

### Statsig

Groups are declared in the console or through the Console API, not in application code. The Console API experiment schema (https://docs.statsig.com/console-api/experiments) takes a `groups` array of `{name, size, parameterValues, description?, isControl?, disabled?}`, where `size` is a number from 0 to 100 and `parameterValues` is "A map of parameter name to the value this group serves". The experiment itself carries `allocation` (0-100), `targetingGateID` ("Restrict your experiment to users passing the selected feature gate"), `controlGroupID` and `launchedGroupID`.

Each group compiles into one rule with `passPercentage: 100` plus a single `user_bucket` condition holding a cumulative threshold. From the checked-in ruleset fixture `statsig-io/go-sdk: download_config_specs.json`, experiment `sample_experiment`:

```
Control 2RamGsERWbWMIMnSfOlQuX pass 100  [('user_bucket','lt',500)]  {'experiment_param':'control', ...}
Test    2RamGujUou6h2bVNQWhtNZ pass 100  [('user_bucket','lt',1000)] {'experiment_param':'test', ..., 'bool':True}
```

https://docs.statsig.com/sdks/how-evaluation-works states the model: "Group assignment: The user's bucket (based on the experiment salt) determines which group they fall into. **Groups are cumulative ranges across 1000 buckets.**"

Whether sizes must sum to 100 is not stated in the docs I read (the experiment overview, create-new, and Console API pages). Mechanically the last group's cumulative threshold in the fixture is 1000, which covers the whole bucket space, and buckets past the last threshold fall through to the spec's `defaultValue`. Record this as not found.

A variant carries an arbitrary JSON object as its payload. The rule field is `returnValue`, typed `unknown` in `statsig-io/js-client-monorepo: packages/client-core/src/DownloadConfigSpecsResponse.ts` (`SpecRule`) and `map[string]interface{}` in Go. The fixture's `returnValue` mixes a string and a boolean in one object. The SDK surface exposes per-parameter typed getters over that object. The documented list of allowed parameter types was not verified from a fetched page.

Forcing a variant for a segment is supported by three mechanisms, all of which run ahead of bucketing. https://docs.statsig.com/sdks/how-evaluation-works: "ID overrides: Specific user/unit IDs mapped to a group", "Conditional overrides: Segment or gate-based overrides, evaluated in order", and "Overrides always take precedence because they appear first in the rule list." The overrides doc says they "force chosen users into a specific experiment group instead of the group that randomization would assign", that "You can override individual IDs, or add overrides based on feature gates and segments", and that Statsig "evaluates ID overrides first, then conditional overrides from top to bottom". Users first exposed through an override are excluded from Pulse results. A targeting gate is a separate thing and only gates users in or out: "Targeting gate: Users who fail the targeting gate receive default values." SDK-local overrides also exist, with rule id `"override"` and reason `LocalOverride` (`statsig-io/go-sdk: evaluator.go:360-405`).

---

## 2. Bucketing

### GrowthBook

Both hash versions live in one function, `packages/sdk-js/src/util.ts:19`:

```ts
function hashFnv32a(str: string): number {
  let hval = 0x811c9dc5;
  const l = str.length;
  for (let i = 0; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  return hval >>> 0;
}

export function hash(seed: string, value: string, version: number): number | null {
  // New unbiased hashing algorithm
  if (version === 2) {
    return (hashFnv32a(hashFnv32a(seed + value) + "") % 10000) / 10000;
  }
  // Original biased hashing algorithm (keep for backwards compatibility)
  if (version === 1) {
    return (hashFnv32a(value + seed) % 1000) / 1000;
  }
  // Unknown hash version
  return null;
}
```

The v1 form matches the old standalone SDK exactly. `growthbook-js` v0.12.0, `src/index.ts:181`:

```ts
    // 14. Compute a hash
    const n = (hashFnv32a(hashValue + experiment.key) % 1000) / 1000;
```

So v1 is `fnv32a(value + seed) % 1000 / 1000`, with no separator between the two strings, 1000 buckets, and the seed appended after the value. In the old SDK the seed was literally the experiment key. v2 is `fnv32a(fnv32a(seed + value) + "") % 10000 / 10000`: the order flips to seed-first, the result is re-hashed after being converted back to a decimal string, and the bucket count goes to 10000. There is no separator character in either version, which means `seed="ab"`, `value="c"` and `seed="a"`, `value="bc"` collide under v2.

The seed is `experiment.seed || experiment.key` (`packages/sdk-js/src/core.ts:655`):

```ts
  const n = hash(
    experiment.seed || key,
    hashValue,
    experiment.hashVersion || 1,
  );
```

The value is the hash attribute's value, `id` by default, with an optional `fallbackAttribute` when sticky bucketing is on (`packages/sdk-js/src/core.ts:1044`, `getHashAttribute`).

Note the default: when a payload carries no `hashVersion`, the SDK uses version 1. Two other call sites differ. Namespace filters default to 2 (`packages/sdk-js/src/core.ts:947`, `hash(filter.seed, hashValue, filter.hashVersion || 2)`), rollout inclusion defaults to 1 (`packages/sdk-js/src/core.ts:971`), and the legacy `inNamespace` helper is pinned to 1 (`packages/sdk-js/src/util.ts:60`, `hash("__" + namespace[0], hashValue, 1)`).

Stated reason for v2, `docs/lib/build-your-own.mdx:293`:

> The original hash version (1) had a flaw that caused bias when running experiments in parallel.

and `docs/lib/build-your-own.mdx:310`:

> **Note**: It's important to use the exact hashing algorithms outlined here so all SDKs behave identically.

That one sentence is the entirety of GrowthBook's public explanation that I could find. The code comment says the same thing in two words, "Original biased hashing algorithm". The spec changelog dates the change to `docs/lib/build-your-own.mdx:1209`: "**v0.4.0** 2023-02-24", listing "Changed signature of `hash` method and added multiple hashing versions". I did not find a blog post, RFC, issue, or design note explaining the correlation mechanism in more detail; see "Where I could not verify".

New experiments get version 2 and old ones were migrated to it. `packages/back-end/src/util/migrations.ts:758`:

```ts
  // Add hashVersion field
  experiment.hashVersion = experiment.hashVersion || 2;
```

`packages/back-end/src/services/features.ts:372` sets `hashVersion: 2` for newly created rules.

Version 2 can still be stripped back out on the wire. The payload builder filters rule keys by the capabilities declared on the SDK Connection. `packages/shared/src/sdk-versioning/sdk-payload.ts:26`:

```ts
export const BUCKETING_V2_RULE_KEYS = [
  "hashVersion",
  "range",
  "ranges",
  "meta",
  "seed",
  "name",
  "phase",
] as const;
```

`getPayloadAllowedKeys` includes those keys only when `capabilities.includes("bucketingV2")`. An SDK Connection pinned to an old SDK version therefore receives rules with no `hashVersion`, and `experiment.hashVersion || 1` puts that traffic back on the biased algorithm.

The algorithm is published as a contract that third-party implementations must match. `docs/lib/build-your-own.mdx:12`: "All libraries should follow this specification as closely as the language permits" and line 14: "an extensive test suite with over 400 language-agnostic unit tests in JSON format. All SDKs must pass 100% of these test cases."

The conformance suite is `packages/sdk-js/test/cases.json`. Its `specVersion` field reads `0.8.1`. Case counts by section, from the file itself:

| Section | Cases |
| --- | --- |
| evalCondition | 273 |
| run | 73 |
| feature | 55 |
| contextualBandit | 35 |
| getQueryStringOverride | 16 |
| inNamespace | 16 |
| hash | 15 |
| getBucketRange | 13 |
| chooseVariation | 13 |
| stickyBucket | 13 |
| decrypt | 10 |
| getEqualWeights | 6 |
| urlRedirect | 4 |

Each entry is a positional array, documented at `docs/lib/build-your-own.mdx:1118`. A hash case is `[seed, value, hashVersion, expected]`, for example `["", "a", 1, 0.22]` and `["ef", "d", 1, 0.652]`. A sticky bucket case carries a name, the SDK context, existing assignment docs, the feature key, the expected `FeatureResult`, and the expected assignment docs after evaluation:

```json
["use fallbackAttribute when missing hashAttribute",
 {"attributes":{"anonymousId":"123"}, "features":{...}}, [], "feature",
 {"bucket":0.863,"featureId":"feature","hashAttribute":"anonymousId","hashUsed":true,
  "hashValue":"123","inExperiment":true,"key":"3","stickyBucketUsed":false,
  "value":3,"variationId":3},
 {"anonymousId||123":{"assignments":{"feature__0":"3"},"attributeName":"anonymousId",
  "attributeValue":"123"}}]
```

So the suite covers condition evaluation, hashing at both versions, bucket range construction, variation choice, full feature and experiment evaluation, namespaces, query-string overrides, payload decryption, sticky bucket read and write, URL redirects, and contextual bandits. It does not cover network fetching, caching, streaming, or the tracking callback's firing behaviour, which the spec describes in prose only.

Bucket ranges are `[start, start + coverage * weight]` per variation with a running cumulative start, `packages/sdk-js/src/util.ts:226`:

```ts
  let cumulative = 0;
  return weights.map((w) => {
    const start = cumulative;
    cumulative += w;
    return [start, start + (coverage as number) * w];
  }) as VariationRange[];
```

`inRange` is half-open: `return n >= range[0] && n < range[1]` (`packages/sdk-js/src/util.ts:53`). `chooseVariation` returns the first matching range index and `-1` otherwise (`packages/sdk-js/src/util.ts:66`).

### Statsig

Two different hashes do two different jobs, and they use different bucket counts.

Rule pass percentage, three parts joined by literal dots. `statsig-io/go-sdk: evaluator.go:693` (I read this file directly):

```go
func evalPassPercent(user User, rule configRule, spec configSpec) bool {
	ruleSalt := rule.Salt
	if ruleSalt == "" {
		ruleSalt = rule.ID
	}
	if rule.PassPercentage == 0.0 { return false }
	if rule.PassPercentage == 100.0 { return true }

	hash := getHashUint64Encoding(spec.Salt + "." + ruleSalt + "." + getUnitID(user, rule.IDType))
	return float64(hash%10000) < (rule.PassPercentage * 100)
}
```

`statsig-io/node-js-server-sdk: src/Evaluator.ts:1166` computes `computeUserHash(config.salt + '.' + (rule.salt ?? rule.id) + '.' + (getUnitID(user, rule.idType) ?? ''))` and compares against `CONDITION_SEGMENT_COUNT = 10 * 1000` (line 50). `statsig-io/statsig-server-core: statsig-rust/src/evaluation/evaluator.rs:768` does the same through `hashing.evaluation_hash_dot3(spec_salt, rule_salt, unit_id)`.

Group assignment inside an experiment, two parts, 1000 buckets. `statsig-io/go-sdk: evaluator.go:800` (read directly):

```go
	case strings.EqualFold(condType, "user_bucket"):
		if salt, ok := cond.AdditionalValues["salt"]; ok {
			value = int64(getHashUint64Encoding(fmt.Sprintf("%s.%s", salt, getUnitID(user, cond.IDType))) % 1000)
		}
```

`statsig-io/node-js-server-sdk: src/Evaluator.ts:1329` matches, with `USER_BUCKET_COUNT = 1000`. The condition salt on a group rule is the experiment's own salt; the layer-allocation rule carries a different salt.

The hash is SHA-256 over the UTF-8 string, with the first eight bytes read big-endian as a uint64. `statsig-io/go-sdk: util.go:23` and `:40` (read directly):

```go
func getHash(key string) []byte {
	hasher := sha256.New()
	bytes := []byte(key)
	hasher.Write(bytes)
	return hasher.Sum(nil)
}

func getHashUint64Encoding(key string) uint64 {
	hash := getHash(key)
	return binary.BigEndian.Uint64(hash)
}
```

`statsig-io/node-js-server-sdk: src/utils/EvaluatorUtils.ts:18` uses `sha256Hash(userHash).getBigUint64(0, false)`, false meaning big-endian. The Rust core appends `b"."` between parts in `compute_bytes_for_key` and reads `u64::from_be_bytes` (`statsig-rust/src/hashing/memo_sha_256.rs:122`).

The docs describe the same thing: "Statsig passes the user identifier … through a SHA256 hashing function, combined with the salt, which produces a large integer" and "applies a modulus operation with 10000 (or 1000 for layers)" (https://docs.statsig.com/sdks/how-evaluation-works).

Salts are server-generated UUIDs per gate, experiment and layer (fixture: `"salt": "8f1b8801-37ec-4ad8-8f62-901acd336caa"`). A rule's salt falls back to its rule id when empty, in all three implementations above. Admins can copy salts between experiments: "Statsig lets you copy and set the salts used for deterministic hashing. One example is a series of related experiments that must reuse control and test buckets. … Only Project Administrators can use this option."

Layers hold one rule per member experiment, carrying `configDelegate`, with its own allocation salt. From the fixture, layer `a_layer`: rule `experimentAssignment`, `passPercentage 100`, `configDelegate "sample_experiment"`, a `user_bucket` condition with operator `any` over a list of bucket ids, and `additionalValues.salt = "58d96daa-…"`. The docs state the independence explicitly: "Layer allocation and group assignment use different salts, so a user's position in the layer is independent of their group assignment within the experiment." Delegation is `_evalDelegate` in node and `evalDelegate` in Go (`evaluator.go:678`).

Statsig has no analogue of GrowthBook's hash-version switch. Grepping `hashVersion|hash_version` across go-sdk, node-js-server-sdk and statsig-server-core returns no hits. The `hash_used: 'none' | 'sha256' | 'djb2'` field on the client initialize response (`js-client-monorepo: packages/client-core/src/InitializeResponse.ts`) hashes config *names* in the payload, not units. The bucketing hash is fixed SHA-256 everywhere. The nearest thing to a version is a per-spec `configVersion` carried through evaluations and sticky values.

The algorithm is not published as a contract a third-party must match. The docs point at the code: "For more details, go to the open-source SDK evaluator." There is no public conformance suite or vector set that I could find. The cross-SDK check is a private endpoint gated on a Statsig API key:

- `statsig-io/python-sdk: tests/test_server_sdk_consistency.py` posts to `api + "/rulesets_e2e_test"` with a `STATSIG-API-KEY` header, asserts `os.environ["test_api_key"]`, and prints "THIS TEST IS EXPECTED TO FAIL FOR NON-STATSIG EMPLOYEES!". Its `TEST_URLS` list is currently commented out ("issues with e2e endpoint, will re enable later").
- `statsig-io/go-sdk: evaluation_test.go:116` hits the same endpoint.
- `statsig-io/node-js-server-sdk: src/__tests__/ClientInitializeResponseConsistency.test.ts` requires `process.env.test_api_key` and is `xdescribe`d ("Disabled until optimizations are complete").
- `statsig-io/java-server-sdk: src/test/java/com/statsig/sdk/APIEvaluationConsistencyTestData.kt` exists.

Public fixture rulesets exist per SDK (`statsig-server-core: statsig-rust/tests/data/eval_proj_dcs.json` with `tests/expected_evaluation_tests.rs`, and `go-sdk/download_config_specs.json`), but they are that SDK's own test data. `github.com/statsig-io/rulesets-eval-project` returns 404.

---

## 3. Sticky bucketing

### GrowthBook

The unit of storage is one document per identifier, holding a map of experiment key to variation key. `packages/sdk-js/src/core.ts:1156` and `:1164`:

```ts
function getStickyBucketExperimentKey(experimentKey, experimentBucketVersion) {
  experimentBucketVersion = experimentBucketVersion || 0;
  return `${experimentKey}__${experimentBucketVersion}`;
}

export function getStickyBucketAttributeKey(attributeName, attributeValue) {
  return `${attributeName}||${attributeValue}`;
}
```

So the stored shape is `{attributeName, attributeValue, assignments: {"<expKey>__<bucketVersion>": "<variationKey>"}}`, keyed by `"<attributeName>||<attributeValue>"`. The stored value is the variation *key* from `meta`, not the index. Note what is absent: no weights, no coverage, no timestamp, no experiment version beyond the integer `bucketVersion`.

The SDK writes it. `packages/sdk-js/src/core.ts:765` writes the assignment during evaluation, immediately before the tracking callback fires at line 795, and only when the merged document differs from what was already stored:

```ts
    if (changed) {
      // update local docs
      ctx.user.stickyBucketAssignmentDocs = ctx.user.stickyBucketAssignmentDocs || {};
      ctx.user.stickyBucketAssignmentDocs[attrKey] = doc;
      // save doc
      ctx.user.saveStickyBucketAssignmentDoc(doc);
    }
```

Where it lands depends on the `StickyBucketService` you inject. `packages/sdk-js/src/sticky-bucket-service.ts` ships `LocalStorageStickyBucketService` (prefix `gbStickyBuckets__`, line 139), `ExpressCookieStickyBucketService` (line 172, default `cookieAttributes = { maxAge: 180 * 24 * 3600 * 1000 }`), `BrowserCookieStickyBucketService` (line 227, js-cookie), and a Redis service. `docs/app/sticky-bucketing.mdx`: "You may use one of our built-in Sticky Bucketing Services or implement your own. We provide common drivers for browser-generated cookies, backend-generated cookies, browser LocalStorage, and Redis stores."

Weight changes mid-experiment do not disturb stored users, because a found sticky bucket skips bucket-range evaluation entirely. `packages/sdk-js/src/core.ts:671`:

```ts
  if (!foundStickyBucket) {
    const ranges = experiment.ranges || getBucketRanges(...);
    assigned = chooseVariation(n, ranges);
  }
```

The operator-facing rules are in `docs/app/making-experiment-changes.mdx`. Changing the traffic split is listed under changes that are not "safe":

> We recommend this approach [new phase, re-randomize] for any change that is not considered "safe" (listed above). This can include (but not limited to):
> - Changing the traffic split (weights) between variations

and sticky bucketing adds an option to leave existing users alone:

> If you have Sticky Bucketing enabled, you may also elect to apply changes to new traffic only, leaving already-bucketed users in their existing (sticky) buckets. An example of this scenario could be decreasing the percent of people included in the experiment for all new incoming users, but leaving existing users in their existing buckets.

Starting a new phase clears assignments by default, by incrementing `bucketVersion` so the composite key no longer matches:

> By default when starting a new phase, these bucketed users will be reassigned (their sticky bucket will be cleared). You may instead choose to block these users from the experiment going forward (in which case they will still see the control). This strategy is only available in the "advanced" mode.

The block path is `minBucketVersion`. `packages/sdk-js/src/core.ts:1130`:

```ts
  // users with any blocked bucket version (0 to minExperimentBucketVersion - 1) are excluded from the test
  if (expMinBucketVersion > 0) {
    for (let i = 0; i < expMinBucketVersion; i++) {
      const blockedKey = getStickyBucketExperimentKey(expKey, i);
      if (assignments[blockedKey] !== undefined) {
        return { variation: -1, versionIsBlocked: true };
      }
    }
  }
```

A stored assignment naming a variation that no longer exists is discarded and the user is re-bucketed. `packages/sdk-js/src/core.ts:1145`:

```ts
  const variationKey = assignments[id];
  if (variationKey === undefined)
    // no assignment found
    return { variation: -1 };
  const variation = expMeta.findIndex((m) => m.key === variationKey);
  if (variation < 0)
    // invalid assignment, treat as "no assignment found"
    return { variation: -1 };
```

The lookup is by variation key against the current `meta` array, so deleting or renaming a variation drops every user who was stored under it back into fresh hashing. There is no error and no exclusion.

Off by default, on two levels. The org must enable it (`docs/app/sticky-bucketing.mdx`: "In the GrowthBook app, go to **Settings** → **General** → **Experiment Settings** and enable the Sticky Bucketing toggle"), and the SDK does nothing unless a service is injected, since every sticky path is guarded by `ctx.user.saveStickyBucketAssignmentDoc && !experiment.disableStickyBucketing` (`packages/sdk-js/src/core.ts:538`). It is also a paid feature, flagged `<CommercialFeature feature="sticky-bucketing" />` at the top of the doc.

The stated reason for the default is not given as a sentence. What the docs give instead is a cost: the fallback attribute that sticky bucketing enables breaks random assignment. `docs/app/sticky-bucketing.mdx`, "Bias Risk":

> Because of the fallback attribute and sticky bucketing, however, they will both get assigned the same variation. This breaks one of the statistical assumptions of A/B testing - that each user is randomly assigned a variation.

> Bottom line: with Fallback Attributes, you can get a more consistent within-session and cross-device user experience at the expense of statistical rigor. With GrowthBook, we let you decide this trade-off for yourself on a per-experiment basis.

The fallback read merges two documents, with the primary attribute's assignments winning. `packages/sdk-js/src/core.ts:1188`:

```ts
  if (fallbackKey && ctx.user.stickyBucketAssignmentDocs[fallbackKey]) {
    Object.assign(assignments, ctx.user.stickyBucketAssignmentDocs[fallbackKey].assignments || {});
  }
  if (ctx.user.stickyBucketAssignmentDocs[hashKey]) {
    Object.assign(assignments, ctx.user.stickyBucketAssignmentDocs[hashKey].assignments || {});
  }
```

### Statsig

Statsig calls it persistent assignment, and it stores a whole frozen evaluation, not a group name. The schema is declared universal across SDKs. `statsig-io/node-js-server-sdk: src/interfaces/IUserPersistentStorage.ts`:

```ts
export type StickyValues = {
  value: boolean; json_value: Record<string, unknown>; rule_id: string;
  group_name: string | null; secondary_exposures: SecondaryExposure[];
  undelegated_secondary_exposures: SecondaryExposure[];
  config_delegate: string | null; explicit_parameters: string[] | null;
  time: number; configVersion?: number | undefined;
};
export type UserPersistedValues = Record<string, StickyValues>;
```

with the comment "The properties of this struct must fit a universal schema that when JSON-ified, can be parsed by every SDK supporting user persistent evaluation." The same struct appears in `statsig-io/go-sdk: user_persistent_storage_interface.go` and `statsig-server-core: statsig-rust/src/persistent_storage/persistent_storage_trait.rs`.

Storage is whatever you supply behind a `load(key)` / `save(key, configName, data)` / `delete(key, configName)` interface. The key is `"<unitID>:<idType>"`: Go `fmt.Sprintf("%s:%s", unitID, idType)`, node `` `${unitID ?? ''}:${idType}` ``, Rust `format!("{id_str}:{id_type}")`. The docs say: "The `key` string is a combination of ID and ID Type: for example, '123:userID' or 'abc:stableID'." On the client the same adapter pattern runs over localStorage or a remote store (`@statsig/js-user-persisted-storage`, `UserPersistentOverrideAdapter`).

The SDK writes it, inside `getExperiment` or `getLayer`, and only for real experiment groups. `statsig-io/node-js-server-sdk: src/Evaluator.ts`, `_evalConfig`:

```ts
const evaluation = this._evalSpec(ctx);
if (evaluation.is_experiment_group) {
  this.persistentStore.save(user, spec.idType, spec.name, evaluation);
}
```

Go does the same through `evalAndSaveToPersistentStorage`. Docs: "save the current user's evaluation on first evaluation (only when the experiment or layer is active)" and "load the previously saved evaluation on subsequent evaluations".

When an operator changes weights mid-experiment, the stored evaluation wins and nothing re-buckets. The persistent assignment doc opens with: "Persistent assignment lets you ensure that a user's variant stays consistent while an experiment is running, **regardless of changes to allocation or targeting**." In code, an entry in `userPersistedValues` for the spec name makes `_evalConfig` return `ConfigEvaluation.fromStickyValues(...)` and skip `_evalSpec` entirely. One opt-in escape exists, `persistentAssignmentOptions.enforceTargeting` ("boolean, default: false — Whether to enforce targeting rules before assigning persisted values"), which re-runs targeting and falls back to a fresh evaluation on failure. It has limited SDK support.

A stored assignment naming a group that no longer exists keeps serving. `fromStickyValues` rebuilds value, rule_id, group_name, json_value and explicit_parameters from the stored blob and sets `is_experiment_group = true`, with no check against the current ruleset. The guards that do exist are coarser. For experiments, node runs `if (userPersistedValues == null || !spec.isActive) { this.persistentStore.delete(...); return this._evalSpec(ctx); }`, and Go the same at `evaluator.go:199`. For layers, the stored `config_delegate` is looked up and must still be active, else the entry is deleted and the user re-evaluated (`_evalLayer` in node, `allocatedExperimentExistsAndIsActive` in Go). The docs list the same two triggers: "Statsig deletes persisted values when: You call `getExperiment` with `user_persisted_values=None`; The experiment isn't active."

So the deletion rule keys on the experiment's active flag, not on the group's existence. Deleting or renaming a group inside a still-active experiment leaves stored users on the old payload. That is the opposite of GrowthBook, which drops a stale variation key and re-buckets (question 3 above).

Off by default, with two separate opt-ins. Without a storage adapter every load, save and delete is a no-op, and even with an adapter nothing is sticky unless the caller passes `userPersistedValues` into the evaluation call. The docs describe both steps ("Providing a storage adapter at Statsig initialization…", "Providing user persisted values to `get_experiment`…") but give no stated reason for the default. The nearest rationale they publish is about ending an experiment: "Users already exposed continue to receive their control or treatment experience, if you configured Persistent Assignment" (https://docs.statsig.com/experiments/ending/stop-assignments).

Language coverage, from the server doc: "Statsig supports this only in `Go`, `Ruby`, `Legacy Node`, `Node Core`, `Java Core`, `Kotlin`, `.Net`, `Python Core`, `PHP Core`, `Rust Core`".

---

## 4. Config distribution

### GrowthBook

A client SDK receives rules, not answers. The payload type is `packages/sdk-js/src/types/growthbook.ts:486`:

```ts
export type FeatureApiResponse = {
  features?: FeatureDefinitions;
  dateUpdated?: string;
  encryptedFeatures?: string;
  experiments?: AutoExperiment[];
  encryptedExperiments?: string;
  savedGroups?: SavedGroupsValues;
  encryptedSavedGroups?: string;
  contextualBandits?: ContextualBanditDefinitions;
  encryptedContextualBandits?: string;
};
```

`docs/app/api.mdx` shows the shape served at the SDK endpoint, with `condition` and `force` inline in the rules.

A server SDK receives the same payload from the same endpoint with the same client key. The difference is the instance class: `GrowthBookClient` (`packages/sdk-js/src/GrowthBookClient.ts`) is the stateless multi-user form for servers, and `GrowthBook` is the single-user form. Both share `core.ts` and both fetch through `feature-repository.ts`.

The payload is scoped, not per-user. It is scoped to one environment: `docs/features/environments.mdx:37`: "Each SDK Connection is tied to a specific environment and has its own unique SDK key. When the SDK fetches its configuration, it receives **only the features and rules for that environment**". It can be scoped to a project: "SDK connections can be scoped to a project to reduce payload size" (`docs/features/environments.mdx:55`). It is filtered by the declared SDK capabilities (`packages/shared/src/sdk-versioning/sdk-payload.ts`, `getPayloadAllowedKeys`). Disabled features are dropped: "When a feature is disabled for an environment, GrowthBook excludes the feature from the API response" (`docs/features/environments.mdx:26`).

Remote evaluation returns a per-user answer, and GrowthBook justifies it as security. `docs/self-host/remote-evaluation.mdx`:

> Remote Evaluation brings the security benefits of a backend SDK to client-side environments by evaluating feature flags exclusively on a private server. This ensures that sensitive information within targeting rules and unused features and experiment variations are never exposed to the client.

> The primary benefit is **security**: sensitive targeting rules, unused variations, business logic, and experiment configuration details remain hidden on your server and never get exposed to the client.

> **Added Latency** - Each evaluation requires a network request to your remote evaluation endpoint... **Reduced Cacheability** - The SDK payload cannot be cached and reused across users or when user attributes change

The client posts its attributes to your endpoint (`packages/sdk-js/src/feature-repository.ts:433`):

```ts
      ? helpers.fetchRemoteEvalCall({
          host: apiHost,
          clientKey,
          payload: {
            attributes: instance.getAttributes(),
            forcedVariations: instance.getForcedVariations(),
            forcedFeatures: Array.from(instance.getForcedFeatures().entries()),
            url: instance.getUrl(),
          },
```

Exposure events survive the round trip: "Client SDK fires any experiment tracking callbacks (experiment exposure events); these are deferred by the remote evaluation endpoint and hydrated back to the client and are only fired when needed."

Version marker on the payload: `dateUpdated` (a string timestamp) in the response body. I found no ETag or `If-None-Match` handling in `packages/sdk-js/src/feature-repository.ts`, and no mention of either in the docs. Freshness arrives by push over SSE, which the spec changelog dates to v0.3.0, 2023-01-18: "Server Sent Events (SSE) support for realtime feature updates" (`docs/lib/build-your-own.mdx:1207`).

### Statsig

A client SDK receives pre-evaluated values. https://docs.statsig.com/sdks/how-evaluation-works: "On client SDKs, Statsig evaluates all gates and experiments server-side when you call `initialize`." The endpoint is `initialize` on `https://featureassets.org/v1` (`js-client-monorepo: packages/client-core/src/NetworkConfig.ts`). The response type `InitResponseCommon` (`packages/client-core/src/InitializeResponse.ts`) carries `time`, `has_updates`, `hash_used: 'none'|'sha256'|'djb2'`, `user`, `evaluated_keys`, `derived_fields`, `sdk_flags`, `full_checksum`, `exposures`, plus the per-config `feature_gates`, `dynamic_configs` and `layer_configs` maps.

A server SDK receives the rules. "Server SDKs hold the entire ruleset of your project in memory (a JSON representation of each gate or experiment)." The endpoint is `download_config_specs` on `https://api.statsigcdn.com/v1`; `statsig-io/go-sdk: transport.go:90` builds either `/download_config_specs?sinceTime=%d` or the CDN form `/download_config_specs/%s.json?sinceTime=%d`. The payload's top-level keys are `dynamic_configs, feature_gates, layer_configs, layers, has_updates, time, id_lists, diagnostics`.

Statsig does evaluate remotely and return per-user answers, for client SDKs. The justification given is latency and the absence of stored state: "No evaluations require a network request. Checks take under 1 ms after initialization", and "A common assumption is that Statsig maintains a list of all IDs and their assigned groups. … Statsig doesn't cache previous evaluations or maintain distributed evaluation state across client and server SDKs." Server SDKs get rules for the symmetric reason: "Because server SDKs hold the ruleset in memory, they can evaluate any user without a network request." A server SDK can also produce a client payload itself, `getClientInitializeResponse(user, CLIENT_KEY, {hash:'djb2'})`, which is the bootstrap path. An on-device-evaluation client exists that pulls `download_config_specs` to the browser instead (`js-client-monorepo`, `js-on-device-eval-client`, `SpecsDataAdapter`).

Both payloads carry a version marker, and both support a not-modified response. Server: a `sinceTime` query parameter carrying the store's `lastSyncTime`, and a response with `has_updates` and `time` (`statsig-io/go-sdk: store.go:117` and `:442`); when `has_updates` is false the source becomes `SourceNetworkNotModified` (`store.go:462`). Client: the request body carries `sinceTime`, `previousDerivedFields` and `full_checksum` (`js-client-monorepo: packages/js-client/src/Network.ts:19` and `:62`), sent only when the cache is valid for a 204, and a `has_updates: false` response yields the `'NetworkNotModified'` source reusing cached data (`packages/client-core/src/DataAdapterCore.ts:170`). Every evaluation's `details` also exposes `lcut`, "the last time any configuration changed in your project", and `receivedAt`.

---

## 5. Offline and stale config

### GrowthBook

Two cache layers and an explicit staleness bound. `docs/lib/js.mdx:290`: "The JavaScript SDK has 2 caching layers: 1. In-memory cache... 2. Persistent localStorage cache". Defaults, `docs/lib/js.mdx:305`:

```ts
configureCache({
  cacheKey: "gbFeaturesCache",
  // Consider features stale after this much time (60 seconds default)
  staleTTL: 1000 * 60,
  // Cached features older than this will be ignored (4 hours default)
  maxAge: 1000 * 60 * 60 * 4,
  // For Remote Eval only - limit the number of cache entries (~1 entry per user)
  maxEntries: 10,
  ...
})
```

Stale-while-revalidate is the serving rule. `packages/sdk-js/src/feature-repository.ts:260`:

```ts
  const minStaleAt = new Date(now.getTime() - cacheSettings.maxAge + cacheSettings.staleTTL);
  ...
  if (existing && (allowStale || existing.staleAt > now) && existing.staleAt > minStaleAt) {
    if (existing.sse) supportsSSE.add(key);
    // Reload features in the background if stale
    if (existing.staleAt < now) {
      fetchFeatures(instance);
    } else {
      startAutoRefresh(instance);
    }
    return { data: existing.data, success: true, source: "cache" };
  } else {
    const res = await promiseTimeout(fetchFeatures(instance), timeout);
    return res || { data: null, success: false, source: "timeout", error: new Error("Timeout") };
  }
```

A stale entry inside `maxAge` serves the old values and refreshes in the background. An entry past `maxAge` is ignored, and the SDK blocks on a network fetch bounded by `timeout`, returning `{data: null, success: false, source: "timeout"}` when that expires. `source` is one of `"cache" | "network" | "error" | "timeout"` (`packages/sdk-js/src/types/growthbook.ts:447`), so the caller can tell which happened.

With nothing cached and no network, every feature falls back to the fallback argument the caller supplies: "Renders 'red' if the feature is disabled" (`docs/features/basics.mdx:36`, `gb.getFeatureValue('button-color', 'red')`).

Bootstrap: the payload can be passed in directly at init, which is the SSR path used in the Next.js and Sanity guides (`docs/guide/nextjs-and-vercel-feature-flags.mdx`). There is also a standalone `prefetchPayload` function (`docs/lib/js.mdx`, 1.0.0 notes). I did not find a bundled-file fallback shipped by the SDK itself.

### Statsig

A running server SDK keeps serving the last successful sync and retries in the background. https://docs.statsig.com/messages/serverSDKConnection: "Server SDKs poll for changes … every 10 seconds, and for changes to ID lists every 1 minute. If one of these requests fails, the SDK retries a few times and may output a warning. The SDK continues to operate using the last known definition of your project… During a complete Statsig API outage, the SDK operates offline using the last known set of feature gate and experiment definitions while retrying connections in the background." `statsig-io/go-sdk: store.go:429` carries the same sentence in a comment.

A cold start during an outage is the data adapter's job. https://docs.statsig.com/server/concepts/data_store: "Starting a new server or SDK instance while Statsig is down is a different scenario. The `DataAdapter`/`DataStore` addresses this case." The interface is `Get/Set/Initialize/Shutdown` plus `ShouldBeUsedForQueryingUpdates` (`statsig-io/go-sdk: data_adapter_interface.go`), with cache keys `statsig.cache`, `statsig.id_lists` and `statsig.id_lists::{list_name}`. Precedence at `statsig-io/go-sdk: store.go:273` is data adapter first, then `bootstrapValues`, and only when `lastSyncTime == 0` does it fall through to the network. The sources are `SourceDataAdapter`, `SourceBootstrap`, `SourceNetwork`, `SourceNetworkNotModified`. `localMode=true` "disables all network fetches from Statsig".

On the client, the initialize payload is cached per user in browser storage, bounded by count. `js-client-monorepo: packages/client-core/src/DataAdapterCore.ts:23` sets `const CACHE_LIMIT = 10;`. `initializeSync()` serves cache immediately; `initializeAsync({timeoutMs})` races the network against a timer and falls back to cache. Bootstrap is `dataAdapter.setData(json)`, which marks the source `'Bootstrap'`, normally fed from a server's `getClientInitializeResponse`. The full source enumeration is `'Uninitialized' | 'Loading' | 'NoValues' | 'Cache' | 'Network' | 'NetworkNotModified' | 'Bootstrap' | 'Prefetch'` (`packages/client-core/src/StatsigDataAdapter.ts`).

There is no TTL or staleness bound on the client config cache. Validity checks only that the stable id still matches:

```ts
protected _getIsCacheValueValid(current: DataAdapterResult): boolean {
  return current.stableID == null || current.stableID === StableID.get(this._getSdkKey());
}
```

Eviction is by count, ten users, not by age. The one TTL in the client is unrelated to config, `DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000` on the network fallback URL resolver (`packages/client-core/src/NetworkFallbackResolver.ts:27`). A stale cache therefore serves indefinitely. The SDK reports staleness and leaves the decision to you: "`receivedAt` marks when the SDK received this response, useful for judging cache staleness", with `details` such as `{ reason: 'Cache:Recognized', lcut: 1713837126636, receivedAt: 1713838137598 }` (https://docs.statsig.com/client/javascript-sdk). With nothing cached and no bootstrap the reason is `NoValues` or `Uninitialized` and the SDK returns the caller's defaults.

---

## 6. Exposure events

### GrowthBook

The SDK emits on evaluation, inside the evaluation function, not on render. `packages/sdk-js/src/core.ts:793`:

```ts
  // 14. Fire the tracking callback(s)
  // Store the promise in case we're awaiting it (ex: browser url redirects)
  const trackingCalls = onExperimentViewed(ctx, experiment, result);
```

Step 14 runs after the variation is chosen and after the sticky bucket is written, and it is the last thing before the result is returned. The spec's wording, `docs/lib/build-your-own.mdx:257`: the tracking callback is "A callback function that is executed every time a user is included in an **Experiment**". Rules that only force a value log nothing at all (`docs/features/rules.mdx` table, Targeting rule → Tracking: No). So GrowthBook's exposure is an evaluation event by construction, and the platform offers no render-time hook. The application controls the moment only by controlling when it calls `evalFeature` or `run`.

Deduplication is in-memory per instance, on a four-part key. `packages/sdk-js/src/core.ts:1355`:

```ts
export function getExperimentDedupeKey(experiment, result) {
  return (
    result.hashAttribute +
    result.hashValue +
    experiment.key +
    result.variationId
  );
}
```

used at `packages/sdk-js/src/core.ts:81`:

```ts
  // Make sure a tracking callback is only fired once per unique experiment
  if (ctx.user.trackedExperiments) {
    const k = getExperimentDedupeKey(experiment, result);
    if (ctx.user.trackedExperiments.has(k)) {
      return [];
    }
    ctx.user.trackedExperiments.add(k);
  }
```

The spec states the same key as step 14 of the evaluation algorithm, `docs/lib/build-your-own.mdx:980`: "Fire `context.trackingCallback` if set and the combination of hashAttribute, hashValue, experiment.key, and variationId has not been tracked before". Because the variation id is part of the key, a user who flips variations mid-session produces two exposures. The set lives on the instance and is cleared on `setAttributes`-style resets (`packages/sdk-js/src/GrowthBook.ts:597`), so it does not survive a page load.

Server-render plus browser hydration: one exposure, if you wire the deferred tracking bridge. `docs/lib/js.mdx:461`:

> There are some scenarios where you need to queue up tracking calls in one GrowthBook instance and fire them in another. For example, if your analytics tracker is only available on the front-end, but you are running experiments in Node.js.
> ...
> Then, import with `setDeferredTrackingCalls`. This does not fire them automatically. You must call `fireDeferredTrackingCalls` after.

The deferred queue is a `Map` keyed by the same dedupe key, on both the write and the import. `packages/sdk-js/src/GrowthBook.ts:1042`:

```ts
  private _saveDeferredTrack(data: TrackingData) {
    this._deferredTrackingCalls.set(
      getExperimentDedupeKey(data.experiment, data.result),
      data,
    );
  }
```

`packages/sdk-js/src/GrowthBook.ts:958`:

```ts
  public setDeferredTrackingCalls(calls: TrackingData[]) {
    this._deferredTrackingCalls = new Map(
      calls.filter((c) => c && c.experiment && c.result)
        .map((c) => [getExperimentDedupeKey(c.experiment, c.result), c]),
    );
  }
```

Read the guard at `packages/sdk-js/src/core.ts:796` carefully, because it decides whether an evaluation queues or fires:

```ts
  const trackingCalls = onExperimentViewed(ctx, experiment, result);
  if (trackingCalls.length === 0 && ctx.global.saveDeferredTrack) {
    ctx.global.saveDeferredTrack({ experiment, result, user: getTrackingUserContext(ctx.user) });
  }
```

An evaluation queues a deferred call whenever `onExperimentViewed` produced no calls. That covers both "no tracking callback is configured" (the server case, which is what the bridge is for) and "this key was already tracked". The `Map` key makes the second case idempotent.

The failure mode the bridge protects against is worth naming plainly: the server queue and the client instance are separate objects, so if the server evaluates, exports calls, and the client instance also evaluates with its own `trackingCallback` set, the client fires its own exposure and then `fireDeferredTrackingCalls` fires the imported one. Two events for one view. The documented pattern avoids that by not setting a `trackingCallback` in the constructor: "you should not specify a `trackingCallback` in the constructor and instead use `setTrackingCallback` later when ready. When you do this, the GrowthBook instance will queue up tracking calls and then fire them all at once when you set the callback" (`docs/lib/js.mdx:463`). `setTrackingCallback` calls `fireDeferredTrackingCalls` itself (`packages/sdk-js/src/GrowthBook.ts:988`).

Suppression and manual emission: exposure is suppressed by not configuring a `trackingCallback` (evaluations then accumulate in the deferred map, which you can drop). Manual emission is `getDeferredTrackingCalls` plus `setDeferredTrackingCalls` plus `fireDeferredTrackingCalls`. There is a separate, non-experiment hook for every feature read, `onFeatureUsage` (`docs/lib/js.mdx:700`), described in the Roku doc as firing "on **every** feature evaluation, not just experiments" (`docs/lib/roku.mdx:504`).

### Statsig

The SDK emits on evaluation. https://docs.statsig.com/server-core/node-core: "By default, the SDK automatically logs an exposure event when you check a gate, get a config, get an experiment, or call get() on a parameter in a layer. To delay exposure logging (for example, to log only after the user actually uses the feature), use manual exposures." The same sentence appears on the Go, Python, Ruby, Java and legacy Node pages.

Statsig addresses the evaluate-versus-render gap by naming it and handing you a switch. https://docs.statsig.com/server/nodejsServerSDK: "Statsig SDKs automatically log an exposure event every time you check a gate/experiment/config. In some scenarios, you may want to control when to log an exposure." The docs phrase the reason as "to log only after the user actually uses the feature".

Layers move the emission point down to the parameter read. https://docs.statsig.com/experiments/layers-overview: "Calling `getLayer(\"layer_name\")` by itself doesn't log an exposure. Statsig logs a `statsig::layer_exposure` event when you read a specific parameter with `getLayer(\"layer_name\").get(\"parameter_name\")`." Billing follows assignment: "If Statsig assigns the user to an experiment within the layer, the `statsig::layer_exposure` event is billable. If Statsig doesn't assign the user to an experiment within the layer, the `statsig::layer_exposure` event isn't billable." Source agrees, `statsig-io/node-js-server-sdk: src/Layer.ts`, inside `get<T>`: `const logAndReturn = (): T => { this._logExposure?.(this, key); return val as T; };`.

Deduplication runs two different schemes. The client keeps a time map over a rolling ten-minute window. `statsig-io/js-client-monorepo: packages/client-core/src/EventLogger.ts` (I read this file directly):

```ts
const MAX_DEDUPER_KEYS = 1000;
const DEDUPER_WINDOW_DURATION_MS = 600_000;
...
const key = [event.eventName, userKey, metadata['gate'], metadata['config'],
  metadata['ruleID'], metadata['allocatedExperiment'], metadata['parameterName'],
  String(metadata['isExplicitParameter']), metadata['reason']].join('|');
const previous = this._lastExposureTimeMap[key];
if (previous && now - previous < DEDUPER_WINDOW_DURATION_MS) return false;
```

`userKey` is `_getUserStorageKey(this._sdkKey, user)`. The whole map is dropped when it passes 1000 keys. The legacy `statsig-io/js-client: src/StatsigLogger.ts` uses the same ten minutes with a key that omits the user.

Server SDKs dedupe over about a minute. `statsig-io/node-js-server-sdk: src/LogEventProcessor.ts` sets `const deduperInterval = 60 * 1000;`, clears the Set on that timer, and builds `const keyList = [user.userID, customIdKey, eventName, metadataKey];` after stripping `ignoredMetadataKeys = new Set(['serverTime','configSyncTime','initTime','reason'])`, plus a hard clear at 100000 entries. Python mirrors it (`statsig/statsig_logger.py`, reset at 10000). Go uses a structured key over a `TTLSet` with `resetInterval: time.Minute` (`statsig-io/go-sdk: logger.go`):

```go
func computeDedupeKeyForGate(gateName, ruleID string, value bool, userID string, customIDs map[string]string) string {
	return "n:" + gateName + ";u:" + computeUserKey(userID, customIDs) + "r:" + ruleID + ";v:" + strconv.FormatBool(value)
}
func computeDedupeKeyForLayer(layerName, experimentName, parameterName, ruleID, userID string, customIDs map[string]string) string {
	return "n:" + layerName + ";e:" + experimentName + ";p:" + parameterName + ";u:" + computeUserKey(userID, customIDs) + "r:" + ruleID
}
```

Docs state both windows, https://docs.statsig.com/experiments/layers-overview: "Client SDKs (JS/web, iOS, Android): 10 minutes per user, layer, and parameter combination. Server SDKs: About 1 minute. The dedupe set resets every 60 seconds."

Server render plus browser hydration: with defaults, one exposure, for a reason that has nothing to do with dedupe. The client SDK drops events entirely when it detects a non-browser environment. `packages/client-core/src/EventLogger.ts`, `_shouldLogEvent`: `if (this._options?.loggingEnabled !== 'always' && _isServerEnv()) { return false; }`, where `_isServerEnv` (SafeJs.ts) is true when `document` is absent and `process.versions.node` exists. https://docs.statsig.com/client/Next: "`browser-only` (default): log events from browser environments. `disabled`: never send events. `always`: log in every environment, including non-browser contexts." Bootstrapping does not log either: `getClientInitializeResponse` in `statsig-io/node-js-server-sdk: src/StatsigServer.ts` contains no exposure call, and https://docs.statsig.com/faq calls its output "hypothetical assignments (e.g., to bootstrap clients)".

Two exposures happen in two cases. First, when the server path uses a server SDK `checkGate` or `getExperiment`, which does log, and the browser then evaluates the same thing. Second, when `loggingEnabled: 'always'` is set. The two dedupers hold separate state in separate processes, so a server exposure and a client exposure for the same user are never deduped against each other.

Suppression and manual emission, server side (`statsig-io/node-js-server-sdk: src/index.ts`): `manuallyLogGateExposure(user, gateName)`, `manuallyLogConfigExposure`, `manuallyLogExperimentExposure`, `manuallyLogLayerParameterExposure(user, layerName, parameterName)`, alongside `checkGateWithExposureLoggingDisabled`, `getExperimentWithExposureLoggingDisabled`, `getLayerWithExposureLoggingDisabled` and their `...Sync` variants. Server-core SDKs replaced the method pairs with an options field, https://docs.statsig.com/server-core/go-core: methods "accept an optional options parameter with a `DisableExposureLogging` field". Client SDKs use a per-call option, `packages/client-core/src/EvaluationOptions.ts` declaring `disableExposureLog?: boolean;`, and StatsigClientBase.ts:

```ts
if (options?.disableExposureLog === true) { this._logger.incrementNonExposureCount(name); return; }
```

A suppressed check is still counted and reported as `statsig::non_exposed_checks`. Manual exposures are tagged, Go sets `metadata["isManualExposure"] = "true"`. Parameter stores never log on their own: `packages/js-client/src/ParamStoreGetterFactory.ts` defaults to `disableExposureLog: true`.

One more thing that affects exposure counts: server SDKs sample. `determineSampling` in LogEventProcessor.ts, logger.go and statsig_logger.py drops a fraction of exposures when Statsig's remote `sampling_mode` config is set and the environment tier is production, using `is_hash_in_sampling_rate(exposureKey, sample_rate)`, attaching `samplingRate` to the event.

---

## 7. Typing and codegen

### GrowthBook

TypeScript: the CLI generates the `AppFeatures` interface from your account. `docs/tools/cli.mdx:132`:

```
## Generating TypeScript types
Generate an `AppFeatures` type definition from your feature flags for strictly-typed SDK usage:

growthbook generate-types --output ./types
```

with the suggested `package.json` script `"type-gen": "growthbook generate-types --output ./types"`. The generated interface plugs into `new GrowthBook<AppFeatures>({...})` and then "all feature flag methods will be strictly typed... Typos will cause compile-time errors" (`docs/lib/js.mdx:531`). Without it, the SDK infers the value type from the fallback argument.

Python: a generator ships inside the SDK. `docs/lib/python.mdx:1009`:

```bash
python -m growthbook.codegen --input features.json --output growthbook_features.py
```

It reads the SDK endpoint payload or a bare feature map, emits `TypedGrowthBookClient` / `TypedGrowthBook` subclasses and a `FeatureKey` Literal, and the docs tell you to commit the file and fail CI on drift: "`git diff --exit-code growthbook_features.py  # fails if the committed file is stale`". Features with no inferable type "fall back to `Any` and are listed in a warning at generation time."

Swift or Kotlin: not found. I grepped `docs/` for "generate types", "typed features", "type generation", and "codegen"; the only hits are the CLI page, the Python page, an unrelated Sanity guide, and a docs sentence about exporting config schemas. `docs/lib/swift.mdx` and `docs/lib/kotlin.mdx` have no codegen section.

### Statsig

Not found. No Statsig tool generates typed accessors or constants from gate or experiment configuration, for any of the three languages.

Where the search ran: the full docs corpus at https://docs.statsig.com/llms-full.txt (833 pages, generated 2026-09-22) grepped for "codegen", "code generation", "generated constants", "statsig generate", "typed accessors", "type-safe accessor", "statsig CLI" and "npx statsig", with no such feature. Both pages of https://api.github.com/orgs/statsig-io/repos list no codegen repo, and a code search for `org:statsig-io codegen` returned `"total_count": 0`. `statsig-io/statsig-code` is the VS Code extension; its README lists a flag summary, hover insights, CodeLens, diagnostics and shortcuts, no generation. `statsig-io/terraform-provider-statsig` and `pulumi-statsig` manage configuration and emit no client types.

What Statsig offers is runtime typing at the call site: `Layer.get<T>(key, defaultValue, typeGuard)` in `statsig-io/node-js-server-sdk: src/Layer.ts`, where the type comes from the default value plus an optional guard function.

---

## 8. Flag and rule identity

### GrowthBook

Rules carry an opaque id. `packages/sdk-js/src/types/growthbook.ts:24` has `id?: string` on `FeatureRule`, and the back end mints it once at write time. `packages/back-end/src/services/features.ts:2134`:

```ts
export function generateRuleId() {
  return uniqid("fr_");
}
```

assigned only when absent, at a single chokepoint. `packages/back-end/src/services/features.ts:2189`:

```ts
// Single write-time chokepoint for rule ids, experiment tracking keys,
// rollout seeds, and schedule timestamps — consolidated so the invariants
// can't drift across call sites.
export function addIdsToFlatRules(rules: FeatureRule[] = [], featureId: string): void {
  rules.forEach((r) => {
    if (r.type === "experiment" && !r?.trackingKey) {
      r.trackingKey = featureId;
    }
    if (!r.id) {
      r.id = generateRuleId();
    }
```

Since the id is only minted when missing, editing a rule's condition or percentage keeps it, and reordering the array keeps it, because the id lives on the object and not on its position. Legacy rules without ids get a content hash, which is stable for identical content and changes when content changes. `packages/back-end/src/services/features.ts:2161`:

```ts
// Deterministic id for legacy rules with no `id`. Hashes the rule sans id so
// the same content always yields the same id — replayable across reads and
// re-runs.
export function synthesizeRuleId(rule: object): string {
  const { id: _id, ...rest } = rule as ...;
  const json = stableStringify(rest);
  const hash = createHash("sha1").update(json).digest("hex").slice(0, 16);
  return `fr_h_${hash}`;
}
```

There is a second identity convention for rules that survived the v1-to-v2 migration, documented in `packages/shared/src/util/ruleId.ts`:

```
 * Surface contract:
 *   - External (SDK payloads, tracking keys, telemetry, UI lookups) → stem.
 *   - Internal (storage, mutation targeting) → literal suffixed id.
 *
 * Invariant: `generateRuleId()` and user-supplied ids never contain `__`, so
 * any id containing `__` is a migration artifact
```

Variations carry keys separately from indices. `VariationMeta` is "**key** (`string`, optional) - A unique key for this variation" (`docs/lib/build-your-own.mdx:279`), and the result reports `key: meta.key || "" + variationIndex` (`packages/sdk-js/src/core.ts:1010`). That key is what the exposure event carries and what a sticky bucket stores, so it is the identifier analysis sees.

What analysis actually depends on is the experiment's `trackingKey` and the variation key, not the rule id. The tracking key defaults to the feature id (`r.trackingKey = featureId` above), the exposure event carries `experimentId: experiment.key` and `variationId: result.key` (`packages/sdk-js/src/core.ts:118`), and the seed defaults to the same key (`experiment.seed || key`). Two consequences follow. Changing the tracking key re-seeds the hash and re-randomizes everyone. Renaming or deleting a variation invalidates every sticky bucket stored under the old key (see question 3).

The identity that separates before from after in the results is the phase, not an id: "This creates a brand new phase of the experiment. All data collected until this point is excluded from the analysis" (`docs/app/making-experiment-changes.mdx`). Rules carry a `phase` field into the payload (`packages/shared/src/sdk-versioning/sdk-payload.ts:33`).

### Statsig

Exposures carry the rule id. `statsig-io/js-client-monorepo: packages/client-core/src/StatsigEvent.ts`: a gate exposure's metadata is `{gate, gateValue, ruleID}` plus `configVersion`; a config or experiment exposure is `{config, ruleID}` plus `rulePassed`; a layer parameter exposure is `{config, parameterName, ruleID, allocatedExperiment, isExplicitParameter}`, where `ruleID` is `parameterRuleIDs?.[parameterName] ?? layer.ruleID`. Secondary exposures ride along as `{gate, gateValue, ruleID}` entries.

In the spec, a rule carries `id`, `salt`, `idType` and `groupName`, and the containing spec carries its own `salt` and `idType` (`statsig-io/node-js-server-sdk: src/ConfigSpec.ts`). Evaluation returns the rule's own id as `ruleID` (`statsig-io/go-sdk: evaluator.go`, `RuleID: rule.ID`), except for the sentinels `"default"`, `"disabled"`, `"prestart"`, `"override"`, `"inlineTargetingRules"`, `"targetingGate"`, and exploration-phase groups which get `group.ID + ":explore"`.

The rule id is not byte-stable across edits, and Statsig exposes a separate field that is. https://docs.statsig.com/api-reference/gates/update-gate-rules documents both: "id | string | The Statsig ID of this rule." and "baseID | string | The base ID of this rule, i.e. without any added metadata. Will remain the exact same throughout".

On edits, reorders and percentage changes the docs say the following. A percentage change does not reshuffle, https://docs.statsig.com/faq: "Increasing the pass percentage (for example, 10% to 20%) keeps the original 10% and adds new traffic until it reaches the new percentage. Decreasing it removes the newest slice first. To reshuffle all users, you must resalt the gate." Bucketing stability belongs to the salt, https://docs.statsig.com/feature-flags/conditions: "Gate evaluations are stable for a given gate, percentage rollout, and user ID. This stability is based on a salt associated with the feature gate. To reset a gate and reshuffle users, select 'resalt'." Reordering changes which rule a user hits, same page: "After a user qualifies based on the condition in a given rule, Statsig doesn't evaluate subsequent rules for that user." Resetting or abandoning an experiment re-salts, https://docs.statsig.com/experiments/ending/ending-experiment: "The 'salt' used to randomize a user's group also changes... Statsig randomly assigns users to a group that isn't necessarily the same group they were in before the reset", while "A Restart doesn't re-salt (re-randomize) units, and all users continue to receive the same group assignments." A documented rule-id lifecycle for a plain edit or reorder is not found.

Analysis depends on these identifiers. https://docs.statsig.com/statsig-warehouse-native/analysis-tools/pipeline-overview describes the exposure export columns as "group_id | string | groupID for experiments; ruleID+Pass/Fail for gates" and "group_name | string | Name of the experiment group". `ruleID` and `groupID` also appear in `statsig_metadata` on forwarded events.

Group names are labels and Statsig says so twice. https://docs.statsig.com/experiments/create-new: "Group names and descriptions are labels... Your code reads parameter values through the SDK and never reads group names, so you can rename or re-describe a group at any time without a code change or any effect on what users experience." https://docs.statsig.com/experiments/implementation/getting-group calls branching on `experiment.groupName` "an anti-pattern". Note the tension with question 3: persistent assignment stores `group_name` in its blob, so the label that the docs call freely renameable is part of what a sticky record carries.

---

## 9. PII in events

### GrowthBook

In local evaluation the SDK sends no user data anywhere. It fetches a payload by client key and evaluates in process. The only outbound user data in the SDK is the remote-eval POST, which goes to an endpoint you run, and which carries the full attribute object (`packages/sdk-js/src/feature-repository.ts:433`, quoted in question 4).

Exposure events go wherever your `trackingCallback` sends them. GrowthBook hands the callback the experiment, the result (which contains `hashAttribute` and `hashValue`, so the raw identifier), and a user context (`packages/sdk-js/src/core.ts:104`). The built-in `eventLogger` path sends a fixed four-field body (`packages/sdk-js/src/core.ts:112`):

```ts
          {
            experimentId: experiment.key,
            variationId: result.key,
            hashAttribute: result.hashAttribute,
            hashValue: result.hashValue,
          },
```

`hashValue` is the raw identifier, not a hash of it, despite the name. The name refers to the attribute used for hashing.

Targeting attributes can be hashed, opt-in, at the organization and connection level. `docs/lib/js.mdx:646`:

> When _secure attribute hashing_ is enabled, all targeting conditions in the SDK payload referencing attributes with datatype `secureString` or `secureString[]` will be anonymized via SHA-256 hashing. This allows you to safely target users based on sensitive attributes. You must enable this feature in your SDK Connection for it to take effect.

> If your SDK Connection has secure attribute hashing enabled, you will need to manually hash any `secureString` or `secureString[]` attributes that you pass into the GrowthBook SDK.

> To hash an attribute, use a cryptographic library with SHA-256 support, and compute the SHA-256 hashed value of your attribute _plus_ your organization's secure attribute salt.

That protects the attribute values embedded in targeting conditions in the payload. It does not touch exposure events.

I found no SDK telemetry or phone-home in `packages/sdk-js/src` (grepped for "telemetry"; no hits). I did not examine GrowthBook Cloud's managed warehouse ingestion, so treat "nothing leaves the SDK" as a statement about the SDK only.

### Statsig

Every event carries the `StatsigUser` you passed, minus private attributes. The field list in `statsig-io/js-client-monorepo: packages/client-core/src/StatsigUser.ts` is `userID`, `customIDs` (including `stableID`), `email`, `ip`, `userAgent`, `country`, `locale`, `appVersion`, `custom`, `privateAttributes`, `analyticsOnlyMetadata`. SDK metadata adds `appVersion, deviceModel, deviceModelName, locale, sdkVersion, stableID, systemName, systemVersion` (StatsigMetadata.ts). Email and IP travel by default when you set them, unhashed.

Statsig fills in what you omit. https://docs.statsig.com/feature-flags/conditions: "if you don't provide a userID, client SDKs rely on an auto-generated stable identifier persisted to local storage. If you don't set an IP or User Agent (UA), the client SDK infers these attributes from the request." Warehouse exports carry `ip`, `country`, `city`, `state`, `browser_name`, `browser_version`, `os_version`, `device_model` and `sessionID` under `user_dimensions` / `user_object`, plus `metadata.user_agent` ("Browser user agent string (truncated to 200 chars)").

The `stableID` is Statsig's own device identifier, https://docs.statsig.com/guides/sidecar-experiments/advanced-configurations-v3: "an auto-generated device-level GUID stored in the user's localStorage". On mobile, https://docs.statsig.com/faq: "Statsig on Mobile doesn't use device IDs such as `Secure.ANDROID_ID` or `advertisingIdentifier` on iOS. Instead, Statsig uses a StableID, which it randomly generates per device, per app, and per installation... Statsig generates a new StableID when you reinstall an application."

Keeping a field out of events is opt-in, per field, through `privateAttributes`. https://docs.statsig.com/sdks/user: "Dictionary that can contain key/value pairs that can be used for Feature Gate targeting. Statsig does **not** store this dictionary after using it for targeting, and removes it from any `log_event` calls." Enforced in `statsig-io/node-js-server-sdk: src/LogEvent.ts` (`this.user.privateAttributes = null;`) and `packages/client-core/src/EventLogger.ts` (`delete event.user.privateAttributes;`). Moving `email` there is your job.

Coarser switches: `disableAllLogging` on the client ("If true, the SDK doesn't collect any logging within the session, including custom events and config check exposure events"), `disable_all_logging` in Python and Rust server core, `disable_network` ("disables all network functions: event & exposure logging, spec downloads, and ID List downloads. Formerly called 'localMode'"), `includeCurrentPageUrlWithEvents` on web, and an `eventFilterFunc` on init.

No hashing or anonymisation of userID, email or IP exists in the SDKs. Hashing appears only for storage keys, dedupe and sampling keys, and config names.

The `hash_used` field is about config names, not user data. Values are `'djb2' | 'sha256' | 'none'`. https://docs.statsig.com/client/migration-guides/MigrationFromOldJsClient: "By default, all server SDKs generate `sha256` hashes in the `getClientInitializeResponse` method. Set the hash algorithm parameter to `\"djb2\"` to bootstrap the new client SDK... This doesn't change any bucketing logic, only the obfuscation method used for the payload." The client-side equivalent is `disableHashing`, https://docs.statsig.com/client/Android: "When `true`, gate/config/experiment names aren't hashed and remain readable. Requires special authorization from Statsig."

---

## 10. Withholding from clients

### GrowthBook

Three mechanisms, presented differently.

Scoping, presented as operations. An SDK Connection is bound to one environment and receives only that environment's features and rules, and disabled features are omitted from the response entirely (`docs/features/environments.mdx:26` and `:37`). Project scoping is framed as payload size: "SDK connections can be scoped to a project to reduce payload size" (`docs/features/environments.mdx:55`).

Encryption, presented as obfuscation. The endpoint returns `{status: 200, encryptedFeatures: "..."}` and the SDK decrypts with a key you embed (`docs/app/api.mdx:90`). GrowthBook itself will not call it security. `docs/kb/glossary.mdx:75`: "[Encrypted SDK Payload](/app/api#encryption): Provide an extra level of obfuscation to avoid leaking sensitive feature flag and experiment configs in client-side integrations."

Remote evaluation, presented as security, with the trade-offs stated. `docs/self-host/remote-evaluation.mdx`: "The primary benefit is **security**: sensitive targeting rules, unused variations, business logic, and experiment configuration details remain hidden on your server and never get exposed to the client." The same page qualifies it once: "Remote Evaluation improves security through feature obfuscation, but this comes with trade-offs". It also draws the boundary: "Remote Evaluation is designed for **client-side environments**... It should **not** be used in backend contexts where your SDK already runs in a secure server environment."

Under remote evaluation the client receives "evaluated feature values and scrubbed experiment metadata", with exposure callbacks deferred by the endpoint and hydrated back to the client.

### Statsig

Yes, through Target Apps attached to SDK keys, and Statsig presents it as both operations and security, in that order. https://docs.statsig.com/sdks/target-apps:

> "SDK Keys support two attributes that restrict their access to certain configs: Environments and Target Apps. A Target App is a user-defined abstraction tied to entities in your Statsig project, and you can link it to one or more SDK Keys."

> "The two main benefits are: Performance: removing unused entities from the SDK payload speeds up initialization time and reduces the data stored in local caches or data stores. Security: you may not want to expose certain gates, experiments, or configs to client-side code or to a client key that's easily discoverable in your app. Specifying a target app for your client key and linking only client-specific configs to it keeps those configs from being visible."

Same page: "Target Apps are an Enterprise-only feature."

There is no separate "do not expose to client SDKs" checkbox and no server-only config concept. Searches for "client SDK access", "do not expose to client", "server-only" and "clientSDKAccess" across the docs corpus found nothing.

A withheld entity simply is not in the payload, and the SDK returns the caller's default. https://docs.statsig.com/sdks/debugging: "when the SDK key belongs to a target app, Statsig includes only the entities linked to that app. An entity with no target app doesn't reach a target-app-scoped key", and "The SDK returns defaults: `false` for gates and the supplied fallback for experiments/layers. The evaluation reason is `Unrecognized`."

Two sharp edges are documented. Scope does not propagate to dependencies: "Target App scope doesn't propagate to gate dependencies. If a gate has a `passes_gate` or `fails_gate` condition that references another gate, tag that dependency gate with the same Target App independently. Without its own tag, the SDK excludes the dependency gate from its payload, so the condition evaluates silently to `false`." A gate that a targeting condition depends on therefore fails closed and silently. Bootstrapping widens the surface: "the server SDK must have access to all gates, experiments, and configs that both the server and the client need... To filter the bootstrapping response to a specific target app, pass a client key with that target app applied to the `getClientInitializeResponse` call." The option is `clientSdkKey` on that call (https://docs.statsig.com/server-core/node-core: it "lets you filter the response to only the specific feature gates, experiments, dynamic configs, layers, or parameter stores that a particular client key has access to") and `TargetAppID` in server-core options.

Separately, implicit layers never reach a client at all: "When you create an experiment without placing it in an explicit layer, Statsig auto-creates an implicit layer. SDKs never receive implicit layers."

---

## What the experimentation-first products do differently from the flag-first ones

Both products treat the assignment as a measurement, and the flag as a side effect of it. Four concrete consequences follow.

The hash is a published quantity with a documented input string, and both vendors ship the same algorithm across every SDK. GrowthBook goes further and publishes it as a spec with a 500-case JSON conformance file that every SDK must pass. A flag-first product treats bucketing as an implementation detail of one SDK, because nothing downstream reads it back. Here the warehouse reads it back, so the hash input, the separator, the bucket count and the salt all become contract.

The exposure event is a first-class object with its own lifecycle, separate from the evaluation. Statsig ships manual exposure APIs, per-call suppression, a `non_exposed_checks` counter for suppressed evaluations, a layer rule that moves emission from `getLayer` to the parameter read, and server-side sampling with the rate written onto the event. GrowthBook ships a deferred tracking queue that serializes exposures across the server-to-browser boundary so a server-rendered view produces one event. Neither product treats "the SDK returned a value" and "the user was exposed" as the same fact.

Changing a running experiment is a modelled operation with a stated effect on the data. GrowthBook makes the operator pick a release plan and says which changes are safe to apply in place ("Increasing the percent of people included", "Removing a condition") and which invalidate past results ("Changing the traffic split (weights) between variations"). Statsig documents that raising a rollout percentage keeps the existing cohort and appends, that lowering it removes the newest slice, and that a reset re-salts while a restart does not. A flag-first product lets you edit a percentage and says nothing about what that does to yesterday's numbers.

Sticky bucketing exists in both, is off by default in both, and both name its cost. GrowthBook publishes a worked numeric example of the sample ratio mismatch that fallback attributes can induce, and closes with "at the expense of statistical rigor. With GrowthBook, we let you decide this trade-off for yourself on a per-experiment basis." Statsig gates it behind two separate opt-ins and supports it in only part of its SDK matrix. A flag-first product would ship stickiness on by default, because consistent UX is the whole point there and nobody computes a p-value afterwards.

One difference between the two is worth carrying into a design. GrowthBook stores a variation key and re-hashes when that key disappears. Statsig stores the entire evaluation, including the return value, the rule id, the group name and the secondary exposures, and serves it back verbatim while the experiment is active. GrowthBook's record self-heals and loses the old value. Statsig's record survives a config change and can serve a payload that no current rule would produce.

## What surprised me

GrowthBook's v1 hash concatenates the value and the seed with no separator, and v2 keeps that property. `fnv32a(seed + value)` with `seed="ab", value="c"` equals `fnv32a(seed="a", value="bc")`. Experiment keys collide into each other's bucket space whenever one key is a prefix of another plus the start of an id. Statsig avoids this by joining every part with a literal `"."`.

The GrowthBook payload builder strips `hashVersion` from the wire for any SDK Connection that does not declare the `bucketingV2` capability (`packages/shared/src/sdk-versioning/sdk-payload.ts:26`), and the SDK's fallback is `experiment.hashVersion || 1`. Pinning an SDK Connection to an old version therefore silently moves that traffic back onto the algorithm the docs call biased. The setting that does this is labelled as a compatibility version in the UI.

GrowthBook's whole public explanation for the v2 change is one sentence: "The original hash version (1) had a flaw that caused bias when running experiments in parallel." I found no design note, issue, or post explaining the correlation mechanism. For a change that re-randomizes every user in the product, that is a thin paper trail.

`cases.json` declares `"specVersion": "0.8.1"` while `docs/lib/build-your-own.mdx` declares "Latest spec version: 0.7.1" at the top and ends its changelog at v0.7.1, 2025-02-13. The conformance file has moved ahead of the document that governs it, and the file contains a `contextualBandit` section with 35 cases that the spec body does not describe.

Statsig uses 10000 buckets for a rule's pass percentage and 1000 buckets for group assignment inside an experiment, in the same evaluation, over two differently-shaped hash inputs (three dotted parts for the rule, two for the bucket). Their own doc glosses this as "10000 (or 1000 for layers)", which does not match what the code does for experiment groups.

Statsig's persistent assignment stores the group name inside the record, and a separate doc page calls group names free to rename at any time "without a code change or any effect on what users experience". Both statements are true of the running experiment. They are not both true of the analysis that reads `group_name` out of the exposure export.

Statsig's client SDK drops all events when it detects a Node environment (`_isServerEnv`), which is what saves the SSR-plus-hydration case from double-counting. That protection is a default (`loggingEnabled: 'browser-only'`) and a one-word option flips it off.

Statsig's cross-SDK consistency tests are real and unusable by anyone outside the company. They post to `/rulesets_e2e_test` with a Statsig API key, one of them prints "THIS TEST IS EXPECTED TO FAIL FOR NON-STATSIG EMPLOYEES!", one is `xdescribe`d, and one has its URL list commented out.

GrowthBook ships a codegen for Python that emits a typed client and tells you to fail CI on drift (`git diff --exit-code`), and a CLI that emits a TypeScript interface. Statsig ships neither, for any language.

## Where I could not verify

GrowthBook's reasoning for hash v2. I read `packages/sdk-js/src/util.ts`, `docs/lib/build-your-own.mdx` (including the full changelog), grepped the whole `docs/` tree for "correlat", and fetched the 2.7 release post at growthbook.io/blog. The only statement anywhere is the one sentence at `docs/lib/build-your-own.mdx:293`. I could not find a description of the correlation mechanism, a measurement of the bias, or a migration note about what happened to in-flight experiments at the cutover. The clone is shallow, so I could not read the commit that introduced it.

Whether Statsig group sizes must sum to 100. Not stated on the experiment overview, create-new, or Console API pages. The Console API documents `size` as 0 to 100 per group and nothing about the total. The fixture's last cumulative threshold is 1000, and buckets past the last threshold fall to the spec `defaultValue`, but that is inference from one fixture, not a documented rule.

Statsig's complete list of allowed parameter value types. The subagent saw this only in a search snippet and did not fetch the page.

A rule-id lifecycle for Statsig on a plain edit or a reorder. The API documents `baseID` as the part that "Will remain the exact same throughout", which implies `id` changes, but no page states when.

GrowthBook Cloud's managed warehouse and event tracker ingestion. I answered question 9 from the SDK source only. What GrowthBook Cloud stores when you use its own event pipeline is outside what I read.

GrowthBook Swift and Kotlin codegen. I grepped `docs/` for four spellings and read `docs/lib/swift.mdx` and `docs/lib/kotlin.mdx` headings. I did not read the `growthbook-swift` or `growthbook-kotlin` repositories, so a tool that exists only there would have been missed.

Whether GrowthBook's SDK endpoint sets an ETag or `Cache-Control` at the HTTP layer. I checked the SDK's fetch path and the docs, both of which use `dateUpdated` and SSE. I did not issue a request to `cdn.growthbook.io` to inspect response headers.

Statsig's exposure sampling in practice. The `determineSampling` code path is real in three SDKs, but I did not verify what `sampling_mode` is set to for a normal project, so I cannot say how often exposures are actually dropped.
