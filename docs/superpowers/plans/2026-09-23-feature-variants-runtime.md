# Feature Variants, Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A feature resolves to one of several named variants, so calling code renders one of 2+ versions and an application runs an A/B test on the difference.

**Architecture:** One new module, `libs/feature/src/lib/variants.ts`, holding variant validation and variant assignment. Assignment reuses `bucketOf` from `bucketing.ts` with a seed distinct from the rollout's. `evaluate.ts` calls it at the two points where a feature resolves on. `types.ts` grows the configuration fields and the decision fields. Nothing else moves.

**Tech Stack:** TypeScript 6.0.3, Vitest, Nx. Tests are `*.spec.ts` beside the source.

**Spec:** `docs/specs/2026-09-23-feature-variants.md`. Read its "Assignment", "Sticky assignment", "Precedence" and "Result" sections before starting; they carry the argument this plan implements.

**Scope:** This plan implements runtime behaviour with `variant?: string` and `value?: unknown`.

Two of the spec's decisions are deliberately outside it. Decision 8, which replaces `Features<F extends FeatureKey>` with `Features<S>` over a schema and gives `createFeatures` two overloads, is a generics rewrite touching every signature in the package and is its own plan; the package is unpublished, so the intermediate loose typing costs nobody a migration. Decision 12, the outcome-fixture suite that makes `bucketOf` and everything downstream a cross-language contract, is also its own plan: its value is proving that a second implementation agrees, the unit tests in this plan already guard the behaviour for this one, and a fixture format published before any consumer exists is a format nobody reads. That deferral is a debt, not a dismissal. The spec calls the obligation permanent and it is what makes local evaluation across platforms safe, so it lands before any non-JavaScript SDK does.

## Global Constraints

- The package is unpublished (`private: true`, 404 on npm). Any existing signature may change.
- Assignment reuses `bucketOf(value, seed)` from `libs/feature/src/lib/bucketing.ts`. Do not write a second hash.
- The variant seed defaults to `${definition.seed ?? String(definition.key)}:variant`, distinct from the rollout seed. This is the correctness point of the whole feature: one seed for both puts every member of a 20% rollout in the lowest 20% of the variant space, so a 50/50 split hands all of them the control.
- Weights are relative and normalised. They need not sum to 100.
- Assignment walks variants in ascending `order`, which defaults to the array index. The array's own sequence binds nothing once explicit `order` values are present.
- A bucket landing exactly on a band boundary falls in the upper band.
- The variant first in the bucketing order is the control.
- A feature that resolves off carries no variant.
- `stickyVariants` on the context wins over the weights and loses to a rule pin. A name the feature does not declare falls through to the weights.
- Everything but `enabled` on a `Decision` is output only. `libs/feature/src/lib/reason-is-output-only.spec.ts` holds that and gains cases.
- Tests are `*.spec.ts` beside the source. `libs/acl` uses `*.test.ts`; do not copy that.
- Prose in any doc comment or `.mdx`: no em-dashes, no "X rather than Y", no "instead of", no bold lead-ins, every sentence names who or what does the thing. `npx nx test repo-checks` enforces part of this across 262 tests.
- Documented values come from a run, never from reading the implementation.

## Review Focus

- A feature declaring `variants` whose rules all fail resolves off and must carry no `variant`, no `value` and no `assignment`. A control leaking onto an off decision makes the kill switch unreadable. Pinned in Task 4, Step 9.
- Weights that do not sum to 100, including `[1, 1, 1]` and `[30, 20]`, must normalise rather than strand a subject with no variant. PostHog has a test asserting its own version strands them. Pinned in Task 2, Step 7.
- A context whose `variantBy` field holds a value that is neither a string nor a number takes the control with `source: 'fallback'`, the same way `evaluateRule` treats a rollout with no bucketing value. Pinned in Task 3, Step 5.
- A `stickyVariants` entry naming a variant the feature no longer declares falls through to the weights. Throwing would take down a render over stale session data, and honouring it would serve a variant that does not exist. GrowthBook re-buckets here; Statsig serves the stale payload. Pinned in Task 3, Step 9.
- Adding a variant at the end and taking its weight from the previously-last one must move subjects only between those two bands. This is the locality property the `order` field exists to give, and nothing else in the suite would catch its loss. Pinned in Task 2, Step 11.

---

### Task 1: The configuration shape and its validation

**Files:**

- Modify: `libs/feature/src/lib/types.ts` (add `VariantSpec`; extend `FeatureDefinition`, `Rule`, `EvaluationContext`)
- Modify: `libs/feature/src/lib/errors.ts` (two new classes)
- Create: `libs/feature/src/lib/variants.ts` (validation only in this task)
- Create: `libs/feature/src/lib/variants.spec.ts`
- Modify: `libs/feature/src/lib/features.ts` (call the validator from `createFeatures`)
- Modify: `libs/feature/src/index.ts` (export the two errors)

**Interfaces:**

- Consumes: `FeatureConfigError` from `errors.ts`.
- Produces: `VariantSpec`, `DuplicateVariantError`, `UnknownVariantError`, and `validateVariants<F extends FeatureKey>(definition: FeatureDefinition<F>): void`, which throws or returns.

Read `libs/feature/src/lib/errors.ts` and `libs/feature/src/lib/graph.ts` first. `buildGraph` is where `createFeatures` already validates configuration and throws, and `validateVariants` joins it there for the same reason: a variant set with two names or an unresolvable weight has no sensible evaluation result.

- [ ] **Step 1: Write the failing test**

Create `libs/feature/src/lib/variants.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DuplicateVariantError,
  FeatureConfigError,
  UnknownVariantError,
} from './errors.js';
import { validateVariants } from './variants.js';

describe('validateVariants', () => {
  it('accepts a feature declaring no variants', () => {
    expect(() => validateVariants({ key: 'k', enabled: true })).not.toThrow();
  });

  it('accepts a single variant, which is how a value flag is written', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'only', weight: 1, value: { label: 'Buy' } }],
      }),
    ).not.toThrow();
  });

  it('refuses two variants sharing a name', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 1 },
          { name: 'a', weight: 1 },
        ],
      }),
    ).toThrow(DuplicateVariantError);
  });

  it('refuses a rule pinning a variant the feature does not declare', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: 1 }],
        rules: [{ variant: 'b' }],
      }),
    ).toThrow(UnknownVariantError);
  });

  it('refuses a negative weight', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: -1 }],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a weight that is not finite', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: Number.NaN }],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a variant set whose weights are all zero', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 0 },
          { name: 'b', weight: 0 },
        ],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses an empty variant array', () => {
    expect(() =>
      validateVariants({ key: 'k', enabled: true, variants: [] }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses two variants sharing an order', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 1, order: 0 },
          { name: 'b', weight: 1, order: 0 },
        ],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses an order that is not a non-negative integer', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: 1, order: 1.5 }],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a partial order declaration, which mixes two orderings', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 1, order: 0 },
          { name: 'b', weight: 1 },
        ],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('names the feature and the variant in a duplicate-name message', () => {
    expect(() =>
      validateVariants({
        key: 'checkout',
        enabled: true,
        variants: [
          { name: 'blue', weight: 1 },
          { name: 'blue', weight: 1 },
        ],
      }),
    ).toThrow(/checkout.*blue|blue.*checkout/);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx nx test feature -- variants`
Expected: FAIL, "Cannot find module './variants.js'".

- [ ] **Step 3: Add the types**

In `libs/feature/src/lib/types.ts`, add above `FeatureDefinition`:

