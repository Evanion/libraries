# acl layers

Status: draft, 2026-11-11. Phase 1 of layered ACL. Extends
[2026-11-03-acl-0.2-design.md](2026-11-03-acl-0.2-design.md) (acl 0.2.0 on
main at `30e00ee4`). The owner settled the model on 2026-11-11; this document
specifies it and does not reopen it. Calls marked "(my call)" are mine.

First adopter: Portcullis, for its console policy (`platform > realm`), in
`Evanion/portcullis` `docs/superpowers/specs/2026-11-11-acl-layers-adoption-design.md`.

Evidence: the research report `reports/Layered ACL design prior art.md` and
its notes (`research_notes/Layered ACL design prior art/`:
`cloud_iam_hierarchies.md`, `policy_engine_combining.md`,
`escalation_and_support_access.md`, `rebac_saas_tenancy.md`). Section
references below ("report § caps") point there.

## Why

An organization runs one policy per level of a hierarchy. Portcullis has a
platform and realms under it. A retail chain has `central > region > store`.
Each level defines its own roles. A higher level must reach into lower levels
(a central admin acts in every store of its subtree), must be able to stop a
lower level from granting some permissions, and must keep permissions of its
own that lower levels cannot see.

acl 0.2.0 evaluates one flat matrix. A caller that needs two levels today puts
both in one matrix and smuggles the higher-level caller in through a subject
field (Portcullis: `subject.operator`, plus code that makes every operator an
`owner` in every realm). The matrix cannot tell the two kinds of caller apart,
any rule can deny anyone, and a lower-level editor sees every permission.

The two composition tools that exist do not fit. `federatedPolicies`
(`federated-policies.ts:64`) routes disjoint keys to separate documents; two
levels share keys. `applyDenyOverlay` (`deny-overlay.ts:95`) can only subtract
from one document; a higher level needs to grant.

No engine in the survey combines every part of this. Cloud IAM intersects
ancestor limits with grants and exempts the top level from lower denies (AWS
SCPs, GCP PAB, report § caps). Cedar and Cerbos let any deny bind anyone
(report § lower-layer denies). No engine hides higher permissions from lower
editors, and none treats support consent as an authorization primitive
(report § conclusion). This spec builds both.

## Goals

- A project declares an ordered chain of layer types of any length. Each layer
  is its own matrix with its own roles.
- A layer sees its own permissions and every permission of the layers below
  it. A lower layer cannot name a higher layer's permission.
- A higher layer grants on lower-layer permissions across its subtree.
- A layer's rules, allow and deny, bind only principals evaluated in that
  layer. A lower deny never cancels a higher grant.
- A parent layer caps what its descendants may grant, per permission, `open`
  or `locked`, with a layer-wide default.
- Write helpers enforce the Kubernetes subset rule on every write that
  changes effective permissions.
- `explain` names the layer, rule, cap and consent record that decided.
- A higher-layer grant carries a mode, `direct` or `consent`, and the
  evaluator honours both.
- A single-layer matrix decides exactly as it does in 0.2.0.

## Non-goals

- Same-type nesting (`region > region`). One node per layer type on any path.
  A later `recursive` flag on one layer type, with cycle refusal and a depth
  cap, covers sub-regions (report § depth).
- A consent workflow. The library evaluates consent records the host hands
  it. Requests, approvals, notifications and expiry jobs stay in the host.
- Loading anything. The library does no I/O; the host resolves the hierarchy,
  the assignments, the instances and the consent records.
- A layered `federatedPolicies`. See "Federation".
- Changes to `@evanion/react-acl` beyond types. A browser receives the
  reduced view of its own layer and evaluates it with the existing hooks.

## Anti-goals

The work fails, even if every test passes, if:

- any decision of `hydratePolicy` or `parseMatrix` changes for a document that
  carries no `reach`;
- a lower layer's deny changes a decision a higher layer's grant made;
- a key introduced by a higher layer appears in any output computed for, or
  shipped to, a lower layer (decision, capabilities, explanation, view, lint,
  error message);
- a node path accepted by `can` was built by anything other than `place`.

## Model

### Terms

- **Layer type**: one level of the chain, named (`platform`, `realm`).
  Declared once per project, root first.
