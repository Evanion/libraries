# The compliance deny overlay

Status: implemented on `feat/acl`
Packages: `@evanion/acl`. No new package. Adds one exported function, two
exported types, two construction errors, and no change to any existing entry
point. `@evanion/react-acl` is untouched — an overlay is applied where a policy
is constructed, and that is never a React tree.
Depends on: `libs/acl/src/evaluate.ts` (`sideOutcome`'s monotonicity is the whole
soundness argument, § 2); `libs/acl/src/schema.ts` (`assertSchemaFit`, factored
into `assertRulesFit` so the overlay's conditions run through the same checker,
§ 4); `libs/acl/src/validate.ts` (`assertRules`, exported for the same reason);
`libs/acl/src/types.ts` (`Rule` being `{ id?, when? }` is what makes the design
sound — § 1); `docs/specs/2026-09-16-published-policy-contracts.md`, which is on
`spec/published-policy-contracts` and not on `feat/acl`: its § 12 names this
function and fixes the pipeline order, and its decision 11 depends on this
document existing. § 7 is that cross-reference from this side.
Prior art: Apollo Federation's composition step (`rover supergraph compose`) —
several teams contribute to one schema, and a composition run tells a contributor
whether its contribution is admissible before anything deploys. § 6 says what
transfers and what does not, which is almost all of it.

## The failure

A compliance team decides that payouts to a sanctioned region stop today. It does
not own `payments`, `orders` or `ledger`, and the deny has to land in all three.
Its options before this: open three pull requests against three repositories and
wait for three deploys, or put a check in a shared library and hope every service
calls it.

Both fail the same way. The compliance rule ends up as a copy per service,
authored by the team that owns the service rather than the team that owns the
rule, and the first time it changes, the copies diverge. That is the divergence
`2026-09-16-published-policy-contracts.md` describes in the other direction — a
consumer copying an owner's rules — and it has the same cure: the party that owns
the rule authors it once, and the parties that need it fetch it.

What makes this direction harder is that the rule has to outrank what the owning
service's own document says, and the owning service is the only party that may
enforce anything.

## Decisions

1. `applyDenyOverlay(matrix, overlay, { vetoable })` returns a new `Matrix`. It
   appends each overlay key's rules to that permission's `denyRules` and changes
   nothing else. Pure `Matrix -> Matrix`, so it composes with anything by
   ordinary function composition.
2. A contribution is `readonly Rule[]`. **Deny-only is enforced by the parameter
   type and by no check at all.** § 1.
3. **An overlay can only ever subtract.** `sideOutcome` is monotone in its rule
   array, and every branch a longer deny array can reach is `allowed: false`.
   § 2 derives it against the engine as written.
4. Three refusals, all at apply time, each naming the offending key: a key the
   target does not define (`UnknownPermissionError`), a key not in `vetoable`
   (`UnvetoablePermissionError`), and a condition that does not fit the target's
   schema for that key's object kind (`UnknownFieldError`,
   `FieldTypeMismatchError`). § 3.
5. **The schema obligation is scoped to the object kinds of the vetoable keys.**
   A vetoable key whose kind has no `schema.objects` entry is a refusal
   (`MissingVetoSchemaError`), checked whether or not the overlay touches that
   key. § 4.
6. The third refusal reuses `assertSchemaFit`'s checker rather than a second one.
   `schema.ts` gains an exported `assertRulesFit(schema, permission, where,
   rules)`; `assertSchemaFit` is now that function called twice. § 4.
7. The ordinary structural gate runs over the contribution too: `validate.ts`
   exports `assertRules`, and the overlay calls it with `where` of `overlay`. It
   is not a fourth refusal, it is the same gate the document already passes, run
   where the author can act on it. § 5.
8. **The intended second caller is the authoring party**, running the same
   function against the owner's published document in its own CI. Nothing in the
   implementation reads private state or requires the full authored matrix. § 6.
9. `version` is carried through unchanged. The publishing party composes the
   effective version; this function knows no name for the overlay and invents
   none. § 7.
