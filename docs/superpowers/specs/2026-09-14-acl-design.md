# `@evanion/acl` — Design

A declarative access-control matrix authored once and evaluated **locally** on
whatever JS runtime is running: a Node backend, a frontend SSR graph (Next RSC,
React Router framework mode), a browser SPA, or a hybrid JS platform (React
Native on Hermes, Electron/Tauri, Capacitor).

The matrix is a serializable, frozen JS object that round-trips through JSON.
Evaluation is a pure local function of `(matrix, context)`. There are no
per-subject capability snapshots and no backend roundtrip for a decision.

## Packaging

Two packages, following the repo's universal-core + separate-platform convention
(the `widget` → `react-widget` / `astro-widget` split):

| Package              | Role                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@evanion/acl`       | Universal core. Framework-free, runs in any JS runtime. No React, no DOM, no Node-only dependency. Carries the engine and the server-side `authorize(subject, ...)` util. |
| `@evanion/react-acl` | React binding. `PolicyProvider` + hooks. Depends on the core.                                                                                                             |

There are no per-framework packages and no `/next` or `/react-router` exports.
The React package serves both runtime shapes from one surface — an RSC-style
graph (Next and any RSC-capable framework) and a traditional Node server/client
split — without naming a framework. Each shape is a supported usage, not a
separate product. See [Consumption shapes](#consumption-shapes).

## Model

- **One artifact: the matrix definition.** A global policy document. It is the
  only thing that must be serializable.
- **One engine, local evaluation.** `can(subject, key, action, object, now)` is
  a pure function of the matrix and a context. The platform that evaluates holds
  the matrix and computes the answer itself.
- **The frontend pulls the matrix once** — from a backend endpoint
  (`parseMatrix(await fetch(...))`) or bundled at build time — instantiates it
  once, then evaluates locally forever.
- **A non-JS backend** (e.g. .NET) uses its own ACL and only shares JSON at the
  boundary. The user chooses: the backend serializes its matrix and exposes an
  endpoint the frontend fetches, or the two keep separate definitions.
- **Consequence:** because the matrix ships to the client in full, it cannot
  contain anything that must stay secret or be decided server-side. Opaque
  server checks live outside the matrix, as server-side app-layer decisions.

```
matrix (serializable, frozen, JSON round-trip) ─▶ one engine: can(subject, key, action, object?, now?) → Decision
        │
        ├─ Node backend     local evaluation (authoritative)
        ├─ FE SSR           local (RSC graph / React Router loaders, actions, middleware)
        ├─ Browser SPA      local (view toggling, non-authoritative)
        └─ RN/Electron      local (pure JS, no Node/DOM deps)
