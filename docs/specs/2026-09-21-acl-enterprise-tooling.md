# Enterprise tooling around `@evanion/acl`

Status: proposed. Research and design. Three items arrive already decided by the
owner and are recorded here with their open questions worked out: the test kit
(§ 4), the matrix diff (§ 3), and audit logging as an application concern
reached through an observation seam (§ 5). Everything else is a recommendation,
and § 11 recommends building almost none of it until a user asks.
Packages: `@evanion/acl`. Two new exports (`diffMatrix`, a test kit entry), two
new `AccessOptions` members (`observe` and `onObserveError`), one defect to
repair before publication (`Rule.id`). `@evanion/react-acl` changes in neither
runtime nor types. The matrix explorer is its own package and § 13 records its
two settled decisions.
Depends on: `libs/acl/src/evaluate.ts` (`sideOutcome` at `:64-93`, whose
monotonicity § 3 derives the diff's soundness from; `ruleId` at `:5-7`, the
positional fallback § 5.4 is about; the seven-step order at `:105-118`),
`libs/acl/src/conditions.ts` (`readPath` at `:76-92`, one dot per scope, which
§ 2.2 turns on; `resolveContext` at `:58-64`, which passes the caller's subject
by reference and decides § 5.3; `comparandPathOf` at `:124-128`, the
path-to-path comparison § 8 builds tenant isolation from),
`libs/acl/src/validate.ts` (`assertCondition` at `:157-160`, which refuses a
nested path at construction), `libs/acl/src/hydrate-policy.ts` (`expiryOf` at
`:187-205`, the freshness budget § 2.1 bounds revocation with; the four
deciding entry points at `:501`, `:546`, `:572`, `:617`),
`libs/acl/src/fields.ts` (`pickAllowedFields` at `:240-257`, which decides
nothing and is § 5.2's correction), `libs/acl/src/types.ts` (`Matrix` at
`:220-235`, `Decision` at `:261-267`, `Reason` at `:251-258`, and
`ObjectSchema.relations` at `:180-183`, declared and unreadable),
`libs/acl/src/serialize.ts` (`serialize` at `:135-165`, whose reduction § 7
measures), `libs/acl/src/deny-overlay.ts` (`applyDenyOverlay` at `:95-144`, the
sanctioned way for a second party to change an outcome, which § 5.1 rests on),
`libs/acl/src/federated-policies.ts` (`OriginCollisionError` at `:77-86`, which
§ 8 tests per-tenant documents against), `libs/acl/src/authoring.ts`
(`toRules` at `:81-86`, which emits no rule id; `toBranches` at `:67-78`, the
disjunctive normal form § 3 reads grants out of),
`docs/specs/2026-09-16-published-policy-contracts.md` (§ 13, the freshness
budget and the veto-latency argument § 2.1 does not repeat; § 14, the test
obligation § 4 extends to the consumer),
`docs/specs/2026-09-16-deny-overlay.md` (the cross-cutting deny § 6 uses as a
rollout mechanism), `docs/specs/2026-09-17-acl-no-cascade.md` (§ 4, whose
subsumption check § 3 reuses and whose "it has no user" argument § 11 takes),
`docs/specs/2026-09-17-acl-wildcard-action.md` (§ 8, "matrix review is the only
control over an over-broad grant", the sentence § 3 exists to serve; § 4, the
field allow-list that has no defined comparison),
`docs/specs/2026-09-17-acl-federated-policies.md` (the routing table),
`docs/specs/2026-09-20-public-documentation-guidance.md` (the prose rules this
document is written under), `libs/widget/src/warn.ts` (`warnOnce` at `:22-27`
and its production early return at `:23`, which § 5.6 takes as the default
failure report and measures the limit of; `resetWarnings` at `:37-39`),
`apps/docs/components/acl/UnevaluableDemo.tsx` (the fetch-and-reask loop § 5.8
points an injector at).
Measured against: this worktree at `8459a54`, Node v24.16.0, macOS 26.6.2,
Apple M1 Pro. Every decision, message and number quoted below came from running
the package's own test runner over a throwaway spec in `libs/acl/src`, deleted
before this document was committed. The evidence ledger separates what was run,
what was read here, and what was read on a vendor's site.
Prior art: nine authorization products and four specifications, fetched from
their own documentation on 2026-09-21 and listed in § 12 with the page beside
each claim. Two sources could not be reached and are named there. The tooling is
the subject in that section. What a product needs at deploy time decides which
of its tools this architecture could host at all.

## What is actually being asked

The owner asked what tooling around `@evanion/acl` would serve larger
deployments and enterprise use. Three properties of the architecture answer part
of that before any tool is designed.

A policy is a frozen, serializable JSON document, validated and deep-frozen at
construction (`hydrate-policy.ts:106-110`). Evaluation is a local function call
reading nothing beyond the document and the arguments, which the owner set as a
hard constraint. Every consumer re-evaluates for itself and trusts no earlier
layer, which `2026-09-16-published-policy-contracts.md` § 8 states and § 2
derives the contract from.

Those three make some enterprise questions cheap and some unanswerable. § 1 and
§ 2 are the two lists. § 3 through § 8 design the tools that fit. § 10 names
what to refuse on purpose. § 11 is the schedule, and it is short.

## Decisions

1. The architecture serves policy distribution, deterministic replay and
   decision-making under a network partition well, for one shared reason: a
   decision is a pure function of bytes the consumer already holds. § 1.
2. Revocation latency is served badly and the floor is `maxStale`. A consumer
   holding a frozen document cannot learn of a revocation sooner than its
   freshness budget, and no tool in this library moves that floor. § 2.1.
3. Relationship-based access is not served at all and should not be attempted.
   `readPath` resolves one dot per scope (`conditions.ts:78-80`) and
   `assertCondition` refuses a deeper path at construction
   (`validate.ts:157-160`). A user who needs a folder hierarchy reaches for
   SpiceDB or OpenFGA, and § 12 says what those cost. § 2.2.
4. "Which subjects can do X" is not answerable. The document states conditions
   over subject attributes and holds no subject population. NIST SP 800-162
   § 3.1.2.3 records this as a general property of attribute-based systems, so
   the limit is the model's and not this implementation's. § 2.3.
5. `diffMatrix` reports access granted and access withdrawn, in the document's
   own condition vocabulary, per permission. The added allow branch is itself
   the statement of what was granted, so the common case needs no solver and no
   enumeration. § 3.1.
6. The diff over-approximates in the widening direction on purpose. A grant it
   cannot rule out is reported as a grant. § 3.2 names the four things it
   cannot derive and § 3.3 the one optional check that removes the largest class
   of false positives.
7. The diff reports a fourth finding beside granted, withdrawn and
   undetermined: a change in which `object.*` paths a decision reads. Measured,
   one added deny rule turned a decisive `allow` into `unevaluable` naming
   `object.locked`, which breaks every caller that decided without the row.
   § 3.4.
8. The test kit ships, decided by the owner. The enterprise-specific obligation
   it carries is the direction of the assertion: a consumer asserts against the
   producer's published contract fetched in CI, and never against a fixture
   matrix it wrote. A fixture matrix is the second copy the contract exists to
   remove. § 4.
9. Audit logging is an application concern, decided by the owner. The library
   offers an observation seam and no subsystem. § 5.
10. A plugin may observe and may never change an outcome. The line holds, and it
    needs one enforcement the words alone do not give: the event carries no
    reference to the caller's subject or object bag, because those are not
    frozen and a hook holding one could mutate what a later condition reads.
    § 5.3.
11. The observer may return `void` or a promise, and the engine never awaits it.
    A hook able to block a decision turns observability into an availability
    incident: an audit transport taking 40 ms would stall a 0.56 microsecond
    call. Measured, the async guard costs 0.15 microseconds against 0.02 for the
    synchronous one. § 5.5.
12. The engine catches a synchronous throw and attaches a rejection handler to a
    returned promise, and neither reaches a decision. A throw out of a guard is
    a 500 or a fail-open depending on who catches it, an unhandled rejection
    ends a Node process by default, and `parseMatrix` promises an evaluator that
    never throws. § 5.6.
13. A caught observer failure reports through `warnOnce`
    (`libs/widget/src/warn.ts:22-27`) by default and through an optional
    `onObserveError` callback when one is supplied. `warnOnce` alone is
    insufficient because it returns early under `NODE_ENV=production` (`:23`),
    which is the environment where an audit gap matters. Warning per call is
    refused: it floods the log the hook is failing to write to. § 5.6.
14. The event follows the call and not the permission, and the async hook makes
    that decisive. Measured, the per-decision shape puts 500 promises in flight
    for one `capabilities()` call and the per-call shape puts one, and the
    engine bounds neither because it never awaits. § 5.6.
15. Three hook shapes are refused: one that blocks the decision path, one
    contributing rules, and one whose result the engine awaits.
    `applyDenyOverlay` already exists as the reviewable way for a second party
    to change an outcome. § 5.7.
16. The seam observes and supplies nothing. A plugin adding `subject.tier` or
    `object.shop` at evaluation time is refused, and the sharpest reason is
    measurable: an absent `subject.*` path decides `FAILS`
    (`conditions.ts:183`), so a consumer holding the contract and no plugin
    refuses everything the injected field gates, silently and with no `missing`
    naming the cause. Unloaded data is what `unevaluable` and `missing` answer,
    and a derived field is written at the call site. § 5.8.
17. `Rule.id` is a defect to repair before publication. The builder emits no id
    (`authoring.ts:81-86`) so `ruleId` falls back to a position
    (`evaluate.ts:5-7`). Measured, one rule kept its conditions and moved from
    `#0` to `#1` when a branch was added above it, so a log line naming `#0`
    names a different rule in each version. § 5.4.
18. Staged rollout of a policy version is not this library's to build. It holds
    one document handed to it and fetches nothing, so staging belongs to the
    endpoint a consumer fetches from. The local half worth offering is a shadow
    evaluation over two documents. § 6.
19. Authoring at scale is a modelling question with a measured payload attached.
    500 permissions serialize to 204 KB and reduce to 48 KB at one public
    permission in four. `serialize('reduced')` bounds the wire, `federatedPolicies`
    bounds the document, and § 3's diff bounds the review. § 7.
20. Multi-tenancy is one document with a tenant condition, written as `eq` with
    a `path` comparand and measured working. One document per tenant is refused
    for composition: `federatedPolicies` indexes permission keys, so two tenant
    documents collide on every key they share. § 8.
