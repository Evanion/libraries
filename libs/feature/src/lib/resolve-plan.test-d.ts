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
