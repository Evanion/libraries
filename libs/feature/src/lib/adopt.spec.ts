import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adoptDecisions } from './adopt.js';
import type { VersionMismatchPolicy } from './adopt.js';
import type { DecisionSet } from './decision-set.js';
import type { DivergenceReport } from './divergence.js';
import { createFeatures } from './features.js';
import type { FeatureEvent } from './observe.js';
import { serializeConfig } from './serialize.js';
import type { FeatureDefinition, FeatureKey, Schema } from './types.js';

const SPLIT = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
] as const satisfies readonly FeatureDefinition[];

/** A window that opens at the start of 2030, UTC. */
const SALE = [
  {
    key: 'sale',
    enabled: true,
    rules: [
      {
        id: 'window',
        when: [{ field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' }],
      },
    ],
  },
] as const satisfies readonly FeatureDefinition[];

/** A store built from the document a control plane at `version` serves. */
function storeAt(
  version: string | number,
  definitions: readonly FeatureDefinition[] = SPLIT,
  observe?: (event: FeatureEvent) => void,
) {
  return createFeatures(
    serializeConfig(createFeatures(definitions), { version }),
    observe ? { observe } : undefined,
  );
}

/** An observer that collects into the array it answers with. */
function collector() {
  const reports: DivergenceReport<FeatureKey>[] = [];
  return {
    reports,
    observe: (report: DivergenceReport<FeatureKey>) => {
      reports.push(report);
    },
  };
}

/** The `'resolve'` events a list of store events holds. */
function resolves(events: readonly FeatureEvent[]): number {
  return events.filter((event) => event.type === 'resolve').length;
}

const SUBJECT = { targetingKey: 'u-1' };

describe('adoptDecisions', () => {
  it('publishes the shipped decisions when the two versions match', () => {
    const shipped = storeAt('v1').snapshot(SUBJECT);
    const reports: DivergenceReport<FeatureKey>[] = [];

    const published = adoptDecisions(storeAt('v1'), shipped, {
      context: SUBJECT,
      onDivergence: (report) => reports.push(report),
      compare: true,
    });

    expect(published).toBe(shipped.decisions);
    expect(reports).toEqual([]);
  });

  it('resolves locally when no set was shipped', () => {
    const features = storeAt('v1');

    const published = adoptDecisions(features, undefined, { context: SUBJECT });

    expect(published).toEqual(features.resolve(SUBJECT));
  });

  it('reports unversioned once when one side carries no version', () => {
    const shipped = createFeatures(SPLIT).snapshot(SUBJECT);
    const reports: DivergenceReport<FeatureKey>[] = [];

    adoptDecisions(storeAt('v1'), shipped, {
      context: SUBJECT,
      onDivergence: (report) => reports.push(report),
    });

    expect(reports.map((report) => report.kind)).toEqual(['unversioned']);
  });

  it('reports config-version and publishes the shipped set under use-shipped', () => {
    const shipped = storeAt('v1').snapshot(SUBJECT);
    const reports: DivergenceReport<FeatureKey>[] = [];

    const published = adoptDecisions(storeAt('v2'), shipped, {
      context: SUBJECT,
      onDivergence: (report) => reports.push(report),
    });

    expect(published).toBe(shipped.decisions);
    expect(reports).toMatchObject([
      {
        kind: 'config-version',
        shipped: { version: 'v1' },
        local: { version: 'v2' },
      },
    ]);
  });

  it('resolves locally on a config-version mismatch under re-resolve', () => {
    const shipped = storeAt('v1', [{ key: 'cta', enabled: false }]).snapshot(
      SUBJECT,
    );
    const features = storeAt('v2', [{ key: 'cta', enabled: true }]);

    const published = adoptDecisions(features, shipped, {
      context: SUBJECT,
      onVersionMismatch: 're-resolve',
    });

    expect(published).not.toBe(shipped.decisions);
    expect(published.cta?.enabled).toBe(true);
  });

  it('reports every decision that differs under compare true', () => {
    const shipped = storeAt('v1', [
      { key: 'cta', enabled: false },
      { key: 'banner', enabled: false },
    ]).snapshot(SUBJECT);
    const features = storeAt('v1', [
      { key: 'cta', enabled: true },
      { key: 'banner', enabled: true },
    ]);
    const reports: DivergenceReport<FeatureKey>[] = [];

    adoptDecisions(features, shipped, {
      context: SUBJECT,
      onDivergence: (report) => reports.push(report),
      compare: true,
    });

    expect(reports.map((report) => [report.kind, report.key])).toEqual([
      ['decision-differs', 'cta'],
      ['decision-differs', 'banner'],
    ]);
  });

  it('resolves nothing a second time under compare false', () => {
    const events: FeatureEvent[] = [];
    const features = createFeatures(
      serializeConfig(createFeatures(SPLIT), { version: 'v1' }),
      { observe: (event) => void events.push(event) },
    );
    const shipped = features.snapshot(SUBJECT);

    adoptDecisions(features, shipped, {
      context: SUBJECT,
      onDivergence: () => undefined,
      compare: false,
    });

    expect(events.filter((event) => event.type === 'resolve')).toHaveLength(1);
  });

  it('reports a shipped feature the local store does not declare', () => {
    const shipped = storeAt('v1', [
      ...SPLIT,
      {
        key: 'promo',
        enabled: true,
        variants: [{ name: 'spring', weight: 100 }],
      },
    ]).snapshot(SUBJECT);
    const reports: DivergenceReport<FeatureKey>[] = [];

    adoptDecisions(storeAt('v1'), shipped, {
      context: SUBJECT,
      onDivergence: (report) => reports.push(report),
    });

    expect(reports).toHaveLength(1);
    const [missing] = reports;
    expect(missing).toMatchObject({
      kind: 'missing-field',
      key: 'promo',
      shipped: { variant: 'spring', source: 'weighted' },
    });
    expect(missing).not.toHaveProperty('local');
    expect(missing).not.toHaveProperty('field');
    expect(missing?.message).toContain('declares no feature "promo"');
    expect(missing?.message).not.toContain('carries no');
    expect(missing?.message).toContain('Reload the store');
  });

  it('reports no field for a pin off a rule that reads only now', () => {
    const definitions: FeatureDefinition[] = [
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 100 },
          { name: 'blue', weight: 0 },
        ],
        rules: [
          {
            id: 'launch',
            variant: 'blue',
            when: [
              { field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' },
            ],
          },
        ],
      },
    ];
    // A 'build' set lends the adoption no instant, so the context it checks
    // carries nothing at `now`.
    const shipped = storeAt('v1', definitions).snapshot(
      { ...SUBJECT, now: new Date('2026-06-01T00:00:00Z') },
      { origin: 'build' },
    );
    const reports: DivergenceReport<FeatureKey>[] = [];

    adoptDecisions(storeAt('v1', definitions), shipped, {
      context: SUBJECT,
      onDivergence: (report) => reports.push(report),
    });

    expect(shipped.decisions.cta?.assignment?.source).toBe('pinned');
    expect(reports).toEqual([]);
  });

  it('names plan and not now for a pin whose rule also reads plan', () => {
    const definitions: FeatureDefinition[] = [
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 100 },
          { name: 'blue', weight: 0 },
        ],
        rules: [
          {
            id: 'launch',
            variant: 'blue',
            when: [
              { field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' },
              { field: 'plan', op: 'eq', value: 'pro' },
            ],
          },
        ],
      },
    ];
    const shipped = storeAt('v1', definitions).snapshot(
      { ...SUBJECT, plan: 'pro', now: new Date('2026-06-01T00:00:00Z') },
      { origin: 'build' },
    );
    const reports: DivergenceReport<FeatureKey>[] = [];

    adoptDecisions(storeAt('v1', definitions), shipped, {
      context: SUBJECT,
      onDivergence: (report) => reports.push(report),
    });

    expect(reports).toHaveLength(1);
    const [missing] = reports;
    expect(missing).toMatchObject({ kind: 'missing-field', field: 'plan' });
    expect(missing?.message).toContain('carries no "plan"');
    expect(missing?.message).not.toContain('"now"');
  });

  it('publishes the shipped set when one side is unversioned under re-resolve', () => {
    const events: FeatureEvent[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => void events.push(event),
    });
    const shipped = storeAt('v1').snapshot(SUBJECT);

    const published = adoptDecisions(features, shipped, {
      context: SUBJECT,
      onVersionMismatch: 're-resolve',
    });

    expect(published).toBe(shipped.decisions);
    expect(
      events.filter((event) => event.type === 'resolve').length,
    ).toBeLessThanOrEqual(1);
  });

  describe('the instant a local resolution reads', () => {
    // Every case pins this process's clock, so no case depends on the day
    // the suite runs. The window opens in 2030 and the clock reads 2028.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2028-06-01T00:00:00Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('reads the instant a render-origin set states where the context states none', () => {
      const shipped = storeAt('v1', SALE).snapshot({
        now: new Date('2031-01-01T00:00:00Z'),
      });
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1', SALE), shipped, {
        context: {},
        onDivergence: observe,
        compare: true,
      });

      expect(shipped.origin).toBe('render');
      expect(reports).toEqual([]);
    });

    it('reads the instant a render-origin set states where no context is passed', () => {
      const shipped = storeAt('v1', SALE).snapshot({
        now: new Date('2031-01-01T00:00:00Z'),
      });

      const published = adoptDecisions(storeAt('v2', SALE), shipped, {
        onVersionMismatch: 're-resolve',
      });

      expect(published).not.toBe(shipped.decisions);
      expect(published.sale?.enabled).toBe(true);
    });

    it('reads the context instant over the one a render-origin set states', () => {
      const shipped = storeAt('v1', SALE).snapshot({
        now: new Date('2031-01-01T00:00:00Z'),
      });
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1', SALE), shipped, {
        context: { now: new Date('2029-01-01T00:00:00Z') },
        onDivergence: observe,
        compare: true,
      });

      expect(reports).toMatchObject([
        {
          kind: 'decision-differs',
          key: 'sale',
          shipped: { enabled: true },
          local: { enabled: false },
        },
      ]);
    });

    it('reads its own clock and not the instant a build-origin set states', () => {
      const shipped = storeAt('v1', SALE).snapshot(
        { now: new Date('2031-01-01T00:00:00Z') },
        { origin: 'build' },
      );
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1', SALE), shipped, {
        context: {},
        onDivergence: observe,
        compare: true,
      });

      expect(reports).toMatchObject([
        {
          kind: 'decision-differs',
          key: 'sale',
          shipped: { enabled: true },
          local: { enabled: false },
        },
      ]);
    });

    it('reads its own clock under re-resolve when the stated instant names no date', () => {
      vi.setSystemTime(new Date('2031-01-01T00:00:00Z'));
      const shipped = storeAt('v1', SALE).snapshot({});

      const published = adoptDecisions(
        storeAt('v2', SALE),
        { ...shipped, now: 'the day before' },
        { onVersionMismatch: 're-resolve' },
      );

      // An invalid `Date` answers every `after` condition with `false`, so a
      // resolution at it would read the window closed.
      expect(published.sale?.enabled).toBe(true);
    });

    it('publishes the shipped set when the stated instant names no date', () => {
      const shipped = storeAt('v1', SALE).snapshot({});
      const sent = { ...shipped, now: '' };

      expect(adoptDecisions(storeAt('v1', SALE), sent)).toBe(sent.decisions);
    });
  });

  describe('the version comparison', () => {
    it('reports unversioned once when neither side carries a version', () => {
      const shipped = createFeatures(SPLIT).snapshot(SUBJECT);
      const { reports, observe } = collector();

      const published = adoptDecisions(createFeatures(SPLIT), shipped, {
        context: SUBJECT,
        onDivergence: observe,
        onVersionMismatch: 're-resolve',
      });

      expect(published).toBe(shipped.decisions);
      expect(reports).toMatchObject([
        {
          kind: 'unversioned',
          shipped: { version: undefined },
          local: { version: undefined },
        },
      ]);
    });

    it('reports a store carrying no version against a versioned set', () => {
      const shipped = storeAt('v1').snapshot(SUBJECT);
      const { reports, observe } = collector();

      adoptDecisions(createFeatures(SPLIT), shipped, {
        context: SUBJECT,
        onDivergence: observe,
      });

      expect(reports).toMatchObject([
        { kind: 'unversioned', shipped: { version: 'v1' }, local: {} },
      ]);
      expect(reports[0]?.local?.version).toBeUndefined();
    });

    it('reports a set carrying no version against a versioned store and publishes it under re-resolve', () => {
      const shipped = storeAt('v1').snapshot(SUBJECT);
      const unversioned: DecisionSet<Schema> = {
        now: shipped.now,
        origin: shipped.origin,
        decisions: shipped.decisions,
      };
      const { reports, observe } = collector();

      const published = adoptDecisions(storeAt('v1'), unversioned, {
        context: SUBJECT,
        onDivergence: observe,
        onVersionMismatch: 're-resolve',
      });

      expect(published).toBe(unversioned.decisions);
      expect(reports).toMatchObject([
        { kind: 'unversioned', shipped: {}, local: { version: 'v1' } },
      ]);
      expect(reports[0]?.shipped?.version).toBeUndefined();
    });

    it('reads the number 1 and the string "1" as two versions', () => {
      const shipped = storeAt(1).snapshot(SUBJECT);
      const { reports, observe } = collector();

      adoptDecisions(storeAt('1'), shipped, {
        context: SUBJECT,
        onDivergence: observe,
      });

      expect(reports).toMatchObject([
        {
          kind: 'config-version',
          shipped: { version: 1 },
          local: { version: '1' },
        },
      ]);
    });

    it('reads version 0 on both sides as one version', () => {
      const shipped = storeAt(0).snapshot(SUBJECT);
      const { reports, observe } = collector();

      const published = adoptDecisions(storeAt(0), shipped, {
        context: SUBJECT,
        onDivergence: observe,
        onVersionMismatch: 're-resolve',
      });

      expect(published).toBe(shipped.decisions);
      expect(reports).toEqual([]);
    });

    it('reads the empty string on both sides as one version', () => {
      const shipped = storeAt('').snapshot(SUBJECT);
      const { reports, observe } = collector();

      adoptDecisions(storeAt(''), shipped, {
        context: SUBJECT,
        onDivergence: observe,
      });

      expect(reports).toEqual([]);
    });

    it('publishes the shipped set under re-resolve when the two versions agree', () => {
      const events: FeatureEvent[] = [];
      const shipped = storeAt('v1').snapshot(SUBJECT);

      const published = adoptDecisions(
        storeAt('v1', SPLIT, (event) => void events.push(event)),
        shipped,
        { context: SUBJECT, onVersionMismatch: 're-resolve' },
      );

      expect(published).toBe(shipped.decisions);
      expect(resolves(events)).toBe(0);
    });

    it('publishes the shipped set for a policy the union does not carry', () => {
      // A policy read off a query string or a JSON setting reaches the call
      // with no compiler in between.
      const shipped = storeAt('v1', [{ key: 'cta', enabled: false }]).snapshot(
        SUBJECT,
      );

      const published = adoptDecisions(
        storeAt('v2', [{ key: 'cta', enabled: true }]),
        shipped,
        {
          context: SUBJECT,
          onVersionMismatch: 'reload' as unknown as VersionMismatchPolicy,
        },
      );

      expect(published).toBe(shipped.decisions);
    });
  });

  describe('the local resolution budget', () => {
    it('resolves nothing for compare true with no observer installed', () => {
      const events: FeatureEvent[] = [];
      const shipped = storeAt('v1', [{ key: 'cta', enabled: false }]).snapshot(
        SUBJECT,
      );

      adoptDecisions(
        storeAt(
          'v1',
          [{ key: 'cta', enabled: true }],
          (event) => void events.push(event),
        ),
        shipped,
        { context: SUBJECT, compare: true },
      );

      expect(resolves(events)).toBe(0);
    });

    it('resolves once for a mismatch under re-resolve that also compares', () => {
      const events: FeatureEvent[] = [];
      const shipped = storeAt('v1', [{ key: 'cta', enabled: false }]).snapshot(
        SUBJECT,
      );
      const { reports, observe } = collector();

      const published = adoptDecisions(
        storeAt(
          'v2',
          [{ key: 'cta', enabled: true }],
          (event) => void events.push(event),
        ),
        shipped,
        {
          context: SUBJECT,
          onVersionMismatch: 're-resolve',
          onDivergence: observe,
          compare: true,
        },
      );

      expect(resolves(events)).toBe(1);
      expect(published.cta?.enabled).toBe(true);
      expect(reports.map((report) => report.kind)).toEqual([
        'config-version',
        'decision-differs',
      ]);
    });

    it('resolves once and reports nothing when no set was shipped', () => {
      const events: FeatureEvent[] = [];
      const { reports, observe } = collector();

      adoptDecisions(
        storeAt('v1', SPLIT, (event) => void events.push(event)),
        undefined,
        { context: SUBJECT, onDivergence: observe, compare: true },
      );

      expect(resolves(events)).toBe(1);
      expect(reports).toEqual([]);
    });

    it('resolves with no context at all when no set was shipped', () => {
      const features = createFeatures([{ key: 'banner', enabled: true }]);

      expect(adoptDecisions(features, undefined).banner?.enabled).toBe(true);
    });
  });

  describe('the bucketing check', () => {
    it('names the bucketing field a context carries nothing at', () => {
      const shipped = storeAt('v1').snapshot(SUBJECT);
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1'), shipped, {
        context: {},
        onDivergence: observe,
      });

      expect(reports).toMatchObject([
        {
          kind: 'missing-field',
          key: 'cta',
          field: 'targetingKey',
          shipped: { source: 'weighted' },
          local: { variant: 'control', source: 'fallback' },
        },
      ]);
      expect(reports[0]?.message).toContain('carries no "targetingKey"');
    });

    it('names a bucketing field whose value no engine buckets', () => {
      const shipped = storeAt('v1').snapshot(SUBJECT);
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1'), shipped, {
        context: { targetingKey: null } as unknown as Record<string, unknown>,
        onDivergence: observe,
      });

      expect(reports).toMatchObject([
        { kind: 'missing-field', key: 'cta', field: 'targetingKey' },
      ]);
      expect(reports[0]?.message).toContain(
        'carries no value at "targetingKey" that buckets a subject',
      );
    });

    it('names nothing for a bucketing field holding a number', () => {
      const custom: FeatureDefinition[] = [
        { ...SPLIT[0], variantBy: 'accountId' },
      ];
      const shipped = storeAt('v1', custom).snapshot({ accountId: 42 });
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1', custom), shipped, {
        context: { accountId: 42 },
        onDivergence: observe,
      });

      expect(reports).toEqual([]);
    });

    it('names the field and the control a split of its own states', () => {
      // Neither the field nor the control is the default: the split buckets on
      // `accountId`, and its control is the variant ordered first, which is the
      // second element of the array.
      const custom: FeatureDefinition[] = [
        {
          key: 'cta',
          enabled: true,
          variantBy: 'accountId',
          variants: [
            { name: 'blue', weight: 50, order: 1 },
            { name: 'green', weight: 50, order: 0 },
          ],
        },
      ];
      const shipped = storeAt('v1', custom).snapshot({ accountId: 'a-1' });
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1', custom), shipped, {
        context: {},
        onDivergence: observe,
      });

      expect(reports).toMatchObject([
        {
          kind: 'missing-field',
          key: 'cta',
          field: 'accountId',
          shipped: { source: 'weighted' },
          local: { variant: 'green', source: 'fallback' },
        },
      ]);
    });

    it('names the field this store buckets on where the two stores differ', () => {
      const shipped = storeAt('v1').snapshot(SUBJECT);
      const { reports, observe } = collector();

      adoptDecisions(
        storeAt('v1', [{ ...SPLIT[0], variantBy: 'accountId' }]),
        shipped,
        { context: SUBJECT, onDivergence: observe },
      );

      expect(reports).toMatchObject([
        { kind: 'missing-field', key: 'cta', field: 'accountId' },
      ]);
      expect(reports[0]?.local).toEqual({
        variant: 'control',
        source: 'fallback',
      });
      expect(reports[0]?.message).toContain('by "targetingKey"');
      expect(reports[0]?.message).toContain('carries no "accountId"');
    });

    it('names nothing for a sticky assignment the context reproduces', () => {
      const shipped = storeAt('v1').snapshot({
        targetingKey: 'u-1',
        stickyVariants: { cta: 'blue' },
      });
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1'), shipped, {
        context: { stickyVariants: { cta: 'blue' } },
        onDivergence: observe,
      });

      expect(shipped.decisions.cta?.assignment?.source).toBe('sticky');
      expect(reports).toEqual([]);
    });

    it('names the bucketing field for a sticky assignment the context cannot reproduce', () => {
      const shipped = storeAt('v1').snapshot({
        targetingKey: 'u-1',
        stickyVariants: { cta: 'blue' },
      });
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1'), shipped, {
        context: {},
        onDivergence: observe,
      });

      expect(reports).toMatchObject([
        {
          kind: 'missing-field',
          key: 'cta',
          field: 'targetingKey',
          shipped: { variant: 'blue', source: 'sticky' },
          local: { source: 'fallback' },
        },
      ]);
    });

    it('names nothing for a shipped assignment that itself fell back', () => {
      const shipped = storeAt('v1').snapshot({});
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1'), shipped, {
        context: {},
        onDivergence: observe,
      });

      expect(shipped.decisions.cta?.assignment?.source).toBe('fallback');
      expect(reports).toEqual([]);
    });

    it('names the store gap for a key it declares with no variants', () => {
      const shipped = storeAt('v1').snapshot(SUBJECT);
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1', [{ key: 'cta', enabled: true }]), shipped, {
        context: SUBJECT,
        onDivergence: observe,
      });

      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({ kind: 'missing-field', key: 'cta' });
      expect(reports[0]).not.toHaveProperty('field');
      expect(reports[0]).not.toHaveProperty('local');
      expect(reports[0]?.message).toContain('with no variants');
      expect(reports[0]?.message).not.toContain('targetingKey');
    });
  });

  describe('the pin check', () => {
    /** A split a rule pins off `group`, while the split buckets on `targetingKey`. */
    const STAFF: FeatureDefinition[] = [
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [
          {
            id: 'staff',
            when: [{ field: 'group', op: 'eq', value: 'staff' }],
            variant: 'blue',
          },
        ],
      },
    ];

    const PINNED: FeatureDefinition[] = [
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 100 },
          { name: 'blue', weight: 0 },
        ],
        rules: [
          {
            id: 'proto',
            variant: 'blue',
            when: [{ field: 'constructor', op: 'eq', value: 'x' }],
          },
        ],
      },
    ];

    it('names a rule field a context only inherits off Object.prototype', () => {
      const shipped = storeAt('v1', PINNED).snapshot({
        ...SUBJECT,
        constructor: 'x',
      });
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1', PINNED), shipped, {
        context: { ...SUBJECT },
        onDivergence: observe,
      });

      expect(shipped.decisions.cta?.assignment?.source).toBe('pinned');
      expect(reports).toMatchObject([
        { kind: 'missing-field', key: 'cta', field: 'constructor' },
      ]);
    });

    it('names nothing for a pin naming a rule this store does not hold', () => {
      const shipped = storeAt('v1', PINNED).snapshot({
        ...SUBJECT,
        constructor: 'x',
      });
      const cta = shipped.decisions.cta;
      const forged = {
        ...shipped,
        decisions: {
          ...shipped.decisions,
          cta: { ...cta, assignment: { ...cta?.assignment, rule: 'ghost' } },
        },
      } as unknown as DecisionSet<Schema>;
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1', PINNED), forged, {
        context: { ...SUBJECT },
        onDivergence: observe,
      });

      expect(reports).toEqual([]);
    });

    it('names every unreadable field in the message and the first in field', () => {
      const both: FeatureDefinition[] = [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 100 },
            { name: 'blue', weight: 0 },
          ],
          rules: [
            {
              id: 'two',
              variant: 'blue',
              when: [
                { field: 'plan', op: 'eq', value: 'pro' },
                { field: 'region', op: 'eq', value: 'eu' },
              ],
            },
          ],
        },
      ];
      const shipped = storeAt('v1', both).snapshot({
        ...SUBJECT,
        plan: 'pro',
        region: 'eu',
      });
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1', both), shipped, {
        context: SUBJECT,
        onDivergence: observe,
      });

      expect(reports).toHaveLength(1);
      expect(reports[0]?.field).toBe('plan');
      expect(reports[0]?.message).toContain('carries no "plan", "region"');
    });

    it('names nothing for a pin whose rule field the context carries and no bucketing field', () => {
      const shipped = storeAt('v1', STAFF).snapshot({
        targetingKey: 'u-9',
        group: 'staff',
      });
      const { reports, observe } = collector();

      // The rule's own field, and not the bucketing field the pin ignored.
      adoptDecisions(storeAt('v1', STAFF), shipped, {
        context: { group: 'staff' },
        onDivergence: observe,
      });

      expect(shipped.decisions.cta?.assignment).toMatchObject({
        source: 'pinned',
        by: 'targetingKey',
      });
      expect(reports).toEqual([]);
    });

    it('names the store gap for a pin on a key it declares with no variants', () => {
      const shipped = storeAt('v1', STAFF).snapshot({
        targetingKey: 'u-9',
        group: 'staff',
      });
      // The pinning rule under the same id and no variants to pin.
      const flag: FeatureDefinition[] = [
        {
          key: 'cta',
          enabled: true,
          rules: [
            {
              id: 'staff',
              when: [{ field: 'group', op: 'eq', value: 'staff' }],
            },
          ],
        },
      ];
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1', flag), shipped, {
        context: { group: 'staff' },
        onDivergence: observe,
      });

      expect(shipped.decisions.cta?.assignment?.source).toBe('pinned');
      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({
        kind: 'missing-field',
        key: 'cta',
        shipped: { variant: 'blue', source: 'pinned' },
      });
      expect(reports[0]).not.toHaveProperty('field');
      expect(reports[0]?.message).toContain('with no variants');
    });

    it("names a pinning rule's rollout field beside its attribute and never its date window", () => {
      // The rule reads a date window, an attribute and, through its rollout
      // alone, a bucketing field of its own.
      const window: FeatureDefinition[] = [
        {
          key: 'cta',
          enabled: true,
          variants: [
            { name: 'control', weight: 50 },
            { name: 'blue', weight: 50 },
          ],
          rules: [
            {
              id: 'staff-window',
              when: [
                { field: 'now', op: 'after', value: '2020-01-01T00:00:00Z' },
                { field: 'group', op: 'eq', value: 'staff' },
              ],
              rollout: { percent: 100, by: 'deviceId' },
              variant: 'blue',
            },
          ],
        },
      ];
      // A 'build' set lends the adoption no instant, so the context it checks
      // carries nothing at `now`.
      const shipped = storeAt('v1', window).snapshot(
        { targetingKey: 'u-9', group: 'staff', deviceId: 'd-1' },
        { origin: 'build' },
      );
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1', window), shipped, {
        context: { targetingKey: 'u-9' },
        onDivergence: observe,
      });

      expect(shipped.decisions.cta?.assignment?.source).toBe('pinned');
      expect(reports).toHaveLength(1);
      expect(reports[0]?.field).toBe('deviceId');
      expect(reports[0]?.message).toContain('off rule "staff-window"');
      expect(reports[0]?.message).toContain('carries no "deviceId", "group"');
      expect(reports[0]?.message).toContain('Pass deviceId, group to');
      expect(reports[0]?.message).not.toContain('"now"');
    });
  });

  describe('the comparison', () => {
    it('names nothing for a shipped key off the prototype chain', () => {
      const shipped = storeAt('v1').snapshot(SUBJECT);
      const polluted = {
        ...shipped,
        decisions: {
          ...shipped.decisions,
          constructor: {
            key: 'constructor',
            enabled: true,
            reason: 'default-on',
          },
        },
      } as unknown as DecisionSet<Schema>;
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1'), polluted, {
        context: SUBJECT,
        onDivergence: observe,
        compare: true,
      });

      expect(reports).toEqual([]);
    });

    it('names nothing for a key only this store holds', () => {
      const shipped = storeAt('v1').snapshot(SUBJECT);
      const { reports, observe } = collector();

      adoptDecisions(
        storeAt('v1', [...SPLIT, { key: 'banner', enabled: true }]),
        shipped,
        { context: SUBJECT, onDivergence: observe, compare: true },
      );

      expect(reports).toEqual([]);
    });

    it('reports a decision whose reason alone differs', () => {
      const shipped = storeAt('v1', [
        { key: 'banner', enabled: true },
      ]).snapshot(SUBJECT);
      const { reports, observe } = collector();

      adoptDecisions(
        storeAt('v1', [
          {
            key: 'banner',
            enabled: true,
            rules: [{ id: 'all', when: [] }],
          },
        ]),
        shipped,
        { context: SUBJECT, onDivergence: observe, compare: true },
      );

      expect(shipped.decisions.banner?.reason).toBe('default-on');
      expect(reports).toMatchObject([
        {
          kind: 'decision-differs',
          key: 'banner',
          shipped: { enabled: true },
          local: { enabled: true },
        },
      ]);
    });

    it('names both variants of a decision that differs', () => {
      const shipped = storeAt('v1').snapshot(SUBJECT);
      const local = shipped.decisions.cta?.variant;
      const other = local === 'blue' ? 'control' : 'blue';
      const forged = {
        ...shipped,
        decisions: { cta: { ...shipped.decisions.cta, variant: other } },
      } as unknown as DecisionSet<Schema>;
      const { reports, observe } = collector();

      adoptDecisions(storeAt('v1'), forged, {
        context: SUBJECT,
        onDivergence: observe,
        compare: true,
      });

      expect(reports).toMatchObject([
        {
          kind: 'decision-differs',
          key: 'cta',
          shipped: { variant: other },
          local: { variant: local },
        },
      ]);
    });

    it('publishes a shipped set that names no decision at all', () => {
      const shipped = storeAt('v1').snapshot(SUBJECT);
      const empty = { ...shipped, decisions: {} } as DecisionSet<Schema>;
      const { reports, observe } = collector();

      const published = adoptDecisions(storeAt('v1'), empty, {
        context: SUBJECT,
        onDivergence: observe,
        compare: true,
      });

      expect(published).toBe(empty.decisions);
      expect(reports).toEqual([]);
    });
  });

  describe('an observer that raises', () => {
    it('keeps reporting and keeps the answer after the first report raises', () => {
      const shipped = storeAt('v1', [{ key: 'cta', enabled: false }]).snapshot(
        SUBJECT,
      );
      const kinds: string[] = [];

      const published = adoptDecisions(
        storeAt('v2', [{ key: 'cta', enabled: true }]),
        shipped,
        {
          context: SUBJECT,
          compare: true,
          onDivergence: (report) => {
            kinds.push(report.kind);
            throw new Error('observer down');
          },
        },
      );

      expect(kinds).toEqual(['config-version', 'decision-differs']);
      expect(published).toBe(shipped.decisions);
    });
  });
});
