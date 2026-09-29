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

| Field               | Meaning                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `key`               | The identifier. `string` or `number`.                                    |
| `enabled`           | The maintainer wants this on.                                            |
| `dependsOn`         | Features that must resolve on for this one to.                           |
| `rules`             | Activation rules. OR-ed.                                                 |
| `seed`              | Bucketing seed for this feature's rollouts. Defaults to the key.         |
| `freezeTimeAtBuild` | Let `plan()` resolve this feature's time windows at build.               |
| `variants`          | Named variants this feature splits across.                               |
| `variantBy`         | Context field variant assignment buckets on. Defaults to `targetingKey`. |
| `variantSeed`       | Bucketing seed for this feature's variant split.                         |

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

A window's `value` is an ISO 8601 string, epoch milliseconds, or a `Date`. The
string has to name one instant on every host: a date-time carrying `Z` or an
offset, written `+01:00` or `+0100`, or a date with no time, which ECMA-262
fixes to UTC. `createFeatures` refuses `'2026-01-01T00:00:00'`, which ECMA-262
reads as local time, because the rule would derive one id and resolve against a
different boundary in every zone. It refuses `'2026-13-01'` and
`'2026-01-01t00:00:00z'` for the same reason: ECMA-262's format does not cover
them, so each engine reads them by rules of its own.

Epoch milliseconds have to be a number a `Date` holds, and a `Date` has to hold
an instant. `createFeatures` refuses `Number.NaN`, which is what `Date.parse`
answers for a string naming no instant, and refuses a number past either end of
the range a `Date` holds, which bounds a window every moment falls inside.

A `Date` holding an instant is taken as that instant and is read no further, so
`new Date('2026-01-01T00:00:00')` carries the constructing host's zone past
every check.

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

A feature that declares `variants` carries `variant` on a decision that
resolves on, and `value` too when the assigned variant declares one.
`assignment` says how: `source` is `'weighted'`, `'pinned'`, `'sticky'` or
`'fallback'`.

<!-- #region variant-result -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
]);

features.resolve({ targetingKey: 'user-1' })['checkout-cta']; // -> { key: 'checkout-cta', enabled: true, reason: 'default-on', variant: 'control', assignment: { source: 'weighted', by: 'targetingKey', bucket: 0.17582221026532352 } }
```

<!-- #endregion variant-result -->

`variant` and `value` are absent on a feature with no `variants` declared,
and so is `assignment`. All three are absent on a feature that resolved off.
See the Variants page in the docs for pinning, `stickyVariants` and what a
context missing the bucketing field gets.

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

## Variants

A feature can resolve to more than on and off. It can split its subjects
across named variants:

<!-- #region variant-basics -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
]);

features.resolve({ targetingKey: 'user-1' })['checkout-cta']; // -> { key: 'checkout-cta', enabled: true, reason: 'default-on', variant: 'control', assignment: { source: 'weighted', by: 'targetingKey', bucket: 0.17582221026532352 } }
```

<!-- #endregion variant-basics -->

Weights are relative and normalised across the set, so `3` and `1` split
75%/25% and never have to sum to 100:

<!-- #region variant-weights -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const weighted = createFeatures([
  {
    key: 'summary-panel',
    enabled: true,
    variants: [
      { name: 'control', weight: 3 },
      { name: 'compact', weight: 1 },
    ],
  },
]);

