# Feature Configuration Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A feature configuration travels as one versioned document. A process validates a candidate whole, installs it by swapping one reference, and keeps the document it already had when the candidate is bad. Two processes that fetched the same document can prove they hold the same configuration.

**Architecture:** A new `config.ts` declares the envelope `FeatureConfig` and the result types. `serialize.ts` writes a live store out as one document with every `Date` converted. `digest.ts` derives an opaque content digest from the canonical text of that document. `validate.ts` is the single checker: it collects every issue and returns them, `createFeatures` throws the first one as the typed error it throws today, and `parseFeatureConfig` and `features.reload` return them. `features.ts` gains `reload` and `version`, and its internal `config`, `graph`, `index` and `keys` become swappable references.

**Tech Stack:** TypeScript 6.0.3, Vitest with `typecheck`, Nx.

**Spec:** `docs/specs/2026-09-23-feature-config-distribution.md`. Read its 15 decisions and § 1 through § 9 before starting. § 3 decides that a holder refuses a whole document when it meets a member it cannot read, and drops nothing, and that decision is what most of `validate.ts` implements.

**Issue:** #279.

## Four reconciliations the spec needs

The spec was written before rule ids, named variants and the observation seam landed. Four of its file references now point at code that moved or that already does the work.

`ruleId` is at `libs/feature/src/lib/rule-id.ts`, not at `evaluate.ts:17-19`. The content hash of #245 is built: `ruleId` returns `rule.id` when a rule declares one, and otherwise a `rule-<fnv1a>` derived from the conditions and from `rollout.by` and `rollout.seed`, with `rollout.percent` excluded. § 2 of the spec describes work that is done. What is left for this plan is the envelope's side: `serializeConfig` emits an authored `id` untouched and `validateConfig` reports `duplicate-rule-id`.

`VariantSpec.order` is built. `types.ts` declares it, `validateVariants` in `variants.ts` refuses a partial declaration, a duplicate order and a non-integer order, and `bucketingOrder` walks on it. This plan converts those three throws into issue codes and adds the serializer's side.

`canonical` is already in this package at `libs/feature/src/lib/canonical.ts`, exported from the index. § 2 says the function "is small enough to port". It is ported. `configDigest` consumes it.

`Features` is generic over a schema `S`, not over a key `F`. Every signature the spec sketches with `Features<F>` is written here as `Features<S, Frozen>`, and `FeatureConfig<F>` keeps its key parameter because a document carries definitions and no schema-mapped type.

## Global Constraints

Values copied from the spec. Where a value is a judgement this plan made because the spec is silent, the constraint says so.

- The package is unpublished (`"private": true`, version `0.0.1`). Any signature may change and no migration is owed.
- The envelope is `FeatureConfig` and it carries exactly six members: `version`, `digest`, `schema`, `schemaVersion`, `maxStale`, `features`. A seventh member in an incoming document is an `unknown-member` issue and the whole document is refused (decision 6, § 3).
- `version` is `string | number`, opaque, compared with `!==` and never ordered. No entry point in this library orders two versions, declines a lower one, or prefers a higher one (decision 4, § 2).
- `maxStale` is a duration in milliseconds, advisory, and no entry point in this library reads it. `resolve`, `plan`, `toggle`, `reload` and `validateConfig` all ignore it, and no `Reason` and no `Decision` mentions it (decision 3, § 1).
- The envelope carries no `notBefore` and no `notAfter`, no `visibility` on a definition and no reduced serialization mode (decision 2, § 1).
- `digest` is always `configDigest` of the document that carries it. A holder that finds one recomputes it and reports `digest-mismatch` when it disagrees (decision 4, § 2).
- No member carrying a bucketing parameter has a default. `VariantSpec.order`, a variant `weight`, `variantSeed` and `variantBy` travel whole or the document is refused (decision 6, § 3).
- A serialized `Instant` is an ISO 8601 string or epoch milliseconds, never a `Date`. `SerializedInstant = string | number` (decision 12, § 8).
- `createFeatures` keeps throwing `FeatureCycleError`, `UnknownDependencyError`, `DuplicateFeatureError`, `DuplicateVariantError`, `UnknownVariantError` and `FeatureConfigError`, from the same inputs it throws on today. `parseFeatureConfig` and `reload` return results. Both paths call one checker, `validateConfig` (decision 11, § 7).
- `validateConfig` reports every issue it finds, not the first (§ 7).
- A reload replaces stored intent and writes no resolved value. `changed` diffs stored intent and never diffs resolved values (decision 9, § 6).
- A reload discards a local `toggle`. No merge (decision 10, § 6).
- A refused candidate leaves every internal reference where it was. The failure path touches no state (§ 6).
- A schema is immutable at its `schemaVersion`. An inline `schema` with no `schemaVersion` is a `missing-schema-version` issue. A document carrying neither declares no shapes and is legal (decision 8, § 5).
- A context field is a flat `FieldType` string: `'string' | 'number' | 'boolean' | 'instant'`, each with an optional `[]` and an optional trailing `?`. Ported from `libs/acl/src/types.ts:157-171` (decision 7, § 4).
- A `ValueShape` is a JSON Schema 2020-12 object fenced to `type`, `properties`, `required`, `items`, `enum`, `const`, `additionalProperties`, `$defs`, `$ref` naming a `$defs` entry in the same document, `title` and `description`. Refused, as `unfenced-schema`: a `$ref` to any URL or file outside the document, `allOf`, `anyOf`, `oneOf`, `not`, `unevaluatedProperties` (§ 4).
- The core imports no driver, opens no socket and starts no timer. `libs/feature/package.json` declares no `dependencies` and keeps declaring none (decision 13, § 9).
- Every process holds the rules and computes its own answer. No endpoint answers which variant a subject gets, and this plan adds no decision-bubbling path (decisions 14 and 15, § 9).
- The 18 issue codes are exactly: `duplicate-feature`, `unknown-dependency`, `cycle`, `duplicate-variant`, `unknown-variant`, `invalid-weight`, `empty-variants`, `zero-weights`, `duplicate-rule-id`, `duplicate-variant-order`, `invalid-variant-order`, `invalid-instant`, `unknown-context-field`, `field-type-mismatch`, `unfenced-schema`, `missing-schema-version`, `unknown-member`, `digest-mismatch`. No task adds a nineteenth.
- Tests are `*.spec.ts` beside the source; type tests are `*.test-d.ts` and the `typecheck` block in `libs/feature/vite.config.ts` runs them. A type test that is not matched by a project's `typecheck.include` runs nowhere.
- `tools/repo-checks/src/test-assert-boundary.test.ts` requires a blank line before the first `expect` in a case body that arranges anything above it.
- `tools/repo-checks/src/exported-type-closure.test.ts` requires that a published declaration names no type its own file keeps private. Every type named in an exported signature is exported from the file that declares it.
- `tools/repo-checks/src/doc-export-coverage.test.ts` requires a `##` heading spelling every exported name, and a running example for every callable export. `doc-export-coverage-allowance.json` is a ratchet, so a new export that is not documented has to be added to the allowance or documented. This plan documents them.
- `tools/repo-checks/src/doc-exports.test.ts` (G5) fails the build when a documentation fence imports a name the package does not export.
- `tools/repo-checks/src/doc-fence.test.ts` (G3) ratchets unexplained fences per section, so a page value that was computed comes from a doctested region in `libs/feature/README.md`.
- `commitlint.config.js` holds the scope enum. `feature` is in it. `feature-source` is not, and `tools/repo-checks/src/commitlint-scope-enum.test.ts` fails the build when a project under `nx.json`'s `release.projects` globs has no entry. Task 11 is why no task in this plan creates that project.
- Conventional commits, scope `feature` for library work, `specs` for a spec edit, `docs` for a documentation-site edit.
- Run every verification through nx: `npx nx affected -t test lint build --base=main --skip-nx-cache`.
- Prose in doc comments, `.mdx` and commit messages: no em-dashes, no "X rather than Y", no "instead of", no bold lead-ins, every sentence names who or what does the thing, no gerund phrase as a subject, no metaphor verb for a technical fact, no three-item rhythmic lists.
- CI runs `npx prettier --check .` as its own job.

## Rulings this plan makes where the spec is silent

Each one is a decision an implementer would otherwise have to invent twice. Each is also listed in the report's open questions, because the owner may want a different answer.

1. `configDigest` removes the `digest` and `version` members from its input before it canonicalises. § 2 has a publisher with no version scheme write the digest into both, and that publisher holds neither value when it computes the digest, so a text carrying either could never be recomputed by a holder and verification would fail on every document that used it. A holder reads `version` with `!==`, which is the only comparison the spec allows on it.
2. `configDigest` returns 32 hex characters, built from `murmur3` at four fixed seeds. The spec names no algorithm and no width. `murmur3` is already exported from this package and already carries a cross-language contract, and 32 bits alone is too narrow for a comparison whose whole job is to detect a difference.
3. `validateVariants`'s partial-order error maps to `invalid-variant-order`, and its zero and non-finite weight totals both map to `zero-weights`. The spec's 18 codes cover neither case by name.
4. `serializeConfig` converts a `Date` at a `WindowCondition.value` and refuses one at every other member. The spec's § 8 and its decision 12 state this rule, so this entry rules nothing and keeps the argument that reached it, which Task 2's refusal tests cite. `toEpoch` at `conditions.ts:18-22` reads the `Date` and the ISO string to one epoch, so a window decides alike in the publisher and in the holder. `evaluateCondition` compares an `AttributeCondition.value` with `===`, and `valueOf` hands a variant value to the application untouched, so a `Date` at either member and the ISO string a holder receives are two values that behave differently while `canonical` writes both as one text. § 2 reads two agreeing digests as a proof that two processes hold one configuration, and `config.ts`'s `JsonValue` states the rule for the condition value. An author who wants either member to travel writes the ISO string in the definition.
5. `serializeConfig` throws `FeatureConfigError` for a variant value JSON cannot carry, which today means a cycle. The store is the caller's own, so this is a programming error at the authoring site, which is the same argument `errors.ts:3-11` makes for `createFeatures`.
6. `FeatureOptions.version`, which an observation event carries, stays separate from the envelope's `version` and this plan defaults neither from the other. An audit stream whose version changed without the application asking is a worse surprise than a stream whose version is absent.
7. `configDigest` covers `maxStale` and `schema`. § 2 fixes the digest at "every other byte of the document" and names the two members it removes, so this entry rules nothing the spec left open and records the two costs a reader meets before the spec sentence that answers them. An operator who edits `maxStale` alone publishes a document every holder reloads, and § 5's two schema forms of one configuration digest apart. A digest that skipped `schema` would leave a holder verifying no part of the inline shapes it checks variant values against. Decision 3's `maxStale` constraint holds: `configDigest` decides nothing from the value and hashes the document a publisher served.
8. `configDigest` takes its canonical text through `canonicalDocument`, which writes `NaN`, `Infinity` and `-Infinity` as `null`. `ruleId` keeps `canonical`'s `number:` tag. `JSON.parse` returns `Infinity` for an overflowing literal such as `1e999`, so one served document reaches one holder as `Infinity` and a second holder, which cached it through `JSON.stringify`, as `null`, and the tag would have the two digest that document apart.

## Review Focus

Input classes the spec implies and no task's happy-path tests would reach. Each one is assigned to the task that owns the code.

- A `Date` nested inside a variant `value` or inside an `AttributeCondition.value`. Ruling 4 refuses one at both members, and a serializer that converted there would publish a document whose holders resolve a rule the way the publisher does not. Pinned in Task 2, Step 6.
- A definition carrying `seed`, `variantBy`, `variantSeed` and `freezeTimeAtBuild`. A round-trip test that compares `key`, `enabled` and `rules` passes while the serializer drops four members that decide bucketing. Pinned in Task 2, Step 7.
- A `when` holding `null`, and a `when` that arrived as an object. `createFeatures` reads `dependsOn` and `rule.variant` and reads no condition, and its inferring overload takes the `any` `JSON.parse` returns, so a store built from a served document carries whatever a control plane wrote there. The pre-walk that converts a window `Date` reads `rule.when` and `condition.op` before `serialized` sees either one. Pinned in Task 2, Step 8.
- A window condition whose value is already an ISO string or an epoch number. Every window fixture an implementer writes carries a `Date`, so the pass-through that serves a holder's own store back is the one path in the serializer no happy-path test reaches. Pinned in Task 2, Step 8.
- A numeric `FeatureKey`. `FeatureKey` is `string | number`, a JSON object key is a string, and the `changed` array, the `Decisions` record and the `duplicate-feature` check all key on it. Pinned in Task 7, Step 8.
- A variant value that holds itself. `structuredClone` carries a cycle, `deepFreeze` guards for one, and a `changed` diff written as a recursive structural walk does not. Pinned in Task 7, Step 9.
- An envelope member named `__proto__`, and a context field named `constructor`. The unknown-member walk and the `ContextSchema` lookup both index an object by a string a foreign producer chose. Pinned in Task 5, Step 8.
- A candidate that is the document already installed. `changed` is empty, and a reload that swapped nothing must still report `ok: true` with the same version on both sides. Pinned in Task 7, Step 7.
- A candidate carrying `features: []`. Every previously configured key disappears, so `changed` names all of them and `resolve` answers an empty record. Pinned in Task 7, Step 6.
- An offsetless ISO instant such as `'2026-10-01T00:00:00'`, which issue #284 records as resolving three ways on three hosts. `validateConfig` accepts it, because `Date.parse` reads it, and the conformance fixture must not carry one. Pinned in Task 5, Step 7 and Task 9, Step 4.
- A weight of `-0` and a weight of `NaN`. `Number.isFinite(-0)` is true and `-0 < 0` is false, so `-0` reaches `zero-weights` through the total and never reaches `invalid-weight`. Pinned in Task 4, Step 9.

---

### Task 1: The envelope, the schema vocabulary and the result types

**Files:**

- Create: `libs/feature/src/lib/config.ts`
- Create: `libs/feature/src/lib/config.test-d.ts`
- Modify: `libs/feature/src/index.ts`

**Interfaces:**

- Consumes: `FeatureDefinition`, `FeatureKey`, `Rule`, `Condition`, `AttributeCondition`, `DayOfWeekCondition` from `./types.js`.
- Produces: `FeatureConfig<F>`, `ConfigEnvelope`, `SerializedInstant`, `SerializedWindowCondition`, `SerializedCondition`, `SerializedRule`, `SerializedDefinition<F>`, `FeatureSchema`, `ContextSchema`, `FeatureShape`, `ValueShape`, `BaseFieldType`, `FieldType`, `ConfigIssueCode`, `ConfigIssue`, `ValidationResult`, `ReloadResult`.

This task adds no runtime. It exists on its own because every later task names these types and because `exported-type-closure.test.ts` fails the build for a type a signature names and a file keeps private, which is easiest to get right once.

- [ ] **Step 1: Write the failing type test**

Create `libs/feature/src/lib/config.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';
import type {
  ConfigIssue,
  FeatureConfig,
  ReloadResult,
  SerializedDefinition,
  ValidationResult,
} from './config.js';
import type { FeatureDefinition } from './types.js';

describe('FeatureConfig', () => {
  it('takes the six members and nothing else', () => {
    expectTypeOf<keyof FeatureConfig>().toEqualTypeOf<
      | 'version'
      | 'digest'
      | 'schema'
      | 'schemaVersion'
      | 'maxStale'
      | 'features'
    >();
  });

  it('keys its definitions on the parameter it was given', () => {
    type Keyed = FeatureConfig<'cta' | 'checkout'>;

    expectTypeOf<Keyed['features'][number]['key']>().toEqualTypeOf<
      'cta' | 'checkout'
    >();
  });

  it('carries a serialized definition where a store carries a live one', () => {
    expectTypeOf<SerializedDefinition<'cta'>>().toExtend<
      FeatureDefinition<'cta'>
    >();
  });

  it('refuses a Date in a window condition', () => {
    const document = {
      features: [
        {
          key: 'cta',
          enabled: true,
          // @ts-expect-error -- a serialized instant is a string or a number.
          rules: [{ when: [{ field: 'now', op: 'after', value: new Date() }] }],
        },
      ],
    } satisfies FeatureConfig<'cta'>;

    expectTypeOf(document.features).toBeArray();
  });
});

describe('ValidationResult', () => {
  it('discriminates on ok', () => {
    const read = (result: ValidationResult): readonly ConfigIssue[] =>
      result.ok ? [] : result.issues;

    expectTypeOf(read).toBeCallableWith({ ok: true });
  });
});

describe('ReloadResult', () => {
  it('carries the installed version on both arms', () => {
    const read = (result: ReloadResult) => result.version;

    expectTypeOf(read).returns.toEqualTypeOf<string | number | undefined>();
  });

  it('carries the candidate version only on the refusal', () => {
    const read = (result: ReloadResult) =>
      result.ok ? result.changed : result.rejected;

    expectTypeOf(read).toBeCallableWith({
      ok: false,
      version: 1,
      rejected: 2,
      issues: [],
    });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx nx test feature -- config.test-d`
