# Published policy contracts

Status: proposed
Packages: `@evanion/acl`. No new package. Adds two fields to `Permission` and
`Matrix` (`visibility`, `maxStale`), one serialization entry point, three
construction errors, one `Reason` member and two `AccessOptions` fields.
`@evanion/react-acl` re-exports the types and changes no runtime.
Depends on: `docs/superpowers/specs/2026-09-14-acl-design.md` (on `feat/acl`, not on
`main`) — its matrix format, the seven-step precedence order, the
read-axis-is-not-a-security-boundary rule and the no-transitive-trust doctrine are
load-bearing here; `libs/acl/src/hydrate-policy.ts`, `evaluate.ts`, `fields.ts`,
`validate.ts`, `types.ts` (same branch); `docs/specs/2026-09-17-acl-no-cascade.md`,
which deleted `dependsOn` and the cascade and shortened § 6's proof to a paragraph;
`docs/specs/2026-09-16-deny-overlay.md`, whose `applyDenyOverlay` is the step before
serialization (§ 10) and whose compliance CI check is what § 11 answers;
`docs/specs/2026-09-16-framework-adapters.md` (on `docs/framework-adapters`, not on
`main`) — its § 7 decides that data crosses a transport and an `Access` does not,
which is the crossing this document publishes over;
`docs/specs/2026-09-17-acl-federated-policies.md` (on `specs/acl-federated-policies`,
not on `feat/acl`), whose `OriginCollisionError` is what § 12 answers.
Supersedes: the acl design's Acquisition paragraph, which fails closed on a version
mismatch. Decisions 13 to 15 replace that with a bounded freshness budget, and § 13 is
the argument.
Prior art: OpenAPI and protobuf descriptors — a service publishes the shape of what it
answers and consumers compile against it, versioned like any other release artifact.
GraphQL federation is **not** prior art here and this is not federation: no gateway
merges the contracts, no composed supergraph exists, and no query is planned across
origins. Every origin's contract stays a separate document a consumer evaluates
separately.

## The failure

A BFF in front of an orders service needs to know whether to render a refund button.
It has three options today: call the orders service per render, guess, or write its
own permission matrix for orders. It writes its own matrix. That matrix is a second
copy of somebody else's rules, maintained by a team that does not own them, and it
diverges on the first rule change nobody thinks to propagate.

Divergence in this direction is quiet. The orders service keeps refusing correctly, so
nothing is breached and no alert fires. What breaks is that the BFF hides a button the
orders service would have allowed, or shows one it refuses, and both failures look
like a UI bug in a different team's backlog forever.

The fix is that the orders service owns its rules and hands them to its consumers as
an artifact, so there is one definition. Co-ownership of a subset — compliance owning
the deny rules, the service owning the rest — falls out of the same shape, and
`applyDenyOverlay` already builds it.

## Decisions

1. A service publishes a **policy contract**: the reduced serialization of its own
   matrix. A contract is a matrix. It parses with `parseMatrix`, evaluates with the
   same engine, and carries no new runtime. Each origin publishes one. A consumer
   holds several, one per origin it must answer questions about, and evaluates each
   against its own subject. Nothing merges them.
2. Visibility is a field on `Permission`:
   `visibility?: 'public' | 'internal'`. § 3 records the trade against an external
   key list and why it is accepted.
3. **An absent `visibility` is `internal`.** An older matrix, a producer that does not
   emit the field, and an author who forgot all fail to publish. § 4.
4. Serialization takes a mode. `full` emits the authored document with `visibility`
   intact. `reduced` emits the contract: public permissions only, with `visibility`
   stripped from each. § 5 is why the reduced form strips it.
5. **The correctness property is equality.** For every subject, object and instant, a
   contract's decision for a public key equals the owner's decision for that key,
   `Decision` fields and `FieldDecision` maps included. A contract that answers more
   conservatively is still a second copy that diverges. § 6.
6. **A projection may remove what grants and must preserve what refuses.** § 7 derives
   it from `sideOutcome`'s monotonicity.
7. **Reduction removes whole permissions and never edits one.** A permission's
   `denyRules`, write-axis field configs and read-axis name list all ship verbatim or
   the permission does not ship. A permission whose deny rules read an internal
   concept is therefore unpublishable as written; the owner discloses the concept or
   keeps the permission internal. § 7.
