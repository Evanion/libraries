# @evanion/feature: the observation seam

Status: proposed
Packages: `@evanion/feature`. One new optional parameter on `createFeatures`,
four new exported types, one new internal module for the swallowed-failure
warning. `@evanion/feature/react` changes in neither runtime nor types.
Depends on: `docs/specs/2026-09-21-acl-enterprise-tooling.md` § 5, which
designed this seam for `@evanion/acl` and settled the line that governs it.
Depends on: `docs/specs/2026-09-11-feature-toggles.md` decision 5, which says
the store holds intent and that resolution is computed on read and never
written back.
Depends on: `docs/specs/2026-09-23-feature-variants.md`, whose "Out of scope"
routes exposure tracking here and whose "Result" defines `variant`, `value` and
`assignment`.
Depends on: `libs/feature/src/lib/features.ts` (the four entry points at
`:34`, `:35`, `:41` and `:49-53`; `withNow` at `:104-107`, which settles the
instant once per call; `resolve` at `:109-124`; `toggle` at `:142-168`, whose
two internal `resolve` calls sit at `:156` and `:160` and whose comparison of
their results sits at `:164`; `isEnabled` at `:178`, which delegates to
`resolve`; `deepFreeze` at `:56-61`).
Depends on: `libs/feature/src/lib/evaluate.ts` (`ruleId` at `:17-19`, the
positional fallback this seam cannot live with; `blockingParent` at `:97-108`,
which reads a parent's `enabled` during the cascade; `decide` at `:160-205`).
Depends on: `libs/feature/src/lib/types.ts` (`Decision` at `:159-171` and the
output-only note above it at `:152-158`; `EvaluationContext` at `:110-115`;
`PlanEntry` at `:176-184`; `ToggleResult` at `:188`).
Depends on: issue #245, which replaces the positional rule id with a content
hash. § 7 says why this seam cannot be released before it.
Reads: `docs/research/2026-09-23-growthbook-statsig.md`,
`docs/research/2026-09-23-launchdarkly.md`,
`docs/research/2026-09-23-unleash-flagsmith.md` and
`docs/research/2026-09-23-openfeature-posthog.md`. Six products, read at source.
§ 1, § 4.2 and § 7 cite them.
Tracks: exposure tracking, routed here by decision 12 of the variants spec.

## Decisions

1. Exposure is not an event this seam can emit. The application records
   exposure at the render site, and § 1 is the argument.
2. An observer may read what an entry point returned and may never change an
   outcome.
3. One event per public entry point call, carrying the value the caller
   received. `resolve` emits one event holding every decision, and no entry
   point emits one event per feature.
4. The internal `resolve` calls inside `isEnabled` and `toggle` emit nothing.
   The public entry point the application called is what the event names.
5. An event carries no `EvaluationContext`. It carries the settled instant and
   the returned value. Whether it also carries a subject identifier is open,
   and § 4.2 states the two postures with the evidence behind each.
6. The observer is installed at construction, through a second optional
   parameter on `createFeatures`.
7. The signature is `(event) => void | Promise<unknown>`. The engine attaches a
   rejection handler to a returned thenable and never awaits it.
8. A synchronous throw and a rejected promise are both caught. An
   `onObserveError` callback reports them, and a local `warnOnce` reports them
   when the application supplied none.
9. The engine deep-freezes the value an entry point returns when an observer is
   installed, so the readonly event type is true at runtime for a JavaScript
   caller.
10. Issue #245 is merged before this seam is released. A control plane assigns
    a stable rule id at creation, and a content hash covers hand-authored
    configuration with `rollout.percent` excluded. § 7.
11. The library performs no network call at evaluation, and this seam does not
    change that. Every process holds the rules and evaluates them locally,
    browsers and mobile clients included, so an observer runs wherever the
    application installed it.
12. The library evaluates the document it is handed. It owns no policy about
    where that document came from or how old it is.
13. A member on an event that reports a version or a capability never enables a
    downgrade of the evaluation algorithm. § 3.

## 1. Exposure does not belong in this seam

This is the question the document exists to answer, and the answer overturns
decision 12 of the variants spec. That decision routed exposure here. The seam
cannot carry it.

An exposure record answers "this subject saw this variant of this feature".
Four facts about the package put that answer out of the library's reach.

`resolve` decides every configured feature in one call (`features.ts:115-119`
walks `graph.order` and decides each one). An application renders some subset
of them. A store holding forty features resolves forty decisions on a request
that renders three. An observer fired from `resolve` would record thirty-seven
exposures to variants nobody saw, and an experiment computed over those records
measures the wrong denominator. A decision is not a view.

The React path removes even the per-key call. `FeatureProvider` resolves once
in a `useMemo` (`react/index.tsx:59-65`) and `useFeature` reads a key out of
the record already computed (`react/index.tsx:90-104`). No library code runs at
the render site at all. The component that renders the blue call-to-action
calls `useFeature('checkout-cta')`, which touches a plain object and returns.
A seam installed on `createFeatures` sees nothing at that moment, because
nothing of the library's is executing.

A server and a browser both decide. A page renders on the server and hydrates
in the browser, and both processes resolve the same features for the same
subject. Two observers would emit two events for one view, and the library
holds nothing that tells them apart.

Deduplication is the application's state. An experiment wants one exposure per
subject per feature per session. The library holds no session, no storage and
no subject identity beyond the string the caller passes each call. The variants
spec already refused storage for the same reason in its "Sticky assignment"
section, and `stickyVariants` exists because an application stores what the
library will not.

### Every product researched emits at evaluation, and then dedupes

No product I read offers a render-time hook. Each one fires exposure inside the
evaluation call, and each one then built machinery against the over-count the
four facts above predict. That machinery is the evidence.

GrowthBook fires the tracking callback as step 14 of `evalFeature`, after the
variation is chosen and after the sticky bucket is written
(`docs/research/2026-09-23-growthbook-statsig.md` § 6). It dedupes in instance
memory on `hashAttribute + hashValue + experiment.key + variationId`, and that
set does not outlive the page load. The server-plus-browser double needs a second
mechanism: a deferred tracking queue that the server exports and the browser
imports, keyed on the same string. The documented pattern is to pass no
`trackingCallback` to the constructor, because a client instance that has one
fires its own exposure and then fires the imported one beside it.

Statsig dedupes twice over and the two halves cannot see each other. The client
keeps a time map over a rolling ten-minute window
(`DEDUPER_WINDOW_DURATION_MS = 600_000`), and the server SDKs keep a Set cleared
every sixty seconds. What actually prevents the duplicate across a server render
and a browser hydration is unrelated to both dedupers: the client SDK drops every event when it detects
a Node environment, `loggingEnabled` defaulting to `'browser-only'`. One option
value flips that off. Server SDKs also sample exposures away under a remote
`sampling_mode` and write the rate onto the event.

PostHog has no such guard and double-counts. Its browser SDK dedupes on
`(flag, String(value))` under `$flag_call_reported` in localStorage and a
cookie, so a repeat visitor emits nothing at all. Its Node SDK dedupes on
`` `${key}_${response}` `` per `distinctId` in process memory. Neither
suppresses the other, so a first visit that renders on a server and hydrates in
a browser emits two exposures for one view, and the next visit emits none
(`docs/research/2026-09-23-openfeature-posthog.md` § 9).

LaunchDarkly emits inside `_variationInternal` and recurses over prerequisite
flags. Its `summary` counters dedupe on `flagKey:variation:version`, and the
full-fidelity `feature` events that experimentation switches on carry no
deduplication at all (`docs/research/2026-09-23-launchdarkly.md` § 6).

Unleash fires an impression event inside `isEnabled` and `getVariant`, carrying
the whole context, with no dedup anywhere in the SDK, opt-in per flag by an
operator (`docs/research/2026-09-23-unleash-flagsmith.md` § 6).

Flagsmith dedupes its `$flag_exposure` event on
`(feature_name, identifier, value)` for the length of one ten-second flush
window, and refuses to emit at all without an identifier, because it reconciles
exposures against conversion events
(`docs/research/2026-09-23-unleash-flagsmith.md` § 6).

Five of the six built a deduper, and every one of those dedupers is state a
library holds about a subject over time: a Set, a time map, a localStorage
entry, a counter keyed on a flag version. This package holds none of that, and
decision 5 of the toggles spec is why it never will. The double-count § 1
predicts is what PostHog produces today.

So the application emits exposure, and it emits it where it renders:

```tsx
function Cta() {
  const { variant, value } = useVariant('checkout-cta');
  useEffect(() => {
    analytics.exposure({ feature: 'checkout-cta', variant, subject: userId });
  }, [variant]);
  return <Button label={value?.label ?? 'Buy'} />;
}
```

What the library owes an application writing that line is a decision carrying
everything the record needs, and the variants spec already put it there.
`Decision.variant` names the variant, `Decision.assignment.source` says whether
the weights, a rule pin, a stored assignment or the control produced it, and
`assignment.bucket` carries the number the split used. After issue #245,
`Decision.rule` names a rule stably enough to join records across a
configuration change. An application reading those four fields writes a
complete exposure record with no help from a callback.

The documentation has to say this in the same words at the member, because an
operator who reads "the library supports an observer" will assume the observer
counts exposures, and the numbers it would produce look plausible and are
wrong.

### What the seam covers instead

Decisions, as decisions. The seam answers questions about the process, and four
consumers want it.

A diagnostic stream. An operator asking why a subject did not get a feature
reads the `no-rule-matched` breakdown (`types.ts:166`) and the `dependency-off`
cause (`types.ts:170`), which the caller usually discards.

Configuration drift. An event carrying the envelope version alongside the
decisions shows which version each replica decided under during a rollout.
`docs/specs/2026-09-23-feature-config-distribution.md` owns the version and the
reload, and this document only reads it.

A toggle audit. `toggle` writes intent (`features.ts:158`), and it is the one
entry point that changes the store. An event naming the key, the new value and
the dependants going off with it is the record an operator wants at 3am.

Build-time evidence. `plan` partitions at build time, and an event carrying the
`Plan` records what a build baked in and what it deferred.

## 2. The event shape, per entry point

`@evanion/acl` settled the analogous question in its § 5.6: the event follows
the entry point, and the batch is the shape the caller received. The same
answer holds here, and the reasoning splits differently across the four entry
points because two of them call `resolve` internally.

### 2.1 `resolve` emits one event holding every decision

The alternative is one event per feature, fired inside the loop at
`features.ts:118`. Two arguments refuse it.

Backpressure, which is ACL § 5.6's decisive argument and is worse here. The
per-feature shape puts one promise in flight per feature per call. A
forty-feature store under a hundred requests a second puts four thousand
promises a second into a queue the library never drains, because § 5 says the
engine never awaits. Measured on an Apple M1 Pro under Node 24.20.0, over
50,000 iterations after a 5,000-iteration warm-up, forty features each carrying
two rules: the per-call shape with an `async` no-op observer ran within
run-to-run noise of the bare call, and the per-feature shape with the same
observer added 4 to 6 microseconds per call for its forty promise allocations.
The latency difference is small and the queue difference is a factor of forty,
and only one of the two is visible to whoever installed the hook.

Mutation through the cascade. `blockingParent` (`evaluate.ts:97-108`) reads
`decision.enabled` off each parent out of the `resolved` map, for every
dependant, during the loop. An observer fired inside that loop holds a decision
the loop has not finished using, and an observer that sets `enabled` to `false`
on it turns off every dependant. The observer would change an outcome while
returning `void`, which is the exact failure decision 2 forbids. Emitting after
the loop closes that path, because nothing in the engine reads the record
again.

Honesty runs the other way for `resolve` than it did for ACL's `capabilities`.
The application asked about every feature, because that is `resolve`'s
contract (`features.ts:33-34`). A batch event naming forty decisions describes
what happened. An application wanting one record per feature iterates the
record inside its own hook, at its own concurrency.

```ts
{ type: 'resolve', at: Date, decisions: Decisions<F>, subject?: string, version?: string }
```

### 2.2 `isEnabled` emits one event naming one key

`isEnabled` calls `resolve` and reads one key out of it (`features.ts:178`). So
it decides forty features and returns one boolean, and the naive
implementation would emit the `resolve` event.

That event lies. An auditor reading it concludes the application asked about
forty features when it asked about one, which is the inversion ACL § 5.6
identified. The library knows which key the caller named, and the event says
so.

So `isEnabled` emits its own event carrying the one `Decision` it read, and
the `resolve` it called internally emits nothing. The engine reaches the
un-emitting resolution through an internal function, and the two public entry
points wrap it.

```ts
{ type: 'is-enabled', at: Date, key: F, decision: Decision<F>, subject?: string, version?: string }
```

The decisions `isEnabled` computed for the other thirty-nine features go
unrecorded, and that is correct. The application never saw them.

### 2.3 `plan` emits one event holding the plan

`plan` partitions every feature (`features.ts:126-140`) and a build calls it
once. One event carrying the `Plan` records the partition, including which
features deferred and which fields they still need.

```ts
{ type: 'plan', at: Date, plan: Plan<F>, subject?: string, version?: string }
```

### 2.4 `toggle` emits one event, and its two internal resolutions emit nothing

`toggle` resolves twice (`features.ts:156` and `:160`) to compute `willDisable`,
and it compares the two results at `:164`. Both resolutions are internal
machinery for one write, and an application that toggled one feature did not
ask about eighty decisions.

The comparison at `:164` also makes the silence load-bearing. If the first
resolution emitted, an observer holding `before` could set
`before[dependant].enabled` to `false` and `willDisable` would come back short.
A UI that confirms a toggle against `willDisable` would then tell an operator
that nothing goes off with it. The observer would have changed an outcome, and
the outcome is the one an operator reads before pulling a kill switch.

`toggle`'s event is a write record, not a decision record, so it carries its
own members.

```ts
{ type: 'toggle', at: Date, key: F, enabled: boolean, willDisable: readonly F[], subject?: string, version?: string }
```

## 3. Where the observer is installed

`createFeatures(definitions)` takes one argument today
(`features.ts:86-88`). It takes a second, optional:

```ts
export interface FeatureOptions {
  /** Called once per public entry point call. Never awaited. */
  observe?: (event: FeatureEvent) => void | Promise<unknown>;
  /** Reports an observer that threw or rejected. Replaces the default warning. */
  onObserveError?: (error: unknown, event: FeatureEvent) => void;
  /**
   * The context field whose value identifies the subject in an event.
   * Whether this member has a default is unresolved. See § 4.2.
   */
  correlateBy?: string;
  /** The configuration version an event reports. */
  version?: string;
}

export function createFeatures<F extends FeatureKey>(
  definitions: readonly FeatureDefinition<F>[],
  options?: FeatureOptions,
): Features<F>;
```

The variants spec replaces this signature with two overloads, and both take the
same second parameter. TypeScript resolves those two overloads on the
type-argument count, so a second value parameter disturbs neither.

Construction is the right place for the same reason it was for `@evanion/acl`.
A `Features` is built once per process and every entry point already closes
over the construction-time values. An application wanting to install an
observer after construction, or two observers, builds a second store or fans
out inside its own hook. `version` sits here provisionally, and
`docs/specs/2026-09-23-feature-config-distribution.md` owns where the version
actually lives once the envelope exists.

`version` names a configuration and it must never name a capability. GrowthBook
shows the failure that rule exists against. Its payload builder strips
`hashVersion`, `range`, `ranges`, `meta`, `seed`, `name` and `phase` out of
every rule when the SDK Connection does not declare a `bucketingV2` capability.
The SDK then reads `experiment.hashVersion || 1` and buckets on the algorithm
its own source comment calls the "Original biased hashing algorithm", the one
GrowthBook's spec says "had a flaw that caused bias when running experiments in
parallel" (`docs/research/2026-09-23-growthbook-statsig.md` § 2). No warning
reaches the caller and no field on the result names which algorithm ran. So if
this seam ever carries a version or a capability on an event, that member
reports what the process already decided under, and no consumer can negotiate a
downgrade with it.

## 4. What an observer may see, and how the line is enforced

### 4.1 No context object

ACL § 5.3 keeps the caller's subject and object bags out of the event, because
`resolveContext` passes them by reference and a later condition in the same
call reads the mutated value. `@evanion/feature` has the same exposure through
a different door. `decide` reads `context[by]` at `evaluate.ts:65` for every
rollout, and `evaluateCondition` reads context fields for every `when`
condition, and the loop at `features.ts:115-119` runs those reads for every
feature after the one whose event fired. So an event carrying the
`EvaluationContext` would let an observer rewrite `group` between feature
twelve and feature thirteen.

Emitting after the loop already removes that path for `resolve`. The event
still carries no context, for the second reason: the context is the caller's
object, it holds whatever attributes the application put on it, and a library
that hands it to a logging hook has decided what an application logs about its
own users.

### 4.2 The subject identifier, awaiting the owner's decision

This is the one member in the document the owner has not ruled on. It is
presented here as open, and the section states both postures because the field
splits on it.

The mechanics are settled either way. ACL answered the identity question with a
correlation value threaded through `AccessOptions`, because an ACL subject is a
bag of attributes. A feature subject is one value, the bucketing key, and the
package already names the field (`types.ts:112-113`, `DEFAULT_ROLLOUT_FIELD` at
`evaluate.ts:15`). The engine reads `context[options.correlateBy]` and copies
the value onto the event when it is a string or a number. A primitive copy holds
no reference back into the caller's context, so an observer that writes to
`event.subject` writes to its own event object and changes nothing. What is open
is whether `correlateBy` has a default.

LaunchDarkly makes the subject opt-out. The context `key` always travels in
`feature` and `index` events, and LaunchDarkly protects `key`, `kind`, `_meta`
and `anonymous` in the evaluation source so an application cannot mark any of
the four private. Every other attribute travels unless the application names it
in `privateAttributes` or sets `allAttributesPrivate`. Client-side SDKs still
send a private attribute to LaunchDarkly for evaluation and withhold it only
from events. Redaction is itself disclosed back: the SDK sends
`_meta.redactedAttributes` naming what it removed, so LaunchDarkly learns the
attribute names even when it does not learn the values. There is no hashing of
the key anywhere in the event path
(`docs/research/2026-09-23-launchdarkly.md` § 9).

Flagsmith goes further in the same direction. Remote evaluation persists the
identity and its traits in the platform, and transient traits are the opt-in
escape, so persistence is what an application gets by doing nothing. A
`$flag_exposure` event carries `identifier` and `traits` verbatim with no
hashing, and Flagsmith refuses to emit an exposure with no identifier, because
the identifier is what reconciles an exposure against a conversion event
(`docs/research/2026-09-23-unleash-flagsmith.md` § 6 and § 9).

Unleash takes the opposite position. Its impression event carries the entire
context, `userId`, `sessionId`, `remoteAddress` and every custom property, with
no hashing and no redaction, and the event never leaves the process. The
application is the transport and the application decides. Unleash Edge exists
for the frontend case, which is the one where context crosses a wire: Edge
"evaluates feature flags for frontend SDKs directly on the Edge node, ensuring
that sensitive user data required for evaluation is never sent upstream to
Unleash" (`docs/research/2026-09-23-unleash-flagsmith.md` § 9).

So the two postures this seam can take:

`correlateBy` defaults to `targetingKey`. An application gets a correlatable
stream with no configuration, which is LaunchDarkly's and Flagsmith's answer. An
application whose bucketing key is a raw email address then puts that address
into whatever its observer writes to, and it does so by writing no code.

`correlateBy` has no default, and an event carries no subject identifier until
the application names a field that derives one. An application wanting
correlation asks for it in one line. An application that never reads this member
emits no identifier at all.

My recommendation is the second, and the owner may argue against it. Two
reasons. An observer here is an arbitrary function the application installed,
and it may be a third-party transport, which is the exact case Unleash built
Edge to prevent; LaunchDarkly's opt-out posture works because LaunchDarkly owns
the transport and the retention policy behind it, and this package owns neither.
The owner is planning a hosted platform, and a default that puts a subject
identifier on every event is a default the hosted platform inherits before
anybody writes its privacy policy.

Until the owner rules, `correlateBy?: string` carries no documented default,
and the documentation at the member says the question is open.

### 4.3 The type refuses the write, and the freeze makes it true

`Decision` is a plain object (`types.ts:159-171`) and TypeScript's `readonly`
disappears at runtime. So the seam does two things.

The event type marks every payload deeply readonly, which rejects
`event.decisions.cta.enabled = false` at compile time for a TypeScript
consumer. That is the whole of the protection a type can give.

The engine deep-freezes the value it is about to emit, using the `deepFreeze`
already in the module (`features.ts:56-61`), and it emits the same object it
returns to the caller. A JavaScript consumer writing the same assignment then
gets a silent no-op under sloppy mode and a `TypeError` under strict mode, and
either way the caller's decisions are the engine's decisions.

Measured, same machine and method as § 2.1, forty features: the bare `resolve`
ran at 20 to 22 microseconds, the deep freeze of its result added 15 to 18, and
a `structuredClone` of the result added 58. So the clone is the wrong order of
magnitude, as it was for `@evanion/acl`, and the freeze is comparable to the
cheapest hook body anyone writes (a `JSON.stringify` of the same record added
15 microseconds).

The freeze happens only when an observer is installed, and that is the one
uncomfortable part of this section. An application that installs an observer
gets a frozen record back from `resolve`, and one that installs none gets a
mutable one. The library's behaviour then differs by configuration. The
alternative is a freeze on every call, which adds 15 to 18 microseconds to a 20
microsecond call for every user of the package whether or not they observe
anything. The recommendation is the conditional freeze, documented at the
member in those words, with a test asserting that the record an observed
`resolve` returns is frozen.

### 4.4 Resolution stays pure in `(config, context, now)`

Decision 5 of the toggles spec is the invariant, and `features.ts:18-23`
records it. The seam does not touch it. `decide` (`evaluate.ts:160-205`) gains
no parameter and no call. The emit happens in the entry point wrapper, after
the return value is complete, and it reads that value. `resolve` remains a pure
function of its inputs, and the entry point around it is no longer free of side
effects. The distinction matters at exactly one place: the observer must never
write to `Features.config`, and the deep freeze at `features.ts:92-94` already
makes that attempt throw.

## 5. Asynchrony, and the engine never awaits

Ported from ACL § 5.5 without change. The observer returns `void` or a promise,
the engine attaches a rejection handler to a returned thenable, and the entry
point returns at the instant the value is ready.

```ts
const result = observe(event);
if (isThenable(result)) result.then(undefined, reportObserverFailure);
```

`then(undefined, handler)` attaches the handler, and the derived promise it
returns is handled, so nothing reaches `unhandledRejection`.

The feature-specific latency argument is stronger than ACL's, because a feature
call is more expensive than an ACL decision and the call sites are worse.
Measured, Apple M1 Pro, Node 24.20.0, 50,000 iterations after a 5,000
warm-up, features each carrying one condition rule and one rollout rule:

- one feature: 0.58 microseconds per `resolve`;
- forty features: 21 microseconds per `resolve`, 0.52 per feature;
- two hundred features: 110 microseconds per `resolve`, 0.55 per feature.

A synchronous observer that blocks for 40 milliseconds on a transport turns the
forty-feature call into a 40.02 millisecond call, which is a factor of two
thousand. Two of the three runtimes make that worse. `FeatureProvider` resolves
during render (`react/index.tsx:59-65`), so a blocking observer blocks a
browser's main thread and a React server render. On a phone, the same call sits
on the UI thread of a cold start.

The engine's own overhead for the guard, measured the same way at forty
features: a synchronous no-op observer stayed within run-to-run noise of the
bare call (both between 20 and 22 microseconds), and one `async` no-op observer
with the thenable check and the attached handler also stayed within that noise.
So the number anyone should care about is what their own hook body does, and
the documentation says so beside the measurement.

## 6. Failure

Ported from ACL § 5.6. The engine catches a synchronous throw and a rejected
promise, and neither reaches a decision.

A synchronous throw propagates out of whatever called `resolve`. In React that
is a render, so a failing audit transport unmounts a tree and shows an error
boundary, and the feature flags that were supposed to be the safe part of the
page took the page down. On a server it is a 500 on a request that had already
decided correctly.

An unhandled rejection ends a Node process by default since Node 15. The
library is the party that chose not to await, so the handler is the library's.

Reporting the swallowed failure, layered in two:

`onObserveError` is the production half. The application counts, samples,
alerts, and decides whether a failing transport is worth taking a process down
for. It is called inside the same catch, and if it throws, the engine reports
through the warning and does not call it again for that event. One level of
recovery, no recursion.

A local `warnOnce` is the default when the application supplies no callback.
`libs/widget/src/warn.ts:22-27` is the shape, keyed on the message so a second
distinct failure is still reported, with `resetWarnings` at `:37-39` beside it
for tests. `@evanion/feature` takes no dependency on `@evanion/widget`, and the
core entry imports no framework (`index.ts:1-5`), so this is a six-line
internal module of the same shape and not an import across packages.

That helper returns early when `NODE_ENV` is `production` (`warn.ts:23`), which
is deliberate and is also its limit: an application that configures neither
member gets a failure caught, warned once in development, and silent in
production. The documentation states that in those words at the member.

Records in flight are lost at exit. A promise the engine never awaited, or a
buffer the application has not drained, is gone when a process exits. On a
rolling deploy every replica loses whatever it had not written, and a
configuration change is exactly when someone looks. The application drains its
buffer on `SIGTERM`, and on a phone it drains on the background transition. A
`drain()` on the `Features` handle was considered and is not recommended: it
would make the store hold the set of pending promises, which is state a
`Features` does not otherwise carry, and every real transport already owns a
flush this one would have to agree with.

The documented hook shape is the one that works everywhere: the observer pushes
onto a buffer synchronously and returns, and the application drains that buffer
at a concurrency it owns.

## 7. The seam depends on issue #245

`ruleId` names a rule by its position when the author gave none
(`evaluate.ts:17-19`):

```ts
function ruleId(rule: Rule, index: number): string {
  return rule.id ?? `#${index}`;
}
```

`Rule.id` documents that fallback as the contract (`types.ts:68`). `Decision`
carries the result at `types.ts:164`, and the variants spec adds a second
carrier at `assignment.rule`.

An event stream naming `#1` is unjoinable across a configuration change. An
author who inserts a staff-targeting rule at the top of a feature renames every
rule below it, so a week of events naming `#1` describe the rollout rule and
this week's events naming `#1` describe the window rule. Nothing in the data
marks the change. An experiment analysis that groups by rule id therefore mixes
two populations and reports a difference nobody caused, which is the worst
class of defect an observability feature can produce, because the output looks
correct.