Expected: FAIL, `./config.js` does not exist.

- [ ] **Step 3: Write the envelope**

Create `libs/feature/src/lib/config.ts`:

```ts
import type {
  AttributeCondition,
  DayOfWeekCondition,
  FeatureDefinition,
  FeatureKey,
  Rule,
} from './types.js';

/**
 * An `Instant` that survives JSON: an ISO 8601 string, or epoch milliseconds.
 *
 * `Instant` at `types.ts:16` admits a `Date`, which a literal in a TypeScript
 * file is what an author writes. `JSON.stringify` writes that `Date` as an ISO
 * string and `JSON.parse` hands back a string, so a document that made one hop
 * through a transport holds a different value than the one that authored it.
 * The two evaluate alike, because `toEpoch` in `conditions.ts` reads both to
 * one number, and `configDigest` over the two disagrees. A document narrows to
 * this, and `serializeConfig` converts on the way out.
 */
export type SerializedInstant = string | number;

/** A window condition as a document carries it. */
export interface SerializedWindowCondition {
  field: 'now';
  op: 'before' | 'after';
  value: SerializedInstant;
}

/** A condition as a document carries it. Only the instant narrows. */
export type SerializedCondition =
  SerializedWindowCondition | DayOfWeekCondition | AttributeCondition;

/** A rule as a document carries it, with its control-plane `id` untouched. */
export interface SerializedRule extends Omit<Rule, 'when'> {
  readonly when?: readonly SerializedCondition[];
}

/** A definition as a document carries it. */
export interface SerializedDefinition<
  F extends FeatureKey = string,
> extends Omit<FeatureDefinition<F>, 'rules'> {
  readonly rules?: readonly SerializedRule[];
}

/**
 * The base of a declared context field type.
 *
 * Ported from `libs/acl/src/types.ts:157-171`. `instant` is a point in time
 * carried as an ISO 8601 string or epoch milliseconds, which is what `toEpoch`
 * at `conditions.ts:18-22` already accepts.
 */
export type BaseFieldType = 'string' | 'number' | 'boolean' | 'instant';

/**
 * One context field's declared type.
 *
 * A flat string, so the whole schema is JSON a producer in any language emits
 * by reflection. `[]` is an array of the base type, and a trailing `?` marks a
 * field a complete context may leave out.
 */
export type FieldType =
  | BaseFieldType
  | `${BaseFieldType}[]`
  | `${BaseFieldType}?`
  | `${BaseFieldType}[]?`;

/**
 * A JSON Schema 2020-12 object, fenced to the subset `validateConfig` accepts.
 *
 * The engine never reads a variant value: `valueOf` hands it to the caller
 * untouched. So this shape is what a code generator and an optional validator
 * read, and the notation is JSON Schema because quicktype and
 * openapi-generator already emit TypeScript, Swift and Kotlin from it.
 */
export type ValueShape = Readonly<Record<string, unknown>>;

/** What a schema records about one feature. */
export interface FeatureShape {
  /** Keyed by variant name, in no significant order. The document holds the order. */
  readonly variants?: Readonly<Record<string, ValueShape>>;
}

/** The context fields rules read. */
export interface ContextSchema {
  readonly fields?: Readonly<Record<string, FieldType>>;
}

/**
 * The typing contract a document states.
 *
 * Two vocabularies, because the two halves describe different things. The
 * engine reads a context field, compares it with a closed operator set, and
 * checks it against the declared type at validation. The engine reads no
 * variant value at all.
 */
export interface FeatureSchema {
  readonly context?: ContextSchema;
  readonly features?: Readonly<Record<string, FeatureShape>>;
}

/**
 * The canonical configuration document: an envelope over a list of definitions.
 *
 * There is no bare-array form, for the reason `Matrix` at
 * `libs/acl/src/types.ts:220-234` gives: a foreign producer emitting JSON
 * states the version and the schema, and one document crosses a boundary
 * without a wrapper assembled at the call site.
 */
export interface FeatureConfig<F extends FeatureKey = string> {
  /**
   * Compared with `!==`. Opaque and unordered.
   *
   * A consumer that could order two versions would act on the order, and both
   * available actions are wrong. Declining a lower version blocks a rollback,
   * which is the operation an operator reaches for at 3am. Accepting only a
   * higher version breaks a control plane serving two shards whose counters
   * diverged. A consumer holding a version different from the one it wants
   * fetches the document that version names.
   */
  readonly version?: string | number;
  /** `configDigest` of this document. A holder that finds one verifies it. */
  readonly digest?: string;
  /** The typing contract, inline. A document may name `schemaVersion` alone. */
  readonly schema?: FeatureSchema;
  /** The schema's own version. A publisher never rewrites a schema at a value. */
  readonly schemaVersion?: string;
  /**
   * How long the publisher believes a holder may keep this document, in
   * milliseconds. Advisory, and no entry point in this library reads it.
   *
   * The party that fetches is the party that acts on it. A binding in
   * `@evanion/feature-source` holds the poller, knows the fetch instant because
   * it performed the fetch, and shortens its interval, logs, refuses to start
   * or serves a fallback document. This library holds no clock authority.
   */
  readonly maxStale?: number;
  readonly features: readonly SerializedDefinition<F>[];
}

/** The envelope without its payload, which a serializer writes around a store. */
export type ConfigEnvelope = Omit<FeatureConfig, 'features'>;

/** What `validateConfig` found wrong. One code per class of defect. */
export type ConfigIssueCode =
  | 'duplicate-feature'
  | 'unknown-dependency'
  | 'cycle'
  | 'duplicate-variant'
  | 'unknown-variant'
  | 'invalid-weight'
  | 'empty-variants'
  | 'zero-weights'
  | 'duplicate-rule-id'
  | 'duplicate-variant-order'
  | 'invalid-variant-order'
  | 'invalid-instant'
  | 'unknown-context-field'
  | 'field-type-mismatch'
  | 'unfenced-schema'
  | 'missing-schema-version'
  | 'unknown-member'
  | 'digest-mismatch';

export interface ConfigIssue {
  code: ConfigIssueCode;
  /** The same text the thrown counterpart carries, where one exists. */
  message: string;
  /** The feature the issue is about, when it is about one. */
  key?: FeatureKey;
  /** A JSON pointer into the document, so a UI highlights the row. */
  path?: string;
}

export type ValidationResult =
  { ok: true } | { ok: false; issues: readonly ConfigIssue[] };

/**
 * What a reload did.
 *
 * Both arms carry `version`, and on both arms it names the document that is
 * installed now. A refusal keeps the previous document, so its `version` is the
 * one that stayed and `rejected` is the one that did not arrive.
 */
export type ReloadResult =
  | {
      ok: true;
      version: string | number | undefined;
      previousVersion: string | number | undefined;
      /** Keys whose stored intent differs from the previous document. */
      changed: readonly FeatureKey[];
    }
  | {
      ok: false;
      /** The version that stayed installed. */
      version: string | number | undefined;
      /** The candidate's version, so a log names what was refused. */
      rejected: string | number | undefined;
      issues: readonly ConfigIssue[];
    };
```

- [ ] **Step 4: Export the types**

In `libs/feature/src/index.ts`, add one `export type` block after the `observe.js` block:

```ts
export type {
  BaseFieldType,
  ConfigEnvelope,
  ConfigIssue,
  ConfigIssueCode,
  ContextSchema,
  FeatureConfig,
  FeatureSchema,
  FeatureShape,
  FieldType,
  ReloadResult,
  SerializedCondition,
  SerializedDefinition,
  SerializedInstant,
  SerializedRule,
  SerializedWindowCondition,
  ValidationResult,
  ValueShape,
} from './lib/config.js';
```

- [ ] **Step 5: Run the type test**

Run: `npx nx test feature -- config.test-d`
Expected: PASS.

- [ ] **Step 6: Keep the export-coverage ratchet honest**

Run: `npx nx test repo-checks -- doc-export-coverage`

Every new type fails the documented rule until Task 12 writes the reference entries. Add each new name to the `"undocumented"` array for `"@evanion/feature"` in `tools/repo-checks/src/doc-export-coverage-allowance.json`, sorted, and remove them again in Task 12. Say in the commit body that the allowance entries are temporary and name Task 12.

- [ ] **Step 7: Run everything and commit**

Run: `npx nx affected -t test lint build --base=main --skip-nx-cache`
Then: `npx prettier --check` on every file you touched.

```bash
git add libs/feature/src/lib/config.ts libs/feature/src/lib/config.test-d.ts libs/feature/src/index.ts tools/repo-checks/src/doc-export-coverage-allowance.json
git commit -m "feat(feature): declare the configuration envelope"
```

---

### Task 2: `serializeConfig`

**Files:**

- Create: `libs/feature/src/lib/serialize.ts`
- Create: `libs/feature/src/lib/serialize.spec.ts`
- Modify: `libs/feature/src/index.ts`

**Interfaces:**

- Consumes: `ConfigEnvelope`, `FeatureConfig`, `SerializedDefinition` from `./config.js`; `Features` from `./features.js`; `bucketingPosition` and `variantSeedOf` from `./variants.js`; `DEFAULT_ROLLOUT_FIELD` from `./fields.js`; `FeatureConfigError` from `./errors.js`; `FeatureDefinition`, `FeatureKey`, `Rule`, `VariantInfo`, `VariantSpec` from `./types.js`. `bucketingPosition` is `bucketingOrder`'s own defaulting, exported so the sort and the serializer read one function.
- Produces:

```ts
export function serializeConfig<S extends Record<keyof S, VariantInfo | never>>(
  features: Features<S, boolean>,
  envelope?: ConfigEnvelope,
): FeatureConfig<keyof S & FeatureKey>;
```

Task 7 changes the default for `envelope` to the document the store was reloaded from. Until then a caller that wants a `version` passes one.

- [ ] **Step 1: Write the failing round-trip test**

Create `libs/feature/src/lib/serialize.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createFeatures } from './features.js';
import { serializeConfig } from './serialize.js';

describe('serializeConfig', () => {
  it('writes every definition the store holds, in store order', () => {
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features.map((each) => each.key)).toEqual([
      'checkout',
      'express',
    ]);
  });

  it('writes a Date in a window condition as its ISO string', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [
              {
                field: 'now',
                op: 'after',
                value: new Date('2026-10-01T00:00:00.000Z'),
              },
            ],
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.rules?.[0]?.when?.[0]).toEqual({
      field: 'now',
      op: 'after',
      value: '2026-10-01T00:00:00.000Z',
    });
  });

  it('survives a trip through JSON unchanged', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50, value: { label: 'Buy' } },
          { name: 'blue', weight: 50, value: { label: 'Get it' } },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });

  it('carries the envelope members a caller supplies', () => {
    const features = createFeatures([{ key: 'cta', enabled: true }] as const);

    const document = serializeConfig(features, {
      version: 'flags@41',
      maxStale: 60_000,
    });

    expect(document.version).toBe('flags@41');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx nx test feature -- serialize`
Expected: FAIL, `./serialize.js` does not exist.

- [ ] **Step 3: Write the serializer**

Create `libs/feature/src/lib/serialize.ts`:

```ts
import { FeatureConfigError } from './errors.js';
import { DEFAULT_ROLLOUT_FIELD } from './fields.js';
import { bucketingPosition, variantSeedOf } from './variants.js';
import type { Features } from './features.js';
import type {
  ConfigEnvelope,
  FeatureConfig,
  SerializedDefinition,
} from './config.js';
import type {
  FeatureDefinition,
  FeatureKey,
  Rule,
  VariantInfo,
  VariantSpec,
} from './types.js';

/** The name a refusal calls a value by, read off the constructor it carries. */
function nameOf(value: object): string {
  const named = value as { readonly constructor?: { readonly name?: string } };
  return named.constructor?.name ?? 'value of that prototype';
}

/** `a` or `an`, so a refusal naming an `Error` reads as a sentence. */
function article(name: string): string {
  return /^[aeiou]/i.test(name) ? 'an' : 'a';
}

/**
 * JSON's own data model, through arrays and nested objects.
 *
 * What the walk admits is a string, a finite number, a boolean, `null`, an
 * array, and an object whose prototype is `Object.prototype` or `null`. Every
 * other leaf throws and names the path, because each one breaks § 8's two
 * promises without saying so.
 *
 * `undefined` properties drop, which is what `canonical.ts:46` does and what
 * keeps an absent key agreeing with a key written as `undefined`.
 *
 * A `Date` is one of the leaves this refuses, and `documentCondition` is the one
 * place a `Date` converts. `evaluateCondition` compares an
 * `AttributeCondition.value` with `===`, and `valueOf` hands a variant value to
 * the application untouched, so a `Date` in either member and the ISO string a
 * holder receives are two values that behave differently. `canonical` writes
 * both as one text, so § 2 reads the two digests as a proof that the two
 * processes hold one configuration while they resolve apart. `config.ts`'s
 * `JsonValue` states the rule for the condition value and this walk enforces it
 * for the whole definition.
 *
 * A `Map`, a `Set` and a `RegExp` keep what they hold in internal slots, and an
 * `Error` keeps its message and its stack as non-enumerable members, so
 * `Object.entries` reads nothing off any of them and the document carries `{}`
 * while the store carries the payload. The publisher and the holder then digest
 * the same `{}` and agree on a document that lost it.
 *
 * The prototype rule is what refuses those four, and it refuses anything else
 * whose prototype JSON has no notion of. That costs nothing a caller wanted:
 * `SerializedVariantSpec.value` is `unknown` for the interfaces § 4's schemas
 * generate, a generator emits an interface over a plain object, and
 * `structuredClone` hands a class instance back as a plain object before the
 * walk ever sees it.
 *
 * A `bigint` reaches the document untouched and the publisher's own
 * `JSON.stringify` throws a `TypeError` naming no feature. `NaN`, `Infinity`
 * and `-Infinity` become `null` on the first transport hop, and `canonical`
 * tags a non-finite number at `canonical.ts:31-45`, so the publisher's text and
 * the holder's disagree and the holder refuses the whole document over a digest
 * mismatch that names no member. An `undefined` array element does the same:
 * `canonical` writes the text `undefined` where JSON writes `null`. A hole in a
 * sparse array is that element, materialized by `Array.from` so the walk meets
 * it. The refusal here names the path instead.
 *
 * A value that holds itself reaches this walk as well. JSON carries no cycle,
 * so this throws and names the path. `open` holds the path the walk stands on
 * and `done` holds what the walk has already written, which are two different
 * questions. A value two paths reach is written once and the second path reads
 * the memo: a diamond 26 levels deep holds 53 objects and fans out to 2^26
 * copies without it, and that fanned-out copy is the document a control plane
 * would serve. `structuredClone` preserves the sharing and `deepFreeze`
 * memoizes the same way, so this pass agrees with the two beside it.
 *
 * `structuredClone` at `features.ts:391` carries every refused leaf into the
 * store and `deepFreeze` seals them, so every one of them reaches here. A
 * function and a symbol do not, because `structuredClone` raises
 * `DataCloneError` on both, and the branch that names a `bigint` names those
 * two for a store some other path builds. The store is the caller's own
 * configuration, and `errors.ts:3-11` already puts a configuration error at the
 * call that supplied it.
 */
function serialized(
  value: unknown,
  path: string,
  open: WeakSet<object>,
  done: Map<object, unknown>,
): unknown {
  if (value instanceof Date) {
    throw new FeatureConfigError(
      `the value at ${path} is a Date, and a document carries an instant as an ISO 8601 string or as epoch milliseconds`,
    );
  }
  if (value === null) return value;
  if (typeof value !== 'object') {
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) return value;
      throw new FeatureConfigError(
        `the number at ${path} is ${String(value)}, and JSON carries no non-finite number`,
      );
    }
    if (value === undefined) {
      throw new FeatureConfigError(
        `the element at ${path} is undefined, and JSON carries no undefined element`,
      );
    }
    throw new FeatureConfigError(
      `the value at ${path} is a ${typeof value}, and JSON carries no ${typeof value}`,
    );
  }
  const array = Array.isArray(value);
  if (!array) {
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      const name = nameOf(value);
      throw new FeatureConfigError(
        `the value at ${path} is ${article(name)} ${name}, and JSON carries no ${name}`,
      );
    }
  }
  if (open.has(value)) {
    throw new FeatureConfigError(
      `the value at ${path} holds itself, and JSON carries no cycle`,
    );
  }
  if (done.has(value)) return done.get(value);
  open.add(value);
  const written = array
    ? Array.from(value as readonly unknown[], (each, at) =>
        serialized(each, `${path}/${String(at)}`, open, done),
      )
    : Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, each]) => each !== undefined)
          .map(([key, each]) => [
            key,
            serialized(each, `${path}/${key}`, open, done),
          ]),
      );
  open.delete(value);
  done.set(value, written);
  return written;
}

/**
 * One condition as the document carries it.
 *
 * A `WindowCondition.value` is the one member of a definition a `Date` reaches
 * legally, and decision 12 has it travel as an ISO string. The two forms decide
 * the window alike, because `toEpoch` at `conditions.ts:18-22` reads both to one
 * epoch, so the publisher holding the `Date` and the holder holding the string
 * answer `before` and `after` the same way. A value that already round-trips
 * travels as the store holds it, which is the second call § 8 names for this
 * entry point: a control plane that built its store from rows serializes it to
 * serve it, and the document it serves equals the document it read.
 *
 * Every other condition value keeps its `Date` and `serialized` refuses it. The
 * operators there are `eq`, `ne`, `in`, `not-in` and `contains`, and
 * `evaluateCondition` runs each one over `===`, so the publisher comparing a
 * `Date` and the holder comparing the ISO string decide one rule two ways over
 * two documents that digest alike. An author who wants that comparison writes
 * the ISO string in the definition, and then the two processes hold one value.
 *
 * The parameter is `unknown` because `createFeatures` reads `dependsOn` and
 * `rule.variant` and reads no condition, and its inferring overload takes the
 * `any` that `JSON.parse` returns. A store a holder built from a served document
 * therefore carries whatever a control plane put at this position. This hands
 * every value it does not convert to `serialized`, which admits what JSON
 * carries and names the path to what it does not, and § 7 gives the shape itself
 * to `validateConfig`.
 */
function documentCondition(condition: unknown, path: string): unknown {
  if (typeof condition !== 'object' || condition === null) return condition;
  const op: unknown = (condition as { readonly op?: unknown }).op;
  if (op !== 'before' && op !== 'after') return condition;
  const value: unknown = (condition as { readonly value?: unknown }).value;
  if (!(value instanceof Date)) return condition;
  if (Number.isNaN(value.getTime())) {
    throw new FeatureConfigError(
      `the Date at ${path}/value names no instant, and JSON carries no invalid Date`,
    );
  }
  return { ...condition, value: value.toISOString() };
}

/**
 * One rule as the document carries it, with its `id` and its rollout untouched.
 *
 * A `when` that is no array reaches `serialized` whole, for the reason
 * `documentCondition` states: nothing between `JSON.parse` and here reads a
 * rule's conditions, so a foreign document decides this value's shape.
 */
function documentRule(rule: Rule, path: string): unknown {
  const when: unknown = rule.when;
  if (!Array.isArray(when)) return rule;
  return {
    ...rule,
    when: (when as readonly unknown[]).map((condition, at) =>
      documentCondition(condition, `${path}/when/${String(at)}`),
    ),
  };
}

/**
 * Every variant with an explicit `order`, in the array order the store holds.
 *
 * `validateVariants` refuses a partial declaration, so either every variant
 * carries an order or none does, and `bucketingPosition` supplies the walk
 * position when none does. A control plane rebuilding this feature from rows
 * with no `ORDER BY` then hands the variants back permuted and assigns
 * identically, which is what decision 11 of the variants spec asks the envelope
 * to carry.
 */
function ordered(variants: readonly VariantSpec[]): readonly VariantSpec[] {
  return variants.map((variant, at) => ({
    ...variant,
    order: bucketingPosition(variant, at),
  }));
}

/**
 * One definition as the document carries it, before the walk writes its leaves.
 *
 * It materializes the three bucketing parameters a store leaves implicit. § 3
 * names four members that travel whole or the document is refused: a variant
 * `weight`, which `VariantSpec` requires of every author, and
 * `VariantSpec.order`, `variantBy` and `variantSeed`, which a definition may
 * leave out. A holder meeting one of those three absent fills it from
 * `bucketingPosition`, from `DEFAULT_ROLLOUT_FIELD` and from `variantSeedOf`,
 * and § 3 is written against exactly that: a holder that fills the gap with a
 * default computes a different assignment and reports nothing while it does.
 * Two of the three derive from members the document carries, so a holder today
 * agrees with the publisher, and a document that states the assignment holds
 * against two changes it otherwise would not. A Swift or Kotlin implementation
 * reads the three values off the cross-process fixture rather than out of this
 * source, and a release that moves `DEFAULT_ROLLOUT_FIELD` or the `:variant`
 * suffix reassigns nobody holding a document written before it.
 *
 * `seed`, `rollout.by` and `rollout.seed` stay as the store holds them, and
 * `rule-id.ts:68-72` is the reason. `ruleId` derives a rule's name from
 * `canonical({ by, seed })` for a rule that declares no `id`, so a serializer
 * writing either rollout member's default renames every derived rule in the
 * document and orphans every event already attached to it, which is the failure
 * § 2 puts the id mechanism in place to prevent.
 *
 * `rollout.seed` reaches its default from `seed` or from `key`, and the document
 * carries both, so a holder derives the seed the publisher derived. `rollout.by`
 * has no such member: `rolloutField` at `evaluate.ts:20-22` falls to
 * `DEFAULT_ROLLOUT_FIELD`, a constant in `fields.ts`, so a holder on a release
 * that moved it buckets a rollout on another context field while `configDigest`
 * reports one version on both sides. Decision 6 names `order`, a variant
 * `weight`, `variantSeed` and `variantBy`, and it leaves this member open.
 */
function documentDefinition<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  path: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = { ...definition };

  const rules = definition.rules;
  if (rules) {
    body['rules'] = rules.map((rule, at) =>
      documentRule(rule, `${path}/rules/${String(at)}`),
    );
  }

  const variants = definition.variants;
  if (variants) {
    body['variants'] = ordered(variants);
    body['variantBy'] = definition.variantBy ?? DEFAULT_ROLLOUT_FIELD;
    body['variantSeed'] = variantSeedOf(definition);
  }

  return body;
}

/**
 * The store's configuration as one document.
 *
 * It takes no mode. It writes every definition, every rule with the `id` its
 * author or its control plane gave it, and every variant with its name, weight,
 * order and value. A round trip back through `parseFeatureConfig` produces the
 * document it started from.
 *
 * The entry point earns its place twice. `configDigest` is defined over the
 * serialized form, so something has to produce that form from a live store, and
 * a control plane that built its store from rows serializes it to serve it.
 *
 * The envelope goes through the same walk as the definitions. `maxStale` and
 * `version` are declared `number` and `string | number`, so `Infinity` and `NaN`
 * sit at both in-type, and `schema` is an open `Record<string, unknown>` at each
 * `ValueShape`. A document emitting one of those carries `null` to its holder,
 * and `canonical` tags a non-finite number, so the holder recomputes a digest
 * that disagrees and refuses the whole document under a code that names no
 * member. The walk refuses it here and names the member, at `/maxStale`.
 *
 * @throws {FeatureConfigError} when a value holds itself, or when a leaf JSON
 * cannot carry reaches the walk. A `Date` outside a window condition is one of
 * those leaves, and a non-finite `maxStale` is another. The message names the
 * path to it.
 */
export function serializeConfig<S extends Record<keyof S, VariantInfo | never>>(
  features: Features<S, boolean>,
  envelope: ConfigEnvelope = {},
): FeatureConfig<keyof S & FeatureKey> {
  const around = serialized(
    envelope,
    '',
    new WeakSet<object>(),
    new Map<object, unknown>(),
  ) as ConfigEnvelope;

  const written = features.config.map((definition, at) => {
    const path = `/features/${String(at)}`;
    const body = serialized(
      documentDefinition(definition, path),
      path,
      new WeakSet<object>(),
      new Map<object, unknown>(),
    );
    return body as SerializedDefinition<keyof S & FeatureKey>;
  });

  return { ...around, features: written };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx nx test feature -- serialize`
Expected: PASS.

- [ ] **Step 5: Export it**

In `libs/feature/src/index.ts`, add `export { serializeConfig } from './lib/serialize.js';` beside the other value exports, and add `serializeConfig` to the allowance array from Task 1, Step 6.

- [ ] **Step 6: Pin the Date that is not in a window condition**

Review Focus. Add to `serialize.spec.ts`:

```ts
it('refuses a Date inside a variant value, which two processes read two ways', () => {
  const features = createFeatures([
    {
      key: 'banner',
      enabled: true,
      variants: [
        {
          name: 'control',
          weight: 1,
          value: { until: new Date('2026-12-24T00:00:00.000Z') },
        },
      ],
    },
  ] as const);

  expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
  expect(() => serializeConfig(features)).toThrow(
    'the value at /features/0/variants/0/value/until is a Date',
  );
});

it('refuses a Date at an attribute condition value, which === compares by identity', () => {
  const features = createFeatures([
    {
      key: 'beta',
      enabled: true,
      rules: [
        {
          when: [
            {
              field: 'signedUpAt',
              op: 'eq',
              value: new Date('2026-01-01T00:00:00.000Z'),
            },
          ],
        },
      ],
    },
  ] as const);

  expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
  expect(() => serializeConfig(features)).toThrow(
    'the value at /features/0/rules/0/when/0/value is a Date',
  );
});

it('refuses a variant value that holds itself', () => {
  const value: Record<string, unknown> = {};
  value['self'] = value;
  const features = createFeatures([
    { key: 'loop', enabled: true, variants: [{ name: 'a', weight: 1, value }] },
  ]);

  expect(() => serializeConfig(features)).toThrow(/holds itself/);
});
```

- [ ] **Step 7: Pin the members a partial serializer drops**

Review Focus. Add to `serialize.spec.ts`:

```ts
it('writes the four members that decide bucketing and build-time freezing', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      seed: 'cohort-7',
      variantBy: 'accountId',
      variantSeed: 'cta:split:v2',
      freezeTimeAtBuild: true,
      variants: [{ name: 'control', weight: 1 }],
    },
  ] as const);

  const document = serializeConfig(features);

  expect(document.features[0]).toMatchObject({
    seed: 'cohort-7',
    variantBy: 'accountId',
    variantSeed: 'cta:split:v2',
    freezeTimeAtBuild: true,
  });
});

it('writes an explicit order on every variant', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    },
  ] as const);

  const document = serializeConfig(features);

  expect(document.features[0]?.variants?.map((each) => each.order)).toEqual([
    0, 1,
  ]);
});

it('keeps an order a control plane already wrote', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50, order: 7 },
        { name: 'blue', weight: 50, order: 3 },
      ],
    },
  ] as const);

  const document = serializeConfig(features);

  expect(document.features[0]?.variants?.map((each) => each.order)).toEqual([
    7, 3,
  ]);
});

/**
 * The two bucketing members a definition may leave out, written out.
 *
 * § 3 names four members that travel whole or the document is refused. A
 * variant `weight` is required of every author and `VariantSpec.order` is
 * written by `ordered`, which leaves `variantBy` and `variantSeed`: a holder
 * meeting either one absent fills it from `DEFAULT_ROLLOUT_FIELD` and from
 * `variantSeedOf`, and the document then states the walk order and states
 * neither the field nor the seed the walk buckets on.
 */
it('writes the members a definition carrying variants has, and no others', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    },
  ] as const);

  const document = serializeConfig(features);

  expect(document.features[0]).toEqual({
    key: 'cta',
    enabled: true,
    variantBy: 'targetingKey',
    variantSeed: 'cta:variant',
    variants: [
      { name: 'control', weight: 50, order: 0 },
      { name: 'blue', weight: 50, order: 1 },
    ],
  });
});

it("writes the seed a definition's own seed derives", () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      seed: 'cohort-7',
      variants: [{ name: 'control', weight: 1 }],
    },
  ] as const);

  const document = serializeConfig(features);

  expect(document.features[0]?.variantSeed).toBe('cohort-7:variant');
});

it('writes neither bucketing member for a feature that declares no variants', () => {
  const features = createFeatures([{ key: 'cta', enabled: true }] as const);

  const document = serializeConfig(features);

  expect(Object.keys(document.features[0] ?? {})).toEqual(['key', 'enabled']);
});

/**
 * A rollout member keeps its default, and `ruleId` is why.
 *
 * `rolloutText` in `rule-id.ts` derives a rule's name from
 * `canonical({ by, seed })` for a rule that declares no `id`. A serializer
 * writing either member's default renames every derived rule the document
 * carries, which orphans every event already attached to it. `rollout.seed`
 * reaches its default from `seed` or from `key`, and the document carries both,
 * so a holder derives the seed the publisher derived. `rollout.by` has no such
 * member, which the case below holds.
 */
it('leaves a rollout that declares no field and no seed as the store holds it', () => {
  const features = createFeatures([
    { key: 'beta', enabled: true, rules: [{ rollout: { percent: 25 } }] },
  ] as const);

  const document = serializeConfig(features);
  const published = document.features[0]?.rules?.[0];

  expect(published?.rollout).toEqual({ percent: 25 });
  expect(published?.id).toBeUndefined();
});

it('writes an authored rule id untouched', () => {
  const features = createFeatures([
    {
      key: 'beta',
      enabled: true,
      rules: [
        { id: 'staff-only', when: [{ field: 'staff', op: 'eq', value: true }] },
      ],
    },
  ] as const);

  const document = serializeConfig(features);

  expect(document.features[0]?.rules?.[0]?.id).toBe('staff-only');
});

it('invents no id for a rule that declares none', () => {
  const features = createFeatures([
    {
      key: 'beta',
      enabled: true,
      rules: [{ when: [{ field: 'staff', op: 'eq', value: true }] }],
    },
  ] as const);

  const document = serializeConfig(features);

  expect(document.features[0]?.rules?.[0]).not.toHaveProperty('id');
});
```

`variantBy` and `variantSeed` are the other two members decision 6 names, and the serializer writes both for every definition carrying variants. `rollout.by` and `rollout.seed` default from the same `DEFAULT_ROLLOUT_FIELD` and the same `seed`, and the serializer leaves both alone, because `ruleId` derives a rule's name from them for a rule that declares no `id`.

The last case is the asymmetry with `order` and it is deliberate. `ruleId` in `rule-id.ts` derives a content hash that survives a permutation of the rules array, so a document that carries no id still names one rule. A variant's walk position does not survive a permutation, so the document carries it.

- [ ] **Step 8: Pin the window a document already carries and the `when` no `Rule` describes**

Review Focus. `documentCondition` and `documentRule` run before `serialized` sees a value, and both read members a foreign document decided the shape of. Add to `serialize.spec.ts`:

```ts
describe('a window a document already carries', () => {
  it('writes an ISO string value as the store holds it', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [
              { field: 'now', op: 'after', value: '2026-10-01T00:00:00.000Z' },
            ],
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.rules?.[0]?.when?.[0]).toEqual({
      field: 'now',
      op: 'after',
      value: '2026-10-01T00:00:00.000Z',
    });
  });

  it('writes the same document again for the store a holder built', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [
              {
                field: 'now',
                op: 'after',
                value: new Date('2026-10-01T00:00:00.000Z'),
              },
            ],
          },
        ],
      },
    ] as const);
    const document = serializeConfig(features);
    const carried = JSON.parse(JSON.stringify(document)) as FeatureConfig;
    const holder = createFeatures(carried.features as Definitions);

    expect(serializeConfig(holder)).toEqual(document);
  });
});

describe('a when a Rule does not describe', () => {
  it('writes a null element as the null JSON carries', () => {
    const features = createFeatures([
      { key: 'k', enabled: true, rules: [{ when: [null] }] },
    ] as never);

    const document = serializeConfig(features);

    expect(document.features[0]?.rules?.[0]?.when).toEqual([null]);
  });

  it('refuses an undefined element and names the path to it', () => {
    const features = createFeatures([
      { key: 'k', enabled: true, rules: [{ when: [undefined] }] },
    ] as never);

    expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
    expect(() => serializeConfig(features)).toThrow(
      'the element at /features/0/rules/0/when/0 is undefined, and JSON ' +
        'carries no undefined element',
    );
  });

  it('writes a when that arrived as an object, not as an array', () => {
    const features = createFeatures([
      {
        key: 'k',
        enabled: true,
        rules: [{ when: { field: 'plan', op: 'eq', value: 'pro' } }],
      },
    ] as never);

    const document = serializeConfig(features);

    expect(document.features[0]?.rules?.[0]?.when).toEqual({
      field: 'plan',
      op: 'eq',
      value: 'pro',
    });
  });
});
```

The three `when` cases hold one rule: the pre-walk hands every value it does not convert to `serialized`, so a document carries what JSON carries and a publisher raises no bare `TypeError` naming no feature. § 7 gives the shape itself to `validateConfig`, which Task 5 builds.

- [ ] **Step 9: Run everything and commit**

Run: `npx nx affected -t test lint build --base=main --skip-nx-cache`
Then: `npx prettier --check` on every file you touched.

```bash
git add libs/feature/src/lib/serialize.ts libs/feature/src/lib/serialize.spec.ts libs/feature/src/index.ts tools/repo-checks/src/doc-export-coverage-allowance.json
git commit -m "feat(feature): serialize a store as one configuration document"
```

---

### Task 3: `configDigest`

**Files:**

- Create: `libs/feature/src/lib/digest.ts`
- Create: `libs/feature/src/lib/digest.spec.ts`
- Modify: `libs/feature/src/index.ts`

**Interfaces:**

