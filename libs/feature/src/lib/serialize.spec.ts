import { describe, expect, it } from 'vitest';
import { FeatureConfigError } from './errors.js';
import { createFeatures } from './features.js';
import { serializeConfig } from './serialize.js';
import type { ConfigEnvelope } from './config.js';

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

  it('writes the definitions in the order the store holds, not in key order', () => {
    const features = createFeatures([
      { key: 'zebra', enabled: true },
      { key: 'alpha', enabled: true },
      { key: 'mid', enabled: true },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features.map((each) => each.key)).toEqual([
      'zebra',
      'alpha',
      'mid',
    ]);
  });

  it('writes an empty features array for a store holding no definitions', () => {
    const features = createFeatures([]);

    const document = serializeConfig(features);

    expect(document.features).toEqual([]);
  });

  it('writes a numeric feature key as the number the store holds', () => {
    const features = createFeatures([
      { key: 7, enabled: true },
      { key: 9, enabled: true },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features.map((each) => each.key)).toEqual([7, 9]);
  });

  it('writes dependsOn as the array the definition declared', () => {
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'payment', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout', 'payment'] },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[2]?.dependsOn).toEqual(['checkout', 'payment']);
  });

  it('writes an enabled of false rather than dropping the member', () => {
    const features = createFeatures([{ key: 'cta', enabled: false }] as const);

    const document = serializeConfig(features);

    expect(document.features[0]).toEqual({ key: 'cta', enabled: false });
  });

  it('writes the intent a toggle left behind, not the intent the store was built with', () => {
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ] as const);
    features.toggle('checkout', false);

    const document = serializeConfig(features);

    expect(document.features.map((each) => each.enabled)).toEqual([
      false,
      true,
    ]);
  });

  it("writes a rule's rollout and the variant it pins", () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [
          {
            id: 'ramp',
            rollout: { percent: 25, by: 'accountId', seed: 'ramp-1' },
            variant: 'blue',
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.rules?.[0]).toEqual({
      id: 'ramp',
      rollout: { percent: 25, by: 'accountId', seed: 'ramp-1' },
      variant: 'blue',
    });
  });

  it('writes a day-of-week condition with its zone and its weekdays', () => {
    const features = createFeatures([
      {
        key: 'weekend',
        enabled: true,
        rules: [
          {
            when: [
              {
                field: 'now',
                op: 'day-of-week',
                zone: 'Europe/Stockholm',
                value: ['sat', 'sun'],
              },
            ],
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.rules?.[0]?.when?.[0]).toEqual({
      field: 'now',
      op: 'day-of-week',
      zone: 'Europe/Stockholm',
      value: ['sat', 'sun'],
    });
  });

  it('writes the epoch and the last instant a Date represents', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        variants: [
          {
            name: 'control',
            weight: 1,
            value: { from: new Date(0), to: new Date(8_640_000_000_000_000) },
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variants?.[0]?.value).toEqual({
      from: '1970-01-01T00:00:00.000Z',
      to: '+275760-09-13T00:00:00.000Z',
    });
  });

  it('writes a Date that is an element of a nested array', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        variants: [
          {
            name: 'control',
            weight: 1,
            value: { windows: [[new Date('2026-10-01T00:00:00.000Z')]] },
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variants?.[0]?.value).toEqual({
      windows: [['2026-10-01T00:00:00.000Z']],
    });
  });

  it('survives a trip through JSON with a Date in all three places one reaches', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [
              {
                field: 'now',
                op: 'after',
                value: new Date('2026-10-01T00:00:00.000Z'),
              },
              {
                field: 'signedUpAt',
                op: 'eq',
                value: new Date('2026-01-01T00:00:00.000Z'),
              },
            ],
          },
        ],
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

    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });

  it('writes a single variant at order zero', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'control', weight: 1 }],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variants?.map((each) => each.order)).toEqual([
      0,
    ]);
  });

  it('keeps an order of zero, which an array index would overwrite', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50, order: 1 },
          { name: 'blue', weight: 50, order: 0 },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variants?.map((each) => each.order)).toEqual([
      1, 0,
    ]);
  });

  it('writes the largest weight and order a definition may carry', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          {
            name: 'control',
            weight: Number.MAX_SAFE_INTEGER,
            order: Number.MAX_SAFE_INTEGER,
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variants?.[0]).toEqual({
      name: 'control',
      weight: Number.MAX_SAFE_INTEGER,
      order: Number.MAX_SAFE_INTEGER,
    });
  });

  it('writes a weight of zero, which a variant no bucket reaches carries', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 1 },
          { name: 'retired', weight: 0 },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variants?.map((each) => each.weight)).toEqual([
      1, 0,
    ]);
  });

  it('writes one object twice when two variants share it', () => {
    const shared = { label: 'Buy' };
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 1, value: shared },
          { name: 'blue', weight: 1, value: shared },
        ],
      },
    ]);

    const document = serializeConfig(features);

    expect(document.features[0]?.variants?.map((each) => each.value)).toEqual([
      { label: 'Buy' },
      { label: 'Buy' },
    ]);
  });

  it('writes a member two paths of one value share', () => {
    const shared = { label: 'Buy' };
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 1, value: { one: shared, two: shared } },
        ],
      },
    ]);

    const document = serializeConfig(features);

    expect(document.features[0]?.variants?.[0]?.value).toEqual({
      one: { label: 'Buy' },
      two: { label: 'Buy' },
    });
  });

  it('writes one document per call, equal to the last and not the same object', () => {
    const features = createFeatures([{ key: 'cta', enabled: true }] as const);

    const first = serializeConfig(features);
    const second = serializeConfig(features);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it('leaves the store it read holding its Dates and its absent orders', () => {
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
        variants: [{ name: 'control', weight: 1 }],
      },
    ] as const);

    serializeConfig(features);
    const condition = features.config[0]?.rules?.[0]?.when?.[0];

    expect(condition?.value).toBeInstanceOf(Date);
    expect(features.config[0]?.variants?.[0]?.order).toBeUndefined();
  });

  it('hands back a definition the store does not hold, so a write to it changes no intent', () => {
    const features = createFeatures([{ key: 'cta', enabled: true }] as const);

    const document = serializeConfig(features);
    const written = document.features[0] as unknown as Record<string, unknown>;
    written['enabled'] = false;

    expect(features.config[0]?.enabled).toBe(true);
    expect(document.features[0]).not.toBe(features.config[0]);
  });

  it('writes a __proto__ member as an own property and pollutes no prototype', () => {
    const value = JSON.parse(
      '{"__proto__":{"polluted":true},"tier":"gold"}',
    ) as unknown;
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'control', weight: 1, value }],
      },
    ]);

    const document = serializeConfig(features);
    const written = document.features[0]?.variants?.[0]?.value as Record<
      string,
      unknown
    >;

    expect(Object.keys(written)).toEqual(['__proto__', 'tier']);
    expect(Object.getPrototypeOf(written)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  describe('the envelope', () => {
    it('carries every member a caller supplies', () => {
      const features = createFeatures([{ key: 'cta', enabled: true }] as const);

      const document = serializeConfig(features, {
        version: 'flags@73',
        maxStale: 30_000,
        schemaVersion: 'ctx@4',
        schema: { context: { fields: { tier: 'string' } } },
      });

      expect(document).toEqual({
        version: 'flags@73',
        maxStale: 30_000,
        schemaVersion: 'ctx@4',
        schema: { context: { fields: { tier: 'string' } } },
        features: [{ key: 'cta', enabled: true }],
      });
    });

    it('writes only features for a caller that supplied none', () => {
      const features = createFeatures([{ key: 'cta', enabled: true }] as const);

      const document = serializeConfig(features);

      expect(Object.keys(document)).toEqual(['features']);
    });

    it('writes the store over a features member an envelope carried', () => {
      const features = createFeatures([{ key: 'cta', enabled: true }] as const);

      const document = serializeConfig(features, {
        features: [],
      } as unknown as ConfigEnvelope);

      expect(document.features.map((each) => each.key)).toEqual(['cta']);
    });
  });

  describe('a cycle', () => {
    it('throws the configuration error type a caller already catches', () => {
      const value: Record<string, unknown> = {};
      value['self'] = value;
      const features = createFeatures([
        {
          key: 'loop',
          enabled: true,
          variants: [{ name: 'a', weight: 1, value }],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
    });

    it('names the path a variant value closes on', () => {
      const value: Record<string, unknown> = {};
      value['deep'] = { inner: value };
      const features = createFeatures([
        {
          key: 'loop',
          enabled: true,
          variants: [{ name: 'a', weight: 1, value }],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(
        '/features/0/variants/0/value/deep/inner',
      );
    });

    it('names the path an attribute condition value closes on', () => {
      const value: Record<string, unknown> = {};
      value['self'] = value;
      const features = createFeatures([
        {
          key: 'loop',
          enabled: true,
          rules: [{ when: [{ field: 'tier', op: 'eq', value }] }],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(
        '/features/0/rules/0/when/0/value/self',
      );
    });

    it('names the index an array closes on', () => {
      const value: unknown[] = [];
      value.push(value);
      const features = createFeatures([
        {
          key: 'loop',
          enabled: true,
          variants: [{ name: 'a', weight: 1, value }],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(
        '/features/0/variants/0/value/0',
      );
    });

    it('names the index of the definition it sits in', () => {
      const value: Record<string, unknown> = {};
      value['self'] = value;
      const features = createFeatures([
        { key: 'clean', enabled: true },
        {
          key: 'loop',
          enabled: true,
          variants: [{ name: 'a', weight: 1, value }],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(
        '/features/1/variants/0/value/self',
      );
    });
  });
});