`@evanion/acl` repaired the same defect in commit f4dd67f.
`libs/acl/src/rule-id.ts:45-49` is the reference: an explicit `rule.id` wins,
and the fallback is FNV-1a over a canonical text built from the rule's own
conditions (`:21-28` is the hash, `:5-11` builds the text). The property that
matters is stability under insertion.

What issue #245 owes this seam is that property and one decision ACL did not
face. An ACL rule carries conditions and a side, so two rules hashing the same
decide the same. A feature rule carries a rollout as well (`types.ts:71`), and
two rules with identical `when` conditions and different `rollout.percent`
decide differently. If the percent enters the canonical text, then an operator
raising a rollout from 20 to 30 renames the rule and breaks the join that the
whole fix exists to protect. If the percent stays out, two rollout rules on one
feature collide.

LaunchDarkly resolves this and does not use a hash for it. A LaunchDarkly rule
carries an `id` the control plane assigns at creation, described in the Go data
model as "a randomized identifier assigned to each rule when it is created" and
documented as the property that "stays the same even if you rearrange the order
of the rules". The positional index stays a separate field, `ruleIndex`, and
both travel in the `reason` object of a `feature` event
(`docs/research/2026-09-23-launchdarkly.md` § 8):

```json
"reason": { "kind": "RULE_MATCH", "ruleIndex": 0, "ruleId": "id", "inExperiment": true }
```

