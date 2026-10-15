import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { FeatureConfigError } from './errors.js';
import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';
import type { FeatureEvent } from './observe.js';
import type { Condition, Schema } from './types.js';

const SPLIT = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
] as const;

/** The document a control plane at `version` serves, with every member stated. */
function served(version: string): FeatureConfig {
  return serializeConfig(createFeatures(SPLIT), { version });
}

describe('Features.snapshot', () => {
  it('carries the version the document it parsed states', () => {
    const parsed = parseFeatureConfig(served('v7'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

    const set = parsed.features.snapshot({
      now: new Date('2026-10-09T00:00:00Z'),
    });

    expect(set.version).toBe('v7');
  });

  it('states the version the decisions resolved under when an observer reloads', () => {
    let reload: ((document: FeatureConfig) => unknown) | undefined;
    const parsed = parseFeatureConfig(served('v1'), {
      observe: (event) => {
        if (event.type !== 'resolve') return;
        const pending = reload;
        reload = undefined;
        pending?.(
          serializeConfig(createFeatures([{ key: 'cta', enabled: false }]), {
            version: 'v2',
          }),
        );
      },
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    reload = (document) => parsed.features.reload(document);

    const set = parsed.features.snapshot({ targetingKey: 'u-4711' });

    expect(set.decisions.cta?.enabled).toBe(true);
    expect(set.version).toBe('v1');
    expect(parsed.features.version).toBe('v2');
  });

  it('states the instant it resolved at, as ISO 8601', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(
      features.snapshot({ now: new Date('2026-10-09T11:22:33.444Z') }).now,
    ).toBe('2026-10-09T11:22:33.444Z');
  });

  it('carries no version for a store built from a literal', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect('version' in features.snapshot()).toBe(false);
  });

  it('states a render origin when the caller names none', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot().origin).toBe('render');
  });

  it('states the origin a build-time caller names', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot({}, { origin: 'build' }).origin).toBe('build');
  });

  it('holds the decision resolve answers for the same context', () => {
    const features = createFeatures(SPLIT);
    const context = { targetingKey: 'u-4711' };

    expect(features.snapshot(context).decisions).toEqual(
      features.resolve(context),
    );
  });

  it('assigns the variant the subject buckets to', () => {
    const features = createFeatures(SPLIT);

    expect(
      features.snapshot({ targetingKey: 'u-4711' }).decisions.cta.variant,
    ).toBe('control');
  });

  it('reports one resolve event to a store that observes', () => {
    const seen: string[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        seen.push(event.type);
      },
    });

    features.snapshot({ targetingKey: 'u-4711' });

    expect(seen).toEqual(['resolve']);
  });

  it('freezes what a store carrying an observer answers', () => {
    const features = createFeatures(SPLIT, { observe: () => undefined });

    expect(Object.isFrozen(features.snapshot({ targetingKey: 'u-4711' }))).toBe(
      true,
    );
  });

  it('reads an explicit instant over the clock', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [
              { field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' },
            ],
          },
        ],
      },
    ]);

    expect(
      features.snapshot({ now: new Date('2031-01-01T00:00:00Z') }).decisions
        .sale.enabled,
    ).toBe(true);
  });
  it('carries a version the document states as the number zero', () => {
    const parsed = parseFeatureConfig(
      serializeConfig(createFeatures(SPLIT), { version: 0 }),
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

    expect(parsed.features.snapshot().version).toBe(0);
  });

  it('carries a version the document states as the empty string', () => {
    const parsed = parseFeatureConfig(
      serializeConfig(createFeatures(SPLIT), { version: '' }),
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

    expect('version' in parsed.features.snapshot()).toBe(true);
  });

  it('keeps a numeric version a number', () => {
    const parsed = parseFeatureConfig(
      serializeConfig(createFeatures(SPLIT), { version: 7 }),
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

    expect(parsed.features.snapshot().version).toBe(7);
  });

  it('states the version a reload installed', () => {
    const parsed = parseFeatureConfig(served('v1'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const accepted = parsed.features.reload(served('v2'));

    expect(accepted.ok).toBe(true);
    expect(parsed.features.snapshot().version).toBe('v2');
  });

  it('keeps the version it held when a reload is refused', () => {
    const parsed = parseFeatureConfig(served('v1'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const refused = parsed.features.reload({
      version: 'v2',
      features: [{ key: 'cta', enabled: true, dependsOn: ['absent'] }],
    });

    expect(refused.ok).toBe(false);
    expect(parsed.features.snapshot().version).toBe('v1');
  });

  it('states the version of the document a toggle wrote onto', () => {
    const parsed = parseFeatureConfig(served('v7'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const written = parsed.features.toggle('cta', false);

    expect(written.ok).toBe(true);
    expect(parsed.features.snapshot({ targetingKey: 'u-4711' }).version).toBe(
      'v7',
    );
    expect(parsed.features.version).toBe('v7');
  });

  it('states the version a toggle that moved no decision left in place', () => {
    const parsed = parseFeatureConfig(served('v7'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const written = parsed.features.toggle('cta', true);

    expect(written.ok).toBe(true);
    expect(parsed.features.snapshot().version).toBe('v7');
  });

  it('states the version again once a reload discarded the toggle', () => {
    const parsed = parseFeatureConfig(served('v7'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    parsed.features.toggle('cta', false);
    const accepted = parsed.features.reload(served('v8'));

    expect(accepted.ok).toBe(true);
    expect(parsed.features.snapshot().version).toBe('v8');
  });

  it('keeps the version when a refused reload leaves a toggle standing', () => {
    const parsed = parseFeatureConfig(served('v7'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    parsed.features.toggle('cta', false);
    const refused = parsed.features.reload({
      version: 'v8',
      features: [{ key: 'cta', enabled: true, dependsOn: ['absent'] }],
    });

    expect(refused.ok).toBe(false);
    expect(parsed.features.snapshot().version).toBe('v7');
  });

  it('states the version for a toggle that restored the installed value', () => {
    const parsed = parseFeatureConfig(served('v7'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    parsed.features.toggle('cta', false);
    const restored = parsed.features.toggle('cta', true);

    expect(restored.ok).toBe(true);
    expect(parsed.features.snapshot().version).toBe('v7');
  });

  it('states the version for a toggle that turned a served feature on', () => {
    const parsed = parseFeatureConfig(
      serializeConfig(createFeatures([{ key: 'checkout', enabled: false }]), {
        version: 'v7',
      }),
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const written = parsed.features.toggle('checkout', true);
    const set = parsed.features.snapshot();

    expect(written.ok).toBe(true);
    expect(set.version).toBe('v7');
    expect(set.decisions.checkout.enabled).toBe(true);
  });

  it('states no version for a toggle a store with no version carries', () => {
    const features = createFeatures(SPLIT);
    const written = features.toggle('cta', false);

    expect(written.ok).toBe(true);
    expect('version' in features.snapshot()).toBe(false);
  });

  it('resolves against the document a reload installed', () => {
    const parsed = parseFeatureConfig(
      serializeConfig(createFeatures([{ key: 'checkout', enabled: true }]), {
        version: 'v1',
      }),
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    parsed.features.reload(
      serializeConfig(createFeatures([{ key: 'checkout', enabled: false }]), {
        version: 'v2',
      }),
    );

    expect(parsed.features.snapshot().decisions.checkout.enabled).toBe(false);
  });

  it('holds an empty decision map for a store with no definitions', () => {
    const set = createFeatures([]).snapshot({
      now: new Date('2026-10-09T00:00:00Z'),
    });

    expect(set.decisions).toEqual({});
    expect(set.now).toBe('2026-10-09T00:00:00.000Z');
    expect(set.origin).toBe('render');
  });

  it('states a render origin for an options object naming none', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot({}, { origin: undefined }).origin).toBe('render');
  });

  it('states the render origin a caller names explicitly', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot({}, { origin: 'render' }).origin).toBe('render');
  });

  it('states the origin a caller names beside no context', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot(undefined, { origin: 'build' }).origin).toBe(
      'build',
    );
  });

  it('states each instant it is handed, not the first one', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot({ now: new Date(0) }).now).toBe(
      '1970-01-01T00:00:00.000Z',
    );
    expect(
      features.snapshot({ now: new Date('2000-01-02T03:04:05.006Z') }).now,
    ).toBe('2000-01-02T03:04:05.006Z');
  });

  it('states the largest instant a Date holds, in extended ISO 8601', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(
      features.snapshot({ now: new Date(8_640_000_000_000_000) }).now,
    ).toBe('+275760-09-13T00:00:00.000Z');
  });

  it('states the smallest instant a Date holds, in extended ISO 8601', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(
      features.snapshot({ now: new Date(-8_640_000_000_000_000) }).now,
    ).toBe('-271821-04-20T00:00:00.000Z');
  });

  it('reads the clock for a call that names no instant', () => {
    onTestFinished(() => {
      vi.useRealTimers();
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T05:06:07.008Z'));
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot().now).toBe('2026-03-04T05:06:07.008Z');
  });

  it('reads the clock again for a second call that names no instant', () => {
    onTestFinished(() => {
      vi.useRealTimers();
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T09:00:00.000Z'));
    const features = createFeatures([{ key: 'checkout', enabled: true }]);
    const morning = features.snapshot();
    vi.setSystemTime(new Date('2026-03-04T17:30:00.000Z'));

    expect(morning.now).toBe('2026-03-04T09:00:00.000Z');
    expect(features.snapshot().now).toBe('2026-03-04T17:30:00.000Z');
  });

  it('names the field when the context holds an instant no string describes', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(() => features.snapshot({ now: new Date(Number.NaN) })).toThrow(
      FeatureConfigError,
    );
    expect(() => features.snapshot({ now: new Date(Number.NaN) })).toThrow(
      /context\/now/,
    );
  });

  it('reports nothing for the call it refuses that instant on', () => {
    const seen: FeatureEvent<Schema>[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        seen.push(event as FeatureEvent<Schema>);
      },
    });

    expect(() => features.snapshot({ now: new Date(Number.NaN) })).toThrow(
      FeatureConfigError,
    );
    expect(seen).toEqual([]);
  });

  it('settles a now-dependent rule the plan for the same instant defers', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [
              { field: 'now', op: 'before', value: '2026-11-01T00:00:00Z' },
            ],
          },
        ],
      },
    ]);
    const buildTime = new Date('2026-10-01T00:00:00Z');

    expect(features.plan({ now: buildTime }).sale.resolved).toBe('deferred');
    expect(
      features.snapshot({ now: buildTime }, { origin: 'build' }).decisions.sale
        .enabled,
    ).toBe(true);
  });

  it('assigns the control the other side of the band buckets to', () => {
    const features = createFeatures(SPLIT);

    expect(
      features.snapshot({ targetingKey: 'u-1' }).decisions.cta.variant,
    ).toBe('blue');
  });

  it('hands the observer the decisions the caller receives', () => {
    const seen: FeatureEvent<Schema>[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        seen.push(event as FeatureEvent<Schema>);
      },
    });

    const set = features.snapshot({ targetingKey: 'u-4711' });

    expect(seen[0]?.type).toBe('resolve');
    expect(seen[0] && 'decisions' in seen[0] && seen[0].decisions).toBe(
      set.decisions,
    );
  });

  it('answers the decisions the store decided when an observer rewrites them', () => {
    let attempts = 0;
    let refused = false;
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        if (event.type !== 'resolve') return;
        attempts += 1;
        try {
          (event.decisions.cta as { enabled: boolean }).enabled = false;
        } catch {
          refused = true;
        }
      },
    });

    const set = features.snapshot({ targetingKey: 'u-4711' });

    expect(attempts).toBe(1);
    expect(refused).toBe(true);
    expect(set.decisions.cta.enabled).toBe(true);
  });

  it('names the instant the set states on the event it reports', () => {
    const seen: FeatureEvent<Schema>[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        seen.push(event as FeatureEvent<Schema>);
      },
    });

    const set = features.snapshot({ now: new Date('2026-05-06T07:08:09Z') });

    expect(seen[0]?.at.toISOString()).toBe(set.now);
  });

  it('reports the event version the options named and states none on the set', () => {
    const seen: FeatureEvent<Schema>[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        seen.push(event as FeatureEvent<Schema>);
      },
      version: 'ev-1',
    });

    const set = features.snapshot({ targetingKey: 'u-4711' });

    expect(seen[0]?.version).toBe('ev-1');
    expect('version' in set).toBe(false);
  });

  it('answers a set though the observer raises out of the callback', () => {
    const failures: unknown[] = [];
    const features = createFeatures(SPLIT, {
      observe: () => {
        throw new Error('boom');
      },
      onObserveError: (error) => {
        failures.push(error);
      },
    });

    const set = features.snapshot({ targetingKey: 'u-4711' });

    expect(set.decisions.cta.variant).toBe('control');
    expect(failures).toHaveLength(1);
  });

  it('freezes nothing for a store carrying no observer', () => {
    const features = createFeatures(SPLIT, {});

    expect(Object.isFrozen(features.snapshot({ targetingKey: 'u-4711' }))).toBe(
      false,
    );
  });

  it('freezes every decision a store carrying an observer answers', () => {
    const features = createFeatures(SPLIT, { observe: () => undefined });

    const set = features.snapshot({ targetingKey: 'u-4711' });

    expect(Object.isFrozen(set.decisions)).toBe(true);
    expect(Object.isFrozen(set.decisions.cta)).toBe(true);
  });

  it('writes no instant onto the context a caller handed it', () => {
    const features = createFeatures(SPLIT);
    const context = Object.freeze({ targetingKey: 'u-4711' });

    const set = features.snapshot(context);

    expect(set.decisions.cta.variant).toBe('control');
    expect('now' in context).toBe(false);
  });

  it('answers a fresh set for every call', () => {
    const features = createFeatures(SPLIT);
    const context = { targetingKey: 'u-4711', now: new Date(0) };

    const first = features.snapshot(context);
    const second = features.snapshot(context);

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });

  it('carries a feature keyed on a prototype member as an own property', () => {
    const features = createFeatures([
      { key: 'constructor', enabled: true },
      { key: '__proto__', enabled: false },
    ]);

    const set = features.snapshot();

    expect(Object.keys(set.decisions)).toEqual(['constructor', '__proto__']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(set.decisions['__proto__']?.enabled).toBe(false);
  });

  describe('the set a wire carries', () => {
    const BEFORE_LAUNCH = { now: new Date('2026-10-09T00:00:00Z') };

    /** A store whose one rule fails on `condition` at {@link BEFORE_LAUNCH}. */
    const gated = (condition: Condition, observe?: () => void) => {
      const definitions = [
        {
          key: 'launch-sale',
          enabled: true,
          rules: [{ id: 'launch', when: [condition] }],
        },
      ];
      return observe
        ? createFeatures(definitions, { observe })
        : createFeatures(definitions);
    };

    /** What a frozen and an unfrozen decision both carry of a failed rule. */
    interface FailedRule {
      readonly rules?: readonly {
        readonly failed?: { readonly value: unknown };
      }[];
    }

    /** The condition a set states as the reason its one rule failed. */
    const failedOn = (set: {
      readonly decisions: Readonly<Partial<Record<string, FailedRule>>>;
    }) => set.decisions['launch-sale']?.rules?.[0]?.failed;

    it('survives a JSON round trip for a window a Date bounds', () => {
      const set = gated({
        field: 'now',
        op: 'after',
        value: new Date('2027-01-01T00:00:00Z'),
      }).snapshot(BEFORE_LAUNCH);

      expect(JSON.parse(JSON.stringify(set))).toEqual(set);
    });

    it('states the Date a window carries as ISO 8601', () => {
      const set = gated({
        field: 'now',
        op: 'after',
        value: new Date('2027-01-01T00:00:00Z'),
      }).snapshot(BEFORE_LAUNCH);

      expect(failedOn(set)?.value).toBe('2027-01-01T00:00:00.000Z');
    });

    it('carries the string a window states as the definition wrote it', () => {
      const set = gated({
        field: 'now',
        op: 'after',
        value: '2027-01-01T00:00:00Z',
      }).snapshot(BEFORE_LAUNCH);

      expect(failedOn(set)?.value).toBe('2027-01-01T00:00:00Z');
      expect(JSON.parse(JSON.stringify(set))).toEqual(set);
    });

    it('carries the epoch milliseconds a window states as the definition wrote them', () => {
      const set = gated({
        field: 'now',
        op: 'after',
        value: 1798761600000,
      }).snapshot(BEFORE_LAUNCH);

      expect(failedOn(set)?.value).toBe(1798761600000);
      expect(JSON.parse(JSON.stringify(set))).toEqual(set);
    });

    it('leaves the Date the store holds in place for resolve', () => {
      const launch = new Date('2027-01-01T00:00:00Z');
      const features = gated({ field: 'now', op: 'after', value: launch });
      features.snapshot(BEFORE_LAUNCH);

      expect(
        features.resolve(BEFORE_LAUNCH)['launch-sale']?.rules?.[0]?.failed
          ?.value,
      ).toEqual(launch);
    });

    it('states the window as ISO 8601 in the set a store carrying an observer freezes', () => {
      const set = gated(
        { field: 'now', op: 'after', value: new Date('2027-01-01T00:00:00Z') },
        () => undefined,
      ).snapshot(BEFORE_LAUNCH);

      expect(failedOn(set)?.value).toBe('2027-01-01T00:00:00.000Z');
      expect(Object.isFrozen(failedOn(set))).toBe(true);
    });

    // Ruling 5 leaves an attribute condition's literal as the definition wrote
    // it. JSON.stringify writes a Date there as a string and JSON.parse keeps
    // the string, so this one value does not come back as it went out.
    it('carries a Date an attribute condition compares against, which a round trip does not restore', () => {
      const memberSince = new Date('2027-01-01T00:00:00Z');
      const set = gated({
        field: 'memberSince',
        op: 'eq',
        value: memberSince,
      }).snapshot({ ...BEFORE_LAUNCH, memberSince: new Date(0) });

      expect(failedOn(set)?.value).toEqual(memberSince);
      expect(JSON.parse(JSON.stringify(set))).not.toEqual(set);
    });

    it('states the Date a before window carries as ISO 8601', () => {
      const set = gated({
        field: 'now',
        op: 'before',
        value: new Date('2026-01-01T00:00:00Z'),
      }).snapshot(BEFORE_LAUNCH);

      expect(failedOn(set)?.value).toBe('2026-01-01T00:00:00.000Z');
      expect(JSON.parse(JSON.stringify(set))).toEqual(set);
    });

    it.each([
      ['the epoch', 0, 'before', '1970-01-01T00:00:00.000Z'],
      [
        'an instant before the epoch',
        Date.UTC(1969, 11, 31, 23, 59, 59, 999),
        'before',
        '1969-12-31T23:59:59.999Z',
      ],
      [
        'a year past 9999',
        Date.UTC(10000, 0, 1),
        'after',
        '+010000-01-01T00:00:00.000Z',
      ],
      [
        'a year before 0',
        Date.UTC(-1, 0, 1),
        'before',
        '-000001-01-01T00:00:00.000Z',
      ],
    ] as const)(
      'states a window Date at %s as its ISO 8601 string',
      (_, epoch, op, iso) => {
        const set = gated({
          field: 'now',
          op,
          value: new Date(epoch),
        }).snapshot(BEFORE_LAUNCH);

        expect(failedOn(set)?.value).toBe(iso);
        expect(JSON.parse(JSON.stringify(set))).toEqual(set);
      },
    );

    it('refuses a window Date naming no instant when the store is built', () => {
      expect(() =>
        gated({ field: 'now', op: 'after', value: new Date(Number.NaN) }),
      ).toThrow(FeatureConfigError);
    });

    it('states every failed window across rules and features, and leaves the rest', () => {
      const set = createFeatures([
        {
          key: 'launch-sale',
          enabled: true,
          rules: [
            {
              id: 'date',
              when: [
                {
                  field: 'now',
                  op: 'after',
                  value: new Date('2027-01-01T00:00:00Z'),
                },
              ],
            },
            {
              id: 'string',
              when: [
                { field: 'now', op: 'after', value: '2027-06-01T00:00:00Z' },
              ],
            },
            {
              id: 'closed',
              when: [
                {
                  field: 'now',
                  op: 'before',
                  value: new Date('2026-01-01T00:00:00Z'),
                },
              ],
            },
          ],
        },
        {
          key: 'weekend',
          enabled: true,
          rules: [
            {
              id: 'saturday',
              when: [
                {
                  field: 'now',
                  op: 'day-of-week',
                  zone: 'UTC',
                  value: ['sat'],
                },
              ],
            },
          ],
        },
        { key: 'plain', enabled: true },
      ]).snapshot(BEFORE_LAUNCH);

      expect(
        set.decisions['launch-sale']?.rules?.map((outcome) => [
          outcome.rule,
          outcome.failed?.value,
        ]),
      ).toEqual([
        ['date', '2027-01-01T00:00:00.000Z'],
        ['string', '2027-06-01T00:00:00Z'],
        ['closed', '2026-01-01T00:00:00.000Z'],
      ]);
      expect(set.decisions.weekend?.rules?.[0]?.failed).toEqual({
        field: 'now',
        op: 'day-of-week',
        zone: 'UTC',
        value: ['sat'],
      });
      expect(set.decisions.plain).toEqual({
        key: 'plain',
        enabled: true,
        reason: 'default-on',
      });
      expect(JSON.parse(JSON.stringify(set))).toEqual(set);
    });

    // An attribute condition may name `now` as its field. Its literal is the
    // definition's, which ruling 5 leaves alone.
    it('carries a Date an attribute condition over now compares against', () => {
      const launch = new Date('2027-01-01T00:00:00Z');
      const set = gated({ field: 'now', op: 'eq', value: launch }).snapshot(
        BEFORE_LAUNCH,
      );

      expect(failedOn(set)?.value).toBeInstanceOf(Date);
      expect(failedOn(set)?.value).toEqual(launch);
    });

    it('survives a JSON round trip in the set a store carrying an observer freezes', () => {
      const set = gated(
        { field: 'now', op: 'after', value: new Date('2027-01-01T00:00:00Z') },
        () => undefined,
      ).snapshot(BEFORE_LAUNCH);

      expect(JSON.parse(JSON.stringify(set))).toEqual(set);
    });

    it('hands the observer the decisions the set carries', () => {
      const seen: FeatureEvent<Schema>[] = [];
      const set = createFeatures(
        [
          {
            key: 'launch-sale',
            enabled: true,
            rules: [
              {
                id: 'launch',
                when: [
                  {
                    field: 'now',
                    op: 'after',
                    value: new Date('2027-01-01T00:00:00Z'),
                  },
                ],
              },
            ],
          },
        ],
        {
          observe: (event) => {
            seen.push(event as FeatureEvent<Schema>);
          },
        },
      ).snapshot(BEFORE_LAUNCH);

      const resolved = seen.find((event) => event.type === 'resolve');

      expect(resolved?.type === 'resolve' && resolved.decisions).toBe(
        set.decisions,
      );
    });

    it('survives a JSON round trip for a store parsed from the document a literal serializes', () => {
      const document = serializeConfig(
        gated({
          field: 'now',
          op: 'after',
          value: new Date('2027-01-01T00:00:00Z'),
        }),
        { version: 'v1' },
      );
      const parsed = parseFeatureConfig(JSON.parse(JSON.stringify(document)));
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

      const set = parsed.features.snapshot(BEFORE_LAUNCH);

      expect(failedOn(set)?.value).toBe('2027-01-01T00:00:00.000Z');
      expect(JSON.parse(JSON.stringify(set))).toEqual(set);
    });

    it('carries a Date a variant value holds, which a round trip does not restore', () => {
      const launch = new Date('2027-01-01T00:00:00Z');
      const set = createFeatures([
        {
          key: 'banner',
          enabled: true,
          variants: [{ name: 'only', weight: 100, value: { launch } }],
        },
      ]).snapshot({ ...BEFORE_LAUNCH, targetingKey: 'u-4711' });

      expect(set.decisions.banner?.value).toEqual({ launch });
      expect(JSON.parse(JSON.stringify(set))).not.toEqual(set);
    });
  });
});

