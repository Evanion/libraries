# Partial inputs on the typed path

Status: accepted and shipped. An object parameter on the typed path takes a
projection, and a path the projection does not carry decides `unevaluable`
rather than `denied`. Landed in `305e0fa` and `ee67f4e`.
Depends on: `libs/acl/src/authoring.ts` (the typed builder, where every
signature in scope lives), `libs/acl/src/conditions.ts` and
`libs/acl/src/evaluate.ts` (the `unevaluable` machinery the change exists to
make reachable), `libs/acl/src/validate.ts` (the path shape that decides how
deep a partial has to go), `libs/acl/src/totality.test.ts` (the property that
already exercises partial objects at every entry point),
`apps/docs/content/acl/pitfalls.mdx` (the hazard this widens the mouth of),
`2026-09-16-documentation-standard.md` § 5 (the fence exemption tags the
README measurement below needs), `origin/docs/twoslash` (unmerged; the fence
compiler this document routes the README through)
Measured against: `origin/feat/acl` at `3055bd8`, TypeScript 6.0.3, with
`libs/acl/tsconfig.spec.json`'s settings. Every compile result quoted below was
produced by running `tsc` on the code quoted beside it.

## What is actually wrong

`libs/acl/src/authoring.ts:138` and `:183`:

```ts
can(subject: Sub, action: string, object?: Obj, now?: Instant): Decision;
```

The object is optional and, when supplied, complete. The types accept zero
knowledge and complete knowledge and refuse everything between them. The
in-between is the case the `unevaluable` / `missing` feature was built for: a
list view holding `{ id, ownerId }` and not the row.

Three calls, compiled against `libs/acl/tsconfig.spec.json`:

| Call                                                                                  | Today                                |
| ------------------------------------------------------------------------------------- | ------------------------------------ |
| `access.can(s, 'comment', 'update', {})`                                              | TS2345, missing `authorId`, `status` |
| `access.can(s, 'comment', 'update', { authorId: 's1' })`                              | TS2345, missing `status`             |
| `wide.canFields({ id: 's1' }, …)` against `policy<{ id: string; roles: string[] }>()` | TS2345, missing `roles`              |

The first two are `libs/acl/README.md:59` (region `four-outcomes`) and the third
is `libs/acl/README.md:513` (region `field-permissions`). The README's own
`four-outcomes` region ends on `access.can(subject, 'comment', 'update', {})`
under the comment "a projection carrying neither field", asserts
`reason === 'unevaluable'` and `missing === ['object.status',
'object.authorId']`, and does not compile against the package it documents.

The hole that hid it: each library's `typecheck.include` is
`src/**/*.test-d.ts` (`libs/acl/vite.config.ts:22`). README fences reach the
test run through `includeSource` (`tools/doc-examples/src/vite-config.ts:55`),
which is `vite-plugin-doctest` transforming markdown to modules and executing
them. Nothing in that path runs a type checker. The claims execute, the
signatures are never checked, and CI is green over a README that asserts a call
the package's types refuse.

## Decisions

1. Every object parameter on the typed path takes `Partial<Obj>`. A projection
   is a first-class argument, and field names stay checked. Section 2.
2. `canMany` takes `readonly Partial<Obj>[]`. A list view is the case, and it
   is the entry point a list view calls. Section 5.
3. `canFields`'s `object` becomes `Partial<Obj>`. `proposed` is already
   `Partial<Obj>` and does not move. Section 5.
4. The subject stays complete. `Sub`, never `Partial<Sub>`. The engine has no
   non-answer for a subject gap: an absent `subject.*` path is a definite miss
   (`conditions.ts:174`), so a partial subject refuses with `no-rule-matched`,
   names nothing in `missing`, and is indistinguishable from a real refusal.
   Section 4.
