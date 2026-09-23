# LaunchDarkly feature flag and experimentation architecture

Research date: 2026-09-23. Sources are LaunchDarkly's public documentation and public SDK repositories on GitHub. Every claim below carries a URL. Anything I could not confirm is marked "not found".

A note on docs URLs: `launchdarkly.com/docs/...` serves clean Markdown when you append `.md` to the page path. I used that form for exact quotes.

---

## 1. Multivariate flags

### Answer

A flag has a `variations` array. Each element is one value. Boolean flags are fixed at two variations. String, number and JSON flags are the multivariate types and have no upper limit on variation count. Each variation carries a value, an optional name, an optional description, and a stable `_id`.

Weights are not percentages in the data model. A rollout is a list of `{variation, weight}` pairs where `weight` is an integer from 0 to 100,000. The UI shows that as a percentage with three decimal places of resolution.

A variation value can be any JSON: boolean, string, number, object or array. The SDK does not derive a static type from the flag configuration. The application picks a typed accessor (`boolVariation`, `stringVariation`, `numberVariation`, `jsonVariation`) and passes a fallback value of that type. A mismatch is caught at runtime, not compile time (see question 7).

A targeting rule can force a specific variation for a segment. A rule is a set of ANDed clauses plus either a fixed variation index or a rollout. A clause can be `Context is in Segments`.

### Evidence

Variation count and types:

> "There is no limit to the number of variations you can add to a multivariate flag."
> — https://launchdarkly.com/docs/home/flags/variations

Flag types (boolean / string / number / JSON), with string and JSON capped at 32KB:
https://launchdarkly.com/docs/home/flags/types

Weights, quoted from the evaluation spec:

> "Weighted variations are a subset of the variation index and a non-negative integer between 0 and 100,000 acting as that variation's weight. In the LaunchDarkly user interface, you define the rollout by specifying the weight as a percentage between 0 (represented as 0) and 100 (represented as 100,000) for each variation."
> — https://launchdarkly.com/docs/sdk/concepts/flag-evaluation-rules

The Go data model confirms the weight range and adds an `Untracked` flag per weighted variation:

```go
// WeightedVariation describes a fraction of users who will receive a specific variation.
type WeightedVariation struct {
	// Variation is the index of the variation to be returned if the user is in this bucket. This is
	// always a real variation index; it cannot be undefined.
	Variation int
	// Weight is the proportion of users who should go into this bucket, as an integer from 0 to 100000.
	Weight int
	// Untracked means that users allocated to this variation should not have tracking events sent.
	Untracked bool
}
```
— https://github.com/launchdarkly/go-server-sdk-evaluation/blob/v3/ldmodel/model_flag.go

Rule shape, quoted from the spec:

> "A rule is defined as a tuple of the ID, collection of clauses, and either the variation index or a rollout plan... SDKs iterate through flags' rules to find the first rule that matches the given context. If the matched rule has a variation index, return the corresponding variation, with the rule's ID and the `RULE_MATCH` evaluation reason."
> — https://launchdarkly.com/docs/sdk/concepts/flag-evaluation-rules

Segment targeting in a rule:

> "Segment conditions use OR logic. If you select more than one segment in a 'Context is in Segments' condition, the condition matches if the context is a member of any one of the selected segments."
> — https://launchdarkly.com/docs/home/flags/target-rules

Variation `_id` and rule `_id` exist in the REST API response: the flag object's variations "each include `_id`", and rules "include `_id`".
— https://launchdarkly.com/docs/api/feature-flags/patch-feature-flag

---

## 2. Bucketing

### Answer

The algorithm is publicly specified and the SDK source matches the spec.

Hash function: SHA-1.

Input, concatenated with `.` separators, in this order:

- With no seed: `flagKey` + `.` + `salt` + `.` + `bucketByValue`
- With a seed: `String(seed)` + `.` + `bucketByValue`

`bucketByValue` is the value of the rollout's `bucketBy` attribute, looked up on the context whose kind matches the rollout's `contextKind`. If `bucketBy` is unset, the context key is used. Experiments always bucket by key and ignore `bucketBy`.

There is a fourth, legacy component. For plain rollouts only (never experiments), if the context carries a deprecated `secondary` key and the SDK has the secondary-key option enabled, `.` + secondary is appended.

Only string and integer attribute values are usable. Floats, booleans, objects and arrays cause a bucketing failure and a bucket value of 0.

Bucket count: the hash is not reduced to N buckets directly. The first 15 hex characters of the SHA-1 digest are parsed as a base-16 integer and divided by `0xFFFFFFFFFFFFFFF` (1152921504606846975) to give a float in [0,1]. Weights are then accumulated as `weight / 100000` and the first variation whose cumulative sum exceeds the bucket value wins. The effective resolution is 100,000 buckets. The experimentation docs describe it in those terms directly.

Cross-SDK consistency: LaunchDarkly states it. The guarantee is easier than it sounds, because client-side SDKs do not bucket at all. They receive pre-evaluated results from LaunchDarkly's backend. Only server-side and edge SDKs run the algorithm.

Test vectors: yes, two layers. The Go evaluation engine carries hard-coded precomputed bucket values. The `sdk-test-harness` runs a cross-SDK conformance suite that recomputes the expected hash rather than hard-coding it, and brackets the expected bucket with narrow weight ranges.

### Evidence

Spec, quoted verbatim:

> "1. Concatenate the flag's key, the flag's salt, and the context's attribute value. Concatenate them with periods, `.`. If there is a seed present, concatenate seed and the context's attribute value instead.
> 2. Copy the first 15 characters of the SHA1 of the above.
> 3. Convert the resulting base 16 integer to a base 10 integer.
> 4. Divide the resulting base 10 integer by `0xFFFFFFFFFFFFFFF` (`1152921504606846975`). The result of this division is the context's variation bucket number.
>    1. If the context kind of the rollout or the attribute value for the bucket is not found, set the context variation's bucket number to 0."
>
> "5. Iterate over the rollout's weighted variations.
>    1. Starting at 0, keep adding the weighted variation's weight divided by 100,000 to the sum.
>    2. When a context's variation bucket is less than the above sum, return the weighted variation's variation index."
> — https://launchdarkly.com/docs/sdk/concepts/flag-evaluation-rules

Go implementation, `computeBucketValue`, quoted from
https://github.com/launchdarkly/go-server-sdk-evaluation/blob/v3/evaluator_bucketing.go :

