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

Three entry points, split by where the document came from:

| Entry            | The document is           | An unknown key |
| ---------------- | ------------------------- | -------------- |
| `policy().build` | one you are writing now   | throws         |
| `hydratePolicy`  | yours, arriving back      | throws         |
| `parseMatrix`    | somebody else's, arriving | fails closed   |

`policy()` is where a policy is written. `hydratePolicy` takes a document that
already exists and returns an evaluator over it, which is what a server's
matrix reaching a client is. `parseMatrix` is the same call with `closed: true`
preset, because a document whose author you are not should refuse an unknown
key rather than throw.

<!-- #region quick-start -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Question = { id: string; askedBy: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')),
  )
  .build();

const decision = access.can({ id: 's1' }, 'question', 'update', {
  askedBy: 's1',
});
decision.allowed; // -> true
```

<!-- #endregion quick-start -->

## A decision explains itself

`allowed` is the answer. `reason`, `rule` and `missing` are the explanation,
and they are output only — nothing in the library reads a `reason` back to
decide anything.

Default deny, an allow rule grants, a matched deny outranks a matching allow,
and a deny the engine could not read refuses too:

<!-- #region four-outcomes -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Question = { askedBy: string; status: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p
      .allow('update', p.eq('object.askedBy', 'subject.id'))
      .deny('update', p.eq('object.status', 'locked')),
  )
  .build();

const subject = { id: 's1' };

// An allow rule matched, and no deny did.
const mine = access.can(subject, 'question', 'update', {
  askedBy: 's1',
  status: 'draft',
});
mine.reason; // -> 'allow'

// Somebody else's question: no allow rule matched.
const theirs = access.can(subject, 'question', 'update', {
  askedBy: 's2',
  status: 'draft',
});
theirs.reason; // -> 'no-rule-matched'

// A matched deny outranks the allow that also matched.
const locked = access.can(subject, 'question', 'update', {
  askedBy: 's1',
  status: 'locked',
});
locked.reason; // -> 'denied'

// A projection carrying neither field. The deny side could not be read, so the
// permission is not answerable yet — and the answer names what to fetch.
const partial = access.can(subject, 'question', 'update', {});
partial.allowed; // -> false
partial.reason; // -> 'unevaluable'
partial.missing; // -> ['object.status', 'object.askedBy']
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
import { policy } from '@evanion/acl';

type Question = { id: string; askedBy: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')),
  )
  .build();

// The list query selected `id` and `body`; the rule reads `askedBy`.
const projection = { id: 'q1', body: 'Does this ship sleeved?' };

const first = access.can({ id: 's1' }, 'question', 'update', projection);
first.reason; // -> 'unevaluable'
first.missing; // -> ['object.askedBy']

// Fetch exactly what `missing` names, then ask once more.
const complete = { ...projection, askedBy: 's1' };
access.can({ id: 's1' }, 'question', 'update', complete).allowed; // -> true
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
import { policy } from '@evanion/acl';

type Question = { id: string; askedBy: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')),
  )
  .build();

const rows = [
  { id: 'c1', askedBy: 's1' },
  { id: 'c2', askedBy: 's2' },
  { id: 'c3' }, // the projection this row came back in lacks the field
];

const decisions = access.canMany({ id: 's1' }, 'question', 'update', rows);
const reasons = decisions.map((decision) => decision.reason);
reasons; // -> ['allow', 'no-rule-matched', 'unevaluable']
```

<!-- #endregion can-many -->

The array is parallel to the input, so the decision for `rows[i]` is
`decisions[i]`. Nothing is filtered out: a refused row still has an entry, which
is what lets a list render the refusal beside the row rather than dropping it.

`capabilities` asks the other way — no instance, every permission in the
document, resolved in document order against one subject.

<!-- #region capabilities -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';
import type { Action } from '@evanion/acl';

type Shopper = { id: string; roles: string[] };

// One policy, every object kind the app has. A `.for()` per kind, and the
// permissions they flatten to live in the same flat list.
const access = policy<
  Shopper,
  { report: { id: string }; listing: { id: string } },
  { report: Action | 'export' }
>()
  .for('report', (p) =>
    p
      .allow('read', p.contains('subject.roles', 'bookseller'))
      .allow('export', p.contains('subject.roles', 'owner')),
  )
  .for('listing', (p) => p.allow('read', p.contains('subject.roles', 'owner')))
  .build();

const caps = access.capabilities({ id: 'u1', roles: ['bookseller'] });

Object.keys(caps); // -> ['report.read', 'report.export', 'listing.read']
caps['report.read']?.allowed; // -> true
caps['report.export']?.reason; // -> 'no-rule-matched'
caps['listing.read']?.reason; // -> 'no-rule-matched'
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

const access = policy<
  Shopper,
  { listing: Listing },
  { listing: 'review' | 'edit' | 'publish' }
>()
  .for('listing', (p) =>
    p
      .allow('review', p.always)
      .allow('edit', p.in('subject.role', ['bookseller', 'owner']))
      .allow('publish', p.in('subject.role', ['owner']))
      .deny('edit', p.eq('object.status', 'published')),
  )
  .build();

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
import { hydratePolicy } from '@evanion/acl';

const access = hydratePolicy({
  version: 'orders@7',
  permissions: [
    { key: 'question.read', object: 'question', action: 'read', rules: [] },
  ],
});

// The server sends `access.matrix`; the client rebuilds from it.
const payload = JSON.parse(
  JSON.stringify(access.matrix),
) as typeof access.matrix;
hydratePolicy(payload).version; // -> 'orders@7'

// The construction site states what it is actually running. The option wins,
// and the frozen `matrix` carries the winner.
const vetoed = hydratePolicy(payload, { version: 'orders@7+veto@41' });
vetoed.version; // -> 'orders@7+veto@41'
vetoed.matrix.version; // -> 'orders@7+veto@41'
```

<!-- #endregion matrix-round-trip -->

`version` is a string or a number. The revalidate contract compares it with
`!==`, so a content digest or a composite (`orders@7+veto@41`) works where a
number cannot — and a composite is what an effective version needs when a
construction site merges a document with something else, such as a compliance
deny overlay applied before construction.

`hydratePolicy(matrix, { version })` **overrides** the document's value. The
document states what a producer shipped; the option states what the construction
site is actually running, which the producer cannot know. The option wins, and
the frozen `access.matrix` carries the winner, so the version that decided is the
version that crosses.

## The schema

A document may declare the shapes its conditions read. The schema is optional
for a producer and binding when present.

<!-- #region schema-binding -->

```ts @import.meta.vitest
import { hydratePolicy } from '@evanion/acl';
import type { Matrix } from '@evanion/acl';