- **Node**: an instance of a layer type in the host's hierarchy (`realm
acme`). The root layer has exactly one node.
- **Path**: a node and its ancestors, root first, one node per layer type.
  Only the host resolver produces it.
- **Instance**: the policy that governs one node: a matrix, the layer's role
  names, and the caps it sets on layers below. A layer type is `shared` (one
  instance for every node, Portcullis phase 1) or `per-node` (each node has
  its own, as a customer's realm would).
- **Principal**: the caller. Subject attributes, a home layer, role
  assignments, consent records.
- **Assignment**: `(subject, layer, node, role)`. It reaches the node and its
  subtree.
- **Introduced at**: the layer whose vocabulary first contains a key. Every
  key is introduced at exactly one layer.

### Chain declaration

```ts
interface LayerChain {
  /** Root first. Names are unique, non-empty, contain no `:` or `.`. */
  readonly layers: readonly LayerType[];
  /** The subject path a layer's rules read roles from. Default `'roles'`. */
  readonly rolesPath?: string;
  /** The subject path that identifies a principal in consent records. Default `'id'`. */
  readonly idPath?: string;
}

interface LayerType {
  readonly name: string;
  /** Keys introduced at this layer, `object.action`. */
  readonly introduces: readonly string[];
  readonly instances: 'shared' | 'per-node';
}
```

Vocabulary: `visible(L) = introduces(L) ∪ visible(child(L))`. The leaf sees its
own keys only. The root sees everything.

The library adds reserved keys to `introduces(L)` for every layer `L` (my call,
from the owner's rule that role assignment is a permission in the layer's
vocabulary, and report checklist item 3). The last three exist only on a layer
that has a child layer.

| Key             | Object field read | Governs                                                          |
| --------------- | ----------------- | ---------------------------------------------------------------- |
| `L:role.assign` | `object.role`     | creating or removing an assignment of that role at the node      |
| `L:role.bind`   | `object.role`     | assigning that role without holding its grants (subset bypass)   |
| `L:role.define` | none              | editing the node's instance: its roles and the rules naming them |
| `L:cap.write`   | `object.layer`    | writing this instance's cap table                                |
| `L:node.create` | `object.layer`    | creating a child node, and its first assignment (bootstrap)      |
| `L:node.move`   | `object.layer`    | moving a child node to or from this node                         |

`:` is legal in an object name (`validate.ts:866` refuses only `.`), so these
are ordinary permissions with ordinary rules. Because they are introduced at
`L`, the layers above `L` can grant on them (a central admin assigning store
roles) and the layers below cannot see them. A host may alias a reserved key to
a key it already has (`assign: { realm: 'member.role' }` in `LayeredOptions`);
the alias must be introduced at the same layer.

### Instance

```ts
interface LayerInstance {
  readonly layer: string;
  /** The node id, or `'*'` for a shared layer type. */
  readonly node: string;
  readonly roles: readonly string[];
  /** An ordinary 0.2 matrix, plus `reach` on allow rules (below). */
  readonly matrix: Matrix;
  /** Caps on every layer below this one. Absent: everything open. Refused on the leaf. */
  readonly caps?: CapTable;
  /** Whether a consent record marked `emergency` counts at this node. Default `'allowed'`. */
  readonly emergencyConsent?: 'allowed' | 'refused';
}

interface CapTable {
  readonly default: 'open' | 'locked';
  /** Keys visible to the child layer only. */
  readonly permissions?: Readonly<Record<string, 'open' | 'locked'>>;
}
```

An instance serializes as JSON with the matrix inline. Its version is the
matrix's `version`; the cap table is part of the instance and is versioned
with it.

### Rule reach

`Rule` gains one optional member:

```ts
interface Rule {
  id?: string;
  when?: readonly Condition[];
  /** Allow rules in a layer instance only. Default `'direct'`. */
  reach?: 'direct' | 'consent';
}
```

`reach` matters only on an allow rule in layer `L` for a key introduced below
`L`. `direct` applies across the subtree and no lower node can block it.
`consent` applies at a node only while a live consent record from that node
or one of its ancestors below `L` covers the principal and the key.

Mode lives on the rule (my call). The same key can then be `direct` for one
role and `consent` for another (operator direct, support consent), which a
per-permission flag cannot express. `Rule` gains a member, and the deny-overlay
soundness argument (`deny-overlay.ts:20-27`: a contribution cannot express an
allow) needs one more refusal: `applyDenyOverlay` refuses a contribution that
carries `reach`.

### Principal and assignments

```ts
interface Principal<Sub = Subject> {
  /** Attributes. The roles path is overwritten per layer. */
  readonly subject: Sub;
  /** The layer this principal belongs to. Default: the leaf. */
  readonly home?: string;
  readonly assignments: readonly Assignment[];
  readonly consents?: readonly ConsentRecord[];
}

