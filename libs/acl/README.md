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

<!-- #region quick-start -->

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

<!-- #endregion quick-start -->

## A decision explains itself

`allowed` is the answer. `reason`, `rule`, `blockedBy`, `cause` and `missing`
are the explanation, and they are output only — nothing in the library reads a
`reason` back to decide anything.

Default deny, an allow rule grants, a matched deny outranks a matching allow,
and a deny the engine could not read refuses too:

<!-- #region four-outcomes -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Comment = { authorId: string; status: string };

const access = policy<{ id: string }>().for<'comment', Comment>(
  'comment',
  (p) =>
    p
      .allow('update', p.eq('object.authorId', 'subject.id'))
      .deny('update', p.eq('object.status', 'locked')),
);

const subject = { id: 's1' };

// An allow rule matched, and no deny did.
const mine = access.can(subject, 'comment', 'update', {
  authorId: 's1',
  status: 'draft',
});
mine.reason; // -> 'allow'

// Somebody else's comment: no allow rule matched.
const theirs = access.can(subject, 'comment', 'update', {
  authorId: 's2',
  status: 'draft',
});
theirs.reason; // -> 'no-rule-matched'

// A matched deny outranks the allow that also matched.
const locked = access.can(subject, 'comment', 'update', {
  authorId: 's1',
  status: 'locked',
});
locked.reason; // -> 'denied'

// A projection carrying neither field. The deny side could not be read, so the
// permission is not answerable yet — and the answer names what to fetch.
const partial = access.can(subject, 'comment', 'update', {});
partial.allowed; // -> false
partial.reason; // -> 'unevaluable'
partial.missing; // -> ['object.status', 'object.authorId']
```

<!-- #endregion four-outcomes -->

`unevaluable` is a third state, not an error and not a no: the object the caller
passed did not carry a path some rule reads. `missing` names those paths, so one
refetch settles the permission. An absent `object.*` path is unevaluable for
every operator, negative ones included; an absent `subject.*` path is an
ordinary miss, because the app resolves the subject whole and never projects it.

### Repairing one

`missing` is a shopping list. Fetch what it names, ask again, and the permission
settles. Both sides' unreadable paths come back together, so one refetch is
enough however many rules read the object.

<!-- #region refetch -->

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

// The list query selected `id` and `title`; the rule reads `authorId`.
const projection = { id: 'c1', title: 'Draft' };

const first = access.can({ id: 's1' }, 'comment', 'update', projection);
first.reason; // -> 'unevaluable'
first.missing; // -> ['object.authorId']

// Fetch exactly what `missing` names, then ask once more.
const complete = { ...projection, authorId: 's1' };
access.can({ id: 's1' }, 'comment', 'update', complete).allowed; // -> true
```

<!-- #endregion refetch -->

A permission that stays `unevaluable` after a refetch is a bug in the document,
almost always a mistyped field name. A `schema` turns that class into an
`UnknownFieldError` at construction.

## Asking more than one question

`canMany` takes a list of instances and answers per instance. It settles the
clock once and resolves the object kind once, where a loop of `can` pays both
per row.

<!-- #region can-many -->

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

const rows = [
  { id: 'c1', authorId: 's1' },
  { id: 'c2', authorId: 's2' },
  { id: 'c3' }, // the projection this row came back in lacks the field
];

const decisions = access.canMany({ id: 's1' }, 'comment', 'update', rows);
const reasons = decisions.map((decision) => decision.reason);
reasons; // -> ['allow', 'no-rule-matched', 'unevaluable']
```

<!-- #endregion can-many -->

The array is parallel to the input, so the decision for `rows[i]` is
`decisions[i]`. Nothing is filtered out: a refused row still has an entry, which
is what lets a list render the refusal beside the row rather than dropping it.

`capabilities` asks the other way — no instance, every permission in the
document, resolved in dependency order against one subject.

<!-- #region capabilities -->

```ts @import.meta.vitest
import { createPolicy } from '@evanion/acl';

const access = createPolicy({
  permissions: [
    {
      key: 'report.read',
      object: 'report',
      action: 'read',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'staff' }] },
      ],
    },
    {
      key: 'report.export',
      object: 'report',
      action: 'export',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'admin' }] },
      ],
    },
  ],
});

const caps = access.capabilities({ id: 'u1', roles: ['staff'] });

