# Published policy contracts

Status: proposed
Packages: `@evanion/acl`. No new package. Adds one field to `Permission`, one
serialization entry point, one construction error, one `Reason` member, one
`AccessOptions` field, and widens `AccessOptions.version`. `@evanion/react-acl`
re-exports the types and changes no runtime.
Depends on: `docs/superpowers/specs/2026-09-14-acl-design.md` (on `feat/acl`, not on
`main`) — its matrix format, the seven-step precedence order, the `dependsOn` cascade,
the read-axis-is-not-a-security-boundary rule and the no-transitive-trust doctrine are
all load-bearing here; `libs/acl/src/create-policy.ts`, `evaluate.ts`, `fields.ts`,
`graph.ts`, `types.ts` (same branch); `docs/specs/2026-09-16-framework-adapters.md`
(on `docs/framework-adapters`, not on `main`) — its § 7 decides that data crosses a
transport and an `Access` does not, which is the crossing this document publishes
over; the compliance deny-overlay design, which is accepted and not yet written down
anywhere in this repo (§ 12); the matrix envelope change, likewise accepted and not
yet written down, which makes `Matrix` a `{ version, schema?, permissions }` object
(§ 10).
Supersedes: the acl design's Acquisition paragraph, which fails closed on a version
mismatch. Decisions 12 to 14 replace that with a bounded freshness budget, and § 13 is
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
the deny rules, the service owning the rest — falls out of the same shape, and is the
subject of the overlay design this one depends on.

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
   emit the field, and an author who forgot all fail to publish rather than publishing
   by accident. § 4.
4. Serialization takes a mode. `full` emits the authored document with `visibility`
   intact. `reduced` emits the contract: public permissions only, with `visibility`
   stripped from each. § 5 is why the reduced form strips it.
5. **The correctness property is equality, not conservatism.** For every subject,
   object and instant, a contract's decision for a public key equals the owner's
   decision for that key, `Decision` fields and `FieldDecision` maps included. § 6.
6. **A projection may remove what grants and must preserve what refuses.** § 7 derives
   it from `sideOutcome`'s monotonicity.
7. **Reduction removes whole permissions and never edits one.** A permission's
   `denyRules`, `dependsOn`, write-axis field configs and read-axis name list all ship
   verbatim or the permission does not ship. A permission whose deny rules read an
   internal concept is therefore unpublishable as written; the owner discloses the
   concept or keeps the permission internal. § 7.
8. **The published set is closed under `dependsOn`.** A public permission naming an
   internal dependency is a construction error at serialization, named
   `UnpublishableDependencyError`, extending `AclConfigError`. § 8.
9. **Evaluation is always local, at every tier.** A consumer fetches contracts on an
   interval and never calls another service to decide anything. The record of decisions
   `capabilities()` returns is per subject and is therefore a fetch per user per origin;
   it is not a publishable artifact and no fallback uses one. § 9.
10. **An internal key at a consumer is a dead end.** It answers
    `{ allowed: false, reason: 'unknown-action' }` under `closed: true` and keeps
    answering that. The remedy for a consumer that needs it is that the owner marks it
    public and cuts a release. § 9.
11. The pipeline is authored matrix, then `applyDenyOverlay`, then
    `serialize(reduced)`, then the contract, in that order. `serialize` takes the
    post-overlay `Access`, so the ordering is carried by the types rather than by a
    convention. § 12.
12. A consumer serves the contract it holds inside a **freshness budget**: `maxStale`,
    a duration the owner sets and the contract carries, measured from the last
    successful freshness validation. Inside the budget every decision answers
    normally, including while a refetch is in flight. Past it every decision answers
    `{ allowed: false, reason: 'stale-contract' }`. An absent `maxStale` is zero, so a
    contract that does not say otherwise keeps the acl design's fail-closed behaviour.
    § 13.
13. `Reason` gains `'stale-contract'`. It is a public type change, and both packages
    are `private: true`, so it lands before the first publish. § 13.
14. There is one staleness bound, not one for the contract and a tighter one for
    compliance vetoes. § 13 is why, and what makes veto-speed revalidation affordable.
15. `AccessOptions.version` and `Access.version` widen to `string | number`. § 11.
16. A reduced envelope keeps its `schema` entries for exactly the object kinds its
    published permissions name, whole, and drops the rest. § 10.
