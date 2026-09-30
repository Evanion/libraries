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

ESM only. Node 20 or newer. Nothing else enters the import graph.

## The first policy

The smallest policy that answers a question, and the answers it gives. Baize's
staff carry the `bookseller` role, and a bookseller may delete any question:

<!-- #region first-policy -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

// Anyone signed in to Baize: a customer, or a bookseller on the shop's staff.
type Shopper = { id: string; roles: string[] };
type Question = { id: string; askedBy: string };

// Built once, at module scope, when the server loads this module.
const access = policy<Shopper, { question: Question }>()
  .for('question', (p) =>
    p.allow('delete', p.contains('subject.roles', 'bookseller')),
  )
  .build();

const bookseller = { id: 'staff-3', roles: ['bookseller'] };
const customer = { id: 'customer-41', roles: ['customer'] };
const question = { id: 'q7', askedBy: 'customer-41' };

access.can(bookseller, 'question', 'delete', question).allowed; // -> true
access.can(customer, 'question', 'delete', question).allowed; // -> false
access.can(customer, 'question', 'delete', question).reason; // -> 'no-rule-matched'
```

<!-- #endregion first-policy -->

`allowed` is the answer and `reason` says which branch of the engine produced
it. `no-rule-matched` is the default deny: nothing in the document granted the
customer the action, so the engine refused without any rule saying to.

`access.matrix` holds the same rules as a JSON value. Another process, such as
a browser, rebuilds an evaluator from it with `hydratePolicy`, and that
evaluator gives the same answers:

<!-- #region first-copy -->

```ts @import.meta.vitest
import { hydratePolicy, policy } from '@evanion/acl';

type Shopper = { id: string; roles: string[] };
type Question = { id: string; askedBy: string };

const access = policy<Shopper, { question: Question }>()
  .for('question', (p) =>
    p.allow('delete', p.contains('subject.roles', 'bookseller')),
  )
  .build();

const bookseller = { id: 'staff-3', roles: ['bookseller'] };
const customer = { id: 'customer-41', roles: ['customer'] };
const question = { id: 'q7', askedBy: 'customer-41' };
// ---cut---
// The server sends the matrix as JSON text, and the browser rebuilds from it.
const json = JSON.stringify(access.matrix);
const inBrowser = hydratePolicy(JSON.parse(json));

inBrowser.can(bookseller, 'question', 'delete', question).allowed; // -> true
inBrowser.can(customer, 'question', 'delete', question).allowed; // -> false
```

<!-- #endregion first-copy -->

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

## Rules that read the row

A subject condition cannot tell apart two customers who hold the same roles. A
condition on an `object.*` path reads the row the call carries, so one rule
tells the customer who asked a question from the customer who did not:

<!-- #region object-condition -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Customer = { id: string; roles: string[] };
type Question = { listing: string; askedBy: string };

const access = policy<Customer, { question: Question }>()
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')),
  )
  .build();

// The same roles, so nothing on the subject tells them apart.
const sam = { id: 'sam', roles: ['customer'] };
const jo = { id: 'jo', roles: ['customer'] };
const question = { listing: 'urn:game:brass-birmingham', askedBy: 'sam' };

access.can(sam, 'question', 'update', question).allowed; // -> true
access.can(jo, 'question', 'update', question).allowed; // -> false
```

<!-- #endregion object-condition -->

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

### The whole decision

A `Decision` is one plain object. `rule` and `missing` appear only on the
reasons that carry them, so a decision whose deny side could not be read holds
all five fields:

<!-- #region decision-shape -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';
import type { Decision } from '@evanion/acl';

type Question = { askedBy: string; status: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p
      .allow('update', p.eq('object.askedBy', 'subject.id'))
      .deny('update', p.eq('object.status', 'locked'))
      .id('locked-question'),
  )
  .build();

// The list query selected `askedBy` and not `status`.
const decision: Decision = access.can({ id: 's1' }, 'question', 'update', {
  askedBy: 's1',
});
decision; // -> { key: 'question.update', allowed: false, reason: 'unevaluable', rule: 'locked-question', missing: ['object.status'] }
```

<!-- #endregion decision-shape -->

### Gating on one

Five reasons refuse without any deny rule matching. A gate that tests
`reason !== 'denied'` proceeds through every one of them, and a gate on
`allowed` proceeds through none:

<!-- #region gate-on-allowed -->

```ts @import.meta.vitest
import { parseMatrix } from '@evanion/acl';

// A contract fetched at 10:00, which its owner lets a holder keep for a minute.
const access = parseMatrix(
  {
    maxStale: 60_000,
    permissions: [
      {
        key: 'question.update',
        object: 'question',
        action: 'update',
        rules: [
          { when: [{ field: 'object.askedBy', op: 'eq', path: 'subject.id' }] },
        ],
      },
      {
        key: 'preorder.place',
        object: 'preorder',
        action: 'place',
        rules: [
          {
            when: [
              { field: 'now', op: 'after', value: '2026-10-01T09:00:00Z' },
            ],
          },
        ],
      },
    ],
  },
  { fetchedAt: '2026-10-01T10:00:00Z' },
);

const shopper = { id: 'customer-41' };
const now = '2026-10-01T10:00:30Z';
const later = '2026-10-01T10:05:00Z';

const refusals = [
  access.can(shopper, 'question', 'update', { askedBy: 'customer-92' }, now),
  access.can(shopper, 'question', 'delete', undefined, now),
  access.can(shopper, 'question', 'update', {}, now),
  access.can(shopper, 'preorder', 'place', undefined, 'soon'),
  access.can(shopper, 'question', 'update', { askedBy: 'customer-41' }, later),
];

refusals.map((decision) => decision.reason); // -> ['no-rule-matched', 'unknown-action', 'unevaluable', 'unusable-clock', 'stale-contract']

refusals.filter((decision) => decision.reason !== 'denied').length; // -> 5
refusals.filter((decision) => decision.allowed).length; // -> 0
```

<!-- #endregion gate-on-allowed -->

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

### Explaining one

A screen that refuses reads `reason` to say why. The handler behind it still
gates on `allowed` alone, so the label is the only thing the reason decides:

<!-- #region refusal-label -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';
import type { Decision } from '@evanion/acl';

type Question = { askedBy: string; status: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p
      .allow('update', p.eq('object.askedBy', 'subject.id'))
      .deny('update', p.eq('object.status', 'locked'))
      .id('locked-question'),
  )
  .build();

/** What the Edit button under a question says. */
function editLabel(decision: Decision): string {
  if (decision.allowed) return 'Edit';
  if (decision.reason === 'denied') return `Locked (${decision.rule})`;
  if (decision.reason === 'unevaluable') return 'Checking';
  return 'Not your question';
}

const asker = { id: 'customer-41' };
const ask = (row: Partial<Question>) =>
  access.can(asker, 'question', 'update', row);

editLabel(ask({ askedBy: 'customer-41', status: 'open' })); // -> 'Edit'
editLabel(ask({ askedBy: 'customer-41', status: 'locked' })); // -> 'Locked (locked-question)'
editLabel(ask({ askedBy: 'customer-92', status: 'open' })); // -> 'Not your question'

// The list query did not select `status`, so the deny rule could not be read.
const partial = ask({ askedBy: 'customer-41' });
editLabel(partial); // -> 'Checking'
partial.rule; // -> 'locked-question'
partial.missing; // -> ['object.status']
```

<!-- #endregion refusal-label -->

### The order the two sides settle in

The engine settles the deny side before the allow side, and a matched deny
refuses wherever the policy declared it. A deny the engine could not read
refuses an allow that matched, and leaves a definite no-allow as
`no-rule-matched`:

<!-- #region resolution-order -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Question = { askedBy: string; status: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p
      .deny('update', p.eq('object.status', 'locked'))
      .id('locked-is-final')
      .allow('update', p.eq('object.askedBy', 'subject.id'))
      .id('asker-edits-own'),
  )
  .build();

const asker = { id: 'customer-41' };

// Step 1: the deny matched, so the allow that also matched does not count.
const locked = access.can(asker, 'question', 'update', {
  askedBy: 'customer-41',
  status: 'locked',
});
locked.reason; // -> 'denied'
locked.rule; // -> 'locked-is-final'

// Step 2: no allow rule can match, so the absent `status` changes nothing.
const theirs = access.can(asker, 'question', 'update', {
  askedBy: 'customer-92',
});
theirs.reason; // -> 'no-rule-matched'

// Step 4: the allow rule matched and the deny side could not be read.
const unread = access.can(asker, 'question', 'update', {
  askedBy: 'customer-41',
});
unread.reason; // -> 'unevaluable'
unread.rule; // -> 'locked-is-final'
unread.missing; // -> ['object.status']

// Step 5: the deny side definitely failed, so the allow grants.
const draft = access.can(asker, 'question', 'update', {
  askedBy: 'customer-41',
  status: 'draft',
});
draft.allowed; // -> true
draft.reason; // -> 'allow'
draft.rule; // -> 'asker-edits-own'
```

<!-- #endregion resolution-order -->

A deny rule that reads a clock which does not parse holds up the permission the
same way, as `unusable-clock`, and it too sits below a definite no-allow:

<!-- #region resolution-clock -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Shopper = { id: string; roles: string[] };

const access = policy<Shopper, { order: { id: string } }, { order: 'place' }>()
  .for('order', (p) =>
    p
      .allow('place', p.contains('subject.roles', 'customer'))
      .id('customers-order')
      .deny(
        'place',
        p.after('now', '2026-12-27T00:00:00Z'),
        p.before('now', '2026-12-29T00:00:00Z'),
      )
      .id('stocktake-closes-orders'),
  )
  .build();

const customer = { id: 'customer-41', roles: ['customer'] };
const visitor = { id: 'visitor-7', roles: [] };

// Step 1: the stocktake window is open, so the deny rule matched.
const stocktake = '2026-12-28T10:00:00Z';
access.can(customer, 'order', 'place', undefined, stocktake).reason; // -> 'denied'

// Step 3: the allow rule matched, and the deny rule's clock does not parse.
const garbled = access.can(customer, 'order', 'place', undefined, 'soon');
garbled.reason; // -> 'unusable-clock'
garbled.rule; // -> 'stocktake-closes-orders'

// Step 2 comes first: no allow rule matches the visitor, clock or no clock.
access.can(visitor, 'order', 'place', undefined, 'soon').reason; // -> 'no-rule-matched'
```

<!-- #endregion resolution-clock -->

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
  { id: 'q1', askedBy: 's1' },
  { id: 'q2', askedBy: 's2' },
  { id: 'q3' }, // the projection this row came back in lacks the field
];

const decisions = access.canMany({ id: 's1' }, 'question', 'update', rows);
const reasons = decisions.map((decision) => decision.reason);
reasons; // -> ['allow', 'no-rule-matched', 'unevaluable']
```

<!-- #endregion can-many -->

The array is parallel to the input, so the decision for `rows[i]` is
`decisions[i]`. Nothing is filtered out: a refused row still has an entry, which
is what lets a list render the refusal beside the row rather than dropping it.

`canMany` is one of three calls that answer more than one question at once.
`capabilities` answers every permission in the document for one subject, and
`authorize` binds the subject so every later call leaves it out:

<!-- #region many-questions -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Question = { askedBy: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p
      .allow('read', p.always)
      .allow('update', p.eq('object.askedBy', 'subject.id')),
  )
  .build();

const subject = { id: 's1' };
const mine = { askedBy: 's1' };
const rows = [mine, { askedBy: 's2' }];

// One decision per row.
access.canMany(subject, 'question', 'update', rows).map((d) => d.allowed); // -> [true, false]

// Every permission, keyed.
Object.keys(access.capabilities(subject)); // -> ['question.read', 'question.update']

// A handle with the subject bound.
const forSubject = access.authorize(subject);
forSubject.can('question', 'update', mine).allowed; // -> true
```

<!-- #endregion many-questions -->

A deny rule needs no object. It reads the subject the same way an allow rule
does, and a policy whose every condition reads the subject still produces three
of the four reasons.

<!-- #region subject-deny -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Shopper = { id: string; roles: string[] };

// Baize suspends an account by adding the `suspended` role, and the account
// keeps `bookseller`. The deny sits beside the allow it overrides, in the
// permission both belong to, and `.id()` names each rule so a decision can
// report which one decided.
const access = policy<Shopper, { report: { id: string } }>()
  .for('report', (p) =>
    p
      .allow('read', p.contains('subject.roles', 'bookseller'))
      .id('booksellers-read')
      .deny('read', p.contains('subject.roles', 'suspended'))
      .id('suspended-reads-nothing'),
  )
  .build();

const bookseller = { id: 'u1', roles: ['bookseller'] };
const suspended = { id: 'u2', roles: ['bookseller', 'suspended'] };
const customer = { id: 'u3', roles: [] };

access.can(bookseller, 'report', 'read').reason; // -> 'allow'
access.can(suspended, 'report', 'read').reason; // -> 'denied'
access.can(suspended, 'report', 'read').rule; // -> 'suspended-reads-nothing'
access.can(customer, 'report', 'read').reason; // -> 'no-rule-matched'
```

<!-- #endregion subject-deny -->

The suspended bookseller satisfies the allow rule, and the deny settles first, so
the decision is `denied`. Nothing here can answer `unevaluable`: the app resolves
the subject whole before the call, so every condition has data to read.

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

`capabilities` passes no object, so a permission whose rules need `object.*` to
settle decides `unevaluable` rather than `true` or `false`, with `missing`
naming the paths. A rule whose subject conditions already fail settles without
the row, and a permission reading only the subject always settles:

<!-- #region capabilities-object -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';
import type { Action } from '@evanion/acl';

type Shopper = { id: string; roles: string[] };
type Question = { askedBy: string; status: string };

const access = policy<
  Shopper,
  { question: Question },
  { question: Action | 'hide' }
>()
  .for('question', (p) =>
    p
      .allow('read', p.always)
      .allow('update', p.eq('object.askedBy', 'subject.id'))
      .allow(
        'hide',
        p.contains('subject.roles', 'bookseller'),
        p.eq('object.status', 'open'),
      ),
  )
  .build();

const customer = { id: 'customer-41', roles: [] };
const caps = access.capabilities(customer);

// Reads only the subject, so it settles.
caps['question.read'].reason; // -> 'allow'

// Needs the row to settle, and names what it would read.
caps['question.update'].reason; // -> 'unevaluable'
caps['question.update'].missing; // -> ['object.askedBy']

// The customer holds no `bookseller` role, so the row cannot change the answer.
caps['question.hide'].reason; // -> 'no-rule-matched'
```

<!-- #endregion capabilities-object -->

A navigation menu filters its items against the map. A key the document does
not carry is absent from it, so the filter compares with `=== true`:

<!-- #region capabilities-menu -->