const matrix: Matrix = {
  schema: {
    subject: { fields: { id: 'string', roles: 'string[]' } },
    objects: {
      question: {
        fields: { askedBy: 'string', status: 'string', tags: 'string[]' },
        relations: { listing: 'listing' },
      },
    },
  },
  permissions: [
    {
      key: 'question.update',
      object: 'question',
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
  hydratePolicy(matrix);
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

`policy<Subject, Objects, Verbs>()` names the subject, the object kinds and the
actions each kind answers for, then returns a builder. Each `.for()` names its
kind as a value and hands the condition helpers to a block, so a typo in an
`object.*` or `subject.*` path is a compile error, and so is an unknown object
kind, an action outside the kind's vocabulary, or an object of the wrong kind at
the call site.

`Verbs` is optional, and a kind it does not name may declare the four
`Action` verbs. The keys `capabilities()` answers under are read off the
`allow` and `deny` calls each block actually made.

<!-- #region typed-authoring -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';
import type { Action } from '@evanion/acl';

type Subject = { id: string; roles: string[] };
type Question = { askedBy: string; status: 'open' | 'locked' };
type Listing = { sellerId: string };

// One policy, every object kind the shop has. Each `.for()` adds a kind and
// keeps the ones before it, so `access` answers for questions and listings
// alike and there is one document to ship.
const access = policy<
  Subject,
  { question: Question; listing: Listing },
  { question: Action | 'hide' }
>()
  .for('question', (p) =>
    p
      .allow(
        'update',
        p.or(
          p.eq('object.askedBy', 'subject.id'),
          p.contains('subject.roles', 'bookseller'),
        ),
      )
      .allow('hide', p.contains('subject.roles', 'bookseller'))
      .deny('delete', p.eq('object.status', 'locked')),
  )
  .for('listing', (p) =>
    p.allow('update', p.eq('object.sellerId', 'subject.id')),
  )
  .build();

const subject = { id: 's1', roles: [] };
const question = { askedBy: 's1', status: 'open' } as const;
access.can(subject, 'question', 'update', question).allowed; // -> true
access.can(subject, 'listing', 'update', { sellerId: 's1' }).allowed; // -> true
access.can(subject, 'listing', 'update', { sellerId: 's2' }).allowed; // -> false
```

<!-- #endregion typed-authoring -->

The block parameter carries the whole permission model: `allow` and `deny`
declare an action's rules, `fields` and `visibility` attach to the action most
recently declared in the chain, and the condition helpers are `eq`, `ne`, `in`,
`notIn`, `contains`, `before`, `after`, `and`, `or` and `always`.

An operand is read as a **path** when its type matches
`` `subject.${string}` | `object.${string}` | 'now' ``, and as a literal value
otherwise. That shape is the only discriminator, and it is what makes
`p.eq('object.status', 'published')` a comparison against a literal while
`p.eq('object.askedBy', 'subject.idd')` is a compile error naming the path.

Action names and comparand value types are not checked at compile time. An
action the matrix does not carry is a legitimate question with a
`unknown-action` answer, so nothing refuses it.

One permission never gates another. An author who means "publish requires
update" writes update's condition into publish, where a reader of publish sees
it. `Cond` is a plain value, so the shared half is a local `const` named once
in the same block:

```ts
const access = policy<
  Subject,
  { question: Question },
  { question: Action | 'hide' }
>()
  .for('question', (p) => {
    const isAsker = p.eq('object.askedBy', 'subject.id');
    return p
      .allow('update', isAsker)
      .allow('hide', p.and(p.contains('subject.roles', 'bookseller'), isAsker));
  })
  .build();
```

`build()` is the terminal. It flattens the blocks to the canonical matrix and
hands back an `Access` carrying the subject type and the key -> object-type map,
so every query checks its key and its object against what the blocks declared.
`.matrix` is the document on its own, for a caller that wants to overlay or ship
it. `JSON.stringify(access.matrix)` emits what a foreign backend would produce.

### Naming a rule

`.id(name)` names the rule the previous `allow()` or `deny()` wrote. A decision
reports that name as `rule`, and `diffMatrix` reads it as the rule's identity
across an edit. A rule that states no name gets one derived from its conditions
and its side, and a release that changes how a condition is represented changes
every derived id, so an audit row holding `allow-b72dadff` stops matching its
rule and nothing reports that it has.

<!-- #region rule-ids -->

```ts @import.meta.vitest
import { expect } from 'vitest';
import { policy } from '@evanion/acl';
import { AmbiguousRuleIdError, DuplicateRuleIdError } from '@evanion/acl';

type Subject = { id: string; roles: string[] };
type Listing = { sellerId: string; status: string };
type Objects = { listing: Listing };

const access = policy<Subject, Objects>()
  .for('listing', (p) =>
    p
      .allow('update', p.eq('object.sellerId', 'subject.id'))
      .id('seller-edits-own')
      .deny('update', p.eq('object.status', 'withdrawn'))
      .id('withdrawn-is-final'),
  )
  .build();

const seller = { id: 's1', roles: [] };
const listing = { sellerId: 's1', status: 'withdrawn' };
access.can(seller, 'listing', 'update', listing).rule; // -> 'withdrawn-is-final'

// An or() inside one allow() emits one rule per branch, and a name cannot
// name two of them.
expect(() =>
  policy<Subject, Objects>().for('listing', (p) =>
    p
      .allow(
        'update',
        p.or(
          p.eq('object.sellerId', 'subject.id'),
          p.contains('subject.roles', 'bookseller'),
        ),
      )
      .id('two-branches'),
  ),
).toThrow(AmbiguousRuleIdError);

// One name, one rule, across both sides of the permission.
expect(() =>
  policy<Subject, Objects>()
    .for('listing', (p) =>
      p
        .allow('update', p.eq('object.sellerId', 'subject.id'))
        .id('seller-edits-own')
        .deny('update', p.eq('object.status', 'withdrawn'))
        .id('seller-edits-own'),
    )
    .build(),
).toThrow(DuplicateRuleIdError);
```

<!-- #endregion rule-ids -->

`AmbiguousRuleIdError` names how many rules the call wrote, and an author who
wants a name per branch writes one `allow()` per branch. `.id()` refuses before
any `allow()` or `deny()`, and after `allowEach()` or `denyEach()`, where
`fields()` and `visibility()` refuse for the same reason.

`DuplicateRuleIdError` refuses a second rule carrying a name already taken in
that permission. The allow side and the deny side share one name space: a
derived id carries the side it sits on, and a decision reports `rule` with no
side next to it, so one name on both sides leaves a support answer pointing at
two rules that decide opposite ways.

### The document a typed policy emits

`version` and `schema` are document fields, so `policy()` takes them and puts
them in the document it flattens to rather than holding them beside it:

<!-- #region typed-document -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Question = { askedBy: string; status: string };

const access = policy<{ id: string }, { question: Question }>({
  version: 'orders@7',
  schema: {
    subject: { fields: { id: 'string' } },
    objects: {
      question: { fields: { askedBy: 'string', status: 'string' } },
    },
  },
})
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')),
  )
  .build();

JSON.stringify(access.matrix.version); // -> '"orders@7"'
```

<!-- #endregion typed-document -->

They sit on `policy()` rather than on a method at the end of the chain because
neither is a per-kind fact: `.for()` exists to write one kind's rules, and a
version and a schema are known before the first block is written.

A schema is written by hand. `policy<Subject, { question: Question }>()` holds
`Question` at the type level only, and a schema is runtime JSON, so nothing can
derive one from the type argument.

That makes the field-existence guarantee available twice on the typed path, and
the duplication is the point: TypeScript gives it to the author, and the schema
gives it to everyone downstream. The document travels; the types do not. A
consumer that adopts the emitted JSON with `parseMatrix` has no `Question` to
check against and gets the same guarantee from the schema. A typed author who
ships a document to nobody needs no schema.

The two are checked independently and can disagree. A path TypeScript accepts
because the type declares the field is still an `UnknownFieldError` at
construction when the schema does not declare it — the schema is binding
wherever it is present.

### Marking a typed permission for publication

`p.visibility('public')` marks the action most recently declared in the chain,
the way `p.fields()` attaches to it. The emitted permission carries the same
`visibility` field a hand-written document carries, so
`serialize(access, 'reduced')` reads a builder-authored matrix and a foreign one
the same way.

<!-- #region typed-contract -->

```ts @import.meta.vitest
import { policy, parseMatrix, serialize } from '@evanion/acl';

type Subject = { id: string; roles: string[]; tier: string };
type Order = { ownerId: string };
type Ledger = { period: string };

const orders = policy<
  Subject,
  { 'orders:order': Order; 'orders:ledger': Ledger },
  { 'orders:order': 'refund'; 'orders:ledger': 'reconcile' }
>({ version: 'orders@7' })
  .for('orders:order', (p) =>
    p
      .allow('refund', p.contains('subject.roles', 'bookseller'))
      .deny('refund', p.eq('subject.tier', 'probation'))
      .visibility('public'),
  )
  .for('orders:ledger', (p) =>
    p.allow('reconcile', p.contains('subject.roles', 'accountant')),
  )
  .build();

const contract = serialize(orders, 'reduced');
contract.permissions.map((p) => p.key); // -> ['orders:order.refund']

const bff = parseMatrix<Subject, { 'orders:order': Order }>(contract);
const bookseller = { id: 'u1', roles: ['bookseller'], tier: 'permanent' };
bff.can(bookseller, 'orders:order', 'refund').allowed; // -> true
```

<!-- #endregion typed-contract -->

An action nobody marks emits no `visibility` at all, which every reader takes as
`internal`, so the reduced document holds the marked actions and nothing else.
`p.visibility('internal')` writes the marking out where an author wants it on
the page.

## Field-level permissions

<!-- #region field-permissions -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

const access = policy<{ id: string }, { listing: { status: string } }>()
  .for('listing', (p) => p.allow('read', p.always).fields(['*', '!status']))
  .build();

const fd = access.canFields(
  { id: 's1' },
  'listing',
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

const access = policy<
  { id: string },
  { question: { askedBy: string; body: string; status: string } }
>()
  .for('question', (p) =>
    p
      .allow('update', p.eq('object.askedBy', 'subject.id'))
      .fields(['*', '!status']),
  )
  .build();

const current = { askedBy: 'c1', body: 'In stock?', status: 'open' };
const proposed = { body: 'Wingspan in stock?', status: 'locked' };

const fd = access.canFields(
  { id: 'c1' },
  'question',
  'update',
  current,
  'write',
  proposed,
);

fd.fields['status']; // -> 'denied'
JSON.stringify(pickAllowedFields(fd, proposed)); // -> '{"body":"Wingspan in stock?"}'
```

<!-- #endregion write-path -->

`pickAllowedFields` throws `ActionNotAllowedError` when the action itself is
refused: no field of a refused action is writable, and an empty object would
read as a lawful write of nothing. A field the action allows but the field rules
deny is a partial write, so that case returns the allowed subset.

## Foreign matrix

A backend that uses its own ACL can expose its matrix as JSON and the frontend
adopts it. The split is provenance: `hydratePolicy` is your own document coming
back, `parseMatrix` is somebody else's arriving, and only the second fails
closed on an unknown key.

The preset earns its five lines. A foreign document whose adopter forgot the
flag would throw on an unknown key instead of refusing, and which of the two a
document gets is the one thing these names have to make obvious.

<!-- #region foreign-matrix -->

```ts @import.meta.vitest
import { parseMatrix } from '@evanion/acl';

const access = parseMatrix({
  permissions: [
    {
      key: 'question.read',
      object: 'question',
      action: 'read',
      rules: [
        {
          when: [
            { field: 'subject.roles', op: 'contains', value: 'bookseller' },
          ],
        },
      ],
    },
  ],
});

access.can({ id: 's1' }, 'question', 'delete').reason; // -> 'unknown-action'
```

<!-- #endregion foreign-matrix -->

## One matrix per service

Across a fleet of services, each service authors and evaluates only the matrix
it owns. No service evaluates another's document to reach a decision, and there
is no merged matrix anywhere.

Object kinds are namespaced by origin — `storefront:listing`, `stock:listing` —
because two services that both say `listing` mean different rows, with different
fields, in different databases. The canonical key is unchanged:
`storefront:listing.read` still equals `` `${object}.${action}` `` character for
character. `.` is the key delimiter and is refused inside `object` and `action`
at construction, which is what makes `:` safe as the namespace separator.

A gateway or a BFF holds one `Access` per origin and merges no document.
`federatedPolicies` composes them: it refuses at construction when two origins
claim one permission key, routes each question to the one origin holding that
key, and settles a single instant for the view.

<!-- #region federation -->

```ts @import.meta.vitest
import { federatedPolicies, parseMatrix } from '@evanion/acl';
import type { Decision, Matrix } from '@evanion/acl';

const storefrontMatrix: Matrix = {
  permissions: [
    {
      key: 'storefront:listing.read',
      object: 'storefront:listing',
      action: 'read',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'owner' }] },
      ],
    },
  ],
};

