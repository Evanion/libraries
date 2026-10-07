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
