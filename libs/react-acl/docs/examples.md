# @evanion/react-acl examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## The Solution: Policy-Driven Hooks

### Core Concept: Declarative UI Gating

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

## Important: Advisory vs. Authoritative (Security Contract)

<!-- #region edit-refused -->

```ts @import.meta.vitest
import { editListing } from '../examples/server';

const mika = { id: 'mika', role: 'bookseller' } as const;
const jo = { id: 'jo', role: 'owner' } as const;
const draft = {
  id: 'brass-birmingham',
  sellerId: 'mika',
  status: 'draft',
} as const;
const published = { ...draft, status: 'published' } as const;

editListing(mika, draft, 'Unpunched, still in shrink').status; // -> 200
editListing(jo, draft, 'Unpunched, still in shrink').status; // -> 403
editListing(mika, published, 'Unpunched, still in shrink').status; // -> 403
```

<!-- #endregion edit-refused -->

## Beyond the Basics

### Type-Safe Hooks with `createPolicyContext`

<!-- #region typed-context -->

```tsx @import.meta.vitest
type Shopper = { id: string; role: 'customer' | 'bookseller' | 'owner' };
type Listing = { id: string; sellerId: string; status: 'draft' | 'published' };

const shop = policy<Shopper, { listing: Listing }, { listing: 'edit' }>()
  .for('listing', (p) => p.allow('edit', p.eq('object.sellerId', 'subject.id')))
  .build();

const {
  PolicyProvider: ShopProvider,
  useCan: useShopCan,
  useCapabilities: useShopCapabilities,
} = createPolicyContext(shop);

function EditControl({ listing }: { listing: Listing }) {
  // useShopCan('lsiting', 'edit', listing) does not compile.
  const decision = useShopCan('listing', 'edit', listing);

  return decision.allowed ? <button type="button">Edit listing</button> : null;
}

function EditReason() {
  // useShopCapabilities()['listing.edti'] does not compile.
  return <i>{useShopCapabilities()['listing.edit'].reason}</i>;
}

const listing: Listing = {
  id: 'brass-birmingham',
  sellerId: 'mika',
  status: 'draft',
};

const html = renderToStaticMarkup(
  <ShopProvider subject={{ id: 'mika', role: 'bookseller' }}>
    <EditControl listing={listing} />
    <EditReason />
  </ShopProvider>,
);

html; // -> '<button type="button">Edit listing</button><i>unevaluable</i>'
```

<!-- #endregion typed-context -->