5. `libs/acl/README.md`'s `field-permissions` region declares
   `policy<{ id: string; roles: string[] }>()` and passes `{ id: 's1' }`. No
   rule in it reads `subject.roles`. The region's subject type changes to the
   subject it actually passes. This is the one README edit the document
   authorises, and it lands with the code change. Section 4.
6. The untyped path does not change. `create-policy.ts:172` (`Authorized.can`)
   and `:199` (`Access.can`) already take `Record<string, unknown>`, which
   admits a projection, an empty object and a whole row alike. Section 5.
7. `@evanion/react-acl` does not change and is not reached. Its hooks are
   written against the untyped `Access`, with no type parameter anywhere in
   `libs/react-acl/src/index.tsx`. Section 7.
8. A shallow `Partial` is the whole of it. No deep partial, no recursive
   mapped type. A path nests at most one level below its scope: `validate.ts:68`
   refuses a second dot at construction, `conditions.ts:70` splits on the first
   dot and reads the remainder as one own key, and `schema.ts:241` refuses a
   condition that names a relation. Section 6.
9. The condition vocabulary keeps the complete type. `Valid` and `Paths` go on
   taking the `Obj` the author declared in `.for<K, Obj>()`, so widening the
   argument does not widen the set of paths a rule may name. Section 6.
10. `Decision.allowed` stays `boolean` and stays the only gate. Section 3.
11. Widening the types raises the frequency of the escalation hazard without
    changing its nature. The mitigation is `readsObject` and one page of prose;
    no type change carries it. Section 3.
12. A name absent from `FieldDecision.fields` is not a denial, and a shrunken
    map is the documented consequence of passing a projection to `canFields`.
    Section 8.
13. Widening `typecheck.include` to cover `README.md` is rejected. It was tried:
    Vitest collects the README as a typecheck file and reports no errors,
    because the markdown is not in the tsc program. Section 9.
14. The README fences are type-checked by compiling them, through the twoslash
    runner on `origin/docs/twoslash`, extended to the package READMEs. Measured
    cost across the repo: two failures, both the ones above. Section 9.

Decision 4 is the one that contradicts the brief this document was written
from, and section 4 is the argument. Decision 14 is the one with a dependency
outside this change. Decision 1 is the whole of the API change.

## 1. What the types promise and what the engine does

The engine's position on a partial object is written down in
`conditions.ts:96-101`:

> The `object` scope is a projection the caller chose: a partial instance and no
> instance are the same shortfall, so an absent `object.*` path is unevaluable.

So the runtime already treats `{}`, `{ authorId }` and a whole row as three
points on one axis, and has a third answer for the first two. `evaluateResolved`
collects the unread `object.*` paths into `{ state: 'unevaluable', missing }`
(`conditions.ts:170-188`), `ruleMatches` unions them per rule
(`evaluate.ts:33-50`), `sideOutcome` unions them per side
(`evaluate.ts:70-99`), and `decideResolved` emits them as
`{ allowed: false, reason: 'unevaluable', missing }` (`evaluate.ts:212-251`).

The typed surface is the only layer that refuses the middle point. That is the
defect: one layer of a five-layer path disagrees with the other four about what
a caller is allowed to hold.

## 2. Why `Partial<Obj>`, and what a cast costs

The way through today is a cast. What a cast costs is worth stating precisely,
because the loose version of the claim is wrong and the compiler says so.

Compiled, against `type Comment = { authorId: string; status: string }`:

| Expression                                        | Result                                     |
| ------------------------------------------------- | ------------------------------------------ |
| `{} as Comment`                                   | compiles                                   |
| `{ authorIdd: 's1' } as Comment`                  | TS2352, neither type sufficiently overlaps |
| `{ authorId: 's1', statuss: 'draft' } as Comment` | TS2352, `status` missing                   |
| `bag as Comment`, `bag: Record<string, unknown>`  | compiles                                   |
| `{ authorIdd: 's1' } as unknown as Comment`       | compiles                                   |

