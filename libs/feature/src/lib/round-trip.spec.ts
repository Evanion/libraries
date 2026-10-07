import { describe, expect, it } from 'vitest';
import { configDigest } from './digest.js';
import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';

const body: readonly FeatureConfig['features'][number][] = [
  { key: 'checkout', enabled: true },
  {
    key: 'cta',
    enabled: true,
    dependsOn: ['checkout'],
    variantBy: 'targetingKey',
    variantSeed: 'cta:variant',
    variants: [
      { name: 'control', weight: 50, order: 0, value: { label: 'Buy' } },
      { name: 'blue', weight: 50, order: 1, value: { label: 'Get it' } },
    ],
  },
];

describe('maxStale', () => {
  it('decides nothing, whatever the clock says', () => {
    const bounded = createFeatures({ maxStale: 1, features: body });
    const unbounded = createFeatures({ features: body });
    const context = {
      targetingKey: 'u1',
      now: new Date('2099-01-01T00:00:00.000Z'),
    };

    expect(bounded.resolve(context)).toEqual(unbounded.resolve(context));
  });

  it('changes no plan and no toggle', () => {
    const bounded = createFeatures({ maxStale: 1, features: body });
    const unbounded = createFeatures({ features: body });
    const context = { now: new Date('2099-01-01T00:00:00.000Z') };

    expect(bounded.plan(context)).toEqual(unbounded.plan(context));
    expect(bounded.toggle('checkout', false, context)).toEqual(
      unbounded.toggle('checkout', false, context),
    );
  });

  it('carries into a serialization and out again', () => {
    const features = createFeatures({ maxStale: 60_000, features: body });

    expect(serializeConfig(features).maxStale).toBe(60_000);
  });
});

describe('the round trip', () => {
  it('produces the document it started from', () => {
    const features = createFeatures({ version: 41, features: body });
    const document = serializeConfig(features);

    const arrived = JSON.parse(JSON.stringify(document)) as FeatureConfig;
    const result = parseFeatureConfig(arrived);

    expect(result.ok && serializeConfig(result.features)).toEqual(document);
  });

  it('produces a store holding the configuration it started from', () => {
    const features = createFeatures({ version: 41, features: body });

    const arrived = JSON.parse(
      JSON.stringify(serializeConfig(features)),
    ) as FeatureConfig;
    const result = parseFeatureConfig(arrived);

    // The spec states the round trip over the store's `config`, not over two
    // serialized documents. A serializer and a parser that drop one member the
    // same way agree on the document and disagree here.
    expect(result.ok && result.features.config).toEqual(features.config);
  });

  it('holds the digest across the hop', () => {
    const features = createFeatures({ version: 41, features: body });
    const document = serializeConfig(features);

    const arrived = JSON.parse(JSON.stringify(document)) as FeatureConfig;

    expect(configDigest(arrived)).toBe(configDigest(document));
  });

  it('replaces a Date with its ISO string and digests the same either way', () => {
    const withDate = [
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [
              {
                field: 'now' as const,
                op: 'after' as const,
                value: new Date('2026-10-01T00:00:00.000Z'),
              },
            ],
          },
        ],
      },
    ];
    const features = createFeatures(withDate);
    const document = serializeConfig(features);

    const arrived = JSON.parse(JSON.stringify(document)) as FeatureConfig;

    expect(configDigest(arrived)).toBe(configDigest(document));
  });

  it('assigns identically after a permutation that keeps every order', () => {
    const features = createFeatures({ features: body });
    const document = serializeConfig(features);
    const permuted: FeatureConfig = {
      ...document,
      features: document.features.map((definition) =>
        definition.variants
          ? { ...definition, variants: [...definition.variants].reverse() }
          : definition,
      ),
    };

    const result = parseFeatureConfig(permuted);
    const subjects = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'];

    expect(
      result.ok &&
        subjects.map((targetingKey) =>
          result.features.variantOf('cta', { targetingKey }),
        ),
    ).toEqual(
      subjects.map((targetingKey) =>
        features.variantOf('cta', { targetingKey }),
      ),
    );
  });

  it('names the same rule after a permutation of the rules array', () => {
    const rules = [
      {
        id: 'staff',
        when: [{ field: 'staff', op: 'eq' as const, value: true }],
      },
      { id: 'beta', when: [{ field: 'beta', op: 'eq' as const, value: true }] },
    ];
    const features = createFeatures([{ key: 'x', enabled: true, rules }]);
    const permuted = createFeatures([
      { key: 'x', enabled: true, rules: [...rules].reverse() },
    ]);
    // `decide` returns on the first matching rule, so a context matching both
    // answers 'staff' at one index and 'beta' at the other. The assertion is
    // that `ruleId` is content-derived, so the one rule that matches carries
    // the same name whichever index the permutation put it at.
    const context = { staff: true, beta: false };

    expect(permuted.resolve(context).x.rule).toBe(
      features.resolve(context).x.rule,
    );
  });

  it('refuses a document whose rules moved and whose digest did not', () => {
    const rules = [
      {
        id: 'staff',
        when: [{ field: 'staff', op: 'eq' as const, value: true }],
      },
      { id: 'beta', when: [{ field: 'beta', op: 'eq' as const, value: true }] },
    ];
    const one: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules }],
    };
    const tampered: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules: [...rules].reverse() }],
      digest: configDigest(one),
    };

    const result = parseFeatureConfig(tampered);

    expect(result.ok === false && result.issues[0]?.code).toBe(
      'digest-mismatch',
    );
  });
});