21. An auditor gets the document at a version, the change history from git, and
    per-consumer decision records from the observation seam. Five of NIST SP
    800-53 AU-3's six content fields come from the event; the sixth is the
    subject identity, which decision 10 keeps out deliberately and the caller
    supplies through a correlation value. § 9.
22. Nine features are refused on purpose beyond decision 15's three, including a
    remote decision endpoint, a decision cache, a reverse-index query and an
    administration interface that writes the matrix. § 10.
23. Ship the refusal list as documentation first. Repair the rule ids. Then the
    diff and the test kit the owner approved. Everything else waits for a user
    with a name. § 11.
24. The public matrix explorer takes a pasted document or an uploaded JSON file,
    and no URL parameter. § 13 records the owner's reasoning and the one
    consequence worth naming for an enterprise reader.
25. A shipped explorer is headless, in its own package, with styled variants as
    further packages. § 13.

Decision 6 is the one to argue with, because a report that over-approximates too
often is a report nobody opens. Decision 10 is the one the owner's own line
needs added to it. Decisions 11 and 14 are the ones where the obvious
implementation is wrong in the same direction, because both would put the hook's
behaviour in front of the caller's. Decision 16 is the one where a sound-looking
exception exists and § 5.8 works it through. Decision 17 is cheap now and a
format break after publication.

## 1. What this architecture serves well

**One definition of the rules, held by many services.** A service authors a
matrix, publishes the reduced serialization, and its consumers adopt it with
`parseMatrix`. `2026-09-16-published-policy-contracts.md` § 6 states the
correctness property: a contract's decision for a public key equals the owner's
decision for that key. What an enterprise otherwise reaches for is a copy of
somebody's rules in somebody else's repository, and that copy diverges at the
first change nobody propagates.

NIST SP 800-53 Rev. 5 AC-24 permits this shape explicitly. Its discussion says
that access control decisions and access enforcement need no common entity, and
that in distributed systems different entities make the decisions. AC-24(1)
covers the transmission of authorization information so decisions can be
enforced at the appropriate locations, which is what a published contract is.

**A decision that holds while the network does not.** `decideResolved` reads
`permission.rules`, `permission.denyRules` and the settled context
(`evaluate.ts:129-199`). Nothing fetches. A service whose authorization server
is unreachable goes on deciding correctly against the document it holds until
its freshness budget expires, at which point it refuses. Measured, one decision
over a 200-permission document takes 0.55 microseconds, so the per-request
budget an enterprise usually spends on an authorization round trip goes unspent.

**Replay.** Evaluation is pure in the document and the arguments, so anybody
holding the document at version V reproduces a decision exactly. A central
service answers "what did you decide" from its own log and is the only party
who can. Here the auditor, the consumer and the owner each recompute the answer
independently, provided the version names bytes. § 9 says what that proviso
obliges.

**A trust boundary that stays put.** Every layer re-evaluates. A browser's
evaluation toggles visibility, a gateway refuses loudly, and the service owning
the row decides for real. No layer's answer is carried forward as an assertion,
so no layer's compromise grants access downstream. This is why a stale consumer
over-shows and never over-grants
(`2026-09-16-published-policy-contracts.md` § 13).

## 2. What it serves badly, or not at all

### 2.1 Revocation latency

A consumer holding a frozen document learns of a revocation at its next
successful freshness validation. Between the owner's change and that validation,
the consumer decides on the old document. `expiryOf`
(`hydrate-policy.ts:187-205`) bounds the window at
`fetchedAt + min(matrix.maxStale, options.maxStale)`, and past that instant
every key answers `stale-contract`.

Measured, with `maxStale: 1000` and `fetchedAt: 0` at a settled clock of 5000: a
key the document holds answers `stale-contract`, a key it does not hold answers
`stale-contract`, and `capabilities()` answers `stale-contract` for every entry.
`readsObject` goes on answering true, because it states a fact about the
document and no fact about the present.

So `maxStale` is the floor on revocation latency, and no tool in this library
lowers it. An owner who needs a revocation to take effect within one second sets
`maxStale` to one second, and every consumer revalidates at that rate.
`2026-09-16-published-policy-contracts.md` § 13 works out what makes that
affordable, which is a version probe separate from the payload, and leaves push
versus poll open. Neither changes the shape: a consumer that has not
revalidated decides on old bytes.

Two enterprise cases separate here and a deployment that confuses them will set
`maxStale` far lower than it needs.

A terminated employee's access is revoked at the identity provider, and that
revocation reaches the subject. `subject.roles` stops carrying the role, and
every consumer resolving a fresh subject refuses immediately, whatever the
document's age. Revocation through the document is for a change of rule.

Break-glass access has the same shape with the worse direction. An emergency
grant written into the document takes up to `maxStale` to reach a consumer,
which is the wrong latency for an incident. An enterprise doing break-glass here
puts the emergency role on the subject and the condition in the document, so the
document names the role it will honour and never the person.

### 2.2 Relationship-based access

"Is this document in a folder this user's team owns" has no expression in this
format, and the refusal arrives at construction.

Measured: a condition on `object.folder.teamId` throws
`InvalidConditionError`, with the message `permission "doc.read": condition
rules[0].when[0] on "object.folder.teamId" nests below its scope: a path reads
one field of a scope, so at most one dot is resolvable`. `readPath`
(`conditions.ts:78-80`) splits at the first dot and reads the remainder as a
single key off the scope bag, so even without the validator the nested form
would look for a field literally named `folder.teamId`.

`ObjectSchema.relations` exists (`types.ts:180-183`) and its own docblock states
the division: a relation names the kinds a kind points at, one hop, and a
condition cannot compare one because a relation is no value. It is declared for
the consumers that resolve it.

That division should stay. Traversal needs the graph, the graph is absent from
the document, and fetching it mid-decision is the network call the owner
refused. A caller who has already resolved the hop passes the result as a flat
field, and `object.teamId` on a loaded row is an ordinary condition that decides
correctly. What the library cannot do is traverse for a caller who has not.

What a user needing the real thing reaches for is a Zanzibar implementation,
where a relationship tuple is the primitive and the graph walk is the engine's
job. § 12 covers SpiceDB and OpenFGA and names their deploy-time cost, which is
a service plus a database plus a network call per check. A user weighing the two
options is weighing exactly that.

The line for the public documentation: this library decides on attributes a
caller already holds, and an answer that depends on walking a hierarchy the
caller does not hold belongs to a different library.

### 2.3 The question that cannot be asked

An access review asks who can approve a refund. A matrix answers that a subject
whose `roles` contains `approver` and whose `tenantId` equals the order's can.
Turning the second into the first needs the subject population, which the
document does not carry and the engine never sees.

This is no gap a tool closes, because the missing input is an identity
directory. NIST SP 800-162 § 3.1.2.3 names the same limit for attribute-based
access control generally, calling the review of who holds access before any
request is made a before-the-fact audit, often necessary for demonstrating
compliance, and adding that "An ABAC system may not lend itself well to
conducting these audits efficiently". The same page says determining who can
reach an object may require simulating the request for every known subject.

So a user who came here from a role-based system and expects a role-membership
report is going to want one, and the honest answer names the directory as the
place the join happens. What this library contributes to that join is a
machine-readable statement of the conditions per permission, which is the
document.

The inverse question is answerable and is the better evidence: what gated this
permission on 3 March is the document at the version deployed on 3 March. § 9
takes it up.

### 2.4 One stream of every decision

A central policy service sees every question and logs it in one place. This
library sees the questions one process asks, in that process. N consumers
produce N streams, and a question nobody asked produces nothing.

The second half is the one that matters. A caller who skips the check entirely
leaves no trace, so an absence of records is no evidence that no access
occurred. A central service has the same hole whenever an enforcement point
fails to call it, and there one party owns the call count and can see the hole.
Here nobody does.

NIST SP 800-53 AU-2 asks an organization to give "a rationale for why the event
types selected for logging are deemed to be adequate". For a deployment on this
library, that rationale has to state which call sites are instrumented and why
the uninstrumented ones do not matter, because the library cannot state it for
them. § 9 is the rest of the answer and § 5 is the seam.

## 3. `diffMatrix`, reported as access

The owner approved the diff. What is open is what it reports, and a line-by-line
document diff is not it. A reviewer wants a sentence of the form "this deploy
lets any subject whose `roles` contains `operator` reprice a listing". This
section works out how much of that is derivable.

### 3.1 The added branch is the grant

Two properties of the engine make the common case free.

`sideOutcome` (`evaluate.ts:64-93`) is monotone in its rule array: appending
rules moves a side along `fails -> unevaluable -> unusable-clock -> matched` and
never back. `applyDenyOverlay`'s docblock (`deny-overlay.ts:58-70`) derives the
overlay's subtract-only property from it, and `serialize`'s
(`serialize.ts:111-120`) derives the contract's equality property from it. The
diff is the third consumer.

**Appending an allow rule cannot remove an allow.** `allowed: true` is reached
only at the fifth step of the precedence order, which requires
`deny.state === 'fails'` and `allow.state === 'matched'`. An added allow rule
changes no deny rule, and a side that matched goes on matching whatever is
appended. The allowed set grows or stays. Measured: a subject with
`role: 'admin'` and no ownership answered `no-rule-matched` against one rule and
`{ allowed: true, reason: 'allow', rule: 'admin' }` against the same permission
with an admin rule appended.

**Appending a deny rule cannot add an allow.** `allowed: true` requires
`deny.state === 'fails'`, and a deny side that was not `fails` cannot become
`fails` by gaining a rule. The allowed set shrinks or stays.

The second property is the builder's output shape. `toBranches`
(`authoring.ts:67-78`) emits disjunctive normal form, one rule per branch, with
the branch's conditions AND-ed inside it. A permission's allow side is therefore
a disjunction of conjunctions over `subject.*`, `object.*` and `now`.

Put those together. When `rules_after` contains `rules_before` plus a set of new
branches, the access newly granted is contained in the disjunction of the new
branches, and the new branches are conditions an author wrote. The report is a
rendering of those conditions. Nothing is enumerated and nothing is solved.

The rendering is what turns a condition list into the reviewer's sentence. Split
each branch's conditions by scope:

- conditions on `subject.*` describe who gained the access;
- conditions on `object.*`, including a `path` comparand naming the subject,
  describe which rows;
- `before` and `after` on `now` describe the window.

A branch ANDing `subject.roles contains 'operator'` with
`subject.tenantId eq object.tenantId` renders as: any subject whose `roles`
contains `operator` may now `reprice` a `listing` whose `tenantId` equals the
subject's. That is the sentence, produced by a template over three condition
groups, with no inference in it.

