# @evanion/feature examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## The cascade

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

## Rolling Out by Date and Share

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

## Writing Definitions

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

## Shipping a Snapshot to the Client

To share feature decisions from your server to the browser, you can generate a state object using `features.snapshot`. The set states the configuration version and the instant beside the decisions, so a client that reads it knows what produced them.

When a request arrives on the server, you create a snapshot by providing the subject's targeting key and the instant to resolve at. `snapshot` reads its own clock when the caller names no instant. The set holds one decision per configured feature, and a serializer sends it to the client.

<!-- #region snapshot -->

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

// On the server, inside the request that renders the page.
const set = features.snapshot({
  targetingKey: 'cust-0042',
  now: new Date('2026-11-01T09:00:00Z'),
});

set.now; // -> '2026-11-01T09:00:00.000Z'
set.origin; // -> 'render'
set.decisions['checkout-cta'].variant; // -> 'control'
```

<!-- #endregion snapshot -->

## Rollouts

<!-- #region rollout -->

```ts @import.meta.vitest
import { inRollout } from '@evanion/feature';

inRollout('cust-0101', 10, 'new-checkout'); // -> true
inRollout('cust-0042', 10, 'new-checkout'); // -> false
```

<!-- #endregion rollout -->

<!-- #region bucket-stable -->

```ts @import.meta.vitest
import { bucketOf, inRollout } from '@evanion/feature';

bucketOf('cust-0101', 'new-checkout'); // -> 0.04385687271133065
inRollout('cust-0101', 25, 'new-checkout'); // -> true
inRollout('cust-0007', 25, 'new-checkout'); // -> false
```

<!-- #endregion bucket-stable -->

<!-- #region bucket-decorrelated -->

```ts @import.meta.vitest
import { bucketOf } from '@evanion/feature';

bucketOf('cust-0007', 'new-checkout'); // -> 0.912969104712829
bucketOf('cust-0007', 'express-pickup'); // -> 0.007160091772675514
```

<!-- #endregion bucket-decorrelated -->

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

<!-- #region primitives -->

```ts @import.meta.vitest
import { bucketOf, inRollout } from '@evanion/feature';

const customers = ['cust-0007', 'cust-0042', 'cust-0101', 'cust-0113'];

customers.filter((id) => inRollout(id, 10, 'new-checkout')); // -> ['cust-0101', 'cust-0113']
bucketOf('cust-0113', 'new-checkout'); // -> 0.03226795047521591
```

<!-- #endregion primitives -->

## Variants

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

## React

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

## Distribution

<!-- #region config-document -->

```ts @import.meta.vitest
import { createFeatures, serializeConfig } from '@evanion/feature';

const features = createFeatures([
  { key: 'new-checkout', enabled: true },
  { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
]);

const document = serializeConfig(features, {
  version: '2026-10-08.1',
  maxStale: 60_000,
});

document.version; // -> '2026-10-08.1'
document.maxStale; // -> 60000
document.features.length; // -> 2
document.digest; // -> undefined
```

<!-- #endregion config-document -->

<!-- #region config-document-rules -->

```ts @import.meta.vitest
import { createFeatures, serializeConfig } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'new-checkout',
    enabled: true,
    rules: [
      {
        id: 'after-launch',
        when: [
          {
            field: 'now',
            op: 'after',
            value: new Date('2026-10-01T00:00:00.000Z'),
          },
        ],
      },
    ],
  },
]);

const document = serializeConfig(features);

document.features[0]?.rules?.[0]?.when?.[0]; // -> { field: 'now', op: 'after', value: '2026-10-01T00:00:00.000Z' }
```

<!-- #endregion config-document-rules -->

<!-- #region config-digest -->

```ts @import.meta.vitest
import {
  configDigest,
  createFeatures,
  serializeConfig,
} from '@evanion/feature';

const features = createFeatures([{ key: 'new-checkout', enabled: true }]);
const document = serializeConfig(features, { version: 41 });

const digest = configDigest(document);
digest.length; // -> 32

// `version` is outside the text, so a relabelled document digests the same.
configDigest({ ...document, version: 42 }) === digest; // -> true

