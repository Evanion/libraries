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
npm install @evanion/react-acl
```

## Quick start

```tsx
import { PolicyProvider, useCan } from '@evanion/react-acl';
import { hydratePolicy } from '@evanion/acl';

const access = hydratePolicy({
  permissions: [
    {
      key: 'comment.update',
      object: 'comment',
      action: 'update',
      rules: [
        { when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] },
      ],
    },
  ],
});

export function App({ user }: { user: { id: string } }) {
  return (
    <PolicyProvider
      access={access}
      subject={user}
      context={{ now: new Date() }}
    >
      <CommentList />
    </PolicyProvider>
  );
}

function CommentList() {
  if (!useCan('comment', 'update', { authorId: user.id }).allowed) {
    return <ReadOnlyComment />;
  }
  return <EditableComment />;
}
```

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