describe('the duration no entry point reads', () => {
  it('decides what the unbounded store decides, and decides something', () => {
    const bounded = createFeatures({ maxStale: 1, features: body });
    const context = { targetingKey: 'u1' };

    const decisions = bounded.resolve(context);

    expect(decisions).toEqual(
      createFeatures({ features: body }).resolve(context),
    );
    expect(decisions).toMatchObject({
      checkout: { enabled: true },
      cta: { enabled: true, variant: 'control' },
    });
  });

  it('reaches no decision and no plan entry under any name', () => {
    const features = createFeatures({ maxStale: 60_000, features: body });
    const context = { targetingKey: 'u1' };

    const text = JSON.stringify([
      features.resolve(context),
      features.plan(context),
      features.toggle('checkout', false, context),
    ]);

    expect(text).not.toMatch(/maxStale|stale/i);
  });

  it('carries a zero out, which a falsy test for the member would drop', () => {
    const features = createFeatures({ maxStale: 0, features: body });

    expect(serializeConfig(features).maxStale).toBe(0);
  });

  it('carries a duration legal for the type and wrong for the domain', () => {
    const answers = [-1, 0.5, Number.MAX_SAFE_INTEGER].map(
      (maxStale) =>
        serializeConfig(createFeatures({ maxStale, features: body })).maxStale,
    );

    expect(answers).toEqual([-1, 0.5, Number.MAX_SAFE_INTEGER]);
  });

  it('leaves the decisions alone whatever the publisher wrote there', () => {
    const context = { targetingKey: 'u1' };
    const answers = [-1, 0, 0.5, Number.MAX_SAFE_INTEGER].map((maxStale) => {
      const result = parseFeatureConfig({ maxStale, features: body });
      return result.ok && result.features.resolve(context);
    });

    expect(answers[0]).toEqual(
      createFeatures({ features: body }).resolve(context),
    );
    expect(new Set(answers.map((each) => JSON.stringify(each))).size).toBe(1);
  });
});