An analysis keyed on `ruleId` joins across a reorder and an analysis keyed on
`ruleIndex` does not. A rollout's `Seed` lives on the `Rollout` struct inside
the rule, so an operator changing a percentage or starting a new experiment
iteration changes neither the rule id nor the bucketing seed.

So #245 resolves into two mechanisms that behave alike across a ramp. A control
plane assigns a stable id at rule creation and that id derives from nothing in
the rule's contents, which is what
`docs/specs/2026-09-23-feature-config-distribution.md` owns. A hand-authored
configuration with no control plane behind it gets the content hash, with
`rollout.percent` excluded from the canonical text, so an operator ramping from
20 to 30 renames nothing. Two rollout rules on one feature with identical `when`
conditions then collide under the hash, and the author breaks that tie by
writing an explicit `rule.id`, which `ruleId` already honours ahead of the
fallback (`evaluate.ts:17-19`).

Two products show what the absence produces. A PostHog release condition carries
no id and the evaluation reason references it by positional `condition_index`,
so reordering conditions invalidates every reason reference pointing at them. A
PostHog variant carries no stable id at all, and the variant key is itself the
bucketing input, so renaming a variant re-buckets everyone who had it
(`docs/research/2026-09-23-openfeature-posthog.md` § 10). Flagsmith went the
other way and gave each variant a `key` slug with `unique_together` against the
feature, ordering variants by creation so a new one takes the last band and
shifts none of the existing ones
(`docs/research/2026-09-23-unleash-flagsmith.md` § 8).

