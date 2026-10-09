import { describe, expect, it } from 'vitest';

import { createFeatures } from './features.js';
import { resolvePlan } from './resolve-plan.js';
import type { DivergenceReport } from './divergence.js';

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

describe('resolvePlan', () => {
  it('uses a settled entry decision without re-running its rules', () => {
    const features = createFeatures([
      {
        key: 'pro-perks',
        enabled: true,
        rules: [
          { id: 'pro', when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
        ],
      },
    ]);
    const plan = features.plan({ plan: 'pro' });
    features.reload({
      features: [
        {
          key: 'pro-perks',
          enabled: true,
          rules: [
            { id: 'pro', when: [{ field: 'plan', op: 'eq', value: 'never' }] },
          ],
        },
      ],
    });

    expect(resolvePlan(features, plan, { plan: 'pro' })['pro-perks']).toEqual(
      plan['pro-perks'].decision,
    );
  });

  it('keeps the variant a settled entry decision carries', () => {
    const features = createFeatures(SPLIT);
    const plan = features.plan({ targetingKey: 'u-0' });

    const decisions = resolvePlan(features, plan, { targetingKey: 'u-4711' });

    expect(plan.cta.resolved).toBe(true);
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

  it('keeps enablement from a deferred entry and fills in the variant', () => {
    const features = createFeatures(SPLIT);
    const plan = features.plan({});
    const entry = plan.cta;

    const decisions = resolvePlan(features, plan, { targetingKey: 'u-4711' });

    expect(entry.resolved).toBe('deferred');
    expect(entry.decision?.variant).toBeUndefined();
    expect(decisions.cta.enabled).toBe(entry.decision?.enabled);
    expect(decisions.cta.reason).toBe(entry.decision?.reason);
    expect(decisions.cta.variant).toBe('control');
  });

  it('keeps a deferred entry decision a client context would decide against', () => {
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
    const plan = features.plan({ plan: 'pro' });

    const decisions = resolvePlan(features, plan, {
      plan: 'free',
      targetingKey: 'u-0',
    });

    expect(plan.cta).toEqual({
      key: 'cta',
      resolved: 'deferred',
      needs: ['targetingKey'],
      decision: {
        key: 'cta',
        enabled: true,
        reason: 'rule-match',
        rule: 'pro',
      },
    });
    expect(decisions.cta).toEqual({
      key: 'cta',
      enabled: true,
      reason: 'rule-match',
      rule: 'pro',
      variant: 'blue',
      assignment: {
        source: 'weighted',
        by: 'targetingKey',
        bucket: 0.6062106641475111,
      },
    });
  });

  it('resolves a deferred entry carrying no decision in full', () => {
    const features = createFeatures([
      {
        key: 'pro-perks',
        enabled: true,
        rules: [
          { id: 'pro', when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
        ],
      },
    ]);

    expect(
      resolvePlan(features, features.plan({}), { plan: 'pro' })['pro-perks'],
    ).toEqual({
      key: 'pro-perks',
      enabled: true,
      reason: 'rule-match',
      rule: 'pro',
    });
  });

  it('resolves a chain deeper than two cascades in dependency order', () => {
    const features = createFeatures([
      {
        key: 'a',
        enabled: true,
        rules: [
          { id: 'tier', when: [{ field: 'tier', op: 'eq', value: 'gold' }] },
        ],
      },
      { key: 'b', enabled: true, dependsOn: ['a'] },
      { key: 'c', enabled: true, dependsOn: ['b'] },
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

  it('resolves a feature the plan names no entry for', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(resolvePlan(features, {}, {})['checkout']).toEqual({
      key: 'checkout',
      enabled: true,
      reason: 'default-on',
    });
  });

  it('reads no plan entry off the prototype chain', () => {
    const features = createFeatures([{ key: 'constructor', enabled: true }]);

    expect(resolvePlan(features, {}, {})['constructor']).toEqual({
      key: 'constructor',
      enabled: true,
      reason: 'default-on',
    });
  });

  it('reports the field a deferred entry still needs', () => {
    const features = createFeatures(SPLIT);
    const reports: DivergenceReport[] = [];

    resolvePlan(
      features,
      features.plan({}),
      {},
      { onDivergence: (report) => reports.push(report) },
    );

    expect(reports).toEqual([
      {
        kind: 'missing-field',
        key: 'cta',
        field: 'targetingKey',
        message: expect.stringContaining('targetingKey'),
      },
    ]);
  });

  it('assigns the first variant in the bucketing order for a context with no key', () => {
    const features = createFeatures(SPLIT);

    const decision = resolvePlan(features, features.plan({}), {}).cta;

    expect(decision.variant).toBe('control');
    expect(decision.assignment?.source).toBe('fallback');
  });

  it('reads the instant a render-origin caller supplies', () => {
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

    const decisions = resolvePlan(
      features,
      features.plan({}),
      {},
      { now: new Date('2031-01-01T00:00:00Z') },
    );

    expect(decisions.sale.enabled).toBe(true);
  });

  it('reads an explicit context instant over the one the caller supplied', () => {
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

    const decisions = resolvePlan(
      features,
      features.plan({}),
      { now: new Date('2029-01-01T00:00:00Z') },
      { now: new Date('2031-01-01T00:00:00Z') },
    );

    expect(decisions.sale.enabled).toBe(false);
  });

  it('throws nothing out of an onDivergence that throws', () => {
    const features = createFeatures(SPLIT);

    expect(() =>
      resolvePlan(
        features,
        features.plan({}),
        {},
        {
          onDivergence: () => {
            throw new Error('observer');
          },
        },
      ),
    ).not.toThrow();
  });
});
