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

const access = createPolicy({
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

const decision = access.can({ id: 's1' }, 'comment', 'update', {
  authorId: 's1',
});
decision.allowed; // -> true
```

## The matrix document

A matrix is an envelope, never a bare array:

```json
{ "version": 3, "schema": { "objects": {} }, "permissions": [] }
```

`version` and `schema` belong to the document, so a producer in any language
states both in the JSON it emits, and one value crosses an SSR boundary with
nothing assembled around it:

```ts @import.meta.vitest
import { createPolicy } from '@evanion/acl';

const access = createPolicy({
  version: 'orders@7',
  permissions: [
    { key: 'comment.read', object: 'comment', action: 'read', rules: [] },
  ],
});

// The server sends `access.matrix`; the client rebuilds from it.
const payload = JSON.parse(
  JSON.stringify(access.matrix),
) as typeof access.matrix;
createPolicy(payload).version; // -> 'orders@7'
```

`version` is a string or a number. The revalidate contract compares it with
`!==`, so a content digest or a composite (`orders@7+veto@41`) works where a
number cannot — and a composite is what an effective version needs when a
construction site merges a document with something else, such as a compliance
deny overlay applied before construction.

`createPolicy(matrix, { version })` **overrides** the document's value. The
document states what a producer shipped; the option states what the construction
site is actually running, which the producer cannot know. The option wins, and
the frozen `access.matrix` carries the winner, so the version that decided is the
version that crosses.

## The schema

A document may declare the shapes its conditions read. The schema is optional
for a producer and binding when present.

```ts @import.meta.vitest
import { createPolicy } from '@evanion/acl';
import type { Matrix } from '@evanion/acl';

const matrix: Matrix = {
  schema: {
    subject: { fields: { id: 'string', roles: 'string[]' } },
    objects: {
      comment: {
        fields: { authorId: 'string', status: 'string', tags: 'string[]' },
        relations: { post: 'post' },
      },
    },
  },
  permissions: [
    {
      key: 'comment.update',
      object: 'comment',
      action: 'update',
      // `status` is a string, and contains tests an array.
      rules: [
        { when: [{ field: 'object.status', op: 'contains', value: 'draft' }] },
      ],
    },
  ],
};

let refused = '';
try {
  createPolicy(matrix);
} catch (error) {
  refused = (error as Error).name;
}
refused; // -> 'FieldTypeMismatchError'
```

Field types are flat strings, so the whole schema is JSON a producer emits by
reflection: `string`, `number`, `boolean`, `instant`, a `[]` suffix for an array
of one, a `?` suffix for a field that may be absent from a complete instance. A
declared field that is present and `null` is present — nullability is not an
optionality axis.

### What a present schema checks

Two things, both at construction, both an `AclConfigError`:

1. A condition naming a field the schema does not declare
   (`UnknownFieldError`). Without a schema this is the typo class that decides
   `unevaluable` forever on the foreign path.
2. A condition whose operator or comparand does not fit the declared type
   (`FieldTypeMismatchError`): `contains` against a field that is not an array,
   an equality against an array field, a literal of the wrong type, or a `path`
   comparand whose two sides disagree.

### What it does not check

- **Object kinds it does not declare.** Granularity is per kind: a permission on
  a kind absent from `schema.objects` is unchecked, and `subject.*` paths are
  unchecked unless `schema.subject` is declared.
- **Field-rule names.** The `fields` allow-list and the `targets` /
  `transitions` keys of `FieldRules` are not checked against the schema.
- **Whether a permission can decide `unevaluable`.** Proving that a permission
  naming no optional field always decides for a complete instance is not done;
  the `?` suffix is carried in the document and read by nothing today.
- **`instant` fields, temporally.** `before` and `after` read the clock and
  nothing else, so an `instant` field is compared with `eq`, `ne`, `in` or
  `not-in` only.

## Typed authoring

`policy<Subject>()` names the subject once and returns a builder. Each `.for()`
call binds one object kind to its type and hands the condition helpers to a
block, so a typo in an `object.*` or `subject.*` path is a compile error, and so
is an unknown object kind or an object of the wrong kind at the call site.

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };

const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
  p
    .allow(
      'update',
      p.or(
        p.eq('object.authorId', 'subject.id'),
        p.contains('subject.roles', 'editor'),
      ),
    )
    .allow('publish', p.contains('subject.roles', 'editor'))
    .dependsOn('comment.update')
    .deny('delete', p.eq('object.status', 'published')),
);

const subject = { id: 's1', roles: [] };
const comment = { authorId: 's1', status: 'draft' } as const;
const decision = access.can(subject, 'comment', 'update', comment);
decision.allowed; // -> true
```

The block parameter carries the whole permission model: `allow` and `deny`
declare an action's rules, `dependsOn` and `fields` attach to the action most
recently declared in the chain, and the condition helpers are `eq`, `ne`, `in`,
`notIn`, `contains`, `before`, `after`, `and`, `or` and `always`.

An operand is read as a **path** when its type matches
`` `subject.${string}` | `object.${string}` | 'now' ``, and as a literal value
otherwise. That shape is the only discriminator, and it is what makes
`p.eq('object.status', 'published')` a comparison against a literal while
`p.eq('object.authorId', 'subject.idd')` is a compile error naming the path.

Action names, comparand value types, and `dependsOn` keys are not checked at
compile time. A `dependsOn` naming no configured permission is refused at
construction with `UnknownDependencyError`.

The builder flattens to the canonical matrix on the first query, so
`JSON.stringify(access.matrix)` emits the same document a foreign backend would
produce.

### The document a typed policy emits

`version` and `schema` are document fields, so `policy()` takes them and puts
them in the document it flattens to rather than holding them beside it:

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Comment = { authorId: string; status: string };

const access = policy<{ id: string }>({
  version: 'orders@7',
  schema: {
    subject: { fields: { id: 'string' } },
    objects: {
      comment: { fields: { authorId: 'string', status: 'string' } },
    },
  },
}).for<'comment', Comment>('comment', (p) =>
  p.allow('update', p.eq('object.authorId', 'subject.id')),
);

JSON.stringify(access.matrix.version); // -> '"orders@7"'
```

They sit on `policy()` rather than on a method at the end of the chain because
neither is a per-kind fact: `.for()` exists to accumulate the key-to-type map,
and a version and a schema are known before the first block is written.

A schema is written by hand. `.for<'comment', Comment>()` holds `Comment` at the
type level only, and a schema is runtime JSON, so nothing can derive one from the
type argument.

That makes the field-existence guarantee available twice on the typed path, and
the duplication is the point: TypeScript gives it to the author, and the schema
gives it to everyone downstream. The document travels; the types do not. A
consumer that adopts the emitted JSON with `parseMatrix` has no `Comment` to
check against and gets the same guarantee from the schema. A typed author who
ships a document to nobody needs no schema.

The two are checked independently and can disagree. A path TypeScript accepts
because the type declares the field is still an `UnknownFieldError` at
construction when the schema does not declare it — the schema is binding
wherever it is present.

## Field-level permissions

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

const access = policy<{ id: string; roles: string[] }>().for<
  'comment',
  { status: string }
>('comment', (p) => p.allow('read', p.always).fields(['*', '!status']));

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

### Writing

A write passes the proposed object to `canFields` and writes what
`pickAllowedFields` hands back. Every key of the proposed write is decided, and
the returned object holds only the keys that decided `allowed` — that object is
the value to write, and nothing else from the write is.

```ts @import.meta.vitest
import { policy, pickAllowedFields } from '@evanion/acl';

const access = policy<{ id: string }>().for<
  'user',
  { id: string; name: string }
>('user', (p) =>
  p.allow('update', p.eq('object.id', 'subject.id')).fields(['*', '!role']),
);

const current = { id: 'u1', name: 'Ann' };
const proposed = { name: 'Eve', role: 'admin' };

const fd = access.canFields(
  { id: 'u1' },
  'user',
  'update',
  current,
  'write',
  proposed,
);

fd.fields['role']; // -> 'denied'
JSON.stringify(pickAllowedFields(fd, proposed)); // -> '{"name":"Eve"}'
```

`pickAllowedFields` throws `ActionNotAllowedError` when the action itself is
refused: no field of a refused action is writable, and an empty object would
read as a lawful write of nothing. A field the action allows but the field rules
deny is a partial write, so that case returns the allowed subset.

## Foreign matrix

A backend that uses its own ACL can expose its matrix as JSON and the frontend
adopts it. A foreign matrix fails closed on unknown permissions.

```ts @import.meta.vitest
import { parseMatrix } from '@evanion/acl';

const access = parseMatrix({
  permissions: [
    {
      key: 'comment.read',
      object: 'comment',
      action: 'read',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] },
      ],
    },
  ],
});

