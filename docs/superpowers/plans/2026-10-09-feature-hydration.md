# Feature Hydration and Cross-Process Agreement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A server resolves a subject's decisions and ships them to the client that renders the same tree. The client holds the rules too, so it can disagree. This plan makes the shipped set carry the configuration version and the instant it was resolved at, has the provider render the shipped set and name what it could not have reproduced, and has `resolvePlan` finish a build-time plan against a client context without re-deciding what the build already decided.

**Architecture:** Two new core modules declare the wire types: `decision-set.ts` for `DecisionSet` and `divergence.ts` for `DivergenceReport` plus the one call that invokes an observer and swallows what it throws. `features.ts` gains `snapshot`, which is `resolve` plus the version, the instant and the origin. `resolve-plan.ts` walks a plan in graph order and applies one of three rules per entry. `src/react/hydrate.ts` holds every check the provider runs, so `index.tsx` keeps its one job of publishing a context value. `evaluate.ts` exports `withVariant`, which `resolve-plan.ts` needs to attach an assignment to a decision the build already settled.

**Tech Stack:** TypeScript 6.0.3, Vitest with `typecheck`, React 18/19 peer, Nx.

**Spec:** `docs/specs/2026-09-23-feature-hydration.md`. Read its 11 decisions and § 1 through § 9 before starting.

**Issue:** #280.

**Depends on:** #279 (configuration distribution) and #274 (variants), both merged to `main` at `855d9273`. Every interface this plan consumes from them is in the tree.

## Six reconciliations against merged main

The spec was written before the distribution work landed. Four of its decisions are already satisfied by code on `main`, and three of its code snippets do not compile against the types that landed. Read this section before Task 1; it is why the task list is shorter than the decision list.

### Decisions 1, 2 and 3 are done, under another name

`hydrateFeatures` exists as `parseFeatureConfig` at `libs/feature/src/lib/parse.ts:28`:

```ts
export function parseFeatureConfig<
  S extends Record<keyof S, VariantInfo | never> = Record<
    FeatureKey,
    VariantInfo | never
  >,
>(
  config: FeatureConfig<Extract<keyof S, FeatureKey>>,
  options?: FeatureOptions<S>,
):
  | { ok: true; features: Features<S, boolean> }
  | { ok: false; issues: readonly ConfigIssue[] };
```

It takes the document, it throws nothing, it reports every issue at once, and the caller keeps whatever store it held. `parse.spec.ts` already pins each test § 2 asks for: `reports every issue the document carries, not the first` (:306), `carries no store on the refusal` (:293), `refuses a document whose digest does not describe it` (:326), `reads no advisory duration, at either end of the range` (:269), `refuses a variant set whose order no document member declares` (:454), `leaves the document it refused exactly as it was handed it` (:499).

No task adds a second entry point. A `hydrateFeatures` alias would publish two names for one function, and `doc-export-coverage.test.ts` would then demand two reference entries for it.

### Decision 11 is done

`libs/feature/src/lib/bucketing.ts:71` declares `utf8`, which walks the string and emits its UTF-8 bytes, writing U+FFFD for a lone surrogate. `murmur3Bytes` hashes the array and `murmur3` calls `utf8` for the string form. `TextEncoder` appears nowhere in `bucketing.ts` or `digest.ts`, and `digest.spec.ts:430` already asserts a digest with `TextEncoder` and `structuredClone` deleted from `globalThis`.

### `Features.version` is done

`features.ts:70` declares `readonly version: string | number | undefined`, lifted off the installed envelope. `features.ts:76` declares `readonly envelope: ConfigEnvelope` beside it. Task 2 reads both and adds neither.

### `InvalidConfigDocumentError` does not exist and is not needed

The spec header names it. `collectIssues` reports a `ConfigIssue` with a code, a message, a `key` and a JSON pointer, and `parseFeatureConfig` returns those. No task adds the error class.

### Three of the spec's snippets do not compile

`Features` and `Decisions` are generic over a schema, not over a key. Both constrain their parameter to `Record<keyof S, VariantInfo | never>`, so every signature the spec sketches with a `FeatureKey` parameter in that position is rejected by the compiler.

| The spec writes                                                                    | It fails because                                                                                                           | This plan writes                                                                                                                 |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `resolvePlan<F extends FeatureKey>(features: Features<F>, plan: Plan<F>, …)`       | `Features<string>` violates `S extends Record<keyof S, VariantInfo \| never>`; `Plan<string>` violates the same constraint | `resolvePlan<S extends Record<keyof S, VariantInfo \| never>>(features: Features<S>, plan: Plan<S> \| DeepReadonly<Plan<S>>, …)` |
| `interface DecisionSet<F extends FeatureKey = string> { decisions: Decisions<F> }` | `Decisions<string>` violates the same constraint                                                                           | `interface DecisionSet<S extends Record<keyof S, VariantInfo \| never> = Schema, Frozen extends boolean = boolean>`              |
| `hydrateFeatures<S>(document: unknown, options?): HydrateResult<S>`                | no `HydrateResult` type exists and none is wanted                                                                          | nothing; `parseFeatureConfig` already returns the union inline                                                                   |

`DivergenceReport<F extends FeatureKey = string>` as the spec writes it does compile, and Task 1 writes it unchanged.

### § 8's `structuredClone` claim contradicts merged main

§ 8 says `hydrateFeatures` does not call `structuredClone` and asks for a test that runs it with the global deleted. `parseFeatureConfig` routes construction through `createFeatures` (`parse.ts:57-66`), and `createFeatures` calls `structuredClone` at `features.ts:789` per definition and at `features.ts:576` for the envelope. The merged comment states the reason: one construction path keeps one store shape in the package. Task 6 closes the gap on the document path alone and leaves the literal path on `structuredClone`.

## Global Constraints

Values copied from the spec. Where a value is a judgement this plan made because the spec is silent, the constraint says so.

- The package is unpublished (`libs/feature/package.json:4`, `"private": true`, version `0.0.1`). The `decisions` prop changes shape with no migration path and no deprecation.
- `FeatureProvider` compares `decisions.version` against `features.version` with `!==`. Never `<`, never `>`, never a parse (decision 5, § 3).
- Four version outcomes, and every one of the four renders the shipped decisions (§ 3):

  | shipped   | store               | outcome                              |
  | --------- | ------------------- | ------------------------------------ |
  | a version | the same version    | agreed, no report                    |
  | a version | a different version | `kind: 'config-version'`, reported   |
  | a version | none                | `kind: 'unversioned'`, reported      |
  | none      | any                 | `kind: 'unversioned'`, reported once |

- `onVersionMismatch` defaults to `'use-shipped'`. The other value is `'re-resolve'`. No third value (decision 6, § 3).
- `DecisionSet.now` is required and is an ISO 8601 string. `version` is optional and omitted for a store built from a literal. `origin` is `'render' | 'build'` (decision 4, § 3, § 6).
- `origin: 'render'` supplies the default `now` for everything a consumer resolves locally. `origin: 'build'` does not, and the consumer reads its own clock for the deferred remainder. An explicit `context.now` wins over both, which keeps the precedence at `features.ts:895-898` unchanged (decision 9, § 6).
- `DivergenceReport.kind` is exactly four values: `'config-version'`, `'unversioned'`, `'missing-field'`, `'decision-differs'`. No task adds a fifth (§ 7).
- The library wraps every `onDivergence` call in `try`/`catch` and discards what the callback throws. Nothing in the library reads a report back, and no report alters a decision (decision 10, § 7).
- `resolvePlan`, per entry (§ 5):
  1. `resolved` is a boolean with a `decision`: the entry's `decision` is the answer and nothing re-runs.
  2. `resolved` is `'deferred'` with no `decision`: `decide` runs for that feature against the client context, with the decisions settled so far in this pass as the cascade's parent map.
  3. `resolved` is `'deferred'` with a `decision`: `enabled`, `reason` and the explanation fields come straight off `entry.decision`, and only the variant assignment is computed. The rules do not re-run.
- `resolvePlan` walks in graph order, because a deferred parent puts its `needs` on its dependants (`evaluate.ts:243-245`) and a dependant resolved before its parent reads an empty parent map.
- An entry whose `needs` names a field the client context lacks is reported as `kind: 'missing-field'` naming the feature and the field, and the engine then falls back the way it already does (§ 5).
- The provider's context-sufficiency check runs in production, for one pass over the shipped set. The decision diff runs only when `process.env.NODE_ENV !== 'production'` (§ 4).
- `parseFeatureConfig` reads no `maxStale` and no fetch instant, and gains neither. The platform binding owns the refetch schedule (decision 2).
- A served document states `order`, `variantBy` and `variantSeed` on every feature declaring variants, or the checker refuses it. Verified: a document whose `cta` carries two weighted variants and none of the three members produces `invalid-variant-order` plus two `unknown-member` issues. Every test fixture in this plan that needs a served document builds it with `serializeConfig(createFeatures(literal), { version })`, which writes all three.
- Tests are `*.spec.ts` beside the source for the core and `*.spec.tsx` under `src/react` for the adapter; type tests are `*.test-d.ts` and `*.test-d.tsx`. `libs/feature/vite.config.ts` runs the core project in `node` over `src/lib/**` and the React project in `jsdom` over `src/react/**`. A file outside a project's `include` runs nowhere.
- `tools/repo-checks/src/doc-behaviour.test.ts` requires a `describe` spelling each non-error callable export's name exactly. `resolvePlan` needs `describe('resolvePlan')`.
- `tools/repo-checks/src/test-title-mood.test.ts` refuses an `it` title opening with `should`, `will`, `must` or `can`, and refuses Title Case.
- `tools/repo-checks/src/test-assert-boundary.test.ts` requires a blank line before the first `expect` in a case body that arranges anything above it.
- `tools/repo-checks/src/exported-type-closure.test.ts` requires that every type named in an exported declaration is exported from the file that declares it. `DivergenceSide` and `DecisionOrigin` are exported for that reason.
- `tools/repo-checks/src/doc-export-coverage.test.ts` demands a `##` heading on the API reference for every export and a running example for every callable one. The reference pages are owned by another session, so each task that adds an export adds its name to `tools/repo-checks/src/doc-export-coverage-allowance.json` under `@evanion/feature`. The file is sorted and the sort is checked.
- `tools/repo-checks/src/doc-regions.test.ts` checks that every `file=… region=…` reference on a page resolves. It does not require a region to be referenced, so a new region in `libs/feature/docs/examples.md` is safe to add before the page exists.
- Documentation prose is not written here. Tested regions go in `libs/feature/docs/examples.md`. No task edits `apps/docs/content` or any README; another session owns those.
- Conventional commits, scope `feature` for library work and `repo-checks` for an allowance edit. The scope enum in `commitlint.config.js` already holds both.
- Verify each task with `npx nx run-many -t lint test typecheck -p feature repo-checks`. Do not run the full affected sweep; the land step and CI both run it.
- Prose in doc comments and commit messages: no em-dashes, no "X rather than Y", no "instead of", no bold lead-ins, every sentence names who or what does the thing, no gerund phrase as a subject, no metaphor verb for a technical fact, no three-item rhythmic lists.

