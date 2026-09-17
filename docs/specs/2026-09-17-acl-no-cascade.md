# The shape of the `@evanion/acl` surface

Status: proposed
Packages: `@evanion/acl`. `@evanion/react-acl` is untouched by part A, reads one
changed type in part B, and is evidence against part C.
Depends on: `libs/acl/src/conditions.ts` (`settleNow` and `toEpoch`, which are
where part C's premise fails), `libs/acl/src/evaluate.ts` (step 2 of the
precedence order, and `sideOutcome`, whose monotonicity the deny overlay rests
on),
`libs/acl/src/graph.ts` (the whole file), `libs/acl/src/create-policy.ts` (the
cascade slicing, and the factory part B makes generic),
`libs/acl/src/authoring.ts` (the typed facade), `libs/acl/src/reads-object.ts`
(transitive over `dependsOn`), `libs/acl/src/validate.ts`
(`DuplicatePermissionError` has no raise site outside `graph.ts`),
`docs/specs/2026-09-16-deny-overlay.md` § 2 (checked in § 6 below),
`docs/specs/2026-09-17-acl-partial-inputs.md` § 5 (the `authorize` gap part B
closes), `docs/specs/2026-09-11-feature-toggles.md` (where the cascade came
from), `docs/superpowers/specs/2026-09-14-acl-design.md` (the design this
amends). Part C reads two commits on `feat/acl` rather than a specification:
`92eb2f4` (which widened `now` to `Instant`, and gives the reason) and `9c48e7a`
(which built `unusable-clock`, and lists the four inputs that reach it).
Measured against: `origin/feat/acl` at `40e0c8b`, TypeScript 6.0.3. Every line
number, count and compile result below was derived by reading that tree in this
session.
Prior art: Cedar, Zanzibar/OpenFGA and XACML 3.0, read for § 1. One of the three
can express the constraint, and where it can, it writes it at the definition of
the thing being checked. That is the finding, and it is not the one the brief
expected. Cedar and XACML again for § 9.6, for how a policy that has to be
serialized carries an instant.

## What is actually wrong

Three things, independent of each other, all about what the public surface
contains and what it is called rather than about what it computes. A fourth
question was asked and the answer is that nothing is wrong.

**`dependsOn` is a deny path written where nobody reading the permission will
see it.** `docs/superpowers/specs/2026-09-14-acl-design.md:127` justifies it as
"a flat list with a `dependsOn` cascade, mirroring `@evanion/feature`", and
`:181-185` concedes what it costs in the same breath: "This is an intentional
reading of the feature-flag cascade transplanted to authorization, and it is
itself an implicit deny path." The stated reason is that the other package in
this repository has one. That is a consistency argument, and it is the only one
offered.

**There are two factories for one evaluator.** `policy()`
(`libs/acl/src/authoring.ts:421`) declares the entire `Access` surface a second
time and forwards every call to `createPolicy(...)`. It carries no evaluation of
its own. `authorize()` is where the fiction breaks: `Policy.authorize`
(`:225`) returns the untyped `Authorized`, so the type binding the builder exists
to provide is dropped at that member.

The two are one question in one place, quoted here because it is the whole
argument for taking them together — `authoring.ts:444-446`:

```ts
// A later block may contribute a key an earlier dependsOn names, so the
// matrix built before this call no longer answers for the whole policy.
built = undefined;
```

The facade caches an `Access` and invalidates it on every `.for()`. It does that
because `dependsOn` can name a key a later block contributes. Remove the cascade
and the reason for the cache and its invalidation both go; what is left is a
builder that accumulates drafts and hands back a matrix, which is what part B
asks it to be.

A third question was asked in the same pass — whether the clock's `Instant`
should narrow so `unusable-clock` could go. Nothing is wrong there, and § 9 says
why in enough detail to settle it rather than re-open it. The one defect that
investigation did find is `Infinity`, which is not what it was looking for.

**And the documentation says the opposite of what the owner intends.** Of the 20
doctest regions in `libs/acl/README.md`, 12 construct with `createPolicy`, 7 with
`policy<` and 1 with `parseMatrix`. `index.mdx:17` and `simple.mdx:44` lead with
regions from the first group, so the constructor a reader meets first is the one
the owner does not consider primary. § 10.

## Decisions

Part A, part B and part C are separable, and part C is mostly a refusal. A and B
can each be taken without the other; § 7 says what changes if only one is. Part D
rests on B for its API half and stands alone for its documentation half; § 10.6
says which is which.

### Part A — remove `dependsOn`

1. `dependsOn` is deleted from `Permission`, from the typed builder, from the
   canonical JSON, and from the engine. The package is unpublished, so this is
   free today and a breaking format change on any later day.
2. Step 2 of the precedence order in `evaluate.ts:148-168` is deleted. The
   nine-step order becomes eight, and every remaining step reads only the
   permission in hand.
3. `Reason` loses `'dependency-off'`. `Decision` loses `blockedBy` and `cause`.
   The `Cause` interface and its export are deleted. `missing` stays: it is the
   `unevaluable` repair path and has never been about the cascade.
4. `graph.ts` is deleted entirely, and with it `PermissionGraph`, `buildGraph`,
   `dependants` and `order`. `FeatureCycleError` and `UnknownDependencyError`
   are deleted.
5. **`DuplicatePermissionError` stays, and its raise site moves to
   `validate.ts`.** `buildGraph` is the only place in the package that rejects a
   duplicate key (`graph.ts:28-30`); `buildIndex` (`create-policy.ts:251-257`)
   silently keeps the last one. Deleting `graph.ts` without moving this check
   turns a construction error into a silent overwrite. § 5.
6. An author who means "publish requires update" writes the requirement as a
   condition on publish, where a reader of publish sees it. § 3 gives the before
   and after from the README's own matrix.
7. **No lint replaces it in this change.** A lint needs a declaration of the
   intended implication, and a declaration in the matrix is `dependsOn` with the
   failure moved to build time. § 4 sketches the one form that is worth
   specifying later and says why it is a separate document.
8. `readsObject` stops being transitive. `buildReadsObject`
   (`reads-object.ts:39-57`) collapses into `permissionReadsObject`, which is
   already the per-permission answer.
9. The deny overlay is unaffected and its soundness argument gets shorter. § 6
   derives this rather than asserting it, and reports one behaviour change that
   is a tightening of the overlay's trust boundary.

### Part B — one factory

10. `policy<Sub>()` stops carrying an evaluator. It keeps `for()` and the
    `matrix`, `version` and `schema` getters, and loses `can`, `canMany`,
    `canFields`, `capabilities`, `authorize`, `object` and `readsObject`.
11. Superseded by decision 21, and kept because part B without part D still needs
    it: `policy<Sub>().for(...).matrix` is typed `TypedMatrix<Sub, R>`, a
    `Matrix` plus a phantom member under a `unique symbol` key. Part D's
    `build()` terminal keeps the types on a method of `Policy<Sub, R>`, so
    nothing carries them across a function parameter and no brand is built.
12. `createPolicy<Sub, R>(matrix, options?): Access<Sub, R>` infers both
    parameters from the argument and defaults them to `Record<string, unknown>`
    and `Record<string, Record<string, unknown>>`. The caller restates nothing,
    and an unbranded `Matrix` degrades to exactly today's untyped signatures. § 7
    is the compile that checks this.