- Consumes: `canonical` from `./canonical.js`; `murmur3` from `./bucketing.js`; `FeatureConfig` from `./config.js`.
- Produces: `export function configDigest(config: FeatureConfig): string;`

- [ ] **Step 1: Write the failing test**

Create `libs/feature/src/lib/digest.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { configDigest } from './digest.js';
import type { FeatureConfig } from './config.js';

const document: FeatureConfig = {
  version: 41,
  features: [
    { key: 'checkout', enabled: true },
    { key: 'express', enabled: true, dependsOn: ['checkout'] },
  ],
};

describe('configDigest', () => {
  it('returns 32 hex characters', () => {
    expect(configDigest(document)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('agrees for two documents differing only in key order', () => {
    const permuted: FeatureConfig = {
      features: [...document.features],
      version: document.version,
    };

    expect(configDigest(permuted)).toBe(configDigest(document));
  });

  it('agrees for an absent key and a key written undefined', () => {
    const explicit: FeatureConfig = { ...document, schemaVersion: undefined };

    expect(configDigest(explicit)).toBe(configDigest(document));
  });

  it('agrees whatever digest the document already carries', () => {
    const carried: FeatureConfig = { ...document, digest: 'not a digest' };

    expect(configDigest(carried)).toBe(configDigest(document));
  });

  it('disagrees when the rules array order changes', () => {
    const rules = [
      {
        id: 'staff',
        when: [{ field: 'staff', op: 'eq' as const, value: true }],
      },
      { id: 'beta', when: [{ field: 'beta', op: 'eq' as const, value: true }] },
    ];
    const one: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules }],
    };
    const other: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules: [...rules].reverse() }],
    };

    expect(configDigest(other)).not.toBe(configDigest(one));
  });

  it('agrees when the version changes and nothing else does', () => {
    const bumped: FeatureConfig = { ...document, version: 42 };

    expect(configDigest(bumped)).toBe(configDigest(document));
  });

  it('verifies the document a publisher with no version scheme serves', () => {
    const authored: FeatureConfig = {
      features: [{ key: 'x', enabled: true }],
    };
    const digest = configDigest(authored);
    const served: FeatureConfig = { ...authored, version: digest, digest };

    expect(configDigest(served)).toBe(digest);
  });

  it('agrees across a trip through JSON', () => {
    const arrived = JSON.parse(JSON.stringify(document)) as FeatureConfig;

    expect(configDigest(arrived)).toBe(configDigest(document));
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx nx test feature -- digest`
Expected: FAIL, `./digest.js` does not exist.

- [ ] **Step 3: Write the digest**

Create `libs/feature/src/lib/digest.ts`:

```ts
import { murmur3Bytes, utf8 } from './bucketing.js';
import { canonical } from './canonical.js';
import type { FeatureConfig } from './config.js';

/**
 * Four fixed seeds, which widen a 32-bit hash to a 128-bit digest.
 *
 * One `murmur3` word is 8 hex characters, and a comparison whose whole job is
 * to detect a difference between two documents deserves more than that. The
 * values are the murmur3 reference suite's seeds and two constants from the
 * same family, and nothing in the library derives meaning from them beyond
 * being four distinct 32-bit numbers every implementation can copy.
 */
const SEEDS: readonly number[] = [
  0x00000000, 0x9747b28c, 0x2f1e3d4c, 0xb7e15163,
];

/**
 * A hex digest over the canonical text of a document.
 *
 * `canonical` in this package sorts object keys, preserves array order, drops
 * `undefined` properties and writes a `Date` the way `JSON.stringify` writes
 * one. Two documents differing in key order or in whitespace state one
 * configuration, and a digest over raw bytes would change when nothing did.
 *
 * It also tags `NaN`, `Infinity` and `-Infinity`, which `JSON.stringify` writes
 * as `null`, and `ruleId` is the caller that needs the three apart. No digest
 * rests on that tag: `serializeConfig` refuses a non-finite number at every
 * member of the document it emits, `maxStale` included, and `JSON.parse` hands a
 * holder none, so both sides of a comparison canonicalise a number JSON carries.
 *
 * `digest` and `version` are removed from the input before the text is taken,
 * and both are removed for one reason: § 2 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` has a publisher with no
 * version scheme set both members to the digest, and a holder recompute it and
 * refuse a document that disagrees. A publisher computes the digest before it
 * has either member to write, so a text that carried them could never be
 * recomputed from the document served, and every verification of every document
 * from that publisher would report a mismatch.
 *
 * What is left is the configuration. A holder that wants to know whether the
 * publisher relabelled a document compares `version` with `!==`, which is what
 * `docs/specs/2026-09-23-feature-hydration.md`, "The comparison", asks of it.
 *
 * Two processes computing one digest from documents they fetched separately
 * have proved they hold the same configuration, which is what condition 2 of
 * the variants spec's determinism section asks for. The comparison holds across
 * a JSON hop because `canonical` writes a `Date` and the ISO string the
 * transport hands the holder as one text, which is also why `serializeConfig`
 * refuses a `Date` at a member `toEpoch` does not read: two processes whose
 * values compare apart under `===` digest alike.
 *
 * Not a cryptographic digest. No security property rests on the difficulty of
 * finding a second document that hashes the same, and Web Crypto's `digest`
 * returns a promise, which no synchronous entry point here can await.
 */
export function configDigest(config: FeatureConfig): string {
  const body: Record<string, unknown> = { ...config };
  delete body['digest'];
  delete body['version'];
  const bytes = utf8(canonical(body));
  return SEEDS.map((seed) =>
    murmur3Bytes(bytes, seed).toString(16).padStart(8, '0'),
  ).join('');
}
```

- [ ] **Step 4: Run the tests**

Run: `npx nx test feature -- digest`
Expected: PASS.

- [ ] **Step 5: Export it**

In `libs/feature/src/index.ts`, add `export { configDigest } from './lib/digest.js';` and add `configDigest` to the allowance array from Task 1, Step 6.

- [ ] **Step 6: Run everything and commit**

Run: `npx nx affected -t test lint build --base=main --skip-nx-cache`
Then: `npx prettier --check` on every file you touched.

```bash
git add libs/feature/src/lib/digest.ts libs/feature/src/lib/digest.spec.ts libs/feature/src/index.ts tools/repo-checks/src/doc-export-coverage-allowance.json
git commit -m "feat(feature): derive an opaque digest from a document"
```

---

### Task 4: One checker for the graph and the variants

**Files:**

- Modify: `libs/feature/src/lib/graph.ts`
- Modify: `libs/feature/src/lib/variants.ts`
- Create: `libs/feature/src/lib/validate.ts`
- Create: `libs/feature/src/lib/validate.spec.ts`
- Modify: `libs/feature/src/lib/features.ts`
- Modify: `libs/feature/src/index.ts`
- Modify: `libs/feature/src/lib/graph.spec.ts` (no behaviour change, imports only if needed)

**Interfaces:**

- Consumes: `FeatureConfig`, `ConfigIssue`, `ConfigIssueCode`, `ValidationResult` from `./config.js`; the six error classes from `./errors.js`; `FeatureDefinition`, `FeatureKey` from `./types.js`.
- Produces:
  - `graph.ts`: `export function graphErrors<F extends FeatureKey>(definitions: readonly FeatureDefinition<F>[]): readonly FeatureConfigError[];` and `buildGraph` unchanged in behaviour.
  - `variants.ts`: `export function variantErrors<F extends FeatureKey>(definition: FeatureDefinition<F>): readonly FeatureConfigError[];` and `validateVariants` unchanged in behaviour.
  - `validate.ts`: `export function validateConfig(config: FeatureConfig): ValidationResult;` and, not exported from the package index, `export function collectIssues(config: FeatureConfig): readonly Found[];` with `export interface Found { issue: ConfigIssue; error: FeatureConfigError }`.

Decision 11 says both entry points call one checker. The checker is `collectIssues`, and every issue it reports is built from the error object the throwing path would have thrown, so the message a stack trace carries and the message an operator's console carries are one string by construction and not by agreement.

- [ ] **Step 1: Write the failing test for the collector**

Create `libs/feature/src/lib/validate.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createFeatures } from './features.js';
import { validateConfig } from './validate.js';
import { DuplicateFeatureError } from './errors.js';
import type { FeatureConfig } from './config.js';

describe('validateConfig', () => {
  it('accepts a document the store accepts', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'checkout', enabled: true },
        { key: 'express', enabled: true, dependsOn: ['checkout'] },
      ],
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('reports four issues in a document carrying four', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
        { key: 'b', enabled: true, dependsOn: ['nowhere'] },
        { key: 'c', enabled: true, dependsOn: ['d'] },
        { key: 'd', enabled: true, dependsOn: ['c'] },
        {
          key: 'e',
          enabled: true,
          variants: [{ name: 'only', weight: -1 }],
        },
      ],
    };

    const result = validateConfig(config);

    expect(
      result.ok === false && result.issues.map((each) => each.code),
    ).toEqual([
      'duplicate-feature',
      'unknown-dependency',
      'cycle',
      'invalid-weight',
    ]);
  });

  it('gives an issue the message its thrown counterpart carries', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]?.message).toBe(
      new DuplicateFeatureError('a').message,
    );
  });

  it('names the feature and a pointer into the document', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'b', enabled: true, variants: [] },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]).toMatchObject({
      code: 'empty-variants',
      key: 'b',
      path: '/features/1/variants',
    });
  });

  it('leaves createFeatures throwing the error it throws today', () => {
    expect(() =>
      createFeatures([
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ]),
    ).toThrow(DuplicateFeatureError);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx nx test feature -- validate`
Expected: FAIL, `./validate.js` does not exist.

- [ ] **Step 3: Split the graph's throws from its walk**

In `libs/feature/src/lib/graph.ts`, add `graphErrors` above `buildGraph` and make `buildGraph` call it:

```ts
/**
 * Every configuration error in the dependency graph, in document order.
 *
 * `buildGraph` throws the first of these and `validateConfig` reports all of
 * them, so the two paths differ only in what they do with the list. One producer of
 * the error objects means one message for each defect, whether a TypeScript
 * author reads it in a stack trace or an operator reads it in a console.
 *
 * The cycle walk records a closing edge and marks the node finished, and it
 * does not stop, so a document with two independent cycles reports both and the walk
 * still terminates.
 */
export function graphErrors<F extends FeatureKey>(
  definitions: readonly FeatureDefinition<F>[],
): readonly FeatureConfigError[] {
  const found: FeatureConfigError[] = [];
  const parents = new Map<F, readonly F[]>();

  for (const definition of definitions) {
    if (parents.has(definition.key)) {
      found.push(new DuplicateFeatureError(definition.key));
      continue;
    }
    parents.set(definition.key, definition.dependsOn ?? []);
  }

  for (const [key, dependsOn] of parents) {
    for (const parent of dependsOn) {
      if (!parents.has(parent)) {
        found.push(new UnknownDependencyError(key, parent));
      }
    }
  }

  const finished = new Set<F>();
  const onPath = new Set<F>();
  const path: F[] = [];

  const visit = (key: F): void => {
    if (finished.has(key)) return;
    if (onPath.has(key)) {
      const start = path.indexOf(key);
      found.push(new FeatureCycleError([...path.slice(start), key]));
      return;
    }
    onPath.add(key);
    path.push(key);
    for (const parent of parents.get(key) ?? []) visit(parent);
    path.pop();
    onPath.delete(key);
    finished.add(key);
  };

  for (const key of parents.keys()) visit(key);

  return found;
}
```

Then, at the top of `buildGraph`, before it builds `parents`:

```ts
const found = graphErrors(definitions);
if (found[0]) throw found[0];
```

and delete the three `throw` statements inside `buildGraph` itself, keeping its `parents`, `order`, `position`, `children` and `dependants` construction. The walk inside `buildGraph` now runs on a graph that is known to have no duplicate, no unknown dependency and no cycle, so its `visit` needs no `onPath` guard; keep the guard anyway and make it `return`, because a future caller that skips `graphErrors` would otherwise loop.

- [ ] **Step 4: Split the variants' throws from their check**

In `libs/feature/src/lib/variants.ts`, rename the body of `validateVariants` to `variantErrors`, returning `readonly FeatureConfigError[]`, with every `throw new X(...)` replaced by `found.push(new X(...))` and every early `return` replaced by the equivalent that keeps collecting. Then:

```ts
/**
 * Checks a feature's variants at construction, where the dependency graph is
 * already checked.
 *
 * @throws {DuplicateVariantError} when two variants share a name.
 * @throws {UnknownVariantError} when a rule pins a variant nobody declared.
 * @throws {FeatureConfigError} for an unusable weight, an unusable order, an
 * empty set, or a weight total that is zero or not finite.
 */
export function validateVariants<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
): void {
  const found = variantErrors(definition);
  if (found[0]) throw found[0];
}
```

The order the collector pushes in fixes the order `validateVariants` throws in, so it must be the order the current function checks in: the empty set, then per variant the duplicate name, the weight and the order, then the weight total, then the partial-order mix, then the unknown pin.

- [ ] **Step 5: Run the existing suites**

Run: `npx nx test feature -- graph variants features`
Expected: PASS. The refactor changes no message and no throw order, so every existing assertion holds.

- [ ] **Step 6: Write the checker**

Create `libs/feature/src/lib/validate.ts`:

```ts
import { graphErrors } from './graph.js';
import { variantErrors } from './variants.js';
import {
  DuplicateFeatureError,
  DuplicateVariantError,
  FeatureConfigError,
  FeatureCycleError,
  UnknownDependencyError,
  UnknownVariantError,
} from './errors.js';
import type {
  ConfigIssue,
  ConfigIssueCode,
  FeatureConfig,
  ValidationResult,
} from './config.js';
import type { FeatureDefinition, FeatureKey } from './types.js';

/**
 * One issue, paired with the error the throwing path raises for it.
 *
 * `createFeatures` throws the error and `validateConfig` reports the issue, and
 * the message on both is one string, because one object produced it.
 */
export interface Found {
  issue: ConfigIssue;
  error: FeatureConfigError;
}

/** The code a graph error reports as. */
function graphCode(error: FeatureConfigError): ConfigIssueCode {
  if (error instanceof DuplicateFeatureError) return 'duplicate-feature';
  if (error instanceof UnknownDependencyError) return 'unknown-dependency';
  if (error instanceof FeatureCycleError) return 'cycle';
  return 'duplicate-feature';
}

/**
 * The code a variant error reports as.
 *
 * `variantErrors` raises a bare `FeatureConfigError` for five distinct
 * defects, so the text it wrote is the only thing that separates them. The spec
 * names 18 codes and none of them covers a partial `order` declaration or a
 * weight total that is not finite, so the first maps to `invalid-variant-order`
 * and the second to `zero-weights`, which are the codes closest to what an
 * operator has to fix.
 */
function variantCode(error: FeatureConfigError): ConfigIssueCode {
  if (error instanceof DuplicateVariantError) return 'duplicate-variant';
  if (error instanceof UnknownVariantError) return 'unknown-variant';
  if (error.message.includes('empty variants array')) return 'empty-variants';
  if (error.message.includes('which is not a usable share'))
    return 'invalid-weight';
  if (error.message.includes('non-negative integer'))
    return 'invalid-variant-order';
  if (error.message.includes('two variants the order'))
    return 'duplicate-variant-order';
  if (error.message.includes('mixes two orderings'))
    return 'invalid-variant-order';
  return 'zero-weights';
}

function found(
  code: ConfigIssueCode,
  error: FeatureConfigError,
  key?: FeatureKey,
  path?: string,
): Found {
  return {
    error,
    issue: {
      code,
      message: error.message,
      ...(key === undefined ? {} : { key }),
      ...(path === undefined ? {} : { path }),
    },
  };
}

/** The pointer at a definition, and optionally at one of its members. */
function pointer(at: number, member?: string): string {
  return member === undefined
    ? `/features/${String(at)}`
    : `/features/${String(at)}/${member}`;
}

/** The member a variant error points at, so a UI highlights the right row. */
function variantMember(error: FeatureConfigError): string {
  if (error instanceof UnknownVariantError) return 'rules';
  return 'variants';
}

/** Two rules of one feature declaring one id. */
function ruleIdErrors<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
): readonly FeatureConfigError[] {
  const seen = new Set<string>();
  const errors: FeatureConfigError[] = [];
  for (const rule of definition.rules ?? []) {
    if (rule.id === undefined) continue;
    if (seen.has(rule.id)) {
      errors.push(
        new FeatureConfigError(
          `feature "${String(definition.key)}" declares the rule id "${rule.id}" twice`,
        ),
      );
      continue;
    }
    seen.add(rule.id);
  }
  return errors;
}

/**
 * Every defect in a document, in the order a reader meets them.
 *
 * The graph comes first, because a duplicate key and an unknown dependency
 * describe the document as a whole. Then each definition in document order,
 * with its variants and its rule ids.
 *
 * Not exported from the package. `validateConfig` is the public half and
 * `createFeatures` is the other caller.
 */
