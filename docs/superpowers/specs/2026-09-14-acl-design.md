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
  The disclosure is structural, not only about values: a reader of the shipped
  matrix learns every object kind, action name, role string, field name, state
  machine, time window and `dependsOn` edge in the privilege model. Security
  does not rest on that staying secret, so the matrix ships anyway; names in it
  are chosen knowing they are public.

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

### The clock

`now` is an `Instant` — `string | number | Date` — everywhere it is accepted: on
`EvaluationContext` and as the argument to `can`, `canMany`, `canFields`,
`capabilities` and `authorize`. It is the same type a `before`/`after` condition
value takes, so a context that crossed a JSON boundary (every SSR hydration
payload) is passed straight through and no adapter converts at the call site.

Each entry point settles `now` to epoch milliseconds once, before any condition
is evaluated, so a matrix with many time conditions parses the clock once. An
omitted `now` is the wall clock at the entry point.

An instant that does not parse — `'not a date'`, `NaN`, an `Invalid Date` — is
not an error: evaluation is total. A `before`/`after` condition **fails** when
its clock does not parse, which is what it already does when its boundary value
does not parse. Failing, not unevaluable: an unparseable instant is not an
`object.*` projection the caller can fill in, so nothing would make the rule
hold. The permission lands on `no-rule-matched`, and a deny rule over an
unparseable clock does not deny.

Construction validates that every condition resolves and can decide something.
The engine reads a path as a scope and one field of that scope, so a condition
field is `now`, `subject.<field>` or `object.<field>` and nothing deeper: a path
that nests below its scope never reads, and a condition that never reads inside a
deny rule is a deny that does not deny. `condition.path` is held to the same rule
as `condition.field`. The operator and its comparand are checked as a pair —
`in` / `not-in` need an array `value`, `contains` needs a `value`, `eq` / `ne`
need exactly one of `value` or `path`, `before` / `after` read `now` and need an
instant — so no condition reaches the engine whose operand the engine would
ignore.

For a foreign matrix field names themselves are unchecked (the engine has no
types to check them against); for the typed authoring path, field names are
additionally checked at compile time against the declared types.

## Matrix format

An envelope over a flat list with a `dependsOn` cascade, the list itself
mirroring `@evanion/feature`.

```json
{
  "version": 3,
  "schema": {
    "subject": { "fields": { "id": "string", "roles": "string[]" } },
    "objects": {
      "article": {
        "fields": { "authorId": "string", "status": "string" },
        "relations": { "comments": "comment" }
      }
    }
  },
  "permissions": []
}
```

There is no bare-array form. One shape, so a producer emitting JSON has one
document to emit and a consumer has one document to validate.

`version` and `schema` are properties of the document, not of the construction
call. A `version` carried in `AccessOptions` alone is unreachable for a foreign
producer, and forces every SSR crossing to hand-assemble `{ matrix, version }`
and reconstruct with `createPolicy(payload.matrix, { version: payload.version })`.
With the envelope the crossing is `const payload = access.matrix` and
`createPolicy(payload)`.

`version` is a **string or a number**. The revalidate contract is a `!==`, so a
content digest or a composite (`orders@7+veto@41`) works unchanged, and a number
cannot express a composite: a sum collides and a max ignores a rollback. Three
things need the composite — a schema-bearing document whose content hash makes
`access.version` always present and meaningful, a compliance deny overlay merged
in before construction whose effective version must cover both inputs, and a
published contract version covering the same composite.

`AccessOptions.version` is an **override** of the document's value. The document
states what a producer shipped; the option states what the construction site is
actually running, which is a different thing whenever the site composes the
document with something else. The option wins, and the frozen `access.matrix`
carries the winner, so the version that decided is the version that crosses.

The permissions themselves:

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
- `rules` are OR-ed; the `when` conditions inside one rule are AND-ed. `when` is
  **required** on every rule. An empty `when` is the unconditional form
  (`always`), so a rule that arrives without the key is indistinguishable from
  one an author wrote as `always` — and the two differ by an unconditional
  grant. Requiring the key separates them at no cost across a JSON boundary,
  where `[]` survives and `undefined` does not.
