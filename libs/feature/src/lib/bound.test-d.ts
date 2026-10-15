import { describe, expectTypeOf, it } from 'vitest';

import { createFeatures } from './features.js';
import type { DeepReadonly } from './observe.js';
import type { Decisions } from './types.js';

describe('BoundFeatures', () => {
  it('answers the variant-name union from variantOf on a literal store', () => {
    const handle = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ] as const).for({ targetingKey: 'cust-0042' });

    expectTypeOf(handle.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('answers the deeply readonly form from resolve on a store carrying an observer', () => {
    const handle = createFeatures(
      [{ key: 'banner', enabled: false }] as const,
      {
        observe: () => undefined,
      },
    ).for();

    expectTypeOf(handle.resolve()).toEqualTypeOf<
      DeepReadonly<Decisions<{ banner: never }>>
    >();
  });

  it('carries no toggle', () => {
    const handle = createFeatures([{ key: 'banner', enabled: false }]).for();

    expectTypeOf(handle).not.toHaveProperty('toggle');
  });
});