```go
const (
	longScale = float32(0xFFFFFFFFFFFFFFF)
	initialHashInputBufferSize = 100
)

func (es *evaluationScope) computeBucketValue(
	isExperiment bool,
	seed ldvalue.OptionalInt,
	contextKind ldcontext.Kind,
	key string,
	attr ldattr.Ref,
	salt string,
) (float32, bucketingFailureReason, error) {
	hashInput := internal.LocalBuffer{Data: make([]byte, 0, initialHashInputBufferSize)}

	if seed.IsDefined() {
		hashInput.AppendInt(seed.IntValue())
	} else {
		hashInput.AppendString(key)
		hashInput.AppendByte('.')
		hashInput.AppendString(salt)
	}
	hashInput.AppendByte('.')

	if isExperiment || !attr.IsDefined() { // always bucket by key in an experiment
		attr = ldattr.NewLiteralRef(ldattr.KeyAttr)
	} else if attr.Err() != nil {
		return 0, bucketingFailureInvalidAttrRef, badAttrRefError(attr.String())
	}
	selectedContext := es.context.IndividualContextByKind(contextKind)
	if !selectedContext.IsDefined() {
		return 0, bucketingFailureContextLacksDesiredKind, nil
	}
	uValue := selectedContext.GetValueForRef(attr)
	if uValue.IsNull() { // attributes can't be null, so null means it doesn't exist
		return 0, bucketingFailureAttributeNotFound, nil
	}
	switch {
	case uValue.IsString():
		hashInput.AppendString(uValue.StringValue())
	case uValue.IsInt():
		hashInput.AppendInt(uValue.IntValue())
	default:
		// Non-integer numbers, and values of any other JSON type, can't be used for bucketing because they have no
		// single reliable representation as a string.
		return 0, bucketingFailureAttributeValueWrongType, nil
	}

	if es.owner.enableSecondaryKey && !isExperiment { // secondary key is not supported in experiments
		if secondary := selectedContext.Secondary(); secondary.IsDefined() {
			hashInput.AppendByte('.')
			hashInput.AppendString(secondary.StringValue())
		}
	}

	hashOutputBytes := sha1.Sum(hashInput.Data)
	hexEncodedChars := make([]byte, 64)
	hex.Encode(hexEncodedChars, hashOutputBytes[:])
	hash := hexEncodedChars[:15]

	intVal, _ := internal.ParseHexUint64(hash)

	bucket := float32(intVal) / longScale

	return bucket, 0, nil
}
```

The JavaScript implementation in `js-core` produces the same input string, confirming the format independently:

```ts
const prefix = seed ? Number(seed) : `${key}.${salt}`;
const hashKey = `${prefix}.${bucketableValue}`;
const hashVal = parseInt(this._sha1Hex(hashKey).substring(0, 15), 16);

// This is how this has worked in previous implementations, but it is not
// ideal.
// The maximum safe integer representation in JS is 2^53 - 1.
return [hashVal / 0xfffffffffffffff, true];
```
— https://github.com/launchdarkly/js-core/blob/main/packages/shared/sdk-server/src/evaluation/Bucketer.ts

Note: `0xfffffffffffffff` exceeds `Number.MAX_SAFE_INTEGER`, and so does a 15-hex-digit `hashVal`. The JS SDK carries an explicit `eslint-disable no-loss-of-precision` and a comment saying the approach "is not ideal". There is a public issue about exactly this: https://github.com/launchdarkly/node-server-sdk/issues/157

Weight accumulation and the last-bucket fallback, from the Go evaluator:

```go
var sum float32
for _, bucket := range r.Rollout.Variations {
	sum += float32(bucket.Weight) / 100000.0
	if bucketVal < sum {
		resultInExperiment := isExperiment && !bucket.Untracked &&
			problem != bucketingFailureContextLacksDesiredKind
		return bucket.Variation, resultInExperiment, nil
	}
}

// The user's bucket value was greater than or equal to the end of the last bucket. This could happen due
// to a rounding error, or due to the fact that we are scaling to 100000 rather than 99999, or the flag
// data could contain buckets that don't actually add up to 100000. Rather than returning an error in
// this case (or changing the scaling, which would potentially change the results for *all* users), we
// will simply put the user in the last bucket.
```
— https://github.com/launchdarkly/go-server-sdk-evaluation/blob/v3/evaluator.go

Hard-coded test vectors (flag key `hashKey`, salt `saltyA`):

| context value | seed | expected bucket |
|---|---|---|
| userKeyA | none | 0.42157587 |
| userKeyB | none | 0.6708485 |
| userKeyC | none | 0.10343106 |
| userKeyA | 61 | 0.09801207 |
| userKeyB | 61 | 0.14483777 |
| userKeyC | 61 | 0.9242641 |

— https://github.com/launchdarkly/go-server-sdk-evaluation/blob/v3/evaluator_bucketing_testdata_test.go

Cross-SDK conformance suite: https://github.com/launchdarkly/sdk-test-harness , file `sdktests/server_side_eval_bucketing.go`, which opens with:

> "These tests check for consistent computation of bucket values for rollouts/experiments across SDKs. They use the hash algorithm defined in computeExpectedBucketValue rather than relying on any hard-coded expected values, except in cases where we expect a specific edge-case result such as zero."

The harness works by starting a mock LaunchDarkly service and driving a small test service that each SDK implements.

Who runs the algorithm:

> "Client-side SDKs evaluate feature flags by contacting LaunchDarkly, which runs the evaluation rules described here on the backend. Server-side SDKs and edge SDKs evaluate feature flags internally using embedded evaluation rules."
> — https://launchdarkly.com/docs/sdk/concepts/flag-evaluation-rules

The stated cross-SDK guarantee:

> "A context receives a consistent variation for as long as the seed stays the same, no matter how many times it evaluates the flag or which SDK evaluates it."
> — https://launchdarkly.com/docs/home/experimentation/traffic-assignment

---

## 3. Sticky / persistent bucketing

### Answer

LaunchDarkly stores no per-subject assignment anywhere. It says so explicitly. Assignment is recomputed from the seed and the context key on every evaluation. Stickiness comes from keeping the seed and the bucket-to-variation mapping stable, not from a persistence layer.

Mechanically, an experiment iteration has a seed. 100,000 buckets are split into tracked buckets (in the experiment) and untracked buckets (outside it, served the control variation, excluded from results). When an operator raises the allocation, LaunchDarkly takes the new tracked buckets from the untracked pool, so contexts already in the experiment keep their variation without anything being stored.

