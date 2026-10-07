import { describe, expect, it } from 'vitest';
import { configDigest } from './digest.js';
import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import type {
  ConfigIssueCode,
  FeatureConfig,
  SerializedDefinition,
} from './config.js';

describe('parseFeatureConfig', () => {
  it('builds a store from a document', () => {
    const config: FeatureConfig = {
      version: 41,
      features: [
        { key: 'checkout', enabled: true },
        { key: 'express', enabled: true, dependsOn: ['checkout'] },
      ],
    };

    const result = parseFeatureConfig(config);

    expect(result.ok && result.features.isEnabled('express')).toBe(true);
  });

  it('returns the issues and no store for a bad document', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true, dependsOn: ['b'] },
        { key: 'c', enabled: true, dependsOn: ['d'] },
      ],
    };

    const result = parseFeatureConfig(config);

    expect(
      result.ok === false && result.issues.map((each) => each.code),
    ).toEqual(['unknown-dependency', 'unknown-dependency']);
  });

  it('throws nothing for a document createFeatures would throw on', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    };

    expect(() => parseFeatureConfig(config)).not.toThrow();
  });

  it('throws nothing for a document the checker accepts and the clone cannot carry', () => {
    const config = {
      features: [
        {
          key: 'cta',
          enabled: true,
          variantBy: 'targetingKey',
          variantSeed: 'cta:variant',
          variants: [{ name: 'blue', weight: 1, order: 0, value: () => 1 }],
        },
      ],
    } satisfies FeatureConfig;

    expect(() => parseFeatureConfig(config)).not.toThrow();
  });

  it('installs an observer the caller supplies', () => {
    const seen: string[] = [];
    const config: FeatureConfig = { features: [{ key: 'a', enabled: true }] };

    const result = parseFeatureConfig(config, {
      observe: (event) => {
        seen.push(event.type);
      },
    });
    if (result.ok) result.features.resolve();

    expect(seen).toEqual(['resolve']);
  });
});

/**
 * The two members § 3 has travel with a served variant set.
 *
 * A definition carrying variants and no readable `variantBy` or `variantSeed`
 * is a document the checker refuses, so a fixture below that declares variants
 * and means something else by its defect carries both.
 */
const TRAVELS = {
  variantBy: 'targetingKey',
  variantSeed: 'cta:variant',
} as const;

/**
 * A document whose variant value nests deeper than a recursive walk of it fits
 * on the stack.
 *
 * `structuredClone` at `features.ts:393` and `canonical` at `canonical.ts:138`
 * both recurse through the value, so each raises `RangeError: Maximum call
 * stack size exceeded` over this one. The text is parsed per case, because
 * `JSON.parse` is the only reader here that builds the value without recursing
 * that far.
 */
const DEEP = `{"features":[{"key":"cta","enabled":true,"variantBy":"targetingKey","variantSeed":"cta:variant","variants":[{"name":"blue","weight":1,"order":0,"value":${'['.repeat(5000)}1${']'.repeat(5000)}}]}]}`;