Object.keys(caps); // -> ['report.read', 'report.export']
caps['report.read']?.allowed; // -> true
caps['report.export']?.reason; // -> 'no-rule-matched'
```

<!-- #endregion capabilities -->

`capabilities` passes no object, so every permission whose rules read `object.*`
decides `unevaluable` rather than `true` or `false`. That is the contract, not a
shortfall: without an instance there is nothing to compare against. It answers
definitely for the permissions that read only the subject, which is the half a
navigation menu is built from.

## One policy behind a screen

A rendered interface is a set of controls, and each control is one `can`. The
policy is the only place a rule is written; the interface reads answers and
draws.

<!-- #region listing-bar -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

/** Who is signed in. `role` is what the policy reads. */
interface Shopper {
  role: 'customer' | 'bookseller' | 'owner';
}

/** A game listing in the shop. A status, because that is all a rule reads. */
interface Listing {
  status: 'draft' | 'published';
}

const access = policy<Shopper>().for<'listing', Listing>('listing', (p) =>
  p
    .allow('review', p.always)
    .allow('edit', p.in('subject.role', ['bookseller', 'owner']))
    .allow('publish', p.in('subject.role', ['owner']))
    .deny('edit', p.eq('object.status', 'published')),
);

const bookseller: Shopper = { role: 'bookseller' };
const draft: Listing = { status: 'draft' };

access.can(bookseller, 'listing', 'review', draft).allowed; // -> true
access.can(bookseller, 'listing', 'edit', draft).allowed; // -> true
access.can(bookseller, 'listing', 'publish', draft).reason; // -> 'no-rule-matched'
access.can(bookseller, 'listing', 'edit', { status: 'published' }).reason; // -> 'denied'
```

<!-- #endregion listing-bar -->

Four statements decide three controls for every role the shop has. Publishing a
listing changes the fourth answer without anything else moving: the deny reads
`object.status`, so the same bookseller who could edit the draft cannot edit the
listing once it is published.

## The matrix document

A matrix is an envelope, never a bare array:

```json
{ "version": 3, "schema": { "objects": {} }, "permissions": [] }
```

`version` and `schema` belong to the document, so a producer in any language
states both in the JSON it emits, and one value crosses an SSR boundary with
nothing assembled around it:

<!-- #region matrix-round-trip -->

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

<!-- #endregion matrix-round-trip -->

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

<!-- #region schema-binding -->

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

<!-- #endregion schema-binding -->

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

<!-- #region typed-authoring -->

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

<!-- #endregion typed-authoring -->

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

<!-- #region typed-document -->

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

<!-- #endregion typed-document -->

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

## Dependency cascades

`dependsOn` names permissions that must resolve on for this one to resolve on. A
parent that is off takes its dependants with it, transitively, and nothing is
written back into the document.

<!-- #region cascade -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: string };

const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
  p
    .allow('update', p.eq('object.authorId', 'subject.id'))
    .allow('publish', p.contains('subject.roles', 'editor'))
    .dependsOn('comment.update')
    .allow('feature', p.contains('subject.roles', 'editor'))
    .dependsOn('comment.publish'),
);

const editor = { id: 's1', roles: ['editor'] };
const theirs = { authorId: 's2', status: 'draft' };