access.can({ id: 's1' }, 'comment', 'delete').reason; // -> 'unknown-action'
```

## Server-side `authorize`

`authorize` binds a subject so a middleware, loader, action, or RSC server
component evaluates without restating it.

```ts @import.meta.vitest
import { createPolicy } from '@evanion/acl';

const access = createPolicy({
  permissions: [
    {
      key: 'comment.read',
      object: 'comment',
      action: 'read',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] },
      ],
    },
  ],
});

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
cover these would be lying about what an evaluator can see. Each clause below
is an entry in [SECURITY.md](./SECURITY.md), the register the adversarial suite
in `src/security` is checked against.

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

### The clock a decision reads

`now` is a parameter. Omitted, it is the wall clock; supplied, it is whatever
the caller passed, and every `before`/`after` window moves with it. A `now` that
reaches `can` from a client payload — a hydration blob, a request body, a query
string — hands the client every time window in the matrix. Pass it only to make
a server render and its rehydration agree, and resolve it server-side.

A clock that does not parse fails every time condition it is read by, which is
closed on an allow rule and open on a deny rule: a deny gated on a time window
does not deny when the clock is `null` or unparseable. Supply an instant that
parses, or none at all.

### The bag a decision reads

Conditions read `subject` and `object` live, field by field, as the decision
walks the rules. The deny side is evaluated before the allow side, and each side
reads the fields its own rules name. A bag whose properties are accessors — an
ORM row, a lazy proxy, a memoised getter over a cache that can refill — can
answer the two sides differently and pass the deny it should have matched. The
matrix the engine evaluates is a frozen deep copy for exactly this reason; the
subject and the object are not copied, because they are the app's data and
copying them would hide the cost. Pass plain, already-resolved objects.

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
consumer's to implement. The comparison is a `!==`, so a digest or a composite
covering every input works as well as a counter. The server never depends on a
client's copy in any case, since it evaluates its own.

