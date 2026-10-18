# @evanion/react-acl

**Context-aware authorization hooks for your React component tree.**

Stop prop-drilling authorization decisions through ten layers of components just to hide a single button. `@evanion/react-acl` lets any component ask, "Can the current user perform this action on this object?" without needing to know where the user or the policy lives.

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

## Capabilities of @evanion/react-acl

The package moves authorization from fragile UI logic—like spreading `if (user.role === 'admin')` checks through your JSX—to a declarative, policy-driven model using capabilities.

- **Zero Prop-Drilling**: Components ask for what they need, when they need it, via the `useCan` hook.
- **Decoupled Logic**: A component only knows _if_ it is allowed to act, not _why_ (e.g., whether it is because of a specific role or ownership).
- **Local Decisions**: Decisions are evaluated in memory against the provider's matrix, so UI toggles do not wait on network requests.
- **Type-Safety**: Use `createPolicyContext` to ensure permission keys and object types are checked at compile time.

## Installation

`@evanion/react-acl` is ESM only and requires Node 20 or newer. It requires React 18 or 19 as a peer dependency and includes `@evanion/acl` as a dependency.

```bash
npm install @evanion/react-acl @evanion/acl
```

## Security Contract

A decision returned by these hooks is advisory; it changes the UI but protects nothing. Your server must perform the same check using `@evanion/acl` before any sensitive read or write. Because the matrix in the browser is only as fresh as the fetch that delivered it, a revoked permission remains active until the matrix is replaced.

The full security contract is in [SECURITY.md](https://github.com/Evanion/libraries/blob/main/libs/acl/SECURITY.md) and on the [security page](https://docs.evanion.com/acl/security/).

## Documentation

For the full API reference and integration guides, visit:

👉 **[docs.evanion.com/react-acl](https://docs.evanion.com/react-acl/)**

## License

MIT