weighted.resolve({ targetingKey: 'user-4' })['summary-panel']; // -> { key: 'summary-panel', enabled: true, reason: 'default-on', variant: 'compact', assignment: { source: 'weighted', by: 'targetingKey', bucket: 0.9914100710302591 } }
weighted.resolve({ targetingKey: 'user-1' })['summary-panel']; // -> { key: 'summary-panel', enabled: true, reason: 'default-on', variant: 'control', assignment: { source: 'weighted', by: 'targetingKey', bucket: 0.4314444069750607 } }
```

<!-- #endregion variant-weights -->

`order` fixes a variant's position in the bucketing walk. The array index
decides the walk position when an author leaves `order` out, so an array a
control plane reorders with no explicit `order` reassigns a subject near a
boundary. An explicit `order` holds the walk steady under that same
reordering:

<!-- #region variant-order -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const declared = createFeatures([
  {
    key: 'summary-panel',
    enabled: true,
    variants: [
      { name: 'control', weight: 3 },
      { name: 'compact', weight: 1 },
    ],
  },
]);
const reordered = createFeatures([
  {
    key: 'summary-panel',
    enabled: true,
    variants: [
      { name: 'control', weight: 3, order: 0 },
      { name: 'compact', weight: 1, order: 1 },
    ],
  },
]);
const swapped = createFeatures([
  {
    key: 'summary-panel',
    enabled: true,
    variants: [
      { name: 'compact', weight: 1 },
      { name: 'control', weight: 3 },
    ],
  },
]);

declared.resolve({ targetingKey: 'user-4' })['summary-panel'].variant; // -> 'compact'
reordered.resolve({ targetingKey: 'user-4' })['summary-panel'].variant; // -> 'compact'
swapped.resolve({ targetingKey: 'user-4' })['summary-panel'].variant; // -> 'control'
```

<!-- #endregion variant-order -->

`variantSeed` defaults to a value distinct from the rollout's own seed. The
same seed on both correlates the two: every member of a 50% rollout falls
below the same 0.5 boundary a 50/50 variant split also uses.

<!-- #region variant-seed-shared -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const shared = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    rules: [{ rollout: { percent: 50 } }],
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
    variantSeed: 'checkout-cta',
  },
]);

shared.resolve({ targetingKey: 'user-1' })['checkout-cta'].variant; // -> 'control'
shared.resolve({ targetingKey: 'user-2' })['checkout-cta'].variant; // -> 'control'
```

<!-- #endregion variant-seed-shared -->

A rule can pin a variant, overriding the weights entirely:

<!-- #region variant-pin -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
    rules: [
      { when: [{ field: 'group', op: 'eq', value: 'staff' }], variant: 'blue' },
      { rollout: { percent: 20 } },
    ],
  },
]);

features.resolve({ targetingKey: 'user-1' })['checkout-cta'].variant; // -> 'control'
features.resolve({ targetingKey: 'user-1', group: 'staff' })['checkout-cta']; // -> { key: 'checkout-cta', enabled: true, reason: 'rule-match', rule: 'rule-39b9a074', variant: 'blue', assignment: { source: 'pinned', by: 'targetingKey', rule: 'rule-39b9a074' }, value: { label: 'Get it' } }
```

<!-- #endregion variant-pin -->

`stickyVariants` holds a prior assignment, keyed by feature, that an
application stores. A stored entry wins over the weights, checked before a
bucketing value is ever read:

<!-- #region variant-sticky -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const sticky = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
]);

sticky.resolve({ stickyVariants: { 'checkout-cta': 'blue' } })['checkout-cta']; // -> { key: 'checkout-cta', enabled: true, reason: 'default-on', variant: 'blue', assignment: { source: 'sticky', by: 'targetingKey' }, value: { label: 'Get it' } }
```

<!-- #endregion variant-sticky -->

With no sticky entry and no usable value for `by`, the subject takes the
control and `assignment.source` reads `'fallback'`:

<!-- #region variant-fallback -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
]);

features.resolve({})['checkout-cta']; // -> { key: 'checkout-cta', enabled: true, reason: 'default-on', variant: 'control', assignment: { source: 'fallback', by: 'targetingKey' } }
```

<!-- #endregion variant-fallback -->

`variant` and `value` are absent on a feature that resolves off, and so is
`assignment`:

<!-- #region variant-off -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
    rules: [
      { when: [{ field: 'group', op: 'eq', value: 'staff' }], variant: 'blue' },
      { rollout: { percent: 20 } },
    ],
  },
]);

