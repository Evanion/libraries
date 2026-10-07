# @evanion/feature

**Dependency-aware feature flags: a feature whose parent resolves off resolves off with it.**

> **Not on npm yet.** `package.json` carries `private: true`, so a release run
> versions and tags the package without publishing it, and
> `npm install @evanion/feature` does not resolve until the first version is
> published by hand. See [RELEASING.md](../../RELEASING.md).

Express pickup only exists inside the new checkout, so a customer who gets express pickup without the new checkout sees a broken page. `@evanion/feature` resolves a feature off whenever a feature it depends on resolves off, so no feature is ever on without its prerequisites.

## Flags that depend on other flags

Baize offers express pickup inside the new checkout, and demo night booking inside express pickup. With independent flags, every component that renders the booking repeats the whole chain:

```tsx
if (flags.newCheckout && flags.expressPickup && flags.demoNightBooking) {
  return <DemoNightBooking />;
}
```

Turn the new checkout off, and every component that left one of those checks out still offers the booking.

## The cascade

`@evanion/feature` takes a dependency graph. If a parent feature resolves off, all of its dependants resolve off with it, transitively, on the same call. Nothing is written back into your configuration.

<!-- #region cascade -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'new-checkout',
    enabled: true,
    rules: [
      {
        id: 'booksellers-first',
        when: [{ field: 'role', op: 'eq', value: 'bookseller' }],
      },
    ],
  },
  {
    key: 'express-pickup',
    enabled: true,
    dependsOn: ['new-checkout'],
  },
]);

// A bookseller gets the new checkout AND the express pickup
const bookseller = { role: 'bookseller' };
features.isEnabled('express-pickup', bookseller); // -> true

// A customer is denied the checkout, so they are automatically denied pickup
const customer = { role: 'customer' };
features.isEnabled('express-pickup', customer); // -> false
```

<!-- #endregion cascade -->

## What it does

- Dependencies are transitive. If express pickup depends on the new checkout, and demo night booking on express pickup, turning off the new checkout takes both off.
- Rollouts hash the customer's id, so one customer gets the same answer in every session and every service.
- Variants split customers across named versions of a feature by relative weight.
- A rule can open or close a feature at an ISO 8601 instant, such as `2026-10-01T00:00:00Z`.
- A rule can match any field of the context you pass, such as a role.
- The core imports no framework, so the same store runs in an API, a build script, or under the `@evanion/feature/react` provider.

## Installation

```bash
npm install @evanion/feature
```

The package needs Node 20 or later and ships ES modules. It has two entry points. `@evanion/feature` is the core and imports no framework. `@evanion/feature/react` carries the provider and hooks, is client code, and needs React 18 or 19, an optional peer dependency.

## Beyond the basics

A feature moves from booksellers only to every customer through rules, rollouts and variants. The sections below also cover:

- `plan()`, which splits features into those a build can resolve and those deferred to the request.
- Variant pinning, which overrides the weights for a matching rule, such as pinning booksellers to the `blue` variant.
- Sticky assignments, which hand back an assignment your application stored, so a customer keeps a variant when you change the weights.
- The `observe` callback, which reports each decision the store made for a request.

## Rolling Out by Date and Share

A rule can combine a time window with a percentage rollout. Express pickup below is offered only to a customer the new checkout is already on for:

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

`cust-0042` and `cust-0107` differ because the 25% rollout put them in different buckets, and the answer for each is the same on every request. Without the cascade, a quarter of customers would get the new checkout and all of them would get its pickup option.

## Writing Definitions

A feature is stored intent. `createFeatures` validates the dependency graph, deep-clones and freezes your definitions, and returns the store. Your own array stays editable:

<!-- #region definition -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const definitions = [{ key: 'gift-cards', enabled: true }];
const features = createFeatures(definitions);

features.isEnabled('gift-cards'); // -> true
Object.isFrozen(definitions[0]); // -> false
Object.isFrozen(features.definition('gift-cards')); // -> true
```

<!-- #endregion definition -->

Dependencies are transitive and one-way, and a definition may name a feature declared after it. A feature that is off takes every feature behind it along and leaves the feature it depends on alone:

<!-- #region cascade-chain -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  { key: 'demo-night-booking', enabled: true, dependsOn: ['express-pickup'] },
  { key: 'express-pickup', enabled: false, dependsOn: ['new-checkout'] },
  { key: 'new-checkout', enabled: true },
]);

