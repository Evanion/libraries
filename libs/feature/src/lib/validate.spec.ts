import { describe, expect, it } from 'vitest';
import { createFeatures } from './features.js';
import { ruleId } from './rule-id.js';
import { serializeConfig } from './serialize.js';
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

/**
 * The two members § 3 has travel with a served variant set.
 *
 * A definition carrying variants and no readable `variantBy` or `variantSeed` is
 * a document `validateConfig` refuses, so every fixture below that declares
 * variants and means something else by its defect carries both.
 */
const TRAVELS = {
  variantBy: 'targetingKey',
  variantSeed: 'cta:variant',
} as const;

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
          ...TRAVELS,
          variants: [
            { name: 'control', weight: 1, order: 0 },
            { name: 'control', weight: 1, order: 1 },
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
          ...TRAVELS,
          variants: [{ name: 'control', weight: 1, order: 0 }],
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
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [{ name: 'only', weight: -1, order: 0 }],
        },
      ],
    },
    code: 'invalid-weight',
    error: FeatureConfigError,
  },
  {
    label: 'every weight zero',
    document: {
      features: [
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [{ name: 'only', weight: 0, order: 0 }],
        },
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
          ...TRAVELS,
          variants: [
            { name: 'control', weight: Number.MAX_VALUE, order: 0 },
            { name: 'blue', weight: Number.MAX_VALUE, order: 1 },
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
          ...TRAVELS,
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
          ...TRAVELS,
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
          ...TRAVELS,
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
          ...TRAVELS,
          variants: [{ name: 'only', weight: -1, order: 0 }],
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
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [{ name: 'only', weight: -0, order: 0 }],
        },
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
          ...TRAVELS,
          variants: [{ name: 'only', weight: NaN, order: 0 }],
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
          ...TRAVELS,
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
          ...TRAVELS,
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
          ...TRAVELS,
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
          ...TRAVELS,
          variants: [
            { name: 'control', weight: NaN, order: 0 },
            { name: 'blue', weight: -5, order: 1 },
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
          rules: [
            { id: 'to-blue', variant: 'blue' },
            { id: 'to-green', variant: 'green' },
          ],
        },
      ],
    };

    const result = validateConfig(config);

    // Both rules carry an id, because two rules matching on nothing derive one
    // and `duplicate-rule-id` is what this document would report first.
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
          ...TRAVELS,
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
          ...TRAVELS,
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
          ...TRAVELS,
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
          ...TRAVELS,
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
          ...TRAVELS,
          variants: [
            { name: 'control', weight: Number.MAX_VALUE, order: 0 },
            { name: 'blue', weight: Number.MAX_VALUE, order: 1 },
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
          ...TRAVELS,
          variants: [{ name: 'only', weight: Number.MAX_VALUE, order: 0 }],
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
          ...TRAVELS,
          variants: [{ name: 'only', weight: Number.MIN_VALUE, order: 0 }],
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
          ...TRAVELS,
          variants: [
            { name: 'control', weight: 0, order: 0 },
            { name: 'blue', weight: 1, order: 1 },
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
          ...TRAVELS,
          variants: [{ name: 'only', weight: -Infinity, order: 0 }],
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

  it('reports a declared id that collides with one another rule derives', () => {
    const derived = {
      when: [{ field: 'staff', op: 'eq', value: true }],
    } satisfies Rule;
    const declared = { id: ruleId(derived) } satisfies Rule;
    const config: FeatureConfig = {
      features: [{ key: 'beta', enabled: true, rules: [declared, derived] }],
    };

    // Section 2: two rules answering one name make a dashboard keyed on that
    // name report two rules as one. `ruleId` is the name `Decision.rule`,
    // `RuleOutcome.rule` and an assignment all carry, and a rule declaring no
    // id is named by a hash of what it matches on.
    expect(ruleId(declared)).toBe(ruleId(derived));
    expect(validateConfig(config)).toEqual({
      ok: false,
      issues: [
        {
          code: 'duplicate-rule-id',
          key: 'beta',
          message: `feature "beta" answers the rule id "${ruleId(derived)}" for two rules, and a decision that names it names both`,
          path: '/features/0/rules',
        },
      ],
    });
  });

  it('reports two ramps of one feature over one condition set', () => {
    const when = [
      { field: 'plan', op: 'eq', value: 'pro' },
    ] satisfies Rule['when'];
    const config: FeatureConfig = {
      features: [
        {
          key: 'beta',
          enabled: true,
          rules: [
            { when, rollout: { percent: 20, by: 'accountId' } },
            { when, rollout: { percent: 50, by: 'accountId' } },
          ],
        },
      ],
    };

    // `rolloutText` excludes `rollout.percent`, so an operator moving a ramp
    // does not rename the rule. Two ramps over one condition set therefore
    // derive one id, and both of them are reachable: a subject the first refuses
    // is bucketed against the second.
    expect(codesOf(config)).toEqual(['duplicate-rule-id']);
  });

  it('accepts two ramps of one feature that declare their own ids', () => {
    const when = [
      { field: 'plan', op: 'eq', value: 'pro' },
    ] satisfies Rule['when'];
    const config: FeatureConfig = {
      features: [
        {
          key: 'beta',
          enabled: true,
          rules: [
            { id: 'early', when, rollout: { percent: 20 } },
            { id: 'late', when, rollout: { percent: 50 } },
          ],
        },
      ],
    };

    expect(validateConfig(config)).toEqual({ ok: true });
  });

  it('leaves createFeatures comparing the ids a literal declares', () => {
    const when = [
      { field: 'plan', op: 'eq', value: 'pro' },
    ] satisfies Rule['when'];

    // A store a TypeScript author built may hold a condition value that closes
    // on itself, which `serializeConfig` refuses and `canonical` recurses
    // through, so the derivation runs over the document a transport delivered.
    expect(() =>
      createFeatures([
        {
          key: 'beta',
          enabled: true,
          rules: [
            { when, rollout: { percent: 20 } },
            { when, rollout: { percent: 50 } },
          ],
        },
      ]),
    ).not.toThrow();
  });
});

