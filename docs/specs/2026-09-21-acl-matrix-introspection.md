# Matrix introspection, and an explorer for a document a reader brings

Status: proposed
Packages: `@evanion/acl` gains three exports and nothing else. A sibling
`@evanion/acl-introspect` holds the derivations and the cross-reference. The
docs-site explorer is an `apps/docs` component. `@evanion/react-acl` gains
nothing, and section 4 argues why.
Depends on: `libs/acl/src/types.ts` (`Matrix`, `MatrixSchema`, `ObjectSchema`,
`FieldType` and `BaseFieldType` at `:157-235`, which are the whole
introspection payload), `libs/acl/src/conditions.ts` (`comparandPathOf` at
`:124-128` and `conditionReadsObject` at `:137-141`, the two rules section 3
refuses to restate; the docblock on `comparandPathOf` already says the rule is
stated once so it "cannot drift between evaluation and inspection"),
`libs/acl/src/reads-object.ts` (`permissionReadsObject`, the third),
`libs/acl/src/schema.ts` (`lookupPath` at `:136-159` and `assertConditionFits`
at `:218-331`, which decide what a present schema already refuses; section 2 is
about the two branches at `:232` and `:233`),
`libs/acl/src/fields.ts` (`decideFields` at `:146`, and the `missing-field` and
`proposed-required` reasons at `:97-114`, which is where a field rule naming an
undeclared field lands), `libs/acl/src/serialize.ts` (`isPublic` at `:50-52` and
the `reduced` filter at `:143`, which decide what section 8 calls disclosure),
`libs/acl/src/hydrate-policy.ts` (`capabilities` at `:617-630`),
`apps/shop-api/src/acl/policy.controller.ts` (the one endpoint in this
repository that publishes a matrix, and the disclosure boundary section 8
measures against), `apps/docs/next.config.ts:53` (`output: 'export'`, which is
why a browser explorer uploads nothing),
`apps/docs/components/landing/AccessDemo.tsx`,
`apps/docs/components/landing/PolicySpecimen.tsx`,
`apps/docs/components/acl/FieldWriteDemo.tsx`,
`apps/docs/components/acl/UnevaluableDemo.tsx` (the four demos section 10 keeps),
`nx.json:151` (`"projects": ["libs/*"]`, so a directory under `libs/` publishes
and a sibling package needs no config edit),
`docs/specs/2026-09-16-published-policy-contracts.md` (the contract topology
section 8 stands on),
`docs/specs/2026-09-17-acl-wildcard-action.md` (the auditability argument in its
section 8, which this document is the tooling answer to).
Measured against: this worktree, branched from `main` at `f6f8eeb`. Nine
behaviours are quoted from a scratch test run through `nx test acl` in this
worktree and then deleted; the evidence ledger names each one. Every other claim
about this repository is a reading of the file named beside it.
Prior art reached, each with the URL that answered named in section 11: the
Swagger UI configuration documentation and its `src/core/config/` source at
`swagger-api/swagger-ui` `master`; the OpenAPI specification 3.1.0, both the
published HTML and the Markdown source; JSON Schema Validation 2020-12; the
GraphQL specification, October 2021; GraphiQL's schema store at
`graphql/graphiql` `main`; the Apollo Sandbox documentation page; the Rego
Playground, measured by calling its `POST /v1/data` endpoint because the page
itself answers a fetch with an empty application shell; the OPA CLI,
policy-testing and policy-language documentation; the Regal README; the
`casbin/casbin-editor` README; the CASL README and package listing; the Oso
documentation index at `osohq.com/docs/llms.txt` and the `osohq/oso` README.
Not reached, and therefore absent from the argument: `casbin.org/docs/editor`,
which answers 404, and `editor.casbin.org`, which serves an application shell;
the CASL documentation site, which is client-rendered and answers a fetch with a
title and no body; every Oso documentation page below its index, which answered
404 to the URLs guessed from that index; GitHub's code search API, which refused
an unauthenticated session. General web search was unavailable for this
document, which section 11's closing claim is qualified by.
Quotation: one short quote per source, in section 11, with the page named.

## What is actually wrong

Nothing is broken. `@evanion/acl` decides correctly and this document proposes
no change to any decision. The gap is that a matrix is reviewed by reading it,
and the document format carries facts a reader cannot see by reading.

Three of them, measured in this worktree.

A permission can be dead on arrival and construct without complaint:

```ts
const permission = {
  key: 'order.read',
  object: 'order',
  action: 'read',
  rules: [
    {
      id: 'r1',
      when: [
        { field: 'subject.role', op: 'eq', value: 'admin' },
        { field: 'subject.role', op: 'eq', value: 'guest' },
      ],
    },
  ],
};
```

`hydratePolicy` accepts it and `can` answers
`{ allowed: false, reason: 'no-rule-matched' }` for every subject. The two
conditions are AND-ed, one path cannot hold two unequal literals, and the
document states no such thing.

A field rule can name a field nothing declares. With
`schema.objects.order.fields` declaring `ownerId` and `status`, and the
permission carrying `fields: { fields: ['ghost', 'status'], ghost: { targets:
['x'] } }`, construction succeeds. `canFields` over a complete instance answers
`ghost: 'unevaluable'`, reason `proposed-required`. `types.ts:200-203` says so
in the `MatrixSchema` docblock: what a present schema does not check is "the
field names in `FieldRules`". The check is absent by design and no reader
computes it by eye.

A contract can be empty and say nothing. `serialize(access, 'reduced')` over a
document where no permission carries `visibility: 'public'` returns
`{ permissions: [] }`. No error, no warning. `apps/shop-api`'s endpoint would
serve it.

The fourth gap is the one with an attacker attached. A matrix says what it
guards. Nothing says what it does not guard, because the set of things that
exist is in the API, not in the matrix.

## Decisions

