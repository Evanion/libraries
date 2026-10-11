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
import { createFeatureContext, FeatureProvider } from './index.js';
import type {
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