interface Assignment {
  readonly layer: string;
  readonly node: string;
  readonly role: string;
}

interface ConsentRecord {
  readonly id: string;
  /** The node that consented. Its subtree is covered. */
  readonly node: { layer: string; id: string };
  /** The higher layer whose consent-mode rules this record opens. */
  readonly layer: string;
  readonly grantee: { role: string } | { subject: string };
  readonly keys: readonly string[];
  readonly notBefore: Instant;
  readonly notAfter: Instant;
  readonly emergency?: boolean;
}
```

The host loads assignments and consent records from server state for the
principal and the path. The library ignores an assignment whose `(layer,
node)` is not on the path, and reports one whose role the instance does not
declare (`unknown-role` in `explain` and `lint`).

### Which layers evaluate a principal

For principal `P` at path `n0..nd` (root first), layer `L` with node `n_i` on
the path evaluates `P` when:

- `L` is `P.home`, or
- `P` holds an assignment `(L, n_i, r)` with `r` declared by `instance(n_i)`.

A layer that does not evaluate `P` contributes nothing for `P`. It cannot
allow and it cannot deny. That one rule is how "a lower layer's deny cannot
bind a higher-layer subject" holds: a platform operator who is no member of
realm `acme` is never evaluated by `acme`'s rules. A person who is both (a
member of `acme` and a platform operator) is evaluated by both layers, and
each layer's deny cancels only that layer's own allow.

`home` exists for callers with no assignment yet: a person accepting an
invite to `acme` is evaluated by the realm layer with `roles: []`, so role-free
rules such as "any signed-in person may accept an invite" still match. A layer
above `home` evaluates `P` only through an assignment.

## Evaluation

### `can`

```
can(P, placement, key, action, object?, now?):
  t     = settleNow(now)                      # one clock for every layer
  K     = key + '.' + action
  path  = placement.path                      # n0 (root) .. nd, from place()
  outcomes = []

  for i in 0..d:                              # root first
    L    = layer(n_i)
    inst = placement.instance(i)
    roles = [a.role for a in P.assignments
             if a.layer == L and a.node == n_i.id and a.role in inst.roles]
    if L != home(P) and roles == []: continue              # not evaluated
    if K not in visible(L): continue                       # hidden from L
    if stale(inst, t): outcomes.push((L, n_i, stale-contract)); continue
    perm = inst.permission(K)
    if perm is absent: outcomes.push((L, n_i, unknown-action)); continue

    ctx = { subject: P.subject with rolesPath := roles, object, now: t }
    d = decideResolved(perm with allow rules filtered by reach(P, L, i, K, t), ctx)
        # deny rules untouched; consent-mode allow rules without a live record
        # are dropped and remembered as consent-required

    if d.allowed:
      for j in 0..i-1:                         # every ancestor of L
        a = placement.instance(j)
        if stale(a, t): d = stale-contract (cappedBy: layer(n_j)); break
        if cap(a, K) == 'locked': d = capped (cappedBy: layer(n_j)); break
    outcomes.push((L, n_i, d))

  return combine(K, outcomes)

reach(P, L, i, K, t)(rule):
  if rule.reach != 'consent' or introducedAt(K) <= i: return keep
  for c in P.consents:
    if c.layer == L
       and c.node is n_j on the path with j > i
       and K in c.keys
       and grantee(c) matches P (role in roles, or subject id at idPath)
       and toEpoch(c.notBefore) <= t < toEpoch(c.notAfter)
       and not (c.emergency and placement.instance(j).emergencyConsent == 'refused'):
      return keep (record c)
  return drop (consent-required)

cap(a, K):
  a.caps absent              -> 'open'
  K in a.caps.permissions    -> that value
  else                       -> a.caps.default