17. Two release gates on the publishing repo: a differential equality check (§ 14) and
    a snapshot of the published key list (§ 3).

## 1. What a contract is

`libs/acl/src/create-policy.ts` builds an `Access` out of closures, and
`docs/specs/2026-09-16-framework-adapters.md` § 7 already settles that an `Access` does
not cross a transport — `structuredClone` throws on the functions and `JSON.stringify`
silently drops every method. Data crosses. A contract is that data, narrowed:

```ts
const contract = serialize(access, 'reduced'); // a Matrix, JSON by construction
```

A consumer adopts it the way it adopts any foreign matrix:

```ts
const orders = parseMatrix(contract, { version: contract.version });
orders.can(subject, 'refund', 'approve', order);
```

`parseMatrix` sets `closed: true` (`libs/acl/src/parse-matrix.ts`), so a key the
contract does not carry answers `unknown-action` instead of throwing. That is the
behaviour decision 10 depends on, and it already exists.

## 2. Ownership, not a gateway

Each origin's contract is a separate document evaluated separately. There is no merge
step, no composed model and no planner, and adding one would recreate the failure: a
merged supergraph is a single artifact nobody owns whose contents come from several
teams, which is the second copy again with a nicer name.

The doctrine the acl design already states holds unchanged: every layer evaluates its
own copy and no layer trusts an earlier one. A BFF that consulted a contract and
allowed a call does not excuse the orders service from deciding again on its own
matrix. The contract removes the second _definition_; it does not remove the second
_evaluation_, and it must not.

## 3. Visibility is a flag on the permission

```ts
export interface Permission {
  key: string;
  object: ObjectKey;
  action: Action;
  rules?: readonly Rule[];
  denyRules?: readonly Rule[];
  dependsOn?: readonly string[];
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
empty result is the right answer, reached for a mechanical reason rather than a
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
reads the snapshot diff rather than the matrix diff. The snapshot is generated, so it
cannot drift from the marking; it is a review surface, not a second source of truth.
Without it, the review objection stands unmitigated, which is why it is a gate and not
a suggestion.

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

function serialize(access: Access, mode: SerializeMode): Matrix;
```

`full` emits `access.matrix` as it stands — the authored document, `visibility`
included, round-tripping losslessly through `parseMatrix`.

`reduced` emits the contract:

- keep a permission when `visibility === 'public'`, drop it otherwise
- delete `visibility` from every kept permission
- keep everything else on a kept permission byte for byte
- carry the envelope's `version`, and its `schema` entries per decision 16
- throw `UnpublishableDependencyError` if a kept permission names a dropped dependency

`serialize` reads `access.matrix`, which is already a deep-frozen `structuredClone`
(`create-policy.ts`), so it copies out of a value nothing can have mutated since
construction.

## 6. The equality property

For every subject, object and instant, and for every key the contract carries:

```
contractAccess.can(subject, key, action, object, now)
  ≡ ownerAccess.can(subject, key, action, object, now)
```

and the same for `canFields` on both axes, field by field, reason by reason.

Equality, not "the contract is at least as conservative". A consumer that answers
conservatively is still a second copy that diverges from the owner, and it produces
exactly the failure in § 1: a button hidden forever against a server that would have
allowed the call, with no error anywhere to notice. A permission that is off by being
conservative is indistinguishable, from inside the consumer, from a permission that is
off because the rules say so.

`Decision` equality includes `reason`, `rule`, `blockedBy`, `cause` and `missing`,
because a consumer renders on those. A `cause.missing` that named a path in the owner
and nothing in the contract would leave a UI with no refetch to make.

The property is provable from the engine rather than asserted. `create-policy.ts`'s
`cascadeOf` walks `dependsOn` upward only, collecting a key's transitive ancestors, and
`decideCascaded` resolves that slice alone. One permission's decision is a function of
that permission and its transitive `dependsOn` ancestors, and of nothing else in the
matrix. So removing permissions that are neither the key nor one of its ancestors
cannot change its decision — which is precisely what decisions 7 and 8 guarantee that
reduction does. `capabilities()` folds over `graph.order` and reads each key's
ancestors out of the same resolved map, so it agrees per key; the contract's record is
a subset of the owner's, carrying the public keys with identical values.

## 7. Remove what grants, preserve what refuses