8. **Evaluation is always local, at every tier.** A consumer fetches contracts on an
   interval and never calls another service to decide anything. The record of decisions
   `capabilities()` returns is per subject and is therefore a fetch per user per origin;
   it is not a publishable artifact and no fallback uses one. § 8.
9. **An internal key at a consumer is a dead end.** It answers
   `{ allowed: false, reason: 'unknown-action' }` under `closed: true` and keeps
   answering that. The remedy for a consumer that needs it is that the owner marks it
   public and cuts a release. § 8.
10. The pipeline is authored matrix, then `applyDenyOverlay`, then `hydratePolicy`,
    then `serialize(access, 'reduced')`. **One `Access` per publishing process holds
    the order**, and the type system holds nothing beyond the contract matching that
    `Access`. § 10 is the argument and § 10's release gate is what covers the rest.
11. **A vetoable key is published.** `serialize` in reduced mode takes the target's
    `vetoable` list and refuses a listed key that is internal, with
    `UnpublishedVetoableError`. `deny-overlay.ts:78-82` promises a compliance team a
    contract it can check its contribution against, and an internal vetoable key
    breaks that promise. § 11.
12. **Keys ship verbatim and the contract format adds no namespace.** A namespaced
    key is spelled `orders:invoice.read`, the namespace lives in the authored
    `object`, and `validate.ts` already fixes that spelling. § 12.
13. A consumer serves the contract it holds inside a **freshness budget**: `maxStale`,
    a duration in milliseconds the owner sets and the contract carries, measured from
    the last successful freshness validation, which the consumer reports as
    `fetchedAt`. Inside the budget every decision answers normally, including while a
    refetch is in flight. Past it every decision answers
    `{ allowed: false, reason: 'stale-contract' }`. A consumer that passes no
    `fetchedAt` makes no freshness claim and no budget applies. A consumer that passes
    one against a document carrying no `maxStale` is a construction error,
    `MissingFreshnessBudgetError`. § 13.
14. `Reason` gains `'stale-contract'`, alongside the six members the engine emits
    today:
    ```ts
    type Reason =
      | 'allow'
      | 'no-rule-matched'
      | 'denied'
      | 'unknown-action'
      | 'unevaluable'
      | 'unusable-clock'
      | 'stale-contract';
    ```
    Both packages are `private: true`, so it lands before the first publish. § 13.
15. There is one staleness bound, and no tighter second one for compliance vetoes.
    § 13 is why, and what makes veto-speed revalidation affordable.
16. A reduced envelope keeps its `schema` entries for exactly the object kinds its
    published permissions name, whole, and drops the rest. § 9.
17. Three release gates on the publishing repo: a differential equality check (§ 14),
    a snapshot of the published key list (§ 3), and an assertion that the published
    version names every input the process composed (§ 10).

## 1. What a contract is

`libs/acl/src/hydrate-policy.ts` builds an `Access` out of closures, and
`docs/specs/2026-09-16-framework-adapters.md` § 7 already settles that an `Access` does
not cross a transport — `structuredClone` throws on the functions and `JSON.stringify`
silently drops every method. Data crosses. A contract is that data, narrowed:

```ts
const contract = serialize(access, 'reduced'); // a Matrix, JSON by construction
```

A consumer adopts it the way it adopts any foreign matrix:

```ts
const orders = parseMatrix(contract, { fetchedAt: Date.now() });
orders.can(subject, 'refund', 'approve', order);
```

`parseMatrix` sets `closed: true` (`libs/acl/src/parse-matrix.ts`), so a key the
contract does not carry answers `unknown-action` without throwing. That is the
behaviour decision 9 depends on, and it already exists.

## 2. Ownership, without a gateway

Each origin's contract is a separate document evaluated separately. There is no merge
step, no composed model and no planner, and adding one would recreate the failure: a
merged supergraph is a single artifact nobody owns whose contents come from several
teams, which is the second copy under a nicer name.

The doctrine the acl design already states holds unchanged: every layer evaluates its
own copy and no layer trusts an earlier one. A BFF that consulted a contract and
allowed a call does not excuse the orders service from deciding again on its own
matrix. The contract removes the second _definition_ and leaves the second
_evaluation_ standing, which is what it must do.