This document records only that #245 must be settled before the first event is
written, because a stream produced under positional ids and a stream produced
under stable ids are two formats and no analysis joins them.

## 8. Multi-process

Local evaluation is the default and it is deliberate. Every process holds the
rules and decides for itself, backend services, browsers and native clients
alike, and an observer runs in whichever one the application installed it in.
Four consequences.

The library performs no network call at evaluation. Nothing in
`libs/feature/src` opens a socket, and `resolve` reads configuration a caller
already handed to `createFeatures`. An observer that writes to a transport is
therefore the first network call in the evaluation path, and it is the
application's code doing it. § 5 is what keeps that call off the render.

Transports differ per runtime and none of that is the library's. A service
writes to a log collector, a browser writes with `navigator.sendBeacon` on
`visibilitychange` because an unload cancels a `fetch`, and a native client
writes to a local queue that persists across a process restart. The event shape is the
same in all of them, which is the point of putting it in the library at all.

Unleash holds this same posture from its own end, and it is the closest thing in
the field to what § 8 describes. An impression event is an `EventEmitter` event
that Unleash never sends anywhere; the application subscribes and forwards it
(`docs/research/2026-09-23-unleash-flagsmith.md` § 6). Unleash Edge then exists
so that a frontend SDK's context reaches an edge node and goes no further
upstream. This seam is that arrangement with the vendor removed. The event is an
in-process callback, and every transport decision after it belongs to the
application. Decision 12 is the other half: the library evaluates the document
it was handed and owns no policy about where that document came from or how old
it is, so an application choosing an edge proxy, a bundled file or a polled
endpoint changes nothing here.