So a direct assertion over a fresh literal with a typo in it is caught. The two
that are not caught are the two that occur in real code: a row that arrived as
`Record<string, unknown>` from a query builder or a JSON body, and the
`as unknown as` form a developer reaches for when the direct assertion was
refused. Both of those erase every field name in the projection, and a
misspelling that gets through lands as `unevaluable` at runtime with the
misspelling itself reported in `missing`. Fail-closed, so nothing breaks
loudly; the permission quietly never allows, and the cast is what hid it.

`Partial<Comment>` keeps the names under check where a cast does not:

| Expression                                  | Result                                      |
| ------------------------------------------- | ------------------------------------------- |
| `{}`                                        | compiles                                    |
| `{ authorIdd: 's1' }`                       | TS2561, "Did you mean to write 'authorId'?" |
| `{ authorId: 's1', statuss: 'draft' }`      | TS2561 on `statuss`                         |
| `projection`, typed `{ authorIdd: string }` | TS2559, no properties in common             |
| `row`, typed `{ authorId: string }`         | compiles                                    |
| `bag`, typed `Record<string, unknown>`      | compiles                                    |

Two of those deserve to be stated rather than skipped. `Partial<T>` is a weak
type, so TypeScript's weak-type detection catches a projection type whose keys
are all wrong (TS2559) even though it is not a fresh literal. It does not catch
a projection variable that has one right key and one wrong one: excess property
checking applies to fresh object literals only, so
`const p = { authorId: 's1', statuss: 'draft' }` passes as an argument while the
same literal written inline is refused. And a value already typed
`Record<string, unknown>` has an index signature, which turns weak-type
detection off, so the bag case stays exactly as unchecked as it is today.

`Record<string, unknown>` as the parameter type would be that last row applied
to every call. It permits the partial and gives up the field names at the same
time, which is the cast's bargain moved into the signature where nobody can see
it being struck. `Partial<Obj>` buys the same permission and keeps the names.

## 3. The security analysis

Two claims, both checked against the source.

A partial is fail-closed at the value level. `Decision.allowed` is `boolean`
(`types.ts:244`) with no optional and no third value. Every return in
`decideResolved` that is not the matched-allow branch carries
`allowed: false` — `denied` (`evaluate.ts:176`), `dependency-off` (`:186`),
`no-rule-matched` (`:197`), `unusable-clock` (`:201` and `:237`), `unevaluable`
(`:212` and `:246`) — and the comment at `evaluate.ts:168` states it as the
invariant: "Every one of these branches is `allowed: false`, so none leaks." On
the field axis, `FieldState` has no `unevaluable`-is-allowed path either:
`decideFields` computes `allowed` as every state being exactly `'allowed'`
(`fields.ts:222`), `canFields` ANDs that with the action decision
(`create-policy.ts:441-446`), and `pickAllowedFields` copies a key only when its
state is `'allowed'` (`fields.ts:250-256`). A projection cannot widen any of
this. It can only move a decision from a definite answer to a refusal.

The escalation hazard was never the partial data. It is a caller branching on
`reason` and treating `'unevaluable' !== 'denied'` as permission, which reads
identically whether the object arrived complete or not.
`apps/docs/content/acl/pitfalls.mdx:18` and `:71` already name both forms of it,
and `apps/docs/content/acl/integrations/nestjs.mdx:165` ships the one legitimate
use — `if (decision.allowed || decision.reason === 'unevaluable') return true;`
in a guard that runs before the row is loaded, correct only because the service
behind it decides again.

Whether widening the types changes the hazard's likelihood: yes, upward, and
saying otherwise would be dishonest. Today a partial call costs a cast, which is
a visible artefact a reviewer can object to and a developer has to decide to
write. After decision 1 the partial call is the cheapest thing to type, so more
calls will return `unevaluable`, so more code will meet the three-valued
`reason` for the first time. The nature of the hazard does not move; its
frequency does.

The mitigation is what already exists, pointed at the new callers:

- `Access.readsObject(key, action)` (`create-policy.ts:248`) answers, from the
  document, whether a permission can be decided without the row at all. A
  caller that is about to pass a projection is exactly the caller that needs
  it. It goes beside the partial examples on every page that gains one.
- The pitfalls entries at `pitfalls.mdx:18` and `:27` are the text. They are
  written and they are correct; what they lack is a reader arriving from the
  partial case. The `asking` and `fields` pages link to them from the paragraph
  that introduces the projection.
- `libs/acl/src/authoring.test-d.ts` gains the assertion that
  `Decision['allowed']` is `boolean` and that a partial call still returns
  `Decision`, so a later narrowing attempt fails the type tests rather than the
  review.

None of this contradicts the security contract at
`apps/docs/content/acl/security.mdx`: browser evaluation toggles what a user
sees and is never the access control, enforcement happens in a trusted
environment, and every app in the chain evaluates for itself and trusts no
earlier layer. A projection changes what one evaluation can answer. It changes
nothing about where the answer counts.

## 4. The subject side is not symmetric

The brief asked for a partial subject alongside the partial object. The engine
refuses the symmetry, in the same function that grants it on the object side.

`conditions.ts:173-176`: an absent path that is not an `object.*` path returns
`FAILS` immediately. `conditions.ts:99-101` says why: "The subject is resolved
whole by the app and is never a projection, so an absent `subject.*` path is a
definite miss." `libs/acl/README.md:107-109` states the same thing to readers.

So the two sides are not two instances of one problem:

|                                     | object gap                            | subject gap                     |
| ----------------------------------- | ------------------------------------- | ------------------------------- |
| Condition outcome                   | `unevaluable`, naming the path        | `fails`                         |
| Permission outcome                  | `unevaluable`, `missing` populated    | `no-rule-matched`               |
| What the caller can do              | fetch what `missing` names, ask again | nothing; the answer looks final |
| Distinguishable from a real refusal | yes                                   | no                              |

`Partial<Sub>` would type-check a call whose answer is a silent, permanent,
undiagnosable no. That is fail-closed and it is also unusable: the caller is
told the rules did not match when the truth is that the caller did not supply
the attribute the rule reads. Decision 4 keeps the complete subject for that
reason, and the guarantee is real in the sense that matters here — it is the
contract the engine is written against, enforced by nothing at runtime, which
is why the type is where it has to be stated.

That leaves the README's `field-permissions` region, which is where the subject
error was found. Its policy declares `roles` and never reads it; the type
argument is decoration, and `{ id: 's1' }` is the honest subject for that
example. Decision 5 changes the region's type argument. A reader who genuinely
holds a projected subject is holding a bug, and the compiler telling them so is
the feature.

## 5. Every signature, and which one changes

`libs/acl/src/authoring.ts`, the typed path:

| Signature                                                               | Line   | Change                                          |
| ----------------------------------------------------------------------- | ------ | ----------------------------------------------- |
| `BoundKind.can(subject, action, object?, now?)`                         | 138    | `object?: Partial<Obj>`                         |
| `BoundKind.canMany(subject, action, objects, now?)`                     | 139    | `readonly Partial<Obj>[]`                       |
| `BoundKind.canFields(subject, action, object, axis, proposed?, now?)`   | 145    | `object: Partial<Obj>`; `proposed` unchanged    |
| `Policy.can(subject, key, action, object?, now?)`                       | 183    | `object?: Partial<R[K]>`                        |
| `Policy.canMany(subject, key, action, objects, now?)`                   | 190    | `readonly Partial<R[K]>[]`                      |
| `Policy.canFields(subject, key, action, object, axis, proposed?, now?)` | 197    | `object: Partial<R[K]>`; `proposed` unchanged   |
| `Policy.capabilities(subject, now?)`                                    | 206    | none; it takes no object                        |
| `Policy.authorize(subject, options?)`                                   | 207    | none; see below                                 |
| `Policy.for(key, build)`                                                | 179    | none; `Obj` is declared here and stays complete |
| `Ops` / `Actions` / `Valid` / `Operand` / `Paths`                       | 19-134 | none                                            |