- `dependsOn` is a cascade. A permission whose dependency resolves off is off,
  transitively, carrying `blockedBy` and `cause` — the same shape as `feature`.
- There is no `enabled` flag. A permission with no `rules` and no `dependsOn`
  denies; one with `rules` evaluates them.

### The schema

`schema` declares, per object kind, its field types and its one-hop relations,
plus optionally the subject's. It is optional for a producer and binding when
present.

Field types are flat strings, so the whole schema is JSON a .NET producer emits
by reflection: `string`, `number`, `boolean`, `instant`, a `[]` suffix for an
array of one, a `?` suffix for a field that may be absent from a complete
instance. A declared field that is present and `null` is present — nullability is
not an optionality axis.

Granularity is per object kind. A kind `objects` does not declare is unchecked,
and `subject.*` paths are unchecked unless `subject` is declared.

A present schema is checked at construction, after the per-condition structural
checks, so a condition that is not evaluable at all is reported as that rather
than as a schema fault. Two guarantees:

1. **A condition names a declared field.** Naming one the schema does not
   declare is an `UnknownFieldError`. Without a schema this is the typo class
   that evaluates to `unevaluable` forever on the foreign path, because an absent
   `object.*` path is a shortfall the caller is told to fill in. A relation name
   is refused the same way: a condition reads one field of one scope, and a
   relation is not a value it compares.
2. **The operator fits the declared type.** `FieldTypeMismatchError` covers
   `contains` against a field that is not an array, an equality or a membership
   test against an array field (both compare by identity, which no two arrays
   satisfy), a literal of the wrong base type, and a `path` comparand whose two
   sides disagree. `null` fits every base, and `instant` agrees with `string` and
   `number` because those are the two forms it is carried in.

A schema that is accepted but unenforced is a trap, so what is **not** checked is
stated rather than inferred:

- **Field-rule names.** The `fields` allow-list and the `targets` /
  `transitions` keys of `FieldRules` are not checked against the schema. The
  typo class there is unguarded whether or not a schema is present.
- **Totality.** Proving that a permission naming no optional field cannot decide
  `unevaluable` for a complete instance is not done. It is not a walk over the
  conditions the way the two guarantees above are: it needs the `dependsOn`
  cascade and the field rules folded in, and a definition of "complete instance"
  the caller has not stated. The `?` suffix is carried in the document and read
  by nothing today.
- **`instant`, temporally.** `before` and `after` read the clock and nothing
  else, so an `instant` field is comparable with `eq`, `ne`, `in` and `not-in`
  only. A `before` against a non-`instant` field is already refused one step
  earlier, by the structural check that pairs `before`/`after` with `now`.

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
  missing?: string[]; // the field paths, when reason is 'unevaluable'
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

`cause.missing` carries the same paths the causing decision carried, so a
dependant blocked behind an `unevaluable` ancestor tells the caller what to
fetch and not merely that the state is repairable.

`cause` is a `Cause`, not a nested `Decision`. It answers one question — which
permission the cascade actually died on, and why — and `blockedBy` already names
the edge the cascade took, so a recursive decision would carry a second copy of
the chain the caller can walk from the matrix. The narrow shape also keeps the
decision flat enough to log.

`reason` is **output only**. Nothing in the library reads a `reason` back to
decide anything, so stripping it changes no decision. A test asserts this.

### Reasons