The withdrawn side reports the same way off added deny branches. A removed
permission withdraws whatever it granted, and a removed branch withdraws
whatever that branch granted, both subject to § 3.2's over-approximation.

A removal needs one qualification stated where a reviewer will see it.
Measured, removing a permission answers
`{ key: 'doc.read', allowed: false, reason: 'unknown-action' }` for a
`parseMatrix` holder and throws `UnknownObjectKeyError` with the message
`object kind "doc" is not configured in this matrix` for a `hydratePolicy`
holder. The first is a withdrawal. The second is a crash, and the diff reports
it in those words for open-mode holders, because two audiences need different
sentences for one edit.

### 3.2 What the diff cannot derive

Four limits, each stated so a reviewer knows what the silence means.

**How many people that is.** The report names a condition and never a headcount.
`subject.roles contains 'operator'` might describe two people or two thousand,
and the difference lives in the directory. § 2.3 is the general form. A
consequence worth naming: the report cannot rank findings by blast radius, so
every widening is presented at equal weight and the reviewer supplies the
judgement.

**Whether the new grant overlaps the old one.** The exactly-new set is the new
branch minus the disjunction of the old branches, and computing that minus means
negating a DNF, expanding the resulting CNF, and simplifying. That is
exponential in the branch count and the result is unreadable even when it is
small. So the report names the added branch whole and says, in the report, that
some of it may already have been granted. A false positive here wastes a
reviewer's minute.

**Whether the added branch grants anything at all.** A branch ANDing
`subject.role eq 'admin'` with `subject.role eq 'operator'` is unsatisfiable and
grants nothing, and the report calls it a grant. § 3.3 is the optional check
that removes this class.

**What an edited condition did.** A condition changed in place, and a change on
both sides of one permission, are undetermined. The report shows both versions
and classifies neither. This has to be loud. A report that quietly called an
edited condition unchanged would be worse than no report, because a reviewer
would stop reading it.

Field rules are mostly undetermined for a reason already settled elsewhere.
`2026-09-17-acl-wildcard-action.md` § 4 establishes that the name allow-list has
no defined comparison between configurations: `['*', '!price']` and `['title']`
over one field set have no intersection expressible in the syntax, and the
object's field list is absent from the matrix. So a field-rule change is
reported as a change with both versions shown, except where both versions are
literal name lists carrying no `!` entry, where subset and superset are decided
by set comparison.

### 3.3 The satisfiability check, optional and decidable

The condition language is small enough that the false-positive class in § 3.2 is
removable, and this is worth writing down even if the first version omits it.

Per path, a branch's conditions reduce to a small constraint. `eq` with a
literal and `in` restrict the path to a set of values. `ne` and `not-in` remove
values. `contains` asserts the path holds an array containing a value. `before`
and `after` on `now` form an interval. A branch is unsatisfiable when any path's
allowed set empties, when an interval inverts, or when a `contains` meets an
`eq` to a non-array literal on the same path.

The one coupling is `eq` and `ne` with a `path` comparand
(`conditions.ts:124-128`), which relates two paths. Those make the constraints a
union-find over paths with literal sets attached, which is still decidable and
still cheap. Values are compared with `===` at evaluation
(`conditions.ts:200-211`), so literal equality for primitives is exactly the
comparison the checker performs.

`2026-09-17-acl-no-cascade.md` § 4 specifies the same machinery for the cascade
lint it declined to build, describing a syntactic subsumption check over the
flattened rules and calling it conservative in the right direction. The diff
reuses that reasoning with the comparison reversed: subsumption answers whether
the old branches already cover the new one, which is the overlap question, and
satisfiability answers whether the new branch covers anything. Both are
conservative and both fail toward reporting a grant.

Whether either ships in the first version is open. The classification in § 3.1
needs neither.

### 3.4 The fourth finding, which is not about access

Decision 7. A change can leave the allowed set alone and still break every
caller, by changing which paths a decision reads.

Measured. Before: one permission allowing `read` where `subject.role` equals
`admin`, no deny rules. After: the same permission with one deny rule reading
`object.locked`. An admin with no object supplied answered
`{ allowed: true, reason: 'allow', rule: 'r' }` before and
`{ allowed: false, reason: 'unevaluable', rule: 'd', missing: ['object.locked'] }`
after.

No access widened, and `readsObject('doc', 'read')` flipped from false to true
across the edit. A gateway deciding without the row
(`apps/shop-api/src/acl/acl.guard.ts:52-59` is the shape) went from passing the
request to refusing it, and a UI that rendered a control now holds a decision it
must refetch to settle. So the diff reports, per permission, the `object.*`
paths each version reads, and reports a change in `readsObject` as its own
finding. `permissionReadsObject` (`reads-object.ts:23-27`) already computes it.

### 3.5 What the diff needs from the format

A comparison needs a canonical form. Two documents differing only in key order
or in whitespace state one policy, and a report calling them changed is noise.
So the diff carries a canonical serialization, and that serialization is what a
content-digest `version` needs as well. `types.ts:216-219` already invites a
digest by making `version` a string. The two are one piece of work.

## 4. The test kit

The owner approved the kit. This section records what an enterprise user in
particular needs from it, since the ordinary case is a vitest file calling `can`
and needs no library at all. Measured, `hydratePolicy` over a 200-permission
document takes 2.7 ms, so a suite constructing per test spends nothing worth
optimising.

**The direction of the assertion is the part that goes wrong.** A consumer
asserts its decisions against the producer's published contract, fetched in CI.
A fixture matrix written by the consumer to stand in for the contract is a
second copy of somebody else's rules, which is the failure
`2026-09-16-published-policy-contracts.md` opens on, and putting it in a test
file makes it no less a second copy. A consumer fetching the contract and
asserting the decisions its UI depends on finds out at the producer's next
release, in its own pipeline.

**A contract's arrival is a version bump, so the kit needs a failure mode for
one.** A consumer pinned to a contract version gets a red build when the
producer publishes, which is the point. The kit should make the distinction
visible between a decision that changed and a key that disappeared, because the
second is a producer breaking a published contract and the first may be
deliberate. `diffMatrix` answers this for the consumer as well as for the owner,
and the kit should hand a consumer the diff between the pinned contract and the
fetched one.

**The freshness path needs a fixture clock.** `expiryOf` reads
`options.fetchedAt` and the document's `maxStale`, and every entry point settles
`now` once. A consumer testing what its UI does at `stale-contract` passes an
instant, which the engine already accepts at every call site. The kit's job is
making that legible enough that a consumer writes the test at all, because
`stale-contract` is the refusal a consumer's UI will meet in production and
never in development.

**A producer's obligation is already specified and the consumer's half is
this.** `2026-09-16-published-policy-contracts.md` § 14 sets the producer's test
obligation, which is that the reduced document decides as the full one for every
public key. The consumer's obligation is the mirror: the decisions this
application renders, asserted against the document the owner published.

What the kit should not become is a second way to write a matrix. A helper that
builds a policy for a test, with a shorter syntax than the authoring builder, is
a second authoring surface whose documents differ from production documents in
ways nobody reviews.

## 5. The observation seam

The owner's position: audit logging is an application concern, and the library
could expose an API to register plugins. This section designs the seam and
pressure-tests the line that governs it.

### 5.1 A plugin may observe and may never change an outcome

The line holds, and three properties of the library are why.

The matrix is the auditable artifact. `2026-09-17-acl-wildcard-action.md` § 8
says matrix review is the only control over an over-broad grant. A plugin
altering a decision makes the document a partial description of the system, and
a review of a partial description controls nothing.

`serialize`'s contract has exactly one property: a contract decides as the owner
decides (`serialize.ts:111-120`). A consumer-side plugin changing decisions
breaks that equality silently, and the producer has no way to detect it.

The library already exports the sanctioned way for a second party to change an
outcome, and it works by rewriting the document. `applyDenyOverlay`
(`deny-overlay.ts:95-144`) takes a `Matrix` and returns a `Matrix`, so a
compliance team's contribution is reviewable, serializable and monotone. A
mutating plugin would be a second path to the same effect with none of those
three properties, and the existence of the first is the argument against the
second.

So the seam is an observer: installed at construction through `AccessOptions`,
synchronous, returning nothing, unable to alter a `Decision`.

### 5.2 What the seam catches that a caller cannot

The case for a hook over `const d = access.can(...); log(d)` is the decisions a
caller never sees individually. Measured against the entry points
(`hydrate-policy.ts:501`, `:546`, `:572`, `:617`), four decide: `can`,
`canMany`, `canFields` and `capabilities`. A caller of `capabilities` receives a
record and typically reads two keys of it. A caller of `canFields` receives a
`FieldDecision` whose per-field map the application reduces to one boolean.

One correction to the case as it was put. `pickAllowedFields`
(`fields.ts:240-257`) decides nothing. It takes a `FieldDecision` the caller
already holds and projects the proposed object through it, and the decision it
projects was made by `canFields`. It does throw `ActionNotAllowedError` when the
action is refused, which is an enforcement event an application may want to
record, and that throw is already visible to the caller at the call site. The
hook's value stands on `canFields` and `capabilities`, and `pickAllowedFields`
is not an example of it.

### 5.3 The enforcement the line needs

Decision 10. "May never change an outcome" needs more than a return type of
`void`, because the engine hands the caller's own objects to the conditions.

`resolveContext` (`conditions.ts:58-64`) copies `ctx.subject` and `ctx.object`
by reference into the resolved context, and `readPath` reads fields off those
bags at evaluation. The matrix is deep-frozen at construction
(`hydrate-policy.ts:23-44`). The subject and the object are not frozen and never
were, because they are the caller's values.

So a hook handed the subject bag can mutate it, and a later condition in the
same `canFields` call, or the next object in a `canMany` loop, reads the mutated
value. The observer would then change an outcome while returning `void`, which
is the exact failure decision 10 forbids.

Two remedies. Cloning the bags per event costs a `structuredClone` against a
0.55 microsecond decision, which is the wrong order of magnitude. The
recommendation is the other one: the event carries no subject and no object at
all.

An event carries the permission key, the action, the `Decision` or the record
the entry point returned, the document `version`, and the settled instant. The
subject identity arrives from the caller, as a correlation value supplied
through `AccessOptions` or through `authorize(subject)`, which already binds a
subject to a handle (`hydrate-policy.ts:640-644`). That value is the caller's
choice, so the caller decides what identifier to record, what to redact, and
what to keep out of a log entirely. The library then holds no subject attribute
it might write somewhere.

The cost is stated plainly: an application that installs an observer and
supplies no correlation value gets records naming no subject, which is § 9's one
missing AU-3 field.

### 5.4 The rule id defect

