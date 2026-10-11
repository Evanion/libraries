import { describe, expectTypeOf, it } from 'vitest';

import { createFeatures } from './features.js';
import type {
  AsSchema,
  Definitions,
  DefinitionsOf,
  DefinitionsOrConfig,
  Features,
} from './features.js';
import type { DecisionSet } from './decision-set.js';
import type {
  FeatureConfig,
  FeatureSchema,
  SerializedDefinition,
} from './config.js';
import type {
  FeatureDefinition,
  FeatureKey,
  InferSchema,
  Schema,
  VariantInfo,
  VariantSpec,
} from './types.js';

/**
 * The six names the typed-construction entries of `apps/docs/content/feature/api.mdx`
 * describe, held to what those entries claim.
 *
 * `schema.test-d.ts` holds the two `InferSchema` cases a literal reaches and
 * every `Decisions` and `Plan` narrowing that follows from them.
 * `features.test-d.ts` holds `createFeatures` over a literal, over a document,
 * and the `satisfies`-against-annotation difference a caller sees through
 * `variantOf`. This file holds what neither reaches: the third `InferSchema`
 * case, the arrays and variant lists that are empty or repeated, the input
 * `DefinitionsOf` answers `never` for, the mapping `AsSchema` performs, and the
 * index signature that decides where the `Schema` alias may be written.
 *
 * Every case here is a type assertion. No fixture reads a clock, a host global
 * or an environment variable, so the file answers the same under Node, under a
 * browser bundler and under an edge runtime.
 */

/** A definitions array whose one member declares two variants with values. */
const literal = [
  {
    key: 'preorderBanner',
    enabled: true,
    variants: [
      { name: 'wide', weight: 50, value: { copy: 'Reserve your copy' } },
      { name: 'tall', weight: 50, value: { copy: 'Pre-order now' } },
    ],
  },
] as const satisfies Definitions<'preorderBanner'>;

/** The schema a reader writes by hand for a store built from JSON. */
interface ShopFlags {
  preorderBanner: { variant: 'wide' | 'tall' };
}

declare const handWritten: ShopFlags;

describe('Definitions', () => {
  it('keys the array on FeatureKey when a caller names no key union', () => {
    expectTypeOf<Definitions>().toEqualTypeOf<
      readonly FeatureDefinition<FeatureKey>[]
    >();
  });

  it('closes the array to the keys its parameter names', () => {
    const outside = [
      // @ts-expect-error TS2322: 'preorderBanner' is the only key named.
      { key: 'tournamentMode', enabled: true },
    ] as const satisfies Definitions<'preorderBanner'>;

    expectTypeOf(outside).not.toBeNever();
  });

  it('declares variants optionally, so a member may omit them', () => {
    expectTypeOf<
      readonly [{ readonly key: 'preorderBanner'; readonly enabled: true }]
    >().toExtend<Definitions<'preorderBanner'>>();
  });
});

describe('DefinitionsOrConfig', () => {
  it('admits an array that declares no feature at all', () => {
    // The empty literal is the floor of the bare-array half: no version, no
    // schema and no freshness claim, which is what the entry says an author
    // writing flags in a file owes.
    expectTypeOf<readonly []>().toExtend<
      DefinitionsOrConfig<'preorderBanner'>
    >();
  });

  it('refuses a document whose features name a key outside the union', () => {
    expectTypeOf<{
      readonly features: readonly [
        { readonly key: 'tournamentMode'; readonly enabled: true },
      ];
    }>().not.toExtend<DefinitionsOrConfig<'preorderBanner'>>();
  });

  it('refuses an envelope carrying no features at all', () => {
    expectTypeOf<{
      readonly version: '7';
      readonly schemaVersion: '1';
    }>().not.toExtend<DefinitionsOrConfig<'preorderBanner'>>();
  });
});