## Rulings this plan makes where the spec is silent

Each one is also in the report's open questions, because the owner may want a different answer.

1. **`snapshot` takes an `origin` option, defaulting to `'render'`.** The spec gives `snapshot` one parameter and says `origin: 'build'` is "a `plan()` snapshot", but `plan()` returns a `Plan` and not a `DecisionSet`, so nothing in the spec's surface can produce a `'build'` set. A build pipeline is the party that knows, so it states it: `features.snapshot(context, { origin: 'build' })`.
2. **No `HydrateOptions.version` override.** Decision 4 says `Features.version` is what the envelope carried "or what `HydrateOptions.version` overrode". `FeatureOptions.version` already exists on `parseFeatureConfig`'s options and means the version an _event_ reports (`observe.ts:179`). A second `version` member on the same options object with a different meaning is a trap. A caller who wants another document version writes `parseFeatureConfig({ ...document, version })`, which is one line and which `configDigest` already strips before it canonicalises.
3. **No `onDivergence` option on `parseFeatureConfig`.** § 2 types it as "notified for every divergence this store detects later", and no store detects divergence. The provider detects it and `resolvePlan` detects it, and each takes its own observer, which § 7 also says.
4. **`snapshot` emits the existing `'resolve'` event.** `FeatureEvent` declares `resolve`, `is-enabled`, `plan` and `toggle` (`observe.ts:64-104`). A snapshot resolves every feature for one context, which is what a `resolve` event reports. No fifth event type.
5. **`publishedDecisions` is not exported from either entry.** It is the provider's whole body, lifted into `src/react/hydrate.ts` so `index.tsx` stays a publisher. Keeping it unexported keeps it out of `doc-export-coverage`.
6. **The provider reports from inside `useMemo`.** § 4 requires both checks to report before React reconciles, and the memo body is where the provider computes what it publishes. Under `StrictMode` a development render runs the body twice, so an observer counting reports sees two. The alternative, an effect, runs after reconciliation and reports the cause below the symptom.

## Review Focus

The input classes the spec implies, each with the task that owns its test.

| Class                                                        | Input                                                                            | Owning task                                                            |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| An observer that throws                                      | `onDivergence` raising out of the callback, under a unit call and under a render | Task 1 (unit), Task 4 (render)                                         |
| No observer at all                                           | `undefined` where an observer goes, on every reporting path                      | Task 1                                                                 |
| A store with no version                                      | a store built from a literal, whose `snapshot` must omit the member              | Task 2                                                                 |
| A store with a version                                       | a store parsed from a document, whose `snapshot` must carry it                   | Task 2                                                                 |
| A caller stating the origin                                  | `snapshot(context, { origin: 'build' })`                                         | Task 2                                                                 |
| A settled plan entry whose rules moved                       | `plan()`, then `reload` with different rules, then `resolvePlan`                 | Task 3                                                                 |
| A deferred entry carrying a decision                         | enablement settled, variant outstanding                                          | Task 3                                                                 |
| A deferred entry carrying none                               | a chain three deep, resolved in graph order                                      | Task 3                                                                 |
| A plan that names no entry for a configured feature          | a partial plan, which resolves the gap in full                                   | Task 3                                                                 |
| A plan keyed on a prototype member                           | `constructor` or `__proto__` as a feature key                                    | Task 3                                                                 |
| A context missing a deferred entry's `needs`                 | reported as `missing-field`, then the engine's own fallback                      | Task 3                                                                 |
| An instant a plan supplies                                   | `options.now` against `context.now` against the clock                            | Task 3                                                                 |
| Two versions that differ                                     | `'v1'` shipped against `'v2'` held                                               | Task 4                                                                 |
| One side carrying no version                                 | a set from a literal store against any store, and the reverse                    | Task 4                                                                 |
| A mismatch under `'re-resolve'`                              | the provider renders what it resolved itself                                     | Task 4                                                                 |
| An instant a render-origin set carries                       | the provider's local resolution reads it                                         | Task 4                                                                 |
| A context missing the field a shipped assignment bucketed on | reported as `missing-field` with the control it would have assigned              | Task 5                                                                 |
| A shipped decision that differs locally                      | in `enabled`, in `reason`, or in `variant`                                       | Task 5                                                                 |
| A production bundle                                          | `NODE_ENV=production`, where the diff must not run                               | Task 5                                                                 |
| A decision set keyed on a prototype member                   | `constructor` in the shipped map                                                 | Task 5                                                                 |
| A document a holder must refuse                              | order defects, a digest that covers other bytes, an unreadable member            | existing `parse.spec.ts`; Task 6 re-runs them with the globals deleted |
| A document carrying a value no copy reproduces               | a function, a symbol, a value nested past the stack                              | Task 6                                                                 |
| A fixture a second implementation must reproduce             | a fallback assignment, and a deferred entry carrying a decision                  | Task 7                                                                 |

---

## Task 1: The divergence report and the call that invokes an observer

**Deliverable:** `DivergenceReport`, `DivergenceSide` and `DivergenceObserver` declared once, and `reportDivergence`, which calls an observer and discards what it throws. Nothing consumes them yet.

**Files:**

- `libs/feature/src/lib/divergence.ts` (new)
- `libs/feature/src/lib/divergence.spec.ts` (new)
- `libs/feature/src/index.ts` (edit: three type exports)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)

**Interfaces consumed:**

```ts
// libs/feature/src/lib/types.ts
export type FeatureKey = string | number;
```

**Interfaces produced:**

```ts
// libs/feature/src/lib/divergence.ts
export interface DivergenceSide {
  version?: string | number;
  enabled?: boolean;
  variant?: string;
  source?: 'weighted' | 'pinned' | 'sticky' | 'fallback';
}

export interface DivergenceReport<F extends FeatureKey = string> {
  kind: 'config-version' | 'unversioned' | 'missing-field' | 'decision-differs';
  key?: F;
  field?: string;
  shipped?: DivergenceSide;
  local?: DivergenceSide;
  message: string;
}

export type DivergenceObserver<F extends FeatureKey = string> = (
  report: DivergenceReport<F>,
) => void;

export function reportDivergence<F extends FeatureKey>(
  observer: DivergenceObserver<F> | undefined,
  report: DivergenceReport<F>,
): void;
```

### Steps

- [ ] Write `libs/feature/src/lib/divergence.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { reportDivergence } from './divergence.js';
import type { DivergenceReport } from './divergence.js';

const REPORT: DivergenceReport = {
  kind: 'unversioned',
  message: 'one of the two carries no config version',
};

describe('reportDivergence', () => {
  it('hands the observer the report it was given', () => {
    const seen: DivergenceReport[] = [];

    reportDivergence((report) => seen.push(report), REPORT);

    expect(seen).toEqual([REPORT]);
  });

  it('discards what an observer throws', () => {
    expect(() =>
      reportDivergence(() => {
        throw new Error('observer');
      }, REPORT),
    ).not.toThrow();
  });

  it('calls nothing when no observer was installed', () => {
    expect(() => reportDivergence(undefined, REPORT)).not.toThrow();
  });

  it('reads nothing back off the report the observer altered', () => {
    const report: DivergenceReport = { ...REPORT };

    reportDivergence((given) => {
      given.kind = 'config-version';
    }, report);

    expect(report.kind).toBe('config-version');
  });
});
```

The fourth case records that the library writes the report, hands it over and reads no member of it afterwards. It asserts the mutation lands, which is the evidence that nothing downstream depends on the value.

- [ ] Write `libs/feature/src/lib/divergence.ts`:

```ts
import type { FeatureKey } from './types.js';

/** One side of a comparison, at the members a report names. */
export interface DivergenceSide {
  version?: string | number;
  enabled?: boolean;
  variant?: string;
  source?: 'weighted' | 'pinned' | 'sticky' | 'fallback';
}

/**
 * What a process could not reproduce, and why. Output only.
 *
 * Nothing in the library reads a report back, which is the invariant
 * `reason-is-output-only.spec.ts` already holds for `reason`. A report names
 * the feature at `key` when one feature is at fault, and the context field at
 * `field` on a `'missing-field'` report.
 */
export interface DivergenceReport<F extends FeatureKey = string> {
  kind: 'config-version' | 'unversioned' | 'missing-field' | 'decision-differs';
  key?: F;
  field?: string;
  shipped?: DivergenceSide;
  local?: DivergenceSide;
  /** One sentence naming the cause and the fix. */
  message: string;
}

/** What a caller installs to hear about divergence. */
export type DivergenceObserver<F extends FeatureKey = string> = (
  report: DivergenceReport<F>,
) => void;

/**
 * Calls `observer` and discards whatever it throws.
 *
 * An observer that takes down a render is worse than the divergence it was
 * reporting, so the raise stops here and the caller carries on with the
 * decisions it already computed.
 */
export function reportDivergence<F extends FeatureKey>(
  observer: DivergenceObserver<F> | undefined,
  report: DivergenceReport<F>,
): void {
  if (!observer) return;
  try {
    observer(report);
  } catch {
    return;
  }
}
```