```

Keys introduced at the layer that owns the cap table, or above it, never reach
`cap`: a layer only evaluates keys it can see, and a cap table only names keys
its descendants can see. A hidden key is locked for the lower layer by
construction, because the lower layer cannot hold a rule for it.

A cap applies to every layer below the instance that sets it, adjacent or
further down, so a region cannot reopen what central locked (AWS SCP
every-level rule, report § caps). A grant made in layer `L` is capped by `L`'s
ancestors only. A central grant on a store permission is not capped by the
caps central itself sets on regions and stores.

### `combine`

Grants union across layers; each layer's denies stay inside it.

```
combine(K, outcomes):
  allowed = [o for o in outcomes if o.d.allowed]
  if allowed: return the first in root-first order, with layer and node set
  if outcomes == []: return { key: K, allowed: false, reason: 'unknown-action' }
  return the refusal with the highest rank:
    stale-contract > unusable-clock > unevaluable (missing: union of all)
    > capped > consent-required > denied > no-rule-matched > unknown-action
```

The rank keeps the existing rule that an answer the caller can repair outranks
a definite refusal (`evaluate.ts:160-175`): an unevaluable layer could still
allow, so a definite deny in another layer does not settle the union.

The first allowing layer root-first is reported because it is the widest
grant. Any allowing layer gives the same `allowed: true`.

### Decision and explanation

```ts
type LayeredReason = Reason | 'capped' | 'consent-required';

interface LayeredDecision extends Omit<Decision, 'reason'> {
  reason: LayeredReason;
  /** The layer and node whose outcome is reported. */
  layer?: string;
  node?: string;
  /** On `capped`: the ancestor layer whose cap refused. */
  cappedBy?: string;
  /** On an allow through a consent-mode rule. */
  consent?: { id: string; emergency: boolean };
}

interface LayerExplanation {
  layer: string;
  node: string;
  evaluated: 'home' | 'assignment' | 'no';
  roles: string[];
  /** The 0.2 explanation of this layer's permission, absent when not evaluated or hidden. */
  explanation?: Explanation;
  caps: {
    layer: string;
    node: string;
    state: 'open' | 'locked';
    source: 'entry' | 'default' | 'absent';
  }[];
  consent?: {
    rule: string;
    record?: string;
    state: 'live' | 'missing' | 'expired' | 'emergency-refused';
  }[];
  outcome: LayeredDecision;
}

interface LayeredExplanation {
  decision: LayeredDecision;
  layers: LayerExplanation[];
}
```

`Decision` and `Reason` do not change. The two new reasons exist only on
`LayeredDecision`, so an exhaustive switch over 0.2's `Reason` keeps compiling
(my call; widening `Reason` would break every consumer of the flat engine for
a value it never emits).

`explain` lists every layer on the path. A layer that cannot see the key is
listed with no `explanation`, and its rows name no key. When the principal's
highest evaluated layer cannot see `K`, `explain` returns the `unknown-action`
decision and an empty `layers` array, so a lower-layer caller cannot learn
that a higher key exists.

### Fields

`canFields` decides per layer and unions: a field is `allowed` when any layer
whose action outcome is allowed (after caps and consent) allows it. Caps act on
the action only in phase 1.

### Capabilities and views

`capabilities(P, placement, now?)` returns one entry per key in
`visible(top)`, where `top` is the highest layer that evaluates `P` on the
path. A realm-home customer's map has no platform key in it, with any reason.

`view(layer, placement)` returns what a layer-`L` editor, SDK or browser may
hold: the instances of `L` and the layers below it on the path, and from each
ancestor's cap table only the entries for keys in `visible(L)` plus the
default. It never returns an ancestor's matrix. `serialize(…, 'reduced')`
applies to each instance as before.

## Placement

```ts
interface HierarchyResolver {
  /** The node's path, root first, read from server state. null: no such node. */
  path(node: NodeRef): Promise<readonly NodeRef[] | null>;
  /** The instance governing `at`. A shared layer returns the same object for every node. */
  instance(at: NodeRef): Promise<LayerInstance | null>;
}

