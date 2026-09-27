# Feature Schema Typing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `features.variantOf('cta')` returns `'control' | 'blue'` and not `string`, inferred from the definitions a consumer wrote, with an explicit schema available for configuration that arrives as JSON.

**Architecture:** The public generics stop being parameterised on the feature key and start being parameterised on a schema mapping each key to its variant union and value type. `createFeatures` gains two overloads: one with a `const` type parameter that infers the schema from a literal, one taking the schema explicitly. The React entry erases the schema into its context and gains a factory that returns provider and hooks bound to one store, following `@evanion/react-acl`. Nothing below the type facade changes: `assignVariant`, `bucketingOrder`, `assignWeighted` and `VariantAssignment` carry no key parameter today.

**Tech Stack:** TypeScript 6.0.3, Vitest with `typecheck`, Nx. Runtime tests are `*.spec.ts` beside the source; type tests are `*.test-d.ts`.

**Spec:** `docs/specs/2026-09-23-feature-variants.md`, decision 8 and its "Typing" section. Read both.

## Global Constraints

- The package is unpublished (`private: true`, 404 on npm). Any signature may change and no migration is owed.
- `Decision<F, V, T>` keeps `V extends string = string` and `T = unknown` as defaults. Seven generic functions in `evaluate.ts` write `variant` and `value` through those defaults, and dropping either breaks all seven at once.
- A schema is always a record. A bare key union is not a schema. The spec's sentence "a plain key union remains a valid schema" is shorthand for "a feature declaring no variants keeps the types it has today", and it is corrected in Task 6.
- Numeric keys stay. `FeatureKey` is `string | number` and `types.ts:3-6` states the numeric-enum case is deliberate. A schema inferred from numeric enum keys gives exhaustive lookups, proved against TS 6.0.3.
- The explicit-schema constraint is self-referential, `S extends Record<keyof S, ...>`, not `S extends Schema` with an index signature. The index-signature form rejects an `interface`.
- The inferring overload needs `const` on its type parameter. Without it the key index collapses to an index signature and the schema is useless, silently.
- Any mapped type branching on the variant shape guards with `[S[K]] extends [never]`. `never extends VariantInfo` evaluates true, so a feature with no variants otherwise gets `variant: never; value: never` instead of no fields, with no error.
- Tests are `*.spec.ts` beside the source. `repo-checks` enforces a blank line before the first `expect` in a case that arranges anything above it.
- Prose in doc comments, `.mdx` and commit messages: no em-dashes, no "X rather than Y", no "instead of", no bold lead-ins, every sentence names who or what does the thing, no gerund phrase as a subject, no metaphor verb for a technical fact, no three-item rhythmic lists.
- CI runs `npx prettier --check .` as its own job.

## Review Focus

- A type test that runs against no typecheck harness passes unconditionally. `libs/feature/vite.config.ts` has no `test.typecheck` block, and `libs/urn/vite.config.ts:16-18` records what happens without one: vitest falls back to the solution-style tsconfig with `files: []` and every `expectTypeOf` silently passes. Task 1 wires the harness and proves it by watching a deliberately wrong assertion fail.
- A feature declaring no variants must produce a decision with no `variant` and no `value` key, not one carrying `never`. Pinned in Task 2, Step 7.
- The inferring overload must work on a bare array literal with no `as const`. A consumer who has to remember `as const` will forget, and the failure is a silent widening to `string`. Pinned in Task 3, Step 5.
- A numeric enum key must still reach `useFeature` and still index a schema. `FeatureKey` admits numbers and the React hooks take `FeatureKey`. Pinned in Task 5, Step 9.
- The React provider's widening cast must stay a widening. Every `Decision<'cta', 'control' | 'blue', {...}>` assigns to `Decision` because `key`, `variant`, `value`, `blockedBy` and `cause` sit in output position. If that is not true at a concrete schema, the cast hides a reinterpretation. Pinned in Task 5, Step 3.

---

### Task 1: Wire the typecheck harness, and prove it runs

**Files:**