// Every rule on `feature` matched. It is off because `update` is.
const decision = access.can(editor, 'comment', 'feature', theirs);
decision.reason; // -> 'dependency-off'
decision.blockedBy; // -> 'comment.publish'
decision.cause; // -> { key: 'comment.update', reason: 'no-rule-matched' }
```

<!-- #endregion cascade -->

`blockedBy` is the edge this permission died on. `cause` walks past it to the
first ancestor that is off for a reason of its own — what an operator has to
fix. In a chain of three they name two different permissions, which is why both
are carried. A repairable cause keeps its `missing` paths on the way down, so a
dependant three levels deep still knows what to fetch.

Cycles are refused at construction with `FeatureCycleError`, and a cascade is
resolved once per permission rather than once per edge.

## Field-level permissions

<!-- #region field-permissions -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

const access = policy<{ id: string }>().for<'comment', { status: string }>(
  'comment',
  (p) => p.allow('read', p.always).fields(['*', '!status']),
);

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

<!-- #endregion field-permissions -->

The object form of `fields` keys the per-field configs by field name and takes
`fields` for the name allow-list, so `fields` is the one name a field cannot
have: a field called `fields` has nowhere to put its `targets` or `transitions`.
It can still be allowed or denied by name through the list. A matrix that gives
it a config is refused at construction with an `InvalidPermissionError` naming
the clash.

A field decision carries the action decision it hangs off, and `fd.allowed` is
true only when the action is allowed and every field is allowed. The field maps
are filled in whatever the action says, so a blocked caller still sees which
fields would be editable once the action is unblocked.

### Writing

A write passes the proposed object to `canFields` and writes what
`pickAllowedFields` hands back. Every key of the proposed write is decided, and
the returned object holds only the keys that decided `allowed` — that object is
the value to write, and nothing else from the write is.

<!-- #region write-path -->

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

<!-- #endregion write-path -->

`pickAllowedFields` throws `ActionNotAllowedError` when the action itself is
refused: no field of a refused action is writable, and an empty object would
read as a lawful write of nothing. A field the action allows but the field rules
deny is a partial write, so that case returns the allowed subset.

## Foreign matrix

A backend that uses its own ACL can expose its matrix as JSON and the frontend
adopts it. A foreign matrix fails closed on unknown permissions.

<!-- #region foreign-matrix -->

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

<!-- #endregion foreign-matrix -->

## One matrix per service

Across a fleet of services, each service authors and evaluates only the matrix
it owns. No service evaluates another's document to reach a decision, and there
is no merged matrix anywhere.

Object kinds are namespaced by origin — `orders:invoice`, `billing:invoice` —
because two services that both say `invoice` mean different rows, with different
fields, in different databases. The canonical key is unchanged:
`orders:invoice.read` still equals `` `${object}.${action}` `` character for
character. `.` is the key delimiter and is refused inside `object` and `action`
at construction, which is what makes `:` safe as the namespace separator.

A gateway or a BFF holds a map of policies rather than a merge. The map key is
the origin, so routing is a lookup and two documents cannot collide even without
naming discipline.

<!-- #region federation -->

```ts @import.meta.vitest
import { createPolicy } from '@evanion/acl';
import type { Decision, Matrix } from '@evanion/acl';

const ordersMatrix: Matrix = {
  permissions: [
    {
      key: 'orders:invoice.read',
      object: 'orders:invoice',
      action: 'read',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'ops' }] },
      ],
    },
  ],
};

const billingMatrix: Matrix = {
  permissions: [
    {
      key: 'billing:invoice.read',
      object: 'billing:invoice',
      action: 'read',
      rules: [
        {
          when: [{ field: 'subject.roles', op: 'contains', value: 'finance' }],
        },
      ],
    },
  ],
};

// One Access per origin, every one of them closed.
const policies = new Map([
  ['orders', createPolicy(ordersMatrix, { closed: true })],
  ['billing', createPolicy(billingMatrix, { closed: true })],
]);

const subject = { id: 'u1', roles: ['finance'] };

// One advisory view for a UI. The namespaces are disjoint, so the fold is safe.
const view: Record<string, Decision> = Object.assign(
  {},
  ...[...policies.values()].map((access) => access.capabilities(subject)),
);

Object.keys(view).sort(); // -> ['billing:invoice.read', 'orders:invoice.read']
view['billing:invoice.read']?.allowed; // -> true
view['orders:invoice.read']?.allowed; // -> false

// An origin nobody registered answers nothing, with no flag to set.
const absent = policies.get('orders')?.can(subject, 'shipping:parcel', 'read');
absent?.reason; // -> 'unknown-action'
```

<!-- #endregion federation -->

That view is advisory, in the same tier as a browser's. Every service behind the
edge evaluates its own matrix for itself and never trusts the edge's answer.

An unreachable upstream needs no special handling. Its origin is absent from the
map, and under `closed: true` every key it would have answered is already
`{ allowed: false, reason: 'unknown-action' }`.

`dependsOn` does not cross an origin. `orders:order.ship` depending on
`billing:invoice.paid` fails at construction with `UnknownDependencyError`,
inside orders' own process, where the author can fix it. That is the right
outcome rather than a limitation: resolving the edge would mean evaluating
billing's `object.*` conditions against the order instance the caller passed,
and returning a confident wrong answer. When one request genuinely touches two
services, the fan-out is the caller's own `&&` — `a.can(…).allowed &&
b.can(…).allowed` — written where somebody knows whether they meant AND or OR.

Integrity of a document in transit belongs to the transport, the same way
resolving a subject does: the library neither signs a matrix nor verifies one.

## A cross-cutting deny

A compliance or fraud team publishes deny rules for permissions it does not own.
The owning service fetches them and applies them in its own process, before it
constructs its policy:

```
authored matrix -> applyDenyOverlay -> createPolicy -> access
```

`applyDenyOverlay` appends each key's rules to that permission's `denyRules` and
returns a new matrix. Nothing merges at an edge, nothing but the owner is
authoritative, and the service that enforces the veto is the one that applies it.

<!-- #region deny-overlay -->

```ts @import.meta.vitest
import { applyDenyOverlay, createPolicy } from '@evanion/acl';
import type { DenyOverlay, Matrix } from '@evanion/acl';