describe('validateConfig, on a document whose members are not the declared shapes', () => {
  /** What a served body reaches the checker as: whatever `JSON.parse` returned. */
  function served(body: string): FeatureConfig {
    return JSON.parse(body) as FeatureConfig;
  }

  it('reports a document carrying no features member', () => {
    const result = validateConfig(served('{"version":"7"}'));

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'unknown-member',
          message:
            'the document declares "features" as nothing, and this checker reads an array of definitions',
          path: '/features',
        },
      ],
    });
  });

  it('reports a features member holding null, an object or a string', () => {
    const bodies = ['{"features":null}', '{"features":{}}', '{"features":"a"}'];

    expect(
      bodies.map((body) => {
        const result = validateConfig(served(body));
        return result.ok ? [] : result.issues.map((issue) => issue.message);
      }),
    ).toEqual([
      [
        'the document declares "features" as null, and this checker reads an array of definitions',
      ],
      [
        'the document declares "features" as an object, and this checker reads an array of definitions',
      ],
      [
        'the document declares "features" as a string, and this checker reads an array of definitions',
      ],
    ]);
  });

  it('reports a definition that is not an object', () => {
    const result = validateConfig(served('{"features":[null,7]}'));

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        message:
          'the definition at /features/0 is null, and this checker reads an object',
        path: '/features/0',
      },
      {
        code: 'unknown-member',
        message:
          'the definition at /features/1 is a number, and this checker reads an object',
        path: '/features/1',
      },
    ]);
  });

  it('reports a variants member that is not an array', () => {
    const result = validateConfig(
      served('{"features":[{"key":"a","enabled":true,"variants":{}}]}'),
    );

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        key: 'a',
        message:
          'feature "a" declares "variants" as an object, and this checker reads an array of variants',
        path: '/features/0/variants',
      },
    ]);
  });

  it('reports a rules member that is not an array', () => {
    const result = validateConfig(
      served('{"features":[{"key":"a","enabled":true,"rules":{}}]}'),
    );

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        key: 'a',
        message:
          'feature "a" declares "rules" as an object, and this checker reads an array of rules',
        path: '/features/0/rules',
      },
    ]);
  });

  it('reports a dependsOn member that arrived as an object', () => {
    const result = validateConfig(
      served('{"features":[{"key":"a","enabled":true,"dependsOn":{"0":"b"}}]}'),
    );

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        key: 'a',
        message:
          'feature "a" declares "dependsOn" as an object, and this checker reads an array of keys',
        path: '/features/0/dependsOn',
      },
    ]);
  });

  it('reports a string dependsOn once, and no dependency the walk would read out of it', () => {
    const result = validateConfig(
      served('{"features":[{"key":"a","enabled":true,"dependsOn":"ab"}]}'),
    );

    // A string is iterable, so the graph walk reads "a" and "b" as two parents
    // and reports an unknown dependency and a one-edge cycle. Neither names a
    // row the document carries.
    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        key: 'a',
        message:
          'feature "a" declares "dependsOn" as a string, and this checker reads an array of keys',
        path: '/features/0/dependsOn',
      },
    ]);
  });

  it('reports a variant and a rule that are not objects', () => {
    const result = validateConfig(
      served(
        '{"features":[{"key":"a","enabled":true,"variants":[null],"rules":[3]}]}',
      ),
    );

    expect(
      result.ok === false && result.issues.map((issue) => issue.path),
    ).toEqual(['/features/0/variants/0', '/features/0/rules/0']);
  });

  it('reports the graph beside a member of one definition it could not read', () => {
    const result = validateConfig(
      served(
        '{"features":[{"key":"a","enabled":true},{"key":"a","enabled":true,"variants":7}]}',
      ),
    );

    // Section 7: validateConfig reports every issue it finds. Section 3's
    // "refuses the whole document, drops nothing and evaluates nothing" is what
    // a holder does with the result, and an unreadable `variants` costs the
    // document its variant walk and costs the graph nothing.
    expect(
      result.ok === false && result.issues.map((issue) => issue.code),
    ).toEqual(['unknown-member', 'duplicate-feature']);
  });

  it('reports a variant defect of one definition beside an unreadable member of another', () => {
    const result = validateConfig(
      served(
        '{"features":[' +
          '{"key":"a","enabled":true,"variants":{}},' +
          '{"key":"b","enabled":true,"variantBy":"accountId","variantSeed":"b:v",' +
          '"variants":[{"name":"only","weight":0,"order":0}]}]}',
      ),
    );

    expect(
      result.ok === false && result.issues.map((issue) => issue.code),
    ).toEqual(['unknown-member', 'zero-weights']);
  });

  it('walks no variant of the definition whose variants it could not read', () => {
    const result = validateConfig(
      served(
        '{"features":[{"key":"a","enabled":true,"variants":7,"rules":[{"id":"pin","variant":"ghost"}]}]}',
      ),
    );

    // A pin is held against the names the array declares, and this document
    // declares no array this checker read.
    expect(
      result.ok === false && result.issues.map((issue) => issue.path),
    ).toEqual(['/features/0/variants']);
  });

  it('reads a member every definition declares, so one document names them all', () => {
    const result = validateConfig(
      served(
        '{"features":[{"key":"a","enabled":true,"dependsOn":"b"},{"key":"b","enabled":true,"variants":0}]}',
      ),
    );

    expect(
      result.ok === false && result.issues.map((issue) => issue.path),
    ).toEqual(['/features/0/dependsOn', '/features/1/variants']);
  });

  it('names no key for a definition whose own key is not a string or a number', () => {
    const result = validateConfig(
      served('{"features":[{"key":{},"enabled":true,"variants":7}]}'),
    );

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        message:
          'the definition at /features/0 declares "key" as an object, and this checker reads a string or a number',
        path: '/features/0/key',
      },
      {
        code: 'unknown-member',
        message:
          'the definition at /features/0 declares "variants" as a number, and this checker reads an array of variants',
        path: '/features/0/variants',
      },
    ]);
  });

  it('reports a body that parsed to null', () => {
    const result = validateConfig(served('null'));

    // § 6 has a holder that refuses a document keep the one it already
    // installed, which it cannot do if the refusal arrives as a raise.
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'unknown-member',
          message:
            'the document is null, and this checker reads an object carrying "features"',
        },
      ],
    });
  });

  it('reports a body the binding read as nothing', () => {
    expect(validateConfig(undefined as never)).toEqual({
      ok: false,
      issues: [
        {
          code: 'unknown-member',
          message:
            'the document is nothing, and this checker reads an object carrying "features"',
        },
      ],
    });
  });

  it('reports a body that parsed to the bare array § 1 refuses', () => {
    const result = validateConfig(served('[{"key":"a","enabled":true}]'));

    expect(
      result.ok === false && result.issues.map((issue) => issue.message),
    ).toEqual([
      'the document is an array, and this checker reads an object carrying "features"',
    ]);
  });

  it('reports a rule id that arrived as a number', () => {
    const result = validateConfig(
      served('{"features":[{"key":"a","enabled":true,"rules":[{"id":1}]}]}'),
    );

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        key: 'a',
        message:
          'feature "a" declares "id" on the rule at /features/0/rules/0 as a number, and this checker reads a string',
        path: '/features/0/rules/0/id',
      },
    ]);
  });

  it('refuses the two ids that answer one name in a decision', () => {
    const numeric = validateConfig(
      served(
        '{"features":[{"key":"a","enabled":true,"rules":[{"id":1},{"id":"1"}]}]}',
      ),
    );
    const objects = validateConfig(
      served(
        '{"features":[{"key":"a","enabled":true,"rules":[{"id":{}},{"id":{}}]}]}',
      ),
    );

    // `ruleId` returns `rule.id` unchanged, so each of these pairs names one
    // rule in `Decision.rule` while `ruleIdErrors` keys its map on two values.
    // That is the collision § 2 puts `duplicate-rule-id` in place to prevent.
    expect(numeric.ok).toBe(false);
    expect(objects.ok).toBe(false);
  });

  it('throws none of this, which is what the reload path is built on', () => {
    expect(() => validateConfig(served('null'))).not.toThrow();
    expect(() => validateConfig(served('{"version":1}'))).not.toThrow();
    expect(() => validateConfig(served('{"features":{}}'))).not.toThrow();
    expect(() =>
      validateConfig(
        served('{"features":[{"key":"a","enabled":true,"variants":{}}]}'),
      ),
    ).not.toThrow();
  });
});