## 3. Visibility is a flag on the permission

```ts
export interface Permission {
  key: string;
  object: ObjectKey;
  action: Action;
  rules?: readonly Rule[];
  denyRules?: readonly Rule[];
  fields?: FieldRules;
  /** Whether this permission ships in a reduced serialization. Absent is internal. */
  visibility?: 'public' | 'internal';
}
```

The marking sits where the thing being marked sits, so an author deciding a
permission's rules decides its audience in the same edit, and a reviewer reading a
permission sees both.

### The accepted trade

An external selector — `serialize(access, { public: ['invoice.approve', …] })` — was
argued for and is not what ships. Two objections to the flag stand, are accepted, and
are recorded here so they are not re-argued:

**The flag is dead data in the artifact.** Everything in a contract is public by
definition, so a consumer reading `visibility: 'public'` learns nothing from it.
Decision 4 answers this directly: the reduced form strips the field. The full form
keeps it, because the full form is the authored document and a matrix that lost its
marking on a `full` round trip would come back unmarked, which decision 3 reads as
internal — a silent un-publish on every round trip. So `full` must keep it and
`reduced` must not.

Stripping has one consequence worth stating: a contract is a terminal artifact. A
consumer that holds one cannot re-publish it, because every permission in it arrives
unmarked and decision 3 reads unmarked as internal, so its reduced serialization is
empty. Re-publishing someone else's rules is the failure in the first place, so an
empty result is the right answer, reached by a mechanical route and not by a
prohibition.

**Visibility gets reviewed in N places.** Across a matrix of two hundred permissions,
a security reviewer asking "what do we expose" reads two hundred scattered fields, and
a diff that changes one of them is one line inside a permission whose rule edits
surround it. A selector puts the whole answer in one file whose entire diff is the
published surface.

This is the stronger objection and the flag does not answer it. Decision 17 mitigates
it: a committed snapshot of the published key list, asserted by a test, produces
exactly the one-file diff the selector would have. A change to any permission's
`visibility` shows up as a line added or removed in that snapshot, and a reviewer
reads the snapshot diff in place of the matrix diff. The snapshot is generated, so it
cannot drift from the marking; it is a review surface and never a second source of
truth. Without it, the review objection stands unmitigated, which is why it is a gate
and not a suggestion.

One asymmetry remains and has no mitigation. A foreign matrix reaching
`parseMatrix` from a non-JS producer carries no `visibility` field unless that producer
emits one, so a .NET service that wants to publish has to change its emitter. Under a
selector the publishing side could name the keys without the producer's cooperation.
The behaviour is correct — an unmarked matrix publishes nothing — and it is a real cost
to a polyglot backend.

## 4. Unmarked is internal

Fail-closed on forgetting is the entire reason the marking exists. An author who marks
nothing publishes nothing and notices; an author whose omission defaulted to public
would publish a permission whose deny rules name an internal tier and would not notice
until somebody read the artifact.

This also settles what happens to every matrix authored before the field exists, and to
`policy()` in `libs/acl/src/authoring.ts`, which does not set it: nothing publishes
until somebody says so.

## 5. Serialization

```ts
type SerializeMode = 'full' | 'reduced';

interface SerializeOptions {
  /** The target's vetoable keys, as `applyDenyOverlay` took them. § 11. */
  readonly vetoable?: readonly string[];
}

function serialize<Sub, R>(access: Access<Sub, R>, mode: 'full'): Matrix;
function serialize<Sub, R>(
  access: Access<Sub, R>,
  mode: 'reduced',
  options?: SerializeOptions,
): Matrix;
```

`full` emits `access.matrix` as it stands — the authored document, `visibility`
included, round-tripping losslessly through `parseMatrix`.

`reduced` emits the contract:

- keep a permission when `visibility === 'public'`, drop it otherwise
- delete `visibility` from every kept permission
- keep everything else on a kept permission byte for byte
- carry the envelope's `version` and `maxStale`, and its `schema` entries per
  decision 16
- throw `UnpublishedVetoableError` when `options.vetoable` names a dropped key

`serialize` reads `access.matrix`, which is already a deep-frozen `structuredClone`
(`hydrate-policy.ts`), so it copies out of a value nothing can have mutated since
construction.