features.isEnabled('demo-night-booking'); // -> false
features.isEnabled('new-checkout'); // -> true
```

<!-- #endregion cascade-chain -->

### Configuration Errors

`createFeatures` refuses a broken graph at construction. Every error it throws extends `FeatureConfigError`, and `resolve`, `plan` and `toggle` never throw:

<!-- #region config-errors -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';
import type { FeatureDefinition } from '@evanion/feature';

const attempt = (definitions: FeatureDefinition[]) => {
  try {
    createFeatures(definitions);
    return 'built';
  } catch (error) {
    return String(error);
  }
};

const cycle: FeatureDefinition[] = [
  { key: 'a', enabled: true, dependsOn: ['c'] },
  { key: 'b', enabled: true, dependsOn: ['a'] },
  { key: 'c', enabled: true, dependsOn: ['b'] },
];
const duplicate: FeatureDefinition[] = [
  { key: 'a', enabled: true },
  { key: 'a', enabled: true },
];

attempt(cycle); // -> 'FeatureCycleError: feature dependency cycle: a -> c -> b -> a'
attempt([{ key: 'a', enabled: true, dependsOn: ['b'] }]); // -> 'UnknownDependencyError: feature "a" depends on "b", which is not configured'
attempt(duplicate); // -> 'DuplicateFeatureError: duplicate feature key "a"'
```

<!-- #endregion config-errors -->

### Rules and Conditions

Rules are OR-ed, the conditions inside one rule are AND-ed, and a rollout is one more conjunct of the rule that carries it:

<!-- #region rules -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'beta-banner',
    enabled: true,
    rules: [
      {
        id: 'internal',
        when: [{ field: 'roles', op: 'contains', value: 'bookseller' }],
      },
      { id: 'ramp', rollout: { percent: 10 } },
    ],
  },
]);

features.isEnabled('beta-banner', { roles: ['bookseller'] }); // -> true
const customer = (targetingKey: string) =>
  features.isEnabled('beta-banner', { roles: ['customer'], targetingKey });

customer('cust-0042'); // -> false
customer('cust-0007'); // -> true
```

<!-- #endregion rules -->

A condition over a field the context does not carry never holds, the negative operators included. `ne` on an absent field is unevaluable, so it is false:

<!-- #region absent-field -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const preview = createFeatures([
  {
    key: 'new-checkout',
    enabled: true,
    rules: [
      {
        id: 'not-customers',
        when: [{ field: 'role', op: 'ne', value: 'customer' }],
      },
    ],
  },
]);

preview.isEnabled('new-checkout', { role: 'bookseller' }); // -> true
preview.isEnabled('new-checkout', {}); // -> false
```

<!-- #endregion absent-field -->

A time window's string has to name one instant on every host: a date-time carrying `Z` or an offset, or a date with no time, which ECMA-262 fixes to UTC. `createFeatures` refuses the rest:

<!-- #region instant-strings -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const opening = (value: string) => {
  try {
    createFeatures([
      {
        key: 'new-checkout',
        enabled: true,
        rules: [{ id: 'launch', when: [{ field: 'now', op: 'after', value }] }],
      },
    ]);
    return 'built';
  } catch (error) {
    return (error as Error).name;
  }
};

opening('2026-01-01T09:00:00+09:00'); // -> 'built'
opening('2026-01-01T09:00:00+0900'); // -> 'built'
opening('2026-01-01'); // -> 'built'
opening('2026-01-01T00:00:00'); // -> 'FeatureConfigError'
opening('2026-04-31'); // -> 'FeatureConfigError'
```

<!-- #endregion instant-strings -->

### Typing the Keys and the Variants

A store built from an array literal needs no type argument. When your configuration arrives as JSON, or from a variable typed `FeatureDefinition<Flag>[]`, name a schema:

<!-- #region typed-schema -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';
import type { FeatureDefinition } from '@evanion/feature';

interface Flags {
  'new-checkout': never;
  'express-pickup': { variant: 'control' | 'blue'; value: never };
}

// Typed as definitions, so the compiler has no literals to read.
const config: FeatureDefinition<keyof Flags>[] = [
  { key: 'new-checkout', enabled: true },
  {
    key: 'express-pickup',
    enabled: true,
    dependsOn: ['new-checkout'],
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
];

const features = createFeatures<Flags>(config);

features.variantOf('express-pickup', { targetingKey: 'cust-0042' }); // -> 'blue'
// @ts-expect-error -- 'express-delivery' is not a key of Flags
features.isEnabled('express-delivery'); // -> false
```

<!-- #endregion typed-schema -->

## Reading a Decision

`resolve` returns one decision per feature. `enabled` is the decision, and everything else explains it:

<!-- #region dependency-off -->

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
// ---cut---
features.resolve({ targetingKey: 'cust-0107', now })['express-pickup']; // -> { key: 'express-pickup', enabled: false, reason: 'dependency-off', blockedBy: 'new-checkout', cause: { key: 'new-checkout', reason: 'no-rule-matched', rule: 'after-launch' } }
```

<!-- #endregion dependency-off -->

| `reason`          | Meaning                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `default-on`      | enabled, no rules                                                 |
| `rule-match`      | enabled, a rule matched; carries `rule`                           |
| `explicitly-off`  | `enabled === false`                                               |
| `no-rule-matched` | enabled, rules present, none passed; carries a per-rule breakdown |
| `dependency-off`  | a parent resolved off; carries `blockedBy` and `cause`            |

`reason` is output only. Nothing in this library reads it back to decide anything.

One `resolve` per request answers every flag on the page:

<!-- #region resolve-request -->

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
// ---cut---
const decisions = features.resolve({ targetingKey: 'cust-0101', now });

decisions['new-checkout']; // -> { key: 'new-checkout', enabled: true, reason: 'rule-match', rule: 'after-launch' }
decisions['express-pickup']; // -> { key: 'express-pickup', enabled: true, reason: 'default-on' }
```

<!-- #endregion resolve-request -->

`blockedBy` names the immediate parent and `cause` the first ancestor that is off for a reason of its own. Down a chain the two differ:

<!-- #region cascade-reasons -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  { key: 'new-checkout', enabled: true },
  { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  { key: 'demo-night-booking', enabled: true, dependsOn: ['express-pickup'] },
]);
// ---cut---
features.toggle('new-checkout', false);
const decisions = features.resolve();

decisions['express-pickup']; // -> { key: 'express-pickup', enabled: false, reason: 'dependency-off', blockedBy: 'new-checkout', cause: { key: 'new-checkout', reason: 'explicitly-off' } }
decisions['demo-night-booking']; // -> { key: 'demo-night-booking', enabled: false, reason: 'dependency-off', blockedBy: 'express-pickup', cause: { key: 'new-checkout', reason: 'explicitly-off' } }
```

<!-- #endregion cascade-reasons -->

A `no-rule-matched` decision carries one outcome per rule. A condition that failed is named in `failed`, and a rollout that left the customer out reports its numbers in `rollout`:

<!-- #region no-rule-matched -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'new-checkout',
    enabled: true,
    rules: [
      { when: [{ field: 'role', op: 'eq', value: 'bookseller' }] },
      { id: 'a-share', rollout: { percent: 10 } },
    ],
  },
]);

const customer = { role: 'customer', targetingKey: 'cust-0042' };

features.resolve(customer)['new-checkout']; // -> { key: 'new-checkout', enabled: false, reason: 'no-rule-matched', rules: [{ rule: 'rule-d69c7f2b', matched: false, failed: { field: 'role', op: 'eq', value: 'bookseller' } }, { rule: 'a-share', matched: false, rollout: { percent: 10, by: 'targetingKey', member: false } }] }
```

<!-- #endregion no-rule-matched -->

## Toggling and Inspecting the Store

`toggle` is the only writer. It sets `enabled` on the stored definition and reports which dependants went off with it:

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

`willDisable` lists only the dependants that were on and are now off, and it is empty when enabling. A key the store was not built with returns a result and never throws:

<!-- #region toggle-report -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  { key: 'new-checkout', enabled: true },
  { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  { key: 'demo-night-booking', enabled: true, dependsOn: ['express-pickup'] },
]);
// ---cut---
features.toggle('express-pickup', false); // -> { ok: true, key: 'express-pickup', enabled: false, willDisable: ['demo-night-booking'] }
features.toggle('express-pickup', true); // -> { ok: true, key: 'express-pickup', enabled: true, willDisable: [] }
// @ts-expect-error -- the store's keys are checked at compile time too
features.toggle('express-delivery', false); // -> { ok: false, key: 'express-delivery', error: 'unknown-feature' }
```

<!-- #endregion toggle-report -->

The store also answers what it holds:

<!-- #region inspect -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  { key: 'new-checkout', enabled: true },
  { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  { key: 'demo-night-booking', enabled: true, dependsOn: ['express-pickup'] },
]);
// ---cut---
features.keys; // -> ['new-checkout', 'express-pickup', 'demo-night-booking']
features.dependants('new-checkout'); // -> ['express-pickup', 'demo-night-booking']
features.definition('express-pickup'); // -> { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] }
Object.isFrozen(features.config); // -> true
```

<!-- #endregion inspect -->

## Rollouts