```ts @import.meta.vitest
import { parseMatrix, policy } from '@evanion/acl';

type Shopper = { id: string; roles: string[] };

// `stock` writes the report rules and serves the document as JSON. It declares
// nothing about listings.
const stock = policy<Shopper, { report: { id: string } }>()
  .for('report', (p) =>
    p.allow('read', p.contains('subject.roles', 'bookseller')),
  )
  .build();

const served = JSON.stringify(stock.matrix);
const access = parseMatrix(JSON.parse(served));
const caps = access.capabilities({ id: 'u1', roles: ['bookseller'] });

const menu = [
  { href: '/reports', label: 'Reports', key: 'report.read' },
  { href: '/listings', label: 'Listings', key: 'listing.read' },
];

const shown = menu.filter((item) => caps[item.key]?.allowed === true);
shown.map((item) => item.label); // -> ['Reports']

// Hiding only what the map refuses shows the key the document never declared.
const leaky = menu.filter((item) => caps[item.key]?.allowed !== false);
leaky.map((item) => item.label); // -> ['Reports', 'Listings']
```

<!-- #endregion capabilities-menu -->

## One policy behind a screen

A rendered interface is a set of controls, and each control is one `can`. The
policy is the only place a rule is written; the interface reads answers and
draws.

<!-- #region listing-bar -->

```ts @import.meta.vitest
import { parseMatrix, policy } from '@evanion/acl';

/** Who is signed in. `role` is what the policy reads. */
interface Shopper {
  role: 'customer' | 'bookseller' | 'owner';
}

/** A game listing in the shop. A status, because that is all a rule reads. */
interface Listing {
  status: 'draft' | 'published';
}

// `stock` writes the listing rules and serves `stock.matrix` as JSON.
const stock = policy<
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

// The storefront adopts the document it fetched, and the action bar asks it.
const access = parseMatrix<Shopper, { listing: Listing }>(stock.matrix);

const bookseller: Shopper = { role: 'bookseller' };
const draft: Listing = { status: 'draft' };

access.can(bookseller, 'listing', 'review', draft).allowed; // -> true
access.can(bookseller, 'listing', 'edit', draft).allowed; // -> true
access.can(bookseller, 'listing', 'publish', draft).reason; // -> 'no-rule-matched'
access.can(bookseller, 'listing', 'edit', { status: 'published' }).reason; // -> 'denied'
access.can(bookseller, 'listing', 'edit', {}).reason; // -> 'unevaluable'
access.can(bookseller, 'listing', 'archive', draft).reason; // -> 'unknown-action'
```

<!-- #endregion listing-bar -->

Four rules decide three controls for every role the shop has. `stock` writes
them and the storefront adopts the document with `parseMatrix`, so an action the
document does not carry answers `unknown-action` and a listing without `status`
answers `unevaluable` for `edit`. Publishing a listing changes the fourth answer
without anything else moving: the deny reads `object.status`, so the same
bookseller who could edit the draft cannot edit the listing once it is
published.

## The matrix document

A matrix is an envelope, never a bare array. `JSON.stringify(access.matrix)`
prints the text a producer serves:

<!-- #region matrix-text -->

```ts @import.meta.vitest
import { parseMatrix, policy } from '@evanion/acl';

type Question = { askedBy: string };

const access = policy<{ id: string }, { question: Question }>({
  version: 3,
  schema: { objects: { question: { fields: { askedBy: 'string' } } } },
})
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')),
  )
  .build();

const text = JSON.stringify(access.matrix);
text; // -> '{"version":3,"schema":{"objects":{"question":{"fields":{"askedBy":"string"}}}},"permissions":[{"key":"question.update","object":"question","action":"update","rules":[{"when":[{"field":"object.askedBy","op":"eq","path":"subject.id"}]}]}]}'

const adopted = parseMatrix(JSON.parse(text));
adopted.can({ id: 's1' }, 'question', 'update', { askedBy: 's1' }).allowed; // -> true

// The permission list on its own is no document.
let refused = '';
try {
  parseMatrix(JSON.parse(text).permissions);
} catch (error) {
  refused = (error as Error).name;
}
refused; // -> 'InvalidMatrixError'
```

<!-- #endregion matrix-text -->

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
```

<!-- #endregion matrix-round-trip -->

A construction site that changed the document states the version it runs:

<!-- #region version-override -->

```ts @import.meta.vitest
import { hydratePolicy } from '@evanion/acl';

const shipped = hydratePolicy({
  version: 'orders@7',
  permissions: [
    {
      key: 'orders:order.refund',
      object: 'orders:order',
      action: 'refund',
      rules: [],
    },
  ],
}).matrix;

// This process merged deny overlay 41 into `orders@7` before construction, so
// it runs a revision `orders` never shipped. The option names that revision,
// and the frozen `matrix` carries it.
const effective = hydratePolicy(shipped, { version: 'orders@7+veto@41' });
effective.version; // -> 'orders@7+veto@41'
effective.matrix.version; // -> 'orders@7+veto@41'
```

<!-- #endregion version-override -->

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

### One permission

A `Permission` names one object-and-action pair and carries the rules that
decide it. Its allow rules are OR-ed, its deny rules are OR-ed, and a matched
deny wins. A rule's `when` is AND-ed, and its `id` is what a decision reports as
`rule`:

<!-- #region permission-shape -->

```ts @import.meta.vitest
import { hydratePolicy } from '@evanion/acl';
import type { Permission } from '@evanion/acl';

const update: Permission = {
  key: 'question.update', // exactly `${object}.${action}`
  object: 'question',
  action: 'update',
  rules: [
    {
      id: 'asker-edits',
      when: [{ field: 'object.askedBy', op: 'eq', path: 'subject.id' }],
    },
  ],
  denyRules: [
    {
      id: 'locked-is-final',
      when: [{ field: 'object.status', op: 'eq', value: 'locked' }],
    },
  ],
  fields: { fields: ['*', '!status'] }, // the field axis
};

const access = hydratePolicy({ permissions: [update] });
const ask = (status: string) =>
  access.can({ id: 's1' }, 'question', 'update', { askedBy: 's1', status });

ask('open').rule; // -> 'asker-edits'
ask('locked').rule; // -> 'locked-is-final'
```

<!-- #endregion permission-shape -->

### Conditions

One condition reads one path and compares it with a `path` comparand or a
literal `value`. The bare `now` reads the clock:

<!-- #region condition-forms -->

```ts @import.meta.vitest
import { hydratePolicy } from '@evanion/acl';
import type { Condition } from '@evanion/acl';

