# @evanion/react-feature

**Feature decisions for your React component tree, resolved once and read anywhere.**

To switch a single banner in a complex UI, you often have to prop-drill a flags object through ten layers of components. `@evanion/react-feature` solves this by publishing the decisions `@evanion/feature` has already resolved, allowing any component to ask "is this on, and which variant am I in?" without needing to know where the store or evaluation context lives.

<!-- #region server-render -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
// ---cut---
import { createFeatures } from '@evanion/feature';
import type { DecisionSet } from '@evanion/feature';
import { FeatureProvider, useVariant } from '@evanion/react-feature';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// app/features.ts, imported by the server and by the client bundle. A store
// carries functions, so it reaches a client module as an import and never as a
// prop.
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

// app/flags.tsx, a client module ('use client')
function ShopFlags({
  shopperId,
  decisions,
  children,
}: {
  shopperId: string;
  decisions: ShopDecisions;
  children: ReactNode;
}) {
  // The provider re-resolves the shipped set to check it, so it needs the
  // field the server bucketed on. A provider mounted without `targetingKey`
  // publishes the shipped variant and reports it as one it cannot reproduce.
  // `useMemo` holds the object across renders, which the provider's own memo
  // reads as the same context.
  const context = useMemo(() => ({ targetingKey: shopperId }), [shopperId]);

  return (
    <FeatureProvider
      features={features}
      context={context}
      decisions={decisions}
    >
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
    <ShopFlags shopperId={shopperId} decisions={decisions}>
      <Shelf />
    </ShopFlags>,
  );
};

shelfFor('sam'); // -> '<p>Most played first</p>'
shelfFor('mika'); // -> '<p>Newest first</p>'
```

<!-- #endregion server-render -->

## Capabilities

`@evanion/react-feature` provides the following capabilities:

- **Zero Prop-Drilling**: Components name the key they care about and read the decision from the provider above them.
- **One Instant Per Render**: A set a render resolved states the instant it was created. The provider reads that instant as the default for anything it resolves itself, ensuring no two components in one tree straddle a time window.
- **Local Reads**: Hooks read decisions already held by the provider, so variant switches never wait on network requests.
- **Type-Safety**: `createFeatureContext(features)` returns a provider and hooks bound to one store's schema. Misspelled keys trigger compile errors, and variants are constrained to the union declared by the store.
- **Divergence Reports**: When handed a shipped set, a provider compares the config version against the store. It names decisions it cannot reproduce via `onDivergence`. Where the set and the store each carry a config version and the two differ, `onVersionMismatch` decides whether the tree renders the shipped set or a local re-resolution. A store built from a bare definitions array carries no version, so a provider over one reports `unversioned` and keeps the shipped set whatever `onVersionMismatch` asks for. Build both sides from a document that carries a version to make the choice available.
- **Lightweight Footprint**: The package is ESM only and requires Node 20 or newer. Its only peer dependency is React 18 or 19, with `@evanion/feature` pinned as a dependency.

## Installation

Note: This package is not on npm yet. Because `package.json` carries `private: true`, `npm install @evanion/react-feature` does not resolve until the first version is published.

```bash
npm install @evanion/react-feature @evanion/feature
```

## Documentation

To master the implementation and explore worked examples, visit the full documentation site:

👉 **[docs.evanion.com/react-feature](https://docs.evanion.com/react-feature/)**

The `@evanion/react-feature` hooks operate by reading a shared model of features, rules, variants, and decision sets. Because this model is defined in the core package, its detailed documentation is located here:

👉 **[docs.evanion.com/feature](https://docs.evanion.com/feature/)**

## License

MIT
