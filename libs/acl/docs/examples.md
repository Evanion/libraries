# @evanion/acl examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## The Solution: A Serializable Matrix

### Core Concept: The Matrix in Action

<!-- #region first-policy -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

// Anyone signed in to Baize: a customer, or a bookseller on the shop's staff.
type Shopper = { id: string; roles: string[] };
type Question = { id: string; askedBy: string };

// 1. Define your policy once, at module scope, when the server loads this module.
const access = policy<Shopper, { question: Question }>()
  .for('question', (p) =>
    p.allow('delete', p.contains('subject.roles', 'bookseller')),
  )
  .build();

const bookseller = { id: 'staff-3', roles: ['bookseller'] };
const customer = { id: 'customer-41', roles: ['customer'] };
const question = { id: 'q7', askedBy: 'customer-41' };

// 2. Evaluate locally and instantly
access.can(bookseller, 'question', 'delete', question).allowed; // -> true
access.can(customer, 'question', 'delete', question).allowed; // -> false
access.can(customer, 'question', 'delete', question).reason; // -> 'no-rule-matched'
```

<!-- #endregion first-policy -->

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

<!-- #region quick-start -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Question = { id: string; askedBy: string };

const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p.allow('update', p.eq('object.askedBy', 'subject.id')),
  )
  .build();

const decision = access.can({ id: 'customer-41' }, 'question', 'update', {
  id: 'q7',
  askedBy: 'customer-41',
});
decision.allowed; // -> true
```

<!-- #endregion quick-start -->

## Rules that read the row

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

### The whole decision

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

### Explaining one

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

<!-- #region subject-deny -->

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

// Anyone signed in to Baize: a customer, or a bookseller on the shop's staff.
type Shopper = { id: string; roles: string[] };
type Question = { id: string; askedBy: string };
type Report = { id: string };

// Baize suspends an account by adding the `suspended` role, and the account
// keeps `bookseller`. The deny sits beside the allow it overrides, and `.id()`
// names each rule so a decision can report which one decided.
const access = policy<Shopper, { question: Question; report: Report }>()
  .for('question', (p) =>
    p.allow('delete', p.contains('subject.roles', 'bookseller')),
  )
  .for('report', (p) =>
    p
      .allow('read', p.contains('subject.roles', 'bookseller'))
      .id('booksellers-read')
      .deny('read', p.contains('subject.roles', 'suspended'))
      .id('suspended-reads-nothing'),
  )
  .build();

const bookseller = { id: 'staff-3', roles: ['bookseller'] };
const suspended = { id: 'staff-5', roles: ['bookseller', 'suspended'] };
const customer = { id: 'customer-41', roles: ['customer'] };

access.can(bookseller, 'report', 'read').reason; // -> 'allow'
access.can(suspended, 'report', 'read').reason; // -> 'denied'
access.can(suspended, 'report', 'read').rule; // -> 'suspended-reads-nothing'
access.can(customer, 'report', 'read').reason; // -> 'no-rule-matched'
```

<!-- #endregion subject-deny -->

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

## The matrix document

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

### One permission

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

## Typed authoring

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

### A bound handle

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

### The document a typed policy emits

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

### Marking a typed permission for publication

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

## A cross-cutting deny

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

## Publishing the rules to a consumer

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

### How long a consumer may keep deciding on it

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

## Testing a contract you consume

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

### Deciding before the row is loaded

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

### A change that widens nothing and breaks every caller

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

### The bag a decision reads

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

## API

### The clock

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