export function collectIssues(config: FeatureConfig): readonly Found[] {
  const definitions = config.features;
  const all: Found[] = graphErrors(definitions).map((error) =>
    found(
      graphCode(error),
      error,
      error instanceof DuplicateFeatureError ||
        error instanceof UnknownDependencyError
        ? error.key
        : undefined,
    ),
  );

  definitions.forEach((definition, at) => {
    for (const error of variantErrors(definition)) {
      all.push(
        found(
          variantCode(error),
          error,
          definition.key,
          pointer(at, variantMember(error)),
        ),
      );
    }
    for (const error of ruleIdErrors(definition)) {
      all.push(
        found('duplicate-rule-id', error, definition.key, pointer(at, 'rules')),
      );
    }
  });

  return all;
}

/**
 * Every defect in a candidate document, reported and not thrown.
 *
 * It reports all of them. A poller showing an operator one error per deploy
 * cycle is a poor tool when the row has four.
 *
 * `createFeatures` calls the same checker and throws the first issue as the
 * typed error it has always thrown, which keeps `errors.ts:3-11` true: every
 * error this library raises is raised where the configuration is supplied, and
 * `resolve`, `plan` and `toggle` stay total.
 */
export function validateConfig(config: FeatureConfig): ValidationResult {
  const all = collectIssues(config);
  if (all.length === 0) return { ok: true };
  return { ok: false, issues: all.map((each) => each.issue) };
}
```

- [ ] **Step 7: Route `createFeatures` through it**

In `libs/feature/src/lib/features.ts`, replace the `for (const definition of config) validateVariants(definition);` line with a call to the checker, above `buildGraph`:

```ts
const refused = collectIssues({ features: config });
if (refused[0]) throw refused[0].error;
const graph = buildGraph(config);
```

Drop the `validateVariants` import and add `import { collectIssues } from './validate.js';`.

The order changes in one way and the change is deliberate: a document with a graph defect and a variant defect now throws the graph error. It threw the variant error before, because the loop ran first. Nothing asserts that order today. Confirm that with `npx nx test feature -- features` before moving on, and if an assertion does depend on it, report it and edit no assertion.

- [ ] **Step 8: Export `validateConfig` and run**

In `libs/feature/src/index.ts`, add `export { validateConfig } from './lib/validate.js';` and add `validateConfig` to the allowance array.

Run: `npx nx test feature`
Expected: PASS.

- [ ] **Step 9: Pin the weights that look valid**

Review Focus. Add to `validate.spec.ts`:

```ts
it('reports a negative zero weight through the total, not as a share', () => {
  const config: FeatureConfig = {
    features: [
      { key: 'cta', enabled: true, variants: [{ name: 'only', weight: -0 }] },
    ],
  };

  const result = validateConfig(config);

  // `Number.isFinite(-0)` is true and `-0 < 0` is false, so the per-variant
  // check passes it and the total is what refuses it.
  expect(result.ok === false && result.issues.map((each) => each.code)).toEqual(
    ['zero-weights'],
  );
});

it('reports a NaN weight as an unusable share', () => {
  const config: FeatureConfig = {
    features: [
      { key: 'cta', enabled: true, variants: [{ name: 'only', weight: NaN }] },
    ],
  };

  const result = validateConfig(config);

  expect(result.ok === false && result.issues[0]?.code).toBe('invalid-weight');
});

it('reports a fractional order as an invalid one', () => {
  const config: FeatureConfig = {
    features: [
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 1, order: 0.5 },
          { name: 'blue', weight: 1, order: 1 },
        ],
      },
    ],
  };

  const result = validateConfig(config);

  expect(result.ok === false && result.issues[0]?.code).toBe(
    'invalid-variant-order',
  );
});

it('reports two variants sharing an order', () => {
  const config: FeatureConfig = {
    features: [
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 1, order: 3 },
          { name: 'blue', weight: 1, order: 3 },
        ],
      },
    ],
  };

  const result = validateConfig(config);

  expect(result.ok === false && result.issues[0]?.code).toBe(
    'duplicate-variant-order',
  );
});

it('reports two rules of one feature declaring one id', () => {
  const config: FeatureConfig = {
    features: [
      {
        key: 'beta',
        enabled: true,
        rules: [
          { id: 'staff', when: [{ field: 'staff', op: 'eq', value: true }] },
          { id: 'staff', when: [{ field: 'staff', op: 'eq', value: false }] },
        ],
      },
    ],
  };

  const result = validateConfig(config);

  expect(result.ok === false && result.issues[0]).toMatchObject({
    code: 'duplicate-rule-id',
    key: 'beta',
    path: '/features/0/rules',
  });
});

it('lets two features declare the same rule id', () => {
  const config: FeatureConfig = {
    features: [
      { key: 'a', enabled: true, rules: [{ id: 'staff' }] },
      { key: 'b', enabled: true, rules: [{ id: 'staff' }] },
    ],
  };

  // A rule id names a rule inside its own feature. `Decision.rule` is read
  // beside `Decision.key`, so two features naming one rule collide nowhere.
  expect(validateConfig(config)).toEqual({ ok: true });
});
```

- [ ] **Step 10: Run everything and commit**

Run: `npx nx affected -t test lint build --base=main --skip-nx-cache`
Then: `npx prettier --check` on every file you touched.

```bash
git add libs/feature/src/lib/graph.ts libs/feature/src/lib/variants.ts libs/feature/src/lib/validate.ts libs/feature/src/lib/validate.spec.ts libs/feature/src/lib/features.ts libs/feature/src/index.ts tools/repo-checks/src/doc-export-coverage-allowance.json
git commit -m "feat(feature): report every configuration defect from one checker"
```

---

### Task 5: The envelope's own checks

**Files:**

- Modify: `libs/feature/src/lib/validate.ts`
- Modify: `libs/feature/src/lib/validate.spec.ts`

**Interfaces:**

- Consumes: `configDigest` from `./digest.js`; `FeatureSchema`, `FieldType`, `ValueShape` from `./config.js`; everything Task 4 produced.
- Produces: no new exported name. `validateConfig` and `collectIssues` gain seven codes: `unknown-member`, `digest-mismatch`, `missing-schema-version`, `unfenced-schema`, `unknown-context-field`, `field-type-mismatch`, `invalid-instant`.

- [ ] **Step 1: Write the failing tests**

Add to `libs/feature/src/lib/validate.spec.ts`:

```ts
describe('the envelope', () => {
  it('refuses a member it does not know', () => {
    const config = {
      features: [{ key: 'a', enabled: true }],
      hashVersion: 2,
    } as unknown as FeatureConfig;

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]).toMatchObject({
      code: 'unknown-member',
      path: '/hashVersion',
    });
  });

  it('refuses a document whose digest does not describe it', () => {
    const config: FeatureConfig = {
      features: [{ key: 'a', enabled: true }],
      digest: '0'.repeat(32),
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]?.code).toBe(
      'digest-mismatch',
    );
  });

  it('accepts a document whose digest describes it', () => {
    const body: FeatureConfig = { features: [{ key: 'a', enabled: true }] };

    expect(validateConfig({ ...body, digest: configDigest(body) })).toEqual({
      ok: true,
    });
  });

  it('refuses an inline schema nobody can name', () => {
    const config: FeatureConfig = {
      features: [{ key: 'a', enabled: true }],
      schema: { context: { fields: { plan: 'string' } } },
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]).toMatchObject({
      code: 'missing-schema-version',
      path: '/schema',
    });
  });

  it('accepts a schemaVersion with no schema behind it', () => {
    const config: FeatureConfig = {
      features: [{ key: 'a', enabled: true }],
      schemaVersion: 's7',
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('refuses a combinator in a variant value shape', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'cta', enabled: true, variants: [{ name: 'a', weight: 1 }] },
      ],
      schemaVersion: 's1',
      schema: {
        features: {
          cta: { variants: { a: { oneOf: [{ type: 'string' }] } } },
        },
      },
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]).toMatchObject({
      code: 'unfenced-schema',
      path: '/schema/features/cta/variants/a/oneOf',
    });
  });

  it('refuses a $ref that leaves the document', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'cta', enabled: true, variants: [{ name: 'a', weight: 1 }] },
      ],
      schemaVersion: 's1',
      schema: {
        features: {
          cta: {
            variants: { a: { $ref: 'https://example.test/label.json' } },
          },
        },
      },
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]?.code).toBe(
      'unfenced-schema',
    );
  });

  it('accepts a $ref naming a $defs entry in the same document', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'cta', enabled: true, variants: [{ name: 'a', weight: 1 }] },
      ],
      schemaVersion: 's1',
      schema: {
        features: {
          cta: {
            variants: {
              a: {
                $defs: { Label: { type: 'string' } },
                type: 'object',
                properties: { label: { $ref: '#/$defs/Label' } },
              },
            },
          },
        },
      },
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('refuses a condition over a field the schema does not declare', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'beta',
          enabled: true,
          rules: [{ when: [{ field: 'tier', op: 'eq', value: 'gold' }] }],
        },
      ],
      schemaVersion: 's1',
      schema: { context: { fields: { plan: 'string' } } },
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]).toMatchObject({
      code: 'unknown-context-field',
      key: 'beta',
    });
  });

  it('refuses contains over a declared boolean', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'beta',
          enabled: true,
          rules: [{ when: [{ field: 'staff', op: 'contains', value: true }] }],
        },
      ],
      schemaVersion: 's1',
      schema: { context: { fields: { staff: 'boolean' } } },
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]?.code).toBe(
      'field-type-mismatch',
    );
  });

  it('refuses a window instant a Date constructor reads as NaN', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'sale',
          enabled: true,
          rules: [
            { when: [{ field: 'now', op: 'after', value: 'next tuesday' }] },
          ],
        },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]).toMatchObject({
      code: 'invalid-instant',
      key: 'sale',
      path: '/features/0/rules/0/when/0/value',
    });
  });
});
```

Add `import { configDigest } from './digest.js';` at the top of the file.

- [ ] **Step 2: Run and confirm they fail**

Run: `npx nx test feature -- validate`

- [ ] **Step 3: Check the members**

Add to `validate.ts`:

```ts
/** The six members an envelope carries. A seventh refuses the document. */
const ENVELOPE_MEMBERS: ReadonlySet<string> = new Set([
  'version',
  'digest',
  'schema',
  'schemaVersion',
  'maxStale',
  'features',
]);

/**
 * A member this holder cannot read refuses the whole document.
 *
 * GrowthBook's payload builder strips a rule key an SDK connection does not
 * declare support for, and the SDK then reads `experiment.hashVersion || 1`,
 * which puts that traffic back on the hashing GrowthBook's own documentation
 * calls biased, with no warning on either side. Two properties combine to
 * produce that: the producer removes a member the consumer needs, and the
 * consumer defaults the missing member to a value that changes an answer.
 *
 * This refuses both. The holder drops nothing and evaluates nothing, and the
 * issue names the member. The cost is availability, and § 6 bounds it: a
 * refused candidate leaves the installed document deciding.
 */
function memberIssues(config: FeatureConfig): readonly Found[] {
  return Object.keys(config)
    .filter((member) => !ENVELOPE_MEMBERS.has(member))
    .map((member) =>
      found(
        'unknown-member',
        new FeatureConfigError(
          `the document carries the member "${member}", which this holder cannot read`,
        ),
        undefined,
        `/${member}`,
      ),
    );
}
```

`Object.keys` reads own enumerable keys only, so a document parsed from JSON text carrying `"__proto__"` surfaces the member here and no prototype is written. Step 8 pins that.

- [ ] **Step 4: Check the digest and the schema version**

```ts
function digestIssues(config: FeatureConfig): readonly Found[] {
  if (config.digest === undefined) return [];
  const derived = configDigest(config);
  if (derived === config.digest) return [];
  return [
    found(
      'digest-mismatch',
      new FeatureConfigError(
        `the document states the digest ${config.digest} and its content digests to ${derived}`,
      ),
      undefined,
      '/digest',
    ),
  ];
}

/**
 * An inline schema states its own version.
 *
 * A schema is immutable at its `schemaVersion`, so a document naming `s7` and a
 * schema published at `s7` cannot disagree. An inline schema nobody can name
 * cannot be cached, compared or fetched again. A document carrying neither
 * member declares no shapes, which is what a configuration with no variant
 * values looks like.
 */
function schemaVersionIssues(config: FeatureConfig): readonly Found[] {
  if (config.schema === undefined || config.schemaVersion !== undefined) {
    return [];
  }
  return [
    found(
      'missing-schema-version',
      new FeatureConfigError(
        'the document carries an inline schema and no schemaVersion, so no holder can cache it',
      ),
      undefined,
      '/schema',
    ),
  ];
}
```

- [ ] **Step 5: Fence the value shapes**

```ts
/** What a `ValueShape` may use. */
const FENCED: ReadonlySet<string> = new Set([
  'type',
  'properties',
  'required',
  'items',
  'enum',
  'const',
  'additionalProperties',
  '$defs',
  '$ref',
  'title',
  'description',
]);

/**
 * The fence, walked over one variant value shape.
 *
 * A remote `$ref` makes the document one a generator cannot resolve offline,
 * and `allOf`, `anyOf`, `oneOf` and `not` produce Swift and Kotlin a reader
 * cannot map back to the schema. An owner needing a union writes an `enum` over
 * a discriminant.
 */
function shapeIssues(shape: unknown, path: string): readonly Found[] {
  if (shape === null || typeof shape !== 'object') return [];
  if (Array.isArray(shape)) {
    return shape.flatMap((each, at) =>
      shapeIssues(each, `${path}/${String(at)}`),
    );
  }

  const issues: Found[] = [];
  for (const [keyword, held] of Object.entries(
    shape as Record<string, unknown>,
  )) {
    const at = `${path}/${keyword}`;
    if (keyword === '$ref') {
      if (typeof held !== 'string' || !held.startsWith('#/$defs/')) {
        issues.push(
          found(
            'unfenced-schema',
            new FeatureConfigError(
              `the value shape at ${at} references ${String(held)}, and a shape may reference only a $defs entry in the same document`,
            ),
            undefined,
            at,
          ),
        );
      }
      continue;
    }
    if (!FENCED.has(keyword)) {
      issues.push(
        found(
          'unfenced-schema',
          new FeatureConfigError(
            `the value shape at ${at} uses the keyword "${keyword}", which the fence refuses`,
          ),
          undefined,
          at,
        ),
      );
      continue;
    }
    issues.push(...shapeIssues(held, at));
  }
  return issues;
}

function schemaIssues(config: FeatureConfig): readonly Found[] {
  const features = config.schema?.features;
  if (!features) return [];
  return Object.entries(features).flatMap(([key, shape]) =>
    Object.entries(shape.variants ?? {}).flatMap(([variant, value]) =>
      shapeIssues(value, `/schema/features/${key}/variants/${variant}`).map(
        (each) => ({ ...each, issue: { ...each.issue, key } }),
      ),
    ),
  );
}
```

`type` and `title` hold strings, so the recursion into them returns at once. `properties`, `items` and `$defs` hold shapes, and the walk reaches every keyword inside them.

- [ ] **Step 6: Check the context fields and the instants**

```ts
/** The base of a declared type, with the array and optional suffixes stripped. */
function baseOf(declared: FieldType): { base: string; array: boolean } {
  const withoutOptional = declared.endsWith('?')
    ? declared.slice(0, -1)
    : declared;
  const array = withoutOptional.endsWith('[]');
  return {
    base: array ? withoutOptional.slice(0, -2) : withoutOptional,
    array,
  };
}

/**
 * Whether an operator fits a declared type.
 *
 * `contains` asks whether an array holds a value, so the declared field is an
 * array. `in` and `not-in` ask whether a scalar is a member of a literal list,
 * so the declared field is a scalar. `eq` and `ne` compare with `===`, which
 * never holds for two arrays, so they take a scalar too. `before` and `after`
 * read `now` and reach no declared field.
 */
function operatorFits(op: string, declared: FieldType): boolean {
  const { array } = baseOf(declared);
  if (op === 'contains') return array;
  return !array;
}