interface NodeRef {
  readonly layer: string;
  readonly id: string;
}
```

`layers.place(resolver, node)` calls the resolver, then checks the path: one
node per layer type, in chain order, root first, ending at `node`, root layer
present. It adopts every instance through the same gate `parseMatrix` uses
(deep copy, freeze, `validateMatrix`), runs the layer checks below, and
returns an opaque `Placement`. Hydrated instances are cached by `(layer, node,
version)` on the `LayeredAccess`.

`can`, `explain`, `capabilities`, `canFields` and every write check accept only
a `Placement` that `place` returned on the same `LayeredAccess`. The library
records each one in a `WeakSet`; anything else throws
`UnresolvedPlacementError`. A host that builds a path from request input has
no way to hand it to the evaluator (report checklist item 11).

The node being asked about can come from the request (which realm the URL
names). Its ancestry, its instance and the principal's assignments cannot.

## Validation

Construction (`layeredPolicy(chain)`) refuses:

| Error                      | When                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `LayerChainError`          | empty chain, duplicate or malformed layer name, two root nodes, `rolesPath` malformed     |
| `VocabularyCollisionError` | a key introduced at two layers (names the key and both layers)                            |
| `ReservedKeyError`         | `introduces` names a reserved `L:role.*` or `L:cap.write` key, or an alias crosses layers |

`place` refuses an instance with:

| Error                   | When                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HiddenPermissionError` | the matrix names a key outside `visible(L)`. The message is the same for a key a higher layer introduces and a key nobody introduces, so the error tells a lower editor nothing about higher vocabularies |
| `UnknownRoleError`      | a rule compares the roles path with a literal role the instance does not declare                                                                                                                          |
| `CapScopeError`         | a cap table on the leaf, or a cap entry for a key outside `visible(child(L))`                                                                                                                             |
| `ReachError`            | `reach` on a deny rule, or `reach: 'consent'` on a key introduced at `L` or above                                                                                                                         |
| `BlanketBindError`      | an allow rule for `L:role.bind` without an `object.role` `eq` or `in` condition                                                                                                                           |

`hydratePolicy` and `parseMatrix` refuse any rule with `reach` (`ReachError`):
a single-layer reader has no consent records and must not read a consent-mode
grant as a plain allow. `applyDenyOverlay` refuses a contribution with `reach`.
`validateAll` reports all of the above as issues for an instance passed with
its chain (`validateAll(instance, { chain })`).

Cap tables are writable only from the parent. In the data model a cap table
is a member of the parent's instance; a child instance has no member to put
one in. The write helper (`checkCapWrite`) requires `P:cap.write` at the
parent node.

## Writes and the subset rule

### Coverage

A writer `W` covers an allow rule `ρ` of layer `L`, key `K`, at placement `p`
when some allow rule `σ` exists such that:

1. `σ` is a rule for `K` in an instance on `p`'s path at a layer `M` that
   evaluates `W`, with `M` at or above `L`;
2. `σ`'s role conditions hold for `W`'s roles in `M`;
3. `σ`'s other `subject.*` conditions that compare with a literal hold for
   `W.subject`;
4. every remaining condition of `σ` (object, `now`, subject-to-object paths)
   appears in `ρ`, compared canonically (`canonical.ts`);
5. `σ` is `direct`, or a live consent record covers it for `W` at `p`;
6. no ancestor of `M` locks `K`;
7. every deny rule of `M` for `K` whose subject side does not definitely fail
   for `W` also appears canonically among `L`'s deny rules for `K`.

Rule 4 is syntactic subsumption: `ρ` with at least `σ`'s conditions is at most
as broad. Rule 7 stops a writer bound by a higher-layer deny from handing out
a lower-layer grant that deny would not bind. When `M` is `L`, rule 7 always
holds.

Coverage is conservative. It refuses some writes a semantic check would allow
(a `ρ` that is narrower through a different condition). The refusal names the
uncovered rule, and `L:role.bind` is the explicit way past it.

The writer's standing is computed over every layer that evaluates `W`,
including layers the target layer cannot see (report checklist item 6).

### Write checks

```ts
interface WriteDecision {
  allowed: boolean;
  reason: 'allow' | 'not-permitted' | 'escalation' | 'unknown-role';
  /** How the write was authorized. */
  via?: 'subset' | 'bind' | 'narrowing' | 'bootstrap';
  /** The permission decision on the gating key. */
  gate: LayeredDecision;
  /** Rules the writer does not cover, by key and rule id. */
  uncovered?: { key: string; rule: string }[];
}
```

| Helper                                      | Gate key at the placement       | Subset requirement                                                                                                          |
| ------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `checkAssign(W, p, { layer, node, role })`  | `L:role.assign` with `{ role }` | `W` covers every allow rule of `instance(node)` that names `role`, or `L:role.bind` allows `{ role }`                       |
| `checkUnassign(W, p, assignment)`           | `L:role.assign` with `{ role }` | none (narrowing)                                                                                                            |
| `checkRoleEdit(W, p, layer, before, after)` | `L:role.define`                 | `W` covers every branch `diffMatrix(before, after)` reports as `granted`                                                    |
| `checkCapWrite(W, p, layer, before, after)` | `L:cap.write` with `{ layer }`  | for each key the change opens (entry or default), `W` holds `K` at `p` with no condition left (rule 4 against an empty `ρ`) |
| `checkMove(W, node, fromParent, toParent)`  | `P:node.move` at both parents   | gate at both parents (report § depth, Azure management groups)                                                              |