10. Nothing leaks into the simple path. `createPolicy(matrix)` takes no overlay,
    no `vetoable` list and no schema, and the overlay lives in its own module
    behind its own export. § 8.

Decision 5 is the one to argue with. Decision 2 is the one everything else rests
on, and decision 3 is the one that had to be checked against the code rather than
asserted.

## 1. Deny-only is the shape, not a rule

```ts
type DenyOverlay = Readonly<Record<string, readonly Rule[]>>;
```

`Rule` in `libs/acl/src/types.ts` is:

```ts
interface Rule {
  id?: string;
  when?: readonly Condition[];
}
```

Everything a contribution must not be able to say lives somewhere else.
`dependsOn` and `fields` are fields of `Permission`, not of `Rule`. An allow rule
is not a different kind of rule — it is the same `Rule` in a different array, and
the parameter type names only one array. `version` and `schema` are envelope
members the overlay has no channel to reach.

So there is no prohibited construction to detect and reject, because the type
system has already declined to parse one. This matters more than the usual
type-safety argument, because the party writing the overlay is by construction a
party the owner does not fully trust — that is what makes it an overlay rather
than a pull request. A check can be bypassed by a producer emitting JSON in
another language, or be forgotten in one of the paths that build a contribution.
A shape that cannot express the thing has neither failure mode: the JSON a
foreign producer emits either parses as a rule array or does not reach the
function at all.

The runtime consequence is stated once, in `deny-overlay.ts`, and is worth
repeating here because a future contributor's instinct will be to add the check:
there is nothing to check. Adding `if (contribution.rules)` would be dead code
against a type with no such member.

## 2. Only subtracting, derived from the engine as written

The claim is that for any matrix `M`, overlay `O`, subject, object and instant,
if `applyDenyOverlay(M, O, …)` decides `allowed: true` then `M` decides
`allowed: true` for the same inputs.

`sideOutcome` in `libs/acl/src/evaluate.ts` folds a rule array into one of four
states. Reading the fold: a `matched` returns immediately; otherwise it records
the first `unusable-clock` rule, unions the `unevaluable` paths, and returns
`unusable-clock` before `unevaluable` before `fails`. So the four states are
ordered

```
fails  <  unevaluable  <  unusable-clock  <  matched
```

and appending rules to the array can only move the result up this order. Nothing
in the fold can un-match a match, un-unusable a clock, or discard a recorded
`missing` path, because every branch is an accumulate-or-return and none of them
removes.

`decideResolved` reaches `allowed: true` on exactly one line: the
`allow.state === 'matched'` branch. Reading the precedence order above it, that
branch is reached only when `deny.state` is neither `matched` (step 1), nor
`unusable-clock` (step 4), nor `unevaluable` (step 5) — that is, only when the
deny side is `fails`, the bottom of the order. `fails` after appending implies
`fails` before appending, by monotonicity. The allow side, `dependsOn` and the
resolved-parent map are untouched by the overlay, so the same allow rule matches.
Therefore the authored matrix reached the same branch and decided `allowed:
true`.

The cascade follows: `dependsOn` reads `resolved.get(parent).allowed`, and a
parent that stayed true under the overlay blocks nothing it did not block before.

Two consequences worth stating, because both look like regressions and neither
is:

- An overlay deny the engine cannot evaluate refuses. Steps 4 and 5 sit above
  step 6, so a veto whose object path the caller did not fetch lands on
  `unevaluable` with `allowed: false` rather than handing out the grant. That is
  the precedence the engine already had, and it is the direction a veto has to
  fail in.
- An overlay can turn an object-independent permission into one that reads the
  object. `readsObject` counts deny rules, so a permission that decided without a
  row starts reporting that it needs one. A caller that honours `readsObject`
  handles this; one that ignores it gets `unevaluable`, which is still a refusal.

## 3. The refusals, and why all three are at apply time

The alternative is to let a bad overlay through and let `createPolicy` refuse the
result. Two things are wrong with that.