## 6. The equality property

For every subject, object and instant, and for every key the contract carries:

```
contractAccess.can(subject, key, action, object, now)
  ≡ ownerAccess.can(subject, key, action, object, now)
```

and the same for `canFields` on both axes, field by field, reason by reason.
`Decision` equality includes `reason`, `rule` and `missing`, because a consumer
renders on those: a `missing` that named a path in the owner and nothing in the
contract would leave a UI with no refetch to make.

Equality, and no weaker property. A consumer that answers conservatively is still a
second copy that diverges from the owner, and it produces exactly the failure in § 1: a
button hidden forever against a server that would have allowed the call, with no error
anywhere to notice. A permission that is off by being conservative is
indistinguishable, from inside the consumer, from a permission that is off because the
rules say so.

The proof is one paragraph since `docs/specs/2026-09-17-acl-no-cascade.md` deleted the
cascade. `hydratePolicy` resolves a call to one permission through `index.get`, and
`decideResolved` reads that permission and the settled context. One permission's
decision is a function of that permission and of nothing else in the matrix. So
removing other permissions cannot change it, which is what decision 7 guarantees
reduction does. `capabilities()` maps over `frozen.permissions` and decides each one
the same way, so the contract's record is a subset of the owner's, carrying the public
keys with identical values.

## 7. Remove what grants, preserve what refuses

`sideOutcome` in `libs/acl/src/evaluate.ts` folds a rule array along
`fails < unevaluable < unusable-clock < matched`. It is monotone in the array:
removing a rule can only move a side toward `fails`, and can never turn a `fails` into
a `matched`.

Run that through the precedence order:

- **Remove an allow rule.** The allow side moves toward `fails`, so the permission
  moves toward `no-rule-matched`. More conservative, sound, and unequal, which
  decision 5 rejects.
- **Remove a deny rule.** The deny side moves toward `fails`, so a `denied` becomes an
  allow. More permissive. Unsound.
- **Drop a write-axis `targets` or `transitions`.** `decideFields` falls through to the
  name list, or to `allowed`/`allow` when there is no name list. A field that was
  `denied` with `targets-failed` becomes `allowed`. Unsound.
- **Drop a read-axis name list.** `decideFields` reads `names` on the read axis too:
  without a list every field is `allowed`/`allow`, with one an unlisted field is
  `denied`/`not-listed`. The read axis is a projection hint and never a security
  boundary, so no access is granted by the change, and the field maps differ, which
  breaks the equality of decision 5 anyway.

Every edit to a permission is unsound, unequal, or both. The only operation left is
removing the permission whole, which § 6 shows changes nothing for the permissions that
remain.

The cost is explicit and lands on the owner. A permission is publishable only with its
refusals attached, so:

```ts
{
  key: 'invoice.approve',
  object: 'invoice',
  action: 'approve',
  visibility: 'public',
  rules: [
    {
      id: 'approver',
      when: [{ field: 'subject.roles', op: 'contains', value: 'approver' }],
    },
  ],
  denyRules: [
    {
      id: 'tier',
      when: [
        { field: 'subject.internalTier', op: 'in', value: ['probation'] },
      ],
    },
  ],
}
```

publishes `subject.internalTier` and the word `probation` to every consumer, or it does
not publish. There is no third option that keeps equality. The acl design already
accepts structural disclosure for the matrix as a whole — "a reader of the shipped
matrix learns every object kind, action name, role string, field name, state machine
and time window" — and this is the same acceptance applied per permission, at the
owner's choice.

## 8. Evaluation is always local

The constraint: a decision must never cost a network call. The overhead is per request
and per subject, it lands in the latency of every page that renders a button, and no
cache removes it because the answer varies by subject.

The distinction that makes contracts compatible with it:

- **Fetching a contract is periodic.** It is subject-independent and cacheable until
  its version changes, so it happens at deploy, at boot, or on a revalidate interval.
  It looks like a bundle refresh or a package install.
- **Fetching a decision is per request**, because a decision is per subject. A
  `Record<key, Decision>` from `capabilities()` is one subject's answers, so shipping
  it is a fetch per user per origin.

