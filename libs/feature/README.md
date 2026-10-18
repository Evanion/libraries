# @evanion/feature

**Define your feature flags in a plain document you own and evaluate them across your Node.js API, build scripts, and the browser using a single library.**

With `@evanion/feature`, you treat your flags as a shared source of truth for your entire stack. A static build can resolve global flags during compilation, while a Node.js API or browser client resolves user-specific flags at request time—all using the same evaluation logic.

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

## Capabilities of @evanion/feature

The `@evanion/feature` package replaces fragile "if-statement soup" with a cascading dependency graph and environment-agnostic evaluation.

- **Unified Evaluation**: Use one library across APIs, build scripts, and the browser to ensure a single source of truth.
- **Transitive Dependencies**: Define complex graphs. If A depends on B, and B depends on C, turning off C disables both B and A.
- **Deterministic Rollouts**: Use hash-based bucketing to ensure a user's experience is stable across sessions and services.
- **Weighted Variants**: Split your users across different versions of a feature (A/B testing) with relative weights.
- **Temporal Boundaries**: Gate features behind ISO 8601 time windows (e.g., "Enable this on Jan 1st at 00:00 UTC").
- **Contextual Targeting**: Resolve features based on any context field (roles, regions, plan levels).
- **Framework-Agnostic Core**: The core imports no framework, allowing use across APIs, build scripts, or CLIs. React bindings are available separately via `@evanion/react-feature`.
- **Compatibility**: This is an ESM-only package requiring Node 20 or newer. It has no dependencies and no peer dependencies.

## Installation

Note: This package is not on npm yet. Because `package.json` carries `private: true`, `npm install @evanion/feature` does not resolve until the first version is published.

```bash
npm install @evanion/feature
```

## Documentation

For the full API reference and worked examples, visit the documentation site:

👉 **[libs.evanion.com/docs/feature](https://libs.evanion.com/docs/feature/)**

If you need to integrate these features into a user interface, you can use the React binding provided by `@evanion/react-feature`. While the core `@evanion/feature` package provides the logic, `@evanion/react-feature` adds the `'use client'` directive, the necessary provider, and hooks that allow React components to read a store.

👉 **[libs.evanion.com/docs/react-feature](https://libs.evanion.com/docs/react-feature/)**

## License

MIT