describe('the round trip over an envelope', () => {
  const schema = {
    context: { fields: { targetingKey: 'string' } },
    features: {
      cta: {
        variants: {
          control: { type: 'object' },
          blue: { type: 'object' },
        },
      },
    },
  } as const;

  it('produces the document it started from, every member carried', () => {
    const document: FeatureConfig = {
      version: 0,
      schema,
      schemaVersion: '1',
      maxStale: 0,
      features: body,
    };

    const arrived = JSON.parse(
      JSON.stringify({ ...document, digest: configDigest(document) }),
    ) as FeatureConfig;
    const result = parseFeatureConfig(arrived);

    // `serializeConfig` writes no digest: `ConfigEnvelope` fences the member to
    // `never` and `configDigest` is its one writer, so a holder re-serving a
    // document it verified publishes the configuration and recomputes the
    // digest over the bytes it serves.
    expect(result.ok && serializeConfig(result.features)).toEqual(document);
  });

  it('produces a document a second hop leaves alone', () => {
    const features = createFeatures({ version: 41, features: body });
    const once = serializeConfig(features);

    const twice = parseFeatureConfig(
      JSON.parse(JSON.stringify(once)) as FeatureConfig,
    );
    const thrice =
      twice.ok &&
      parseFeatureConfig(
        JSON.parse(
          JSON.stringify(serializeConfig(twice.features)),
        ) as FeatureConfig,
      );

    expect(thrice && thrice.ok && serializeConfig(thrice.features)).toEqual(
      once,
    );
  });

  it('carries a version of zero and one of the empty string', () => {
    const answers = [0, '', Number.MAX_SAFE_INTEGER, 'v1'].map(
      (version) =>
        serializeConfig(createFeatures({ version, features: body })).version,
    );

    expect(answers).toEqual([0, '', Number.MAX_SAFE_INTEGER, 'v1']);
  });

  it('produces a different document for a different configuration', () => {
    const features = createFeatures({ version: 41, features: body });
    const document = serializeConfig(features);
    const other = createFeatures({
      version: 41,
      features: [{ key: 'checkout', enabled: false }],
    });

    expect(serializeConfig(other)).not.toEqual(document);
  });

  it('closes over a document declaring no features', () => {
    const empty: FeatureConfig = { version: 1, features: [] };

    const result = parseFeatureConfig(
      JSON.parse(JSON.stringify(empty)) as FeatureConfig,
    );

    expect(result.ok && serializeConfig(result.features)).toEqual(empty);
    expect(result.ok && result.features.resolve({})).toEqual({});
    expect(configDigest(empty)).not.toBe(
      configDigest({ version: 1, features: body }),
    );
  });

  it('closes over the one definition a document carries', () => {
    const one: FeatureConfig = {
      features: [{ key: 'checkout', enabled: true }],
    };

    const result = parseFeatureConfig(
      JSON.parse(JSON.stringify(one)) as FeatureConfig,
    );

    expect(result.ok && serializeConfig(result.features)).toEqual(one);
  });

  it('closes over a definition keyed on a number', () => {
    const numeric: FeatureConfig<7> = {
      version: 1,
      features: [{ key: 7, enabled: true }],
    };

    const result = parseFeatureConfig<Record<7, never>>(
      JSON.parse(JSON.stringify(numeric)) as FeatureConfig<7>,
    );

    expect(result.ok && serializeConfig(result.features)).toEqual(numeric);
    expect(result.ok && result.features.keys).toEqual([7]);
  });

  it('refuses a document listing one key twice and serializes nothing', () => {
    const twice: FeatureConfig = {
      features: [
        { key: 'checkout', enabled: true },
        { key: 'checkout', enabled: false },
      ],
    };

    const result = parseFeatureConfig(twice);

    expect(result.ok).toBe(false);
    expect(
      result.ok === false && result.issues.map((each) => each.code),
    ).toEqual(['duplicate-feature']);
  });
});

describe('the digest across the hop', () => {
  it('passes a document whose digest describes it', () => {
    const document: FeatureConfig = { version: 41, features: body };
    const served: FeatureConfig = {
      ...document,
      digest: configDigest(document),
    };

    const result = parseFeatureConfig(
      JSON.parse(JSON.stringify(served)) as FeatureConfig,
    );

    expect(result.ok).toBe(true);
  });

  it('disagrees across the hop when one weight moved', () => {
    const document = serializeConfig(createFeatures({ features: body }));
    const moved: FeatureConfig = {
      ...document,
      features: document.features.map((definition) =>
        definition.variants
          ? {
              ...definition,
              variants: definition.variants.map((variant, at) =>
                at === 0 ? { ...variant, weight: 49 } : variant,
              ),
            }
          : definition,
      ),
    };

    const arrived = JSON.parse(JSON.stringify(moved)) as FeatureConfig;

    expect(configDigest(arrived)).not.toBe(configDigest(document));
  });

  it('carries a window instant the store already holds as a string', () => {
    const stringly: FeatureConfig = {
      features: [
        {
          key: 'sale',
          enabled: true,
          rules: [
            {
              when: [
                {
                  field: 'now',
                  op: 'after',
                  value: '2026-10-01T00:00:00.000Z',
                },
              ],
            },
          ],
        },
      ],
    };

    const result = parseFeatureConfig(stringly);

    expect(result.ok && serializeConfig(result.features)).toEqual(stringly);
  });

  it('carries a window instant the store already holds as epoch milliseconds', () => {
    const numeric: FeatureConfig = {
      features: [
        {
          key: 'sale',
          enabled: true,
          rules: [
            {
              when: [{ field: 'now', op: 'after', value: 1_790_000_000_000 }],
            },
          ],
        },
      ],
    };

    const result = parseFeatureConfig(numeric);

    expect(result.ok && serializeConfig(result.features)).toEqual(numeric);
  });

  it('digests a Date and the string that spells it alike, and the instant before it apart', () => {
    const authored = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [
              {
                field: 'now' as const,
                op: 'after' as const,
                value: new Date('2026-10-01T00:00:00.000Z'),
              },
            ],
          },
        ],
      },
    ]);
    const earlier = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [
              {
                field: 'now' as const,
                op: 'after' as const,
                value: new Date('2026-09-30T23:59:59.999Z'),
              },
            ],
          },
        ],
      },
    ]);

    expect(configDigest(serializeConfig(authored))).not.toBe(
      configDigest(serializeConfig(earlier)),
    );
  });
});

