import type { ReactElement } from 'react';
import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from '../lib/features.js';
import type { Decision, FeatureKey } from '../lib/types.js';
import {
  createFeatureContext,
  FeatureProvider,
  useFeature,
  useVariant,
} from './index.js';

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

describe('the provider', () => {
  const observed = createFeatures(
    [
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50, value: { label: 'Get it' } },
        ],
      },
      { key: 'banner', enabled: false },
    ] as const,
    { observe: () => undefined },
  );

  it('takes the decisions an observed store resolved', () => {
    // The server-render handoff the react page documents. An observed store
    // answers the deeply readonly form, and a prop typed on the mutable form
    // alone refuses it.
    const decisions = observed.resolve({ targetingKey: 'u1' });
    const element: ReactElement = (
      <FeatureProvider features={observed} decisions={decisions} />
    );

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });

  it('binds hooks that answer what an observed store resolves', () => {
    const bound = createFeatureContext(observed);
    const decisions = observed.resolve({ targetingKey: 'u1' });

    expectTypeOf(bound.useFeatures()).toEqualTypeOf<typeof decisions>();
  });

  it('takes them on the bound provider too', () => {
    const bound = createFeatureContext(observed);
    const decisions = observed.resolve({ targetingKey: 'u1' });
    const element: ReactElement = (
      <bound.FeatureProvider decisions={decisions} />
    );

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });
});

describe('the bound hooks over a store with no observer', () => {
  it('answer the mutable decisions the store resolves', () => {
    const bound = createFeatureContext(features);
    const resolved = features.resolve({ targetingKey: 'u1' });

    expectTypeOf(bound.useFeatures()).toEqualTypeOf<typeof resolved>();
  });

  it('answer the mutable decision for one key', () => {
    const bound = createFeatureContext(features);
    const resolved = features.resolve({ targetingKey: 'u1' });

    expectTypeOf(bound.useFeature('cta')).toEqualTypeOf<
      (typeof resolved)['cta']
    >();
  });
});

describe('the bound provider, over the store it is handed', () => {
  const defs = [
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50, value: { label: 'Get it' } },
      ],
    },
  ] as const;
  const plain = createFeatures(defs);
  const watched = createFeatures(defs, { observe: () => undefined });

  it('takes a substituted store that freezes what the factory store freezes', () => {
    const bound = createFeatureContext(plain);

    const element: ReactElement = <bound.FeatureProvider features={plain} />;

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });

  it('refuses a store whose freeze the bound hooks do not describe', () => {
    // The hooks answer the factory store's own form. A store that freezes what
    // it resolves, mounted under a factory built from a store that freezes
    // nothing, would publish frozen decisions to hooks promising the mutable
    // form, and a component writing one of those fields throws.
    const bound = createFeatureContext(plain);

    const element: ReactElement = (
      // @ts-expect-error the factory store freezes nothing and this one freezes
      <bound.FeatureProvider features={watched} />
    );

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });
});
