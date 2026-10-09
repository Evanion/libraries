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