describe('validateConfig, on the variant order a served document carries', () => {
  /** Two variants of one feature, with the orders a document declares. */
  function document(orders: readonly (number | undefined)[]): FeatureConfig {
    return {
      features: [
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: orders.map((order, at) => ({
            name: at === 0 ? 'control' : 'blue',
            weight: 1,
            ...(order === undefined ? {} : { order }),
          })),
        },
      ],
    };
  }

  it('reports a document whose variants declare no order at all', () => {
    const result = validateConfig(document([undefined, undefined]));

    // Section 3: a holder that fills the gap with the array index computes a
    // different assignment from a holder whose copy of the array a store
    // permuted, and neither reports anything while it does.
    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'invalid-variant-order',
        key: 'cta',
        message:
          'feature "cta" declares an order on none of its 2 variants, which leaves the walk to an array order a store may permute',
        path: '/features/0/variants',
      },
    ]);
  });

  it('reports a single variant declaring no order', () => {
    expect(codesOf(document([undefined]))).toEqual(['invalid-variant-order']);
  });

  it('accepts a document whose every variant declares one', () => {
    expect(validateConfig(document([0, 1]))).toEqual({ ok: true });
  });

  it('accepts the document serializeConfig writes from a literal declaring none', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 1 },
          { name: 'blue', weight: 1 },
        ],
      },
    ]);

    expect(validateConfig(serializeConfig(features))).toEqual({ ok: true });
  });

  it('leaves createFeatures accepting the literal whose array is the order', () => {
    expect(() =>
      createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1 },
            { name: 'blue', weight: 1 },
          ],
        },
      ]),
    ).not.toThrow();
  });

  it('reports the partial declaration as the mixed ordering it is', () => {
    expect(messagesOf(document([0, undefined]))).toEqual([
      'feature "cta" declares an order on 1 of its 2 variants, which mixes two orderings',
    ]);
  });
});