When there are not enough untracked buckets left, behaviour splits on one setting, `Disable reshuffling`:

- Reshuffling allowed: LaunchDarkly generates a new seed. Every context re-maps. Assignments are scrambled across all variations.
- Reshuffling disabled: LaunchDarkly does not generate a new seed.

`Disable reshuffling` is the default on new experiments, and it only holds under monotonically increasing traffic. Decrease and then increase, and assignments may move. Pressing `Stop` and starting a new iteration always reshuffles, regardless of the checkbox.

Experiments in a layer share one seed. LaunchDarkly reshuffles a single layer experiment by redistributing which buckets belong to which variation, leaving the shared seed and the other experiments alone.

### Evidence

No stored assignment, quoted verbatim:

> "This calculation is deterministic. The same seed and the same context key always produce the same bucket, which means:
> * A context receives a consistent variation for as long as the seed stays the same, no matter how many times it evaluates the flag or which SDK evaluates it.
> * LaunchDarkly does not need to store a record of which variation each context received. It recalculates the assignment on every evaluation.
> * If the seed changes, every context maps to a new bucket, and contexts move between variations."
> — https://launchdarkly.com/docs/home/experimentation/traffic-assignment

Tracked and untracked buckets:

> "Tracked buckets are part of your experiment. The contexts in these buckets receive an experiment variation, and LaunchDarkly analyzes their metric events in your results. Untracked buckets are not part of your experiment. The contexts in these buckets receive the control variation, and LaunchDarkly excludes them from your results."
> — https://launchdarkly.com/docs/home/experimentation/traffic-assignment

What happens on a weight change:

> "When you increase your audience allocation, LaunchDarkly needs more tracked buckets than the previous iteration used. It takes them from the untracked buckets first, which leaves the buckets that were already tracked where they are. This is why the contexts already in your experiment keep their variations when you ramp up.
> If there are not enough untracked buckets remaining to cover the increase, LaunchDarkly cannot satisfy the new allocation without moving contexts. If you allow traffic reshuffling, LaunchDarkly generates a new seed for the iteration, which re-maps every context and redistributes them across all of the variations. If you disable traffic reshuffling, LaunchDarkly does not generate a new seed."
> — https://launchdarkly.com/docs/home/experimentation/traffic-assignment

Decreasing then increasing:

> "This setting only preserves assignments when you increase traffic. For example, increasing traffic from 5% to 20%, then from 20% to 60%, preserves existing assignments. If you decrease traffic and then increase it again, such as from 20% to 5%, then from 5% to 60%, LaunchDarkly may reassign contexts to different variations."
> — https://launchdarkly.com/docs/home/experimentation/reshuffle

The Stop-button trap:

> "Checking the **Disable reshuffling** box prevents traffic reshuffling only if you make changes to an experiment using the experiment's **Edit design** button. If you use the **Stop** button instead, LaunchDarkly will always reshuffle traffic into new variations when you start a new iteration, whether or not the **Disable reshuffling** box is checked."
> — https://launchdarkly.com/docs/home/experimentation/reshuffle

How the assignment reaches the SDK:

> "When you start an iteration, LaunchDarkly writes the bucket assignments into your flag's targeting rule as a percentage rollout and delivers the updated flag to your SDKs."
> — https://launchdarkly.com/docs/home/experimentation/traffic-assignment

The continuing case (30% at Blue/Green/Orange, raised to 60%), and the detail that the original 30% keep their variations but leave the analysis:

> "In the new iteration, the 30% that were already receiving variations Blue, Green, and Orange continue to receive those variations, but are no longer included in the experiment nor its analysis. New traffic is used for the additional 30% allocated to the experiment."
> — https://launchdarkly.com/docs/home/experimentation/reshuffle

Layers:

> "All of the experiments in a layer share one seed, rather than each iteration generating its own... LaunchDarkly can reshuffle one experiment in a layer by redistributing its blocks, without changing the seed the layer shares."
> — https://launchdarkly.com/docs/home/experimentation/traffic-assignment

---

## 4. Config distribution

### Answer

Client-side and mobile SDKs receive pre-evaluated values, one result per flag, for one specific evaluation context. They do not receive rules, clauses, segments, salts or targeting lists. LaunchDarkly's backend evaluates on their behalf.

Server-side and edge SDKs receive the complete ruleset for the environment: flags with `rules`, `clauses`, `targets`, `salt`, `variations`, `fallthrough`, `offVariation`, plus segments.

Transport: server-side SDKs default to streaming (SSE) and continue receiving updates over one persistent connection. Client-side SDKs open a polling request first and may then hold a streaming connection. Polling in server-side SDKs uses HTTP ETags with `if-none-match` and honours 304.