`Decision.rule` names a rule id, and `ruleId` (`evaluate.ts:5-7`) falls back to
the rule's position when the rule carries none:

```ts
function ruleId(rule: Rule, index: number): string {
  return rule.id ?? `#${index}`;
}
```

The authoring builder never sets one. `toRules` (`authoring.ts:81-86`) maps each
DNF branch to `{ when }` and nothing else, so every authored rule takes the
positional fallback.

Measured, over two documents authored with the builder. One block allowing
`read` on an ownership condition emitted
`{"rules":[{"when":[{"field":"object.ownerId","op":"eq","path":"subject.id"}]}]}`
and the owner's decision named `rule: "#0"`. The same block wrapped in
`p.or(p.eq('subject.role', 'admin'), …)` emitted the admin branch first, and the
identical ownership rule decided as `rule: "#1"`.

A record carrying `rule: "#0"` therefore names a different rule in each version,
and an auditor joining records across a policy change joins them wrongly. The
records look consistent and are not.

Two remedies, and the second is the one to take. The builder could derive an id
from the branch's own conditions, which is stable under insertion and unstable
under an edit to the branch. That is defensible, and it makes every id a hash in
documents humans read and in the `Decision.rule` a UI records.

Or the builder takes an id from the author. `allow(action, ...conditions)` has
no slot for one today, and one `allow` call can emit several branches, so an
author's id needs a per-branch suffix. This is the form to specify: an author
who names a rule `refund-window` gets a record naming `refund-window`, and a
reviewer reading § 3's report sees a name where a position stands now.

Either way the decision belongs before the first release. After it, a document
naming rules positionally and a document naming them stably are two formats, and
every record written under the first is unjoinable to the second.

### 5.5 The hook may be asynchronous, and the engine never awaits it

The owner's correction, and it is right. An observer returns `void` or a
promise, and the engine attaches a rejection handler to the promise and moves
on. `can` stays synchronous and returns at the instant the decision is made.

The reason is the failure a synchronous-only contract creates. An audit
transport that takes 40 ms on a bad day, called from inside `can`, stalls every
decision in the process for 40 ms, and a decision is otherwise a 0.56
microsecond call. A hook able to block a decision turns an observability
feature into an availability incident, and the party who installed the hook is
rarely the party who notices.

So the signature is `(event) => void | Promise<unknown>`, and the engine's emit
is one branch, one call, and a rejection handler when a thenable comes back:

```ts
const result = observer(event);
if (isThenable(result)) result.then(undefined, reportObserverFailure);
```

`then(undefined, handler)` is what attaches the handler, and the derived promise
it returns is handled, so nothing reaches `unhandledRejection`. § 5.6 is what
`reportObserverFailure` does.

The costs, measured over 200,000 iterations after a 2,000-iteration warm-up, on
a 200-permission document, with the emit above wrapped around `can`:

- a bare `can`: 0.56 microseconds;
- `can` with a synchronous no-op observer and the engine's guard: 0.58
  microseconds;
- `can` with an `async` no-op observer, the thenable check and the attached
  handler: 0.71 microseconds;
- `can` with a synchronous observer calling `JSON.stringify`: 0.75
  microseconds.

Three readings. An installed synchronous observer costs 0.02 microseconds of
engine overhead. An async observer costs 0.15, which is the promise the `async`
function allocates plus the handler attached to it, and it is the price of the
guarantee that a slow hook cannot stall a decision. A hook body that serializes
costs more than either, so the number a user should care about is what their
own hook does.

### 5.6 One event per call, and what a failure does

Decision 11 has a second argument now, and the second one is decisive.

The obvious implementation fires the observer inside `decideResolved`, once per
permission decided. Measured, `capabilities()` over a 500-permission document
makes 500 decisions and takes 0.29 ms.

The first argument against it is honesty. The application asked one question,
and an auditor reading 500 records concludes it checked 500 permissions. That is
the inverse of § 2.4's hole: there, decisions nobody asked about go unrecorded;
here, decisions nobody asked about would be recorded as though asked.

The second is backpressure, and it arrives with the async hook. Measured, the
per-decision shape puts 500 promises in flight for one `capabilities()` call,
and the per-call shape puts one. The engine never awaits, so nothing in the
library bounds that number, and under render traffic the per-decision shape
accumulates promises at 500 per call with no signal to anyone. An unbounded
queue nobody can see is worse than a slow hook, because a slow hook shows up as
latency and this shows up as memory.

So the event follows the entry point. `can` emits one event carrying one
`Decision`. `canMany` emits one carrying the array. `canFields` emits one
carrying the `FieldDecision`. `capabilities` emits one carrying the record. Four
entry points, one event each, and the batch is the shape the caller received.

A per-decision event in addition to the batch would give an application nothing
the batch withholds. An application wanting a record per row iterates the array
inside its own hook, at its own concurrency, and the library keeps the fan-out
out of its own loop. So the batch shape is the only shape.

One promise per call still accumulates where the hook awaits IO per call, and
the library cannot bound that because it never awaits. The documented advice is
the shape that works: the hook pushes onto a buffer synchronously and returns,
and the application drains that buffer with a concurrency limit it owns.

**A failing observer is caught by the engine.** A synchronous throw and a
rejected promise are both caught, and neither reaches a decision. Three reasons,
and the first two are the owner's correction to an earlier draft of this
document.

A synchronous throw inside `can` propagates out of the caller.
`apps/shop-api/src/acl/acl.guard.ts:52-59` is the shape: a throw there is a 500,
and a caller who wrapped the guard in a `try` that treats an exception as a pass
has a fail-open. An observability feature that can produce either is not one to
ship.

An unhandled rejection ends a Node process by default since Node 15. A
fire-and-forget hook with no handler attached is therefore a process-level
hazard, and the handler has to be the library's, because the library is the
party that chose not to await.

And `parseMatrix`'s documented promise is an evaluator that never throws. A
member the library offers must not be the way that promise breaks.

**Reporting the swallowed failure.** A silent audit failure is the thing AU-12
exists to prevent, so the catch cannot be the end of it. Three options, and the
answer is a layered pair.

Warning on every call is refused. A hook failing on every decision, at 0.56
microseconds per decision, floods the log it is failing to write to.

`warnOnce` (`libs/widget/src/warn.ts:22-27`) is the default when no error
callback is supplied, keyed on the message so a second distinct failure is still
reported, with `resetWarnings` (`:37-39`) beside it for tests. Its limit is
measured in its own second line: it returns early when `NODE_ENV` is
`production`. So `warnOnce` alone would report nothing in the environment where
an audit gap matters, which settles that it cannot be the whole answer.

So an optional `onObserveError` callback on `AccessOptions` is the production
half, and it replaces the warning when supplied. An application counts,
samples, alerts, and decides whether a failing audit transport should take the
process down. That callback is called inside the same catch, and if it throws,
the engine reports through `warnOnce` and does not call it again for that event.
One level of recovery and no recursion.

The default for an application that configures neither: caught, warned once in
development, silent in production. The documentation has to say that in those
words beside the member, because an operator who reads "audit logging is
supported" and nothing else will assume otherwise.

**Fire and forget loses its last records at exit.** A promise in flight, or a
buffer the application has not drained, is gone when the process exits. On a
rolling deploy every replica loses whatever it had not written. The records most
likely to be lost are therefore the ones around a deploy, which is when a policy
change lands, which is when an auditor looks.

That is the application's to fix, by draining its buffer on `SIGTERM` before it
exits, and the documentation names it at the member, so nobody meets it first
during an incident. A `drain()` on the `Access` was considered and is
not recommended: it would make the library hold the set of pending promises,
which is state an `Access` does not otherwise carry, and every real log
transport already owns a flush that this one would have to agree with.

### 5.7 Three hook shapes refused

**A hook performing IO on the decision path.** The async contract in § 5.5 is
what makes this a refusal and no mere discouragement: an observer doing IO
returns its promise, the engine attaches a handler, and the decision returns
without waiting. What stays refused is an observer that blocks, which a
synchronous hook performing synchronous IO does. A `readFileSync` or a blocking
socket write inside an observer stalls the decision exactly as § 5.5 describes,
and no contract the library can express prevents it. The documentation states
it, and the async form is the remedy offered beside it.

**A hook contributing rules.** A second policy language, invisible to matrix
review, evaluated by code no reviewer of the document reads. `applyDenyOverlay`
is the reviewable form and it produces a document. § 5.1 is the argument.

**A hook whose result the engine awaits.** The inverse of § 5.5, stated as a
refusal so a later reader does not add it as a convenience. An awaited hook
makes `can` return a promise, which makes every caller async and breaks
`capabilities()` in a synchronous render path, and it puts the hook's latency in
front of every decision.

A fourth, from § 5.3: a hook receiving the caller's subject or object bag. It
would let an observer change an outcome while returning `void`.

### 5.8 Injection is refused, and the need is already answered

The owner asked whether a plugin could add data to the subject or the object at
evaluation time, and the answer is no. The seam observes and supplies nothing.
Four arguments, and the first one disqualifies on its own.

**A condition on an injected path makes the document describe a system that
exists only where the plugin is installed.** A matrix naming `subject.tier`
obliges `schema.subject` to declare `tier`, and `assertRulesFit`
(`schema.ts:341`, reached at `:374` for every permission and from
`deny-overlay.ts:129` for an overlay) checks every condition against that
declaration. So the document states that a
subject carries a tier, and no caller passes one. The written artifact is the
thing under review, and a document describing a shape the caller never supplies
is describing something other than the system.

The consequence is measured and it is silent. `evaluateResolved` returns `FAILS`
for an absent path outside the `object` scope (`conditions.ts:183`), so a
condition on `subject.tier` in a process without the plugin decides
`no-rule-matched`. Measured, over a document declaring `tier` in
`schema.subject` and allowing `report.read` where it equals `gold`: a subject
carrying the field answered
`{ allowed: true, reason: 'allow', rule: 'gold' }` and a subject without it
answered `{ allowed: false, reason: 'no-rule-matched' }`, with no `missing`
array and nothing naming the cause. A
consumer adopting the producer's contract through `parseMatrix` and holding no
plugin refuses everything the tier gates, quietly and in the safe direction,
which is the direction that produces a support ticket and never an alert. That
breaks the contract's one property, which is that it decides as the owner
decides (`serialize.ts:111-120`), and `serialize` cannot detect it because it
copies a kept permission byte for byte.

**Injection that fetches anything breaks the constraint the design rests on,**
and fetching is the case that motivates the request. Loading the shop a listing
belongs to, or the tier from a billing service, is a network call inside a
function documented as local, synchronous and total.

**Two calls with identical arguments could return different decisions.** The
doctrine is that each layer evaluates for itself and reaches the owner's answer.
A producer and a consumer agree today because evaluation is pure in the document
and the arguments. An injector makes a decision depend on state neither party
passed, so the consumer's re-evaluation stops being a check on anything. Replay
(§ 1) goes with it, and so does § 9's first audit artifact, because recomputing
a decision from the document and the recorded inputs no longer reproduces it.

**`missing` would start reporting the wrong thing.** It names exactly the
`object.*` paths a decision could not read, so a caller refetches those and asks
again (`evaluate.ts:159-198`). A plugin filling some of them makes the field
under-report, and a caller reading an empty `missing` concludes there is nothing
to fetch while the real shortfall is a plugin the process did not install.

The underlying need is real and the library answers it twice already.

**Data the caller has not loaded** is what `unevaluable` and `missing` exist
for. The engine names the paths, the caller fetches those, the caller asks
again. `apps/docs/components/acl/UnevaluableDemo.tsx` walks a reader through
that loop. Measured in § 8: a tenant condition against a caller holding no row
answers `{ allowed: false, reason: 'unevaluable', missing: ['object.tenantId'] }`,
which names the fetch.

**A derived field belongs to the caller.** `access.can({ ...subject, tier },
...)` puts the derivation at the call site, where a reader of that line sees it,
and it makes the subject evaluated the same value the application logs. § 5.3
keeps the subject out of the observer event for a related reason, and the two
compose: the caller owns the subject, derives onto it, passes it, and records
the identifier it chose.

Where this is genuinely worse than injection: a derivation needed by twenty call
sites is written at twenty call sites, or once in a helper every call site must
remember to use, and a site that forgets refuses silently by the same
`conditions.ts:183` path. That cost is real. It is a cost the repository can see
in a grep, and an injector's equivalent failure is invisible in every repository
except the one holding the plugin.

## 6. Staged rollout

`version` and `maxStale` exist and neither is a rollout mechanism. The library
holds one document handed to it by a caller and fetches nothing, so it has no
endpoint to stage from. Serving version 2 to a tenth of consumers is a property
of the artifact store they fetch from, and it is built the way any other
artifact rollout is built. § 12 records that the products with a staged rollout
all own the distribution channel, which is the part this library declines to
own.

The local half is worth offering second.

**Shadow evaluation.** A caller holds two `Access` values, decides on the first,
and records where the second would have decided differently. Both evaluations
are local calls, neither reaches the network, and the second changes no
behaviour. At 0.55 microseconds per decision, a service deciding twice spends
about one extra microsecond and gets the difference set over real traffic.

That composes with § 3. `diffMatrix` reports statically which permissions
changed and which changes it could not classify; a shadow run reports which of
those the traffic reaches, and with which subjects. A permission the diff calls
undetermined and the traffic never reaches is one an owner can deploy without
reading further.

The shape is small: a function over two `Access` values comparing one query's
two decisions, and a helper comparing two `capabilities()` records. The
recording, the sampling and the alerting belong to the application, because a
library owning them owns a sink and § 10 refuses that.

What a shadow run does not give is a staged rollback. Rolling back is publishing
the previous version, and how fast that reaches consumers is § 2.1 again.

## 7. Authoring at scale

Whether a document with hundreds of permissions is a tooling problem or a
modelling one. Measured first, on the worktree named above, with four actions
per object kind, two allow rules and one deny rule per permission, and one
permission in four marked public:

- 25 kinds, 100 permissions: 40,819 bytes full, 9,679 bytes reduced,
  2.2 ms to construct, 0.83 ms per `capabilities()`.
- 50 kinds, 200 permissions: 81,669 bytes full, 19,329 bytes reduced,
  2.7 ms to construct, 0.87 ms per `capabilities()`.
- 125 kinds, 500 permissions: 204,419 bytes full, 48,329 bytes reduced,
  5.3 ms to construct, 1.28 ms per `capabilities()`.

Construction happens once per process and stays under 6 ms at 500 permissions,
so nobody will notice it. `capabilities()` runs per subject and per render, and
it scales with the whole document where a single `can` scales with one
permission. An application rendering a menu from `capabilities()` over a
500-permission document should cache the record per subject, or ask `can` for
the few keys the menu reads.

The wire cost is 204 KB authored and 48 KB published. `serialize('reduced')`
bounds it, so what a consumer carries scales with the published surface and not
with the producer's internal one. An owner whose contract approaches the
authored document's size has marked too much public, and the numbers make that
visible.

The authoring ergonomics are settled and this document does not reopen them.
`2026-09-17-acl-wildcard-action.md` decision 3 puts `allowEach` and `denyEach`
on the builder so an author writes twelve lines and the document carries
forty-eight permissions, and its § 8 gives the reason the document stays
literal: a grant's diff has to look like a grant.

The remaining cost at scale is review, and § 3 is the answer. Five hundred
permissions produce a textual diff no reviewer reads carefully, and the same
five hundred produce a granted list that is usually empty and occasionally holds
one entry. The wildcard spec's sentence is the one this serves: at 500
permissions an unaided review is not a control over an over-broad grant.

One modelling remedy belongs beside the tooling one. A document past a few
hundred permissions usually holds several services' rules, and
`federatedPolicies` is the split: one document per origin, each with its own
version and freshness budget, composed by a routing table over exact keys
(`federated-policies.ts:71-86`). Smaller review per document, smaller payload
per consumer, and the collision check the constructor already performs.

## 8. Multi-tenancy

One document with a tenant condition. Not one per tenant.

The condition is expressible today. `comparandPathOf`
(`conditions.ts:124-128`) allows `eq` and `ne` to compare two paths, so
`subject.tenantId eq object.tenantId` is an ordinary condition. Measured, over a
permission whose allow rule ANDs that comparison with
`subject.roles contains 'reader'`:

- a reader in `t1` against an object in `t1`:
  `{ allowed: true, reason: 'allow', rule: 'same-tenant' }`;
- the same reader against an object in `t2`:
  `{ allowed: false, reason: 'no-rule-matched' }`;
- the same reader with no object supplied:
  `{ allowed: false, reason: 'unevaluable', missing: ['object.tenantId'] }`.

The third line is what makes this safe and not merely expressible. A caller who
has not loaded the row cannot pass the tenant check by accident, because the
engine refuses and names the path it needs.

One document per tenant fails on composition and on operations.
`federatedPolicies` indexes every member's permission keys and throws
`OriginCollisionError` on a key two members claim
(`federated-policies.ts:77-86`), so two tenants holding `order.read` cannot sit
in one federated set. They can sit in separate `Access` values a caller selects
between, and then an operator holds one document, one version and one freshness
budget per tenant. At a hundred tenants that is a hundred publication pipelines
for rules that are usually identical.

Per-tenant documents earn their cost where tenants genuinely hold different
rules, which describes an enterprise product with per-customer policy. There the
caller constructs one `Access` per tenant and holds them in a map, and nothing in
the library objects.

### The lint worth specifying

The failure a tenant condition has is an author forgetting it on one permission,
and nothing detects that. The permission grants across tenants, it validates, it
serializes, and § 3's report calls it an ordinary new grant, correctly, because
it is one.

The check that catches it declares the invariant and infers none: a
configuration names object kinds and, per kind, a condition every permission on
that kind must carry on its allow side. A permission omitting it fails by name.

This is not the lint `2026-09-17-acl-no-cascade.md` § 4 declined. That one had
to know which implications an author intended, and nothing in a matrix says so,
which is why a declaration of the pairs would have been `dependsOn` under
another name. Here the declaration is the feature: the author states that
`order` is tenant-scoped, and the check searches the flattened rules for a
condition tuple. Conservative in the same direction and for the same reason: two
semantically equivalent conditions written differently do not compare equal, so
the check reports a permission that is in fact fine, and a reviewer reads one
finding.

It is not worth building before a multi-tenant user exists. § 11.

## 9. What an auditor needs

A compliance reviewer asks four things about an access control. This
architecture answers three from artifacts it already produces, and the fourth is
§ 2.3's.

**The control's definition at a point in time.** The document at the version
deployed then. This is stronger evidence than a screenshot of an administration
console, because it is the exact input the engine read and it is bytes. It
depends entirely on `version` naming bytes, which § 3.5 makes computable and
which `types.ts:216-219` already invites.

**Evidence that changes were authorised.** The matrix is source, so the change
history is git: an author, a reviewer, a timestamp and a diff per change. An
enterprise usually assembles this out of a console's audit log, where the
reviewer is whoever the console says. Here it is the repository's ordinary
review record, which is what most frameworks are asking for, and § 3 is what
makes the diff column readable.

**Evidence that the control operated.** The observation seam. NIST SP 800-53
AU-3 requires an audit record to establish what type of event occurred, when,
where, the source, the outcome, and the "Identity of any individuals, subjects,
or objects/entities associated with the event". Against § 5.3's event:

- what type: the permission key and the action, from the event;
- when: the settled instant, which every entry point already settles once;
- outcome: `allowed` and `reason`, from the `Decision`;
- source: the process, which the application's logger supplies;
- where: the same;
- identity: absent from the event by decision 10, and supplied by the caller as
  a correlation value.

Five of the six arrive from the seam. The sixth is deliberately the caller's,
because a library holding a subject identifier is a library that might write one
somewhere the application did not choose. An application installing an observer
and supplying no correlation value produces records that fail AU-3, and the
documentation has to say so in those words.

Three structural limits stand whatever the seam does. Records exist only for
questions asked, so AU-2's rationale for adequacy has to name the instrumented
call sites (§ 2.4). N consumers produce N streams, which a log aggregator joins;
`@evanion/nestjs-correlation-id` already exists in this repository for the
correlation half. And the seam is fire-and-forget (§ 5.5), so a record in flight
at process exit is lost, which puts the gap at every deploy boundary. An auditor
asking why a window of records is missing is asking about a rolling restart, and
the application's drain on `SIGTERM` is the answer. A deployment presenting
these records as complete without that drain is presenting something it has not
checked.

**A list of who had access.** Not answerable. § 2.3, with NIST SP 800-162's
concurrence that this is an attribute-based-access-control property and not this
library's failing.

Is the whole sufficient? For change management, yes, and arguably better than a
central service recording a console edit, because the policy change passed
review before deployment. For proving no unauthorised access occurred, no, and
that was never within a policy library's reach. That proof lives in the
enforcing service's logs, and under this doctrine the enforcing service is the
one owning the row and re-evaluating. A consumer's decision was never the
boundary (`2026-09-16-published-policy-contracts.md` § 13), so a consumer's
records are UI evidence and the owner's records are access evidence.

The one thing to add to the documentation and not to the library: a statement of
which record is authoritative. Without it, an enterprise will collect a
browser's decisions and present them as an access record.

## 10. What should not be built

Nine refusals beyond § 5.7's three hook shapes and § 5.8's injection, each with
the property it would break.

1. **A remote decision endpoint, a sidecar or a PDP service.** The owner's
   constraint. Every property in § 1 follows from a decision being a local
   function call, and the first feature reaching the network mid-decision makes
   all of them conditional on the network.
2. **Relationship traversal or a graph walk.** § 2.2. It needs the graph, the
   graph is absent from the document, and fetching it mid-decision is refusal 1
   arriving by another route. `ObjectSchema.relations` stays a declaration for
   the consumers that resolve it.
3. **A fetcher, a poller or a loader taking a URL.** The consumer fetches and
   hands the document in. A library taking a URL holds a network call one
   function away from the decision path, and the first caller constructing
   inside a request handler puts it in that path.
4. **A push revocation channel.** It would collapse the staleness window and add
   a delivery mechanism whose failure is silent: a consumer that missed a push
   believes it is fresh. `2026-09-16-published-policy-contracts.md` § 13
   measures the budget from the last successful validation for that exact case,
   and a push the budget still backstops is a transport the consumer builds.
5. **A decision cache.** A decision takes 0.55 microseconds. A cache adds a key
   to get wrong, a staleness window inside the process, and a second place a
   revocation has to reach.
6. **A decision sink, a log transport or an audit shipper.** § 5 gives the seam
   and stops there. The application's logging stack already holds retention,
   redaction and a destination.
7. **A reverse-index query: which subjects can do X.** § 2.3. It needs the
   subject population, and a library acquiring one holds a copy of the identity
   directory, which diverges.
8. **An administration interface that writes the matrix.** The document would
   change outside review, and review is the only control over an over-broad
   grant. An interface that opens a pull request is a different thing and
   nobody's objection.
9. **A per-consumer freshness override that extends the owner's budget.**
   `expiryOf` takes `min` of the two for the reason stated at
   `hydrate-policy.ts:170-177`: a consumer choosing its own bound optimises for
   its own availability, which is the wrong party's interest. Tightening stays
   allowed.

Refusals 1, 2 and 7 are the ones a user will ask for, and each is better
answered by naming the other tool than by half-building it here. § 12 names the
tools.

## 11. Sequencing

`@evanion/acl` is unpublished and has no users. The recommendation is to build
almost none of this.

**Day one, and two of the three are documentation.**

The refusal list. A user evaluating this library needs to know on day zero that
relationship-based access has no expression here, that revocation is bounded by
`maxStale`, and that "who can do X" is a question for the directory. That costs
an afternoon and saves a user a month spent on the wrong foundation. It is the
highest-value item in this document.

Stable rule ids (§ 5.4). Cheap now and a format break after publication, and
every audit claim in § 9 rests on them.

A statement of which record is authoritative (§ 9), so an enterprise does not
present a browser's decisions as an access record.

**Next, the two the owner approved.** The test kit, scoped as § 4 describes,
with the consumer-side direction as its documented obligation. `diffMatrix`
with § 3.1's rendering, § 3.4's fourth finding, and neither optional check from
§ 3.3. Its canonical serialization is also what makes `version` a content
digest, so those two land together and § 9's first artifact becomes real.

**Waiting for a named user.** The shadow evaluator (§ 6), the tenant lint (§ 8),
the satisfiability and subsumption checks (§ 3.3), and anything in § 12 nobody
has requested. Each has a trigger: the shadow evaluator when an owner is afraid
of a policy change, the lint when a multi-tenant deployment exists, the
satisfiability check when a reviewer reports the false positives as noise.

**The case against more now.** `2026-09-17-acl-no-cascade.md` § 4 declined to
specify a lint partly because nothing in the repository declared the pairs it
would check, so the lint's first test case would also have been its first user.
That argument holds for every item above. The diff answers it, because its four
findings are derived from the engine's own properties and are sound for whoever
reads them. The shadow evaluator and the tenant lint are designed against an
imagined operator, and an imagined operator is the thing most likely to be wrong
about which line of a report they read first.

## 12. The landscape, read for this document

Fetched from each product's own documentation on 2026-09-21. The page is named
beside each claim. Two sources could not be reached and are named at the end.
What matters here is the deploy-time requirement, because it decides which of a
product's tools this architecture could host, and the operational tooling,
because that is the subject.

**Open Policy Agent.** A policy-as-code engine evaluating Rego and returning
arbitrary JSON. Four integration shapes on `openpolicyagent.org/docs/integration`:
a REST daemon or sidecar, a Go SDK, the `rego` library, and compiled
WebAssembly. Its own page says to "Deploy OPA as a host-level daemon or sidecar
container". Operationally it is the richest of the nine. Decision logs
(`/docs/management-decision-logs`) POST gzipped batches to a remote service and
support masking through JSON Pointers, drop rules and a per-second rate limit.
Bundles (`/docs/management-bundles`) carry a `revision` string in a manifest,
support ETag caching and long polling, ship delta bundles as JSON Patch for data
only, and verify per-file hashes from a JWT signature. Status reporting
(`/docs/management-status`) sends the active bundle revision and activation
errors per instance. Discovery (`/docs/management-discovery`) lets an instance
receive its own configuration from a Rego policy evaluated against its labels,
which is the fleet and per-region lever. `opa test`
(`/docs/policy-testing`) runs `test_` rules with coverage, mocking through
`with`, and a `--fail-on-empty` flag for CI. The OPA Control Plane
(`/docs/ocp`) builds bundles from Git repositories, injects organization-wide
policies by label selector, and publishes to object storage.

The part relevant here: OPA's bundle machinery is a distribution system, and
`@evanion/acl` declines to own distribution (§ 10, refusal 3). Its decision-log
subsystem is what § 5 declines to build. Its `revision` string is what § 3.5's
content digest does for a matrix, with the difference that OPA's revision is a
label a build assigns and a digest is computed from bytes.

**Cerbos.** A stateless PDP evaluating YAML resource and principal policies,
deployed as a service, a sidecar, a DaemonSet or on serverless
(`docs.cerbos.dev/cerbos/latest/deployment/`), with the sidecar recommended on
Kubernetes. Audit logs (`/configuration/audit`) split into access records and
decision records correlated by a call id, with a file backend, an embedded
queryable store defaulting to seven days, Kafka, and a hosted sink. `cerbos
compile` (`/policies/compile`) validates and runs YAML tests with shared
fixtures, filtered by suite, principal or action, and has GitHub Actions for CI.
Cerbos Hub (`docs.cerbos.dev/cerbos-hub/`) adds a control plane that signs and
distributes a "compact encrypted policy bundle", an embedded WASM PDP for the
browser and the edge, fleet management showing which version each instance
serves, and centralized log collection with JSONPath masking before upload.

The part relevant here: the embedded WASM PDP is the closest thing in the nine
to this library's position, and Cerbos reaches it by compiling a policy for a
runtime. A matrix stays a document the runtime reads. The Hub's
fleet view answers a question § 6 leaves to the artifact store, and it answers
it because Hub owns the distribution.

**SpiceDB and AuthZed.** A Zanzibar implementation, a standalone service over
PostgreSQL, MySQL, CockroachDB or Spanner, with a gRPC and HTTP API
(`authzed.com/docs/spicedb/getting-started/discovering-spicedb`). Relationship
tuples are the primitive and the engine walks the graph. `zed validate` plus
validation YAML carrying relationships, assertions and expected relations is the
test story (`/spicedb/modeling/validation-testing-debugging`), with two GitHub
Actions. Consistency is explicit per request
(`/spicedb/concepts/consistency`): a ZedToken is a point-in-time snapshot token
the docs call "the SpiceDB equivalent of Google Zanzibar's Zookie concept", and
the four levels run from a cached read to a fully consistent one. The Watch API
(`/spicedb/concepts/watch`) streams relationship changes for audit trails and
cache invalidation, bounded by the datastore garbage-collection window. Audit
logging (`/authzed/concepts/audit-logging`) is an AuthZed product feature
emitting CloudEvents to Kinesis, Pub/Sub or Kafka. Materialize
(`/materialize/getting-started/overview`) precomputes permission sets, which is
the Leopard index of the paper.

This is what a user needing § 2.2 reaches for, and the deploy-time line is the
whole trade: a service, a database, and a check over the network.

**OpenFGA and Auth0 FGA.** OpenFGA implements the Zanzibar model, runs as a
server over PostgreSQL, MySQL or SQLite, and exposes HTTP and gRPC
(`openfga.dev/docs/getting-started/setup-openfga/docker`). Its concepts page
defines a store as the isolation unit: "A store is an OpenFGA entity used to
organize authorization check data", with no cross-store sharing, and an
authorization model is versioned and immutable within a store. Testing is
`.fga.yaml` store files with check, list-objects and list-users tests run by
`fga model test`, with a GitHub Action (`/docs/modeling/testing`). The CLI
manages stores, models and tuples in bulk (`/docs/getting-started/cli`).
Telemetry is OpenTelemetry metrics and traces from the SDK
(`/docs/getting-started/configure-telemetry`) and that page documents no
server-side audit log for the open-source server. Auth0 FGA's product page
(`auth0.com/fine-grained-authorization`) lists immutable audit trails, an
availability SLA and multi-region deployment as its enterprise additions.

The store-per-tenant model is the alternative to § 8's tenant condition, and it
works there because a store is a server-side partition with its own tuples. The
equivalent here would be a document per tenant, which § 8 refuses on
`OriginCollisionError` and on publication cost.

**Google's Zanzibar paper.** Reachable at
`usenix.org/conference/atc19/presentation/pang`, full text at
`usenix.org/system/files/atc19-pang.pdf`. It defines the relationship model
SpiceDB and OpenFGA implement, and its § 2.2 states the consistency problem this
library does not have to solve and could not solve the same way. The new-enemy
problem arises when an ACL update's ordering is not respected, or when an old
ACL is applied to new content, and preventing it needs "external consistency and
snapshot reads with bounded staleness". Zanzibar gets external consistency from
Spanner's TrueTime and hands the client an opaque zookie stored with the
content, so a later check evaluates at a snapshot at least as fresh as the
content version.

Two readings for this design. Zanzibar's zookie and this library's `maxStale`
answer the same class of question and answer it at opposite ends: a zookie
raises the freshness floor for one check against a central store, while
`maxStale` caps how long a local holder may decide on bytes it already has. And
the new-enemy problem has no form here for a structural reason: the document
carries rules and no per-object ACL, so there is no ACL-to-content ordering to
respect. The analogous exposure is § 2.1's, where a stale document over-shows
against a revoked rule.

**Oso and Oso Cloud.** Oso Cloud is a centralized service evaluating Polar over
its own store (`osohq.com/docs`), reached over HTTP or an SDK, with every
authorization check a network call
(`/docs/reference/sdks/authorization-checks.md`). The legacy embedded library is
deprecated with continued critical fixes (`github.com/osohq/oso`). Local
authorization (`/docs/develop/facts/local-authorization.md`) keeps policy
centralized and pushes data local by emitting SQL against the application's own
database. Logs (`/docs/develop/troubleshooting/logs.md`) retain 24 hours on the
free tiers and 30-plus days with search higher up, and the page states "Log
export isn't currently available." Explain
(`/docs/develop/troubleshooting/debugging.md`) shows the facts and rules behind
one decision. Polar carries native `test` blocks with fixtures
(`/docs/reference/polar/tests.md`). Policy Preview
(`/docs/develop/policies/policy-preview.md`, beta) benchmarks a candidate policy
against production, which is a performance gate and no decision diff.

The part relevant here: Explain is the tool § 3's report is closest to in intent
and furthest from in method. Explain answers about one decision using facts the
service holds. `diffMatrix` answers about a version change using conditions the
document states, and it has no facts at all.

**Casbin.** An embedded library, in-process, with no sidecar and no network call
per decision (`casbin.apache.org/docs/overview`; `casbin.org` redirects there).
A `model.conf` and a `policy.csv`, and `e.Enforce(sub, obj, act)` returning a
boolean. Its overview page names what it does not do, including user
authentication and user or role list management. Adapters load and save policy
across SQL, NoSQL, key-value, cloud and file backends
(`/docs/adapters`). Watchers (`/docs/watchers`) propagate a policy change to
other enforcer instances over etcd, Redis, Kafka, NATS and others. The editor is
at `editor.casbin.org`. Logging (`/docs/log-error`) is developer debug
instrumentation, off by default, with no decision store, no retention and no
export. No page was found for policy diffing, staged rollout, built-in
multi-tenancy or a decision explainer.

Casbin is the nearest neighbour by deployment shape, and its operational gap is
the same one this document is about. Its watcher is the push channel § 10
refusal 4 declines, and it works there because a Casbin enforcer holds a mutable
policy set and this library holds a frozen document.

**Permit.io.** A control plane in Permit's cloud and a PDP container in the
customer's network evaluating with OPA or Cedar
(`docs.permit.io/overview/how-does-it-work/`), so decisions are local to the
cluster. OPAL pushes policy and data changes to the PDPs over topic-based
pub/sub. Audit logs (`/how-to/use-audit-logs/types-and-filtering/`) record each
check with timestamp, user, action, resource type, tenant and decision,
filterable by all of those. Debug mode (`/how-to/use-audit-logs/debug-mode/`)
attaches a reason code and a human-readable reason per decision, and the page
warns it increases latency and should be off in production. Forwarding is a
Fluent Bit sidecar with stdout and Elasticsearch outputs
(`/how-to/use-audit-logs/logs-forwarder/`).

The one feature in the nine that answers § 3's question from the other
direction: Audit Log Replay
(`/how-to/use-audit-logs/audit-log-replay/`). `permit test run audit` "runs the
logged checks against a PDP and lists every decision that differs from the audit
log." That is § 6's shadow evaluation performed offline over recorded traffic,
and it needs exactly two things this library would need for the same tool: a
decision record carrying its inputs, and a replayable evaluator. The second is
free here because evaluation is pure. The first is what § 5.3 deliberately
withholds, since the event carries no subject. So an offline replay over this
library's records is possible only where the application's correlation value
lets it reconstruct the subject, and that is the application's choice. Worth
recording as the strongest argument anyone will make for putting the subject in
the event.

**Keycloak Authorization Services.** The Keycloak server is the PDP and a
confidential client becomes a resource server
(`keycloak.org/docs/latest/authorization_services/index.html`). Policies cover
role, group, client, time, regex and JavaScript forms, combined by unanimous,
affirmative or consensus decision strategies. Two decision paths: a requesting
party token carrying permissions, after which enforcement reads the token
locally, or a call to the token endpoint with `response_mode` set to `decision`
for an overall verdict or `permissions` for the granted set. The Evaluate tab is
a simulation tool taking an identity and a context and showing the decision. The
policy enforcer caches path-to-resource associations to avoid server calls
(`keycloak.org/securing-apps/policy-enforcer`). Auditing is admin events, which
record administrative REST invocations per realm with an optional full
representation of the request body
(`keycloak.org/docs/latest/server_admin/index.html`); no per-decision log was
found.

The RPT path is the one shape among the nine that resembles this library's
doctrine and departs from it at the point that matters. A token carrying
permissions is a decision made once and carried forward as an assertion, which
is precisely what "each app in the chain does its own evaluation" refuses. A
matrix crosses the same boundary and stays a rule set, so the receiving layer
decides for itself.

**XACML 3.0** (`docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html`)
supplies the vocabulary the other products use. Its glossary defines the PDP as
the entity evaluating applicable policy and rendering an authorization decision,
the PEP as the entity performing access control by making decision requests and
enforcing decisions, the PAP as the entity creating policies, and the PIP as the
source of attribute values. Its § 2.9 puts distribution out of scope:
"XACML does not describe any normative way to do this."

So the standard that named the architecture declines to say how a policy reaches
a PDP, which is the gap every product above fills with a proprietary bundle
format and this library fills with a JSON document a consumer fetches however it
likes.

**NIST SP 800-162**, the ABAC guide
(`nvlpubs.nist.gov/nistpubs/specialpublications/NIST.SP.800-162.pdf`), § 2.4.3
permits distributed and centralized PDP and PEP placement, describes local
organizations implementing separate PDPs against a centralized policy store, and
§ 2.4 requires policies to be machine-enforceable and published for consumption.
Its § 3.1.2.3 is § 2.3's citation. Its § 3.1.3 warns that a distributed
architecture has consequences for the ability to audit access control decisions,
which is § 2.4's hole stated by a standards body.

**NIST SP 800-53 Rev. 5**
(`nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf`). AC-24
and its discussion permit different entities to decide and to enforce, and
AC-24(1) covers transmitting authorization information so decisions can be
enforced at the appropriate locations. AC-24(2) references SP 800-162 directly.
AU-3 gives the audit record field list § 9 maps the event against, requiring
among other fields the "Identity of any individuals, subjects, or
objects/entities associated with the event". AU-2 requires a rationale for the
adequacy of the selected event types, and AU-12 requires generation capability
on defined components.

### Not reached

- **Styra DAS.** `docs.styra.com` and `www.styra.com` both failed DNS
  resolution, and the archive was blocked by the fetch tool. Nothing about
  DAS decision logs, Stacks, policy impact analysis or staged deployment is
  asserted anywhere above. One observation with no conclusion attached: OPA's
  own documentation now carries an OPA Control Plane section covering bundle
  building, environment promotion and organization-wide policy injection, and
  it does not mention DAS.
- **ISO/IEC 27001:2022 Annex A.** Every `iso.org` URL returned HTTP 403,
  including the ISO/IEC 27002:2022 landing page and the Online Browsing
  Platform. Controls 5.15, 5.18, 8.2 and 8.15 are quoted nowhere above, and
  this document asserts nothing about them.
- **AICPA Trust Services Criteria.** The 2017 criteria with 2022 revised points
  of focus are downloadable free behind an account, and the page carries no
  direct PDF link. The criteria text was not read, so this document asserts
  nothing about which CC-series criteria cover logical access or audit
  evidence, and the commonly cited numbering is deliberately absent above.
- **Cerbos embedded PDP detail page.** Four candidate URLs returned 404. The
  WASM and embedded claims above come from the Cerbos Hub overview only.
- **Auth0 FGA audit log documentation.** Three candidate URLs on `docs.fga.dev`
  served the docs homepage. The immutable-audit-trail claim rests on the
  product page at `auth0.com` alone.
- **Oso open-source documentation.** `osohq.com/docs/oss` returned HTTP 502 on
  three attempts and `docs.osohq.com` redirects to it. The deprecation status of
  the embedded library comes from the GitHub README.

Both research passes ran without web search, because the session's search budget
was exhausted before they started, so every page above was reached by a directly
constructed URL. Pages that exist under names not guessed are therefore absent
from this survey, and the absence of a feature above is weaker evidence than its
presence.

## 13. Recorded beside this, and not analysed here

Two owner decisions about the matrix explorer arrived while this document was
being written. They belong in the record and they are not this document's
analysis.

**The public explorer takes a pasted document or an uploaded JSON file, and no
URL parameter.** The documentation site deploys to GitHub Pages, so a reader's
matrix is evaluated in that reader's own browser and reaches no server the
project owns. The enterprise consequence is worth stating in the explorer's own
page: a matrix is a security artifact, and a reader pasting a production
document into a tool needs to know from the page where the bytes go. A URL
parameter would put the document in a browser history, in a referrer header and
in any proxy log between the reader and the site, and a reader sharing a link
would be sharing the policy without deciding to. The upload form has neither
property.

**A shipped explorer is headless, with minimal embedded CSS and no styling, in
its own package.** Styled variants, including a Tailwind-class one, are further
packages. It sits outside `@evanion/react-acl` so that the binding a consumer
imports for `useCapabilities` carries no explorer and no styles. § 7's
`capabilities()` number is the one measurement here worth carrying into that
package's own documentation, because an explorer rendering a whole capability
record over a large document is exactly the caller that pays it.

## Testing

Nothing here ships, so there is nothing to test yet. What each recommendation
would owe:

- `diffMatrix` owes a test per class in § 3.1, and the discriminating one is
  undetermined: a document whose condition was edited in place must be reported
  as undetermined and never as unchanged, because the silent-unchanged answer is
  the failure the tool exists to prevent.
- `diffMatrix` owes the fourth finding its own test, built from § 3.4's measured
  pair: an added deny rule whose allowed set did not widen and whose
  `readsObject` flipped.
- `diffMatrix` owes a rendering test over a branch carrying all three condition
  scopes, asserting the subject clause, the object clause and the time clause
  come out separately, because a report that merges them stops reading as a
  sentence about who.
- The canonical serialization owes a test that two documents differing only in
  key order compare equal, and one that a document differing in a single
  condition value does not.
- Stable rule ids owe a test that an authored rule keeps its id when a branch is
  added above it, which is § 5.4's measured case with the expectation reversed.
- The observer owes a test that a hook cannot change a decision, written as a
  hook that tries: it mutates every object it is handed and the decision is
  asserted unchanged. That test is what makes § 5.3's event shape a contract,
  which a convention alone does not.
- The observer owes a test that `capabilities()` over an N-permission document
  fires the hook once, because the obvious implementation fires it N times and
  § 5.6 is the argument against.
- The observer owes a test that a synchronous throw from the hook does not
  escape `can`, and that the decision the call returns is the decision the
  engine reached. That is the whole of decision 12 and it is one assertion.
- The observer owes a test that a hook returning a rejected promise produces no
  `unhandledRejection`, asserted by installing a process-level listener and
  finding it silent. Without that assertion the library's handler is a comment.
- The observer owes a test that `can` returns before an async hook resolves,
  written with a hook that never resolves. A test that awaited it would pass
  against an implementation that awaits, which is decision 15's third refusal.
- The failure reporting owes a test per layer: `warnOnce` fires once for a
  repeated failure and again for a distinct one, an `onObserveError` callback
  replaces the warning when supplied, and a callback that itself throws falls
  back to the warning and is not called again for that event.
- § 5.8's refusal owes an assertion over existing behaviour, with no feature
  attached: a document whose condition names `subject.tier`, decided against a
  subject carrying none, answers `no-rule-matched` and carries no `missing`.
  That test exists so a later reader proposing injection meets the
  silent-refusal behaviour as an assertion, ahead of meeting it in a consumer.
- The test kit owes a test of its own freshness fixture: a consumer's assertion
  at `stale-contract` passes only where the engine actually expired, and a kit
  that let a test pass without the budget elapsing would teach a consumer the
  wrong thing about production.
- The shadow evaluator owes a test that it changes no decision, which is the
  only property that makes it safe to run against live traffic.
- The tenant lint owes a test that a permission carrying the tenant condition on
  one of two allow branches fails, because a disjunction skipping the check on
  one branch is the mistake the lint exists to catch.

## The evidence, and what it does not cover

### Measured

By running a throwaway spec in `libs/acl/src` against this worktree at
`8459a54`, Node v24.16.0, macOS 26.6.2, Apple M1 Pro:

- The nested-path refusal and its exact message, an `InvalidConditionError` from
  `validate.ts:159` thrown at `hydratePolicy` for a condition on
  `object.folder.teamId`.
- The widening pair in § 3.1: `no-rule-matched` before the appended admin rule,
  `{ allowed: true, reason: 'allow', rule: 'admin' }` after.
- The fourth-finding pair in § 3.4:
  `{ allowed: true, reason: 'allow', rule: 'r' }` before the added deny rule and
  `{ allowed: false, reason: 'unevaluable', rule: 'd', missing: ['object.locked'] }`
  after.
- The removal pair in § 3.1: `UnknownObjectKeyError` with the message quoted, in
  open mode, and `{ key: 'doc.read', allowed: false, reason: 'unknown-action' }`
  in closed mode.
- The three tenant decisions in § 8, including the `unevaluable` naming
  `object.tenantId`.
- The four `stale-contract` answers in § 2.1, and `readsObject` answering true
  past expiry.
- The rule-id pair in § 5.4: the emitted permission quoted verbatim, and the
  same ownership rule deciding as `#0` and then as `#1`.