const stockMatrix: Matrix = {
  permissions: [
    {
      key: 'stock:listing.read',
      object: 'stock:listing',
      action: 'read',
      rules: [
        {
          when: [
            { field: 'subject.roles', op: 'contains', value: 'bookseller' },
          ],
        },
      ],
    },
  ],
};

// One Access per origin. Each document belongs to the service that emitted it,
// so each arrives through `parseMatrix` and fails closed. Two origins claiming
// one key throw `OriginCollisionError` on this line, naming both.
const fleet = federatedPolicies({
  storefront: parseMatrix(storefrontMatrix),
  stock: parseMatrix(stockMatrix),
});

const subject = { id: 'u1', roles: ['bookseller'] };

// One advisory view for a UI, over one instant every origin reads.
const view: Record<string, Decision> = fleet.capabilities(subject);

Object.keys(view).sort(); // -> ['stock:listing.read', 'storefront:listing.read']
view['stock:listing.read']?.allowed; // -> true
view['storefront:listing.read']?.allowed; // -> false

// The origin holding the key answers it. A key nobody holds reaches no origin.
fleet.can(subject, 'stock:listing', 'read').allowed; // -> true
fleet.can(subject, 'shipping:parcel', 'read').reason; // -> 'unknown-action'

// The member itself, with `canMany`, `canFields`, `readsObject` and `authorize`
// on it, plus the document that origin published.
fleet.get('storefront')?.matrix.permissions.length; // -> 1
```

<!-- #endregion federation -->

That view is advisory, in the same tier as a browser's. Every service behind the
edge evaluates its own matrix for itself and never trusts the edge's answer.

An unreachable upstream needs no special handling. Its origin is absent from the
record, so every key it would have answered is already
`{ allowed: false, reason: 'unknown-action' }`.

One permission never gates another, inside one origin or across two. When a
request touches two services, the fan-out is the caller's own `&&` —
`a.can(…).allowed && b.can(…).allowed` — written where somebody knows whether
they meant AND or OR.

Integrity of a document in transit belongs to the transport, the same way
resolving a subject does: the library neither signs a matrix nor verifies one.

## A cross-cutting deny

A compliance or fraud team publishes deny rules for permissions it does not own.
The owning service fetches them and applies them in its own process, before it
constructs its policy:

```
authored matrix -> applyDenyOverlay -> hydratePolicy -> access
```

`applyDenyOverlay` appends each key's rules to that permission's `denyRules` and
returns a new matrix. Nothing merges at an edge, nothing but the owner is
authoritative, and the service that enforces the veto is the one that applies it.

The document at the end of that arrow is the one case the names do not divide
cleanly: the owner composed it in this process, so nothing was serialized and
nothing is foreign. It takes `hydratePolicy` because that is the open-mode
entry, and there the name is wider than its word.

<!-- #region deny-overlay -->

```ts @import.meta.vitest
import { applyDenyOverlay, hydratePolicy } from '@evanion/acl';
import type { DenyOverlay, Matrix } from '@evanion/acl';

// The owner's document. `schema.objects.refund` is what opening `refund.issue`
// to a veto obliges it to declare.
const authored: Matrix = {
  version: 'refunds@7',
  schema: {
    objects: { refund: { fields: { region: 'string', amount: 'number' } } },
  },
  permissions: [
    {
      key: 'refund.issue',
      object: 'refund',
      action: 'issue',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'owner' }] },
      ],
    },
  ],
};