const when: Condition[] = [
  { field: 'object.askedBy', op: 'eq', path: 'subject.id' }, // path comparand
  { field: 'subject.roles', op: 'contains', value: 'customer' }, // literal comparand
  { field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' }, // the clock
];

const access = hydratePolicy({
  permissions: [
    {
      key: 'question.update',
      object: 'question',
      action: 'update',
      rules: [{ when }],
    },
  ],
});

const customer = { id: 'customer-41', roles: ['customer'] };
const question = { askedBy: 'customer-41' };
const ask = (now: string) =>
  access.can(customer, 'question', 'update', question, now);

ask('2026-06-01T00:00:00Z').allowed; // -> true
ask('2025-06-01T00:00:00Z').allowed; // -> false
```

<!-- #endregion condition-forms -->

## The schema

A document may declare the shapes its conditions read. The schema is optional
for a producer and binding when present.

<!-- #region schema-binding -->

```ts @import.meta.vitest
import { hydratePolicy } from '@evanion/acl';
import type { Matrix } from '@evanion/acl';

const matrix: Matrix = {
  schema: {
    subject: { fields: { id: 'string' } },
    objects: {
      question: { fields: { askedBy: 'string', status: 'string' } },
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

<!-- #region paths-and-literals -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Question = { askedBy: string; status: string };

const access = policy<{ id: string }, { question: Question }>()
  .for(
    'question',
    (p) =>
      p
        .deny('update', p.eq('object.status', 'locked')) // compares against the string 'locked'
        .allow('update', p.eq('object.askedBy', 'subject.id')), // compares two paths
  )
  .build();

const [update] = access.matrix.permissions;
update?.denyRules?.[0]?.when; // -> [{ field: 'object.status', op: 'eq', value: 'locked' }]
update?.rules?.[0]?.when; // -> [{ field: 'object.askedBy', op: 'eq', path: 'subject.id' }]

policy<{ id: string }, { question: Question }>().for('question', (p) =>
  // @ts-expect-error `subject.idd` names no field of the subject type
  p.allow('update', p.eq('object.askedBy', 'subject.idd')),
);
```

<!-- #endregion paths-and-literals -->

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

### A bound handle

`access.object(key)` binds one object kind, so every call on the handle names
the kind once. `access.authorize(subject)` binds the subject the same way:

<!-- #region bound-handle -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Question = { askedBy: string; body: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')).fields(['body']),
  )
  .build();

const subject = { id: 's1' };
const question = { askedBy: 's1', body: 'In stock?' };
const proposed = { body: 'Is Wingspan in stock?' };

const questions = access.object('question');
questions.can(subject, 'update', question).allowed; // -> true

const fd = questions.canFields(subject, 'update', question, 'write', proposed);
fd.fields; // -> { askedBy: 'denied', body: 'allowed' }

access.authorize(subject).can('question', 'update', question).allowed; // -> true
```

<!-- #endregion bound-handle -->

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

JSON.parse(JSON.stringify(access.matrix)).version; // -> 'orders@7'
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

const storefront = parseMatrix<Subject, { 'orders:order': Order }>(contract);
const bookseller = { id: 'u1', roles: ['bookseller'], tier: 'permanent' };
storefront.can(bookseller, 'orders:order', 'refund').allowed; // -> true
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
```

<!-- #endregion field-permissions -->

The object form of `fields` keys the per-field configs by field name and takes
`fields` for the name allow-list, so `fields` is the one name a field cannot
have: a field called `fields` has nowhere to put its `targets` or `transitions`.
It can still be allowed or denied by name through the list. A matrix that gives
it a config is refused at construction with an `InvalidPermissionError` naming
the clash.

`fields` takes a name list, where `*` is the baseline and `!name` subtracts from
it, or that list inside an object beside the per-field configs:

<!-- #region field-lists -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Listing = {
  id: string;
  title: string;
  price: number;
  status: 'draft' | 'published';
  visibility: string;
};

const access = policy<
  { id: string },
  { listing: Listing },
  { listing: 'read' | 'update' | 'publish' }
>()
  .for('listing', (p) =>
    p
      .allow('read', p.always)
      .fields(['*', '!status']) // everything except status
      .allow('update', p.always)
      .fields(['title', 'price']) // exactly these two
      .allow('publish', p.always)
      .fields({
        fields: ['*', '!id'],
        status: { transitions: { draft: ['published'], published: [] } },
        visibility: { targets: ['public', 'private'] },
      }),
  )
  .build();

const bookseller = { id: 'u1' };
const listing: Listing = {
  id: 'l1',
  title: 'Wingspan',
  price: 499,
  status: 'draft',
  visibility: 'private',
};

const read = access.canFields(bookseller, 'listing', 'read', listing, 'read');
read.fields['status']; // -> 'denied'

const update = access.canFields(
  bookseller,
  'listing',
  'update',
  listing,
  'write',
  {
    title: 'Wingspan (second edition)',
    status: 'published',
  },
);
update.fields['title']; // -> 'allowed'
update.fields['status']; // -> 'denied'

const publish = access.canFields(
  bookseller,
  'listing',
  'publish',
  listing,
  'write',
  {
    id: 'l2',
    status: 'published',
    visibility: 'secret',
  },
);
publish.reasons; // -> { id: 'not-listed', title: 'allow', price: 'allow', status: 'allow', visibility: 'targets-failed' }
```

<!-- #endregion field-lists -->

A field decision carries the action decision it hangs off, and `fd.allowed` is
true only when the action is allowed and every field is allowed. The field maps
are filled in whatever the action says, so a blocked caller still sees which
fields would be editable once the action is unblocked.

<!-- #region field-decision -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';
import type { FieldDecision } from '@evanion/acl';

type Listing = {
  sellerId: string;
  title: string;
  price: number;
  status: string;
};

const access = policy<{ id: string }, { listing: Listing }>()
  .for('listing', (p) =>
    p
      .allow('update', p.eq('object.sellerId', 'subject.id'))
      .fields(['title', 'price']),
  )
  .build();

const current = {
  sellerId: 's1',
  title: 'Wingspan',
  price: 499,
  status: 'draft',
};
const proposed = { price: 449, status: 'published' };

const fd: FieldDecision = access.canFields(
  { id: 's1' },
  'listing',
  'update',
  current,
  'write',
  proposed,
);

fd.action.allowed; // -> true
fd.allowed; // -> false
fd.fields; // -> { sellerId: 'denied', title: 'allowed', price: 'allowed', status: 'denied' }
fd.reasons; // -> { sellerId: 'not-listed', title: 'allow', price: 'allow', status: 'not-listed' }
```

<!-- #endregion field-decision -->

### Passing a projection

The maps are keyed by the union of the object's own keys, the proposed write's
keys, the names the rules configure and the names in the list. A projection
shrinks that union, and a name it leaves out that nothing else names is absent
from the maps:

<!-- #region projection-fields -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Listing = {
  sellerId: string;
  title: string;
  price: number;
  status: string;
};

const access = policy<{ id: string }, { listing: Listing }>()
  .for('listing', (p) =>
    p
      .allow('update', p.eq('object.sellerId', 'subject.id'))
      .fields(['title', 'price']),
  )
  .build();

// The list query selected two columns, and no `status`.
const projection = { sellerId: 's1', title: 'Wingspan' };
const fd = access.canFields(
  { id: 's1' },
  'listing',
  'update',
  projection,
  'read',
);

Object.keys(fd.fields); // -> ['sellerId', 'title', 'price']
fd.fields['status']; // -> undefined
```

<!-- #endregion projection-fields -->

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

const current = { askedBy: 'customer-41', body: 'In stock?', status: 'open' };
const proposed = { body: 'Wingspan in stock?', status: 'locked' };

const fd = access.canFields(
  { id: 'customer-41' },
  'question',
  'update',
  current,
  'write',
  proposed,
);

fd.action.allowed; // -> true
fd.fields['status']; // -> 'denied'
JSON.stringify(pickAllowedFields(fd, proposed)); // -> '{"body":"Wingspan in stock?"}'
```

<!-- #endregion write-path -->

`pickAllowedFields` throws `ActionNotAllowedError` when the action itself is
refused: no field of a refused action is writable, and an empty object would
read as a lawful write of nothing. A field the action allows but the field rules
deny is a partial write, so that case returns the allowed subset.

A field carries one of three states, and a filter that drops only the `denied`
keys writes the other two. Below, the handler loaded the question without
`status`, so the `transitions` config cannot read the edge it guards:

<!-- #region hand-filter -->

```ts @import.meta.vitest
import { policy, pickAllowedFields } from '@evanion/acl';

type Question = { askedBy: string; body: string; status: 'open' | 'locked' };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')).fields({
      fields: ['*'],
      status: { transitions: { open: ['locked'], locked: [] } },
    }),
  )
  .build();

// The row as the handler loaded it, and the write the form posted.
const row = { askedBy: 'customer-41', body: 'In stock?' };
const proposed = { body: 'Is Wingspan in stock?', status: 'open' as const };

const fd = access.canFields(
  { id: 'customer-41' },
  'question',
  'update',
  row,
  'write',
  proposed,
);

fd.fields['status']; // -> 'unevaluable'

// Dropping only the denied keys writes a status nobody approved.
const narrowed = Object.fromEntries(
  Object.entries(proposed).filter(([key]) => fd.fields[key] !== 'denied'),
);
Object.keys(narrowed); // -> ['body', 'status']
Object.keys(pickAllowedFields(fd, proposed)); // -> ['body']
```

<!-- #endregion hand-filter -->

`fields` names what a write may carry, and a per-field config restricts one
field's value. `transitions` reads the edge from the value the row holds now to
the value the write proposes, so it needs the current value to decide:

<!-- #region field-configs -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Question = { askedBy: string; body: string; status: 'open' | 'locked' };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')).fields({
      fields: ['body'],
      status: { transitions: { open: ['locked'], locked: [] } },
    }),
  )
  .build();

const asker = { id: 'customer-41' };
const open = {
  askedBy: 'customer-41',
  body: 'In stock?',
  status: 'open',
} as const;
const locked = { ...open, status: 'locked' } as const;

// open -> locked is the one edge the config allows.
const closing = access.canFields(asker, 'question', 'update', open, 'write', {
  status: 'locked',
});
closing.fields['status']; // -> 'allowed'

// locked names no edge, so nothing moves a question out of it.
const reopening = access.canFields(
  asker,
  'question',
  'update',
  locked,
  'write',
  { status: 'open' },
);
reopening.reasons['status']; // -> 'transition-failed'

// A row loaded without `status` gives the config no edge to read.
const unread = access.canFields(
  asker,
  'question',
  'update',
  { askedBy: 'customer-41' },
  'write',
  { status: 'locked' },
);
unread.reasons['status']; // -> 'missing-field'

// A key only the posted form carries is still decided, by the name list.
const posted: Partial<Question> = JSON.parse('{"pinned":true}');
const pinning = access.canFields(
  asker,
  'question',
  'update',
  open,
  'write',
  posted,
);
pinning.reasons['pinned']; // -> 'not-listed'
pinning.reasons['askedBy']; // -> 'not-listed'
```

<!-- #endregion field-configs -->

A per-field config restricts the field it names and no other. With no name list
beside it, every key the config leaves unnamed stays writable:

<!-- #region config-not-allow-list -->

```ts @import.meta.vitest
import { pickAllowedFields, policy } from '@evanion/acl';

type Listing = { sellerId: string; title: string; status: string };
type Objects = { listing: Listing };

const transitions = { draft: ['published'] };

// A config and nothing else.
const open = policy<{ id: string }, Objects>()
  .for('listing', (p) =>
    p
      .allow('update', p.eq('object.sellerId', 'subject.id'))
      .fields({ status: { transitions } }),
  )
  .build();

// The same config, beside a name list that closes `sellerId`.
const closed = policy<{ id: string }, Objects>()
  .for('listing', (p) =>
    p
      .allow('update', p.eq('object.sellerId', 'subject.id'))
      .fields({ fields: ['*', '!sellerId'], status: { transitions } }),
  )
  .build();

const seller = { id: 's1' };
const listing = { sellerId: 's1', title: 'Wingspan', status: 'draft' };

// The form published the listing and handed it to another seller.
const posted = { status: 'published', sellerId: 's9' };

const ask = (access: typeof open) =>
  access.canFields(seller, 'listing', 'update', listing, 'write', posted);

pickAllowedFields(ask(open), posted); // -> { status: 'published', sellerId: 's9' }
pickAllowedFields(ask(closed), posted); // -> { status: 'published' }
```

<!-- #endregion config-not-allow-list -->

### Reading

The `read` axis decides which fields of a row this subject may see. It runs no
query: the row was fetched already, and a field decided `denied` here was still
read out of the database.

<!-- #region read-axis -->

```ts @import.meta.vitest
import { pickAllowedFields, policy } from '@evanion/acl';

type Question = { askedBy: string; body: string; askerEmail: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p.allow('read', p.always).fields(['*', '!askerEmail']),
  )
  .build();

// The row as the handler fetched it, email included.
const question = {
  askedBy: 'customer-41',
  body: 'Is Wingspan in stock?',
  askerEmail: 'customer-41@example.com',
};

const view = access.canFields(
  { id: 'customer-92' },
  'question',
  'read',
  question,
  'read',
);

view.fields['askerEmail']; // -> 'denied'
pickAllowedFields(view, question); // -> { askedBy: 'customer-41', body: 'Is Wingspan in stock?' }
```

<!-- #endregion read-axis -->

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

`parseMatrix` validates the document before it returns an evaluator, and every
refusal extends `AclConfigError`. A consumer that fetches on a schedule keeps
the last document that constructed:

<!-- #region adopt-keep-last -->

```ts @import.meta.vitest
import { AclConfigError, parseMatrix } from '@evanion/acl';
import type { Matrix } from '@evanion/acl';

const refund = {
  key: 'orders:order.refund',
  object: 'orders:order',
  action: 'refund',
} as const;

const bookseller = {
  field: 'subject.roles',
  op: 'contains',
  value: 'bookseller',
} as const;

// The last document `orders` served that constructed.
let adopted = parseMatrix({
  version: 'orders@7',
  permissions: [{ ...refund, rules: [{ when: [bookseller] }] }],
});

/** Adopt a fetched document, or keep the one in hand and name the refusal. */
function readopt(served: Matrix): string | undefined {
  try {
    adopted = parseMatrix(served);
    return undefined;
  } catch (error) {
    if (error instanceof AclConfigError) return error.name;
    throw error;
  }
}

// `orders@8` lost its refund rule's conditions on the way.
const damaged = {
  version: 'orders@8',
  permissions: [{ ...refund, rules: [{ when: null }] }],
} as never;

readopt(damaged); // -> 'InvalidRuleError'
adopted.version; // -> 'orders@7'

const staff = { id: 'u1', roles: ['bookseller'] };
adopted.can(staff, 'orders:order', 'refund').allowed; // -> true
```

<!-- #endregion adopt-keep-last -->

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

<!-- #region namespaced-kind -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Seller = { id: string; shop: string };
type Listing = { id: string; shop: string };

const storefront = policy<Seller, { 'storefront:listing': Listing }>()
  .for('storefront:listing', (p) =>
    p.allow('read', p.eq('object.shop', 'subject.shop')),
  )
  .build();

const ines = { id: 'staff:ines', shop: 'stockholm' };
const listing = { id: 'wingspan', shop: 'stockholm' };

storefront.matrix.permissions[0]?.key; // -> 'storefront:listing.read'
storefront.can(ines, 'storefront:listing', 'read', listing).allowed; // -> true

/** The error a call raises, by name, or `undefined` when it raises none. */
function raised(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as Error).name;
  }
  return undefined;
}

