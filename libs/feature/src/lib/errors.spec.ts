import { describe, expect, it } from 'vitest';

import {
  DuplicateFeatureError,
  DuplicateVariantError,
  FeatureConfigError,
  FeatureCycleError,
  UnknownDependencyError,
  UnknownVariantError,
  createFeatures,
} from '../index.js';
import type { FeatureDefinition, FeatureKey } from '../index.js';

/**
 * The six classes as a caller meets them, through `createFeatures`.
 *
 * `graph.spec.ts` and `variants.spec.ts` hold `buildGraph` and
 * `validateVariants`, which are the internal walks. The reference page's claim
 * is about the published entry point: a caller hands `createFeatures` a
 * configuration, catches one class, and reads the members the entry it looked
 * up names. `collectIssues` sits between those walks and that call and decides
 * which defect is thrown first, so the members a caller reads are a property of
 * the call and not of the walk.
 *
 * Every fixture is a configuration literal. None of them reads a clock, a zone
 * table or a host's structured-clone implementation, so the members asserted
 * below are the same on every runtime the package supports.
 */

/** The error a configuration raises, or the store it built. */
function refusalOf(
  definitions: readonly FeatureDefinition<FeatureKey>[],
): unknown {
  try {
    createFeatures(definitions);
    return 'built';
  } catch (caught) {
    return caught;
  }
}

/** The error a configuration raises, typed for the member reads below. */
function errorOf<E>(
  definitions: readonly FeatureDefinition<FeatureKey>[],
  kind: abstract new (...args: never[]) => E,
): E {
  const caught = refusalOf(definitions);

  expect(caught).toBeInstanceOf(kind);
  return caught as E;
}

/** One configuration per class, each the smallest set that raises it. */
const REFUSED: Readonly<
  Record<string, readonly FeatureDefinition<FeatureKey>[]>
> = {
  FeatureConfigError: [
    {
      key: 'checkout-cta',
      enabled: true,
      variants: [{ name: 'control', weight: Number.NaN }],
    },
  ],
  FeatureCycleError: [
    { key: 'a', enabled: true, dependsOn: ['b'] },
    { key: 'b', enabled: true, dependsOn: ['a'] },
  ],
  UnknownDependencyError: [{ key: 'a', enabled: true, dependsOn: ['b'] }],
  DuplicateFeatureError: [
    { key: 'a', enabled: true },
    { key: 'a', enabled: true },
  ],
  DuplicateVariantError: [
    {
      key: 'checkout-cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'control', weight: 50 },
      ],
    },
  ],
  UnknownVariantError: [
    {
      key: 'checkout-cta',
      enabled: true,
      variants: [{ name: 'control', weight: 100 }],
      rules: [{ id: 'booksellers', variant: 'blue' }],
    },
  ],
};

describe('FeatureConfigError', () => {
  it('catches all six configuration failures in one block', () => {
    const caught = Object.values(REFUSED).map(refusalOf);

    expect(
      caught.filter((each) => each instanceof FeatureConfigError),
    ).toHaveLength(6);
    expect(caught.filter((each) => each instanceof Error)).toHaveLength(6);
  });

  it('carries the class name on `name`, which a second copy of the module still reads', () => {
    const named = Object.fromEntries(
      Object.entries(REFUSED).map(([name, definitions]) => [
        name,
        (refusalOf(definitions) as Error).name,
      ]),
    );

    expect(named).toEqual({
      FeatureConfigError: 'FeatureConfigError',
      FeatureCycleError: 'FeatureCycleError',
      UnknownDependencyError: 'UnknownDependencyError',
      DuplicateFeatureError: 'DuplicateFeatureError',
      DuplicateVariantError: 'DuplicateVariantError',
      UnknownVariantError: 'UnknownVariantError',
    });
  });

  it('answers a bare base class for a defect no subclass names', () => {
    const error = errorOf(
      REFUSED['FeatureConfigError'] as readonly FeatureDefinition<FeatureKey>[],
      FeatureConfigError,
    );

    expect(error.name).toBe('FeatureConfigError');
    expect(error).not.toBeInstanceOf(DuplicateVariantError);
    expect(error.message).toContain('checkout-cta');
  });
});

