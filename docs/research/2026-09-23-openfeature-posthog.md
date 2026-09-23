# OpenFeature and PostHog: research for an @evanion/feature provider

Date: 2026-09-23

Sources pinned at these commits:

- `open-feature/spec` @ `24f98d7e61ed139ba2f0ba3ec283245cfa230739` (2026-09-21)
- `PostHog/posthog-python` @ `dd614340a2d680d7d29ddbd58a5b120d967d9d2d` (2026-09-22)
- `PostHog/posthog-js` @ `7f0e726882262875ab300644b69d4ed94b94085a` (2026-09-23)
- `PostHog/posthog` read file by file from `raw.githubusercontent.com/PostHog/posthog/master` on 2026-09-23

Spec paths below are relative to the `open-feature/spec` repository root.

A note on conformance before anything else. `specification/README.md` restricts what counts as normative:

> The following parts of this document are normative:
>
> - Statements under markdown H5 headings, appearing in markdown block quotes, and containing an uppercase keyword from RFC 2119.
> - This conformance clause.

> An implementation is not compliant if it fails to satisfy one or more of the "MUST", "MUST NOT", "REQUIRED", "SHALL", or "SHALL NOT" requirements defined in the normative sections of the specification.

Prose outside a quoted H5 block is explanation, not obligation. I mark the distinction where it matters.

---

## 1. The evaluation API and the resolution result

### Answer

A provider returns a `resolution details` structure with six fields: `value` (required), `error code`, `error message`, `reason`, `variant`, `flag metadata` (all optional). The SDK turns that into `evaluation details`, which is the same set plus a required `flag key`. `flag metadata` is an escape hatch for provider-specific data addressed at a provider-specific hook. Nine reasons are enumerated, and the enumeration is explicitly open: any string is legal. `SPLIT` means "the resolved value was the result of pseudorandom assignment" and nothing in the spec constrains when a provider may use it. The only requirement touching `reason` at all is a SHOULD.

### Evidence

`specification/types.md`:

