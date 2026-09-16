# React Authorization

The React binding for `@evanion/acl`. A provider and hooks over an
already-built access matrix, for both an RSC-style graph and a traditional Node
server/client split. Evaluation lives in the core; nothing here decides
anything.

## Installation

```bash
npm install @evanion/react-acl
```

## Quick start

```tsx
import { PolicyProvider, useCan } from '@evanion/react-acl';
import { createPolicy } from '@evanion/acl';

const access = createPolicy([
  {
    key: 'comment.update',
    object: 'comment',
    action: 'update',
    rules: [
      { when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] },
    ],
  },
]);

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

## The clock

`context.now` takes any `Instant`: an ISO 8601 string, epoch milliseconds, or a
`Date`. Pass the string an SSR payload hydrates with rather than converting it —
the hooks key their memo on `now`, so a string holds the memo across renders
where a `Date` is a new object every render and re-evaluates the matrix.

## License

MIT