1. `introspect(matrix)` returns findings and a path index, and restates no part
   of the document. A caller that wants a permission reads
   `matrix.permissions`. Section 1.
2. `@evanion/acl` exports `conditionReadsObject`, `comparandPathOf` and
   `permissionReadsObject`, unchanged. Nothing else moves into the core.
   Section 3.
3. The derivations live in `@evanion/acl-introspect`, a sibling under `libs/`.
   The core keeps its zero dependencies and its zero peers, and a Node consumer
   that never introspects parses none of it. Section 3.
4. `@evanion/react-acl` gains nothing. An explorer binding, if one is ever
   built, is a fourth package. Section 4.
5. The cross-reference takes a normalized `ApiSurface`, never a GraphQL document
   or an OpenAPI object. The two adapters live behind their own entry points
   with their parsers as optional peers. Section 5.
6. A finding carries `confidence: 'certain' | 'conventional'`. A REST mapping is
   always `conventional` and never fails a build. Section 9.
7. The cross-reference never infers an action from an operation name. It reports
   coverage at `(kind, writes)` and a user-supplied mapping upgrades it to
   `(kind, action)`. Section 5.
8. The permanently-unevaluable set the original sketch asked for does not exist
   in a constructed matrix. `assertConditionFits` already refuses it. What does
   exist is two narrower sets, and only one is findable without an API schema.
   Section 2.
9. The explorer takes a `Matrix`, never an `Access`. A caller that wants the
   internal permissions writes `serialize(access, 'full')` at the mount site,
   and that string is the audit. Section 8.
10. The four existing demos stay, all four. The explorer subsumes none of them.
    Section 10.
11. Before v1, decision 2 ships and nothing else. Section 12.

Decision 8 is the one that contradicts the brief, and it is measured. Decision 1
is the one that keeps this from becoming a second document format. Decision 7 is
the one that gives up the most and is right to. Decision 11 is the
recommendation, and it is smaller than what was asked for.

## 1. What `introspect()` returns

```ts
export interface Introspection {
  readonly findings: readonly Finding[];
  readonly reads: Readonly<Record<string, PathIndex>>;
}

export interface PathIndex {
  readonly subject: readonly string[];
  readonly object: readonly string[];
  readonly clock: boolean;
  readonly fieldNames: readonly string[];
  readonly readsObject: boolean;
  readonly published: boolean;
}
```

`reads` is keyed by permission key. Every member is computed from the rule
arrays, so none of it is a copy of anything the document already states in the
form a reader wants.

`subject` and `object` are the distinct paths any rule on either side reads, on
either operand, sorted. `comparandPathOf` decides the second operand, so a
condition comparing `object.authorId` against `subject.id` contributes to both.
`clock` is the same union over `field === 'now'` and the comparand. `readsObject`
is `permissionReadsObject` applied per permission, so an explorer reads it once
for the document where `Access.readsObject` answers one `(key, action)` pair per
call. `fieldNames` is the allow-list minus `*` and the bang entries, unioned
with the `FieldConfig` keys.

`published` is `permission.visibility === 'public'`, which is the predicate
`serialize.ts:50-52` applies. One boolean, and no projected document:
`serialize` produces the contract, and a second implementation of the filter
here is the drift this refuses.

A `Finding`:

```ts
export interface Finding {
  readonly code: FindingCode;
  readonly severity: 'dead' | 'undecidable' | 'uncovered' | 'disclosure';
  readonly confidence: 'certain' | 'conventional';
  /** The permission key, or the object kind, or the operation id. */
  readonly at: string;
  /** Where inside the permission, as `assertRulesFit` spells it. */
  readonly where?: string;
  readonly detail: string;
}
```

`where` copies the `rules[0].when[1]` spelling `assertRulesFit`
(`schema.ts:341-358`) already emits, so a finding and a construction error point
at a document position the same way.

What is deliberately absent: a permission list, an action list, a kind list, a
rendered tree, and any per-subject decision. A subject's decisions are
`capabilities()`, which exists, costs one local call and no network, and is
already the right shape. An explorer calls it once per subject it wants to show.

## 2. The findings that hold, and the one that does not

The original sketch asked for "a rule reading an `object.*` path the schema does
not declare, so it is permanently `unevaluable`". Measured: that document does
not construct.

```
schema.objects.order.fields = { ownerId: 'string' }
rules[0].when[0] = { field: 'object.nope', op: 'eq', value: 1 }

hydratePolicy -> THREW UnknownFieldError: permission "order.update":
condition rules[0].when[0] on "object.nope" names a field the schema does
not declare
```

`assertConditionFits` reaches `schema.ts:233` and throws. No `Access` in any
process carries that permission, so no introspection can report it.

The same condition against a kind the schema does not declare is a different
matter. `lookupPath` answers `unchecked` (`schema.ts:146`), construction
succeeds, and a decision over a complete instance answers:

```
{ key: 'order.update', allowed: false, reason: 'unevaluable',
  missing: ['object.nope'] }
```

That permission is permanently unevaluable in production and the matrix alone
cannot say so, because the matrix declared nothing to check against. Reporting
it needs a second document, which is section 5. What `introspect` reports is the
precondition: a permission naming a kind `schema.objects` does not declare, so a
reader knows which permissions nothing checked.

The six findings `introspect` derives from the document alone, each measured:

`contradictory-allow`, severity `dead`, confidence `certain`. Two conditions in
one rule's `when` on the same `field`, both `op: 'eq'`, with unequal literal
`value`s and no `path`. Measured above: `no-rule-matched` for every subject. The
same analysis extends to `eq` beside `ne` with an equal value, to `in` with an
empty array, and to `in` beside `not-in` whose arrays are disjoint. It does not
extend further, and "Where I am guessing" says why.