describe('DefinitionsOf', () => {
  it('hands an empty definitions array back as itself', () => {
    expectTypeOf<DefinitionsOf<readonly []>>().toEqualTypeOf<readonly []>();
  });

  it('answers never for a value that is neither form', () => {
    expectTypeOf<DefinitionsOf<string>>().toBeNever();
    expectTypeOf<DefinitionsOf<readonly string[]>>().toBeNever();
    expectTypeOf<DefinitionsOf<undefined>>().toBeNever();
  });

  it('answers never for a record declaring no features member', () => {
    expectTypeOf<DefinitionsOf<{ readonly version: '7' }>>().toBeNever();
  });

  it('answers never for a document whose features hold the wrong element', () => {
    // A record carrying `features` is legal for the `{ features: infer F }`
    // test and wrong for the domain. The `extends` clause on the inferred
    // member is what refuses it, so a caller who passed one gets `never` at
    // every schema position rather than a schema built off strings.
    expectTypeOf<
      DefinitionsOf<{ readonly features: readonly string[] }>
    >().toBeNever();
    expectTypeOf<
      DefinitionsOf<{ readonly features: readonly [{ readonly key: 'a' }] }>
    >().toBeNever();
  });

  it('distributes over the union DefinitionsOrConfig declares', () => {
    expectTypeOf<
      DefinitionsOf<DefinitionsOrConfig<'preorderBanner'>>
    >().toEqualTypeOf<
      | readonly FeatureDefinition<'preorderBanner'>[]
      | readonly SerializedDefinition<'preorderBanner'>[]
    >();
  });
});

describe('InferSchema', () => {
  it('maps a member typed FeatureDefinition to VariantInfo', () => {
    // The third case of the entry. `Definitions<K>` declares `variants`
    // optionally, so the compiler reads no names off a member of a plain array
    // type, and `VariantInfo` records that the store still answers a real
    // variant name at runtime.
    expectTypeOf<
      InferSchema<Definitions<'preorderBanner'>>['preorderBanner']
    >().toEqualTypeOf<VariantInfo>();
  });

  it('maps a member carrying no variants key to never', () => {
    // The second case, beside the third, because the entry turns on the
    // difference: an absent key means no variants, an optional key means names
    // the compiler cannot read.
    expectTypeOf<
      InferSchema<
        readonly [{ readonly key: 'tournamentMode'; readonly enabled: true }]
      >['tournamentMode']
    >().toBeNever();
  });

  it('maps a member whose variants are not literal to an open name', () => {
    type Open = InferSchema<
      readonly [
        {
          readonly key: 'preorderBanner';
          readonly enabled: true;
          readonly variants: readonly VariantSpec[];
        },
      ]
    >;

    expectTypeOf<Open['preorderBanner']['variant']>().toEqualTypeOf<string>();
    expectTypeOf<Open['preorderBanner']['value']>().toBeNever();
  });

  it('gives a never variant to a member declaring an empty variant list', () => {
    // Legal for the type and wrong for the domain. A literal empty list fires
    // the first case with nothing in it, so the entry carries `variant: never`
    // and a reader calling `variantOf` is typed `undefined` for a feature that
    // declares no variant to answer with.
    type Empty = InferSchema<
      readonly [
        {
          readonly key: 'preorderBanner';
          readonly enabled: true;
          readonly variants: readonly [];
        },
      ]
    >;

    expectTypeOf<Empty['preorderBanner']['variant']>().toBeNever();
    expectTypeOf<Empty['preorderBanner']['value']>().toBeNever();
  });

  it('answers an empty schema for an array declaring no feature', () => {
    expectTypeOf<InferSchema<readonly []>>().toEqualTypeOf<
      Record<never, never>
    >();
  });

  it('unions the variant names of two members repeating one key', () => {
    // Also legal for the type and wrong for the domain, and the type is not
    // the guard: `createFeatures` throws `DuplicateFeatureError` for this
    // document, which `features.spec.ts` holds. The key remapping collapses
    // the two members into one entry carrying both names, so a reader cannot
    // read a duplicate off the schema.
    type Repeated = InferSchema<
      readonly [
        {
          readonly key: 'preorderBanner';
          readonly enabled: true;
          readonly variants: readonly [
            { readonly name: 'wide'; readonly weight: 1 },
          ];
        },
        {
          readonly key: 'preorderBanner';
          readonly enabled: true;
          readonly variants: readonly [
            { readonly name: 'tall'; readonly weight: 1 },
          ];
        },
      ]
    >;

    expectTypeOf<Repeated['preorderBanner']['variant']>().toEqualTypeOf<
      'wide' | 'tall'
    >();
  });
});

