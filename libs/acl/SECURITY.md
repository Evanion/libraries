# Security register

The classes of attack this package is held against, and what happens to each.
The adversarial suite in `src/security` is checked against this file: one entry
per class, one identifier, and the test that proves the entry. Adding a class is
an entry here plus a test there.

A one-off review does not run again. This does, under `nx test @evanion/acl`.

## Tiers

Every entry sits in exactly one tier, and the tier decides what a test may
claim.

| Tier | Meaning                                                       | What the test asserts                                                                                                |
| ---- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1    | The library prevents it.                                      | The attack produces a construction error or a decision that does not grant.                                          |
| 2    | The library supplies the primitive; the consumer must use it. | The primitive is correct, and — where one exists — the idiom it replaces is visibly wrong against the same decision. |
| 3    | Structurally out of scope.                                    | Nothing. The contract clause exists, and where the behaviour reads like a defence, what the engine actually does.    |

Tier 3 entries carry no passing defence, because a passing test there would
imply one. Where an entry names a gap with no defence at all, it says so.

Counts: 20 tier 1, 8 tier 2, 8 tier 3.

## Tier 1 — prevented

| ID      | Class                                                                                                              | CWE / OWASP        | Mechanism                                                                                                                                                                                                                                                               | Test                                |
| ------- | ------------------------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| SEC-001 | Mass assignment through a key present only in the proposed write                                                   | CWE-915, API3:2023 | The write axis decides every key of `proposed`, not only the keys the object carries, so an exclusion applies to a key the row has never held                                                                                                                           | `tier1-prevented.test.ts` › SEC-001 |
| SEC-002 | Fail-open on untrusted configuration: an absent or null `when`                                                     | CWE-1188, CWE-276  | Construction throws on a `when` that is absent, null or not a list, and an unconditional grant is spelled as an empty list, the form that survives a JSON round trip                                                                                                    | `tier1-prevented.test.ts` › SEC-002 |
| SEC-003 | Unreachable permission: a key that disagrees with its object and action                                            | CWE-566            | Construction throws on a `key` that differs from `object.action` and on a delimiter in either part                                                                                                                                                                      | `tier1-prevented.test.ts` › SEC-003 |
| SEC-004 | Unevaluable deny: a deny rule reading a path the projection lacks                                                  | CWE-863, A01:2021  | A deny side that cannot be read outranks a matching allow; the decision is `unevaluable` and names the paths to fetch                                                                                                                                                   | `tier1-prevented.test.ts` › SEC-004 |
| SEC-005 | Prototype pollution reaching a decision                                                                            | CWE-1321           | Every path read and every rule lookup is own-property guarded; every decision map is written with `defineProperty`                                                                                                                                                      | `tier1-prevented.test.ts` › SEC-005 |
| SEC-006 | A prototype member naming a transition edge                                                                        | CWE-1321           | The transitions map is read as own properties only                                                                                                                                                                                                                      | `tier1-prevented.test.ts` › SEC-006 |
| SEC-007 | A narrowed write carrying `__proto__` into the consumer's row                                                      | CWE-1321           | `__proto__` names no field, so it never enters a decision map and `pickAllowedFields` never returns it — `Object.assign` of the result cannot move a prototype. A schema declaring the name does not make it a field: the schema binds conditions, not the writable set | `tier1-prevented.test.ts` › SEC-007 |
| SEC-008 | Authoring token leakage: `*` and `!name` arriving as literal keys                                                  | CWE-915            | `*` and `!name` are syntax, not field names, wherever they turn up — in the rules, on the object, or in the write                                                                                                                                                       | `tier1-prevented.test.ts` › SEC-008 |
| SEC-009 | Operator and value confusion in a condition                                                                        | CWE-20             | An operand the engine would ignore is refused at construction rather than dropped                                                                                                                                                                                       | `tier1-prevented.test.ts` › SEC-009 |
| SEC-010 | Incorrect default permissions                                                                                      | CWE-276, A01:2021  | Nothing is allowed without an allow rule that matched: no rules, an empty rule list and an unknown action all refuse                                                                                                                                                    | `tier1-prevented.test.ts` › SEC-010 |
| SEC-011 | Authorization bypass through a user-controlled key                                                                 | CWE-566, API1:2023 | The untrusted path fails closed on an unknown key; the authored path throws                                                                                                                                                                                             | `tier1-prevented.test.ts` › SEC-011 |
| SEC-012 | Mutating the matrix after it is adopted                                                                            | CWE-913            | The matrix is a deep-frozen copy, so neither the caller's reference nor the exposed one can change what evaluates                                                                                                                                                       | `tier1-prevented.test.ts` › SEC-012 |
| SEC-013 | Configuration time of check to time of use (TOCTOU): a document that answers validation and evaluation differently | CWE-367            | The envelope is rebuilt from one read of each member, frozen, and validated as that copy, so nothing sits between the checked bytes and the evaluated ones. Covers `permissions`, `schema`, `version`, and everything under them                                        | `tier1-prevented.test.ts` › SEC-013 |
| SEC-014 | Object data that cannot be coerced, crashing the decision                                                          | CWE-754, CWE-248   | Only a primitive names a transition edge; a value with no prototype, a hostile `toString` and a symbol all deny                                                                                                                                                         | `tier1-prevented.test.ts` › SEC-014 |
| SEC-015 | Resource exhaustion through matrix shape                                                                           | CWE-674, CWE-400   | The freeze walk is iterative, and construction throws on a value nested deeper than the copy walks                                                                                                                                                                      | `tier1-prevented.test.ts` › SEC-015 |
| SEC-016 | Cost of a decision growing faster than the matrix                                                                  | CWE-400            | A decision reads the permission it was asked about and nothing else; the bound is asserted as a count of subject reads, not a duration                                                                                                                                  | `tier1-prevented.test.ts` › SEC-016 |
| SEC-017 | Type confusion across a JSON boundary                                                                              | CWE-1287           | Comparisons are strict: `'1'` is not `1`, `null` is not absent, a list is not the scalar it holds, a `Date` is not the string that spells it                                                                                                                            | `tier1-prevented.test.ts` › SEC-017 |
| SEC-018 | A clock or a boundary that does not parse, on either side                                                          | CWE-754            | A condition whose clock does not parse is `unusable-clock`, not a fail, and the state outranks a matching allow, so a time-gated deny goes on denying. A boundary that does not parse is an `InvalidConditionError` at construction                                     | `tier1-prevented.test.ts` › SEC-018 |
| SEC-019 | A hostile write escaping the decision it was narrowed against                                                      | CWE-915            | Property over generated writes of authoring tokens, prototype names, unicode shapes and oversized keys: every picked key was marked `allowed`, and applying the result moves no prototype                                                                               | `tier1-prevented.test.ts` › SEC-019 |
| SEC-020 | A document that is not an envelope reaching the engine                                                             | CWE-20             | A missing or non-array `permissions`, a version that is neither a string nor a number, a schema that is not one, a declared type that is not one, and a bare list with no envelope at all are all construction errors                                                   | `tier1-prevented.test.ts` › SEC-020 |