`unconditional-deny`, severity `dead`, confidence `certain`. A deny rule whose
`when` is the empty array. Measured: with an allow rule that matches, `can`
answers `{ allowed: false, reason: 'denied', rule: 'd1' }`. Step 1 of the
precedence order in `evaluate.ts` takes it before anything else runs, so every
allow rule on that permission is unreachable.

`field-rule-off-schema`, severity `undecidable`, confidence `certain`. A name in
`fieldNames` that `schema.objects[kind].fields` does not declare, for a kind the
schema declares. Measured: `ghost: 'unevaluable'`, reason `proposed-required`,
against a complete instance. This is the one permanently-unevaluable set the
document can find on its own, and it exists because `MatrixSchema`'s docblock
says the field-rule names are unchecked.

`unchecked-kind`, severity `undecidable`, confidence `certain`. A permission
whose `object` is not a key of `schema.objects`, in a document that carries a
schema. Every `object.*` condition on it passed construction unchecked. Reported
only when a schema is present, because a document with no schema declared nothing
and has no gap to report.

`unguarded-kind`, severity `uncovered`, confidence `certain`. A key of
`schema.objects` that no permission names. Measured: a schema declaring `order`
and `customer` with only `order.read` present constructs, and `access.schema`
carries both kinds. A kind the policy describes and never guards.

`empty-contract`, severity `disclosure`, confidence `certain`. No permission
carries `visibility: 'public'`. Measured: `serialize(access, 'reduced')` returns
`{ permissions: [] }` and throws nothing. A service whose endpoint serves that
publishes an empty policy, and every consumer adopting it refuses everything.

## 3. Where the analysis lives, and what it costs

Three placements were considered.

In `@evanion/acl`. Measured cost: the package's shipped JavaScript is 97,621
bytes across fifteen modules, unminified, and `index.js` re-exports from all of
them. A Node consumer importing the barrel parses every module whether or not it
calls into one, because ESM re-exports are eager. A bundler consumer tree-shakes
it, since `sideEffects: false` is set and the modules are separate. So a server
consumer pays the parse, which means `apps/shop-api` and every guard like it,
for a function no request path calls.

In `tools/`. Nothing under `tools/` publishes (`nx.json:151`), so the CLI could
live there and the explorer could not import it.

In a sibling under `libs/`. One directory, published automatically, and the
cross-reference adapters can take `graphql` as an optional peer without that
peer appearing anywhere near the engine. `@evanion/acl` has zero dependencies
and zero peers today, and keeping it that way is worth more than one fewer
package.

Take the sibling, with one obligation on the core. `conditionReadsObject`,
`comparandPathOf` and `permissionReadsObject` are exported from their modules
and absent from `index.ts`. A sibling package that reimplemented the
operand rule would hold the second copy of the one fact the engine and an
inspector must agree on. The docblock on `comparandPathOf` anticipates exactly
this: it says every pass over the operands goes through it, so the rule "cannot
drift between evaluation and inspection". Decision 2 makes that sentence true by
exporting the three functions from `@evanion/acl`. They add no derivation, no
dependency and forty lines of shipped code.

## 4. The headless binding, and why `'use client'` is not the reason to skip it

`libs/react-acl/src/index.tsx:1` is `'use client'` and the directive applies to
the module, so an RSC server component cannot import the provider or any hook
beside it. That constrains the production binding, where a server component
genuinely wants to decide before it renders. It does not constrain an explorer.
A reader supplies a document, switches subjects, and filters findings, and every
one of those is a client interaction. An explorer has no server half.

The reason to keep the explorer out of `@evanion/react-acl` is the dependency
direction. The binding is what every React application imports, and it depends
on `@evanion/acl` alone. A headless explorer hook depends on
`@evanion/acl-introspect`, and putting it behind the same barrel gives every
application a transitive dependency on the analysis package for a hook it never
renders. The same argument as section 3, one level up.

So: no headless binding before the docs explorer exists. The docs explorer is
one consumer, and one consumer does not establish the shape of an API. Build the
explorer in `apps/docs` against `introspect()` directly, and extract a
`@evanion/react-acl-explorer` when a second consumer asks for the same hooks.
If no second consumer asks, the extraction never happens and nothing was
published that has to be supported.

Where the sketch was right: whatever is eventually extracted returns data and
renders nothing. `Introspection` is already that data, so the hook is a
`useMemo` over a `Matrix` and the headless question mostly answers itself.

## 5. The cross-reference, and what a schema can actually decide

The cross-reference is the strongest part of the idea and the part with the most
guessing in it. The design keeps the two apart.

`crossReference` takes a normalized surface, never a GraphQL document and never
an OpenAPI object:

```ts
export interface ApiField {
  readonly name: string;
  readonly type: BaseFieldType | 'unmapped';
  readonly array: boolean;
  readonly optional: boolean;
}

export interface ApiType {
  readonly kind: string;
  readonly fields: readonly ApiField[];
}

export interface ApiOperation {
  readonly id: string;
  readonly writes: boolean;
  readonly kind?: string;
  readonly action?: string;
  readonly inputFields?: readonly string[];
}

export interface ApiSurface {
  readonly source: 'graphql' | 'openapi';
  readonly types: readonly ApiType[];
  readonly operations: readonly ApiOperation[];
}

export function crossReference(
  matrix: Matrix,
  surface: ApiSurface,
  mapping?: Readonly<Record<string, string>>,
): readonly Finding[];
```

`mapping` takes an operation id to a permission key, and it is how a user
overrides every inference below.

The adapters convert. `graphqlSurface(introspectionResult)` and
`openapiSurface(document)` live behind their own entry points, each naming its
parser as an optional peer, so a consumer that checks only OpenAPI installs no
GraphQL package.

Five categories, ranked by what they rest on.

`uncovered-write`, severity `uncovered`. An operation with `writes: true` whose
`kind` no permission names. This is the security finding: a mutation or a write
endpoint nothing guards. Confidence is `certain` for GraphQL and `conventional`
for OpenAPI, and section 6 is the whole of why.