A rollout's answer is a pure hash of a seed and the customer's bucketing value, so the same customer gets the same answer in every process:

<!-- #region rollout -->

```ts @import.meta.vitest
import { inRollout } from '@evanion/feature';

inRollout('cust-0101', 10, 'new-checkout'); // -> true
inRollout('cust-0042', 10, 'new-checkout'); // -> false
```

<!-- #endregion rollout -->

The bucket does not depend on the percentage, so raising a percentage only adds members:

<!-- #region bucket-stable -->

```ts @import.meta.vitest
import { bucketOf, inRollout } from '@evanion/feature';

bucketOf('cust-0101', 'new-checkout'); // -> 0.04385687271133065
inRollout('cust-0101', 25, 'new-checkout'); // -> true
inRollout('cust-0007', 25, 'new-checkout'); // -> false
```

<!-- #endregion bucket-stable -->

The seed defaults to the feature key, which puts one customer in unrelated buckets for two features:

<!-- #region bucket-decorrelated -->

```ts @import.meta.vitest
import { bucketOf } from '@evanion/feature';

bucketOf('cust-0007', 'new-checkout'); // -> 0.912969104712829
bucketOf('cust-0007', 'express-pickup'); // -> 0.007160091772675514
```

<!-- #endregion bucket-decorrelated -->

`by` names the context field a rollout buckets on, and `seed` replaces the feature key as the hash seed. Gift cards below take the new checkout's seed, so they reach the same customers the new checkout's 25% does:

<!-- #region rollout-spec -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'gift-cards',
    enabled: true,
    rules: [
      {
        rollout: {
          percent: 25,
          by: 'targetingKey',
          seed: 'new-checkout',
        },
      },
    ],
  },
]);

features.isEnabled('gift-cards', { targetingKey: 'cust-0101' }); // -> true
features.isEnabled('gift-cards', { targetingKey: 'cust-0007' }); // -> false
```

<!-- #endregion rollout-spec -->

A context with no value for `by` is outside every rollout, even at 100%. A `percent` of `0` includes nobody:

<!-- #region rollout-edges -->

```ts @import.meta.vitest
import { createFeatures, inRollout } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'new-checkout',
    enabled: true,
    rules: [{ id: 'everyone', rollout: { percent: 100 } }],
  },
]);

features.isEnabled('new-checkout', { targetingKey: 'cust-0042' }); // -> true
features.isEnabled('new-checkout', {}); // -> false
inRollout('cust-0101', 0, 'new-checkout'); // -> false
```

<!-- #endregion rollout-edges -->

The primitives work without a store, for snapshot tests or for asking which customers a rollout reaches:

<!-- #region primitives -->

```ts @import.meta.vitest
import { bucketOf, inRollout } from '@evanion/feature';

const customers = ['cust-0007', 'cust-0042', 'cust-0101', 'cust-0113'];

customers.filter((id) => inRollout(id, 10, 'new-checkout')); // -> ['cust-0101', 'cust-0113']
bucketOf('cust-0113', 'new-checkout'); // -> 0.03226795047521591
```

<!-- #endregion primitives -->

## Variants

A feature can resolve to more than on and off. It can split its subjects across named variants:

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

Weights are relative and normalised across the set, so `3` and `1` split 75%/25% and never have to sum to 100:

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

`order` fixes a variant's position in the bucketing walk. Without it the array index decides, so a control plane that reorders the array reassigns a subject. With it, the same reorder moves nobody:

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
const swappedWithOrder = createFeatures([
  {
    key: 'summary-panel',
    enabled: true,
    variants: [
      { name: 'compact', weight: 1, order: 1 },
      { name: 'control', weight: 3, order: 0 },
    ],
  },
]);

declared.resolve({ targetingKey: 'user-4' })['summary-panel'].variant; // -> 'compact'
swapped.resolve({ targetingKey: 'user-4' })['summary-panel'].variant; // -> 'control'
swappedWithOrder.resolve({ targetingKey: 'user-4' })['summary-panel'].variant; // -> 'compact'
```

<!-- #endregion variant-order -->

`variantSeed` defaults to `${seed ?? key}:variant`, a value distinct from the rollout's own seed. The same seed on both correlates the two: every member of a 50% rollout falls below the same 0.5 boundary a 50/50 split uses, so all of them get the control:

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
      {
        when: [{ field: 'role', op: 'eq', value: 'bookseller' }],
        variant: 'blue',
      },
      { rollout: { percent: 20 } },
    ],
  },
]);

const bookseller = { targetingKey: 'user-1', role: 'bookseller' };

