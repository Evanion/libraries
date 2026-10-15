import { describe, expect, it } from 'vitest';

import { adoptDecisions } from './adopt.js';
import type { DivergenceReport } from './divergence.js';
import { createFeatures } from './features.js';
import type { FeatureEvent } from './observe.js';
import { serializeConfig } from './serialize.js';
import type { FeatureDefinition, FeatureKey } from './types.js';

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

/** A store built from the document a control plane at `version` serves. */
function storeAt(
  version: string,
  definitions: readonly FeatureDefinition[] = SPLIT,
) {
  return createFeatures(
    serializeConfig(createFeatures(definitions), { version }),
  );
}

/** The subject every case resolves for. */
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
    const shipped = storeAt('v1', definitions).snapshot({
      ...SUBJECT,
      now: new Date('2026-06-01T00:00:00Z'),
    });
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
    const shipped = storeAt('v1', definitions).snapshot({
      ...SUBJECT,
      plan: 'pro',
      now: new Date('2026-06-01T00:00:00Z'),
    });
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
});