`dead-kind`, severity `dead`, confidence `certain` for both sources. A
permission whose `object` matches no `ApiType.kind`. Policy for a kind the API
does not have. It rests only on the kind mapping.

`field-rule-off-api`, severity `undecidable`, confidence `certain`. A name in
`fieldNames` that the mapped `ApiType` does not declare. This is the production
form of `field-rule-off-schema` from section 2, and it reaches the case section 2
could not: a permission on a kind `MatrixSchema` declares nothing for, whose
field rules name a field the deployed API does not have. Measured consequence:
`unevaluable` with `proposed-required`, forever.

`type-mismatch`, severity `undecidable`, confidence `certain` where the mapping
in section 7 is total and `conventional` where it is not.

`uncovered-action`, severity `uncovered`, confidence `conventional`, always.
Decision 7: the cross-reference does not infer that `cancelOrder` means action
`cancel`, or `update`, or anything. It cannot. `CRUD_ACTIONS` gives four names
and an operation name is free text. So the default report is per kind and per
write-ness, and `uncovered-action` is emitted only for operations the `mapping`
argument named a key for, where that key is absent from the matrix. That makes
it a typo check over a list the user wrote, which is a thing it can actually do.

What the ranking means in practice: the two findings worth acting on without
further thought are `uncovered-write` against a GraphQL schema and
`dead-kind`. The rest need a reader.

## 6. Why GraphQL is the easier source, and what a REST path does not name

Four facts.

A GraphQL schema names types, and every field declares the type it returns.
`cancelOrder(id: ID!): Order` states the kind in the return type. An OpenAPI
path is a string, and `POST /orders` states nothing about a type; the type, if
present at all, is in `requestBody.content[...].schema`, possibly behind a
`$ref`, possibly composed with `allOf`.

Mutation is a distinct root type, so the schema itself says which operations
write. HTTP methods carry the same fact reliably enough, so this one is close to
even.

Fields are fields. A GraphQL object type's field set is the field set. An
OpenAPI operation's input fields live inside a media-type schema that may be
absent, referenced, or composed, and the response fields live somewhere else
again.

Introspection is a query against a running server. What is checked is what is
deployed. An OpenAPI document is a file that may or may not match the service
that serves it.

The mapping convention for OpenAPI, stated so a reader can judge it:

- take the path's last segment that is not a `{parameter}`;
- singularise it by dropping a trailing `s`;
- lowercase it;
- map the method: `GET` and `HEAD` to reads, every other method to writes.

What that cannot infer, each a real shape:

`POST /orders/{id}/cancel` yields `cancel`, which is an action, not a kind. The
convention produces a kind that does not exist and `dead-kind` fires on a
permission that is fine.

`POST /checkout` names a process. No kind.

`GET /addresses` singularises to `addresse`. Every plural that is not a bare
`s` comes out wrong, and a dictionary would only move the guessing.

A kind named `order` behind a path spelled `/purchase-orders`, or `/v2/orders`,
or `/api/orders`. Prefix stripping is another convention on top of this one.

So OpenAPI findings are `conventional`, every one of them, and decision 6 keeps
them out of a build gate. A user who supplies `mapping` converts them to
`certain`, which is the honest trade: the inference is a user's, stated in a
file, reviewable.

## 7. The four bases against two type systems

`BaseFieldType` is `string | number | boolean | instant`, with `[]` and `?`
suffixes (`types.ts:157-171`). `instant` is "carried as an ISO 8601 string or
epoch milliseconds", so it agrees with two API types and every other base agrees
with one.

| Declared  | GraphQL scalar | OpenAPI `type` / `format` | Confidence   |
| --------- | -------------- | ------------------------- | ------------ |
| `string`  | `String`, `ID` | `string`, no `date-time`  | certain      |
| `number`  | `Int`, `Float` | `number`, `integer`       | certain      |
| `boolean` | `Boolean`      | `boolean`                 | certain      |
| `instant` | no built-in    | `string` with `date-time` | certain      |
| `instant` | no built-in    | `integer` with `int64`    | conventional |
| `T[]`     | `LIST` wrapper | `array` with `items`      | certain      |
| `T?`      | no `NON_NULL`  | absent from `required`    | certain      |

Three rows need the reasoning stated.

`instant` has no GraphQL counterpart. The specification's built-in scalars are
five, `Int`, `Float`, `String`, `Boolean` and `ID`, and every date is a custom
scalar whose name a schema author chose: `DateTime`, `Timestamp`,
`AWSDateTime`, `Date`. The adapter cannot know which. Decision: a custom scalar
maps to `'unmapped'`, and a declared `instant` against an `'unmapped'` field
emits nothing. The adapter stays silent where it would otherwise guess. A user
who wants the check passes a scalar name list to `graphqlSurface`.
`specifiedByURL` is the only machine-readable hint a custom scalar carries, and
it is not enough to key on.

`instant` against OpenAPI splits into two rows, and section 11 is why. OAS 3.1
adopted JSON Schema 2020-12 and its own format table is down to `int32`,
`int64`, `float`, `double` and `password`. `date-time` is a JSON Schema format,
and JSON Schema treats formats as annotations unless a validator opts into
asserting them. So `string` with `date-time` is certain in one sense only: the
producer meant a timestamp. It says nothing about whether any validator checked
one. Epoch milliseconds as an `integer` is a convention nobody wrote down
anywhere, so that row is conventional.

The `?` row maps GraphQL nullability onto optionality, and the two are not the
same claim. `types.ts:167-171` says nullability is not an optionality axis here:
a declared field that is present and `null` is present. GraphQL's `NON_NULL`
wrapper constrains the value and says nothing about presence. The adapter maps
them anyway, because the other reading treats every nullable GraphQL field as
required and emits a mismatch against every `T?` in a matrix, and most fields in
most GraphQL schemas are nullable.

