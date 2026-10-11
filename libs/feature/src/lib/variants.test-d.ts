import { describe, expectTypeOf, it } from 'vitest';

import {
  assignVariant as publishedAssignVariant,
  variantSeedOf as publishedVariantSeedOf,
} from '../index.js';
import { assignVariant, variantSeedOf } from './variants.js';
import type { VariantAssignment } from './variants.js';
import type {
  FeatureDefinition,
  RolloutSpec,
  Schema,
  VariantInfo,
  VariantSpec,
} from './types.js';

/**
 * The variant surface a consumer annotates against: the two calls, the three
 * types a document author writes, and the one a reader of an assignment reads.
 *
 * The values are in `variants.spec.ts`. What is here is the shape each name
 * promises, and the two generics erase differently -- the key parameterises
 * what each call takes and neither narrows what it answers.
 */

/** A numeric key union, which is the form `FeatureKey` admits beside a string. */
enum Flag {
  CheckoutCta = 1,
  ExpressPickup = 2,
}

const cta: FeatureDefinition<'checkout-cta'> = {
  key: 'checkout-cta',
  enabled: true,
  variants: [
    { name: 'control', weight: 50 },
    { name: 'blue', weight: 50 },
  ],
};

describe('VariantSpec', () => {
  it('requires a name and a weight and leaves the rest to the author', () => {
    expectTypeOf<VariantSpec['name']>().toEqualTypeOf<string>();
    expectTypeOf<VariantSpec['weight']>().toEqualTypeOf<number>();
    expectTypeOf<VariantSpec['order']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<VariantSpec['value']>().toEqualTypeOf<unknown>();
  });

  it('refuses a variant declaring no weight', () => {
    // @ts-expect-error -- a share every other variant is normalised against is
    // not a member an author may leave out.
    const spec: VariantSpec = { name: 'control' };
    expectTypeOf(spec).toEqualTypeOf<VariantSpec>();
  });
});

describe('RolloutSpec', () => {
  it('requires a percentage and leaves the field and the seed optional', () => {
    expectTypeOf<RolloutSpec['percent']>().toEqualTypeOf<number>();
    expectTypeOf<RolloutSpec['by']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<RolloutSpec['seed']>().toEqualTypeOf<string | undefined>();
  });

  it('refuses a rollout declaring no percentage', () => {
    // @ts-expect-error -- a rollout with no share names no cohort.
    const rollout: RolloutSpec = { by: 'shopperId' };
    expectTypeOf(rollout).toEqualTypeOf<RolloutSpec>();
  });
});

describe('VariantInfo', () => {
  it('records the variant name and the value it carries', () => {
    expectTypeOf<VariantInfo['variant']>().toEqualTypeOf<string>();
    expectTypeOf<VariantInfo['value']>().toEqualTypeOf<unknown>();
  });

  it('is what a schema maps a feature with variants to', () => {
    const schema: Schema = {
      'checkout-cta': { variant: 'blue', value: '#1f6feb' },
    };

    expectTypeOf(schema['checkout-cta']).toEqualTypeOf<
      VariantInfo | undefined
    >();
  });

  it('leaves never at a feature declaring no variants', () => {
    // `Schema`'s value is `VariantInfo | never`, which collapses to
    // `VariantInfo`, so the member is assignable and `Decisions` reads the
    // `never` an inferred schema writes. `schema.test-d.ts` holds that side.
    const schema: Record<'express-pickup', never> = {} as Record<
      'express-pickup',
      never
    >;

    expectTypeOf<typeof schema>().toMatchTypeOf<Schema>();
  });
});

describe('VariantAssignment', () => {
  it('names the three ways a subject reached its variant and no fourth', () => {
    // The page states this union and states that `'pinned'` is not in it,
    // because only `decide` knows which rule matched.
    expectTypeOf<VariantAssignment['source']>().toEqualTypeOf<
      'weighted' | 'sticky' | 'fallback'
    >();
  });

  it('carries the chosen spec, the field and an optional bucket', () => {
    expectTypeOf<VariantAssignment['variant']>().toEqualTypeOf<VariantSpec>();
    expectTypeOf<VariantAssignment['by']>().toEqualTypeOf<string>();
    expectTypeOf<VariantAssignment['bucket']>().toEqualTypeOf<
      number | undefined
    >();
  });
});

describe('assignVariant', () => {
  it('answers an assignment or nothing', () => {
    expectTypeOf(
      assignVariant(cta, { targetingKey: 'cust-0101' }),
    ).toEqualTypeOf<VariantAssignment | undefined>();
  });

  it('answers the same type for a definition keyed on a literal', () => {
    // The key parameterises what the call takes. Nothing about the answer
    // narrows with it, so a reader checks `source` and not the key.
    expectTypeOf(assignVariant(cta, {})).toEqualTypeOf<
      VariantAssignment | undefined
    >();
  });

  it('takes a definition keyed on a number', () => {
    const numbered: FeatureDefinition<Flag> = {
      key: Flag.CheckoutCta,
      enabled: true,
      variants: [{ name: 'control', weight: 100 }],
    };

    expectTypeOf(assignVariant(numbered, {})).toEqualTypeOf<
      VariantAssignment | undefined
    >();
  });

  it('takes a definition declaring no variants, which answers nothing', () => {
    expectTypeOf(
      assignVariant({ key: 'express-pickup', enabled: true }, {}),
    ).toEqualTypeOf<VariantAssignment | undefined>();
  });

  it('refuses a context that is not one', () => {
    // @ts-expect-error -- the second parameter is an `EvaluationContext`, and a
    // caller handing it a bucketing value direct has skipped the field name.
    assignVariant(cta, 'cust-0101');
  });

  it('requires the context, which has no default', () => {
    // @ts-expect-error -- `features.resolve` defaults the context and this does
    // not, because a caller reaching this function owns the clock too.
    assignVariant(cta);
  });
});

describe('variantSeedOf', () => {
  it('answers text for a definition keyed either way', () => {
    const numbered: FeatureDefinition<Flag> = {
      key: Flag.ExpressPickup,
      enabled: true,
    };

    expectTypeOf(variantSeedOf(cta)).toEqualTypeOf<string>();
    expectTypeOf(variantSeedOf(numbered)).toEqualTypeOf<string>();
  });

  it('refuses a key on its own', () => {
    // @ts-expect-error -- the seed is composed from `variantSeed`, `seed` and
    // the key, so the whole definition is what answers it.
    variantSeedOf('checkout-cta');
  });
});

describe('the published declarations', () => {
  it('publishes both calls at the declaration this file read', () => {
    expectTypeOf(publishedAssignVariant).toEqualTypeOf<typeof assignVariant>();
    expectTypeOf(publishedVariantSeedOf).toEqualTypeOf<typeof variantSeedOf>();
  });
});