A matrix is the publishable thing and a decision is not, at any tier. This document
offers no decision-bubbling path, no "ask the owner" fallback and no remote
`capabilities()` endpoint, and none should be added later without revisiting this
section. `capabilities()` keeps its existing local meaning: every decision for the
current subject, computed from a matrix the caller already holds.

### The consequence, stated plainly

If a consumer needs to decide it, the permission must be public. **Internal means no
consumer needs this**, and it does not mean consumers ask us for it. An internal key at
a consumer is `unknown-action` under `closed: true` and stays that way; it is a
fail-closed dead end and never a fallback path.

The cost is that the public surface becomes a negotiated contract between services in
place of a default-deny convenience. Getting it wrong means a consumer cannot answer
a question it needs to answer, and the fix is a release by another team — a
`visibility` change, a review, a version bump and a deploy, on the owner's schedule. A
consumer blocked this way has no local workaround that preserves equality, because the
only workaround is writing the rule itself, which is § 1.

That trade is the price of the constraint, and it is the same trade any published API
carries.

## 9. The envelope and `schema`

`Matrix` is `{ version?, schema?, permissions }` at `types.ts:206-210`, and `schema` is
`{ subject?, objects? }` keyed by object kind. Reduction has to say what happens to a
`schema` describing internal object kinds.

The rule: a reduced envelope carries the `schema` entries for exactly the object kinds
named by its published permissions, whole, and drops every other entry.

`schema` is keyed by object kind and not by permission, so projecting it is no edit to
a permission and decision 7 does not reach it. Keeping a surviving kind's entry whole
is the conservative choice: a kept permission's rules may read any path on its object,
and an entry pruned to the fields the rules mention would break the moment a consumer
used the schema to validate an instance before calling `canFields`. An entry for a kind
no published permission names discloses internal structure and buys the consumer
nothing, so it goes.

`schema.subject` ships whole. It describes the consumer's own actor, which the consumer
already holds, and every published permission's `subject.*` conditions are checked
against it. Pruning it would break `assertRulesFit` at the consumer for the rules that
did ship.

A kind can be named by both a public and an internal permission. Its entry ships,
because the public permission needs it, and the internal permission's absence is what
keeps that permission private.

## 10. The pipeline, and what holds its order

```
authored matrix ─▶ applyDenyOverlay ─▶ hydratePolicy ─▶ serialize(reduced) ─▶ contract
```

The ordering is load-bearing. Serializing from the authored matrix omits every
compliance veto, and a veto is a deny rule, so omitting one is § 7's unsound direction
applied wholesale: the contract would allow what the owner refuses, for exactly the
permissions compliance cared most about.

An earlier draft of this document claimed the types carry the order, because
`serialize` takes an `Access` and the only `Access` in a publishing path is the one
built from the overlaid matrix. That claim is false. `hydratePolicy(authoredMatrix)` is
one call with no overlay anywhere in its signature, and `deny-overlay.ts:9` documents a
pipeline with no serialization step in it. Nothing in the type system stands between an
authored matrix and an `Access`.

What the types do hold is narrower and is the half decision 5 needs: `serialize` reads
`access.matrix`, so a contract equals the frozen document that `Access` evaluates. The
owner enforces on that same `Access`. So a contract can never disagree with what the
owner enforces, and publishing a veto-free contract requires the owner to be running
veto-free, which is a failure of the overlay step and not of serialization. Two
`Access` values in one publishing process is the only shape that breaks this, and one
`hydratePolicy` call in the publishing path is what a reviewer checks.

What holds the rest is the version, and it is evidence a gate can read.
`AccessOptions.version` exists for this composition and says so at
`hydrate-policy.ts:133-148`: the option wins over the document's `version` because the
construction site composed inputs the authored document cannot know about, and the
frozen `access.matrix` carries the winner. `applyDenyOverlay` carries `version` through
untouched and invents no name for the overlay, so a contract whose version names only
the authored matrix came out of a process that composed nothing. Decision 17's third
gate asserts that the published version names every input, which is one string
comparison in the publishing repo's release job.

The overlay is also why a contract's version is composite. A number cannot express one:
summing two versions collides, and taking the maximum ignores a rollback on the other
component. `Matrix.version` is `string | number` today (`types.ts:207`), so
`'orders@7+veto@41'` is already legal and no type change is owed here.

## 11. Vetoable keys are published

