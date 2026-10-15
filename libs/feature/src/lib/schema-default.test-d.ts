import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';
import type { DeepReadonly } from './observe.js';
import { parseFeatureConfig } from './parse.js';
import type {
  BoundFeatures,
  Decision,
  DecisionSet,
  Decisions,
  Features,
  InferSchema,
  Plan,
  PlanEntry,
  Schema,
} from '../index.js';

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

type Typed = InferSchema<typeof defs>;

// The store `parseFeatureConfig` answers when the caller names no schema. Its
// default is `Record<FeatureKey, VariantInfo | never>`, which is a different
// type from `Schema` that each side must still accept.
type Parsed = Extract<
  ReturnType<typeof parseFeatureConfig>,
  { ok: true }
>['features'];

declare const store: Features;
declare const decisions: Decisions;
declare const plan: Plan;

describe('Features, Decisions and Plan with no type argument', () => {
  it('are the instantiation at Schema', () => {
    expectTypeOf<Features>().toEqualTypeOf<Features<Schema, boolean>>();
    expectTypeOf<Decisions>().toEqualTypeOf<Decisions<Schema>>();
    expectTypeOf<Plan>().toEqualTypeOf<Plan<Schema>>();
  });

  it('match the default DecisionSet already had', () => {
    expectTypeOf<DecisionSet>().toEqualTypeOf<DecisionSet<Schema, boolean>>();
    expectTypeOf(store.snapshot()).toEqualTypeOf<DecisionSet>();
  });

  it('leave Frozen at both freezes', () => {
    expectTypeOf<Features>().not.toEqualTypeOf<Features<Schema, true>>();
    expectTypeOf<Features>().not.toEqualTypeOf<Features<Schema, false>>();
    expectTypeOf(store.resolve()).toEqualTypeOf<
      Decisions | DeepReadonly<Decisions>
    >();
  });

  it('accept the parsed store and are accepted by its slot', () => {
    expectTypeOf<Parsed>().toExtend<Features>();
    expectTypeOf<Features>().toExtend<Parsed>();
  });

  it('answer a key the compiler never saw at the open form', () => {
    expectTypeOf(decisions['beta']).toEqualTypeOf<
      Decision<string, string, unknown> | undefined
    >();
    expectTypeOf(plan['beta']).toEqualTypeOf<
      PlanEntry<string, string, unknown> | undefined
    >();
    expectTypeOf(store.variantOf('beta')).toEqualTypeOf<string | undefined>();
    expectTypeOf(store.valueOf('beta')).toEqualTypeOf<unknown>();
    // `keyof Schema & FeatureKey` is `string`. A document key `7` is asked as
    // `'7'`, which the store answers the same as `7`.
    expectTypeOf(store.isEnabled).parameter(0).toEqualTypeOf<string>();
  });
});

describe('a store built from a literal', () => {
  const typed = createFeatures(defs);

  it('still infers its own schema, not the default', () => {
    expectTypeOf(typed).toEqualTypeOf<Features<Typed, false>>();
    expectTypeOf(typed.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('hands its decisions and its set to a slot at the open form', () => {
    expectTypeOf(typed.resolve()).toExtend<Decisions>();
    expectTypeOf(typed.plan()).toExtend<Plan>();
    expectTypeOf(typed.snapshot()).toExtend<DecisionSet>();
  });

  it('fits a slot declared as the bare Features, observed or not', () => {
    const observed = createFeatures(defs, { observe: () => undefined });

    expectTypeOf(typed).toExtend<Features>();
    expectTypeOf(observed).toExtend<Features>();
  });

  it('fits a slot declared as the bare BoundFeatures', () => {
    expectTypeOf(typed.for()).toExtend<BoundFeatures>();
  });

  it('answers its variant names through the bare slot as strings', () => {
    const slot: Features = typed;

    expectTypeOf(slot.variantOf('cta')).toEqualTypeOf<string | undefined>();
  });
});
