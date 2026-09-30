import { describe, expect, it } from 'vitest';
import { createFeatures } from './features.js';
import { validateConfig } from './validate.js';
import { DuplicateFeatureError } from './errors.js';
import type { FeatureConfig } from './config.js';

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
});
