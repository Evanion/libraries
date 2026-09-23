import { describe, expect, it } from 'vitest';
import {
  DuplicateVariantError,
  FeatureConfigError,
  UnknownVariantError,
} from './errors.js';
import {
  assignVariant,
  assignWeighted,
  bucketingOrder,
  validateVariants,
  variantSeedOf,
} from './variants.js';

describe('validateVariants', () => {
  it('accepts a feature declaring no variants', () => {
    expect(() => validateVariants({ key: 'k', enabled: true })).not.toThrow();
  });

  it('accepts a single variant, which is how a value flag is written', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'only', weight: 1, value: { label: 'Buy' } }],
      }),
    ).not.toThrow();
  });

  it('refuses two variants sharing a name', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 1 },
          { name: 'a', weight: 1 },
        ],
      }),
    ).toThrow(DuplicateVariantError);
  });

  it('refuses a rule pinning a variant the feature does not declare', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: 1 }],
        rules: [{ variant: 'b' }],
      }),
    ).toThrow(UnknownVariantError);
  });

  it('refuses a negative weight', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: -1 }],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a weight that is not finite', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: Number.NaN }],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a variant set whose weights are all zero', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 0 },
          { name: 'b', weight: 0 },
        ],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a weight total that overflows to infinity', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: Number.MAX_VALUE },
          { name: 'b', weight: Number.MAX_VALUE },
        ],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('accepts a large weight that leaves the total finite', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: Number.MAX_VALUE / 4 },
          { name: 'b', weight: 1 },
        ],
      }),
    ).not.toThrow();
  });

  it('refuses an empty variant array', () => {
    expect(() =>
      validateVariants({ key: 'k', enabled: true, variants: [] }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses two variants sharing an order', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 1, order: 0 },
          { name: 'b', weight: 1, order: 0 },
        ],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses an order that is not a non-negative integer', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: 1, order: 1.5 }],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a partial order declaration, which mixes two orderings', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 1, order: 0 },
          { name: 'b', weight: 1 },
        ],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('names the feature and the variant in a duplicate-name message', () => {
    expect(() =>
      validateVariants({
        key: 'checkout',
        enabled: true,
        variants: [
          { name: 'blue', weight: 1 },
          { name: 'blue', weight: 1 },
        ],
      }),
    ).toThrow(/checkout.*blue|blue.*checkout/);
  });
});

describe('bucketingOrder', () => {
  it('walks the array order when no variant declares one', () => {
    const order = bucketingOrder([
      { name: 'control', weight: 1 },
      { name: 'blue', weight: 1 },
    ]);

    expect(order.map((each) => each.name)).toEqual(['control', 'blue']);
  });

  it('walks ascending order when every variant declares one', () => {
    const order = bucketingOrder([
      { name: 'blue', weight: 1, order: 1 },
      { name: 'control', weight: 1, order: 0 },
    ]);

    expect(order.map((each) => each.name)).toEqual(['control', 'blue']);
  });

  it('walks a permuted array identically once order is declared', () => {
    const a = bucketingOrder([
      { name: 'control', weight: 1, order: 0 },
      { name: 'blue', weight: 1, order: 1 },
    ]);
    const b = bucketingOrder([
      { name: 'blue', weight: 1, order: 1 },
      { name: 'control', weight: 1, order: 0 },
    ]);

    expect(a.map((each) => each.name)).toEqual(b.map((each) => each.name));
  });

  it("leaves the caller's array untouched", () => {
    const variants = [
      { name: 'blue', weight: 1, order: 1 },
      { name: 'control', weight: 1, order: 0 },
    ];
    bucketingOrder(variants);

    expect(variants.map((each) => each.name)).toEqual(['blue', 'control']);
  });
});

describe('assignWeighted', () => {
  const evenPair = [
    { name: 'control', weight: 50 },
    { name: 'blue', weight: 50 },
  ];

  it('gives the lower band to a low bucket', () => {
    expect(assignWeighted(evenPair, 0).name).toBe('control');
    expect(assignWeighted(evenPair, 0.49).name).toBe('control');
  });

  it('gives the upper band to a high bucket', () => {
    expect(assignWeighted(evenPair, 0.51).name).toBe('blue');
    expect(assignWeighted(evenPair, 0.999).name).toBe('blue');
  });

  it('gives a bucket landing on a boundary to the upper band', () => {
    expect(assignWeighted(evenPair, 0.5).name).toBe('blue');
  });

  it('gives everything to a single variant', () => {
    const only = [{ name: 'only', weight: 7 }];

    expect(assignWeighted(only, 0).name).toBe('only');
    expect(assignWeighted(only, 0.999).name).toBe('only');
  });

  it('never assigns a variant weighted zero', () => {
    const withZero = [
      { name: 'off', weight: 0 },
      { name: 'on', weight: 1 },
    ];

    for (const bucket of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(assignWeighted(withZero, bucket).name).toBe('on');
    }
  });

  it('normalises weights that do not sum to 100', () => {
    const thirds = [
      { name: 'a', weight: 1 },
      { name: 'b', weight: 1 },
      { name: 'c', weight: 1 },
    ];

    expect(assignWeighted(thirds, 0.0).name).toBe('a');
    expect(assignWeighted(thirds, 0.5).name).toBe('b');
    expect(assignWeighted(thirds, 0.9).name).toBe('c');
  });

  it('assigns every bucket in [0, 1) to some variant', () => {
    const uneven = [
      { name: 'a', weight: 30 },
      { name: 'b', weight: 20 },
    ];

    for (let i = 0; i < 1000; i += 1) {
      const assigned = assignWeighted(uneven, i / 1000);
      expect(['a', 'b']).toContain(assigned.name);
    }
  });

  it('moves subjects only between the last two bands when a variant is appended', () => {
    const before = [
      { name: 'a', weight: 50 },
      { name: 'b', weight: 50 },
    ];
    const after = [
      { name: 'a', weight: 50 },
      { name: 'b', weight: 30 },
      { name: 'c', weight: 20 },
    ];

    for (let i = 0; i < 1000; i += 1) {
      const bucket = i / 1000;
      const was = assignWeighted(before, bucket).name;
      const now = assignWeighted(after, bucket).name;
      if (was === 'a') expect(now).toBe('a');
      else expect(['b', 'c']).toContain(now);
    }
  });
});