Two asymmetries produce no finding at all. OAS 3.1 carries `null` as a type
value where GraphQL expresses the same thing as the absence of `NON_NULL`.
GraphQL's `Int` is specified as signed 32-bit, so an OpenAPI `integer` with
`format: int64` has no GraphQL scalar and arrives as a custom one.

## 8. Disclosure

A full matrix in a browser shows every internal permission, every rule, every
condition and every literal a condition compares against. `visibility` exists
precisely to keep that from crossing, and `serialize.ts:143` is the filter.

The docs-site explorer is the safe case, and the construction is what makes it
safe. `apps/docs/next.config.ts:53` is `output: 'export'`, so the site is static
files. `@evanion/acl` imports no framework and evaluates locally. A reader
pastes a document into a page that has no server to post it to. The page should
state that plainly, as a fact about where the code runs, and carry no warning.

One thing the explorer page must refuse, copied from Swagger UI's default in
section 11: a document loaded from a query string. `queryConfigEnabled` is
`false` in `defaults.js:67` for a reason, and a matrix reachable at
`?matrix=https://...` is a link a third party can send. The page accepts a paste
and a file the reader picks, and reads no query parameter.

The dangerous case is a shippable dev route. Three controls, in order of how much
they are worth.

Decision 9 is the first and the only structural one. The explorer's entry point
takes a `Matrix` parameter, and every other overload is refused. A caller who
wants the internal document writes `serialize(access, 'full')` at the mount
site. That string sits in the application's own source, so a grep finds it and a
diff shows it. A function that took an `Access` and called `serialize` itself
would move the decision inside a package and out of review.

The second is the package boundary. A dev route ships as its own published
package that an application adds to `dependencies`, so it shows up in a lockfile
diff and in whatever the team runs over its production dependencies. An explorer
folded into `@evanion/react-acl` would arrive in every application that already
depends on it, with nothing to notice.

The third is a `NODE_ENV` check, and it is worth the least. It catches an
accident and stops nobody, since a dev route on a production build is one
environment variable away and the bundle already carries the code. Document it
as what it is: a check that catches a mistake and no attacker.

What none of the three reach: a team that deliberately mounts the explorer
behind an admin login and considers the internal permissions fine to show to an
administrator. That may well be fine. The design does not try to decide it.

## 9. The CLI, and whether a build should fail

The explorer needs a person looking at a screen. Three things the CLI reaches
that the explorer does not.

A matrix authored with the TypeScript builder and never serialized. `apps/admin`
and `apps/shop-api` both build an `Access` in process. A CLI imports the module,
takes `access.matrix`, and checks a document that no endpoint publishes.

The API schema where it lives. A `schema.graphql` in the repository, an
`openapi.json` a build emits. The explorer would need the reader to find and
paste both.

A nonzero exit.

On whether CI should fail: yes, and only on `confidence: 'certain'`. The default
gate is `--fail-on certain`, which covers the six findings of section 2 plus
`dead-kind` and `field-rule-off-api`. A `conventional` finding is the tool's
guess about a convention the repository may not follow, and failing a build on it
produces a failure whose only fix is to edit a policy that was correct. The flag
accepts `--fail-on none` for a report-only run and `--fail-on conventional` for
a team that has checked the convention holds for their API.

A dead permission is the clearest case for a gate. It cannot be intentional, the
finding names the rule and the condition positions, and the fix is a deletion.

## 10. The four demos

Measured: `AccessDemo.tsx` is 283 lines, `PolicySpecimen.tsx` 211,
`FieldWriteDemo.tsx` 284, `UnevaluableDemo.tsx` 180. Each carries a designed
scenario with written copy. `AccessDemo` renders a board game listing with named
reviewers; `UnevaluableDemo` is built around one permission that reads
`object.authorId` and one list row that does not carry it.

The explorer subsumes none of them and should not try. A teaching page shows one
concept against a scenario chosen so the concept is visible; an explorer shows
every fact about a document the reader brought, with no scenario and no copy. A
reader meeting `unevaluable` for the first time needs the row that is missing the
field, pointed at. The same reader, three pages later, holding their own matrix,
needs the explorer.

What the explorer does take from them: `PolicySpecimen` and `AccessDemo` both
build an `Access` and read decisions per subject, which is `capabilities()` and
nothing more. No extraction is proposed. The overlap is four lines of `useMemo`
in each and extracting it would couple four teaching pages to one component's
shape.

The connection to make is a link. Each of the four pages ends with a link to the
explorer, and the explorer ships a sample document per concept so a reader
arrives with something loaded.

## 11. Prior art, read for this document

I fetched ten sources for this section. Each claim names the URL that answered,
and a source that did not answer is named as that. One quotation per source.

**Swagger UI**, from `docs/usage/configuration.md` and `src/core/config/` at
`swagger-api/swagger-ui` `master`. Three ways a document gets in: `url` for one
definition, `urls` for a dropdown, `spec` for an inline object, with a stated
precedence. The configuration page says of `url`: "This parameter is ignored if
`urls` or `spec` is provided." The free-text explore bar lives only in the
standalone preset's `TopBar`, and it disappears when `urls` is configured.

Two defaults are worth copying and one is worth refusing.
`queryConfigEnabled` defaults to `false` in `src/core/config/defaults.js:67`,
so `?url=` does nothing unless a host opts in. That is the right default and the
docs explorer should match it: a document arrives by paste or by file picker,
never by query string, because a query string is a link somebody else can send.
`validatorUrl` defaults to `https://validator.swagger.io/validator`
(`defaults.js:17`), so a private specification's URL reaches a third party
unless the host disables it. The explorer validates with `hydratePolicy`, in the
page, and contacts nothing.