// What compliance publishes. A contribution is a `Rule[]`, so it can state a
// deny and nothing else -- no allow, no dependency, no field rule.
const overlay: DenyOverlay = {
  'refund.issue': [
    {
      id: 'sanctions-hold',
      when: [{ field: 'object.region', op: 'eq', value: 'XX' }],
    },
  ],
};

const access = hydratePolicy(
  applyDenyOverlay(authored, overlay, { vetoable: ['refund.issue'] }),
  { version: 'refunds@7+veto@41' },
);

const operator = { id: 'u1', roles: ['owner'] };

access.can(operator, 'refund', 'issue', { region: 'SE', amount: 10 }).allowed; // -> true
access.can(operator, 'refund', 'issue', { region: 'XX', amount: 10 }).reason; // -> 'denied'
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

## Publishing the rules to a consumer

A BFF in front of an orders service needs to know whether to render a refund
button. Without an artifact to read, it writes its own matrix for somebody else's
rules, and that copy diverges on the first change nobody propagates. Divergence
this way is quiet: the orders service keeps refusing correctly, so nothing is
breached and no alert fires, and the button stays hidden against a server that
would have allowed the call.

`serialize(access, 'reduced')` gives the owner an artifact to hand over. Each
permission carries `visibility`, the reduced form keeps the `public` ones and
drops the rest, and an unmarked permission is internal, so an older document and
an author who forgot both publish nothing.

<!-- #region contract -->

```ts @import.meta.vitest
import { hydratePolicy, parseMatrix, serialize } from '@evanion/acl';
import type { Matrix } from '@evanion/acl';

const authored: Matrix = {
  version: 'orders@7',
  maxStale: 300_000,
  schema: {
    objects: {
      'orders:order': { fields: { ownerId: 'string' } },
      'orders:ledger': { fields: { period: 'string' } },
    },
  },
  permissions: [
    {
      key: 'orders:order.refund',
      object: 'orders:order',
      action: 'refund',
      visibility: 'public',
      rules: [
        {
          when: [
            { field: 'subject.roles', op: 'contains', value: 'bookseller' },
          ],
        },
      ],
      denyRules: [
        { when: [{ field: 'subject.tier', op: 'eq', value: 'probation' }] },
      ],
    },
    {
      key: 'orders:ledger.reconcile',
      object: 'orders:ledger',
      action: 'reconcile',
      visibility: 'internal',
      rules: [{ when: [] }],
    },
  ],
};

const orders = hydratePolicy(authored);
const contract = serialize(orders, 'reduced');

contract.permissions.map((p) => p.key); // -> ['orders:order.refund']
Object.keys(contract.schema?.objects ?? {}); // -> ['orders:order']
'visibility' in (contract.permissions[0] ?? {}); // -> false

// The consumer adopts it the way it adopts any foreign document, and reports
// when it last checked the contract was current.
const bff = parseMatrix(contract, { fetchedAt: Date.now() });
const bookseller = { id: 'u1', roles: ['bookseller'], tier: 'permanent' };

bff.can(bookseller, 'orders:order', 'refund').allowed; // -> true
bff.can(bookseller, 'orders:ledger', 'reconcile').reason; // -> 'unknown-action'
```

<!-- #endregion contract -->

A kept permission ships whole. Dropping one of its deny rules would turn a
refusal into an allow, and dropping an allow rule or a field config would move
the answer the other way, so a permission goes out with its refusals attached or
it stays internal. That cost lands on the owner: the deny rule above publishes
`subject.tier` and the word `probation` to every consumer.

The contract's decisions equal the owner's, key for key, which is the property
that makes it worth holding. Answering more conservatively would be a second copy
again, and a button hidden by caution looks exactly like a button hidden by a
rule.

A contract is terminal. Its permissions arrive unmarked, so a consumer's own
reduced serialization is empty and nobody re-publishes another team's rules.

### How long a consumer may keep deciding on it

`maxStale` is the owner's ceiling, in milliseconds, measured from the holder's
last successful freshness check. The holder reports that instant as `fetchedAt`
and may tighten the bound with its own `maxStale`, never extend it. Past
`fetchedAt + min(the two)` every key answers
`{ allowed: false, reason: 'stale-contract' }`, and the remedy is a fetch of the
document.

Measuring from the last check is what expires a consumer whose poll silently
stopped: such a consumer believes it is fresh and would never start a clock of
its own. A holder that reports no `fetchedAt` claims no freshness and runs under
no bound, which is every matrix a service authors in its own process.

A stale contract is stale-permissive, and that is survivable for one reason: the
owner re-evaluates on its own matrix on every call and refuses. A stale consumer
over-shows and never over-grants.

### A key another team may veto has to ship

`serialize(access, 'reduced', { vetoable })` refuses a listed key the reduction
would drop. Compliance checks its contribution by running `applyDenyOverlay`
against the published contract, and an internal vetoable key is absent from it,
taking its object kind's schema entry along, so that check would refuse every
contribution it was written to accept.

## Testing a contract you consume

`@evanion/acl/testing` is a secondary entry point. Importing `@evanion/acl`
pulls none of it in, it imports no test framework, and every helper returns a
value or throws a plain `Error`, so it runs under vitest, `node:test` and jest
alike.

A test that calls `can` and reads the decision needs none of it. What it is for
is the assertion a consumer gets wrong: a fixture matrix written by the consumer
to stand in for the producer's contract is a second copy of somebody else's
rules, which is the failure the contract removes. The consumer pins the
producer's document, fetches the current one in CI, and replays its own
questions against both.

`contractDrift` reports a removed key apart from a changed decision. The first
is a producer breaking a published contract. The second may be exactly what the
producer intended, and the consumer decides whether its UI still reads
correctly. An added key is neither, and `assertNoContractDrift` passes on one.

<!-- #region contract-drift -->

```ts @import.meta.vitest
import { contractDrift } from '@evanion/acl/testing';
import type { Matrix } from '@evanion/acl';

// The contract this consumer pinned, checked in beside the test.
const pinned: Matrix = {
  version: 'orders@7',
  permissions: [
    {
      key: 'orders:order.refund',
      object: 'orders:order',
      action: 'refund',
      rules: [
        {
          id: 'bookseller',
          when: [
            { field: 'subject.roles', op: 'contains', value: 'bookseller' },
          ],
        },
      ],
    },
    {
      key: 'orders:order.cancel',
      object: 'orders:order',
      action: 'cancel',
      rules: [{ id: 'anyone', when: [] }],
    },
  ],
};

// What the producer publishes now, fetched in CI. The refund key is gone.
const fetched: Matrix = {
  version: 'orders@8',
  permissions: [
    {
      key: 'orders:order.cancel',
      object: 'orders:order',
      action: 'cancel',
      rules: [{ id: 'anyone', when: [] }],
    },
  ],
};

const staff = { id: 'u1', roles: ['bookseller'] };

const drift = contractDrift({
  pinned,
  fetched,
  // The decisions this application renders, named the way a reader reads them.
  cases: [
    {
      name: 'the refund button',
      subject: staff,
      key: 'orders:order',
      action: 'refund',
    },
    {
      name: 'the cancel button',
      subject: staff,
      key: 'orders:order',
      action: 'cancel',
    },
  ],
});

drift.removed; // -> ['orders:order.refund']
drift.changed.map((change) => change.name); // -> ['the refund button']
drift.changed[0]?.fetched.reason; // -> 'unknown-action'
```

<!-- #endregion contract-drift -->

### A red build when a replayed decision changes