`deny-overlay.ts:78-82` names a second caller for `applyDenyOverlay`: a compliance team
runs it against the owner's published contract, in its own CI, and finds its own
mistake before the owner's deploy does. That check needs three things out of the
contract, and the first two are the ones this document controls. It needs the vetoable
permission, so `UnknownPermissionError` does not fire. It needs that permission's object
kind in `schema.objects`, so `MissingVetoSchemaError` does not fire and `assertRulesFit`
has shapes to check against. It needs the `vetoable` list, which the target states out
of band, the same way it states it to the overlay authority today.

A vetoable key marked internal defeats the first two at once. The permission is gone
from the contract and decision 16 drops its kind's schema entry along with it, so the
compliance team's CI refuses every contribution it was written to check, and the veto
lands for the first time in the owner's deploy. So `serialize` refuses it, with
`UnpublishedVetoableError` naming the key and both remedies.

The check lives in `serialize` and not in `applyDenyOverlay`, and the reason is that
second caller. `applyDenyOverlay` running against a published contract sees permissions
whose `visibility` decision 4 stripped, so every one of them reads internal there, and
a visibility check inside it would refuse the exact call it exists to enable. The
obligation is symmetric with `MissingVetoSchemaError` and lands at the same moment:
opening an extension point obliges the target to declare the kind and to publish the
key, and a target that opens none owes neither.

`serialize` takes the `vetoable` list as an option because an `Access` does not carry
one. `DenyOverlayOptions` is an argument to `applyDenyOverlay` at `deny-overlay.ts:33-41`,
and the matrix it returns records nothing about which keys were opened. The publishing
path already holds the list, having just passed it to the overlay, so passing it again
repeats a value and asks for no new knowledge.

## 12. Two origins, one key

`federatedPolicies` refuses construction when two members claim one permission key,
with `OriginCollisionError` naming the key and both origins. Two services that both
publish `invoice.read` produce two contracts a consumer cannot hold side by side.

The contract format does nothing about it, and that is the decision. Rewriting a key at
serialization is an edit to a permission, which decision 7 forbids, and it breaks
equality directly: `Decision.key` is `${object}.${action}`, so a renamed key answers
under a name the owner never answers under, and the two `Decision`s differ in their
first field for every subject. Rewriting the key without rewriting `object` also fails
`KeyMismatchError` at the consumer's `parseMatrix`, so the contract would not load.

The namespace belongs in the authored `object`, and `validate.ts:442-452` already fixes
its spelling. A `.` in `object` or `action` is refused, because the join onto
`${object}.${action}` is reversible only while neither part carries one, and the comment
there names the namespaced form: `orders:invoice.read`. An owner that expects to sit
beside other origins names its kinds that way before it publishes, once, in its own
matrix.

A collision that reaches a consumer is therefore two owners naming one kind, and the
consumer is the first place both documents exist, which is where `federatedPolicies`
catches it. Decision 17's key-list snapshot is the earlier catch: the published surface
of an origin is one file a reviewer reads, and a bare `invoice` in it is visible before
a consumer ever fetches the contract.

## 13. Veto latency and the staleness window

A compliance veto lands on the owner, the owner's effective version changes, and the
consumer learns about it on its next revalidate. Between the veto and the consumer's
refetch, the consumer serves the pre-veto contract and answers permissively while the
owner already refuses.

This is a UI-correctness gap and no security hole. The owner enforces on its own matrix
on every call, and the consumer's decision has never been the boundary. What a user
sees in the gap is a button that returns a refusal when pressed, which is the ordinary
behaviour of any client one tick behind its server.

### The bound

The acl design fails a consumer closed on a version mismatch. Under decision 8 there is
no network fallback to soften that, so failing closed the moment a mismatch is seen
means an application stops answering questions it answered a moment ago, for as long as
a refetch takes, with a failure mode indistinguishable from the origin being down. The
stale window is accepted, with a bound. Four things have to be pinned down for that to
be a design.

