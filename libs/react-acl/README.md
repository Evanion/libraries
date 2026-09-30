# React Authorization

The React binding for `@evanion/acl`. A provider and hooks over an
already-built access matrix, for both an RSC-style graph and a traditional Node
server/client split. Evaluation lives in the core; nothing here decides
anything.

## What a decision here means

Every decision these hooks return is a convenience, never an access control.
`@evanion/acl` in a browser exists to toggle what the user sees — show or hide a
button, enable or disable a field, render the read-only branch instead of the
editable one. Hiding a control hides the control, not the data behind it, and
not the request the control would have sent.

Real access control happens in a trusted environment: a React Router 8 or
Next.js server runtime, or the server side of an API boundary. `can` has the
same signature and the same return type in both places, and is authoritative in
one and advisory in the other. Nothing in the types tells them apart — the
runtime the call runs in is the whole difference.

Every app in the chain evaluates for itself and trusts no earlier layer. A
gateway or a BFF that already allowed the request does not excuse the service
behind it from deciding again, and a server-rendered page that hid the button
does not excuse the handler the button posts to. There is no transitive trust
and no "already checked upstream" exemption: a caller reaches the later layer
directly whenever it wants to, without passing the earlier one.

A matrix in a browser is a copy, as fresh as the fetch that delivered it. A
client evaluating a stale one keeps granting a permission the server has since
revoked, and the client has no way to know. Refetch on whatever cadence the
app's revocation story needs, and let the server's answer be the one that
counts. The core README's security contract covers the rest of what the
consumer owns.

## Installation

```bash
npm install @evanion/react-acl @evanion/acl
```

## Quick start

The server builds the rules with `@evanion/acl`'s `policy()` and renders
`ShopAccess`, a client component that hydrates `access.matrix` into a
`PolicyProvider`. `EditControl` under it asks `useCan` and draws its button
only for the seller who listed the listing:

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

`EditControl` takes no `access` prop and no shopper prop. The rule compares
`object.sellerId` with `subject.id`, so Mika, who listed the game, gets the
button and Jo gets an empty string.

The `// ---cut---` line is where the docs site starts showing the block: the
two components above it are the ones `examples/` holds.

## Hooks

- `useCan(key, action, object?)` — one decision. `object` is the instance,
  optional for the create case; an object-dependent rule with no instance yields
  an `unevaluable` decision.
- `useCanMany(key, action, objects)` — a decision array parallel to the input,
  for rendering a list without N `useCan` calls.
- `useCanFields(key, action, object, axis, proposed?)` — the field-level
  decision on the `read` or `write` axis.
- `useCapabilities()` — every action-level decision for the current subject (no
  object, so no object-dependent decisions).

## A policy written in TypeScript

The hooks above take the key as a string, which is what a matrix that crossed
JSON can offer. A policy authored with the core's `policy` builder knows its
keys and its row types, and `createPolicyContext` binds them to a provider and
the same four hooks:

```tsx
import { policy } from '@evanion/acl';
import { createPolicyContext } from '@evanion/react-acl';

type Shopper = { id: string; role: 'customer' | 'bookseller' };
type Listing = { id: string; sellerId: string };

const shop = policy<Shopper, { listing: Listing }, { listing: 'edit' }>()
  .for('listing', (p) => p.allow('edit', p.eq('object.sellerId', 'subject.id')))
  .build();

const { PolicyProvider, useCan } = createPolicyContext(shop);

function EditControl({ listing }: { listing: Listing }) {
  // 'lsiting' does not compile; the imported useCan would pass it through.
  return useCan('listing', 'edit', listing).allowed ? <EditButton /> : null;
}
```

Both types come off the argument, so the call site names neither. It is a
factory because `createContext` fixes its type where the context is made and
`useContext` hands a hook that fixed type whatever the provider above it was
given, so a generic provider has nowhere to put the binding.

Each call makes its own context, and the provider it returns feeds the shared
one too, so a component holding the imported `useCan` reads the same decision
underneath it.

## The clock

`context.now` takes any `Instant`: an ISO 8601 string, epoch milliseconds, or a
`Date`. Pass the string an SSR payload carries and leave it as it stands — the
hooks key their memo on `now`, so a string holds the memo across renders where
a `Date` is a new object every render and re-evaluates the matrix.

## License

MIT