A document that states no `version` leaves `access.version` undefined, and a
`!==` against undefined decides nothing. A producer that wants the contract to
hold states a version — a content hash of the document is enough.

## API

| Export                                                                                     | Purpose                                                                                      |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `createPolicy(matrix, options?)`                                                           | Builds the access object from a matrix document. Validates, clones and freezes.              |
| `parseMatrix(json, options?)`                                                              | Adopts a foreign matrix document; fails closed on unknown keys.                              |
| `policy<S>(options?)`                                                                      | Typed authoring; `.for<K, O>(key, block)` per object kind. Flattens to the canonical matrix. |
| `p.allow` / `p.deny` / `p.dependsOn` / `p.fields`                                          | Declare one action inside a `.for()` block.                                                  |
| `p.eq` / `ne` / `in` / `notIn` / `contains` / `before` / `after` / `and` / `or` / `always` | Build a permission's conditions, path-checked against the block's types.                     |
| `access.object(key)`                                                                       | A handle bound to one object kind, on a typed policy.                                        |
| `access.can(subject, key, action, object?, now?)`                                          | One decision.                                                                                |
| `access.canMany(...)`                                                                      | A decision array, parallel to the input.                                                     |
| `access.canFields(...)`                                                                    | The field-level decision for one axis, plus the action decision gating it.                   |
| `pickAllowedFields(decision, proposed)`                                                    | The subset of a proposed write the decision allows. The value to write.                      |
| `access.capabilities(subject)`                                                             | Every action-level decision.                                                                 |
| `access.authorize(subject)`                                                                | A bound handle for server-side evaluation.                                                   |
| `access.matrix`                                                                            | The frozen document. Round-trips through JSON; this is what crosses SSR.                     |
| `access.version` / `access.schema`                                                         | The effective version, and the declared shapes when the document carries them.               |

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

const access = createPolicy({
  permissions: [
    {
      key: 'sale.buy',
      object: 'sale',
      action: 'buy',
      rules: [
        {
          when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' }],
        },
      ],
    },
  ],
});

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