**The OpenAPI specification 3.1.0**, from `spec.openapis.org/oas/v3.1.0.html`
and the Markdown source at `OAI/OpenAPI-Specification` `main`. 3.1 adopted JSON
Schema 2020-12 wholesale: "Data types in the OAS are based on the types
supported by the JSON Schema Specification Draft 2020-12." So the `type` values
are `null`, `boolean`, `object`, `array`, `number`, `string` and `integer`, and
the OAS format table is down to five entries (`int32`, `int64`, `float`,
`double`, `password`). JSON Schema owns `date-time`, and JSON Schema treats a
format as an annotation unless a validator opts into asserting it. Section 7's
table is corrected against this.

Operation shape confirmed: Paths Object, Path Item Object, Operation Object,
with `get`, `put`, `post`, `delete`, `options`, `head`, `patch` and `trace` as
the method members, and `operationId` as "Unique string used to identify the
operation". Nothing in the three objects names a resource type. The only path to
a schema is through a media-type schema under `requestBody` or `responses`,
usually a `$ref`, and `tags` group for documentation with no type semantics.
Section 6's argument rests on this and the reading held.

**The GraphQL specification, October 2021**, from `spec.graphql.org/October2021/`.
`__schema` is a meta-field on the query root; `__Schema` carries `types`,
`queryType`, `mutationType`, `subscriptionType`, `directives` and
`description`. `__TypeKind` is exactly `SCALAR`, `OBJECT`, `INTERFACE`, `UNION`,
`ENUM`, `INPUT_OBJECT`, `LIST` and `NON_NULL`, and `name` is null on the two
wrapper kinds. The built-in scalars are five: `Int`, `Float`, `String`,
`Boolean` and `ID`, the last described as "a unique identifier, often used to
refetch an object or as the key for a cache". There is no built-in date scalar,
which is what decision 7's `'unmapped'` answer in section 7 exists for.

The query root is mandatory and the other two are optional, so an adapter reads
`mutationType` as possibly null. A schema with no mutations yields an empty
write-operation list and the cross-reference reports nothing for it.

**GraphiQL**, from `packages/graphiql-react/src/stores/schema.ts` at
`graphql/graphiql` `main`. Two paths, both real. The `fetcher` prop sends
`getIntrospectionQuery()` under operation name `IntrospectionQuery`, and it
retries with the subscription field stripped when a server refuses. A `schema`
prop skips the request entirely and accepts a built `GraphQLSchema` or the
result of an introspection query. An SDL string is not accepted; a caller runs
`buildSchema` first.

That is the shape `graphqlSurface` should take: an introspection result or a
built schema, and no network call of its own. The explorer is a static page and
it issues no introspection query against a reader's server.

**Apollo Sandbox**, from `apollographql.com/docs/graphos/platform/sandbox`. It
"loads a running GraphQL server's schema via introspection", where the registry
Explorer reads published schemas instead. The same page recommends disabling
introspection in production and points a production endpoint at a public variant
or the embedded Explorer. Whether Sandbox accepts an uploaded SDL file is not
stated on that page, so this document claims nothing about it.

**The Rego Playground**, `play.openpolicyagent.org`. The page answers a fetch
with an empty application shell, so I measured it by calling its API directly:
`POST /v1/data` with `{rego_modules, input, data, rego_version}` answers with
evaluation results and timing metrics, and a malformed payload answers a Go
unmarshal error. So the playground evaluates on a server, and a pasted policy
leaves the machine. The OPA policy language page says a reader "might find it
helpful to follow along using the online OPA playground", and the same page
describes sharing an example by URL, which is a server-stored artifact.

This is the design decision section 8 goes the other way on, and the reason is
that this library evaluates locally on any JavaScript runtime, so a browser
already has the whole engine. A Rego playground cannot do that without shipping
a WASM build of OPA. The explorer page should state the consequence: the
evaluator runs in the reader's browser, so the document the reader pastes has
nowhere to be uploaded to. No server's conduct comes into it.

**The OPA CLI**, from `openpolicyagent.org/docs/cli` and
`/docs/policy-testing`. `opa check` parses and compiles Rego source, silent on
success and nonzero on failure, which is the shape section 9's gate copies.
`opa test --coverage` reports evaluated and unevaluated lines: the report
"includes all of the lines evaluated and not evaluated in the Rego files
provided on the command line". Line coverage over a policy is a different
measurement from operation coverage over an API, and the distinction is the
whole of section 5.

The closest existing thing to the cross-reference is `opa eval --schema` and
`opa check --schema` (`/docs/policy-language`), which type-check a policy
against an input JSON Schema and flag a reference to a field the schema does not
declare, reporting an `undefined ref` naming the field it wanted instead. That
is the same check `assertConditionFits` performs at construction here, arrived
at independently, which is some evidence the check is the right one. It has no
notion of an operation list, so it does not reach `uncovered-write`.

**Regal**, from `open-policy-agent/regal` `main`. A linter, debugger and
language server for Rego, under the OPA organisation, with editor integrations.
It lints the policy language and cross-references nothing.

**The Casbin editor**, from `casbin/casbin-editor` `master`. `casbin.org/editor`
redirects to a stub and `casbin.org/docs/editor` answers 404, so the README is
the source. A web editor for a Casbin model and policy, Next.js and TypeScript,
running enforcement client-side with `node-casbin`. The README calls it "a pure
frontend Javascript project". A user supplies the model, the policy and the
requests, and the page computes the results.

This is the nearest prior art to the docs explorer and it confirms the shape:
the whole engine runs in the page, over a document the reader supplies. Casbin
does not ship it as an embeddable library. The README describes a
standalone deployment and an Electron build, and the reusable piece is
`node-casbin` itself. So Casbin publishes the analysis engine and does not
publish the inspector, which is the sequencing section 12 proposes.