```ts
/**
 * One variant of a feature.
 *
 * `weight` is relative. Weights are normalised across the set, so they need not
 * sum to 100, and an author raising one lowers every other share.
 *
 * `order` fixes where this variant sits in the bucketing walk. The array index
 * supplies it when an author leaves it out, and a control plane writes it
 * explicitly so a serializer that reorders the array assigns identically.
 */
export interface VariantSpec {
  name: string;
  weight: number;
  order?: number;
  value?: unknown;
}
```

In the same file, add to `FeatureDefinition`, after `seed`:

```ts
  /** The variants this feature splits across. One is legal: that is a value flag. */
  variants?: readonly VariantSpec[];
  /** The context field variant assignment buckets on. Defaults to `targetingKey`. */
  variantBy?: string;
  /**
   * The variant bucketing seed. Defaults to `${seed ?? key}:variant`.
   *
   * The default is distinct from the rollout's seed on purpose. One seed for
   * both puts every member of a 20% rollout in the lowest 20% of the variant
   * space, so a 50/50 split hands all of them the control and the experiment
   * measures nothing.
   */
  variantSeed?: string;
```

Add to `Rule`, after `rollout`:

```ts
  /**
   * Pins the variant when this rule matches, overriding the weights and any
   * assignment the context carries. Names a variant the feature declares.
   */
  variant?: string;
```

Add to `EvaluationContext`, after `targetingKey`:

```ts
  /**
   * Prior assignments, keyed by feature. Checked after a rule pin and before
   * the weights.
   *
   * Reweighting a running experiment moves every subject above a changed band
   * boundary. An application that must hold a subject still stores the
   * assignment wherever it keeps session state and hands it back here. This
   * library writes no storage and reads this only.
   */
  stickyVariants?: Readonly<Record<string, string>>;
```

- [ ] **Step 4: Add the two errors**

In `libs/feature/src/lib/errors.ts`, following the shape of `DuplicateFeatureError`:

```ts
/** Two variants of one feature share a name, so a pin names both. */
export class DuplicateVariantError extends FeatureConfigError {
  constructor(
    readonly feature: string,
    readonly variant: string,
  ) {
    super(`feature "${feature}" declares the variant "${variant}" twice`);
    this.name = 'DuplicateVariantError';
  }
}

/** A rule pins a variant its feature does not declare. */
export class UnknownVariantError extends FeatureConfigError {
  constructor(
    readonly feature: string,
    readonly variant: string,
  ) {
    super(
      `feature "${feature}" has a rule pinning "${variant}", which it does not declare`,
    );
    this.name = 'UnknownVariantError';
  }
}
```

Read the existing `DuplicateFeatureError` first and match how it assigns `name` and stores its fields. If it does something different, follow it rather than this block.

- [ ] **Step 5: Write the validator**

Create `libs/feature/src/lib/variants.ts`:

```ts
import {
  DuplicateVariantError,
  FeatureConfigError,
  UnknownVariantError,
} from './errors.js';
import type { FeatureDefinition, FeatureKey } from './types.js';

/**
 * Checks a feature's variants at construction, where the dependency graph is
 * already checked.
 *
 * Every case below is a configuration error with no sensible evaluation result.
 * A set with two names cannot answer which one a pin meant, a set whose weights
 * are all zero has no band to assign into, and a partial `order` declaration
 * mixes two orderings and reads as a typo either way.
 *
 * @throws {DuplicateVariantError} when two variants share a name.
 * @throws {UnknownVariantError} when a rule pins a variant nobody declared.
 * @throws {FeatureConfigError} for an unusable weight, an unusable order, or an
 * empty set.
 */
export function validateVariants<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
): void {
  const key = String(definition.key);
  const variants = definition.variants;
  if (!variants) return;

  if (variants.length === 0) {
    throw new FeatureConfigError(
      `feature "${key}" declares an empty variants array, which leaves no variant to assign`,
    );
  }

  const names = new Set<string>();
  const orders = new Set<number>();
  let declaredOrders = 0;
  let total = 0;

  for (const variant of variants) {
    if (names.has(variant.name)) {
      throw new DuplicateVariantError(key, variant.name);
    }
    names.add(variant.name);

    if (!Number.isFinite(variant.weight) || variant.weight < 0) {
      throw new FeatureConfigError(
        `feature "${key}" gives the variant "${variant.name}" the weight ${String(variant.weight)}, which is not a usable share`,
      );
    }
    total += variant.weight;

    if (variant.order !== undefined) {
      declaredOrders += 1;
      if (!Number.isInteger(variant.order) || variant.order < 0) {
        throw new FeatureConfigError(
          `feature "${key}" gives the variant "${variant.name}" the order ${String(variant.order)}, which is not a non-negative integer`,
        );
      }
      if (orders.has(variant.order)) {
        throw new FeatureConfigError(
          `feature "${key}" gives two variants the order ${String(variant.order)}, which leaves the walk between them undefined`,
        );
      }
      orders.add(variant.order);
    }
  }

  if (total <= 0) {
    throw new FeatureConfigError(
      `feature "${key}" gives every variant the weight zero, which leaves no variant to assign`,
    );
  }

  if (declaredOrders > 0 && declaredOrders !== variants.length) {
    throw new FeatureConfigError(
      `feature "${key}" declares an order on ${String(declaredOrders)} of its ${String(variants.length)} variants, which mixes two orderings`,
    );
  }

  for (const rule of definition.rules ?? []) {
    if (rule.variant !== undefined && !names.has(rule.variant)) {
      throw new UnknownVariantError(key, rule.variant);
    }
  }
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx nx test feature -- variants`
Expected: PASS, 12 tests.

- [ ] **Step 7: Call the validator from `createFeatures`**

Read `libs/feature/src/lib/features.ts` around the `buildGraph(config)` call. Add the import:

```ts
import { validateVariants } from './variants.js';
```

and, immediately before `const graph = buildGraph(config);`, add:

```ts
for (const definition of config) validateVariants(definition);
```

The graph check runs after, so a cycle and a bad variant set in one configuration report the variant first. Either order is defensible; this one keeps the cheaper check first.

- [ ] **Step 8: Write the failing test for construction**

Append to `libs/feature/src/lib/features.spec.ts`, inside the existing top-level `describe`:

```ts
it('refuses a configuration whose variants share a name', () => {
  expect(() =>
    createFeatures([
      {
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 1 },
          { name: 'a', weight: 1 },
        ],
      },
    ]),
  ).toThrow(DuplicateVariantError);
});
```

Add `DuplicateVariantError` to that file's import from `./errors.js`, matching how the existing error imports are written there.

- [ ] **Step 9: Run the package suite**

Run: `npx nx test feature`
Expected: PASS, every file.

- [ ] **Step 10: Export the errors**

In `libs/feature/src/index.ts`, add `DuplicateVariantError` and `UnknownVariantError` to the existing error export block, keeping its alphabetical order. Add `VariantSpec` to the type export block, also in order.

- [ ] **Step 11: Run the repository checks**

Run: `npx nx test repo-checks`
Expected: PASS. A failure from `doc-export-coverage` names the new exports as undocumented. Two error classes join `tools/repo-checks/src/doc-export-coverage-allowance.json` the way the four existing error classes are handled there; read that file and follow what it already does for `DuplicateFeatureError`.

- [ ] **Step 12: Commit**

```bash
git add libs/feature/src/lib/types.ts libs/feature/src/lib/errors.ts \
  libs/feature/src/lib/variants.ts libs/feature/src/lib/variants.spec.ts \
  libs/feature/src/lib/features.ts libs/feature/src/lib/features.spec.ts \
  libs/feature/src/index.ts tools/repo-checks/src/doc-export-coverage-allowance.json
git commit -m "feat(feature): declare the variants a feature splits across"
```

