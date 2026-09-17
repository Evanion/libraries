[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# Feature Toggles

> Not published yet. `package.json` carries `private: true`, so a release run
> versions and tags the package without publishing it. npm cannot configure a
> trusted publisher for a package that does not exist on the registry, so the
> first version has to be published by hand — see
> [RELEASING.md](../../RELEASING.md). Removing `private` before that bootstrap
> makes a release run fail at the publish step with everything else already
> tagged.

Feature toggles where one flag can depend on another. A parent that resolves off
takes its dependants with it, transitively, and it does that without writing
anything back into the configuration.

<!-- #region quick-start -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'new-checkout',
    enabled: true,
    rules: [
      {
        id: 'after-launch',
        when: [{ field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' }],
        rollout: { percent: 25, by: 'targetingKey' },
      },
    ],
  },
  { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
]);

const now = new Date('2026-11-01T00:00:00Z');

features.isEnabled('express-pickup', { targetingKey: 'cust-0042', now }); // -> true
features.isEnabled('express-pickup', { targetingKey: 'cust-0107', now }); // -> false
```

<!-- #endregion quick-start -->

Express pickup is offered only to a customer the new checkout is already on
for. `cust-0042` and `cust-0107` differ because the 25% rollout put them in
different buckets, and the answer for each is the same on every request.
Without the cascade, a quarter of customers would get the new checkout and all
of them would get its pickup option.

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
{ field: 'role', op: 'eq' | 'ne' | 'in' | 'not-in' | 'contains', value: 'bookseller' }
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

<!-- #region dependency-off -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'new-checkout',
    enabled: true,
    rules: [
      {
        id: 'staff-first',
        when: [{ field: 'role', op: 'eq', value: 'bookseller' }],
      },
    ],
  },
  { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
]);

features.resolve({ role: 'customer' })['express-pickup']; // -> { key: 'express-pickup', enabled: false, reason: 'dependency-off', blockedBy: 'new-checkout', cause: { key: 'new-checkout', reason: 'no-rule-matched', rule: 'staff-first' } }
```

<!-- #endregion dependency-off -->

`blockedBy` is the edge, for a graph view. `cause` is the first ancestor off for
a reason of its own, for an operator who wants to know what to fix.

`reason` is output only. Nothing in this library reads it back to decide
anything, so deleting it changes no decision.

## Rollouts

```ts
{ rollout: { percent: 25, by: 'targetingKey', seed: 'holiday-cohort' } }
```

The primitive under it is exported, and it is the whole of what a rollout
decides:

<!-- #region rollout -->

```ts @import.meta.vitest
import { inRollout } from '@evanion/feature';

inRollout('cust-0101', 10, 'new-checkout'); // -> true
inRollout('cust-0042', 10, 'new-checkout'); // -> false
```

<!-- #endregion rollout -->

The bucket behind it is a pure hash of the seed and the bucketing value. No
randomness, no clock, no process state, so every process agrees and a customer
who saw the new checkout at 10% still sees it at 25%:

<!-- #region bucket-stable -->

```ts @import.meta.vitest
import { bucketOf, inRollout } from '@evanion/feature';

bucketOf('cust-0101', 'new-checkout'); // -> 0.04385687271133065
inRollout('cust-0101', 25, 'new-checkout'); // -> true
inRollout('cust-0007', 25, 'new-checkout'); // -> false
```

<!-- #endregion bucket-stable -->

The seed defaults to the feature key, which is what puts one customer in
different places in two rollouts:

<!-- #region bucket-decorrelated -->

```ts @import.meta.vitest
import { bucketOf } from '@evanion/feature';

bucketOf('cust-0007', 'new-checkout'); // -> 0.912969104712829
bucketOf('cust-0007', 'express-pickup'); // -> 0.007160091772675514
```

<!-- #endregion bucket-decorrelated -->

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

<!-- #region toggle -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  { key: 'new-checkout', enabled: true },
  { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  { key: 'demo-night-booking', enabled: true, dependsOn: ['express-pickup'] },
]);

features.toggle('new-checkout', false); // -> { ok: true, key: 'new-checkout', enabled: false, willDisable: ['express-pickup', 'demo-night-booking'] }
```

<!-- #endregion toggle -->

Dependencies cascade one way only -- a dependant never blocks its parent -- but
the information that blocking existed to provide is kept. `willDisable` lists
the transitive dependants that resolve on now and will not after the toggle. A UI
can confirm before applying; a script can ignore it.

An unknown key returns `{ ok: false, error: 'unknown-feature' }` rather than
throwing.

## Static and runtime evaluation

<!-- #region plan -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'new-checkout',
    enabled: true,
    rules: [{ id: 'a-share', rollout: { percent: 10, by: 'targetingKey' } }],
  },
]);

features.plan({ now: new Date('2026-11-01T00:00:00Z') }); // -> { 'new-checkout': { key: 'new-checkout', resolved: 'deferred', needs: ['targetingKey'] } }
```

<!-- #endregion plan -->

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
  if (!useFeatureEnabled('express-pickup')) return <LegacyCheckout />;
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
type Flag = 'new-checkout' | 'express-pickup';
const features = createFeatures<Flag>(config);

features.resolve()['express-pickup'].enabled; // Decision, not Decision | undefined
features.isEnabled('express-delivery'); // compile error: not a Flag
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
