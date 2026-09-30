import { describe, expect, it } from 'vitest';
import { createFeatures } from './features.js';
import { ruleId } from './rule-id.js';
import { validateConfig } from './validate.js';
import {
  DuplicateFeatureError,
  DuplicateVariantError,
  FeatureConfigError,
  FeatureCycleError,
  UnknownDependencyError,
  UnknownVariantError,
} from './errors.js';
import type { ConfigIssueCode, FeatureConfig } from './config.js';
import type { Rule } from './types.js';

/** The codes a document reports, in the order the checker found them. */
function codesOf(config: FeatureConfig): readonly ConfigIssueCode[] {
  const result = validateConfig(config);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

/** The messages a document reports, in that same order. */
function messagesOf(config: FeatureConfig): readonly string[] {
  const result = validateConfig(config);
  return result.ok ? [] : result.issues.map((issue) => issue.message);
}

/**
 * The error `createFeatures` raises for a document, for the cases that compare
 * the two paths. A document every case here hands it is a document it refuses,
 * so an acceptance is the failure this reports.
 */
function thrownBy(config: FeatureConfig): FeatureConfigError {
  try {
    createFeatures(config.features);
  } catch (error) {
    if (error instanceof FeatureConfigError) return error;
    throw error;
  }
  throw new Error('createFeatures accepted the document');
}

/** A document with one defect, and what each path says about it. */
interface Single {
  readonly label: string;
  readonly document: FeatureConfig;
  readonly code: ConfigIssueCode;
  readonly error: new (...args: never[]) => FeatureConfigError;
}

/**
 * One document per class of defect, each carrying exactly one.
 *
 * Decision 11 asks that the reported message and the thrown message be one
 * string. A single-defect document is what makes that comparable: the issue the
 * checker reports first and the error the store throws describe the same row.
 */
const SINGLES: readonly Single[] = [
  {
    label: 'duplicate key',
    document: {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    },
    code: 'duplicate-feature',
    error: DuplicateFeatureError,
  },
  {
    label: 'unknown dependency',
    document: {
      features: [{ key: 'a', enabled: true, dependsOn: ['nowhere'] }],
    },
    code: 'unknown-dependency',
    error: UnknownDependencyError,
  },
  {
    label: 'cycle',
    document: {
      features: [
        { key: 'a', enabled: true, dependsOn: ['b'] },
        { key: 'b', enabled: true, dependsOn: ['a'] },
      ],
    },
    code: 'cycle',
    error: FeatureCycleError,
  },
  {
    label: 'duplicate variant name',
    document: {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1 },
            { name: 'control', weight: 1 },
          ],
        },
      ],
    },
    code: 'duplicate-variant',
    error: DuplicateVariantError,
  },
  {
    label: 'unknown pin',
    document: {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'control', weight: 1 }],
          rules: [{ variant: 'ghost' }],
        },
      ],
    },
    code: 'unknown-variant',
    error: UnknownVariantError,
  },
  {
    label: 'empty variant set',
    document: { features: [{ key: 'cta', enabled: true, variants: [] }] },
    code: 'empty-variants',
    error: FeatureConfigError,
  },
  {
    label: 'negative weight',
    document: {
      features: [
        { key: 'cta', enabled: true, variants: [{ name: 'only', weight: -1 }] },
      ],
    },
    code: 'invalid-weight',
    error: FeatureConfigError,
  },
  {
    label: 'every weight zero',
    document: {
      features: [
        { key: 'cta', enabled: true, variants: [{ name: 'only', weight: 0 }] },
      ],
    },
    code: 'zero-weights',
    error: FeatureConfigError,
  },
  {
    label: 'weight total overflowing',
    document: {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: Number.MAX_VALUE },
            { name: 'blue', weight: Number.MAX_VALUE },
          ],
        },
      ],
    },
    code: 'zero-weights',
    error: FeatureConfigError,
  },
  {
    label: 'order below zero',
    document: {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'only', weight: 1, order: -1 }],
        },
      ],
    },
    code: 'invalid-variant-order',
    error: FeatureConfigError,
  },
  {
    label: 'two variants one order',
    document: {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, order: 2 },
            { name: 'blue', weight: 1, order: 2 },
          ],
        },
      ],
    },
    code: 'duplicate-variant-order',
    error: FeatureConfigError,
  },
  {
    label: 'partial order declaration',
    document: {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, order: 0 },
            { name: 'blue', weight: 1 },
          ],
        },
      ],
    },
    code: 'invalid-variant-order',
    error: FeatureConfigError,
  },
  {
    label: 'two rules one id',
    document: {
      features: [
        {
          key: 'beta',
          enabled: true,
          rules: [{ id: 'staff' }, { id: 'staff' }],
        },
      ],
    },
    code: 'duplicate-rule-id',
    error: FeatureConfigError,
  },
];