describe('validateConfig, on a key or a variant name that spells a defect', () => {
  it('reports a weight defect under its own code, whatever the variant is named', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [{ name: 'empty variants array', weight: -1, order: 0 }],
        },
      ],
    };

    // The code is built where the error is built, so the name a document author
    // chose reaches the message and decides nothing.
    expect(codesOf(config)).toEqual(['invalid-weight']);
  });

  it('reports a duplicate order under its own code, whatever the feature is named', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'non-negative integer',
          enabled: true,
          ...TRAVELS,
          variants: [
            { name: 'x', weight: 1, order: 3 },
            { name: 'y', weight: 1, order: 3 },
          ],
        },
      ],
    };

    expect(codesOf(config)).toEqual(['duplicate-variant-order']);
  });

  it('reports a zero weight total under its own code, whatever the feature is named', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'which is not a usable share',
          enabled: true,
          ...TRAVELS,
          variants: [{ name: 'only', weight: 0, order: 0 }],
        },
      ],
    };

    expect(codesOf(config)).toEqual(['zero-weights']);
  });

  it('reports an overflowing total under its own code, whatever the feature is named', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'mixes two orderings',
          enabled: true,
          ...TRAVELS,
          variants: [
            { name: 'a', weight: 1.7e308, order: 0 },
            { name: 'b', weight: 1.7e308, order: 1 },
          ],
        },
      ],
    };

    expect(codesOf(config)).toEqual(['zero-weights']);
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

