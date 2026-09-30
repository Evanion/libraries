import { describe, expect, it } from 'vitest';
import { FeatureConfigError } from './errors.js';
import { createFeatures } from './features.js';
import { serializeConfig } from './serialize.js';
import { assignVariant } from './variants.js';
import type { ConfigEnvelope, FeatureConfig } from './config.js';
import type { Definitions } from './features.js';
import type { FeatureDefinition } from './types.js';

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

  it('refuses a Date inside a variant value, which two processes read two ways', () => {
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

    expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
    expect(() => serializeConfig(features)).toThrow(
      'the value at /features/0/variants/0/value/until is a Date, and a ' +
        'document carries an instant as an ISO 8601 string or as epoch ' +
        'milliseconds',
    );
  });

  it('refuses a Date at an attribute condition value, which === compares by identity', () => {
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

    expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
    expect(() => serializeConfig(features)).toThrow(
      'the value at /features/0/rules/0/when/0/value is a Date, and a ' +
        'document carries an instant as an ISO 8601 string or as epoch ' +
        'milliseconds',
    );
  });

  it('resolves a document the way the store that wrote it resolves', () => {
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
                value: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
      },
    ] as const);
    const document = serializeConfig(features);
    const carried = JSON.parse(JSON.stringify(document)) as FeatureConfig;
    const holder = createFeatures(carried.features as Definitions);
    const context = { signedUpAt: '2026-01-01T00:00:00.000Z' };

    expect(holder.resolve(context)).toEqual(features.resolve(context));
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

  it('writes the members a definition carrying variants has, and no others', () => {
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

    expect(document.features[0]).toEqual({
      key: 'cta',
      enabled: true,
      variantBy: 'targetingKey',
      variantSeed: 'cta:variant',
      variants: [
        { name: 'control', weight: 50, order: 0 },
        { name: 'blue', weight: 50, order: 1 },
      ],
    });
  });

  /**
   * The two bucketing members a definition may leave out, written out.
   *
   * § 3 names four members that travel whole or the document is refused. A
   * variant `weight` is required of every author and `VariantSpec.order` is
   * written by `ordered`, which leaves `variantBy` and `variantSeed`: a holder
   * meeting either one absent fills it from `DEFAULT_ROLLOUT_FIELD` and from
   * `variantSeedOf`, and the document then states the walk order and states
   * neither the field nor the seed the walk buckets on.
   */
  it('writes the field a variant assignment buckets on', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'control', weight: 1 }],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variantBy).toBe('targetingKey');
  });

  it('writes the seed a variant assignment buckets on, derived from the key', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'control', weight: 1 }],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variantSeed).toBe('cta:variant');
  });

  it("writes the seed a definition's own seed derives", () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        seed: 'cohort-7',
        variants: [{ name: 'control', weight: 1 }],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(document.features[0]?.variantSeed).toBe('cohort-7:variant');
  });

  it('writes neither bucketing member for a feature that declares no variants', () => {
    const features = createFeatures([{ key: 'cta', enabled: true }] as const);

    const document = serializeConfig(features);

    expect(Object.keys(document.features[0] ?? {})).toEqual(['key', 'enabled']);
  });

  /**
   * A rollout member keeps its default, and `ruleId` is why.
   *
   * `rolloutText` in `rule-id.ts` derives a rule's name from
   * `canonical({ by, seed })` for a rule that declares no `id`. A serializer
   * writing either member's default renames every derived rule the document
   * carries, which orphans every event already attached to it. Both members
   * reach their default from `key` and `seed`, and the document carries both,
   * so a holder computes what the publisher computed.
   */
  it('leaves a rollout that declares no field and no seed as the store holds it', () => {
    const features = createFeatures([
      {
        key: 'beta',
        enabled: true,
        rules: [{ rollout: { percent: 25 } }],
      },
    ] as const);

    const document = serializeConfig(features);
    const published = document.features[0]?.rules?.[0];

    expect(published?.rollout).toEqual({ percent: 25 });
    expect(published?.id).toBeUndefined();
  });

  /**
   * The permutation `ordered` exists for.
   *
   * A control plane holding a feature's variants as rows and selecting them
   * with no `ORDER BY` hands them back in whatever order the table gave. The
   * explicit `order` the document carries is what makes that harmless: a
   * holder sorts on it and walks the bands the publisher walked. Without the
   * member the holder falls to the array index, every band boundary moves, and
   * every subject above a moved boundary gets another variant with nothing
   * reporting it.
   */
  it('assigns what the publisher assigns from a document whose variants arrived permuted', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 20 },
          { name: 'blue', weight: 30 },
          { name: 'green', weight: 50 },
        ],
      },
    ] as const);
    const document = serializeConfig(features);
    const permuted = {
      ...document.features[0],
      variants: [...(document.features[0]?.variants ?? [])].reverse(),
    } as FeatureDefinition<'cta'>;
    const holder = createFeatures([permuted] as Definitions<'cta'>);
    const subjects = Array.from(
      { length: 40 },
      (_, at) => `user-${String(at)}`,
    );
    const assigned = (store: typeof features, subject: string) =>
      assignVariant(store.config[0] as FeatureDefinition<'cta'>, {
        targetingKey: subject,
      })?.variant.name;

    expect(subjects.map((subject) => assigned(holder, subject))).toEqual(
      subjects.map((subject) => assigned(features, subject)),
    );
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
        rules: [
          {
            when: [
              { field: 'now', op: 'after', value: new Date(0) },
              {
                field: 'now',
                op: 'before',
                value: new Date(8_640_000_000_000_000),
              },
            ],
          },
        ],
      },
    ] as const);

    const document = serializeConfig(features);

    expect(
      document.features[0]?.rules?.[0]?.when?.map((each) => each.value),
    ).toEqual(['1970-01-01T00:00:00.000Z', '+275760-09-13T00:00:00.000Z']);
  });

  it('refuses a Date that is an element of a nested array', () => {
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

    expect(() => serializeConfig(features)).toThrow(
      '/features/0/variants/0/value/windows/0/0',
    );
  });

  it('survives a trip through JSON with a Date at the one place one reaches', () => {
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
                value: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
        variants: [
          {
            name: 'control',
            weight: 1,
            value: { until: '2026-12-24T00:00:00.000Z' },
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

  it('writes one object for the value two variants share, and JSON writes it twice', () => {
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
    const values = document.features[0]?.variants?.map((each) => each.value);

    expect(values).toEqual([{ label: 'Buy' }, { label: 'Buy' }]);
    expect(values?.[0]).toBe(values?.[1]);
  });

  it('writes one object for the member two paths of one value share', () => {
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
    const value = document.features[0]?.variants?.[0]?.value as Record<
      string,
      unknown
    >;

    expect(value).toEqual({ one: { label: 'Buy' }, two: { label: 'Buy' } });
    expect(value['one']).toBe(value['two']);
  });

  /**
   * A diamond, which the walk meets once per path unless it memoizes.
   *
   * `open` answers whether the walk stands on a value already, which is the
   * cycle question. A value two paths reach is not a cycle and every path
   * copying it is what fans out: 20 levels reached 22MB and 26 killed the
   * worker on heap. `structuredClone` carries the sharing into the store and
   * `deepFreeze` walks each node once, so the serializer is the pass that
   * decided the document's size, and the document is what a control plane
   * serves.
   *
   * `toBe` is the assertion the size rests on. A walk that copied would still
   * satisfy `toEqual` on both branches, at 2^20 the cost.
   */
  it('writes one object for a value every path of a deep diamond reaches', () => {
    let node: Record<string, unknown> = { leaf: 'Buy' };
    for (let level = 0; level < 20; level += 1) node = { l: node, r: node };
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'control', weight: 1, value: node }],
      },
    ]);

    const value = serializeConfig(features).features[0]?.variants?.[0]
      ?.value as Record<string, unknown>;

    const copied: number[] = [];
    let spine = value;
    for (let level = 0; level < 20; level += 1) {
      if (spine['l'] !== spine['r']) copied.push(level);
      spine = spine['l'] as Record<string, unknown>;
    }

    expect(copied).toEqual([]);
    expect(spine).toEqual({ leaf: 'Buy' });
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

  /**
   * A leaf `serialized` walks past and JSON cannot write.
   *
   * `serializeConfig` produces a JSON document, and `errors.ts` puts every
   * configuration fault at the call that supplied the configuration, as a
   * `FeatureConfigError`. Each leaf here reaches the walk and breaks both.
   *
   * An invalid `Date` makes `toISOString` raise a bare `RangeError` naming no
   * path and no key. A `bigint` passes through, and the publisher's own
   * `JSON.stringify` throws a `TypeError` naming nothing. A `Map`, a `Set` and
   * a `RegExp` keep what they hold in internal slots, and an `Error` keeps its
   * message and its stack as non-enumerable members, so `Object.entries` reads
   * nothing off any of the four and the holder installs a document whose
   * variant value lost what it carried, with no digest disagreeing: the
   * publisher canonicalizes the same `{}`.
   *
   * `NaN` and `Infinity` become `null` on the first transport hop
   * and both sides digest `null`, so nothing reports the difference. An
   * `undefined` array element goes the other way, since `canonical` writes the
   * text `undefined` where JSON writes `null`, and the holder refuses the whole
   * document over a digest mismatch it cannot explain.
   *
   * Every one of them reaches a store: `structuredClone` carries them, holes in
   * a sparse array included, and `deepFreeze` seals a `Map` and a `Set` on
   * purpose. Three kinds never arrive, so no case here holds them. A function
   * and a symbol make `structuredClone` raise `DataCloneError` inside
   * `createFeatures`, a typed array makes `deepFreeze` raise `TypeError`, and
   * `structuredClone` hands back a class instance as a plain object.
   *
   * Each case asserts the message as well as the class. The message is what a
   * publisher reads to find the value it has to replace, and a case that
   * asserted the class alone would pass with every branch raising one sentence
   * and with `nameOf` returning a constant.
   *
   * `null` is the leaf the walk admits and this block does not hold. `a null`
   * below carries it.
   */
  describe('a leaf JSON carries no value of', () => {
    it('refuses a window condition Date that names no instant', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          rules: [
            { when: [{ field: 'now', op: 'after', value: new Date(NaN) }] },
          ],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
      expect(() => serializeConfig(features)).toThrow(
        'the Date at /features/0/rules/0/when/0/value names no instant, and ' +
          'JSON carries no invalid Date',
      );
    });

    it('refuses a bigint, which JSON.stringify throws on', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'control', weight: 1, value: { budget: 10n } }],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
      expect(() => serializeConfig(features)).toThrow(
        'the value at /features/0/variants/0/value/budget is a bigint, and ' +
          'JSON carries no bigint',
      );
    });

    it('refuses a Map, whose entries a document would lose', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [
            {
              name: 'control',
              weight: 1,
              value: new Map([['label', 'Buy']]),
            },
          ],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
      expect(() => serializeConfig(features)).toThrow(
        'the value at /features/0/variants/0/value is a Map, and JSON carries ' +
          'no Map',
      );
    });

    it('refuses a Set, whose members a document would lose', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'control', weight: 1, value: new Set([1, 2]) }],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
      expect(() => serializeConfig(features)).toThrow(
        'the value at /features/0/variants/0/value is a Set, and JSON carries ' +
          'no Set',
      );
    });

    it('refuses a RegExp, which a document would carry as an empty object', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'control', weight: 1, value: { match: /x/g } }],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
      expect(() => serializeConfig(features)).toThrow(
        'the value at /features/0/variants/0/value/match is a RegExp, and ' +
          'JSON carries no RegExp',
      );
    });

    it('refuses an Error, whose message is not an own enumerable member', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, value: { cause: new Error('boom') } },
          ],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
      expect(() => serializeConfig(features)).toThrow(
        'the value at /features/0/variants/0/value/cause is an Error, and ' +
          'JSON carries no Error',
      );
    });

    it('refuses NaN, which one JSON hop turns into null', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'control', weight: 1, value: { budget: NaN } }],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
      expect(() => serializeConfig(features)).toThrow(
        'the number at /features/0/variants/0/value/budget is NaN, and JSON ' +
          'carries no non-finite number',
      );
    });

    it('refuses Infinity, which one JSON hop turns into null', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, value: { budget: Infinity } },
          ],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
      expect(() => serializeConfig(features)).toThrow(
        'the number at /features/0/variants/0/value/budget is Infinity, and ' +
          'JSON carries no non-finite number',
      );
    });

    it('refuses a non-finite number at an attribute condition value', () => {
      const features = createFeatures([
        {
          key: 'beta',
          enabled: true,
          rules: [{ when: [{ field: 'spend', op: 'eq', value: -Infinity }] }],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
      expect(() => serializeConfig(features)).toThrow(
        'the number at /features/0/rules/0/when/0/value is -Infinity, and ' +
          'JSON carries no non-finite number',
      );
    });

    it('refuses an undefined array element, which two sides digest two ways', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, value: ['a', undefined, 2] },
          ],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
      expect(() => serializeConfig(features)).toThrow(
        'the element at /features/0/variants/0/value/1 is undefined, and JSON ' +
          'carries no undefined element',
      );
    });

    it('refuses a hole in a sparse array, which structuredClone keeps', () => {
      const sparse = ['a', , 2];
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'control', weight: 1, value: sparse }],
        },
      ]);

      expect(1 in (features.config[0]?.variants?.[0]?.value as unknown[])).toBe(
        false,
      );
      expect(() => serializeConfig(features)).toThrow(FeatureConfigError);
      expect(() => serializeConfig(features)).toThrow(
        'the element at /features/0/variants/0/value/1 is undefined, and JSON ' +
          'carries no undefined element',
      );
    });

    it('names the path to the leaf it refused', () => {
      const features = createFeatures([
        { key: 'clean', enabled: true },
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 1, value: { labels: [new Map()] } },
          ],
        },
      ]);

      expect(() => serializeConfig(features)).toThrow(
        '/features/1/variants/0/value/labels/0',
      );
    });
  });

  /**
   * `null`, the one leaf the walk admits that is neither a primitive nor a
   * plain container.
   *
   * § 8 leaves the rest of the document to JSON, and `config.ts`'s `JsonValue`
   * lists `null` beside the primitives, so an author clearing an optional field
   * writes one. The walk has to admit it on purpose: `typeof null` is
   * `'object'`, so `null` reaches the prototype rule with every guard above it
   * passed, and `Object.getPrototypeOf(null)` raises a bare `TypeError` naming
   * no path.
   *
   * `config.test-d.ts` holds `null` against `JsonValue`. These three cases are
   * the runtime half: a member, a whole condition value, and an array element,
   * which is the element `canonical` and `JSON.stringify` both write as `null`.
   */
  describe('a null', () => {
    it('writes a null variant value member', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'control', weight: 1, value: { label: null } }],
        },
      ]);

      const document = serializeConfig(features);

      expect(document.features[0]?.variants?.[0]?.value).toEqual({
        label: null,
      });
    });

    it('writes a null attribute condition value', () => {
      const features = createFeatures([
        {
          key: 'beta',
          enabled: true,
          rules: [{ when: [{ field: 'plan', op: 'eq', value: null }] }],
        },
      ]);

      const document = serializeConfig(features);

      expect(document.features[0]?.rules?.[0]?.when?.[0]?.value).toBeNull();
    });

    it('writes a null array element, which both sides digest as null', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'control', weight: 1, value: ['a', null, 2] }],
        },
      ]);

      const document = serializeConfig(features);

      expect(document.features[0]?.variants?.[0]?.value).toEqual([
        'a',
        null,
        2,
      ]);
      expect(JSON.parse(JSON.stringify(document))).toEqual(document);
    });
  });

  /**
   * A member written as `undefined`, which the document does not carry.
   *
   * § 8 of the spec: "`undefined` members drop on the way out, which is what
   * `canonical.ts:21-22` does and what keeps an absent key and a key written as
   * `undefined` agreeing". `structuredClone` keeps the property, so the drop is
   * this walk's to make.
   *
   * Both cases read `Object.keys`. `toEqual` treats a key holding `undefined`
   * as absent, so a round-trip assertion passes whether the member dropped or
   * not, and nothing fails when the filter goes.
   */
  describe('an undefined member', () => {
    it('drops out of a variant value and leaves the members beside it', () => {
      const features = createFeatures([
        {
          key: 'cta',
          enabled: true,
          variants: [
            {
              name: 'control',
              weight: 1,
              value: { label: undefined, tier: 'gold' },
            },
          ],
        },
      ]);

      const document = serializeConfig(features);
      const value = document.features[0]?.variants?.[0]?.value as Record<
        string,
        unknown
      >;

      expect(Object.keys(value)).toEqual(['tier']);
    });

    it('drops out of an attribute condition value and leaves the members beside it', () => {
      const features = createFeatures([
        {
          key: 'beta',
          enabled: true,
          rules: [
            {
              when: [
                {
                  field: 'plan',
                  op: 'eq',
                  value: { name: undefined, tier: 'gold' },
                },
              ],
            },
          ],
        },
      ]);

      const document = serializeConfig(features);
      const value = document.features[0]?.rules?.[0]?.when?.[0]
        ?.value as Record<string, unknown>;

      expect(Object.keys(value)).toEqual(['tier']);
    });
  });
});
