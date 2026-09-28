import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';
import type { FeatureEvent } from './observe.js';

const defs = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
] as const;

describe('the options parameter', () => {
  it('leaves inference alone', () => {
    const features = createFeatures(defs, { observe: () => undefined });

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('takes an observer returning nothing and one returning a promise', () => {
    createFeatures(defs, { observe: () => undefined });
    createFeatures(defs, { observe: async () => undefined });
  });
});

describe('FeatureEvent', () => {
  it('discriminates on type', () => {
    const read = (event: FeatureEvent) => {
      if (event.type === 'is-enabled') return event.key;
      if (event.type === 'resolve') return event.decisions;
      if (event.type === 'plan') return event.plan;
      return event.result;
    };

    expectTypeOf(read).toBeCallableWith({
      type: 'toggle',
      at: new Date(),
      result: { ok: false, key: 'cta', error: 'unknown-feature' },
    });
  });
});