- [ ] Add to `libs/feature/src/index.ts`, after the `parseFeatureConfig` export:

```ts
export type {
  DivergenceObserver,
  DivergenceReport,
  DivergenceSide,
} from './lib/divergence.js';
```

- [ ] Add `DivergenceObserver`, `DivergenceReport` and `DivergenceSide` to `undocumented` in `tools/repo-checks/src/doc-export-coverage-allowance.json`, under `@evanion/feature`, in sorted position. `reportDivergence` is not exported from the entry, so it needs no entry.

- [ ] Verify: `npx nx run-many -t lint test typecheck -p feature repo-checks`

---

## Task 2: The decision set and `Features.snapshot`

**Deliverable:** `DecisionSet`, `DecisionOrigin`, `SnapshotOptions`, and `Features.snapshot`, which resolves every feature for one context and states the version, the instant and the origin.

**Files:**

- `libs/feature/src/lib/decision-set.ts` (new)
- `libs/feature/src/lib/features.ts` (edit: the import, the interface member, the implementation, the returned object)
- `libs/feature/src/lib/snapshot.spec.ts` (new)
- `libs/feature/src/lib/snapshot.test-d.ts` (new)
- `libs/feature/src/index.ts` (edit: three type exports)
- `libs/feature/docs/examples.md` (edit: one region)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)

**Interfaces consumed:**

```ts
// libs/feature/src/lib/features.ts
readonly version: string | number | undefined;
resolve(context?: EvaluationContext): FrozenWhenObserved<Frozen, Decisions<S>>;
// libs/feature/src/lib/observe.ts
export type FrozenWhenObserved<Frozen extends boolean, T> = /* … */;
// libs/feature/src/lib/types.ts
export type Decisions<S extends Record<keyof S, VariantInfo | never>>;
export type Schema = /* … */;
// libs/feature/src/lib/parse.ts
export function parseFeatureConfig<S …>(config, options?):
  | { ok: true; features: Features<S, boolean> }
  | { ok: false; issues: readonly ConfigIssue[] };
```

Inside `createFeatures`, the implementation reads four locals that already exist: `withNow` (`features.ts:895`), `resolveAll` (`features.ts:949`), `frozenWhenObserved` (`features.ts:892`), `installed` (`features.ts:818`), plus `observed`, `emit` and `envelope`.

**Interfaces produced:**

```ts
// libs/feature/src/lib/decision-set.ts
export type DecisionOrigin = 'render' | 'build';

export interface DecisionSet<
  S extends Record<keyof S, VariantInfo | never> = Schema,
  Frozen extends boolean = boolean,
> {
  readonly version?: string | number;
  readonly now: string;
  readonly origin: DecisionOrigin;
  readonly decisions: FrozenWhenObserved<Frozen, Decisions<S>>;
}

export interface SnapshotOptions {
  readonly origin?: DecisionOrigin;
}

// libs/feature/src/lib/features.ts, on the Features interface
snapshot(
  context?: EvaluationContext,
  options?: SnapshotOptions,
): DecisionSet<S, Frozen>;
```

### Steps

- [ ] Write `libs/feature/src/lib/decision-set.ts`:

```ts
import type { FrozenWhenObserved } from './observe.js';
import type { Decisions, Schema, VariantInfo } from './types.js';

/** Where a decision set was produced. */
export type DecisionOrigin = 'render' | 'build';

/**
 * One subject's answers for one instant, with the configuration that produced
 * them.
 *
 * It crosses no service boundary. The process that produced it and the process
 * that consumes it are two halves of one page load, which is the line § 8 of
 * `docs/specs/2026-09-16-published-policy-contracts.md` draws between a
 * document and a decision.
 */
export interface DecisionSet<
  S extends Record<keyof S, VariantInfo | never> = Schema,
  Frozen extends boolean = boolean,
> {
  /**
   * The config version that produced these.
   *
   * Absent for a store built from a literal, which carries no version to
   * state. A consumer compares it with `!==` and orders nothing.
   */
  readonly version?: string | number;
  /** The instant they were resolved at, ISO 8601. */
  readonly now: string;
  /**
   * Where they came from.
   *
   * A `'render'` set came out of the request that produced the HTML, so its
   * instant is seconds old and every consumer reads it as the default for what
   * it resolves locally. A `'build'` set may be days old, so the consumer reads
   * its own clock for the remainder.
   */
  readonly origin: DecisionOrigin;
  readonly decisions: FrozenWhenObserved<Frozen, Decisions<S>>;
}

/** What a caller passes `Features.snapshot` beyond the context. */
export interface SnapshotOptions {
  /**
   * What the set states about where it came from. Defaults to `'render'`.
   *
   * A build pipeline that writes a set into a bundle passes `'build'`, because
   * it is the party that knows the instant it stated is not a request's.
   */
  readonly origin?: DecisionOrigin;
}
```

- [ ] Edit `libs/feature/src/lib/features.ts`. Add the import beside the `ConfigEnvelope` one:

```ts
import type { DecisionSet, SnapshotOptions } from './decision-set.js';
```

- [ ] Add the member to the `Features` interface, after `plan`:

```ts
  /**
   * Every decision for one context, with the configuration version and the
   * instant that produced them.
   *
   * `resolve` answers the decisions alone, and a consumer in another process
   * cannot recover either member from them. A set states both, so a server
   * states the instant once and no application passes `now` by hand.
   */
  snapshot(
    context?: EvaluationContext,
    options?: SnapshotOptions,
  ): DecisionSet<S, Frozen>;
```

- [ ] Add the implementation inside `createFeatures`, beside `plan`:

```ts
const snapshot = (
  context?: EvaluationContext,
  options?: SnapshotOptions,
): DecisionSet<Record<FeatureKey, VariantInfo>, boolean> => {
  const evaluationContext = withNow(context);
  const decisions = frozenWhenObserved(resolveAll(evaluationContext));

  if (observed) {
    emit({
      type: 'resolve',
      ...envelope(evaluationContext),
      decisions,
    } as FeatureEvent<Record<FeatureKey, VariantInfo>>);
  }

  return frozenWhenObserved({
    ...(installed.version === undefined ? {} : { version: installed.version }),
    now: evaluationContext.now.toISOString(),
    origin: options?.origin ?? 'render',
    decisions: decisions as Decisions<Record<FeatureKey, VariantInfo>>,
  });
};
```

The spread is what omits the member. A store built from a literal has `installed.version === undefined`, and `'version' in set` then answers `false`, so no consumer reads an `undefined` it has to tell apart from a version nobody stated.

- [ ] Add `snapshot,` to the returned object, between `plan,` and `toggle,`.

- [ ] Write `libs/feature/src/lib/snapshot.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';

const SPLIT = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
] as const;

/** The document a control plane at `version` serves, with every member stated. */
function served(version: string): FeatureConfig {
  return serializeConfig(createFeatures(SPLIT), { version });
}

describe('Features.snapshot', () => {
  it('carries the version the document it parsed states', () => {
    const parsed = parseFeatureConfig(served('v7'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

    const set = parsed.features.snapshot({
      now: new Date('2026-10-09T00:00:00Z'),
    });

    expect(set.version).toBe('v7');
  });

  it('states the instant it resolved at, as ISO 8601', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(
      features.snapshot({ now: new Date('2026-10-09T11:22:33.444Z') }).now,
    ).toBe('2026-10-09T11:22:33.444Z');
  });

  it('carries no version for a store built from a literal', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect('version' in features.snapshot()).toBe(false);
  });

  it('states a render origin when the caller names none', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot().origin).toBe('render');
  });

  it('states the origin a build-time caller names', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot({}, { origin: 'build' }).origin).toBe('build');
  });

  it('holds the decision resolve answers for the same context', () => {
    const features = createFeatures(SPLIT);
    const context = { targetingKey: 'u-4711' };

    expect(features.snapshot(context).decisions).toEqual(
      features.resolve(context),
    );
  });

  it('assigns the variant the subject buckets to', () => {
    const features = createFeatures(SPLIT);

    expect(
      features.snapshot({ targetingKey: 'u-4711' }).decisions.cta.variant,
    ).toBe('control');
  });

  it('reports one resolve event to a store that observes', () => {
    const seen: string[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => seen.push(event.type),
    });

    features.snapshot({ targetingKey: 'u-4711' });

    expect(seen).toEqual(['resolve']);
  });

  it('freezes what a store carrying an observer answers', () => {
    const features = createFeatures(SPLIT, { observe: () => undefined });

    expect(Object.isFrozen(features.snapshot({ targetingKey: 'u-4711' }))).toBe(
      true,
    );
  });

  it('reads an explicit instant over the clock', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [
              { field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' },
            ],
          },
        ],
      },
    ]);

    expect(
      features.snapshot({ now: new Date('2031-01-01T00:00:00Z') }).decisions
        .sale.enabled,
    ).toBe(true);
  });
});
```

`'control'` is the variant `u-4711` buckets to under the default seed, verified against the engine. The bucket is a pure hash, so the name is fixed and the test states it.

- [ ] Write `libs/feature/src/lib/snapshot.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';

import { createFeatures } from './features.js';
import type { DecisionSet } from './decision-set.js';

describe('Features.snapshot', () => {
  const unobserved = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    },
  ] as const);

  it('answers a set over the schema the definitions supplied', () => {
    expectTypeOf(unobserved.snapshot().decisions.cta.variant).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('states the instant as a string and the origin as its two values', () => {
    expectTypeOf(unobserved.snapshot().now).toEqualTypeOf<string>();
    expectTypeOf(unobserved.snapshot().origin).toEqualTypeOf<
      'render' | 'build'
    >();
  });

  it('answers the frozen form for a store carrying an observer', () => {
    const observed = createFeatures(
      [{ key: 'banner', enabled: false }] as const,
      { observe: () => undefined },
    );

    expectTypeOf(observed.snapshot()).toExtend<
      DecisionSet<{ banner: never }, true>
    >();
  });
});
```

