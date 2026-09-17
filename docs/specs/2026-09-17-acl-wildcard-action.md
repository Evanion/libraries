# `all` as a wildcard action

Status: accepted, as a decision not to implement. `create`, `read`, `update`
and `delete` ship as the library's default action vocabulary. `all` does not
ship as an engine wildcard, on the auditability argument in section 8: adding
one action to a vocabulary would widen every wildcard grant through a diff that
names no permission, no rule and no condition, and matrix review is the only
control over an over-broad grant. `allowEach` and `denyEach` on the authoring
builder answer the ergonomic case, writing one ordinary permission per action
so the document still names everything it grants.
Packages: `@evanion/acl`. `@evanion/react-acl` is reached through
`useCapabilities`, which reads whatever `capabilities()` keys. `apps/admin` and
`apps/shop-api` are the two consumers measured below.
Depends on: `libs/acl/src/evaluate.ts` (`decideResolved` and the precedence
order documented above it, which section 1 works the wildcard against),
`libs/acl/src/hydrate-policy.ts` (`permissionFor` at `:417-425`, the exact map
hit that makes a wildcard invisible; `capabilities` at `:543-556`;
`readsObject` at `:427-431`), `libs/acl/src/fields.ts` (`decideFields`, which
reads one permission's `fields`), `libs/acl/src/reads-object.ts`
(`permissionReadsObject`), `libs/acl/src/validate.ts` (`PERMISSION_MEMBERS` at
`:272-280` and the envelope at `:401-402`, which decide what a document may
carry), `libs/acl/src/serialize.ts` (the `visibility` filter at `:124`),
`libs/acl/src/deny-overlay.ts` (`vetoable` and the monotonicity argument at
`:51-62`), `libs/acl/src/federated-policies.ts` (the exact-key routing table at
`:71-80`), `libs/acl/src/authoring.ts` (`Actions.allow` at `:118`, where the
reduced form in section 10 lands), `apps/shop-api/src/acl/acl.guard.ts:52-59`
(the `readsObject` caller section 5 is about), `apps/admin/app/access.ts:105-111`
(the `capabilities` caller section 3 is about),
`docs/specs/2026-09-17-acl-no-cascade.md` (the removal this document's
recommendation has the same shape as, and whose § 6 tightening a wildcard would
partly undo), `docs/specs/2026-09-16-deny-overlay.md` (the `vetoable` contract
section 6 tests the wildcard against),
`docs/specs/2026-09-17-acl-federated-policies.md` (the routing table),
`docs/superpowers/specs/2026-09-14-acl-design.md` (where actions were settled as
plain strings)
Measured against: this worktree at `673ad35`, branched from `feat/acl-demo`.
Every decision, key and thrown error quoted below was produced by running the
package's own test runner over a matrix carrying `game.all`, or by reading the
file named beside the claim. The evidence ledger at the end separates the two.
Prior art: CASL v6, read for this document from `stalniy/casl` at `master`.
The guide pages `guide/intro`, `guide/define-aliases` and
`guide/restricting-fields`, the API page `api/casl-ability`, and the source of
`packages/casl-ability/src/RuleIndex.ts` and `Ability.ts`, which is where the
wildcard is actually implemented and where the docs stop short. Section 9.

## What is actually wrong

`@evanion/acl` has no wildcard, and `permissionFor`
(`hydrate-policy.ts:417-425`) is the whole of why:

```ts
const permission = index.get(`${key}.${action}`);
```

One string, one map. A document carrying `game.all` answers `can(subject,
'game', 'all')` and nothing else. Measured, over a matrix with `game.all` and
`game.read` and no `game.update`:

| Call                            | Open mode (`hydratePolicy`)                      | Closed mode (`parseMatrix`)                    |
| ------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `can(s, 'game', 'update')`      | throws `UnknownPermissionError`                  | `{ allowed: false, reason: 'unknown-action' }` |
| `can(s, 'game', 'all')`         | `{ allowed: true, reason: 'allow', rule: 'r1' }` | same                                           |
| `readsObject('game', 'update')` | throws `UnknownPermissionError`                  | `false`                                        |
| `capabilities(s)`               | keys `game.all` and `game.read`                  | same                                           |

So `all` is an ordinary action today, with an ordinary action's behaviour, and
it happens to be spelled like a promise the engine does not keep. Shipping it in
a default vocabulary is what makes that a trap: an author who writes `game.all`
because the vocabulary offered it gets a permission that grants one literal
action named `all`, and every reader of that matrix reads a grant over
everything.

The second half of the defect is the consumer. `apps/admin/app/access.ts:110`:

```ts
return capabilities[permission]?.allowed === true;
```

An absent key reads as refused. A `game.all` grant therefore hides every menu
item the admin app gates on `game.update`, silently and in the safe direction,
which is the direction that makes the feature useless without making it loud.

## Decisions

The recommendation is not to ship `all` as an engine wildcard. Decisions 1
through 3 are what is shipped; decisions 4 through 14 are what the engine form
would have to settle, written out because a later reader will propose it again
and these are the answers the questions have.

1. `all` is not in the default vocabulary. The library ships `create`, `read`,
   `update` and `delete`. Four ordinary actions, no engine work, and a matrix in
   which every key a reader sees is a key the engine decides. Section 8 is the
   argument. It is about what a reviewer can conclude from a document; the
   engine computes the same answers either way.
2. `all` is not reserved either. `validateMatrix` goes on accepting
   `action: 'all'` as an ordinary action, and a producer whose domain has a
   literal `all` action keeps it. A reservation costs a format break for every
   such producer and buys nothing while decision 1 holds. Section 7.
3. The ergonomic case is answered at authoring time. `Actions` gains
   `allowEach(actions, ...conditions)` and `denyEach(actions, ...conditions)`,
   which write one permission per named action into the same flat list
   `allow()` writes into. The vocabulary is a TypeScript value at the authoring
   site, so nothing has to reach the document, and the document a reviewer opens
   names every action it grants. Section 10.
4. If the engine form is taken anyway, a deny on `game.update` beats an allow on
   `game.all`, and it beats it for the reason step 1 of the existing precedence
   order exists. Section 1.
5. A `game.update` permission layers onto `game.all`. Both permissions'
   `rules` arrays union into the allow side and both `denyRules` arrays union
   into the deny side, and `decideResolved` runs once over the union. Override
   is refused: under override, adding a narrower permission that carries only an
   allow discards the wildcard's denies, so writing a grant widens access
   somewhere the author did not write. Section 2.
6. `capabilities()` expands the wildcard across the vocabulary and emits no
   `game.all` key. A literal key is refused because `apps/admin/app/access.ts:110`
   reads an absent key as refused, so every existing capability consumer would
   silently lose the grant. Section 3.
7. Expansion obliges the document to carry the vocabulary. `Matrix` gains an
   `actions: readonly string[]` envelope member, and `validateMatrix` refuses a
   document that carries a wildcard permission without it. A `parseMatrix`
   consumer adopting such a document takes a format it must now emit, and a
   producer that omits the member gets a refusal at construction, and never a
   narrower answer at decision time. Section 3.
8. A wildcard permission may not carry `fields`. `decideFields` reads one
   permission's config, two `transitions` maps over one field state two
   machines, and `TargetsTransitionsConflictError` already refuses that
   contradiction inside one permission. `validateMatrix` refuses `fields` on a
   wildcard. Section 4.
9. `readsObject(key, action)` answers the union over every permission covering
   that pair. With only `game.all` present and its rules reading an `object.*`
   path, `readsObject('game', 'update')` is true. Section 5.
10. `serialize('reduced')` refuses a document where a public permission is
    covered by an internal wildcard, with a new error naming both keys. The
    contract's one property is that it decides as the owner decides, and a
    published `game.update` whose real deny lives on an unpublished `game.all`
    breaks it. Section 6.
11. `applyDenyOverlay` treats a wildcard key in `vetoable` as what it is: an
    opening over every action the vocabulary covers, including actions added to
    the vocabulary after the list was written. The docs say so at the point the
    owner writes the list. No code change. Section 6.
12. `federatedPolicies` refuses a member document carrying a wildcard, with a
    new error. The routing table is keyed on exact permission keys
    (`federated-policies.ts:71-80`), each member holds its own frozen document
    and its own vocabulary, and a wildcard in one origin would answer for keys
    the table routes to another. Section 6.
13. A wildcard permission's decision names the wildcard's rule id in
    `Decision.rule`, and `Decision.key` stays the key the caller asked for
    (`game.update`). A decision that reported `game.all` would tell a caller it
    asked a question it did not ask. Section 2.
14. No lint infers a vocabulary from a document. The set of actions a wildcard
    covers is exactly the set nobody wrote down, so a check over the permissions
    present cannot recover it. This is the same argument
    `2026-09-17-acl-no-cascade.md` § 4 makes for the cascade lint, and it holds
    here for a smaller reason: the declaration would be the `actions` member of
    decision 7, and a document without one has nothing to check.

Decision 1 is the one to argue with. Decision 5 is the one where both answers
are defensible and the choice is about which mistake stays silent. Decision 7 is
the one that turns a nine-line engine change into a format change. Decision 12
is the one nobody would have found without reading the routing table.

## 1. Where a second permission attaches to the precedence order

The order in `evaluate.ts:106-113` decides one permission:

```
1. a deny rule matches -> denied
2. the allow side definitely fails -> no-rule-matched
3. the deny side reads an unusable clock -> unusable-clock, naming the rule
4. the deny side is unevaluable -> unevaluable, naming the deny rule
5. an allow rule matches -> allow
6. the allow side reads an unusable clock -> unusable-clock
7. the allow side is unevaluable -> unevaluable
8. otherwise -> no-rule-matched
```

Two measured notes on that comment before it is used. The code has seven return
branches, and the eighth step is unreachable: `allow.state` is one of four
values, step 2 takes `fails`, step 5 takes `matched`, step 6 takes
`unusable-clock`, and the final `return` (`:188-193`) emits `unevaluable`
where the comment promises `no-rule-matched`. That is a defect in the
comment and it is independent of this document.

The order also says, at `:103-104`, what it is for:

> Every step reads `permission.rules`, `permission.denyRules` and the context,
> so one decision is answerable from the permission a reader has in hand.

A wildcard breaks that sentence, and the sentence is the thing worth protecting.
Two permissions can answer one query, so a combination rule has to exist
somewhere. There are two places to put it, and only one of them keeps the
sentence true.

The first place is above `decideResolved`: decide `game.update` and `game.all`
separately, then combine two `Decision` values. That needs a second precedence
order over `Decision`, with its own answer for every pair of `denied`,
`no-rule-matched`, `unusable-clock`, `unevaluable` and `allow`. Twenty-five
pairs, of which the interesting ones are the undecided states: a wildcard that
lands on `unevaluable` beside a specific permission that allows has to answer
something, and both answers are wrong in a way the caller cannot see.

The second place is below it: union the rule arrays, then run the existing
`decideResolved` once. Section 2 takes this one, and decision 4 follows from it.
Under the union, a deny rule on
`game.update` is a member of the deny side that step 1 reads, so it decides the
permission before any allow rule is looked at, whichever permission the allow
rule came from. The answer to "does a deny on `game.update` beat an allow on
`game.all`" is yes, and it is yes because the union puts both rules where the
order already reads them, with no new step and no new order.

The union also inherits the rest of the order, which is where its cost is. A
wildcard carrying a time condition puts that condition on the deny side or the
allow side of every action it covers, so steps 3, 4, 6 and 7 start firing for
actions whose own permission reads no clock and no object. An author who writes
one `before` condition on `game.all` has made every game action answer
`unusable-clock` under a clock that does not parse. That is correct behaviour
and it is not obvious from the matrix.

## 2. Two permissions, one query

Decision 5 unions. The alternative is override, where `game.update`, when
present, decides alone and `game.all` is consulted only for actions no
permission names. Both are defensible, and the choice comes down to which
mistake is silent.

Under override, this document grants update to a banned subject:

```json
{
  "permissions": [
    {
      "key": "game.all",
      "object": "game",
      "action": "all",
      "rules": [
        {
          "id": "staff",
          "when": [{ "field": "subject.role", "op": "eq", "value": "staff" }]
        }
      ],
      "denyRules": [
        {
          "id": "banned",
          "when": [{ "field": "subject.banned", "op": "eq", "value": true }]
        }
      ]
    },
    {
      "key": "game.update",
      "object": "game",
      "action": "update",
      "rules": [
        {
          "id": "staff",
          "when": [{ "field": "subject.role", "op": "eq", "value": "staff" }]
        }
      ]
    }
  ]
}
```

The author added `game.update` to say something narrower about update. Under
override they deleted the ban, and nothing in the document says so. Adding a
permission that carries only an allow widened access. Under the union the ban
holds, because `banned` is a member of the deny side that step 1 reads.

The property the union has is the one `sideOutcome`'s monotonicity already gives
the deny overlay (`deny-overlay.ts:51-62`): appending deny rules moves the deny
side along `fails -> unevaluable -> unusable-clock -> matched` and never back.
Under the union, every deny rule any covering permission carries is in the array
`sideOutcome` folds, so no covering permission can weaken another's refusal.
Override has no such property in either direction: the narrower key can drop the
wildcard's denies and its allows at once.

What the union costs, stated plainly. An author cannot carve an exception out of
a wildcard by writing a narrower allow. `game.all` granting everything to staff,
plus `game.update` granting update to authors, means staff keep update and
authors gain it. To take update away from staff the author writes a deny on
`game.update`, and that deny reaches staff only because the union put it on the
same side. An author who reads the wildcard as a default that a specific
permission replaces will write the first form and get the second behaviour.

Decision 13 is the reporting half. `Decision.key` is built from the caller's
arguments at every entry point today (`hydrate-policy.ts:459`, `:482`, `:511`),
so a wildcard decision keeps reporting `game.update`, and `rule` names whichever
rule id decided, which may be a rule id the wildcard permission carries. A
caller that logs `decision.rule` and greps the matrix for it finds the wildcard,
which is the correct place to look.

## 3. `capabilities()` and the vocabulary at runtime

Measured: `capabilities` (`hydrate-policy.ts:543-556`) maps
`frozen.permissions` to `[permission.key, decision]`, so a document with
`game.all` produces the key `game.all` and no other key for that object kind.
Also measured, `apps/admin/app/access.ts:105-111`:

```ts
export function allows(
  capabilities: Record<string, Decision>,
  permission: AdminPermission,
): boolean {
  return capabilities[permission]?.allowed === true;
}
```

`AdminPermission` is a union of literal keys (`:95-103`), so `allows(caps,
'game.update')` against a `game.all` grant is `false`, with no error anywhere.
`libs/react-acl/src/index.tsx:138` hands the same record to `useCapabilities`,
and `libs/react-acl/examples/menu.tsx:23` iterates its entries, so a UI built on
either reads a wildcard grant as an absence.

Three answers were available.

The literal key is what the engine does today. It is safe, because a UI that
hides a control the subject may use is the failure the doctrine already accepts
in a browser, and it makes the wildcard useless for the case it exists for. An
author reaching for `game.all` wants one line to grant the whole kind, and a
capability map that does not carry the grant sends them back to writing the
actions out.

Expansion is decision 6, and its cost is decision 7. The expansion needs the set
of actions to expand over, at runtime, in the process holding the document. A
`Matrix` is `{ version?, maxStale?, schema?, permissions }` (`validate.ts:401`),
every permission member is checked against a closed set
(`validate.ts:272-280`), and nothing in the envelope names an action the
document does not already carry a permission for. So the vocabulary is not in
the document, and it cannot be inferred from it: the actions a wildcard covers
are exactly the actions nobody wrote a permission for.

One shortcut is tempting and it is wrong in the dangerous direction. A
construction site could derive the vocabulary from the permissions the document
already carries. A document with `game.all` and
`game.read` would expand to `game.read` alone, so `capabilities` reports read
and the engine, under section 2's union, goes on allowing `game.update` at
`can`. The map and the evaluator would disagree about the same document. A
consumer that gates a UI on the map and a server that decides on the evaluator
then disagree about the same subject, which is the one thing the shared-document
design exists to prevent.

So decision 7. `Matrix` gains `actions: readonly string[]`, `validateMatrix`
refuses a document carrying a wildcard permission without it, and `capabilities`
emits one entry per `(object kind, action)` pair the vocabulary names, each
decided by section 2's union.

What that costs a consumer who adopts it with `parseMatrix`:

- A foreign producer must emit the member. A document written before this change
  and carrying no wildcard keeps working, because the refusal is conditional on
  a wildcard being present. A producer that adds a wildcard without the member
  gets an `InvalidMatrixError` at `parseMatrix`, which is loud and is at
  construction.
- The member is a second place the vocabulary lives. The producer's own
  authoring vocabulary and the document's `actions` array can drift, and nothing
  detects it: a vocabulary that lost an action shrinks every wildcard grant in
  the document, and one that gained an action widens every wildcard grant in the
  document, with no change to any permission.
- `serialize('reduced')` has to carry the member into the contract, and a
  contract carrying a vocabulary is publishing the names of actions whose
  permissions were dropped as internal. `serialize.ts:59-76` prunes the schema
  to the kinds that survived, for exactly this reason, and the vocabulary has no
  equivalent pruning: dropping an action from the contract's vocabulary changes
  what the contract's own wildcard grants.

That third point is the one that should decide the question for anybody who
takes the engine form. A published contract either leaks the internal action
names or decides differently from the owner, and no projection of the array
avoids both.

## 4. Field rules on a wildcard

`decideFields` (`fields.ts:146-224`) takes one `Permission` and reads
`permission.fields`. Under section 2's union, two permissions can cover one
query and each may carry a `fields` config, so a merge rule would be needed.
There is no sound one.

The name allow-list composes badly. `allowed()` (`fields.ts:69-74`) reads
`['*', '!price']` as "every field except price" and `['title']` as "title
alone", and those two configs over one field set have no defined intersection in
the syntax: the merged list `['*', '!price', 'title']` reads as the first config
with a redundant entry, which is wider than either input. A merge that wrote the
intersection out would need the object's fields, and the matrix does not carry
them (`fields.ts:156-158` says so in the code's own words).

The per-field configs compose worse. Two `transitions` maps for one field state
two machines over one field, and `validateMatrix` already refuses a smaller
version of that contradiction inside one permission:
`TargetsTransitionsConflictError` (`validate.ts:324-326`) rejects a field
carrying both `targets` and `transitions`, because the intended edge set is
undefined. Two `transitions` maps arriving from two permissions is the same
undefinedness with a comma in it.

Hence decision 8. A wildcard permission carries `rules` and `denyRules` and no
`fields`, refused at construction with a message naming the key. The
consequence for an author: field rules are written per action, on the permission
for that action, which is where a reader of that action's field rules already
looks. A wildcard that wanted field rules is a wildcard that wanted to be four
permissions, and section 10 is how it writes them.

## 5. `readsObject` and the NestJS guard

Measured, with only `game.all` in the document: `readsObject('game', 'update')`
throws `UnknownPermissionError` in open mode and answers `false` in closed mode.
Both are wrong once a wildcard means what it says, and the caller is
`apps/shop-api/src/acl/acl.guard.ts:52-59`:

```ts
const decision = this.access.can(subject, required.key, required.action);
if (decision.allowed) return true;
if (this.access.readsObject(required.key, required.action)) return true;
throw new ForbiddenException(decision.reason);
```

Work the false answer through. The wildcard's rules read `object.ownerId`, so
`can` at the guard, which holds a subject and no row, answers `unevaluable`.
`readsObject` answers false, and the guard throws `ForbiddenException`. A
request the service would have allowed after loading the row gets a 403 at the
guard, and the reason string on it is `unevaluable`, which reads to the client
as a bug report. The guard over-refuses, and it does so for every
object-dependent wildcard grant.

The true answer has the opposite failure. If `readsObject` answered true where
no covering permission reads the object, the guard would pass a request through
that it could have refused, and the refusal would fall to the service. Under the
doctrine that is tolerable, because the service re-evaluates on the row it
loads and `games.service.spec.ts` asserts that side. It is still a weakening of
the guard, so the answer is not "always true".

Decision 9 is the union, and it is the only answer that is right in both
directions: `readsObject(key, action)` is true when any permission covering that
pair names an `object.*` path on either side. `permissionReadsObject`
(`reads-object.ts:23-27`) is already the per-permission answer and does not
change; the change is at `hydrate-policy.ts:427-431`, where the single
`permissionFor` lookup becomes the same covering-set lookup `can` uses.

Two smaller consequences. A wildcard whose rules read only `subject.*` leaves
`readsObject` false for every action it covers, so a guard goes on refusing
loudly, which is the behaviour the member exists for. And `readsObject` keeps
answering past the freshness budget (`hydrate-policy.ts:380-382`), because it
states a fact about the document, and that stays true with a wildcard in it.

## 6. `serialize`, `applyDenyOverlay`, `federatedPolicies`

These three are where a wildcard stops being one engine's problem.

`serialize` filters per permission on `visibility === 'public'`
(`serialize.ts:124`) and copies each kept permission byte for byte. The
reduction's stated property is at `:96-100`: editing a kept permission is
refused because that would make the contract disagree with the owner. A wildcard
lets a document disagree with the owner without any permission being edited. A
public `game.update` covered by an internal `game.all` publishes the allow and
drops the deny, and the consumer's evaluation of the contract allows what the
owner refuses. Decision 10 refuses that document at `serialize` time, naming
both keys, because the check is cheap and the alternative is a contract that is
wrong in the granting direction.

`applyDenyOverlay` needs no code change and needs a paragraph of documentation.
The function appends deny rules to the keys `vetoable` names
(`deny-overlay.ts:126-136`), and under section 2's union a deny appended to
`game.update` decides `game.update` whatever `game.all` allows. That is the
cross-cutting case working correctly. The part that needs saying is the other
direction: an owner who lists `game.all` as vetoable has opened every action the
vocabulary covers, including actions added to the vocabulary later, to a deny
another team writes. `2026-09-17-acl-no-cascade.md` § 6 tightened `vetoable`
into a complete statement of an overlay's reach by removing the cascade that
propagated it. A wildcard key in that list widens the reach again, from one key
to the whole vocabulary of one object kind, and the owner writing the list is
the party who has to see that.

One measured detail that does hold: `assertRulesFit(schema, permission,
'overlay', rules)` (`deny-overlay.ts:122`) checks a contribution against
`permission.object`, which is `game` for `game.all` as much as for
`game.update`, so an overlay on a wildcard is schema-checked exactly as one on
an ordinary permission.

`federatedPolicies` is the one that fails structurally. Construction indexes
every member's permission keys and refuses a key two origins claim
(`federated-policies.ts:71-80`), and `can` routes on the exact key
(`:84-89`). Origin A holding `game.all` and origin B holding `game.update`
collide on nothing, so construction succeeds. Then `can(subject, 'game',
'update')` routes to B alone, and A's wildcard, including any deny it carries,
never runs. The routing table cannot be fixed by widening the collision check
alone: each member is a separate frozen document with its own `actions` array
under decision 7, so "the set of keys origin A claims" is not a set the table
can compute without adopting A's vocabulary as the federation's. Decision 12
refuses a member document carrying a wildcard, and says why at the point of
refusal.

## 7. Reserving the word

Measured: `validateMatrix` has no reserved action names. It refuses an action
that is not a non-empty string (`:468-470`) and one carrying the key delimiter
(`:483-489`), and nothing else. A permission `{ key: 'game.all', object:
'game', action: 'all' }` validates today and decides as an ordinary permission,
confirmed by running it.

Also measured: no matrix in this repository declares `action: 'all'`. The four
`'all'` hits across `libs/` and `apps/` are rule ids in
`libs/acl/src/parse-matrix.test.ts` and `libs/acl/src/validate.test.ts`.

So reserving `all` breaks nothing here today, and it breaks every foreign
producer whose domain has a literal `all` action. That is not a hypothetical
shape: `export.all`, `report.all` and `notification.all` are ordinary
permissions in ordinary applications, and a library that takes a bare English
word out of a user's vocabulary owes them an escape hatch. CASL provides one
(`anyAction` and `anySubjectType` options, `RuleIndex.ts:113-114`, section 9),
and it can, because a CASL ability is constructed in a process with options
beside it. A `Matrix` is a document. An escape hatch here is another envelope
member, with the same drift problem decision 7's `actions` has, for a rarer
case.

Whether reservation is breaking, and for whom:

- For this repository, no. Nothing uses the name.
- For the package as published, nothing yet. It is unpublished, so the format
  is free to change today.
- For a producer adopting the format later, yes, and the failure is at
  construction with a message naming the key, which is the right shape for a
  breaking change.
- For a producer who already shipped `action: 'all'` meaning a literal action,
  the break is silent under the engine form: the document keeps validating and
  starts granting every action in the vocabulary. That case is the argument for
  refusing such a document outright, and it is why decision 7 makes the
  `actions` member mandatory alongside a wildcard.

Decision 2 declines the reservation entirely, because decision 1 leaves nothing
to reserve.

## 8. What a reviewer can conclude from a matrix

The doctrine is that the browser's evaluation toggles element visibility and
never controls access, that a trusted environment decides for real, and that
every app in a chain evaluates for itself and trusts no earlier layer. An
evaluation makes no network call, so every input a decision reads is in the
document and the context. A wildcard changes none of that. The engine stays
sound, no layer starts trusting another, and nothing reaches out.

What a wildcard changes is what a person reading the document knows, and that is
the only control anyone has over a grant being wider than intended.

Reading `game.update` in a matrix today tells a reviewer what update grants: the
permission's own `rules` and `denyRules`, and nothing else decides it. That is
the sentence `evaluate.ts:103-104` states and section 1 quotes. With a wildcard
in the format, three things stop being true at a glance:

1. A reviewer reading `game.update` no longer sees what update grants. Some
   other permission in the same document may cover it, and finding out means
   scanning every permission whose object is `game`. The scan is mechanical and
   short in a small document; it is the same scan
   `2026-09-17-acl-no-cascade.md` § 2 removed for the cascade, reintroduced with
   a different name.
2. A reviewer reading `game.all` cannot tell what it grants without the
   vocabulary, and under decision 7 the vocabulary is an array somewhere else in
   the envelope. The permission's own text states a grant over a set the
   permission does not name.
3. The set changes without the permission changing. Adding `archive` to the
   `actions` array grants archive to every subject any wildcard in the document
   allows. The diff that grants it touches no permission, no rule and no
   condition.

Point 3 is the one that decides this document. Every other cost here is work.
That one is a grant whose diff does not look like a grant, and the review of a
matrix is where an over-broad grant is supposed to be caught.

The counter-argument is real and worth stating. A matrix with four actions on
twelve object kinds is 48 permissions, most of them identical, and a reader who
has to check 48 near-identical blocks for one difference is doing a worse review
than a reader of 12 wildcards. A repeated block hides a change as effectively as
an abstraction does. That argument is why decision 3 exists: an authoring helper
writes the 48 blocks from 12 lines of source, so the author writes the short
form and the reviewer reads the long one. The document stays literal, and the
diff of a grant stays a diff of permissions.

## 9. CASL, read for this document

CASL is the obvious comparison and it differs from this library in the two ways
that matter to a wildcard.

What CASL says, `guide/intro`:

> `manage` and `all` are special keywords in CASL. `manage` represents any
> action and `all` represents any subject.

So CASL's `all` is on the other axis from the one asked about here. Its
action-side wildcard is `manage`, and its subject-side wildcard is `all`. A
reader who carries "CASL has `all`" into this design has the axes crossed.

How it combines, read from the source, which is where the guide stops.
`possibleRulesFor`
(`RuleIndex.ts:185-211`) merges the rules indexed under the requested action
with the rules indexed under `manage`, then merges in the rules for the `all`
subject type, using `mergePrioritized` (`utils.ts:137`), which interleaves two
priority-ordered arrays. `_indexAndAnalyzeRules` (`:149-177`) walks the raw
rules backwards and assigns `priority = rawRules.length - i - 1`, so the last
declared rule has the lowest priority number and is scanned first.
`relevantRuleFor` (`Ability.ts:30-42`) returns the first rule whose conditions
match, and `can` is `!!rule && !rule.inverted`. So CASL layers the wildcard and
the specific action into one ordered list, and the last matching declaration
wins, inverted or not.

That is order-dependence, and CASL's own guide names it as a hazard:

> When defining direct and inverted rules for the same pair of action and
> subject the order of rules matters: `cannot` declarations should follow after
> `can`, otherwise they will be overridden by `can`.

with a worked example ending in the comment `// true!` where the reader expects
false. Our `Matrix` is a frozen JSON document that a foreign producer emits, and
array order in such a document is not something a reviewer reads as semantics. A
rule that made the order of `permissions` decide a grant would be a trap in
exactly the place this library has spent the most care avoiding one. Decision 5's
union is order-independent: deny wins wherever it sits in the array.

Three more differences worth having written down.

CASL matches on subject types and instances, detecting the type from
`article.constructor.name` by default (`guide/intro`), and its conditions are
MongoDB query syntax evaluated by ucast. Ours is a frozen serializable matrix,
conditions are a closed set of operators over `subject.*`, `object.*` and `now`
(`validate.ts:23-29`), and the outcome is tri-state: `allowed` plus a `reason`
that distinguishes a refusal from an undecided decision. CASL's `can` returns a
boolean, so it has no `unevaluable` and no `unusable-clock`, and therefore none
of section 1's cost from a wildcard carrying a clock or an object path.

CASL's aliases are the closest thing it has to decision 3, and they went the
other way. `createAliasResolver` (`guide/define-aliases`) maps one action onto
several, `resolveAction` is a constructor option (`api/casl-ability`, the
`Ability` options at `:57`), and the guide says the resolution happens "once on
`Ability` instantiation level". The alias map is not in `ability.rules`, which
is what `packRules` ships across the wire. So a CASL rule set that crosses a
process boundary carries the alias word and not its expansion, and the receiving
process must be constructed with the same resolver. That is decision 7's problem
in CASL's own design, solved by putting the vocabulary outside the serialized
document and requiring both ends to agree out of band. Our federation story
cannot take that answer: `parseMatrix` adopts a document from a producer the
consumer does not share code with.

And CASL forbids aliasing `manage` (`guide/define-aliases`, "Invalid usage"),
because a wildcard that is also an alias target has no defined expansion. The
same shape appears here as decision 8: a wildcard that also carries field rules
has no defined merge.

## 10. The reduced form: expansion at authoring time

Decision 3 is what ships in place of the engine wildcard. `Actions`
(`authoring.ts:117-132`) gains two members beside `allow` and `deny`:

```ts
allowEach(actions: readonly string[], ...conditions: Cond[]): Actions<Sub, Obj>;
denyEach(actions: readonly string[], ...conditions: Cond[]): Actions<Sub, Obj>;
```

Each writes one draft per named action into the same flat list `allow` writes
into, so the matrix that comes out has one permission per action, with the
conditions repeated. An author writes:

```ts
policy<Subject>().for<'game', Game>('game', (p) =>
  p
    .allowEach(CRUD, p.contains('subject.roles', 'staff'))
    .deny('delete', p.eq('subject.trainee', true)),
);
```

and the document carries four permissions, `game.create` through `game.delete`,
each naming its own action, with `game.delete` carrying the deny. Every question
this document asked disappears at that point. `capabilities()` keys four
literal actions that `apps/admin/app/access.ts:110` reads. `readsObject`
answers per permission as it does now. `serialize('reduced')` marks visibility
per action. `applyDenyOverlay` opens the actions the owner listed and no others.
`federatedPolicies` routes four exact keys. `validateMatrix` needs no reserved
name and the envelope needs no new member.

What it does not do is shrink the document. Four permissions for one line of
source is four permissions in the JSON, in every serialization, on every wire.
For twelve object kinds and four actions that is 48 permissions where the engine
form would carry 12, and the SSR payload carries the difference. That cost is
real and it is measurable per application; it is also the cost that buys section
8's point 3, where a grant's diff looks like a grant.

`CRUD` is exported as a `readonly string[]` beside the builder, so an author who
wants the library's default vocabulary names it once and an author with their
own vocabulary passes their own array. Nothing in the engine reads either.

## Testing

- A matrix carrying `action: 'all'` validates, constructs, and decides as an
  ordinary permission, asserted at `hydratePolicy` and at `parseMatrix`. This is
  decision 2, and the test exists so that a later reader who proposes reserving
  the name finds the behaviour asserted in a test.
- `allowEach(['create', 'read'], cond)` produces two permissions whose `key`,
  `object` and `action` are the two actions named, whose rule arrays are equal,
  and whose rule ids are distinct per permission. The DNF flattening
  (`authoring.ts:74-84`) runs once per action, so the equality is over the
  emitted arrays and not over a shared reference.
- `allowEach([])` produces no permission and does not throw. An empty vocabulary
  is a legal thing for a caller to hold, and a chain member that silently
  contributed nothing is preferable to one that fails at authoring time for a
  value the caller computed.
- `denyEach` after `allowEach` over the same action list produces permissions
  carrying both sides, and `.fields()` after `allowEach` attaches to every
  action the call named. `authoring.ts:208` already refuses `fields()` before
  any `allow()`, and the multi-action case has to state which permissions it
  attached to.
- `serialize('reduced')` over a document authored with `allowEach` and marked
  `visibility('public')` publishes every action the call named. The marking is
  per permission, so a helper that wrote four permissions and marked one would
  publish a contract missing three.
- No test asserts wildcard semantics, because decision 1 ships none. If the
  engine form is later taken, section 2's banned-subject document is the first
  test to write, and it fails against the union and passes against override,
  which is the discrimination that matters.

## The evidence, and what it does not cover

What is measured, by reading the file named or by running the package's test
runner over a matrix carrying `game.all` in this worktree:

- `permissionFor` is an exact map hit, and the four calls in the table under
  "What is actually wrong". The thrown `UnknownPermissionError` message, the
  `unknown-action` decision, the `false` from `readsObject` and the two
  `capabilities` keys are the runner's output, not a reading of the code.
- `capabilities` keys `permission.key` per permission
  (`hydrate-policy.ts:548-555`), and `apps/admin/app/access.ts:110` reads an
  absent key as refused.
- `validateMatrix` reserves no action name, and no matrix in this repository
  uses `all` as an action. The four `'all'` hits are rule ids in two test files.
- The precedence order's step 8 is unreachable, and the final return emits
  `unevaluable`. Derived by case analysis over the four `SideOutcome` states
  against the branches at `evaluate.ts:139-193`.
- `decideFields` reads one permission's `fields`, and
  `TargetsTransitionsConflictError` refuses `targets` beside `transitions` in
  one field config (`validate.ts:324-326`).
- `federatedPolicies` indexes exact permission keys and routes on
  `${key}.${action}`, so two origins holding `game.all` and `game.update` do not
  collide at construction. Read from `federated-policies.ts:71-89`; not run.
- CASL's combination and ordering: `possibleRulesFor`, `mergePrioritized`,
  `_indexAndAnalyzeRules` and `relevantRuleFor`, read from the source at
  `stalniy/casl` `master`, with the two guide quotations taken from
  `docs-src/src/content/pages/guide/intro/en.md`. The alias resolver's
  instantiation-time resolution and its absence from `ability.rules` come from
  `guide/define-aliases` and from the `Ability` options list in
  `api/casl-ability`.

What is asserted here and not measured:

- That a wildcard makes a matrix harder to audit. Nobody has reviewed a matrix
  with wildcards in it, here or anywhere this document can cite. Section 8's
  three points are derived from what the format would carry, and the
  counter-argument in the same section is derived the same way. No user study,
  no incident, no measurement.
- That 48 permissions cost less than 12 wildcards on the wire in any application
  anyone runs. The payload arithmetic is arithmetic; whether it matters has not
  been measured against `apps/storefront-rsc` or any other consumer, and that
  measurement is the thing that would most readily overturn decision 3.
- That a producer's vocabulary and a document's `actions` array would drift.
  This is inference from two places holding one fact, and the failure has not
  been observed because the member does not exist.
- That the union is what an author expects. Section 2 argues it from which
  mistake stays silent, which is an argument about failure modes. What an author
  predicts is a separate question. Both readings are common in the field: CASL's
  last-declaration-wins is a third reading again.
- That `allowEach` is the right name and shape. It is one pair of members on an
  existing interface and nothing in this document tested it against an author.

## Where I am guessing

- That the owner's ergonomic complaint is about writing four near-identical
  permissions. Decision 3 answers that complaint. If the want is a declared,
  enforced vocabulary,
  section 3's `actions` envelope member is worth having on its own, with no
  wildcard attached: it would let `validateMatrix` refuse a permission naming an
  action the vocabulary does not carry, which catches a misspelled action name
  at construction and is the one part of the engine form with no security cost.
- That decision 12's refusal is not itself a problem. Refusing a wildcard in a
  federated member means a service that adopted wildcards internally cannot
  publish its document into a federation, and I have not checked whether any
  intended federation participant would be in that position. Nothing in this
  repository federates yet outside the documentation examples.
- That section 4's merge really has no sound form. I worked the name allow-list
  and the two per-field configs and found none. A field-level merge defined as
  "the intersection over the fields the object carries" is computable at
  decision time, where the object is in hand, and I did not cost it because
  `decideFields` also answers for fields the object does not carry
  (`fields.ts:168-181`), and those are exactly the ones an intersection cannot
  decide.
- That the engine form is nine lines plus a format change, as decision 7's
  framing implies. The covering-set lookup replaces one `Map.get` in five call
  sites and the union of two rule arrays is a concatenation, but I did not write
  it, and `canMany`'s per-object loop over one resolved permission
  (`hydrate-policy.ts:493-495`) would have to hold the union across the loop and
  not rebuild it per object.