// The owner's document. `schema.objects.payout` is what opening `payout.send`
// to a veto obliges it to declare.
const authored: Matrix = {
  version: 'payments@7',
  schema: {
    objects: { payout: { fields: { region: 'string', amount: 'number' } } },
  },
  permissions: [
    {
      key: 'payout.send',
      object: 'payout',
      action: 'send',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'ops' }] },
      ],
    },
  ],
};

// What compliance publishes. A contribution is a `Rule[]`, so it can state a
// deny and nothing else -- no allow, no dependency, no field rule.
const overlay: DenyOverlay = {
  'payout.send': [
    {
      id: 'sanctions-hold',
      when: [{ field: 'object.region', op: 'eq', value: 'XX' }],
    },
  ],
};

const access = createPolicy(
  applyDenyOverlay(authored, overlay, { vetoable: ['payout.send'] }),
  { version: 'payments@7+veto@41' },
);

const operator = { id: 'u1', roles: ['ops'] };

access.can(operator, 'payout', 'send', { region: 'SE', amount: 10 }).allowed; // -> true
access.can(operator, 'payout', 'send', { region: 'XX', amount: 10 }).reason; // -> 'denied'
```

<!-- #endregion deny-overlay -->

It refuses at apply time, naming the key: a key the target does not define, a key
the target does not list in `vetoable`, and a condition that does not fit the
target's schema for that key's object kind. The schema obligation is scoped to
the kinds behind `vetoable`, so a service that opens no extension point owes no
schema.

`applyDenyOverlay` is pure `Matrix -> Matrix`, and it can only subtract:
appending deny rules moves the deny side towards a match and never away, and
every branch reached that way is `allowed: false`. A subject the overlaid matrix
allows was allowed by the authored one, for every object and every instant.

The authoring party runs the same call. A compliance team applies its overlay to
the owner's published document in its own CI and finds its own mistake there
rather than in the owner's next deploy.

## Server-side `authorize`

`authorize` binds a subject so a middleware, loader, action, or RSC server
component evaluates without restating it.

<!-- #region server-authorize -->

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

<!-- #endregion server-authorize -->

The handle carries decisions and nothing else — no `matrix`, no `version`. A
caller that ships the document alongside the decisions holds the `access` it
came from, which it already imports to call `authorize` at all. One frozen
document is evaluated against many subjects, and offering it off a
subject-bound handle would read as this subject's matrix, which is the
per-subject snapshot the design exists to avoid.

### Deciding before the row is loaded

A caller that runs in front of the fetch — an HTTP guard ahead of the handler
that loads the row — gets `unevaluable` from every object-dependent permission,
every time. `unevaluable` is not a refusal, so the guard has to let the request
through and trust that something downstream decides properly. Nothing in the
decision tells it apart from a call that happened to lack data.

`readsObject` answers that from the document rather than from a call.

<!-- #region reads-object -->

```ts @import.meta.vitest
import { createPolicy } from '@evanion/acl';

const access = createPolicy({
  permissions: [
    {
      key: 'article.read',
      object: 'article',
      action: 'read',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'staff' }] },
      ],
    },
    {
      key: 'article.update',
      object: 'article',
      action: 'update',
      rules: [{ when: [] }],
      denyRules: [
        { when: [{ field: 'object.locked', op: 'eq', value: true }] },
      ],
    },
  ],
});