`capabilities` is already the zero-knowledge call: it builds its context with
`object: undefined` (`create-policy.ts:453`) and answers every permission in the
document. Nothing to widen.

`authorize` returns `Authorized`, which is the untyped handle
(`create-policy.ts:171-186`): the type binding is dropped at that call today,
and a caller who goes through it gets `Record<string, unknown>` for every
object. Re-typing `Authorized` over `Sub` and `R` is a separate change with its
own inference questions, and this document does not take it. It is named here
so the gap is a known one rather than a surprise.

`libs/acl/src/create-policy.ts`, the untyped path: no change. `Access.can`
(`:199`), `Access.canMany` (`:206`), `Access.canFields` (`:213`),
`Access.capabilities` (`:222`), `Access.authorize` (`:223`), and the four
members of `Authorized` (`:172-185`) all take `Subject` and
`Record<string, unknown>`, which already accept a projection. `Subject` is
itself `Record<string, unknown>` (`:132`), so the subject asymmetry of section 4
is a claim the typed path makes and the untyped path has never made.

`libs/acl/src/fields.ts`: `pickAllowedFields<T extends Record<string, unknown>>`
(`:240`) is generic over the proposed write and returns `Partial<T>`. No change.

## 6. Nesting, relations, and why shallow is the whole of it

A shallow `Partial<Obj>` leaves nested reads required. That would be a gap if
nested reads existed. They do not, at three independent layers:

- `validate.ts:56-72` rejects any path with a second dot at construction, with
  the message "nests below its scope: a path reads one field of a scope, so at
  most one dot is resolvable". No constructed matrix carries one.
- `conditions.ts:68-84` splits a path on its first dot and reads the remainder
  as a single own key with a `hasOwnProperty` guard. `object.a.b` would look up
  the literal key `"a.b"` and find nothing.
- `schema.ts:241-248` refuses a condition whose path names a relation, with the
  reason that "a condition reads one field of one scope, and a relation is not a
  value it compares". `ObjectSchema.relations` (`types.ts:170`) declares one hop
  for the consumers that resolve it, and declares nothing a condition may read.

So `schema.objects` relations do not interact with `Partial<Obj>` at all: a
relation is never an operand, and the object a condition reads is always one
flat bag of own keys. A deep partial would buy nothing and cost a recursive
mapped type over every declared object type, plus the inference and error-message
noise that comes with one. Decision 8 declines it.

Decision 9 is the other half of the same point. `Valid<S, Sub, Obj>`
(`authoring.ts:29`) and `Paths<T, P>` (`:19`) are applied to the `Obj` declared
in `.for<K, Obj>()`, and nothing in the change touches that position. A rule
goes on naming the fields of the complete type; the caller goes on being
allowed to bring fewer of them. The two are independent, and `Paths` would not
have moved in any case — `keyof` an optional-property type is the same key set.

## 7. react-acl

No change, and the change does not reach it. `libs/react-acl/src/index.tsx`
declares `useCan(key, action, object?: Record<string, unknown>)` (`:85`),
`useCanMany` (`:100`), `useCanFields` (`:113`) and `useCapabilities` (`:128`),
all over the untyped `Access` held in context (`:33-39`). There is no type
parameter in the file. A React caller can already pass a projection and already
gets `unevaluable` for it, which is what `PolicyProvider` was built for: a list
rendered from a projection, with the row fetched on demand.

If the typed path is ever re-exposed through React, it inherits decisions 1
through 4 as written. Nothing here blocks that and nothing here does it.

## 8. What relies on completeness today

Nothing, and it was checked rather than assumed.