// Every other member is inside it.
configDigest({ ...document, maxStale: 60_000 }) === digest; // -> false
```

<!-- #endregion config-digest -->

<!-- #region config-digest-hop -->

```ts @import.meta.vitest
import {
  configDigest,
  createFeatures,
  serializeConfig,
} from '@evanion/feature';
import type { FeatureConfig } from '@evanion/feature';

const features = createFeatures([{ key: 'new-checkout', enabled: true }]);
const document = serializeConfig(features, { version: 41 });

const arrived = JSON.parse(JSON.stringify(document)) as FeatureConfig;

configDigest(arrived) === configDigest(document); // -> true
```

<!-- #endregion config-digest-hop -->

<!-- #region config-validate -->

```ts @import.meta.vitest
import { validateConfig } from '@evanion/feature';
import type { FeatureConfig } from '@evanion/feature';

const candidate: FeatureConfig = {
  version: 42,
  features: [
    { key: 'new-checkout', enabled: true },
    { key: 'new-checkout', enabled: true },
    { key: 'express-pickup', enabled: true, dependsOn: ['nowhere'] },
  ],
};

const found = validateConfig(candidate);

found.ok; // -> false
found.ok ? [] : found.issues.map((issue) => issue.code); // -> ['duplicate-feature', 'unknown-dependency']
found.ok ? [] : found.issues.map((issue) => issue.key); // -> ['new-checkout', 'express-pickup']
```

<!-- #endregion config-validate -->

<!-- #region config-install -->

```ts @import.meta.vitest
import { parseFeatureConfig } from '@evanion/feature';
import type { FeatureConfig } from '@evanion/feature';

const served: FeatureConfig = {
  version: '2026-10-08.1',
  features: [
    { key: 'new-checkout', enabled: true },
    { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  ],
};

const installed = parseFeatureConfig(served);

installed.ok; // -> true
installed.ok && installed.features.version; // -> '2026-10-08.1'
installed.ok && installed.features.isEnabled('express-pickup'); // -> true
```

<!-- #endregion config-install -->

<!-- #region config-install-refused -->

```ts @import.meta.vitest
import { parseFeatureConfig } from '@evanion/feature';
import type { FeatureConfig } from '@evanion/feature';

const served: FeatureConfig = {
  version: '2026-10-08.2',
  features: [
    { key: 'new-checkout', enabled: true },
    { key: 'express-pickup', enabled: true, dependsOn: ['nowhere'] },
  ],
};

const installed = parseFeatureConfig(served);

installed.ok; // -> false
installed.ok ? [] : installed.issues.map((issue) => issue.code); // -> ['unknown-dependency']
```

<!-- #endregion config-install-refused -->

<!-- #region config-envelope -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures({
  version: 'flags@41',
  schemaVersion: '2026-10-01',
  maxStale: 60_000,
  features: [
    { key: 'new-checkout', enabled: true },
    { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  ],
});

features.version; // -> 'flags@41'
features.envelope.schemaVersion; // -> '2026-10-01'
features.envelope.maxStale; // -> 60000
features.isEnabled('express-pickup'); // -> true
```

<!-- #endregion config-envelope -->

<!-- #region config-reload -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures({
  version: 41,
  features: [
    { key: 'new-checkout', enabled: true },
    { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  ],
});

const installed = features.reload({
  version: 42,
  features: [
    { key: 'new-checkout', enabled: true },
    { key: 'express-pickup', enabled: false, dependsOn: ['new-checkout'] },
  ],
});

installed; // -> { ok: true, version: 42, previousVersion: 41, changed: ['express-pickup'] }
features.isEnabled('express-pickup'); // -> false
```

<!-- #endregion config-reload -->

<!-- #region config-reload-refused -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures({
  version: 41,
  features: [{ key: 'new-checkout', enabled: true }],
});

const refused = features.reload({
  version: 42,
  features: [
    { key: 'new-checkout', enabled: true },
    { key: 'new-checkout', enabled: false },
  ],
});

refused.ok; // -> false
refused.ok ? undefined : refused.rejected; // -> 42
features.version; // -> 41
features.isEnabled('new-checkout'); // -> true
```

<!-- #endregion config-reload-refused -->

<!-- #region config-reload-toggle -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures({
  version: 41,
  features: [{ key: 'new-checkout', enabled: true }],
});