describe('validateConfig, on the key a definition is named by', () => {
  /** What a served body reaches the checker as: whatever `JSON.parse` returned. */
  function served(body: string): FeatureConfig {
    return JSON.parse(body) as FeatureConfig;
  }

  it('reports a definition carrying no key', () => {
    const result = validateConfig({ features: [{ enabled: true }] } as never);

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'unknown-member',
          message:
            'the definition at /features/0 declares "key" as nothing, and this checker reads a string or a number',
          path: '/features/0/key',
        },
      ],
    });
  });

  it('names a row for each keyless definition, where a duplicate named none', () => {
    const result = validateConfig({
      features: [{ enabled: true }, { enabled: true }],
    } as never);

    // A path per row is what an operator fixes. One `duplicate feature key
    // "undefined"` for the pair carries neither a key nor a path.
    expect(
      result.ok === false && result.issues.map((issue) => issue.path),
    ).toEqual(['/features/0/key', '/features/1/key']);
  });

  it('reports two keys that are objects and collapses neither into the other', () => {
    const result = validateConfig(
      served(
        '{"features":[{"key":{},"enabled":true},{"key":{},"enabled":true}]}',
      ),
    );

    // `Object.fromEntries` writes both of these to the property
    // "[object Object]", so the second answers for the first in every resolved
    // record. The graph walk reads neither, because the checker read no key.
    expect(
      result.ok === false && result.issues.map((issue) => issue.path),
    ).toEqual(['/features/0/key', '/features/1/key']);
  });

  it('accepts a numeric key, which FeatureKey admits', () => {
    expect(
      validateConfig(served('{"features":[{"key":7,"enabled":true}]}')),
    ).toEqual({ ok: true });
  });

  it('reports a numeric key beside its own string spelling', () => {
    const result = validateConfig(
      served(
        '{"features":[{"key":1,"enabled":true},{"key":"1","enabled":false}]}',
      ),
    );

    // `resolveAll` builds its `Decisions` record with `Object.fromEntries`, which
    // writes 1 and '1' to one property, so `isEnabled(1)` reads the decision of
    // '1' and answers false for a feature the document declares enabled.
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'duplicate-feature',
          key: '1',
          message: new DuplicateFeatureError('1').message,
        },
      ],
    });
  });

  it('accepts two numeric keys no spelling shares', () => {
    expect(
      validateConfig(
        served(
          '{"features":[{"key":1,"enabled":true},{"key":2,"enabled":true}]}',
        ),
      ),
    ).toEqual({ ok: true });
  });

  it('refuses a keyless definition at createFeatures too', () => {
    expect(() => createFeatures([{ enabled: true }] as never)).toThrow(
      'the definition at /features/0 declares "key" as nothing',
    );
  });
});

