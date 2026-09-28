import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';
import type { FeatureDefinition } from './types.js';

describe('createFeatures, inferring', () => {
  it('narrows variantOf to the names a feature declares', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50, value: { label: 'Get it' } },
        ],
      },
    ]);

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('refuses a key the definitions do not declare', () => {
    const features = createFeatures([{ key: 'cta', enabled: true }]);

    // @ts-expect-error nothing declares this key
    features.variantOf('nope');
  });
});

describe('createFeatures, explicit', () => {
  interface MyFlags {
    cta: { variant: 'control' | 'blue'; value: { label: string } };
  }

  it('takes an interface as its schema', () => {
    const features = createFeatures<MyFlags>(JSON.parse('[]'));

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
    expectTypeOf(features.valueOf('cta')).toEqualTypeOf<
      { label: string } | undefined
    >();
  });
});

describe('the const type parameter', () => {
  it('infers from a bare array literal with no as const', () => {
    // A consumer who must remember `as const` will forget, and the failure is a
    // silent widening to string, and no error reports it.
    const features = createFeatures([
      { key: 'cta', enabled: true, variants: [{ name: 'only', weight: 1 }] },
    ]);

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<'only' | undefined>();
  });
});

describe('the explicit schema checks the definitions', () => {
  interface MyFlags {
    cta: { variant: 'control' | 'blue'; value: { label: string } };
  }

  it('refuses a definition naming a key the schema does not declare', () => {
    createFeatures<MyFlags>([
      // @ts-expect-error the schema declares `cta`, and `keys` would report a
      // feature the store never holds.
      { key: 'totally-unrelated', enabled: true },
    ]);
  });

  it('accepts a definition naming a key the schema declares', () => {
    const features = createFeatures<MyFlags>([{ key: 'cta', enabled: true }]);

    expectTypeOf(features.keys).toEqualTypeOf<readonly 'cta'[]>();
  });
});

describe('a definitions array with no literals to read', () => {
  const definitions: FeatureDefinition<'cta'>[] = [
    { key: 'cta', enabled: true, variants: [{ name: 'only', weight: 1 }] },
  ];

  it('refuses the inferring form, which would map every variant to never', () => {
    createFeatures(
      // @ts-expect-error `FeatureDefinition` declares `variants` optionally, so
      // an array type carries no variant names to infer. Name the schema.
      definitions,
    );
  });

  it('narrows through a named schema', () => {
    const features = createFeatures<{ cta: { variant: 'only' } }>(definitions);

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<'only' | undefined>();
  });
});

describe('the never guard on the two readers', () => {
  it('types both readers as undefined for a feature declaring no variants', () => {
    const features = createFeatures([{ key: 'plain', enabled: true }]);

    expectTypeOf(features.variantOf('plain')).toEqualTypeOf<undefined>();
    expectTypeOf(features.valueOf('plain')).toEqualTypeOf<undefined>();
  });
});