```

## Vocabulary

Authorization has a standard vocabulary — **subject / object / action** — used
by Casbin, Cedar and OWASP. This library adopts it, because "resource" is
overloaded in every entry point: it names both the _kind_ (`'comment'`) and the
_instance_ (`comment`). The split removes that collision before the API is
public, avoiding a v2 breaking rename.

| Term      | Means                                     | Example     |
| --------- | ----------------------------------------- | ----------- |
| `subject` | the actor doing the action                | a `User`    |
| `key`     | the object kind                           | `'comment'` |
| `action`  | what they do                              | `'update'`  |
| `object`  | the instance they act on, when one exists | a `Comment` |

The canonical call order across every entry point is
`(subject, key, action, object?, now?)`. It is the same order in `can`,
`canMany`, `canFields`, `authorize`, and the bound `object()` handler. The
`key` names the object kind; `object` is the instance, optional for the create
case; `now` is the optional clock instant. All examples and the hooks
(`useCan(key, action, object?)`, etc.) use this order.

## Scope

### In scope (v1)

- A canonical, serializable, frozen matrix definition.
- One framework-free engine evaluating it in any JS runtime.
- Authoring helpers with typed subject and object keys.
- Matrix acquisition by fetch or by build-time bundling.
- `@evanion/react-acl`: provider and hooks.
- The server-side `authorize(subject)` util, in the core.
- Field-level permissions.
- Bulk evaluation (`canMany`) in the core.

### Non-goals

- No .NET/Go/other-language evaluator. A non-JS backend uses its own ACL; only
  JSON crosses the boundary.
- No predicate functions. Rules are declarative data, because the matrix must
  round-trip through `JSON.stringify` losslessly.
- No row-scoping query language. Collection filtering over a list is deferred
  to v2 (see [Collection scoping](#collection-scoping-deferred-to-v2)).
- No obligation hooks, no Redis-backed role graphs, no inference of subject
  types from classes.
- No Casbin/Cedar native-format parsing. The library defines canonical JSON; a
  foreign backend emits that, or the user keeps separate definitions.
- No per-subject capability projection or snapshot-refresh machinery. The FE
  evaluates the full matrix locally.
- No framework-specific packages. React is the only binding.

## The evaluation context

`can(subject, key, action, object?, now?)` splits the subject and the object as
separate structured arguments. The condition DSL reads fields from a **three-key
context object** with namespaced paths:

```
{ subject: { ... }, object: { ... }, now: <instant> }
```

Paths are written `subject.*`, `object.*`, and bare `now`. The engine never
spreads subject and object into a single flat bag, because fields can collide
(`id` on the subject and `id` on the object would silently overwrite) — a
silent-allow or silent-deny bug. Namespacing is the load-bearing decision.

Construction validates that every condition field resolves within one of the
three namespaces. For a foreign matrix the check is namespace-only (the engine
has no types to check field names against); for the typed authoring path, field
names are additionally checked at compile time against the declared types.

## Matrix format

A flat list with a `dependsOn` cascade, mirroring `@evanion/feature`.

```json
[
  {
    "key": "article.update",
    "object": "article",
    "action": "update",
    "rules": [
      {
        "id": "author",
        "when": [
          { "field": "object.authorId", "op": "eq", "path": "subject.id" }
        ]
      },
      {
        "id": "editor",
        "when": [
          { "field": "subject.roles", "op": "contains", "value": "editor" }
        ]
      }
    ]
  },
  {
    "key": "article.publish",
    "object": "article",
    "action": "publish",
    "dependsOn": ["article.update"],
    "rules": [
      {
        "id": "editor-only",
        "when": [
          { "field": "subject.roles", "op": "contains", "value": "editor" }
        ]
      }
    ]
  }
]
```

- `key` = `object.action`. Construction requires `key` to equal
  `` `${object}.${action}` `` exactly, character for character, and rejects any
  other permission with `KeyMismatchError` naming all three. Lookup is by the
  `key` string, so a permission whose `key` disagrees with its `object` and
  `action` is unreachable — a silent hole in the matrix rather than a visible
  failure. A typed object→action union is derived for the typed authoring path.
- `rules` are OR-ed; the `when` conditions inside one rule are AND-ed.
- `dependsOn` is a cascade. A permission whose dependency resolves off is off,
  transitively, carrying `blockedBy` and `cause` — the same shape as `feature`.
- There is no `enabled` flag. A permission with no `rules` and no `dependsOn`
  denies; one with `rules` evaluates them.

### Cascade semantics in authorization terms

`dependsOn` means "you may do this only if you may also do that." It is not RBAC
permission inheritance. `article.publish dependsOn: ['article.update']` means a
publisher who may publish but not update is blocked. This is an intentional
reading of the feature-flag cascade transplanted to authorization, and it is
itself an implicit deny path.

## Rules

Rules are declarative conditions only. No functions.

| Form           | Example                                                        | Meaning                   |
| -------------- | -------------------------------------------------------------- | ------------------------- |
| subject path   | `{ field: 'subject.roles', op: 'contains', value: 'editor' }`  | a property of the subject |
| subject↔object | `{ field: 'object.authorId', op: 'eq', path: 'subject.id' }`   | compares two scopes       |
| time           | `{ field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' }` | a clock window            |

Ops are `eq`, `ne`, `in`, `not-in`, `contains`. Field access uses an
`Object.prototype.hasOwnProperty` guard: the subject and object are caller data,
so `constructor`, `__proto__` and `toString` must never resolve off the
prototype chain.

## Decision

Mirrors `feature`'s decision shape, renamed for authorization.

```ts
type Cause = {
  key: string; // the first ancestor off for a reason of its own
  reason: Reason;
  rule?: string;
};

type Decision = {
  key: string;
  allowed: boolean;
  reason: Reason;
  blockedBy?: string; // the dependency key, when reason is 'dependency-off'
  cause?: Cause; // the root of the cascade
  rule?: string; // the rule that decided, when reason is 'allow' | 'denied'
  missing?: string[]; // the field paths, when reason is 'unevaluable'
};

type Reason =
  | 'allow'
  | 'no-rule-matched'
  | 'denied'
  | 'dependency-off'
  | 'unknown-action'
  | 'unevaluable';
```

`cause` is a `Cause`, not a nested `Decision`. It answers one question — which
permission the cascade actually died on, and why — and `blockedBy` already names
the edge the cascade took, so a recursive decision would carry a second copy of
the chain the caller can walk from the matrix. The narrow shape also keeps the
decision flat enough to log.

`reason` is **output only**. Nothing in the library reads a `reason` back to
decide anything, so stripping it changes no decision. A test asserts this.

### Reasons

| `reason`          | meaning                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allow`           | an allow rule matched; carries `rule`                                                                                                                                            |
| `no-rule-matched` | rules present, none passed                                                                                                                                                       |
| `denied`          | an explicit deny matched (see [Deny](#deny)); carries `rule`                                                                                                                     |
| `dependency-off`  | a dependency resolved off; carries `blockedBy` and `cause`                                                                                                                       |
| `unknown-action`  | the key is not in the matrix (fail-closed path only)                                                                                                                             |
| `unevaluable`     | an `object`-dependent condition had no instance (the "create" case); carries `missing`. (A field-level decision needing a field the object did not carry is also `unevaluable`.) |

## Deny

Authorization needs an explicit deny that **wins over a concurrent allow**.
Pure allow-OR ("deny is just no matching allow") is the wrong model: real
policies are negative-rule-shaped ("admins can do X, except nobody can do Y on
this thing"), and the field-level bang-prefix already implies deny semantics, so
the action level must match.

A permission may carry `rules` (allows) and/or `denyRules` (denies). Denies use
the same `when`/`dependsOn` shape and are fully serializable.

Deny is a stage in the single precedence order, defined once (see the full
five-step order in [the no-instance case](#the-no-instance-case)):

1. If a deny rule matches, deny (reason `denied`).
2. Else if a dependency resolved off, deny (reason `dependency-off`,
   `blockedBy`, `cause`).
3. Else if an allow rule matches, allow (reason `allow`).
4. Else if an `object`-dependent rule could not be evaluated for lack of an
   instance, `unevaluable`.
5. Else deny (reason `no-rule-matched`).

When both a deny and a dependency-off apply, `denied` wins; the result may still
carry `blockedBy`/`cause`. A matched deny carries the same
`reason`-is-output-only contract.

## Unknown object or action

The open/closed behaviour is decided by how the matrix was built.

- **Typed, locally-defined matrix** (`policy(...)`): the key universe is known.
  An unknown key at runtime is a programmer error and **throws** a typed error
  (`UnknownPermissionError extends AuthorizationConfigError`), naming the key.
- **Foreign matrix** (`parseMatrix(...)`): the key universe is untrusted
  configuration data. An unknown key **fails closed** (`{ allowed: false,
reason: 'unknown-action' }`) and never throws.

The typed path also makes the object→action union exhaustive at compile time, so
the runtime throw is a backstop, not the primary defence. The two behaviours
are deliberate and documented, and both packages share the same default.

## The no-instance case

An `object` instance is not always available. The most common view toggle is
"can I create one" — `useCan('comment', 'create')` with no instance. Following
`feature`'s discipline ("a condition over a field the context does not carry
never holds"), an `object`-dependent rule with no instance is `unevaluable`,
not a fabricated `false`:

```ts
access.can(subject, 'comment', 'create');
// -> { allowed: false, reason: 'unevaluable', missing: ['object.authorId'] }
```

The engine never evaluates an absent object's fields against `undefined`.

### `unevaluable` in the precedence order

`unevaluable` is the result of a whole permission whose `object`-dependent rules
cannot be decided for lack of an instance. It ranks below `deny` and
`dependency-off` but above `no-rule-matched`, and it is distinct from a
definite deny:

1. If a deny rule matches, deny (`denied`).
2. Else if a dependency resolved off, deny (`dependency-off`).
3. Else if an allow rule matches, allow (`allow`).
4. Else if an `object`-dependent rule could not be evaluated for lack of an
   instance, `unevaluable`.
5. Else deny (`no-rule-matched`).

A rule that mixes `object`-dependent and `object`-independent branches with no
instance is decided by the `object`-independent branch alone:
`p.allow('create', p.or(p.eq('object.authorId', 'subject.id'), p.always))` with
no instance is `allow`, because `always` does not need the object. Only a permission whose matching branches all
need an absent object yields `unevaluable`.

## Field-level permissions

`can(subject, key, action, object, now)` returns the action `Decision`. A
separate entry point answers "which fields does this action touch":

```ts
access.canFields(subject, 'comment', 'update', comment, 'write');
// -> { allowed: false, fields: { body: 'allowed', title: 'allowed', status: 'denied' }, reasons: { body: 'allow', title: 'allow', status: 'denied' } }
```

Read and write are separate axes. **Read is a projection hint, never a security
boundary** — forced by the matrix-ships-to-client premise. `targets` and
`transitions` apply to the **write** axis only; the read axis accepts only an
allow-list or bang-prefix form.

### Field states

Each field decision is **tri-state**, because a missing field is not a deny:

```ts
type FieldState = 'allowed' | 'denied' | 'unevaluable';

type FieldReason =
  | 'allow' // the field passed its allow-list / value rule
  | 'not-listed' // the field is not in the allow-list
  | 'denied' // the field matched a bang ('!') entry or a deny
  | 'targets-failed' // the proposed value is not in the targets allow-list
  | 'transition-failed' // the current->proposed edge is not allowed
  | 'missing-field' // the object lacks the field the rule reads
  | 'proposed-required'; // a targets or transitions rule was evaluated without a proposed value

interface FieldDecision {
  allowed: boolean; // true iff every field is 'allowed'
  fields: Record<string, FieldState>;
  reasons: Record<string, FieldReason>;
}
```

There is no partial-allowed ambiguity: if any field is `denied` or
`unevaluable`, the top-level `allowed` is `false`.

### `fields()`

A permission's field rules attach through `fields()`, which accepts either an
array of field-name tokens or a per-field config object:

- **Allow-list** — `fields(['body', 'title'])`: only these are allowed.
- **Bang prefix** — `fields(['*', '!status'])`: everything except `status`. A
  negative entry requires a `*` baseline in the same call. `fields(['!status'])`
  (a deny with no baseline) and `fields(['body', 'title', '!status'])` (a bang
  mixed into an explicit allow-list, which already denies anything not listed)
  are both **construction errors**. A bang without a `*` leaves the allowed set
  undefined, so it is refused up front.
- **Per-field config** — `fields({ status: { ... } })`, write axis only, with
  exactly one of:
  - `targets: ['published']` — an allow-list of **proposed** values that may be
    written. Stateless: it does not depend on the current value.
  - `transitions: { draft: ['published'], published: [] }` — a static
    allowed-edge state machine over the field's **current** value. `published:
[]` means no outgoing move, so a revert to `draft` is impossible.
    `targets` and `transitions` are **mutually exclusive** per field.

`*` and `!name` are **authoring syntax**. They name a baseline and an exclusion
in the token list; they are not field names. The canonical matrix resolves them
at construction, and no field decision may key on them: `'*'` and `'!status'`
must never appear in the `fields` or `reasons` maps of a `FieldDecision`, which
carry real field names only.

Field rules stay **leaf-level**: they never cascade through `dependsOn`.

### The `proposed` value

The write axis takes an optional proposed value, because `targets` and
`transitions` read the field in different states:

```ts
canFields(subject, key, action, object, axis, proposed?, now?)
```

- `transitions` checks the edge from the field's **current** value on `object` to
  its value in `proposed`. Both ends are required: `canFields(subject, 'comment',
'update', currentComment, 'write', { status: 'published' })`.
- `targets` checks a **proposed** value alone, ignoring the current one:
  `canFields(subject, 'comment', 'update', currentComment, 'write', { status:
'published' })`.

Decision rule for choosing between them: **know the current value → use
`transitions`; setting a fresh field or not knowing the current value → use
`targets`.** Both forms require `proposed`; an edge with no destination and a
value allow-list with no candidate value are equally undecidable. When
`proposed` is omitted and either rule exists, the field decision is
`unevaluable` with reason `proposed-required`, naming the field. That is a
distinct condition from `missing-field`, which means the object lacks the field
a rule reads — the caller fixes one by passing a proposed state and the other by
passing a complete object.

The single `proposed` value is a whole-object write. It carries the proposed
state of the object being written, so each field configured with `targets` is
checked against the corresponding value in `proposed`, and each field configured
with `transitions` is checked against the edge from its current value in
`object` to its value in `proposed`. A single call can therefore mix `targets`
and `transitions` across fields of one write: the engine reads each field's
current value from `object` and its proposed value from `proposed`. When
`proposed` is a whole object, `canFields` covers the multi-field write case
without ambiguity.

### The transition contract

`transitions` reads the field's current value off the provided object. A partial
or projected object that lacks the field cannot answer. When a field-level
decision needs a field the object does not carry, the decision is `unevaluable`
and names the missing field — it never silently evaluates against `undefined`.
This is the `feature` `plan()` "deferred / needs" precedent.

## Authoring

### Canonical form: structural string keys

The canonical, serialized, and engine-facing form is a flat array of string-key
permissions (the JSON above). `parseMatrix(json)` adopts this form and validates
it.

### Typed path: the chained builder

`policy<Subject>()` names the subject once and returns a builder. Each `.for()`
call names one object kind, binds its object type, and hands a
**contextually-typed parameter** to a block. The condition helpers are methods on
that parameter, so they see both `Subject` and the block's object type.

```ts
import { policy } from '@evanion/acl';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };
type Media = { ownerId: string; bytes: number };