---

### Task 2: The bucketing order and the weighted split

**Files:**

- Modify: `libs/feature/src/lib/variants.ts`
- Test: `libs/feature/src/lib/variants.spec.ts`

**Interfaces:**

- Consumes: `bucketOf(value: string, seed: string): number` from `bucketing.ts`, `validateVariants` from Task 1.
- Produces: `bucketingOrder(variants: readonly VariantSpec[]): readonly VariantSpec[]` and `assignWeighted(variants: readonly VariantSpec[], bucket: number): VariantSpec`, plus `variantSeedOf<F extends FeatureKey>(definition: FeatureDefinition<F>): string`.

Read `libs/feature/src/lib/bucketing.ts` fully, including its doc comment on the three properties a rollout bucket has. Two of them carry over here and one does not: a bucket is stable and decorrelated across features, and it is NOT monotonic in a weight, because weights are band boundaries and moving one reassigns every subject above it.

- [ ] **Step 1: Write the failing test for the order**

Append to `libs/feature/src/lib/variants.spec.ts`:

```ts
describe('bucketingOrder', () => {
  it('walks the array order when no variant declares one', () => {
    const order = bucketingOrder([
      { name: 'control', weight: 1 },
      { name: 'blue', weight: 1 },
    ]);
    expect(order.map((each) => each.name)).toEqual(['control', 'blue']);
  });

  it('walks ascending order when every variant declares one', () => {
    const order = bucketingOrder([
      { name: 'blue', weight: 1, order: 1 },
      { name: 'control', weight: 1, order: 0 },
    ]);
    expect(order.map((each) => each.name)).toEqual(['control', 'blue']);
  });

  it('walks a permuted array identically once order is declared', () => {
    const a = bucketingOrder([
      { name: 'control', weight: 1, order: 0 },
      { name: 'blue', weight: 1, order: 1 },
    ]);
    const b = bucketingOrder([
      { name: 'blue', weight: 1, order: 1 },
      { name: 'control', weight: 1, order: 0 },
    ]);
    expect(a.map((each) => each.name)).toEqual(b.map((each) => each.name));
  });

  it('leaves the caller's array untouched', () => {
    const variants = [
      { name: 'blue', weight: 1, order: 1 },
      { name: 'control', weight: 1, order: 0 },
    ];
    bucketingOrder(variants);
    expect(variants.map((each) => each.name)).toEqual(['blue', 'control']);
  });
});
```

Add `bucketingOrder` to the file's import from `./variants.js`.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx nx test feature -- variants`
Expected: FAIL, `bucketingOrder is not a function`.

- [ ] **Step 3: Write `bucketingOrder`**

Add to `libs/feature/src/lib/variants.ts`:

```ts
/**
 * The variants in the order assignment walks them.
 *
 * `order` decides the walk and the array index supplies it when an author left
 * it out, so a document whose array a serializer permuted assigns identically
 * once a control plane has written an explicit order. `validateVariants`
 * refuses a partial declaration, so either every variant carries one or none
 * does.
 *
 * The returned array is a copy. A caller's configuration is frozen and this
 * function sorts.
 */
export function bucketingOrder(
  variants: readonly VariantSpec[],
): readonly VariantSpec[] {
  return [...variants]
    .map((variant, index) => ({ variant, at: variant.order ?? index }))
    .sort((a, b) => a.at - b.at)
    .map((each) => each.variant);
}
```

Add `VariantSpec` to the file's type import.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx nx test feature -- variants`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the split**

Append to `libs/feature/src/lib/variants.spec.ts`:

```ts
describe('assignWeighted', () => {
  const evenPair = [
    { name: 'control', weight: 50 },
    { name: 'blue', weight: 50 },
  ];

  it('gives the lower band to a low bucket', () => {
    expect(assignWeighted(evenPair, 0).name).toBe('control');
    expect(assignWeighted(evenPair, 0.49).name).toBe('control');
  });

  it('gives the upper band to a high bucket', () => {
    expect(assignWeighted(evenPair, 0.51).name).toBe('blue');
    expect(assignWeighted(evenPair, 0.999).name).toBe('blue');
  });

  it('gives a bucket landing on a boundary to the upper band', () => {
    expect(assignWeighted(evenPair, 0.5).name).toBe('blue');
  });

  it('gives everything to a single variant', () => {
    const only = [{ name: 'only', weight: 7 }];
    expect(assignWeighted(only, 0).name).toBe('only');
    expect(assignWeighted(only, 0.999).name).toBe('only');
  });

  it('never assigns a variant weighted zero', () => {
    const withZero = [
      { name: 'off', weight: 0 },
      { name: 'on', weight: 1 },
    ];
    for (const bucket of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(assignWeighted(withZero, bucket).name).toBe('on');
    }
  });
});
```

Add `assignWeighted` to the file's import.

- [ ] **Step 6: Run the tests and confirm they fail**

Run: `npx nx test feature -- variants`
Expected: FAIL, `assignWeighted is not a function`.

- [ ] **Step 7: Write the failing test for normalisation**

Append to the `assignWeighted` describe block:

```ts
it('normalises weights that do not sum to 100', () => {
  const thirds = [
    { name: 'a', weight: 1 },
    { name: 'b', weight: 1 },
    { name: 'c', weight: 1 },
  ];
  expect(assignWeighted(thirds, 0.0).name).toBe('a');
  expect(assignWeighted(thirds, 0.5).name).toBe('b');
  expect(assignWeighted(thirds, 0.9).name).toBe('c');
});

it('assigns every bucket in [0, 1) to some variant', () => {
  const uneven = [
    { name: 'a', weight: 30 },
    { name: 'b', weight: 20 },
  ];
  for (let i = 0; i < 1000; i += 1) {
    const assigned = assignWeighted(uneven, i / 1000);
    expect(['a', 'b']).toContain(assigned.name);
  }
});
```

A subject stranded with no variant is the defect PostHog has a test asserting for its own implementation. This suite asserts the opposite.

- [ ] **Step 8: Run the tests and confirm they fail**

Run: `npx nx test feature -- variants`
Expected: FAIL.

- [ ] **Step 9: Write `assignWeighted`**

Add to `libs/feature/src/lib/variants.ts`:

```ts
/**
 * The variant a bucket falls to.
 *
 * Weights are normalised across the set and laid out as cumulative bands over
 * [0, 1) in bucketing order. A bucket landing exactly on a boundary falls in
 * the upper band, which is the same rule `inRollout` uses when it compares
 * strictly below its threshold.
 *
 * One property of rollout bucketing does not carry over. A rollout percentage
 * is monotonic, so raising it only admits more subjects and moves none out. A
 * weight is a band boundary, so moving one reassigns every subject above it.
 * Walking in `order` bounds the damage: an author appending a variant and
 * taking its weight from the previously-last one moves subjects only between
 * those two bands.
 *
 * `validateVariants` has already refused an empty set and a set weighted
 * entirely zero, so the final variant is always reachable and the loop always
 * returns.
 */
export function assignWeighted(
  variants: readonly VariantSpec[],
  bucket: number,
): VariantSpec {
  const ordered = bucketingOrder(variants);
  const total = ordered.reduce((sum, each) => sum + each.weight, 0);

  let ceiling = 0;
  for (const variant of ordered) {
    ceiling += variant.weight / total;
    // Strictly below, so a variant weighted zero widens no band and a bucket
    // on a boundary belongs to the band above it.
    if (bucket < ceiling) return variant;
  }

  // Floating point can leave the final ceiling a hair under 1. The last band
  // owns whatever is left.
  return ordered[ordered.length - 1] as VariantSpec;
}
```