features.resolve({ targetingKey: 'user-1' })['checkout-cta'].variant; // -> 'control'
features.resolve(bookseller)['checkout-cta']; // -> { key: 'checkout-cta', enabled: true, reason: 'rule-match', rule: 'rule-d69c7f2b', variant: 'blue', assignment: { source: 'pinned', by: 'targetingKey', rule: 'rule-d69c7f2b' }, value: { label: 'Get it' } }
```

<!-- #endregion variant-pin -->

`stickyVariants` holds a prior assignment, keyed by feature, that your application stored. A stored entry naming a declared variant wins over the weights:

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

With no sticky entry and no usable value for `variantBy`, the subject takes the control, the first variant in bucketing order, and `assignment.source` reads `'fallback'`:

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

`variant`, `value` and `assignment` are absent on a feature that resolves off:

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
      {
        when: [{ field: 'role', op: 'eq', value: 'bookseller' }],
        variant: 'blue',
      },
      { rollout: { percent: 20 } },
    ],
  },
]);

features.resolve({ targetingKey: 'user-2' })['checkout-cta']; // -> { key: 'checkout-cta', enabled: false, reason: 'no-rule-matched', rules: [{ rule: 'rule-d69c7f2b', matched: false, failed: { field: 'role', op: 'eq', value: 'bookseller' } }, { rule: 'rule-3deffef5', matched: false, rollout: { percent: 20, by: 'targetingKey', member: false } }] }
```

<!-- #endregion variant-off -->

## Build-time Planning

`plan()` partitions every feature into resolvable now and deferred, for a build that does not have the whole evaluation context. A build that renders one page per game knows the game and not the customer:

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

features.plan({ game: 'urn:game:azul' }); // -> { 'new-checkout': { key: 'new-checkout', resolved: 'deferred', needs: ['targetingKey'] } }
```

<!-- #endregion plan -->

A rule the context already refutes needs nothing more. Conditions within a rule are AND-ed, so one failing condition settles the rule whatever an absent field holds:

<!-- #region plan-refuted -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const booking = createFeatures([
  {
    key: 'demo-night-booking',
    enabled: true,
    rules: [
      {
        id: 'spirit-island-preview',
        when: [
          { field: 'game', op: 'eq', value: 'urn:game:spirit-island' },
          { field: 'role', op: 'eq', value: 'bookseller' },
        ],
      },
      { id: 'everyone', when: [] },
    ],
  },
]);

booking.plan({ game: 'urn:game:azul' })['demo-night-booking']; // -> { key: 'demo-night-booking', resolved: true, needs: [], decision: { key: 'demo-night-booking', enabled: true, reason: 'rule-match', rule: 'everyone' } }
```

<!-- #endregion plan-refuted -->

`plan()` withholds `now` from a feature's rules unless the feature sets `freezeTimeAtBuild`, so a window stays deferred even when the build's clock is past it:

<!-- #region freeze-time -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'demo-night-booking',
    enabled: true,
    freezeTimeAtBuild: true,
    rules: [
      {
        id: 'from-december',
        when: [{ field: 'now', op: 'after', value: '2026-12-01T00:00:00Z' }],
      },
    ],
  },
  {
    key: 'gift-cards',
    enabled: true,
    rules: [
      {
        id: 'from-december',
        when: [{ field: 'now', op: 'after', value: '2026-12-01T00:00:00Z' }],
      },
    ],
  },
]);

const plan = features.plan({ now: new Date('2026-12-02T00:00:00Z') });

plan['demo-night-booking']; // -> { key: 'demo-night-booking', resolved: true, needs: [], decision: { key: 'demo-night-booking', enabled: true, reason: 'rule-match', rule: 'from-december' } }
plan['gift-cards']; // -> { key: 'gift-cards', resolved: 'deferred', needs: ['now'] }
```

<!-- #endregion freeze-time -->

A planned breakdown names a failed condition only where every request would name the same one. Where `plan()` stepped over a condition it could not read, the outcome names the rule and drops `failed`:

<!-- #region plan-breakdown -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const booking = createFeatures([
  {
    key: 'demo-night-booking',
    enabled: true,
    rules: [
      {
        id: 'spirit-island-preview',
        when: [
          { field: 'role', op: 'eq', value: 'bookseller' },
          { field: 'game', op: 'eq', value: 'urn:game:spirit-island' },
        ],
      },
    ],
  },
]);

const request = { role: 'bookseller', game: 'urn:game:azul' };
const build = { game: 'urn:game:azul' };

booking.resolve(request)['demo-night-booking'].rules; // -> [{ rule: 'spirit-island-preview', matched: false, failed: { field: 'game', op: 'eq', value: 'urn:game:spirit-island' } }]
booking.plan(build)['demo-night-booking'].decision?.rules; // -> [{ rule: 'spirit-island-preview', matched: false }]
```

