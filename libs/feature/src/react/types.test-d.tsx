import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from '../lib/features.js';
import type { Decision, FeatureKey } from '../lib/types.js';
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
  { key: 'banner', enabled: false },
]);

describe('the wide hooks', () => {
  it('return the erased decision, which is true under any provider', () => {
    // `Decision<FeatureKey>`, not `Decision`: `F` defaults to `string` and a
    // store keyed on a numeric enum resolves a `Decision<7>`, whose `key` a
    // `Decision` does not accept.
    expectTypeOf(useFeature('cta')).toEqualTypeOf<Decision<FeatureKey>>();
  });

  it('read a variant off the erased decision', () => {
    expectTypeOf(useVariant('cta')).toEqualTypeOf<
      Pick<Decision, 'variant' | 'value'>
    >();
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

  it('answer undefined for a key the store declares no variants on', () => {
    expectTypeOf(bound.useVariant('banner')).toEqualTypeOf<{
      variant?: undefined;
      value?: undefined;
    }>();
  });

  it('refuse a key the store does not carry', () => {
    // @ts-expect-error the store declares no such key
    bound.useFeature('nope');
  });
});