Every read of an object field in the engine is guarded. `readPath` reads through
`Object.prototype.hasOwnProperty` and returns `undefined` for an absent field
(`conditions.ts:81-83`). `decideConfig` guards the current value the same way
and answers `unevaluable` with reason `missing-field` when it is absent
(`fields.ts:106-112`). `decideFields` derives its field list from
`Object.keys(ctx.object)` with an `ctx.object ? … : []` guard (`fields.ts:168`),
and reads a rule's config only through `hasOwn` (`:189`). `pickAllowedFields`
checks `hasOwn(decision.fields, field)` before reading a state (`:252`).

The property test is the stronger evidence. `libs/acl/src/totality.test.ts`
generates junk contexts and runs every entry point against them, and its
`canMany` call passes `[object, {}]` explicitly (`:262`) — an empty object at a
typed-complete position, already, through the untyped surface. The standing
property is that every entry point answers with a decision, and it holds for
partial and malformed objects today.

The one behavioural consequence worth writing down is decision 12, on
`canFields`. The decision maps are keyed by the union of the object's own keys,
the proposed write's keys and the rule's field names (`fields.ts:168-181`). Hand
it a projection and the map is smaller: a field the projection omits, that no
rule names and that the write does not propose, appears in neither `fields` nor
`reasons`. That direction is safe — a caller rendering inputs from
`fields` renders fewer, and `pickAllowedFields` writes only keys that decided
`allowed` — and it is the case `pitfalls.mdx:71` already warns about from the
other end ("the same filter also passes any key the decision does not carry at
all"). The rule to state on the page: a name in the map is a decision, and a
name absent from it is not a denial.

## 9. Type-checking the README fences

This is its own decision with its own cost, and the cost was measured rather
than guessed.

Widening `typecheck.include` does not work. Adding `README.md` to
`libs/acl/vite.config.ts:22` and running `vitest --typecheck.only --run` in
`libs/acl` collects a third typecheck file, where the baseline collects two, and
reports "Type Errors no errors" — over a README that `tsc` rejects in two
places. Vitest's typecheck maps `tsc` diagnostics onto files it collected, and
`tsc`'s program contains no markdown, so a fence in a `.md` file can never
produce a diagnostic to map. The change is inert, which is worse than a change
that breaks something, because it reads as coverage. Decision 13.

What does work is compiling the fences. `origin/docs/twoslash` already carries
the machinery: `tools/repo-checks/src/doc-twoslash.test.ts` expands regions with
`expandRegions` and runs `createTwoslasher` over every `twoslash` fence in
`apps/docs/content`, with `// @errors:` as the declared-failure list and a
second assertion that a declared code is still produced. Decision 14 extends
that runner's input from the docs content to the package READMEs. It carries
one dependency: that branch is not merged, and this change waits on it rather
than growing a second fence compiler beside it.

The cost of turning it on, measured over all eleven package READMEs at
`3055bd8` by extracting every `ts`/`tsx` fence and compiling it under
`tsconfig.base.json`'s settings:

| Fences                                               | Count | Failing |
| ---------------------------------------------------- | ----- | ------- |
| `ts`/`tsx` fences in package READMEs                 | 137   | —       |
| Self-contained (carry their own imports)             | 42    | 14      |
| Self-contained and doctested (`@import.meta.vitest`) | 23    | 2       |
| Self-contained and illustrative                      | 19    | 12      |

The two doctested failures are `libs/acl/README.md:59` and `:513`. That is the
whole cost of decision 14 as scoped to doctested fences: the two defects this
document is about, and nothing else in the repo.

The 95 fences that carry no import of their own compile only against a context
an earlier fence set up, and the 12 failing illustrative fences name symbols
they never declare (`ErrorBoundary`, `ThemeProvider`, `Hero`, `validateItems`)
or import subpaths such as `@evanion/baize-ui/tokens`. Those are the population
the documentation standard's § 5 exemption tags exist for, and bringing them
under a compiler is a separate piece of work with a real bill. Decision 14 is
scoped to the doctested fences, where the bill is two lines.

## What this rejects, and why

A narrowed return type for a complete object. The shape would be an overload
where passing a whole `Obj` yields a `Decision` whose `reason` cannot be
`'unevaluable'`. It would be a lie, and two independent paths prove it. A
complete object still refuses with `unusable-clock` whenever a rule reads the
clock and the caller's instant does not parse (`conditions.ts:160`,
`evaluate.ts:201` and `:237`) — and `settleNow(null)` is NaN by design
(`conditions.ts:41-47`). A complete object also does not repair a subject-side
gap, which lands as `no-rule-matched` under section 4. Beyond those, `dependsOn`
means a permission's reason can come from an ancestor's cascade
(`evaluate.ts:185-193`), and the ancestor is decided against the same context
but its own rules. A type that promised "complete in, decidable out" would be
wrong on three counts and would push callers to skip the `allowed` check, which
is the one thing section 3 is holding.

