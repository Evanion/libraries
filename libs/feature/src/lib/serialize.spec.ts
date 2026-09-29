import { describe, expect, it } from 'vitest';
import { createFeatures } from './features.js';
import { serializeConfig } from './serialize.js';

describe('serializeConfig', () => {
  it('writes every definition the store holds, in store order', () => {
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features.map((each) => each.key)).toEqual([
      'checkout',
      'express',
    ]);
  });

  it('writes a Date in a window condition as its ISO string', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [
              {
                field: 'now',
                op: 'after',
                value: new Date('2026-10-01T00:00:00.000Z'),
              },
            ],
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.rules?.[0]?.when?.[0]).toEqual({
      field: 'now',
      op: 'after',
      value: '2026-10-01T00:00:00.000Z',
    });
  });

  it('survives a trip through JSON unchanged', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50, value: { label: 'Buy' } },
          { name: 'blue', weight: 50, value: { label: 'Get it' } },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });

  it('carries the envelope members a caller supplies', () => {
    const features = createFeatures([{ key: 'cta', enabled: true }] as const);

    const document = serializeConfig(features, {
      version: 'flags@41',
      maxStale: 60_000,
    });

    expect(document.version).toBe('flags@41');
  });

  it('writes a Date inside a variant value as its ISO string', () => {
    const features = createFeatures([
      {
        key: 'banner',
        enabled: true,
        variants: [
          {
            name: 'control',
            weight: 1,
            value: { until: new Date('2026-12-24T00:00:00.000Z') },
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variants?.[0]?.value).toEqual({
      until: '2026-12-24T00:00:00.000Z',
    });
  });

  it('writes a Date inside an attribute condition as its ISO string', () => {
    const features = createFeatures([
      {
        key: 'beta',
        enabled: true,
        rules: [
          {
            when: [
              {
                field: 'signedUpAt',
                op: 'eq',
                value: new Date('2026-01-01T00:00:00.000Z'),
              },
            ],
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.rules?.[0]?.when?.[0]?.value).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });

  it('refuses a variant value that holds itself', () => {
    const value: Record<string, unknown> = {};
    value['self'] = value;
    const features = createFeatures([
      {
        key: 'loop',
        enabled: true,
        variants: [{ name: 'a', weight: 1, value }],
      },
    ]);

    expect(() => serializeConfig(features)).toThrow(/holds itself/);
  });

  it('writes the four members that decide bucketing and build-time freezing', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        seed: 'cohort-7',
        variantBy: 'accountId',
        variantSeed: 'cta:split:v2',
        freezeTimeAtBuild: true,
        variants: [{ name: 'control', weight: 1 }],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]).toMatchObject({
      seed: 'cohort-7',
      variantBy: 'accountId',
      variantSeed: 'cta:split:v2',
      freezeTimeAtBuild: true,
    });
  });

  it('writes an explicit order on every variant', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variants?.map((each) => each.order)).toEqual([
      0, 1,
    ]);
  });

  it('keeps an order a control plane already wrote', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50, order: 7 },
          { name: 'blue', weight: 50, order: 3 },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variants?.map((each) => each.order)).toEqual([
      7, 3,
    ]);
  });

  it('writes an authored rule id untouched', () => {
    const features = createFeatures([
      {
        key: 'beta',
        enabled: true,
        rules: [
          {
            id: 'staff-only',
            when: [{ field: 'staff', op: 'eq', value: true }],
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.rules?.[0]?.id).toBe('staff-only');
  });

  it('invents no id for a rule that declares none', () => {
    const features = createFeatures([
      {
        key: 'beta',
        enabled: true,
        rules: [{ when: [{ field: 'staff', op: 'eq', value: true }] }],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.rules?.[0]).not.toHaveProperty('id');
  });
});
