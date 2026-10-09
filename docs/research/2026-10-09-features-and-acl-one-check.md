# One check across @evanion/feature and @evanion/acl: what is actually shared

Date: 2026-10-09
Subject: issue #219, "Explore a unifying check across features and ACL"

Method: I read the source at `origin/main` @ `855d9273` in a worktree of that commit. The graphify knowledge graph (6,051 nodes over 918 files, built from the same commit) supplied the cross-package pairs and the file locations; every claim below was then read out of the file it cites. Two claims are runtime-verified: I ran a throwaway script against `libs/acl/src/index.ts` through `tsx` and the transcript is quoted in section 5. Line numbers are at `855d9273`.

Scope note: #219 proposes a third package that answers "may this subject do this, and is it switched on". This memo answers the prior question the issue itself raises: how much of the two packages is really the same shape, and whether anything should be shared at all. It changes no code.

---

## 1. `parseMatrix` and `parseFeatureConfig`

Same. Both are the foreign-document entry point, named next to a throwing entry point for an authored literal. `parseMatrix` at `libs/acl/src/parse-matrix.ts:43` is one line: `hydratePolicy(matrix, { ...options, closed: true })`. `hydratePolicy` at `libs/acl/src/hydrate-policy.ts:467` is the local form. On the other side, `parseFeatureConfig` at `libs/feature/src/lib/parse.ts:28` is the reporting form of `createFeatures` at `libs/feature/src/lib/features.ts:716`. Both carry the same type-parameter trick for a document that arrived as JSON and therefore has no literal for the compiler to read names off: `parseMatrix<Sub, R, Keys>` and `parseFeatureConfig<S>`.

Different, and the premise that the two "both fail soft on a foreign document" is wrong. `closed: true` reaches only the unknown-key lookups: `objectFor` at `hydrate-policy.ts:494-500` and `permissionFor` at `:502-509` return instead of throwing. The document itself still goes through `adopt` at `hydrate-policy.ts:127-131`, which calls `validateMatrix`, and that throws — `InvalidMatrixError` at `libs/acl/src/errors.ts:119`, `InvalidPermissionError`, `InvalidConditionError` and the rest. So `parseMatrix` fails soft on an unknown _key_ and hard on a malformed _document_.

`parseFeatureConfig` fails soft on both. It wraps `collectIssues` in a try/catch at `parse.ts:44-48` and `createFeatures` in a second one at `parse.ts:57-65`, and returns `{ ok: false, issues }` for a document whose own members raise on being read.

The divergence is already documented, in the function that chose it. `parse.ts:19-23` names the other package's line and the reason:

> `@evanion/acl` draws the line elsewhere and the divergence is deliberate. `parseMatrix` at `libs/acl/src/parse-matrix.ts:43-49` throws, because an ACL consumer fetches a contract at boot and a malformed contract is a deploy failure the consumer wants loudly. This takes the name and refuses the throw.

Would a shared abstraction hold? No. A shared `parse` has to pick throw or report, and that is the one axis the two packages chose differently for a stated reason. Picking throw makes a feature poller take down a process that is serving traffic. Picking report makes an ACL boot failure silent. The shared thing here is a naming convention — `parse*` reports, the other entry point throws — and a convention needs no module.

## 2. Version revalidation

Same. `Matrix.version` at `libs/acl/src/types.ts:222` and `FeatureConfig.version` at `libs/feature/src/lib/config.ts:197` are both `string | number`, both compared with `!==`, both documented as opaque and unordered. Both lift the member onto the handle: `Access.version` at `hydrate-policy.ts:356`, `Features.version` at `features.ts:69`. feature's docblock at `config.ts:189-196` argues the ordering point in full — declining a lower version blocks a rollback, which is the operation an operator reaches for at 3am, and accepting only a higher one breaks a control plane serving two shards whose counters diverged. acl's at `types.ts:216-219` states the same conclusion in one sentence.

Different: what a mismatch does. acl rebuilds. The revalidate contract is user-space, four lines, and lives in the tested region `revalidate` at `libs/acl/docs/examples.md:3136-3181`:

```ts
function revalidate(current: Access, served: Matrix): Access {
  return current.version === served.version ? current : parseMatrix(served);
}
```

