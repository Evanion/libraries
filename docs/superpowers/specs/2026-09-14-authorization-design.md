# `@evanion/authorization` — Design

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

| Package | Role |
| ------- | ---- |
| `@evanion/authorization` | Universal core. Framework-free, runs in any JS runtime. No React, no DOM, no Node-only dependency. Carries the engine and the server-side `authorize(subject, ...)` util. |
| `@evanion/react-authorization` | React binding. `PolicyProvider` + hooks. Depends on the core. |

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
overloaded in every entry point: it names both the *kind* (`'comment'`) and the
*instance* (`comment`). The split removes that collision before the API is
public, avoiding a v2 breaking rename.

| Term | Means | Example |
| ---- | ----- | ------- |
| `subject` | the actor doing the action | a `User` |
| `key` | the object kind | `'comment'` |
| `action` | what they do | `'update'` |
| `object` | the instance they act on, when one exists | a `Comment` |

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
- `@evanion/react-authorization`: provider and hooks.
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
    "object": "Article",
    "action": "update",
    "rules": [
      { "id": "author", "when": [{ "field": "object.authorId", "op": "eq", "path": "subject.id" }] },
      { "id": "editor", "when": [{ "field": "subject.roles", "op": "contains", "value": "editor" }] }
    ]
  },
  {
    "key": "article.publish",
    "object": "Article",
    "action": "publish",
    "dependsOn": ["article.update"],
    "rules": [ { "id": "editor-only", "when": [{ "field": "subject.roles", "op": "contains", "value": "editor" }] } ]
  }
]
```

- `key` = `object.action`. A typed object→action union is derived for the typed
  authoring path.
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

| Form | Example | Meaning |
| ---- | ------- | ------- |
| subject path | `{ field: 'subject.roles', op: 'contains', value: 'editor' }` | a property of the subject |
| subject↔object | `{ field: 'object.authorId', op: 'eq', path: 'subject.id' }` | compares two scopes |
| time | `{ field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' }` | a clock window |

Ops are `eq`, `ne`, `in`, `not-in`, `contains`. Field access uses an
`Object.prototype.hasOwnProperty` guard: the subject and object are caller data,
so `constructor`, `__proto__` and `toString` must never resolve off the
prototype chain.

## Decision

Mirrors `feature`'s decision shape, renamed for authorization.

```ts
type Decision = {
  key: string;
  allowed: boolean;
  reason: Reason;
  blockedBy?: string;    // the dependency key, when reason is 'dependency-off'
  cause?: Decision;      // the first ancestor off, for a reason of its own
  rule?: string;         // the rule that decided, when reason is 'allow' | 'denied'
  missing?: string[];    // the field paths, when reason is 'unevaluable'
};

type Reason =
  | 'allow'
  | 'no-rule-matched'
  | 'denied'
  | 'dependency-off'
  | 'unknown-action'
  | 'unevaluable';
```

`reason` is **output only**. Nothing in the library reads a `reason` back to
decide anything, so stripping it changes no decision. A test asserts this.

### Reasons

| `reason` | meaning |
| -------- | ------- |
| `allow` | an allow rule matched; carries `rule` |
| `no-rule-matched` | rules present, none passed |
| `denied` | an explicit deny matched (see [Deny](#deny)); carries `rule` |
| `dependency-off` | a dependency resolved off; carries `blockedBy` and `cause` |
| `unknown-action` | the key is not in the matrix (fail-closed path only) |
| `unevaluable` | an `object`-dependent condition had no instance (the "create" case); carries `missing`. (A field-level decision needing a field the object did not carry is also `unevaluable`.) |

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
instance is decided by the `object`-independent branch alone: `permit(or(eq('object.authorId','subject.id'), always))` with no instance is `allow`, because
`always` does not need the object. Only a permission whose matching branches all
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
  | 'allow'                 // the field passed its allow-list / value rule
  | 'not-listed'            // the field is not in the allow-list
  | 'denied'                // the field matched a bang ('!') entry or a deny
  | 'targets-failed'        // the proposed value is not in the targets allow-list
  | 'transition-failed'     // the current->proposed edge is not allowed
  | 'missing-field'         // the object lacks the field the rule reads
  | 'proposed-required';     // a targets rule was evaluated without a proposed value

interface FieldDecision {
  allowed: boolean;            // true iff every field is 'allowed'
  fields: Record<string, FieldState>;
  reasons: Record<string, FieldReason>;
}
```

There is no partial-allowed ambiguity: if any field is `denied` or
`unevaluable`, the top-level `allowed` is `false`.

### `fields()`

A permission's field rules attach through `fields()`, which accepts one of:

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

Field rules stay **leaf-level**: they never cascade through `dependsOn`.

### The `proposed` value

The write axis takes an optional proposed value, because `targets` and
`transitions` read the field in different states:

```ts
canFields(subject, key, action, object, axis, proposed?, now?)
```

- `transitions` reads the field's **current** value off `object` and checks the
  allowed edge. `canFields(subject, 'comment', 'update', currentComment, 'write')`.
- `targets` checks a **proposed** value: `canFields(subject, 'comment', 'update',
  currentComment, 'write', { status: 'published' })`.

Decision rule for choosing between them: **know the current value → use
`transitions`; setting a fresh field or not knowing the current value → use
`targets`.** If `proposed` is omitted but a `targets` rule exists, the decision
is `unevaluable` naming the field.

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

### Typed path: `policy` + `permit`

A generic gives the subject type; the object type rides on the value where
generics are legal.

```ts
import { policy, permit, and, or, eq, contains, always } from '@evanion/authorization';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };

const access = policy<Subject>({
  comment: {
    update: permit<Comment>(
      or(
        eq('object.authorId', 'subject.id'),
        contains('subject.roles', 'editor'),
      ),
    ).fields({
      status: { transitions: { draft: ['published'], published: [] } },
    }),
    create: permit<Comment>(always),
    read: permit<Comment>(always).fields(['*', '!status']),
  },
});

access.can(subject, 'comment', 'update', comment);
//    subject: Subject   key: 'comment'   action: 'update'   object: Comment — all type-checked
access.can(subject, 'comment', 'create');       // no instance: reason 'unevaluable'
```

- `policy<Subject>` names the subject once.
- `permit<Comment>` carries the object type on the value, so a `type` alias
  works and the matrix stays plain data.
- `eq('object.authorId', 'subject.id')` is verified against
  `Comment['authorId']` (string) and `Subject['id']` (string). A typo, a wrong
  subject type, or a bad field path is a compile error.
- The helpers `always`, `and` and `or` compose the rule DSL. `or` lets a rule
  express alternatives (`isOwner OR isEditor`), which the array-level OR alone
  cannot spell through `permit`.
- `eq` is symmetric: both arguments are field paths resolved in the namespaced
  context, and both are checked against their respective types regardless of
  which scope they name. A field may also be compared to a **literal**
  (`eq('object.status', 'published')`), matching the canonical condition DSL's
  `value` form.
- The full typed helper surface mirrors the ops: `eq`, `ne`, `in`, `not-in`,
  `contains`, plus `and`, `or`, and `always`. `always` serializes to an empty
  `when` array (always true). A time condition is written with
  `before` / `after` over the `now` namespace, e.g.
  `after('now', '2026-10-01T00:00:00Z')`.
- The nested authoring form **flattens** to the canonical flat JSON matrix at
  construction; `JSON.stringify(access.matrix)` emits the same document a foreign
  backend would produce.

The typed path's generic plumbing must produce **readable** errors — the
message names the offending field or path, not an opaque `Type 'string' is not
assignable`. `.test-d.ts` cases assert readable errors, not merely that a type
error exists. Otherwise developers abandon the typed path for string keys and
forfeit the safety it sells.

Only the canonical string-key form and the `permit<Object>` typed path are in
v1. The constructor class-key path (`[Comment]:`) is not; it is the most magical
of the authoring options and reintroduces "class is a runtime value" against the
JSON round-trip. It can return in a later release if a consumer needs
instance-resolution.

### Construction entry points

Three constructors, one surface. Each returns the same `access` object —
`.can`, `.canFields`, `.canMany`, `.capabilities`, `.authorize`, `.object`,
`.matrix`, `.version`:

- `createPolicy(matrix)` — from a canonical matrix (array form).
- `policy<Subject>(nested)` — from the typed nested authoring form; flattens to
  the same canonical matrix.
- `parseMatrix(json)` — from foreign or emitted JSON; the untrusted path.

All validate once and freeze. A locally-authored `policy(...)` has no foreign
`version`; `access.version` for a typed matrix is `undefined`, or a value the
author supplies as an option. Only a fetched matrix carries a meaningful
`version` for the revalidate contract.

### Optional: bound object handler

To avoid repeating the key, a small handler binds it once:

```ts
const comments = access.object('comment', {
  update: permit<Comment>(...),
  create: permit<Comment>(always),
  read: permit<Comment>(always),
});
comments.can(subject, 'update', comment);
```

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

Evaluation is total: it never throws for a data-shape problem. Omitting
`proposed` where a `targets` rule exists yields an `unevaluable` field decision,
not a thrown error, keeping the repo's "evaluate is total" discipline.

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
import { createPolicy } from '@evanion/authorization';

const access = createPolicy(matrix);
const forUser = access.authorize(subject, { now });   // returns a bound handle

forUser.can('comment', 'create');                    // -> Decision
forUser.can('comment', 'update', comment);           // -> Decision
forUser.canMany('comment', 'read', comments);        // -> Decision[]
```

`authorize` lives in the core, not the React package, because it is plain Node
server-side evaluation and must not force a React peer dependency on a server
that only needs the evaluator. The traditional split's middleware/loader/action
is a plain Node layer and imports from the core.

Signature: `access.authorize(subject, { now? }): Authorized` where `Authorized`
exposes `can`, `canMany`, `canFields` and `capabilities` with the `subject`
already bound.

## Consumption shapes

`@evanion/react-authorization` serves both runtime shapes from one surface.
Neither is named to a framework; each is a supported usage pattern.

### RSC-style

A Server Component resolves the subject, evaluates on Node, and passes the
subject/context down to the provider. Applies to Next and any RSC-capable
framework.

```tsx
// server component
import { createPolicy } from '@evanion/authorization';
const access = createPolicy(matrix);
const subject = await getSubject();                     // app-supplied (cookies/session)
const forUser = access.authorize(subject);
const decision = forUser.can('comment', 'create');      // -> Decision
// render conditionally, and pass subject to the provider:

<PolicyProvider access={access} subject={subject} context={{ now }}>
  <CommentForm />
</PolicyProvider>
```

### Traditional Node server / client split

Middleware, a loader, or an action resolves the subject and evaluates server-side
(authoritative), then bridges the result to the client provider.

```tsx
// server (middleware / loader / action) — imports from the core, no React dep
import { createPolicy } from '@evanion/authorization';
const access = createPolicy(matrix);
const subject = resolveSubject(req);                    // app-supplied
const allowed = access.authorize(subject).can('comment', 'update', comment);
if (!allowed) return redirect(...);

// client provider, fed the server-resolved subject
import { PolicyProvider } from '@evanion/react-authorization';
<PolicyProvider access={access} subject={subject} context={{ now }}>
  <CommentList />
</PolicyProvider>
```

In both shapes the subject crossing server→client is passed explicitly by the
app; the package never reaches into request/context plumbing. The adapter
supplies the evaluator, not the principal.

## React binding

`@evanion/react-authorization` exposes:

```tsx
import { PolicyProvider, useCan, useCanFields, useCanMany } from '@evanion/react-authorization';

<PolicyProvider access={access} subject={subject} context={{ now }}>
  <App />
</PolicyProvider>;

function Row() {
  if (!useCan('comment', 'update', comment)) return <ReadOnlyComment />;
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

React Native and Electron consume the core (and the `react-authorization` hooks
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
libs/authorization/                 # universal core
  src/
    index.ts          # createPolicy / policy, parseMatrix, can, canMany, canFields, capabilities, authorize
    types.ts          # Matrix, Permission, Rule, Condition, Decision, Reason, FieldState, FieldReason, FieldDecision
    evaluate.ts       # can(): (matrix, context) -> Decision
    conditions.ts     # declarative condition evaluator (namespaced paths + proto guard)
    graph.ts          # dependsOn cascade + cycle/unknown/duplicate validation
    project.ts        # nested authoring form -> canonical flat matrix
    parse-matrix.ts   # foreign JSON validation/adoption
    authorize.ts      # access.authorize(subject) -> bound Authorized handle
    errors.ts
    test-setup.ts
  README.md
  package.json        # name: @evanion/authorization

libs/react-authorization/           # React binding, depends on @evanion/authorization
  src/
    index.tsx         # PolicyProvider + hooks; re-exports core types
    test-setup.ts
  README.md
  package.json        # name: @evanion/react-authorization
```

Both follow `@evanion/source` file-per-entry packaging; the React package marks
its client modules `'use client'`, re-exports the core's types so a consumer who
never names the core never installs it by hand, and depends on a compatible
range of `@evanion/authorization`. The two packages release in lockstep. When
`react-authorization` is documented, `apps/docs`' `navigation.ts` gains an entry
and the repo-checks test passes.

## Testing

Mirrors `feature`'s discipline:

- one unit test per condition op
- the `dependsOn` cascade
- validation errors (duplicate key, unknown dependency, cycle, unknown op,
  namespace resolution, deny-without-baseline, bang-in-allow-list,
  targets+transitions exclusivity)
- a serializability round-trip (matrix → JSON → matrix → identical decisions)
- a `reason`-is-output-only invariant (decide with reasons stripped, assert the
  same outcome)
- field-level: allow-list, bang prefix, `targets`, `transitions`, exclusivity,
  partial-object → `unevaluable`, `proposed`-omitted-with-`targets`
- deny precedence (deny beats allow, and deny beats dependency-off)
- the no-instance `unevaluable` case
- typed `.test-d.ts` for the `policy`/`permit` authoring path, asserting
  *readable* errors
- README doctests (`@import.meta.vitest`)
- a `react-authorization` smoke test (provider + hooks)