access.readsObject('article', 'read'); // -> false
access.readsObject('article', 'update'); // -> true
```

<!-- #endregion reads-object -->

True when any allow rule or any deny rule names an `object.*` path, on either
operand, or when any `dependsOn` ancestor does — an ancestor left unevaluable
carries the child with it. It takes no subject: the answer is a fact about the
matrix. Field rules do not count, since a `transitions` config reads the object
only on the `canFields` write axis, where the caller holds the row already.

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

A clock that parses is taken as given. A clock that does not — `null`, `NaN`,
an `Invalid Date`, a string that is not a date — refuses instead: every
permission whose decision reads it answers
`{ allowed: false, reason: 'unusable-clock' }`, on the allow side and the deny
side alike. Supply an instant that parses, or none at all.

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

The whole mechanism the library supplies is the comparison. Fetching, deciding
what to do with a mismatch, and rebuilding are the consumer's:

<!-- #region revalidate -->

```ts @import.meta.vitest
import { createPolicy } from '@evanion/acl';
import type { Access, Matrix } from '@evanion/acl';

/** Rebuild when the served document moved; otherwise keep the one in hand. */
function revalidate(current: Access, served: Matrix): Access {
  return current.version === served.version ? current : createPolicy(served);
}

const served: Matrix = {
  version: 'orders@8',
  permissions: [
    { key: 'comment.read', object: 'comment', action: 'read', rules: [] },
  ],
};

let access = createPolicy({ ...served, version: 'orders@7' });
access = revalidate(access, served);
access.version; // -> 'orders@8'
```

<!-- #endregion revalidate -->

Until that runs, the client grants what it last fetched. There is no push, no
expiry and no way for a held matrix to notice that it is stale.

## API

| Export                                                                                     | Purpose                                                                                      |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `createPolicy(matrix, options?)`                                                           | Builds the access object from a matrix document. Validates, clones and freezes.              |
| `parseMatrix(json, options?)`                                                              | Adopts a foreign matrix document; fails closed on unknown keys.                              |
| `policy<S>(options?)`                                                                      | Typed authoring; `.for<K, O>(key, block)` per object kind. Flattens to the canonical matrix. |
| `p.allow` / `p.deny` / `p.dependsOn` / `p.fields`                                          | Declare one action inside a `.for()` block.                                                  |
| `p.eq` / `ne` / `in` / `notIn` / `contains` / `before` / `after` / `and` / `or` / `always` | Build a permission's conditions, path-checked against the block's types.                     |
| `policy(...).object(key)`                                                                  | A handle bound to one object kind. Typed policies only; `createPolicy` has no `object`.      |
| `access.can(subject, key, action, object?, now?)`                                          | One decision.                                                                                |
| `access.canMany(...)`                                                                      | A decision array, parallel to the input.                                                     |
| `access.canFields(...)`                                                                    | The field-level decision for one axis, plus the action decision gating it.                   |
| `pickAllowedFields(decision, proposed)`                                                    | The subset of a proposed write the decision allows. The value to write.                      |
| `access.capabilities(subject)`                                                             | Every action-level decision.                                                                 |
| `access.readsObject(key, action)`                                                          | Whether the permission needs the object row at all. Takes no subject.                        |
| `access.authorize(subject)`                                                                | A bound handle for server-side evaluation. Decisions only; the document stays on `access`.   |
| `access.matrix`                                                                            | The frozen document. Round-trips through JSON; this is what crosses SSR.                     |
| `access.version` / `access.schema`                                                         | The effective version, and the declared shapes when the document carries them.               |

A decision carries `allowed` plus an output-only `reason` (`allow`,
`no-rule-matched`, `denied`, `dependency-off`, `unknown-action`, `unevaluable`,
`unusable-clock`). Nothing in the library reads a `reason` back to decide
anything.

### The clock

`now` is an `Instant` — an ISO 8601 string, epoch milliseconds, or a `Date` —
wherever it is taken, which is the same type a `before`/`after` condition value
takes. A context hydrated from JSON carries a string and is passed through as
it stands:

<!-- #region clock -->

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

<!-- #endregion clock -->

Omitting `now` reads the wall clock. A clock that does not parse never throws:
the permission refuses with `reason: 'unusable-clock'`, which is not repairable
by a refetch and carries no `missing`. A condition **value** that does not parse
is a construction error instead — the boundary comes from the document, and the
document is checked once.

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