An `Access` is immutable for its life; there is no reload path in the engine. feature installs in place. `reload` at `features.ts:1119-1205` validates the candidate, clones and deep-freezes it, builds the candidate graph, and only then assigns the references the store reads, so a candidate that fails at any step leaves every reference where it was (`features.ts:1102-1106`). It returns `ReloadResult` (`config.ts:284`), which names the `changed` keys and, on a refusal, both the version that stayed and the one that was rejected.

feature also carries `digest` (`config.ts:199`) and `schemaVersion` (`config.ts:201`); acl carries neither. acl carries `AccessOptions.version` (`hydrate-policy.ts:148-158`), an override so a construction site that merged a deny overlay can state a composite effective version (`orders@7+veto@41`); feature has no counterpart, and `reload` is the one writer of its `version` (`features.ts:1066-1071`).

Would a shared abstraction hold? A shared `isStale(held, served)` is `held !== served`. The comparison is three tokens and the docblock explaining why it is not `<` is the whole asset. That docblock is already written twice, which is the right number of times for a sentence a reader of either package needs in front of them. A shared module would move it away from both. One convention page could state it once and both docblocks could cite it.

## 3. The schema vocabularies

Same, and it is a port rather than convergence. feature says so: `config.ts:120-123` reads "Ported from `libs/acl/src/types.ts:157-171`". The `FieldType` union is byte-identical between `libs/acl/src/types.ts:167-171` and `libs/feature/src/lib/config.ts:134-138`, as is `BaseFieldType` (`types.ts:157`, `config.ts:125`), down to the `instant` member and the four-arm template-literal spelling of optional and array forms.

Both enforce the same two checks against a declared shape, and only those two: a condition naming a field the declared shape does not declare, and an operator that does not fit the declared type. acl throws `UnknownFieldError` (`errors.ts:149`) and `FieldTypeMismatchError` (`errors.ts:163`); feature reports `'unknown-context-field'` and `'field-type-mismatch'`, raised at `libs/feature/src/lib/validate.ts:1683` and `:1697`. Both make the schema optional for a producer and binding when present, and both leave an undeclared kind or an absent schema unchecked (`types.ts:186-203`, `validate.ts:1580-1586`).

Different: the containers, because the thing being described differs. acl's `MatrixSchema` (`types.ts:204`) is `{ subject?, objects? }`, keyed by object kind, each an `ObjectSchema` (`types.ts:180`) with `fields` and `relations` — an ACL condition reads two namespaced scopes and object kinds are the matrix's own axis. feature's `FeatureSchema` (`config.ts:169`) is `{ context?, features? }`: `ContextSchema` (`config.ts:157`) is one flat `fields` map because a flag has a subject and no object, and `features` is a _second_ vocabulary, JSON Schema via `ValueShape` (`config.ts:148`), for variant values the engine never reads. `config.ts:171-175` states why there are two: the engine reads a context field and compares it with a closed operator set, and it reads no variant value at all.

Would a shared abstraction hold? For `BaseFieldType`, `FieldType` and the operator-fits-type predicate, yes — that is two type aliases and one function, and feature already took them by copy with a citation. Nothing above that level survives the move, because an object-kind-keyed map and a flat context map are not two configurations of one type.

## 4. acl's `unevaluable` / `missing` and feature's `PlanEntry.needs`

Same shape, same member name, same precedence rule. acl's `ConditionOutcome` at `libs/acl/src/types.ts:72-77` has the arm `{ state: 'unevaluable'; missing: readonly string[] }`, lifted to `Decision.reason === 'unevaluable'` with `Decision.missing` (`types.ts:252-268`); the union of missing paths across the rules of one side happens at `libs/acl/src/evaluate.ts:30-39` and `:66-88`. feature's `PlannedRule` at `libs/feature/src/lib/evaluate.ts:270-272` has `{ state: 'unevaluable'; missing: readonly string[] }` — the same two member names — lifted to `PlanEntry.resolved === 'deferred'` with `PlanEntry.needs` (`libs/feature/src/lib/types.ts:343-360`).

Both reached the same precedence conclusion independently. acl, at `evaluate.ts:18-21`: a condition that `fails` decides the rule however many of the others are unevaluable. feature, at `evaluate.ts:255-259`: "A rule's conditions are AND-ed, so one condition the context refutes decides the rule however many of the others read a field the context lacks. No value of an absent field makes the AND hold." Both therefore walk past a refuted rule instead of deferring on it, and both are careful about which condition they blame — acl names the first unevaluable rule and unions the paths (`evaluate.ts:48-50`), feature names a failed condition only when every condition ahead of it was readable (`evaluate.ts:286-297`).