13. `Authorized` becomes `Authorized<Sub, R>`, which closes the gap
    `2026-09-17-acl-partial-inputs.md` § 5 named and declined to take.
14. `BoundKind` moves to `create-policy.ts` as the return of `Access.object(key)`
    and is declared once rather than twice.
15. `parseMatrix` is untouched and keeps returning a plain `Matrix`. The runtime
    JSON path — the one the federation design rests on and a TypeScript builder
    cannot express — is unchanged in every respect.

### Part C — the clock

Part C was proposed as a narrowing of `Instant` from `string | number | Date` to
`Date | number`, to delete `unusable-clock`. **The recommendation is not to take
it.** The document half is impossible, the call-site half deletes nothing, and
both halves cost something. § 9 is the derivation. The three decisions below are
what is left once that is established, and the last one is worth taking on its
own.

16. **`Instant` stays `string | number | Date`, in the document and at the call
    site.** The canonical matrix is JSON, a `before`/`after` condition carries an
    instant as a document value, and JSON has no date. § 9.1.
17. **`unusable-clock` stays.** It is not created by the string form. `settleNow`
    (`conditions.ts:41-46`) lands on NaN for `null`, `NaN`, `Infinity` and an
    `Invalid Date` as well, and three of those four survive the narrowing. No
    `Reason` member, no `ConditionOutcome` state and no engine branch is deleted
    by it. § 9.2.
18. The unreachable boundary guard in `evaluateResolved`
    (`conditions.ts:163-164`) is deleted anyway, or kept with its comment
    corrected. It is dead on every public path today, and that is independent of
    Part C. § 9.4.
19. **A browser clock is the user's clock, and the docs say so.** A time
    condition is weaker in a browser than a role condition, because the subject
    controls the input. The doctrine already covers it; nothing states it. § 9.5.
20. **`settleNow` refuses a non-finite `now`.** `toEpoch` returns a number
    through unchanged, so `Infinity` is accepted as a clock today and makes every
    `after` condition hold. This is the one defect the Part C investigation
    found, it is in the form Part C would have kept, and it is one predicate.
    § 9.2.

### Part D — which entry point is the main one

Part D rests on part B and supersedes one of its decisions. § 10.6 says which,
and says plainly that D's API half is incoherent without B while its
documentation half is not.

21. **`policy<Sub>()` gains a terminal `build(options?): Access<Sub, R>`.** This
    replaces decision 11: types no longer cross a standalone function boundary,
    so `TypedMatrix` and its phantom `unique symbol` are not needed and are not
    built. `Policy<Sub, R>` has three members — `for`, `matrix`, `build` — and
    still forwards nothing. The authoring call site becomes
    `policy<S>().for(…).build()` and names no other function. § 10.1.
22. **`createPolicy` is renamed `hydratePolicy`.** The reason is accuracy before
    signal: after part B, `createPolicy` does not create a policy. It takes a
    document that already exists and returns an evaluator over it, and the
    commonest instance of that is a matrix the server built arriving at a client.
    § 10.2.
23. **`parseMatrix` stays, unrenamed, and the two split by provenance rather
    than by trust.** `hydratePolicy` is my own document coming back;
    `parseMatrix` is somebody else's document arriving. The README already
    divides its regions on exactly that line, so this names a split that is
    there. § 10.3.
24. **The residue is stated rather than hidden.** One case is neither — a
    document the owner composed in-process, `hydratePolicy(applyDenyOverlay(…))`.
    It takes `hydratePolicy` because that is the open-mode entry, and the name is
    wider than its word there. § 10.3.
25. **`index` and `simple` teach `policy()`.** The document entries appear where
    a document arrives, which is seven pages rather than three: `adopting`,
    `matrix` and `federation`, and also `next-rsc`, `react-router`, `platforms`
    and `advanced`, which transclude the SSR crossing. § 10.4.
26. **Twelve of the README's 20 doctest regions change**: seven switch to
    `policy()`, four take the rename, one becomes `parseMatrix`. § 10.4 names
    each.
27. **Six lines of prose stop saying "hydration" about the clock.** The word is
    in use in this package for an instant that crossed JSON, and it carries the
    loudest warning in the acl docs. Taking it for the matrix means giving it up
    for the clock on the pages where both appear. § 10.5 is the condition on
    decision 22, and it is a condition, not a caveat.

Decision 7 is the one to argue with. Decision 5 is the one that would have been
a silent regression. Decision 12 is the one that had to be compiled rather than
asserted. Decision 16 is the one the brief asked me to check first and expected
might sink Part C, and it does. Decision 27 is the one that makes decision 22
safe, and taking 22 without 27 would put two opposite instructions under one verb
on one page.

## 1. What the three systems actually do

The brief asked me to verify that Cedar, Zanzibar and XACML have no equivalent
on actions. One of them does, and the detail is more useful than the claim.