/** The codes a document reports through this entry point, in checker order. */
function codesOf(config: FeatureConfig): readonly ConfigIssueCode[] {
  const result = parseFeatureConfig(config);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('the documents parseFeatureConfig accepts', () => {
  it('builds a store with no keys from a document carrying no features', () => {
    const result = parseFeatureConfig({ features: [] });

    expect(result.ok && result.features.keys).toEqual([]);
  });

  it('resolves an empty record for a document carrying no features', () => {
    const result = parseFeatureConfig({ features: [] });

    expect(result.ok && result.features.resolve()).toEqual({});
  });

  it('answers off for the one definition a document disables', () => {
    const config: FeatureConfig = { features: [{ key: 'a', enabled: false }] };

    const result = parseFeatureConfig(config);

    expect([result.ok, result.ok && result.features.isEnabled('a')]).toEqual([
      true,
      false,
    ]);
  });

  it('keys a definition on the number a document carries', () => {
    const config: FeatureConfig<number> = {
      features: [{ key: 7, enabled: true }],
    };

    const result = parseFeatureConfig(config);

    expect(result.ok && result.features.keys).toEqual([7]);
  });

  it('carries the value a served variant declares', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [
            { name: 'blue', weight: 1, order: 0, value: { label: 'Buy' } },
          ],
        },
      ],
    };

    const result = parseFeatureConfig(config);

    expect(result.ok && result.features.valueOf('cta')).toEqual({
      label: 'Buy',
    });
  });

  it('lets a rule the document carries decide on the context', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'a',
          enabled: true,
          rules: [{ when: [{ field: 'plan', op: 'eq', value: 'pro' }] }],
        },
      ],
    };

    const result = parseFeatureConfig(config);
    const answers = result.ok
      ? [
          result.features.isEnabled('a', { plan: 'pro' }),
          result.features.isEnabled('a', { plan: 'free' }),
        ]
      : [];

    expect(answers).toEqual([true, false]);
  });

  it('accepts a document carrying all six members', () => {
    const body: FeatureConfig = {
      version: 'v9',
      schema: { context: { fields: { plan: 'string' } } },
      schemaVersion: '1',
      maxStale: 0,
      features: [
        {
          key: 'a',
          enabled: true,
          rules: [{ when: [{ field: 'plan', op: 'eq', value: 'pro' }] }],
        },
      ],
    };

    const result = parseFeatureConfig({ ...body, digest: configDigest(body) });

    expect(result.ok && result.features.isEnabled('a', { plan: 'pro' })).toBe(
      true,
    );
  });

  it('reads no advisory duration, at either end of the range', () => {
    const body: FeatureConfig = { features: [{ key: 'a', enabled: true }] };

    const answers = [0, Number.MAX_SAFE_INTEGER].map((maxStale) => {
      const result = parseFeatureConfig({ ...body, maxStale });
      return result.ok && result.features.isEnabled('a');
    });

    expect(answers).toEqual([true, true]);
  });
});