- [ ] Add to `libs/feature/src/index.ts`:

```ts
export type {
  DecisionOrigin,
  DecisionSet,
  SnapshotOptions,
} from './lib/decision-set.js';
```

- [ ] Add a region to `libs/feature/docs/examples.md`, after the `inspect` region. Draft the code, then run the prose through gemma and correct only factual errors in her output:

````md
## Shipping a Snapshot to the Client

<!-- #region snapshot -->

```ts @import.meta.vitest
import { createFeatures } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
]);

// On the server, inside the request that renders the page.
const set = features.snapshot({
  targetingKey: 'cust-0042',
  now: new Date('2026-11-01T09:00:00Z'),
});

set.now; // -> '2026-11-01T09:00:00.000Z'
set.origin; // -> 'render'
set.decisions['checkout-cta'].variant; // -> 'control'
```

<!-- #endregion snapshot -->
````

`cust-0042` buckets to 0.3862 under the seed `checkout-cta`, which is the `control` band. `expect-comments` compares each `// ->` value against what the call answers.

- [ ] Add `DecisionOrigin`, `DecisionSet` and `SnapshotOptions` to `undocumented` in the allowance, in sorted position.

- [ ] Verify: `npx nx run-many -t lint test typecheck -p feature repo-checks`

---

## Task 3: `resolvePlan`

**Deliverable:** `resolvePlan`, which turns a build-time plan plus a client context into a full decision set, applying one of three rules per entry.

**Files:**

- `libs/feature/src/lib/evaluate.ts` (edit: export `withVariant`)
- `libs/feature/src/lib/resolve-plan.ts` (new)
- `libs/feature/src/lib/resolve-plan.spec.ts` (new)
- `libs/feature/src/lib/resolve-plan.test-d.ts` (new)
- `libs/feature/src/index.ts` (edit: one value export, one type export)
- `libs/feature/docs/examples.md` (edit: one region)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)

**Interfaces consumed:**

```ts
// libs/feature/src/lib/evaluate.ts
export function decide<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  context: EvaluationContext,
  resolved: ReadonlyMap<F, Decision<F>>,
): Decision<F>;
function withVariant<F extends FeatureKey>(
  decision: Decision<F>,
  assigned: VariantAssignment | undefined,
  source?: VariantAssignment['source'] | 'pinned',
  rule?: string,
): Decision<F>;                      // becomes `export function` in this task

// libs/feature/src/lib/graph.ts
export function buildGraph<F extends FeatureKey>(
  nodes: readonly GraphNode<F>[],
): FeatureGraph<F>;                   // `.order` is the dependency order

// libs/feature/src/lib/variants.ts
export function assignVariant<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  context: EvaluationContext,
): VariantAssignment | undefined;

// libs/feature/src/lib/features.ts
readonly config: readonly FeatureDefinition<keyof S & FeatureKey>[];

// libs/feature/src/lib/types.ts
export interface PlanEntry<F, V, T> {
  key: F;
  resolved: boolean | 'deferred';
  needs: readonly string[];
  decision?: Decision<F, V, T>;
}

// libs/feature/src/lib/divergence.ts   (Task 1)
export function reportDivergence<F extends FeatureKey>(
  observer: DivergenceObserver<F> | undefined,
  report: DivergenceReport<F>,
): void;
```

**Interfaces produced:**

```ts
// libs/feature/src/lib/resolve-plan.ts
export interface ResolvePlanOptions<F extends FeatureKey = string> {
  now?: Date;
  onDivergence?: DivergenceObserver<F>;
}

export function resolvePlan<S extends Record<keyof S, VariantInfo | never>>(
  features: Features<S>,
  plan: Plan<S> | DeepReadonly<Plan<S>>,
  context?: EvaluationContext,
  options?: ResolvePlanOptions<keyof S & FeatureKey>,
): Decisions<S>;
```

### Steps

- [ ] Edit `libs/feature/src/lib/evaluate.ts:148`: change `function withVariant` to `export function withVariant`. The docblock above it stays as it is.

- [ ] Write `libs/feature/src/lib/resolve-plan.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createFeatures } from './features.js';
import { resolvePlan } from './resolve-plan.js';
import type { DivergenceReport } from './divergence.js';

const SPLIT = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
] as const;

describe('resolvePlan', () => {
  it('uses a settled entry decision without re-running its rules', () => {
    const features = createFeatures([
      {
        key: 'pro-perks',
        enabled: true,
        rules: [
          { id: 'pro', when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
        ],
      },
    ]);
    const plan = features.plan({ plan: 'pro' });
    features.reload({
      features: [
        {
          key: 'pro-perks',
          enabled: true,
          rules: [
            { id: 'pro', when: [{ field: 'plan', op: 'eq', value: 'never' }] },
          ],
        },
      ],
    });

    expect(resolvePlan(features, plan, { plan: 'pro' })['pro-perks']).toEqual(
      plan['pro-perks'].decision,
    );
  });

  it('keeps enablement from a deferred entry and fills in the variant', () => {
    const features = createFeatures(SPLIT);
    const plan = features.plan({});
    const entry = plan.cta;

    const decisions = resolvePlan(features, plan, { targetingKey: 'u-4711' });

    expect(entry.resolved).toBe('deferred');
    expect(entry.decision?.variant).toBeUndefined();
    expect(decisions.cta.enabled).toBe(entry.decision?.enabled);
    expect(decisions.cta.reason).toBe(entry.decision?.reason);
    expect(decisions.cta.variant).toBe('control');
  });

  it('resolves a deferred entry carrying no decision in full', () => {
    const features = createFeatures([
      {
        key: 'pro-perks',
        enabled: true,
        rules: [
          { id: 'pro', when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
        ],
      },
    ]);

    expect(
      resolvePlan(features, features.plan({}), { plan: 'pro' })['pro-perks'],
    ).toEqual({
      key: 'pro-perks',
      enabled: true,
      reason: 'rule-match',
      rule: 'pro',
    });
  });

  it('resolves a chain deeper than two cascades in dependency order', () => {
    const features = createFeatures([
      {
        key: 'a',
        enabled: true,
        rules: [
          { id: 'tier', when: [{ field: 'tier', op: 'eq', value: 'gold' }] },
        ],
      },
      { key: 'b', enabled: true, dependsOn: ['a'] },
      { key: 'c', enabled: true, dependsOn: ['b'] },
    ]);

    const decisions = resolvePlan(features, features.plan({}), {
      tier: 'bronze',
    });

    expect(decisions.c).toEqual({
      key: 'c',
      enabled: false,
      reason: 'dependency-off',
      blockedBy: 'b',
      cause: { key: 'a', reason: 'no-rule-matched', rule: 'tier' },
    });
  });

  it('resolves a feature the plan names no entry for', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(resolvePlan(features, {}, {})['checkout']).toEqual({
      key: 'checkout',
      enabled: true,
      reason: 'default-on',
    });
  });

  it('reads no plan entry off the prototype chain', () => {
    const features = createFeatures([{ key: 'constructor', enabled: true }]);

    expect(resolvePlan(features, {}, {})['constructor']).toEqual({
      key: 'constructor',
      enabled: true,
      reason: 'default-on',
    });
  });

  it('reports the field a deferred entry still needs', () => {
    const features = createFeatures(SPLIT);
    const reports: DivergenceReport[] = [];

    resolvePlan(
      features,
      features.plan({}),
      {},
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports).toEqual([
      {
        kind: 'missing-field',
        key: 'cta',
        field: 'targetingKey',
        message: expect.stringContaining('targetingKey'),
      },
    ]);
  });

  it('assigns the first variant in the bucketing order for a context with no key', () => {
    const features = createFeatures(SPLIT);

    const decision = resolvePlan(features, features.plan({}), {}).cta;

    expect(decision.variant).toBe('control');
    expect(decision.assignment?.source).toBe('fallback');
  });

  it('reads the instant a render-origin caller supplies', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [
              { field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' },
            ],
          },
        ],
      },
    ]);

    const decisions = resolvePlan(
      features,
      features.plan({}),
      {},
      { now: new Date('2031-01-01T00:00:00Z') },
    );

    expect(decisions.sale.enabled).toBe(true);
  });

  it('reads an explicit context instant over the one the caller supplied', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [
              { field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' },
            ],
          },
        ],
      },
    ]);

    const decisions = resolvePlan(
      features,
      features.plan({}),
      { now: new Date('2029-01-01T00:00:00Z') },
      { now: new Date('2031-01-01T00:00:00Z') },
    );

    expect(decisions.sale.enabled).toBe(false);
  });

  it('throws nothing out of an onDivergence that throws', () => {
    const features = createFeatures(SPLIT);

    expect(() =>
      resolvePlan(
        features,
        features.plan({}),
        {},
        {
          onDivergence: () => {
            throw new Error('observer');
          },
        },
      ),
    ).not.toThrow();
  });
});
```

The first case is the spec's own test: mutate the store's rules between `plan()` and `resolvePlan` and assert the settled entries are unchanged. `reload` is the mutation, because the store's `config` is deeply frozen and a direct write raises.

- [ ] Write `libs/feature/src/lib/resolve-plan.ts`:

```ts
import { decide, withVariant } from './evaluate.js';
import { buildGraph } from './graph.js';
import { assignVariant } from './variants.js';
import { reportDivergence } from './divergence.js';
import type { DivergenceObserver } from './divergence.js';
import type { DeepReadonly } from './observe.js';
import type {
  Decision,
  Decisions,
  EvaluationContext,
  FeatureKey,
  Plan,
  PlanEntry,
  VariantInfo,
} from './types.js';
import type { Features } from './features.js';

/** What a caller passes `resolvePlan` beyond the plan itself. */
export interface ResolvePlanOptions<F extends FeatureKey = string> {
  /**
   * The instant to resolve the deferred remainder at.
   *
   * A `DecisionSet` carrying `origin: 'render'` states an instant seconds old,
   * and a caller passes it here so a window boundary between the server's
   * instant and the client's call cannot move half the tree. A set carrying
   * `origin: 'build'` states one that may be days old, and that caller passes
   * nothing, so this reads the client's own clock.
   */
  now?: Date;
  onDivergence?: DivergenceObserver<F>;
}

/**
 * Turns a build-time plan plus a client context into a full decision set.
 *
 * Three rules, one per kind of entry. A boolean `resolved` carrying a decision
 * is the answer and nothing re-runs, because the build already decided and a
 * client that re-decides throws away the point of planning. A `'deferred'`
 * entry carrying no decision goes through `decide` against the client context.
 * A `'deferred'` entry carrying a decision has its enablement settled and its
 * variant outstanding, so the enablement comes off the entry and only the
 * assignment is computed; a second run of the rules against a richer client
 * context can flip enablement, which would contradict the entry.
 *
 * The walk is the dependency order, because a deferred parent puts its `needs`
 * on its dependants and a dependant resolved before its parent would read an
 * empty parent map.
 */
export function resolvePlan<S extends Record<keyof S, VariantInfo | never>>(
  features: Features<S>,
  plan: Plan<S> | DeepReadonly<Plan<S>>,
  context?: EvaluationContext,
  options?: ResolvePlanOptions<keyof S & FeatureKey>,
): Decisions<S> {
  const entries = plan as Record<FeatureKey, PlanEntry<FeatureKey>>;
  const observer = options?.onDivergence as
    DivergenceObserver<FeatureKey> | undefined;
  const settled: EvaluationContext = {
    ...context,
    now: context?.now ?? options?.now ?? new Date(),
  };

  const resolved = new Map<FeatureKey, Decision<FeatureKey>>();
  const held = features.config;
  const positions = new Map<FeatureKey, number>(
    held.map((definition, at) => [definition.key, at]),
  );

  for (const key of buildGraph(held).order) {
    const at = positions.get(key);
    const definition = at === undefined ? undefined : held[at];
    if (!definition) continue;
    // A bare index walks the prototype chain, so a plan keyed `constructor`
    // reads a function off `Object.prototype`.
    const entry = Object.prototype.hasOwnProperty.call(entries, key)
      ? entries[key]
      : undefined;

    // The plan does not name this feature, so nothing about it is settled.
    if (!entry) {
      resolved.set(key, decide(definition, settled, resolved));
      continue;
    }

    // Rule 1. The build settled this one and nothing re-runs.
    if (entry.resolved !== 'deferred') {
      if (entry.decision) {
        resolved.set(key, entry.decision);
        continue;
      }
      resolved.set(key, decide(definition, settled, resolved));
      continue;
    }

    for (const field of entry.needs) {
      if (settled[field] !== undefined) continue;
      reportDivergence(observer, {
        kind: 'missing-field',
        key,
        field,
        message: `feature "${String(key)}": this plan deferred on "${field}" and this context carries none, so the engine falls back. Pass ${field} in the context you hand resolvePlan.`,
      });
    }

    // Rule 3. Enablement is settled and the variant alone is outstanding.
    if (entry.decision) {
      resolved.set(
        key,
        entry.decision.enabled
          ? withVariant(entry.decision, assignVariant(definition, settled))
          : entry.decision,
      );
      continue;
    }

    // Rule 2. Nothing about it is settled.
    resolved.set(key, decide(definition, settled, resolved));
  }

  return Object.fromEntries(resolved) as Decisions<S>;
}
```

`entry.decision.enabled` guards the assignment because `withVariant` would attach a variant to a decision that resolved off, and `Decision`'s docblock has `variant` present only on a feature that resolved on.

- [ ] Write `libs/feature/src/lib/resolve-plan.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';

import { createFeatures } from './features.js';
import { resolvePlan } from './resolve-plan.js';

describe('resolvePlan', () => {
  const definitions = [
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    },
    { key: 'banner', enabled: false },
  ] as const;

  it('answers the variant union the definitions declare', () => {
    const features = createFeatures(definitions);

    expectTypeOf(
      resolvePlan(features, features.plan()).cta.variant,
    ).toEqualTypeOf<'control' | 'blue' | undefined>();
  });

  it('declares no variant for a feature that has none', () => {
    const features = createFeatures(definitions);
    const decision = resolvePlan(features, features.plan()).banner;

    expectTypeOf(decision).not.toHaveProperty('variant');
  });

  it('takes the plan a store carrying an observer answers', () => {
    const features = createFeatures(definitions, {
      observe: () => undefined,
    });

    expectTypeOf(resolvePlan(features, features.plan())).toExtend<
      Record<'cta' | 'banner', unknown>
    >();
  });
});
```

- [ ] Add to `libs/feature/src/index.ts`:

```ts
export { resolvePlan } from './lib/resolve-plan.js';
export type { ResolvePlanOptions } from './lib/resolve-plan.js';
```

- [ ] Add a region to `libs/feature/docs/examples.md`, after the `snapshot` region. Draft the code, then run the prose through gemma:

````md
## Finishing a Build-Time Plan on the Client

<!-- #region resolve-plan -->

```ts @import.meta.vitest
import { createFeatures, resolvePlan } from '@evanion/feature';

const features = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
]);

// At build time, with no subject to bucket on.
const plan = features.plan({ now: new Date('2026-11-01T00:00:00Z') });

plan['checkout-cta'].resolved; // -> 'deferred'
plan['checkout-cta'].needs; // -> ['targetingKey']

// In the client, where the subject is known.
const decisions = resolvePlan(features, plan, { targetingKey: 'cust-0042' });

decisions['checkout-cta'].variant; // -> 'control'
decisions['checkout-cta'].assignment?.source; // -> 'weighted'
```

<!-- #endregion resolve-plan -->
````

- [ ] Add `ResolvePlanOptions` and `resolvePlan` to `undocumented`, and `resolvePlan` to `unexercised`, in the allowance. `unexercised` is needed because `doc-export-coverage` counts only a region a docs page references, and the page is another session's work.

- [ ] Verify: `npx nx run-many -t lint test typecheck -p feature repo-checks`. `doc-behaviour.test.ts` passes only because `resolve-plan.spec.ts` carries `describe('resolvePlan')`.

---

## Task 4: The provider takes a decision set and compares the two versions

**Deliverable:** `FeatureProviderProps.decisions` becomes a `DecisionSet`, `onDivergence` and `onVersionMismatch` are new props, and the provider renders the shipped decisions on a mismatch unless the application asked for the opposite.

**Files:**

- `libs/feature/src/react/hydrate.ts` (new)
- `libs/feature/src/react/index.tsx` (edit: imports, both props types, both providers, the type re-exports)
- `libs/feature/src/react/hydrate.spec.tsx` (new)
- `libs/feature/src/react/react.spec.tsx` (edit: one case)
- `libs/feature/src/react/types.test-d.tsx` (edit: two cases)
- `libs/feature/docs/examples.md` (edit: three regions)
- `tools/repo-checks/src/doc-export-coverage-allowance.json` (edit)

**Interfaces consumed:**

```ts
// libs/feature/src/lib/decision-set.ts   (Task 2)
export interface DecisionSet<S …, Frozen extends boolean = boolean>;
// libs/feature/src/lib/divergence.ts     (Task 1)
export type DivergenceObserver<F extends FeatureKey = string>;
export function reportDivergence<F extends FeatureKey>(observer, report): void;
// libs/feature/src/lib/features.ts
readonly version: string | number | undefined;
resolve(context?: EvaluationContext): FrozenWhenObserved<Frozen, Decisions<S>>;
// libs/feature/src/react/index.tsx
function erased<S …>(resolved: Decisions<S> | DeepReadonly<Decisions<S>>): AnyDecisions;
```

**Interfaces produced:**

```ts
// libs/feature/src/react/hydrate.ts
export type VersionMismatchPolicy = 'use-shipped' | 're-resolve';

export function publishedDecisions<
  S extends Record<keyof S, VariantInfo | never>,
>(
  features: Features<S>,
  context: EvaluationContext | undefined,
  shipped: DecisionSet<S> | undefined,
  onVersionMismatch: VersionMismatchPolicy,
  onDivergence: DivergenceObserver<keyof S & FeatureKey> | undefined,
): Decisions<S> | DeepReadonly<Decisions<S>>;

// libs/feature/src/react/index.tsx, on both props types
decisions?: DecisionSet<S>;            // DecisionSet<S, Frozen> on the bound one
onDivergence?: DivergenceObserver<keyof S & FeatureKey>;
onVersionMismatch?: VersionMismatchPolicy;
```

Task 5 adds `sufficiency` and `diff` to this same file. This task writes `publishedDecisions` with the two call sites already in place and the two functions stubbed to no-ops, so the signature does not move between tasks.

### Steps

