# @evanion/feature

**Dependency-aware feature flags for precise rollouts.**

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

`@evanion/feature` allows you to define a dependency graph. If a parent feature resolves off, all of its dependents resolve off with it, transitively, on the same call.

### Core Concept: The Dependency Cascade

To see this in action, consider a scenario where express pickup depends on the new checkout, but only booksellers get the new checkout. Because a customer is refused the checkout, they are also refused pickup. The following block runs in the package's test suite; each `// ->` comment shows the value of the expression on its line.

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

## Key Features

- 📉 **Transitive Dependencies**: Define complex graphs. If A depends on B, and B depends on C, turning off C disables both B and A.
- 🎲 **Deterministic Rollouts**: Use hash-based bucketing to ensure a user's experience is stable across sessions and services.
- 🌈 **Weighted Variants**: Split your users across different versions of a feature (A/B testing) with relative weights.
- ⏰ **Temporal Boundaries**: Gate features behind ISO 8601 time windows (e.g., "Enable this on Jan 1st at 00:00 UTC").
- 🎯 **Contextual Targeting**: Resolve features based on any context field (roles, regions, plan levels).
- 🪶 **Framework-Agnostic Core**: Use the same logic in your API, your build scripts, or via the `@evanion/feature/react` provider.
- 📦 **Compatibility**: The package is ESM only and needs Node 20 or newer. The core has no dependencies and imports no framework; `@evanion/feature/react` needs React 18 or 19, an optional peer dependency.

## Installation

Note: This package is not on npm yet. Because `package.json` carries `private: true`, `npm install @evanion/feature` does not resolve until the first version is published.

```bash
npm install @evanion/feature
```

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/feature](https://docs.evanion.com/feature/)**

## License

MIT
