import { describe, expectTypeOf, it } from 'vitest';
import type { Decisions, InferSchema } from './types.js';

const defs = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50, value: { label: 'Buy' } },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
  { key: 'nav', enabled: true },
] as const;

type S = InferSchema<typeof defs>;

describe('InferSchema', () => {
  it('reads a variant union off a feature that declares variants', () => {
    expectTypeOf<S['cta']['variant']>().toEqualTypeOf<'control' | 'blue'>();
  });

  it('reads the value union off the same feature', () => {
    expectTypeOf<S['cta']['value']>().toEqualTypeOf<
      { readonly label: 'Buy' } | { readonly label: 'Get it' }
    >();
  });

  it('gives never to a feature that declares no variants', () => {
    expectTypeOf<S['nav']>().toEqualTypeOf<never>();
  });
});

describe('Decisions', () => {
  it('narrows the variant per key', () => {
    expectTypeOf<Decisions<S>['cta']['variant']>().toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });
});

describe('the never guard', () => {
  it('omits the variant fields for a feature declaring none', () => {
    // `never extends VariantInfo` is true, so a branch without the tuple wrap
    // gives this feature `variant: never` and no error reports it.
    expectTypeOf<Decisions<S>['nav']['variant']>().toEqualTypeOf<
      string | undefined
    >();
  });
});
