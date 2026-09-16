# Authorization

A declarative, serializable access-control matrix authored once and evaluated
**locally** on whatever JS runtime is running — a Node backend, a frontend SSR
graph, a browser SPA, or a hybrid JS platform (React Native, Electron). The
matrix is a frozen object that round-trips through JSON. No per-subject
snapshots, no backend roundtrip.

The matrix ships to the client in full and evaluates locally, so it cannot
contain secrets or server-side-only predicates. Opaque checks live outside the
matrix, as server-side app-layer decisions. What that costs, and what each
consumer owns, is the [security contract](#security-contract).

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

## Security contract

A decision counts where it is made. It is authoritative in a trusted
environment — a React Router 8 or Next.js server runtime, a Node service, the
server side of an API boundary — and advisory everywhere else. In
a browser the same `can` call, with the same signature and the same return
type, only toggles what the user sees. Nothing in the types separates the two;
the runtime does.

Every app in the chain evaluates for itself and trusts no earlier layer. A
gateway or a BFF that already allowed the request does not excuse the service
behind it from deciding again. There is no transitive trust and no "already
checked upstream" exemption, because a caller reaches the later service
directly whenever it wants to. Evaluating the same matrix twice is cheap: it is
a local function call over a frozen object, with no roundtrip to pay for.

The matrix is a public document in its names and structure, not only in its
values. It ships to the client in full, so anyone who loads the page reads
every object kind, every action name, every role string that appears in a
condition, every field name including the ones the API never returns, every
state machine and its terminal states, every time window and its boundaries,
and the whole `dependsOn` graph. That is a map of the privilege model and of
the server's internal vocabulary. It is not an argument against shipping the
matrix — security must not rest on the document staying secret, and here it
does not. It is an argument for naming things as if they were going to be read,
because they are. An action named `bypass-kyc` or a role named
`internal-fraud-reviewer` is a disclosure the moment the page loads.

The rest of the contract is the consumer's to own. A library that claimed to
cover these would be lying about what an evaluator can see.

### Subject authenticity

`can(subject, ...)` authorizes the bag it is handed. It has no way to ask where
that bag came from. A subject derived from anything the client controls — a
header, a query parameter, an unverified token body, a field the client posted
— gets the attacker's claimed identity faithfully authorized. This is the
confused deputy, and it cannot be fixed inside an evaluator. Resolve the
subject from a verified session or a verified token, server-side, before the
subject reaches `can`.

### Complete mediation

Nothing makes you call `can`. A new route, a new resolver, a background job, an
admin script, a direct query — each is unguarded until someone guards it. The
library can make the checked path the easy one, through `authorize(subject)`
bound once in middleware; it cannot make the unchecked path impossible. Whether
every path is covered is a property of the app, and the place to assert it is
the app's tests.

### Time of check to time of use

A decision describes the snapshot it was given. Between `can` returning `true`
and the write landing, the object can change owner, the subject can lose the
role, and the time window can close. Re-read the object and re-check inside the
transaction, or write with a conditional predicate that fails when the state it
was authorized against has moved. The library carries no freshness token and no
way to detect the gap.

### What a condition may read

A condition may read only fields the subject cannot write. A rule that keys on
an object field within the subject's reach is self-authorizing: the subject
edits the field, then passes the check the field controls.
`contains('object.collaborators', 'subject.id')` is the obvious trap, allowing
a user to add themselves to a document and be authorized for it. Either keep
the field out of every write path the rule guards, or key the rule on something
the subject cannot reach — ownership set at creation, a role on the subject, a
field the server alone writes.

### Matrix freshness

A client holds the matrix it last fetched. When a permission is revoked, that
client keeps granting it until it refetches, and it has no way to notice.
`access.version` is a surface for detecting a mismatch, not a mechanism for
resolving one: comparing it, failing closed, and forcing a refetch is the
consumer's to implement. The server never depends on a client's copy in any
case, since it evaluates its own.

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