`sideOutcome` in `libs/acl/src/evaluate.ts` folds a rule array and returns `matched`
when any rule matches, `undecidable` when none matches and at least one is
undecidable, and `fails` otherwise. It is monotone in the array: removing a rule can
only move a side toward `fails`, and can never turn a `fails` into a `matched`.

Run that through the precedence order:

- **Remove an allow rule.** The allow side moves toward `fails`, so the permission
  moves toward `no-rule-matched` at step 3. More conservative, sound, and unequal —
  which decision 5 rejects.
- **Remove a deny rule.** The deny side moves toward `fails`, so a `denied` at step 1
  becomes an allow at step 5. More permissive. Unsound.
- **Drop a write-axis `targets` or `transitions`.** `decideFields` falls through to the
  name list, or to `allowed`/`allow` when there is no name list. A field that was
  `denied` with `targets-failed` becomes `allowed`. Unsound.
- **Drop a read-axis name list.** `decideFields` reads `names` on the read axis too:
  without a list every field is `allowed`/`allow`, with one an unlisted field is
  `denied`/`not-listed`. The read axis is a projection hint and never a security
  boundary, so no access is granted by the change — and the field maps differ, which
  breaks the equality of decision 5 anyway.

Every edit to a permission is unsound, unequal, or both. The only operation left is
removing the permission whole, which § 6 shows changes nothing for the permissions that
remain.

The cost is explicit and lands on the owner. A permission is publishable only with its
refusals attached, so:

```ts
{
  key: 'invoice.approve',
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
matrix learns every object kind, action name, role string, field name, state machine,
time window and `dependsOn` edge" — and this is the same acceptance applied per
permission, at the owner's choice.

## 8. Closure under `dependsOn`

A public permission naming an internal dependency has four candidate resolutions and
none is acceptable:

| Resolution                 | What happens                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Drop the edge              | The consumer skips step 2 of the precedence order, so a permission the owner blocks resolves on. More permissive. Unsound. |
| Keep the dangling edge     | `buildGraph` throws `UnknownDependencyError` in the consumer's `parseMatrix`. The whole contract fails to load.            |
| Stub the parent as allowed | Step 2 never fires. Same unsound result as dropping the edge.                                                              |
| Stub the parent as denied  | The permission is `dependency-off` for every subject, forever. Equality fails in the conservative direction.               |

So it is a construction error at serialization time, raised by the owner's build rather
than by the consumer's loader, naming both ends and both remedies:

```
UnpublishableDependencyError: cannot publish "invoice.approve": it depends on
"invoice.reconcile", which is internal. Publish "invoice.reconcile", or make
"invoice.approve" internal.
```

The check is a walk of the public set's `dependsOn` edges against the public set, so it
reports every violating edge in one run rather than one per build. `buildGraph` has
already rejected cycles and unknown keys on the authored matrix, so the walk terminates
and every named parent exists.

Note the asymmetry: only the ancestor direction constrains publication. An internal
permission may depend on a public one freely, because a permission's decision does not
read its dependants.

## 9. Evaluation is always local

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
fail-closed dead end, not a fallback path.

The cost is that the public surface becomes a negotiated contract between services
rather than a default-deny convenience. Getting it wrong means a consumer cannot answer
a question it needs to answer, and the fix is a release by another team — a
`visibility` change, a review, a version bump and a deploy, on the owner's schedule. A
consumer blocked this way has no local workaround that preserves equality, because the
only workaround is writing the rule itself, which is § 1.

That trade is the price of the constraint, and it is the same trade any published API
carries.

## 10. The envelope and `schema`

The queued envelope change makes `Matrix` a `{ version, schema?, permissions }` object
in place of today's bare `readonly Permission[]`. Reduction then has to say what
happens to a `schema` describing internal object kinds.

The rule: a reduced envelope carries the `schema` entries for exactly the object kinds
named by its published permissions, whole, and drops every other entry.

`schema` is keyed by object kind rather than by permission, so projecting it is not an
edit to a permission and decision 7 does not reach it. Keeping a surviving kind's entry
whole is the conservative choice: a kept permission's rules may read any path on its
object, and an entry pruned to the fields the rules mention would break the moment a
consumer used the schema to validate an instance before calling `canFields`. An entry
for a kind no published permission names discloses internal structure and buys the
consumer nothing, so it goes.

A kind can be named by both a public and an internal permission. Its entry ships,
because the public permission needs it, and the internal permission's absence is what
keeps that permission private.

## 11. `version` widens to `string | number`

`AccessOptions.version` is `number | undefined` in `create-policy.ts`, and
`Access.version` reflects it.

A contract's version has to identify the authored matrix and any applied overlay
together (§ 12). A number cannot express a composite: summing two versions collides
(3+7 and 5+5 are the same artifact identity for two different artifacts), and taking
the maximum ignores a rollback on the other component. `'matrix-14+overlay-3'`, a
content hash, or a semver string all express it, and all are strings.

This is not the only driver. The acl design's Acquisition section already says the
matrix carries "an integer `version` (or a hash)", and a hash is a string, so the
prose and the type already disagree in the published design. A third driver exists
outside this repo in the owner's notes and is not restated here. The change is
type-level and pre-publish; `@evanion/acl` is `private: true` today, so it costs
nothing now and is a breaking change to every adapter signature after the first
release.

## 12. The pipeline

```
authored matrix ─▶ applyDenyOverlay ─▶ serialize(reduced) ─▶ contract
```

The overlay is a separate accepted design: a compliance authority publishes deny rules,
and the owner applies them in its own process before constructing its `Access`. This
document does not specify it and depends on it.

The ordering is load-bearing. Serializing from the authored matrix omits every
compliance veto, and a veto is a deny rule, so omitting one is § 7's unsound direction
applied wholesale — the contract would allow what the owner refuses, for exactly the
permissions compliance cared most about.

The types carry the ordering rather than a convention: `serialize` takes an `Access`,
and the only `Access` in the publishing path is the one built from the overlaid matrix.
A build that serializes the authored array has no `Access` to hand it.

The overlay is also why a contract's version is composite, and § 11 is that argument.

## 13. Veto latency and the staleness window

A compliance veto lands on the owner, the owner's effective version changes, and the
consumer learns about it on its next revalidate. Between the veto and the consumer's
refetch, the consumer serves the pre-veto contract and answers permissively while the
owner already refuses.

This is a UI-correctness gap, not a security hole. The owner enforces on its own matrix
on every call, and the consumer's decision has never been the boundary. What a user
sees in the gap is a button that returns a refusal when pressed, which is the ordinary
behaviour of any client that is one tick behind its server.

### The bound

The acl design fails a consumer closed on a version mismatch. Under decision 9 there is
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
validation makes staleness a property of what the consumer knows rather than of what it
noticed, so a consumer that has stopped checking expires on schedule. A successful
validation is a response that confirms a version, whether or not the version changed;
the budget resets on a matching version as much as on a completed refetch.

**Who sets it: the owner, as a ceiling.** `maxStale` is a field on the contract
envelope. A consumer may configure a shorter bound locally and may not extend it —
`min(ownerMaxStale, localMaxStale)`. The owner knows how fast its policy changes and how
fast a revocation has to take effect; a consumer does not, and a consumer choosing its
own bound optimises for its own availability, which is the wrong party's interest. An
absent `maxStale` is zero: a contract that says nothing tolerates no staleness and keeps
the acl design's existing fail-closed behaviour, so the window is opt-in by the owner in
the same way publication is.

The objection stands and is accepted: this puts an operational parameter in a policy
document. The answer is that "how long may a revoked permission keep being shown" is a
policy statement about revocation latency, not a deployment tunable, and it is the one
party with the knowledge writing it down where the consumers already look.

**What expiry does: every decision answers `stale-contract`.** Decision 13 adds the
reason:

```ts
type Reason =
  | 'allow'
  | 'no-rule-matched'
  | 'denied'
  | 'dependency-off'
  | 'unknown-action'
  | 'unevaluable'
  | 'stale-contract';