> ### Resolution Details
>
> A structure which contains a subset of the fields defined in the `evaluation details`, representing the result of the provider's [flag resolution process](./glossary.md#resolving-flag-values), including:
>
> - value (boolean | string | number | structure, required)
> - error code ([error code](#error-code), optional)
> - error message (string, optional)
> - reason (string, optional)
> - variant (string, optional)
> - flag metadata ([flag metadata](#flag-metadata), optional)

> ### Evaluation Details
>
> A structure representing the result of the [flag evaluation process](./glossary.md#evaluating-flag-values), and made available in the [detailed flag resolution functions](./sections/01-flag-evaluation.md#14-detailed-flag-evaluation), containing the following fields:
>
> - flag key (string, required)
> - value (boolean | string | number | structure, required)
> - error code ([error code](#error-code), optional)
> - error message (string, optional)
> - reason (string, optional)
> - variant (string, optional)
> - flag metadata ([flag metadata](#flag-metadata))

Note the asymmetry: `flag metadata` is optional on `resolution details` and unqualified on `evaluation details`, because Requirement 1.4.14 fills it in with an empty record when the provider omits it.

The reason table, `specification/types.md`:

| Reason | Explanation |
| --- | --- |
| STATIC | The resolved value is static (no dynamic evaluation). |
| DEFAULT | The resolved value fell back to a pre-configured value (no dynamic evaluation occurred or dynamic evaluation yielded no result). |
| TARGETING_MATCH | The resolved value was the result of a dynamic evaluation, such as a rule or specific user-targeting. |
| SPLIT | The resolved value was the result of pseudorandom assignment. |
| CACHED | The resolved value was retrieved from a cache. |
| DISABLED | The resolved value was the result of the flag being disabled in the management system. |
| UNKNOWN | The reason for the resolved value could not be determined. |
| STALE | The resolved value is non-authoritative or possibly out of date |
| ERROR | The resolved value was the result of an error. |

The enumeration is open, `specification/types.md`:

> The `reason` should not be limited to the reasons enumerated above. It can be any of the pre-defined reasons, or any string value.

The single normative statement about `reason`, Requirement 2.2.5 in `specification/sections/02-providers.md`:

> The `provider` **SHOULD** populate the `resolution details` structure's `reason` field with `"STATIC"`, `"DEFAULT",` `"TARGETING_MATCH"`, `"SPLIT"`, `"CACHED"`, `"DISABLED"`, `"UNKNOWN"`, `"STALE"`, `"ERROR"` or some other string indicating the semantic reason for the returned flag value.

So `SPLIT` carries one sentence of definition and a SHOULD. A provider that returns `TARGETING_MATCH` for a bucketed assignment violates nothing.

What the SDK does with the provider's reason, Requirement 1.4.7 in `specification/sections/01-flag-evaluation.md`:

> In cases of normal execution, the `evaluation details` structure's `reason` field **MUST** contain the value of the `reason` field in the `flag resolution` structure returned by the configured `provider`, if the field is set.

`flag metadata`, `specification/types.md`:

> ### Flag Metadata
>
> A structure which supports definition of arbitrary properties, with keys of type `string`, and values of type `boolean`, `string`, or `number`.
>
> This structure is populated by a provider for use by an [Application Author](./glossary.md#application-author) via the [Evaluation API](./glossary.md#evaluation-api) or an [Application Integrator](./glossary.md#application-integrator) via [hooks](./sections/04-hooks.md).

Requirement 1.4.14, `specification/sections/01-flag-evaluation.md`:

> If the `flag metadata` field in the `flag resolution` structure returned by the configured `provider` is set, the `evaluation details` structure's `flag metadata` field **MUST** contain that value. Otherwise, it **MUST** contain an empty record.

with the non-normative note:

> This `flag metadata` field is intended as a mechanism for providers to surface additional information about a feature flag (or its evaluation) beyond what is defined within the OpenFeature spec itself. The primary consumer of this information is a provider-specific hook.

Requirement 2.2.10, `specification/sections/02-providers.md`:

> `flag metadata` **MUST** be a structure supporting the definition of arbitrary properties, with keys of type `string`, and values of type `boolean | string | number`.

Requirement 2.2.9 is only a SHOULD: "The `provider` **SHOULD** populate the `resolution details` structure's `flag metadata` field."

Three flag-metadata keys have agreed meanings, in `specification/appendix-d-observability.md`:

| Event Record Attribute | Flag Metadata Key | Requirement level | Type | Notes |
| --- | --- | --- | --- | --- |
| `feature_flag.context.id` | `contextId` | `Recommended` | `string` | The context identifier returned in the flag metadata uniquely identifies the subject of the flag evaluation. If not available, the [targeting key](./glossary.md#targeting-key) should be used. |
| `feature_flag.set.id` | `flagSetId` | `Recommended` | `string` | A logical identifier for the [flag set](./glossary.md#flag-set). |
| `feature_flag.version` | `version` | `Recommended` | `string` | A version string (format unspecified) for the flag or [flag set](./glossary.md#flag-set). |

The appendix is a recommendation document, not a set of H5 requirement blocks, so these keys bind nobody. They are the names every telemetry hook already looks for.

Error codes, `specification/types.md`: `PROVIDER_NOT_READY`, `FLAG_NOT_FOUND`, `PARSE_ERROR`, `TYPE_MISMATCH`, `TARGETING_KEY_MISSING`, `INVALID_CONTEXT`, `PROVIDER_FATAL`, `GENERAL`.

---

## 2. Variants

### Answer

A variant is a name for a value; the spec models the two as separate fields on one structure and does not define how a provider derives one from the other. The `variant` field is typed `string` in both `resolution details` and `evaluation details`. A provider is not required to populate it: Requirement 2.2.4 is a SHOULD. The meaning of the string is explicitly the provider's business.

### Evidence

`specification/glossary.md`:

> ### Variant
>
> A variant is a semantic identifier for a value. This allows for referral to particular values without necessarily including the value itself, which may be quite prohibitively large or otherwise unsuitable in some cases.

> ### Values
>
> Individual variants have values associated with them. These values adhere to the flag's type.

The glossary's entity diagram states the cardinality:

```
Flag ||--|{ variant: "has many"
variant ||--|| value: "has"
Flag ||--o{ rule: "Has zero or many"
rule }|--|{ variant : "links to many"
```

Requirement 2.2.4, `specification/sections/02-providers.md`:

> In cases of normal execution, the `provider` **SHOULD** populate the `resolution details` structure's `variant` field with a string identifier corresponding to the returned flag value.

and the note right under it:

> For example, the flag value might be `3.14159265359`, and the variant field's value might be `"pi"`.
>
> The value of the variant field might only be meaningful in the context of the flag management system associated with the provider. For example, the variant may be a UUID corresponding to the variant in the flag management system, or an index corresponding to the variant in the flag management system.

So: string, yes. Required, no. Relationship to value, provider's call. The only constraint on the SDK side is Requirement 1.4.6, which says the SDK MUST copy the provider's variant into evaluation details "if the field is set".

The types note adds one expectation for error paths:

> For example, in the case of an unsuccessful evaluation, `error code`, `reason`, and `error message` will be set, and `variant` will not.

That is a note, not a requirement.

---

## 3. Hooks

### Answer

Four stages: `before`, `after`, `error`, `finally`. The spec is written language-agnostically and says nothing about sync versus async; the return types it specifies are `evaluation context` or nothing. A hook may alter the evaluation only through the `before` stage, and only by returning an evaluation context that gets merged at highest precedence. No stage can change the resolved value: `after`, `error` and `finally` all have no return value. A hook must not mutate `hook hints`, must not mutate `flag key`, `flag type` or `default value`, and in the dynamic-context paradigm must not mutate the evaluation context outside `before`. A throw in `before` or `after` triggers the `error` hooks, skips the remaining hooks in that stage, and returns the default value. A throw in `error` or `finally` is swallowed.

### Evidence

Stages, `specification/sections/04-hooks.md`:

> Hooks add their logic at any of four specific stages of flag evaluation:
>
> - `before`, immediately before flag evaluation
> - `after`, immediately after successful flag evaluation
> - `error`, immediately after an unsuccessful flag evaluation
> - `finally`, unconditionally after flag evaluation

Signatures. Conditional Requirement 4.3.2.1 (dynamic-context):

> The `before` stage **MUST** run before flag resolution occurs. It accepts a `hook context` (required) and `hook hints` (optional) as parameters and returns either an `evaluation context` or nothing.

Conditional Requirement 4.3.3.1 (static-context) drops the return value entirely:

> The `before` stage **MUST** run before flag resolution occurs. It accepts a `hook context` (required) and `hook hints` (optional) as parameters. It has no return value.

Requirement 4.3.6:

> The `after` stage **MUST** run after flag resolution occurs. It accepts a `hook context` (required), `evaluation details` (required) and `hook hints` (optional). It has no return value.

Requirement 4.3.7:

> The `error` hook **MUST** run when errors are encountered in the `before` stage, the `after` stage or during flag resolution. It accepts `hook context` (required), `exception` representing what went wrong (required), and `hook hints` (optional). It has no return value.

Requirement 4.3.8:

> The `finally` hook **MUST** run after the `before`, `after`, and `error` stages. It accepts a `hook context` (required), `evaluation details` (required) and `hook hints` (optional). It has no return value.

How `before` alters the evaluation. Requirement 4.3.4:

> Any `evaluation context` returned from a `before` hook **MUST** be passed to subsequent `before` hooks (via `HookContext`).

Requirement 4.3.5:

> When `before` hooks have finished executing, any resulting `evaluation context` **MUST** be merged with the existing `evaluation context`.

Requirement 3.2.3 puts that merge at the top of the precedence chain: "API (global; lowest precedence) -> transaction -> client -> invocation -> before hooks (highest precedence)".

Prohibitions. Requirement 4.1.3:

> The `flag key`, `flag type`, and `default value` properties **MUST** be immutable. If the language does not support immutability, the hook **MUST NOT** modify these properties.

Conditional Requirement 4.1.4.1 (dynamic-context):

> The evaluation context **MUST** be mutable only within the `before` hook.

Requirement 4.5.3:

> The hook **MUST NOT** alter the `hook hints` structure.

Throwing. Requirement 4.4.5:

> If an error occurs in the `before` or `after` hooks, the `error` hooks **MUST** be invoked.

Requirement 4.4.6:

> If an error occurs during the evaluation of `before` or `after` hooks, any remaining hooks in the `before` or `after` stages **MUST NOT** be invoked.

Requirement 4.4.7:

> If an error occurs in the `before` hooks, the default value **MUST** be returned.

Requirement 4.4.3:

> If a `finally` hook abnormally terminates, evaluation **MUST** proceed, including the execution of any remaining `finally` hooks.

Requirement 4.4.4 says the same for `error` hooks. Both add the non-normative gloss: "exceptions thrown in `finally` hooks should be caught and not propagated up the call stack."

Ordering, Requirement 4.4.2:

> Hooks **MUST** be executed "stack-wise" with respect to flag resolution, prioritizing increasing specificity (API, Client, Invocation, Provider) first, and the order in which they were added second.

with the explanation: "Before flag resolution (the `before` stage), hooks run in the order `API` -> `Client` -> `Invocation` -> `Provider` ... After flag evaluation (the `after`, `error`, or `finally` stages), hooks run in the order `Provider` -> `Invocation` -> `Client` -> `API`, and within those, in reverse of the order in which they were added."

A provider ships its own hooks. Requirement 2.3.1:

> The provider interface **MUST** define a `provider hook` mechanism which can be optionally implemented in order to add `hook` instances to the evaluation life-cycle.

and the section prose:

> These hooks can be used to perform side effects and mutate the context for purposes of the provider. Provider hooks are not configured or controlled by the `application author`.

Cross-stage state, Requirement 4.6.1:

> `hook data` **MUST** be a structure supporting the definition of arbitrary properties, with keys of type `string`, and values of any type.

Sync versus async: **not found**. I searched every `specification/sections/*.md`, `types.md` and `glossary.md` for a statement on hook synchrony and found none. The repository style guide states the reason: "Code blocks should be pseudocode, not any particular language". The only adjacent requirement is 1.4.12, "The `client` **SHOULD** provide asynchronous or non-blocking mechanisms for flag evaluation", which is about the client, not hooks.

---

## 4. Evaluation context

### Answer

Context is a bag of typed key-value pairs plus one specified field. Yes, there is a targeting-key concept; it is called `targeting key`, it is typed string, and it is optional on the structure. The merge order is fixed by a MUST: API (global) -> transaction -> client -> invocation -> before hooks, later overwriting earlier. Which levels exist depends on the paradigm; in the static-context paradigm the client and invocation levels are forbidden.

### Evidence

Requirement 3.1.1, `specification/sections/03-evaluation-context.md`:

> The `evaluation context` structure **MUST** define an optional `targeting key` field of type string, identifying the subject of the flag evaluation.

with the note:

> The targeting key uniquely identifies the subject (end-user, or client service) of a flag evaluation. Providers may require this field for fractional flag evaluation, rules, or overrides targeting specific users. Such providers may behave unpredictably if a targeting key is not specified at flag resolution.

The provider's recourse when it needs one is the error code `TARGETING_KEY_MISSING`: "The provider requires a targeting key and one was not provided in the `evaluation context`" (`specification/types.md`).

Requirement 3.1.2:

> The evaluation context **MUST** support the inclusion of custom fields, having keys of type `string`, and values of type `boolean | string | number | datetime | structure`.

Requirement 3.1.4:

> The evaluation context fields **MUST** have a unique key.

Merging, Requirement 3.2.3:

> Evaluation context **MUST** be merged in the order: API (global; lowest precedence) -> transaction -> client -> invocation -> before hooks (highest precedence), with duplicate values being overwritten.

Conditional Requirement 3.2.1.1 (dynamic-context):

> The API, Client and invocation **MUST** have a method for supplying `evaluation context`.

Conditional Requirement 3.2.2.2 (static-context):

> The Client and invocation **MUST NOT** have a method for supplying `evaluation context`.

Conditional Requirement 3.2.2.3 (static-context) adds a per-domain context: "The API **MUST** have a method for setting `evaluation context` for a `domain`."

Transaction context is experimental and dynamic-context-only. Conditional Requirement 3.3.1.1: "The API **SHOULD** have a method for setting a `transaction context propagator`." Conditional Requirement 3.3.2.1 for static context: "The API **MUST NOT** have a method for setting a `transaction context propagator`."

Field casing is unconstrained: "Field casing is not specified and should be chosen in accordance with language idioms."

The merged context is what a hook sees. Requirement 4.1.1 note: "The `evaluation context` provided in the hook context refers to the **merged evaluation context** as specified in Requirement 3.2.3."

---

## 5. Static versus dynamic context

### Answer

The two paradigms differ in where the subject of evaluation lives. Dynamic context (server-side) passes the subject per evaluation call, so the provider resolves one flag for one subject at a time and holds no per-user state. Static context (client-side) sets the subject once globally, so the provider fetches every flag for that subject in bulk at initialization, serves evaluations from that cache, and re-fetches when the context changes. The spec makes this a structural fork: the client-side client method signatures have no context parameter at all, and the provider gains an `on context changed` function, a `RECONCILING` status and two extra events.

### Evidence

`specification/glossary.md`:

> ### Dynamic-Context Paradigm
>
> Server-side applications typically perform flag evaluations on behalf of many users, with each request or event being associated with a particular user or client. For this reason, server frameworks typically operate similarly to this:
>
> - the application is initialized with some static context (geography, service name, hostname, etc)
> - with each request or event, relevant dynamic context (for example, user session data, unique user identifiers) is provided to flag evaluations

> ### Static-Context Paradigm
>
> In contrast to server-side or other service-type applications, client side applications typically operate in the context of a single user. Most feature flagging libraries for these applications have been designed with this in mind. Frequently, client/web libraries operate similarly to this:
>
> - an initialization occurs, which fetches evaluated flags in bulk for a given context (user)
> - the evaluated flags are cached in the library
> - flag evaluations take place against this cache, without a need to provide context (context was already used to evaluate flags in bulk)
> - libraries provide a mechanism to update context (e.g. if a user logs in), meaning cached evaluations are no longer valid and must be re-evaluated, frequently involving a network request or I/O operation

and the direction of easy portability:

> Not all client libraries work this way, but generally, libraries that accept dynamic context per evaluation can build providers which conform to this model with relative ease, while the reverse is not true.

What the fork costs a provider. Requirement 2.6.1, `specification/sections/02-providers.md`:

> The provider **MAY** define an `on context changed` function, which takes an argument for the previous context and the newly set context, in order to respond to an evaluation context change.

The SDK calls it. Conditional Requirement 3.2.4.1:

> When the global `evaluation context` is set, the `on context changed` function **MUST** run.

Conditional Requirement 3.2.4.2:

> When the `evaluation context` for a specific provider is set, the `on context changed` function **MUST** only run on the associated provider.

The provider must report the outcome as an event. Requirement 2.8.4:

> The provider **MUST** emit `PROVIDER_CONTEXT_CHANGED` if its `on context changed` function terminates normally, and `PROVIDER_ERROR` if it terminates abnormally.

with the mechanism spelled out:

> The `on context changed` return (or thrown error) is treated by the SDK as a synchronization signal only; the status transition and handler invocation occur only when the SDK receives the provider-emitted event.

`RECONCILING` exists only here. `specification/types.md` marks the status "RECONCILING\*" and the events `PROVIDER_RECONCILING` and `PROVIDER_CONTEXT_CHANGED` with "\* static context (client-side) paradigm only". Conditional Requirement 1.7.2.1:

> In addition to `NOT_READY`, `READY`, `STALE`, `ERROR`, or `FATAL`, the `provider status` accessor **MUST** support possible value `RECONCILING`.

The client method signatures differ. Conditional Requirement 1.3.1.1 (dynamic) takes "`evaluation context` (optional)"; Conditional Requirement 1.3.2.1 (static) takes only "`flag key` ... `default value` ... and `evaluation options` (optional)".

Both `1.3.2` and `1.7.2` carry the `hardening` badge, so these client-side requirements can still take a breaking change in a minor version. `specification/README.md`: "Breaking changes require consensus by the Technical Steering Committee but may still be made with minor version updates."

---

## 6. Provider obligations

### Answer

Two things are mandatory: a `metadata` member with a `name` string, and methods that resolve flag values and return `resolution details`. Everything else about the provider surface is MAY or SHOULD, with one important exception: if a provider defines a lifecycle method, it MUST emit the matching event. `initialize`, `shutdown`, `on context changed`, `track` and `domain-scoped` are all MAY. A provider that cannot answer indicates an error in the language's idiom, with an error code; the SDK then returns the caller's default value and never throws at the caller.

### Evidence

Mandatory. Requirement 2.1.1:

> The provider interface **MUST** define a `metadata` member or accessor, containing a `name` field or accessor of type string, which identifies the provider implementation.

Requirement 2.2.1:

> The `feature provider` interface **MUST** define methods to resolve flag values, with parameters `flag key` (string, required), `default value` (boolean | number | string | structure, required) and `evaluation context` (optional), which returns a `resolution details` structure.

Conditional Requirement 2.2.2.1, when the language distinguishes the types:

> The `feature provider` interface **MUST** define methods for typed flag resolution, including boolean, numeric, string, and structure.

Requirement 2.2.3:

> In cases of normal execution, the `provider` **MUST** populate the `resolution details` structure's `value` field with the resolved flag value.

Requirement 2.2.6 and 2.3.2 bar setting `error code` or `error message` on the happy path.

Requirement 2.3.1 makes the provider-hook mechanism a MUST on the interface, optional to implement: "which can be optionally implemented".

Optional. Requirement 2.4.1: "The `provider` **MAY** define an initialization function which accepts the global `evaluation context` and an optional bound `domain`". Requirement 2.5.1: "The provider **MAY** define a mechanism to gracefully shutdown and dispose of resources." Requirement 2.6.1 for `on context changed`. Condition 2.7.1 for `track`. Requirement 2.4.3: "The `provider` **MAY** declare that it is `domain-scoped`".

Cannot answer. Requirement 2.2.7:

> In cases of abnormal execution, the `provider` **MUST** indicate an error using the idioms of the implementation language, with an associated `error code` and optional associated `error message`.

> The provider might throw an exception, return an error, or populate the `error code` object on the returned `resolution details` structure to indicate a problem during flag value resolution. This includes situations where the provider is not yet initialized or has encountered an irrecoverable error; in such cases, the provider indicates the error (e.g. with error codes `PROVIDER_NOT_READY` or `PROVIDER_FATAL`), and the client returns the default value per Requirement 1.4.10.

The caller-facing guarantee, Requirement 1.4.10:

> Methods, functions, or operations on the client **MUST NOT** throw exceptions, or otherwise abnormally terminate. Flag evaluation calls must always return the `default value` in the event of abnormal execution. Exceptions include functions or methods for the purposes for configuration or setup.

Init failure, Conditional Requirement 2.4.2.1:

> If the provider's `initialize` function fails to render the provider ready to evaluate flags, it **SHOULD** abnormally terminate.

Events and state. Requirement 5.1.1:

> The `feature provider` interface **MUST** define a mechanism for signaling the occurrence of one of a set of events, including `PROVIDER_READY`, `PROVIDER_ERROR`, `PROVIDER_CONFIGURATION_CHANGED`, `PROVIDER_STALE`, `PROVIDER_RECONCILING`, and `PROVIDER_CONTEXT_CHANGED`, with a `provider event details` payload.

Requirement 2.8.1:

> The provider **MUST** emit an event to signal each status transition, including transitions resulting from lifecycle methods (`initialize`, `on context changed`) and spontaneous transitions.

> Providers must not rely on the SDK to infer status from lifecycle method return values.

Requirement 2.8.2:

> The provider **MUST** emit `PROVIDER_READY` before its `initialize` function terminates normally.

Requirement 2.8.3 mirrors it for `PROVIDER_ERROR`, adding "If the error is irrecoverable, the error code must indicate `PROVIDER_FATAL`."

The exemption for stateless providers, Conditional Requirement 2.8.5.1 (condition: "The provider does not define an `initialize` function"):

> The SDK **MUST** treat such providers as `READY` from registration and **MUST** run `PROVIDER_READY` handlers on their behalf.

Provider statuses, `specification/types.md`: `NOT_READY`, `READY`, `ERROR`, `STALE`, `FATAL`, `RECONCILING` (static-context only). Requirement 1.7.6 makes shutdown the one transition the SDK infers without an event.

Section 2 carries the `stable` badge; sections 2.4, 2.5, 2.6 and 2.8 carry `hardening`; 2.7 (tracking) carries `experimental`.

---

## 7. What the spec deliberately does not standardise

### Answer

Flag configuration format, targeting rules, bucketing and experiment analysis appear nowhere in the normative text. The spec states positively that evaluation logic is not its job, and it defines the vocabulary for rules and fractional evaluation in the glossary while placing no requirement on either. "Experiment" does not occur anywhere in the specification directory.

### Evidence

The closest thing to an explicit scope statement is in the repository `README.md`:

> The OpenFeature SDK provides a mechanism for interfacing
> with an external evaluation engine in a vendor agnostic way;
> it does **not** itself handle the flag evaluation logic.

`specification/sections/02-providers.md` overview says the same from the provider side:

> Providers are the "translator" between the flag evaluation calls made in application code, and the flag management system that stores flags and in some cases evaluates flags.

> Hypothetical provider implementations might wrap a vendor SDK, embed an REST client, or read flags from a local file.

`specification/glossary.md` defines the concepts and assigns them to the management system:

> ### Flag Management System
>
> A source-of-truth for flag values and rules. Flag management systems may include SaaS feature flag vendors, custom "in-house" feature flag infrastructure, or open-source implementations.

> ### Rule
>
> A rule is some criteria or logic used to assign a variant during an evaluation.

> ### Fractional Evaluation
>
> Pseudorandomly resolve flag values using a context property, such as a targeting key, based on a configured proportion or percentage (ie: 50/50).

> ### Targeting
>
> The application of rules, specific user overrides, or fractional evaluations in feature flag resolution.

No H5 requirement block in `specification/` references a flag configuration schema, a rule grammar, a hash function, a bucket count or an experiment. I grepped the whole `specification/` tree for "experiment": zero hits. The only normative traces of targeting are indirect: the `TARGETING_MATCH` and `SPLIT` reason strings, the `TARGETING_KEY_MISSING` error code, and Requirement 3.1.1's optional targeting key.

Caveat on method. I first asked a summarizer to pull "does not standardise" quotes from `openfeature.dev/docs/reference/intro` and it produced a clean six-item list. I then fetched the page myself and the list is not on it; the page contains no such statement. I discarded that answer. Everything above is grepped from the repository.

---

## 8. PostHog multivariate flags and bucketing

### Answer

A multivariate flag declares an ordered list of variants under `filters.multivariate.variants`, each with a string `key`, an optional display `name`, and a `rollout_percentage` float. There are no explicit bucket boundaries; PostHog lays the variants end to end in declaration order into cumulative ranges over [0, 1).

The hash is SHA-1 over the UTF-8 string `"{flag_key}.{bucketing_identifier}{salt}"`, truncated to the first 15 hex characters (60 bits) and divided by `0xFFFFFFFFFFFFFFF`. The salt is the empty string for the rollout check and the literal `"variant"` for variant selection, so a user's position in the rollout and their position among the variants are two independent draws off the same identifier. There is no bucket count. The output is a continuous float in [0, 1) compared directly against cumulative fractions.

Local evaluation is offered in the server SDKs. It receives full flag definitions from `GET /flags/definitions?token=<project key>&send_cohorts`, authenticated with the secret (personal) API key, with ETag/304 support.

### Evidence

The hash, `posthog/feature_flags.py` in `posthog-python`:

```python
__LONG_SCALE__ = float(0xFFFFFFFFFFFFFFF)

# This function takes a bucketing value and a feature flag key and returns a float between 0 and 1.
# Given the same bucketing value and key, it'll always return the same float. These floats are
# uniformly distributed between 0 and 1, so if we want to show this feature to 20% of traffic
# we can do _hash(key, bucketing_value) < 0.2
def _hash(key: str, bucketing_value: str, salt: str = "") -> float:
    hash_key = f"{key}.{bucketing_value}{salt}"
    hash_val = int(hashlib.sha1(hash_key.encode("utf-8")).hexdigest()[:15], 16)
    return hash_val / __LONG_SCALE__
```

The server-side Rust engine computes the identical number, `rust/feature-flags/src/flags/flag_matching_utils.rs`:

```rust
const LONG_SCALE: u64 = 0xfffffffffffffff;

pub fn calculate_hash(prefix: &str, hashed_identifier: &str, salt: &str) -> Result<f64, FlagError> {
    let hash_key = format!("{prefix}{hashed_identifier}{salt}");
    let hash_value = Sha1::digest(hash_key.as_bytes());
    // We use the first 8 bytes of the hash and shift right by 4 bits
    // This is equivalent to using the first 15 hex characters (7.5 bytes) of the hash
    // as was done in the previous implementation, ensuring consistent feature flag distribution
    let hash_val: u64 = u64::from_be_bytes(hash_value[..8].try_into().unwrap()) >> 4;
    Ok(hash_val as f64 / LONG_SCALE as f64)
}
```

The `prefix` carries the dot. `rust/feature-flags/src/flags/flag_matching.rs`:

```rust
        calculate_hash(&format!("{}.", feature_flag.key), &hashed_identifier, salt)
```

Variant selection uses the salt `"variant"`, same file:

```rust
    pub(crate) fn get_matching_variant(
        &self,
        feature_flag: &FeatureFlag,
        aggregation_group_type_index: Option<i32>,
        hash_key_overrides: Option<&HashMap<String, String>>,
        request_hash_key_override: &Option<String>,
    ) -> Result<Option<String>, FlagError> {
        let hash = self.get_hash(
            feature_flag,
            "variant",
            ...
```

and the rollout check uses the empty salt:

```rust
        let included = crate::flags::v1_bucketing::is_in_rollout(rollout_percentage, || {
            self.get_hash(
                feature_flag,
                "",
                ...
```

The cumulative range assignment, `rust/feature-flags/src/flags/v1_bucketing.rs`:

```rust
pub fn is_in_rollout(
    percentage: f64,
    hash: impl FnOnce() -> Result<f64, FlagError>,
) -> Result<bool, FlagError> {
    if percentage == 100.0 {
        return Ok(true);
    }
    Ok(hash()? <= percentage / 100.0)
}

pub fn select_variant(hash: f64, variants: &[MultivariateFlagVariant]) -> Option<&str> {
    let mut cumulative_percentage = 0.0;
    for variant in variants {
        cumulative_percentage += variant.rollout_percentage / 100.0;
        if hash < cumulative_percentage {
            return Some(&variant.key);
        }
    }
    None
}
```

The Python client builds the same table explicitly, `posthog/feature_flags.py`:

```python
def get_matching_variant(flag, bucketing_value):
    hash_value = _hash(flag["key"], bucketing_value, salt="variant")
    for variant in variant_lookup_table(flag):
        if hash_value >= variant["value_min"] and hash_value < variant["value_max"]:
            return variant["key"]
    return None


def variant_lookup_table(feature_flag):
    lookup_table = []
    value_min = 0
    multivariates = ((feature_flag.get("filters") or {}).get("multivariate") or {}).get(
        "variants"
    ) or []
    for variant in multivariates:
        value_max = value_min + variant["rollout_percentage"] / 100
        lookup_table.append(
            {"value_min": value_min, "value_max": value_max, "key": variant["key"]}
        )
        value_min = value_max
    return lookup_table
```

Weights below 100 leave a dead zone with no variant. The Rust unit test in `v1_bucketing.rs` asserts it:

```rust
    #[test]
    fn incomplete_variant_weights_leave_the_remainder_unassigned() {
        let variants = [MultivariateFlagVariant {
            key: "control".to_string(),
            rollout_percentage: 40.0,
            ..Default::default()
        }];
        assert_eq!(select_variant(0.4, &variants), None);
        assert_eq!(select_variant(1.0, &variants), None);
    }
```

Variant shape, `rust/feature-flags/src/flags/flag_models.rs`:

```rust
pub struct MultivariateFlagVariant {
    pub key: String,
    pub name: Option<String>,
    pub rollout_percentage: f64,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}
```

What gets hashed. For a group-aggregated flag the group key; otherwise the device id if the flag sets `bucketing_identifier == "device_id"`; otherwise the experience-continuity override if continuity is on; otherwise the distinct id. `rust/feature-flags/src/flags/flag_matching.rs`:

> // Priority: DB override > request's anon_distinct_id > distinct_id

An empty identifier short-circuits to hash 0.0, same file:

```rust
        if hashed_identifier.is_empty() {
            // Nothing to hash. `check_rollout` compares `hash <= percentage / 100.0`, so a
            // 0.0 hash matches every rollout threshold, including 0.
            return Ok(0.0);
        }
```

Python mirrors the identifier choice, `posthog/feature_flags.py`:

```python
def resolve_bucketing_value(flag, distinct_id, device_id=None):
    ...
    if bucketing_identifier == "device_id":
        if not device_id:
            raise InconclusiveMatchError(
                "Flag requires device_id for bucketing but none was provided"
            )
        return device_id
    return distinct_id
```

A per-condition `variant` string overrides the hash entirely, `posthog/feature_flags.py`:

```python
            if match_result == ConditionMatch.MATCH:
                variant_override = condition.get("variant")
                if variant_override and variant_override in valid_variant_keys:
                    variant = variant_override
                else:
                    variant = get_matching_variant(flag, effective_bucketing)
```

Local evaluation. `posthog/client.py` in `posthog-python`:

```python
            response = request_get(
                personal_api_key,
                f"/flags/definitions?token={self.api_key}&send_cohorts",
                self.host,
                timeout=10,
                etag=request_etag,
                **self._request_identity_kwargs(),
            )
```

and the payload it keeps:

```python
                "cohorts": data["cohorts"],
                "group_type_mapping": data["group_type_mapping"],
```

Default poll interval is 30 seconds (`poll_interval=30` in the `Client.__init__` signature, `posthog/client.py`). PostHog's docs page https://posthog.com/docs/feature-flags/local-evaluation states local evaluation is available in the Node, Ruby, Go, Python, C#/.NET, PHP, Java, Rust and Elixir SDKs only, that a secret API key is required and must never be exposed to a client, and that you must "provide any person properties, groups, or group properties required to evaluate the flag's release conditions." Static cohorts cannot be evaluated locally; `posthog/feature_flags.py` raises for them:

```python
class RequiresServerEvaluation(Exception):
    """
    Raised when feature flag evaluation requires server-side data that is not
    available locally (e.g., static cohorts, experience continuity).
```

Docs also state the fallback: by default a failed local evaluation falls back to a server request, and `onlyEvaluateLocally` suppresses that and returns undefined.

Per-condition rollout precision: the docs page https://posthog.com/docs/feature-flags/creating-feature-flags states rollout percentages support decimals to two places, minimum 0.01%.

---

## 9. Exposure events

### Answer

The SDK emits, at the moment of the evaluation call, not at render. The event is `$feature_flag_called`. Every SDK deduplicates, and each one uses a different key and a different storage lifetime, so a server render and a browser hydration produce two exposures for one page view.

- posthog-js browser: dedup key is `(flag key, String(value))`, stored under `$flag_call_reported` in PostHog persistence (localStorage plus cookie by default), so it survives a reload. Opt-in `deduplicateCallsPerSession` resets it on session change.
- posthog-node: dedup key is `` `${key}_${response}${groupSuffix}` `` inside a per-`distinctId` `Set`, in process memory, flushed wholesale when the client exceeds `maxCacheSize`.

The two caches are unrelated. A server render calling `getFeatureFlag` emits one event from the node client; the browser client on hydration has an empty `$flag_call_reported` for that key on a first visit and emits a second. I found no cross-SDK suppression mechanism.

### Evidence

Browser emission and dedup, `packages/browser/src/posthog-featureflags.ts` in `posthog-js`:

```ts
        const flagReportValue = String(flagValue)
        ...
        let flagCallReported: Record<string, string[]> = this._prop(FLAG_CALL_REPORTED) || {}

        let sessionIdToPersist: string | undefined
        // When session-scoped dedup is enabled, reset the reported flags whenever the session changes.
        if (this._config.deduplicateCallsPerSession) {
            const currentSessionId = this._client?.session.sessionId
            const storedSessionId = this._prop(FLAG_CALL_REPORTED_SESSION_ID)
            if (currentSessionId && currentSessionId !== storedSessionId) {
                flagCallReported = {}
                sessionIdToPersist = currentSessionId
            }
        }

        if (options.send_event || !('send_event' in options)) {
            if (!(key in flagCallReported) || !flagCallReported[key].includes(flagReportValue)) {
```

The persistence key, `packages/browser/src/constants.ts`:

```ts
export const FLAG_CALL_REPORTED = '$flag_call_reported'
export const FLAG_CALL_REPORTED_SESSION_ID = '$flag_call_reported_session_id'
```

The config doc, `packages/types/src/posthog-config.ts`:

> When enabled, `$feature_flag_called` event deduplication is scoped to the current session.
> By default, the SDK deduplicates `$feature_flag_called` events globally and only re-emits

Node dedup, `packages/node/src/client.ts`:

```ts
  /**
   * Fires a `$feature_flag_called` event for the given flag if the (distinctId, flag, response)
   * triple hasn't already been reported for this client. Shared by the single-flag evaluation
   * path and `FeatureFlagEvaluations.isEnabled() / getFlag()` so both paths dedupe identically.
   */
  protected _captureFlagCalledEventIfNeeded(params: FlagCalledEventParams): void {
    ...
    const featureFlagReportedKey = `${key}_${response}${groupSuffix}`

    if (
      distinctId in this.distinctIdHasSentFlagCalls &&
      this.distinctIdHasSentFlagCalls[distinctId].has(featureFlagReportedKey)
    ) {
      return
    }

    if (Object.keys(this.distinctIdHasSentFlagCalls).length >= this.maxCacheSize) {
      this.distinctIdHasSentFlagCalls = {}
    }
```

Event properties, `packages/core/src/posthog-core.ts`:

```ts
      const properties: Record<string, any> = {
        $feature_flag: key,
        $feature_flag_response: flagValue,
        ...maybeAdd('$feature_flag_id', featureFlag?.metadata?.id),
        ...maybeAdd('$feature_flag_version', featureFlag?.metadata?.version),
        ...maybeAdd('$feature_flag_reason', featureFlag?.reason?.description ?? featureFlag?.reason?.code),
        ...maybeAdd('$feature_flag_bootstrapped_response', bootstrappedResponse),
        ...maybeAdd('$feature_flag_bootstrapped_payload', bootstrappedPayload),
        $used_bootstrap_value: !this.getPersistedProperty(PostHogPersistedProperty.FlagsEndpointWasHit),
        ...maybeAdd('$feature_flag_request_id', details?.requestId),
        ...maybeAdd('$feature_flag_evaluated_at', details?.evaluatedAt),
        ...maybeAdd('$feature_flag_error', featureFlagError),
        ...maybeAdd('$feature_flag_has_experiment', featureFlag?.metadata?.has_experiment),
      }

      this.capture('$feature_flag_called', properties)
```

Suppression is per call, `packages/core/src/types.ts`: "Whether to send a $feature_flag_called event. Defaults to true."

Which methods count as an exposure, https://posthog.com/docs/experiments/adding-experiment-code:

> Only flag value access counts as an exposure

> Other methods like `getAllFlags()`, `getFeatureFlags()`, or payload-only accessors do **not** record an exposure event

There is a server-controlled slimming gate, `packages/node/src/client.ts`:

```ts
  private _shouldSendMinimalFlagCalledEvent(event: string, properties: PostHogEventProperties): boolean {
    return (
      event === '$feature_flag_called' &&
      this._minimalFlagCalledEvents &&
      properties.$feature_flag_has_experiment === false
    )
  }
```

A flag linked to a live experiment keeps the full event; an unlinked one can be reduced to an allowlist of properties (`packages/core/src/featureFlagUtils.ts`: "Strict allowlist of event properties kept on a minimal `$feature_flag_called` event.").

---

## 10. Config distribution, offline, identity, PII

### Answer

A client gets answers, a server with local evaluation gets definitions. The browser POSTs to `/flags` and receives an evaluated map: per flag a `key`, `enabled`, `variant`, `reason` and `metadata` carrying the flag's integer `id` and `version`. A server SDK with a secret key GETs `/flags/definitions` and receives the raw flag definitions plus `group_type_mapping` and `cohorts`, and evaluates locally.

Versioning: definitions are ETagged and answer 304. Evaluated responses carry a per-flag integer `version` and a per-request `requestId` and `evaluatedAt`.

Offline: the browser falls back to the last flags it persisted and marks the evaluation with a `$feature_flag_error` property. A server SDK keeps serving the last polled definitions, and falls back to a network call when local evaluation is inconclusive, unless `onlyEvaluateLocally` is set.

Stable identifiers across edits: no. A variant is identified only by its `key` string. A release condition is a positional `FlagPropertyGroup` with no id; it is referenced in the evaluation reason by `condition_index`. Renaming a variant key or reordering conditions changes bucketing and breaks reason references. The flag itself has a stable integer `id` and an integer `version`.

Identifiers in events by default: `distinct_id` always, and from the browser `$device_id`, `$session_id`, `$current_url`, `$referrer`, `$referring_domain`, browser/OS/device properties, and the IP, which the server resolves to geo unless geoip is disabled.

### Evidence

What a client receives, `rust/feature-flags/src/api/types.rs`:

```rust
pub struct FlagDetails {
    pub key: String,
    pub enabled: bool,
    pub variant: Option<String>,
    pub failed: bool,
    pub reason: FlagEvaluationReason,
    pub metadata: FlagDetailsMetadata,
    pub conditions: Option<Vec<ConditionAnalysis>>,
}

pub struct FlagDetailsMetadata {
    pub id: i32,
    pub version: i32,
    pub description: Option<String>,
    pub payload: Option<Value>,
    pub has_experiment: bool,
}

pub struct FlagEvaluationReason {
    pub code: String,
    pub condition_index: Option<i32>,
    pub description: Option<String>,
}
```

and the envelope:

```rust
pub struct FlagsResponse {
    pub errors_while_computing_flags: bool,
    pub flags: HashMap<String, FlagDetails>,
    pub quota_limited: Option<Vec<String>>,
    pub request_id: Uuid,
    pub evaluated_at: i64,
    pub minimal_flag_called_events: Option<bool>,
    pub config: ConfigResponse,
}
```

The reason codes, `rust/feature-flags/src/flags/flag_match_reason.rs`: `super_condition_value`, `condition_match`, `no_condition_match`, `out_of_rollout_bound`, `no_group_type`, `holdout_condition_value`, `flag_disabled`, `missing_dependency`. Three internal variants (`NoConditionMatchGroupsNotEvaluated`, `NoConditionMatchCohortNotEvaluated`) serialize as `no_condition_match` for backward compatibility. There is no separate code distinguishing a bucketed multivariate assignment from a plain rule match: both surface as `condition_match`.

Definitions endpoint and ETag, `rust/feature-flags/src/api/flag_definitions.rs`:

> **ETag support:**
> when the client's ETag matches the current cache state, avoiding redundant data transfer.
> ETags are stored by Django in Redis alongside the cached data.

```rust
    let client_etag = extract_etag_from_header(headers.get("if-none-match"));
    ...
    // If client sent a matching ETag, short-circuit with 304 (skip full data fetch)
```

Client side of the same handshake, `posthog/client.py`:

```python
                if response.not_modified:
                    if self._flags_etag != request_etag:
```

No stable id on a condition, `rust/feature-flags/src/flags/flag_models.rs`:

```rust
pub struct FlagPropertyGroup {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub properties: Option<Vec<PropertyFilter>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rollout_percentage: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
```

The comment on the `extra` passthrough names `sort_key` as a key the frontend leaks into this structure, so a UI ordering hint exists, but the evaluator does not read it:

> Without this, frontend leaks (`description`, `sort_key`), runtime annotations
> (`cohort_name`, `group_key_names`), and field typos would be silently dropped
> on round-trip

Flag-level identity and version, same file:

```rust
pub struct FeatureFlag {
    pub id: FeatureFlagId,
    pub team_id: i32,
    pub name: Option<String>,
    pub key: String,
    ...
    pub version: Option<i32>,
```

Browser offline fallback, `packages/browser/src/posthog-featureflags.ts`:

```ts
        } else if (errorsLoading) {
            this._fallBackToPersistedFlags()
        }
```

and the error classification that lands on the next exposure event:

```ts
    ERRORS_WHILE_COMPUTING: 'errors_while_computing_flags',
    CONNECTION_ERROR: 'connection_error',
    UNKNOWN_ERROR: 'unknown_error',
    apiError: (status: number | string) => `api_error_${status}`,
```

Browser identifiers, `packages/browser/src/posthog-core.ts` sets `$device_id: uuid` on first visit with the comment "distinct id == $device_id is a proxy for an anonymous user", and sets `properties['$session_id'] = sessionId`. `packages/browser/src/constants.ts` names it: `export const DEVICE_ID = '$device_id'`.

Server-side geoip is opt-out per call, `packages/node/src/client.ts` threads a `disableGeoip` option through `capture` and `identify`.

Default event properties are documented at https://posthog.com/docs/data/events, which lists `distinct_id` ("a unique identifier for person, commonly a `uuidv7` value"), `$ip`, `$current_url`, `$referrer`, `$referring_domain`, `$browser`, `$browser_version`, `$os`, `$os_version`, `$device_type`, `$lib`, `$lib_version`. That page does not list `$device_id` or `$session_id`; I confirmed both from the source above.

PostHog's own OpenFeature provider maps context to PostHog this way, `openfeature-provider/openfeature/contrib/provider/posthog/provider.py` in `posthog-python`:

> Evaluation-context mapping:
>     * ``targeting_key``               -> PostHog ``distinct_id``
>     * reserved attr ``groups``        -> PostHog ``groups``
>     * reserved attr ``group_properties`` -> PostHog ``group_properties``
>     * every other attribute           -> PostHog ``person_properties``

Every non-reserved context attribute becomes a person property on the evaluation request. That is the PII surface a provider controls.

---

## What OpenFeature would force on a provider for this library

A provider package is a thin set of obligations, and most of the friction is in what the spec makes optional.

**The required surface is small.** Provider metadata with a `name`, and four resolve methods returning `{ value, variant?, reason?, errorCode?, errorMessage?, flagMetadata? }`. Requirements 2.1.1 and 2.2.1/2.2.2.1. Nothing else is a MUST on the provider interface except 2.3.1's hook mechanism, which may be a no-op.

**Pick a paradigm before writing a line.** Requirement 1.3.1.1 versus 1.3.2.1 are different method signatures on different SDK packages. A dynamic-context provider takes an evaluation context per resolve call. A static-context provider takes none, caches a bulk result, implements `on context changed`, and must transition through `RECONCILING`. Shipping both means two provider classes against two SDKs. If @evanion/feature evaluates per call with a subject passed in, the dynamic-context provider is a direct mapping and the static-context one needs a bulk-evaluate entry point plus a cache.

**Never throw at the caller.** Requirement 1.4.10 puts this on the SDK, and Requirement 2.2.7 puts the matching obligation on the provider: signal failure with an error code, in the language idiom. The provider must map every internal failure onto `PROVIDER_NOT_READY`, `FLAG_NOT_FOUND`, `PARSE_ERROR`, `TYPE_MISMATCH`, `TARGETING_KEY_MISSING`, `INVALID_CONTEXT`, `PROVIDER_FATAL` or `GENERAL`. If the library's own error taxonomy is richer, it collapses here, and the detail goes in `error message` under Requirement 2.3.3 (a MAY).

**Lifecycle methods are optional, events are not.** Requirement 2.8.1 makes this the sharpest constraint in the whole spec. If the provider defines `initialize`, it MUST emit `PROVIDER_READY` before that function returns normally (2.8.2) and `PROVIDER_ERROR` before it returns abnormally (2.8.3). The SDK will not infer either from the return value. If the library's config loader is synchronous and cannot fail, the cheapest correct path is to define no `initialize` at all and take Conditional Requirement 2.8.5.1's free `READY`.

**The subject is a single optional string.** Requirement 3.1.1 gives one `targeting key`, type string. If @evanion/feature's targeting takes a richer subject (an id plus a kind, or several identities), the provider has to encode the extra parts as custom context fields and re-assemble them, and that encoding becomes a public contract the library owns.

**Context arrives pre-merged and non-negotiable.** Requirement 3.2.3 fixes five levels and last-writer-wins on duplicate keys. The provider sees one flat structure with unique string keys and values restricted to `boolean | string | number | datetime | structure` (3.1.2). Any library concept that is not one of those types has to serialize.

**Hooks cannot repair a resolution.** Only `before` returns anything, and only an evaluation context. A provider hook can annotate, time, log or emit telemetry, and it can add context, but it cannot rewrite a resolved value or reason after the fact. Anything the library wants a consumer's hook to see must ride in `flag metadata`, which is flat and typed `boolean | string | number` only (2.2.10). No nested objects.

**Reason and variant are the vocabulary, and they are looser than they look.** `SPLIT` is a one-line definition with a SHOULD attached. Nothing prevents the provider from emitting it for bucketed assignment, and nothing requires it. If @evanion/feature distinguishes a rule match from a bucketed assignment internally, mapping that distinction onto `TARGETING_MATCH` versus `SPLIT` is legal and honest, and it is also the distinction PostHog's own provider throws away (see below). Anything finer belongs in `flag metadata` under a namespaced key, alongside the three well-known ones, `contextId`, `flagSetId` and `version`.

**Two consumers of `variant` conflict.** The spec says a variant "might only be meaningful in the context of the flag management system" and offers a UUID or an index as examples. Appendix D says the opposite for telemetry: "The `variant` field should be included whenever possible as it represents the symbolic name of the flag's returned value (e.g., 'on'/'off', 'control'/'treatment')." A human-readable key serves telemetry; a UUID serves stability across renames. Pick one and document it, because OpenFeature will not.

---

## What surprised me

The provider must emit its own readiness event. Requirement 2.8.1 explicitly says "Providers must not rely on the SDK to infer status from lifecycle method return values," and 2.8.2 says the emit has to happen *before* `initialize` terminates. An `async initialize` that just resolves leaves the SDK stuck at `NOT_READY`. This is easy to get wrong and silent when you do.

`SPLIT` carries no constraint at all. I expected the spec to tie it to fractional evaluation, given that the glossary defines "Fractional Evaluation" in detail. It does not. Requirement 2.2.5 is one SHOULD listing nine strings "or some other string", so `reason` is closer to a free-text convention than an enum.

PostHog's own OpenFeature provider never emits `SPLIT`. `_map_reason` in `posthog-python` collapses everything to three values:

```python
        if result.enabled:
            # Enabled: the user matched a targeting condition (or was assigned a
            # variant). PostHog has no distinct OpenFeature-style reason here.
            return Reason.TARGETING_MATCH
```

A user assigned to the `test` variant by a SHA-1 bucket gets `TARGETING_MATCH`. The comment says PostHog "has no distinct OpenFeature-style reason here", but the server does distinguish: `FlagEvaluationReason.code` would be `condition_match` either way, so the information genuinely is not on the wire. A library that models bucketing explicitly can do better than the reference provider.

Variant keys are the bucketing input, so renaming one re-buckets everyone. `select_variant` walks the declaration order and `MultivariateFlagVariant` has no id field. Reordering variants in the UI reassigns users too. Worse, the variant hash and the rollout hash differ only by the salt `"variant"` versus `""`, both over `"{flag_key}.{identifier}"`, so renaming a *flag* re-rolls both draws at once.

Incomplete variant weights silently strand users. `select_variant` returns `None` when the weights sum below 100, and PostHog has a test asserting exactly that. The caller then falls through to the boolean `enabled` path.

Hook synchrony is genuinely unspecified. I expected at least a SHOULD about non-blocking hooks, given Requirement 1.4.12 exists for the client. There is nothing. Every language SDK decides for itself.

The browser's exposure dedup outlives the page. `$flag_call_reported` lives in PostHog persistence, which is localStorage plus a cookie by default, so a repeat visitor whose flag value has not changed emits no exposure at all on a later visit. Session-scoped dedup is opt-in. An experiment analysis that assumes one exposure per session is wrong by default.

---

## Where I could not verify

**Hook synchronous or asynchronous.** Not found in the spec. I grepped `specification/sections/*.md`, `specification/types.md`, `specification/glossary.md` and `specification/README.md`. The style guide's "Code blocks should be pseudocode, not any particular language" explains the gap. Whether a given SDK awaits a hook is a per-SDK question I did not chase into the `open-feature/js-sdk` repository.

**An explicit "OpenFeature does not standardise X" sentence.** Not found beyond the repository `README.md` line about evaluation logic. I checked `specification/README.md`, all six `sections/*.md`, `glossary.md`, `types.md`, and fetched `openfeature.dev/docs/reference/intro` and `openfeature.dev/faq/` (the latter 404s). My section 7 answer therefore rests on absence of requirements plus that one README sentence, which I flag as weaker evidence than a positive scope clause.

**Whether PostHog's UI enforces variant weights summing to 100.** I read only the evaluators, which do not. The Django serializer at `products/feature_flags/backend/api/filters_schema.py` is referenced in a Rust comment ("Runtime Python mirror ... validates filters against these shapes at write time") but I did not read it.

**`$device_id` and `$session_id` as documented defaults.** https://posthog.com/docs/data/events does not list them. I verified both from `posthog-js` source (`packages/browser/src/posthog-core.ts`, `packages/browser/src/constants.ts`), which is stronger evidence, but the docs and the code disagree on completeness.

**The full default property set PostHog attaches server-side.** I read the SDK's `disableGeoip` plumbing and the docs table, not the ingestion pipeline. What the server adds or strips after receipt (geo resolution, IP retention, property sanitization) I did not verify.

**Whether a server render and a browser hydration ever coordinate exposure suppression.** I searched `posthog-js` for cross-SDK dedup and found none: `distinctIdHasSentFlagCalls` is node-local memory, `$flag_call_reported` is browser persistence. I did not check whether PostHog deduplicates `$feature_flag_called` server-side during experiment analysis, which would change the practical answer.

**PostHog's OpenFeature provider for JavaScript.** I read the Python one (`posthog-python/openfeature-provider`). Whether a JS/TS PostHog provider exists, and how it maps reasons, I did not check.

**Flag config format v2.** `rust/feature-flags/src/flags/config_v2.rs` and `config_format.rs` exist and the `FlagFilters` struct carries a `non_v1: Option<Arc<NonV1Config>>` field. Everything above describes the v1 `filters` shape. Whether v2 introduces stable condition or variant identifiers, I did not read.
