import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures, type Definitions } from './features.js';
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

  type MyFlagsAlias = {
    cta: { variant: 'control' | 'blue'; value: { label: string } };
  };

  it('takes an interface as its schema', () => {
    const features = createFeatures<MyFlags>(JSON.parse('[]'));

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
    expectTypeOf(features.valueOf('cta')).toEqualTypeOf<
      { label: string } | undefined
    >();
  });

  it('takes a type alias as its schema', () => {
    // The constraint on `S` is self-referential, so it admits both forms. An
    // `S extends Schema` constraint carrying an index signature admits the
    // alias and rejects the interface.
    const features = createFeatures<MyFlagsAlias>(JSON.parse('[]'));

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

  it('widens the variant to string, which is what the store can promise', () => {
    // `FeatureDefinition` declares `variants` optionally, so an array type
    // carries no variant names to infer. `string` is the honest answer for a
    // reader whose runtime value is a variant name. `undefined` would be a
    // lie about a value the store does return.
    const features = createFeatures(definitions);

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<string | undefined>();
  });

  it('narrows through a named schema', () => {
    const features = createFeatures<{ cta: { variant: 'only' } }>(definitions);

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<'only' | undefined>();
  });
});

describe('a feature declaring no variants', () => {
  it('types both readers as undefined', () => {
    // `DecisionOf` drops `variant` and `value` for a `never` schema entry, and
    // `infer V` off an absent optional property answers `never`, so both
    // readers arrive at `undefined` with no guard of their own. The guard that
    // does the work sits on `DecisionOf`, and `schema.test-d.ts` pins it by
    // comparing the decision shape against one with both keys omitted.
    const features = createFeatures([{ key: 'plain', enabled: true }]);

    expectTypeOf(features.variantOf('plain')).toEqualTypeOf<undefined>();
    expectTypeOf(features.valueOf('plain')).toEqualTypeOf<undefined>();
  });
});

describe('a definitions array containing a spread', () => {
  const parents: readonly FeatureDefinition<'parent'>[] = [
    { key: 'parent', enabled: true },
  ];

  it('reads the literal members and widens the spread members', () => {
    // A tuple constraint on the inferring overload rejected this call outright.
    // The spread contributes an array type, whose member carries no variant
    // names, and the literal beside it carries its own.
    const features = createFeatures([
      ...parents,
      { key: 'child', enabled: true, variants: [{ name: 'a', weight: 1 }] },
    ]);

    expectTypeOf(features.variantOf('child')).toEqualTypeOf<'a' | undefined>();
    expectTypeOf(features.variantOf('parent')).toEqualTypeOf<
      string | undefined
    >();
  });
});

describe('a definitions variable', () => {
  const satisfied = [
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50, value: { label: 'Buy' } },
        { name: 'blue', weight: 50, value: { label: 'Get it' } },
      ],
    },
  ] as const satisfies Definitions<'cta'>;

  const annotated: Definitions<'cta'> = [
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50, value: { label: 'Buy' } },
        { name: 'blue', weight: 50, value: { label: 'Get it' } },
      ],
    },
  ];

  it('keeps the variant names through as const satisfies', () => {
    const features = createFeatures(satisfied);

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
    expectTypeOf(features.valueOf('cta')).toEqualTypeOf<
      { readonly label: 'Buy' } | { readonly label: 'Get it' } | undefined
    >();
  });

  it('widens them to string through a type annotation', () => {
    // `Definitions` declares `variants` optionally, so the annotation gives the
    // variable a type carrying no variant names. This pins why the docblock
    // sends a caller to `satisfies`.
    const features = createFeatures(annotated);

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<string | undefined>();
    expectTypeOf(features.valueOf('cta')).toEqualTypeOf<unknown>();
  });
});

describe('plan, inferring from the definitions', () => {
  const defs = [
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50, value: { label: 'Get it' } },
      ],
      rules: [{ id: 'eu', when: [{ field: 'region', op: 'eq', value: 'eu' }] }],
    },
  ] as const satisfies Definitions<'cta'>;

  it("narrows a plan entry's variant to the names the feature declares", () => {
    const features = createFeatures(defs);

    expectTypeOf(features.plan({}).cta.decision?.variant).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it("narrows a plan entry's value to the values the feature declares", () => {
    const features = createFeatures(defs);

    expectTypeOf(features.plan({}).cta.decision?.value).toEqualTypeOf<
      { readonly label: 'Get it' } | undefined
    >();
  });
});

describe('createFeatures over a document', () => {
  it('infers the variant union off a document holding a literal', () => {
    const features = createFeatures({
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 50 },
            { name: 'blue', weight: 50 },
          ],
        },
      ],
    } as const);

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });
});