const access = policy<Subject>()
  .for<'comment', Comment>('comment', (p) =>
    p
      .allow(
        'update',
        p.or(
          p.eq('object.authorId', 'subject.id'),
          p.contains('subject.roles', 'editor'),
        ),
      )
      .fields({
        status: { transitions: { draft: ['published'], published: [] } },
      })
      .allow('publish', p.contains('subject.roles', 'editor'))
      .dependsOn('comment.update')
      .deny('delete', p.eq('object.status', 'published'))
      .allow('create', p.always)
      .allow('read', p.always)
      .fields(['*', '!status']),
  )
  .for<'media', Media>('media', (p) =>
    p.allow('read', p.eq('object.ownerId', 'subject.id')),
  );

access.can(subject, 'comment', 'update', comment);
//    subject: Subject   key: 'comment'   action: 'update'   object: Comment — all type-checked
access.can(subject, 'comment', 'create'); // no instance: reason 'unevaluable'
```

- `policy<Subject>()` names the subject once. Every `.for()` block reads
  `subject.*` paths against it.
- `.for<'comment', Comment>('comment', ...)` binds the key and its object type
  together and accumulates them into a key→object-type map. Chained `.for()`
  calls each contribute, so the map covers every configured kind.
- `access.can(subject, key, action, object?)` checks `key` against the
  accumulated key union and `object` against that key's type. An unknown key and
  a `Media` passed where a `Comment` is expected are both compile errors.
- The block parameter exposes `allow`, `deny` and `dependsOn` as chained
  methods, so the typed path spells everything the canonical JSON does —
  including explicit deny, which is [the reason](#deny) this library is more than
  a permission list.
- `.fields()` attaches to the action most recently declared in the chain.
- The condition helpers on the block parameter mirror the ops: `eq`, `ne`, `in`,
  `not-in`, `contains`, plus `and`, `or`, and `always`. `always` serializes to an
  empty `when` array (always true). A time condition is written with
  `before` / `after` over the `now` namespace, e.g.
  `p.after('now', '2026-10-01T00:00:00Z')`.
- `eq` is symmetric: either operand may name a field path, and a path operand is
  checked against the type its namespace resolves to.
- The builder **flattens** to the canonical flat JSON matrix at construction;
  `JSON.stringify(access.matrix)` emits the same document a foreign backend would
  produce.

#### Paths versus literals

An operand is read as a **path** when its string type matches
`` `subject.${string}` | `object.${string}` | 'now' ``, and as a **literal value**
otherwise. That shape is the only discriminator:

```ts
p.eq('object.status', 'published'); // 'published' is a literal — compiles
p.eq('object.authorId', 'subject.id'); // 'subject.id' is a path — checked
p.eq('object.authorId', 'subject.idd'); // compile error: unknown path
```

The rule is load-bearing. Without it a mistyped path (`'subject.idd'`) is
indistinguishable from a deliberate string literal, and the condition silently
compares a field against the text `"subject.idd"` instead of the subject's id.

#### What is checked

Checked at compile time:

- the object kind key, against the accumulated union of `.for()` keys
- the `object` argument of `can` / `canFields` / `canMany`, against that key's
  declared type
- every path operand, per resource: `object.authorId` is valid inside the
  `comment` block and a compile error inside the `media` block

Not checked at compile time:

- action names, which stay plain strings
- the comparand's value type against the field's type
- `dependsOn` keys, which are validated at construction instead

Path errors name the offending path rather than failing as an opaque
assignability mismatch:

```
Argument of type '"object.authrId"' is not assignable to parameter of type
"unknown path 'object.authrId' on this resource"
```

`.test-d.ts` cases assert that message, not merely that a type error exists.
Otherwise developers abandon the typed path for string keys and forfeit the
safety it sells.

#### Why not a nested object

A nested form — `policy<Subject>({ comment: { update: permit<Comment>(eq(...)) } })` —
reads better and cannot deliver the checking above. `eq(...)` is a free function
call whose type arguments are resolved before `permit<Comment>` binds anything,
so the helpers never see `Subject` or `Comment`; TypeScript has no partial
type-argument inference that would let `permit<Comment>` supply the object type
to an argument expression it merely receives. Written that way, the helpers
degrade to `(a: string, b: string)` and every path typo compiles clean. Only a
contextually-typed parameter puts the two types in scope where the operands are
written.

Only the canonical string-key form and the typed builder are in v1. The
constructor class-key path (`[Comment]:`) is not; it is the most magical of the
authoring options and reintroduces "class is a runtime value" against the JSON
round-trip. It can return in a later release if a consumer needs
instance-resolution.

### Construction entry points

Three constructors, one surface. Each returns the same `access` object —
`.can`, `.canFields`, `.canMany`, `.capabilities`, `.authorize`, `.object`,
`.matrix`, `.version`:

- `createPolicy(matrix)` — from a canonical matrix (array form).
- `policy<Subject>()` — from the typed builder; flattens to the same canonical
  matrix.
- `parseMatrix(json)` — from foreign or emitted JSON; the untrusted path.

All validate once and freeze. A locally-authored `policy(...)` has no foreign
`version`; `access.version` for a typed matrix is `undefined`, or a value the
author supplies as an option. Only a fetched matrix carries a meaningful
`version` for the revalidate contract.

### Optional: bound object handler

To avoid repeating the key, a small handler binds it once:

```ts
const comments = access.object('comment');
comments.can(subject, 'update', comment);
comments.canMany(subject, 'read', commentList);
```

`access.object(key)` narrows an existing `access` to one object kind. On a typed
matrix the key is checked against the accumulated union and the bound handler
keeps that key's object type on every call.

This is class-free, keeps plain data, and gives close to class-key ergonomics
without classes.

## Bulk evaluation

Rendering a list must not pay N context-normalization passes. The core exposes

```ts
access.canMany(subject, 'comment', 'read', comments, now);
// -> Decision[], parallel to the input array
```

which normalizes the subject/context once and folds over the objects, returning
a `Decision[]` parallel to the input. This is the seam collection filtering will
build on in v2; in v1 it is a documented fold over the same `decide`, not a
query language. Its primary justification is ergonomics and list handling, not a
claim that context normalization is the hot cost.

## Validation

`createPolicy(matrix)` validates once and **freezes**, mirroring `luhn`,
`token` and `feature`:

- duplicate keys
- a `key` that is not `` `${object}.${action}` ``
- `dependsOn` naming an unknown key
- dependency cycles, with the path in the error
- an unknown op
- a condition field that does not resolve within `subject.*` / `object.*` / `now`
  (namespace check; field-name validity is a typed-path compile-time guarantee)
- a deny with no `*` baseline in `fields()`
- a bang mixed into an explicit allow-list in `fields()`
- both `targets` and `transitions` on the same field
- a rule node that cannot round-trip through JSON (a captured object reference,
  a function, a `Date`, a `Map`)

The matrix is cloned and deeply frozen at construction (`structuredClone` +
`deepFreeze`), so an instance you hold can never produce a decision its own
config rejects, and a runtime object can never leak into it.

### Construction errors

Named classes, all extending `AuthorizationConfigError`, with messages that
explain themselves:

- `DenyWithoutBaselineError` — a `!` entry in `fields()` has no `*` baseline.
- `BangInAllowListError` — a `!` entry mixed into an explicit allow-list.
- `TargetsTransitionsConflictError` — both `targets` and `transitions` on one
  field.
- `KeyMismatchError` — `key` is not `` `${object}.${action}` ``.

**Open question:** the error hierarchy is prefixed `Authorization` while the
package is `@evanion/acl`. Renaming it to `AclConfigError` is a breaking change
to a public export, so it belongs before the first publish or not at all.

Evaluation is total: it never throws for a data-shape problem. Omitting
`proposed` where a `targets` or `transitions` rule exists yields an
`unevaluable` field decision with reason `proposed-required`, not a thrown
error, keeping the repo's "evaluate is total" discipline.

## Acquisition

- **Fetch**: `parseMatrix(await fetch(endpoint).then(r => r.json()))` — the
  foreign matrix is validated and adopted.
- **Build time**: the matrix is imported as a module and bundled (SSR and
  browser), the OpenAPI-spec parallel.

The matrix carries an integer `version` (or a hash), exposed as `access.version`.
The fetch-and-revalidate contract is documented: on a version mismatch after a
refetch, a frontend **fails closed** rather than continuing with the stale
matrix. A frontend evaluating a stale matrix keeps a permission the backend has
since revoked, so staleness is a security concern, not a cache detail. There is
no auto-refetch machinery in v1; the version is the surface the caller uses.

## Server-side `authorize`

A universal server-side helper lives in the core and binds a subject for the
current request. It is the curried form of `can`, so a Node middleware, loader,
action, or RSC server component evaluates against an `access` instance without
restating the subject:

```ts
import { createPolicy } from '@evanion/acl';

