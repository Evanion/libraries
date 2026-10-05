# @evanion/feature

**Dependency-aware feature flags for precise, risk-free rollouts.**

Stop guessing if a user is seeing a feature they aren't actually eligible for. When your features have dependencies—where "Express Pickup" requires the "New Checkout" to be active—simple boolean flags aren't enough. `@evanion/feature` manages the complex graph of feature dependencies, ensuring that no feature is ever enabled without its prerequisites.

## The Problem: The "Broken Dependency" Bug

In complex apps, features rarely exist in isolation. You might have a "Premium Dashboard" that depends on a "Subscription Engine," which in turn depends on a "User Profile" update. 

When you use simple flags, you end up with "if-statement soup":
```tsx
if (flags.isPremium && flags.hasProfile && flags.subscriptionActive) {
  return <PremiumDashboard />;
}
```

This is fragile. If you turn off the "Subscription Engine" for a maintenance window, you have to remember to manually toggle every single dependent feature, or you'll ship a broken experience to your users.

## The Solution: Cascading Feature Dependencies

`@evanion/feature` allows you to define a dependency graph. If a parent feature is disabled, all of its dependents are automatically disabled—transitively and instantly.

### Core Concept: The Dependency Cascade

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'new-checkout',
    enabled: true,
    rules: [{ id: 'beta', when: [{ field: 'role', op: 'eq', value: 'beta-tester' }] }],
  },
  { 
    key: 'express-pickup', 
    enabled: true, 
    dependsOn: ['new-checkout'] 
  },
]);

// A beta tester gets the new checkout AND the express pickup
const betaUser = { role: 'beta-tester' };
features.isEnabled('express-pickup', betaUser); // -> true

// A regular user is denied the checkout, so they are automatically denied pickup
const regularUser = { role: 'customer' };
features.isEnabled('express-pickup', regularUser); // -> false
```

## Key Features

- 📉 **Transitive Dependencies**: Define complex graphs. If A depends on B, and B depends on C, turning off C disables both B and A.
- 🎲 **Deterministic Rollouts**: Use hash-based bucketing to ensure a user's experience is stable across sessions and services.
- 🌈 **Weighted Variants**: Split your users across different versions of a feature (A/B testing) with relative weights.
- ⏰ **Temporal Boundaries**: Gate features behind ISO 8601 time windows (e.g., "Enable this on Jan 1st at 00:00 UTC").
- 🎯 **Contextual Targeting**: Resolve features based on any context field (roles, regions, plan levels).
- 🪶 **Framework-Agnostic Core**: Use the same logic in your API, your build scripts, or via the `@evanion/feature/react` provider.

## Installation

```bash
npm install @evanion/feature
```

## Beyond the Basics

Managing a feature's lifecycle from "internal beta" to "100% rollout" requires more than a boolean. Our documentation covers advanced rollout strategies:

- **The `plan()` API**: Partition your rules to determine which features can be resolved at build-time and which must be deferred to the request.
- **Variant Pinning**: Override weights for specific users (e.g., pinning a QA engineer to the "blue" variant).
- **Sticky Assignments**: Ensure users don't jump between variants if you change the weights.
- **Observability**: Using the `observe` callback to audit exactly which features were resolved for a request.

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/feature](https://docs.evanion.com/feature)**

## License
MIT