**CASL**, from the repository README at `stalniy/casl` `master` and the
`packages/` listing. The published packages are `ability`, `mongoose`,
`prisma`, `angular`, `react` and `vue`, plus a `dx` package that holds build
configuration. No inspector, no explorer, no devtools extension, no playground.
Introspection in CASL is programmatic: `ability.rules`, `can` and `cannot`. The
docs site is a client-rendered application that answers a fetch with a title and
no body, so nothing was read from it.

**Oso**, from `osohq.com/docs/llms.txt` and the legacy `osohq/oso` README. The
hosted product's documentation index lists "Debugging a Policy", "Policy
Preview", an "Oso Dev Server", "Polar Tests" and an MCP server. Policy Preview
is described as previewing and benchmarking policy changes before deploying.
Individual documentation URLs guessed from the index answered 404, so nothing
below the index was read. The open-source Oso README says: "Use the Oso debugger
or REPL to track down unexpected behavior." Those are terminal tools.

**Nothing found that cross-references a policy against an API schema for
uncovered operations.** GitHub repository search for the obvious phrasings
returned nothing relevant. One caveat, stated plainly: general web search was
unavailable for this session, so the survey rests on GitHub repository search
plus the documentation above, and a hosted product with no public repository
would not have appeared. I found nothing. That is weaker than saying nothing
exists, and the weaker claim is the one this document makes.

What the survey settles. Four of the five candidates ship an inspector of some
kind and none of them ships it as a library: Casbin deploys an app, OPA hosts a
service, Oso sells a product, CASL ships nothing. Three of them run analysis
over the policy alone. One of them, OPA's `--schema`, reaches the input document
and checks field references against it, which is where this library already is
at construction time. The operation-coverage question is the part nobody
answers, and it is also the part section 5 rates as the least reliable, which is
a coincidence worth noticing before treating it as an opportunity.

## 12. Sequencing against a first release

`@evanion/acl` is at `0.0.1` and private. Everything published before v1 is
supported forever, and this document proposes a package, an analysis surface, a
cross-reference format, two adapters, a CLI and a React binding. That is seven
API surfaces for a problem nobody in this repository has hit yet.

Before v1, one thing: decision 2. Export `conditionReadsObject`,
`comparandPathOf` and `permissionReadsObject` from `@evanion/acl`. They are
three existing functions, no new behaviour, no dependency, and they are what
keeps a later inspector from holding a second copy of the operand rule. Adding
exports later is a minor version and not a break, so the argument for doing it
now is about the shape settling while the shape is still movable, and about the
docblock on `comparandPathOf` already promising it.

After v1, in order:

`@evanion/acl-introspect` at `0.x`, with section 2's six findings and nothing
else. No cross-reference, no adapters. It is one function over one document and
its whole test surface is the nine behaviours this document measured.

The docs-site explorer, built in `apps/docs` against that `0.x`. It is the first
consumer and it is the one that finds out whether `Introspection` is the right
shape. Nothing publishes it, so a rewrite costs one commit.

The cross-reference, once one real GraphQL schema has been run against one real
matrix. Not before. Every category in section 5 is either trivially reliable or
a convention nobody has tested, and running it once separates the two. More
design does not.

The CLI, the OpenAPI adapter and any React binding: after somebody has used the
cross-reference and can state the false-positive rate as a number.

## Recommendation

Build less than this document describes.

Ship decision 2 before v1. Ship `introspect()` as data in a sibling `0.x`
package after v1, with the six derivations of section 2 and no cross-reference.
Build the docs explorer as an `apps/docs` component with no headless binding
between it and the analysis.

The argument for stopping there: the six findings of section 2 are each
measured, each `certain`, each invisible to a reviewer today, and each fixable
by an author who sees one. They are the whole of what a matrix can be checked
against itself for. Everything past them needs a
second document, and the second document introduces a convention, and the
convention is where a tool starts being wrong in a way its user cannot fix. The
cross-reference is the most valuable idea here and it is also the one that most
needs a real schema to argue against, which nothing in this repository currently
has.

The case against stopping there: `uncovered-write` is the finding with a security
consequence, and it is the one this recommendation defers. If a real GraphQL
schema is available, the counter-proposal is to build the GraphQL adapter and
`uncovered-write` alone, skip OpenAPI entirely, and let the other four categories
of section 5 wait. That is a defensible reordering and it costs one adapter.

## Testing

- The nine measured behaviours of sections 2 and 8 become fixtures, each
  asserted against `introspect` output. The contradictory-allow document and the
  unconditional-deny document are the two whose engine behaviour is asserted
  beside the finding, so a change to the precedence order that made either one
  live breaks the finding's test.
- `field-rule-off-schema` is asserted against a document whose kind is declared
  and against one whose kind is not, and the second asserts no finding. The
  second is the case where a false positive would fire on every matrix that
  declares a partial schema.
- `introspect` over a document with no `schema` emits no `unchecked-kind`, no
  `unguarded-kind` and no `field-rule-off-schema`. A schemaless document is the
  common case and it must be quiet.
- A finding's `where` parses as a position `assertRulesFit` would emit for the
  same condition, asserted by constructing a document that fails
  `assertConditionFits` at that position and comparing the two strings.
- No test asserts a cross-reference category, because the recommendation ships
  none. If the GraphQL adapter is built, the first test to write is a schema
  whose mutation returns a type no permission names, because that is
  `uncovered-write` at its only reliable inference.

## The evidence, and what it does not cover

Measured, by running a scratch test through `nx test acl` in this worktree and
deleting it:

- A rule whose `when` holds two `eq` conditions on one `subject.*` path with
  unequal literals constructs and answers `no-rule-matched`.
- A condition naming a field of a declared kind that `schema.objects` does not
  carry throws `UnknownFieldError` at `hydratePolicy`, with the message quoted in
  section 2.
