# @evanion/feature: dependency-aware feature toggles

Status: approved, not implemented
Prior art: https://gist.github.com/Evanion/bd8f5618503357dd6cafdf27cc665836 (2022 sketch, not carried forward)

## Why not the gist

The sketch establishes the intent and nothing else. `feature.store.ts` and
`feature.hook.ts` are byte-identical, `dispatch` is `(value) => {}`, and
`feature.provider.tsx` imports a `useFeatureProvider` that does not exist. The
resolution in `feature.utils.ts` is single-level — `getRestrictive` reads
`state[current].active` from the original state rather than the progressively
computed result, so a chain A→B→C never cascades — and it mutates its input.
There is no reverse index, no cycle detection, and the dependants direction is
unimplemented.

This is a rewrite. What carries over is the idea and the
`Feature extends string | number` type parameter.

## Decisions

1. Framework-free core. React is a thin adapter on a separate entry.
2. Cycles are rejected at construction, naming the path.
3. Dependencies cascade one way only: a parent that is off disables its
   dependants. There is no upward blocking.
4. A toggle returns a structured result rather than throwing.
5. The store holds intent. Resolution is computed on read and never written
   back.
6. Conditional activation is expressed as `rules`, OR-ed, each holding `when`
   conditions that are AND-ed.

## Shape

```ts
{
  key: 'checkout-v2',
  enabled: true,
  dependsOn: ['payments-v3'],
  rules: [
    {
      when: [{ field: 'now', op: 'before', value: '2026-10-01T00:00:00Z' }],
      rollout: { percent: 25, by: 'targetingKey' },
    },
  ],
}
```

`enabled` is intent: the maintainer wants this on. `rules` decide whether it
resolves on for a given context.

## Naming

"Filter" is wrong. A filter subtracts from a set; these do the opposite — a
feature with no rules is on, and once it has rules it is off unless one
matches. They activate.

`rules` and `when` conditions, following GrowthBook, LaunchDarkly and
Flagsmith. Unleash's `strategies`/`constraints` is the other live convention
and is more precise about the unit carrying an algorithm as well as predicates,
but `rules` is what a reader guesses correctly with no prior exposure.

`policy` is deliberately unused. It was the right word for the upward blocking
behaviour, which decision 3 removes; reserving it avoids spending the word on
something that is not a permission question.

## Evaluation

### Precedence

Defined once so it is not a per-case question:

- `enabled === false` short-circuits. Rules never run. This matches
  LaunchDarkly, where an off flag returns the off variation with reason `OFF`
  and targeting is not evaluated.
- `enabled === true` hands the decision to the rules. No rules present means on.
- Rules are OR-ed. `when` conditions within one rule are AND-ed. Not
  first-match: first-match forces the reader to reason about order, and Unleash
  and PostHog both converged on OR.

A consequence worth documenting: toggling `enabled` on for a feature whose
rules do not currently match changes stored intent and the feature still
resolves off. The toggle is a kill switch in one direction only. Do not
overload it as a force-on — that is a separate mechanism (LaunchDarkly
individual targets, GrowthBook `force` rules) and can be added later as an
override list or a rule with no conditions, both visible in config.

### Cascade

A dependant sees its parent's **resolved** value. A parent that is off for any
reason disables its dependants.

This is a correctness requirement, not a preference. If a parent is in a 25%
rollout and its dependants consulted only the declared flag, the rollout would
leak to 100% of users.

Resolution is transitive. The gist's bug is reading the original state during
the fold; the implementation must resolve in dependency order so a chain
cascades.

### Result

One `enabled` boolean in the decision. The distinction between kinds of "off"
lives in the explanation:

| `reason` | meaning |
| --- | --- |
| `default-on` | enabled, no rules |
| `rule-match` | enabled, a rule matched; carries the rule id |
| `explicitly-off` | `enabled === false` |
| `no-rule-matched` | enabled, rules present, none passed |
| `dependency-off` | a parent resolved off |

`no-rule-matched` carries a per-rule breakdown naming the failed condition, so
a UI can say "outside window until 2026-10-01" rather than "off".

`dependency-off` carries both the immediate parent and the root cause — walk to
the first ancestor that is off for a non-dependency reason:

```ts
{
  enabled: false,
  reason: 'dependency-off',
  blockedBy: 'payments-v3',
  cause: { key: 'payments-v3', reason: 'no-rule-matched', rule: 'window-q4' },
}
```

A UI wants the root cause; a graph view wants the edge.

**Invariant: `reason` is output only.** The cascade reads `enabled` from the
parent's result and nothing else. Deleting the reason field must change no
decision anywhere. Write that as a test.

## The store holds intent

The cascade never writes. When a parent's window expires nothing changes in the
store; `resolve()` starts returning false for the dependant. When the window
reopens `resolve()` returns true. The dependant's `enabled` was `true`
throughout, because that field means "the maintainer wants this on", which
remained true.

