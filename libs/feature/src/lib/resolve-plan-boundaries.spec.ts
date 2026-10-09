import { describe, expect, it, vi } from 'vitest';

import { createFeatures } from './features.js';
import { resolvePlan } from './resolve-plan.js';
import type { DivergenceReport } from './divergence.js';
import type { FeatureEvent } from './observe.js';

/**
 * The input classes `resolvePlan` answers at its edges.
 *
 * `resolve-plan.spec.ts` holds one case per rule of § 5. This file holds the
 * boundaries of each rule: a plan a build hand-assembled, a store whose
 * configuration moved under a plan, a context that carries a field at its
 * smallest legal value, and the three sources a variant assignment can come
 * from. Several cases pass a plan object written out here rather than one
 * `features.plan` produced, because `planFeature` never emits a settled entry
 * with no decision, a deferred entry that resolved off, or a settled parent
 * above a deferred dependant, and a build pipeline that assembles a partial
 * plan can hand `resolvePlan` all three.
 */

/** A split whose two variants carry one value between them. */
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

/** A window a build cannot decide, so every plan over it defers on `now`. */
const WINDOW = [
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
] as const;

describe('resolvePlan', () => {
  it('resolves a settled entry that carries no decision', () => {
    const features = createFeatures(SPLIT);

    const decisions = resolvePlan(
      features,
      { cta: { key: 'cta', resolved: true, needs: [] } },
      { targetingKey: 'u-0' },
    );

    expect(decisions.cta).toEqual({
      key: 'cta',
      enabled: true,
      reason: 'default-on',
      variant: 'blue',
      value: { label: 'Get it' },
      assignment: {
        source: 'weighted',
        by: 'targetingKey',
        bucket: 0.6062106641475111,
      },
    });
  });

  it('keeps a deferred entry that resolved off and assigns it no variant', () => {
    const features = createFeatures(SPLIT);
    const decision = {
      key: 'cta',
      enabled: false,
      reason: 'no-rule-matched',
    } as const;

    const decisions = resolvePlan(
      features,
      { cta: { key: 'cta', resolved: 'deferred', needs: [], decision } },
      { targetingKey: 'u-0' },
    );

    expect(decisions.cta).toEqual(decision);
  });

  it('drops a carried variant and its value from a deferred entry it reassigns', () => {
    const features = createFeatures(SPLIT);

    const decisions = resolvePlan(
      features,
      {
        cta: {
          key: 'cta',
          resolved: 'deferred',
          needs: [],
          decision: {
            key: 'cta',
            enabled: true,
            reason: 'default-on',
            variant: 'blue',
            value: { label: 'Get it' },
          },
        },
      },
      { targetingKey: 'u-4711' },
    );

    expect(decisions.cta).toEqual({
      key: 'cta',
      enabled: true,
      reason: 'default-on',
      variant: 'control',
      assignment: {
        source: 'weighted',
        by: 'targetingKey',
        bucket: 0.44809214142151177,
      },
    });
  });

  it('assigns the weighted variant and its value for a carried bucketing key', () => {
    const features = createFeatures(SPLIT);

    const decision = resolvePlan(features, features.plan({}), {
      targetingKey: 'u-0',
    }).cta;

    expect(decision.variant).toBe('blue');
    expect(decision.value).toEqual({ label: 'Get it' });
    expect(decision.assignment?.source).toBe('weighted');
  });

  it('assigns the variant the declared order puts first, over the array one', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'blue', weight: 50, order: 1 },
          { name: 'control', weight: 50, order: 0 },
        ],
      },
    ] as const);

    const decision = resolvePlan(features, features.plan({}), {}).cta;

    expect(decision.variant).toBe('control');
    expect(decision.assignment?.source).toBe('fallback');
  });

  it('assigns the one variant a single-variant split declares', () => {
    const features = createFeatures([
      { key: 'cta', enabled: true, variants: [{ name: 'only', weight: 100 }] },
    ] as const);

    const decision = resolvePlan(features, features.plan({}), {}).cta;

    expect(decision.variant).toBe('only');
    expect(decision.assignment?.source).toBe('fallback');
  });

  it('keeps a prior sticky assignment over the weights', () => {
    const features = createFeatures(SPLIT);

    const decision = resolvePlan(features, features.plan({}), {
      targetingKey: 'u-0',
      stickyVariants: { cta: 'control' },
    }).cta;

    expect(decision.variant).toBe('control');
    expect(decision.assignment).toEqual({
      source: 'sticky',
      by: 'targetingKey',
    });
  });

  it('walks the dependency order for definitions declared child first', () => {
    const features = createFeatures([
      { key: 'c', enabled: true, dependsOn: ['b'] },
      { key: 'b', enabled: true, dependsOn: ['a'] },
      {
        key: 'a',
        enabled: true,
        rules: [
          { id: 'tier', when: [{ field: 'tier', op: 'eq', value: 'gold' }] },
        ],
      },
    ]);

    const decisions = resolvePlan(features, features.plan({}), {
      tier: 'bronze',
    });

    expect(decisions.c).toEqual({
      key: 'c',
      enabled: false,
      reason: 'dependency-off',
      blockedBy: 'b',
      cause: { key: 'a', reason: 'no-rule-matched', rule: 'tier' },
    });
  });

  it('cascades a settled entry onto a dependant the same plan deferred', () => {
    const features = createFeatures([
      { key: 'gate', enabled: true },
      { key: 'child', enabled: true, dependsOn: ['gate'] },
    ]);

    const decisions = resolvePlan(features, {
      gate: {
        key: 'gate',
        resolved: false,
        needs: [],
        decision: { key: 'gate', enabled: false, reason: 'explicitly-off' },
      },
      child: { key: 'child', resolved: 'deferred', needs: [] },
    });

    expect(decisions.child).toEqual({
      key: 'child',
      enabled: false,
      reason: 'dependency-off',
      blockedBy: 'gate',
      cause: { key: 'gate', reason: 'explicitly-off' },
    });
  });

  it('cascades a parent this pass resolved off onto a deferred entry carrying a decision', () => {
    const features = createFeatures([
      {
        key: 'gate',
        enabled: true,
        rules: [
          { id: 'beta', when: [{ field: 'beta', op: 'eq', value: true }] },
        ],
      },
      {
        key: 'cta',
        enabled: true,
        dependsOn: ['gate'],
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ] as const);
    // The build knew `beta`, so `gate` is settled and `cta` carries its
    // enablement with the split outstanding. This plan names `cta` alone, the
    // way a build that plans a subset does, so `gate` re-decides here against
    // a context that refutes the rule the build matched.
    const plan = features.plan({ beta: true });

    const decisions = resolvePlan(
      features,
      { cta: plan.cta },
      { beta: false, targetingKey: 'u-0' },
    );

    expect(plan.cta.resolved).toBe('deferred');
    expect(plan.cta.decision?.enabled).toBe(true);
    expect(decisions.gate.enabled).toBe(false);
    expect(decisions.cta).toEqual({
      key: 'cta',
      enabled: false,
      reason: 'dependency-off',
      blockedBy: 'gate',
      cause: { key: 'gate', reason: 'no-rule-matched', rule: 'beta' },
    });
  });

  it('answers an empty set for a store holding no feature', () => {
    const features = createFeatures([]);

    expect(resolvePlan(features, {}, {})).toEqual({});
  });

  it('answers explicitly-off for a disabled feature the plan skipped', () => {
    const features = createFeatures([{ key: 'checkout', enabled: false }]);

    expect(resolvePlan(features, {}, {})['checkout']).toEqual({
      key: 'checkout',
      enabled: false,
      reason: 'explicitly-off',
    });
  });

  it('names no feature the store dropped after the plan was built', () => {
    const features = createFeatures([
      { key: 'a', enabled: true },
      { key: 'b', enabled: true },
    ]);
    const plan = features.plan({});
    features.reload({ features: [{ key: 'a', enabled: true }] });

    expect(Object.keys(resolvePlan(features, plan, {}))).toEqual(['a']);
  });

  it('reads a plan entry keyed on a prototype setter', () => {
    const features = createFeatures([{ key: '__proto__', enabled: true }]);
    const plan = features.plan({});

    expect(resolvePlan(features, plan, {})['__proto__']).toEqual({
      key: '__proto__',
      enabled: true,
      reason: 'default-on',
    });
  });

  it('reads no entry a polluted prototype puts under a configured key', () => {
    const features = createFeatures([{ key: 'cta', enabled: true }]);
    const planted = {
      key: 'cta',
      resolved: false,
      needs: [],
      decision: { key: 'cta', enabled: false, reason: 'explicitly-off' },
    };
    // The one input that separates `hasOwnProperty` from a bare index: every
    // member `Object.prototype` already carries reads as an entry with no
    // `resolved` and no `decision`, which falls through to the same `decide`
    // call the missing-entry path makes. The property is non-enumerable and
    // the `finally` below removes it.
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, 'cta', {
      value: planted,
      configurable: true,
      enumerable: false,
      writable: true,
    });

    try {
      expect(resolvePlan(features, {}, {}).cta).toEqual({
        key: 'cta',
        enabled: true,
        reason: 'default-on',
      });
    } finally {
      Reflect.deleteProperty(Object.prototype, 'cta');
    }
  });

  it('reads the clock when neither the context nor the caller states an instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-01-01T00:00:00Z'));
    const features = createFeatures(WINDOW);
    const plan = features.plan({});

    try {
      expect(resolvePlan(features, plan).sale.enabled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads an instant the caller supplies below the window', () => {
    const features = createFeatures(WINDOW);

    const decisions = resolvePlan(
      features,
      features.plan({}),
      {},
      { now: new Date('2029-01-01T00:00:00Z') },
    );

    expect(decisions.sale.enabled).toBe(false);
  });

  it('resolves a window rule off for an instant that reads as no date', () => {
    const features = createFeatures(WINDOW);

    const decisions = resolvePlan(
      features,
      features.plan({}),
      {},
      { now: new Date('not a date') },
    );

    expect(decisions.sale.enabled).toBe(false);
  });

  it('reports every field one deferred entry needs', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        rules: [
          { id: 'pro', when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
        ],
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ] as const);
    const reports: DivergenceReport[] = [];

    resolvePlan(
      features,
      features.plan({}),
      {},
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports.map((report) => report.field)).toEqual([
      'plan',
      'targetingKey',
    ]);
  });

  it('reports the same field once per feature that deferred on it', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
      {
        key: 'hero',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'wide', weight: 50 },
        ],
      },
    ] as const);
    const reports: DivergenceReport[] = [];

    resolvePlan(
      features,
      features.plan({}),
      {},
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports.map((report) => [report.key, report.field])).toEqual([
      ['cta', 'targetingKey'],
      ['hero', 'targetingKey'],
    ]);
  });

  it('reports nothing for a context carrying every field the plan deferred on', () => {
    const features = createFeatures(SPLIT);
    const reports: DivergenceReport[] = [];

    resolvePlan(
      features,
      features.plan({}),
      { targetingKey: 'u-0' },
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports).toEqual([]);
  });

  it('reads an empty string as a carried bucketing field', () => {
    const features = createFeatures(SPLIT);
    const reports: DivergenceReport[] = [];

    const decision = resolvePlan(
      features,
      features.plan({}),
      { targetingKey: '' },
      { onDivergence: (report) => reports.push(report) },
    ).cta;

    expect(reports).toEqual([]);
    expect(decision.assignment?.source).toBe('weighted');
  });

  it('reports a field the context carries as undefined', () => {
    const features = createFeatures(SPLIT);
    const reports: DivergenceReport[] = [];

    resolvePlan(
      features,
      features.plan({}),
      { targetingKey: undefined },
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports.map((report) => report.field)).toEqual(['targetingKey']);
  });

  it('reports the bucketing field although a sticky map settles the split', () => {
    const features = createFeatures(SPLIT);
    const reports: DivergenceReport[] = [];

    const decision = resolvePlan(
      features,
      features.plan({}),
      { stickyVariants: { cta: 'blue' } },
      { onDivergence: (report) => reports.push(report) },
    ).cta;

    expect(reports.map((report) => report.field)).toEqual(['targetingKey']);
    expect(decision.assignment?.source).toBe('sticky');
  });

  it('reports nothing for a deferred entry that needs no field', () => {
    const features = createFeatures(SPLIT);
    const reports: DivergenceReport[] = [];

    const decisions = resolvePlan(
      features,
      { cta: { key: 'cta', resolved: 'deferred', needs: [] } },
      {},
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports).toEqual([]);
    expect(decisions.cta.variant).toBe('control');
  });

  it('resolves every feature although the observer raises', () => {
    const features = createFeatures(SPLIT);

    const decisions = resolvePlan(
      features,
      features.plan({}),
      {},
      {
        onDivergence: () => {
          throw new Error('observer');
        },
      },
    );

    expect(decisions.cta.variant).toBe('control');
  });

  it('writes nothing into a plan a store froze', () => {
    const features = createFeatures(SPLIT, { observe: () => undefined });
    const plan = features.plan({});
    const before = JSON.stringify(plan);

    const decisions = resolvePlan(features, plan, { targetingKey: 'u-0' });

    expect(decisions.cta.variant).toBe('blue');
    expect(JSON.stringify(plan)).toBe(before);
  });

  it('reports no event to the observer the store carries', () => {
    const events: FeatureEvent<Record<string, never>>[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        events.push(event as FeatureEvent<Record<string, never>>);
      },
    });
    const plan = features.plan({});
    const planned = events.length;

    resolvePlan(features, plan, { targetingKey: 'u-0' });

    expect(planned).toBe(1);
    expect(events.length).toBe(planned);
  });
});
