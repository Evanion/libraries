# @evanion/react-acl

**Context-aware authorization hooks for your React component tree.**

Stop prop-drilling authorization decisions through ten layers of components just to hide a single button. `@evanion/react-acl` provides a set of hooks that allow any component in your tree to ask, "Can the current user perform this action on this object?" without needing to know where the user or the policy lives.

## The Problem: The "Authorization Prop-Drill"

In most React apps, authorization is handled by passing a `user` object or a `permissions` array down from the root. This leads to:

1. **Prop-Drilling**: Passing authorization data through components that don't need it, just to reach a leaf component that does.
2. **Fragile UI Logic**: Spreading `if (user.role === 'admin')` checks throughout your JSX, making it nearly impossible to change your permission model without editing every single component.

## The Solution: Policy-Driven Hooks

`@evanion/react-acl` brings the power of `@evanion/acl`'s serializable matrices directly into your React components. Instead of checking roles, you check **capabilities**.

You wrap your app (or a sub-tree) in a `PolicyProvider`, and any child component can then use the `useCan` hook to make a decision.

### Core Concept: Declarative UI Gating

To define access on the server, `policy()` from `@evanion/acl` builds the rules, and `ShopAccess` hydrates `access.matrix` into a `PolicyProvider`. `EditControl` uses `useCan` to render its button only for the seller who listed the listing; Mika sees the button while Jo sees an empty string. This block runs in the package's test suite with imports from `react`, `react-dom/server`, `@evanion/acl` and `@evanion/react-acl`, where each `// ->` comment denotes the expression's value.

<!-- #region server-render -->

```tsx @import.meta.vitest
import type { ReactNode } from 'react';
import type { Matrix } from '@evanion/acl';

type Shopper = { id: string; role: 'customer' | 'bookseller' | 'owner' };
type Listing = { id: string; sellerId: string; status: 'draft' | 'published' };

// ShopAccess is examples/mount.tsx, and EditControl is examples/decision.tsx.
function ShopAccess({
  matrix,
  shopper,
  now,
  children,
}: {
  matrix: Matrix;
  shopper: Shopper;
  now: string;
  children: ReactNode;
}) {
  const access = useMemo(() => hydratePolicy(matrix), [matrix]);
  const context = useMemo(() => ({ now }), [now]);

  return (
    <PolicyProvider access={access} subject={shopper} context={context}>
      {children}
    </PolicyProvider>
  );
}

function EditControl({ listing }: { listing: Listing }) {
  const decision = useCan('listing', 'edit', listing);

  if (!decision.allowed) return null;

  return <button type="button">Edit listing</button>;
}
// ---cut---
// On the server, once per process: the seller who listed a listing edits it.
const access = policy<Shopper, { listing: Listing }, { listing: 'edit' }>()
  .for('listing', (p) => p.allow('edit', p.eq('object.sellerId', 'subject.id')))
  .build();

const listing: Listing = {
  id: 'brass-birmingham',
  sellerId: 'mika',
  status: 'draft',
};

// On the server, per request. In production `now` is
// new Date().toISOString(), read once for the whole render.
const renderFor = (shopper: Shopper) =>
  renderToStaticMarkup(
    <ShopAccess
      matrix={access.matrix}
      shopper={shopper}
      now="2026-09-25T09:00:00.000Z"
    >
      <EditControl listing={listing} />
    </ShopAccess>,
  );

const mika: Shopper = { id: 'mika', role: 'bookseller' };
const jo: Shopper = { id: 'jo', role: 'owner' };

renderFor(mika); // -> '<button type="button">Edit listing</button>'
renderFor(jo); // -> ''
```

<!-- #endregion server-render -->

## Key Features

- 🧩 **Zero Prop-Drilling**: Components ask for what they need, when they need it.
- 🎯 **Decoupled Logic**: The component doesn't know _why_ it's allowed (e.g., because it's an admin or the owner); it only knows _if_ it's allowed.
- ⚡ **Local Decisions**: Every decision is evaluated in memory against the matrix the provider holds, so a UI toggle never waits on a network request.
- 🛠️ **Type-Safe**: When used with `createPolicyContext`, your permission keys and object types are checked at compile time.
- 📦 **Lightweight**: React 18 or 19 is the only peer dependency, and `@evanion/acl` is pinned as a dependency. The package is ESM only and needs Node 20 or newer.

## Installation

```bash
npm install @evanion/react-acl @evanion/acl
```

## Security Contract

A decision these hooks return is advisory: it changes what the user sees and protects nothing behind it. Before any write or sensitive read, your server must make the same check with `@evanion/acl`, and every layer decides for itself. The matrix in the browser is as fresh as the fetch that delivered it, so a revoked permission keeps granting there until a new matrix replaces it. The full security contract is in [SECURITY.md](https://github.com/Evanion/libraries/blob/main/libs/acl/SECURITY.md) and on the [security page](https://docs.evanion.com/acl/security/).

## Documentation

For the full API reference and integration guides, visit our documentation site:

👉 **[docs.evanion.com/react-acl](https://docs.evanion.com/react-acl/)**

## License

MIT