- Modify: `libs/feature/vite.config.ts`
- Create: `libs/feature/src/lib/typecheck-harness.test-d.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: a working `expectTypeOf` harness for every later task.

This task exists because a type test with no harness is worse than no type test. Read `libs/urn/vite.config.ts` first, including the comment at `:16-18`, then `libs/feature/vite.config.ts`.

- [ ] **Step 1: Write a type test that must fail**

Create `libs/feature/src/lib/typecheck-harness.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';

/**
 * Proves the typecheck harness runs. A deliberately wrong assertion here fails
 * the suite, and the same assertion in a tree with no `test.typecheck` block
 * passes, which is the failure `libs/urn/vite.config.ts` records.
 */
describe('the typecheck harness', () => {
  it('reads a string as a string', () => {
    expectTypeOf<string>().toEqualTypeOf<number>();
  });
});
```

- [ ] **Step 2: Run it and watch it pass, which is the bug**

Run: `npx nx test feature`
Expected: PASS. The file sits in the tree and nothing typechecks it. Record that you saw this.

- [ ] **Step 3: Wire the harness**

In `libs/feature/vite.config.ts`, add to the `test` object, following `libs/urn/vite.config.ts:15-23` and keeping its comment's substance in your own words:

```ts
    // Without an explicit tsconfig, vitest falls back to the solution-style
    // tsconfig.json (files: [], include: []). It then typechecks nothing and
    // every expectTypeOf assertion passes whatever it asserts.
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['src/**/*.test-d.{ts,tsx}'],
    },
```

- [ ] **Step 4: Run it and watch it fail**

Run: `npx nx test feature`
Expected: FAIL, naming `typecheck-harness.test-d.ts` and the `string` against `number` mismatch. Quote the failure in your report. This is the only evidence that every later type test means anything.

- [ ] **Step 5: Correct the assertion**

```ts
expectTypeOf<string>().toEqualTypeOf<string>();
```

- [ ] **Step 6: Run the package suite**

Run: `npx nx test feature`
Expected: PASS, with the typecheck run reported alongside the runtime tests.

- [ ] **Step 7: Commit**

```bash
git add libs/feature/vite.config.ts libs/feature/src/lib/typecheck-harness.test-d.ts
git commit -m "test(feature): typecheck the type tests"
```

---

### Task 2: The schema types

**Files:**

- Modify: `libs/feature/src/lib/types.ts`
- Create: `libs/feature/src/lib/schema.test-d.ts`

**Interfaces:**

- Consumes: `VariantSpec`, `FeatureDefinition`, `FeatureKey` from `types.ts`.
- Produces: `VariantInfo`, `Schema`, `InferSchema<D>`, and `Decision<F, V, T>`, `Decisions<S>`, `PlanEntry<F, V, T>`, `Plan<S>` in their new shapes.

Read `libs/feature/src/lib/types.ts` in full. The declarations that change are at `:104` (`FeatureDefinition`), `:195` (`Cause`), `:208` (`Decision`), `:240` (`Decisions`), `:243` (`PlanEntry`), `:264` (`Plan`) and `:266` (`ToggleResult`). `Cause` and `ToggleResult` keep their single key parameter; only what gets fed in changes.

The type machinery below was proved against TS 6.0.3 with the real `VariantSpec` and `FeatureDefinition`. Use it as written.

- [ ] **Step 1: Write the failing type test**

Create `libs/feature/src/lib/schema.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';
import type { Decisions, InferSchema } from './types.js';

const defs = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50, value: { label: 'Buy' } },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
  { key: 'nav', enabled: true },
] as const;

type S = InferSchema<typeof defs>;

describe('InferSchema', () => {
  it('reads a variant union off a feature that declares variants', () => {
    expectTypeOf<S['cta']['variant']>().toEqualTypeOf<'control' | 'blue'>();
  });

  it('reads the value union off the same feature', () => {
    expectTypeOf<S['cta']['value']>().toEqualTypeOf<
      { readonly label: 'Buy' } | { readonly label: 'Get it' }
    >();
  });

  it('gives never to a feature that declares no variants', () => {
    expectTypeOf<S['nav']>().toEqualTypeOf<never>();
  });
});