**What it is measured from: the last successful freshness validation.** Not the moment a
mismatch is first noticed. A budget that starts at detection bounds nothing when
detection itself fails, and detection is the consumer's code — a poll that silently
stopped, a probe endpoint answering 200 from a cache, a deploy that dropped the timer.
Such a consumer believes it is fresh and never starts a clock. Measuring from the last
validation makes staleness a property of what the consumer knows, and no property of
what it noticed, so a consumer that has stopped checking expires on schedule. A
successful validation is a response that confirms a version, whether or not the version
changed; the budget resets on a matching version as much as on a completed refetch. The
consumer reports that instant as `AccessOptions.fetchedAt`.

**Who sets it: the owner, as a ceiling.** `maxStale` is a field on the contract
envelope. A consumer may configure a shorter bound locally and may not extend it —
`min(ownerMaxStale, localMaxStale)`. The owner knows how fast its policy changes and how
fast a revocation has to take effect; a consumer does not, and a consumer choosing its
own bound optimises for its own availability, which is the wrong party's interest.

An earlier draft read an absent `maxStale` as a budget of zero. That does not survive
contact with the engine. A zero budget expires at the instant after `fetchedAt`, so
every key answers `stale-contract` for the life of the process, which is the failure
mode this whole section exists to remove, arrived at through a document field nobody
set. The rule instead: a consumer that passes no `fetchedAt` makes no freshness claim
and no budget applies, which is every matrix in the repo today; a consumer that passes
one against a document carrying no `maxStale` is refused at construction with
`MissingFreshnessBudgetError`, naming the document and the field it owes. The failure is
loud, it fires once, and it names the owner's remedy, which a per-call refusal names too
late.

The objection to putting an operational parameter in a policy document stands and is
accepted. The answer is that "how long may a revoked permission keep being shown" is a
policy statement about revocation latency and no deployment tunable, and it is the one
party with the knowledge writing it down where the consumers already look.

**What expiry does: every decision answers `stale-contract`.** Decision 14 adds the
reason. Neither existing refusal carries the meaning. `unknown-action` says the key is
not in the matrix, which a consumer renders as "this permission does not exist" and
never retries. `unevaluable` says the decision is repairable by fetching object paths,
and it carries `missing` to say which — an expired contract would carry an empty
`missing`, telling a UI to refetch nothing, forever. `stale-contract` says the contract
this would have been decided against is too old to trust, and its remedy is a contract
refetch, which is a different action by a different part of the consumer.
`capabilities()` returns every key the document carries with that reason, and
`canFields` returns
`{ allowed: false, action: { …, reason: 'stale-contract' }, fields: {}, reasons: {} }`,
matching the shape the `unknown-action` path already returns.

The check runs before the key lookup, ahead of `objectFor` and `permissionFor`. A
contract past its budget carries no claim about the present, and that includes its claim
about which keys it holds, so an unknown key on an expired contract answers
`stale-contract` too.