- The same condition against an undeclared kind constructs and answers
  `{ allowed: false, reason: 'unevaluable', missing: ['object.nope'] }` against a
  complete instance.
- A `fields` allow-list and a `FieldConfig` naming `ghost`, on a kind whose
  schema declares `ownerId` and `status`, constructs. `canFields` answers
  `ghost: 'unevaluable'` with reason `proposed-required`.
- A deny rule with `when: []` beside a matching allow answers
  `{ allowed: false, reason: 'denied', rule: 'd1' }`.
- `serialize(access, 'reduced')` over a document with no `visibility` marking
  returns `{ permissions: [] }` and throws nothing.
- `capabilities()` keys by `permission.key`.
- A schema declaring `order` and `customer` with a permission on `order` alone
  constructs, and `access.schema.objects` carries both keys.
- A rule with no `when` member at all is refused at construction with
  `InvalidRuleError`, so `when: []` is the only unconditional form and
  `unconditional-deny` has one shape to look for.

Measured by reading the file named:

- `@evanion/acl` ships 97,621 bytes of JavaScript across fifteen modules,
  summed from `libs/acl/dist` excluding `security/`, unminified, excluding
  declaration files and source maps.
- `apps/docs/next.config.ts:53` sets `output: 'export'`.
- `nx.json:151` sets `"projects": ["libs/*"]`.
- `libs/react-acl/src/index.tsx:1` is `'use client'`.
- The four demo line counts in section 10.
- `libs/acl/package.json` declares no `dependencies` and no `peerDependencies`;
  `libs/react-acl/package.json` declares `@evanion/acl` and a React peer.
- `apps/shop-api/src/acl/policy.controller.ts` calls `serialize(access,
'reduced')` and is the only endpoint in this repository publishing a matrix.

Measured by fetching the URL named in section 11:

- Swagger UI's `url`/`urls`/`spec` precedence and the explore bar's confinement
  to the standalone preset, from `docs/usage/configuration.md` and
  `src/standalone/plugins/top-bar/components/TopBar.jsx`. The two defaults,
  `queryConfigEnabled: false` and the `validator.swagger.io` `validatorUrl`,
  from `src/core/config/defaults.js` at lines 67 and 17.
- OAS 3.1's adoption of JSON Schema 2020-12, its seven `type` values and its
  five-entry format table, from the specification. The Path Item method members
  and `operationId`, from the same document.
- GraphQL's `__Schema` members, the eight `__TypeKind` values and the five
  built-in scalars, from the October 2021 specification.
- GraphiQL's `getIntrospectionQuery` call and its `schema` prop, from
  `packages/graphiql-react/src/stores/schema.ts`.
- The Rego Playground's server-side evaluation, measured by posting to
  `/v1/data` and reading the response, including a Go unmarshal error on a
  malformed payload.
- `opa check`'s exit behaviour, `opa test --coverage`'s line coverage, and
  `opa eval --schema`'s `undefined ref` against an input schema, from the three
  OPA documentation pages named.
- The casbin-editor README's client-side enforcement and its standalone
  deployment, and CASL's published package list.

Read from a documentation index, with the pages it lists unreachable:

- Oso's "Policy Preview", "Debugging a Policy" and dev server. The index at
  `osohq.com/docs/llms.txt` answered; every page below it that I tried answered 404. So this document does not establish what Oso's debugger does. The
  terminal REPL claim comes from the open-source README, and the open-source
  project is a different product from the hosted one.

Asserted here and not measured:

- That the parse cost of fifteen eager re-exports matters to any server this
  repository runs. The byte count is a byte count. Nobody profiled a cold start
  with and without an `introspect` module, and that measurement is what would
  most readily overturn section 3.
- That a reviewer misses a dead permission by reading. No review has been run
  over a matrix carrying one, here or anywhere this document can cite. Section
  "What is actually wrong" argues from what the format carries.
- That the OpenAPI convention fails often enough to justify decision 6. I
  constructed the four failing shapes in section 6; I did not sample real
  documents.
- That `Introspection` is the shape an explorer wants. One consumer is planned
  and it does not exist, which is why section 12 sequences the explorer before
  any extraction.
- That a dev-route package in `dependencies` gets reviewed. This assumes a
  process nobody in this repository has.

## Where I am guessing

- That the cross-reference is what the owner most wants. The brief calls it the
  differentiator and the recommendation defers it, on the ground that nothing
  here has a schema to test it against. If a schema exists that this document did
  not find, the recommendation's counter-proposal is the one to take.
- That `confidence` belongs on a finding and not on a category. On the finding,
  one category can be certain from GraphQL and conventional from OpenAPI, which
  `uncovered-write` needs. Whether a consumer wants that granularity is
  untested.
- That the contradiction analysis should stop where section 2 stops. A general
  satisfiability check over conditions is decidable for this condition language,
  since every operator compares one path against a literal or another path, and
  nothing here is quantified. I did not work out whether the general form finds
  anything the four listed cases miss, and the reason to stop short is that a
  reported contradiction nobody can see in the document is a finding a reader
  cannot act on.
- That the GraphQL return type is the right kind mapping. `cancelOrder: Order`
  is the shape this rests on, and a mutation returning a payload wrapper
  (`CancelOrderPayload { order: Order }`), which is the Relay convention, breaks
  it. The adapter would need to unwrap one level and the unwrap is a convention
  of its own.
- That nothing already does the cross-reference. Section 11's closing claim
  rests on GitHub repository search and ten documentation sources, with no
  general web search available. A hosted product with no public repository would
  not have appeared, and the survey should be rerun with search before the
  differentiator claim is repeated anywhere public.
- That the three exports of decision 2 are the complete set. I checked the
  functions `introspect` would need against the condition and permission
  modules. A derivation added later may want something else, and the cost of
  discovering that after v1 is a minor version, which is small.