## Tier 2 — the primitive exists, the consumer must use it

| ID      | Class                                                                                                          | CWE / OWASP        | Primitive                                                                                                                                                                          | Test                                 |
| ------- | -------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| SEC-101 | Mass assignment when applying a write                                                                          | CWE-915, API3:2023 | `pickAllowedFields` keeps only what the decision marked `allowed`. Filtering by hand on `!== 'denied'` writes the unevaluable fields and every key the decision does not carry     | `tier2-primitives.test.ts` › SEC-101 |
| SEC-102 | A per-field config mistaken for a writable-field list                                                          | CWE-915            | A `targets`/`transitions` config restricts that field and no other; the writable set is stated by `fields.fields`. Without a name list every unnamed key is writable               | `tier2-primitives.test.ts` › SEC-102 |
| SEC-103 | Object-level authorization: insecure direct object reference (IDOR) / broken object level authorization (BOLA) | CWE-639, API1:2023 | A condition over `object.*` plus a projection that carries the field. A projection that omits it refuses rather than grants                                                        | `tier2-primitives.test.ts` › SEC-103 |
| SEC-104 | Reading an unevaluable decision as a grant                                                                     | CWE-863            | `allowed` is the gate; `missing` names what one refetch has to bring back. Gating on the reason string instead grants what the engine refused                                      | `tier2-primitives.test.ts` › SEC-104 |
| SEC-105 | Unicode and key-shape attacks on a field name                                                                  | CWE-176            | Names match as written, byte for byte. A composed and a decomposed spelling are two fields; an explicit allow-list closes the question, an exclusion list does not                 | `tier2-primitives.test.ts` › SEC-105 |
| SEC-106 | `in` and `eq` disagreeing about NaN                                                                            | CWE-1077           | `includes` is SameValueZero and `===` is not, so a list matches NaN where an equality never does. A rule that means "never" is an equality. JSON carries no NaN in the first place | `tier2-primitives.test.ts` › SEC-106 |
| SEC-107 | A stale matrix still granting a revoked permission                                                             | CWE-672            | `access.version` is the surface for detecting a mismatch. Comparing it, failing closed and refetching is the consumer's                                                            | `tier2-primitives.test.ts` › SEC-107 |
| SEC-108 | Reading the field maps as the gate                                                                             | CWE-863            | The maps answer what would be editable whatever the action decides; `allowed` is the composition of both                                                                           | `tier2-primitives.test.ts` › SEC-108 |