describe('FeatureCycleError', () => {
  it('closes `path` on the key it opens on for a feature depending on itself', () => {
    const error = errorOf(
      [{ key: 'a', enabled: true, dependsOn: ['a'] }],
      FeatureCycleError,
    );

    expect(error.path).toEqual(['a', 'a']);
    expect(error.message).toBe('feature dependency cycle: a -> a');
  });

  it('writes the closing edge into the message as well as onto `path`', () => {
    const error = errorOf(
      [
        { key: 'a', enabled: true, dependsOn: ['c'] },
        { key: 'b', enabled: true, dependsOn: ['a'] },
        { key: 'c', enabled: true, dependsOn: ['b'] },
      ],
      FeatureCycleError,
    );

    expect(error.path).toEqual(['a', 'c', 'b', 'a']);
    expect(error.message).toBe('feature dependency cycle: a -> c -> b -> a');
  });

  it('holds `path` to the cycle and not to the walk that reached it', () => {
    const error = errorOf(
      [
        { key: 'entry', enabled: true, dependsOn: ['a'] },
        { key: 'a', enabled: true, dependsOn: ['b'] },
        { key: 'b', enabled: true, dependsOn: ['a'] },
      ],
      FeatureCycleError,
    );

    expect(error.path).toEqual(['a', 'b', 'a']);
    expect(error.path).not.toContain('entry');
  });

  it('carries numeric keys on `path` as the document wrote them', () => {
    const error = errorOf(
      [
        { key: 1, enabled: true, dependsOn: [2] },
        { key: 2, enabled: true, dependsOn: [1] },
      ],
      FeatureCycleError,
    );

    expect(error.path).toEqual([1, 2, 1]);
    expect(error.path.map((key) => typeof key)).toEqual([
      'number',
      'number',
      'number',
    ]);
  });
});

describe('UnknownDependencyError', () => {
  it('names the dependant on `key` and the name that resolves to nothing on `dependency`', () => {
    const error = errorOf(
      [{ key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] }],
      UnknownDependencyError,
    );

    expect(error.key).toBe('express-pickup');
    expect(error.dependency).toBe('new-checkout');
    expect(error.message).toBe(
      'feature "express-pickup" depends on "new-checkout", which is not configured',
    );
  });

  it('carries a key of 0, which is falsy and still a key', () => {
    const error = errorOf(
      [{ key: 0, enabled: true, dependsOn: ['missing'] }],
      UnknownDependencyError,
    );

    expect(error.key).toBe(0);
    expect(error.message).toBe(
      'feature "0" depends on "missing", which is not configured',
    );
  });

  it('carries a numeric dependency as the number, and not as the string that spells it', () => {
    const error = errorOf(
      [{ key: 1, enabled: true, dependsOn: [2] }],
      UnknownDependencyError,
    );

    expect(error.dependency).toBe(2);
    expect(typeof error.dependency).toBe('number');
  });
});

describe('DuplicateFeatureError', () => {
  it('carries the key two definitions share', () => {
    const error = errorOf(
      REFUSED[
        'DuplicateFeatureError'
      ] as readonly FeatureDefinition<FeatureKey>[],
      DuplicateFeatureError,
    );

    expect(error.key).toBe('a');
    expect(error.message).toBe('duplicate feature key "a"');
  });

  it('carries the second spelling for a numeric key beside the string that spells it', () => {
    const error = errorOf(
      [
        { key: 1, enabled: true },
        { key: '1', enabled: true },
      ],
      DuplicateFeatureError,
    );

    expect(error.key).toBe('1');
    expect(typeof error.key).toBe('string');
  });

  it('carries a key that spells a property of Object.prototype', () => {
    const error = errorOf(
      [
        { key: 'constructor', enabled: true },
        { key: 'constructor', enabled: true },
      ],
      DuplicateFeatureError,
    );

    expect(error.key).toBe('constructor');
  });
});