/**
 * The other half of the rule `Features.snapshot` states. `snapshot` states the
 * instant on the wire and refuses a `Date` that describes none; every entry
 * point below states no instant and carries that `Date` into the decision. It
 * reaches a condition as a comparison that answers false, which
 * `evaluateCondition` already holds cases for, so each one answers.
 */
describe('the instant the total entry points carry', () => {
  /** A context whose `Date` names no instant. */
  const NO_INSTANT = { now: new Date(Number.NaN), targetingKey: 'u-4711' };

  it('resolves every feature for a context holding one', () => {
    const features = createFeatures(SPLIT);

    expect(features.resolve(NO_INSTANT).cta.enabled).toBe(true);
  });

  it('answers enablement for a context holding one', () => {
    const features = createFeatures(SPLIT);

    expect(features.isEnabled('cta', NO_INSTANT)).toBe(true);
  });

  it('assigns the variant the subject buckets to for a context holding one', () => {
    const features = createFeatures(SPLIT);

    expect(features.variantOf('cta', NO_INSTANT)).toBe('control');
  });

  it('answers the assigned variant value for a context holding one', () => {
    const features = createFeatures(SPLIT);

    expect(
      features.valueOf('cta', { ...NO_INSTANT, targetingKey: 'u-1' }),
    ).toEqual({
      label: 'Get it',
    });
  });

  it('partitions every feature for a context holding one', () => {
    const features = createFeatures(SPLIT);

    expect(features.plan(NO_INSTANT).cta.resolved).toBe(true);
  });

  it('writes the toggle a context holding one asks for', () => {
    const features = createFeatures(SPLIT);

    expect(features.toggle('cta', false, NO_INSTANT)).toEqual({
      ok: true,
      key: 'cta',
      enabled: false,
      willDisable: [],
    });
  });

  it('answers a rule reading the instant as a condition no subject matches', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [
              { field: 'now', op: 'after', value: '2020-01-01T00:00:00Z' },
            ],
          },
        ],
      },
    ]);

    expect(features.resolve(NO_INSTANT).sale.enabled).toBe(false);
  });
});