features.resolve({ targetingKey: 'user-2' })['checkout-cta']; // -> { key: 'checkout-cta', enabled: false, reason: 'no-rule-matched', rules: [{ rule: 'rule-39b9a074', matched: false, failed: { field: 'group', op: 'eq', value: 'staff' } }, { rule: 'rule-3deffef5', matched: false, rollout: { percent: 20, by: 'targetingKey', member: false } }] }
```

<!-- #endregion variant-off -->

See the Variants page in the docs for the full walkthrough.

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
withholds `now` from the planning context unless the feature sets
`freezeTimeAtBuild`. A rule that still needs `now` to be decided is deferred on
the same terms as a rule needing any other absent field.

A rule the context already refutes needs nothing more. Conditions within a rule
are AND-ed, so one condition that fails settles the rule whatever an absent
field holds, and `plan()` walks past it to the rules below.

<!-- #region plan-refuted -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const promo = createFeatures([
  {
    key: 'eu-promo',
    enabled: true,
    rules: [
      {
        id: 'eu-pro',
        when: [
          { field: 'plan', op: 'eq', value: 'pro' },
          { field: 'region', op: 'eq', value: 'eu' },
        ],
      },
      { id: 'everyone', when: [] },
    ],
  },
]);

promo.plan({ plan: 'free' })['eu-promo']; // -> { key: 'eu-promo', resolved: true, needs: [], decision: { key: 'eu-promo', enabled: true, reason: 'rule-match', rule: 'everyone' } }
```

<!-- #endregion plan-refuted -->

`now` is one of those absent fields. A condition beside a window can refute the
rule on its own, so `'now'` reaches `needs` only where the walk read every other
condition and each one held.

<!-- #region plan-refuted-window -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const launch = createFeatures([
  {
    key: 'promo',
    enabled: true,
    rules: [
      {
        id: 'launch-pro',
        when: [
          { field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' },
          { field: 'plan', op: 'eq', value: 'pro' },
        ],
      },
      { id: 'everyone', when: [] },
    ],
  },
]);

launch.plan({ plan: 'free' }).promo; // -> { key: 'promo', resolved: true, needs: [], decision: { key: 'promo', enabled: true, reason: 'rule-match', rule: 'everyone' } }
launch.plan({ plan: 'pro' }).promo; // -> { key: 'promo', resolved: 'deferred', needs: ['now'] }
```

<!-- #endregion plan-refuted-window -->

When every rule loses this way the feature settles off, and the breakdown on
its decision says only what every request agrees on. `failed` names one
condition out of the several a rule can fail, and which one a request names
depends on the fields the build did not have, so an outcome names a condition
only where `plan()` read every condition ahead of the refuted one. Step over
one it could not read and the outcome names the rule and drops `failed`.

<!-- #region plan-breakdown -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const gated = createFeatures([
  {
    key: 'gated',
    enabled: true,
    rules: [
      {
        id: 'eu-pro',
        when: [
          { field: 'region', op: 'eq', value: 'eu' },
          { field: 'plan', op: 'eq', value: 'pro' },
        ],
      },
    ],
  },
]);

gated.resolve({ region: 'eu', plan: 'free' }).gated.rules; // -> [{ rule: 'eu-pro', matched: false, failed: { field: 'plan', op: 'eq', value: 'pro' } }]
gated.plan({ plan: 'free' }).gated.decision?.rules; // -> [{ rule: 'eu-pro', matched: false }]
```

<!-- #endregion plan-breakdown -->

A feature with no rules resolves on at build time even while it declares
variants, so `plan()` settles the two questions separately: `resolved` reads
enablement, and a deferred entry can still carry a `decision` when only the
variant split is outstanding.

<!-- #region plan-variant -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const withVariants = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
]);

withVariants.plan({})['checkout-cta']; // -> { key: 'checkout-cta', resolved: 'deferred', needs: ['targetingKey'], decision: { key: 'checkout-cta', enabled: true, reason: 'default-on' } }
withVariants.plan({ targetingKey: 'user-1' })['checkout-cta']; // -> { key: 'checkout-cta', resolved: true, needs: [], decision: { key: 'checkout-cta', enabled: true, reason: 'default-on', variant: 'control', assignment: { source: 'weighted', by: 'targetingKey', bucket: 0.17582221026532352 } } }
```

<!-- #endregion plan-variant -->

A parent deferred on its split alone has settled its own enablement, so it holds
no dependant up. The dependant cascades off that enablement and plans its own
rules the way it would under a resolved parent, and the parent's `targetingKey`
stays out of the dependant's `needs`.

<!-- #region plan-split-parent -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const chain = createFeatures([
  {
    key: 'banner',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
  {
    key: 'banner-cta',
    enabled: true,
    dependsOn: ['banner'],
    rules: [
      { id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] },
    ],
  },
]);

chain.plan({}).banner; // -> { key: 'banner', resolved: 'deferred', needs: ['targetingKey'], decision: { key: 'banner', enabled: true, reason: 'default-on' } }
chain.plan({})['banner-cta']; // -> { key: 'banner-cta', resolved: 'deferred', needs: ['role'] }
```

