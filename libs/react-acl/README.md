# @evanion/react-acl

**Context-aware authorization hooks for your React component tree.**

Stop prop-drilling authorization decisions through ten layers of components just to hide a single button. `@evanion/react-acl` provides a provider and a set of hooks that allow any component in your tree to ask, "Can the current user perform this action on this object?" without needing to know where the user or the policy lives.

## The Problem: The "Authorization Prop-Drill"

In most React apps, authorization is handled by passing a `user` object or a `permissions` array down from the root. This leads to:

1. **Prop-Drilling**: Passing authorization data through components that don't need it, just to reach a leaf component that does.
2. **Fragile UI Logic**: Spreading `if (user.role === 'admin')` checks throughout your JSX, making it nearly impossible to change your permission model without editing every single component.
3. **Split Answers**: Two components that each read the user and the clock for themselves can answer the same question two ways on one screen, for example either side of a discount that ends at 18:00.

## The Solution: Policy-Driven Hooks

`@evanion/react-acl` brings `@evanion/acl`'s serializable matrices directly into your React components. A component asks whether the current user may take an action on an object, and the policy decides. The binding decides nothing itself: every hook calls the `@evanion/acl` evaluator you hand the provider, and returns the decision that evaluator returns.

You wrap your app (or a sub-tree) in a `PolicyProvider`, and any child component can then use the `useCan` hook to make a decision. The provider holds one evaluator, one subject and one instant for the whole tree under it, so every component on the screen reads the same rules at the same time.

### Core Concept: Declarative UI Gating

In the example below, the server builds the rules with `@evanion/acl`'s `policy()` and renders `ShopAccess`, a client component that hydrates `access.matrix` into a `PolicyProvider`. `EditControl` asks `useCan` and draws its button only for the seller who listed the listing:

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

`EditControl` takes no `access` prop and no shopper prop. The rule compares `object.sellerId` with `subject.id`, so Mika, who listed the game, gets the button and Jo gets an empty string. The docs site shows the block from the `// ---cut---` line down, and the two components above it live in [`examples/`](./examples).

### Why this is better:

- 🧩 **Zero Prop-Drilling**: Components ask for what they need, when they need it.
- 🎯 **Decoupled Logic**: The component doesn't know _why_ it's allowed (e.g., because the user is the seller who listed it); it only knows _if_ it's allowed. Gate on `allowed` alone: a component that branches on `reason` is writing a rule of its own.
- ⚡ **Local Decisions**: Every decision is evaluated in memory against the matrix the provider holds, and each hook memoises its answer, so a UI toggle never waits on a network request.
- 🛠️ **Type-Safe**: When used with `createPolicyContext`, your object kinds and actions are checked at compile time.

## Installation

```bash
npm install @evanion/react-acl @evanion/acl
```

React 18 or 19 is the only peer dependency. The package needs Node 20 or newer and ships ESM only, with no CommonJS build.

## Important: Advisory vs. Authoritative (Security Contract)

It is critical to remember that **browser-side authorization is advisory**. A decision these hooks return toggles what the user sees: show or hide a button, enable or disable a field, render the read-only branch instead of the editable one.

Hiding a button in React does not protect the data behind it. A user can always trigger the API request manually. Therefore, while `@evanion/react-acl` is perfect for a polished UI, you **must** perform the same check on your server using `@evanion/acl` before executing any write or sensitive read. `access.can` has the same signature and the same return type in both places, so nothing in the types tells the authoritative call from the advisory one. The runtime the call runs in is the whole difference.

[`examples/server.tsx`](./examples/server.tsx) builds the same rules on the server, adds a deny rule for a published listing, and exports `editListing`, the handler the Edit button posts to. The handler asks `access.can` for itself, so it refuses a write whatever the browser drew:

<!-- #region edit-refused -->

```ts @import.meta.vitest
import { editListing } from './examples/server';

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

Two more rules complete the contract:

- **No transitive trust**: Every layer evaluates for itself and trusts no earlier one. A gateway that already allowed the request does not excuse the service behind it, and a server-rendered page that hid the button does not excuse the handler the button posts to, because a caller can reach the later layer directly.
- **A stale copy keeps granting**: The matrix in the browser is as fresh as the fetch that delivered it, so a permission the server revokes keeps granting in the browser until a new matrix replaces it. Refetch on the cadence your revocations need. A matrix sent with `maxStale` and hydrated with `hydratePolicy(matrix, { fetchedAt })` answers `allowed: false` with `reason: 'stale-contract'` once the provider's `context.now` passes `fetchedAt + maxStale`. A `now` fixed at the server's render instant never passes it, so only a refetch replaces that copy. `maxStale` matters to a client that keeps deciding between fetches, and that client passes a `now` from its own clock, which then also decides every time window in the policy. `fetchedAt` on a matrix with no `maxStale` throws `MissingFreshnessBudgetError`.

This follows the core [security contract](https://docs.evanion.com/acl/security) defined in the main `@evanion/acl` package.

## Beyond the Basics

Each hook calls the `@evanion/acl` method of the same shape with the provider's subject and instant, and throws when no `PolicyProvider` sits above it:

- **`useCan(key, action, object?)`**: One decision. `object` is optional for the create case. Without one, a permission whose rule reads the object answers `unevaluable` unless a rule that reads only the subject decides it.
- **`useCanMany(key, action, objects)`**: Efficiently evaluate permissions for a list of objects (e.g., a data table) without triggering N separate hook calls. The decision array is parallel to the input.
- **`useCanFields(key, action, object, axis, proposed?)`**: Control exactly which fields a user can see in a form (the `'read'` axis) or set (the `'write'` axis).
- **`useCapabilities()`**: Get every action-level decision for the current user, keyed by permission key such as `'listing.edit'`, to build dynamic navigation menus. It passes no object, so a permission whose rule reads the object answers `unevaluable` unless a rule that reads only the subject decides it.

### Type-Safe Hooks with `createPolicyContext`

The hooks above take the object kind and action as plain strings, which is all a matrix that crossed JSON can offer. A policy built with `@evanion/acl`'s `policy()` knows its keys and its row types, and `createPolicyContext` binds them to a provider and the same four hooks. The block uses `policy` from `@evanion/acl`, `createPolicyContext` from `@evanion/react-acl` and `renderToStaticMarkup` from `react-dom/server`:

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

`EditReason` renders `reason` only to show the answer: `useShopCapabilities` passes no listing, so the seller rule cannot read `object.sellerId` and answers `unevaluable`. A component gates on `allowed`.

The provider `createPolicyContext` returns, `ShopProvider` here, already holds the policy, so it takes `subject` alone. Pass `access` to decide against a different document of the same shape, such as the copy a browser hydrated from JSON. Each `createPolicyContext` call makes its own context, and its hooks read only the provider that call returned: two policies nest without sharing hooks, and the bound hooks throw under the package's own `PolicyProvider`. The bound provider also feeds the shared context, so a component calling the package's own `useCan` underneath it reads the same decision.

### Keep `now` a String

`context.now` takes any instant `@evanion/acl` reads: an ISO 8601 string, epoch milliseconds, or a `Date`. Pass the string an SSR payload carries and leave it as it stands. The hooks key their memo on `now`, so a string holds the memo across renders, while a `Date` is a new object every render and re-evaluates the matrix. Without `context.now`, the provider reads `new Date()` whenever its own memo recomputes.

For the full API reference and integration guides, visit our documentation site:

👉 **[docs.evanion.com/react-acl](https://docs.evanion.com/react-acl)**

## License

MIT