`Record<string, unknown>` as the parameter type. It permits the partial and
discards every field name with it. Section 2 has the compile results; the short
version is that it moves the cast into the signature.

`Partial<Sub>`. Section 4.

A deep partial. Section 6.

Making a subject-side gap report `missing`. It would make `Partial<Sub>`
survivable by giving the subject the same repairable non-answer the object has.
It is a change to the decision semantics of every existing policy: a role check
against a subject that does not carry `roles` would stop being a refusal and
start being a fetch instruction, which is wrong for a subject the app resolved
whole, and which is a silent behaviour change for every caller who reads
`allowed` today and every caller who switches on `reason`. The library's
position is that the app owns the subject. This document keeps it.

Widening `typecheck.include`. Section 9. It was tried; it does nothing.

## Order

1. Decisions 1 through 3, under the constraints decisions 8 and 9 set, in
   `libs/acl/src/authoring.ts`. Type positions only; the runtime already erases to `Record<string, unknown>` at
   `authoring.ts:379-381`.
2. The type tests: a partial object at each widened entry point, a partial
   subject asserted to be refused with `@ts-expect-error`, and the
   `Decision['allowed']` assertion from section 3, in
   `libs/acl/src/authoring.test-d.ts`.
3. Decision 5, the `field-permissions` region.
4. The prose: the projection paragraph on `acl/asking` and `acl/fields`, the
   `readsObject` pointer, and the absent-name rule from decision 12 on
   `acl/pitfalls`.
5. Decision 14, after `origin/docs/twoslash` merges.

Steps 1 through 4 are one change and one review. Step 5 is the guard that would
have caught the whole thing, and it lands last because its dependency is not in
yet.

## Testing

- `libs/acl/src/authoring.test-d.ts`: `{}` and a one-field projection compile at
  `can`, `canMany` and `canFields` on both `Policy` and `BoundKind`; a
  misspelled key in a fresh literal is refused; a partial subject is refused.
- `libs/acl/src/authoring.test.ts`: a partial object through the typed path
  returns `reason: 'unevaluable'` with the same `missing` the untyped path
  returns for the same projection, so the two surfaces are shown to answer
  alike.
- `libs/acl/src/totality.test.ts`: unchanged. It already covers the runtime
  half, and the change is type-level.
- The doctest run over `libs/acl/README.md`: unchanged assertions, now compiled.

## Where I am guessing

The frequency claim in section 3 is an argument, not a measurement. Nobody has
counted how many `as Obj` casts exist in callers of this package outside this
repo, and the repo's own apps do not use the typed path with a projection today.
The direction of the effect is not in doubt; the size of it is unmeasured.

The 12 failing illustrative fences in section 9 were compiled by a harness
written for this document, with the workspace packages mapped to their sources
by `paths`. The twoslash runner resolves through each package's published
`exports` against `dist/`, so its verdict on those 12 will differ in detail from
the harness's. The 23 doctested fences are the population decision 14 is scoped
to, and the two failures in that population were each reproduced directly with
`tsc` against `libs/acl/tsconfig.spec.json`.