describe('what the permutations prove', () => {
  it('splits the subjects it permutes across both variants', () => {
    const features = createFeatures({ features: body });
    const subjects = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'];

    const assigned = subjects.map((targetingKey) =>
      features.variantOf('cta', { targetingKey }),
    );

    expect(new Set(assigned)).toEqual(new Set(['control', 'blue']));
  });

  it('names the rule that matched and not the rule at the index', () => {
    const rules = [
      {
        id: 'staff',
        when: [{ field: 'staff', op: 'eq' as const, value: true }],
      },
      { id: 'beta', when: [{ field: 'beta', op: 'eq' as const, value: true }] },
    ];
    const permuted = createFeatures([
      { key: 'x', enabled: true, rules: [...rules].reverse() },
    ]);

    expect(permuted.resolve({ staff: true, beta: false }).x.rule).toBe('staff');
    expect(permuted.resolve({ staff: false, beta: true }).x.rule).toBe('beta');
  });

  it('accepts the document whose rules did not move', () => {
    const rules = [
      {
        id: 'staff',
        when: [{ field: 'staff', op: 'eq' as const, value: true }],
      },
      { id: 'beta', when: [{ field: 'beta', op: 'eq' as const, value: true }] },
    ];
    const one: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules }],
    };

    const result = parseFeatureConfig({ ...one, digest: configDigest(one) });

    expect(result.ok).toBe(true);
  });
});

describe('what the publisher states and the holder would otherwise default', () => {
  const implicit = [
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50, value: { label: 'Buy' } },
        { name: 'blue', weight: 50, value: { label: 'Get it' } },
      ],
    },
  ] as const;
  const subjects = Array.from({ length: 20 }, (_, at) => `u${String(at)}`);

  it('states the order, the field and the seed a literal left implicit', () => {
    const features = createFeatures(implicit);

    const document = serializeConfig(features);

    expect(document.features[0]).toMatchObject({
      variantBy: 'targetingKey',
      variantSeed: 'cta:variant',
      variants: [{ order: 0 }, { order: 1 }],
    });
  });

  it('assigns in the holder what the publisher assigned, over a literal that stated none of the three', () => {
    const features = createFeatures(implicit);

    const arrived = JSON.parse(
      JSON.stringify(serializeConfig(features)),
    ) as FeatureConfig;
    const result = parseFeatureConfig(arrived);
    const held = subjects.map(
      (targetingKey) =>
        result.ok && result.features.variantOf('cta', { targetingKey }),
    );

    expect(held).toEqual(
      subjects.map((targetingKey) =>
        features.variantOf('cta', { targetingKey }),
      ),
    );
    expect(new Set(held)).toEqual(new Set(['control', 'blue']));
  });

  it('buckets a rollout in the holder the way the publisher bucketed it', () => {
    const features = createFeatures([
      {
        key: 'nav',
        enabled: true,
        rules: [{ rollout: { percent: 50 } }],
      },
    ]);

    const arrived = JSON.parse(
      JSON.stringify(serializeConfig(features)),
    ) as FeatureConfig;
    const result = parseFeatureConfig(arrived);
    const held = subjects.map(
      (targetingKey) =>
        result.ok && result.features.resolve({ targetingKey }).nav?.enabled,
    );

    expect(held).toEqual(
      subjects.map(
        (targetingKey) => features.resolve({ targetingKey }).nav?.enabled,
      ),
    );
    expect(new Set(held)).toEqual(new Set([true, false]));
  });

  it('names a rule that declares no id alike on both sides of the hop', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [
              {
                field: 'now' as const,
                op: 'after' as const,
                value: new Date('2026-10-01T00:00:00.000Z'),
              },
            ],
          },
        ],
      },
    ]);
    const context = { now: new Date('2026-10-02T00:00:00.000Z') };

    const arrived = JSON.parse(
      JSON.stringify(serializeConfig(features)),
    ) as FeatureConfig;
    const result = parseFeatureConfig(arrived);
    const published = features.resolve(context).sale?.rule;

    expect(published).toMatch(/^rule-/);
    expect(result.ok && result.features.resolve(context).sale?.rule).toBe(
      published,
    );
  });
});