- [ ] **Step 10: Run the tests and confirm they pass**

Run: `npx nx test feature -- variants`
Expected: PASS.

- [ ] **Step 11: Write the failing test for locality**

Append to the `assignWeighted` describe block:

```ts
it('moves subjects only between the last two bands when a variant is appended', () => {
  const before = [
    { name: 'a', weight: 50 },
    { name: 'b', weight: 50 },
  ];
  const after = [
    { name: 'a', weight: 50 },
    { name: 'b', weight: 30 },
    { name: 'c', weight: 20 },
  ];

  for (let i = 0; i < 1000; i += 1) {
    const bucket = i / 1000;
    const was = assignWeighted(before, bucket).name;
    const now = assignWeighted(after, bucket).name;
    if (was === 'a') expect(now).toBe('a');
    else expect(['b', 'c']).toContain(now);
  }
});
```

This is the locality property `order` exists to give, and nothing else in the suite would catch its loss.

- [ ] **Step 12: Run the tests and confirm they pass**

Run: `npx nx test feature -- variants`
Expected: PASS. The implementation already has this property; the test pins it.

- [ ] **Step 13: Write the failing test for the seed**

Append to `libs/feature/src/lib/variants.spec.ts`:

```ts
describe('variantSeedOf', () => {
  it('defaults to the key with a variant suffix', () => {
    expect(variantSeedOf({ key: 'cta', enabled: true })).toBe('cta:variant');
  });

  it('builds on the feature seed when one is given', () => {
    expect(variantSeedOf({ key: 'cta', enabled: true, seed: 'autumn' })).toBe(
      'autumn:variant',
    );
  });

  it('takes an explicit variantSeed unchanged', () => {
    expect(
      variantSeedOf({ key: 'cta', enabled: true, variantSeed: 'fixed' }),
    ).toBe('fixed');
  });

  it('separates the variant bucket from the rollout bucket', () => {
    // The correctness point of this feature. One seed for both would put every
    // member of a 20% rollout in the lowest 20% of the variant space.
    const definition = { key: 'cta', enabled: true };
    const rolloutSeed = String(definition.key);
    expect(variantSeedOf(definition)).not.toBe(rolloutSeed);
  });
});
```

Add `variantSeedOf` to the file's import.

- [ ] **Step 14: Write `variantSeedOf`**

Add to `libs/feature/src/lib/variants.ts`:

```ts
/**
 * The seed a feature's variant assignment buckets on.
 *
 * The default appends to whatever the rollout seeds on, so the two buckets are
 * independent. Hashing the same pair for both puts every member of a 20%
 * rollout in the lowest 20% of the variant space, so a 50/50 split hands all of
 * them the control and the experiment measures nothing. Unleash seeds a rollout
 * with 0 and a variant with 86028157, and PostHog salts one with `""` and the
 * other with `"variant"`, for this reason.
 */
export function variantSeedOf<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
): string {
  if (definition.variantSeed !== undefined) return definition.variantSeed;
  return `${definition.seed ?? String(definition.key)}:variant`;
}
```

- [ ] **Step 15: Write the decorrelation test**

Append to `libs/feature/src/lib/bucketing.spec.ts`, inside its existing top-level `describe`:

```ts
it('splits a rollout cohort across variants near the declared weights', () => {
  // The regression guard for seed separation. Sharing one seed puts every
  // member of a 20% rollout in the lowest 20% of the variant space, so a
  // 50/50 split would hand all of them the control.
  const key = 'cta';
  const inRolloutKeys: string[] = [];
  for (let i = 0; i < 20000; i += 1) {
    const subject = `user-${String(i)}`;
    if (inRollout(subject, 20, key)) inRolloutKeys.push(subject);
  }

  expect(inRolloutKeys.length).toBeGreaterThan(3000);

  let lower = 0;
  for (const subject of inRolloutKeys) {
    if (bucketOf(subject, `${key}:variant`) < 0.5) lower += 1;
  }

  const share = lower / inRolloutKeys.length;
  expect(share).toBeGreaterThan(0.45);
  expect(share).toBeLessThan(0.55);
});
```

- [ ] **Step 16: Run the package suite**

Run: `npx nx test feature`
Expected: PASS, every file.

- [ ] **Step 17: Commit**

```bash
git add libs/feature/src/lib/variants.ts libs/feature/src/lib/variants.spec.ts \
  libs/feature/src/lib/bucketing.spec.ts
git commit -m "feat(feature): split a feature's subjects across its variants"
```

---

### Task 3: Sticky assignment and the control fallback

**Files:**

- Modify: `libs/feature/src/lib/variants.ts`
- Test: `libs/feature/src/lib/variants.spec.ts`

**Interfaces:**

- Consumes: `bucketingOrder`, `assignWeighted`, `variantSeedOf` from Task 2; `bucketOf` from `bucketing.ts`; `DEFAULT_ROLLOUT_FIELD` from `evaluate.ts`.
- Produces:

```ts
export interface VariantAssignment {
  variant: VariantSpec;
  source: 'weighted' | 'sticky' | 'fallback';
  by: string;
  bucket?: number;
}

export function assignVariant<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  context: EvaluationContext,
): VariantAssignment | undefined;
```

It returns `undefined` for a feature declaring no variants. A rule pin produces `source: 'pinned'` and Task 4 builds that in `decide`, because only `decide` knows a rule matched.

`DEFAULT_ROLLOUT_FIELD` is exported from `evaluate.ts` and re-exported from the package entry. Importing it here creates no cycle, because `evaluate.ts` will import from `variants.ts` in Task 4 and `variants.ts` imports only that one constant back. If the linter refuses the cycle, move the constant into its own module and re-export it from both, rather than duplicating the string.

- [ ] **Step 1: Write the failing test for the weighted path**

Append to `libs/feature/src/lib/variants.spec.ts`:

```ts
describe('assignVariant', () => {
  const cta = {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  };

  it('returns nothing for a feature declaring no variants', () => {
    expect(
      assignVariant({ key: 'k', enabled: true }, { targetingKey: 'u' }),
    ).toBeUndefined();
  });

  it('buckets on targetingKey by default', () => {
    const assignment = assignVariant(cta, { targetingKey: 'user-1' });
    expect(assignment?.source).toBe('weighted');
    expect(assignment?.by).toBe('targetingKey');
    expect(assignment?.bucket).toBeGreaterThanOrEqual(0);
    expect(assignment?.bucket).toBeLessThan(1);
    expect(['control', 'blue']).toContain(assignment?.variant.name);
  });

  it('buckets on the field variantBy names', () => {
    const byAccount = { ...cta, variantBy: 'accountId' };
    const assignment = assignVariant(byAccount, { accountId: 'acct-9' });
    expect(assignment?.by).toBe('accountId');
    expect(assignment?.source).toBe('weighted');
  });

  it('gives one subject the same variant every time', () => {
    const first = assignVariant(cta, { targetingKey: 'user-1' });
    const second = assignVariant(cta, { targetingKey: 'user-1' });
    expect(second?.variant.name).toBe(first?.variant.name);
  });

  it('buckets a numeric key the same as its string spelling', () => {
    const asNumber = assignVariant(cta, { targetingKey: 42 as never });
    const asString = assignVariant(cta, { targetingKey: '42' });
    expect(asNumber?.variant.name).toBe(asString?.variant.name);
  });
});
```