const access = createPolicy(matrix);
const forUser = access.authorize(subject, { now }); // returns a bound handle

forUser.can('comment', 'create'); // -> Decision
forUser.can('comment', 'update', comment); // -> Decision
forUser.canMany('comment', 'read', comments); // -> Decision[]
```

`authorize` lives in the core, not the React package, because it is plain Node
server-side evaluation and must not force a React peer dependency on a server
that only needs the evaluator. The traditional split's middleware/loader/action
is a plain Node layer and imports from the core.

Signature: `access.authorize(subject, { now? }): Authorized` where `Authorized`
exposes `can`, `canMany`, `canFields` and `capabilities` with the `subject`
already bound.

## Consumption shapes

`@evanion/react-acl` serves both runtime shapes from one surface.
Neither is named to a framework; each is a supported usage pattern.

### RSC-style

A Server Component resolves the subject, evaluates on Node, and passes the
subject/context down to the provider. Applies to Next and any RSC-capable
framework.

```tsx
// server component
import { createPolicy } from '@evanion/acl';
const access = createPolicy(matrix);
const subject = await getSubject(); // app-supplied (cookies/session)
const forUser = access.authorize(subject);
const decision = forUser.can('comment', 'create'); // -> Decision
// render conditionally, and pass subject to the provider:

<PolicyProvider access={access} subject={subject} context={{ now }}>
  <CommentForm />
</PolicyProvider>;
```

### Traditional Node server / client split

Middleware, a loader, or an action resolves the subject and evaluates server-side
(authoritative), then bridges the result to the client provider.

```tsx
// server (middleware / loader / action) — imports from the core, no React dep
import { createPolicy } from '@evanion/acl';
const access = createPolicy(matrix);
const subject = resolveSubject(req);                    // app-supplied
const decision = access.authorize(subject).can('comment', 'update', comment);
if (!decision.allowed) return redirect(...);

// client provider, fed the server-resolved subject
import { PolicyProvider } from '@evanion/react-acl';
<PolicyProvider access={access} subject={subject} context={{ now }}>
  <CommentList />
</PolicyProvider>
```

In both shapes the subject crossing server→client is passed explicitly by the
app; the package never reaches into request/context plumbing. The adapter
supplies the evaluator, not the principal.

## React binding

`@evanion/react-acl` exposes:

```tsx
import {
  PolicyProvider,
  useCan,
  useCanFields,
  useCanMany,
} from '@evanion/react-acl';

<PolicyProvider access={access} subject={subject} context={{ now }}>
  <App />
</PolicyProvider>;

function Row() {
  const decision = useCan('comment', 'update', comment);
  if (!decision.allowed) return <ReadOnlyComment reason={decision.reason} />;
  return <EditableComment />;
}
```

Hooks:

- `useCan(key, action, object?)` — one decision. `key` is the object name
  (`'comment'`); `object` is the instance, when one is available. With no
  instance and an `object`-dependent rule, the decision is `unevaluable`.
- `useCanFields(key, action, object, axis, proposed?)` — the field-level
  decision. `axis` is `'read'` or `'write'`.
- `useCanMany(key, action, objects)` — a bulk decision array for a list,
  parallel to the input.
- `useCapabilities()` — every decision for the **current subject**, action-level
  only (no object, so no `object`-dependent decisions). It is backed by the
  core's `access.capabilities(subject, { now })`, which returns one
  `Decision` per configured key, keyed as a record `Record<key, Decision>` —
  the same keyed shape `feature`'s `resolve()` uses. For an unconfigured key it
  matches the matrix's open/closed behaviour (throws for a typed matrix, fails
  closed for a foreign one).

The provider evaluates the full matrix against the current context; it does not
ship or imply a per-subject snapshot. Evaluation is memoised on the tuple
`(context identity, key, action, object identity)` — a hook that carries a
per-call `object` must not key on the context alone, or a re-render with a
different instance returns a stale decision. Lists should use `useCanMany` to
avoid N memoised evaluations.

## React Native and Electron

React Native and Electron consume the core (and the `react-acl` hooks
where the rendering maps) directly; the engine has no Node or DOM dependency,
so it runs on Hermes and in an Electron renderer unchanged.

## Collection scoping (deferred to v2)

Row-level scoping ("read comments where `authorId` is me") is the most common
ACL shape and is deliberately not in v1. The reason: a client-side filter is
half a feature, and real row-scoping requires the backend to **push the filter
into the database** — a query-builder this library does not own. Building a
filter DSL risks the Mongo-shaped-condition drift the `feature` design warned
about.

What v1 ships to make v2 possible without a redesign:

- The **object-path condition primitive** (`object.authorId eq subject.id`),
  which is the row-scope building block.
- **`canMany`** as a documented fold over the same `decide`.

v2 can then add filter semantics and DB pushdown without touching the
evaluation model.

## Repo structure

```
libs/acl/                 # universal core
  src/
    index.ts          # createPolicy / policy, parseMatrix, can, canMany, canFields, capabilities, authorize
    types.ts          # Matrix, Permission, Rule, Condition, Decision, Reason, FieldState, FieldReason, FieldDecision
    evaluate.ts       # can(): (matrix, context) -> Decision
    conditions.ts     # declarative condition evaluator (namespaced paths + proto guard)
    graph.ts          # dependsOn cascade + cycle/unknown/duplicate validation
    project.ts        # typed builder -> canonical flat matrix
    parse-matrix.ts   # foreign JSON validation/adoption
    authorize.ts      # access.authorize(subject) -> bound Authorized handle
    errors.ts
    test-setup.ts
  README.md
  package.json        # name: @evanion/acl