In the table, `L` is the layer of the assignment or instance being written,
and `P` is the parent layer of the node being moved.

Membership, invites and token issue are assignments to the library. The host
calls `checkAssign` for each role the new member, invite or token carries.

Removal is narrowing, but the gate still runs, and in the gate's layer. A
realm owner cannot remove a platform assignment because the assignment lives
in the platform layer and the owner holds no `platform:role.assign` (report
checklist item 8).

`checkRoleEdit` reuses `diffMatrix` (`diff-matrix.ts:560`), whose `granted`
findings already over-approximate widening. A `granted` branch with no role
condition widens access for every principal the layer evaluates, and needs
coverage like any other.

### Bootstrap

The first assignment at a new node has no writer who holds anything there.
`checkBootstrap(W, parentPlacement, childLayer, role)` allows it when `W` holds
`P:node.create` at the parent and returns `via: 'bootstrap'`. The host calls it once, inside the transaction that creates the
node, and records it (report Portcullis checklist item 8).

### Lint

`lint(placement)` reports, per instance:

- `capped-grant`: an allow rule for a key an ancestor locks. The rule is inert.
  A child admin sees why a role stopped working (report § caps).
- `unknown-role` assignments the host passed.
- `shadowed-condition`: a role has an unconditional and a conditional allow on
  the same key. Allow rules are OR-ed, so the condition does nothing. The
  library does not pick a winner (report checklist item 10); it reports.
- `consent-without-direct-path`: a consent-mode rule on a key no direct rule
  of any layer grants, so the key is unreachable without consent. Information
  only.

## Consent mode

Phase 1 implements consent in the library: the `reach` member, `ConsentRecord`,
the evaluation step above, the `consent-required` reason, `emergencyConsent`
on the instance, and `explain` rows. The tests cover it.

What stays with the host: creating records, who in the lower layer may
approve, notifying, revoking, expiring, alerting on `emergency`, and the
realm's audit log. The library evaluates the records it receives and reports
`consent.emergency` on the decision so the host can alert.

Portcullis phase 1 uses `direct` only. Its consent feature (consented support
access) is its phase 2, in the adoption spec.

## Federation and the deny overlay

Layers split a policy by level. Federation splits it by owning service. They
are orthogonal: a key has one introducing layer and one origin.

- `federatedPolicies` does not change and keeps routing single-layer `Access`
  values by key.
- A service that owns keys in a layered chain builds its own `LayeredAccess`
  over its own instances. Two services in one chain introduce disjoint keys;
  `VocabularyCollisionError` within a chain and `OriginCollisionError` across
  origins enforce the same invariant at the two levels.
- A layered federated set (`federatedPolicies` over `LayeredAccess` values) is
  deferred until a user needs it. `LayeredAccess.can` takes a principal and a
  placement, so it cannot sit in a record typed for `Access`.

The deny overlay applies to one instance's matrix before `place` sees it, as it
applies to a document before construction today. It can only name keys in
that instance, so a compliance overlay on a lower layer cannot reach a higher
key (the existing `UnknownPermissionError`), and its denies bind only the
principals that layer evaluates. A compliance team that needs to bind a
higher layer's principals overlays the higher layer.

## API sketch