describe('validateConfig, on the enabled every definition declares', () => {
  /** What a served body reaches the checker as: whatever `JSON.parse` returned. */
  function served(body: string): FeatureConfig {
    return JSON.parse(body) as FeatureConfig;
  }

  it('reports a definition carrying no enabled', () => {
    const result = validateConfig(served('{"features":[{"key":"checkout"}]}'));

    // § 3: a producer that cannot emit a member this document requires emits a
    // document the checker refuses, and the issue names the member. This is the
    // member that decides the answer.
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'unknown-member',
          key: 'checkout',
          message:
            'feature "checkout" declares "enabled" as nothing, and this checker reads a boolean',
          path: '/features/0/enabled',
        },
      ],
    });
  });

  it('reports an enabled carrying the string that spells it', () => {
    const result = validateConfig(
      served('{"features":[{"key":"promo","enabled":"yes"}]}'),
    );

    // `evaluate` reads the member for truth at `evaluate.ts:187`, so the absent
    // one resolves off as `explicitly-off` and this one resolves on as
    // `default-on`, and a renamed column publishes either.
    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        key: 'promo',
        message:
          'feature "promo" declares "enabled" as a string, and this checker reads a boolean',
        path: '/features/0/enabled',
      },
    ]);
  });

  it('names a row for each definition whose enabled did not travel', () => {
    const result = validateConfig(
      served(
        '{"features":[{"key":"a"},{"key":"b","enabled":true},{"key":"c","enabled":0}]}',
      ),
    );

    expect(
      result.ok === false && result.issues.map((issue) => issue.path),
    ).toEqual(['/features/0/enabled', '/features/2/enabled']);
  });

  it('accepts a definition declaring it false', () => {
    expect(
      validateConfig(served('{"features":[{"key":"a","enabled":false}]}')),
    ).toEqual({ ok: true });
  });

  it('refuses a definition carrying no enabled at createFeatures too', () => {
    expect(() => createFeatures([{ key: 'a' }] as never)).toThrow(
      'declares "enabled" as nothing',
    );
  });
});

describe('validateConfig, on the dependencies a definition declares', () => {
  /** What a served body reaches the checker as: whatever `JSON.parse` returned. */
  function served(body: string): FeatureConfig {
    return JSON.parse(body) as FeatureConfig;
  }

  it('reports a nested array and names no dependency out of it', () => {
    const result = validateConfig(
      served('{"features":[{"key":"a","enabled":true,"dependsOn":[["a"]]}]}'),
    );

    // `String(['a'])` is 'a', so a graph walk over this element reports that
    // feature "a" depends on "a", which is not configured, about the only row
    // the document declares.
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'unknown-member',
          key: 'a',
          message:
            'feature "a" declares the dependency at /features/0/dependsOn/0 as an array, and this checker reads a key',
          path: '/features/0/dependsOn/0',
        },
      ],
    });
  });

  it('points at the element and not at the member, for a dependency holding an object', () => {
    const result = validateConfig(
      served('{"features":[{"key":"a","enabled":true,"dependsOn":[{"x":1}]}]}'),
    );

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        key: 'a',
        message:
          'feature "a" declares the dependency at /features/0/dependsOn/0 as an object, and this checker reads a key',
        path: '/features/0/dependsOn/0',
      },
    ]);
  });

  it('reports every unreadable element of one dependsOn', () => {
    const result = validateConfig(
      served(
        '{"features":[{"key":"a","enabled":true,"dependsOn":[null,true]}]}',
      ),
    );

    expect(
      result.ok === false && result.issues.map((issue) => issue.path),
    ).toEqual(['/features/0/dependsOn/0', '/features/0/dependsOn/1']);
  });

  it('accepts a numeric dependency, which FeatureKey admits', () => {
    expect(
      validateConfig(
        served(
          '{"features":[{"key":1,"enabled":true},{"key":2,"enabled":true,"dependsOn":[1]}]}',
        ),
      ),
    ).toEqual({ ok: true });
  });
});