Different, and this is what answers #219's hard question. acl's `unevaluable` is a per-call runtime state. feature's `needs` is a build-time planning state, and feature has no runtime counterpart at all. `evaluateRule` at `libs/feature/src/lib/evaluate.ts:46` treats an absent condition field as a condition that did not hold, and an absent bucketing value as a rollout that did not match, with the reason given inline at `evaluate.ts:65-67`: "Defaulting it to 'in' would ramp a rollout to everyone whose context happens to be incomplete." `Decision` (`libs/feature/src/lib/types.ts:278`) carries no `missing`, and `Reason` (`types.ts:230`) has five members, none of them `unevaluable`.

So #219's question — "what does it return when the flag is on and the permission is `unevaluable`?" — has no symmetric answer to find. There is nothing on the flag side to merge with. A union returns acl's `Decision` with its `missing` intact plus one boolean, and the lossiness the issue worries about is one-sided: it is the flag's `reason`, `rules`, `blockedBy` and `cause` (`types.ts:278-330`) that a boolean would discard, not acl's.

Would a shared abstraction hold? The outcome type and the AND-precedence rule could be one small module of shared vocabulary. It would not be shared behaviour: the two packages call it from opposite sides of the build/run line, so the module would export a type and a comment and no code path either package shares.

## 5. The two deep freezes — the one real defect

Same intent. Both packages freeze a deep copy rather than the caller's object, both guard the walk against a structure that refers back to itself. acl: `deepFreeze` at `libs/acl/src/hydrate-policy.ts:30-44`, an explicit stack with a `Set` seen-set, over `structuredClone`d permissions (`cloneNode`, `:54-60`) assembled by `rebuild` (`:99-110`) inside `adopt` (`:127-131`). feature: `deepFreeze` at `libs/feature/src/lib/features.ts:304-327`, recursion with a `WeakSet`, over `structuredClone`d definitions (`features.ts:782`).

Different: feature seals internal-slot mutators before it freezes, and acl does not. `sealMutators` at `features.ts:266-283` replaces every `Date` `set*` method, every `Map` `set`/`delete`/`clear` and every `Set` `add`/`delete`/`clear` with an own property that throws `TypeError`. The reason is at `features.ts:257-261`: "`Object.freeze` locks an object's own properties and covers no internal slot. A frozen `Date` still answers `setTime`."

acl's walk freezes the `Date` and then steps over it — `hydrate-policy.ts:36-40`:

```ts
Object.freeze(at);
if (at instanceof Date) continue;
```

A `Date` is reachable in an acl matrix. `validateMatrix` accepts one as a `before`/`after` boundary at `libs/acl/src/validate.ts:135` (`value instanceof Date`), `structuredClone` carries a `Date` through `cloneNode`, `toEpoch` at `libs/acl/src/conditions.ts:20-24` calls `value.getTime()` on the boundary at every evaluation rather than settling it once, and `Access.matrix` is public (`hydrate-policy.ts:349-356`, documented as the thing an SSR crossing serializes).

Verified. A matrix with one `before` rule, boundary `new Date('2020-01-01T00:00:00Z')`, evaluated at `2026-10-09`:

```
before: { key: 'doc.read', allowed: false, reason: 'no-rule-matched' }
after : { key: 'doc.read', allowed: true,  reason: 'allow', rule: 'w' }
```

The only statement between the two lines is `access.matrix.permissions[0].rules[0].when[0].value.setTime(Date.parse('2030-01-01T00:00:00Z'))`. `Object.isFrozen` on that value answers `true` before and after. The reverse direction works the same way: a boundary moved backwards turns an `allow` into a `no-rule-matched`. So a holder of `access.matrix` can move a time boundary on a frozen matrix and flip a decision in either direction, including into a grant.

Would a shared abstraction hold? This is the one pair where the answer is yes, and the reason is a defect rather than elegance. acl's copy is the weaker one and feature's is a superset of what acl needs: the `Map` and `Set` arms are unreachable for an acl matrix, since `structuredClone` is the only way a value enters and `validateMatrix` fences the members a permission may carry (`libs/acl/src/validate.ts:303-312`). The two also differ on re-entering an already-frozen value — feature returns early at `features.ts:307`, which is also what stops `sealMutators` redefining a property it already made non-configurable.