The error would name a position inside a permission — `denyRules[3].when[0]` —
and the author of the overlay wrote no permission and no `denyRules`. The
position is a fact about the merged document, and the merged document is not an
artifact either party edits. Refusing at apply time lets the error say
`overlay[0].when[0]`, which is a position in the file the author has open.

The second is decision 8. The compliance team has the overlay and the owner's
published document; it does not have the owner's `createPolicy` call, and running
one is not something it can be asked to simulate. The refusals have to live in
the function both parties call.

Refusal (2) is the one that carries the trust boundary. `vetoable` is the owner's
whole statement of where another team may append, and a key outside it is a
permission whose owner has said nothing. There is no default: an empty `vetoable`
refuses every contribution, and a matrix that names no extension point cannot be
overlaid at all.

## 4. The schema obligation, and why it is scoped

Refusal (3) is the one that makes the overlay useful rather than merely safe.
Without it, `{ field: 'object.riskBand', op: 'eq', value: 'high' }` against a
kind with no `riskBand` is accepted, and every decision it touches lands on
`unevaluable` forever — a deny that never denies, reported as a refusal the
caller is told to repair by refetching a field that does not exist. That is the
typo class `UnknownFieldError` exists for, and it is worse here than in a local
document, because the party who made the typo is not the party who reads the
logs.

The checker is not written twice. `schema.ts` had one loop over
`['rules', 'denyRules']` calling `assertConditionFits`; that inner body is now
`assertRulesFit(schema, permission, where, rules)`, exported, and
`assertSchemaFit` is two calls to it. The overlay passes `'overlay'` as `where`
and gets the same `UnknownFieldError` and `FieldTypeMismatchError` a document
would, located in the overlay. One rule, one implementation, and a future change
to what a schema checks reaches both callers.

### Scoped, and why that is load-bearing

`MatrixSchema` is optional. Most matrices in this repository's examples carry
none, and `lookupPath` answers `unchecked` for a kind the schema does not
declare — which would make refusal (3) silently vacuous for exactly the matrices
that most need it.

The fix is not to require a schema of every matrix. That would put the cost of
this feature on every single-service consumer that will never see an overlay, and
`createPolicy(matrix)` would start refusing documents it accepts today. The
constraint the owner set was explicit: as long as it does not complicate simpler
setups, a vetoable selector is fine.

So the obligation attaches to the act of opening an extension point. Listing a
key in `vetoable` is what obliges the matrix to declare that key's object kind,
and a matrix that lists nothing owes nothing. A service with no overlay never
calls the function and never learns the rule exists.

The check runs over every vetoable key, not only the ones the overlay reaches.
Checking only the reached ones would mean a matrix could open a key with no
declared kind and pass, until the day compliance first writes a rule for it — and
that day is a deploy of compliance's document, not of the owner's, so the
owner would find out about its own omission from someone else's release.

### What this does not cover

`schema.subject` is not part of the obligation, and a compliance deny is very
likely to read `subject.*`. With no `schema.subject`, `lookupPath` answers
`unchecked` for every subject path and refusal (3) checks nothing about the half
of the condition most likely to carry the typo.

This follows the design as settled — the obligation is stated over object kinds —
and it is a real hole. The narrow fix is to include `schema.subject` in the
obligation whenever a vetoable key exists. The reason not to do it here is that
`subject` is one declaration for the whole document rather than one per key, so
requiring it is not scoped the way decision 5 is: it is a document-wide
obligation triggered by opening one key. That is a different decision from the
one that was settled, and it belongs in its own change.

## 5. The structural gate, which is not a fourth refusal

`validateMatrix` refuses a rule with no `when`, a condition with an unknown `op`,
a `path` on an operator that compares against a literal, and a dozen other
things. An overlay that carries one of those would be refused by the owner's
`createPolicy` — which is decision 8's problem again: it is refused in the wrong
process, on the wrong day, against a position the author did not write.