describe('variantSeedOf', () => {
  it('defaults to the key with a variant suffix', () => {
    expect(variantSeedOf({ key: 'cta', enabled: true })).toBe('cta:variant');
  });

  it('builds on the feature seed when one is given', () => {
    expect(variantSeedOf({ key: 'cta', enabled: true, seed: 'autumn' })).toBe(
      'autumn:variant',
    );
  });

  it('takes an explicit variantSeed unchanged', () => {
    expect(
      variantSeedOf({ key: 'cta', enabled: true, variantSeed: 'fixed' }),
    ).toBe('fixed');
  });

  it('separates the variant bucket from the rollout bucket', () => {
    // The correctness point of this feature. One seed for both would put every
    // member of a 20% rollout in the lowest 20% of the variant space.
    const definition = { key: 'cta', enabled: true };
    const rolloutSeed = String(definition.key);

    expect(variantSeedOf(definition)).not.toBe(rolloutSeed);
  });
});

describe('assignVariant', () => {
  const cta = {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  };

  it('returns nothing for a feature declaring no variants', () => {
    expect(
      assignVariant({ key: 'k', enabled: true }, { targetingKey: 'u' }),
    ).toBeUndefined();
  });

  it('buckets on targetingKey by default', () => {
    const assignment = assignVariant(cta, { targetingKey: 'user-1' });

    expect(assignment?.source).toBe('weighted');
    expect(assignment?.by).toBe('targetingKey');
    expect(assignment?.bucket).toBeGreaterThanOrEqual(0);
    expect(assignment?.bucket).toBeLessThan(1);
    expect(['control', 'blue']).toContain(assignment?.variant.name);
  });

  it('buckets on the field variantBy names', () => {
    const byAccount = { ...cta, variantBy: 'accountId' };
    const assignment = assignVariant(byAccount, { accountId: 'acct-9' });

    expect(assignment?.by).toBe('accountId');
    expect(assignment?.source).toBe('weighted');
  });

  it('gives one subject the same variant every time', () => {
    const first = assignVariant(cta, { targetingKey: 'user-1' });
    const second = assignVariant(cta, { targetingKey: 'user-1' });

    expect(second?.variant.name).toBe(first?.variant.name);
  });

  it('buckets a numeric key the same as its string spelling', () => {
    const asNumber = assignVariant(cta, { targetingKey: 42 as never });
    const asString = assignVariant(cta, { targetingKey: '42' });

    expect(asNumber?.variant.name).toBe(asString?.variant.name);
  });

  it('gives the control to a context carrying no bucketing value', () => {
    const assignment = assignVariant(cta, {});

    expect(assignment?.variant.name).toBe('control');
    expect(assignment?.source).toBe('fallback');
    expect(assignment?.bucket).toBeUndefined();
  });

  it('gives the control when the bucketing field holds an object', () => {
    const assignment = assignVariant(cta, { targetingKey: {} as never });

    expect(assignment?.source).toBe('fallback');
  });

  it('reads the control as the first variant in the bucketing order', () => {
    const reordered = {
      ...cta,
      variants: [
        { name: 'blue', weight: 50, order: 1 },
        { name: 'control', weight: 50, order: 0 },
      ],
    };

    expect(assignVariant(reordered, {})?.variant.name).toBe('control');
  });

  it('takes a prior assignment the context carries', () => {
    const assignment = assignVariant(cta, {
      targetingKey: 'user-1',
      stickyVariants: { cta: 'blue' },
    });

    expect(assignment?.variant.name).toBe('blue');
    expect(assignment?.source).toBe('sticky');
  });

  it('holds a subject still across a reweighting', () => {
    const sticky = { targetingKey: 'user-1', stickyVariants: { cta: 'blue' } };
    const reweighted = {
      ...cta,
      variants: [
        { name: 'control', weight: 90 },
        { name: 'blue', weight: 10 },
      ],
    };

    expect(assignVariant(reweighted, sticky)?.variant.name).toBe('blue');
  });

  it('ignores a prior assignment for another feature', () => {
    const assignment = assignVariant(cta, {
      targetingKey: 'user-1',
      stickyVariants: { other: 'blue' },
    });

    expect(assignment?.source).toBe('weighted');
  });

  it('falls through to the weights for a variant no longer declared', () => {
    // A variant an operator removed must not pin a subject to something that
    // does not exist, and throwing would take down a render over stale session
    // data.
    const assignment = assignVariant(cta, {
      targetingKey: 'user-1',
      stickyVariants: { cta: 'retired' },
    });

    expect(assignment?.source).toBe('weighted');
    expect(['control', 'blue']).toContain(assignment?.variant.name);
  });

  it('takes a prior assignment even with no bucketing value', () => {
    const assignment = assignVariant(cta, { stickyVariants: { cta: 'blue' } });

    expect(assignment?.variant.name).toBe('blue');
    expect(assignment?.source).toBe('sticky');
  });
});