features.toggle('new-checkout', false);
features.isEnabled('new-checkout'); // -> false

features.reload({
  version: 42,
  features: [{ key: 'new-checkout', enabled: true }],
});

features.isEnabled('new-checkout'); // -> true
```

<!-- #endregion config-reload-toggle -->

<!-- #region config-schema -->

```ts @import.meta.vitest
import { validateConfig } from '@evanion/feature';
import type { FeatureConfig } from '@evanion/feature';

const typed: FeatureConfig = {
  schemaVersion: '2026-10-01',
  schema: {
    context: { fields: { role: 'string', tier: 'string?' } },
    features: {
      'checkout-cta': {
        variants: {
          control: {
            type: 'object',
            properties: { label: { type: 'string' } },
          },
        },
      },
    },
  },
  features: [
    {
      key: 'checkout-cta',
      enabled: true,
      variantBy: 'targetingKey',
      variantSeed: 'checkout-cta:variant',
      variants: [
        { name: 'control', weight: 100, order: 0, value: { label: 'Buy' } },
      ],
      rules: [
        {
          id: 'booksellers',
          when: [{ field: 'role', op: 'eq', value: 'bookseller' }],
        },
      ],
    },
  ],
};

validateConfig(typed); // -> { ok: true }
```

<!-- #endregion config-schema -->

<!-- #region config-schema-refused -->

```ts @import.meta.vitest
import { validateConfig } from '@evanion/feature';
import type { FeatureConfig } from '@evanion/feature';

const unversioned: FeatureConfig = {
  schema: { context: { fields: { role: 'string' } } },
  features: [{ key: 'new-checkout', enabled: true }],
};

const unfenced: FeatureConfig = {
  schemaVersion: '2026-10-01',
  schema: {
    features: {
      'checkout-cta': {
        variants: { control: { anyOf: [{ type: 'string' }] } },
      },
    },
  },
  features: [{ key: 'new-checkout', enabled: true }],
};

const codes = (config: FeatureConfig) => {
  const found = validateConfig(config);
  return found.ok ? [] : found.issues.map((issue) => issue.code);
};

codes(unversioned); // -> ['missing-schema-version']
codes(unfenced); // -> ['unfenced-schema']
```

<!-- #endregion config-schema-refused -->

<!-- #region config-unknown-field -->

```ts @import.meta.vitest
import { validateConfig } from '@evanion/feature';
import type { FeatureConfig } from '@evanion/feature';

const candidate: FeatureConfig = {
  schemaVersion: '2026-10-01',
  schema: { context: { fields: { role: 'string' } } },
  features: [
    {
      key: 'new-checkout',
      enabled: true,
      rules: [
        { id: 'tiers', when: [{ field: 'tier', op: 'eq', value: 'gold' }] },
      ],
    },
  ],
};

const found = validateConfig(candidate);

found.ok ? [] : found.issues.map((issue) => issue.code); // -> ['unknown-context-field']
```

<!-- #endregion config-unknown-field -->

<!-- #region config-unknown-member -->

```ts @import.meta.vitest
import { validateConfig } from '@evanion/feature';
import type { FeatureConfig } from '@evanion/feature';

// A control plane one release ahead of this holder.
const candidate = {
  features: [{ key: 'new-checkout', enabled: true, notBefore: '2026-11-01' }],
} as unknown as FeatureConfig;

const found = validateConfig(candidate);

found.ok ? [] : found.issues.map((issue) => issue.code); // -> ['unknown-member']
found.ok ? [] : found.issues.map((issue) => issue.path); // -> ['/features/0/notBefore']
```

<!-- #endregion config-unknown-member -->

<!-- #region config-digest-verified -->

```ts @import.meta.vitest
import {
  configDigest,
  createFeatures,
  serializeConfig,
  validateConfig,
} from '@evanion/feature';

const features = createFeatures([{ key: 'new-checkout', enabled: true }]);
const document = serializeConfig(features, { version: 41 });

const published = { ...document, digest: configDigest(document) };

validateConfig(published); // -> { ok: true }

const edited = { ...published, maxStale: 60_000 };
const found = validateConfig(edited);

found.ok ? [] : found.issues.map((issue) => issue.code); // -> ['digest-mismatch']
```

<!-- #endregion config-digest-verified -->