- Every number in § 7's list, from one construction and one `capabilities()` per
  size.
- The hot-path numbers in § 5.5, over 200,000 iterations after a 2,000-iteration
  warm-up, with the emit shown in that section wrapped around `can`: 0.56 bare,
  0.58 with a synchronous no-op observer, 0.71 with an `async` no-op observer
  and the attached rejection handler, 0.75 with a synchronous observer calling
  `JSON.stringify`. That document carries one allow rule and one deny rule per
  permission, which is lighter than § 7's, so these figures and § 7's
  `capabilities()` figures come from two documents and should not be compared
  with each other.
- `capabilities()` over a 500-permission document producing 500 entries and
  taking 0.29 ms, on that same lighter document.
- § 5.6's in-flight count. Firing one promise per decided permission for one
  `capabilities()` call over that 500-permission document peaked at 500
  concurrent promises; the per-call shape is one by construction.
- § 5.8's silent refusal. A `parseMatrix` document whose allow rule compares
  `subject.tier` to `'gold'`, with `tier` declared in `schema.subject`,
  answered `{ key: 'report.read', allowed: true, reason: 'allow', rule: 'gold' }`
  for a subject carrying the field and
  `{ key: 'report.read', allowed: false, reason: 'no-rule-matched' }` for a
  subject without it. No `missing`, no error, no difference a caller can see
  from an ordinary refusal.