So `assertRules` is exported from `validate.ts` and the overlay calls it. This is
not a new rule and not a new error class. It is the gate every rule array in this
library already passes, moved to the first moment the offending array is in
hand.

The ordering inside the function matters and is the same ordering
`validateMatrix` uses: structural before semantic. A contribution whose condition
has no readable `field` is reported as that rather than as a schema fault.

## 6. Apollo Federation, and what survives the crossing

The analogy is real and it is small.

What transfers: a contributor can find out whether its contribution is admissible
without the owner deploying anything. `rover supergraph compose` run in a
subgraph team's CI answers "would this break composition" as a local computation
over published artifacts. `applyDenyOverlay(ordersContract, myOverlay, {
vetoable })` in compliance's CI answers the same question — is every key real, is
every key open to me, does every condition fit the declared shape — and it
answers it the same way, as a pure function over documents the other party
published. That symmetry is the whole quality story, and it is what decision 8
protects.

Everything else does not transfer, and the differences are not details.

Federation composes N subgraph schemas into one supergraph, and the supergraph is
what serves traffic. Here there is no composed artifact and no shared runtime.
The result of `applyDenyOverlay` is the owner's matrix, in the owner's process,
which the owner alone evaluates. Compliance's copy of the computation is a lint
run whose output is discarded; nothing it produces is deployed anywhere.

Federation's composition runs in a central pipeline and its output is
authoritative for everyone. The overlay is applied N times, once per owning
service, and each owner decides independently whether to fetch the overlay at
all. A compliance team cannot make a service apply its rules, which is correct:
the enforcing party is the deciding party, and a design where compliance could
inject a deny into a process that did not ask for it is a design where compliance
can take that service down.

Federation contributions are additive in both directions — a subgraph adds types
and fields, and the supergraph serves more than any one subgraph did. An overlay
contribution is monotone in one direction only (§ 2), and that asymmetry is what
makes it safe to accept from a party the owner does not fully trust. There is no
federation analogue, because there is no federation operation that can only
remove capability.

The library's existing doctrine is unchanged by all of this, and
`apps/docs/content/acl/federation.mdx` says so: nothing merges at an edge, every
layer decides for itself, and a gateway holds a map rather than a merge.

## 7. Where this sits in the publishing pipeline

`docs/specs/2026-09-16-published-policy-contracts.md` § 12 fixes the order:

```
authored matrix -> applyDenyOverlay -> serialize(reduced) -> contract
```

Serializing before applying publishes a contract with the vetoes omitted. A veto
is a deny rule, so omitting one is removing a refusal, which is § 6 of that
document's unsound direction — the published contract would allow what the owner
refuses, for exactly the permissions compliance cared most about. Consumers would
render the button, press it, and get a refusal from the owner, which is the
divergence both documents exist to remove.

That document carries the ordering in its types: `serialize` takes an `Access`,
and the only `Access` in a publishing path is the one built from the overlaid
matrix. Nothing in this document is needed to enforce it. What this document
owes the other one is that `applyDenyOverlay` returns a `Matrix` and not
something else, so `createPolicy` can be the next step.

That specification is on the `spec/published-policy-contracts` branch and not on
`feat/acl`, so nothing in it is built yet. This document does not depend on it
being built — the overlay is useful to a service that publishes no contract at
all — and the only thing that lands with it is `serialize`.

### Version

`applyDenyOverlay` carries `version` through unchanged. It has no name for the
overlay it applied, and inventing one — a hash of the contribution, a counter —
would be this function deciding a naming scheme for an artifact it did not
fetch and cannot see the provenance of.

The publishing party composes the effective version, and `AccessOptions.version`
already exists for it and already documents this exact case: "a compliance deny
overlay merged in before construction gives an effective version covering both
inputs, and the authored document cannot know about it". So
`createPolicy(applyDenyOverlay(…), { version: 'payments@7+veto@41' })` is the
whole mechanism, and it was already there.

## 8. The simple path, checked rather than asserted

The owner's constraint was that a vetoable selector is fine as long as it does
not complicate simpler setups. Concretely, after this change:

- `createPolicy(matrix)` has the same signature and the same behaviour. It takes
  no overlay and no `vetoable`, and it refuses no document it accepted before.
- `parseMatrix` is untouched.
- `Matrix`, `Permission` and `Rule` gain no members. A document written before
  this change is the same document after it, and `vetoable` is not a field on
  anything — it is an argument to one function.
- The schema obligation is reachable only through `applyDenyOverlay`. A consumer
  that never calls it can never be refused for not declaring a kind.
- `@evanion/react-acl` gains nothing and re-exports nothing new. An overlay is
  applied where a policy is constructed, which is a server or a module scope,
  never a React tree.

The whole surface is one function and two types in one new module, plus two error
classes. A reader of the quick start meets none of it.

## Testing

- Each of the three refusals, asserted on both the error class and the message
  naming the key.
- The scoped obligation: a vetoable key with no declared kind refuses; a kind no
  vetoable key names is not owed; a matrix that opens nothing owes nothing and
  applies an empty overlay without error.
- A contribution is checked against the kind its key names and not another,
  distinguished by a fixture where the two kinds declare different fields.
- A valid overlay narrows: a subject who could, now cannot, with the full
  `Decision` asserted including the overlay's own rule id.
- The contribution is appended to the target's own `denyRules` rather than
  replacing them, and the input matrix is not mutated.
- An overlay deny that cannot be evaluated refuses, reporting `unevaluable` with
  the deny rule named and the missing path listed.
- The result round-trips through JSON unchanged, constructs, and the resulting
  `access` answers.
- The authoring party's use: the same call against a published subset carrying
  only the vetoable keys and their schema entries, refusing the same mistake.
- Monotonicity as a property over 200 seeded matrices, overlays and context sets:
  no decision moves from `allowed: false` to `allowed: true`.
- An overlay that matches nothing leaves every decision identical, over the same
  generated matrices and contexts rather than one case.
- Both properties are guarded against being vacuous by a test that counts what
  the generator actually reached: how many extension points were opened, how many
  decisions were allowed before the overlay, and how many of those the overlay
  narrowed.

The refusals and the monotonicity property are mutation-proven: removing each
check in turn, and appending the contribution to the allow side or having it
replace the target's own deny rules, each fails the suite.

## Where I am guessing

- That `subject.*` conditions being unchecked (§ 4) is tolerable for the first
  version. It is the path a compliance rule is most likely to read, and the
  argument for leaving it is about the shape of the obligation rather than about
  the size of the hole. If the first real overlay is written against `subject.*`
  and has a typo in it, this was the wrong call.
- That `vetoable` as a flat key list is the right granularity. Every alternative
  I considered — a per-key list of allowed authorities, a per-object-kind opening,
  a predicate — buys something and costs a concept, and none of them is needed
  until there is more than one authority publishing overlays. A second authority
  is what makes this question real, and there is not one yet.
- That the overlay is fetched and applied at construction rather than
  continuously. A veto lands on the owner when the owner next rebuilds its
  `Access`, and how often that is, is the owner's business. § 13 of
  `2026-09-16-published-policy-contracts.md` thinks about the consumer-side
  latency of exactly this and concludes it is a UI-correctness gap rather than a
  hole; the owner-side gap between compliance publishing and the owner rebuilding
  has had no such argument written for it, and it is the one that is actually a
  security question.
- That nobody wants to know which rules came from the overlay after the fact. The
  result is an ordinary `Matrix` with no provenance marker, so a `Decision`
  naming rule `sanctions-hold` is distinguishable only by the id the author
  chose. An operator debugging a refusal may well want the document to say. Adding
  it means a member on `Rule`, which is a change to the format every producer
  emits, so it is not a small addition.
- That appending after the target's own deny rules is the right position. The
  sides are OR-ed, so order does not change any decision — it changes only which
  rule id a matched deny reports when both would match. Reporting the owner's own
  rule first seemed right; an operator chasing a compliance hold might disagree.