const dotted = () =>
  policy<Seller, { 'storefront.listing': Listing }>()
    .for('storefront.listing', (p) => p.allow('read', p.always))
    .build();

raised(dotted); // -> 'InvalidPermissionError'
```

<!-- #endregion namespaced-kind -->

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

// A request touching both origins asks both, and the caller writes the AND.
const shelf = fleet.can(subject, 'storefront:listing', 'read').allowed;
const stock = fleet.can(subject, 'stock:listing', 'read').allowed;
shelf && stock; // -> false

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
// deny and nothing else -- no allow, no field rule.
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
const storefront = parseMatrix(contract, { fetchedAt: Date.now() });
const bookseller = { id: 'u1', roles: ['bookseller'], tier: 'permanent' };

storefront.can(bookseller, 'orders:order', 'refund').allowed; // -> true
storefront.can(bookseller, 'orders:ledger', 'reconcile').reason; // -> 'unknown-action'
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

With `maxStale: 1000`, `fetchedAt: 0` and a settled clock of 5000, the expiry
reaches every call that decides, and `readsObject` goes on answering, because it
states a fact about the document and none about the present:

<!-- #region stale-contract -->

```ts @import.meta.vitest
import { hydratePolicy } from '@evanion/acl';

const access = hydratePolicy(
  {
    version: 'orders@7',
    maxStale: 1000,
    permissions: [
      {
        key: 'question.update',
        object: 'question',
        action: 'update',
        rules: [
          { when: [{ field: 'object.askedBy', op: 'eq', path: 'subject.id' }] },
        ],
      },
    ],
  },
  { fetchedAt: 0 },
);