describe('validateConfig', () => {
  it('accepts a document the store accepts', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'checkout', enabled: true },
        { key: 'express', enabled: true, dependsOn: ['checkout'] },
      ],
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('reports four issues in a document carrying four', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
        { key: 'b', enabled: true, dependsOn: ['nowhere'] },
        { key: 'c', enabled: true, dependsOn: ['d'] },
        { key: 'd', enabled: true, dependsOn: ['c'] },
        {
          key: 'e',
          enabled: true,
          variants: [{ name: 'only', weight: -1 }],
        },
      ],
    };

    const result = validateConfig(config);

    expect(
      result.ok === false && result.issues.map((each) => each.code),
    ).toEqual([
      'duplicate-feature',
      'unknown-dependency',
      'cycle',
      'invalid-weight',
    ]);
  });

  it('gives an issue the message its thrown counterpart carries', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]?.message).toBe(
      new DuplicateFeatureError('a').message,
    );
  });

  it('names the feature and a pointer into the document', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'b', enabled: true, variants: [] },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]).toMatchObject({
      code: 'empty-variants',
      key: 'b',
      path: '/features/1/variants',
    });
  });

  it('leaves createFeatures throwing the error it throws today', () => {
    expect(() =>
      createFeatures([
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ]),
    ).toThrow(DuplicateFeatureError);
  });

  it('reports a negative zero weight through the total, not as a share', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'cta', enabled: true, variants: [{ name: 'only', weight: -0 }] },
      ],
    };

    const result = validateConfig(config);

    // `Number.isFinite(-0)` is true and `-0 < 0` is false, so the per-variant
    // check passes it and the total is what refuses it.
    expect(
      result.ok === false && result.issues.map((each) => each.code),
    ).toEqual(['zero-weights']);
  });

  it('reports a NaN weight as an unusable share', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'only', weight: NaN }],
        },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]?.code).toBe(
      'invalid-weight',
    );
  });

  it('reports a fractional order as an invalid one', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, order: 0.5 },
            { name: 'blue', weight: 1, order: 1 },
          ],
        },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]?.code).toBe(
      'invalid-variant-order',
    );
  });

  it('reports two variants sharing an order', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, order: 3 },
            { name: 'blue', weight: 1, order: 3 },
          ],
        },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]?.code).toBe(
      'duplicate-variant-order',
    );
  });

  it('reports two rules of one feature declaring one id', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'beta',
          enabled: true,
          rules: [
            { id: 'staff', when: [{ field: 'staff', op: 'eq', value: true }] },
            { id: 'staff', when: [{ field: 'staff', op: 'eq', value: false }] },
          ],
        },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]).toMatchObject({
      code: 'duplicate-rule-id',
      key: 'beta',
      path: '/features/0/rules',
    });
  });

  it('lets two features declare the same rule id', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true, rules: [{ id: 'staff' }] },
        { key: 'b', enabled: true, rules: [{ id: 'staff' }] },
      ],
    };

    // A rule id names a rule inside its own feature. `Decision.rule` is read
    // beside `Decision.key`, so two features naming one rule collide nowhere.
    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('carries the message createFeatures throws, for every class of defect', () => {
    for (const single of SINGLES) {
      const result = validateConfig(single.document);
      const thrown = thrownBy(single.document);

      expect({
        label: single.label,
        codes: result.ok ? [] : result.issues.map((issue) => issue.code),
      }).toEqual({ label: single.label, codes: [single.code] });
      expect({
        label: single.label,
        message: result.ok ? '' : result.issues[0]?.message,
      }).toEqual({ label: single.label, message: thrown.message });
      expect(thrown, single.label).toBeInstanceOf(single.error);
    }
  });

  it('accepts a document declaring no features at all', () => {
    expect(validateConfig({ features: [] })).toEqual({ ok: true });
  });

  it('accepts a diamond, where two parents share one child', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'root', enabled: true },
        { key: 'left', enabled: true, dependsOn: ['root'] },
        { key: 'right', enabled: true, dependsOn: ['root'] },
        { key: 'leaf', enabled: true, dependsOn: ['left', 'right'] },
      ],
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('reports both cycles in a document carrying two independent ones', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true, dependsOn: ['b'] },
        { key: 'b', enabled: true, dependsOn: ['a'] },
        { key: 'c', enabled: true, dependsOn: ['d'] },
        { key: 'd', enabled: true, dependsOn: ['c'] },
      ],
    };

    expect(messagesOf(config)).toEqual([
      'feature dependency cycle: a -> b -> a',
      'feature dependency cycle: c -> d -> c',
    ]);
  });

  it('reports both cycles a feature sitting in two of them closes', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true, dependsOn: ['b'] },
        { key: 'b', enabled: true, dependsOn: ['a', 'c'] },
        { key: 'c', enabled: true, dependsOn: ['b'] },
      ],
    };

    expect(messagesOf(config)).toEqual([
      'feature dependency cycle: a -> b -> a',
      'feature dependency cycle: b -> c -> b',
    ]);
  });

  it('reports a feature depending on itself as a one-edge cycle', () => {
    const config: FeatureConfig = {
      features: [{ key: 'a', enabled: true, dependsOn: ['a'] }],
    };

    const result = validateConfig(config);

    // No `key`: a cycle is a property of a set of features, and naming one of
    // them would point an operator at a row that is no more at fault than the
    // rest.
    expect(result.ok === false && result.issues).toEqual([
      { code: 'cycle', message: 'feature dependency cycle: a -> a' },
    ]);
  });

  it('reports one duplicate per extra definition of a key', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    };

    expect(codesOf(config)).toEqual(['duplicate-feature', 'duplicate-feature']);
  });

  it('reports an unknown dependency once per naming of it', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true, dependsOn: ['nowhere', 'nowhere'] },
      ],
    };

    expect(codesOf(config)).toEqual([
      'unknown-dependency',
      'unknown-dependency',
    ]);
  });

  it('reads the dependsOn of the first definition of a duplicated key', () => {
    const declaredFirst: FeatureConfig = {
      features: [
        { key: 'a', enabled: true, dependsOn: ['nowhere'] },
        { key: 'a', enabled: true },
      ],
    };
    const declaredSecond: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true, dependsOn: ['nowhere'] },
      ],
    };

    // The first definition of a key wins the graph, so the second one's
    // `dependsOn` is never walked and the unknown parent in it goes unreported
    // until the duplicate is resolved.
    expect(codesOf(declaredFirst)).toEqual([
      'duplicate-feature',
      'unknown-dependency',
    ]);
    expect(codesOf(declaredSecond)).toEqual(['duplicate-feature']);
  });

  it('names the depending feature on an unknown dependency, not the missing one', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'b', enabled: true, dependsOn: ['nowhere'] },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-dependency',
        key: 'b',
        message: new UnknownDependencyError('b', 'nowhere').message,
      },
    ]);
  });

  it('reports the graph before the definitions it is built from', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true, variants: [] },
        { key: 'b', enabled: true },
        { key: 'b', enabled: true },
      ],
    };

    expect(codesOf(config)).toEqual(['duplicate-feature', 'empty-variants']);
  });

  it('reports every variant defect of one feature in reading order', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, order: 0 },
            { name: 'control', weight: -1, order: -2 },
          ],
          rules: [{ variant: 'ghost' }],
        },
      ],
    };

    expect(codesOf(config)).toEqual([
      'duplicate-variant',
      'invalid-weight',
      'invalid-variant-order',
      'unknown-variant',
    ]);
  });

  it('reports each unusable share and leaves the total unjudged', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: NaN },
            { name: 'blue', weight: -5 },
          ],
        },
      ],
    };

    // The sum over the rest describes no second defect: it is NaN because a
    // share the checker already named is NaN. A total reported here would send
    // an operator to fix a member that is fine.
    expect(codesOf(config)).toEqual(['invalid-weight', 'invalid-weight']);
  });

  it('stops at an empty variant set, leaving a pin it cannot judge unreported', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [],
          rules: [{ variant: 'ghost' }],
        },
      ],
    };

    expect(codesOf(config)).toEqual(['empty-variants']);
  });

  it('reports one unknown variant per pin on a feature declaring none', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          rules: [{ variant: 'blue' }, { variant: 'green' }],
        },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-variant',
        key: 'cta',
        message: new UnknownVariantError('cta', 'blue').message,
        path: '/features/0/rules',
      },
      {
        code: 'unknown-variant',
        key: 'cta',
        message: new UnknownVariantError('cta', 'green').message,
        path: '/features/0/rules',
      },
    ]);
  });

  it('reports a partial order declaration as an invalid order', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, order: 0 },
            { name: 'blue', weight: 1 },
          ],
        },
      ],
    };

    expect(messagesOf(config)).toEqual([
      'feature "cta" declares an order on 1 of its 2 variants, which mixes two orderings',
    ]);
  });

  it('reports an order below zero as an invalid one', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'only', weight: 1, order: -1 }],
        },
      ],
    };

    expect(messagesOf(config)).toEqual([
      'feature "cta" gives the variant "only" the order -1, which is not a non-negative integer',
    ]);
  });

  it('reads the order -0 and the order 0 as one order', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, order: 0 },
            { name: 'blue', weight: 1, order: -0 },
          ],
        },
      ],
    };

    // `Number.isInteger(-0)` is true and `-0 < 0` is false, so the order is
    // usable, and a `Set` compares it with SameValueZero, so it collides with 0.
    expect(messagesOf(config)).toEqual([
      'feature "cta" gives two variants the order 0, which leaves the walk between them undefined',
    ]);
  });

  it('accepts an order of zero beside the largest safe integer', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, order: 0 },
            { name: 'blue', weight: 1, order: Number.MAX_SAFE_INTEGER },
          ],
        },
      ],
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('reports a weight total that overflows as a set with nothing to assign', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: Number.MAX_VALUE },
            { name: 'blue', weight: Number.MAX_VALUE },
          ],
        },
      ],
    };

    const result = validateConfig(config);

    // The spec names no code for an overflow, so it reports as `zero-weights`:
    // both leave the walk with no usable share, and the message separates them.
    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'zero-weights',
        key: 'cta',
        message:
          'feature "cta" gives its variants a weight total of Infinity, which overflows and leaves no usable share',
        path: '/features/0/variants',
      },
    ]);
  });

  it('accepts the largest weight that leaves the total finite', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'only', weight: Number.MAX_VALUE }],
        },
      ],
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('accepts the smallest weight above zero', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'only', weight: Number.MIN_VALUE }],
        },
      ],
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('accepts a variant weighted zero beside one that carries the total', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 0 },
            { name: 'blue', weight: 1 },
          ],
        },
      ],
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('reports a weight of negative infinity as an unusable share', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'only', weight: -Infinity }],
        },
      ],
    };

    expect(messagesOf(config)).toEqual([
      'feature "cta" gives the variant "only" the weight -Infinity, which is not a usable share',
    ]);
  });

  it('points at the definition a variant defect sits on, by index', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'b', enabled: true },
        { key: 'c', enabled: true },
        { key: 'd', enabled: true, variants: [] },
      ],
    };

    const result = validateConfig(config);

    expect(result.ok === false && result.issues[0]?.path).toBe(
      '/features/3/variants',
    );
  });

  it('reports one duplicate per extra rule declaring an id', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'beta',
          enabled: true,
          rules: [{ id: 'staff' }, { id: 'staff' }, { id: 'staff' }],
        },
      ],
    };

    expect(codesOf(config)).toEqual(['duplicate-rule-id', 'duplicate-rule-id']);
  });

  it('accepts two rules of one feature whose declared ids differ', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'beta',
          enabled: true,
          rules: [{ id: 'staff' }, { id: 'beta-testers' }],
        },
      ],
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('accepts a declared id that collides with one another rule derives', () => {
    const derived = {
      when: [{ field: 'staff', op: 'eq', value: true }],
    } satisfies Rule;
    const declared = { id: ruleId(derived) } satisfies Rule;
    const config: FeatureConfig = {
      features: [{ key: 'beta', enabled: true, rules: [declared, derived] }],
    };

    // `ruleIdErrors` compares declared ids, and a rule declaring none is named
    // by a hash of what it matches on, so these two rules answer one id and a
    // decision naming it names both.
    expect(ruleId(declared)).toBe(ruleId(derived));
    expect(validateConfig(config)).toEqual({ ok: true });
  });
});

describe('createFeatures', () => {
  it('throws the graph error for a document carrying a graph and a variant defect', () => {
    expect(() =>
      createFeatures([
        { key: 'a', enabled: true, variants: [] },
        { key: 'a', enabled: true },
      ]),
    ).toThrow(DuplicateFeatureError);
  });

  it('throws the first variant defect when the graph is sound', () => {
    expect(() =>
      createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1 },
            { name: 'control', weight: 1 },
          ],
        },
      ]),
    ).toThrow(DuplicateVariantError);
  });

  it('refuses two rules of one feature declaring one id', () => {
    expect(() =>
      createFeatures([
        {
          key: 'beta',
          enabled: true,
          rules: [{ id: 'staff' }, { id: 'staff' }],
        },
      ]),
    ).toThrow('feature "beta" declares the rule id "staff" twice');
  });
});