Sharing the code is optional. Fixing acl is not, and it is independent of #219.

## 6. `stale-contract` and `maxStale`

Same member, same unit, same owner. `Matrix.maxStale` (`libs/acl/src/types.ts:233`) and `FeatureConfig.maxStale` (`libs/feature/src/lib/config.ts:217`) both state how long a holder may keep deciding on the document, in milliseconds, set by the publisher as a ceiling.

Different: acl enforces it and feature declines to. acl's `expiryOf` (`hydrate-policy.ts:197`) settles `fetchedAt + min(document maxStale, options.maxStale)` once at construction; past it, `can`, `canMany`, `canFields` and `capabilities` answer `reason: 'stale-contract'` for every key, including a key the document does not hold (`hydrate-policy.ts:485-489`, and `types.ts:246-250` for why). Reporting `fetchedAt` against a document that states no budget throws `MissingFreshnessBudgetError` (`errors.ts:350`) rather than reading the absent field as zero, because zero "would expire every key for the life of the process, which is indistinguishable from the origin being down". A holder may tighten the owner's bound and never extend it (`hydrate-policy.ts:176-182`).

feature's `config.ts:208-216` says the opposite in as many words: "Advisory, and no entry point in this library reads it… This library holds no clock authority." It leaves the poller, the fetch instant, and the choice to shorten an interval or serve a fallback to whatever reads the document.

Would a shared abstraction hold? No, and the asymmetry is the right one. A stale ACL grant is a revocation that did not take effect. A stale flag is a ramp that did not move. Paying acl's cost for the second — a throw at construction when a holder reports a fetch instant the publisher never budgeted for — would make a flag store refuse to start over a field nobody set.

What is shared is a rule, not code: a freshness budget belongs to the document's owner, and a holder may only tighten it. That sentence is worth stating once and citing from both, and whatever reads feature's document is where it would apply if it ever does.

## 7. acl's fail-closed default and luhn's construction-time refusal

Not the same question. The graph paired them on a surface.

luhn's `codePointsOf` (`libs/luhn/src/lib/luhn.ts:106-148`) throws `InvalidDictionaryError` for five reasons, enumerated as `InvalidDictionaryReason` at `libs/luhn/src/lib/exceptions.ts:55`: `not-a-string`, `too-short`, `odd-length`, `duplicate`, `case-pairs`. The docblock at `luhn.ts:155-157` states what the throw buys: "Everything a dictionary has to satisfy is checked here, once. Nothing is checked at use, so an accepted instance cannot produce a code its own `validate` rejects." `createLuhn` then returns `Object.freeze` of the bound instance (`luhn.ts:253`). It is a constructor precondition over a self-contained mathematical property, and it makes the instance total.

acl's fail-closed is not a precondition. `AccessOptions.closed` defaults to `false` (`hydrate-policy.ts:162-165`, read at `:475`), and it governs what a _query_ does with a key the document does not carry: `false` throws `UnknownPermissionError` (`errors.ts:385`) or `UnknownObjectKeyError` (`errors.ts:375`), `true` answers `{ allowed: false, reason: 'unknown-action' }`. Nothing about it is settled at construction, and it cannot be: the key arrives with the call.

What the two actually share is a different convention, and feature holds it too: an authored literal throws and a foreign document answers. acl spells it `closed: false` for `hydratePolicy` and `closed: true` for `parseMatrix` (`parse-matrix.ts:43-49`). feature spells it `createFeatures` against `parseFeatureConfig` (`parse.ts:11-23`). luhn has only the authored side — no caller fetches a dictionary over a wire — so it has only the throw.

Would a shared abstraction hold? There is nothing to share. Three throws over three unrelated invariants, and the convention above them is a sentence.

## 8. The union #219 proposes

Nobody writes the conjunction. No file in the repository imports both packages' APIs. `apps/storefront`, `apps/storefront-rsc`, `apps/shop-api` and `apps/admin` import `@evanion/acl`; `apps/docs` imports `@evanion/feature`. The two files that hold both strings — `apps/docs/app/navigation.ts:263` and `:362`, and `apps/docs/tools/test-statistics.mjs:27` and `:174` — hold docs-site package metadata, not a gate. #219's own bar is unmet by its own terms: "until a real caller in the demo apps or the docs wants it, this is speculative and should stay closed".