function conditionIssues<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  at: number,
  fields: Readonly<Record<string, FieldType>> | undefined,
): readonly Found[] {
  const issues: Found[] = [];
  (definition.rules ?? []).forEach((rule, ruleAt) => {
    (rule.when ?? []).forEach((condition, whenAt) => {
      const path = `${pointer(at, 'rules')}/${String(ruleAt)}/when/${String(whenAt)}`;

      if (condition.op === 'before' || condition.op === 'after') {
        const value = condition.value;
        const epoch =
          typeof value === 'number' ? value : new Date(value).getTime();
        if (Number.isNaN(epoch)) {
          issues.push(
            found(
              'invalid-instant',
              new FeatureConfigError(
                `feature "${String(definition.key)}" compares now against ${JSON.stringify(value)}, which names no instant`,
              ),
              definition.key,
              `${path}/value`,
            ),
          );
        }
        return;
      }

      if (condition.op === 'day-of-week') return;
      if (!fields) return;

      const declared = Object.prototype.hasOwnProperty.call(
        fields,
        condition.field,
      )
        ? fields[condition.field]
        : undefined;

      if (declared === undefined) {
        issues.push(
          found(
            'unknown-context-field',
            new FeatureConfigError(
              `feature "${String(definition.key)}" reads the context field "${condition.field}", which the schema does not declare`,
            ),
            definition.key,
            `${path}/field`,
          ),
        );
        return;
      }

      if (!operatorFits(condition.op, declared)) {
        issues.push(
          found(
            'field-type-mismatch',
            new FeatureConfigError(
              `feature "${String(definition.key)}" applies "${condition.op}" to the context field "${condition.field}", which the schema declares ${declared}`,
            ),
            definition.key,
            `${path}/op`,
          ),
        );
      }
    });
  });
  return issues;
}
```

The field lookup goes through `hasOwnProperty`, for the reason `conditions.ts:80-83` and `variants.ts:196-200` already give: a bare index walks the prototype chain, so a field named `constructor` reads a function off `Object.prototype` and the check would pass a field nobody declared.

- [ ] **Step 7: Wire the envelope checks into `collectIssues`**

`collectIssues` gains the envelope passes in front of the graph pass, and the per-definition loop gains `conditionIssues`:

```ts
export function collectIssues(config: FeatureConfig): readonly Found[] {
  const all: Found[] = [
    ...memberIssues(config),
    ...digestIssues(config),
    ...schemaVersionIssues(config),
    ...schemaIssues(config),
  ];

  const definitions = config.features;
  const fields = config.schema?.context?.fields;

  all.push(...graphErrors(definitions).map(/* unchanged from Task 4 */));

  definitions.forEach((definition, at) => {
    // variantErrors and ruleIdErrors, unchanged from Task 4
    all.push(...conditionIssues(definition, at, fields));
  });

  return all;
}
```

`createFeatures` calls `collectIssues({ features: config })`, which carries no `schema`, so a literal is checked for its instants and for nothing schema-shaped. That is correct: a literal states no schema and owes none.

Add the case that proves an offsetless instant is accepted, which issue #284 is about:

```ts
it('accepts an offsetless instant, which parses and resolves per host', () => {
  const config: FeatureConfig = {
    features: [
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [{ field: 'now', op: 'after', value: '2026-10-01T00:00:00' }],
          },
        ],
      },
    ],
  };

  // ECMA-262 reads a date-time string with no offset as local time, so this
  // document decides differently in Stockholm and in Tokyo. Issue #284 owns
  // that. `invalid-instant` is about a string that parses to NaN, and this one
  // parses.
  expect(validateConfig(config)).toEqual({ ok: true });
});
```

- [ ] **Step 8: Pin the two names that reach a prototype**

Review Focus. Add to `validate.spec.ts`:

```ts
it('reports __proto__ in a document as an unknown member', () => {
  const config = JSON.parse(
    '{"features":[{"key":"a","enabled":true}],"__proto__":{"maxStale":1}}',
  ) as FeatureConfig;

  const result = validateConfig(config);

  expect(result.ok === false && result.issues[0]).toMatchObject({
    code: 'unknown-member',
    path: '/__proto__',
  });
});

it('refuses a condition over constructor when the schema declares no such field', () => {
  const config: FeatureConfig = {
    features: [
      {
        key: 'beta',
        enabled: true,
        rules: [{ when: [{ field: 'constructor', op: 'eq', value: 1 }] }],
      },
    ],
    schemaVersion: 's1',
    schema: { context: { fields: { plan: 'string' } } },
  };

  const result = validateConfig(config);

  expect(result.ok === false && result.issues[0]?.code).toBe(
    'unknown-context-field',
  );
});
```

`JSON.parse` writes `__proto__` as an own data property, so the first case is a document a foreign producer can really send. If `Object.keys` does not surface it on this runtime, report that and stop: the member walk needs `Reflect.ownKeys` and the plan wants a ruling before the check ships.

- [ ] **Step 9: Run everything and commit**

Run: `npx nx affected -t test lint build --base=main --skip-nx-cache`
Then: `npx prettier --check` on every file you touched.

```bash
git add libs/feature/src/lib/validate.ts libs/feature/src/lib/validate.spec.ts
git commit -m "feat(feature): refuse a document this holder cannot read whole"
```

---

### Task 6: `parseFeatureConfig`

**Files:**

- Create: `libs/feature/src/lib/parse.ts`
- Create: `libs/feature/src/lib/parse.spec.ts`
- Create: `libs/feature/src/lib/parse.test-d.ts`
- Modify: `libs/feature/src/index.ts`

**Interfaces:**

- Consumes: `validateConfig` and `collectIssues` from `./validate.js`; `createFeatures` and `Features` from `./features.js`; `FeatureConfig`, `ConfigIssue` from `./config.js`.
- Produces:

```ts
export function parseFeatureConfig<
  S extends Record<keyof S, VariantInfo | never> = Record<
    FeatureKey,
    VariantInfo | never
  >,
>(
  config: FeatureConfig<keyof S & FeatureKey>,
  options?: FeatureOptions<S>,
):
  | { ok: true; features: Features<S, boolean> }
  | { ok: false; issues: readonly ConfigIssue[] };
```

The spec sketches `parseFeatureConfig<F extends FeatureKey>(config: FeatureConfig<F>)`. `Features` is generic over a schema now, and a document that arrived as JSON carries no literal for `InferSchema` to read, so the caller names the schema: `parseFeatureConfig<MyFlags>(document)`. That is the same move the second `createFeatures` overload already documents.

The `options` parameter exists because a process that reloads is exactly the process that wants an observer, and a caller that could not pass one would have to build the store twice.

- [ ] **Step 1: Write the failing tests**

Create `libs/feature/src/lib/parse.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseFeatureConfig } from './parse.js';
import type { FeatureConfig } from './config.js';

describe('parseFeatureConfig', () => {
  it('builds a store from a document', () => {
    const config: FeatureConfig = {
      version: 41,
      features: [
        { key: 'checkout', enabled: true },
        { key: 'express', enabled: true, dependsOn: ['checkout'] },
      ],
    };

    const result = parseFeatureConfig(config);

    expect(result.ok && result.features.isEnabled('express')).toBe(true);
  });

  it('returns the issues and no store for a bad document', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true, dependsOn: ['b'] },
        { key: 'c', enabled: true, dependsOn: ['d'] },
      ],
    };

    const result = parseFeatureConfig(config);

    expect(
      result.ok === false && result.issues.map((each) => each.code),
    ).toEqual(['unknown-dependency', 'unknown-dependency']);
  });

  it('throws nothing for a document createFeatures would throw on', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    };

    expect(() => parseFeatureConfig(config)).not.toThrow();
  });

  it('installs an observer the caller supplies', () => {
    const seen: string[] = [];
    const config: FeatureConfig = { features: [{ key: 'a', enabled: true }] };

    const result = parseFeatureConfig(config, {
      observe: (event) => {
        seen.push(event.type);
      },
    });
    if (result.ok) result.features.resolve();

    expect(seen).toEqual(['resolve']);
  });
});
```

- [ ] **Step 2: Run and confirm they fail**

Run: `npx nx test feature -- parse`

- [ ] **Step 3: Write it**

Create `libs/feature/src/lib/parse.ts`:

```ts
import { createFeatures } from './features.js';
import { collectIssues } from './validate.js';
import type { Features } from './features.js';
import type { ConfigIssue, FeatureConfig } from './config.js';
import type { FeatureOptions } from './observe.js';
import type { FeatureKey, VariantInfo } from './types.js';

/**
 * Builds a store from a document. It reports, and it throws nothing.
 *
 * `createFeatures` keeps throwing, and the two entry points differ in who
 * supplied the configuration. A literal that fails validation is a programming
 * error the author reads in a stack trace at the line that wrote it. A row that
 * fails validation arrives on a poller inside a process that is serving
 * traffic, and a malformed row there reports and lets the previous document
 * keep deciding.
 *
 * `@evanion/acl` draws the line elsewhere and the divergence is deliberate.
 * `parseMatrix` at `libs/acl/src/parse-matrix.ts:43-49` throws, because an ACL
 * consumer fetches a contract at boot and a malformed contract is a deploy
 * failure the consumer wants loudly. This takes the name and refuses the throw.
 *
 * A document that arrived as JSON carries no literal, so the compiler infers no
 * variant names from it. A caller who wants the names names the schema:
 * `parseFeatureConfig<MyFlags>(document)`.
 */
export function parseFeatureConfig<
  S extends Record<keyof S, VariantInfo | never> = Record<
    FeatureKey,
    VariantInfo | never
  >,
>(
  config: FeatureConfig<keyof S & FeatureKey>,
  options?: FeatureOptions<S>,
):
  | { ok: true; features: Features<S, boolean> }
  | { ok: false; issues: readonly ConfigIssue[] } {
  const refused = collectIssues(config);
  if (refused.length > 0) {
    return { ok: false, issues: refused.map((each) => each.issue) };
  }

  // The checker just passed, so this call throws nothing. It is the same
  // construction path, which is what keeps one store shape in the package.
  const features = createFeatures<S>(
    config.features,
    (options ?? {}) as FeatureOptions<S>,
  );

  return { ok: true, features };
}
```

- [ ] **Step 4: Write the type test**

Create `libs/feature/src/lib/parse.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';
import { parseFeatureConfig } from './parse.js';
import type { FeatureConfig } from './config.js';

interface Flags {
  cta: { variant: 'control' | 'blue'; value: { label: string } };
  checkout: never;
}

describe('parseFeatureConfig', () => {
  it('narrows the store on ok', () => {
    const result = parseFeatureConfig<Flags>({ features: [] });

    if (result.ok) {
      expectTypeOf(result.features.variantOf('cta')).toEqualTypeOf<
        'control' | 'blue' | undefined
      >();
    }
  });

  it('carries the issues on the other arm', () => {
    const result = parseFeatureConfig<Flags>({ features: [] });

    if (!result.ok) {
      expectTypeOf(result.issues[0]?.code).toExtend<string | undefined>();
    }
  });

  it('refuses a document naming a feature the schema does not declare', () => {
    const document = {
      // @ts-expect-error -- 'nope' is not a key of Flags.
      features: [{ key: 'nope', enabled: true }],
    } as FeatureConfig<keyof Flags>;

    expectTypeOf(document).toBeObject();
  });
});
```

- [ ] **Step 5: Export it and run**

In `libs/feature/src/index.ts`, add `export { parseFeatureConfig } from './lib/parse.js';` and add `parseFeatureConfig` to the allowance array.

Run: `npx nx test feature -- parse`
Expected: PASS.

- [ ] **Step 6: Run everything and commit**

Run: `npx nx affected -t test lint build --base=main --skip-nx-cache`
Then: `npx prettier --check` on every file you touched.

```bash
git add libs/feature/src/lib/parse.ts libs/feature/src/lib/parse.spec.ts libs/feature/src/lib/parse.test-d.ts libs/feature/src/index.ts tools/repo-checks/src/doc-export-coverage-allowance.json
git commit -m "feat(feature): build a store from a document without a throw"
```

---

### Task 7: `features.reload` and `features.version`

**Files:**

- Modify: `libs/feature/src/lib/features.ts`
- Create: `libs/feature/src/lib/reload.spec.ts`
- Create: `libs/feature/src/lib/reload.test-d.ts`
- Modify: `libs/feature/src/lib/serialize.ts`

**Interfaces:**

- Consumes: `collectIssues` from `./validate.js`; `FeatureConfig`, `ConfigEnvelope`, `ReloadResult` from `./config.js`; `buildGraph` from `./graph.js`.
- Produces, on `Features<S, Frozen>`:

```ts
  /** The installed document's version, lifted for convenience. */
  readonly version: string | number | undefined;
  /** Validates a candidate and installs it, or keeps the current one and reports. */
  reload(config: FeatureConfig<keyof S & FeatureKey>): ReloadResult;
```

and, from `serialize.ts`, `serializeConfig(features)` with no second argument now writes the envelope the store was last reloaded from.

A store built by `createFeatures` from a bare array has installed no document, so its `version` is `undefined` and its envelope is empty. That is the literal path, and a literal states no version.

- [ ] **Step 1: Write the failing tests**

Create `libs/feature/src/lib/reload.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createFeatures } from './features.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';

const start: FeatureConfig = {
  version: 41,
  features: [
    { key: 'checkout', enabled: true },
    { key: 'express', enabled: true, dependsOn: ['checkout'] },
  ],
};

describe('reload', () => {
  it('installs a candidate and names what changed', () => {
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ]);

    const result = features.reload({
      version: 42,
      features: [
        { key: 'checkout', enabled: false },
        { key: 'express', enabled: true, dependsOn: ['checkout'] },
      ],
    });

    expect(result).toEqual({
      ok: true,
      version: 42,
      previousVersion: undefined,
      changed: ['checkout'],
    });
  });

  it('decides from the installed document afterwards', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    features.reload({ features: [{ key: 'checkout', enabled: false }] });

    expect(features.isEnabled('checkout')).toBe(false);
  });

  it('lifts the installed version', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    features.reload({
      version: 'flags@41',
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(features.version).toBe('flags@41');
  });

  it('keeps the installed document when a candidate is refused', () => {
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ]);
    const before = features.config;

    const result = features.reload({
      version: 42,
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
        { key: 'b', enabled: true, dependsOn: ['nowhere'] },
        { key: 'c', enabled: true, dependsOn: ['d'] },
        { key: 'd', enabled: true, dependsOn: ['c'] },
      ],
    });

    expect(result).toEqual({
      ok: false,
      version: undefined,
      rejected: 42,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate-feature' }),
      ]),
    });
    expect(features.config).toBe(before);
    expect(features.isEnabled('express')).toBe(true);
  });

  it('reports four issues for a candidate carrying four', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    const result = features.reload({
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
        { key: 'b', enabled: true, dependsOn: ['nowhere'] },
        { key: 'c', enabled: true, dependsOn: ['d'] },
        { key: 'd', enabled: true, dependsOn: ['c'] },
        { key: 'e', enabled: true, variants: [{ name: 'only', weight: -1 }] },
      ],
    });

    expect(result.ok === false && result.issues).toHaveLength(4);
  });

  it('refuses an unknown member and keeps deciding', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    const result = features.reload({
      features: [{ key: 'checkout', enabled: false }],
      hashVersion: 2,
    } as unknown as FeatureConfig);

    expect(result.ok === false && result.issues[0]?.code).toBe(
      'unknown-member',
    );
    expect(features.isEnabled('checkout')).toBe(true);
  });

  it('discards a local toggle the incoming document does not carry', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);
    features.toggle('checkout', false);

    features.reload({ features: [{ key: 'checkout', enabled: true }] });

    // The store's truth is the configuration source. A toggle is a local write
    // against it, and a merge would make the store answer from two authorities
    // with no record of which one decided.
    expect(features.isEnabled('checkout')).toBe(true);
  });

  it('names no key whose resolved answer moved because now moved', () => {
    const rules = [
      {
        when: [
          {
            field: 'now',
            op: 'before' as const,
            value: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    ];
    const features = createFeatures([{ key: 'sale', enabled: true, rules }]);

    const result = features.reload({
      features: [{ key: 'sale', enabled: true, rules }],
    });

    // The window expired and nothing about the feature changed, so `changed`
    // is empty. It diffs stored intent and never diffs a resolved value.
    expect(result.ok && result.changed).toEqual([]);
  });

  it('carries the installed envelope into a serialization', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    features.reload({
      ...start,
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(serializeConfig(features).version).toBe(41);
  });
});
```

- [ ] **Step 2: Run and confirm they fail**

Run: `npx nx test feature -- reload`

- [ ] **Step 3: Make the store's references swappable**

In `libs/feature/src/lib/features.ts`, inside the implementation body, change four bindings and add one:

```ts
let config: readonly FeatureDefinition<FeatureKey>[] = Object.freeze(
  definitions.map((definition) => deepFreeze(structuredClone(definition))),
);
const refused = collectIssues({ features: config });
if (refused[0]) throw refused[0].error;
let graph = buildGraph(config);
let index = new Map<FeatureKey, number>(config.map((d, i) => [d.key, i]));
let keys: readonly FeatureKey[] = Object.freeze(
  config.map((definition) => definition.key),
);
/** The envelope the store last installed. A literal installs none. */
let installed: ConfigEnvelope = {};
```

The returned object then reads all four through accessors, because a value captured at construction would keep naming the first document after a reload:

```ts
    get keys() {
      return keys;
    },
    get version() {
      return installed.version;
    },
    dependants: (key) => graph.dependants(key),
```

`definitionOf` already reads `index` and `config` through the closure, so it needs no change. `resolveAll`, `plan` and `toggle` read `graph.order` and `config` the same way.

- [ ] **Step 4: Write the intent diff**

Add to `features.ts`, beside `deepFreeze`:

```ts
/**
 * Whether two stored definitions state the same intent.
 *
 * `canonical` would answer this in one line and recurses without a guard, and a
 * variant value that holds itself reaches this walk, because `structuredClone`
 * carries a cycle through. The pair map is what terminates: an object the walk
 * has already entered is equal exactly when its counterpart is the object it
 * was paired with.
 *
 * `undefined` properties are skipped, so an absent key and a key written as
 * `undefined` state one intent, which is the rule `canonical.ts:21-22` states
 * for the same reason.
 */
function sameIntent(
  a: unknown,
  b: unknown,
  seen = new Map<object, unknown>(),
): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const paired = seen.get(a);
  if (paired !== undefined) return paired === b;
  seen.set(a, b);

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const own = (value: object): string[] =>
    Object.keys(value).filter(
      (key) => (value as Record<string, unknown>)[key] !== undefined,
    );
  const left = own(a);
  const right = own(b);
  if (left.length !== right.length) return false;

  return left.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      sameIntent(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        seen,
      ),
  );
}