<!-- #endregion plan-breakdown -->

`plan()` settles enablement and the variant split separately. A deferred entry still carries a `decision` when only the split is outstanding:

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

The two halves of a plan go to different places. The settled decisions ship with the build, and the deferred keys are what the request still resolves:

<!-- #region plan-split -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'new-checkout',
    enabled: true,
    rules: [{ id: 'a-share', rollout: { percent: 10 } }],
  },
  { key: 'gift-cards', enabled: true },
  { key: 'demo-night-booking', enabled: false },
]);

const plan = features.plan({ game: 'urn:game:azul' });

const settled = Object.fromEntries(
  Object.entries(plan)
    .filter(([, entry]) => entry.resolved !== 'deferred')
    .map(([key, entry]) => [key, entry.decision]),
);
const deferred = Object.values(plan)
  .filter((entry) => entry.resolved === 'deferred')
  .map((entry) => entry.key);

settled; // -> { 'gift-cards': { key: 'gift-cards', enabled: true, reason: 'default-on' }, 'demo-night-booking': { key: 'demo-night-booking', enabled: false, reason: 'explicitly-off' } }
deferred; // -> ['new-checkout']
```

<!-- #endregion plan-split -->

## Observing

An application installs one observer at construction. The store calls it once for each `resolve`, `plan` and `toggle` call, and for each `isEnabled` call on a configured key, with the value that call returned. `variantOf` and `valueOf` report nothing:

<!-- #region observe-install -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';
import type { FeatureEvent } from '@evanion/feature';

const seen: FeatureEvent[] = [];

const features = createFeatures(
  [
    { key: 'new-checkout', enabled: true },
    { key: 'gift-cards', enabled: true },
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
seen[0]; // -> { type: 'resolve', at: new Date('2026-11-01T00:00:00Z'), subject: 'cust-0042', version: '2026-11-01', decisions: { 'new-checkout': { key: 'new-checkout', enabled: true, reason: 'default-on' }, 'gift-cards': { key: 'gift-cards', enabled: true, reason: 'default-on' } } }
```

<!-- #endregion observe-install -->

`isEnabled` resolves every feature to answer about one, and it reports the one decision the caller received:

<!-- #region observe-one-key -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';
import type { FeatureEvent } from '@evanion/feature';

const seen: FeatureEvent[] = [];

const features = createFeatures(
  [
    { key: 'new-checkout', enabled: true },
    { key: 'gift-cards', enabled: true },
  ],
  {
    observe: (event) => {
      seen.push(event);
    },
  },
);

const now = new Date('2026-11-01T00:00:00Z');

features.isEnabled('gift-cards', { targetingKey: 'cust-0042', now });

seen.length; // -> 1
seen[0]; // -> { type: 'is-enabled', at: new Date('2026-11-01T00:00:00Z'), subject: 'cust-0042', key: 'gift-cards', decision: { key: 'gift-cards', enabled: true, reason: 'default-on' } }
```

<!-- #endregion observe-one-key -->

An observer changes no outcome. The engine never awaits it, and an observer that throws or rejects reaches `onObserveError` while the caller keeps the value the entry point computed:

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

An event carries no `EvaluationContext`. It carries a subject identifier copied out as a primitive, and `correlateBy` names the context field it is read off, defaulting to `targetingKey`:

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

Because the engine never awaits an observer, an asynchronous transport buffers events and drains them at a concurrency the application controls:

<!-- #region observe-buffer -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';
import type { FeatureEvent } from '@evanion/feature';

const pending: FeatureEvent[] = [];
const sent: FeatureEvent[][] = [];
const transport = { send: (batch: FeatureEvent[]) => sent.push(batch) };

const features = createFeatures([{ key: 'new-checkout', enabled: true }], {
  observe: (event) => {
    pending.push(event);
  },
});

features.resolve({ targetingKey: 'cust-0042' });
features.isEnabled('new-checkout', { targetingKey: 'cust-0107' });

// A server runs this on exit: process.on('SIGTERM', drain)
const drain = () => transport.send(pending.splice(0));
drain();

pending.length; // -> 0
sent[0]?.map((event) => event.type); // -> ['resolve', 'is-enabled']
```

<!-- #endregion observe-buffer -->

This seam does not record exposure. `resolve` decides every configured feature, so an observer fired from it records an exposure for every feature the request never rendered. The application records exposure where it renders, off the decision `useFeature` already holds:

<!-- #region observe-exposure -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
// ---cut---
import { createFeatures } from '@evanion/feature';
import { createFeatureContext } from '@evanion/feature/react';
import { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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
const { FeatureProvider, useFeature } = createFeatureContext(features);

const exposures: object[] = [];
const analytics = {
  exposure: (record: object) => {
    exposures.push(record);
  },
};

// components/cta.tsx, a client module ('use client')
function Cta({ customerId }: { customerId: string }) {
  const decision = useFeature('checkout-cta');

  useEffect(() => {
    analytics.exposure({
      feature: 'checkout-cta',
      variant: decision.variant,
      source: decision.assignment?.source,
      bucket: decision.assignment?.bucket,
      rule: decision.rule,
      subject: customerId,
    });
  }, [decision, customerId]);

  return <button type="button">{decision.value?.label ?? 'Buy'}</button>;
}

// app/page.tsx, a Server Component
function Page({ customerId }: { customerId: string }) {
  const decisions = features.resolve({ targetingKey: customerId });

  return (
    <FeatureProvider decisions={decisions}>
      <Cta customerId={customerId} />
    </FeatureProvider>
  );
}

const html = renderToStaticMarkup(<Page customerId="cust-0199" />);

html; // -> '<button type="button">Get it</button>'
exposures; // -> []
```

<!-- #endregion observe-exposure -->

The server render ran no effect, so it recorded nothing. The browser runs `useEffect` when it mounts the button, and that is the exposure.

## React

`FeatureProvider` resolves a store once for a context and hands the decisions to every hook below it:

<!-- #region react-provider -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
// ---cut---
import { createFeatures } from '@evanion/feature';
import { FeatureProvider, useFeatureEnabled } from '@evanion/feature/react';
import { renderToStaticMarkup } from 'react-dom/server';

const features = createFeatures([{ key: 'express-pickup', enabled: true }]);
const context = {
  targetingKey: 'cust-0042',
  now: new Date('2026-11-01T00:00:00Z'),
};

function Checkout() {
  if (!useFeatureEnabled('express-pickup')) return <p>Standard checkout</p>;
  return <p>Checkout with express pickup</p>;
}

const html = renderToStaticMarkup(
  <FeatureProvider features={features} context={context}>
    <Checkout />
  </FeatureProvider>,
);

html; // -> '<p>Checkout with express pickup</p>'
```

<!-- #endregion react-provider -->

Resolution is memoised on the `context` object's identity, so a component that builds the context holds it in a `useMemo`:

<!-- #region react-memo -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
import { createFeatures } from '@evanion/feature';
import { FeatureProvider, useFeatureEnabled } from '@evanion/feature/react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const features = createFeatures([{ key: 'express-pickup', enabled: true }]);

function Checkout() {
  return <p>{useFeatureEnabled('express-pickup') ? 'Express' : 'Standard'}</p>;
}
// ---cut---
// The instant the server rendered at, so both sides read the same clock.
const now = new Date('2026-11-01T00:00:00Z');

function Flags({
  customerId,
  children,
}: {
  customerId: string;
  children: ReactNode;
}) {
  const context = useMemo(
    () => ({ targetingKey: customerId, now }),
    [customerId],
  );

  return (
    <FeatureProvider features={features} context={context}>
      {children}
    </FeatureProvider>
  );
}

const html = renderToStaticMarkup(
  <Flags customerId="cust-0042">
    <Checkout />
  </Flags>,
);

html; // -> '<p>Express</p>'
```

<!-- #endregion react-memo -->

`useFeature` and `useVariant` throw for a key the provider does not carry, so a typo never reads as a feature that is off. `isEnabled` on the store answers `false` for the same key:

<!-- #region react-strict-key -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
// ---cut---
import { createFeatures } from '@evanion/feature';
import { FeatureProvider, useFeature } from '@evanion/feature/react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const features = createFeatures([{ key: 'express-pickup', enabled: true }]);

function Misspelled() {
  return <p>{useFeature('express-delivery').reason}</p>;
}

const attempt = (element: ReactElement) => {
  try {
    return renderToStaticMarkup(element);
  } catch (error) {
    return String(error);
  }
};

const page = (
  <FeatureProvider features={features}>
    <Misspelled />
  </FeatureProvider>
);

attempt(page); // -> 'Error: feature "express-delivery" is not configured in this <FeatureProvider>'
// @ts-expect-error -- the store's keys are checked at compile time
features.isEnabled('express-delivery'); // -> false
```

<!-- #endregion react-strict-key -->

`decisions` hands the provider a record resolved elsewhere. The provider uses that record as it is and resolves nothing beside it, so a key missing from the record throws:

<!-- #region react-decisions -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
import { createFeatures } from '@evanion/feature';
import { FeatureProvider, useFeatureEnabled } from '@evanion/feature/react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const attempt = (element: ReactElement) => {
  try {
    return renderToStaticMarkup(element);
  } catch (error) {
    return String(error);
  }
};
// ---cut---
const features = createFeatures([
  { key: 'express-pickup', enabled: true },
  { key: 'gift-cards', enabled: true },
]);