A subject decided in two processes produces two events. A server renders the
page and the browser hydrates, and both resolve the same features for the same
`targetingKey`. The application deduplicates, and the variants spec's
"Determinism across processes" section is what makes the two agree well enough
to deduplicate at all. The seam adds no correlation identifier of its own,
because the application already has a request id and the library would be
guessing at it.

An observer's failure mode differs by runtime. A rejected promise ends a Node
process and a browser only logs one, so § 6's handler matters most on a server
and § 6's `SIGTERM` drain has no browser equivalent. A phone's operating system
can suspend a process without warning, and whatever the buffer held is gone.
The documentation names that at the member, because an experiment missing a
tail of mobile records reads as a result.

## 9. Shapes refused

An observer fired inside `decide`. § 2.1 measured the queue and § 4.1 named the
mutation path through `blockingParent`. It is refused on both.

An observer whose result the engine awaits. `resolve` would return a promise,
every caller would become async, and `FeatureProvider` computes decisions
inside `useMemo` during render (`react/index.tsx:59-65`) where a promise is
unusable. It also puts the hook's latency in front of every decision, which
§ 5 measured at a factor of two thousand for a 40 millisecond transport.

An observer that contributes rules or forces a feature on. The configuration is
the reviewable artifact and decision 5 of the toggles spec says the store holds
intent. A hook that turns a feature on makes the stored intent a partial
description of what runs, and a reviewer of a partial description controls
nothing. The toggles spec already reserved the force-on question for an
override list visible in configuration.