/**
 * The keys whose stored intent differs between two documents, in the order the
 * candidate declares them, with a key the candidate drops reported after them.
 *
 * It diffs intent. It never diffs a resolved value. Decision 5 of
 * `docs/specs/2026-09-11-feature-toggles.md` says the store holds intent and
 * resolution is computed on read and never written back, so a reload replaces
 * intent and computes nothing. A feature whose window expired between two
 * documents appears here only when the document changed.
 */
function changedKeys(
  before: readonly FeatureDefinition<FeatureKey>[],
  after: readonly FeatureDefinition<FeatureKey>[],
): readonly FeatureKey[] {
  const previous = new Map(
    before.map((definition) => [definition.key, definition]),
  );
  const changed: FeatureKey[] = [];

  for (const definition of after) {
    const held = previous.get(definition.key);
    if (held === undefined || !sameIntent(held, definition)) {
      changed.push(definition.key);
    }
    previous.delete(definition.key);
  }

  for (const key of previous.keys()) changed.push(key);

  return changed;
}
```

- [ ] **Step 5: Write `reload`**

Add inside the implementation body, beside `toggle`:

```ts
/**
 * Validates a candidate whole and installs it, or keeps the current document
 * and reports why.
 *
 * The order is what makes it atomic. It checks the candidate, clones and
 * deep-freezes every definition the way construction does, builds the
 * candidate graph, and only then assigns the references the store reads. A
 * candidate that fails at any step leaves every reference where it was, and
 * the failure path touches no state at all.
 *
 * `resolve` reads the store once at the top of its call and walks
 * `graph.order` from there, so a swap during a `resolve` is invisible to it:
 * the running call holds the previous frozen array. A reload therefore never
 * produces a decision computed half from one document and half from another.
 */
const reload = (candidate: FeatureConfig<FeatureKey>): ReloadResult => {
  const refused = collectIssues(candidate);
  if (refused[0]) {
    return {
      ok: false,
      version: installed.version,
      rejected: candidate.version,
      issues: refused.map((each) => each.issue),
    };
  }

  const nextConfig = Object.freeze(
    candidate.features.map((definition) =>
      deepFreeze(structuredClone(definition) as FeatureDefinition<FeatureKey>),
    ),
  );
  const nextGraph = buildGraph(nextConfig);
  const nextIndex = new Map<FeatureKey, number>(
    nextConfig.map((definition, at) => [definition.key, at]),
  );
  const nextKeys = Object.freeze(
    nextConfig.map((definition) => definition.key),
  );
  const changed = changedKeys(config, nextConfig);
  const previousVersion = installed.version;

  const envelope: Record<string, unknown> = { ...candidate };
  delete envelope['features'];

  config = nextConfig;
  graph = nextGraph;
  index = nextIndex;
  keys = nextKeys;
  installed = envelope as ConfigEnvelope;

  return {
    ok: true,
    version: candidate.version,
    previousVersion,
    changed,
  };
};
```

Add `reload` to the returned object and to the `Features` interface, with the docblock the interface needs. Add to `toggle`'s docblock in the `Features` interface:

```
   * A reload discards this write. The store's truth is the configuration
   * source, and a toggle is a local write against it. An operator who wants a
   * durable toggle writes the row and lets the poller bring it back.
```

- [ ] **Step 6: Pin the empty candidate**

Review Focus. Add to `reload.spec.ts`:

```ts
it('installs an empty document and names every key it dropped', () => {
  const features = createFeatures([
    { key: 'checkout', enabled: true },
    { key: 'express', enabled: true, dependsOn: ['checkout'] },
  ]);

  const result = features.reload({ features: [] });

  expect(result.ok && result.changed).toEqual(['checkout', 'express']);
  expect(features.keys).toEqual([]);
  expect(features.resolve()).toEqual({});
});
```

- [ ] **Step 7: Pin the candidate that is already installed**

Review Focus. Add to `reload.spec.ts`:

```ts
it('installs the document it already holds and names nothing', () => {
  const features = createFeatures([{ key: 'checkout', enabled: true }]);
  features.reload({
    version: 41,
    features: [{ key: 'checkout', enabled: true }],
  });

  const result = features.reload({
    version: 41,
    features: [{ key: 'checkout', enabled: true }],
  });

  expect(result).toEqual({
    ok: true,
    version: 41,
    previousVersion: 41,
    changed: [],
  });
});
```

- [ ] **Step 8: Pin the numeric key**

Review Focus. Add to `reload.spec.ts`:

```ts
it('keys a reload on a number the way the store keys on one', () => {
  const features = createFeatures([
    { key: 1, enabled: true },
    { key: 2, enabled: true, dependsOn: [1] },
  ]);

  const result = features.reload({
    features: [
      { key: 1, enabled: false },
      { key: 2, enabled: true, dependsOn: [1] },
    ],
  });

  // `FeatureKey` is `string | number` and a JSON object key is a string, so a
  // diff that went through `Object.keys` would report `'1'` and a caller
  // comparing it with `1` would find nothing.
  expect(result.ok && result.changed).toEqual([1]);
  expect(features.isEnabled(2)).toBe(false);
});
```

- [ ] **Step 9: Pin the value that holds itself**

Review Focus. Add to `reload.spec.ts`:

```ts
it('diffs a variant value that holds itself without looping', () => {
  const value: Record<string, unknown> = { label: 'Buy' };
  value['self'] = value;
  const features = createFeatures([
    { key: 'cta', enabled: true, variants: [{ name: 'a', weight: 1, value }] },
  ]);

  const other: Record<string, unknown> = { label: 'Get it' };
  other['self'] = other;
  const result = features.reload({
    features: [
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'a', weight: 1, value: other }],
      },
    ],
  });

  expect(result.ok && result.changed).toEqual(['cta']);
});
```

- [ ] **Step 10: Pin the reload that interleaves with a resolve**

Add to `reload.spec.ts`:

```ts
it('gives a resolve started before it a decision set entirely from one document', () => {
  // `stickyVariants` is read once per feature inside the walk, so a getter on
  // it runs mid-resolve. That is the synchronous hook this case needs.
  const features = createFeatures([
    { key: 'parent', enabled: true },
    { key: 'child', enabled: true, dependsOn: ['parent'] },
  ]);

  let swapped = false;
  const decisions = features.resolve({
    targetingKey: 'u1',
    get stickyVariants() {
      if (!swapped) {
        swapped = true;
        features.reload({
          features: [
            { key: 'parent', enabled: false },
            { key: 'child', enabled: true, dependsOn: ['parent'] },
          ],
        });
      }
      return undefined;
    },
  });

  expect(decisions).toMatchObject({
    parent: { enabled: true },
    child: { enabled: true },
  });
});
```

If `stickyVariants` turns out not to be read on this path, find the read that is (`context[by]` in `assignVariant`, or a `when` condition's field) and use that getter. Do not add a hook to the engine for the test.

- [ ] **Step 11: Write the type test**

Create `libs/feature/src/lib/reload.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';

const defs = [{ key: 'cta', enabled: true }] as const;

describe('reload', () => {
  it('returns a discriminated result', () => {
    const features = createFeatures(defs);
    const result = features.reload({
      features: [{ key: 'cta', enabled: true }],
    });

    if (result.ok) {
      expectTypeOf(result.changed).toExtend<readonly (string | number)[]>();
    } else {
      expectTypeOf(result.rejected).toEqualTypeOf<
        string | number | undefined
      >();
    }
  });

  it('lifts the version as an opaque value', () => {
    const features = createFeatures(defs);

    expectTypeOf(features.version).toEqualTypeOf<string | number | undefined>();
  });

  it('refuses a candidate naming a key the store does not declare', () => {
    const features = createFeatures(defs);

    features.reload({
      // @ts-expect-error -- 'nope' is not a key this store declares.
      features: [{ key: 'nope', enabled: true }],
    });
  });
});
```

- [ ] **Step 12: Default the serializer's envelope**

In `libs/feature/src/lib/serialize.ts`, change the second parameter's default from `{}` to the store's own installed envelope. `Features` exposes `version` and no envelope, so add a second lifted member is the wrong move. Read it off the store through one new internal member on the returned object, declared on `Features` as:

```ts
  /** The envelope the store last installed, without its payload. */
  readonly envelope: ConfigEnvelope;
```

and make `serializeConfig`'s signature `envelope: ConfigEnvelope = features.envelope`. Export `ConfigEnvelope` from the index, which Task 1 already did, and add `envelope` to the allowance array.

Run: `npx nx test feature -- reload serialize`
Expected: PASS, including the case from Step 1 that asserts `serializeConfig(features).version` is 41.

- [ ] **Step 13: Run everything and commit**

Run: `npx nx affected -t test lint build --base=main --skip-nx-cache`
Then: `npx prettier --check` on every file you touched.

```bash
git add libs/feature/src/lib/features.ts libs/feature/src/lib/reload.spec.ts libs/feature/src/lib/reload.test-d.ts libs/feature/src/lib/serialize.ts libs/feature/src/index.ts tools/repo-checks/src/doc-export-coverage-allowance.json
git commit -m "feat(feature): swap a whole document or keep the one installed"
```

---

### Task 8: `createFeatures` takes a document

**Files:**

- Modify: `libs/feature/src/lib/features.ts`
- Modify: `libs/feature/src/lib/features.test-d.ts`
- Modify: `libs/feature/src/lib/features.spec.ts`

**Interfaces:**

- Consumes: `FeatureConfig` from `./config.js`.
- Produces: `createFeatures` accepting `FeatureConfig<K>` wherever it accepts `readonly FeatureDefinition<K>[]`, with the same return type.

§ 1 says a process that starts from a document its poller already fetched should not unwrap it by hand. The docblock at `features.ts` states that the signature list stops at three, because TypeScript elaborates every candidate for a failed call while a list holds three or fewer and reports one candidate against the argument nodes once it holds more, which put the error for a misspelled option on the definitions array. A fourth overload would undo that, so the document goes into the existing parameter types as a union.

- [ ] **Step 1: Probe the inference before writing anything**

Write a throwaway `.ts` file at the repository root, importing the real `createFeatures`, and compile it with:

```
./node_modules/.bin/tsc --ignoreConfig --noEmit --strict --target es2022 --module esnext --moduleResolution bundler <file>
```

Assert with a strict type-equality helper and not with error text, because tsc's printer widens a literal union in this position:

```ts
type Exact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
const ok = <T extends true>(_: T) => {};
```

Check six calls against a `definitions` array declared `as const`:

1. `createFeatures(defs)` still infers the variant union off the literal.
2. `createFeatures({ features: defs } as const)` infers the same union.
3. `createFeatures(defs, { observe: () => {} })` still answers the frozen form.
4. `createFeatures<MyFlags>(defs)` still selects the explicit overload.
5. `createFeatures<MyFlags>({ features: defs })` selects the same overload.
6. A misspelled option still reports its error on the option and not on the first argument.

Report the compiler output for all six. If the union parameter costs case 1 or case 6, stop and report it. The alternative the plan then wants a ruling on is leaving `createFeatures` alone and telling a document holder to call `parseFeatureConfig`, which Task 6 already ships and which loses nothing but a throw.

- [ ] **Step 2: Write the failing type test**

Add to `libs/feature/src/lib/features.test-d.ts`:

```ts
describe('createFeatures over a document', () => {
  it('infers the variant union off a document holding a literal', () => {
    const features = createFeatures({
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 50 },
            { name: 'blue', weight: 50 },
          ],
        },
      ],
    } as const);

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });
});
```

- [ ] **Step 3: Widen the parameters**

Introduce one alias in `features.ts` and use it in all three signatures and in the implementation:

```ts
/**
 * What `createFeatures` accepts: a bare array, or the document an envelope
 * carries.
 *
 * A literal has no version, no schema and no freshness claim, and an author
 * writing four flags in a file owes none of them. A process whose poller
 * already fetched a document hands that document over without unwrapping it.
 */
export type DefinitionsOrConfig<K extends FeatureKey = FeatureKey> =
  readonly FeatureDefinition<K>[] | FeatureConfig<K>;
```

The implementation reads one line at the top:

```ts
const supplied: readonly FeatureDefinition<FeatureKey>[] = Array.isArray(given)
  ? given
  : given.features;
```

and the envelope initialiser becomes the document's own members when one arrived, so a store built from a document answers `version` immediately.

- [ ] **Step 4: Prove the runtime half**

Add to `libs/feature/src/lib/features.spec.ts`:

```ts
it('builds a store from a document and lifts its version', () => {
  const features = createFeatures({
    version: 41,
    features: [{ key: 'checkout', enabled: true }],
  });

  expect(features.version).toBe(41);
});

it('throws the first issue of a document the way it throws an array one', () => {
  expect(() =>
    createFeatures({
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    }),
  ).toThrow(DuplicateFeatureError);
});

it('refuses a document carrying a member it cannot read', () => {
  expect(() =>
    createFeatures({
      features: [{ key: 'a', enabled: true }],
      hashVersion: 2,
    } as unknown as FeatureConfig),
  ).toThrow(/hashVersion/);
});
```

- [ ] **Step 5: Run everything and commit**

Run: `npx nx affected -t test lint build --base=main --skip-nx-cache`
Then: `npx prettier --check` on every file you touched.

```bash
git add libs/feature/src/lib/features.ts libs/feature/src/lib/features.spec.ts libs/feature/src/lib/features.test-d.ts libs/feature/src/index.ts
git commit -m "feat(feature): build a store straight from a document"
```

---

### Task 9: `maxStale` is inert, the round trip closes, and the fixture ships

**Files:**

- Create: `libs/feature/src/lib/round-trip.spec.ts`
- Create: `libs/feature/conformance/config-decisions.json`
- Create: `libs/feature/src/lib/conformance.spec.ts`
- Modify: `libs/feature/package.json`

**Interfaces:**

- Consumes: `serializeConfig`, `configDigest`, `parseFeatureConfig`, `validateConfig`, `createFeatures`.
- Produces: `libs/feature/conformance/config-decisions.json`, the published cross-process fixture.

- [ ] **Step 1: Prove `maxStale` is inert**

Create `libs/feature/src/lib/round-trip.spec.ts` and open it with:

```ts
import { describe, expect, it } from 'vitest';
import { configDigest } from './digest.js';
import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';

const body: readonly FeatureConfig['features'][number][] = [
  { key: 'checkout', enabled: true },
  {
    key: 'cta',
    enabled: true,
    dependsOn: ['checkout'],
    variants: [
      { name: 'control', weight: 50, order: 0, value: { label: 'Buy' } },
      { name: 'blue', weight: 50, order: 1, value: { label: 'Get it' } },
    ],
  },
];