describe('AsSchema', () => {
  it('maps an entry that is no VariantInfo to never', () => {
    expectTypeOf<AsSchema<{ copy: string }>['copy']>().toBeNever();
  });

  it('keeps an entry that is one', () => {
    expectTypeOf<
      AsSchema<{ preorderBanner: VariantInfo }>['preorderBanner']
    >().toEqualTypeOf<VariantInfo>();
  });

  it('keeps the never a feature declaring no variants maps to', () => {
    expectTypeOf<
      AsSchema<{ tournamentMode: never }>['tournamentMode']
    >().toBeNever();
  });

  it('keeps the variant names an inferred schema carries', () => {
    expectTypeOf<
      AsSchema<InferSchema<typeof literal>>['preorderBanner']['variant']
    >().toEqualTypeOf<'wide' | 'tall'>();
  });

  it('makes the constraint hold where the inferred schema alone does not', () => {
    // What the entry claims about why every schema position of the first
    // `createFeatures` signature writes the wrapper. `InferSchema` remaps its
    // keys and `D` is a bare type parameter, so the compiler cannot prove the
    // self-referential constraint before a call resolves.
    type Unproven<D extends DefinitionsOrConfig> = Features<
      // @ts-expect-error TS2344: InferSchema<DefinitionsOf<D>> does not
      // satisfy Record<keyof InferSchema<DefinitionsOf<D>>, VariantInfo>.
      InferSchema<DefinitionsOf<D>>
    >;
    type Proven<D extends DefinitionsOrConfig> = Features<
      AsSchema<InferSchema<DefinitionsOf<D>>>
    >;

    expectTypeOf<Unproven<Definitions<'preorderBanner'>>>().not.toBeNever();
    expectTypeOf<Proven<Definitions<'preorderBanner'>>>().not.toBeNever();
  });
});

describe('Schema', () => {
  it('refuses a hand-written interface in an annotation', () => {
    // @ts-expect-error TS2322: Index signature for type 'string' is missing in
    // type 'ShopFlags'.
    const annotated: Schema = handWritten;

    expectTypeOf(annotated).not.toBeNever();
  });

  it('takes that same interface as the schema a caller names', () => {
    const features = createFeatures<ShopFlags>({
      features: [{ key: 'preorderBanner', enabled: true }],
    });

    expectTypeOf(features.variantOf('preorderBanner')).toEqualTypeOf<
      'wide' | 'tall' | undefined
    >();
  });

  it('takes the same members written as an alias and not as an interface', () => {
    // What the index signature turns on is the declaration form and not the
    // key type. The compiler gives a type alias of an object type an implicit
    // index signature and gives an `interface` none, so the two declarations
    // below hold the same members and only one of them satisfies the alias.
    // A reader who meets `TS2322` and rewrites `interface` as `type` makes the
    // annotation compile, which is why the entry sends them to the named
    // schema parameter and not to a rewrite.
    type AliasFlags = { preorderBanner: { variant: 'wide' | 'tall' } };

    expectTypeOf<AliasFlags>().toExtend<Schema>();
    expectTypeOf<ShopFlags>().not.toExtend<Schema>();
    expectTypeOf<Record<FeatureKey, VariantInfo>>().toExtend<Schema>();
  });

  it('is the schema a decision set defaults to', () => {
    expectTypeOf<DecisionSet>().toEqualTypeOf<DecisionSet<Schema, boolean>>();
  });

  it('types no member of a document, which FeatureSchema does', () => {
    expectTypeOf<FeatureConfig['schema']>().toEqualTypeOf<
      FeatureSchema | undefined
    >();
  });
});