| `reason`          | meaning                                                                                                                                                                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allow`           | an allow rule matched; carries `rule`                                                                                                                                                                                                                                                          |
| `no-rule-matched` | rules present, none passed                                                                                                                                                                                                                                                                     |
| `denied`          | an explicit deny matched (see [Deny](#deny)); carries `rule`                                                                                                                                                                                                                                   |
| `dependency-off`  | a dependency resolved off; carries `blockedBy` and `cause`                                                                                                                                                                                                                                     |
| `unknown-action`  | the key is not in the matrix (fail-closed path only)                                                                                                                                                                                                                                           |
| `unevaluable`     | an `object`-dependent condition could not read a path it needs — no instance at all (the "create" case) or an instance that does not carry the field; carries `missing`, the paths that did not read. (A field-level decision needing a field the object did not carry is also `unevaluable`.) |

## Deny

Authorization needs an explicit deny that **wins over a concurrent allow**.
Pure allow-OR ("deny is just no matching allow") is the wrong model: real
policies are negative-rule-shaped ("admins can do X, except nobody can do Y on
this thing"), and the field-level bang-prefix already implies deny semantics, so
the action level must match.

A permission may carry `rules` (allows) and/or `denyRules` (denies). Denies use
the same `when`/`dependsOn` shape and are fully serializable.

Deny is a stage in the single precedence order, defined once (see the full
order in [the missing-data case](#the-missing-data-case)):

1. If a deny rule **matches**, deny (reason `denied`, `rule`).
2. Else if a dependency resolved off, deny (reason `dependency-off`,
   `blockedBy`, `cause`).
3. Else if the allow side **definitely fails**, deny (reason
   `no-rule-matched`).
4. Else if the deny side is **unevaluable**, `unevaluable`.
5. Else if an allow rule **matches**, allow (reason `allow`).
6. Else if the allow side is **unevaluable**, `unevaluable`.
7. Else deny (reason `no-rule-matched`).

An unevaluable deny is not a deny, and it is not nothing either: the rule whose
job is to refuse could not be read, so the permission is `unevaluable` (step 4)
rather than a silent allow.

When both a deny and a dependency-off apply, `denied` wins; the result may still
carry `blockedBy`/`cause`. A matched deny carries the same
`reason`-is-output-only contract.

## Unknown object or action

The open/closed behaviour is decided by how the matrix was built.

- **Typed, locally-defined matrix** (`policy(...)`): the key universe is known.
  An unknown key at runtime is a programmer error and **throws** a typed error
  (`UnknownPermissionError extends AclConfigError`), naming the key.
- **Foreign matrix** (`parseMatrix(...)`): the key universe is untrusted
  configuration data. An unknown key **fails closed** (`{ allowed: false,
reason: 'unknown-action' }`) and never throws.

The typed path also makes the object→action union exhaustive at compile time, so
the runtime throw is a backstop, not the primary defence. The two behaviours
are deliberate and documented, and both packages share the same default.

## The missing-data case

An `object`-dependent condition that cannot read the path it needs is
**unevaluable**. There is one such case, not two: no instance at all (the
"create" toggle, `useCan('comment', 'create')`) and a partial or projected
instance that does not carry the field are the same shortfall, and both yield
`unevaluable` carrying the paths in `missing`. Following `feature`'s discipline
("a condition over a field the context does not carry never holds"), the engine
never evaluates an absent field against `undefined`:

```ts
access.can(subject, 'comment', 'create');
// -> { allowed: false, reason: 'unevaluable', missing: ['object.authorId'] }