`assertNoContractDrift` runs `contractDrift` and throws a `ContractDriftError`
when the producer removed a published key or a replayed decision changed. The
error carries the whole `report`, and its message is `describeContractDrift` of
that report. `ContractDriftError` extends `AclAssertionError`, which is the base
class every refusal in this entry point raises.

<!-- #region drift-assert -->

```ts @import.meta.vitest
import { AclAssertionError } from '@evanion/acl/testing';
import { ContractDriftError } from '@evanion/acl/testing';
import { assertNoContractDrift } from '@evanion/acl/testing';
import { describeContractDrift } from '@evanion/acl/testing';
import type { Matrix } from '@evanion/acl';

const refund = (role: string): Matrix => ({
  version: role === 'bookseller' ? 'orders@7' : 'orders@8',
  permissions: [
    {
      key: 'orders:order.refund',
      object: 'orders:order',
      action: 'refund',
      rules: [
        {
          id: 'staff',
          when: [{ field: 'subject.roles', op: 'contains', value: role }],
        },
      ],
    },
  ],
});

// The producer kept the key and narrowed the role that holds it.
const staff = { id: 'u1', roles: ['bookseller'] };

let caught: unknown;
try {
  assertNoContractDrift({
    pinned: refund('bookseller'),
    fetched: refund('supervisor'),
    cases: [
      {
        name: 'the refund button',
        subject: staff,
        key: 'orders:order',
        action: 'refund',
      },
    ],
  });
} catch (error) {
  caught = error;
}

const drift = caught as ContractDriftError;
drift instanceof AclAssertionError; // -> true
drift.report.removed; // -> []
drift.report.changed[0]?.fetched.reason; // -> 'no-rule-matched'
describeContractDrift(drift.report).split('\n')[0]; // -> 'contract drift, orders@7 -> orders@8'
```

<!-- #endregion drift-assert -->

### The whole document diff at the same seam

`options.diff` is a `MatrixDiffer<D>`, a `(pinned, fetched) => D`.
`contractDrift` reads nothing out of the result and carries it onto
`report.diff`, so passing `diffMatrix` types `report.diff` as a `MatrixDiff` and
passing nothing leaves it `undefined`. The replayed cases say what this
application's own screens do; the diff says what moved in the document behind
them.

<!-- #region drift-seam -->

```ts @import.meta.vitest
import { diffMatrix } from '@evanion/acl';
import { contractDrift } from '@evanion/acl/testing';
import type { Matrix } from '@evanion/acl';

const bookseller = {
  id: 'staff',
  when: [{ field: 'subject.roles', op: 'contains', value: 'bookseller' }],
} as const;

const supervisor = {
  id: 'supervisor',
  when: [{ field: 'subject.roles', op: 'contains', value: 'supervisor' }],
} as const;

const contract = (version: string, rules: readonly unknown[]): Matrix =>
  ({
    version,
    permissions: [
      {
        key: 'orders:order.refund',
        object: 'orders:order',
        action: 'refund',
        rules,
      },
    ],
  }) as Matrix;

const report = contractDrift({
  pinned: contract('orders@7', [bookseller]),
  fetched: contract('orders@8', [bookseller, supervisor]),
  diff: diffMatrix,
});

report.changed; // -> []
report.diff?.unchanged; // -> false
report.diff?.findings.map((finding) => finding.kind); // -> ['granted']
```

<!-- #endregion drift-seam -->

### Reaching `stale-contract` on purpose

`stale-contract` is the refusal a consumer's UI meets in production and never in
development, because a matrix authored in-process reports no `fetchedAt` and
runs under no bound. `fixtureClock` computes the budget the way the engine
computes it and names the two instants that bracket it: `fresh` is the last one
every key still decides on, `stale` the first one that answers
`stale-contract`.

<!-- #region fixture-clock -->

```ts @import.meta.vitest
import { parseMatrix } from '@evanion/acl';
import { assertRefused, fixtureClock } from '@evanion/acl/testing';
import type { Matrix } from '@evanion/acl';

const contract: Matrix = {
  version: 'orders@7',
  maxStale: 300_000,
  permissions: [
    {
      key: 'orders:order.refund',
      object: 'orders:order',
      action: 'refund',
      rules: [{ id: 'anyone', when: [] }],
    },
  ],
};

const clock = fixtureClock(contract, { fetchedAt: '2026-01-01T00:00:00Z' });
const bff = parseMatrix(contract, clock.options);
const shopper = { id: 'u1' };

const inside = bff.can(
  shopper,
  'orders:order',
  'refund',
  undefined,
  clock.fresh,
);
inside.reason; // -> 'allow'

// `assertRefused` names the key, the reason and the rule when it throws, so a
// failure says which refusal arrived instead of `false !== true`.
const past = bff.can(shopper, 'orders:order', 'refund', undefined, clock.stale);
assertRefused(past, 'stale-contract').allowed; // -> false
```

<!-- #endregion fixture-clock -->

### Assertions that name the reason

`assertAllowed` returns the decision it was given, or throws naming the key, the
reason, the rule and the missing paths. `assertRefused` is the same for a
refusal and takes the `reason` to assert. `assertFieldState` asserts one field
of a `canFields` decision, and reports a field the decision carries no entry for
apart from a field in the wrong state. `explainDecision` and
`explainFieldDecision` are the one-line renderings those three throw, available
on their own for a message a test assembles itself.

<!-- #region consumer-assertions -->

```ts @import.meta.vitest
import { parseMatrix } from '@evanion/acl';
import { AclAssertionError } from '@evanion/acl/testing';
import { assertAllowed } from '@evanion/acl/testing';
import { assertFieldState } from '@evanion/acl/testing';
import { explainDecision } from '@evanion/acl/testing';
import { explainFieldDecision } from '@evanion/acl/testing';
import type { Matrix } from '@evanion/acl';

const contract: Matrix = {
  version: 'orders@8',
  permissions: [
    {
      key: 'orders:order.update',
      object: 'orders:order',
      action: 'update',
      rules: [
        {
          id: 'staff',
          when: [
            { field: 'subject.roles', op: 'contains', value: 'bookseller' },
          ],
        },
      ],
      fields: { fields: ['note'] },
    },
  ],
};

const storefront = parseMatrix(contract);
const staff = { id: 'u1', roles: ['bookseller'] };

const decision = storefront.can(staff, 'orders:order', 'update');
assertAllowed(decision, 'the order editor').rule; // -> 'staff'
explainDecision(decision); // -> '"orders:order.update" allowed with reason "allow", from rule "staff"'

const fields = storefront.canFields(
  staff,
  'orders:order',
  'update',
  { note: 'held for pickup' },
  'write',
);
assertFieldState(fields, 'note', 'allowed').allowed; // -> true
explainFieldDecision(fields); // -> '"orders:order.update" allowed with reason "allow", from rule "staff"; note: allowed (allow)'

let caught: unknown;
try {
  assertFieldState(fields, 'total', 'allowed');
} catch (error) {
  caught = error;
}

const failure = caught as AclAssertionError;
failure instanceof AclAssertionError; // -> true
failure.message; // -> '"orders:order.update" has no field "total": it carries note'
```

<!-- #endregion consumer-assertions -->

## Server-side `authorize`

`authorize` binds a subject so a middleware, loader, action, or RSC server
component evaluates without restating it.

<!-- #region server-authorize -->