Add `assignVariant` to the file's import.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx nx test feature -- variants`
Expected: FAIL, `assignVariant is not a function`.

- [ ] **Step 3: Write the failing test for the fallback**

Append to the `assignVariant` describe block:

```ts
it('gives the control to a context carrying no bucketing value', () => {
  const assignment = assignVariant(cta, {});
  expect(assignment?.variant.name).toBe('control');
  expect(assignment?.source).toBe('fallback');
  expect(assignment?.bucket).toBeUndefined();
});

it('gives the control when the bucketing field holds an object', () => {
  const assignment = assignVariant(cta, { targetingKey: {} as never });
  expect(assignment?.source).toBe('fallback');
});

it('reads the control as the first variant in the bucketing order', () => {
  const reordered = {
    ...cta,
    variants: [
      { name: 'blue', weight: 50, order: 1 },
      { name: 'control', weight: 50, order: 0 },
    ],
  };
  expect(assignVariant(reordered, {})?.variant.name).toBe('control');
});
```

The fallback direction matters. A control admits nobody to the experiment, which is what `evaluateRule` does when a rollout has no bucketing value: it does not match, so an incomplete context ramps nobody in.

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `npx nx test feature -- variants`
Expected: FAIL.

- [ ] **Step 5: Write the failing test for sticky**

Append to the `assignVariant` describe block:

```ts
it('takes a prior assignment the context carries', () => {
  const assignment = assignVariant(cta, {
    targetingKey: 'user-1',
    stickyVariants: { cta: 'blue' },
  });
  expect(assignment?.variant.name).toBe('blue');
  expect(assignment?.source).toBe('sticky');
});

it('holds a subject still across a reweighting', () => {
  const sticky = { targetingKey: 'user-1', stickyVariants: { cta: 'blue' } };
  const reweighted = {
    ...cta,
    variants: [
      { name: 'control', weight: 90 },
      { name: 'blue', weight: 10 },
    ],
  };
  expect(assignVariant(reweighted, sticky)?.variant.name).toBe('blue');
});

it('ignores a prior assignment for another feature', () => {
  const assignment = assignVariant(cta, {
    targetingKey: 'user-1',
    stickyVariants: { other: 'blue' },
  });
  expect(assignment?.source).toBe('weighted');
});

it('falls through to the weights for a variant no longer declared', () => {
  // A variant an operator removed must not pin a subject to something that
  // does not exist, and throwing would take down a render over stale session
  // data.
  const assignment = assignVariant(cta, {
    targetingKey: 'user-1',
    stickyVariants: { cta: 'retired' },
  });
  expect(assignment?.source).toBe('weighted');
  expect(['control', 'blue']).toContain(assignment?.variant.name);
});

it('takes a prior assignment even with no bucketing value', () => {
  const assignment = assignVariant(cta, { stickyVariants: { cta: 'blue' } });
  expect(assignment?.variant.name).toBe('blue');
  expect(assignment?.source).toBe('sticky');
});
```

- [ ] **Step 6: Run the tests and confirm they fail**

Run: `npx nx test feature -- variants`
Expected: FAIL.

- [ ] **Step 7: Write `assignVariant`**

Add to `libs/feature/src/lib/variants.ts`:

```ts
/** How a subject reached its variant. Output only. */
export interface VariantAssignment {
  variant: VariantSpec;
  source: 'weighted' | 'sticky' | 'fallback';
  by: string;
  /** Absent when the context carried no bucketing value. */
  bucket?: number;
}

/**
 * The variant a context gets, for a feature that resolved on.
 *
 * Three answers in order. A prior assignment the application stored wins, when
 * it names a variant this feature still declares. The weights answer next, for
 * a context carrying a usable bucketing value. The control answers last.
 *
 * The control is the honest answer for an incomplete context: the feature
 * resolved on, so calling code needs a variant to render, and the control
 * admits nobody to the experiment. `evaluateRule` refuses a rollout the same
 * way when the context carries no bucketing value, so neither ramps anybody in
 * on missing data.
 *
 * A pin from a matching rule beats all three, and `decide` applies it, because
 * only `decide` knows which rule matched.
 */
export function assignVariant<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  context: EvaluationContext,
): VariantAssignment | undefined {
  const variants = definition.variants;
  if (!variants || variants.length === 0) return undefined;

  const by = definition.variantBy ?? DEFAULT_ROLLOUT_FIELD;

  const stored = context.stickyVariants?.[String(definition.key)];
  if (stored !== undefined) {
    const held = variants.find((variant) => variant.name === stored);
    if (held) return { variant: held, source: 'sticky', by };
  }

  const value = context[by];
  if (typeof value !== 'string' && typeof value !== 'number') {
    const [control] = bucketingOrder(variants);
    return { variant: control as VariantSpec, source: 'fallback', by };
  }

  const bucket = bucketOf(String(value), variantSeedOf(definition));
  return {
    variant: assignWeighted(variants, bucket),
    source: 'weighted',
    by,
    bucket,
  };
}
```

Add the imports this needs at the top of the file:

```ts
import { bucketOf } from './bucketing.js';
import { DEFAULT_ROLLOUT_FIELD } from './evaluate.js';
import type { EvaluationContext } from './types.js';
```

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `npx nx test feature -- variants`
Expected: PASS.

- [ ] **Step 9: Run the package suite and check for an import cycle**

Run: `npx nx test feature && npx nx lint feature && npx nx build feature`
Expected: PASS. If the build or the linter reports a cycle between `evaluate.ts` and `variants.ts`, move `DEFAULT_ROLLOUT_FIELD` into a new `libs/feature/src/lib/fields.ts`, import it into both, and re-export it from `evaluate.ts` so the package entry's existing export keeps working. Do not duplicate the string literal.

- [ ] **Step 10: Commit**

```bash
git add libs/feature/src/lib/variants.ts libs/feature/src/lib/variants.spec.ts
git commit -m "feat(feature): hold a subject to a variant an application stored"
```

---

### Task 4: Wire assignment into the decision

**Files:**

- Modify: `libs/feature/src/lib/types.ts` (the `Decision` fields)
- Modify: `libs/feature/src/lib/evaluate.ts` (`decide`)
- Test: `libs/feature/src/lib/features.spec.ts`
- Test: `libs/feature/src/lib/reason-is-output-only.spec.ts`

**Interfaces:**

- Consumes: `assignVariant`, `VariantAssignment` from Task 3.
- Produces: `Decision.variant?: string`, `Decision.value?: unknown`, `Decision.assignment?: { source: 'weighted' | 'pinned' | 'sticky' | 'fallback'; by: string; bucket?: number; rule?: string }`.

Read `decide` in `libs/feature/src/lib/evaluate.ts` fully. It has four exits: `explicitly-off`, `dependency-off`, `default-on`, and `rule-match`, plus the `no-rule-matched` fall-through. A variant attaches to exactly two of them, `default-on` and `rule-match`, and to neither of the others.

- [ ] **Step 1: Write the failing test for `default-on`**

Append to `libs/feature/src/lib/features.spec.ts`, inside the existing top-level `describe`:

```ts
  it('assigns a variant to a feature that is on with no rules', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50, value: { label: 'Get it' } },
        ],
      },
    ]);

    const decision = features.resolve({ targetingKey: 'user-1' }).cta;

    expect(decision.enabled).toBe(true);
    expect(decision.reason).toBe('default-on');
    expect(['control', 'blue']).toContain(decision.variant);
    expect(decision.assignment?.source).toBe('weighted');
    expect(decision.assignment?.by).toBe('targetingKey');
  });

  it('carries the assigned variant's value', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'only', weight: 1, value: { label: 'Buy' } }],
      },
    ]);

    const decision = features.resolve({ targetingKey: 'user-1' }).cta;

    expect(decision.variant).toBe('only');
    expect(decision.value).toEqual({ label: 'Buy' });
  });

  it('carries no value for a variant declaring none', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'only', weight: 1 }],
      },
    ]);

    expect(features.resolve({ targetingKey: 'u' }).cta.value).toBeUndefined();
  });
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx nx test feature -- features`
Expected: FAIL, `decision.variant` is `undefined`.

- [ ] **Step 3: Add the `Decision` fields**

In `libs/feature/src/lib/types.ts`, add to `Decision`, after `cause`:

```ts
  /** The assigned variant, on a feature that resolved on and declares variants. */
  variant?: string;
  /** The assigned variant's configured value, when it declares one. */
  value?: unknown;
  /**
   * How the variant was chosen. Output only, like `reason`.
   *
   * `'pinned'` names the rule that pinned it. `'fallback'` means the context
   * carried no bucketing value and the subject took the control.
   */
  assignment?: {
    source: 'weighted' | 'pinned' | 'sticky' | 'fallback';
    by: string;
    /** Absent when the context did not carry the bucketing field. */
    bucket?: number;
    /** The pinning rule, on `'pinned'`. */
    rule?: string;
  };
```

Update the `Decision` doc comment's sentence listing the output-only fields so it names `variant`, `value` and `assignment` alongside `reason`, `rule`, `rules`, `blockedBy` and `cause`. Read it first and extend the existing list rather than rewriting the paragraph.

- [ ] **Step 4: Wire `default-on`**

In `libs/feature/src/lib/evaluate.ts`, add the import:

```ts
import { assignVariant } from './variants.js';
import type { VariantAssignment } from './variants.js';
```

Add this helper above `decide`:

```ts
/** Copies an assignment onto a decision. A feature with no variants adds nothing. */
function withVariant<F extends FeatureKey>(
  decision: Decision<F>,
  assigned: VariantAssignment | undefined,
  source: VariantAssignment['source'] | 'pinned' = assigned?.source ??
    'weighted',
  rule?: string,
): Decision<F> {
  if (!assigned) return decision;
  const assignment: Decision<F>['assignment'] = { source, by: assigned.by };
  if (assigned.bucket !== undefined && source !== 'pinned') {
    assignment.bucket = assigned.bucket;
  }
  if (rule !== undefined) assignment.rule = rule;

  const next: Decision<F> = {
    ...decision,
    variant: assigned.variant.name,
    assignment,
  };
  if (assigned.variant.value !== undefined) next.value = assigned.variant.value;
  return next;
}
```

Then change `decide`'s no-rules exit from:

```ts
const rules = definition.rules ?? [];
if (rules.length === 0) {
  return { key: definition.key, enabled: true, reason: 'default-on' };
}
```

to:

```ts
const rules = definition.rules ?? [];
if (rules.length === 0) {
  return withVariant(
    { key: definition.key, enabled: true, reason: 'default-on' },
    assignVariant(definition, context),
  );
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx nx test feature -- features`
Expected: PASS for the three tests from Step 1.

- [ ] **Step 6: Write the failing test for `rule-match` and the pin**

Append to `libs/feature/src/lib/features.spec.ts`:

```ts
it('assigns a variant when a rule matched without pinning one', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
      rules: [{ rollout: { percent: 100 } }],
    },
  ]);

  const decision = features.resolve({ targetingKey: 'user-1' }).cta;

  expect(decision.reason).toBe('rule-match');
  expect(decision.assignment?.source).toBe('weighted');
  expect(['control', 'blue']).toContain(decision.variant);
});

it('takes the variant a matching rule pins', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 99 },
        { name: 'blue', weight: 1 },
      ],
      rules: [
        {
          when: [{ field: 'group', op: 'eq', value: 'staff' }],
          variant: 'blue',
        },
        { rollout: { percent: 100 } },
      ],
    },
  ]);

  const decision = features.resolve({
    targetingKey: 'user-1',
    group: 'staff',
  }).cta;

  expect(decision.variant).toBe('blue');
  expect(decision.assignment?.source).toBe('pinned');
  expect(decision.assignment?.rule).toMatch(/^rule-[0-9a-f]{8}$/);
});

it('lets a pin beat a prior assignment the context carries', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
      rules: [
        {
          when: [{ field: 'group', op: 'eq', value: 'staff' }],
          variant: 'blue',
        },
      ],
    },
  ]);

  const decision = features.resolve({
    targetingKey: 'user-1',
    group: 'staff',
    stickyVariants: { cta: 'control' },
  }).cta;

  expect(decision.variant).toBe('blue');
  expect(decision.assignment?.source).toBe('pinned');
});
```

- [ ] **Step 7: Run the tests and confirm they fail**

Run: `npx nx test feature -- features`
Expected: FAIL.

- [ ] **Step 8: Wire `rule-match`**

In `decide`, change the matching-rule exit from:

```ts
if (outcome.matched) {
  return {
    key: definition.key,
    enabled: true,
    reason: 'rule-match',
    rule: outcome.rule,
  };
}
```

to:

```ts
if (outcome.matched) {
  const base: Decision<F> = {
    key: definition.key,
    enabled: true,
    reason: 'rule-match',
    rule: outcome.rule,
  };
  const assigned = assignVariant(definition, context);
  if (!assigned) return base;

  const pinned = rule.variant;
  if (pinned !== undefined) {
    const held = definition.variants?.find((each) => each.name === pinned);
    // `validateVariants` refused a pin naming an undeclared variant at
    // construction, so `held` is present for any configuration that built.
    if (held) {
      return withVariant(
        base,
        { ...assigned, variant: held },
        'pinned',
        outcome.rule,
      );
    }
  }

  return withVariant(base, assigned);
}
```

- [ ] **Step 9: Write the failing test for the off paths**

Append to `libs/feature/src/lib/features.spec.ts`:

```ts
it('carries no variant on any of the three off paths', () => {
  const variants = [
    { name: 'control', weight: 50 },
    { name: 'blue', weight: 50 },
  ];
  const features = createFeatures([
    { key: 'parent', enabled: false },
    { key: 'child', enabled: true, dependsOn: ['parent'], variants },
    { key: 'killed', enabled: false, variants },
    {
      key: 'unmatched',
      enabled: true,
      variants,
      rules: [{ when: [{ field: 'role', op: 'eq', value: 'staff' }] }],
    },
  ]);

  const decisions = features.resolve({
    targetingKey: 'user-1',
    role: 'customer',
  });

  for (const key of ['child', 'killed', 'unmatched'] as const) {
    expect(decisions[key].enabled).toBe(false);
    expect(decisions[key].variant).toBeUndefined();
    expect(decisions[key].value).toBeUndefined();
    expect(decisions[key].assignment).toBeUndefined();
  }

  expect(decisions.killed.reason).toBe('explicitly-off');
  expect(decisions.child.reason).toBe('dependency-off');
  expect(decisions.unmatched.reason).toBe('no-rule-matched');
});
```

A control leaking onto an off decision would make the two states indistinguishable at the call site, and the kill switch is the one thing an operator must read unambiguously.

- [ ] **Step 10: Run the tests and confirm they pass**

Run: `npx nx test feature -- features`
Expected: PASS. The three off exits never call `assignVariant`, so this test passes against the code from Step 8. It pins the property.

