# `federatedPolicies`, and the invariant nothing checks

Status: accepted and shipped. `federatedPolicies` and `OriginCollisionError`
are exported from `@evanion/acl`, landed in `c2d6023`.
Packages: `@evanion/acl`. One exported function, one exported interface, one
error class, one new module. No change to `Matrix`, `Permission`, `Rule` or any
existing entry point. `@evanion/react-acl` is untouched: a federated set is
assembled where policies are constructed, and that is a gateway or a BFF process,
never a React tree.
Depends on: `libs/acl/README.md:678-735` (the `federation` region, whose comment
at `:720` is the premise), `apps/docs/content/acl/federation.mdx:39-72` (the same
claim in prose, and the doctrine at `:12` that bounds what this function may be),
`libs/acl/src/create-policy.ts` (`Access` at `:188-249`, `capabilities` at
`:449-456`, `ctxWith` at `:360-368`, `buildIndex` at `:251-257`, `AccessOptions.
closed` at `:150-154`), `libs/acl/src/conditions.ts:41-46` (`settleNow`, which is
where the second defect is), `libs/acl/src/graph.ts:28-30` (the only raise site
of `DuplicatePermissionError` today), `libs/acl/src/errors.ts:36-43` (the class),
`libs/acl/src/validate.ts:428-443` (the key delimiter, which is what makes `:`
available as a namespace separator), `libs/acl/src/deny-overlay.ts` (`:88-92` for
the signature, `:103` and `:114` for the refusal that answers § 4's second
question, `:1-10` for the doctrine), `libs/acl/src/parse-matrix.ts:21-26`,
`docs/specs/2026-09-16-deny-overlay.md` § 7 (the pipeline this appends one step
to), `docs/specs/2026-09-17-acl-no-cascade.md` decision 5 and § 6 (where
`DuplicatePermissionError` moves, and what the overlay's reach becomes), and its
decisions 22 and 23 (the provenance split § 5 sits above).
Measured against: `origin/feat/acl` at `40e0c8b`, with
`docs/specs/2026-09-17-acl-no-cascade.md` read from `specs/acl-no-cascade` at
`94d7a04`. Every line number and behaviour below was derived by reading that tree
in this session.
Prior art: none was read for this document. The three systems
`2026-09-17-acl-no-cascade.md` § 1 surveys decide one request against one policy
set, and none of them has a composition step that runs at a client of N
independently owned documents, so the survey does not reach this question.

## What is actually wrong

Federation is entirely userland and one line of it is a promise. The
`federation` region builds a `Map` of origin to `Access`, then folds the
per-origin capability maps with `Object.assign` (`README.md:721-724`), under this
comment at `:720`:

```ts
// One advisory view for a UI. The namespaces are disjoint, so the fold is safe.
```

**Nothing checks that.** I looked for an enforcement and there is none.
`validateMatrix` reads one document (`validate.ts:408-450`). `buildGraph` rejects
a duplicate key inside one permission array (`graph.ts:28-30`). No function in
the package takes more than one `Matrix` or more than one `Access`. The only
grep hits for the word are the comment itself and its prose copy at
`federation.mdx:51-52`. The premise the brief gave holds.

The collision is reachable, and reachable through legal documents.
`validate.ts:428-440` refuses a `.` inside `object` or `action`, which is what
makes `orders:invoice` spellable. It requires no namespace. `{ object:
'invoice', action: 'read' }` is a valid permission, and two services that both
emit it are two valid documents. `Object.assign` then keeps the last one, and the
edge holds a view where one service's answer stands in for another's, with no
error and no flag.

`federation.mdx:46-49` states the correct half of this and stops one paragraph
short:

> two documents that both declare `invoice.read` are two entries under two
> different map keys, and neither can overwrite the other. A merged matrix has no
> such property — the second `invoice.read` wins, silently.

That is true of routing through `policies.get(origin)`. The fold two lines later
is the merged case, and it loses the entry the same way.

**There is a second defect in the same four lines, and it is about the clock.**
`Object.assign({}, ...[...policies.values()].map((a) => a.capabilities(subject)))`
calls `capabilities` N times with `now` undefined. Each call reaches `ctxWith`
(`create-policy.ts:360-368`), which calls `settleNow`
(`conditions.ts:41-46`), which returns `Date.now()` for an undefined instant. So
a view over five origins reads five clocks. A `before`/`after` boundary that
falls between two of those reads produces one view in which a window is open for
one origin and closed for another, and the view is presented as one subject's
capabilities at one moment.

That one is smaller and it has a cheaper fix. § 7 costs both.

## Decisions

1. **`federatedPolicies(policies)` refuses at construction when two origins claim
   the same permission key.** A duplicate key across origins is a configuration
   error of exactly the kind `DuplicatePermissionError` names inside one matrix,
   and the construction site is the first moment both documents are in hand. § 1
   tests this against the two alternatives and says why neither survives.
2. **The error is a new class, `OriginCollisionError`, not
   `DuplicatePermissionError`.** It carries the key and both origin names.
   `DuplicatePermissionError` carries the key alone (`errors.ts:36-43`), and an
   edge operator holding only the key cannot tell which of five upstream
   documents to go and fix. § 1.4.
3. **It composes and evaluates nothing.** The function holds the `Access` values
   the caller passed, forwards every question to one of them, and computes no
   decision of its own. § 2 derives this from `closed`, `version` and `schema`
   being per document, and from the doctrine at `federation.mdx:12`.
4. **It is not an `Access` and does not pretend to be.** It has no `matrix`, no
   `version` and no `schema`, because none of the three is single-valued over N
   documents. The returned type is `FederatedAccess`, with three members. § 2.2.
5. **Three members: `can`, `capabilities`, `get`.** `canMany`, `canFields`,
   `readsObject` and `authorize` are not forwarded. They are reachable through
   `get(origin)`, which is `policies.get(origin)` with decision 1 already run.
   § 2.3 says what each rejected forward would have cost.
6. **`can` routes by the canonical key, not by a namespace prefix.** The origin
   that answers `can(subject, 'orders:invoice', 'read')` is the one origin whose
   key set contains `orders:invoice.read`. Decision 1 is what makes that a
   function. § 3.
7. **A key no member holds answers
   `{ key, allowed: false, reason: 'unknown-action' }`.** No throw, no flag. This
   is the answer the current region already gives (`README.md:731-732`) and the
   answer `closed: true` gives for an absent origin
   (`federation.mdx:63-68`). § 3.2.
8. **The namespace stays a convention in the key string.** `Permission` gains no
   `origin` member, `object` is not parsed, and `:` keeps meaning nothing to the
   library. Collision detection is a string comparison over `permission.key`.
   § 6.
9. **`capabilities(subject, now?)` settles one instant and passes it to every
   member.** This closes the N-clock defect. It is the only computation in the
   function that is not a lookup. § 7.2.
10. **The overlay applies per origin, before composition, and this function takes
    no overlay.** `applyDenyOverlay` is `Matrix -> Matrix`
    (`deny-overlay.ts:88-92`) and `federatedPolicies` takes `Access` values, so
    the ordering is forced by the types. § 4.1.
11. **One origin's overlay cannot deny another origin's `vetoable` key.**
    `applyDenyOverlay` refuses a key the target matrix does not define with
    `UnknownPermissionError` (`deny-overlay.ts:103`, `:114`), and a key from
    another origin is such a key. The cross-origin boundary is already exact, and
    it is exact independently of the cascade. § 4.2.
12. **The spec holds in both worlds of `2026-09-17-acl-no-cascade.md` Part A.**
    The overlay's over-reach through `dependsOn` is contained inside one origin,
    because `dependsOn` does not cross an origin
    (`federation.mdx:74-82`). § 4.3 says what an edge sees in each world, and the
    difference is visible only in the folded view.
13. **Every member is built by whichever entry point its document's provenance
    calls for, and this function cares about none of them.** After
    `2026-09-17-acl-no-cascade.md` decisions 22 and 23 a map may mix
    `parseMatrix` and `hydratePolicy` in one call. § 5.
14. **The README's `federation` region changes, whether or not decisions 1 to 13
    are taken.** The comment at `:720` states an invariant nothing enforces, and
    the four-line hand-rolled check is what a reader needs if the function does
    not ship. § 8.

Decision 1 is the one to argue with, and § 1.3 is the argument against it that I
think is strongest. Decision 5 is where the function could turn into the facade
`2026-09-17-acl-no-cascade.md` part B exists to remove. Decision 9 is the defect
nobody was looking for. Decision 14 is the half I would defend if the rest is
declined, and § 8 says so plainly.

## 1. What happens when two policies claim the same key

Three shapes were on the table. Two of them are answers to a different question.

### 1.1 Refuse at construction

The check is cheap and the data is public. `Access.matrix` is the frozen document
(`create-policy.ts:194`, `:475-477`), and `matrix.permissions` carries every key.
So the whole of decision 1 is one pass:

```ts
const owner = new Map<string, string>();
for (const [origin, access] of Object.entries(policies)) {
  for (const permission of access.matrix.permissions) {
    const held = owner.get(permission.key);
    if (held !== undefined)
      throw new OriginCollisionError(permission.key, held, origin);
    owner.set(permission.key, origin);
  }
}
```

That map is also the routing table decision 6 needs, so the check and the
dispatch are one structure built once.

The consistency argument is real and it is the one the brief leans on.
`graph.ts:28-30` refuses a second `article.publish` inside one array;
`buildIndex` (`create-policy.ts:251-257`) is the `Map.set` loop that would
otherwise keep the last one, which is the same silent overwrite `Object.assign`
performs a layer up. `2026-09-17-acl-no-cascade.md` decision 5 moves that raise
site into `validateMatrix` for exactly this reason: deleting the check turns a
construction error into a silent overwrite. The federated fold is the same
mistake between documents, and it has no check at all.

### 1.2 Answer per origin

The second shape keeps both keys and makes `can` take the origin, so there is no
flat fold and a caller learns which service answered.

This is the map the README already builds. `policies.get('orders')?.can(...)` is
that call, it is one line, and it is correct today. A function wrapping it adds a
type and an import.

The claimed value is that a caller needs to know which service said no. Work it
through and the value does not appear. With disjoint keys, the key names the
origin, because the namespace is the origin (`federation.mdx:14-18`). With
colliding keys, the caller passed the origin in, so the answer to "which service
said no" is the argument the caller just wrote. Per-origin answering reports the
routing decision back to the party that made it.

The sharper objection is that it forecloses decision 6. A router that dispatches
on the key is a function only while the key sets are disjoint. Under a collision, `can(subject,
'invoice', 'read')` has two answers and the library would have to pick one, which
is `Object.assign`'s failure moved into the engine. So shape 2 is the shape that
survives a collision, and the reason it survives is that it never composes. That
is the status quo with a wrapper around it.

### 1.3 Deny on conflict

The third shape treats disagreement as a refusal, on the XACML deny-overrides
instinct.

It is wrong here for a reason that is about the domain and not about safety.
`orders:invoice.read` and `billing:invoice.read` under a collision are two
different rows, in two different databases, with different fields
(`federation.mdx:16-18`). They are two questions that happen to have been given
one name. The intersection of their answers is a refusal that is about neither
question, and the caller is told no by a policy set in which nobody said no.

It also hides the misconfiguration permanently. A collision that denies decides
something on every call, for every subject, and reports nothing. The day somebody
notices is the day a correct grant was refused, and the trail from that refusal
back to two services that both forgot a namespace is long.

And it is the one shape that cannot be undone. Decision 1 fails at the edge's
startup, in the edge's own process, with both origin names in the message.
Decision 3 fails in production, quietly.

### 1.4 Why the error is new

`DuplicatePermissionError` reports the key
(`errors.ts:36-43`): `duplicate permission key "invoice.read"`. Inside one
matrix, that is the whole location, because there is one document and the reader
has it open. At an edge, the key is the least useful half of the fact. The reader
needs to know that orders and billing both claim it, because the fix is a pull
request against one of two repositories and the message is what decides which.

So `OriginCollisionError extends AclConfigError`, carrying `key`, and the two
origin names, and reading:

```
permission key "invoice.read" is claimed by two origins, "orders" and "billing":
each origin's keys must be disjoint for one view to hold both
```

The cost is one more exported error class in a session that is deleting two
(`2026-09-17-acl-no-cascade.md` decision 4 deletes `FeatureCycleError` and
`UnknownDependencyError`). § 7 counts it.

## 2. Compose, do not evaluate

The owner's phrasing was "chain them together, each focused on one thing." Two
readings fit that sentence and only one fits the code.

### 2.1 Why a builder producing a single `Access` is refused

A builder folding N matrices into one document would have to answer four
questions, and each answer loses something a document already states.

**`closed` is per construction.** `AccessOptions.closed`
(`create-policy.ts:150-154`) is decided when one document is adopted. The
federation region constructs every origin closed (`README.md:716-719`), and
`federation.mdx:70-72` gives the reason: on the open path one unregistered
origin takes down the request. A merged `Access` has one `closed` for all N, so a
BFF that owns one of its documents and wants that one to throw on an unknown key
cannot have it.

**`version` is one field.** `Matrix.version` is a string or a number
(`validate.ts:388-392`). N documents have N versions. The merged document would
carry either nothing or a composite the function invented, and
`2026-09-16-deny-overlay.md` § 7 already settled that this library does not
invent version names for artifacts it did not fetch. The N-ary case is that
argument multiplied.

**`schema.objects` is a second collision surface.** Merging N schemas collides on
object kinds with the same silent overwrite the permissions array has, and then
`assertSchemaFit` (`validate.ts:452-457`) runs every origin's conditions against
the merged declaration. A kind that two origins declare differently would turn
one origin's valid condition into a `FieldTypeMismatchError` about a shape its
author never wrote.

**And `access.matrix` would have to return something.** It is a frozen document
that round-trips through JSON (`create-policy.ts:190-194`). A merged one is a
document no producer emitted and no service owns, and handing it out invites
somebody to construct from it, which is the merged matrix the topology says does
not exist.

`federation.mdx:12` is the sentence that settles it: "There is no merged matrix
anywhere in the topology." A function in this package that produces one
contradicts the page that motivates the function.

### 2.2 What the returned value is

`FederatedAccess` is a distinct interface. It cannot be `Access`, for the reason
above: `matrix`, `version` and `schema` (`create-policy.ts:194-198`) have no
single value over N documents, and a getter returning the first, or an array, or
undefined, would be three different lies.

```ts
export interface FederatedAccess {
  can(
    subject: Subject,
    key: string,
    action: string,
    object?: Record<string, unknown>,
    now?: Instant,
  ): Decision;
  capabilities(subject: Subject, now?: Instant): Record<string, Decision>;
  get(origin: string): Access | undefined;
}

export function federatedPolicies(
  policies: Readonly<Record<string, Access>>,
): FederatedAccess;
```

`can`'s signature is `Access.can`'s, unchanged, so a caller holding one moves to
the other by changing the receiver.

### 2.3 The four members that are not there

`2026-09-17-acl-no-cascade.md` § 7 counted what a facade costs: `Policy<Sub, R>`
re-declares nine `Access` members, `ErasedPolicy` declares the same nine again,
and about 105 of `authoring.ts`'s 487 lines carry no behaviour. Part B removes
that. A federated set forwarding nine members rebuilds it in another file, and
the second time would be harder to argue against, because the first one shipped.

So each forward has to pay for itself.

- **`canMany`** batches one permission over many objects and settles one clock
  for the list (`create-policy.ts:405-409`). One permission means one origin, and
  a caller that knows the key can reach the origin through `get`. No forward.
- **`canFields`** is a form-rendering call against one row of one kind. The
  caller holds the row, so it holds the kind, so it knows the origin. No forward.
- **`readsObject`** is a fact about one document
  (`create-policy.ts:224-248`). Same argument. No forward.
- **`authorize`** is the one with a case: an edge is per request, and a bound
  subject with a bound instant is what an edge wants. It is declined because
  `Authorized` has four members (`create-policy.ts:171-186`) and a federated
  bound handle would carry two, which is a second new interface for a convenience
  the caller gets by passing `subject` twice. Decision 9 already settles the
  clock, which was the substantive half. This is the forward I would add first if
  the surface grows.

`get(origin)` is what makes all four declinations honest. It returns the `Access`
the caller passed, unchanged, with every member on it.

## 3. Routing

### 3.1 By key

`can(subject, key, action)` looks `${key}.${action}` up in the map § 1.1 built and
forwards to that origin's `Access` with the arguments untouched. The forwarded
call reaches an `Access` that holds the key, so `objectFor`
(`create-policy.ts:306-311`) finds the kind and `permissionFor` (`:313-321`)
finds the permission. An open-mode member never sees an unknown key through this
path, which is why `federatedPolicies` does not need to read `closed` and could
not read it if it wanted to: `closed` is not on `Access`.

A router that dispatches on the namespace prefix was the alternative, and
decision 8 rules it out. The library does not know what `:` means, and a split on
it would make the library know, which is § 6.

### 3.2 An origin nobody registered

The current region's answer is already the right one:

```ts
const absent = policies.get('orders')?.can(subject, 'shipping:parcel', 'read');
absent?.reason; // -> 'unknown-action'
```

That answer arrives by accident there, because the caller asked orders about a
shipping key and orders is closed. Under decision 7 the federated set answers it
directly: no member holds `shipping:parcel.read`, so the set returns
`{ key: 'shipping:parcel.read', allowed: false, reason: 'unknown-action' }`
without forwarding to anyone.

This keeps the property `federation.mdx:63-68` names. An unreachable upstream is
an origin absent from the record, its keys are absent from the map, and every one
of them answers `unknown-action`. A degraded fleet fails closed by absence, and
no code path exists that somebody has to remember to write.

## 4. The deny overlay

### 4.1 Before composition, and the types say so

`applyDenyOverlay(matrix, overlay, options): Matrix`
(`deny-overlay.ts:88-92`) takes and returns a document. `federatedPolicies` takes
`Access` values, and an `Access` holds a document that was already validated and
frozen at `adopt` (`create-policy.ts:125-129`, `:300`). There is no point after
composition at which a `Matrix` is available to overlay.

So the pipeline is `2026-09-16-deny-overlay.md` § 7's, run per origin, with one
step appended:

```
authored matrix -> applyDenyOverlay -> parseMatrix -> Access  ┐
authored matrix -> applyDenyOverlay -> parseMatrix -> Access  ├─> federatedPolicies
authored matrix ----------------------> parseMatrix -> Access  ┘
```

The third row is an origin that fetched no overlay, which is every origin's own
decision (`2026-09-16-deny-overlay.md` § 6: a compliance team cannot make a
service apply its rules).

**`federatedPolicies` takes no overlay, no `vetoable` list and no matrix.** This
is the load-bearing half of decision 10. An overlay parameter would have the edge
applying a veto to a document it does not own, in a process
`federation.mdx:54-61` describes as advisory, and the services behind the edge
would never see it. That inverts `deny-overlay.ts:5-7`: "the service that
enforces the veto is the service that applies it."

### 4.2 A `vetoable` key belongs to one origin

The second question is whether origin A's overlay can deny a `vetoable` key from
origin B. It cannot, and the refusal is already written.

`applyDenyOverlay` indexes the target matrix (`deny-overlay.ts:93`) and throws
`UnknownPermissionError` for any overlay key the target does not define
(`:103` for a vetoable entry, `:114` for a contribution). `billing:invoice.read`
is not defined in the orders matrix, so an overlay naming it and applied to
orders refuses, by key, at apply time.

The framing correction matters more than the mechanism. An overlay is not owned
by an origin. It is a third party's document that each owning service fetches and
applies to its own matrix. "Origin A's overlay denying origin B's key" is not a
configuration the API can express in the first place: there is no call in which
A's matrix and B's key appear together.

So the cross-origin boundary is exact and always was, and nothing in
`federatedPolicies` widens it. The set forwards decisions from documents that
were already overlaid, and it has no channel to a document at all.

### 4.3 Which world this assumes

`2026-09-17-acl-no-cascade.md` § 6 found that the overlay's reach today exceeds
what `vetoable` documents, because step 2 of the precedence order propagates a
deny to the dependants of a vetoed key whether or not the owner listed them.

That over-reach is contained inside one origin. `dependsOn` does not cross an
origin: `orders:order.ship` naming `billing:invoice.paid` fails at construction
with `UnknownDependencyError`, inside orders' own process
(`federation.mdx:74-82`). So every key the propagation reaches is a key of the
same document that was overlaid, and § 4.2's boundary holds unchanged in both
worlds.

**This spec assumes neither world and is correct in both.** What differs is what
an edge sees in the folded view. Before Part A, an overlay on `orders:article.
update` can turn off `orders:article.publish` in the view, and no `vetoable` list
named `publish`. After Part A, the view shows exactly the keys the owner opened.
The federated set computes nothing either way; it forwards what orders decided,
and orders decided it in orders' process.

One consequence is worth stating because it will not be obvious later. If Part A
does not land, an operator reading a federated view and trying to explain a
`false` on a key no overlay mentions has to know that the deny came through a
cascade inside one origin's document, and the federated set carries no marker
saying which origin's cascade. `get(origin)` and that origin's `access.matrix`
are the whole of the trail.

## 5. How this composes with the rename

`2026-09-17-acl-no-cascade.md` decision 23 splits the document entries by
provenance:

| Entry            | The document is           | Unknown key  |
| ---------------- | ------------------------- | ------------ |
| `policy().build` | one you are writing now   | throws       |
| `hydratePolicy`  | yours, arriving back      | throws       |
| `parseMatrix`    | somebody else's, arriving | fails closed |

**`federatedPolicies` is not a fourth row.** It takes no document. Every member
of the record was built by one of the three, and the set accepts whichever,
because all three return `Access` (`parse-matrix.ts:21-26` returns
`createPolicy`'s result with `closed` flipped).

A federated set is built from documents other services wrote, so the common case
is `parseMatrix` on every member, and the brief's placement on the
foreign-document side is right for that case:

```ts
const fleet = federatedPolicies({
  orders: parseMatrix(ordersJson),
  billing: parseMatrix(billingJson),
});
```

The mixed case is real and is the reason the set must not care. A BFF that owns
one of the documents it serves holds its own document alongside two foreign ones:

```ts
const fleet = federatedPolicies({
  orders: parseMatrix(ordersJson),
  billing: parseMatrix(billingJson),
  sessions: hydratePolicy(ownDocument),
});
```

`sessions` throws on an unknown key inside its own `Access` and the other two
fail closed, which is what each provenance calls for. A builder over matrices
(§ 2.1) would have to pick one of those behaviours for all three.

There is one thing decision 13 owes the rename. `2026-09-17-acl-no-cascade.md`
decision 26 switches the README's `federation` region to `parseMatrix`
(§ 10.4, "It is the genuinely foreign case and it is currently built on
`createPolicy`"). Decision 14's rewrite of that region has to land on
`parseMatrix` if part D is taken and on `createPolicy` if it is not, and the two
changes touch the same lines. Whichever lands second takes the other's form.

## 6. The namespace stays a string

`orders:invoice` is a convention today and the library knows nothing about it.
`validate.ts:428-440` refuses a `.` inside `object` or `action`, and the comment
above it says why `:` is then available:

> A key is built by joining the two parts on a dot, and that join is reversible
> only while neither part carries one [...] An object kind namespaced by origin is
> spelled with a colon -- `orders:invoice.read` -- which stays legal.

"Stays legal" is the whole of the support. Nothing splits on `:`, nothing
requires it, and `key !== `${object}.${action}`` is the only structural claim
about a key (`validate.ts:442-444`).

Decision 8 keeps that, for three reasons.

**A structural namespace is a format change.** `Permission` would gain an
`origin`, or `object` would become a parsed pair. Every foreign producer emits
`Permission`, and `2026-09-17-acl-no-cascade.md` Part A is deleting a member of
it in this same session. A new member added for a composition convenience runs the
other way.

**It would be obligatory, and most documents have no origin.** The quick start's
`comment.read` has none. A namespace the API knows about is a namespace the API
checks, and a check over documents that mostly carry no namespace either fails
every one of them or is optional, which is a convention with a type on it.

**The check does not need it.** The invariant is that the key sets are disjoint,
and a comparison over `permission.key` tests exactly that. A structural check
would test that the origin prefixes differ, which is a stronger claim that
answers a different question: two origins could share a prefix and still hold
disjoint keys, and two origins with different prefixes cannot collide anyway. The
weaker string comparison is the one that matches the invariant, and it holds for
a fleet where nobody namespaces anything.

The consequence is decision 6. `federatedPolicies` cannot derive an origin from a
key, so the record's keys stay caller-supplied, exactly as the `Map` in the region
is today, and they are used for two things: `get(origin)` and the two names in
`OriginCollisionError`.

## 7. What this costs, and what a caller loses without it

### 7.1 The cost, counted

One module. One exported function, one exported interface with three members, one
error class exported from `index.ts`. No change to `Matrix`, `Permission`,
`Rule`, `Access`, `AccessOptions`, `createPolicy`, `parseMatrix`,
`applyDenyOverlay` or `policy()`. A reader of the quick start meets none of it,
the same way `2026-09-16-deny-overlay.md` § 8 checked for the overlay.

The honest accounting is not the line count. It is that this session has spent
itself removing surface: `2026-09-17-acl-no-cascade.md` deletes `graph.ts`, two
error classes, a type, two `Decision` members, a `Reason` member and about 105
lines of facade. An entry point added against that current needs an argument that
the alternative is worse, and § 7.3 is where I make it.

### 7.2 What a caller loses by not having it

Two things, and they are not the same size.

**The invariant stays a comment.** An edge that folds N capability maps has no
way to learn that two of its upstreams collided, and `README.md:720` currently
tells that reader the fold is safe. This is the whole case for the function.

**The fold reads N clocks.** Decision 9 fixes it, and so does one argument in the
README region:

```ts
const at = Date.now();
const view = Object.assign(
  {},
  ...[...policies.values()].map((a) => a.capabilities(subject, at)),
);
```

No library code. If this were the only defect, the answer would be that one edit
and nothing else.

**Routing is not on the list.** `policies.get(origin)?.can(...)` works today, is
one line, and needs nothing. Decision 6 is a consequence of decision 1, not a
motivation for it.

### 7.3 Why a documented convention plus a lint is not available here

The brief offered that alternative and it is the right instinct, because it is the
answer `2026-09-17-acl-no-cascade.md` § 4 reached for `dependsOn`: a lint moves
the failure to build time and keeps it out of the runtime surface.

It does not reach here, and the reason is structural. A lint runs over a
repository, and the two colliding documents are in two repositories, owned by two
teams, and neither one is wrong on its own. `orders`' matrix is valid.
`billing`'s matrix is valid. The collision exists only in the process that holds
both, and that process holds them because they arrived over HTTP at startup. There
is no build step anywhere in the topology with both documents in hand, so there is
nowhere to put the lint.

Where the check has to go is where both documents are, and that is the edge, at
runtime, at construction. Which is decision 1.

### 7.4 The four-line alternative, stated so it can be chosen

The check is small and the data is public, so an edge can write it:

```ts
const seen = new Map<string, string>();
for (const [origin, access] of policies) {
  for (const p of access.matrix.permissions) {
    const held = seen.get(p.key);
    if (held !== undefined) throw new Error(`${p.key}: ${held} and ${origin}`);
    seen.set(p.key, origin);
  }
}
```

That is the function's whole content, minus the routing map it also produces.

**I recommend building it anyway, and the reason is not difficulty.** This
package refuses a configuration error at construction everywhere else it can:
duplicate keys (`graph.ts:28-30`), a key that does not match its parts
(`validate.ts:442-444`), a dependency on a permission that is not configured, and
the overlay's three refusals (`deny-overlay.ts:103`, `:114`, `:122`). The one
place it leaves a configuration error to a comment is the topology it documents as
its answer to scale. Every edge that writes the fold has to know to write those
four lines, and the document that would have told them says the fold is safe.

If the owner declines the function, decision 14 is not optional. § 8.

## 8. The region changes either way

`README.md:720` has to stop claiming an invariant nothing enforces, whatever is
decided above.

If decisions 1 to 13 are taken, the region becomes a `federatedPolicies` call and
the comment goes, because the claim is then true by construction and the reader
can see what makes it true.

If they are not, the region keeps the `Map` and the fold and gains two things: the
`Date.now()` argument from § 7.2, and the four-line check from § 7.4 written out
in the fence, with the comment reworded to say that the disjointness is the
reader's to maintain. `federation.mdx:51-52` carries the same sentence in prose
and takes the same correction.

The one thing that must not survive is the current pairing: a comment asserting
the property, above a fold that depends on it, in the region a reader copies.

## Testing

- Two origins claiming one key refuse at construction, asserted on the error
  class and on a message naming the key and both origins. A third origin holding
  a disjoint key set constructs.
- The collision is detected for keys that carry no namespace at all. Two matrices
  that both declare `{ object: 'invoice', action: 'read' }` are both valid
  documents and are the case decision 8 exists to catch.
- A collision between a key one origin declares and a key another origin declares
  only in `denyRules` is not a collision: the check reads `permission.key`, and a
  deny rule has none.
- `capabilities` over N origins equals the `Object.assign` fold over the same
  origins with one shared instant, key for key, for a matrix set with no
  collision. This is the compatibility assertion for the region being rewritten.
- The single clock: a matrix whose permission is gated on `{ field: 'now', op:
'before', value: B }` and a second matrix gated on `{ op: 'after', value: B }`,
  folded with an explicit `now` on either side of `B`, produce a view in which
  exactly one is allowed, at every N. The hand-rolled fold cannot be asserted this
  way, which is what makes decision 9 a fix and not a tidy.
- `can` routes to the origin holding the key and its `Decision` is identical,
  field for field, to that origin's own `can` with the same arguments, including
  `unevaluable` with its `missing` paths.
- A key no origin holds answers `unknown-action` and forwards to nobody, asserted
  with a member constructed open, which would have thrown had it been reached.
- `get` returns the identical `Access` reference the caller passed, so
  `get(origin)?.matrix === passed.matrix`.
- An empty record constructs and answers `unknown-action` for everything.
- The overlay's position: `federatedPolicies` over an origin whose matrix was
  overlaid reports the narrowed decision, and the same set built from the
  un-overlaid document reports the original. This asserts the pipeline order in
  behaviour, where a comment is all that states it today.
- An overlay naming another origin's key refuses at `applyDenyOverlay` with
  `UnknownPermissionError`, asserted at the overlay call and not at
  `federatedPolicies`, so the boundary is shown to live where § 4.2 says it does.
- `federatedPolicies` accepts a record mixing `parseMatrix` and the open-mode
  entry, and each member keeps its own unknown-key behaviour when reached through
  `get`.
- The refusal is mutation-proven: removing the collision check makes the first
  test fail, and replacing the shared instant with a per-member `Date.now()`
  makes the clock test fail.

## Where I am guessing

- That an edge would rather fail to start than serve a view with an overwritten
  entry. Decision 1 makes one upstream's naming mistake into the edge's startup
  failure, and the edge owns neither document. The mitigation is that the edge can
  drop the offending origin and keep serving, because
  `federation.mdx:63-68` already makes an absent origin safe, but a gateway
  operator paged at 3am about billing's namespace will not describe that as a
  mitigation. This is the decision to revisit first if it hurts.
- That nobody wants `authorize` on the set. § 2.3 declines it on surface cost, and
  an edge is the most per-request site in the topology, which is the strongest
  case for a bound handle anywhere in this library. I would not argue hard against
  adding it.
- That the folded view's advisory status is enough to keep the collision from
  being a security question. Every source in this repository says the edge view is
  advisory and every service re-decides
  (`federation.mdx:54-61`, `README.md:737-739`). If some consumer ever treats a
  capability map as authoritative, a collision stops being a rendering fault, and
  nothing in the library can detect that consumer.
- That three members is the right surface and it will stay three. The facade this
  avoids started as forwards that each looked justified, and the argument in § 2.3
  is the same argument that could be made about the fourth member, and the fifth.
- That `permission.key` is the right granularity for the check. It catches two
  origins claiming one decision, which is the invariant the fold needs. It does
  not catch two origins declaring one object kind with different fields, which is
  a modelling collision that produces no fold error and no wrong answer today. I
  have not worked out whether that stays harmless as the schema surface grows.
- That the region rewrite in § 8 is the only documentation change. I read
  `federation.mdx` in full and grepped the word across the acl content, but the
  fold appears in the README as a region that seven other pages may transclude,
  and I did not re-count the transclusions after the `2026-09-17-acl-no-cascade.md`
  part D edits move several of them.