```ts @import.meta.vitest
import { policy, type Action } from '@evanion/acl';

type Shopper = { id: string; roles: string[] };

// One policy, every object kind the app has. A `.for()` per kind, and one
// bound handle answers for all of them.
type Shelf = { report: { id: string }; listing: { id: string } };

// `report` grants a verb outside the default CRUD set, so it names its own
// vocabulary. `listing` omits one and takes `Action`.
const access = policy<Shopper, Shelf, { report: Action | 'export' }>()
  .for('report', (p) =>
    p
      .allow('read', p.contains('subject.roles', 'bookseller'))
      .allow('export', p.contains('subject.roles', 'owner')),
  )
  .for('listing', (p) => p.allow('read', p.contains('subject.roles', 'owner')))
  .build();

const forUser = access.authorize({ id: 'u1', roles: ['bookseller'] });
forUser.can('report', 'read').allowed; // -> true
forUser.can('report', 'export').reason; // -> 'no-rule-matched'
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
import { policy } from '@evanion/acl';

type Listing = { id: string; locked: boolean };

const access = policy<{ id: string; roles: string[] }, { listing: Listing }>()
  .for('listing', (p) =>
    p
      .allow('read', p.contains('subject.roles', 'owner'))
      .allow('update', p.always)
      .deny('update', p.eq('object.locked', true)),
  )
  .build();

access.readsObject('listing', 'read'); // -> false
access.readsObject('listing', 'update'); // -> true
```

<!-- #endregion reads-object -->

True when any allow rule or any deny rule of this permission names an
`object.*` path, on either operand. It takes no subject: the answer is a fact
about the matrix. Field rules do not count, since a `transitions` config reads the object
only on the `canFields` write axis, where the caller holds the row already.

## What a deploy changed

`diffMatrix(before, after)` compares two matrix documents and reports access
rather than text. A reviewer reading a line-by-line document diff has to hold
the precedence order in their head to work out what moved. A finding states it.

The evaluator ORs the rules on a side, so a side that has matched goes on
matching whatever is appended to it. An added allow branch can therefore only
widen and an added deny branch can only narrow, and the added branch is the
reviewer's sentence, because its conditions are what an author wrote. A rule is
identified by a hash of its conditions, so a reordered document reports nothing.

<!-- #region diff-matrix -->

```ts @import.meta.vitest
import { diffMatrix, findingsOf } from '@evanion/acl';
import type { Condition, Matrix } from '@evanion/acl';

const isOwner: Condition = {
  field: 'subject.roles',
  op: 'contains',
  value: 'owner',
};
const isBookseller: Condition = {
  field: 'subject.roles',
  op: 'contains',
  value: 'bookseller',
};
const ownListing: Condition = {
  field: 'subject.id',
  op: 'eq',
  path: 'object.sellerId',
};

const reprice = {
  key: 'listing.reprice',
  object: 'listing',
  action: 'reprice',
} as const;

const before: Matrix = {
  version: 'listings@7',
  permissions: [{ ...reprice, rules: [{ when: [isOwner] }] }],
};

// One branch appended: a bookseller may reprice a listing they sell.
const after: Matrix = {
  version: 'listings@8',
  permissions: [
    {
      ...reprice,
      rules: [{ when: [isOwner] }, { when: [isBookseller, ownListing] }],
    },
  ],
};

const diff = diffMatrix(before, after);

diff.unchanged; // -> false
diff.version; // -> { before: 'listings@7', after: 'listings@8' }

const granted = findingsOf(diff, 'granted');

granted[0]?.key; // -> 'listing.reprice'
granted[0]?.cause; // -> 'allow-branch-added'
granted[0]?.groups.subject; // -> [isBookseller]
granted[0]?.groups.object; // -> [ownListing]
granted[0]?.groups.window; // -> []
```

<!-- #endregion diff-matrix -->

`groups` splits the branch for rendering. `subject` is who gained the access,
`object` is which rows, and `window` is the `now` conditions. A condition
comparing a subject path against an object path lands in `object`, because it
restricts rows rather than people.

Four things the report cannot derive, and it states each rather than guessing:

- How many people a grant describes. The report names a condition and never a
  headcount, so findings cannot be ranked by blast radius.
- Whether a grant overlaps one already in force. The report names the added
  branch whole, so a reviewer may read a grant that was already granted.
- Whether an added branch grants anything. A branch ANDing
  `subject.role eq 'owner'` with `subject.role eq 'bookseller'` is
  unsatisfiable, and the report calls it a grant.
- What an edit did. A rule that kept an author-supplied `id` and changed its
  conditions, and a permission whose allow side and deny side both moved, come
  back as `undetermined` with both versions attached.

Each of those fails toward reporting a grant, which is the direction a reviewer
can check.

### A change that widens nothing and breaks every caller

A permission that gains a deny rule reading `object.locked` grants nobody
anything new. The narrowing is reported as `deny-branch-added`, and it is the
smaller half of what the edit did. Every caller deciding without the row also
breaks: the decision that answered `allow` answers `unevaluable` naming the
path it now needs. `diffMatrix` reports that second consequence as a finding of
its own.

<!-- #region diff-reads-object -->

```ts @import.meta.vitest
import { diffMatrix, findingsOf, parseMatrix } from '@evanion/acl';
import type { Matrix } from '@evanion/acl';

type Staff = { id: string; roles: string[] };
type Objects = { listing: { locked?: boolean } };

const read = {
  key: 'listing.read',
  object: 'listing',
  action: 'read',
  rules: [
    { when: [{ field: 'subject.roles', op: 'contains', value: 'bookseller' }] },
  ],
} as const;

const before: Matrix = { version: 'listings@7', permissions: [read] };

const after: Matrix = {
  version: 'listings@8',
  permissions: [
    {
      ...read,
      denyRules: [
        { when: [{ field: 'object.locked', op: 'eq', value: true }] },
      ],
    },
  ],
};

const seller: Staff = { id: 'u1', roles: ['bookseller'] };

// A gateway that decides in front of the fetch passes no listing.
const was = parseMatrix<Staff, Objects>(before).can(seller, 'listing', 'read');
const now = parseMatrix<Staff, Objects>(after).can(seller, 'listing', 'read');

was.allowed; // -> true
now.allowed; // -> false
now.reason; // -> 'unevaluable'
now.missing; // -> ['object.locked']

const diff = diffMatrix(before, after);

// The narrowing, which is what the added deny branch did to the allowed set.
const withdrawn = findingsOf(diff, 'withdrawn');
withdrawn[0]?.cause; // -> 'deny-branch-added'

// The second finding, which is what it did to every caller.
const reads = findingsOf(diff, 'reads-object');

reads[0]?.before; // -> false
reads[0]?.after; // -> true
reads[0]?.paths.after; // -> ['object.locked']
```

<!-- #endregion diff-reads-object -->

## What refuses a document

Each refusal below names the value it refused and where that value sits, so a
build log identifies the line to change. Every case names its input first,
because the name is what the message will be about.

<!-- #region errors-document -->

