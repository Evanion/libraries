# `@evanion/authorization` — Design

A declarative access-control matrix authored once and evaluated **locally** on
whatever JS runtime is running: a Node backend, a frontend SSR graph (Next RSC,
React Router 7+ framework mode), a browser SPA, or a hybrid JS platform (React
Native on Hermes, Electron/Tauri, Capacitor).

The matrix is a serializable, frozen JS object that round-trips through JSON.
Evaluation is a pure local function of `(matrix, context)`. There are no
per-actor capability snapshots and no backend roundtrip for a decision.

## Model

- **One artifact: the matrix definition.** A global policy document. It is the
  only thing that must be serializable.
- **One engine, local evaluation.** `can(actor, action, resource, now)` is a
  pure function of the matrix and a context. The platform that evaluates holds
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
matrix (serializable, frozen, JSON round-trip) ─▶ one engine: can(actor, action, resource, now) → Decision
        │
        ├─ Node backend     local evaluation (authoritative)
        ├─ FE SSR           local (Next RSC / RR7+ loaders, actions, middleware)
        ├─ Browser SPA      local (view toggling, non-authoritative)
        └─ RN/Electron      local (pure JS, no Node/DOM deps)
```

## Scope

### In scope (v1)

- A canonical, serializable, frozen matrix definition.
- One framework-free engine evaluating it in any JS runtime.
- Authoring helpers with typed resource and actor keys.
- Matrix acquisition by fetch or by build-time bundling.
- A thin `/react` binding (provider + hooks).
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
- No per-actor capability projection or snapshot-refresh machinery. The FE
  evaluates the full matrix locally.

## The evaluation context

`can(actor, action, resource, now)` splits the actor and the resource as
separate structured arguments. The condition DSL reads fields from a **three-key
context object** with namespaced paths:

```
{ actor: { ... }, resource: { ... }, now: <instant> }
```

Paths are written `actor.*`, `resource.*`, and bare `now`. The engine never
spreads actor and resource into a single flat bag, because fields can collide
(`id` on the actor and `id` on the resource would silently overwrite) — a
silent-allow or silent-deny bug. Namespacing is the load-bearing decision.

Construction validates that every condition field resolves within one of the
three namespaces, catching a condition typo at build time rather than at
enforcement time.

## Matrix format

A flat list with a `dependsOn` cascade, mirroring `@evanion/feature`.

```json
[
  {
    "key": "article.update",
    "resource": "Article",
    "action": "update",
    "rules": [
      { "id": "author", "when": [{ "field": "resource.authorId", "op": "eq", "path": "actor.id" }] },
      { "id": "editor", "when": [{ "field": "actor.roles", "op": "contains", "value": "editor" }] }
    ]
  },
  {
    "key": "article.publish",
    "resource": "Article",
    "action": "publish",
    "dependsOn": ["article.update"],
    "rules": [ { "id": "editor-only", "when": [{ "field": "actor.roles", "op": "contains", "value": "editor" }] } ]
  }
]
```

- `key` = `resource.action`. A typed resource→action union is derived for the
  typed authoring path.
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
| actor path | `{ field: 'actor.roles', op: 'contains', value: 'editor' }` | a property of the actor |
| actor↔resource | `{ field: 'resource.authorId', op: 'eq', path: 'actor.id' }` | compares two scopes |
| time | `{ field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' }` | a clock window |

Ops are `eq`, `ne`, `in`, `not-in`, `contains`. Field access uses an
`Object.prototype.hasOwnProperty` guard: the actor and resource are caller data,
so `constructor`, `__proto__` and `toString` must never resolve off the
prototype chain.

## Decision

Identical to `feature`'s decision shape.

```ts
{
  key: 'article.publish',
  allowed: false,
  reason: 'dependency-off',
  blockedBy: 'article.update',
  cause: { key: 'article.update', reason: 'no-rule-matched', rule: 'author' },
}
```

`reason` is **output only**. Nothing in the library reads a `reason` back to
decide anything, so stripping it changes no decision. A test asserts this.

### Reasons

| `reason` | meaning |
| -------- | ------- |
| `allow` | a rule matched |
| `no-rule-matched` | rules present, none passed |
| `denied` | an explicit deny matched (see [Deny](#deny)) |
| `dependency-off` | a dependency resolved off; carries `blockedBy` and `cause` |
| `unknown-action` | the key is not in the matrix (fail-closed path only) |
| `unevaluable` | a field-level decision needed a field the resource did not carry |

## Deny

Authorization needs an explicit deny that **wins over a concurrent allow**.
Pure allow-OR ("deny is just no matching allow") is the wrong model: real
policies are negative-rule-shaped ("admins can do X, except nobody can do Y on
this thing"), and the field-level bang-prefix already implies deny semantics, so
the action level must match.

A permission may carry `rules` (allows) and/or `denyRules` (denies). Denies use
the same `when`/`dependsOn` shape and are fully serializable.

Precedence, defined once:

1. If a deny rule matches, deny (reason `denied`).
2. Else if an allow rule matches, allow (reason `allow`).
3. Else deny (reason `no-rule-matched`).

A matched deny carries the same `reason`-is-output-only contract.

## Unknown resource or action

The open/closed behaviour is decided by how the matrix was built.

- **Typed, locally-defined matrix** (`policy(...)`): the key universe is known.
  An unknown key at runtime is a programmer error and **throws** a typed error
  (`UnknownPermissionError extends AuthorizationConfigError`), naming the key.
- **Foreign matrix** (`parseMatrix(...)`): the key universe is untrusted
  configuration data. An unknown key **fails closed** (`{ allowed: false,
  reason: 'unknown-action' }`) and never throws.

The typed path also makes the resource→action union exhaustive at compile time,
so the runtime throw is a backstop, not the primary defence. The two behaviours
are deliberate and documented, and every binding shares the same default.

## Field-level permissions

`can(actor, action, resource, now)` returns the action `Decision`. A separate
entry point answers "which fields does this action touch":

```ts
access.canFields(actor, 'comment', 'update', comment, 'write');
// -> { allowed: true, fields: { body: true, title: true, status: false }, reasons: { ... } }
```

Read and write are separate axes, scoped by the action's nature.

### `fields()`

A permission's field rules attach through `fields()`, which accepts one of:

- **Allow-list** — `fields(['body', 'title'])`: only these are allowed.
- **Bang prefix** — `fields(['*', '!status'])`: everything except `status`. A
  negative entry requires a `*` baseline in the same call; `fields(['!status'])`
  (a deny with no baseline) is a **construction error**, because nothing says
  what else should be allowed.
- **Per-field config** — `fields({ status: { ... } })` with exactly one of:
  - `targets: ['published']` — a stateless value allow-list: these values may
    be written.
  - `transitions: { draft: ['published'], published: [] }` — a static
    allowed-edge state machine over the field's **current** value. `published:
    []` means no outgoing move, so a revert to `draft` is impossible.
    `targets` and `transitions` are **mutually exclusive** per field.

Field rules stay **leaf-level**: they never cascade through `dependsOn`.

### The transition contract

`transitions` reads the field's current value off the provided resource. A
partial or projected resource that lacks the field cannot answer. When a
field-level decision needs a field the resource does not carry, the decision is
`unevaluable` and names the missing field — it never silently evaluates against
`undefined`. This is the `feature` `plan()` "deferred / needs" precedent.

## Authoring

### Canonical form: structural string keys

The canonical, serialized, and engine-facing form is a flat array of string-key
permissions (the JSON above). `parseMatrix(json)` adopts this form and validates
it.

### Typed path: `policy` + `permit`

A generic gives the actor type; the resource type rides on the value where
generics are legal.

```ts
import { policy, permit, and, eq, contains } from '@evanion/authorization';

type Actor   = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };

const access = policy<Actor>({
  comment: {
    update: permit<Comment>(
      and(eq('resource.authorId', 'actor.id'), contains('actor.roles', 'editor')),
    ).fields({
      status: { transitions: { draft: ['published'], published: [] } },
    }),
    read: permit<Comment>(always).fields(['*', '!status']),
  },
});

access.can(actor, 'comment', 'update', comment);
//    actor: Actor   key: 'comment'   action: 'update'   resource: Comment — all type-checked
```

- `policy<Actor>` names the actor once.
- `permit<Comment>` carries the resource type on the value, so a `type` alias
  works and the matrix stays plain data.
- `eq('resource.authorId', 'actor.id')` is verified against
  `Comment['authorId']` (string) and `Actor['id']` (string). A typo, a wrong
  actor type, or a bad field path is a compile error.
- The nested authoring form **flattens** to the canonical flat JSON matrix at
  construction; `JSON.stringify(access.matrix)` emits the same document a
  foreign backend would produce.

Only the canonical string-key form and the `permit<Resource>` typed path are in
v1. The constructor class-key path (`[Comment]:`) is not; it is the most
magical of the authoring options and reintroduces "class is a runtime value"
against the JSON round-trip. It can return in a later release if a consumer
needs instance-resolution.

### Optional: bound resource handler

To avoid repeating the key, a small handler binds it once:

```ts
const comments = access.resource('comment', {
  update: permit<Comment>(...),
  read: permit<Comment>(...),
});
comments.can(actor, 'update', comment);
```

This is class-free, keeps plain data, and gives close to class-key ergonomics
without classes.

## Bulk evaluation

Rendering a list must not pay N context-normalization passes. The core exposes

```ts
access.canMany(actor, 'comment', 'read', comments, now);
```

which normalizes the actor/context once and folds over the resources. This is
the seam collection filtering will build on in v2; in v1 it is a documented fold
over the same `decide`, not a query language.

## Validation

`createPolicy(matrix)` validates once and **freezes**, mirroring `luhn`,
`token` and `feature`:

- duplicate keys
- `dependsOn` naming an unknown key
- dependency cycles, with the path in the error
- an unknown op or field
- a condition field that does not resolve within `actor.*` / `resource.*` / `now`
- a deny with no `*` baseline in `fields()`
- both `targets` and `transitions` on the same field
- a rule node that cannot round-trip through JSON (a captured resource
  reference, a function, a `Date`, a `Map`)

The matrix is cloned and deeply frozen at construction (`structuredClone` +
`deepFreeze`), so an instance you hold can never produce a decision its own
config rejects, and a runtime resource can never leak into it.

## Acquisition

- **Fetch**: `parseMatrix(await fetch(endpoint).then(r => r.json()))` — the
  foreign matrix is validated and adopted.
- **Build time**: the matrix is imported as a module and bundled (SSR and
  browser), the OpenAPI-spec parallel.

The matrix carries an integer `version` (or a hash) surfaced by the fetch
binding, with a documented fetch-and-revalidate contract. A frontend evaluating
a stale matrix keeps a permission the backend has since revoked, so staleness is
a security concern, not a cache detail.

## React binding

A thin `/react` subpath export mirrors `feature/react`:

```tsx
<PolicyProvider access={access} context={{ actor, now }}>
  <App />
</PolicyProvider>;

function Row() {
  if (!useCan('comment', 'update', comment)) return <ReadOnlyComment />;
  return <EditableComment />;
}
```

- `useCan(key, action, resource?)` — one decision. `key` is the resource name (`'comment'`); `resource` is the instance, when one is available.
- `useCanFields(key, action, resource, axis)` — the field-level decision. `axis` is `'read'` or `'write'`.
- `useCapabilities()` — every decision for the current context.

The provider evaluates the full matrix against the current context; it does not
ship or imply a per-actor snapshot. Evaluation is memoised on the context
object's identity.

## Bindings beyond React

Deferred. The core `can()` is framework-agnostic and directly callable from any
server framework without a binding. Express/Fastify/Nest/Next/React Router
bindings are not shipped in v1, because each needs an **actor-resolution** story
— where the principal comes from the request — that is framework- and
auth-implementation-specific and is not yet specified. Bindings return once that
story is written. The core's per-entry file layout keeps them additive.

React Native and Electron consume the core (and `/react` hooks where the
rendering maps) directly; the engine has no Node or DOM dependency.

## Collection scoping (deferred to v2)

Row-level scoping ("read comments where `authorId` is me") is the most common
ACL shape and is deliberately not in v1. The reason: a client-side filter is
half a feature, and real row-scoping requires the backend to **push the filter
into the database** — a query-builder this library does not own. Building a
filter DSL risks the Mongo-shaped-condition drift the `feature` design warned
about.

What v1 ships to make v2 possible without a redesign:

- The **resource-path condition primitive** (`resource.authorId eq actor.id`),
  which is the row-scope building block.
- **`canMany`** as a documented fold over the same `decide`.

v2 can then add filter semantics and DB pushdown without touching the
evaluation model.

## Repo structure

Mirrors `feature`:

```
libs/authorization/
  src/
    index.ts          # createPolicy / policy, parseMatrix, can, canMany, canFields
    types.ts          # Matrix, Permission, Rule, Condition, Decision, ResourceMap
    evaluate.ts       # can(): (matrix, context) -> Decision
    conditions.ts     # declarative condition evaluator (namespaced paths + proto guard)
    graph.ts          # dependsOn cascade + cycle/unknown/duplicate validation
    project.ts        # nested authoring form -> canonical flat matrix
    parse-matrix.ts   # foreign JSON validation/adoption
    errors.ts
    test-setup.ts
  src/react/
    index.tsx         # provider + hooks (subpath export)
  README.md
  package.json        # name: @evanion/authorization
```

The `@evanion/source` file-per-entry packaging and per-module `'use client'`
handling follow the `feature` precedent, so adding a binding later is purely
additive.

## Testing

Mirrors `feature`'s discipline:

- one unit test per condition op
- the `dependsOn` cascade
- validation errors (duplicate key, unknown dependency, cycle, unknown op/field,
  namespace resolution, deny-without-baseline, targets+transitions exclusivity)
- a serializability round-trip (matrix → JSON → matrix → identical decisions)
- a `reason`-is-output-only invariant (decide with reasons stripped, assert the
  same outcome)
- field-level: allow-list, bang prefix, `targets`, `transitions`, exclusivity,
  partial-resource → `unevaluable`
- deny precedence (deny beats allow)
- typed `.test-d.ts` for the `policy`/`permit` authoring path
- README doctests (`@import.meta.vitest`)
- a `/react` binding smoke test
