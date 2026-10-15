import type { ReactElement } from 'react';
import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from '@evanion/feature';
import type {
  Decision as CoreDecision,
  DecisionOrigin as CoreDecisionOrigin,
  DecisionSet as CoreDecisionSet,
  Decisions as CoreDecisions,
  DivergenceObserver as CoreDivergenceObserver,
  DivergenceReport as CoreDivergenceReport,
  DivergenceSide as CoreDivergenceSide,
  EvaluationContext as CoreEvaluationContext,
  FeatureKey as CoreFeatureKey,
  Features as CoreFeatures,
  FrozenWhenObserved as CoreFrozenWhenObserved,
  Schema as CoreSchema,
  VariantInfo as CoreVariantInfo,
} from '@evanion/feature';
import { createFeatureContext, FeatureProvider, useFeature } from './index.js';
import type {
  AnyDecisions,
  BoundFeatureProviderProps,
  Decision,
  DecisionOrigin,
  DecisionSet,
  Decisions,
  DivergenceObserver,
  DivergenceReport,
  DivergenceSide,
  EvaluationContext,
  FeatureKey,
  FeatureProviderProps,
  Features,
  FrozenWhenObserved,
  Schema,
  VariantInfo,
} from './index.js';

/**
 * The evaluation types the adapter takes across the package boundary.
 *
 * `config-types.test-d.tsx` holds the 22 document types to the core's
 * declarations, and its own header says the decision-set and divergence types
 * are somebody else's business. This is that somebody. The 13 names below are
 * what `src/index.tsx` re-exports from outside `config.ts`, and the props cases
 * are the reason the identity matters: an application builds its store with its
 * own `@evanion/feature` import and hands it to a provider from a second
 * package, so a `Features` redeclared here rather than imported would refuse
 * the store at the mount.
 *
 * Eight of the 13 are the types this package's own public declarations name:
 * `FeatureProviderProps`, `BoundFeatureProviderProps`, `BoundVariant`,
 * `FeatureContext`, `AnyDecisions`, `createFeatureContext`, `useFeature` and
 * `useVariant` name `Features`, `EvaluationContext`, `Decisions`, `Decision`,
 * `FeatureKey`, `VariantInfo`, `FrozenWhenObserved` and `Schema` between them.
 * A reader annotating one of those props reaches one specifier for the
 * annotation and the name inside it.
 *
 * `types.test-d.tsx` holds what the hooks answer for a schema. These hold what
 * the props accept, which is the half a second copy of the core in the
 * dependency graph breaks first.
 */

const features = createFeatures([
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
  { key: 'banner', enabled: false },
]);

const hero = createFeatures([{ key: 'hero', enabled: true }]);

/** A schema with one variant-free key, for the generic names. */
type OneKey = Record<'cta', never>;

describe('the five decision-set names the entry re-exports', () => {
  it("publishes the core's DecisionOrigin", () => {
    expectTypeOf<DecisionOrigin>().toEqualTypeOf<CoreDecisionOrigin>();
  });

  it("publishes the core's DecisionSet, at both parameters", () => {
    expectTypeOf<DecisionSet<OneKey, true>>().toEqualTypeOf<
      CoreDecisionSet<OneKey, true>
    >();
    expectTypeOf<DecisionSet>().toEqualTypeOf<CoreDecisionSet<CoreSchema>>();
  });

  it("publishes the core's DivergenceObserver", () => {
    expectTypeOf<DivergenceObserver<'cta'>>().toEqualTypeOf<
      CoreDivergenceObserver<'cta'>
    >();
  });

  it("publishes the core's DivergenceReport", () => {
    expectTypeOf<DivergenceReport<'cta'>>().toEqualTypeOf<
      CoreDivergenceReport<'cta'>
    >();
  });

  it("publishes the core's DivergenceSide", () => {
    expectTypeOf<DivergenceSide>().toEqualTypeOf<CoreDivergenceSide>();
  });
});