describe('validateConfig, on the bucketing members § 3 has travel whole', () => {
  /** A served definition carrying one variant and the members this case gives it. */
  function document(members: Readonly<Record<string, unknown>>): FeatureConfig {
    return {
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'only', weight: 1, order: 0 }],
          ...members,
        },
      ],
    } as FeatureConfig;
  }

  it('reports a variantBy a layer stripped', () => {
    const result = validateConfig(document({ variantSeed: 'cta:variant' }));

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'unknown-member',
          key: 'cta',
          message:
            'feature "cta" declares variants and no "variantBy" this checker can read, and a holder that fills the gap buckets every subject on another context field',
          path: '/features/0/variantBy',
        },
      ],
    });
  });

  it('reports a variantSeed a layer stripped', () => {
    const result = validateConfig(document({ variantBy: 'accountId' }));

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'unknown-member',
          key: 'cta',
          message:
            'feature "cta" declares variants and no "variantSeed" this checker can read, and a holder that fills the gap hashes every subject against another seed',
          path: '/features/0/variantSeed',
        },
      ],
    });
  });

  it('reports both when a document carries neither', () => {
    expect(
      messagesOf(document({})).map((message) => message.slice(0, 44)),
    ).toEqual([
      'feature "cta" declares variants and no "vari',
      'feature "cta" declares variants and no "vari',
    ]);
  });

  it('reports a variantBy that arrived as a number', () => {
    expect(
      codesOf(document({ variantBy: 7, variantSeed: 'cta:variant' })),
    ).toEqual(['unknown-member']);
  });

  it('accepts a document carrying both', () => {
    expect(
      validateConfig(
        document({ variantBy: 'accountId', variantSeed: 'cta:variant' }),
      ),
    ).toEqual({ ok: true });
  });

  it('asks for neither of them from a definition declaring no variants', () => {
    expect(
      validateConfig({ features: [{ key: 'cta', enabled: true }] }),
    ).toEqual({ ok: true });
  });

  it('asks for neither of them before the empty set it already refused', () => {
    expect(
      codesOf({ features: [{ key: 'cta', enabled: true, variants: [] }] }),
    ).toEqual(['empty-variants']);
  });

  it('leaves createFeatures accepting the literal that declares neither', () => {
    expect(() =>
      createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'only', weight: 1 }],
        },
      ]),
    ).not.toThrow();
  });

  it('accepts the document serializeConfig writes from that same literal', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'only', weight: 1 }],
      },
    ]);

    expect(validateConfig(serializeConfig(features))).toEqual({ ok: true });
  });
});

describe('validateConfig, on the conditions a served rule declares', () => {
  /** What a served body reaches the checker as: whatever `JSON.parse` returned. */
  function served(body: string): FeatureConfig {
    return JSON.parse(body) as FeatureConfig;
  }

  /** One feature whose single rule carries the `when` this case gives it. */
  function document(when: string): FeatureConfig {
    return served(
      `{"features":[{"key":"a","enabled":true,"rules":[{"when":${when}}]}]}`,
    );
  }

  it('reports a when that arrived as an object', () => {
    const result = validateConfig(document('{"field":"plan"}'));

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        key: 'a',
        message:
          'feature "a" declares "when" on the rule at /features/0/rules/0 as an object, and this checker reads an array of conditions',
        path: '/features/0/rules/0/when',
      },
    ]);
  });

  it('reports a condition that is not an object', () => {
    expect(messagesOf(document('[null]'))).toEqual([
      'feature "a" declares the condition at /features/0/rules/0/when/0 as null, and this checker reads an object',
    ]);
  });

  it('reports a field and an op the derivation cannot length-prefix', () => {
    const result = validateConfig(document('[{"value":true}]'));

    expect(
      result.ok === false && result.issues.map((issue) => issue.path),
    ).toEqual([
      '/features/0/rules/0/when/0/field',
      '/features/0/rules/0/when/0/op',
    ]);
  });

  it('reports a day-of-week condition carrying no zone', () => {
    const result = validateConfig(
      document('[{"field":"now","op":"day-of-week","value":[1]}]'),
    );

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        key: 'a',
        message:
          'feature "a" declares "zone" on the day-of-week condition at /features/0/rules/0/when/0 as nothing, and this checker reads a time zone name',
        path: '/features/0/rules/0/when/0/zone',
      },
    ]);
  });

  it('accepts a day-of-week condition carrying one', () => {
    expect(
      validateConfig(
        document(
          '[{"field":"now","op":"day-of-week","value":[1],"zone":"Europe/Stockholm"}]',
        ),
      ),
    ).toEqual({ ok: true });
  });

  it('accepts a rule carrying no when at all', () => {
    expect(
      validateConfig(
        served('{"features":[{"key":"a","enabled":true,"rules":[{}]}]}'),
      ),
    ).toEqual({ ok: true });
  });

  it('derives no rule id for a feature whose conditions it could not read', () => {
    const result = validateConfig(
      served(
        '{"features":[{"key":"a","enabled":true,"rules":[{"when":[null]},{"when":[null]}]}]}',
      ),
    );

    // Two rules matching on the same unreadable condition would answer one
    // derived id, and `canonical` has no text for a condition this checker could
    // not walk.
    expect(
      result.ok === false && result.issues.map((issue) => issue.code),
    ).toEqual(['unknown-member', 'unknown-member']);
  });

  it('throws none of this either', () => {
    expect(() => validateConfig(document('[{"op":3}]'))).not.toThrow();
    expect(() => validateConfig(document('"ab"'))).not.toThrow();
  });
});