describe('the documents parseFeatureConfig refuses', () => {
  it('names the duplicate key the document declares twice', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    };

    expect(codesOf(config)).toEqual(['duplicate-feature']);
  });

  it('carries no store on the refusal', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    };

    const result = parseFeatureConfig(config);

    expect('features' in result).toBe(false);
  });

  it('reports every issue the document carries, not the first', () => {
    const config = {
      hashVersion: 2,
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    } as unknown as FeatureConfig;

    expect(codesOf(config)).toEqual(['unknown-member', 'duplicate-feature']);
  });

  it('refuses a feature that depends on itself', () => {
    const config: FeatureConfig = {
      features: [{ key: 'a', enabled: true, dependsOn: ['a'] }],
    };

    expect(codesOf(config)).toEqual(['cycle']);
  });

  it('refuses a document whose digest does not describe it', () => {
    const config: FeatureConfig = {
      digest: '0'.repeat(32),
      features: [{ key: 'a', enabled: true }],
    };

    expect(codesOf(config)).toEqual(['digest-mismatch']);
  });

  it('reports a variant value no structured clone of the document carries', () => {
    const config = {
      features: [
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [{ name: 'blue', weight: 1, order: 0, value: () => 1 }],
        },
      ],
    } satisfies FeatureConfig;

    expect(codesOf(config)).toEqual(['unknown-member']);
  });

  it('reports a variant value nested past the stack a clone of it needs', () => {
    const config = JSON.parse(DEEP) as FeatureConfig;

    expect(codesOf(config)).toEqual(['unknown-member']);
  });

  it('reports the digest it cannot take of a document nested that deep', () => {
    const config = JSON.parse(DEEP) as FeatureConfig;

    expect(codesOf({ ...config, digest: '0'.repeat(32) })).toEqual([
      'unknown-member',
    ]);
  });

  it('reports the hole the features array leaves where a definition goes', () => {
    const features: SerializedDefinition[] = [];
    features[1] = { key: 'a', enabled: true };

    const result = parseFeatureConfig({ features });

    expect(result.ok === false && result.issues[0]).toMatchObject({
      code: 'unknown-member',
      path: '/features/0',
    });
  });

  it('names the member no holder can read', () => {
    const config = {
      features: [{ key: 'a', enabled: true }],
      hashVersion: 2,
    } as unknown as FeatureConfig;

    const result = parseFeatureConfig(config);

    expect(result.ok === false && result.issues[0]).toMatchObject({
      code: 'unknown-member',
      path: '/hashVersion',
    });
  });

  it('refuses a parsed document carrying __proto__ and writes no prototype', () => {
    const config = JSON.parse(
      '{"features":[{"key":"a","enabled":true}],"__proto__":{"polluted":true}}',
    ) as FeatureConfig;

    const codes = codesOf(config);

    expect(codes).toEqual(['unknown-member']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('refuses a variant set the document declares empty', () => {
    const config: FeatureConfig = {
      features: [{ key: 'cta', enabled: true, ...TRAVELS, variants: [] }],
    };

    expect(codesOf(config)).toEqual(['empty-variants']);
  });

  it('refuses a weight below zero', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [{ name: 'blue', weight: -1, order: 0 }],
        },
      ],
    };

    expect(codesOf(config)).toEqual(['invalid-weight']);
  });

  it('refuses a weight of -0 through the total it sums to', () => {
    const config: FeatureConfig = {
      features: [
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [{ name: 'blue', weight: -0, order: 0 }],
        },
      ],
    };

    expect(codesOf(config)).toEqual(['zero-weights']);
  });

  it('refuses a variant set whose order no document member declares', () => {
    const variants = [
      { name: 'control', weight: 1 },
      { name: 'blue', weight: 1 },
    ];
    const config: FeatureConfig = {
      features: [{ key: 'cta', enabled: true, ...TRAVELS, variants }],
    };

    const codes = codesOf(config);

    expect(codes).toEqual(['invalid-variant-order']);
    expect(() =>
      createFeatures([{ key: 'cta', enabled: true, variants }]),
    ).not.toThrow();
  });

  it('leaves the document it refused exactly as it was handed it', () => {
    const config = {
      hashVersion: 2,
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    } as unknown as FeatureConfig;
    const before = JSON.stringify(config);

    parseFeatureConfig(config);

    expect(JSON.stringify(config)).toBe(before);
  });
});

describe('the options parseFeatureConfig forwards', () => {
  it('calls no observer for a document it refused', () => {
    const seen: string[] = [];
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    };

    parseFeatureConfig(config, {
      observe: (event) => {
        seen.push(event.type);
      },
    });

    expect(seen).toEqual([]);
  });

  it('reports the version and the subject the options named', () => {
    const seen: unknown[] = [];
    const config: FeatureConfig = { features: [{ key: 'a', enabled: true }] };

    const result = parseFeatureConfig(config, {
      correlateBy: 'userId',
      version: '7',
      observe: (event) => {
        seen.push({ subject: event.subject, version: event.version });
      },
    });
    if (result.ok) result.features.resolve({ userId: 'u1' });

    expect(seen).toEqual([{ subject: 'u1', version: '7' }]);
  });

  it('hands the observer the decisions the store resolved', () => {
    const seen: unknown[] = [];
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'b', enabled: false },
      ],
    };

    const result = parseFeatureConfig(config, {
      observe: (event) => {
        if (event.type === 'resolve') seen.push(Object.keys(event.decisions));
      },
    });
    if (result.ok) result.features.resolve();

    expect(seen).toEqual([['a', 'b']]);
  });
});

describe('the store a document builds', () => {
  it('holds the definitions the document carried when the caller edits it', () => {
    const rows = [{ key: 'a', enabled: true }];
    const config: FeatureConfig = { features: rows };

    const result = parseFeatureConfig(config);
    rows.push({ key: 'b', enabled: true });
    rows[0] = { key: 'a', enabled: false };
    const held = result.ok
      ? [result.features.keys, result.features.isEnabled('a')]
      : [];

    expect(held).toEqual([['a'], true]);
  });
});