- [ ] **Step 11: Extend the output-only invariant**

Read `libs/feature/src/lib/reason-is-output-only.spec.ts` fully, then append a case in the style it already uses, asserting that mutating `variant`, `value` and `assignment` on a returned decision changes no later decision. Follow whatever mechanism the existing cases use to make that assertion; do not invent a second one.

- [ ] **Step 12: Run the package suite**

Run: `npx nx test feature && npx nx test repo-checks`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add libs/feature/src/lib/types.ts libs/feature/src/lib/evaluate.ts \
  libs/feature/src/lib/features.spec.ts libs/feature/src/lib/reason-is-output-only.spec.ts
git commit -m "feat(feature): resolve a feature to one of its variants"
```

---

### Task 5: Build-time planning

**Files:**

- Modify: `libs/feature/src/lib/types.ts` (the `PlanEntry` doc comments)
- Modify: `libs/feature/src/lib/evaluate.ts` (`planFeature`)
- Test: `libs/feature/src/lib/features.spec.ts`

**Interfaces:**

- Consumes: everything from Task 4.
- Produces: a `PlanEntry` that may carry a `decision` while `resolved` is `'deferred'`.

Read `planFeature` in `libs/feature/src/lib/evaluate.ts` fully, and the `PlanEntry` doc comments in `types.ts`. Today `decision` is documented as present only when `resolved` is a boolean, and `needs` as empty unless `resolved` is `'deferred'`. Decision 9 of the spec relaxes the first of those.

The alternative, a `resolved` that answers enablement alone with a separate field for the variant, fails in the wrong direction: a build-time pass written as `if (entry.resolved === true) emitStatic(entry.decision)` would emit a static decision carrying a variant nothing computed. Under `'deferred'` that same call site skips the entry and resolves per request.

- [ ] **Step 1: Write the failing test**

Append to `libs/feature/src/lib/features.spec.ts`:

```ts
it('defers a feature whose enablement is settled and whose variant is not', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    },
  ]);

  const entry = features.plan().cta;

  expect(entry.resolved).toBe('deferred');
  expect(entry.needs).toEqual(['targetingKey']);
  expect(entry.decision?.enabled).toBe(true);
  expect(entry.decision?.reason).toBe('default-on');
  expect(entry.decision?.variant).toBeUndefined();
});

it('needs the field variantBy names', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variantBy: 'accountId',
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    },
  ]);

  expect(features.plan().cta.needs).toEqual(['accountId']);
});

it('resolves a feature whose variant a build-time context settles', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    },
  ]);

  const entry = features.plan({ targetingKey: 'user-1' }).cta;

  expect(entry.resolved).toBe(true);
  expect(entry.needs).toEqual([]);
  expect(entry.decision?.variant).toBeDefined();
});

it('resolves a feature that is off without needing a bucketing field', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: false,
      variants: [{ name: 'control', weight: 1 }],
    },
  ]);

  const entry = features.plan().cta;

  expect(entry.resolved).toBe(false);
  expect(entry.needs).toEqual([]);
  expect(entry.decision?.enabled).toBe(false);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx nx test feature -- features`
Expected: FAIL. `plan()` reports `resolved: true` for a variant feature today, because no rule needs a field.

- [ ] **Step 3: Teach `planFeature` about the variant field**

In `planFeature`, the `available` set and the `ownNeeds` set already decide what a feature still needs. After the existing rules loop and before the `const needs = [...]` line, add:

```ts
// A feature that resolves on and declares variants still needs its bucketing
// field, unless the context already carries it. Enablement can be settled
// while the split is not, and the entry below carries both facts.
const variantField = definition.variantBy ?? DEFAULT_ROLLOUT_FIELD;
const needsVariantField =
  definition.variants !== undefined &&
  definition.variants.length > 0 &&
  !available.has(variantField);
if (needsVariantField) ownNeeds.add(variantField);
```

Then change the final two exits. The deferred exit becomes:

```ts
const needs = [...deferredNeeds, ...ownNeeds].sort();
if (needs.length) {
  const entry: PlanEntry<F> = { key, resolved: 'deferred', needs };
  // Enablement is settled when this feature's own rules all resolved and only
  // its variant is outstanding. A build-time pass reads `resolved` to decide
  // whether to emit statically, so it still skips this entry, and a caller
  // that wants the enablement shortcut reads `decision.enabled` deliberately.
  if (deferredNeeds.size === 0 && ownNeeds.size === 1 && needsVariantField) {
    entry.decision = decide(definition, context, resolved);
  }
  return entry;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx nx test feature -- features`
Expected: PASS.

- [ ] **Step 5: Strip the variant from a deferred decision**

The decision attached to a deferred entry must not carry a variant, because the context that produced it lacks the bucketing field and `assignVariant` would have returned the control with `source: 'fallback'`. A build emitting that would freeze every subject onto the control.

Add a test first, then make it pass:

```ts
it('attaches no variant to a decision on a deferred entry', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    },
  ]);

  const entry = features.plan().cta;

  expect(entry.decision?.variant).toBeUndefined();
  expect(entry.decision?.value).toBeUndefined();
  expect(entry.decision?.assignment).toBeUndefined();
});
```

In the deferred exit, replace `entry.decision = decide(definition, context, resolved);` with:

```ts
const settled = decide(definition, context, resolved);
// The context lacks the bucketing field, so `decide` took the fallback
// and assigned the control. Emitting that would freeze every subject onto
// it. The entry reports enablement and leaves the split to the request.
const { variant, value, assignment, ...enablement } = settled;
void variant;
void value;
void assignment;
entry.decision = enablement as Decision<F>;
```

If the linter objects to the `void` statements, use whatever this repository's convention is for discarding destructured values; check `libs/feature/src` and `libs/acl/src` for an existing example before inventing one.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx nx test feature -- features`
Expected: PASS.

- [ ] **Step 7: Update the `PlanEntry` doc comments**

In `libs/feature/src/lib/types.ts`, rewrite the two doc comments on `PlanEntry`:

```ts
  /**
   * `'deferred'` when some rule, or this feature's variant split, still needs
   * context this plan did not have.
   */
  resolved: boolean | 'deferred';
  /** Context fields still needed, sorted. Empty unless `resolved` is deferred. */
  needs: readonly string[];
  /**
   * The decision, when one is settled.
   *
   * Present whenever `resolved` is a boolean. Also present on a deferred entry
   * whose enablement is settled and whose variant alone is outstanding, and
   * that decision carries no variant, because the context that produced it
   * lacked the bucketing field. A decision no longer implies that `resolved` is
   * a boolean.
   */
  decision?: Decision<F>;
```

- [ ] **Step 8: Run the package suite**

Run: `npx nx test feature && npx nx test repo-checks`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add libs/feature/src/lib/types.ts libs/feature/src/lib/evaluate.ts \
  libs/feature/src/lib/features.spec.ts