access.can(subject, 'comment', 'update', { status: 'draft' }); // a projection
// -> { allowed: false, reason: 'unevaluable', missing: ['object.authorId'] }
```

Absence is unevaluable for **every** operator, negative ones included: `ne`,
`not-in` and `contains` over a path that did not read are as unevaluable as
`eq`. "It is not equal to `published`" is not a fact about a field nobody read.

### The subject/object asymmetry

Absence is unevaluable in an `object.*` path and a definite `false` in a
`subject.*` path. The object is a projection the caller chose, so a field it
lacks says nothing about the instance in the database. The subject is resolved
whole by the app before the call and is never a projection, so a subject that
lacks `roles` genuinely has none — an ordinary denial, not an unknown. A
condition with one operand in each scope follows the operand that failed: an
absent `subject.*` comparand fails the condition outright, an absent `object.*`
comparand leaves it unevaluable.

### Rules and sides

A **rule** MATCHES when every condition holds, FAILS when any condition
definitely fails, and is UNDECIDABLE otherwise.

A **side** — the allow rules, or the deny rules — MATCHES if any of its rules
matches, is UNDECIDABLE if no rule matches and at least one is unevaluable, and
FAILS otherwise.

A rule's `when` conditions are AND-ed, and one condition that is definitely
false decides the rule whatever else is unevaluable: no reading of the absent
paths could make the AND hold, so the rule FAILS rather than being unevaluable.

### `unevaluable` in the precedence order

The governing rule: **a definite outcome beats an unevaluable one; among
definite outcomes, deny beats allow.** An unevaluable deny only ever subtracts,
so it can never turn a definite no-allow into something repairable.

1. If a deny rule MATCHES, deny (`denied`, `rule` = that rule).
2. Else if a dependency resolved off, deny (`dependency-off`, `blockedBy`,
   `cause`).
3. Else if the allow side FAILS, deny (`no-rule-matched`).
4. Else if the deny side is UNDECIDABLE, `unevaluable` with `allowed: false`,
   `rule` = the unevaluable deny rule and `missing` = its unreadable paths,
   unioned with the allow side's if that is also unevaluable.
5. Else if an allow rule MATCHES, allow (`allow`).
6. Else if the allow side is UNDECIDABLE, `unevaluable` with `missing` = the
   union of the unevaluable allow rules' paths.
7. Else deny (`no-rule-matched`). Unreachable given step 3; it is the default
   arm.

Step 3 sits above step 4 because allow is required. A definite "no allow rule
matched" cannot be repaired by fetching the object, so reporting `unevaluable`
there would tell a UI to refetch and re-ask forever. Step 2 sits above step 4
for the same reason: a parent that is definitely off is a definite answer, and
an `unevaluable` in its place invites a pointless refetch. Both branches are
`allowed: false`, so neither leaks.

A rule that mixes `object`-dependent and `object`-independent branches with no
instance is decided by the `object`-independent branch alone:
`p.allow('create', p.or(p.eq('object.authorId', 'subject.id'), p.always))` with
no instance is `allow`, because `always` does not need the object. Only a permission whose matching branches all
need data the context did not carry yields `unevaluable`.

## Field-level permissions

`can(subject, key, action, object, now)` returns the action `Decision`. A
separate entry point answers "which fields does this action touch":

```ts
access.canFields(subject, 'comment', 'update', comment, 'write');
// -> { allowed: false, action: { key: 'comment.update', allowed: true, reason: 'allow', rule: 'author' }, fields: { body: 'allowed', title: 'allowed', status: 'denied' }, reasons: { body: 'allow', title: 'allow', status: 'denied' } }
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
  allowed: boolean; // the action is allowed AND every field is 'allowed'
  action: Decision; // the action-level decision, cascade resolved
  fields: Record<string, FieldState>;
  reasons: Record<string, FieldReason>;
}
```

There is no partial-allowed ambiguity: if any field is `denied` or
`unevaluable`, the top-level `allowed` is `false`.

#### Which fields are decided

The decided set is every field the object carries, every field the rules
configure, every real name the token list mentions, and — on the write axis —
**every key of `proposed`**. A key present only in the write is decided by the
same logic as every other field: `denied` with `not-listed` under an explicit
allow-list or a matching bang entry, `allowed` under a `*` baseline that does not
exclude it. A key nobody decided would be a key nobody denied, and a caller
filtering a write on `state !== 'denied'` would carry it through.

The read axis takes no `proposed`. Read is a projection of the object, and a key
that exists only in a pending write is not part of any read, so a read decision
is keyed on the object alone.

#### The write path

A caller narrows a write through one exported function rather than reading the
maps by hand:

```ts
pickAllowedFields(decision, proposed); // -> the subset to write
```

It returns the keys of `proposed` whose state is `allowed`, and nothing else —
so `denied`, `unevaluable`, and a key the decision does not carry are all
withheld. It throws `ActionNotAllowedError` when `decision.action.allowed` is
false, because no field of a refused action is writable and an empty object is
indistinguishable from a lawful write of nothing. A false top-level `allowed`
that comes from the field maps alone is a partial write, which is what the
narrowing is for, so that case returns the allowed subset.

`canFields` carries the **action** decision as well as the field maps, and
`allowed` is gated on it. A field-level answer that ignored the action is a
false allow: a UI gating a form on `canFields` would get a green light for an
action the engine refuses, for any deny reason — `no-rule-matched`, `denied`,
`dependency-off`, `unevaluable`.

The field maps are still computed whatever the action decides, and a blocked
action does **not** force the fields to `denied` or empty the maps. `'denied'`
already means "matched a bang entry or a deny rule" and `{}` already means an
unknown action; overloading either would destroy the caller's ability to
explain a block as "you cannot do this yet, and here is what would be editable".
Field rules stay leaf-level and never cascade — it is the action gate that
carries the cascade, and the two are composed at the entry point.

On an unknown action (the fail-closed path) the result is
`{ allowed: false, action: { key, allowed: false, reason: 'unknown-action' },
fields: {}, reasons: {} }`. The empty maps are unambiguous because `action` is
present.

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
carry real field names only. That holds whichever source the token arrives
from — an object or a proposed write that literally carries a `'*'` or
`'!status'` key contributes no field, because the token is not a field name
wherever it is read.

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
value allow-list with no candidate value are equally unevaluable. When
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

The reason names the end that is missing, so the caller knows which half to
supply:

| current value on `object` | `proposed` value | reason              |
| ------------------------- | ---------------- | ------------------- |
| present                   | present          | decided on the edge |
| present                   | absent           | `proposed-required` |
| absent                    | present          | `missing-field`     |
| absent                    | absent           | `missing-field`     |

`missing-field` takes precedence when both are absent: a complete object is the
first thing the caller has to fix, and the edge cannot be read from either end
without it. A `targets` field has no current value to read, so its only
unevaluable cause is `proposed-required`.

## Authoring

### Canonical form: structural string keys

The canonical, serialized, and engine-facing form is the envelope above: a
`permissions` array of string-key permissions, with an optional `version` and an
optional `schema`. `parseMatrix(json)` adopts this form and validates it.

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
- `.fields()` and `.dependsOn()` attach to the action most recently declared in
  the chain. Either one before the first `allow` / `deny` of a block has no
  action to attach to and is refused with an `AclConfigError`.
- The condition helpers on the block parameter mirror the ops: `eq`, `ne`, `in`,
  `notIn`, `contains`, plus `and`, `or`, and `always`. `not-in` is not an
  identifier, so the helper is spelled `notIn` and serializes to the `not-in`
  op. `always` serializes to an empty `when` array (always true). A time
  condition is written with `before` / `after` over the `now` namespace, e.g.
  `p.after('now', '2026-10-01T00:00:00Z')`.
- `and` and `or` nest freely. The builder flattens a condition tree to
  disjunctive normal form: each OR branch becomes one rule, and the conditions
  within a branch become that rule's AND-ed `when`. Several conditions passed to
  one `allow` are one AND.
- `eq` is symmetric: either operand may name a field path, and a path operand is
  checked against the type its namespace resolves to.
- The builder **flattens** to the canonical flat JSON matrix at construction;
  `JSON.stringify(access.matrix)` emits the same document a foreign backend would
  produce, envelope included.
- `version` and `schema` are document fields, so `policy<Sub>({ version, schema })`
  takes them and the flattening puts them in the envelope. They are not
  construction options and not chain methods: `.for()` exists to accumulate the
  key-to-type map, and both facts are per-document and known before the first
  block is written. An absent one omits its key, so the document a typed policy
  emits is byte-identical to the one a foreign producer emits for the same policy.

#### Schema on the typed path

A `MatrixSchema` is written by hand. `.for<'comment', Comment>()` holds `Comment`
at the type level, a schema is runtime JSON, and TypeScript types do not survive
to runtime, so no schema can be derived from the type argument.

This puts the field-existence guarantee on the typed path twice, which is
deliberate rather than redundant. The typed path gets it from TypeScript, for the
author, at compile time. The foreign path gets it from the schema, for the
consumer, at construction. The document travels and the types do not: a consumer
that adopts the emitted JSON with `parseMatrix` has no `Comment` to check against,
and the schema is the only thing that carries the author's guarantee to it. A
typed author who ships a document to nobody needs no schema.

The two are checked independently and may disagree. A path TypeScript accepts
because the object type declares the field is still an `UnknownFieldError` at
construction when the schema does not declare it; a present schema is binding.

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
`.matrix`, `.version`, `.schema`:

- `createPolicy(matrix)` — from a canonical matrix document.
- `policy<Subject>()` — from the typed builder; flattens to the same canonical
  document, carrying the `version` and `schema` the author supplies.
- `parseMatrix(json)` — from foreign or emitted JSON; the untrusted path.

Alongside them, one free function completes the write path:

- `pickAllowedFields(decision, proposed)` — the subset of a proposed write a
  `canFields` decision allows.

All validate once and freeze. `access.version` is `access.matrix.version` lifted
for convenience, and is `undefined` for a document that states none and a
construction site that overrides none — a `!==` against `undefined` decides
nothing, so a producer that wants the revalidate contract to hold states a
version, and a content hash of the document is enough.

### Optional: bound object handler

To avoid repeating the key, a small handler binds it once:

```ts
const comments = access.object('comment');
comments.can(subject, 'update', comment);
comments.canMany(subject, 'read', commentList);
```

`access.object(key)` narrows an existing `access` to one object kind. On a typed
matrix the key is checked against the accumulated union and the bound handler
keeps that key's object type on every call. It is on the typed builder today;
`createPolicy` and `parseMatrix` have no key type to check against and do not
carry it yet.

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

A foreign matrix is untrusted input, so validation is structural before it is
semantic: every node's type is checked before anything reads it, and a matrix
validation accepts evaluates without throwing.

- a matrix that is not an array, or a permission that is not an object
- a permission with no `key`, `object` or `action`
- duplicate keys
- a `key` that is not `` `${object}.${action}` ``
- a `.` in `object` or in `action`. The key is the two parts joined on a dot,
  and that join reverses only while neither part carries one: `{ object: 'a.b',
action: 'c' }` and `{ object: 'a', action: 'b.c' }` are two permissions with
  one key, and one silently shadows the other. With the key-equality rule, key
  construction is total in both directions. A `:` stays legal: an object kind
  namespaced by its origin is spelled `orders:invoice`, so
  `orders:invoice.read` satisfies the key rule character for character
- `rules` / `denyRules` that are not arrays, and a rule that is not an object
- a rule with no `when`, or a `when` that is not an array
- a condition that is not an object, or that names no field
- an unknown op
- a condition field or `path` that does not resolve within `subject.<field>` /
  `object.<field>` / `now` — including one nesting below its scope (field-name
  validity itself is a typed-path compile-time guarantee)
- an operator paired with a comparand it cannot use: a non-array `value` for
  `in` / `not-in`, a missing `value` for `contains`, an `eq` / `ne` with both or
  neither of `value` and `path`, a `path` on an operator that compares against a
  literal, a `before` / `after` that does not read `now` or whose `value` is not
  an instant
- `dependsOn` that is not a list of keys, or naming an unknown key
- dependency cycles, with the path in the error
- field rules that are not the documented shape: a `fields` that is not an
  object, a name list that is not an array of strings, a field config that is
  not an object, a non-array `targets`, a non-object `transitions`
- a deny with no `*` baseline in `fields()`
- a bang mixed into an explicit allow-list in `fields()`
- both `targets` and `transitions` on the same field
- a permission holding a value the structured clone algorithm refuses: a
  function, a symbol, or a structure nested deeper than it walks

The matrix is cloned and deeply frozen at construction (`structuredClone` +
`deepFreeze`), so an instance you hold can never produce a decision its own
config rejects, and a runtime object can never leak into it. A `Date` clones and
is accepted as an `Instant`; a shape that refers back to itself clones and
freezes. Cloning is per permission, so a value the clone refuses is reported
against the permission holding it.

Both walks over a matrix — the `dependsOn` order in `buildGraph` and the freeze —
are iterative. Their depth is the foreign matrix's choice, and the depth a
runtime gives a call stack is not the depth a matrix may declare.

### Construction errors

Named classes, all extending `AclConfigError`, with messages that
explain themselves:

- `DenyWithoutBaselineError` — a `!` entry in `fields()` has no `*` baseline.
- `BangInAllowListError` — a `!` entry mixed into an explicit allow-list.
- `TargetsTransitionsConflictError` — both `targets` and `transitions` on one
  field.
- `KeyMismatchError` — `key` is not `` `${object}.${action}` ``, naming all
  three.
- `InvalidMatrixError` — the matrix is not an envelope around a `permissions`
  array, its `version` is neither a string nor a number, a permission has no key,
  or a permission holds a value that cannot be cloned.
- `InvalidSchemaError` — a `schema` whose own shape is not the canonical one,
  naming the path inside the document (`schema.objects.comment.fields.status`).
- `InvalidPermissionError` — a permission node's own shape: `object`, `action`,
  `rules`, `denyRules`, `dependsOn` or `fields`. A `.` in `object` or `action`
  raises this rather than a class of its own: the key still equals its parts, so
  it is not a mismatch, and the part that carries the delimiter is a field of the
  permission like any other.
- `InvalidRuleError` — a rule that is not an object, or whose `when` is absent or
  not an array.
- `InvalidConditionError` — a condition's shape, namespace, path depth, or
  operator/comparand pairing.
- `UnknownFieldError` — a condition names a field, or a comparand path, that a
  declared object kind does not declare. Only raised against a present schema.
- `FieldTypeMismatchError` — a condition's operator or comparand does not fit
  the declared type. Only raised against a present schema.

Every message names the offending permission key and the offending field, and
locates a rule or condition inside the permission (`denyRules[0].when[1]`), so
the author of a foreign matrix can find it without a line number.

The base class is `AclConfigError`, matching the `@evanion/acl` package name.
The name is a public export, so it is fixed before the first publish.

Evaluation is total: once a matrix is constructed, no entry point throws for any
context. For any matrix and any context, `parseMatrix` either rejects the matrix
with an `AclConfigError` or returns an access object whose `can`, `canMany`,
`canFields` and `capabilities` answer with a decision — there is no third
outcome. A property test over generated malformed matrices and generated
contexts holds the claim, and covers `pickAllowedFields` under the one throw it
declares. Omitting `proposed` where a `targets` or `transitions` rule exists
yields an `unevaluable` field decision with reason `proposed-required`, not a
thrown error.

The runtime `UnknownObjectKeyError` / `UnknownPermissionError` throws sit outside
that claim as the typed matrix's programmer-error backstop rather than a
data-shape failure: the untrusted `parseMatrix` path is closed and answers
`unknown-action`.

`ActionNotAllowedError` is the one error raised outside construction, and it
does not extend `AclConfigError`: it reports a decision, not a configuration
fault. `pickAllowedFields` raises it, and no evaluation entry point does.

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

In both shapes, a decision made on the server is authoritative and a decision
made in the browser is non-authoritative. The browser evaluation exists to
toggle what the user sees; it is never the access control. `can` has one
signature and one return type in both places, and nothing in the types marks
which one a given call is — the runtime it runs in is the whole difference.
That cuts both ways for the consumer: every app in the chain evaluates for
itself and trusts no earlier layer, so a gateway or a BFF that already decided
does not excuse the service behind it from deciding again. There is no
transitive trust in the model and no "already checked upstream" exemption.

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
  closed for a foreign one). It carries **no field state**: field rules read the
  instance (`transitions` needs a current value, and a name list is decided
  against the fields the object carries), and `capabilities()` has no instance,
  so a field-level answer belongs to `useCanFields` alone.

### The `capabilities()` contract

`capabilities()` runs without an object, so every permission carrying an
`object`-scoped rule — a deny rule as much as an allow rule — is `unevaluable`
there rather than `allow`. In `capabilities()`, `unevaluable` means **possible,
needs an object**: a UI renders it as available-pending-object, not hidden. The
paths in `missing` name what to fetch to get a definite answer, and `can(...)`
with the instance gives one.

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
    types.ts          # Matrix, MatrixSchema, ObjectSchema, FieldType, Permission, Rule, Condition, Decision, Reason, FieldState, FieldReason, FieldDecision
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
  dependency, cycle, unknown op, namespace resolution, path depth,
  operator/comparand pairing, rule and condition shape, deny-without-baseline,
  bang-in-allow-list, targets+transitions exclusivity)
- a totality property: for a generated matrix — wrong types in every position,
  nulls, prototype keys, deep nesting — and a generated context, construction
  rejects with an `AclConfigError` or every entry point returns a decision. This
  is the test that makes the totality claim true rather than aspirational, and a
  seeded generator so a counterexample is a seed
- a dependency chain and a nested value deeper than a call stack, which the
  construction walks settle without a `RangeError`
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
- a permission whose `object`-dependent rules are unevaluable while an allow rule
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