### Read here, and not run

- `sideOutcome`'s monotonicity (`evaluate.ts:64-93`) and the fifth step of the
  precedence order (`:175-182`), over which § 3.1's two soundness arguments are
  case analyses.
- `expiryOf` and the `min` of the two budgets (`hydrate-policy.ts:187-205`).
- `resolveContext` passing the caller's subject and object by reference
  (`conditions.ts:58-64`), and `deepFreeze` covering the matrix alone
  (`hydrate-policy.ts:23-44`). § 5.3 rests on the pair.
- `pickAllowedFields` taking a `FieldDecision` and deciding nothing
  (`fields.ts:240-257`).
- `assertRulesFit` at `schema.ts:341`, reached at `:374` and from
  `deny-overlay.ts:129`.
- `toRules` and `toBranches` (`authoring.ts:67-86`).
- `federatedPolicies`'s collision check (`federated-policies.ts:77-86`).
- `serialize`'s public filter and schema projection (`serialize.ts:143-164`).
- `ObjectSchema.relations` and its docblock (`types.ts:173-183`).
- The four deciding entry points (`hydrate-policy.ts:501`, `:546`, `:572`,
  `:617`).

### Quoted from a source outside this repository

Each fetched on 2026-09-21, one short quotation per source, with the page named
in § 12: Open Policy Agent's integration page, Cerbos Hub's overview, SpiceDB's
consistency page, OpenFGA's concepts page, the Zanzibar paper's § 2.2, Oso's
logs page, Permit.io's audit-log replay page, XACML 3.0 § 2.9, and NIST SP
800-53 Rev. 5's AU-3. Everything else about a product in § 12 is a summary in
this document's own words of a page named beside it. Casbin and Keycloak are
summarised and not quoted.