```ts
export function layeredPolicy<Sub = Subject>(
  chain: LayerChain,
  options?: LayeredOptions,
): LayeredAccess<Sub>;

interface LayeredOptions {
  /** Same meaning as AccessOptions.maxStale, applied per instance. */
  maxStale?: number;
  /** Per layer, an existing key that stands in for `L:role.assign`. */
  assign?: Readonly<Record<string, string>>;
}

interface LayeredAccess<Sub = Subject> {
  readonly chain: Readonly<LayerChain>;
  visible(layer: string): readonly string[];
  place(resolver: HierarchyResolver, node: NodeRef): Promise<Placement>;
  /** Composite of the path's instance versions: `platform@7+realm:acme@41`. */
  version(placement: Placement): string;

  can(
    P: Principal<Sub>,
    at: Placement,
    key: string,
    action: string,
    object?: Record<string, unknown>,
    now?: Instant,
  ): LayeredDecision;
  explain(
    P: Principal<Sub>,
    at: Placement,
    key: string,
    action: string,
    object?: Record<string, unknown>,
    now?: Instant,
  ): LayeredExplanation;
  capabilities(
    P: Principal<Sub>,
    at: Placement,
    now?: Instant,
  ): Record<string, LayeredDecision>;
  canFields(
    P: Principal<Sub>,
    at: Placement,
    key: string,
    action: string,
    object: Record<string, unknown>,
    axis: 'read' | 'write',
    proposed?: Record<string, unknown>,
    now?: Instant,
  ): FieldDecision;

  view(layer: string, at: Placement): LayerView;
  lint(at: Placement): LayerFinding[];

  checkAssign(
    W: Principal<Sub>,
    at: Placement,
    a: Assignment,
    now?: Instant,
  ): WriteDecision;
  checkUnassign(
    W: Principal<Sub>,
    at: Placement,
    a: Assignment,
    now?: Instant,
  ): WriteDecision;
  checkRoleEdit(
    W: Principal<Sub>,
    at: Placement,
    layer: string,
    before: LayerInstance,
    after: LayerInstance,
    now?: Instant,
  ): WriteDecision;
  checkCapWrite(
    W: Principal<Sub>,
    at: Placement,
    layer: string,
    before: CapTable | undefined,
    after: CapTable,
    now?: Instant,
  ): WriteDecision;
  checkMove(
    W: Principal<Sub>,
    node: NodeRef,
    from: Placement,
    to: Placement,
    now?: Instant,
  ): WriteDecision;
  checkBootstrap(
    W: Principal<Sub>,
    parent: Placement,
    layer: string,
    role: string,
    now?: Instant,
  ): WriteDecision;
}
```

New module `layers.ts` and `layer-writes.ts`; new exports from `index.ts`:
`layeredPolicy`, the types above, and the errors in "Validation". The typed
authoring builder (`policy()`) gains nothing in phase 1; layer instances are
authored as matrices (my call: typed layered authoring is its own design and
nobody needs it before Portcullis phase 2).

## Versioning and migration

- `Matrix`, `Permission`, `Decision`, `Reason`, `Explanation` and every 0.2
  entry point keep their shape. `Rule` gains the optional `reach`.
- A 0.2 document carries no `reach`, so it decides identically. A 0.3
  single-layer reader refuses a rule with `reach`. A 0.2.0 reader does not:
  `assertRule` (`validate.ts:333-375`) checks `id` and `when` and ignores any
  other rule member, while permissions refuse unknown members
  (`collectMembers`, `validate.ts:479`). A 0.2.0 reader handed a layer
  instance would read `reach: 'consent'` as a plain allow. So 0.2.1 refuses
  unknown rule members, with the same message shape as `collectMembers`, and
  is released before 0.3.0 (my call). The 0.3.0 changelog states that every
  reader of a layer instance must run 0.2.1 or later.
- A one-layer chain is the flat engine: for a principal whose `home` is the
  only layer and whose assignments carry exactly the roles the flat subject
  carried, every decision equals `parseMatrix(matrix).can`. A property test
  holds this (test 1).
- Release: `feat(acl)` commits on 0.2.x bump the patch under
  `adjustSemverBumpsForZeroMajorVersion`; the `Rule.reach` commit is
  `feat(acl)!` with a `BREAKING CHANGE` footer (single-layer readers now
  refuse `reach`), giving 0.3.0. `react-acl` re-exports `Rule` and releases
  with its pin moved.

## Tests

Unit tests per error class, asserting class and message, and that no message
names a key outside the reporting layer's vocabulary.

Property tests over generated chains (depth 1 to 4), instances (shared and
per-node), assignments, cap tables, consent records, objects and clocks, 200
seeds each:

1. One-layer equivalence with `parseMatrix` (above).
2. Lower denies are inert for higher grants: appending any deny rule to any
   instance below `L` never changes a decision whose reported layer is `L` or
   above.
3. Cap monotonicity: locking an entry or the default never moves a decision
   from refused to allowed; opening never moves allowed to refused.
4. Every-ancestor caps: a key locked at depth `j` is refused for every grant
   at depth `> j`, whatever caps sit between.
5. Visibility: for every principal whose top evaluated layer is `L`,
   `capabilities`, `explain`, `view`, `lint` and every error message contain
   no key outside `visible(L)` (string search over the serialized output).
