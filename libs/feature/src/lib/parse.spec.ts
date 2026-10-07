import { describe, expect, it } from 'vitest';
import { configDigest } from './digest.js';
import { FeatureConfigError } from './errors.js';
import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { validateConfig } from './validate.js';
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

/** A document whose one served variant carries `value`. */
function carrying(value: unknown): FeatureConfig {
  return {
    features: [
      {
        key: 'cta',
        enabled: true,
        ...TRAVELS,
        variants: [{ name: 'blue', weight: 1, order: 0, value }],
      },
    ],
  } as unknown as FeatureConfig;
}

/**
 * An array nested deeper than `recurse` walks on the runtime this runs on.
 *
 * `structuredClone` at `features.ts:409` recurses once per level, so the depth
 * it gives up at is a property of the stack the runtime hands it and not of the
 * document: `node --stack-size=4000` copies four times what the default copies.
 * A fixture pinning one depth asserts a refusal that a flag turns off, and the
 * case then reads an empty issue list with no hint that the stack moved.
 *
 * So the depth is the runtime's answer. The doubling stops at the first depth
 * `recurse` raises on, and the throw below is what a case gets where none of
 * them raises. The arrays are built with a loop, so nothing recurses on the way
 * in and no reader's own ceiling caps what this reaches.
 */
function nestedPast(recurse: (value: unknown) => unknown): unknown {
  for (let depth = 2_000; depth <= 512_000; depth *= 2) {
    let value: unknown = 1;
    for (let at = 0; at < depth; at += 1) value = [value];
    try {
      recurse(value);
    } catch {
      return value;
    }
  }
  throw new Error(
    'no array nested 512000 levels deep exhausted the stack this runtime hands the walk, so the cases over it name a refusal nothing produces',
  );
}

/**
 * A document whose variant value nests deeper than the construction path copies.
 */
const DEEP = carrying(nestedPast(structuredClone));

/**
 * A document whose variant value no canonical text names, at a depth every
 * runtime walks.
 *
 * 27 doublings of a shared array is 2^27 leaves, because neither a canonical
 * text nor JSON carries the sharing, so `canonical` meets `RangeError: Invalid
 * string length` over it. `structuredClone` keeps the sharing, so the
 * construction path copies this definition and the digest is the one walk that
 * gives up on it.
 */
const WIDE = carrying(
  (() => {
    let value: unknown = 1;
    for (let at = 0; at < 27; at += 1) value = [value, value];
    return value;
  })(),
);

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
    expect(codesOf(DEEP)).toEqual(['unknown-member']);
  });

  it('reports the digest it cannot take of a document no text names', () => {
    expect(codesOf({ ...WIDE, digest: '0'.repeat(32) })).toEqual([
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

  it('carries the message and the key of the issue it refuses a document for', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    };

    const result = parseFeatureConfig(config);

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'duplicate-feature',
        message: 'duplicate feature key "a"',
        key: 'a',
      },
    ]);
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

/**
 * The copy the construction path takes, which the checker asks nothing about.
 *
 * Decision 11 puts both entry points behind one checker, and the checker reads
 * the members § 3 names. It reads no value below a variant value, so a document
 * whose variant value `structuredClone` has no serialization for is one it
 * answers `{ ok: true }` about. `createFeatures` copies the definition and
 * raises there, and this entry point reports the raise as the definition that
 * carries the value.
 *
 * The literal path keeps the raise. A value no copy holds is a programming
 * error at the authoring site, which is the argument `errors.ts:3-11` makes for
 * every throw this library raises where the configuration is supplied.
 */
describe('the copy a document asks the construction path for', () => {
  /** The documents whose variant value no copy of the definition holds. */
  const UNCOPYABLE: readonly FeatureConfig[] = [
    {
      features: [
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [{ name: 'blue', weight: 1, order: 0, value: () => 1 }],
        },
      ],
    } as unknown as FeatureConfig,
    DEEP,
  ];

  it('reports what the checker reads no member of', () => {
    const answers = UNCOPYABLE.map((config) => [
      validateConfig(config).ok,
      parseFeatureConfig(config).ok,
    ]);

    expect(answers).toEqual([
      [true, false],
      [true, false],
    ]);
  });

  it('keys the refusal on the feature and points at the definition', () => {
    const result = parseFeatureConfig(
      UNCOPYABLE[0] as unknown as FeatureConfig,
    );

    expect(result.ok === false && result.issues[0]).toEqual({
      code: 'unknown-member',
      key: 'cta',
      message:
        'feature "cta" carries a value no copy of the definition holds: ' +
        '() => 1 could not be cloned.',
      path: '/features/0',
    });
  });

  it('names the definition the second row of a document carries', () => {
    const config = {
      features: [
        { key: 'a', enabled: true },
        {
          key: 'cta',
          enabled: true,
          ...TRAVELS,
          variants: [{ name: 'blue', weight: 1, order: 0, value: () => 1 }],
        },
      ],
    } as unknown as FeatureConfig;

    const result = parseFeatureConfig(config);

    expect(result.ok === false && result.issues[0]?.path).toBe('/features/1');
  });

  it('reports the raise no copy of a definition reproduces', () => {
    const config = carrying(new Uint8Array([1, 2, 3]));

    const result = parseFeatureConfig(config);

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        message: 'Cannot freeze array buffer views with elements',
      },
    ]);
  });

  it('throws out of createFeatures the copy raise and no typed error', () => {
    const config = UNCOPYABLE[0] as unknown as FeatureConfig;
    const build = () => createFeatures(config.features);

    expect(build).toThrow('() => 1 could not be cloned.');
    expect(build).not.toThrow(FeatureConfigError);
  });
});