describe('maxStale', () => {
  it('decides nothing, whatever the clock says', () => {
    const bounded = createFeatures({ maxStale: 1, features: body });
    const unbounded = createFeatures({ features: body });
    const context = {
      targetingKey: 'u1',
      now: new Date('2099-01-01T00:00:00.000Z'),
    };

    expect(bounded.resolve(context)).toEqual(unbounded.resolve(context));
  });

  it('changes no plan and no toggle', () => {
    const bounded = createFeatures({ maxStale: 1, features: body });
    const unbounded = createFeatures({ features: body });
    const context = { now: new Date('2099-01-01T00:00:00.000Z') };

    expect(bounded.plan(context)).toEqual(unbounded.plan(context));
    expect(bounded.toggle('checkout', false, context)).toEqual(
      unbounded.toggle('checkout', false, context),
    );
  });

  it('carries into a serialization and out again', () => {
    const features = createFeatures({ maxStale: 60_000, features: body });

    expect(serializeConfig(features).maxStale).toBe(60_000);
  });
});
```

- [ ] **Step 2: Close the round trip**

Add to `round-trip.spec.ts`:

```ts
describe('the round trip', () => {
  it('produces the document it started from', () => {
    const features = createFeatures({ version: 41, features: body });
    const document = serializeConfig(features);

    const arrived = JSON.parse(JSON.stringify(document)) as FeatureConfig;
    const result = parseFeatureConfig(arrived);

    expect(result.ok && serializeConfig(result.features)).toEqual(document);
  });

  it('holds the digest across the hop', () => {
    const features = createFeatures({ version: 41, features: body });
    const document = serializeConfig(features);

    const arrived = JSON.parse(JSON.stringify(document)) as FeatureConfig;

    expect(configDigest(arrived)).toBe(configDigest(document));
  });

  it('replaces a Date with its ISO string and digests the same either way', () => {
    const withDate = [
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [
              {
                field: 'now',
                op: 'after' as const,
                value: new Date('2026-10-01T00:00:00.000Z'),
              },
            ],
          },
        ],
      },
    ];
    const features = createFeatures(withDate);
    const document = serializeConfig(features);

    const arrived = JSON.parse(JSON.stringify(document)) as FeatureConfig;

    expect(configDigest(arrived)).toBe(configDigest(document));
  });

  it('assigns identically after a permutation that keeps every order', () => {
    const features = createFeatures({ features: body });
    const document = serializeConfig(features);
    const permuted: FeatureConfig = {
      ...document,
      features: document.features.map((definition) =>
        definition.variants
          ? { ...definition, variants: [...definition.variants].reverse() }
          : definition,
      ),
    };

    const result = parseFeatureConfig(permuted);
    const subjects = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'];

    expect(
      result.ok &&
        subjects.map((targetingKey) =>
          result.features.variantOf('cta', { targetingKey }),
        ),
    ).toEqual(
      subjects.map((targetingKey) =>
        features.variantOf('cta', { targetingKey }),
      ),
    );
  });

  it('names the same rule after a permutation of the rules array', () => {
    const rules = [
      {
        id: 'staff',
        when: [{ field: 'staff', op: 'eq' as const, value: true }],
      },
      { id: 'beta', when: [{ field: 'beta', op: 'eq' as const, value: true }] },
    ];
    const features = createFeatures([{ key: 'x', enabled: true, rules }]);
    const permuted = createFeatures([
      { key: 'x', enabled: true, rules: [...rules].reverse() },
    ]);
    const context = { staff: true, beta: true };

    expect(permuted.resolve(context).x.rule).toBe(
      features.resolve(context).x.rule,
    );
  });

  it('refuses a document whose rules moved and whose digest did not', () => {
    const rules = [
      {
        id: 'staff',
        when: [{ field: 'staff', op: 'eq' as const, value: true }],
      },
      { id: 'beta', when: [{ field: 'beta', op: 'eq' as const, value: true }] },
    ];
    const one: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules }],
    };
    const tampered: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules: [...rules].reverse() }],
      digest: configDigest(one),
    };

    const result = parseFeatureConfig(tampered);

    expect(result.ok === false && result.issues[0]?.code).toBe(
      'digest-mismatch',
    );
  });
});
```

- [ ] **Step 3: Write the cross-process fixture**

Create `libs/feature/conformance/config-decisions.json`. It holds one serialized document, one context, and the expected `Decisions` map, so an implementation in another language proves it agrees:

```json
{
  "note": "One document, one context, and the decisions any implementation must produce. See docs/specs/2026-09-23-feature-config-distribution.md § 9.",
  "config": {
    "version": 1,
    "digest": "<fill from configDigest>",
    "features": []
  },
  "context": {
    "targetingKey": "u-4711",
    "now": "2026-06-01T12:00:00.000Z",
    "plan": "pro"
  },
  "decisions": {}
}
```

Fill `config` with a document that reaches every mechanism a second implementation has to get right: a dependency edge, a feature that resolves off through the cascade, an attribute rule, a window rule with an instant carrying an explicit offset, a rollout, and a two-variant split with explicit `order` values. Fill `digest` with `configDigest` of the document, and `decisions` with what `createFeatures(config).resolve(context)` answers.

Every instant in the fixture carries an explicit offset. Issue #284 records that ECMA-262 reads an offsetless date-time string as local time, so a fixture carrying one would decide differently on a host in Stockholm and a host in Tokyo, and a second implementation would fail a test the reference passes by accident.

- [ ] **Step 4: Hold the fixture to the engine**

Create `libs/feature/src/lib/conformance.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configDigest } from './digest.js';
import { createFeatures } from './features.js';
import type { FeatureConfig } from './config.js';

interface Fixture {
  config: FeatureConfig;
  context: { now: string; [field: string]: unknown };
  decisions: Record<string, unknown>;
}

const fixture = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../conformance/config-decisions.json'),
    'utf8',
  ),
) as Fixture;

describe('the published cross-process fixture', () => {
  it('states the digest of the document it carries', () => {
    expect(fixture.config.digest).toBe(configDigest(fixture.config));
  });

  it('produces the decisions it publishes', () => {
    const features = createFeatures(fixture.config);
    const { now, ...rest } = fixture.context;

    const decisions = features.resolve({ ...rest, now: new Date(now) });

    expect(JSON.parse(JSON.stringify(decisions))).toEqual(fixture.decisions);
  });

  it('carries an explicit offset on every instant it states', () => {
    const text = JSON.stringify(fixture);

    // ECMA-262 reads a date-time string with no offset as local time, so an
    // offsetless instant here would decide differently per host. Issue #284.
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T[\d:.]+"/);
  });
});
```

- [ ] **Step 5: Publish the fixture**

In `libs/feature/package.json`, add `"conformance"` to the `files` array, after `"dist"`. A consumer writing a Swift or Kotlin implementation reads it out of the published tarball, which is where the variants spec's `bucketOf` vectors will also land.

- [ ] **Step 6: Run everything and commit**

Run: `npx nx affected -t test lint build --base=main --skip-nx-cache`
Then: `npx prettier --check` on every file you touched.

```bash
git add libs/feature/src/lib/round-trip.spec.ts libs/feature/src/lib/conformance.spec.ts libs/feature/conformance libs/feature/package.json
git commit -m "test(feature): publish one document, one context and the decisions"
```

---

### Task 10: The React entry re-exports the types and changes no runtime

**Files:**

- Modify: `libs/feature/src/react/index.tsx`
- Modify: `libs/feature/src/react/types.test-d.tsx`

**Interfaces:**

- Consumes: every type `config.ts` declares.
- Produces: the same names on `@evanion/feature/react`, as types only.

The spec's header says `@evanion/feature/react` re-exports the types and changes no runtime. A React application that holds a store and reloads it from a poller writes its handler in a component file, and that file should import one specifier.

- [ ] **Step 1: Write the failing type test**

Add to `libs/feature/src/react/types.test-d.tsx`:

```tsx
import type { FeatureConfig, ReloadResult } from './index.js';

describe('the react entry', () => {
  it('re-exports the document types', () => {
    const read = (result: ReloadResult) => result.version;
    const document: FeatureConfig = { features: [] };

    expectTypeOf(read).toBeCallableWith({
      ok: true,
      version: 1,
      previousVersion: undefined,
      changed: [],
    });
    expectTypeOf(document.features).toBeArray();
  });
});
```

- [ ] **Step 2: Re-export**

In `libs/feature/src/react/index.tsx`, add one `export type` block beside the existing imports, naming the same 17 types Task 1 added to the core index. No value is re-exported: `serializeConfig`, `configDigest`, `validateConfig` and `parseFeatureConfig` stay on the core entry, because a component that calls one of them is holding configuration in a render tree and should reach for the core.

- [ ] **Step 3: Check the adapter-parity guard**

Run: `npx nx test repo-checks -- react-pair adapter-parity`

`tools/repo-checks/src/react-pair.test.ts` holds the two entries to each other. Read what it requires before assuming a type-only re-export satisfies it, and report what it says if it asks for more.

- [ ] **Step 4: Run everything and commit**

Run: `npx nx affected -t test lint build --base=main --skip-nx-cache`
Then: `npx prettier --check` on every file you touched.

```bash
git add libs/feature/src/react/index.tsx libs/feature/src/react/types.test-d.tsx
git commit -m "feat(feature): re-export the document types from the react entry"
```

---

### Task 11: The adapter boundary, held by a test

**Files:**

- Create: `libs/feature/src/lib/core-boundary.spec.ts`
- Modify: `libs/feature/package.json` (no change expected; the test asserts what is there)

**Interfaces:**

- Consumes: nothing from the library's own source.
- Produces: a failing build for a core that grows a dependency, a driver import, a socket or a timer.

Decisions 13, 14 and 15 are architectural and this task is what keeps them true. Decision 13 says every adapter that reads configuration from a database, an HTTP endpoint or a disk cache lives in `@evanion/feature-source`, and the core imports no driver, opens no socket and starts no timer. Decision 14 says local evaluation is the default. Decision 15 says no endpoint answers which variant a subject gets, which is a rule about what this repository does not add.

This plan creates no `libs/feature-source`. The spec designs no adapter interface, its own closing section records that one poller serving every adapter is a guess and that no push source has been written, and a new directory under `libs/` is a released package that `docs-navigation.test.ts`, `commitlint-scope-enum.test.ts`, `coverage-config.test.ts`, `typecheck-config.test.ts` and `security-register.test.ts` all have opinions about. Step 4 opens the issue that owns it.

- [ ] **Step 1: Write the failing test**

Create `libs/feature/src/lib/core-boundary.spec.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

/** Every source file the package publishes, test files excluded. */
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.(spec|test|test-d)\./.test(entry.name)) return [];
    return [path];
  });
}

describe('the core', () => {
  it('declares no runtime dependency', () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, '../package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    // A browser bundle of this package must not contain a Postgres driver, and
    // a React Native bundle must not contain a Node `http` import. Every
    // adapter that reads configuration from somewhere lives in a sibling
    // package. § 9.
    expect(manifest.dependencies).toBeUndefined();
  });

  it('imports no module outside itself', () => {
    const foreign = sources(ROOT)
      .filter((path) => !path.includes(`${join('src', 'react')}`))
      .flatMap((path) =>
        [...readFileSync(path, 'utf8').matchAll(/from\s+'([^']+)'/g)].map(
          (match) => ({ path, specifier: match[1] as string }),
        ),
      )
      .filter((each) => !each.specifier.startsWith('.'));

    expect(foreign).toEqual([]);
  });

  it('starts no timer and opens no socket', () => {
    const offences = sources(ROOT).flatMap((path) => {
      const text = readFileSync(path, 'utf8');
      return [
        /setInterval/,
        /setTimeout/,
        /\bfetch\(/,
        /XMLHttpRequest/,
        /WebSocket/,
      ]
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${path}: ${String(pattern)}`);
    });

    // The core holds no clock authority and performs no fetch. The party that
    // fetches is the party that acts on `maxStale`, and it lives in
    // `@evanion/feature-source`. § 1, § 9.
    expect(offences).toEqual([]);
  });
});
```

The second case allows `react` in `src/react`, which is a peer dependency and not a runtime one. If the exclusion by path turns out to be wrong for this tree, narrow it to allowing the exact specifier `react` in that directory.

- [ ] **Step 2: Run it**

Run: `npx nx test feature -- core-boundary`
Expected: PASS on the first run. This test locks a property the package already has, and its value is that it fails the day somebody adds `pg` to reach a row.

- [ ] **Step 3: State the boundary where a reader meets it**

Add to the `FeatureConfig.maxStale` docblock in `config.ts`, if it is not already there from Task 1, and to `libs/feature/README.md` under the heading Task 12 adds: the core evaluates the document it is handed, the party that fetches holds the clock, and no endpoint answers which variant a subject gets.

- [ ] **Step 4: Open the follow-up issue**

```bash
gh issue create \
  --title "feat(feature-source): poll a configuration source and reload a store" \
  --label enhancement \
  --body "Decision 13 of \`docs/specs/2026-09-23-feature-config-distribution.md\` puts every adapter that reads configuration from a database, an HTTP endpoint or a disk cache in a sibling package \`@evanion/feature-source\`. The core now has the entry points that adapter needs: \`parseFeatureConfig\`, \`features.reload\`, \`serializeConfig\` and \`configDigest\`.

Three things the spec leaves open and this issue owns:

- The adapter interface. § 9 sketches \`postgresSource({ pool, table }).start({ interval })\` and nothing more.
- A push source. The spec's closing section records that a source pushing over a websocket has no poll interval and fits the poller shape awkwardly, and that none has been written.
- What the binding does with the envelope's advisory \`maxStale\`.

A new directory under \`libs/\` is a released package, so it also needs an entry in \`commitlint.config.js\`'s scope enum, an entry in \`apps/docs/app/navigation.ts\`, a documentation section, and the coverage and typecheck configuration every library carries."
```

- [ ] **Step 5: Commit**

```bash
git add libs/feature/src/lib/core-boundary.spec.ts
git commit -m "test(feature): hold the core to no driver, no socket and no timer"
```

---

### Task 12: The documentation

**Files:**

- Create: `apps/docs/content/feature/distribution.mdx`
- Modify: `apps/docs/content/feature/_meta.ts`
- Modify: `apps/docs/content/feature/api.mdx`
- Modify: `libs/feature/README.md`
- Modify: `tools/repo-checks/src/doc-export-coverage-allowance.json`

**Interfaces:**

- Consumes: every export this plan added.
- Produces: a page a reader follows, and an allowance file back at the entries it had before Task 1.

Read `apps/docs/content/feature/observing.mdx` for the shape a page takes here, and the doctested regions in `libs/feature/README.md` for how a printed value stays true. Read `docs/specs/2026-09-25-documentation-standard.md` § 7, § 8 and § 9 for the shape rules `doc-shape.test.ts`, `doc-exports.test.ts` and `doc-fence.test.ts` enforce.

- [ ] **Step 1: Write the page**

`distribution.mdx` covers, in this order: what a document is and the six members it carries; how a process installs one, with `parseFeatureConfig` and with `createFeatures`; what a reload does and what it refuses; why a reload discards a local toggle; `version` and `digest`, and why a consumer compares and never orders; the schema, its two vocabularies and its fence; and the section that matters most, where the adapter lives and what no endpoint answers.

Two paragraphs a reader most easily misreads, and both need to be plain. `maxStale` travels and this library never reads it, and the reader's own poller is what acts on it. A refused document leaves the previous one deciding, which is the availability cost § 3 accepts on purpose.

- [ ] **Step 2: Doctest every value the page prints**

Any document, issue list or `ReloadResult` a page prints comes from a run and sits in an `@import.meta.vitest` region in `libs/feature/README.md`, the way the variants values do. A page value outside a region drifts silently, and `doc-fence.test.ts` ratchets the count of unexplained fences per section, so a plain fence carrying a computed value fails the build.

- [ ] **Step 3: List the page**

In `apps/docs/content/feature/_meta.ts`, add `distribution: 'Distribution'` after `observing`. A reader meets it once they know what a decision is, how one is planned and how one is observed. Extend the file's doc comment to say why it sits there, matching the reasoning already written for the other entries.

- [ ] **Step 4: Write the reference entries**

`api.mdx` gains one `##` or `###` heading per new export, which is the bar `doc-export-coverage.test.ts` sets, and a running example for each of the four callables. The new headings:

- `serializeConfig(features, envelope?)`
- `configDigest(config)`
- `validateConfig(config)`
- `parseFeatureConfig(config, options?)`
- `FeatureConfig<F>` and `ConfigEnvelope`
- `SerializedInstant`, `SerializedCondition`, `SerializedRule` and `SerializedDefinition<F>`
- `FeatureSchema`, `ContextSchema`, `FeatureShape`, `ValueShape`, `BaseFieldType` and `FieldType`
- `ConfigIssue`, `ConfigIssueCode` and `ValidationResult`
- `ReloadResult`
- `DefinitionsOrConfig<K>`

The `Features<S>` entry gains `reload`, `version` and `envelope`, and the `createFeatures` entry gains the document parameter.

- [ ] **Step 5: Empty the allowance**

Remove every name Tasks 1 through 8 added to `"undocumented"` for `"@evanion/feature"` in `tools/repo-checks/src/doc-export-coverage-allowance.json`. The file must end this task holding exactly the entries it held before Task 1.

Run: `npx nx test repo-checks`
Expected: PASS. `doc-export-coverage` fails on a name with no heading, `doc-exports` fails on a fence importing a name the package does not export, `docs-navigation` fails on a `_meta.ts` key with no page behind it, and `doc-shape` fails on a lede over 40 words.

- [ ] **Step 6: Run everything and commit**

Run: `npx nx affected -t test lint build --base=main --skip-nx-cache`
Then: `npx prettier --check` on every file you touched.

```bash
git add apps/docs/content/feature libs/feature/README.md tools/repo-checks/src/doc-export-coverage-allowance.json
git commit -m "docs(feature): document how a configuration reaches a process"
```

---

## What this plan does not build

- `libs/feature-source`, and every adapter in it. Task 11, Step 4 opens the issue.
- A code generator that emits TypeScript, Swift or Kotlin from a `FeatureSchema`. § 4 recommends quicktype and openapi-generator and this repository runs neither. The fence exists so that a generator's output is readable, and nothing here proves it is.
- A run-time check of a variant value against its declared `ValueShape`. § 5 calls it the only run-time consumer of a schema and calls it optional. `validateConfig` fences the shape and validates no value against it.
- Hydration, which `docs/specs/2026-09-23-feature-hydration.md` owns, and issue #280 tracks.