6. Union: a decision is allowed iff some evaluated layer's outcome is allowed.
7. Subset soundness: after any assignment `checkAssign` allows via `subset`,
   for every key and generated context, the assignee's new allows on keys the
   role grants are a subset of the writer's allows at the same placement.
8. Role-edit soundness: the same property for `checkRoleEdit`.
9. Consent: a consent-mode rule never allows without a live matching record;
   `notAfter` is exclusive; an emergency record is ignored at a node with
   `emergencyConsent: 'refused'`; a record from a node off the path never
   counts.
10. `explain(...).decision` equals `can(...)` for every input.
11. Placement: an object shaped like a `Placement` but not returned by `place`
    throws; a resolver path out of chain order, with a repeated layer type or
    without the root, is refused.

Each property is guarded against vacuity by counters, as the deny-overlay
tests are: how many decisions were allowed before a mutation, how many caps
locked a live grant, how many consent rules matched a record.

Mutation-proven: removing each refusal, letting a lower deny cancel the
union, skipping one ancestor in the cap walk, and dropping rule 7 of coverage
each fail the suite.

## Escalation-prevention checklist

Report § checklist, library items, mapped to mechanism and test.

| #   | Item                                                      | Mechanism                                                                                                                            | Test                         |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| 1   | Assign only roles whose grants you hold                   | `checkAssign` coverage, or `L:role.bind`                                                                                             | 7; unit `checkAssign`        |
| 2   | Role edits need the resulting grants                      | `checkRoleEdit` over `diffMatrix` granted branches                                                                                   | 8                            |
| 3   | Bypasses are explicit permissions                         | reserved `L:role.bind`, `L:role.define`; `BlanketBindError`                                                                          | unit per error               |
| 4   | Grantable-role lists refuse grant-bearing roles           | a role whose rules allow `L:role.assign` or `L:role.bind` needs coverage of those rules too; no transitive opt-in in phase 1         | 7 with generated admin roles |
| 5   | Role edits recheck assignments that used a bypass         | `checkRoleEdit` gates on `L:role.define` and coverage of the new grants, so a bypass-assigned role cannot be widened past the editor | 8                            |
| 6   | Subset against the full set, hidden keys included         | coverage reads every layer that evaluates the writer                                                                                 | 7 with writer above target   |
| 7   | Caps live in the parent                                   | `caps` member exists only on the parent instance; `checkCapWrite` gates on `P:cap.write`; `CapScopeError`                            | unit; 3; 4                   |
| 8   | Lower admins cannot remove higher placements              | `checkUnassign` gates in the assignment's own layer                                                                                  | unit                         |
| 9   | Wildcards freeze                                          | the engine has no wildcard action (`2026-09-17-acl-wildcard-action.md`)                                                              | existing                     |
| 10  | One rule for conditional and unconditional grants         | allow rules OR; `lint` reports `shadowed-condition`                                                                                  | unit `lint`                  |
| 11  | Node path from the host                                   | `Placement` only from `place`; `UnresolvedPlacementError`                                                                            | 11                           |
| 12  | Higher-layer attributes not writable below                | host obligation; the library reads roles only from assignments, never from `subject`                                                 | 1 (roles path overwritten)   |
| 13  | Re-parenting checks both parents                          | `checkMove`                                                                                                                          | unit                         |
| 14  | Explain names the deciding rule, cap, consent, write path | `LayeredExplanation`, `WriteDecision.via` and `uncovered`                                                                            | 10; unit                     |

## Where I am guessing

- That syntactic coverage (rule 4) is permissive enough. Portcullis's console
  roles pass it (owner's rules carry no condition an editor's lacks). A
  customer policy with object conditions written two ways may need
  `L:role.bind` more than it should. A semantic subsumption check is the
  upgrade if that happens.
- That `home` defaulting to the leaf fits most hosts. A host with principals
  that belong to a middle layer (a regional manager who is no store member)
  sets `home` per principal.
- That per-node instances need no inheritance of the layer type's shared rules.
  Phase 1 has no per-node user; Portcullis phase 2 is the first.
- That `maxStale` per instance is the right freshness unit. A stale ancestor
  refuses every lower grant it caps, which is safe and may be loud.

## Left to the builder

- Module layout inside `layers.ts` and `layer-writes.ts`.
- Error messages, within the rule that no message names a key the reporting
  layer cannot see.
- Cache eviction for hydrated instances.
- Order of work: evaluation and validation first, then writes, then consent.
  Each is its own PR.