```ts @import.meta.vitest
import { parseMatrix } from '@evanion/acl';

/** The error a call raises, by name, or `undefined` when it raises none. */
function raised(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as Error).name;
  }
  return undefined;
}

const read = {
  key: 'doc.read',
  object: 'doc',
  action: 'read',
  rules: [{ when: [] }],
};

const noPermissions = { version: 'v1' } as never;
const objectVersion = { version: {}, permissions: [] } as never;
const wrongKey = {
  version: 'v1',
  permissions: [{ ...read, key: 'doc.write' }],
} as never;
const twice = { version: 'v1', permissions: [read, read] } as never;
const noAction = {
  version: 'v1',
  permissions: [{ key: 'doc.read', object: 'doc' }],
} as never;
const whenIsString = {
  version: 'v1',
  permissions: [{ ...read, rules: [{ when: 'x' }] }],
} as never;

raised(() => parseMatrix(noPermissions)); // -> 'InvalidMatrixError'
raised(() => parseMatrix(objectVersion)); // -> 'InvalidMatrixError'
raised(() => parseMatrix(wrongKey)); // -> 'KeyMismatchError'
raised(() => parseMatrix(twice)); // -> 'DuplicatePermissionError'
raised(() => parseMatrix(noAction)); // -> 'InvalidPermissionError'
raised(() => parseMatrix(whenIsString)); // -> 'InvalidRuleError'

// Three conditions, one class. The message tells them apart.
const when = (condition: unknown) =>
  ({
    version: 'v1',
    permissions: [{ ...read, rules: [{ when: [condition] }] }],
  }) as never;

const unknownOp = when({ field: 'subject.id', op: 'nope', value: 1 });
const twoDots = when({ field: 'subject.a.b', op: 'eq', value: 1 });
const noScope = when({ field: 'user.id', op: 'eq', value: 1 });

raised(() => parseMatrix(unknownOp)); // -> 'InvalidConditionError'
raised(() => parseMatrix(twoDots)); // -> 'InvalidConditionError'
raised(() => parseMatrix(noScope)); // -> 'InvalidConditionError'
```

<!-- #endregion errors-document -->

An `InvalidConditionError` carries `key`, `field` and `where`, and `where` is
the path to the condition inside the permission:

<!-- #region errors-condition-where -->

```ts @import.meta.vitest
import { parseMatrix } from '@evanion/acl';

/** What an `InvalidConditionError` carries beside its message. */
type Located = Error & {
  key?: string;
  field?: string;
  where?: string;
};

const twoDots = {
  version: 'v1',
  permissions: [
    {
      key: 'doc.read',
      object: 'doc',
      action: 'read',
      rules: [{ when: [{ field: 'subject.a.b', op: 'eq', value: 1 }] }],
    },
  ],
} as never;

let caught: Located | undefined;
try {
  parseMatrix(twoDots);
} catch (error) {
  caught = error as Located;
}

caught?.name; // -> 'InvalidConditionError'
caught?.key; // -> 'doc.read'
caught?.field; // -> 'subject.a.b'
caught?.where; // -> 'rules[0].when[0]'
```

<!-- #endregion errors-condition-where -->

## What refuses a schema or a field rule

A schema is checked for its own shape, and then every condition naming a
declared kind is checked against it. Field rules are checked with or without
one.

<!-- #region errors-schema-fields -->

```ts @import.meta.vitest
import { parseMatrix } from '@evanion/acl';

function raised(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as Error).name;
  }
  return undefined;
}

const read = {
  key: 'doc.read',
  object: 'doc',
  action: 'read',
  rules: [{ when: [] }],
};
const schema = { objects: { doc: { fields: { title: 'string' } } } };

const unknownType = {
  version: 'v1',
  schema: { objects: { doc: { fields: { title: 'nope' } } } },
  permissions: [read],
} as never;

const undeclaredField = {
  version: 'v1',
  schema,
  permissions: [
    {
      ...read,
      rules: [{ when: [{ field: 'object.missing', op: 'eq', value: 1 }] }],
    },
  ],
} as never;

const containsOnString = {
  version: 'v1',
  schema,
  permissions: [
    {
      ...read,
      rules: [
        { when: [{ field: 'object.title', op: 'contains', value: 'x' }] },
      ],
    },
  ],
} as never;

raised(() => parseMatrix(unknownType)); // -> 'InvalidSchemaError'
raised(() => parseMatrix(undeclaredField)); // -> 'UnknownFieldError'
raised(() => parseMatrix(containsOnString)); // -> 'FieldTypeMismatchError'

const fields = (rules: unknown) =>
  ({ version: 'v1', permissions: [{ ...read, fields: rules }] }) as never;

const bangInList = fields({ fields: ['title', '!price'] });
const bangNoBaseline = fields({ fields: ['!price'] });
const bothConfigs = fields({
  status: { targets: ['open'], transitions: { open: [] } },
});

raised(() => parseMatrix(bangInList)); // -> 'BangInAllowListError'
raised(() => parseMatrix(bangNoBaseline)); // -> 'DenyWithoutBaselineError'
raised(() => parseMatrix(bothConfigs)); // -> 'TargetsTransitionsConflictError'
```

<!-- #endregion errors-schema-fields -->

## What a query raises, and what it refuses instead

`hydratePolicy` is the open path and throws on a key the document never held,
because a local document is source and a missing key is an authoring mistake.
`parseMatrix` is the closed path and answers `unknown-action`, because a
foreign document is input and a query against it must refuse rather than end
the request.

<!-- #region errors-query -->

```ts @import.meta.vitest
import { hydratePolicy, parseMatrix } from '@evanion/acl';

function raised(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as Error).name;
  }
  return undefined;
}

const document = {
  version: 'v1',
  permissions: [
    { key: 'doc.read', object: 'doc', action: 'read', rules: [{ when: [] }] },
  ],
} as never;

const open = hydratePolicy(document);
const closed = parseMatrix(document);

// The document holds `doc.read` and nothing else. A query naming anything
// else is typed `never` here, because a caller writing one has already left
// what the document declares.
const anyone = {} as never;
const doc = 'doc' as never;
const readAction = 'read' as never;
const noSuchAction = 'write' as never;
const noSuchKind = 'thing' as never;

raised(() => open.can(anyone, doc, noSuchAction)); // -> 'UnknownPermissionError'
raised(() => open.can(anyone, noSuchKind, readAction)); // -> 'UnknownObjectKeyError'

const refused = closed.can(anyone, doc, noSuchAction);

refused.allowed; // -> false
refused.reason; // -> 'unknown-action'
```

<!-- #endregion errors-query -->

Freshness raises where the holder is built, not where a decision is asked for,
so a misconfigured holder fails at startup:

<!-- #region errors-freshness -->

```ts @import.meta.vitest
import { parseMatrix } from '@evanion/acl';

function raised(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as Error).name;
  }
  return undefined;
}

const read = {
  key: 'doc.read',
  object: 'doc',
  action: 'read',
  rules: [{ when: [] }],
};
const stateless = { version: 'v1', permissions: [read] } as never;
const bounded = { version: 'v1', maxStale: 1000, permissions: [read] } as never;

const reported = { fetchedAt: 0 };
const notAnInstant = { fetchedAt: 'nope' } as never;

raised(() => parseMatrix(stateless, reported)); // -> 'MissingFreshnessBudgetError'
raised(() => parseMatrix(bounded, notAnInstant)); // -> 'InvalidFreshnessError'
```

<!-- #endregion errors-freshness -->

## What refuses a composition

<!-- #region errors-composition -->

```ts @import.meta.vitest
import { applyDenyOverlay, federatedPolicies } from '@evanion/acl';
import { parseMatrix, policy, serialize } from '@evanion/acl';

function raised(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as Error).name;
  }
  return undefined;
}

const read = {
  key: 'doc.read',
  object: 'doc',
  action: 'read',
  rules: [{ when: [] }],
};
const plain = { version: 'v1', permissions: [read] } as never;
const declared = {
  version: 'v1',
  schema: { objects: { doc: { fields: { locked: 'boolean' } } } },
  permissions: [read],
} as never;

const twoOrigins = { a: parseMatrix(plain), b: parseMatrix(plain) } as never;
const veto = { 'doc.read': [{ when: [] }] };
const locked = { field: 'object.locked', op: 'eq' as const, value: true };
const lockedVeto = { 'doc.read': [{ when: [locked] }] };
const noKeyOpened = { vetoable: [] };
const opened = { vetoable: ['doc.read'] };

raised(() => federatedPolicies(twoOrigins)); // -> 'OriginCollisionError'
raised(() => applyDenyOverlay(plain, veto, noKeyOpened)); // -> 'UnvetoablePermissionError'
raised(() => applyDenyOverlay(plain, veto, opened)); // -> 'MissingVetoSchemaError'
raised(() => applyDenyOverlay(declared, lockedVeto, opened)); // -> undefined

const internalOnly = policy<{ id: string }, { doc: { id: string } }>()
  .for('doc', (p) => p.allow('read', p.always))
  .build();
const asContract = { vetoable: ['doc.read'] } as never;

raised(() => serialize(internalOnly, 'reduced', asContract)); // -> 'UnpublishedVetoableError'
```

