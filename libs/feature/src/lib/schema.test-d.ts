import { describe, expectTypeOf, it } from 'vitest';
import type {
  Condition,
  Decisions,
  InferSchema,
  Plan,
  RuleOutcome,
} from './types.js';

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

const mixed = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
] as const;

type Mixed = InferSchema<typeof mixed>;

/** A schema a consumer writes by hand for a store built from JSON. */
interface Written {
  cta: { variant: 'control' | 'blue'; value: { label: string } };
  nav: never;
}

describe('InferSchema', () => {
  it('reads a variant union off a feature that declares variants', () => {
    expectTypeOf<S['cta']['variant']>().toEqualTypeOf<'control' | 'blue'>();
  });

  it('reads the value union off the same feature', () => {
    expectTypeOf<S['cta']['value']>().toEqualTypeOf<
      { readonly label: 'Buy' } | { readonly label: 'Get it' }
    >();
  });

  it('keeps the value of the one variant declaring it', () => {
    expectTypeOf<Mixed['cta']['value']>().toEqualTypeOf<{
      readonly label: 'Get it';
    }>();
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

  it('narrows the value per key', () => {
    expectTypeOf<Decisions<S>['cta']['value']>().toEqualTypeOf<
      { readonly label: 'Buy' } | { readonly label: 'Get it' } | undefined
    >();
  });

  it('narrows the value of a set where one variant declares none', () => {
    expectTypeOf<Decisions<Mixed>['cta']['value']>().toEqualTypeOf<
      { readonly label: 'Get it' } | undefined
    >();
  });

  it('takes a hand-written interface as its schema', () => {
    expectTypeOf<Decisions<Written>['cta']['variant']>().toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });
});

describe('Plan', () => {
  it('narrows the variant per key', () => {
    expectTypeOf<
      NonNullable<Plan<S>['cta']['decision']>['variant']
    >().toEqualTypeOf<'control' | 'blue' | undefined>();
  });

  it('narrows the value per key', () => {
    expectTypeOf<
      NonNullable<Plan<S>['cta']['decision']>['value']
    >().toEqualTypeOf<
      { readonly label: 'Buy' } | { readonly label: 'Get it' } | undefined
    >();
  });

  it('omits the variant fields for a feature declaring none', () => {
    expectTypeOf<NonNullable<Plan<S>['nav']['decision']>>().not.toHaveProperty(
      'variant',
    );
    expectTypeOf<NonNullable<Plan<S>['nav']['decision']>>().not.toHaveProperty(
      'value',
    );
  });

  it('takes a hand-written interface as its schema', () => {
    expectTypeOf<
      NonNullable<Plan<Written>['cta']['decision']>['variant']
    >().toEqualTypeOf<'control' | 'blue' | undefined>();
  });

  it('types the resolution as a boolean or the deferred marker', () => {
    expectTypeOf<Plan<S>['cta']['resolved']>().toEqualTypeOf<
      boolean | 'deferred'
    >();
  });

  it('types the outstanding fields as a readonly list of names', () => {
    expectTypeOf<Plan<S>['cta']['needs']>().toEqualTypeOf<readonly string[]>();
  });

  it('types the per-rule breakdown a refuted rule fills', () => {
    expectTypeOf<
      NonNullable<Plan<S>['cta']['decision']>['rules']
    >().toEqualTypeOf<readonly RuleOutcome[] | undefined>();
  });

  it('types the condition a refuted rule blames', () => {
    expectTypeOf<
      NonNullable<
        NonNullable<Plan<S>['cta']['decision']>['rules']
      >[number]['failed']
    >().toEqualTypeOf<Condition | undefined>();
  });

  it('keeps the breakdown off a feature declaring no variants too', () => {
    expectTypeOf<
      NonNullable<Plan<S>['nav']['decision']>['rules']
    >().toEqualTypeOf<readonly RuleOutcome[] | undefined>();
  });
});

describe('the never guard', () => {
  it('omits the variant fields for a feature declaring none', () => {
    // `never extends VariantInfo` is true, so a branch without the tuple wrap
    // gives this feature `variant: never` and no error reports it.
    expectTypeOf<Decisions<S>['nav']>().not.toHaveProperty('variant');
    expectTypeOf<Decisions<S>['nav']>().not.toHaveProperty('value');
  });

  it('keeps the fields a variant-free decision still carries', () => {
    expectTypeOf<Decisions<S>['nav']>().toHaveProperty('enabled');
    expectTypeOf<Decisions<S>['nav']>().toHaveProperty('reason');
  });

  it('keeps every other field Decision declares on a variant-free entry', () => {
    // `Omit<Decision, 'variant' | 'value'>` drops those two keys and nothing
    // else, so the api reference cannot say a variant-free decision carries
    // `key`, `enabled` and `reason` alone.
    expectTypeOf<Decisions<S>['nav']>().toHaveProperty('rule');
    expectTypeOf<Decisions<S>['nav']>().toHaveProperty('rules');
    expectTypeOf<Decisions<S>['nav']>().toHaveProperty('blockedBy');
    expectTypeOf<Decisions<S>['nav']>().toHaveProperty('cause');
    expectTypeOf<Decisions<S>['nav']>().toHaveProperty('assignment');
  });
});

enum Flag {
  Cta = 1,
  Nav = 2,
}

describe('a numeric key', () => {
  interface NumericSchema {
    [Flag.Cta]: { variant: 'control' | 'blue' };
    [Flag.Nav]: never;
  }

  it('narrows a schema keyed on a numeric enum', () => {
    expectTypeOf<Decisions<NumericSchema>[Flag.Cta]['variant']>().toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
    expectTypeOf<
      Decisions<NumericSchema>[Flag.Cta]['key']
    >().toEqualTypeOf<Flag.Cta>();
  });

  it('drops the variant fields for the numeric key declaring none', () => {
    expectTypeOf<Decisions<NumericSchema>[Flag.Nav]>().not.toHaveProperty(
      'variant',
    );
  });

  it('refuses the key union on its own', () => {
    // `Decisions<S>` constrains `S` to `Record<keyof S, VariantInfo | never>`,
    // so a schema is a record and the key union alone does not satisfy it.
    type Bad = Decisions<
      // @ts-expect-error TS2344: Type 'Flag' does not satisfy the constraint
      Flag.Cta | Flag.Nav
    >;
    expectTypeOf<Bad>().not.toBeNever();
  });
});
