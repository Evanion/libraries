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

  it('refuses a pin on a feature that declares no variants', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        rules: [{ variant: 'blue' }],
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

  it('takes an empty variantSeed unchanged too', () => {
    // The member is read with `!== undefined` and not with `??`, so an empty
    // string is a seed its author declared. A document that lost the member in
    // transit arrives without it, which is the case `variantErrors` refuses by
    // name, and nothing here has to tell the two apart.
    expect(variantSeedOf({ key: 'cta', enabled: true, variantSeed: '' })).toBe(
      '',
    );
  });

  it('composes an empty feature seed into the variant seed', () => {
    // `seed ?? key` for the same reason: an author who wrote the member owns
    // what it says, and the key does not stand in for it.
    expect(variantSeedOf({ key: 'cta', enabled: true, seed: '' })).toBe(
      ':variant',
    );
  });

  it('spells a numeric feature key into the seed', () => {
    // `FeatureKey` admits a number beside a string, and a Swift or Kotlin port
    // composes the same text for one.
    expect(variantSeedOf({ key: 7, enabled: true })).toBe('7:variant');
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

  it('returns nothing for a feature declaring an empty variants array', () => {
    // A separate branch from the absent member above. `variantErrors` refuses
    // the empty array, so a store never holds one, and a caller handing this
    // function its own object reaches it.
    expect(
      assignVariant(
        { key: 'cta', enabled: true, variants: [] },
        { targetingKey: 'user-1' },
      ),
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

  it('buckets a falsy bucketing value rather than giving the control', () => {
    // The read tests `typeof` for a string or a number, which `0` and `''`
    // both pass. A truthiness test in its place would hand the control to
    // every shopper the application keys `0`, and the experiment would
    // undercount one arm without reporting anything.
    const byShopper = { ...cta, variantBy: 'shopperId' };

    expect(assignVariant(byShopper, { shopperId: 0 })?.source).toBe('weighted');
    expect(assignVariant(byShopper, { shopperId: '' })?.source).toBe(
      'weighted',
    );
  });

  it('gives the control when the bucketing field holds a boolean or null', () => {
    // `EvaluationContext` carries an index signature, so an application that
    // writes a flag or a JSON null at the bucketing field compiles. Neither
    // value names a subject, and the control admits nobody to the experiment.
    const byShopper = { ...cta, variantBy: 'shopperId' };

    expect(assignVariant(byShopper, { shopperId: true })?.source).toBe(
      'fallback',
    );
    expect(assignVariant(byShopper, { shopperId: null })?.source).toBe(
      'fallback',
    );
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

  it('reports no bucket on a sticky assignment the context carried a key for', () => {
    // `VariantAssignment.bucket` is documented as the weighted answer's alone,
    // and the context here carries a bucketing value the sticky branch returns
    // above without hashing. A writer that filled the member anyway would have
    // a reader believe the weights decided this.
    const assignment = assignVariant(cta, {
      targetingKey: 'user-1',
      stickyVariants: { cta: 'blue' },
    });

    expect(assignment?.source).toBe('sticky');
    expect(assignment?.bucket).toBeUndefined();
  });

  it('buckets a prior assignment the context carries as JSON null', () => {
    // A session store round-trips an absent variant as `null`, which is not
    // `undefined`, so the read takes the branch and no declared variant
    // matches. The weights answer and no render fails over stale session data.
    const assignment = assignVariant(cta, {
      targetingKey: 'user-1',
      stickyVariants: { cta: null as never },
    });

    expect(assignment?.source).toBe('weighted');
    expect(['control', 'blue']).toContain(assignment?.variant.name);
  });

  it('reads a sticky entry under the string spelling of a numeric key', () => {
    // The lookup is `String(definition.key)`, and a context the application
    // built from JSON keys the record by the same text.
    const numbered = { key: 7, enabled: true, variants: cta.variants };

    const assignment = assignVariant(numbered, {
      targetingKey: 'user-1',
      stickyVariants: { 7: 'blue' },
    });

    expect(assignment?.source).toBe('sticky');
    expect(assignment?.variant.name).toBe('blue');
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

  it('ignores a prototype property a feature key happens to name', () => {
    const named = {
      key: 'constructor',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    };

    const assignment = assignVariant(named, { targetingKey: 'user-1' });

    expect(assignment?.source).toBe('weighted');
    expect(['control', 'blue']).toContain(assignment?.variant.name);
  });

  it('reads an own sticky entry for a feature key that names a prototype property', () => {
    const named = {
      key: 'toString',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    };

    const assignment = assignVariant(named, {
      targetingKey: 'user-1',
      stickyVariants: { toString: 'blue' },
    });

    expect(assignment?.source).toBe('sticky');
    expect(assignment?.variant.name).toBe('blue');
  });

  describe('a definition validateVariants would have refused', () => {
    /**
     * The docblock's position, and the reference page's: this function throws
     * for none of these and the answer it gives is deterministic and wrong.
     * `createFeatures` and `validateConfig` are the two gates, and a caller
     * that built the definition itself passed neither, so these are the answers
     * a reader who skipped both gets.
     */
    const unusable = (weights: readonly number[]) => ({
      key: 'checkout-cta',
      enabled: true,
      variants: weights.map((weight, at) => ({
        name: `v${String(at)}`,
        weight,
      })),
    });

    const assignedNames = (weights: readonly number[]) =>
      new Set(
        Array.from(
          { length: 200 },
          (_, i) =>
            assignVariant(unusable(weights), {
              targetingKey: `cust-${String(i)}`,
            })?.variant.name,
        ),
      );

    it('answers without throwing for a zero, negative, infinite or NaN weight', () => {
      // `doc-behaviour.test.ts` puts this title on the `assignVariant`
      // reference entry, directly under prose saying the function does not
      // throw for any of these, so the title states what the loop holds.
      for (const weights of [
        [0, 0],
        [-10, 50],
        [Number.POSITIVE_INFINITY, 50],
        [Number.NaN, 50],
        [Number.MAX_VALUE, Number.MAX_VALUE],
      ]) {
        expect(() =>
          assignVariant(unusable(weights), { targetingKey: 'cust-0101' }),
        ).not.toThrow();
      }
    });

    it('hands every subject the last-ordered variant for a set weighted entirely zero', () => {
      // The total is zero, so every band width is 0/0, every comparison
      // against NaN is false, and the loop falls out to the last variant.
      expect(assignedNames([0, 0])).toEqual(new Set(['v1']));
    });

    it('hands every subject the first-ordered variant for a negative weight that cancels the total', () => {
      // The total is zero without the set being all zeros, so the first band
      // divides a positive weight by zero and takes every bucket. The sign of
      // the first non-zero weight decides it: `[-10, 10]` leaves the ceiling
      // at -Infinity, the next addition makes it NaN, and the loop falls out
      // to the last variant the way an all-zero set does.
      expect(assignedNames([10, -10])).toEqual(new Set(['v0']));
      expect(assignedNames([-10, 10])).toEqual(new Set(['v1']));
    });

    it('answers a negative weight from the position the weight sits in', () => {
      // `assignWeighted` sums the weights, so a negative one shrinks the total
      // rather than making it NaN, and some band's ceiling passes 1 and
      // swallows every bucket below it. Which band that is moves with the
      // negative weight's position, so the last-ordered variant is not the
      // answer the way it is for a zero total: the first arrangement makes the
      // negatively weighted variant unreachable, the second makes it the only
      // reachable one, and the third splits the subjects.
      expect(assignedNames([-10, 50])).toEqual(new Set(['v1']));
      expect(assignedNames([50, -10])).toEqual(new Set(['v0']));
      expect(assignedNames([50, -10, 20])).toEqual(new Set(['v0', 'v2']));
    });

    it('hands every subject the last-ordered variant for a weight that is not finite', () => {
      // Both arrangements, because this is the half of the docblock that holds
      // wherever the bad weight sits.
      expect(assignedNames([Number.POSITIVE_INFINITY, 50])).toEqual(
        new Set(['v1']),
      );
      expect(assignedNames([50, Number.POSITIVE_INFINITY])).toEqual(
        new Set(['v1']),
      );
      expect(assignedNames([Number.NaN, 50])).toEqual(new Set(['v1']));
      expect(assignedNames([50, Number.NaN])).toEqual(new Set(['v1']));
    });

    it('hands every subject the last-ordered variant for finite weights whose total overflows', () => {
      // Both weights pass the per-weight check, so `variantErrors` catches
      // this set on the total alone and its message names the overflow. Every
      // band width is `Number.MAX_VALUE / Infinity`, which is 0 and not NaN,
      // so no ceiling passes a bucket and the loop falls out the way it does
      // for an all-zero set.
      expect(assignedNames([Number.MAX_VALUE, Number.MAX_VALUE])).toEqual(
        new Set(['v1']),
      );
    });

    it('walks two variants sharing an order in the order they were declared', () => {
      // `bucketingOrder` sorts on the position and nothing separates a tie.
      // `Array.prototype.sort` has been stable since ES2019, so the first
      // declared keeps the lower band on every engine, and the answer is
      // deterministic without being the one an author who wrote the duplicate
      // meant.
      const tied = {
        key: 'checkout-cta',
        enabled: true,
        variants: [
          { name: 'first', weight: 50, order: 0 },
          { name: 'second', weight: 50, order: 0 },
        ],
      };

      expect(bucketingOrder(tied.variants).map((each) => each.name)).toEqual([
        'first',
        'second',
      ]);
      expect(assignWeighted(tied.variants, 0).name).toBe('first');
      expect(assignWeighted(tied.variants, 0.75).name).toBe('second');
      expect(assignVariant(tied, { targetingKey: 'user-1' })?.source).toBe(
        'weighted',
      );
    });
  });
});