describe('DuplicateVariantError', () => {
  it('carries the feature and the name two variants share', () => {
    const error = errorOf(
      REFUSED[
        'DuplicateVariantError'
      ] as readonly FeatureDefinition<FeatureKey>[],
      DuplicateVariantError,
    );

    expect(error.feature).toBe('checkout-cta');
    expect(error.variant).toBe('control');
    expect(error.message).toBe(
      'feature "checkout-cta" declares the variant "control" twice',
    );
  });

  it('spells a numeric feature key as a string on `feature`', () => {
    const error = errorOf(
      [
        {
          key: 7,
          enabled: true,
          variants: [
            { name: 'control', weight: 50 },
            { name: 'control', weight: 50 },
          ],
        },
      ],
      DuplicateVariantError,
    );

    expect(error.feature).toBe('7');
    expect(typeof error.feature).toBe('string');
  });

  it('carries the empty name two variants share', () => {
    const error = errorOf(
      [
        {
          key: 'checkout-cta',
          enabled: true,
          variants: [
            { name: '', weight: 50 },
            { name: '', weight: 50 },
          ],
        },
      ],
      DuplicateVariantError,
    );

    expect(error.variant).toBe('');
    expect(error.message).toBe(
      'feature "checkout-cta" declares the variant "" twice',
    );
  });
});

describe('UnknownVariantError', () => {
  it('carries the feature and the variant a rule pins', () => {
    const error = errorOf(
      REFUSED[
        'UnknownVariantError'
      ] as readonly FeatureDefinition<FeatureKey>[],
      UnknownVariantError,
    );

    expect(error.feature).toBe('checkout-cta');
    expect(error.variant).toBe('blue');
    expect(error.message).toBe(
      'feature "checkout-cta" has a rule pinning "blue", which it does not declare',
    );
  });

  it('refuses a pin on a feature that declares no variants at all', () => {
    const error = errorOf(
      [
        {
          key: 'checkout-cta',
          enabled: true,
          rules: [{ id: 'booksellers', variant: 'blue' }],
        },
      ],
      UnknownVariantError,
    );

    expect(error.feature).toBe('checkout-cta');
    expect(error.variant).toBe('blue');
  });

  it('refuses a pin that differs from a declared name only in case', () => {
    const error = errorOf(
      [
        {
          key: 'checkout-cta',
          enabled: true,
          variants: [{ name: 'control', weight: 100 }],
          rules: [{ id: 'booksellers', variant: 'Control' }],
        },
      ],
      UnknownVariantError,
    );

    expect(error.variant).toBe('Control');
  });

  it('refuses a pin naming the empty variant', () => {
    const error = errorOf(
      [
        {
          key: 'checkout-cta',
          enabled: true,
          variants: [{ name: 'control', weight: 100 }],
          rules: [{ id: 'booksellers', variant: '' }],
        },
      ],
      UnknownVariantError,
    );

    expect(error.variant).toBe('');
  });

  it('refuses a pin naming a property of Object.prototype, which the set lookup does not walk', () => {
    const error = errorOf(
      [
        {
          key: 'checkout-cta',
          enabled: true,
          variants: [{ name: 'control', weight: 100 }],
          rules: [{ id: 'booksellers', variant: 'toString' }],
        },
      ],
      UnknownVariantError,
    );

    expect(error.variant).toBe('toString');
  });

  it('spells a numeric feature key as a string on `feature`', () => {
    const error = errorOf(
      [
        {
          key: 7,
          enabled: true,
          variants: [{ name: 'control', weight: 100 }],
          rules: [{ id: 'booksellers', variant: 'blue' }],
        },
      ],
      UnknownVariantError,
    );

    expect(error.feature).toBe('7');
  });
});

describe('createFeatures', () => {
  it('raises every one of the six classes, so a store a caller holds cannot fail mid-evaluation', () => {
    const classes = [
      FeatureConfigError,
      FeatureCycleError,
      UnknownDependencyError,
      DuplicateFeatureError,
      DuplicateVariantError,
      UnknownVariantError,
    ];

    for (const kind of classes) {
      const definitions = REFUSED[
        kind.name
      ] as readonly FeatureDefinition<FeatureKey>[];
      expect(refusalOf(definitions)).toBeInstanceOf(kind);
    }
  });

  it('raises none of them from resolve, plan, toggle or variantOf', () => {
    const features = createFeatures([
      { key: 'new-checkout', enabled: true },
      { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
    ]);
    const noInstant = { now: new Date(Number.NaN), targetingKey: 'cust-0042' };

    expect(() => features.resolve(noInstant)).not.toThrow();
    expect(() => features.isEnabled('express-pickup', noInstant)).not.toThrow();
    expect(() => features.plan(noInstant)).not.toThrow();
    expect(() => features.toggle('new-checkout', false)).not.toThrow();
    expect(() => features.variantOf('new-checkout', noInstant)).not.toThrow();
  });
});