An observer that receives the `EvaluationContext`. § 4.1.

An observer that supplies context fields at evaluation, which ACL § 5.8
refused for `@evanion/acl`. The refusal is firmer here. The variants spec
requires the same subject to get the same variant on a server, in a browser and
in a native client, and it lists the five things that must agree. A field
injected by a plugin installed in one process and absent in another breaks
every one of those agreements, and it breaks them silently: the variant differs
between two renders of the same page and no dashboard shows it. An application
needing a derived field computes it at the call site and puts it on the
context, where a reader of that line sees it, and `stickyVariants` is the
sanctioned channel for an assignment the application stored.

## 10. What this document does not own

The configuration envelope, `version`, `configDigest`, the schema, serialization
and reload: `docs/specs/2026-09-23-feature-config-distribution.md`. The event's
`version` member reads whatever that document settles. That document carries
`maxStale` as an advisory value no entry point reads, and it declares no
visibility concept, so neither reaches an event.

Hydration and cross-process stability:
`docs/specs/2026-09-23-feature-hydration.md`. § 8's duplicate-event case is a
consequence of what that document settles, not a thing this one decides.

Variant assignment, sticky assignment and the `assignment` shape:
`docs/specs/2026-09-23-feature-variants.md`. § 1 reads those fields and adds
none.

