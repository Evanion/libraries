import { describe, expectTypeOf, it } from 'vitest';

import { createFeatures } from './features.js';
import { resolvePlan } from './resolve-plan.js';
import type { ResolvePlanOptions } from './resolve-plan.js';
import type { DivergenceObserver } from './divergence.js';

const definitions = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
  { key: 'banner', enabled: false },
] as const;

describe('resolvePlan', () => {
  it('answers every configured key for a plan naming none of them', () => {
    const features = createFeatures(definitions);

    expectTypeOf(resolvePlan(features, {}).cta.variant).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('answers the configured value type for a variant that declares one', () => {
    const features = createFeatures(definitions);

    expectTypeOf(resolvePlan(features, {}).cta.value).toEqualTypeOf<
      { readonly label: 'Get it' } | undefined
    >();
  });

  it('answers the variant union a store carrying an observer plans', () => {
    const features = createFeatures(definitions, { observe: () => undefined });

    expectTypeOf(
      resolvePlan(features, features.plan()).cta.variant,
    ).toEqualTypeOf<'control' | 'blue' | undefined>();
  });

  it('narrows a report key to the keys the store holds', () => {
    const features = createFeatures(definitions);

    resolvePlan(
      features,
      {},
      {},
      {
        onDivergence: (report) => {
          expectTypeOf(report.key).toEqualTypeOf<
            'cta' | 'banner' | undefined
          >();
        },
      },
    );
  });

  it('takes an instant as a Date and nothing else', () => {
    const features = createFeatures(definitions);

    expectTypeOf(
      // @ts-expect-error -- `now` is a `Date`, not an ISO string.
      resolvePlan(features, {}, {}, { now: '2031-01-01T00:00:00Z' }),
    ).not.toBeNever();
  });

  it('refuses a plan entry naming a variant the feature does not declare', () => {
    const features = createFeatures(definitions);

    expectTypeOf(
      resolvePlan(features, {
        cta: {
          key: 'cta',
          resolved: 'deferred',
          needs: [],
          decision: {
            key: 'cta',
            enabled: true,
            reason: 'default-on',
            // @ts-expect-error -- `green` is not a declared variant.
            variant: 'green',
          },
        },
      }),
    ).not.toBeNever();
  });

  it('refuses a plan entry keyed on a feature the store does not hold', () => {
    const features = createFeatures(definitions);

    expectTypeOf(
      resolvePlan(features, {
        // @ts-expect-error -- no feature is keyed `nope`.
        nope: { key: 'nope', resolved: true, needs: [] },
      }),
    ).not.toBeNever();
  });

  it('declares no variant member on a feature that has none', () => {
    const features = createFeatures(definitions);

    expectTypeOf(resolvePlan(features, {}).banner).not.toHaveProperty(
      'variant',
    );
  });

  it('defaults the options key to the loose feature key', () => {
    expectTypeOf<ResolvePlanOptions['onDivergence']>().toEqualTypeOf<
      DivergenceObserver<string> | undefined
    >();
  });
});
