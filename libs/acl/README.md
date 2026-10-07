# @evanion/acl

`@evanion/acl` decides authorization locally. You write the rules once as a serializable matrix, and your Node backend, your Next.js server components and the browser each evaluate that matrix in their own process.

## The Problem: Two Places to Ask

Most apps put authorization in one of two places, and both cost something:

1. **Centralized**: Every check is an API call to an auth service. Each hidden button waits on a round trip, and the auth service answers one "Can the user do X?" request per control on every page.
2. **Duplicated**: You write the logic in the backend and then _re-implement_ a version of it in the frontend. The moment a rule changes, your UI diverges from your API, and the user gets "forbidden" errors for buttons the UI offered.

## The Solution: A Serializable Matrix

`@evanion/acl` introduces the **Access Control Matrix**. Instead of a function, your policy is a data structure: a frozen object that round-trips through JSON.

You author the policy on the server, serialize it to JSON, and ship it to the client. The client rebuilds the evaluator and makes the exact same decisions as the server, with no network call.

Because the matrix ships to the client in full, it cannot hold secrets or server-only predicates. Those checks stay in your server code, outside the matrix. What that costs, and what each consumer owns, is the [security contract](#security-contract).

### Core Concept: The Matrix in Action

Baize, the board game shop every example here is set in, lets its staff delete questions. Staff carry the `bookseller` role:

`allowed` is the answer, and `reason` says which branch of the engine produced it. `no-rule-matched` is the default deny: nothing in the document granted the customer the action, so the engine refused without any rule saying to.

`access.matrix` holds the same rules as a JSON value. Another process, such as a browser, rebuilds an evaluator from it with `hydratePolicy`, and that evaluator gives the same answers:

## Key Features

- A decision is a synchronous local function call, with no `await` and no network request.
- The frontend answers from the same matrix as the backend, shipped as JSON. A copy answers from the version it holds until it fetches a new one.
- Nothing is granted by default. An action an adopted document does not carry is refused, and a malformed document throws at construction.
- `canFields` decides an `update` and also _which fields_ of it the user may change.
- The package is ESM only and has no dependencies. It runs on Node 20 or newer, in a browser, and in hybrid JS platforms such as React Native and Electron.

## Installation

```bash
npm install @evanion/acl
```

ESM only. Node 20 or newer. Nothing else enters the import graph.

## Beyond the Basics

The matrix is more than just a boolean check. It provides a rich set of tools for production-grade authorization:

- **`canFields`** and **`pickAllowedFields`**: Prevent mass-assignment attacks by deciding every field of a write and keeping only the allowed ones.
- **`capabilities`**: Generate a map of everything a user can do to build dynamic navigation menus.
- **`parseMatrix`**: Adopt a policy another service published, failing closed on any action it does not carry.
- **`federatedPolicies`**: Answer from one evaluator per service behind a single view, with no merged document.
- **`hydratePolicy`**: Rebuild an evaluator from your own document when it arrives back as JSON.

For deep dives into the security model, field-level permissions, and integration guides for Next.js and Express, visit the documentation site:

👉 **[docs.evanion.com/acl](https://docs.evanion.com/acl)**

The rest of this README is the reference: every behaviour below is an example that runs in the package's test suite.

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

## Rules that read the row

A subject condition cannot tell apart two customers who hold the same roles. A
condition on an `object.*` path reads the row the call carries, so one rule
tells the customer who asked a question from the customer who did not:

## A decision explains itself

`allowed` is the answer. `reason`, `rule` and `missing` are the explanation,
and they are output only — nothing in the library reads a `reason` back to
decide anything.

Default deny, an allow rule grants, a matched deny outranks a matching allow,
and a deny the engine could not read refuses too:

`unevaluable` is a third state, not an error and not a no: the object the caller
passed did not carry a path some rule reads. `missing` names those paths, so one
refetch settles the permission. An absent `object.*` path is unevaluable for
every operator, negative ones included; an absent `subject.*` path is an
ordinary miss, because the app resolves the subject whole and never projects it.

### The whole decision

A `Decision` is one plain object. `rule` and `missing` appear only on the
reasons that carry them, so a decision whose deny side could not be read holds
all five fields:

### Gating on one

Five reasons refuse without any deny rule matching. A gate that tests
`reason !== 'denied'` proceeds through every one of them, and a gate on
`allowed` proceeds through none:

### Repairing one

`missing` is a shopping list. Fetch what it names, ask again, and the permission
settles. Both sides' unreadable paths come back together, so one refetch is
enough however many rules read the object.

A permission that stays `unevaluable` after a refetch is a bug in the document,
almost always a mistyped field name. A `schema` turns that class into an
`UnknownFieldError` at construction.

### Explaining one

A screen that refuses reads `reason` to say why. The handler behind it still
gates on `allowed` alone, so the label is the only thing the reason decides:

### The order the two sides settle in

The engine settles the deny side before the allow side, and a matched deny
refuses wherever the policy declared it. A deny the engine could not read
refuses an allow that matched, and leaves a definite no-allow as
`no-rule-matched`:

A deny rule that reads a clock which does not parse holds up the permission the
same way, as `unusable-clock`, and it too sits below a definite no-allow:

## Asking more than one question

`canMany` takes a list of instances and answers per instance. It settles the
clock once and resolves the object kind once, where a loop of `can` pays both
per row.

The array is parallel to the input, so the decision for `rows[i]` is
`decisions[i]`. Nothing is filtered out: a refused row still has an entry, which
is what lets a list render the refusal beside the row rather than dropping it.

`canMany` is one of three calls that answer more than one question at once.
`capabilities` answers every permission in the document for one subject, and
`authorize` binds the subject so every later call leaves it out:

A deny rule needs no object. It reads the subject the same way an allow rule
does, and a policy whose every condition reads the subject still produces three
of the four answers.

The suspended bookseller satisfies the allow rule, and the deny settles first, so
the decision is `denied`. Nothing here can answer `unevaluable`: the app resolves
the subject whole before the call, so every condition has data to read.

`capabilities` asks the other way — no instance, every permission in the
document, resolved in document order against one subject.

`capabilities` passes no object, so a permission whose rules need `object.*` to
settle decides `unevaluable` rather than `true` or `false`, with `missing`
naming the paths. A rule whose subject conditions already fail settles without
the row, and a permission reading only the subject always settles:

A navigation menu filters its items against the map. A key the document does
not carry is absent from it, so the filter compares with `=== true`:

## One policy behind a screen

A rendered interface is a set of controls, and each control is one `can`. The
policy is the only place a rule is written; the interface reads answers and
draws.

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

`version` and `schema` belong to the document, so a producer in any language
states both in the JSON it emits, and one value crosses an SSR boundary with
nothing assembled around it:

A construction site that changed the document states the version it runs:

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

### Conditions

One condition reads one path and compares it with a `path` comparand or a
literal `value`. The bare `now` reads the clock:

## The schema

A document may declare the shapes its conditions read. The schema is optional
for a producer and binding when present.

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

### A bound handle

`access.object(key)` binds one object kind, so every call on the handle names
the kind once. `access.authorize(subject)` binds the subject the same way:

### Naming a rule

`.id(name)` names the rule the previous `allow()` or `deny()` wrote. A decision
reports that name as `rule`, and `diffMatrix` reads it as the rule's identity
across an edit. A rule that states no name gets one derived from its conditions
and its side, and a release that changes how a condition is represented changes
every derived id, so an audit row holding `allow-b72dadff` stops matching its
rule and nothing reports that it has.

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

An action nobody marks emits no `visibility` at all, which every reader takes as
`internal`, so the reduced document holds the marked actions and nothing else.
`p.visibility('internal')` writes the marking out where an author wants it on
the page.

## Field-level permissions

The object form of `fields` keys the per-field configs by field name and takes
`fields` for the name allow-list, so `fields` is the one name a field cannot
have: a field called `fields` has nowhere to put its `targets` or `transitions`.
It can still be allowed or denied by name through the list. A matrix that gives
it a config is refused at construction with an `InvalidPermissionError` naming
the clash.

`fields` takes a name list, where `*` is the baseline and `!name` subtracts from
it, or that list inside an object beside the per-field configs:

A field decision carries the action decision it hangs off, and `fd.allowed` is
true only when the action is allowed and every field is allowed. The field maps
are filled in whatever the action says, so a blocked caller still sees which
fields would be editable once the action is unblocked.

### Passing a projection

The maps are keyed by the union of the object's own keys, the proposed write's
keys, the names the rules configure and the names in the list. A projection
shrinks that union, and a name it leaves out that nothing else names is absent
from the maps:

### Writing

A write passes the proposed object to `canFields` and writes what
`pickAllowedFields` hands back. Every key of the proposed write is decided, and
the returned object holds only the keys that decided `allowed` — that object is
the value to write, and nothing else from the write is.

`pickAllowedFields` throws `ActionNotAllowedError` when the action itself is
refused: no field of a refused action is writable, and an empty object would
read as a lawful write of nothing. A field the action allows but the field rules
deny is a partial write, so that case returns the allowed subset.

A field carries one of three states, and a filter that drops only the `denied`
keys writes the other two. Below, the handler loaded the question without
`status`, so the `transitions` config cannot read the edge it guards:

`fields` names what a write may carry, and a per-field config restricts one
field's value. `transitions` reads the edge from the value the row holds now to
the value the write proposes, so it needs the current value to decide:

A per-field config restricts the field it names and no other. With no name list
beside it, every key the config leaves unnamed stays writable:

### Reading

The `read` axis decides which fields of a row this subject may see. It runs no
query: the row was fetched already, and a field decided `denied` here was still
read out of the database.

## Foreign matrix

A backend that uses its own ACL can expose its matrix as JSON and the frontend
adopts it. The split is provenance: `hydratePolicy` is your own document coming
back, `parseMatrix` is somebody else's arriving, and only the second fails
closed on an unknown key.

The preset earns its five lines. A foreign document whose adopter forgot the
flag would throw on an unknown key instead of refusing, and which of the two a
document gets is the one thing these names have to make obvious.

`parseMatrix` validates the document before it returns an evaluator, and every
refusal extends `AclConfigError`. A consumer that fetches on a schedule keeps
the last document that constructed:

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

### A red build when a replayed decision changes

`assertNoContractDrift` runs `contractDrift` and throws a `ContractDriftError`
when the producer removed a published key or a replayed decision changed. The
error carries the whole `report`, and its message is `describeContractDrift` of
that report. `ContractDriftError` extends `AclAssertionError`, which is the base
class every refusal in this entry point raises.

### The whole document diff at the same seam

`options.diff` is a `MatrixDiffer<D>`, a `(pinned, fetched) => D`.
`contractDrift` reads nothing out of the result and carries it onto
`report.diff`, so passing `diffMatrix` types `report.diff` as a `MatrixDiff` and
passing nothing leaves it `undefined`. The replayed cases say what this
application's own screens do; the diff says what moved in the document behind
them.

### Reaching `stale-contract` on purpose

`stale-contract` is the refusal a consumer's UI meets in production and never in
development, because a matrix authored in-process reports no `fetchedAt` and
runs under no bound. `fixtureClock` computes the budget the way the engine
computes it and names the two instants that bracket it: `fresh` is the last one
every key still decides on, `stale` the first one that answers
`stale-contract`.

### Assertions that name the reason

`assertAllowed` returns the decision it was given, or throws naming the key, the
reason, the rule and the missing paths. `assertRefused` is the same for a
refusal and takes the `reason` to assert. `assertFieldState` asserts one field
of a `canFields` decision, and reports a field the decision carries no entry for
apart from a field in the wrong state. `explainDecision` and
`explainFieldDecision` are the one-line renderings those three throw, available
on their own for a message a test assembles itself.

## Server-side `authorize`

`authorize` binds a subject so a middleware, loader, action, or RSC server
component evaluates without restating it.

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

True when any allow rule or any deny rule of this permission names an
`object.*` path, on either operand. It takes no subject: the answer is a fact
about the matrix. Field rules do not count, since a `transitions` config reads the object
only on the `canFields` write axis, where the caller holds the row already.

A guard ahead of the fetch decides what the subject alone settles, and hands
every permission that reads the row to the handler that loads it:

### In an Express app

The package ships no Express adapter. A middleware binds `authorize` to
`res.locals`, and each handler decides on the row it loaded. The order the
middlewares are mounted in is what puts every route behind the binding:

### In a Server Action

A Server Action is an async function a caller can post to directly, and the
render that drew its form never ran for that caller. The action resolves the
subject and reads the row again, and decides on both:

## What a deploy changed

`diffMatrix(before, after)` compares two matrix documents and reports access
rather than text. A reviewer reading a line-by-line document diff has to hold
the precedence order in their head to work out what moved. A finding states it.

The evaluator ORs the rules on a side, so a side that has matched goes on
matching whatever is appended to it. An added allow branch can therefore only
widen and an added deny branch can only narrow, and the added branch is the
reviewer's sentence, because its conditions are what an author wrote. A rule is
identified by a hash of its conditions, so a reordered document reports nothing.

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

## What refuses a document

Each refusal below names the value it refused and where that value sits, so a
build log identifies the line to change. Every case names its input first,
because the name is what the message will be about.

An `InvalidConditionError` carries `key`, `field` and `where`, and `where` is
the path to the condition inside the permission:

A path reads one field of one scope. A condition that walks from the row to a
second row, the shop the question belongs to and then that shop's owner, is
refused at construction:

## What refuses a schema or a field rule

A schema is checked for its own shape, and then every condition naming a
declared kind is checked against it. Field rules are checked with or without
one.

## What a query raises, and what it refuses instead

`hydratePolicy` is the open path and throws on a key the document never held,
because a local document is source and a missing key is an authoring mistake.
`parseMatrix` is the closed path and answers `unknown-action`, because a
foreign document is input and a query against it must refuse rather than end
the request.

Freshness raises where the holder is built, not where a decision is asked for,
so a misconfigured holder fails at startup:

## What refuses a composition

## Catching every acl refusal at once

`pickAllowedFields` is the one throw outside construction and query. No field
of a refused action is writable, so it throws where it would otherwise return
an object a handler writes. It is not a configuration fault, so it sits outside
`AclConfigError`, and the request handler catches it:

## Security contract

Authorization is only as strong as the place it runs. A decision counts where it is made: it is **authoritative** in a trusted environment (a React Router 8 or Next.js server runtime, a Node service, the server side of an API boundary) and **advisory** everywhere else. In a browser, the same `can` call, with the same signature and the same return type, only toggles what the user sees. Nothing in the types separates the two; the runtime does.

**Every layer decides for itself.** Every app in the chain evaluates the request on its own and trusts no earlier layer. A gateway or a BFF that already allowed the request does not excuse the service behind it from deciding again, because a caller reaches that service directly whenever it wants to. There is no transitive trust and no "already checked upstream" exemption. Deciding twice is cheap: the second evaluation is a local function call over a frozen object, with no network round-trip.

**The matrix is a public document**, in its names and structure as well as its values. It ships to the client in full, so anyone who loads the page can read:

- every object kind and every action name
- every role string that appears in a condition
- every field name, including the ones the API never returns
- every state machine and its terminal states
- every time window and its boundaries

That is a map of your privilege model and of your server's internal vocabulary. It is not an argument against shipping the matrix: security must not rest on the document staying secret, and here it does not. It is an argument for naming things as if they were going to be read, because they are. An action named `bypass-kyc` or a role named `internal-fraud-reviewer` is a disclosure the moment the page loads.

The rest of the contract is yours to own. A library that claimed to cover these would be lying about what an evaluator can see. Each clause below is an entry in [SECURITY.md](./SECURITY.md), the register the adversarial suite in `src/security` is checked against.

### Subject authenticity

`can(subject, ...)` authorizes the bag it is handed, and it has no way to ask where that bag came from. If you derive the subject from anything the client controls (a header, a query parameter, an unverified token body, a field the client posted), the engine faithfully authorizes the attacker's claimed identity. This is the confused deputy, and no evaluator can fix it.

**The Fix**: Resolve the subject from a verified session or a verified token, server-side, before it reaches `can`.

### Complete mediation

Nothing makes you call `can`. A new route, a new resolver, a background job, an admin script, a direct query: each one is unguarded until someone guards it. The library can make the checked path the easy one, through `authorize(subject)` bound once in middleware, but it cannot make the unchecked path impossible.

**The Fix**: Treat "every path is covered" as a property of your app, and assert it in your app's tests.

### Time of check to time of use

A decision describes the snapshot it was given. Between `can` returning `true` and the write landing, the object can change owner, the subject can lose the role, and the time window can close. The library carries no freshness token and has no way to detect the gap.

**The Fix**: Re-read the object and re-check inside the transaction, or write with a conditional predicate that fails when the state it was authorized against has moved.

### The clock a decision reads

`now` is a parameter. Omit it and the engine reads the wall clock; supply it and the engine reads whatever you passed, and every `before`/`after` window moves with it. A `now` that reaches `can` from a client payload (a request body, a query string, anything the browser sent) hands the client every time window in the matrix.

**The Fix**: Pass `now` only to make a server render and the client's first render agree, and resolve it server-side.

In a browser, the wall clock belongs to the subject. Setting the system clock back re-opens a window that has closed, and the library cannot detect it, because the clock is an argument. A role condition reads the subject a server resolved; a time condition reads a value the subject's machine produced. Both are advisory in a browser, and the second is the weaker of the two. A server passing its own `now` is unaffected.

A clock that parses is taken as given. A clock that does not (`null`, `NaN`, an `Invalid Date`, a string that is not a date) refuses instead: every permission that needs the clock to decide answers `{ allowed: false, reason: 'unusable-clock' }`, on the allow side and the deny side alike. A permission whose deny rule matches, or whose allow side definitely fails, still answers `denied` or `no-rule-matched` first. Supply an instant that parses, or none at all.

### The bag a decision reads

Conditions read `subject` and `object` live, field by field, as the decision walks the rules. The deny side is evaluated before the allow side, and each side reads the fields its own rules name. A bag whose properties are accessors (an ORM row, a lazy proxy, a memoised getter over a cache that can refill) can answer the two sides differently and pass the deny it should have matched.

The matrix the engine evaluates is a frozen deep copy for exactly this reason. The subject and the object are not copied, because they are your app's data, and copying them would hide the cost.

**The Fix**: Pass plain, already-resolved objects.

### What a condition may read

A condition may read only fields the subject cannot write. A rule that keys on an object field within the subject's reach is self-authorizing: the subject edits the field, then passes the check the field controls. `eq('object.sharedWith', 'subject.id')` is the obvious trap, letting a user put their own id in the share field and be authorized for it.

**The Fix**: Keep the field out of every write path the rule guards, or key the rule on something the subject cannot reach: ownership set at creation, a role on the subject, a field the server alone writes.

Below, the share dialog writes `sharedWith` and any customer reaches it, so a read rule keyed on `sharedWith` hands the list to whoever shares it with themselves. The rule keyed on `ownerId` holds, because no write path carries `ownerId`:

### Matrix freshness

A client holds the matrix it last fetched. When a permission is revoked, that client keeps granting it until it refetches, and it has no way to notice. `access.version` is a surface for detecting a mismatch, not a mechanism for resolving one: comparing it, failing closed, and forcing a refetch are yours to implement. The comparison is a `!==`, so a digest or a composite covering every input works as well as a counter. The server never depends on a client's copy in any case, since it evaluates its own.

A document that states no `version` leaves `access.version` undefined, and a `!==` against undefined decides nothing. A producer that wants the contract to hold states a version; a content hash of the document is enough.

The whole mechanism the library supplies is the comparison. Fetching, deciding what to do with a mismatch, and rebuilding are yours:

Until that runs, the client grants what it last fetched. Nothing pushes an update to a holder. A holder that reports `fetchedAt` gets a freshness budget from the document's `maxStale`, and past `fetchedAt + min(maxStale, options.maxStale)` every key answers `stale-contract`. A holder that reports no `fetchedAt` claims no freshness and runs under no expiry.

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

Omitting `now` reads the wall clock. A clock that does not parse never throws:
the permission refuses with `reason: 'unusable-clock'`, which is not repairable
by a refetch and carries no `missing`.

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
