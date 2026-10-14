import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { resolvePlan } from './resolve-plan.js';
import { serializeConfig } from './serialize.js';
import type { DecisionOrigin, SnapshotOptions } from './decision-set.js';
import type { DivergenceReport } from './divergence.js';
import type { FeatureConfig } from './config.js';
import type { FeatureKey } from './types.js';

/**
 * The handoff the `DecisionSet`, `DecisionOrigin` and `SnapshotOptions` entries
 * of `apps/docs/content/feature/api.mdx` describe, exercised end to end.
 *
 * `snapshot.spec.ts` holds what one `snapshot` call states and
 * `resolve-plan.spec.ts` holds what one `resolvePlan` call reads. Neither takes
 * the instant a set states and hands it to the call the reference tells a
 * consumer to make, which is where the origin earns its two values.
 */

/** The boundary a window rule reads, and the two instants either side of it. */
const BOUNDARY = '2026-11-01T00:00:00Z';
const BEFORE = new Date('2026-10-31T23:59:59.000Z');
const AFTER = new Date('2026-11-01T00:00:01.000Z');

/** A store whose one feature the plan defers on `now` alone. */
function windowed() {
  return createFeatures([
    {
      key: 'flash-sale',
      enabled: true,
      rules: [
        {
          id: 'window',
          when: [{ field: 'now', op: 'before', value: BOUNDARY }],
        },
      ],
    },
  ] as const);
}

/** The same one feature, stating what the build-time clock may settle. */
function frozenWindow(freezeTimeAtBuild: boolean) {
  return createFeatures([
    {
      key: 'flash-sale',
      enabled: true,
      freezeTimeAtBuild,
      rules: [
        {
          id: 'window',
          when: [{ field: 'now', op: 'before', value: BOUNDARY }],
        },
      ],
    },
  ] as const);
}

/** The same window, over a feature that also buckets the subject. */
function windowedVariants() {
  return createFeatures([
    {
      key: 'flash-sale',
      enabled: true,
      rules: [
        {
          id: 'window',
          when: [{ field: 'now', op: 'before', value: BOUNDARY }],
        },
      ],
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    },
  ] as const);
}

/** A store whose two windows share one boundary, so one clock decides both. */
function twoWindows() {
  return createFeatures([
    {
      key: 'flash-sale',
      enabled: true,
      rules: [
        {
          id: 'window',
          when: [{ field: 'now', op: 'before', value: BOUNDARY }],
        },
      ],
    },
    {
      key: 'free-shipping',
      enabled: true,
      rules: [
        {
          id: 'window',
          when: [{ field: 'now', op: 'before', value: BOUNDARY }],
        },
      ],
    },
  ] as const);
}

/** A split whose plan defers on the bucketing field. */
const SPLIT = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
] as const;

/** The document a control plane at `version` serves. */
function served(version: string): FeatureConfig {
  return serializeConfig(createFeatures(SPLIT), { version });
}

/** Moves the clock the deferred remainder reads when no caller names one. */
function clockAt(instant: Date): void {
  onTestFinished(() => {
    vi.useRealTimers();
  });
  vi.useFakeTimers();
  vi.setSystemTime(instant);
}