The motivation is also partly spent. acl no longer carries `dependsOn`: `assertMembers` at `libs/acl/src/validate.ts:323-334` refuses a permission carrying any member outside `PERMISSION_MEMBERS` (`validate.ts:303-312`), and the docblock names `dependsOn` as the instance that matters, because "a document written for the cascade states a deny this engine has no step for, so accepting it silently would grant what its author refused".

Two of #219's three design worries resolve cleanly against the source. The `unevaluable` worry is one-sided (section 4), so the union's return type is acl's `Decision` plus a boolean and nothing is lost on the ACL side. The ordering worry is already answered by an exported function: `readsObject` (`hydrate-policy.ts:418-421`) tells a caller in advance whether a permission needs the object row at all, so a caller can short-circuit on the flag and know when the ACL half would have cost it a fetch.

## 9. Recommendation

**Nothing shared for the union itself. Close #219 until a caller holds both handles.** Cost: zero. What it gives up: a consumer that eventually wants the conjunction writes four lines against two already-exported APIs.

**Port `sealMutators` into acl. This is a bug fix, not an abstraction.** Cost: about twenty lines in `libs/acl/src/hydrate-policy.ts`, one test, no API change, no new package, no dependency. Do not lift the freeze into a shared package instead. Both packages declare zero runtime dependencies (`libs/acl/package.json`, `libs/feature/package.json`), and both ship `src` in `files` to serve the `@evanion/source` export condition, so a shared module cannot be a private `internal/` project the way `@evanion/baize-ui` is — an npm consumer resolving `@evanion/acl/src/index.ts` would hit an unresolvable import. The lift therefore means a fourth published package and two new dependency edges, to deduplicate sixty lines. The port is strictly cheaper.

**Write one convention page, with no code, covering sections 1, 2, 6 and 7.** Four rules, each already stated as a docblock in two trees: the authored entry point throws and the foreign one answers; a document version is opaque and compared with `!==`; a freshness budget is the owner's ceiling and a holder may only tighten it; a library that evaluates locally claims no clock authority unless staleness is a security event. Cost: one file, no code change in either package. It gives the four pairs one home and lets both docblocks shrink to a citation.

**Keep copying the four type aliases from section 3 and section 4, with the citation.** `BaseFieldType`, `FieldType`, the operator-fits-type predicate, and the `{ state: 'unevaluable'; missing }` outcome. feature already did this once and said where it came from (`config.ts:120-123`), which costs a reader one hop and the build nothing. Promote them to a shared package only when a third consumer appears; two copies and a citation is cheaper than two dependency edges and the `src`-shipping problem above.

## Where I could not verify

**The blast radius of the `Date` mutator gap.** I verified the mechanism (section 5) and not its reach. `JSON.parse` never produces a `Date`, so a matrix that arrived over a wire holds ISO strings and the gap does not apply to it; only an authored literal reaches it. I did not trace every path by which an authored matrix's `access.matrix` reaches code in the same realm that the author does not control, so I cannot say whether any app in this repository is exposed.

**Whether acl's security tiers already cover it.** I grepped `libs/acl/src/` including `libs/acl/src/security/` for `setTime` and `sealMutator` and found nothing. I did not read `tier1-prevented.test.ts`, `tier2-primitives.test.ts` or `tier3-contract.test.ts` end to end, so a test asserting this under another name would have been missed.

**Where freshness enforcement lives.** `libs/feature/src/lib/config.ts:210-213` leaves the poller and `maxStale` to whatever reads the document, and this repository ships no such reader. Section 6's conclusion stands either way; where feature's freshness enforcement eventually lives does not.

**Whether a shared package could ship with no dependency edge.** I read `libs/acl/package.json`'s `exports` and `files` and `nx.json`'s `release` block, which puts every `libs/` project on npm and `internal/` outside it. I did not test whether the vite library build inlines a workspace import into `dist`, and I did not check whether the `@evanion/source` condition could be dropped for a shared module alone, which is the one thing that would make the `internal/` route viable.

**feature's `digest` against an acl equivalent.** `configDigest` (`libs/feature/src/lib/digest.ts`) has no acl counterpart and is not one of the seven pairs. I did not work out whether acl's `serialize` modes (`libs/acl/src/serialize.ts`) make a document digest meaningless for a matrix — a `reduced` serialization emits different bytes than the document it came from — or whether it is merely absent.