git commit -m "feat(feature): settle enablement at build time while the split waits"
```

---

### Task 6: The React reader, the public entry, and the documentation

**Files:**

- Modify: `libs/feature/src/react/index.tsx`
- Test: `libs/feature/src/react/react.spec.tsx`
- Modify: `libs/feature/src/index.ts`
- Create: `apps/docs/content/feature/variants.mdx`
- Modify: `apps/docs/content/feature/_meta.ts`
- Modify: `apps/docs/content/feature/configuration.mdx`, `decisions.mdx`, `react.mdx`, `build-time.mdx`, `api.mdx`
- Modify: `libs/feature/README.md`

**Interfaces:**

- Consumes: everything from Tasks 1 to 5.
- Produces: `useVariant<F extends FeatureKey = string>(key: F): { variant?: string; value?: unknown }`.

Read `libs/feature/src/react/index.tsx` fully. It is a reader over decisions the provider already resolved, and `useVariant` is one more of those. Nothing in that file decides anything and this task does not change that.

`tools/repo-checks/src/doc-exports.test.ts` holds G5: no documentation fence imports a name its package does not export. `tools/repo-checks/src/docs-navigation.test.ts` fails on a `_meta.ts` key naming a page that does not exist.

- [ ] **Step 1: Write the failing React test**

Append to `libs/feature/src/react/react.spec.tsx`, following the render helpers that file already uses:

```tsx
it('reads the assigned variant and its value', () => {
  const features = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [{ name: 'only', weight: 1, value: { label: 'Buy' } }],
    },
  ]);

  function Reader() {
    const { variant, value } = useVariant('cta');
    return (
      <span>{`${String(variant)}:${String((value as { label: string }).label)}`}</span>
    );
  }

  render(
    <FeatureProvider features={features} context={{ targetingKey: 'u' }}>
      <Reader />
    </FeatureProvider>,
  );

  expect(screen.getByText('only:Buy')).toBeInTheDocument();
});

it('reads no variant from a feature that resolved off', () => {
  const features = createFeatures([
    { key: 'cta', enabled: false, variants: [{ name: 'only', weight: 1 }] },
  ]);

  function Reader() {
    const { variant } = useVariant('cta');
    return <span>{variant === undefined ? 'none' : variant}</span>;
  }

  render(
    <FeatureProvider features={features} context={{ targetingKey: 'u' }}>
      <Reader />
    </FeatureProvider>,
  );

  expect(screen.getByText('none')).toBeInTheDocument();
});

it('throws for a key the provider does not carry', () => {
  const features = createFeatures([{ key: 'cta', enabled: true }]);

  function Reader() {
    useVariant('nope' as 'cta');
    return null;
  }

  expect(() =>
    render(
      <FeatureProvider features={features}>
        <Reader />
      </FeatureProvider>,
    ),
  ).toThrow(/not configured/);
});
```

Match the existing file's imports, render helper and assertion style. If it uses something other than `screen.getByText` or `toBeInTheDocument`, follow that.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx nx test feature -- react`
Expected: FAIL, `useVariant is not exported`.

- [ ] **Step 3: Write `useVariant`**

Append to `libs/feature/src/react/index.tsx`:

```tsx
/**
 * One feature's assigned variant and its value.
 *
 * A reader over the decision `useFeature` already returns. Both are absent for
 * a feature that resolved off and for a feature declaring no variants, so
 * calling code handles off before it switches on a name.
 *
 * Throws for a key the provider does not carry, which `useFeature` does for the
 * same reason: a silent `undefined` would make a typo indistinguishable from a
 * feature nobody assigned.
 */
export function useVariant<F extends FeatureKey = string>(
  key: F,
): { variant?: string; value?: unknown } {
  const decision = useFeature<F>(key);
  return { variant: decision.variant, value: decision.value };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx nx test feature -- react`
Expected: PASS.

- [ ] **Step 5: Export the new names**

In `libs/feature/src/index.ts`:

Add `useVariant` to the React entry's exports, following how `useFeature` and `useFeatureEnabled` are already exported from `libs/feature/src/react/index.tsx`.

Add `VariantAssignment` to the core entry's type export block, in alphabetical order. `VariantSpec` went in with Task 1.

Export `assignVariant` and `variantSeedOf` as values. The argument is the one that already exports `bucketOf` and `murmur3`: a tool building a build-time snapshot, or a test asserting which variant a subject gets, needs to compute an assignment without constructing a store. Do not export `bucketingOrder` or `assignWeighted`; they are steps inside `assignVariant` and no caller needs them separately.

`doc-export-coverage` will name the new value exports. Add them to `tools/repo-checks/src/doc-export-coverage-allowance.json` beside `bucketOf`, `murmur3` and `evaluateCondition`, and give each a row in `api.mdx`'s Core exports table in Step 9, which is how a reader finds them.

- [ ] **Step 6: Measure the values the documentation will carry**

Every id, bucket and variant name in a page comes from a run. Print them:

```bash
cat > libs/feature/src/lib/print-variants.spec.ts <<'EOF'
import { it } from 'vitest';
import { createFeatures } from './features.js';

it('prints', () => {
  const features = createFeatures([
    {
      key: 'checkout-cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50, value: { label: 'Get it' } },
      ],
      rules: [
        { when: [{ field: 'group', op: 'eq', value: 'staff' }], variant: 'blue' },
        { rollout: { percent: 20 } },
      ],
    },
  ]);
  for (const key of ['user-1', 'user-2', 'user-3', 'user-4']) {
    console.log(key, JSON.stringify(features.resolve({ targetingKey: key })));
  }
  console.log('staff', JSON.stringify(features.resolve({ targetingKey: 'user-1', group: 'staff' })));
});
EOF
npx nx test feature -- print-variants
rm libs/feature/src/lib/print-variants.spec.ts
```

Write down what it prints. Pick a subject from the output whose decision shows a weighted assignment, and use its real numbers in the pages below.

- [ ] **Step 7: Write the Variants page**

Create `apps/docs/content/feature/variants.mdx`. Read two existing pages first, `rollouts.mdx` for the shape a bucketing page takes here and `decisions.mdx` for how a decision is shown, and follow their structure, heading depth and fence conventions.

The page covers, in this order: what a variant is and how an author declares one; weights and their normalisation; the bucketing order and why `order` exists; that the variant seed is separate from the rollout seed and what sharing one would do; pinning a variant from a rule; `stickyVariants` and what an application stores; what a context missing the bucketing field gets; and that a feature resolving off carries no variant.

Every number and variant name in a fence comes from Step 6's output.

- [ ] **Step 8: List the page in the navigation**

In `apps/docs/content/feature/_meta.ts`, add `variants: 'Variants'` between `rollouts` and `react`. Variant assignment reuses the bucketing a reader meets in Rollouts, so it follows that page. Extend the file's existing doc comment to say why the page sits there, matching the reasoning already written for the other entries.

- [ ] **Step 9: Update the pages that describe what changed**

`configuration.mdx` gains `variants`, `variantBy`, `variantSeed` and `Rule.variant`. `decisions.mdx` gains `variant`, `value` and `assignment`. `react.mdx` gains `useVariant`. `build-time.mdx` gains the deferred entry that carries a decision. `api.mdx` gains the new types and the new exports in its Core exports table.

Read each page before editing and follow its own conventions. Values come from Step 6.

- [ ] **Step 10: Check the README**

Run: `grep -n "variant" libs/feature/README.md`
If the README describes the decision shape or the configuration shape, extend it the same way. If it does not, this step is done.

- [ ] **Step 11: Run everything**

Run: `npx nx affected -t test lint build --base=main`
Then: `npx prettier --check $(git diff --name-only main...HEAD -- '*.mdx' '*.ts' '*.tsx')`
Expected: PASS. A `doc-exports` failure names a fence importing something the package does not export. A `docs-navigation` failure names a `_meta.ts` key with no page behind it.

- [ ] **Step 12: Commit**

```bash
git add libs/feature/src/react/index.tsx libs/feature/src/react/react.spec.tsx \
  libs/feature/src/index.ts apps/docs/content/feature/ libs/feature/README.md
git commit -m "feat(feature): read a variant in React, and document the whole split"
```