- [ ] Write `libs/feature/src/react/hydrate.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createFeatures,
  parseFeatureConfig,
  serializeConfig,
} from '../index.js';
import { FeatureProvider, useFeature } from './index.js';
import type { DivergenceReport, FeatureConfig } from '../index.js';

const SPLIT = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
] as const;

/** The document a control plane at `version` serves, with every member stated. */
function served(version: string): FeatureConfig {
  return serializeConfig(createFeatures(SPLIT), { version });
}

function storeAt(version: string) {
  const parsed = parseFeatureConfig<{ cta: { variant: 'control' | 'blue' } }>(
    served(version),
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.features;
}

function Cta() {
  const decision = useFeature('cta');
  return <span data-testid="cta">{decision.variant}</span>;
}

describe('FeatureProvider', () => {
  it('renders the shipped decisions when the two versions disagree', () => {
    const client = storeAt('v2');
    const shipped = storeAt('v1').snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={client}
        decisions={shipped}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent(
      String(shipped.decisions.cta.variant),
    );
    expect(reports.map((report) => report.kind)).toContain('config-version');
  });

  it('names both versions on the report it sends', () => {
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={storeAt('v1').snapshot({ targetingKey: 'u-9' })}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(
      reports.find((report) => report.kind === 'config-version'),
    ).toMatchObject({ shipped: { version: 'v1' }, local: { version: 'v2' } });
  });

  it('renders what it resolves itself under re-resolve', () => {
    const shipped = storeAt('v1').snapshot({ targetingKey: 'u-9' });

    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={{
          ...shipped,
          decisions: { cta: { ...shipped.decisions.cta, variant: 'blue' } },
        }}
        context={{ targetingKey: 'u-9' }}
        onVersionMismatch="re-resolve"
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('control');
  });

  it('reports a set and a store that cannot be compared', () => {
    const literal = createFeatures([{ key: 'cta', enabled: true }]);
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={literal}
        decisions={literal.snapshot()}
        onDivergence={(report) => reports.push(report)}
      >
        <span />
      </FeatureProvider>,
    );

    expect(reports.map((report) => report.kind)).toEqual(['unversioned']);
  });

  it('sends no report when the two versions agree', () => {
    const store = storeAt('v1');
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={store.snapshot({ targetingKey: 'u-9' })}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(reports).toEqual([]);
  });

  it('resolves its own store when no set was shipped', () => {
    render(
      <FeatureProvider
        features={storeAt('v1')}
        context={{ targetingKey: 'u-9' }}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('control');
  });

  it('renders on through an onDivergence that throws', () => {
    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={storeAt('v1').snapshot({ targetingKey: 'u-9' })}
        context={{ targetingKey: 'u-9' }}
        onDivergence={() => {
          throw new Error('observer');
        }}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toBeInTheDocument();
  });

  it('reads the instant a render-origin set carries', () => {
    const store = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [
              { field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' },
            ],
          },
        ],
      },
    ]);
    const shipped = store.snapshot({ now: new Date('2031-01-01T00:00:00Z') });

    function Sale() {
      return (
        <span data-testid="sale">{String(useFeature('sale').enabled)}</span>
      );
    }

    render(
      <FeatureProvider features={store} decisions={shipped} context={{}}>
        <Sale />
      </FeatureProvider>,
    );

    expect(shipped.origin).toBe('render');
    expect(screen.getByTestId('sale')).toHaveTextContent('true');
  });
});
```

The third case overrides the shipped variant to `'blue'` so the two answers differ, then asserts the provider rendered `'control'`, which is what the client store resolves for `u-9`.

- [ ] Write `libs/feature/src/react/hydrate.ts`:

```ts
import { reportDivergence } from '../lib/divergence.js';
import type { DivergenceObserver } from '../lib/divergence.js';
import type { DecisionSet } from '../lib/decision-set.js';
import type { Features } from '../lib/features.js';
import type { DeepReadonly } from '../lib/observe.js';
import type {
  Decision,
  Decisions,
  EvaluationContext,
  FeatureKey,
  VariantInfo,
} from '../lib/types.js';

/** What a provider does when the shipped version is not the store's. */
export type VersionMismatchPolicy = 'use-shipped' | 're-resolve';

/** One decision at the erased key type. */
type AnyDecision = Decision<FeatureKey>;

/**
 * A decision record at the erased key type.
 *
 * Both forms of `Decisions<S>` hold one decision per key, and every field this
 * module reads sits in output position. The provider's own `erased` helper
 * makes the same widening for the same reason.
 */
function erasedSet(decisions: unknown): Record<string, AnyDecision> {
  return decisions as Record<string, AnyDecision>;
}

/**
 * Whether the two sides have proved they hold one configuration, reporting
 * through `observer` when they have not.
 *
 * `!==` and nothing else. A publisher with no version scheme sets `version` to
 * the digest, which `configDigest` strips before it canonicalises, so this
 * comparison then reads two digests and means the two processes hold one
 * configuration. An ordered comparison would act on an order neither value
 * carries.
 */
function agreed(
  shippedVersion: string | number | undefined,
  storeVersion: string | number | undefined,
  observer: DivergenceObserver<FeatureKey> | undefined,
): boolean {
  if (shippedVersion === undefined || storeVersion === undefined) {
    reportDivergence(observer, {
      kind: 'unversioned',
      shipped: { version: shippedVersion },
      local: { version: storeVersion },
      message:
        'these decisions and this store cannot be compared: one of the two carries no config version, so this provider cannot tell whether the two processes hold one configuration. Serve the document with a version and hand serializeConfig its envelope.',
    });
    return false;
  }

  if (shippedVersion !== storeVersion) {
    reportDivergence(observer, {
      kind: 'config-version',
      shipped: { version: shippedVersion },
      local: { version: storeVersion },
      message: `these decisions were resolved under config version ${String(shippedVersion)} and this store holds ${String(storeVersion)}, so the two processes hold different configurations. Reload the store from the document the server used, or pass onVersionMismatch: 're-resolve'.`,
    });
    return false;
  }

  return true;
}

/**
 * Names every shipped decision this provider's context could not reproduce.
 *
 * Task 5 writes the body.
 */
function sufficiency<S extends Record<keyof S, VariantInfo | never>>(
  features: Features<S>,
  context: EvaluationContext,
  shipped: Record<string, AnyDecision>,
  observer: DivergenceObserver<FeatureKey> | undefined,
): void {
  return;
}

/**
 * Names every key whose local answer differs from the shipped one.
 *
 * Task 5 writes the body.
 */
function diff(
  shipped: Record<string, AnyDecision>,
  local: Record<string, AnyDecision>,
  observer: DivergenceObserver<FeatureKey> | undefined,
): void {
  return;
}

/**
 * The decisions a provider publishes, with every divergence it detects
 * reported before React reconciles.
 *
 * A mismatch renders the shipped set. The server already rendered HTML from it
 * and recorded an exposure for the variant it shipped, so a client that
 * quietly resolves a third answer makes every experiment result wrong by an
 * amount nobody can measure from the data. The provider also cannot tell which
 * side is stale: a mismatch says the two envelopes differ, and the client's
 * copy is the older one as often as the newer.
 */
export function publishedDecisions<
  S extends Record<keyof S, VariantInfo | never>,
>(
  features: Features<S>,
  context: EvaluationContext | undefined,
  shipped: DecisionSet<S> | undefined,
  onVersionMismatch: VersionMismatchPolicy,
  onDivergence: DivergenceObserver<keyof S & FeatureKey> | undefined,
): Decisions<S> | DeepReadonly<Decisions<S>> {
  const observer = onDivergence as DivergenceObserver<FeatureKey> | undefined;

  if (!shipped) return features.resolve(context);

  // A set from a per-request render carries an instant seconds old, and it is
  // the default for everything this provider resolves locally. A set from a
  // build carries one that may be days old, so the client's own clock answers.
  const settled: EvaluationContext =
    shipped.origin === 'render'
      ? { ...context, now: context?.now ?? new Date(shipped.now) }
      : { ...context };

  const sent = erasedSet(shipped.decisions);
  const agree = agreed(shipped.version, features.version, observer);

  sufficiency(features, settled, sent, observer);

  // One local resolution at most, and only when something reads it. The
  // development diff reads it, and so does a `'re-resolve'` provider whose two
  // versions did not agree.
  const reResolve = !agree && onVersionMismatch === 're-resolve';
  const development = process.env.NODE_ENV !== 'production';
  const local =
    reResolve || development ? features.resolve(settled) : undefined;

  if (development && local) diff(sent, erasedSet(local), observer);
  if (reResolve && local) return local;

  return shipped.decisions as Decisions<S> | DeepReadonly<Decisions<S>>;
}
```

- [ ] Edit `libs/feature/src/react/index.tsx`. Add the imports above the `Features` type import:

```ts
import { publishedDecisions } from './hydrate.js';
import type { VersionMismatchPolicy } from './hydrate.js';
import type { DecisionSet } from '../lib/decision-set.js';
import type { DivergenceObserver } from '../lib/divergence.js';
```

- [ ] Replace `FeatureProviderProps.decisions` and the `FeatureProvider` body:

```tsx
  /**
   * Decisions resolved elsewhere, as the versioned set `Features.snapshot`
   * produces. A server render hands the client the set it resolved, and this
   * provider publishes it.
   *
   * The set states the config version it was resolved under and the instant it
   * was resolved at, so this provider can tell whether the two processes hold
   * one configuration and can resolve the remainder at the server's instant.
   */
  decisions?: DecisionSet<S>;
  /** Notified for every divergence this provider detects. Alters no decision. */
  onDivergence?: DivergenceObserver<keyof S & FeatureKey>;
  /**
   * What to render when the shipped version is not the store's. Defaults to
   * `'use-shipped'`.
   *
   * An application that runs no experiment and cares about revocation latency
   * passes `'re-resolve'`.
   */
  onVersionMismatch?: VersionMismatchPolicy;
  children?: ReactNode;
}

export function FeatureProvider<
  S extends Record<keyof S, VariantInfo | never>,
>({
  features,
  context,
  decisions,
  onDivergence,
  onVersionMismatch = 'use-shipped',
  children,
}: FeatureProviderProps<S>) {
  const value = useMemo<FeatureContextValue>(
    () => ({
      decisions: erased(
        publishedDecisions(
          features,
          context,
          decisions,
          onVersionMismatch,
          onDivergence,
        ),
      ),
    }),
    [features, context, decisions, onVersionMismatch, onDivergence],
  );
```

- [ ] Replace `BoundFeatureProviderProps.decisions` with the same three members, typed `DecisionSet<S, Frozen>`, and replace the bound provider's body:

```tsx
    FeatureProvider({
      features: given,
      context,
      decisions,
      onDivergence,
      onVersionMismatch = 'use-shipped',
      children,
    }) {
      const value = useMemo<FeatureContextValue>(
        () => ({
          decisions: erased(
            publishedDecisions(
              given ?? features,
              context,
              decisions,
              onVersionMismatch,
              onDivergence,
            ),
          ),
        }),
        [given, context, decisions, onVersionMismatch, onDivergence],
      );
```

- [ ] Add the type re-exports to `libs/feature/src/react/index.tsx`, after `AnyDecisions`:

```ts
export type { VersionMismatchPolicy } from './hydrate.js';
export type { DecisionOrigin, DecisionSet } from '../lib/decision-set.js';
export type {
  DivergenceObserver,
  DivergenceReport,
  DivergenceSide,
} from '../lib/divergence.js';
```

- [ ] Migrate the three existing cases that pass a bare `Decisions`. In `libs/feature/src/react/react.spec.tsx`, the case `accepts decisions resolved elsewhere, such as a build snapshot` changes `createFeatures(definitions).resolve(inWindow)` to `createFeatures(definitions).snapshot(inWindow)`. In `libs/feature/src/react/types.test-d.tsx`, the cases at :86 and :105 change `observed.resolve({ targetingKey: 'u1' })` to `observed.snapshot({ targetingKey: 'u1' })`.

- [ ] Migrate the three regions in `libs/feature/docs/examples.md` that pass a bare `Decisions` to the provider. Each one fails at runtime otherwise, because `publishedDecisions` reads `shipped.decisions` and a bare record has no such member.

  - `observe-exposure` (line 1079): `features.resolve({ targetingKey: customerId })` becomes `features.snapshot({ targetingKey: customerId })`.
  - `react-decisions` (line 1241): `features.resolve()` becomes `features.snapshot()`, the override writes through `fromServer.decisions['express-pickup']`, and the partial set keeps the envelope members:

    ```ts
    const fromServer = features.snapshot();
    fromServer.decisions['express-pickup'] = {
      key: 'express-pickup',
      enabled: false,
      reason: 'explicitly-off',
    };
    // A set shipped as JSON reaches the provider unchecked.
    const snapshot = JSON.parse(
      JSON.stringify({
        ...fromServer,
        decisions: { 'gift-cards': fromServer.decisions['gift-cards'] },
      }),
    );
    ```

  - `react-server` (line 1329): the import becomes `import type { DecisionSet } from '@evanion/feature';`, `type ShopDecisions = DecisionSet<{ 'express-pickup': never }>;`, and `features.resolve({ targetingKey: customerId })` becomes `features.snapshot({ targetingKey: customerId })`.

- [ ] Add `DecisionOrigin`, `DecisionSet`, `DivergenceObserver`, `DivergenceReport`, `DivergenceSide` and `VersionMismatchPolicy` to `undocumented` in the allowance. Five of the six are already there from Tasks 1 and 2; the allowance is keyed per package and not per entry point, so re-exporting the same name from `./react` adds no second entry. `VersionMismatchPolicy` is new.

- [ ] Verify: `npx nx run-many -t lint test typecheck -p feature repo-checks`

---

## Task 5: The two SSR checks

**Deliverable:** `sufficiency` names every shipped decision whose bucketing field this provider's context lacks, in production. `diff` names every key whose local answer differs, in development only.

**Files:**

- `libs/feature/src/react/hydrate.ts` (edit: two function bodies)
- `libs/feature/src/react/hydrate.spec.tsx` (edit: five cases)

**Interfaces consumed:**

```ts
// libs/feature/src/lib/variants.ts
export function bucketingOrder(
  variants: readonly VariantSpec[],
): readonly VariantSpec[];
// libs/feature/src/lib/features.ts
definition(key: keyof S & FeatureKey): FeatureDefinition<keyof S & FeatureKey> | undefined;
// libs/feature/src/lib/types.ts
assignment?: {
  source: 'weighted' | 'pinned' | 'sticky' | 'fallback';
  by: string;
  bucket?: number;
  rule?: string;
};
```

**Interfaces produced:** none. Both functions are already declared and called by Task 4.

### Steps

- [ ] Add five cases to `libs/feature/src/react/hydrate.spec.tsx`:

```tsx
it('names the context field a shipped assignment bucketed on', () => {
  const store = storeAt('v1');
  const reports: DivergenceReport[] = [];

  render(
    <FeatureProvider
      features={store}
      decisions={store.snapshot({ targetingKey: 'u-9' })}
      context={{}}
      onDivergence={(report) => reports.push(report)}
    >
      <Cta />
    </FeatureProvider>,
  );

  const missing = reports.find((report) => report.kind === 'missing-field');

  expect(missing?.field).toBe('targetingKey');
  expect(missing?.local).toEqual({ variant: 'control', source: 'fallback' });
});

it('names no field for a shipped decision that already fell back', () => {
  const store = storeAt('v1');
  const reports: DivergenceReport[] = [];

  render(
    <FeatureProvider
      features={store}
      decisions={store.snapshot({})}
      context={{}}
      onDivergence={(report) => reports.push(report)}
    >
      <Cta />
    </FeatureProvider>,
  );

  expect(reports.filter((report) => report.kind === 'missing-field')).toEqual(
    [],
  );
});

it('names every key whose local answer differs from the shipped one', () => {
  const store = storeAt('v1');
  const shipped = store.snapshot({ targetingKey: 'u-9' });
  const reports: DivergenceReport[] = [];

  render(
    <FeatureProvider
      features={store}
      decisions={{
        ...shipped,
        decisions: { cta: { ...shipped.decisions.cta, enabled: false } },
      }}
      context={{ targetingKey: 'u-9' }}
      onDivergence={(report) => reports.push(report)}
    >
      <Cta />
    </FeatureProvider>,
  );

  expect(
    reports.filter((report) => report.kind === 'decision-differs'),
  ).toHaveLength(1);
});

it('names both sides of a decision that differs', () => {
  const store = storeAt('v1');
  const shipped = store.snapshot({ targetingKey: 'u-9' });
  const reports: DivergenceReport[] = [];

  render(
    <FeatureProvider
      features={store}
      decisions={{
        ...shipped,
        decisions: { cta: { ...shipped.decisions.cta, variant: 'blue' } },
      }}
      context={{ targetingKey: 'u-9' }}
      onDivergence={(report) => reports.push(report)}
    >
      <Cta />
    </FeatureProvider>,
  );

  expect(
    reports.find((report) => report.kind === 'decision-differs'),
  ).toMatchObject({
    key: 'cta',
    shipped: { variant: 'blue' },
    local: { variant: 'control' },
  });
});

it('runs no decision diff under NODE_ENV production', () => {
  vi.stubEnv('NODE_ENV', 'production');
  const store = storeAt('v1');
  const shipped = store.snapshot({ targetingKey: 'u-9' });
  const reports: DivergenceReport[] = [];

  render(
    <FeatureProvider
      features={store}
      decisions={{
        ...shipped,
        decisions: { cta: { ...shipped.decisions.cta, enabled: false } },
      }}
      context={{ targetingKey: 'u-9' }}
      onDivergence={(report) => reports.push(report)}
    >
      <Cta />
    </FeatureProvider>,
  );
  vi.unstubAllEnvs();

  expect(
    reports.filter((report) => report.kind === 'decision-differs'),
  ).toEqual([]);
});
```

The import at the top of the file gains `vi`.

- [ ] Write the `sufficiency` body in `libs/feature/src/react/hydrate.ts`:

```ts
function sufficiency<S extends Record<keyof S, VariantInfo | never>>(
  features: Features<S>,
  context: EvaluationContext,
  shipped: Record<string, AnyDecision>,
  observer: DivergenceObserver<FeatureKey> | undefined,
): void {
  for (const decision of Object.values(shipped)) {
    const assignment = decision.assignment;
    if (!assignment || assignment.source === 'fallback') continue;
    if (context[assignment.by] !== undefined) continue;

    const definition = features.definition(
      decision.key as keyof S & FeatureKey,
    );
    const variants = definition?.variants;
    const control = variants ? bucketingOrder(variants)[0]?.name : undefined;

    reportDivergence(observer, {
      kind: 'missing-field',
      key: decision.key,
      field: assignment.by,
      shipped: { variant: decision.variant, source: assignment.source },
      local: { variant: control, source: 'fallback' },
      message: `feature "${String(decision.key)}": the server assigned variant "${String(decision.variant)}" by "${assignment.by}", and this provider's context carries no "${assignment.by}", so a client resolution would assign "${String(control)}" (source: fallback). Pass ${assignment.by} to <FeatureProvider context={...}>.`,
    });
  }
}
```

It skips a decision whose own source is `'fallback'`, because that decision already states the server could not bucket either and the two processes agree. It reads the control off `bucketingOrder(variants)[0]`, which is the variant a context carrying no usable value gets.

Add the import at the top of the file: `import { bucketingOrder } from '../lib/variants.js';`

- [ ] Write the `diff` body:

```ts
function diff(
  shipped: Record<string, AnyDecision>,
  local: Record<string, AnyDecision>,
  observer: DivergenceObserver<FeatureKey> | undefined,
): void {
  for (const [key, sent] of Object.entries(shipped)) {
    const here = Object.prototype.hasOwnProperty.call(local, key)
      ? local[key]
      : undefined;
    if (!here) continue;
    if (
      sent.enabled === here.enabled &&
      sent.reason === here.reason &&
      sent.variant === here.variant
    ) {
      continue;
    }

    reportDivergence(observer, {
      kind: 'decision-differs',
      key: sent.key,
      shipped: {
        enabled: sent.enabled,
        variant: sent.variant,
        source: sent.assignment?.source,
      },
      local: {
        enabled: here.enabled,
        variant: here.variant,
        source: here.assignment?.source,
      },
      message: `feature "${String(sent.key)}": the shipped decision is ${sent.enabled ? 'on' : 'off'} (${sent.reason})${sent.variant === undefined ? '' : ` as "${sent.variant}"`} and this provider resolves ${here.enabled ? 'on' : 'off'} (${here.reason})${here.variant === undefined ? '' : ` as "${here.variant}"`}. React reports the DOM difference this causes and names no cause.`,
    });
  }
}
```

The `hasOwnProperty` guard is what keeps a shipped set keyed `constructor` from reading a function off `Object.prototype` and comparing a decision against it. `useFeature` and `assignVariant` guard the same read the same way.

- [ ] Verify: `npx nx run-many -t lint test typecheck -p feature repo-checks`

---

## Task 6: The document path copies without `structuredClone`

**Deliverable:** `parseFeatureConfig` builds a store without calling `structuredClone`, so a JavaScript host providing `JSON` and nothing else can hydrate. The literal path keeps `structuredClone`.

**Files:**

- `libs/feature/src/lib/features.ts` (edit: the copy at :789, the envelope copy at :576, and a branch on which form the caller passed)
- `libs/feature/src/lib/document-copy.ts` (new)
- `libs/feature/src/lib/document-copy.spec.ts` (new)
- `libs/feature/src/lib/parse.spec.ts` (edit: one case)

**Interfaces consumed:**

```ts
// libs/feature/src/lib/features.ts
function isDocument(
  value: DefinitionsOrConfig,
): value is FeatureConfig<FeatureKey>;
function deepFreeze<T>(value: T, walked?: WeakSet<object>): T;
```

**Interfaces produced:**

```ts
// libs/feature/src/lib/document-copy.ts
/**
 * A copy of a value a document carries, built from `JSON`-shaped members
 * alone. Raises `FeatureConfigError` for a member no document can carry.
 */