**Cedar has none.** A policy's `when`/`unless` sees the principal, action,
resource, context and entity attributes of the request being decided. There is
no callable that asks for a second decision, and the evaluator never nests
(<https://docs.cedarpolicy.com/policies/syntax-policy.html>,
<https://docs.cedarpolicy.com/auth/authorization.html>). Action groups exist and
run the other way: a policy scoped to a group applies to every member, so
permitting the general permits the specific
(<https://docs.cedarpolicy.com/schema/human-readable-schema.html>). To express
"publish only if update", a Cedar author duplicates update's condition inside a
`forbid` on publish.

**XACML 3.0 has none.** `<PolicyIdReference>` and `<PolicySetIdReference>` are
inclusion by id, evaluated "as though it were in-line" against the same request
(§ 7.15,
<https://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html>). The
combining algorithms — deny-overrides, permit-unless-deny and the rest — combine
results for one request. Asking for the decision on a different action is a PIP
attribute or a PEP loop, which is to say it is outside the language.

**OpenFGA has it, and that is the interesting case.** Intersection is in the
configuration language (<https://openfga.dev/docs/configuration-language>), and
Zanzibar's paper has it at § 2.3.1. Modelled as relations:

```
type document
  relations
    define editor: [user]
    define can_update: editor
    define can_publish: [user] and can_update
```

`check(user, can_publish, doc)` is now false for anyone failing `can_update`.
That is the constraint, and it denies.

The place it is written is the point. `can_publish` is the relation the reader
reads and the relation the API is called with, and its dependency on
`can_update` sits on its own right-hand side. There is no edge declared
elsewhere that a reader of `can_publish` has to go and look for. Zanzibar's
other implication construct, the userset rewrite that makes every editor a
viewer, runs in the granting direction and only ever adds.

So the honest form of the argument is not that authorization never denies by
implication. It is that the one system that expresses it puts it at the
definition of the thing being checked, which is what decision 6 asks an author
here to do, and what `dependsOn` does not do.

## 2. Where the deny is, and what it costs to find it

Everything else in this engine is one explicit precedence order over one
permission. `evaluate.ts:148-168` lists nine steps; eight of them read only
`permission.rules`, `permission.denyRules` and the context. Step 2 reads a map of
decisions about other permissions.

The consequence at the reading end: `article.publish` in the matrix carries its
rules, and whether a subject may publish is not answerable from them. A reader
has to find every permission that names `article.publish` as a parent — no, the
other way, which is worse: find `article.publish`'s own `dependsOn`, resolve each
parent, and recurse. `README.md:516-543` is the demonstration, and the comment in
it says so outright: "Every rule on `feature` matched. It is off because `update`
is."

The type surface that exists for this and nothing else:

| Deleted                          | Where                   |
| -------------------------------- | ----------------------- |
| `Permission.dependsOn`           | `types.ts:134`          |
| `Reason` member `dependency-off` | `types.ts:227`          |
| `Cause`                          | `types.ts:232-239`      |
| `Decision.blockedBy`             | `types.ts:247`          |
| `Decision.cause`                 | `types.ts:248`          |
| `FeatureCycleError`              | `errors.ts:11-19`       |
| `UnknownDependencyError`         | `errors.ts:21-33`       |
| `PermissionGraph`                | `graph.ts:8-13`         |
| `buildGraph`                     | `graph.ts:22-111`       |
| `Actions.dependsOn`              | `authoring.ts:126-131`  |
| `buildReadsObject`               | `reads-object.ts:39-57` |

Two of the eleven are exported from `index.ts` as errors
(`index.ts:47`, `:57`) and one as a type (`:67`). The evaluation path that goes
with them is `blockingParent` (`evaluate.ts:101-110`), `rootCause`
(`:112-139`) and the step-2 branch (`:185-194`) — 50 of `evaluate.ts`'s 271
lines; and `resolve` (`create-policy.ts:259-271`), `cascadeOf` (`:273-294`),
the `cascades` memo and `cascadeFor` (`:333-340`) and `decideCascaded`
(`:342-352`) — 55 of that file's 491. `graph.ts` is 111 lines and all of them
go.

`dependants()` (`graph.ts:92-108`) has no caller anywhere in the package today
except its own test. It was built for the reverse-index direction the feature
package needs and this one never used.

One thing the removal buys that is not about reading. `can` today costs one
resolution per permission in the transitive slice
(`create-policy.ts:346-352`); `security/tier1-prevented.test.ts:835` is a whole
`describe` — "SEC-016 the cost of a decision is bounded by the cascade
(CWE-400)" — asserting that bound over chains of depth 4, 40 and 400. Without
the cascade a decision reads one permission, and the class of concern the block
guards against stops existing for `can`.

## 3. What an author writes instead

`libs/acl/README.md:516-543`, the `cascade` region, is the repository's own
example. Before:

```ts
const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
  p
    .allow('update', p.eq('object.authorId', 'subject.id'))
    .allow('publish', p.contains('subject.roles', 'editor'))
    .dependsOn('comment.update'),
);
```

After:

```ts
const access = policy<Subject>().for<'comment', Comment>('comment', (p) => {
  const isAuthor = p.eq('object.authorId', 'subject.id');
  return p
    .allow('update', isAuthor)
    .allow('publish', p.and(p.contains('subject.roles', 'editor'), isAuthor));
});
```

A reader of `publish` now sees both halves of what publish requires. `Cond` is a
plain value (`authoring.ts:52-54`), so the shared condition is a local `const` in
the same block, named once and visible at both uses.

The cost is real and it is worth stating exactly. In the canonical JSON there is
no `const`: a foreign producer emits update's condition array twice, once inside
each permission. And the rewrite copies only the parent's allow conditions — it
does not reproduce the parent's `denyRules`, which the cascade did include,
because it read the parent's whole `Decision`. An author porting a `dependsOn`
whose parent carried denies has to copy those too, as denies on the child. That
is the sharpest argument for keeping the cascade, and § 4 is where it is
answered.

The federation page already takes this position for the cross-service case.
`README.md:750-752`: when one request touches two services "the fan-out is the
caller's own `&&` — `a.can(…).allowed && b.can(…).allowed` — written where
somebody knows whether they meant AND or OR." Decision 6 applies the same rule
inside one process.

## 4. The counter-argument, and the lint

The case for `dependsOn` is not weak. Granting `publish` to a subject who is
denied `update` is usually an authoring mistake, the cascade catches it for every
subject and every object without the author thinking about it, and it catches it
in one place rather than once per permission. Deleting it deletes that safety
net, and § 3 shows the replacement is a copied condition that can drift from the
thing it was copied from.

The owner's position is that this belongs in a lint over the matrix rather than
in a runtime deny path. I think that is right, and I think the lint should not be
specified here, for a reason worth writing down.

A lint has to know which implications the author intended. Nothing in a matrix
without `dependsOn` says that publish was meant to require update; the actions are
opaque strings (`authoring.ts:124`, and
`docs/superpowers/specs/2026-09-14-acl-design.md:546` — "action names, which stay
plain strings"). So a lint needs its own declaration of the pairs, and a
declaration that lives in the matrix is `dependsOn` again with the failure moved
from evaluation to build. Moving the failure is a genuine improvement, but it is
not a smaller feature, and shipping it in the same change as the removal would
mean the format never actually loses the member.

The form that is worth a document of its own, when somebody wants it: a
declaration outside the matrix — a lint config naming pairs — and a syntactic
subsumption check over the flattened rules. The builder already emits
disjunctive normal form (`authoring.ts:74-84`), so each side is a list of AND-ed
condition sets, and "every branch of publish's allow side contains at least one
branch of update's allow side as a subset" is a set comparison over condition
tuples, not a solver. It is conservative: it will report pairs that are in fact
fine, because two conditions that are semantically equivalent and textually
different do not compare equal. For a lint that is the right direction to be
wrong in.

Two reasons not to do it now beyond the one above. It has no user — nothing in
this repository declares a `dependsOn` outside a documentation example, so the
first real pair would also be the lint's first test case. And a check over
`denyRules` and over time conditions is a materially harder comparison than the
allow-side one, and the § 3 drift case is precisely the one involving denies.

## 5. `DuplicatePermissionError`, which nearly went with it

`buildGraph` does three things: it rejects duplicate keys (`graph.ts:28-30`), it
rejects unknown and cyclic dependencies (`:34-40`, `:64-70`), and it returns a
resolution order. Two of the three are about the cascade. The first is not.

Nothing else rejects a duplicate. `validateMatrix` does not — `validate.ts:376`
says "The dependency graph is validated separately by `buildGraph`", and that is
the whole of the deferral. `buildIndex` (`create-policy.ts:251-257`) is a
`Map.set` loop, so a duplicate key silently resolves to whichever permission
came last in the array. A matrix with two `article.publish` entries, one
restrictive and one permissive in the wrong order, would construct without
complaint.

So decision 5 moves the check into `validateMatrix`, keeps the error class and
its export, and keeps `errors.test.ts`'s case for it. This is the one place where
a mechanical deletion of `graph.ts` would have removed a guard that has nothing
to do with the cascade.

Two other things `buildGraph` supplied stay alive in changed form. `graph.order`
feeds `capabilities` (`create-policy.ts:454`), which becomes a map over
`frozen.permissions` in document order. And it feeds `buildReadsObject`
(`:325`), which decision 8 collapses.

## 6. The deny overlay

`docs/specs/2026-09-16-deny-overlay.md` decision 3 is the one that had to be
checked, and its § 2 derives it in two steps.

Step one: `sideOutcome` (`evaluate.ts:70-99`) is monotone in its rule array over
`fails < unevaluable < unusable-clock < matched`. That fold reads
`permission.denyRules` or `permission.rules` and the context. It does not read
`dependsOn`, the resolved map, or anything else. Removing the cascade does not
touch a line of it.

Step two: `decideResolved` reaches `allowed: true` on exactly one branch
(`:228-235`), and reaching it requires the deny side to be `fails`. Deleting step
2 removes one branch above that one. Removing a branch from a chain cannot make a
later branch reachable under conditions it was not already reachable under, and
every branch removed was `allowed: false`. The precondition on the allow branch
is unchanged.

That is the whole argument, and it stands. The spec's § 2 carries one extra
sentence for the cascade — "`dependsOn` reads `resolved.get(parent).allowed`, and
a parent that stayed true under the overlay blocks nothing it did not block
before" — which is a corollary of the base claim, not a premise of it. It is
deleted, and nothing above it changes.

**One behaviour does change, and it tightens the trust boundary.** Today an
overlay deny on a vetoable key also turns off every dependant of that key,
whether or not the owner listed the dependants. `applyDenyOverlay` appends only
to keys in `vetoable` (`deny-overlay.ts:111-124`), but step 2 of the precedence
order propagates the result. So `vetoable` understates the overlay's reach: an
owner who opens `article.update` has, without saying so, also handed compliance
the ability to turn off `article.publish`. The deny-overlay spec's § 3 calls
`vetoable` "the owner's whole statement of where another team may append", and
with the cascade in place that statement is not complete. After this change it
is: an overlay reaches exactly the keys the owner listed.

That is a strengthening, and it is also a capability loss for a compliance team
that was relying on the propagation. Anyone doing so must now list every key they
mean to reach. Nothing in the repository does — no matrix outside a documentation
example declares `dependsOn` at all — so this costs nothing today and is stated
here because it will not be obvious later.

## 7. Two factories, tested against the code

`policy()` is a facade over `createPolicy`. Every query member forwards:

```ts
can: (subject, key, action, object, now) =>
  access().can(bag(subject), key, action, maybeBag(object), now),
```

What it costs, counted: `Policy<Sub, R>` (`authoring.ts:196-231`) re-declares
nine `Access` members and adds two of its own; `ErasedPolicy` (`:360-395`)
declares the same nine a third time in erased form; the forwarding bodies are
`:449-483`; `BoundKind` (`:146-169`) is `Access.object`'s return declared in the
wrong file; `bag` and `maybeBag` (`:397-399`) are two casts that exist to undo
the typing on the way in. Together about 105 of `authoring.ts`'s 487 lines carry
no behaviour. The one member that is not a forward is `for()`.

The owner's read is that two capabilities are genuinely distinct — evaluating
JSON that arrives at runtime, and authoring with inference — and that only the
first needs an evaluator. The code agrees. `policy()` evaluates nothing;
`authoring.ts:428` is a `createPolicy` call behind a `??=`.

The question that had to be answered rather than assumed is whether
`createPolicy` can carry the types without the caller restating the object map.
It can. Compiled with TypeScript 6.0.3, `--strict`:

```ts
declare const brand: unique symbol;

interface TypedMatrix<Sub, R> extends Matrix {
  readonly [brand]?: { subject: Sub; objects: R };
}

declare function createPolicy<
  Sub = Record<string, unknown>,
  R = Record<string, Record<string, unknown>>,
>(matrix: Matrix | TypedMatrix<Sub, R>): Access<Sub, R>;
```

With `Access<Sub, R>` declaring
`can<K extends keyof R & string>(subject: Sub, key: K, action: string, object?: Partial<R[K]>)`,
`createPolicy(typedMatrix)` infers both parameters from the argument and nothing
is restated at the call site. An unknown object kind, a misspelled field on a
projection and an incomplete subject are each rejected, asserted with
`@ts-expect-error`. `createPolicy(foreignMatrix)` falls to the defaults, where
`keyof R & string` is `string` and `Partial<R[K]>` is `Partial<Record<string,
unknown>>` — which is today's untyped signature exactly, so the JSON path keeps
accepting any key and any bag. The file compiles clean.

The phantom member is optional and declared under a `unique symbol`, so it is
never present on a value. `JSON.stringify(access.matrix)` and the
`structuredClone` in `cloneNode` (`create-policy.ts:53-61`) see the same bytes
they see today.

This is also what closes the `authorize` gap. `Authorized<Sub, R>` is the same
two parameters applied to the bound handle, so the binding survives the member
that drops it today. Decision 13 does for free what
`2026-09-17-acl-partial-inputs.md` § 5 declined to take as its own change: "a
separate change with its own inference questions".

### What `for()` becomes

Today:

```ts
for(key, build) {
  const drafts: Draft[] = [];
  kinds.push([key, drafts]);
  build(blockBuilder(key, drafts));
  built = undefined;
  return self;
}
```

After both parts:

```ts
for(key, build) {
  const drafts: Draft[] = [];
  kinds.push([key, drafts]);
  build(blockBuilder(key, drafts));
  return self;
}
```

The `built` variable, the `access()` thunk and the `??=` go with it: nothing is
queryable until `matrix` is read, so there is no cached evaluator to invalidate.
Part A alone removes the stated reason for the invalidation; part B removes the
cache it invalidates.

### Taking one without the other

Part A alone: `policy()` keeps its facade and the `built = undefined` line stays,
because a query between two `.for()` calls would otherwise read a matrix missing
the later blocks. The comment above it has to change — the reason is no longer
`dependsOn`.

Part B alone: the cascade survives, and `for()` keeps neither the cache nor the
invalidation, because nothing is queryable mid-chain. Cross-block `dependsOn`
forward references keep working for the same reason — the matrix is built once,
at `.matrix`, after every block has run.

## 8. What changes outside the library

Nothing is published, so there is no consumer to migrate. The repository's own
surfaces:

**Demo apps: no change.** `apps/admin`, `apps/shop-api`, `apps/storefront` and
`apps/storefront-rsc` do not depend on `@evanion/acl`. The only consumer is
`apps/docs`, through `package.json`, `app/navigation.ts` and
`components/landing/access.ts`; none of the three names `dependsOn`, and the
landing matrix uses `createPolicy`. The `dependsOn` hits in `apps/admin` and
`apps/shop-api` `package.json`, in `nx.json` and in `tools/nx-astro` are Nx
target dependencies and are unrelated.

**`libs/acl/README.md`: 23 matched lines.** The "Dependency cascades" section
(`:510-553`) goes whole, including the `cascade` doctest region. `dependsOn` in
the `typed-authoring` region (`:430`) and the prose at `:443` and `:453-454` go.
So do the federation paragraph "dependsOn does not cross an origin"
(`:744-753`), the `readsObject` transitivity sentence (`:914`), the pitfalls
sentence (`:940`), the API table row (`:1068`), the `Reason` list (`:1082`) and
the decision-fields sentence (`:50`). For part B, the 9 `policy<` sites become
`createPolicy(policy<…>().for(…).matrix)`; the 17 `createPolicy(` sites are
unchanged.

**`apps/docs/content/acl/`: 74 matched lines across 18 of the 23 pages.** Three
pages transclude the deleted README region by name and break if it goes without
them — `intermediate.mdx:73`, `advanced.mdx:21`, `refusals.mdx:36`, each
`region=cascade`. `decisions.mdx` carries 21 of the 74, including the `Cause`
interface (`:20`), the reason-table row (`:77`), precedence step 2 (`:103`) and
a mermaid diagram of a three-permission chain (`:221-232`) that goes whole.
`advanced.mdx`'s lede promises "cascades, the schema, foreign documents" and
keeps the last two. `federation.mdx:74-80` loses its section. `api.mdx` loses
four type members and a `Reason` member. `refusals.mdx:34` loses a section and a
table row. For part B, 13 `policy<` occurrences across 11 pages change shape,
most of them inside transcluded README regions and so edited once at the source.

**Tests: 34 cases delete.** `graph.test.ts` entirely (7 cases, 81 lines);
`create-policy.test.ts` 8; `evaluate.test.ts` 3; `authoring.test.ts` 3;
`reads-object.test.ts` 3 (the transitive ones at `:124`, `:138`, `:151`);
`errors.test.ts` 2; `validate.test.ts` 1; `parse-matrix.test.ts` 1; and in
`security/tier1-prevented.test.ts` 6 — one in SEC-014, three in SEC-015, and two
of SEC-016's five, which leaves that block's title to change since the bound it
now states is over the matrix rather than over a cascade.

**`@evanion/react-acl`: no change for part A**, which is the same reason the deny
overlay spec gives — a policy is constructed where a React tree is not. Part B
reaches it only through the `Access` type its context holds, which gains
defaulted parameters and so keeps compiling unchanged.

## 9. The clock, and why it stays as it is

The question behind Part C was why an ACL has a clock at all. It has one for the
same reason every other authorization system does, and § 9.6 checks that against
the two systems with published grammars. What Part C actually proposed was
narrowing `Instant` (`types.ts:19`) from `string | number | Date` to
`Date | number`, on the reading that accepting a string is what created
`unusable-clock`. That reading does not survive the code.

### 9.1 The document has to carry a string, and that is not negotiable

`Condition` is a union, and its time arm carries the boundary as a document
value (`types.ts:57`):

```ts
| { field: 'now'; op: 'before' | 'after'; value: Instant }
```

The matrix is JSON. `createPolicy` clones it with `structuredClone` and freezes
it, `access.matrix` round-trips through `JSON.stringify`, and `parseMatrix`
adopts a document a producer in another language emitted. JSON has no date type,
so `value` on a serialized condition is a string or a number and can be nothing
else. A `Date` there is a value that exists for exactly as long as the object
lives in one process.

Narrowing to `Date | number` in the document therefore means requiring epoch
milliseconds. That is the constraint that sinks it. `apps/docs/content/acl/
matrix.mdx:53` and `README.md:1106` both write the boundary the way a person
writes a date:

```ts
{ field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' }
```

and § 9.6 has what a foreign producer emits for such a field by default.
Requiring a number would oblige every producer to write a converter to emit
epoch milliseconds where its own type system holds a date, and would oblige every
author to write `1767225600000` where they mean the first of January. The
federation story rests on a foreign producer writing the same document this
library writes, so a format choice that fights the producer's default serializer
is a cost paid by the party least able to see why.

So `string` stays in the document. The only question left is whether it is worth
narrowing the `now` a caller passes while the document keeps strings, which is
the split the brief allowed for.

### 9.2 The call-site narrowing deletes nothing

`unusable-clock` is not a consequence of accepting strings. `settleNow`
(`conditions.ts:41-46`) is the whole of it:

```ts
export function settleNow(now: Instant | null | undefined): number {
  return now === undefined
    ? Date.now()
    : now === null
      ? Number.NaN
      : toEpoch(now);
}
```

Four inputs settle to NaN, and its own doc comment lists them: "`null`, `NaN`, an
`Invalid Date`, a string that is not a date". The narrowing removes the fourth
and leaves the other three. `null` reaches NaN through `settleNow`'s own
signature, which takes `Instant | null | undefined` and will still take `null`.
`NaN` is a number, and `toEpoch` (`:13-17`) returns a number through unchanged.
`new Date('nonsense')` is an `Invalid Date` whose `getTime()` is NaN, and it is
still a `Date`.

The commit that built the deny path lists the same four in its own message.
`9c48e7a`, "fix(acl)!: refuse a decision whose clock does not parse": "a
time-gated deny goes on denying when the caller hands `can` a `null`, a `NaN`, an
`Invalid Date` or a string that is not a date." Three of the four survive Part C.

So nothing is deleted. `Reason` keeps `'unusable-clock'` (`types.ts:230`),
`ConditionOutcome` keeps `{ state: 'unusable-clock' }` (`:78`), `RuleOutcome` and
`SideOutcome` keep theirs (`evaluate.ts:22`, `:67`), and steps 4 and 7 of the
precedence order (`:201-210`, `:237-244`) stay exactly where they are. The
answer to the brief's first sub-question is that the narrowing buys strictly
less than hoped: it removes one of four ways into a state that remains.

**And the form it keeps has a hole the form it removes does not.** `toEpoch`
short-circuits on `typeof value === 'number'` and returns the number, so
`Infinity` settles to `Infinity` rather than to NaN. Run against the function as
written:

```
Infinity  -> Infinity   NaN? false
-Infinity -> -Infinity  NaN? false
NaN       -> NaN        NaN? true
```

`Infinity > boundary` is `true` for every boundary, so `can(subject, key, action,
object, Infinity)` makes every `after` condition hold and every `before`
condition fail, definitively and with no refusal. `-Infinity` does the reverse.
A string cannot do this: `toEpoch` parses it, and a string that does not parse
lands on `unusable-clock`. The number form is the one the engine trusts without
checking.

That is a gap in the current code, not in Part C, and it is the one thing this
investigation found worth changing. Hence decision 20: `settleNow` refuses a
non-finite number the way it refuses NaN. It is three characters of predicate
(`Number.isFinite`) in one function, it closes the hole for `Instant` as it
stands, and narrowing `Instant` would not have closed it — `Date | number` keeps
`number`.

### 9.3 And it costs two things

The first is that it reverts a decision made a day earlier for a stated reason.
`92eb2f4`, "feat(acl)!: take any instant for `now`, not only a `Date`", widened
every entry point from `Date` to `Instant` because "A context that crossed a JSON
boundary -- every SSR hydration payload -- was a legal condition value and a type
error as an argument, leaving each framework adapter to convert at the call
site." Narrowing to `Date | number` puts that conversion back in every adapter,
and the adapters are the surface `2026-09-14-acl-design.md` § "Consumption
shapes" exists to keep thin.

The second is in `libs/react-acl/src/index.tsx:48`, and it is not about types:

> A string or number `now` is compared by value in the hook memo keys, so a
> hydrated context does not re-evaluate on every render.

`Date` is compared by reference. Under the narrowing, a provider fed a hydrated
context either converts to a number at the call site or hands the hooks a fresh
`Date` whose identity changes every render, which is a memo that never hits. The
string form is load-bearing for the React binding's performance, not only for its
ergonomics.

`README.md:1093-1125`, the `clock` doctest region, is built end to end on this:
it hydrates `{ now: new Date(...) }` through `JSON.parse(JSON.stringify(...))`,
types the result `{ now: string }`, and passes it straight to `can`. The region
would have to be rewritten to demonstrate the conversion the narrowing
reintroduces, which is the opposite of what a quick-start region is for.

### 9.4 One thing to delete regardless

`evaluateResolved` guards the boundary a second time (`conditions.ts:163-164`):

```ts
const boundary = toEpoch(condition.value);
if (Number.isNaN(boundary)) return UNUSABLE_CLOCK;
```

Its comment says it is reachable "only through a condition that did not come from
a matrix". That is now no path at all. `validate.ts:145-150` refuses a
`before`/`after` boundary that does not parse; `assertCondition` is reached from
`assertRule`, from `assertRules`, from `validateMatrix` — and `assertRules` is
also what `applyDenyOverlay` calls on a contribution (`deny-overlay.ts:121`), so
an overlay's rules pass the same check. `evaluateCondition` is not exported
(`index.ts:9` names it among the internals that are not). Every rule array that
reaches the engine has had its boundary parsed at construction.

Decision 18 deletes the guard or corrects the comment. This is the one line Part
C was looking for, it is dead for a reason that has nothing to do with the string
form, and it is two lines rather than a feature.

### 9.5 A browser clock is the subject's clock

`now` in a browser comes from the machine the subject controls. Setting the
system clock back re-opens a window that has closed, and re-enables a grant the
author meant to expire. Nothing in the library can detect this, because the
clock is an argument.

The doctrine already covers the consequence: `@evanion/acl` in a browser toggles
element visibility and is never an access control, real enforcement happens in a
trusted environment, and every app in a chain evaluates for itself and trusts no
earlier layer. A server passing its own `now` into `can` is unaffected.

What is missing is that nobody has written it down. `apps/docs/content/acl/
security.mdx:119` discusses the clock only as a refusal — "it answers `{ allowed:
false, reason: 'unusable-clock' }`, so a deny gated on a" — and says nothing
about who supplies it. The distinction worth stating is between condition kinds:
a role condition reads the subject the server resolved, and a time condition
reads a value the browser produced, so the two are not equally trustworthy on the
same page even though both are advisory. Decision 19 adds that to
`acl/security.mdx` and to the README's clock section, and it is takeable with
none of the rest of this document.

### 9.6 What the two published grammars do

Time in authorization is not unusual and the feature is not in question. The
useful detail is how a policy that has to be serialized carries an instant.

**Both of them carry it as parseable text, and neither offers a number.**

Cedar has had `datetime` and `duration` since 4.3.0 behind a flag and by default
since 4.4.0 (RFC 80). Its runtime value is an i64 of epoch milliseconds, and that
value never appears in a policy: a literal is written
`datetime("2024-10-15T11:35:00Z")`, a constructor over a string the parser
consumes, and the accepted forms are the ISO 8601 ones. The validator goes
further and requires the argument to be a string literal —
"Constructor calls such as `datetime(context.time)` ... can _evaluate_ properly,
assuming `context.time` is a string of the accepted format, but will not
_validate_" (<https://docs.cedarpolicy.com/policies/syntax-operators.html>). So
even the context-supplied instant is a string on the wire.

XACML is more emphatic because it has no other option. An instant in a policy is
the lexical content of an `<AttributeValue>` with
`DataType="http://www.w3.org/2001/XMLSchema#dateTime"`, which is ISO 8601 text,
and ordering is delegated to XML Schema's order relation for that type. There is
no numeric epoch form anywhere in the specification
(<http://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html>, § 5.31,
§ 10.2.7, App. B.3).

Two more things transfer. Cedar rejected a built-in `currentTime()` on purpose —
RFC 80: it "is stateful, i.e. not pure, and cannot be modeled in SMT" — and has
applications pass the instant through `context`. That is the same argument this
library makes for `now` being a parameter rather than a call to `Date.now()`
inside a condition, and it is why the clock can be wrong without the engine being
able to tell. XACML § 7.3.6 settles the default the way `settleNow` does: "If a
value for one of these attributes is supplied in the decision request, then the
context handler SHALL use that value. Otherwise, the context handler SHALL supply
a value."

On the producer side, .NET is the case the federation story names.
`System.Text.Json` "parses and writes `DateTime` and `DateTimeOffset` values
according to the ISO 8601-1:2019 extended profile"
(<https://learn.microsoft.com/en-us/dotnet/standard/datetime/system-text-json-support>).
Epoch milliseconds is not a switch: the documentation's own epoch example is a
hand-written `JsonConverter` that still emits a string. Go's `time.Time` marshals
RFC 3339, and RFC 7493 (I-JSON) § 4.3 recommends ISO 8601 strings for exactly
this reason. The claim is not that no producer ever emits a number — raw Jackson
without `JavaTimeModule` registered emits epoch millis — but that a format
requiring a number puts every mainstream producer's default in the wrong, and the
one producer the federation design names in the wrongest position of all.

### 9.7 Where the clock is actually used

Counted over this tree. `@evanion/feature` uses time in six of its seven doc
pages, substantively in four — `api.mdx`, `build-time.mdx`, `configuration.mdx`
and `decisions.mdx` — which is what a rollout window is for and why the cascade
spec's own example (`2026-09-11-feature-toggles.md:41`) is a `before`.

`@evanion/acl` mentions the clock on seven of its 23 pages, but only three of
those carry a use rather than a type-surface or reason-table entry:
`matrix.mdx:53` (one condition in a document), `decisions.mdx:270-281` (the
prose the README `clock` region backs), and `authoring.mdx:31` (the
`p.before`/`p.after` table row). The other four — `api.mdx`, `pitfalls.mdx`,
`refusals.mdx`, `security.mdx` — name `Instant` or `unusable-clock` in a type
listing or a refusal table. No demo app uses either: `grep` for `Instant` and
`unusable-clock` across `apps/` matches nothing outside `apps/docs/content`.

That thinness is a fair argument that the clock is carrying less weight here than
in `feature`. It is not an argument for narrowing its type, because the narrowing
does not remove the feature — it removes the form of it that a hydrated context
arrives in, while leaving every line of engine code that the feature costs.

## 10. Which entry point is the main one

The owner's position is that `policy()` is the main API and `createPolicy` is
not. The documentation says the opposite, and the README's own regions are where
it says it: of 20 doctest regions, 12 construct with `createPolicy`, 7 with
`policy<`, and 1 with `parseMatrix`. `index.mdx:17` and `asking.mdx:7` lead with
`quick-start`; `simple.mdx:44` and `:69` lead with `capabilities` and
`server-authorize`. All three of those regions use `createPolicy`, so the first
constructor a reader meets is the one they will take as primary.

### 10.1 `build()`, and what it does to part B

Part B moved authoring out of `policy()` and left the call site as
`createPolicy(policy<S>().for(…).matrix)`. I flagged that as wordier than what it
replaced and left the question open. Decision 21 closes it: `policy()` gets a
terminal.

```ts
const access = policy<Subject>()
  .for<'comment', Comment>('comment', (p) => p.allow('update', …))
  .build();
```

`Policy<Sub, R>` is then `for`, `matrix` and `build`. That is not the facade part
B removed — the facade's cost was nine members re-declared in `Policy`
(`authoring.ts:196-231`), declared again in `ErasedPolicy` (`:360-395`) and
forwarded in bodies (`:449-483`). `build()` declares nothing and forwards
nothing; it calls the shared constructor once and returns its result.

Two things fall out. The wordiness objection goes, because the authoring path no
longer names a second function. And part B's decision 11 goes with it: the
phantom brand existed only to carry `Sub` and `R` across a standalone function's
parameter, and `build()` is a method on `Policy<Sub, R>`, which already holds
both. `TypedMatrix`, the `unique symbol` and the byte-identity argument for them
are not needed. That also retires the "where I am guessing" entry about the brand
surviving the toolchain, since there is no brand.

Decision 12 stays. `Access<Sub, R>` is still generic, because the document
entries have to return the untyped instantiation and because that is what closes
the `authorize` gap.

`.matrix` stays on the builder alongside `.build()`. A caller sometimes wants the
document without an evaluator: `applyDenyOverlay(matrix, overlay, …)` takes a
`Matrix` (`deny-overlay.ts:88-92`), so an owner overlaying a typed-authored
policy needs the document first.

### 10.2 The rename, and why `create` became wrong

`createPolicy` was an accurate name while it was the only constructor. After part
B it is not: `policy()` creates a policy, and `createPolicy` takes a document
that already exists and returns an evaluator over it. The name is stating the
wrong one of the two jobs, and it is stating it in the imperative the other
function has a better claim to.

`hydratePolicy` names the operation rather than the argument, and the operation
it names is the one the README already describes in the region that will carry
it. `README.md:295-313`, region `matrix-round-trip`, in its own comment:

```ts
// The server sends `access.matrix`; the client rebuilds from it.
const payload = JSON.parse(
  JSON.stringify(access.matrix),
) as typeof access.matrix;
createPolicy(payload).version; // -> 'orders@7'
```

That is hydration in the ordinary sense, and in the React sense a reader of
`@evanion/react-acl` already holds: server-built state reconstituted on the
client. The familiarity carries the meaning instead of fighting it, and it is the
sentence `next-rsc.mdx` and `react-router.mdx` want when they introduce the call
— both transclude that region (`next-rsc.mdx:123`, `react-router.mdx:153`), and
`next-rsc.mdx:118-121` already sets it up: "`Access` is a closure set over a
frozen document. It does not serialize ... It passes the document".

### 10.3 The federation objection, and why the pair resolves it

The objection is that a .NET service emits a matrix nothing dehydrated, so
"hydrate" is wrong on `federation.mdx`.

It holds, and it does not reach, because that page is not where the name lands.
`parseMatrix` already exists for exactly the foreign case and the README already
uses it there — `foreign-matrix` (`README.md:638-659`) is the one region built on
`parseMatrix`, and it is the region `adopting.mdx:9`, `advanced.mdx:83` and
`matrix.mdx:135` show. So the split decision 23 names is not invented for this
document; it is the split the regions already have, with one name on the wrong
side of it.

Stated as provenance rather than trust:

| Entry            | The document is           | Unknown key  |
| ---------------- | ------------------------- | ------------ |
| `policy().build` | one you are writing now   | throws       |
| `hydratePolicy`  | yours, arriving back      | throws       |
| `parseMatrix`    | somebody else's, arriving | fails closed |

The trust axis is still there and still decides `closed`
(`create-policy.ts:150-154`), and it now lines up with provenance rather than
cutting across it. A .NET producer's document reaches `parseMatrix`; a document
the server built and the browser is rebuilding reaches `hydratePolicy`. Neither
call is on the other's page.

The residue is decision 24. `hydratePolicy(applyDenyOverlay(matrix, …))` — the
pipeline `2026-09-16-deny-overlay.md` § 7 fixes — is a document the owner
composed in this process. Nothing was dehydrated and nothing is foreign. It takes
`hydratePolicy` because that is the open-mode entry, and there the name is wider
than its word. That is the mirror of the federation objection, it is smaller
because it is one region on one page, and inventing a third entry point for it
would cost more than the imprecision does.

One thing decision 23 does not do: collapse the two. It is tempting, because
`parseMatrix` is not a parser and not a second function. `parse-matrix.ts:21-26`
is the whole of it:

```ts
export function parseMatrix(
  matrix: Matrix,
  options: AccessOptions = {},
): Access {
  return createPolicy(matrix, { ...options, closed: true });
}
```

Five lines, one option flipped, and the caller does the `JSON.parse`. Collapsing
them to `hydratePolicy(doc, { closed: true })` would be defensible on those five
lines alone. It is refused because the default is the point: a foreign document
whose author forgot the flag would throw on an unknown key instead of failing
closed, and the open/closed pair is a deliberate decision in
`2026-09-14-acl-design.md` under "Unknown object or action". A preset that makes
the safe behaviour reachable without remembering a boolean earns five lines.

### 10.4 Every region and page that changes

Twelve of 20 regions. Seven switch factory, because the document in them is
scaffolding for an engine behaviour rather than the subject of the example:

| Region             | Pages showing it                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `quick-start`      | `index.mdx:17`, `asking.mdx:7`                                                                                     |
| `capabilities`     | `simple.mdx:44`, `capabilities.mdx:8`, `advanced.mdx:68`                                                           |
| `server-authorize` | `simple.mdx:69`, `asking.mdx:100`, `decisions.mdx:259`, `express.mdx:94`, `nestjs.mdx:229`, `react-router.mdx:141` |
| `can-many`         | `asking.mdx:73`                                                                                                    |
| `refetch`          | `refusals.mdx:69`                                                                                                  |
| `clock`            | `decisions.mdx:274`                                                                                                |
| `reads-object`     | README only                                                                                                        |

Four keep their document and take the rename: `matrix-round-trip`
(`adopting.mdx:78`, `advanced.mdx:102`, `matrix.mdx:81`, `next-rsc.mdx:123`,
`platforms.mdx:53`, `react-router.mdx:153`), `revalidate` (`advanced.mdx:112`),
`schema-binding` (`adopting.mdx:65`, `advanced.mdx:38`, `matrix.mdx:100`) and
`deny-overlay` (`federation.mdx:112`).

One switches to `parseMatrix`: `federation` (`federation.mdx:41`). It is the
genuinely foreign case and it is currently built on `createPolicy`, which is the
inconsistency that made the 12-to-7 split look like a recommendation.

`foreign-matrix` is unchanged, and so are the seven `policy<` regions
(`typed-authoring`, `typed-document`, `four-outcomes`, `field-permissions`,
`write-path`, `listing-bar`, `cascade` — the last of which part A deletes).

Prose outside the fences: `federation.mdx:109` and `:151` name `createPolicy`
directly, `:175` names `parseMatrix`, and the README's 17 `createPolicy`
occurrences and 9 `policy<` occurrences are the population to re-count after the
edit. Decision 25's page list — `adopting`, `matrix`, `federation`, `next-rsc`,
`react-router`, `platforms`, `advanced` — is seven rather than the three the
question assumed, and the four extra are the crossing pages, which is where
decision 22's name does its work.

### 10.5 The condition on the name

"Hydrate" is not a free word in this package. It is in use, for the clock, and it
carries a warning:

- `next-rsc.mdx:182` — "Resolve it on the server so the server render and its
  hydration agree — a `now` that reaches `can` from a client payload hands the
  client every time window in the matrix."
- `security.mdx:113-115` and `pitfalls.mdx:227` and `README.md:984-986` — "a
  hydration blob, a request body, a query" among the things `now` must not come
  from.
- `decisions.mdx:272`, `types.ts:12`, `types.ts:87`, `react-acl/README.md:96`,
  `react-acl/src/index.tsx:49` — "a hydrated SSR payload", "a hydrated context",
  "a hydrated instant".

The collision is not with React's sense of the word, which helps. It is that this
package's two rules under that verb point opposite ways: hydrating the _matrix_
from a client payload is fine, because the document is validated, frozen and
non-authoritative; hydrating the _clock_ from a client payload is the single
loudest hazard in these docs. `next-rsc.mdx` is where both land — the call at
`:123` and the warning at `:182`, 59 lines apart.

So decision 27. The six prose locations above say "a client payload" and "a
client-supplied instant" instead of "a hydration blob" and "its rehydration", and
the word is spent on the matrix alone. The code identifiers (`hydrated` as a
local in four test files and one README fence) are internal and can stay. This is
about six lines, it is on pages part D is already editing, and it is what makes
the name safe rather than merely apt.

### 10.6 Taking D on its own

D's API half — decisions 21 to 24 — needs part B. `build()` returns
`Access<Sub, R>`, and without B's decision 12 there is no generic `Access` for it
to return; it would have to hand back the untyped one and drop the types the
builder exists to provide, which is the `authorize` gap widened to every member.
Taking D without B is incoherent, and the spec should not pretend otherwise.

D's documentation half — decisions 25 to 27 — stands alone. Which page leads with
which entry point, and whether "hydration" means the clock or the matrix, are
decisions about the docs that hold whatever the API is called. If nothing else in
this document is taken, `index` and `simple` should still stop leading with the
constructor the owner does not consider primary.

## Testing

- The `Reason` union has no `dependency-off` member and the totality property
  (`totality.test.ts`) still covers every member, so the exhaustive switches stay
  exhaustive.
- A matrix carrying a `dependsOn` key is refused by `validateMatrix` as an
  unknown permission member, rather than ignored. A document written against the
  old format must fail loudly, not silently lose its deny.
- `DuplicatePermissionError` is raised by `validateMatrix`, asserted through
  `createPolicy` and through `parseMatrix`, with `graph.ts` gone. This is the
  regression decision 5 exists to prevent, so it is written before the deletion.
- The deny overlay's monotonicity property (200 seeded matrices) runs unchanged
  and still passes, with the generator no longer emitting `dependsOn`. The
  vacuity guard that counts what the generator reached has to be re-checked: it
  must still report allowed decisions that the overlay narrowed.
- `readsObject` answers per permission, and the three transitive cases are
  replaced by one asserting that a permission whose own rules read only the
  subject reads false whatever other permissions in the document do.
- Part B: `authoring.test-d.ts` asserts that `createPolicy(policy<S>().for(…)
.matrix)` refuses an unknown kind, a misspelled projection field and an
  incomplete subject, and that `authorize(...).can` carries the same checks —
  which is the gap, and the test that proves it closed.
- Part B: `JSON.stringify` of a branded matrix equals `JSON.stringify` of the
  same document built by hand, byte for byte. The phantom must not be
  observable.
- Part B: `createPolicy(parseMatrix(json))` accepts an arbitrary key and an
  arbitrary bag, compiled, so the foreign path is shown not to have narrowed.
- Part C, decision 18: with the boundary guard deleted, a matrix whose
  `before`/`after` value does not parse is still refused at construction, and an
  overlay contribution carrying one is still refused by `applyDenyOverlay`. The
  guard is dead only because those two hold, so the deletion is guarded by
  asserting them.
- Part C, decision 17: a test naming all four unusable inputs — `null`, `NaN`,
  `new Date('nonsense')` and an unparseable string — at one entry point, so the
  next person who proposes narrowing `Instant` meets the list rather than
  deriving it.
- Part D, decision 21: `policy<S>().for(…).build()` returns an `Access` whose
  `can`, `authorize(...).can` and `object(key).can` all refuse an unknown kind, a
  misspelled projection field and an incomplete subject, compiled. This replaces
  part B's brand test, which has nothing left to test.
- Part D, decision 23: `hydratePolicy` throws `UnknownPermissionError` on an
  unknown key and `parseMatrix` answers `unknown-action` for the same document,
  asserted side by side, so the one difference between them is the one the names
  claim.
- Part D, decision 26: no new guard. `tools/repo-checks/src/doc-regions.test.ts`
  already asserts that "every referenced file and region exists" (`:37`), so a
  region a page still points at after being renamed or removed fails the existing
  suite.
- Part C, decision 20: `Infinity` and `-Infinity` as `now` each refuse with
  `unusable-clock` at every entry point, on both the allow side and the deny
  side. This test fails against the tree as it stands, so it is written first and
  it is what the change is for.

## Where I am guessing

- That nobody wants the cascade back. It is the decision the owner has made and
  the evidence supports it, but the evidence is about readability and about one
  repository with no real `dependsOn` in it. A codebase with fifty permissions
  and a genuine action lattice is the case that would test this, and no such
  codebase exists yet to look at.
- That the subsumption lint in § 4 is tractable at the shape it needs to be. The
  allow-side comparison over DNF branches I am confident about. The denies and
  the time windows I have not worked through, and § 3's drift case is the one
  that involves denies, so the part I am least sure of is the part that matters
  most.
- On part C I am not guessing about the mechanism, and I am guessing about the
  appetite. § 9.7's count says the clock carries little weight in this package,
  and somebody who wanted to spend that observation could argue for dropping time
  conditions from the matrix altogether rather than narrowing their type. That is
  a larger question than the one asked, I have not costed it, and it would put
  the library out of step with both systems in § 9.6.
- That the seven regions decision 26 switches to `policy()` are the right seven.
  I drew the line at whether the example is about a document or about an engine
  behaviour, and `clock` and `schema-binding` are the two I could argue either
  way: both show a document-level feature through a constructor that is
  incidental to it.
- That `hydratePolicy` reads as well to somebody who has never used React as it
  does to somebody who has. § 10.2's argument leans on a familiarity a Node-only
  backend author may not hold, and for them the word is a metaphor about water.
  `parseMatrix` had no such dependency, and it is the entry point that keeps its
  name.
- That decision 27's six prose locations are all of them. I grepped `hydrat`
  across `apps/docs/content/acl`, `libs/acl` and `libs/react-acl` and read every
  hit, but the word carries its framework sense in from outside, and a reader
  arriving from a Next or React Router page brings that with them whatever this
  repository's prose says.