describe("the eight core names this package's own declarations name", () => {
  it("publishes the core's Decision, at the key its constraint admits", () => {
    expectTypeOf<Decision<'cta'>>().toEqualTypeOf<CoreDecision<'cta'>>();
    expectTypeOf<Decision>().toEqualTypeOf<CoreDecision>();
  });

  it("publishes the core's Decisions", () => {
    expectTypeOf<Decisions<OneKey>>().toEqualTypeOf<CoreDecisions<OneKey>>();
  });

  it("publishes the core's EvaluationContext", () => {
    expectTypeOf<EvaluationContext>().toEqualTypeOf<CoreEvaluationContext>();
  });

  it("publishes the core's Features, at both parameters", () => {
    expectTypeOf<Features<OneKey, true>>().toEqualTypeOf<
      CoreFeatures<OneKey, true>
    >();
  });

  it("publishes the core's FeatureKey", () => {
    expectTypeOf<FeatureKey>().toEqualTypeOf<CoreFeatureKey>();
  });

  it("publishes the core's FrozenWhenObserved", () => {
    expectTypeOf<FrozenWhenObserved<true, Decisions<OneKey>>>().toEqualTypeOf<
      CoreFrozenWhenObserved<true, CoreDecisions<OneKey>>
    >();
  });

  it("publishes the core's Schema", () => {
    expectTypeOf<Schema>().toEqualTypeOf<CoreSchema>();
  });

  it("publishes the core's VariantInfo", () => {
    expectTypeOf<VariantInfo>().toEqualTypeOf<CoreVariantInfo>();
  });
});

/**
 * The re-exported names carry the core's parameters, defaults and constraints.
 *
 * An identity case passes over an alias that widened on the way through:
 * `export type Decision<F = any> = CoreDecision<F>` is the same type at every
 * argument the identity cases write and admits arguments the core refuses. The
 * cases below write the arguments the core refuses, and the ones whose default
 * the documentation states.
 */
describe('the eight, at their parameters', () => {
  it('refuses a feature key outside FeatureKey', () => {
    // @ts-expect-error -- `F extends FeatureKey`, which is `string | number`
    type Keyed = Decision<symbol>;
    expectTypeOf<Keyed>().not.toBeNever();
  });

  it('takes a numeric key, which is the other half of FeatureKey', () => {
    expectTypeOf<Decision<7>>().toEqualTypeOf<CoreDecision<7>>();
  });

  it("gives Decisions the core's Schema default", () => {
    expectTypeOf<Decisions>().toEqualTypeOf<CoreDecisions<CoreSchema>>();
  });

  it('refuses a schema whose entry is not a VariantInfo', () => {
    // @ts-expect-error -- `Record<keyof S, VariantInfo | never>` is the bound
    type Loose = Decisions<{ cta: string }>;
    expectTypeOf<Loose>().not.toBeNever();
  });

  it('defaults Features to the union of both freezes', () => {
    expectTypeOf<Features<OneKey>>().toEqualTypeOf<CoreFeatures<OneKey>>();
  });

  it('refuses a Frozen argument that is not a boolean', () => {
    // @ts-expect-error -- `Frozen extends boolean`
    type Odd = Features<OneKey, 'yes'>;
    expectTypeOf<Odd>().not.toBeNever();
  });

  it('leaves the decisions alone for a store that freezes nothing', () => {
    expectTypeOf<FrozenWhenObserved<false, Decisions<OneKey>>>().toEqualTypeOf<
      CoreDecisions<OneKey>
    >();
  });

  it('answers both forms for a store whose freeze is unsettled', () => {
    expectTypeOf<
      FrozenWhenObserved<boolean, Decisions<OneKey>>
    >().toEqualTypeOf<CoreFrozenWhenObserved<boolean, CoreDecisions<OneKey>>>();
  });

  it('admits an attribute a rule reads, which EvaluationContext is open for', () => {
    expectTypeOf<{
      targetingKey: string;
      tier: 'gold';
    }>().toMatchTypeOf<EvaluationContext>();
  });
});

/**
 * The erased decision the shared hooks answer.
 *
 * `apps/docs/content/next/react-feature/api.mdx` states under `Decision` that
 * the hook answers `Decision<FeatureKey>` and that the bare `Decision` is a
 * different type. The parameter defaults to `string` while the constraint
 * admits a number, so the wider form does not assign to the narrower and a
 * reader who annotates with the bare name gets `TS2322`.
 */