const subject = { id: 's1' };
const question = { askedBy: 's1' };
const now = 5000;

access.can(subject, 'question', 'update', question, now).reason; // -> 'stale-contract'
access.can(subject, 'question', 'delete', question, now).reason; // -> 'stale-contract'
access.capabilities(subject, now)['question.update']?.reason; // -> 'stale-contract'
access.readsObject('question', 'update'); // -> true
```

<!-- #endregion stale-contract -->

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
import { AclAssertionError, ContractDriftError } from '@evanion/acl/testing';
import { assertNoContractDrift } from '@evanion/acl/testing';
import { describeContractDrift } from '@evanion/acl/testing';
import type { Matrix } from '@evanion/acl';

// One refund permission, held by whoever carries `role`.
const refund = (version: string, role: string): Matrix => ({
  version,
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
    pinned: refund('orders@7', 'bookseller'),
    fetched: refund('orders@8', 'supervisor'),
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
const storefront = parseMatrix(contract, clock.options);
const shopper = { id: 'u1' };

const inside = storefront.can(
  shopper,
  'orders:order',
  'refund',
  undefined,
  clock.fresh,
);
inside.reason; // -> 'allow'

// `assertRefused` names the key, the reason and the rule when it throws, so a
// failure says which refusal arrived instead of `false !== true`.
const past = storefront.can(
  shopper,
  'orders:order',
  'refund',
  undefined,
  clock.stale,
);
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
import { AclAssertionError, assertAllowed } from '@evanion/acl/testing';
import { assertFieldState, assertRefused } from '@evanion/acl/testing';
import { explainDecision, explainFieldDecision } from '@evanion/acl/testing';
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

// A shopper holds no role the rule names, so no allow rule matched.
const shopper = { id: 'u2', roles: [] };
const refused = storefront.can(shopper, 'orders:order', 'update');
assertRefused(refused, 'no-rule-matched', 'the order editor').allowed; // -> false

// No proposed write, so the decision covers the row's fields and the listed names.
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

A guard ahead of the fetch decides what the subject alone settles, and hands
every permission that reads the row to the handler that loads it:

<!-- #region guard-before-row -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Shopper = { id: string; roles: string[] };
type Listing = { id: string; locked: boolean };

const access = policy<Shopper, { listing: Listing }>()
  .for('listing', (p) =>
    p
      .allow('read', p.contains('subject.roles', 'owner'))
      .allow('update', p.contains('subject.roles', 'owner'))
      .deny('update', p.eq('object.locked', true)),
  )
  .build();

/** What an HTTP guard does before the handler loads the listing. */
function guard(subject: Shopper, action: 'read' | 'update') {
  // Never decidable here: the handler owes the decision on the row it loads.
  if (access.readsObject('listing', action)) return 'handler-decides';
  return access.can(subject, 'listing', action).allowed ? 'pass' : 'refuse';
}

const owner = { id: 'u1', roles: ['owner'] };
const customer = { id: 'u2', roles: ['customer'] };

guard(owner, 'read'); // -> 'pass'
guard(customer, 'read'); // -> 'refuse'
guard(owner, 'update'); // -> 'handler-decides'
access.can(owner, 'listing', 'update').reason; // -> 'unevaluable'
```

<!-- #endregion guard-before-row -->

### In an Express app

The package ships no Express adapter. A middleware binds `authorize` to
`res.locals`, and each handler decides on the row it loaded. The order the
middlewares are mounted in is what puts every route behind the binding:

<!-- #region express-app -->

```ts @import.meta.vitest
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

import express from 'express';
import { pickAllowedFields, policy, type Action } from '@evanion/acl';

type ShopSubject = { id: string; roles: string[]; shop: string };
type Game = { urn: string; shop: string; availability: string; price: number };

// Built once, at module scope, and evaluated for every request.
const access = policy<
  ShopSubject,
  { game: Game },
  { game: Action | 'declare' }
>()
  .for('game', (p) =>
    p
      .allow(
        'declare',
        p.contains('subject.roles', 'operator'),
        p.eq('object.shop', 'subject.shop'),
      )
      .fields({ fields: ['availability'] }),
  )
  .build();

declare module 'express-serve-static-core' {
  interface Locals {
    user: ShopSubject;
    access: ReturnType<typeof access.authorize>;
  }
}

// Your session layer: Passport, a JWT check, a cookie store. Here, a token the
// server issued at sign-in.
const sessions = new Map([
  [
    'session-ines',
    { id: 'staff:ines', roles: ['operator'], shop: 'stockholm' },
  ],
]);

const requireSession: express.RequestHandler = (req, res, next) => {
  const user = sessions.get(req.get('authorization') ?? '');
  if (!user) return res.sendStatus(401);
  res.locals.user = user;
  next();
};

// The subject is what requireSession verified. `now` is pinned once, so every
// `before` or `after` condition in this request reads the same instant.
const bindAccess: express.RequestHandler = (_req, res, next) => {
  res.locals.access = access.authorize(res.locals.user, { now: new Date() });
  next();
};

const catalogue = new Map<string, Game>([
  [
    'urn:game:wingspan',
    {
      urn: 'urn:game:wingspan',
      shop: 'stockholm',
      availability: 'in-stock',
      price: 59900,
    },
  ],
  [
    'urn:game:gloomhaven',
    {
      urn: 'urn:game:gloomhaven',
      shop: 'gothenburg',
      availability: 'in-stock',
      price: 149900,
    },
  ],
]);

const games = express.Router();

games.patch('/:urn', (req, res) => {
  const game = catalogue.get(req.params.urn);
  if (!game) return res.sendStatus(404);

  // Every key of the body is decided, including keys a game never holds.
  const decision = res.locals.access.canFields(
    'game',
    'declare',
    game,
    'write',
    req.body,
  );
  if (!decision.action.allowed) return res.sendStatus(403);

  const writable = pickAllowedFields(decision, req.body);
  if (Object.keys(writable).length === 0) return res.sendStatus(400);

  catalogue.set(game.urn, { ...game, ...writable });
  return res.sendStatus(204);
});

// Mounted in this order, every route under `api` runs behind both.
const api = express.Router();
api.use(requireSession);
api.use(bindAccess);
api.use('/games', games);

const server = express().use(express.json()).use('/api', api).listen(0);
await once(server, 'listening');
const { port } = server.address() as AddressInfo;

const patchTitle = (urn: string, body: Partial<Game>) =>
  fetch(`http://localhost:${port}/api/games/${urn}`, {
    method: 'PATCH',
    headers: {
      authorization: 'session-ines',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

const own = await patchTitle('urn:game:wingspan', {
  availability: 'preorder',
  price: 1,
});
own.status; // -> 204
catalogue.get('urn:game:wingspan')?.availability; // -> 'preorder'
catalogue.get('urn:game:wingspan')?.price; // -> 59900

const other = await patchTitle('urn:game:gloomhaven', {
  availability: 'preorder',
});
other.status; // -> 403

server.close();
```

<!-- #endregion express-app -->

### In a Server Action

A Server Action is an async function a caller can post to directly, and the
render that drew its form never ran for that caller. The action resolves the
subject and reads the row again, and decides on both:

<!-- #region server-action -->

```ts @import.meta.vitest
import { pickAllowedFields, policy, type Action } from '@evanion/acl';

type ShopSubject = { id: string; roles: string[]; shop: string };
type Game = { urn: string; shop: string; availability: string; price: number };

const access = policy<
  ShopSubject,
  { game: Game },
  { game: Action | 'declare' }
>()
  .for('game', (p) =>
    p
      .allow(
        'declare',
        p.contains('subject.roles', 'operator'),
        p.eq('object.shop', 'subject.shop'),
      )
      .fields({ fields: ['availability'] }),
  )
  .build();

const catalogue = new Map<string, Game>([
  [
    'urn:game:wingspan',
    {
      urn: 'urn:game:wingspan',
      shop: 'stockholm',
      availability: 'in-stock',
      price: 59900,
    },
  ],
  [
    'urn:game:gloomhaven',
    {
      urn: 'urn:game:gloomhaven',
      shop: 'gothenburg',
      availability: 'in-stock',
      price: 149900,
    },
  ],
]);

// Stands in for reading the verified session, which Next.js reaches through
// `cookies()`.
const currentSubject = async (): Promise<ShopSubject> => ({
  id: 'staff:ines',
  roles: ['operator'],
  shop: 'stockholm',
});

async function declareAvailability(form: FormData): Promise<void> {
  'use server';

  const subject = await currentSubject();
  const game = catalogue.get(String(form.get('urn')));
  if (!game) throw new Error('not-found');

  // Whatever the sender put a name on arrives here, `urn` and `price` too.
  const proposed = Object.fromEntries(form) as Partial<Game>;
  const decision = access.canFields(
    subject,
    'game',
    'declare',
    game,
    'write',
    proposed,
  );
  if (!decision.action.allowed) throw new Error('forbidden');

  catalogue.set(game.urn, {
    ...game,
    ...pickAllowedFields(decision, proposed),
  });
}

// Two submissions straight to the action, with no render before either.
const submit = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return declareAvailability(form).then(
    () => 'written',
    (error: Error) => error.message,
  );
};