<!-- #endregion errors-composition -->

## Catching every acl refusal at once

<!-- #region errors-catching -->

```ts @import.meta.vitest
import { AclConfigError, parseMatrix } from '@evanion/acl';
import { pickAllowedFields, policy } from '@evanion/acl';

const malformed = { version: 'v1' } as never;

let base: Error | undefined;
try {
  parseMatrix(malformed);
} catch (error) {
  base = error as Error;
}

// Every class the package raises at construction extends this one, so a
// startup guard catches the set without naming each member.
base instanceof AclConfigError; // -> true
base instanceof Error; // -> true

// `pickAllowedFields` is the one throw outside construction and query. No
// field of a refused action is writable, so it refuses rather than returning
// an object a handler would write. It is not a configuration fault, so it sits
// outside `AclConfigError`: a startup guard around construction does not catch
// it, and a request handler has to.
const access = policy<{ id: string }, { doc: { id: string; title: string } }>()
  .for('doc', (p) => p.allow('update', p.eq('subject.id', 'nobody')))
  .build();

const row = { id: 'd1', title: 'before' };
const proposed = { title: 'after' };
const decided = access.canFields(
  { id: 'u1' },
  'doc',
  'update',
  row,
  'write',
  proposed,
);

decided.action.allowed; // -> false

let refusedWrite: Error | undefined;
try {
  pickAllowedFields(decided, proposed);
} catch (error) {
  refusedWrite = error as Error;
}

refusedWrite?.name; // -> 'ActionNotAllowedError'
refusedWrite instanceof AclConfigError; // -> false
refusedWrite instanceof Error; // -> true
```

<!-- #endregion errors-catching -->

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
state machine and its terminal states, and every time window and its
boundaries. That is a map of the privilege model and of
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
reaches `can` from a client payload — a request body, a query string, anything
the browser sent — hands the client every time window in the matrix. Pass it
only to make a server render and the client's first render agree, and resolve
it server-side.

In a browser the wall clock belongs to the subject. Setting the system clock
back re-opens a window that has closed, and the library cannot detect it,
because the clock is an argument. A role condition reads the subject a server
resolved; a time condition reads a value the subject's machine produced. Both
are advisory in a browser, and the second is the weaker of the two. A server
passing its own `now` is unaffected.

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
`eq('object.sharedWith', 'subject.id')` is the obvious trap, allowing
a user to put their own id in the share field and be authorized for it. Either keep
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
import { hydratePolicy } from '@evanion/acl';
import type { Access, Matrix } from '@evanion/acl';

/** Rebuild when the served document moved; otherwise keep the one in hand. */
function revalidate(current: Access, served: Matrix): Access {
  return current.version === served.version ? current : hydratePolicy(served);
}

const served: Matrix = {
  version: 'orders@8',
  permissions: [
    { key: 'question.read', object: 'question', action: 'read', rules: [] },
  ],
};

let access = hydratePolicy({ ...served, version: 'orders@7' });
access = revalidate(access, served);
access.version; // -> 'orders@8'
```

<!-- #endregion revalidate -->

Until that runs, the client grants what it last fetched. Nothing pushes an
update to a holder. A holder that reports `fetchedAt` gets a freshness budget
from the document's `maxStale`, and past `fetchedAt + min(maxStale,
options.maxStale)` every key answers `stale-contract`. A holder that reports no
`fetchedAt` claims no freshness and runs under no expiry.

## API

| Export                                                                                     | Purpose                                                                                    |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `policy<S, O, V>(options?)`                                                                | Typed authoring; `.for(key, block)` per object kind, `.build()` for the evaluator.         |
| `hydratePolicy(matrix, options?)`                                                          | An evaluator over a document you already have. Validates, clones and freezes.              |
| `parseMatrix(json, options?)`                                                              | Adopts somebody else's document; fails closed on unknown keys.                             |
| `p.allow` / `p.deny` / `p.fields`                                                          | Declare one action inside a `.for()` block.                                                |
| `p.eq` / `ne` / `in` / `notIn` / `contains` / `before` / `after` / `and` / `or` / `always` | Build a permission's conditions, path-checked against the block's types.                   |
| `access.object(key)`                                                                       | A handle bound to one object kind, so the key is named once.                               |
| `access.can(subject, key, action, object?, now?)`                                          | One decision.                                                                              |
| `access.canMany(...)`                                                                      | A decision array, parallel to the input.                                                   |
| `access.canFields(...)`                                                                    | The field-level decision for one axis, plus the action decision gating it.                 |
| `pickAllowedFields(decision, proposed)`                                                    | The subset of a proposed write the decision allows. The value to write.                    |
| `access.capabilities(subject)`                                                             | Every action-level decision.                                                               |
| `access.readsObject(key, action)`                                                          | Whether the permission needs the object row at all. Takes no subject.                      |
| `access.authorize(subject)`                                                                | A bound handle for server-side evaluation. Decisions only; the document stays on `access`. |
| `access.matrix`                                                                            | The frozen document. Round-trips through JSON; this is what crosses SSR.                   |
| `access.version` / `access.schema`                                                         | The effective version, and the declared shapes when the document carries them.             |

`@evanion/acl/testing` is a separate entry point, for a consumer asserting its
decisions against a producer's published contract.

| Export                                                 | Purpose                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `contractDrift({ pinned, fetched, cases, now, diff })` | What moved between two versions of a contract: keys removed, keys added, decisions changed. |
| `assertNoContractDrift(options)`                       | The same, thrown as a `ContractDriftError`. An added key passes.                            |
| `describeContractDrift(report)`                        | The report as a reader sees it, removals first.                                             |
| `fixtureClock(matrix, options?)`                       | The freshness budget's two edges, `fresh` and `stale`, plus the `AccessOptions` for them.   |
| `assertAllowed(decision, context?)`                    | Returns the decision, or throws naming the reason, the rule and the missing paths.          |
| `assertRefused(decision, reason?, context?)`           | The same for a refusal, optionally asserting which one.                                     |
| `assertFieldState(decision, field, state, context?)`   | One field of a `canFields` decision, with the whole decision in the message.                |
| `explainDecision` / `explainFieldDecision`             | One line naming everything a decision carries.                                              |

A decision carries `allowed` plus an output-only `reason` (`allow`,
`no-rule-matched`, `denied`, `unknown-action`, `unevaluable`,
`unusable-clock`, `stale-contract`). Nothing in the library reads a `reason` back to decide
anything.

### The clock

`now` is an `Instant` — an ISO 8601 string, epoch milliseconds, or a `Date` —
wherever it is taken, which is the same type a `before`/`after` condition value
takes. A context that crossed JSON carries a string and is passed through as
it stands:

<!-- #region clock -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

const access = policy<
  { id: string },
  { sale: { id: string } },
  { sale: 'buy' }
>()
  .for('sale', (p) => p.allow('buy', p.after('now', '2026-01-01T00:00:00Z')))
  .build();

const crossed = JSON.parse(
  JSON.stringify({ now: new Date('2026-06-01T00:00:00Z') }),
) as { now: string };

const open = access.can({ id: 's1' }, 'sale', 'buy', undefined, crossed.now);
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