describe('the instant a render-origin set hands the client', () => {
  it('keeps a window the server resolved on after the client clock crossed it', () => {
    const features = windowed();
    const set = features.snapshot({ now: BEFORE });
    const plan = features.plan({ now: BEFORE });
    clockAt(AFTER);

    expect(set.origin).toBe('render');
    expect(plan['flash-sale'].resolved).toBe('deferred');
    expect(
      resolvePlan(features, plan, {}, { now: new Date(set.now) })['flash-sale']
        .enabled,
    ).toBe(true);
  });

  it('buckets the subject the context carries beside the instant the option states', () => {
    const features = windowedVariants();
    const set = features.snapshot({ now: BEFORE });
    const plan = features.plan({ now: BEFORE });
    clockAt(AFTER);

    expect(plan['flash-sale'].needs).toContain('targetingKey');

    const decision = resolvePlan(
      features,
      plan,
      { targetingKey: 'cust-0042' },
      { now: new Date(set.now) },
    )['flash-sale'];

    expect(decision.enabled).toBe(true);
    expect(decision.assignment?.source).toBe('weighted');
  });

  it('falls back for every subject when the context the call takes is empty', () => {
    const features = windowedVariants();
    const set = features.snapshot({ now: BEFORE });
    const plan = features.plan({ now: BEFORE });
    clockAt(AFTER);

    const reports: DivergenceReport<FeatureKey>[] = [];
    const decision = resolvePlan(
      features,
      plan,
      {},
      {
        now: new Date(set.now),
        onDivergence: (report) => reports.push(report),
      },
    )['flash-sale'];

    expect(decision.enabled).toBe(true);
    expect(decision.assignment?.source).toBe('fallback');
    expect(
      reports.some(
        (report) =>
          report.kind === 'missing-field' && report.field === 'targetingKey',
      ),
    ).toBe(true);
  });

  it('reads the instant on the context over the one the option states', () => {
    const features = windowed();
    const set = features.snapshot({ now: BEFORE });
    const plan = features.plan({ now: BEFORE });

    expect(
      resolvePlan(features, plan, { now: AFTER }, { now: new Date(set.now) })[
        'flash-sale'
      ].enabled,
    ).toBe(false);
  });

  it('keeps the window the server resolved on for a context stating the set instant', () => {
    const features = windowed();
    const set = features.snapshot({ now: BEFORE });
    const plan = features.plan({ now: BEFORE });
    clockAt(AFTER);

    expect(
      resolvePlan(features, plan, {
        targetingKey: 'cust-0042',
        now: new Date(set.now),
      })['flash-sale'].enabled,
    ).toBe(true);
  });

  it('reads the client clock for a build-origin set that passes no instant', () => {
    const features = windowed();
    const set = features.snapshot({ now: BEFORE }, { origin: 'build' });
    const plan = features.plan({ now: BEFORE });
    clockAt(AFTER);

    expect(set.origin).toBe('build');
    expect(resolvePlan(features, plan, {})['flash-sale'].enabled).toBe(false);
  });

  it('answers one window for two calls the set instant settles', () => {
    const features = twoWindows();
    const set = features.snapshot({ now: BEFORE });
    const plan = features.plan({ now: BEFORE });
    clockAt(BEFORE);

    const sale = resolvePlan(features, plan, {}, { now: new Date(set.now) });
    vi.setSystemTime(AFTER);
    const shipping = resolvePlan(
      features,
      plan,
      {},
      { now: new Date(set.now) },
    );

    expect(sale['flash-sale'].enabled).toBe(true);
    expect(shipping['free-shipping'].enabled).toBe(true);
  });

  it('answers two windows for two calls reading the clock either side', () => {
    const features = twoWindows();
    const plan = features.plan({ now: BEFORE });
    clockAt(BEFORE);

    const sale = resolvePlan(features, plan, {});
    vi.setSystemTime(AFTER);
    const shipping = resolvePlan(features, plan, {});

    expect(sale['flash-sale'].enabled).toBe(true);
    expect(shipping['free-shipping'].enabled).toBe(false);
  });

  it('reports no divergence for a deferred window a set instant settles', () => {
    const features = windowed();
    const set = features.snapshot({ now: BEFORE });
    const reports: DivergenceReport[] = [];

    resolvePlan(
      features,
      features.plan({ now: BEFORE }),
      {},
      {
        now: new Date(set.now),
        onDivergence: (report) => reports.push(report),
      },
    );

    expect(reports).toEqual([]);
  });

  it('recovers the instant the set states through the Date constructor', () => {
    const features = windowed();

    expect(new Date(features.snapshot({ now: BEFORE }).now).getTime()).toBe(
      BEFORE.getTime(),
    );
  });

  it('recovers the largest instant a set states, in extended ISO 8601', () => {
    const features = windowed();
    const edge = new Date(8_640_000_000_000_000);

    expect(new Date(features.snapshot({ now: edge }).now).getTime()).toBe(
      edge.getTime(),
    );
  });

  it('recovers the smallest instant a set states, in extended ISO 8601', () => {
    const features = windowed();
    const edge = new Date(-8_640_000_000_000_000);

    expect(new Date(features.snapshot({ now: edge }).now).getTime()).toBe(
      edge.getTime(),
    );
  });

  it('recovers an instant of epoch zero, which a falsy test would drop', () => {
    const features = windowed();

    expect(
      new Date(features.snapshot({ now: new Date(0) }).now).getTime(),
    ).toBe(0);
  });
});

/**
 * `SnapshotOptions.origin` states the provenance and moves no resolution, which
 * the reference entry argues from `snapshot` reading no `freezeTimeAtBuild`.
 * `plan` reads the member and `snapshot` does not, so the two answer differently
 * for one definition and one instant.
 */