function Checkout() {
  return <p>{useFeatureEnabled('express-pickup') ? 'Express' : 'Standard'}</p>;
}

const fromServer = features.resolve();
fromServer['express-pickup'] = {
  key: 'express-pickup',
  enabled: false,
  reason: 'explicitly-off',
};
// A snapshot shipped as JSON reaches the provider unchecked.
const snapshot = JSON.parse(
  JSON.stringify({ 'gift-cards': fromServer['gift-cards'] }),
);

const served = (
  <FeatureProvider features={features} decisions={fromServer}>
    <Checkout />
  </FeatureProvider>
);
const partial = (
  <FeatureProvider features={features} decisions={snapshot}>
    <Checkout />
  </FeatureProvider>
);

attempt(served); // -> '<p>Standard</p>'
attempt(partial); // -> 'Error: feature "express-pickup" is not configured in this <FeatureProvider>'
```

<!-- #endregion react-decisions -->

`createFeatureContext` binds the provider and hooks to one store's schema, so a misspelled key is a compile error and `useVariant` answers the variant union that store declares:

<!-- #region react-bound -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
// ---cut---
import { createFeatures } from '@evanion/feature';
import { createFeatureContext } from '@evanion/feature/react';
import { renderToStaticMarkup } from 'react-dom/server';

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

const { FeatureProvider, useVariant } = createFeatureContext(features);

function Cta() {
  const { value } = useVariant('checkout-cta');
  return <button type="button">{value?.label ?? 'Buy'}</button>;
}

function Misspelled() {
  // @ts-expect-error -- 'checkout-button' is not a key of this store
  return <p>{useVariant('checkout-button').variant}</p>;
}

const forCustomer = (targetingKey: string) =>
  renderToStaticMarkup(
    <FeatureProvider context={{ targetingKey }}>
      <Cta />
    </FeatureProvider>,
  );

forCustomer('cust-0199'); // -> '<button type="button">Get it</button>'
forCustomer('cust-0042'); // -> '<button type="button">Buy</button>'
```

<!-- #endregion react-bound -->

`FeatureProvider` uses `createContext` and `useMemo`, so it is client code. The core is not. Resolve in a Server Component and hand the decisions down. They are plain objects, so they cross the boundary as serialised props:

<!-- #region react-server -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
import { createFeatures } from '@evanion/feature';
import type { Decisions } from '@evanion/feature';
import { FeatureProvider, useFeatureEnabled } from '@evanion/feature/react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

function Checkout() {
  return <p>{useFeatureEnabled('express-pickup') ? 'Express' : 'Standard'}</p>;
}
// ---cut---
const features = createFeatures([
  {
    key: 'express-pickup',
    enabled: true,
    rules: [{ id: 'a-share', rollout: { percent: 25 } }],
  },
]);
type ShopDecisions = Decisions<{ 'express-pickup': never }>;

// app/flags.tsx, a client module ('use client')
function Flags({
  decisions,
  children,
}: {
  decisions: ShopDecisions;
  children: ReactNode;
}) {
  return (
    <FeatureProvider features={features} decisions={decisions}>
      {children}
    </FeatureProvider>
  );
}

// app/layout.tsx, a Server Component
function Layout({
  customerId,
  children,
}: {
  customerId: string;
  children: ReactNode;
}) {
  const decisions = features.resolve({ targetingKey: customerId });
  // Props crossing into a client module are serialised; JSON is the same test.
  const sent: ShopDecisions = JSON.parse(JSON.stringify(decisions));

  return <Flags decisions={sent}>{children}</Flags>;
}

const forCustomer = (customerId: string) =>
  renderToStaticMarkup(
    <Layout customerId={customerId}>
      <Checkout />
    </Layout>,
  );

forCustomer('cust-0042'); // -> '<p>Express</p>'
forCustomer('cust-0107'); // -> '<p>Standard</p>'
```

<!-- #endregion react-server -->

The full API reference and the guides are at [docs.evanion.com/feature](https://docs.evanion.com/feature).

## License

MIT