Versioning: yes, at several layers. Each flag carries a `version`. The pre-evaluated client payload carries both `version` (the payload item version) and `flagVersion` (the flag's own version). FDv2, the newer protocol, tracks aggregate payload state with a "payload selector" rather than a single payload-level version number.

There are endpoints that evaluate server-side for a given context and return the answer. They are exactly the endpoints client and mobile SDKs use, and the Relay Proxy exposes SDK-key-authenticated variants of them for anyone who needs evaluation without an SDK.

### Evidence

What each SDK type gets:

> "For security reasons, client-side SDKs cannot download and store an entire ruleset. Client-side SDKs typically run on customers' own devices, so they are vulnerable to having end users investigate SDK content by unpacking the SDK on a mobile device or inspecting its behavior in a browser."

> "Server-side SDKs receive the complete ruleset associated with an SDK key when they initialize a connection to LaunchDarkly's servers. LaunchDarkly continuously updates the SDK's cached flag ruleset whenever flag rules change on LaunchDarkly, using this persistent connection."

> "Server-side SDKs store information on flag rules and segments. Client-side SDKs store the flag evaluation results."
> — https://launchdarkly.com/docs/sdk/concepts/client-side-server-side

The same page gives the two payload shapes side by side. Client-side:

```json
{
  "show-widgets": {
    "version": 97,
    "flagVersion": 4,
    "value": false,
    "variation": 1,
    "trackEvents": false,
    "prerequisites": ["flag-1", "flag-2"]
  }
}
```

Server-side:

```json
{
  "flags":
    "show-widgets": {
      "key":"show-widgets",
      "version":4,
      "on":false,
      "trackEvents":false,
      "trackEventsFallthrough":false,
      "deleted":false,
      "prerequisites":[],
      "salt":"8e0438b01245445d870fa5d8275efd87",
      "sel":"bda12c82c38e4542b32d2d59046820e2",
      "targets":[{"values":["example-context-key"],"variation":0}],
      "rules":[ {
        "id":"3803d988-a23d-4a24-a66f-2b151749fd23",
        "variation":0,
        "clauses": [{ "attribute":"email", "op":"in", "values": ["@launchdarkly.com"], "negate":false }],
        "trackEvents":false
      }],
      "fallthrough": {"variation":1},
      "offVariation":1,
      "variations":[true,false],
      "debugEventsUntilDate":null,
      "clientSide":false
    }
}
```
— https://launchdarkly.com/docs/sdk/concepts/client-side-server-side

The client-side flag type in the JS SDK matches that payload exactly:

```ts
export interface Flag {
  version: number;
  flagVersion?: number;
  value: LDFlagValue;
  variation?: number;
  trackEvents?: boolean;
  trackReason?: boolean;
  reason?: LDEvaluationReason;
  debugEventsUntilDate?: number;
  deleted?: boolean;
  prerequisites?: string[];
}
```
— https://github.com/launchdarkly/js-core/blob/main/packages/shared/sdk-client/src/types/index.ts

The same file documents FDv2 payload versioning:

> "There is no aggregate payload-level version field; per-flag versioning is tracked via `flagVersion`, and aggregate payload state is tracked via the payload selector."

And the FDv2 mapper states the delegation plainly:

> "Client-side evaluation results are already in their final form (pre-evaluated by the server), so no transformation is needed — this is a passthrough."
> — https://github.com/launchdarkly/js-core/blob/main/packages/shared/sdk-client/src/datasource/flagEvalMapper.ts

ETag handling in the server-side polling requestor:

```ts
const updatedOptions = cachedETag
  ? { ...options, headers: { ...options.headers, 'if-none-match': cachedETag } }
  : options;

const res = await this._requests.fetch(requestUrl, updatedOptions);

if (res.status === 304 && cacheEntry) {
  return { res, body: cacheEntry.body };
}
```
— https://github.com/launchdarkly/js-core/blob/main/packages/shared/sdk-server/src/data_sources/Requestor.ts

Actual endpoint paths, from the JS client SDK:

- Browser polling: `/sdk/evalx/{clientSideId}/contexts/{base64url(context)}`, and `REPORT /sdk/evalx/{clientSideId}/context`
- Browser streaming: `/eval/{clientSideId}/{base64url(context)}`
- Mobile polling: `/msdk/evalx/contexts/{base64url(context)}`
- Mobile streaming: `/meval/{base64url(context)}`
- FDv2: `/sdk/poll/eval/...` and `/sdk/stream/eval/...`

— https://github.com/launchdarkly/js-core/blob/main/packages/shared/sdk-client/src/datasource/Endpoints.ts

The Relay Proxy documents both families and the server-side stream path `/all`, plus SDK-key-authenticated evaluation endpoints for use without an SDK:

> "If you're building an SDK for a language which isn't officially supported by LaunchDarkly, or want to evaluate feature flags internally without an SDK instance, the Relay Proxy provides endpoints for evaluating all feature flags for a given user."
>
> `/sdk/evalx/contexts/{contextBase64}` GET — "Evaluates all flag values for the given evaluation context"
> `/sdk/evalx/context` REPORT — "Same as above, but request body is the evaluation context JSON object (not in base64)"
> — https://github.com/launchdarkly/ld-relay/blob/v8/docs/endpoints.md

The same document notes: "For server-side SDKs other than PHP, the Relay Proxy does not support polling mode, only streaming."

---

## 5. Offline and stale config

### Answer

A client-side or mobile SDK that cannot reach LaunchDarkly serves the last values it stored. If it has never stored any, it serves the fallback value the application passed into the `variation` call.

There is no TTL and no staleness bound on that cached data. The bound is on count, not age: Android and the other mobile SDKs cap the number of cached contexts (`maxCachedContexts`) and evict the oldest context when the cap is exceeded. I found no documented expiry for the cached values themselves.

There is no bundled fallback file shipped with the SDK. The code-level default passed to `boolVariation(key, default)` is the only fallback. With no config at all, every evaluation returns that argument.

Server-side SDKs behave analogously: the in-memory feature store has no expiry, and a server SDK that never connected returns the code-level default.

Offline mode is an explicit configuration flag. It closes the connection, stops updates and stops sending events.

### Evidence

> "Offline mode closes an SDK's connection to LaunchDarkly and switches to a feature flag's last known values."
>
> "For client-side SDKs, if LaunchDarkly is unreachable or if an end user's device is not connected to a network, such as when the device is in airplane mode, the SDK uses the latest stored flag variation values in memory. If there are no previously stored variation values, the SDK uses the fallback values that you define in your code."
>
> "When the client is in offline mode, it makes no network requests, so it is suitable for unit-testing."
> — https://launchdarkly.com/docs/sdk/features/offline-mode

No TTL on the server-side store:

> "By default, LaunchDarkly's server-side SDKs connect to LaunchDarkly and receive feature flag data, store the flags in local memory, and update them when prompted to by LaunchDarkly. This collection of last known flag data is cached in the 'feature store' or 'data store', and cached values have no expiration or time-to-live (TTL) value."
> — https://launchdarkly.com/docs/sdk/features/storing-data

A TTL does exist, but only for the external-database configuration, and it governs how often the SDK re-reads the database, not how long flag data stays valid:

> "As long as the cache is fresh, evaluations will use the cache, even if the external database is unavailable. After the cache expires, the SDK attempts to re-read from the database. If the database is unavailable, the SDK returns flag fallback values."
> — https://launchdarkly.com/docs/sdk/features/storing-data

Mobile cache bounded by context count:

> "The data collected by the Android SDK persists until the number of cached contexts exceeds a limit. When you call `identify`, the number of cached contexts increments." The SDK "deletes context data in excess of `maxCachedContexts`, starting with the oldest context first."
> — https://launchdarkly.com/docs/sdk/client-side/android

Fallback semantics:

> "The fallback value is defined in your code, is one of the flag's variations, and is only returned if an error occurs." Error cases include "LaunchDarkly is unreachable, the feature flag key doesn't exist, or the context or user doesn't have a key specified."
> — https://launchdarkly.com/docs/sdk/features/evaluating

The spec's first preliminary check confirms the offline path: "If the SDK is offline, return the provided fallback value with the `ERROR` evaluation reason and the corresponding error code."
— https://launchdarkly.com/docs/sdk/concepts/flag-evaluation-rules

One more case: a flag that exists but is not available to client-side SDKs serves the fallback.

> "If a client-side or mobile SDK tries to evaluate a feature flag that is not available to it, then LaunchDarkly serves the fallback value for that flag."
> — https://launchdarkly.com/docs/home/flags/new

---

## 6. Exposure events

### Answer

The SDK emits them, not the application, and it emits at evaluation time. Calling `variation` records an event synchronously inside the SDK. Nothing is tied to render.

LaunchDarkly sends two kinds and they behave differently.

`summary` events are the default path. Every evaluation increments a counter. The dedup key is the triple `(flagKey, variation index, flag version)`. The summary rolls up a batch interval into one payload per flag with a count per counter key, plus the set of context kinds seen. Individual context identity is not in the summary.

`feature` events are full-fidelity, one per evaluation, no deduplication. The SDK only emits them when one of these is true: `trackEvents` is set on the flag, `trackEventsFallthrough` is set, `trackEvents` is set on the matched rule, or the matched rule or fallthrough has a rollout of kind `experiment` and the assigned variation is in the tracked variations. Experimentation therefore switches an evaluation from counted to individually recorded.

Prerequisite flags also produce events. The client SDK walks the `prerequisites` array of the evaluated flag and recurses, emitting events for each one, with cycle detection.

Suppression: the application can turn off event sending entirely with the SDK's events option (`sendEvents: false` and its per-language equivalents). There is no documented per-call suppression. LaunchDarkly warns against using the global switch outside testing.

### Evidence

Emitted at evaluation, in the client SDK. `_variationInternal` calls `this._eventProcessor?.sendEvent(...)` directly inside the evaluation path, and recurses over prerequisites "to emulate prereq evaluations occurring with desirable side effects such as events for prereqs".
— https://github.com/launchdarkly/js-core/blob/main/packages/shared/sdk-client/src/LDClientImpl.ts

Summary dedup key, verbatim:

```ts
function counterKey(event: InputEvalEvent) {
  return `${event.key}:${
    event.variation !== null && event.variation !== undefined ? event.variation : ''
  }:${event.version !== null && event.version !== undefined ? event.version : ''}`;
}
```
— https://github.com/launchdarkly/js-core/blob/main/packages/shared/common/src/internal/events/EventSummarizer.ts

The same file shows the roll-up: one `SummaryCounter` per key holding `count`, `value`, `default`, `version`, `variation`, plus a per-flag set of context kinds, emitted as a single `summary` event with `startDate` and `endDate`.

Event kinds:

> "`summary` events describe a set of individual evaluations and customizations over an interval."
> "`feature` events include additional evaluation and customization details for flags or configs used in Experimentation and any flags you enable detailed tracking for."
> — https://launchdarkly.com/docs/sdk/concepts/events

When a feature event is sent, verbatim:

> "Feature events are only sent by the SDK in one of these scenarios:
> * the `trackEvents` or `trackEventsFallthrough` attribute on the flag configuration is sent
> * the `trackEvents` attribute on a targeting rule is sent
> * the targeting rule or default rule when on has a rollout of kind `"experiment"` and the variation associated with the event is included in the tracked variations for that rollout"
> — https://launchdarkly.com/docs/integrations/data-export/schema-reference

Prerequisite events:

> "Any client-side SDK that is configured to send events sends a combination of `summary`, `debug`, and `feature` events back to LaunchDarkly for each evaluated flag. Additionally, most client-side SDKs also send the same combination... for any flags that are prerequisites of the flag explicitly being evaluated. Sending events for prerequisite flags is required for some LaunchDarkly features, such as holdouts."
> — https://launchdarkly.com/docs/sdk/concepts/events

Suppression and LaunchDarkly's position on it:

> "You can disable SDKs from sending events for testing purposes."
> "You can disable SDKs from sending events, but we strongly recommend against it outside of testing purposes. Many LaunchDarkly features will not work correctly if they do not regularly receive analytics events."
> — https://launchdarkly.com/docs/sdk/concepts/events

Buffering: server-side flush is "usually a few seconds", mobile is "around 30 seconds" to save battery, both configurable.
— https://launchdarkly.com/docs/sdk/concepts/events

The `Untracked` field on a weighted variation is what excludes control traffic from experiment analysis at the SDK level, and the Go evaluator returns `inExperiment` only when `!bucket.Untracked`.
— https://github.com/launchdarkly/go-server-sdk-evaluation/blob/v3/evaluator.go

---

## 7. Typing and codegen

### Answer

No. LaunchDarkly ships no tool that generates typed flag accessors from flag configuration, for TypeScript, Swift, Kotlin or anything else. Not found.

What exists instead:

- Per-type variation methods on every SDK (`boolVariation`, `stringVariation`, `numberVariation`, `jsonVariation`). These are hand-called and hand-typed. The flag key is a string literal and the type is asserted by which method you call. A mismatch surfaces at runtime.
- A runtime type check inside the SDK that, on mismatch, logs an error, emits an event with the default value, and returns the code-level default with error kind `WRONG_TYPE`.
- `ld-find-code-refs` / the code references integration, which scans a repository for flag key occurrences. It detects use, not type.
- JSON schema validation on multivariate JSON variations, enforced in LaunchDarkly, not in your compiler.
- `api-client-typescript`, `api-client-go` and siblings, generated from the OpenAPI spec. Those type the management API, not your flags.

Drift between a flag's configured type and the accessor the code calls is caught only at runtime, per evaluation.

### Evidence

Where I looked and found nothing:

- The docs index at https://launchdarkly.com/docs/llms.txt , grepped for "codegen", "generat", "type-safe", "typed". Only AI/metric autogeneration and OpenAPI client generation came back.
- The official CLI, https://github.com/launchdarkly/ldcli , `cmd/root.go` command registration. Commands are: `config`, `setup`, `quickstart`, `login`, `signup`, `resources`, `dev-server`, `sourcemaps`, `symbols`, `whoami`, plus flag `toggle-on`/`toggle-off`/`archive`, `members invite`, `sdk-active`. No generate command.
- https://launchdarkly.com/docs/sdk/features/evaluating , which documents the typed variation methods only.

Runtime type check, from the client SDK:

```ts
const [matched, type] = typeChecker(value);
if (!matched) {
  // ... sends an eval event with the default value ...
  const error = new LDClientError(
    `Wrong type "${type}" for feature flag "${flagKey}"; returning default value`,
  );
  this.emitter.emit('error', this._activeContextTracker.getUnwrappedContext(), error);
  return createErrorEvaluationDetail(ErrorKinds.WrongType, defaultValue);
}
```
— https://github.com/launchdarkly/js-core/blob/main/packages/shared/sdk-client/src/LDClientImpl.ts

A public request for generated type-safe flags exists and is closed: https://github.com/launchdarkly/js-sdk-common/issues/32 . I could not read the comment thread through WebFetch, so I do not know the stated reason for closure. See "Where I could not verify".

Code references tool: https://github.com/launchdarkly/find-code-references

---

## 8. Flag and rule identity

### Answer

Yes. Both variations and rules carry stable identifiers.

A rule's `id` is a randomized value assigned at creation. It survives reordering, and LaunchDarkly documents that explicitly. Inserting a rule does not change any existing rule's id, because ids are not positional. Changing a rollout percentage inside a rule does not change the rule's id either, since the id lives on the rule and the weights live on the rollout underneath it.

The positional index is a separate thing and it does move. Both travel together in the evaluation reason.

A variation's `_id` is assigned per variation in the REST API model. The event stream identifies variations by index, not by `_id`.

The event stream does depend on rule identity. A `feature` event's `reason` object carries `ruleIndex` and `ruleId` when the reason is `RULE_MATCH`. Experiment attribution also depends on rule identity indirectly: `trackEvents` is a per-rule field, and an experiment rollout lives on a specific rule.

Reordering rules changes `ruleIndex` in every subsequent event for those rules while `ruleId` stays put. Analysis keyed on index breaks across a reorder; analysis keyed on id does not.

### Evidence

Rule id is randomized and per-rule, from the Go data model:

```go
type FlagRule struct {
	VariationOrRollout
	// ID is a randomized identifier assigned to each rule when it is created.
	//
	// This is used to populate the RuleID property of ldreason.EvaluationReason.
	ID string
	Clauses []Clause
	// TrackEvents is used internally by the SDK analytics event system.
	//
	// This field is true if the current LaunchDarkly account has experimentation enabled, has associated
	// this flag with an experiment, and has enabled this rule for the experiment. This tells the SDK to
	// send full event data for any evaluation that matches this rule.
	TrackEvents bool
}
```
— https://github.com/launchdarkly/go-server-sdk-evaluation/blob/v3/ldmodel/model_flag.go

Stability under reordering, verbatim from the docs. `ruleIndex` is "the positional index of the matched rule (0 for the first rule)"; `ruleId` is:

> "the rule's unique identifier, and stays the same even if you rearrange the order of the rules"
> — https://launchdarkly.com/docs/sdk/concepts/evaluation-reasons

The seed and rule id are independent: a rollout's `Seed` lives on the `Rollout` struct inside the rule, so changing the seed (a new experiment iteration) does not change the rule id.
— https://github.com/launchdarkly/go-server-sdk-evaluation/blob/v3/ldmodel/model_flag.go

What reaches the event stream:

```json
"reason": {
    "kind": "RULE_MATCH",
    "ruleIndex": 0,
    "ruleId": "id",
    "inExperiment": true,
    "bigSegmentsStatus": "HEALTHY"
}
```
— https://launchdarkly.com/docs/integrations/data-export/schema-reference

The same page shows that variations travel as an index, with an optional `variationName`, and never as `_id`:

> "`variation`: The variation of the flag requested. The SDK stores flag variation values in an array. This value corresponds to the index of the variation the array."
> "`variationName`: The evaluated variation's name, if it exists. If the evaluated variation doesn't have a name, this field doesn't appear."

Variation `_id` and rule `_id` in the management API: https://launchdarkly.com/docs/api/feature-flags/patch-feature-flag

The server-side payload example on https://launchdarkly.com/docs/sdk/concepts/client-side-server-side shows a real rule id: `"id":"3803d988-a23d-4a24-a66f-2b151749fd23"`.

---

## 9. PII in events

### Answer

By default, everything you put on the context travels, except the SDK-side private-attribute redactions you configure.

`feature` events carry `contextKeys` (a map of context kind to key) and, in some schema versions, an inline `context` object. `index` and `identify` events carry the full context attribute object. `summary` events carry counters and the set of context kinds, not identities.

The context `key` always travels. It cannot be made private, and neither can `kind`, `_meta` or `anonymous`.

Private attributes are opt-out, not opt-in. An attribute is sent unless you mark it private. Two levers: `allAttributesPrivate` (a boolean redacting every attribute except the protected four) and `privateAttributes` (a list of attribute references). Both can be set at SDK configuration or per context.

There is no hashing and no pseudonymisation of the key in events. Secure mode uses an HMAC-SHA256 of the key, but that is an authentication token on the evaluation request, not a redaction of the key in events.

Redaction is visible to LaunchDarkly. The SDK sends a `_meta.redactedAttributes` array naming what it removed, so LaunchDarkly learns the attribute names even when it does not learn the values.

Client-side SDKs are a special case: a private attribute still goes to LaunchDarkly, because the backend evaluates the flag and needs it. It is excluded from events and not stored.

Anonymous contexts do not hide anything by themselves. They keep the context off the Contexts list and out of MAU search. LaunchDarkly recommends private attributes over anonymous contexts for PII. Some server-side SDKs can be configured to omit anonymous context data from `index` and `identify` events.

### Evidence

What cannot be made private, from the JS SDK source:

```ts
// These attributes cannot be removed via a private attribute.
const protectedAttributes = ['key', 'kind', '_meta', 'anonymous'].map(
  (str) => new AttributeReference(str, true),
);
```

And the redaction disclosure:

```ts
if (excluded.length) {
  if (!cloned._meta) {
    cloned._meta = {};
  }
  cloned._meta.redactedAttributes = excluded;
}
```
— https://github.com/launchdarkly/js-core/blob/main/packages/shared/common/src/ContextFilter.ts

The same file implements `allAttributesPrivate` by turning every key of the context into a redaction reference, and implements `redactAnonymousAttributes` as an optional per-call flag.

Docs on the two scopes and the client-side exception:

> "If you are using a server-side SDK, the SDK will not send the private attribute back to LaunchDarkly."
> "If you are using a client-side SDK, the SDK will send the private attribute back to LaunchDarkly for evaluation. However, the SDK won't send the attribute to LaunchDarkly in events data, LaunchDarkly won't store the private attribute, and the private attribute will not appear on the Contexts list or on the detail page for the context."
> "Note that the context `key` attribute can never be private."
> — https://launchdarkly.com/docs/sdk/concepts/client-side-server-side

> "The context key is not optional. You cannot set either the context key or the context kind as a private attribute."
> — https://launchdarkly.com/docs/sdk/features/private-attributes

A caveat on removing the private designation later:

> "If you initially mark an attribute as private, LaunchDarkly will continue to treat the attribute as private in subsequent evaluations as long as the context is in the Contexts list, even if you later remove the 'private' designation."
> — https://launchdarkly.com/docs/sdk/features/private-attributes

Event payloads. A `feature` event:

```json
{
    "kind": "feature",
    "creationDate": 1462220944000,
    "contextKeys": { "user": "example-context-key" },
    "context": { "key": "example-context-key", "kind": "user", "name": "Sandy" },
    "key": "flag-key",
    "value": ["evaluation", "result"],
    "variation": 0,
    "reason": { "kind": "RULE_MATCH", "ruleIndex": 0, "ruleId": "id", "inExperiment": true }
}
```

An `index` event carries the full attribute object, nested values included:

```json
{
  "kind": "index",
  "context": {
    "key": "example-context-key",
    "kind": "user",
    "name": "Sandy Smith",
    "jobFunction": "doctor",
    "moreComplex": { "city": "Springfield", "moreThanOne": [1, 2, 3] }
  }
}
```
— https://launchdarkly.com/docs/integrations/data-export/schema-reference

Index event dedup, from the same page:

> "Server-side SDKs have internal logic that determines whether it is necessary to send an `index` event. SDKs do not create `index` events for every flag evaluation. If the SDKs identify the same context multiple times in succession, the SDK does not send multiple `index` events. The SDK identifies contexts based on the contexts' keys."
> "Client-side SDKs do not send `index` events. Instead, client-side SDKs send `identify` events when the SDK initializes, which include all of the context properties."

Anonymous contexts:

> "You can use anonymous contexts to hide personally identifiable information (PII), but we recommend using private attributes instead."
> "Anonymous contexts still count toward your limit for monthly contexts or monthly active users (MAU)."
> — https://launchdarkly.com/docs/home/flags/anonymous-contexts

> "By default, `index` and `identify` events push context data to LaunchDarkly. In some server-side SDKs, you can configure the SDK to omit data from anonymous contexts when sending these `index` and `identify` events."
> — https://launchdarkly.com/docs/sdk/concepts/events

Secure mode, for completeness, is an HMAC on the request and not an event redaction:

> "Secure mode works when you configure your JavaScript-based SDK to include a server-generated HMAC SHA256 hash of your context key or user key. This hash is signed with the SDK key for your environment."
> — https://launchdarkly.com/docs/sdk/features/secure-mode

---

## 10. Client-side availability

### Answer

The setting is called **Client-side availability**. It is two independent booleans, shown in the UI as the checkboxes **SDKs using Mobile key** and **SDKs using Client-side ID**. In the REST API it is the object `clientSideAvailability` with fields `usingMobileKey` and `usingEnvironmentId`. In the flag data the server-side SDK receives, the same concept appears as `"clientSide": false`. It can be set per flag, or as a project-wide default for new flags on the project's Flag settings page.

What it withholds: the flag's evaluation result from the client-side and mobile evaluation endpoints. A flag with the box unchecked is not in the payload those SDKs receive. A client-side SDK asking for it gets the code-level fallback value.

What it does not hide:

- The flag's rules, clauses, segments, salt and targeting lists. Those are never sent to any client-side SDK, checked or unchecked. The setting is not what protects them.
- Anything once the box is checked. With the box on, the flag's evaluated value for any context is retrievable by anyone holding the client-side ID or mobile key, for any context they choose to construct, unless Secure Mode is on. Secure Mode is the control that binds a client to one server-signed context key.
- Server-side and edge SDK access. Those read the full ruleset by SDK key regardless of this setting.
- The flag key in your own shipped bundle.
- Prerequisite flags automatically. If the flag has prerequisites, each prerequisite must be made available separately.

Presentation: both. The docs frame the default as an operational must-do ("you must indicate if you are using either mobile or client-side SDKs") and attach a security warning to the mobile half specifically. The security argument in the docs is about key leakage, not about the setting hiding flag logic, because the logic is never in the client payload anyway.

### Evidence

Exact wording, verbatim:

> "By default, flags are only available to server-side SDKs. If you don't check the **SDKs using Mobile Key** and/or **SDKs using client-side ID** boxes when creating a flag, then your mobile and client-side SDKs will not be able to evaluate the flag."
>
> "By default, flags are only available to server-side SDKs. If you're using a client-side or mobile SDK, you must make your flags available to client-side or mobile SDKs for those SDKs to be able to evaluate them. If a client-side or mobile SDK tries to evaluate a feature flag that is not available to it, then LaunchDarkly serves the fallback value for that flag."
>
> "If you're using client-side or mobile SDKs, and your flags have prerequisites, then the prerequisite flags must also be available to client-side or mobile SDKs."
>
> "You can update your project settings so that all new flags are automatically available to client-side or mobile SDKs... LaunchDarkly accounts created after October 21, 2025 have this box checked by default."
> — https://launchdarkly.com/docs/home/flags/new

The security note, headed "Security implications of making flags available to mobile SDKs", verbatim:

> "SDKs for mobile devices use mobile SDK keys, which are readily available to mobile apps. A leaked mobile SDK key allows the holder to circumvent JavaScript's Secure Mode. This can give the holder access to the value of every flag for any context, even without knowing the SDK key that hashes the context key in Secure Mode."
> — https://launchdarkly.com/docs/home/flags/new

Project-level default, under the heading "Client-side availability": https://launchdarkly.com/docs/home/flags/proj-flag-settings

API field names `clientSideAvailability.usingMobileKey` and `clientSideAvailability.usingEnvironmentId`: https://launchdarkly.com/docs/api/feature-flags/patch-feature-flag

The `"clientSide": false` field in the server-side flag payload example: https://launchdarkly.com/docs/sdk/concepts/client-side-server-side

Why rules are not the thing being hidden:

> "Flag rules may include context identifiers or other personally identifiable information (PII) that you might not want to transmit to client-side applications. Consequently, client-side SDKs depend on LaunchDarkly's servers to safely store flag rules."
>
> "The client-side flag data does not include sensitive data, so no personally identifiable information (PII) is exposed on the client side if the code is unpacked or inspected."
> — https://launchdarkly.com/docs/sdk/concepts/client-side-server-side

Secure Mode as the actual per-context control:

> "Secure mode ensures that customers' feature flag evaluations are kept private in web browser environments, and that one end user cannot inspect the variations for another end user. On an insecure device, a malicious end user could use a context or user key to identify what flag values another end user receives by analyzing the results of multiple flag evaluations. Secure mode prevents you from doing an evaluation for a context or user key that hasn't been signed on the backend."
> — https://launchdarkly.com/docs/sdk/features/secure-mode

The operational framing that client-side flags are advisory, from LaunchDarkly's own blog:

> "Because browsers are an untrusted environment, our client-side SDK uses a completely different approach that allows us to serve feature flags to your users securely."
> — https://launchdarkly.com/blog/keeping-client-side-feature-flags-secure/

---

## What LaunchDarkly does that surprised me

**There is no assignment store.** I expected a persistence layer keyed by subject, like the sticky-bucketing tables other platforms keep. LaunchDarkly has none and says so in one line: "LaunchDarkly does not need to store a record of which variation each context received. It recalculates the assignment on every evaluation." Stickiness is a property of the seed plus the bucket-to-variation map, and the entire "keep users on their variation" feature reduces to "do not regenerate the seed, and take new tracked buckets from the untracked pool first".

**The untracked-bucket trick.** Raising an experiment from 30% to 60% does not move anyone, because the 30,000 new tracked buckets come out of the 70,000 untracked ones. That is why the guarantee only holds for monotonically increasing traffic, and why decreasing then increasing breaks it. It also means the original 30% keep their variation but drop out of the analysis, which is a real and easy-to-miss statistical consequence of ramping.

**The Stop button silently overrides the setting.** `Disable reshuffling` is the default, and pressing `Stop` instead of `Edit design` reshuffles everyone anyway. An operator could plausibly do that without knowing it broke the assignment continuity they explicitly asked for.

**Client-side SDKs do not evaluate.** The name "SDK" suggests local logic. In the client and mobile SDKs, `boolVariation` is a hash-map lookup into pre-evaluated results the backend computed, plus a type check plus an event. Every flag change requires a network round trip. That also means cross-SDK bucketing consistency is not an interoperability problem for client SDKs; there is only one implementation that matters, on LaunchDarkly's side.

**The bucket value loses precision in JavaScript on purpose.** `parseInt(sha1.substring(0, 15), 16)` produces values above `Number.MAX_SAFE_INTEGER`, and the divisor `0xfffffffffffffff` does too. The JS SDK carries `eslint-disable no-loss-of-precision` and a comment reading "This is how this has worked in previous implementations, but it is not ideal." The Go engine's comment about the last bucket says the same thing about the choice to scale to 100000 rather than 99999: "changing the scaling... would potentially change the results for *all* users". Both are frozen because changing them would re-bucket the installed base.

**The redaction list is itself telemetry.** Marking an attribute private removes the value but adds its name to `_meta.redactedAttributes`, which goes to LaunchDarkly. You are disclosing your schema while withholding the data.

**SHA-1 is the hash, deliberately.** The Go source carries `//nolint:gosec // SHA1 is cryptographically weak but we are not using it to hash any credentials`. Bucketing is public-input, so the weakness does not matter, but it does mean the assignment is trivially predictable by anyone who knows the flag key and salt.

**Event dedup keys on flag version.** A flag edit invalidates every summary counter for that flag. That is correct for analysis and it means a busy flag under frequent edits produces more summary counter rows than you would guess.

---

## Where I could not verify

**Whether a mobile SDK's cached flag values ever expire.** The Android docs describe `maxCachedContexts`, an eviction bound on the number of contexts, and the server-side docs state plainly that cached flag data has "no expiration or time-to-live (TTL) value". I found no equivalent statement for mobile and no documented staleness bound on the values themselves. I looked at https://launchdarkly.com/docs/sdk/features/offline-mode , https://launchdarkly.com/docs/sdk/features/storing-data and https://launchdarkly.com/docs/sdk/client-side/android . I did not read the iOS or Android SDK source to confirm.

**LaunchDarkly's stated reason for closing the type-safe flags request.** https://github.com/launchdarkly/js-sdk-common/issues/32 is closed. WebFetch returned the issue body without the comment thread, so I cannot report what the maintainers said. The GitHub MCP server in this session failed to connect (`Authorization header is badly formatted`), and the unauthenticated GitHub search API refused the query. Not verified.

**Whether the cross-SDK test harness exercises client-side bucketing.** `sdk-test-harness` contains `sdktests/server_side_eval_bucketing.go` and `sdktests/client_side_events_experimentation.go`, but I found no `client_side_eval_bucketing.go`. That is consistent with client SDKs not bucketing, but I did not enumerate the full `sdktests` directory or the YAML data files to rule out client-side bucketing coverage elsewhere.

**Exact per-SDK names of the option that disables event sending.** The docs say `sendEvents` for the Cloudflare and Vercel SDKs and state generally that events can be disabled, but https://launchdarkly.com/docs/sdk/features/config does not give one canonical name across all SDKs, and I did not check each SDK's configuration builder.

**Whether `variationName` appears in live SDK-emitted events or only in exported Data Export events.** The Data Export schema documents `variationName` on a version 1 feature event. The `InputEvalEvent` class in `js-core` has no name field. I did not determine whether LaunchDarkly enriches the event server-side at export time.

**The `samplingRatio` field's semantics.** It appears in the Data Export feature event example, on `FlagEvaluationResult` in the client SDK types, and on `InputEvalEvent` with a default of 1. I did not find documentation explaining when LaunchDarkly sets it below 1 or how it affects exposure counts.

**Whether inserting a rule in the middle preserves the ids of rules after it.** The docs guarantee id stability across reordering, and the data model shows ids are per-rule and randomized at creation, so insertion logically cannot renumber them. I did not find a documented statement about insertion specifically, and I did not test it.