const own = await submit({
  urn: 'urn:game:wingspan',
  availability: 'preorder',
  price: '1',
});
own; // -> 'written'
catalogue.get('urn:game:wingspan')?.price; // -> 59900

const other = await submit({
  urn: 'urn:game:gloomhaven',
  availability: 'preorder',
});
other; // -> 'forbidden'
```

<!-- #endregion server-action -->

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
  key: 'question.read',
  object: 'question',
  action: 'read',
  rules: [{ when: [] }],
};

const noPermissions = { version: 'v1' } as never;
const objectVersion = { version: {}, permissions: [] } as never;
const wrongKey = {
  version: 'v1',
  permissions: [{ ...read, key: 'question.update' }],
} as never;
const twice = { version: 'v1', permissions: [read, read] } as never;
const noAction = {
  version: 'v1',
  permissions: [{ key: 'question.read', object: 'question' }],
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
      key: 'question.read',
      object: 'question',
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
caught?.key; // -> 'question.read'
caught?.field; // -> 'subject.a.b'
caught?.where; // -> 'rules[0].when[0]'
```

<!-- #endregion errors-condition-where -->

A path reads one field of one scope. A condition that walks from the row to a
second row, the shop the question belongs to and then that shop's owner, is
refused at construction:

<!-- #region nested-path -->

```ts @import.meta.vitest
import { hydratePolicy } from '@evanion/acl';
import type { Matrix } from '@evanion/acl';

// `object.shop` is the shop, and `.ownerId` a field of that second row.
const hop: Matrix = {
  version: 'v1',
  permissions: [
    {
      key: 'question.edit',
      object: 'question',
      action: 'edit',
      rules: [
        {
          when: [
            { field: 'object.shop.ownerId', op: 'eq', path: 'subject.id' },
          ],
        },
      ],
    },
  ],
};

let refused = '';
try {
  hydratePolicy(hop);
} catch (error) {
  refused = `${(error as Error).name}: ${(error as Error).message}`;
}
refused; // -> 'InvalidConditionError: permission "question.edit": condition rules[0].when[0] on "object.shop.ownerId" nests below its scope: a path reads one field of a scope, so at most one dot is resolvable'
```

<!-- #endregion nested-path -->

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
  key: 'question.read',
  object: 'question',
  action: 'read',
  rules: [{ when: [] }],
};
const schema = { objects: { question: { fields: { status: 'string' } } } };

const unknownType = {
  version: 'v1',
  schema: { objects: { question: { fields: { status: 'nope' } } } },
  permissions: [read],
} as never;

const undeclaredField = {
  version: 'v1',
  schema,
  permissions: [
    {
      ...read,
      rules: [{ when: [{ field: 'object.pinned', op: 'eq', value: true }] }],
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
        { when: [{ field: 'object.status', op: 'contains', value: 'open' }] },
      ],
    },
  ],
} as never;

raised(() => parseMatrix(unknownType)); // -> 'InvalidSchemaError'
raised(() => parseMatrix(undeclaredField)); // -> 'UnknownFieldError'
raised(() => parseMatrix(containsOnString)); // -> 'FieldTypeMismatchError'

const fields = (rules: unknown) =>
  ({ version: 'v1', permissions: [{ ...read, fields: rules }] }) as never;

const bangInList = fields({ fields: ['body', '!status'] });
const bangNoBaseline = fields({ fields: ['!status'] });
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
    {
      key: 'question.read',
      object: 'question',
      action: 'read',
      rules: [{ when: [] }],
    },
  ],
} as never;

const open = hydratePolicy(document);
const closed = parseMatrix(document);

// The document holds `question.read` and nothing else. A query naming anything
// else is typed `never` here, because a caller writing one has already left
// what the document declares.
const anyone = {} as never;
const question = 'question' as never;
const readAction = 'read' as never;
const noSuchAction = 'delete' as never;
const noSuchKind = 'coupon' as never;

raised(() => open.can(anyone, question, noSuchAction)); // -> 'UnknownPermissionError'
raised(() => open.can(anyone, noSuchKind, readAction)); // -> 'UnknownObjectKeyError'

const refused = closed.can(anyone, question, noSuchAction);

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
  key: 'question.read',
  object: 'question',
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
  key: 'question.read',
  object: 'question',
  action: 'read',
  rules: [{ when: [] }],
};
const plain = { version: 'v1', permissions: [read] } as never;
const declared = {
  version: 'v1',
  schema: { objects: { question: { fields: { locked: 'boolean' } } } },
  permissions: [read],
} as never;

const twoOrigins = { a: parseMatrix(plain), b: parseMatrix(plain) } as never;
const veto = { 'question.read': [{ when: [] }] };
const locked = { field: 'object.locked', op: 'eq' as const, value: true };
const lockedVeto = { 'question.read': [{ when: [locked] }] };
const noKeyOpened = { vetoable: [] };
const opened = { vetoable: ['question.read'] };

raised(() => federatedPolicies(twoOrigins)); // -> 'OriginCollisionError'
raised(() => applyDenyOverlay(plain, veto, noKeyOpened)); // -> 'UnvetoablePermissionError'
raised(() => applyDenyOverlay(plain, veto, opened)); // -> 'MissingVetoSchemaError'
raised(() => applyDenyOverlay(declared, lockedVeto, opened)); // -> undefined