describe('Decisions', () => {
  it('narrows the variant per key', () => {
    expectTypeOf<Decisions<S>['cta']['variant']>().toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('carries no variant key for a feature that declares none', () => {
    expectTypeOf<Decisions<S>['nav']>().not.toHaveProperty('variant');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx nx test feature -- schema`
Expected: FAIL, `InferSchema` is not exported from `./types.js`.

- [ ] **Step 3: Add the schema types**

In `libs/feature/src/lib/types.ts`, after `VariantSpec`:

```ts
/** What a schema records about one feature: its variant names and their values. */
export interface VariantInfo {
  variant: string;
  value?: unknown;
}

/**
 * A map from feature key to what that feature's variants are.
 *
 * A consumer writes one of these to type a store built from configuration that
 * arrived as JSON, where there are no literals for `InferSchema` to read. A
 * store built from a literal gets its schema inferred and nobody writes this.
 */
export type Schema = Record<string, VariantInfo | never>;

/**
 * The schema a definitions array implies.
 *
 * `[D['variants']] extends [never]` is the guard that matters. `never` is a
 * subtype of every type, so a plain `D extends { variants: ... }` check takes
 * the variant branch for a feature that declares none and gives it
 * `variant: never`, with no error anywhere. The tuple wrap suppresses
 * distribution and asks the question the branch means to ask.
 */
export type InferSchema<D extends readonly FeatureDefinition<never>[]> = {
  [E in D[number] as E['key']]: E extends {
    variants: infer V extends readonly VariantSpec[];
  }
    ? { variant: V[number]['name']; value: V[number]['value'] }
    : never;
};
```

- [ ] **Step 4: Parameterise `Decision`**

Replace `Decision`'s declaration line, keeping every member and doc comment:

```ts
export interface Decision<
  F extends FeatureKey = string,
  V extends string = string,
  T = unknown,
> {
```

and change the two variant members to use the parameters:

```ts
  variant?: V;
  value?: T;
```

The defaults are load-bearing. `withVariant`, `decide` and `planFeature` in `evaluate.ts` write these fields through the one-parameter form, and dropping either default breaks all seven generic functions in that file at once.

- [ ] **Step 5: Map `Decisions` and `Plan` over a schema**

```ts
/** One decision per feature, each narrowed to what its own variants allow. */
export type Decisions<S extends Schema> = {
  [K in keyof S]: [S[K]] extends [never]
    ? Decision<K & FeatureKey>
    : Decision<K & FeatureKey, S[K]['variant'], S[K]['value']>;
};
```

Give `PlanEntry` the same three parameters as `Decision` and map `Plan` the same way as `Decisions`.

- [ ] **Step 6: Run the type test**

Run: `npx nx test feature -- schema`
Expected: PASS. If the `never` case fails, the guard is the reason; check the tuple wrap.

- [ ] **Step 7: Write the never-guard regression**

Append to `schema.test-d.ts`:

```ts
describe('the never guard', () => {
  it('omits the variant fields for a feature declaring none', () => {
    // `never extends VariantInfo` is true, so a branch without the tuple wrap
    // gives this feature `variant: never` and no error reports it.
    expectTypeOf<Decisions<S>['nav']['variant']>().toEqualTypeOf<
      string | undefined
    >();
  });
});
```

- [ ] **Step 8: Run the package suite and commit**

Run: `npx nx test feature && npx nx test repo-checks`

```bash
git add libs/feature/src/lib/types.ts libs/feature/src/lib/schema.test-d.ts
git commit -m "feat(feature): type a decision by the schema its feature declares"
```

---

### Task 3: The two overloads, and the two new readers

**Files:**

- Modify: `libs/feature/src/lib/features.ts`
- Create: `libs/feature/src/lib/features.test-d.ts`
- Test: `libs/feature/src/lib/features.spec.ts`

**Interfaces:**

- Consumes: `InferSchema`, `Schema`, `Decisions`, `Plan` from Task 2.
- Produces: `Features<S extends Schema>` with `variantOf` and `valueOf`, and `createFeatures` as two overloads.

`Features` has no `variantOf` or `valueOf` today; grep confirms neither name appears in `features.ts` or the entry. This task adds them, because they are the methods the whole refactor exists to type.

The two casts at `features.ts:131` and `:147`, `Object.fromEntries(resolved) as Decisions<F>` and `as Plan<F>`, both break under a schema-shaped record and are part of this task.

- [ ] **Step 1: Write the failing type test**

Create `libs/feature/src/lib/features.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';

describe('createFeatures, inferring', () => {
  it('narrows variantOf to the names a feature declares', () => {
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

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('refuses a key the definitions do not declare', () => {
    const features = createFeatures([{ key: 'cta', enabled: true }]);

    // @ts-expect-error nothing declares this key
    features.variantOf('nope');
  });
});

describe('createFeatures, explicit', () => {
  interface MyFlags {
    cta: { variant: 'control' | 'blue'; value: { label: string } };
  }

  it('takes an interface as its schema', () => {
    const features = createFeatures<MyFlags>(JSON.parse('[]'));

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
    expectTypeOf(features.valueOf('cta')).toEqualTypeOf<
      { label: string } | undefined
    >();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx nx test feature -- features.test-d`
Expected: FAIL, `variantOf` does not exist.

- [ ] **Step 3: Reparameterise `Features` and add the readers**

Change `Features<F extends FeatureKey = string>` to `Features<S extends Schema>`, and inside it change `resolve`, `plan`, `toggle`, `config`, `definition`, `dependants`, `keys` and `isEnabled` to key on `keyof S & FeatureKey` and return the schema-mapped types. Add:

```ts
  /** The assigned variant, or `undefined` for a feature that resolved off. */
  variantOf<K extends keyof S>(
    key: K,
    context?: EvaluationContext,
  ): Decisions<S>[K]['variant'];
  /** The assigned variant's configured value, when it declares one. */
  valueOf<K extends keyof S>(
    key: K,
    context?: EvaluationContext,
  ): Decisions<S>[K]['value'];
```

Both derive from `Decisions<S>[K]` and not from `S[K]` directly. A reader of `variantOf` then sees the same type the decision for that key carries, and the two cannot drift apart.

- [ ] **Step 4: Write the two overloads**

```ts
export function createFeatures<
  const D extends readonly FeatureDefinition<never>[],
>(definitions: D): Features<InferSchema<D>>;
export function createFeatures<S extends Record<keyof S, VariantInfo>>(
  definitions: readonly FeatureDefinition<Extract<keyof S, FeatureKey>>[],
): Features<S>;
export function createFeatures(
  definitions: readonly FeatureDefinition<never>[],
): Features<Schema> {
```

then leave the implementation body as it is, changing only the two `Object.fromEntries` casts to target the implementation signature's own types.

The `const` modifier on `D` is what makes a bare array literal work. Without it the key index collapses to an index signature and every variant widens to `string`, with no error. The self-referential bound on `S` is what lets an `interface` through; `S extends Schema` with an index signature rejects one.

- [ ] **Step 5: Write the no-`as const` regression**

Append to `features.test-d.ts`:

```ts
describe('the const type parameter', () => {
  it('infers from a bare array literal with no as const', () => {
    // A consumer who must remember `as const` will forget, and the failure is a
    // silent widening to string, and no error reports it.
    const features = createFeatures([
      { key: 'cta', enabled: true, variants: [{ name: 'only', weight: 1 }] },
    ]);

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<'only' | undefined>();
  });
});
```

- [ ] **Step 6: Implement `variantOf` and `valueOf`**

In the returned object, add both, reading the decision `resolve` already computes:

```ts
    variantOf: (key, context) => resolve(context)[key]?.variant,
    valueOf: (key, context) => resolve(context)[key]?.value,
```

- [ ] **Step 7: Add the runtime tests**

Append to `libs/feature/src/lib/features.spec.ts`, inside the existing top-level `describe`:

```ts
  it('reads the assigned variant off a resolved feature', () => {
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

    const variant = features.variantOf('cta', { targetingKey: 'user-1' });

    expect(['control', 'blue']).toContain(variant);
  });

  it('reads no variant off a feature that resolved off', () => {
    const features = createFeatures([
      { key: 'cta', enabled: false, variants: [{ name: 'only', weight: 1 }] },
    ]);

    expect(features.variantOf('cta', { targetingKey: 'u' })).toBeUndefined();
  });

  it('reads the assigned variant's value', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'only', weight: 1, value: { label: 'Buy' } }],
      },
    ]);

    expect(features.valueOf('cta', { targetingKey: 'u' })).toEqual({
      label: 'Buy',
    });
  });
```

- [ ] **Step 8: Run the package suite and commit**

Run: `npx nx test feature && npx nx test repo-checks`

```bash
git add libs/feature/src/lib/features.ts libs/feature/src/lib/features.test-d.ts libs/feature/src/lib/features.spec.ts
git commit -m "feat(feature): infer a store's variant types from its definitions"
```

---

### Task 4: The internal call sites and the spec files

**Files:**

- Modify: `libs/feature/src/lib/features.spec.ts:16`, `:610`
- Modify: `libs/feature/src/lib/reason-is-output-only.spec.ts:123`, `:162`, `:170`, `:184`
- Modify: `libs/feature/src/index.ts`

**Interfaces:**

- Consumes: everything from Tasks 2 and 3.
- Produces: a package that compiles, with the public entry exporting the new type surface.

The engine needs no change. `assignVariant`, `bucketingOrder`, `assignWeighted` and `VariantAssignment` carry no key parameter, and `rolloutSeed`, `evaluateRule`, `blockingParent`, `rootCause`, `withVariant`, `decide` and `planFeature` all pass `F` through for a key only or write variant fields through `Decision`'s loose defaults. Verify that claim by compiling rather than by trusting it.

- [ ] **Step 1: Compile and collect every error**

Run: `npx nx build feature`
Write down every error, with its file and line. Each is a site that instantiates one of the changed generics.

- [ ] **Step 2: Fix the spec files**

`features.spec.ts:16` declares `FeatureDefinition<Link>[]` and `:610` declares `FeatureDefinition<'parent' | 'child'>[]`. `reason-is-output-only.spec.ts` uses `createFeatures<Key>`, `FeatureDefinition<Key>` and `Map<Key, Decision<Key>>` at four lines. `FeatureDefinition` keeps its key parameter, so most of these stand; `createFeatures<Key>` does not, because a key union is not a schema.

Rewrite each to let the inferring overload do the work, dropping the explicit type argument. Where a test genuinely needs an explicit schema, write one.

- [ ] **Step 3: Update the public entry**

In `libs/feature/src/index.ts`, export `Schema`, `VariantInfo` and `InferSchema` as types, in alphabetical order in the existing type block.

- [ ] **Step 4: Run everything**

Run: `npx nx test feature && npx nx build feature && npx nx test repo-checks`
Expected: PASS. `doc-export-coverage` will name the three new type exports; add them to `tools/repo-checks/src/doc-export-coverage-allowance.json` beside the existing type entries.

- [ ] **Step 5: Commit**

```bash
git add libs/feature/src libs/feature/src/index.ts tools/repo-checks/src/doc-export-coverage-allowance.json
git commit -m "refactor(feature): compile every site against the schema types"
```

---

### Task 5: The React entry

**Files:**

- Modify: `libs/feature/src/react/index.tsx`
- Create: `libs/feature/src/react/types.test-d.tsx`
- Test: `libs/feature/src/react/react.spec.tsx`

**Interfaces:**

- Consumes: `Features<S>`, `Decisions<S>`, `Schema` from Tasks 2 and 3.
- Produces: five erased exports, plus `createFeatureContext` and the `FeatureContext<S>` interface it returns.

Read `libs/react-acl/src/index.tsx` before writing anything. It answered this question in this repository for the same reason, and its reasoning is at `:35-42` on why a context carries the wide instantiation and `:285-291` on what a browser layer promises. Follow it.

A React context fixes its value type when the context is created, before any store exists. Today that type is `Decisions<FeatureKey>`, which works because `Record<FeatureKey, Decision<FeatureKey>>` structurally accepts any `Decisions<F>`. Under a schema no single type accepts every `Decisions<S>`, because each key carries its own literal variant union.

- [ ] **Step 1: Write the failing type test**

Create `libs/feature/src/react/types.test-d.tsx`:

```tsx
import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from '../lib/features.js';
import type { Decision } from '../lib/types.js';
import { createFeatureContext, useFeature, useVariant } from './index.js';

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

describe('the wide hooks', () => {
  it('return the erased decision, which is true under any provider', () => {
    expectTypeOf(useFeature('cta')).toEqualTypeOf<Decision>();
  });

  it('take a numeric key, because FeatureKey admits one', () => {
    expectTypeOf(useFeature).toBeCallableWith(1);
  });
});

describe('the bound hooks', () => {
  const bound = createFeatureContext(features);

  it('narrow the variant to what the store declares', () => {
    expectTypeOf(bound.useVariant('cta').variant).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('refuse a key the store does not carry', () => {
    // @ts-expect-error the store declares no such key
    bound.useFeature('nope');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx nx test feature -- types.test-d`
Expected: FAIL, `createFeatureContext` is not exported.

- [ ] **Step 3: Erase the context**

In `libs/feature/src/react/index.tsx`, replace the context value type:

```tsx
/**
 * What a provider publishes, at the erased types.
 *
 * `Decision` with no arguments is the widest instantiation, and every
 * `Decision<'cta', 'control' | 'blue', { label: string }>` assigns to it
 * because `key`, `variant`, `value`, `blockedBy` and `cause` all sit in output
 * position. A React context fixes its type when the context is created and
 * cannot hold the schema a provider was given.
 */
type AnyDecisions = Readonly<Record<string, Decision>>;

interface FeatureContextValue {
  decisions: AnyDecisions;
}
```

Confirm the widening claim before you rely on it. Write a scratch assertion that a concrete `Decisions<S>` assigns to `AnyDecisions` with no cast, and report what the compiler says. If it does not assign, the provider's cast is hiding a reinterpretation and this task needs a ruling before it continues.

- [ ] **Step 4: Erase the five wide exports**

`FeatureProviderProps<S extends Schema = Schema>` keeps `features: Features<S>` and `decisions?: Decisions<S>`, both checked at the prop. `FeatureProvider<S extends Schema>` widens once in its `useMemo`. The four hooks lose their type parameter and their cast:

```tsx
export function useFeatures(): AnyDecisions;
export function useFeature(key: FeatureKey): Decision;
export function useFeatureEnabled(key: FeatureKey): boolean;
export function useVariant(
  key: FeatureKey,
): Pick<Decision, 'variant' | 'value'>;
```

`useFeature` keeps its `hasOwnProperty` guard and its throw. `useFeatureEnabled` and `useVariant` keep calling `useFeature`.

- [ ] **Step 5: Add the factory**

```tsx
export function createFeatureContext<S extends Schema>(
  features: Features<S>,
): FeatureContext<S>;
```

It creates its own context, returns a provider bound to `S` and four hooks keyed on `keyof S`, and publishes to the package's shared context as well so a component calling the package's own `useFeature` underneath it reads the same decisions. `libs/react-acl/src/index.tsx:330-336` does exactly this; follow it.

Derive each bound hook's return from `Decisions<S>[K]` and not from `S[K]` directly, so a hook cannot drift from the decision the same key produces.

Keep the narrowing in one named helper. It holds because the context is created inside this call and written by exactly one component whose props type every entry.

- [ ] **Step 6: Run the type test**

Run: `npx nx test feature -- types.test-d`
Expected: PASS.

- [ ] **Step 7: Fix the existing React runtime tests**

`react.spec.tsx` uses `FeatureDefinition<Key>[]`, `useFeature<Key>`, `Decisions<Key>`, `useFeatureEnabled<Key>` and `useFeatures<Key>` at five lines. The hooks no longer take a type argument. Drop them and let the erased types stand; the runtime behaviour is unchanged and every existing assertion should still pass.

- [ ] **Step 8: Add runtime tests for the factory**

Test that a bound provider and its hooks render, that the bound provider's decisions reach the package's own `useFeature` underneath it, and that two factories nested give each set of hooks its own store. Follow `react.spec.tsx`'s `getByTestId` and `toHaveTextContent` idiom.

- [ ] **Step 9: Test the numeric key end to end**

```tsx
  it('reads a feature keyed by a numeric enum', () => {
    // FeatureKey is string | number and types.ts:3-6 states the numeric case is
    // deliberate, so a numeric key reaches the hook and indexes the schema.
    enum Flag {
      Cta = 1,
    }
    const numeric = createFeatures([
      { key: Flag.Cta, enabled: true, variants: [{ name: 'only', weight: 1 }] },
    ]);
    const bound = createFeatureContext(numeric);
    ...
  });
```

Write the render and the assertion in the file's own idiom.

- [ ] **Step 10: Run everything and commit**

Run: `npx nx test feature && npx nx test repo-checks && npx nx build feature`

```bash
git add libs/feature/src/react libs/feature/src/index.ts
git commit -m "feat(feature): bind a react provider and its hooks to one store"
```

---

### Task 6: The documentation, and one spec correction

**Files:**

- Modify: `apps/docs/content/feature/api.mdx`
- Modify: `apps/docs/content/feature/react.mdx`
- Modify: `apps/docs/content/feature/configuration.mdx:203`
- Modify: `apps/docs/content/feature/build-time.mdx:20,24`
- Modify: `apps/docs/content/feature/decisions.mdx:35,42`
- Modify: `libs/feature/README.md:629`
- Modify: `docs/specs/2026-09-23-feature-variants.md`

**Interfaces:**

- Consumes: the whole refactor.
- Produces: documentation that matches the code.

None of the fences naming `F`, `Decision<F>` or `Decisions<F>` sits inside a `twoslash` fence or a doctested region, so every one of them reads wrong silently and no check catches it. That is why this task enumerates them.

- [ ] **Step 1: Correct the spec sentence**

`docs/specs/2026-09-23-feature-variants.md` says "A plain key union remains a valid schema, so a definition set declaring no variants keeps the types it has today." A key union cannot satisfy the schema constraint, and an architect reading that line could not tell what it required.

Rewrite it to say what holds: a schema is a record, and a feature declaring no variants produces a decision with no `variant` and no `value`, which is what it had before variants existed. Commit this separately, since it corrects a document already on main.

- [ ] **Step 2: Rewrite `api.mdx`'s type signatures**

Every declaration at `:11-13`, `:80-83`, `:151-172`, `:194-197`, `:204-214` and `:221-224`, plus the `Features<F>` table at `:23-34` and the React table at `:264-269`. Add `variantOf` and `valueOf` rows, and rows for `Schema`, `VariantInfo`, `InferSchema` and `createFeatureContext`.

- [ ] **Step 3: Replace `react.mdx`'s "Typing the keys" section**

That section at `:127-138` documents `useFeatures<Flag>()` and `useFeatureEnabled<Flag>('express-pickup')`, which stop compiling. Replace it with the factory:

```ts
export const { FeatureProvider, useFeature, useVariant } =
  createFeatureContext(features);
```

Say what a consumer gets: a key checked against a real store, a variant as a union, a typed value. Say what it costs: one line at module scope. Say that the top-level hooks still work with no type argument, which is what the page's other two examples already show.

- [ ] **Step 4: Fix the three remaining call-site examples**

`configuration.mdx:203` and `README.md:629` both show `createFeatures<Flag>(config)`. `react.mdx:132` shows `useFeatures<Flag>()`. Replace each with the form that now compiles, and check `README.md:629` is not inside a `#region` a page cites.

- [ ] **Step 5: Verify every value from a run**

Any decision object or variant name a page prints comes from running the code. Use a throwaway spec file, read what it prints, delete it.

- [ ] **Step 6: Run everything**

Run: `npx nx affected -t test lint build --base=main`
Then: `npx prettier --check` on every file you touched.
Expected: PASS. `doc-exports` fails on a fence importing a name the package does not export.

- [ ] **Step 7: Commit**

```bash
git add apps/docs/content/feature libs/feature/README.md
git commit -m "docs(feature): document the schema types and the bound provider"
```
