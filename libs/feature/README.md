![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)
![npm (scoped)](https://img.shields.io/npm/v/@evanion/feature)

# Feature Toggles

> Not published. The design is settled in
> [the spec](../../docs/specs/2026-09-11-feature-toggles.md); the
> implementation is not written. `package.json` carries `private: true` so a
> release run versions it without publishing it. Remove that field when the
> package does what this file describes.

Feature toggles where one flag can depend on another. A parent that resolves off
takes its dependants with it, transitively, and it does that without writing
anything back into the configuration.

```ts
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'payments-v3',
    enabled: true,
    rules: [
      {
        id: 'window-q4',
        when: [{ field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' }],
        rollout: { percent: 25, by: 'targetingKey' },
      },
    ],
  },
  { key: 'checkout-v2', enabled: true, dependsOn: ['payments-v3'] },
]);

features.isEnabled('checkout-v2', { targetingKey: 'acct-42' });
```

`checkout-v2` is on only when `payments-v3` resolves on for that same account.
Without the cascade, a 25% rollout on the parent would leak to 100% of the
dependant's users.

## Installation

```bash
npm install @evanion/feature
```

Two entry points. `@evanion/feature` is the core and imports no framework, so it
runs in an API, in a script, or at build time. `@evanion/feature/react` carries
the provider and hooks and is client code.

## Configuration

A feature is stored intent:

| Field               | Meaning                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `key`               | The identifier. `string` or `number`.                            |
| `enabled`           | The maintainer wants this on.                                    |
| `dependsOn`         | Features that must resolve on for this one to.                   |
| `rules`             | Activation rules. OR-ed.                                         |
| `seed`              | Bucketing seed for this feature's rollouts. Defaults to the key. |
| `freezeTimeAtBuild` | Let `plan()` resolve this feature's time windows at build.       |

`enabled` is intent, not the answer. `rules` decide whether it resolves on for a
given context.

## Precedence

- `enabled === false` short-circuits. Rules never run.
- A parent that resolved off short-circuits. Rules never run.
- `enabled === true` with no rules means on.
- Rules are OR-ed; the `when` conditions inside one rule are AND-ed. A rollout
  is one more conjunct of the rule that carries it.

Not first-match. Rule order never changes the outcome.

Toggling `enabled` on for a feature whose rules do not match changes stored
intent, and the feature still resolves off. It is a kill switch in one direction
only; it is not a force-on.

## Conditions

```ts
{ field: 'now', op: 'before' | 'after', value: '2026-10-01T00:00:00Z' }
{ field: 'now', op: 'day-of-week', zone: 'Europe/Stockholm', value: ['mon', 'fri'] }
{ field: 'plan', op: 'eq' | 'ne' | 'in' | 'not-in' | 'contains', value: 'pro' }
```

`now` comes from the evaluation context and defaults to `new Date()` at the
call. It is injected, never read from an ambient clock, which is what makes
build-time evaluation honest and tests trivial.

A day-of-week condition must name an IANA zone. UTC day-of-week is wrong for
every business rule anyone writes.

A condition over a field the context does not carry never holds -- including the
negative operators. `ne` on an absent field is unevaluable, not true.

## Results

`resolve(context)` returns one decision per feature. `enabled` is the decision;
everything else explains it.

| `reason`          | meaning                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `default-on`      | enabled, no rules                                                 |
| `rule-match`      | enabled, a rule matched; carries `rule`                           |
| `explicitly-off`  | `enabled === false`                                               |
| `no-rule-matched` | enabled, rules present, none passed; carries a per-rule breakdown |
| `dependency-off`  | a parent resolved off; carries `blockedBy` and `cause`            |

```ts
{
  key: 'checkout-v2',
  enabled: false,
  reason: 'dependency-off',
  blockedBy: 'payments-v3',
  cause: { key: 'payments-v3', reason: 'no-rule-matched', rule: 'window-q4' },
}
```

`blockedBy` is the edge, for a graph view. `cause` is the first ancestor off for
a reason of its own, for an operator who wants to know what to fix.

`reason` is output only. Nothing in this library reads it back to decide
anything, so deleting it changes no decision.

## Rollouts

```ts
{ rollout: { percent: 25, by: 'targetingKey', seed: 'q4-cohort' } }
```

The bucket is a MurmurHash3 of the seed and the bucketing value, normalised over
2^32 buckets. The seed defaults to the feature key, which is what decorrelates a
user's bucket across features -- with a shared seed, someone is in every rollout
or none. Set `seed` explicitly only to correlate two features deliberately.

The bucket does not depend on the percentage, so raising a percentage only adds
members and never moves one out. Lowering it removes the highest buckets.

A context with no value for `by` does not match the rollout.

## The store never writes

The only writers are `toggle()` and editing the configuration. `resolve()` and
`plan()` are pure functions of `(config, context, now)`.

When a parent's window expires nothing changes in the store; `resolve()` starts
returning false for the dependant. When the window reopens it returns true
again. The dependant's `enabled` was `true` throughout, because that field means
"the maintainer wants this on", which stayed true.

Writing resolved values back would put entries in an audit log that nobody
performed, make a process that slept through a window boundary disagree with one
that was awake, and destroy the difference between "someone turned this off" and
"the system turned it off".

## Toggling

```ts
features.toggle('payments-v3', false);
// { ok: true, key: 'payments-v3', enabled: false, willDisable: ['checkout-v2', 'checkout-express'] }
```

Dependencies cascade one way only -- a dependant never blocks its parent -- but
the information that blocking existed to provide is kept. `willDisable` lists
the transitive dependants that resolve on now and will not after the toggle. A UI
can confirm before applying; a script can ignore it.

An unknown key returns `{ ok: false, error: 'unknown-feature' }` rather than
throwing.

## Static and runtime evaluation

```ts
features.plan({ now: new Date() });
// { 'checkout-v2': { resolved: 'deferred', needs: ['targetingKey'] }, … }
```

`plan()` partitions rules by the context they require. A rule needing only `now`
is resolvable for a known instant; a rule needing `targetingKey` is not. A static
site emits only the deferred set and resolves that per request; an API calls
`resolve()` per request. One engine, not a second code path.

Freezing a date window into a build is a deploy-cadence decision, so `plan()`
defers time-dependent rules unless the feature sets `freezeTimeAtBuild`.

## Cycles

A dependency cycle is rejected by `createFeatures`, with the path in the error:

```
FeatureCycleError: feature dependency cycle: a -> b -> c -> a
```

So is a `dependsOn` naming a feature that is not configured, and a duplicate
key. All three are configuration errors, and a cycle has no defined resolution
order at all, so none of them is left for evaluation to trip over.

## React

```tsx
'use client';
import {
  FeatureProvider,
  useFeature,
  useFeatureEnabled,
} from '@evanion/feature/react';

const features = createFeatures(config);
const context = { targetingKey: user.id, now: new Date() };

<FeatureProvider features={features} context={context}>
  <Checkout />
</FeatureProvider>;

function Checkout() {
  if (!useFeatureEnabled('checkout-v2')) return <LegacyCheckout />;
  return <NewCheckout />;
}
```

- `useFeatures()` -- every decision.
- `useFeature(key)` -- one decision, explanation included. Throws for a key that
  is not configured: a silent `false` makes a typo indistinguishable from a
  feature that is off.
- `useFeatureEnabled(key)` -- the boolean.

Resolution is memoised on the `context` object's identity, so keep that
reference stable. Pass `decisions` to hand the provider results resolved
elsewhere -- a server render, or a `plan()` snapshot.

## Typed keys

```ts
type Flag = 'payments-v3' | 'checkout-v2';
const features = createFeatures<Flag>(config);

features.resolve()['checkout-v2'].enabled; // Decision, not Decision | undefined
features.isEnabled('checkout-v3'); // compile error: not a Flag
```

Passing a literal key union makes the decision record exact, so a typo is a
compile error instead of an `undefined` at runtime.

## API

| Export                                                                                       |                                                                    |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `createFeatures(definitions)`                                                                | Builds the store. Validates the graph.                             |
| `.resolve(context?)`                                                                         | A decision per feature.                                            |
| `.isEnabled(key, context?)`                                                                  | One boolean.                                                       |
| `.plan(context?)`                                                                            | Build-time partition.                                              |
| `.toggle(key, enabled, context?)`                                                            | Writes intent, reports `willDisable`.                              |
| `.config`                                                                                    | The stored intent, deeply frozen.                                  |
| `.definition(key)`                                                                           | One stored definition.                                             |
| `.dependants(key)`                                                                           | Transitive dependants, in dependency order.                        |
| `.keys`                                                                                      | Every key, in configuration order.                                 |
| `bucketOf(value, seed)`, `inRollout(value, percent, seed)`, `murmur3(input)`                 | The bucketing primitives, exported for snapshot tooling and tests. |
| `evaluateCondition(condition, context)`                                                      | One condition, for the same reason.                                |
| `FeatureCycleError`, `UnknownDependencyError`, `DuplicateFeatureError`, `FeatureConfigError` | Construction errors.                                               |

## License

MIT