### Asserted here and not measured

- That a reviewer reads a granted list where they would not read a textual diff.
  Nobody has reviewed a 500-permission matrix in this repository or anywhere
  this document can cite, with or without a tool. § 7's argument is derived from
  what the two artifacts contain.
- That the undetermined class is rare enough for § 3's report to be worth
  opening. This depends on how often an author edits a condition in place rather
  than adding or removing a branch, and no change history exists to count it
  against. If most changes land as undetermined, decision 5 is weaker than it
  reads and § 3.3's subsumption check stops being optional.
- That § 3.1's rendering produces a sentence a reviewer accepts. The template is
  designed against the example the question was asked with, and one example is
  not a test.
- That 1.28 ms of `capabilities()` per render matters to any application. The
  number is measured; whether a consumer notices it has not been measured
  against `apps/storefront-rsc` or any other renderer.
- That an application will supply a correlation value. § 5.3's event shape is
  safe by construction and § 9's AU-3 gap depends entirely on an application
  doing something the library cannot check.
- That `warnOnce` plus an optional callback is the right pair. An application
  supplying neither gets silence in production, which § 5.6 states plainly and
  which an operator may still miss. A third option exists and I did not take it:
  making `onObserveError` required whenever `observe` is supplied, so silence
  has to be written down. I declined it because a required callback nobody wants
  gets filled with an empty function, and an empty function reads as a decision
  where `warnOnce` reads as a default.