libs/react-acl/           # React binding, depends on @evanion/acl
  src/
    index.tsx         # PolicyProvider + hooks; re-exports core types
    test-setup.ts
  README.md
  package.json        # name: @evanion/react-acl
```

Both follow `@evanion/source` file-per-entry packaging; the React package marks
its client modules `'use client'`, re-exports the core's types so a consumer who
never names the core never installs it by hand, and depends on a compatible
range of `@evanion/acl`. The two packages release in lockstep. When
`react-acl` is documented, `apps/docs`' `navigation.ts` gains an entry
and the repo-checks test passes.

## Testing

Mirrors `feature`'s discipline:

- one unit test per condition op
- the `dependsOn` cascade
- validation errors (duplicate key, key/object.action mismatch, unknown
  dependency, cycle, unknown op, namespace resolution, deny-without-baseline,
  bang-in-allow-list, targets+transitions exclusivity)
- a serializability round-trip (matrix → JSON → matrix → identical decisions)
- a `reason`-is-output-only invariant (decide with reasons stripped, assert the
  same outcome)
- field-level: allow-list, bang prefix, `targets`, `transitions`, exclusivity,
  partial-object → `unevaluable`, `proposed`-omitted → `proposed-required`
- a field decision map that carries only real field names, never `*` or `!name`
- the no-instance `unevaluable` case
- README doctests (`@import.meta.vitest`)
- a `react-acl` smoke test (provider + hooks)

### Precedence tests

The five-step order is the whole engine, and a test suite that only asserts
allow/deny outcomes passes whether or not the steps are in order. These cases
must each fail if the step they cover is removed or reordered:

- a matched deny and a matched allow, together: the reason is `denied`
- a matched deny and a dependency that resolved off, together: the reason is
  `denied`, not `dependency-off`
- a permission whose `object`-dependent rules are undecidable while an allow rule
  would match: the reason is `allow`, so `unevaluable` ranks below allow
- the same permission with no matching allow rule: the reason is `unevaluable`,
  not `no-rule-matched`, so `unevaluable` ranks above no-rule-matched
- one field `unevaluable` and every other field `allowed`: the top-level
  `allowed` is `false`
- one rule whose `when` holds two conditions, the first true and the second
  false: the rule does not match, so `when` is AND-ed and not OR-ed

### Typed authoring tests

`.test-d.ts` cases over the builder, asserting the **message**, not merely that
an error exists:

- a mistyped path names the path (`unknown path 'object.authrId' on this
resource`)
- a path valid on one resource is rejected inside another resource's block
- an unknown object kind passed to `can` is rejected against the key union
- an object of the wrong kind passed to `can` is rejected against the key's type
- a literal comparand (`p.eq('object.status', 'published')`) compiles