```

Neither existing refusal carries the meaning. `unknown-action` says the key is not in
the matrix, which a consumer renders as "this permission does not exist" and never
retries. `unevaluable` says the decision is repairable by fetching object paths, and it
carries `missing` to say which — an expired contract would carry an empty `missing`,
telling a UI to refetch nothing, forever. `stale-contract` says the contract this would
have been decided against is too old to trust, and its remedy is a contract refetch,
which is a different action by a different part of the consumer. `capabilities()`
returns every key with that reason, and `canFields` returns
`{ allowed: false, action: { …, reason: 'stale-contract' }, fields: {}, reasons: {} }`,
matching the shape the unknown-action path already returns.

The check needs no timer and no clock of its own. `AccessOptions` gains
`fetchedAt?: Instant` alongside `version`, the envelope carries `maxStale`, and every
entry point already settles `now` once (`create-policy.ts`'s `ctxWith`). Expiry is
`now - fetchedAt > maxStale`, evaluated against the same settled instant the conditions
read, so evaluation stays pure, total and local.

**The security argument.** A stale contract is stale-_permissive_: a permission the
owner revoked at the last version stays granted at the consumer until the budget
expires. That is acceptable for one reason only — the consumer's answer was never
authoritative. The owner re-evaluates on its own matrix on every call and refuses, and
§ 2's doctrine holds that every layer evaluates its own copy and no layer trusts an
earlier one. A stale consumer over-shows and never over-grants.

The bound exists anyway, because "advisory" is not a licence to show a revoked rule for
a week: it caps how long a user is offered something the owner has stopped allowing, and
it caps how long a consumer's own logging and audit trail disagrees with the owner's.
Expiry fails closed rather than degrading further, because a contract past its budget
carries no claim about the present at all.

### One bound, not two

A compliance veto is the change that most wants fast propagation, and an ordinary rule
edit does not. A single bound has to be short enough for the veto, which sets every
consumer's refetch rate to veto speed. That argues for a second, tighter bound covering
the overlay.

It does not work, and the reason is § 7. Reduction ships deny rules verbatim, so an
overlay deny in a contract is indistinguishable from an authored deny — same shape, same
field, no provenance mark. A consumer has nothing to key a per-rule or per-permission
bound on. The alternative, two envelope-level bounds, collapses on arithmetic: the
consumer cannot tell which permissions a given version bump touched, so the effective
bound is `min` of the two, which is the tight one applied to everything. That is the
single-bound outcome with extra fields.

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
anything changed, and § 9's constraint is about decisions, so a periodic
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
generated subject exercises the branches rather than landing on `no-rule-matched` every
time. Absent paths are part of the domain, because `unevaluable` and its `missing` list
are decision content under decision 5.

Two more, cheap and specific:

- Reduction removes only whole permissions: for every key in the contract, the
  permission object deep-equals the owner's with `visibility` deleted.
- The published key list snapshot of decision 17, so a visibility change is a one-line
  diff in a file whose whole subject is the published surface.

The differential check is a release gate on the publishing repo, not a test inside
`@evanion/acl`: the library's own suite can only assert it for fixtures, and the
property that matters is about a specific service's matrix.

## What this is guessing

- **The overlay's shape.** § 12 assumes the overlay produces a matrix whose permissions
  carry additional `denyRules` and that it runs before construction. If it instead
  applies at evaluation, the pipeline argument survives and the `serialize` signature
  does not.
- **The envelope's `schema`.** § 10 assumes it is keyed by object kind and describes
  field shapes. Keyed any other way, the projection rule needs rewriting.
- **That `maxStale` is best expressed as a duration.** § 13 settles that the owner sets
  it and what it is measured from, not its units. A revision count or a version-distance
  bound might fit the compliance case better; a duration is the form every HTTP cache
  already uses and is the least surprising default.
- **`fetchedAt` as a consumer-supplied option.** The consumer reports when it last
  validated, so a consumer that lies about it serves a contract past its budget. Nothing
  here stops that, and nothing needs to while the consumer's answer is advisory; a
  signed freshness assertion would, at the cost of a key distribution problem this
  design does not otherwise have.
- **That consumers want whole contracts.** A consumer needing four of an origin's two
  hundred public keys carries all two hundred. Sub-setting by consumer reintroduces a
  per-consumer artifact and a per-consumer review, so it is not proposed, and the cost
  is untested.
- **Nothing measures the disclosure.** § 7 says an owner accepts publishing
  `subject.internalTier`, and no tooling here tells an author what a permission would
  disclose before they mark it public. A "what does this publish" report over a
  permission's condition paths would make the § 7 trade a decision rather than a
  discovery, and is not specified.
- **The differential check's generator.** Path-directed generation is asserted to
  exercise the branches; it has not been written, and a matrix with `contains` over
  arrays and `transitions` over enums may need per-op generators before coverage is
  real.