Every system surveyed does this. LaunchDarkly persists on/off, targeting rules
and prerequisites and evaluates per call; Unleash persists strategies and
constraints; GrowthBook ships a JSON definition and evaluates locally. None
persists an evaluated result back into the flag record.

Reasons not to mutate, beyond tidiness:

- The store would change with no actor, so audit logs get entries nobody
  performed.
- Writes become clock-dependent. A process asleep across a window boundary
  disagrees with one that was awake.
- You lose the distinction between "someone turned this off" and "the system
  turned it off", which is the one an operator needs at 3am.
- The build-time pass would write resolved values into the shared store rather
  than into its own output.

Invariant: the only writers are explicit toggles and config edits. Everything
else is a pure function of `(config, context, now)`.

Resolved state has one legitimate home — a snapshot with known staleness,
outside the store. The build output is such a snapshot. It is a cache and is
never read back as truth.

## Toggling

```ts
features.toggle('payments-v3', false)
// { ok: true, willDisable: ['checkout-v2', 'checkout-express'] }
```

Decision 3 removes upward blocking, but the information it existed to provide
is kept: disabling a parent reports which dependants will go off with it. A UI
can confirm before applying; a script can ignore it. Same safety, no second
policy direction, and no declared-versus-resolved split.

## Cycles

Rejected at construction, with the cycle path in the error. A cycle is a
configuration error, and resolving one is undefined rather than merely
awkward.

This follows the lesson from the luhn audit: reference implementations enforce
their constraints at construction rather than at use. `calmh/luhn` and
`andrew-d/luhn-rs` reject an alphabet with duplicates when it is supplied;
`@evanion/luhn`'s bug is that it checks only at use, and issue #87 is the
result.

## Rollout bucketing

Seed the hash with the feature key, overridable. Every surveyed system does
this, and it is what decorrelates a user's bucket across features so someone
is not in every rollout or none.

GrowthBook shipped the naive version first — `hashFnv32a(value + seed) % 1000`
— and had to fix correlated bucketing across parallel experiments in v2.
LaunchDarkly concatenates `flagKey . salt . attributeValue`, takes SHA1, uses
the first 15 hex digits over `0xFFFFFFFFFFFFFFF`. Unleash normalises MurmurHash
of `groupId` plus the stickiness value, with `groupId` defaulting to the flag
name.

Bucket count must be fine-grained enough that increasing a percentage only adds
buckets and never moves an existing user out.

## Time

`now` is an evaluation-context field defaulting to `new Date()`, following
Unleash's `currentTime`. Time is injected, not read from an ambient clock.
That removes clock-skew arguments, makes tests trivial, and makes build-time
evaluation honest.

Day-of-week rules require an explicit IANA zone. UTC day-of-week is wrong for
every business rule anyone writes.

## Static and runtime evaluation

The line is context-free versus context-dependent.

- `resolve(context)` returns `{ enabled, reason }` per feature.
- `plan()` partitions rules by required context and returns, per feature,
  `resolved: boolean | 'deferred'` plus the context keys still needed.

A rule needing only `now` is resolvable for a known instant; a rule needing
`targetingKey` is not. The Astro storefront calls `plan()` at build and emits
only the deferred set. The Nest API calls `resolve()` per request. One engine,
no second code path.

A build-time-resolved date window is frozen at build. That is a deploy-cadence
decision and must be opt-in per feature.

## Packaging

Two entries.

- `.` — the core. No React import. Usable from the Nest API and at build time.
- `./react` — provider and hooks.

A single bundle cannot carry per-module directives, so a client layer needs its
own build entry. This is the same constraint `@evanion/react-widget` hit; the
difference is that its answer was to have no client code at all, whereas here
the React layer genuinely is client code.

The React coupling in the gist was incidental — it was written while working in
Next — so the core is not an extraction from it so much as where the logic
should have been.

## OpenFeature

OpenFeature standardises the evaluation API, the provider interface, evaluation
context, hooks and events. It does **not** standardise flag configuration or
targeting rules, so it does not constrain the dependency graph.

Ship a provider as a separate package rather than shaping the core around it.
Its resolution detail is `value + reason`, which would flatten away `blockedBy`
and `cause`; those belong in `flagMetadata`. Its `reason` enum
(`STATIC | DEFAULT | TARGETING_MATCH | SPLIT | CACHED | DISABLED | UNKNOWN |
STALE | ERROR`) is a superset of the table above and maps cleanly.

Its static-context versus dynamic-context paradigm split matches the
build-time/per-request split exactly.

## Testing

- Transitive cascade across a chain deeper than two, which is the gist's bug.
- Cycle rejected at construction, error names the path.
- `reason` is output only: deleting it changes no decision.
- The store is never written by evaluation — assert config is byte-identical
  before and after a `resolve()` that cascades.
- A window expiring and reopening restores the dependant without a write.
- Rollout bucketing is stable across evaluations and decorrelated across
  features; raising a percentage never moves an existing member out.
- `plan()` defers exactly the rules needing context and no others.
- Precedence: `enabled === false` short-circuits before rules run.