describe('the frozen window a snapshot does not read', () => {
  it('settles a now-dependent rule a frozen window lets the plan settle too', () => {
    const features = frozenWindow(true);

    expect(features.plan({ now: BEFORE })['flash-sale'].resolved).toBe(true);
    expect(
      features.snapshot({ now: BEFORE }, { origin: 'build' }).decisions[
        'flash-sale'
      ].enabled,
    ).toBe(true);
  });

  it('settles the same decision whether the definition froze the window', () => {
    const frozen = frozenWindow(true).snapshot(
      { now: BEFORE },
      { origin: 'build' },
    );
    const open = frozenWindow(false).snapshot(
      { now: BEFORE },
      { origin: 'build' },
    );

    expect(frozen.decisions['flash-sale']).toEqual(
      open.decisions['flash-sale'],
    );
  });

  it('settles the same decision at either origin for one instant', () => {
    const features = windowed();

    expect(
      features.snapshot({ now: AFTER }, { origin: 'build' }).decisions[
        'flash-sale'
      ],
    ).toEqual(
      features.snapshot({ now: AFTER }, { origin: 'render' }).decisions[
        'flash-sale'
      ],
    );
  });

  it('carries an origin no DecisionOrigin names, the type being its one guard', () => {
    const features = windowed();
    const options = { origin: 'ci' } as unknown as SnapshotOptions;

    expect(features.snapshot({ now: BEFORE }, options).origin).toBe(
      'ci' as DecisionOrigin,
    );
  });

  it('states a render origin for an options object carrying a null origin', () => {
    const features = windowed();
    const options = { origin: null } as unknown as SnapshotOptions;

    expect(features.snapshot({ now: BEFORE }, options).origin).toBe('render');
  });
});

/**
 * `resolvePlan` reports `'missing-field'` and no other kind, because a plan and
 * a context are all it holds. `resolve-plan-boundaries.spec.ts` reads `field`
 * off every report it collects and reads `kind` off none, so the three kinds a
 * provider alone can report have nothing holding them out of this call.
 */
describe('the one divergence kind a plan and a context can report', () => {
  it('reports missing-field and no other kind for a versioned store', () => {
    const parsed = parseFeatureConfig(served('v7'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    // A parsed store defaults its schema to every feature key, so its reports
    // name the loose key and not the union a literal store infers.
    const reports: DivergenceReport<FeatureKey>[] = [];

    resolvePlan(
      parsed.features,
      parsed.features.plan({}),
      {},
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports.map((report) => report.kind)).toEqual(['missing-field']);
  });

  it('reports missing-field and no other kind for a store with no version', () => {
    const features = createFeatures(SPLIT);
    const reports: DivergenceReport[] = [];

    resolvePlan(
      features,
      features.plan({}),
      {},
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports.map((report) => report.kind)).toEqual(['missing-field']);
  });

  it('reports no kind for a settled entry whose decision the rules contradict', () => {
    const features = windowed();
    const reports: DivergenceReport[] = [];

    const decisions = resolvePlan(
      features,
      {
        'flash-sale': {
          key: 'flash-sale',
          resolved: true,
          needs: [],
          decision: {
            key: 'flash-sale',
            enabled: true,
            reason: 'rule-match',
            rule: 'window',
          },
        },
      },
      { now: AFTER },
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports).toEqual([]);
    expect(decisions['flash-sale'].enabled).toBe(true);
  });

  it('fills neither side of the report it makes', () => {
    const features = createFeatures(SPLIT);
    const reports: DivergenceReport[] = [];

    resolvePlan(
      features,
      features.plan({}),
      {},
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports[0]?.shipped).toBeUndefined();
    expect(reports[0]?.local).toBeUndefined();
  });

  it('names the feature and the field on the report it makes', () => {
    const features = createFeatures(SPLIT);
    const reports: DivergenceReport[] = [];

    resolvePlan(
      features,
      features.plan({}),
      {},
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports[0]?.key).toBe('cta');
    expect(reports[0]?.field).toBe('targetingKey');
  });

  it('reports no missing field for a plan deferring on the instant alone', () => {
    const features = windowed();
    const plan = features.plan({ now: BEFORE });
    const reports: DivergenceReport[] = [];

    resolvePlan(
      features,
      plan,
      {},
      {
        now: new Date(BEFORE),
        onDivergence: (report) => reports.push(report),
      },
    );

    expect(plan['flash-sale'].needs).toEqual(['now']);
    expect(reports).toEqual([]);
  });

  /**
   * The async observer the reference entry says a caller may install. The
   * thenable stands in for the promise an `async` observer answers, so the
   * handler `reportDivergence` attaches is read off the call itself and not off
   * a host that reports an unhandled rejection.
   */
  it('hands a rejection handler to a thenable the observer answers', () => {
    const features = createFeatures(SPLIT);
    const rejectionHandlers: unknown[] = [];
    const thenable = {
      then(_onFulfilled: unknown, onRejected: unknown) {
        rejectionHandlers.push(onRejected);
      },
    };

    const decisions = resolvePlan(
      features,
      features.plan({}),
      {},
      { onDivergence: () => thenable as unknown as void },
    );

    expect(rejectionHandlers).toEqual([expect.any(Function)]);
    expect(decisions.cta.variant).toBe('control');
  });
});