The check needs no timer and no clock of its own. The expiry instant is
`fetchedAt + min(maxStale)`, constant for the life of the `Access`, and every entry
point already settles `now` once (`hydrate-policy.ts`'s `ctxWith`). Expiry is
`settled > expiresAt`, evaluated against the same settled instant the conditions read,
so evaluation stays pure, total and local. A `now` that does not parse is NaN, the
comparison is false, and the call proceeds to `unusable-clock` on every permission that
reads the clock, which is what an `Access` with no budget does today.

**The security argument.** A stale contract is stale-_permissive_: a permission the
owner revoked at the last version stays granted at the consumer until the budget
expires. That is acceptable for one reason only — the consumer's answer was never
authoritative. The owner re-evaluates on its own matrix on every call and refuses, and
§ 2's doctrine holds that every layer evaluates its own copy and no layer trusts an
earlier one. A stale consumer over-shows and never over-grants.

The bound exists anyway, because "advisory" is no licence to show a revoked rule for a
week: it caps how long a user is offered something the owner has stopped allowing, and
it caps how long a consumer's own logging and audit trail disagrees with the owner's.
Expiry fails closed and degrades no further, because a contract past its budget carries
no claim about the present at all.

### One bound, and no second

A compliance veto is the change that most wants fast propagation, and an ordinary rule
edit does not. A single bound has to be short enough for the veto, which sets every
consumer's refetch rate to veto speed. That argues for a second, tighter bound covering
the overlay.

It does not work, and the reason is § 7. Reduction ships deny rules verbatim, so an
overlay deny in a contract is indistinguishable from an authored deny: same shape, same
field, no provenance mark. A consumer has nothing to key a per-rule or per-permission
bound on. Two envelope-level bounds collapse on arithmetic, because the consumer cannot
tell which permissions a given version bump touched, so the effective bound is `min` of
the two, which is the tight one applied to everything. That is the single-bound outcome
with extra fields.

Adding provenance to make the split work is worse than the problem. A `source:
'overlay'` mark on a deny rule tells every reader of a public contract which of an
owner's refusals a compliance authority imposed, which is a disclosure the owner did not
choose when it marked the permission public.

What makes a single veto-speed bound affordable is separating the freshness probe from
the payload. Freshness is a version comparison, so a consumer revalidates against a
small version endpoint — a few bytes, cacheable by nothing, answerable from memory — and
downloads the contract body only when the version differs. The body changes only when
the version does. So the tight bound applies to the probe, and the expensive transfer
stays as rare as contract changes are.

Open: push versus poll. Polling costs a probe per consumer per interval whether or not
anything changed, and § 8's constraint is about decisions, so a periodic
subject-independent probe does not violate it. A push — the owner notifying consumers on
a version change — collapses the window to notification latency and adds a delivery
mechanism, a fan-out list, and a failure mode of its own: a consumer that missed a push
believes it is fresh, which is exactly the case the freshness budget is measured from
last validation to survive. Poll is the assumed starting point because it needs nothing
new and its worst case is bounded by construction. Push is worth specifying if the probe
interval a consumer can afford turns out to be longer than the revocation latency
compliance requires. Not settled here.

## 14. The test obligation

Decision 5 is a property over all subjects and objects, and an example-based suite
passes whether or not it holds. The gate is a differential check:

For generated subjects, objects and instants, and for every key the contract carries,
assert that `contract.can(...)` and `full.can(...)` return deep-equal `Decision`s, and
that `contract.canFields(...)` and `full.canFields(...)` return deep-equal `fields` and
`reasons` maps on both axes. Generation covers the paths the matrix's conditions
actually read — the `subject.*` and `object.*` paths reachable from every `when` — so a
generated subject exercises the branches and lands on `no-rule-matched` only when the
rules say so. Absent paths are part of the domain, because `unevaluable` and its
`missing` list are decision content under decision 5.

Two more, cheap and specific:

- Reduction removes only whole permissions: for every key in the contract, the
  permission object deep-equals the owner's with `visibility` deleted.
- The published key list snapshot of decision 17, so a visibility change is a one-line
  diff in a file whose whole subject is the published surface.

The differential check is a release gate on the publishing repo and no test inside
`@evanion/acl`: the library's own suite can only assert it for fixtures, and the
property that matters is about a specific service's matrix.

## What this is guessing

- **That `maxStale` is best expressed as a duration.** § 13 settles that the owner sets
  it and what it is measured from. A revision count or a version-distance bound might
  fit the compliance case better; a duration is the form every HTTP cache already uses
  and is the least surprising default.
- **`fetchedAt` as a consumer-supplied option.** The consumer reports when it last
  validated, so a consumer that lies about it serves a contract past its budget. Nothing
  here stops that, and nothing needs to while the consumer's answer is advisory; a
  signed freshness assertion would, at the cost of a key distribution problem this
  design does not otherwise have.
- **That an owner will spell its object kinds `origin:kind`.** § 12 leans on a
  convention `validate.ts` permits and nothing enforces. A guard could require a colon
  in every `object` of a published matrix, and it would be wrong for the many services
  that publish to one consumer each.
- **That consumers want whole contracts.** A consumer needing four of an origin's two
  hundred public keys carries all two hundred. Sub-setting by consumer reintroduces a
  per-consumer artifact and a per-consumer review, so it is not proposed, and the cost
  is untested.
- **Nothing measures the disclosure.** § 7 says an owner accepts publishing
  `subject.internalTier`, and no tooling here tells an author what a permission would
  disclose before they mark it public. A "what does this publish" report over a
  permission's condition paths would make the § 7 trade a decision and no discovery, and
  is not specified.
- **The differential check's generator.** Path-directed generation is asserted to
  exercise the branches; it has not been written, and a matrix with `contains` over
  arrays and `transitions` over enums may need per-op generators before coverage is
  real.
