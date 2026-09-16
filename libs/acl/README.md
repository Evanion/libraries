# Authorization

A declarative, serializable access-control matrix authored once and evaluated
**locally** on whatever JS runtime is running — a Node backend, a frontend SSR
graph, a browser SPA, or a hybrid JS platform (React Native, Electron). The
matrix is a frozen object that round-trips through JSON. No per-subject
snapshots, no backend roundtrip.

The matrix ships to the client in full and evaluates locally, so it cannot
contain secrets or server-side-only predicates. Opaque checks live outside the
matrix, as server-side app-layer decisions.

## Installation

```bash
npm install @evanion/acl
```

## Quick start

```ts @import.meta.vitest
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

const decision = access.can({ id: 's1' }, 'comment', 'update', {
  authorId: 's1',
});
decision.allowed; // -> true
```

## Typed authoring

The typed path names the subject once and the object type per permission, so a
typo in an `object.*` field is a compile error.

```ts @import.meta.vitest
import { policy, permit, eq } from '@evanion/acl';

const access = policy<{ id: string }>({
  comment: {
    update: permit<{ authorId: string }>(eq('object.authorId', 'subject.id')),
  },
});

access.can({ id: 's1' }, 'comment', 'update', { authorId: 's1' }).allowed; // -> true
```

## Field-level permissions

```ts @import.meta.vitest
import { policy, permit, always } from '@evanion/acl';

const access = policy<{ id: string; roles: string[] }>({
  comment: {
    read: permit<{ status: string }>(always).fields({
      fields: ['*', '!status'],
    }),
  },
});

const fd = access.canFields(
  { id: 's1' },
  'comment',
  'read',
  { status: 'draft' },
  'read',
);
fd.fields['status']; // -> 'denied'
fd.action.allowed; // -> true
```

A field decision carries the action decision it hangs off, and `fd.allowed` is
true only when the action is allowed and every field is allowed. The field maps
are filled in whatever the action says, so a blocked caller still sees which
fields would be editable once the action is unblocked.

## Foreign matrix

A backend that uses its own ACL can expose its matrix as JSON and the frontend
adopts it. A foreign matrix fails closed on unknown permissions.

```ts @import.meta.vitest
import { parseMatrix } from '@evanion/acl';

const access = parseMatrix([
  {
    key: 'comment.read',
    object: 'comment',
    action: 'read',
    rules: [
      { when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] },
    ],
  },
]);

access.can({ id: 's1' }, 'comment', 'delete').reason; // -> 'unknown-action'
```

## Server-side `authorize`

`authorize` binds a subject so a middleware, loader, action, or RSC server
component evaluates without restating it.

```ts @import.meta.vitest
import { createPolicy } from '@evanion/acl';

const access = createPolicy([
  {
    key: 'comment.read',
    object: 'comment',
    action: 'read',
    rules: [
      { when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] },
    ],
  },
]);

const forUser = access.authorize({ id: 's1', roles: ['editor'] });
forUser.can('comment', 'read').allowed; // -> true
```

## API

| Export                                                                   | Purpose                                                                          |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `createPolicy(matrix, options?)`                                         | Builds the access object from a canonical matrix. Validates, clones and freezes. |
| `parseMatrix(json, options?)`                                            | Adopts a foreign matrix; fails closed on unknown keys.                           |
| `policy<S>(config)`                                                      | Typed authoring; flattens to the canonical matrix.                               |
| `permit<O>(...conditions)` / `eq` / `contains` / `and` / `or` / `always` | Build a permission's rules.                                                      |
| `access.can(subject, key, action, object?, now?)`                        | One decision.                                                                    |
| `access.canMany(...)`                                                    | A decision array, parallel to the input.                                         |
| `access.canFields(...)`                                                  | The field-level decision for one axis, plus the action decision gating it.       |
| `access.capabilities(subject)`                                           | Every action-level decision.                                                     |
| `access.authorize(subject)`                                              | A bound handle for server-side evaluation.                                       |

A decision carries `allowed` plus an output-only `reason` (`allow`,
`no-rule-matched`, `denied`, `dependency-off`, `unknown-action`,
`unevaluable`). Nothing in the library reads a `reason` back to decide anything.

### The clock

`now` is an `Instant` — an ISO 8601 string, epoch milliseconds, or a `Date` —
wherever it is taken, which is the same type a `before`/`after` condition value
takes. A context hydrated from JSON carries a string and is passed through as
it stands:

```ts @import.meta.vitest
import { createPolicy } from '@evanion/acl';

const access = createPolicy([
  {
    key: 'sale.buy',
    object: 'sale',
    action: 'buy',
    rules: [
      { when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' }] },
    ],
  },
]);

const hydrated = JSON.parse(
  JSON.stringify({ now: new Date('2026-06-01T00:00:00Z') }),
) as { now: string };

const open = access.can({ id: 's1' }, 'sale', 'buy', undefined, hydrated.now);
open.allowed; // -> true

const early = Date.parse('2025-06-01T00:00:00Z');
const shut = access.can({ id: 's1' }, 'sale', 'buy', undefined, early);
shut.allowed; // -> false
```

Omitting `now` reads the wall clock. An instant that does not parse never
throws: the `before`/`after` conditions reading it fail, the same as a condition
value that does not parse.

## Non-goals

- No .NET/Go/other-language evaluator. A non-JS backend uses its own ACL; only
  JSON crosses the boundary.
- No predicate functions. Rules are declarative, because the matrix must
  round-trip through JSON losslessly.
- No row-scoping query language. Collection filtering over a list is deferred.
- No per-subject capability projection. The FE evaluates the full matrix
  locally.

## License

MIT
