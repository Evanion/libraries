# @evanion/react-feature

**Feature decisions for your React component tree, resolved once and read anywhere.**

To switch a single banner in a complex UI, you often have to prop-drill a flags object through ten layers of components. `@evanion/react-feature` solves this by publishing the decisions `@evanion/feature` has already resolved. Any component in the tree can ask "is this on, and which variant am I in?" without needing to know where the store or the evaluation context lives.

## The Problem: The "Flags Prop-Drill"

When a server resolves flags for a request, the component that actually needs a specific flag is often buried deep in the hierarchy. This creates two primary frictions:

1. **Prop-Drilling**: Components that do not use any flags are forced to carry the flags object simply because a distant child requires it.
2. **Two Answers Per Request**: If a component resolves a flag for itself, it reads its own clock. This means two components in a single render could land on opposite sides of a time window, causing the page to contradict itself.

## The Solution: One Resolution, Published

`@evanion/feature` resolves every configured feature in one call, and `features.snapshot` states that result as a `DecisionSet` containing the instant of resolution, one decision per key, and the config version wherever the store was built from a document that carries one.

`FeatureProvider` publishes that set to the React tree, allowing `useFeature`, `useFeatureEnabled`, `useVariant`, and `useFeatures` to read it. Because the decisions are already made, no hook evaluates anything during the render.

### Core Concept: The Server Resolves, The Tree Reads

Consider a game shop that splits shoppers between two different shelf-sorting methods. The server resolves the split for a specific shopper via `features.snapshot`, and `FeatureProvider` publishes that set. The `Shelf` component then simply reads its assigned variant. If Sam buckets into `popular` and Mika into `newest`, neither component has to perform the resolution logic themselves.

The following block runs in the package's test suite, where each `// ->` comment denotes the expression's value.

<!-- #region server-render -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
import type { ReactNode } from 'react';
// ---cut---
import { createFeatures } from '@evanion/feature';
import type { DecisionSet } from '@evanion/feature';
import { FeatureProvider, useVariant } from '@evanion/react-feature';
import { renderToStaticMarkup } from 'react-dom/server';

// Once per process, on the server and in the browser bundle alike.
const features = createFeatures([
  {
    key: 'shelf-sort',
    enabled: true,
    variants: [
      { name: 'newest', weight: 50 },
      { name: 'popular', weight: 50 },
    ],
  },
]);

type ShopDecisions = DecisionSet<{
  'shelf-sort': { variant: 'newest' | 'popular' };
}>;

// app/shelf.tsx, a client module ('use client')
function Shelf() {
  const { variant } = useVariant('shelf-sort');

  // A feature that resolved off carries no variant, so the shop's own order
  // answers that case and neither arm of the split does.
  if (variant === undefined) return <p>Shop order</p>;

  return <p>{variant === 'popular' ? 'Most played first' : 'Newest first'}</p>;
}

function ShopFlags({
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

// app/page.tsx, on the server, per request
const shelfFor = (shopperId: string) => {
  const decisions = features.snapshot({ targetingKey: shopperId });

  // The framework serialises this prop on its way into the client module.
  // React's flight serializer and Astro's `devalue` carry the `Date` a window
  // condition's `failed.value` can hold, and `JSON.stringify` by hand sends a
  // string in its place.
  return renderToStaticMarkup(
    <ShopFlags decisions={decisions}>
      <Shelf />
    </ShopFlags>,
  );
};

shelfFor('sam'); // -> '<p>Most played first</p>'
shelfFor('mika'); // -> '<p>Newest first</p>'
```

<!-- #endregion server-render -->

## Key Features

`@evanion/react-feature` provides the following capabilities:

- 🧩 **Zero Prop-Drilling**: Components name the key they care about and read the decision from the provider above them.
- 🕓 **One Instant Per Render**: A set a render resolved states the instant it was created. The provider reads that instant as the default for anything it resolves itself, ensuring no two components in one tree straddle a time window.
- ⚡ **Local Reads**: Hooks read decisions already held by the provider, so variant switches never wait on network requests.
- 🛠️ **Type-Safety**: `createFeatureContext(features)` returns a provider and hooks bound to one store's schema. Misspelled keys trigger compile errors, and variants are constrained to the union declared by the store.
- 🧬 **Divergence Reports**: When handed a shipped set, a provider compares the config version against the store. It names decisions it cannot reproduce via `onDivergence` and uses `onVersionMismatch` to choose between the shipped set and a local re-resolution.
- 📦 **Lightweight Footprint**: The package is ESM only and requires Node 20 or newer. Its only peer dependency is React 18 or 19, with `@evanion/feature` pinned as a dependency.

## Installation

Note: This package is not on npm yet. Because `package.json` carries `private: true`, `npm install @evanion/react-feature` does not resolve until the first version is published.

```bash
npm install @evanion/react-feature @evanion/feature
```

## Documentation

The `@evanion/react-feature` package does not have a dedicated section on the documentation site yet.

To see the package in action, you can explore the worked examples in [docs/examples.md](https://github.com/Evanion/libraries/blob/main/libs/react-feature/docs/examples.md).

Because the hooks in this package read a shared model, consisting of features, rules, variants, and decision sets, the underlying logic is documented within the core package:

👉 **[docs.evanion.com/feature](https://docs.evanion.com/feature/)**

## License

MIT