<!-- #endregion plan-split-parent -->

## Observing

An application installs one observer at construction, and the store calls it
once per public entry point call with the value that call returned.

<!-- #region observe-install -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';
import type { FeatureEvent } from '@evanion/feature';

const seen: FeatureEvent[] = [];

const features = createFeatures(
  [
    { key: 'new-checkout', enabled: true },
    { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  ],
  {
    observe: (event) => {
      seen.push(event);
    },
    version: '2026-11-01',
  },
);

const now = new Date('2026-11-01T00:00:00Z');

features.resolve({ targetingKey: 'cust-0042', now });

seen.length; // -> 1
seen[0]; // -> { type: 'resolve', at: new Date('2026-11-01T00:00:00Z'), subject: 'cust-0042', version: '2026-11-01', decisions: { 'new-checkout': { key: 'new-checkout', enabled: true, reason: 'default-on' }, 'express-pickup': { key: 'express-pickup', enabled: true, reason: 'default-on' } } }
```

<!-- #endregion observe-install -->

One call, one event. `resolve` reports every decision in that single event, so
an auditor reading it knows the application asked for every feature.

<!-- #region observe-one-key -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';
import type { FeatureEvent } from '@evanion/feature';

const seen: FeatureEvent[] = [];

const features = createFeatures(
  [
    { key: 'new-checkout', enabled: true },
    { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  ],
  {
    observe: (event) => {
      seen.push(event);
    },
  },
);

const now = new Date('2026-11-01T00:00:00Z');

features.isEnabled('express-pickup', { targetingKey: 'cust-0042', now });

seen.length; // -> 1
seen[0]; // -> { type: 'is-enabled', at: new Date('2026-11-01T00:00:00Z'), subject: 'cust-0042', key: 'express-pickup', decision: { key: 'express-pickup', enabled: true, reason: 'default-on' } }
```

<!-- #endregion observe-one-key -->

`isEnabled` resolves every feature to answer about one, and it reports the one
decision the caller received. `toggle` reports its own result the same way. A
write that names an unconfigured key is reported too, carrying the
`unknown-feature` result the caller received.

<!-- #region observe-toggle -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';
import type { FeatureEvent } from '@evanion/feature';

const seen: FeatureEvent[] = [];

const features = createFeatures(
  [
    { key: 'new-checkout', enabled: true },
    { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  ],
  {
    observe: (event) => {
      seen.push(event);
    },
  },
);

const now = new Date('2026-11-01T00:00:00Z');

features.toggle('new-checkout', false, { now });

seen[0]; // -> { type: 'toggle', at: new Date('2026-11-01T00:00:00Z'), result: { ok: true, key: 'new-checkout', enabled: false, willDisable: ['express-pickup'] } }
```

<!-- #endregion observe-toggle -->

An observer changes no outcome. The engine never awaits it, and an observer
that throws or rejects reaches `onObserveError` while the caller keeps the
value the entry point computed.

<!-- #region observe-failure -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const failures: string[] = [];

const features = createFeatures([{ key: 'new-checkout', enabled: true }], {
  observe: () => {
    throw new Error('audit transport down');
  },
  onObserveError: (error) => {
    failures.push(String(error));
  },
});

features.isEnabled('new-checkout'); // -> true
failures; // -> ['Error: audit transport down']
```

<!-- #endregion observe-failure -->

An event carries no `EvaluationContext`. It carries the instant the call
settled on, the value it returned, and a subject identifier copied out as a
primitive. `correlateBy` names the context field that identifier is read off,
and it defaults to `targetingKey`.

<!-- #region observe-correlate -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';
import type { FeatureEvent } from '@evanion/feature';

const seen: FeatureEvent[] = [];

const features = createFeatures([{ key: 'new-checkout', enabled: true }], {
  observe: (event) => {
    seen.push(event);
  },
  correlateBy: 'analyticsId',
});

const now = new Date('2026-11-01T00:00:00Z');

features.resolve({ targetingKey: 'cust-0042', analyticsId: 'anon-7f3c', now });

seen[0]?.subject; // -> 'anon-7f3c'
```

<!-- #endregion observe-correlate -->

An application bucketing on a raw identifier points `correlateBy` at a field
carrying a pseudonym, and the raw identifier stays out of the event.

This seam does not record exposure. `resolve` decides every configured feature,
so an observer fired from it records an exposure for every feature the request
never rendered. The application records exposure at the render site, off the
decision it already holds. See the Observing page in the docs for the whole
argument.

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
  useVariant,
} from '@evanion/feature/react';

const features = createFeatures([{ key: 'express-pickup', enabled: true }]);
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
- `useVariant(key)` -- `{ variant?, value? }`, read off the same decision.
  Throws for the same unconfigured key `useFeature` does.
- `createFeatureContext(features)` -- the provider and the same four hooks, bound
  to one store's schema. Each bound hook names `keyof S`, so a misspelled key is
  a compile error and `useVariant` answers the variant union that store declares.

Resolution is memoised on the `context` object's identity, so keep that
reference stable. Pass `decisions` to hand the provider results resolved
elsewhere -- a server render, or a `plan()` snapshot.

## Typing the keys and the variants

A store built from an array literal needs no type argument. `createFeatures`
reads the keys, the variant names and each variant's value off the literal, so a
typo is a compile error and not an `undefined` at runtime.

Name a schema when the configuration arrives as JSON, or from a variable typed
`FeatureDefinition<Flag>[]`, because a value with no literals in it carries
nothing for the compiler to read. An entry is `never` for a feature that declares
no variants, and that feature's decision then carries no `variant` key and no
`value` key.

```ts
interface Flags {
  'new-checkout': never;
  'express-pickup': { variant: 'control' | 'blue'; value: never };
}

const features = createFeatures<Flags>(config);

features.resolve()['express-pickup'].enabled; // Decision, not Decision | undefined
features.variantOf('express-pickup'); // 'control' | 'blue' | undefined
features.isEnabled('express-delivery'); // compile error: not a key of Flags
```

`createFeatures<Flags>(config)` checks every definition's key against
`keyof Flags`, so a definition naming a feature `Flags` does not declare is a
compile error at the call.

## API

| Export                                                                                       |                                                                    |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `createFeatures(definitions)`                                                                | Builds the store. Validates the graph.                             |
| `.resolve(context?)`                                                                         | A decision per feature.                                            |
| `.isEnabled(key, context?)`                                                                  | One boolean.                                                       |
| `.variantOf(key, context?)`                                                                  | The assigned variant, at the type the schema declares.             |
| `.valueOf(key, context?)`                                                                    | That variant's configured value.                                   |
| `.plan(context?)`                                                                            | Build-time partition.                                              |
| `.toggle(key, enabled, context?)`                                                            | Writes intent, reports `willDisable`.                              |
| `.config`                                                                                    | The stored intent, deeply frozen.                                  |
| `.definition(key)`                                                                           | One stored definition.                                             |
| `.dependants(key)`                                                                           | Transitive dependants, in dependency order.                        |
| `.keys`                                                                                      | Every key, in configuration order.                                 |
| `bucketOf(value, seed)`, `inRollout(value, percent, seed)`, `murmur3(input)`                 | The bucketing primitives, exported for snapshot tooling and tests. |
| `assignVariant(definition, context)`, `variantSeedOf(definition)`                            | The variant assignment primitives, for the same reason.            |
| `evaluateCondition(condition, context)`                                                      | One condition, for the same reason.                                |
| `FeatureCycleError`, `UnknownDependencyError`, `DuplicateFeatureError`, `FeatureConfigError` | Construction errors.                                               |

## License

MIT