describe('the decision the shared hooks answer', () => {
  it("is the core's Decision at FeatureKey, which useFeature returns", () => {
    expectTypeOf<ReturnType<typeof useFeature>>().toEqualTypeOf<
      CoreDecision<CoreFeatureKey>
    >();
  });

  it('is not the bare Decision, whose key parameter defaults to string', () => {
    expectTypeOf<
      CoreDecision<CoreFeatureKey> extends CoreDecision ? true : false
    >().toEqualTypeOf<false>();
  });

  it('is what AnyDecisions holds one of per key', () => {
    expectTypeOf<AnyDecisions[CoreFeatureKey]>().toEqualTypeOf<
      CoreDecision<CoreFeatureKey>
    >();
  });
});

/**
 * `Schema` is the default `FeatureProviderProps` gives its schema parameter,
 * which `apps/docs/content/next/react-feature/api.mdx` states under both
 * entries. A default that moved would leave the page claiming a type argument
 * is optional when it is not.
 */
describe('the default schema the props carry', () => {
  it('is Schema, so the props need no type argument', () => {
    expectTypeOf<FeatureProviderProps>().toEqualTypeOf<
      FeatureProviderProps<Schema>
    >();
  });

  it('refuses a schema entry the constraint does not admit', () => {
    // @ts-expect-error -- a variant-free feature carries `never`, not `string`
    type Wrong = FeatureProviderProps<{ cta: string }>;
    expectTypeOf<Wrong>().not.toBeNever();
  });
});

describe('the props the provider accepts across the boundary', () => {
  it("types features as the core's Features", () => {
    expectTypeOf<FeatureProviderProps<OneKey>['features']>().toEqualTypeOf<
      CoreFeatures<OneKey>
    >();
  });

  it("types context as the core's EvaluationContext", () => {
    expectTypeOf<FeatureProviderProps<OneKey>['context']>().toEqualTypeOf<
      CoreEvaluationContext | undefined
    >();
  });

  it("types decisions as the core's DecisionSet", () => {
    expectTypeOf<FeatureProviderProps<OneKey>['decisions']>().toEqualTypeOf<
      CoreDecisionSet<OneKey> | undefined
    >();
  });

  it("types onDivergence as the core's observer over the schema's keys", () => {
    expectTypeOf<FeatureProviderProps<OneKey>['onDivergence']>().toEqualTypeOf<
      CoreDivergenceObserver<'cta'> | undefined
    >();
  });

  it('takes a store the application built with its own core import', () => {
    // The call and not `toBeCallableWith`: the matcher reads a generic
    // function at its constraint, so `S` never comes from the argument and
    // every store fails it.
    expectTypeOf(
      FeatureProvider({ features, context: { targetingKey: 'cust-0042' } }),
    ).toExtend<ReactElement>();
  });

  it("takes the set the core's snapshot answers, which is the server handoff", () => {
    expectTypeOf(
      FeatureProvider({
        features,
        decisions: features.snapshot({ targetingKey: 'cust-0042' }),
      }),
    ).toExtend<ReactElement>();
  });

  it('refuses a set another store resolved, because the schemas differ', () => {
    FeatureProvider({
      features,
      // @ts-expect-error -- `hero` declares no `cta`, so its set answers no key
      // a component under this provider may read.
      decisions: hero.snapshot({ targetingKey: 'cust-0042' }),
    });
  });
});

describe('the factory across the boundary', () => {
  it('takes a store the application built and keeps its schema', () => {
    const bound = createFeatureContext(features);

    expectTypeOf(bound.useVariant('cta').variant).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it("types the bound provider's set on the factory's schema", () => {
    const bound = createFeatureContext(features);

    expectTypeOf(bound.FeatureProvider).toBeCallableWith({
      decisions: features.snapshot({ targetingKey: 'cust-0042' }),
    });
  });

  it('refuses a store of another schema at the bound provider', () => {
    const bound = createFeatureContext(features);

    bound.FeatureProvider({
      // @ts-expect-error -- the factory holds `cta` and `banner`, and a
      // substituted store carries the same schema.
      features: hero,
    });
  });

  it('leaves features optional on the bound props and required on the wide ones', () => {
    expectTypeOf<BoundFeatureProviderProps<OneKey>['features']>().toEqualTypeOf<
      CoreFeatures<OneKey, boolean> | undefined
    >();
    expectTypeOf<
      undefined extends FeatureProviderProps<OneKey>['features'] ? true : false
    >().toEqualTypeOf<false>();
  });
});
