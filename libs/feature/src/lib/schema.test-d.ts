import { describe, expectTypeOf, it } from 'vitest';
import type {
  Condition,
  Decisions,
  InferSchema,
  Plan,
  RuleOutcome,
  Schema,
} from './types.js';
import type { FrozenWhenObserved } from './observe.js';
import { parseFeatureConfig } from './parse.js';
import type { Features, DecisionSet } from '../index.js';

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

// A declaration a framework demands: the slot a Nest token, an Astro `locals`
// member or a React Router context writes, where the store's schema arrived at
// runtime.
declare const held: Features;
declare const unobserved: Features<Schema, false>;

type Parsed = Extract<
  ReturnType<typeof parseFeatureConfig>,
  { ok: true }
>['features'];
declare const parsed: Parsed;

describe('the open forms, holding a store built from a document', () => {
  it('accept the store parseFeatureConfig answers', () => {
    expectTypeOf(parseFeatureConfig({ features: [] })).toExtend<
      { ok: true; features: Features } | { ok: false; issues: unknown }
    >();
  });

  it('hand the set off the open slot to the open DecisionSet', () => {
    expectTypeOf(held.snapshot()).toExtend<DecisionSet>();
    expectTypeOf(parsed.snapshot()).toExtend<DecisionSet>();
  });

  // `Frozen` stays `boolean` on the open slot and on a parsed store, so
  // `resolve` and `plan` answer the union of both freezes. The deeply readonly
  // member types a failed window condition's `value` as a `ReadonlyDate`, which
  // the mutable form's `Instant` refuses.
  it('answer both freezes off the open slot, which Decisions and Plan refuse', () => {
    expectTypeOf(held.resolve()).toEqualTypeOf<
      FrozenWhenObserved<boolean, Decisions>
    >();
    expectTypeOf(held.resolve()).not.toExtend<Decisions>();
    expectTypeOf(held.plan()).toEqualTypeOf<
      FrozenWhenObserved<boolean, Plan>
    >();
    expectTypeOf(held.plan()).not.toExtend<Plan>();
    expectTypeOf(parsed.resolve()).not.toExtend<Decisions>();
    expectTypeOf(parsed.plan()).not.toExtend<Plan>();
  });

  it('hand Decisions and Plan what a store with no observer answers', () => {
    expectTypeOf(unobserved.resolve()).toExtend<Decisions>();
    expectTypeOf(unobserved.plan()).toExtend<Plan>();
  });
});