The canonical rule id: issue #245. § 7 states the requirement and settles
nothing.

## Testing

Nothing here is implemented, so this is what the seam owes.

- An observer cannot change a decision, written as an observer that tries. It
  mutates every object it is handed, and the caller's decisions come back
  unchanged. That test is what makes § 4 a contract.
- An observed `resolve` returns a frozen record, and an unobserved one does
  not, which pins § 4.3's uncomfortable asymmetry so nobody removes it by
  accident.
- `isEnabled` emits one `is-enabled` event naming the key it was called with,
  and emits no `resolve` event, over a store of forty features. The assertion
  is on the event count.
- `toggle` emits one `toggle` event and no `resolve` event, and an observer
  that mutates the decisions it is handed does not change `willDisable`. § 2.4
  is the case.
- `resolve` over an N-feature store emits one event and allocates one promise,
  asserted by counting calls to an `async` observer.
- An observer that throws synchronously does not propagate, and the caller's
  decisions are the ones the engine computed.
- An observer that rejects does not produce an unhandled rejection, asserted
  through the process-level handler.
- `onObserveError` is called once per failing event, and an `onObserveError`
  that itself throws is not called again for that event.
- The event carries no reference reachable to the caller's `EvaluationContext`,
  asserted structurally over the emitted object.