const internalOnly = policy<{ id: string }, { question: { id: string } }>()
  .for('question', (p) => p.allow('read', p.always))
  .build();
const asContract = { vetoable: ['question.read'] } as never;

raised(() => serialize(internalOnly, 'reduced', asContract)); // -> 'UnpublishedVetoableError'
```

<!-- #endregion errors-composition -->

## Catching every acl refusal at once

<!-- #region errors-catching -->

```ts @import.meta.vitest
import { AclConfigError, parseMatrix } from '@evanion/acl';

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
```

<!-- #endregion errors-catching -->

`pickAllowedFields` is the one throw outside construction and query. No field
of a refused action is writable, so it throws where it would otherwise return
an object a handler writes. It is not a configuration fault, so it sits outside
`AclConfigError`, and the request handler catches it:

<!-- #region errors-action-refused -->

```ts @import.meta.vitest
import { AclConfigError, ActionNotAllowedError } from '@evanion/acl';
import { pickAllowedFields, policy } from '@evanion/acl';

type Question = { askedBy: string; body: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')),
  )
  .build();

// Somebody else's question, so the action itself is refused.
const row = { askedBy: 'customer-92', body: 'In stock?' };
const proposed = { body: 'Is Wingspan in stock?' };
const decided = access.canFields(
  { id: 'customer-41' },
  'question',
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

refusedWrite instanceof ActionNotAllowedError; // -> true
refusedWrite instanceof AclConfigError; // -> false
```

<!-- #endregion errors-action-refused -->

## Security contract

A decision counts where it is made. It is authoritative in a trusted
environment — a React Router 8 or Next.js server runtime, a Node service, the
server side of an API boundary — and advisory everywhere else. In
a browser the same `can` call, with the same signature and the same return
type, only toggles what the user sees. Nothing in the types separates the two;
the runtime does.

<!-- #region one-call-both-sides -->

```ts @import.meta.vitest
import { hydratePolicy, policy } from '@evanion/acl';

type Question = { askedBy: string };

// The server's evaluator, and the one a browser rebuilds from the JSON it sent.
const server = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')).id('asker-edits'),
  )
  .build();
const browser = hydratePolicy(JSON.parse(JSON.stringify(server.matrix)));

const asker = { id: 'customer-41' };
const question = { askedBy: 'customer-41' };

server.can(asker, 'question', 'update', question); // -> { key: 'question.update', allowed: true, reason: 'allow', rule: 'asker-edits' }
browser.can(asker, 'question', 'update', question); // -> { key: 'question.update', allowed: true, reason: 'allow', rule: 'asker-edits' }
```

<!-- #endregion one-call-both-sides -->

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

<!-- #region live-bag -->

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

// An ORM row whose `status` refills between two reads.
let reads = 0;
const lazy = {
  askedBy: 's1',
  get status() {
    return reads++ === 0 ? 'draft' : 'locked';
  },
};

access.can(subject, 'question', 'update', lazy).allowed; // -> true
lazy.status; // -> 'locked'

// The same row, resolved before the call.
const row = { askedBy: 's1', status: 'locked' };
access.can(subject, 'question', 'update', row).reason; // -> 'denied'
```

<!-- #endregion live-bag -->

### What a condition may read

A condition may read only fields the subject cannot write. A rule that keys on
an object field within the subject's reach is self-authorizing: the subject
edits the field, then passes the check the field controls.
`eq('object.sharedWith', 'subject.id')` is the obvious trap, allowing
a user to put their own id in the share field and be authorized for it. Either keep
the field out of every write path the rule guards, or key the rule on something
the subject cannot reach — ownership set at creation, a role on the subject, a
field the server alone writes.

Below, the share dialog writes `sharedWith` and any customer reaches it, so a
read rule keyed on `sharedWith` hands the list to whoever shares it with
themselves. The rule keyed on `ownerId` holds, because no write path carries
`ownerId`:

<!-- #region self-authorizing -->

```ts @import.meta.vitest
import { pickAllowedFields, policy } from '@evanion/acl';

type Customer = { id: string; roles: string[] };
type Wishlist = { ownerId: string; sharedWith: string; title: string };

const access = policy<
  Customer,
  { wishlist: Wishlist },
  { wishlist: 'read' | 'share' }
>()
  .for('wishlist', (p) =>
    p
      .allow('read', p.eq('object.sharedWith', 'subject.id')) // the subject writes it
      .allow('read', p.eq('object.ownerId', 'subject.id')) // set at creation
      .allow('share', p.contains('subject.roles', 'customer'))
      .fields(['sharedWith']),
  )
  .build();

const intruder = { id: 'customer-92', roles: ['customer'] };
const list = {
  ownerId: 'customer-41',
  sharedWith: 'customer-7',
  title: 'Birthday games',
};

access.can(intruder, 'wishlist', 'read', list).allowed; // -> false

// The share dialog submits both fields, and only `sharedWith` is written.
const posted = { sharedWith: 'customer-92', ownerId: 'customer-92' };
const share = access.canFields(
  intruder,
  'wishlist',
  'share',
  list,
  'write',
  posted,
);
const saved = { ...list, ...pickAllowedFields(share, posted) };

saved.ownerId; // -> 'customer-41'
access.can(intruder, 'wishlist', 'read', saved).allowed; // -> true
```

<!-- #endregion self-authorizing -->

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
import { parseMatrix } from '@evanion/acl';
import type { Access, Matrix } from '@evanion/acl';

/** Rebuild when the served document moved; otherwise keep the one in hand. */
function revalidate(current: Access, served: Matrix): Access {
  // `parseMatrix`, so a key the new version dropped refuses and never throws.
  return current.version === served.version ? current : parseMatrix(served);
}

const read = { key: 'question.read', object: 'question', action: 'read' };
const held: Matrix = {
  version: 'orders@7',
  permissions: [
    { ...read, rules: [{ when: [] }] },
    {
      key: 'question.update',
      object: 'question',
      action: 'update',
      rules: [
        { when: [{ field: 'object.askedBy', op: 'eq', path: 'subject.id' }] },
      ],
    },
  ],
};

// `orders` withdrew `question.update` and published a new version.
const served: Matrix = {
  version: 'orders@8',
  permissions: [{ ...read, rules: [{ when: [] }] }],
};

const jo = { id: 'jo' };
const question = { askedBy: 'jo' };

let access = parseMatrix(held);
access.can(jo, 'question', 'update', question).allowed; // -> true

access = revalidate(access, served);
access.version; // -> 'orders@8'
access.can(jo, 'question', 'update', question).reason; // -> 'unknown-action'
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
by a refetch and carries no `missing`.

<!-- #region unusable-clock -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

// Preorders for a new game open at one instant.
const access = policy<
  { id: string },
  { preorder: { game: string } },
  { preorder: 'place' }
>()
  .for('preorder', (p) =>
    p
      .allow('place', p.after('now', '2026-10-01T09:00:00Z'))
      .id('preorders-open'),
  )
  .build();

const shopper = { id: 'customer-41' };
const place = (now: string | number) =>
  access.can(shopper, 'preorder', 'place', undefined, now);

place('2026-10-02T12:00:00Z').allowed; // -> true
place(Date.parse('2026-09-30T12:00:00Z')).reason; // -> 'no-rule-matched'

// A header that was never a date. The rule that compared the clock is named.
const garbled = place('next tuesday');
garbled.reason; // -> 'unusable-clock'
garbled.rule; // -> 'preorders-open'
'missing' in garbled; // -> false
```

<!-- #endregion unusable-clock -->

A condition **value** that does not parse is a construction error instead,
because the boundary comes from the document and the document is checked once.

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