## Tier 3 — out of scope, documented

| ID      | Class                                                                    | CWE / OWASP       | Why no defence exists                                                                                                                                                                                                                              | Test                                                                                               |
| ------- | ------------------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| SEC-201 | Confused deputy: a forged subject                                        | CWE-441, A01:2021 | `can` authorizes the bag it is handed and has no channel to ask where it came from. Resolve the subject from a verified session, server-side                                                                                                       | `tier3-contract.test.ts` › SEC-201 — asserts "Subject authenticity" below                          |
| SEC-202 | Complete mediation                                                       | CWE-862, A01:2021 | Nothing makes an app call `can`. `authorize(subject)` makes the checked path the easy one; it cannot make the unchecked one impossible                                                                                                             | `tier3-contract.test.ts` › SEC-202 — asserts "Complete mediation" below                            |
| SEC-203 | Time of check to time of use (TOCTOU) between the decision and the write | CWE-367           | A decision describes the snapshot it was given and carries no freshness token. Re-check inside the transaction                                                                                                                                     | `tier3-contract.test.ts` › SEC-203 — asserts "Time of check to time of use" below                  |
| SEC-204 | A self-authorizing condition over subject-writable data                  | CWE-639           | The engine cannot know which object fields the subject can write, and the guarded read is a different action from the write that opens it                                                                                                          | `tier3-contract.test.ts` › SEC-204 — asserts "What a condition may read" below, and pins the grant |
| SEC-205 | Client-side enforcement                                                  | CWE-602           | The same call answers the same way in a browser and on a server; nothing in the types separates authoritative from advisory. The runtime decides                                                                                                   | `tier3-contract.test.ts` › SEC-205 — asserts "Security contract" below                             |
| SEC-206 | Disclosure through the matrix itself                                     | CWE-200           | The matrix ships in full: every key, role string, field name and time window. Name things as if they will be read                                                                                                                                  | `tier3-contract.test.ts` › SEC-206 — asserts "public document" below                               |
| SEC-207 | A caller-supplied clock                                                  | CWE-807, CWE-367  | `now` is a parameter, and a clock that parses is taken as given on every entry point that accepts one: a client-supplied instant slides every window in the matrix. Resolve it server-side. A clock that does **not** parse is SEC-018 and refuses | `tier3-contract.test.ts` › SEC-207 — asserts "The clock a decision reads" below, and pins the gap  |
| SEC-208 | The subject and the object are read live                                 | CWE-367           | The matrix is copied and frozen; the subject and the object are the app's data and are not. A bag whose properties are accessors answers the deny side and the allow side separately. Pass plain, resolved objects                                 | `tier3-contract.test.ts` › SEC-208 — asserts "The bag a decision reads" below, and pins the gap    |

## Security contract

Authorization is only as strong as the place it runs. A decision counts where it is made: it is **authoritative** in a trusted environment (a React Router 8 or Next.js server runtime, a Node service, the server side of an API boundary) and **advisory** everywhere else. In a browser, the same `can` call, with the same signature and the same return type, only toggles what the user sees. Nothing in the types separates the two; the runtime does.

**Every layer decides for itself.** Every app in the chain evaluates the request on its own and trusts no earlier layer. A gateway or a BFF that already allowed the request does not excuse the service behind it from deciding again, because a caller reaches that service directly whenever it wants to. There is no transitive trust and no "already checked upstream" exemption. Deciding twice is cheap: the second evaluation is a local function call over a frozen object, with no network round-trip.

**The matrix is a public document**, in its names and structure as well as its values. It ships to the client in full, so anyone who loads the page can read:

- every object kind and every action name
- every role string that appears in a condition
- every field name, including the ones the API never returns
- every state machine and its terminal states
- every time window and its boundaries

That is a map of your privilege model and of your server's internal vocabulary. It is not an argument against shipping the matrix: security must not rest on the document staying secret, and here it does not. It is an argument for naming things as if they were going to be read, because they are. An action named `bypass-kyc` or a role named `internal-fraud-reviewer` is a disclosure the moment the page loads.

The rest of the contract is yours to own. A library that claimed to cover these would be lying about what an evaluator can see. Each clause below is an entry in the tables above, which the adversarial suite in `src/security` is checked against.

### Subject authenticity

`can(subject, ...)` authorizes the bag it is handed, and it has no way to ask where that bag came from. If you derive the subject from anything the client controls (a header, a query parameter, an unverified token body, a field the client posted), the engine faithfully authorizes the attacker's claimed identity. This is the confused deputy, and no evaluator can fix it.

**The Fix**: Resolve the subject from a verified session or a verified token, server-side, before it reaches `can`.