- A subject member, where one appears, is a primitive and writing to it changes
  no later evaluation in the same call. § 4.2 is unsettled, so the case that
  asserts a default for `correlateBy` waits on the owner's decision.
- `reason-is-output-only.spec.ts` gains a case: a store with an observer
  installed decides identically to one without. The existing file
  (`libs/feature/src/lib/reason-is-output-only.spec.ts:33-53`) already runs the
  engine's own loop with stripped parent results, and the observed variant runs
  beside it.
- The rule id tests belong to issue #245 and the seam adds one: an event stream
  produced before and after a rule is inserted names the surviving rule
  identically.

## Where I am guessing

- That an application genuinely wants the four event types and not just the
  `toggle` one. The toggle audit is the only consumer with an operator behind
  it today. The other three are inferred from what `@evanion/acl` § 9 needed
  for an auditor, and no user of this package has asked for any of them.
- That the conditional freeze in § 4.3 is the right trade. This is still my
  least confident call and the research did not touch it, because no vendor
  faces the question: none of the six returns a mutable decision record that a
  hook also holds. It makes the package behave differently by configuration,
  which is a thing I would normally refuse outright, and I took it because the
  measured 15 to 18 microseconds on every unobserved `resolve`, against a 20 to
  22 microsecond bare call, is worse. An owner who values uniform behaviour over
  that number should freeze always, and the rest of § 4 is unchanged either way.
- § 4.2 is open, and it is no longer a guess. The research split the field:
  LaunchDarkly and Flagsmith make the subject identifier opt-out, Unleash keeps
  the whole context in the process and built Edge so none of it reaches the
  control plane. § 4.2 states both postures and recommends no default on
  `correlateBy`. The owner decides.
- That `isEnabled` warrants its own event. The alternative is one event type
  for every entry point, with the entry point as a member on it. The argument in § 2.2 is about honesty toward an
  auditor, and an auditor of a feature flag stream may not exist. If nobody
  reads these events for compliance, one event type would do and the entry
  point would be a member on it.
- § 1's conclusion held, and this bullet is now closed. Six products emit
  exposure at evaluation and none of them offers a render-time hook, so the
  convention I worried about is universal. Five of them then built a deduper
  against the over-count, and PostHog double-counts a server render plus a
  hydration anyway. The remaining reopener is unchanged: if a future entry point
  reads one key at the render site and nothing else, § 1 is the thing to
  re-argue.
- The measurements are from one machine (Apple M1 Pro, Node 24.20.0) running
  the TypeScript sources through `tsx`, not the built package, over a synthetic
  store whose features all resolve off through `no-rule-matched`. A store whose
  features resolve on through `default-on` allocates smaller decisions and the
  freeze number would drop. I did not measure that case, and there is no
  benchmark harness in `libs/feature` to put any of this in.