- That an unhandled rejection ending the process is worth designing against at
  all. Node's default has been to terminate since version 15, and an application
  that has installed its own `unhandledRejection` handler is unaffected either
  way. I did not measure how many deployments have one.
- That an author would use a rule id if the builder offered one. § 5.4's second
  remedy assumes so, and a builder slot nobody fills leaves the positional
  fallback in the documents that matter.
- That a first enterprise user reads the refusal list before building. This is
  the most load-bearing assumption in § 11 and it is untested.
- Every claim about another product is what that product's own documentation
  says on the date recorded. No product above was deployed, and no behaviour
  above was observed.

## Where I am guessing

- That the owner's question is about tooling and not about whether this
  architecture suits an enterprise at all. If the second, § 2 is the answer and
  everything after it is premature.
- That a first enterprise user arrives holding one service's rules and no
  existing policy estate. A user migrating from a central PDP arrives with
  decision logs, a review process and an auditor expecting one stream, and § 9
  would then be a migration argument. I have not worked that case.
- That § 3's classification is complete over the changes a document actually
  undergoes. I worked the rule arrays and the permission set. Field rules are a
  second axis and § 3.2 settles only the literal-name-list case, because
  `2026-09-17-acl-wildcard-action.md` § 4 establishes that the general
  comparison has no definition. Which cases escape that I did not work out.
- That § 3.3's satisfiability check is as cheap as it reads. The per-path
  constraints are simple and the `path` comparand couples paths into a union-find,
  and I did not write it or cost it against a real document.
- That `version` naming bytes is a documentation change and no format change.
  `types.ts:216-219` invites a digest and nothing enforces one. If a producer's
  existing version scheme is a release number, § 9's first artifact needs a
  second envelope member and not a convention. I did not cost that.
- That the observer belongs on `AccessOptions` and not on a separate
  registration call. It is the member both `parseMatrix` and `hydratePolicy`
  already thread, and an `Access` is constructed once per process, so it fits.
  An application wanting to install an observer after construction, or two of
  them, would need something else, and I did not design for that case.
- That § 5.8's derivation-at-the-call-site remedy is affordable. A derivation
  wanted by twenty call sites is twenty call sites or one helper every site must
  remember, and I have not counted how many derived subject fields a real
  application wants. If the answer is a dozen, the refusal is still right and
  the ergonomics need a separate document about where a subject is assembled.
- That § 13's URL-parameter reasoning is complete. I named the browser history,
  the referrer and the proxy log. A reader pasting into an uploaded file has a
  file on disk, and I did not work out whether that is better or worse for the
  reader who is worried.
- That the shadow evaluator is the right third tool. It is the one composing
  with the diff, which is why it sits there, and an owner more afraid of a bad
  deploy than of a bad review would order these differently.