### Complete mediation

Nothing makes you call `can`. A new route, a new resolver, a background job, an admin script, a direct query: each one is unguarded until someone guards it. The library can make the checked path the easy one, through `authorize(subject)` bound once in middleware, but it cannot make the unchecked path impossible.

**The Fix**: Treat "every path is covered" as a property of your app, and assert it in your app's tests.

### Time of check to time of use

A decision describes the snapshot it was given. Between `can` returning `true` and the write landing, the object can change owner, the subject can lose the role, and the time window can close. The library carries no freshness token and has no way to detect the gap.

**The Fix**: Re-read the object and re-check inside the transaction, or write with a conditional predicate that fails when the state it was authorized against has moved.

### The clock a decision reads

`now` is a parameter. Omit it and the engine reads the wall clock; supply it and the engine reads whatever you passed, and every `before`/`after` window moves with it. A `now` that reaches `can` from a client payload (a request body, a query string, anything the browser sent) hands the client every time window in the matrix.

**The Fix**: Pass `now` only to make a server render and the client's first render agree, and resolve it server-side.

In a browser, the wall clock belongs to the subject. Setting the system clock back re-opens a window that has closed, and the library cannot detect it, because the clock is an argument. A role condition reads the subject a server resolved; a time condition reads a value the subject's machine produced. Both are advisory in a browser, and the second is the weaker of the two. A server passing its own `now` is unaffected.

A clock that parses is taken as given. A clock that does not (`null`, `NaN`, an `Invalid Date`, a string that is not a date) refuses instead: every permission that needs the clock to decide answers `{ allowed: false, reason: 'unusable-clock' }`, on the allow side and the deny side alike. A permission whose deny rule matches, or whose allow side definitely fails, still answers `denied` or `no-rule-matched` first. Supply an instant that parses, or none at all.

### The bag a decision reads

Conditions read `subject` and `object` live, field by field, as the decision walks the rules. The deny side is evaluated before the allow side, and each side reads the fields its own rules name. A bag whose properties are accessors (an ORM row, a lazy proxy, a memoised getter over a cache that can refill) can answer the two sides differently and pass the deny it should have matched.

The matrix the engine evaluates is a frozen deep copy for exactly this reason. The subject and the object are not copied, because they are your app's data, and copying them would hide the cost.

**The Fix**: Pass plain, already-resolved objects.

### What a condition may read

A condition may read only fields the subject cannot write. A rule that keys on an object field within the subject's reach is self-authorizing: the subject edits the field, then passes the check the field controls. `eq('object.sharedWith', 'subject.id')` is the obvious trap, letting a user put their own id in the share field and be authorized for it.

**The Fix**: Keep the field out of every write path the rule guards, or key the rule on something the subject cannot reach: ownership set at creation, a role on the subject, a field the server alone writes.

On the [security page](https://docs.evanion.com/acl/security/), the share dialog writes `sharedWith` and any customer reaches it, so a read rule keyed on `sharedWith` hands the list to whoever shares it with themselves. The rule keyed on `ownerId` holds, because no write path carries `ownerId`:

### Matrix freshness

A client holds the matrix it last fetched. When a permission is revoked, that client keeps granting it until it refetches, and it has no way to notice. `access.version` is a surface for detecting a mismatch, not a mechanism for resolving one: comparing it, failing closed, and forcing a refetch are yours to implement. The comparison is a `!==`, so a digest or a composite covering every input works as well as a counter. The server never depends on a client's copy in any case, since it evaluates its own.

A document that states no `version` leaves `access.version` undefined, and a `!==` against undefined decides nothing. A producer that wants the contract to hold states a version; a content hash of the document is enough.

The whole mechanism the library supplies is the comparison. Fetching, deciding what to do with a mismatch, and rebuilding are yours, and the [security page](https://docs.evanion.com/acl/security/) shows them.

Until that runs, the client grants what it last fetched. Nothing pushes an update to a holder. A holder that reports `fetchedAt` gets a freshness budget from the document's `maxStale`, and past `fetchedAt + min(maxStale, options.maxStale)` every key answers `stale-contract`. A holder that reports no `fetchedAt` claims no freshness and runs under no expiry.

## Where the suite lives, and why

`libs/acl/src/security`, matched by the package's existing `src/**/*.{test,spec}.ts`
include. It runs under `nx test @evanion/acl` with no configuration of its own,
so CI enforces it and there is no separate project for someone to forget. It is
its own directory because it is a distinct concern from the unit tests — those
assert the behaviour of a function, these assert that an attack does not work —
and because a reader looking for the security posture should find one place.

Matrices are built through the factory in `src/security/fixtures.ts` rather than
written as literals, so a change to the matrix format is one helper.