export function documentCopy<T>(value: T): T;
```

### Steps

- [ ] Write `libs/feature/src/lib/document-copy.spec.ts`. The behaviour to pin, case by case: it copies a nested object and array by value, so a later write to the source moves nothing in the copy; it copies a `null` and each primitive; it raises `FeatureConfigError` naming the path for a function, a symbol, a `Date` and a cycle, which is the set `structuredClone` either refuses or carries in a shape a document cannot hold; it raises for a value nested past the depth `JSON.stringify` handles, matching the `RangeError` the existing path reports through `unreadableText`.

  Read `libs/feature/src/lib/unreadable.ts` and `parse.spec.ts:335-360` first. Those three cases (`reports a variant value no structured clone of the document carries`, `reports a variant value nested past the stack a clone of it needs`, `reports the digest it cannot take of a document no text names`) state the messages the refusal already produces, and this task keeps them.

- [ ] Write `libs/feature/src/lib/document-copy.ts`. A document is JSON, so the copier handles an object, an array and a primitive, and refuses everything else by raising the typed error `errors.ts` promises every refusal over a supplied configuration is. It walks with an explicit `WeakSet` for the cycle check, because `JSON.parse(JSON.stringify(value))` loses the path a refusal has to name and turns a `Date` into a string the engine would then compare against an `Instant` it did not receive.

- [ ] Edit `libs/feature/src/lib/features.ts`. `createFeatures` already computes `isDocument(definitions)` for `collectIssues`'s `arrayIsOrder` option at :760. Bind that once above the copy and branch both copies on it:

```ts
const copy = isDocument(definitions) ? documentCopy : structuredClone;
```

Then `:789` becomes `supplied.map((definition) => deepFreeze(copy(definition)))` and `envelopeOf` takes the copier as a parameter. Keep both calls inside the existing `try`, which turns a raise into the typed `FeatureConfigError` `parseFeatureConfig` reports.

- [ ] Add one case to `libs/feature/src/lib/parse.spec.ts`:

```ts
it('builds a store with TextEncoder and structuredClone deleted from globalThis', () => {
  // § 8 of `docs/specs/2026-09-23-feature-hydration.md` runs this on a native
  // client embedding a JavaScript engine with no DOM, which provides `JSON`
  // and neither of these.
  const encoder = globalThis.TextEncoder;
  const clone = globalThis.structuredClone;
  Reflect.deleteProperty(globalThis, 'TextEncoder');
  Reflect.deleteProperty(globalThis, 'structuredClone');

  try {
    const parsed = parseFeatureConfig({
      version: 'v1',
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(parsed.ok && parsed.features.isEnabled('checkout')).toBe(true);
  } finally {
    Reflect.set(globalThis, 'TextEncoder', encoder);
    Reflect.set(globalThis, 'structuredClone', clone);
  }
});
```

`digest.spec.ts:430` is the same shape for `configDigest`; copy its structure so the two read alike.

- [ ] Verify: `npx nx run-many -t lint test typecheck -p feature repo-checks`. `parse.spec.ts` has 50 cases over this path and every one of them has to stay green; a change that passes the new case and breaks `reports a variant value no structured clone of the document carries` has moved the refusal, not the copier.

---

## Task 7: The two shared conformance fixtures

**Deliverable:** The cross-implementation suite gains the two cases § 9 names that it does not already hold: a context carrying no `variantBy` field, and a `'deferred'` plan entry carrying a decision.

**Files:**

- `libs/feature/conformance/plan-decisions.json` (new)
- `libs/feature/conformance/config-decisions.json` (edit: one feature, its decision, the digest)
- `libs/feature/src/lib/conformance.spec.ts` (edit: one `describe`)

**Interfaces consumed:**

```ts
// libs/feature/src/lib/resolve-plan.ts   (Task 3)
export function resolvePlan<S …>(features, plan, context?, options?): Decisions<S>;
// libs/feature/src/lib/digest.ts
export function configDigest(config: FeatureConfig): string;
```

The existing suite already covers two of § 9's four cases. `the published cross-process fixture > produces the decisions it publishes` (`conformance.spec.ts:213`) covers the first, and `lists its variants in an order its own order values disagree with` (:528) covers the permuted-order case. Neither needs touching.

### Steps

- [ ] Add a feature to `libs/feature/conformance/config-decisions.json` whose `variantBy` names a field the fixture's context does not carry, so its decision publishes `assignment.source: 'fallback'` and the variant first in the bucketing order. The fixture's context is `{ targetingKey: 'u-4711', now: '2026-06-01T12:00:00.000Z', plan: 'pro', accountId: 'acct-9' }`, so `variantBy: 'tenantId'` is unbucketable.

- [ ] Recompute the fixture's `digest` and write the new decision into `decisions`. `conformance.spec.ts:209` (`states the digest of the document it carries`) and :213 both fail until both are right. Read :296 and :303 before editing; the fixture is held to passing the checker every holder runs, and to stating a digest of that document and no other.

- [ ] Write `libs/feature/conformance/plan-decisions.json` in the shape `{ note, config, plan, context, decisions }`. Read `conformance.spec.ts:14-30` for the reader the existing file uses and extend it rather than writing a second one. The `config` carries a feature whose rules settle at the build instant and whose variant split does not, which is what produces a `'deferred'` entry carrying a decision. The `note` cites `docs/specs/2026-09-23-feature-hydration.md` § 9.

- [ ] Add a `describe` to `libs/feature/src/lib/conformance.spec.ts` that reads the plan fixture, runs `resolvePlan` over it with the fixture's context, and asserts the published decisions. Two further cases hold the fixture itself honest: one asserts the plan carries an entry whose `resolved` is `'deferred'` and whose `decision` is present, so the file exercises the case it exists for, and one asserts the decision the plan settled keeps its `enabled` and `reason` through `resolvePlan`.

- [ ] `libs/feature/package.json` already lists `conformance` in `files`, so the new fixture ships with the tarball and `conformance.spec.ts:288` stays green.

- [ ] Verify: `npx nx run-many -t lint test typecheck -p feature repo-checks`

---

## Open questions for the owner

1. **`parseFeatureConfig` or a `hydrateFeatures` name.** The function the spec calls `hydrateFeatures` shipped as `parseFeatureConfig` in #279 and satisfies decisions 1, 2 and 3. This plan adds no second name. Renaming it is a separate change that touches `index.ts`, the allowance, the conformance suite and three regions, and the docs session owns the page that names it.
2. **`HydrateOptions.version`.** Decision 4 gives the hydration options a `version` override. `FeatureOptions.version` already exists on the same options object and means the version an event reports. This plan drops the override and has a caller spread the document. Say if you want the override, and say which of the two members keeps the name.
3. **`HydrateOptions.onDivergence`.** § 2 types it as the observer "for every divergence this store detects later", and no store detects divergence. This plan drops it and leaves the observer on the provider and on `resolvePlan`. A store-held observer is possible: `Features` would carry the member and `publishedDecisions` would fall back to it when the prop is absent. That is one more field on the store and one more precedence rule.
4. **`snapshot`'s `origin`.** Nothing in the spec's surface can produce `origin: 'build'`, so this plan gives `snapshot` an options parameter. The alternative is a separate entry point that takes a `Plan` and writes a `'build'` set.
5. **§ 8 against the merged construction path.** Task 6 splits the copier, so `parseFeatureConfig` stops going through `structuredClone` and `createFeatures` keeps it. A caller who hands `parseFeatureConfig` a live object holding a `Date` or a cycle gets a refusal where it previously got a store. That caller is handing a document path a value no document carries, so the refusal looks right, and it is a behaviour change on merged code. The alternative is to drop § 8's `globalThis` test and record it as not met.
6. **Reporting from inside `useMemo`.** Under `StrictMode` a development render runs the memo body twice, so an observer counting reports sees two per mount. The spec requires the report to land before React reconciles, which rules out an effect. A ref that remembers what it already reported would deduplicate and would also hide a genuine second divergence after a prop change.
7. **The development diff's home.** The spec's own "Where I am guessing" asks whether it belongs in the library at all. It is the only place this design reads `process.env.NODE_ENV`, and it doubles the resolution work on mount in development. A `@evanion/feature/devtools` entry would keep the core free of it and would add an import every application has to remember.
