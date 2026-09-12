import { describe, expect, it } from 'vitest';
import { FeatureCycleError } from './errors.js';
import { createFeatures } from './features.js';
import type { Decision, FeatureDefinition } from './types.js';

const WINDOW = '2026-10-01T00:00:00Z';

/**
 * A -> B -> C -> D -> E. Five levels: two would prove nothing about cascading.
 *
 * Typed on a literal key union, which is how a consumer gets exact decision
 * records -- `decisions.e` is a `Decision`, not `Decision | undefined`.
 */
type Link = 'a' | 'b' | 'c' | 'd' | 'e';

const chain = (): FeatureDefinition<Link>[] => [
  { key: 'a', enabled: true },
  { key: 'b', enabled: true, dependsOn: ['a'] },
  { key: 'c', enabled: true, dependsOn: ['b'] },
  { key: 'd', enabled: true, dependsOn: ['c'] },
  { key: 'e', enabled: true, dependsOn: ['d'] },
];

const enabledOf = (decisions: Record<string, Decision>) =>
  Object.fromEntries(
    Object.entries(decisions).map(([key, decision]) => [key, decision.enabled]),
  );

describe('createFeatures', () => {
  it('rejects a cycle at construction, naming the path', () => {
    expect(() =>
      createFeatures([
        { key: 'a', enabled: true, dependsOn: ['c'] },
        { key: 'b', enabled: true, dependsOn: ['a'] },
        { key: 'c', enabled: true, dependsOn: ['b'] },
      ]),
    ).toThrow(FeatureCycleError);
  });
});

describe('precedence', () => {
  it('short-circuits on enabled === false without running the rules', () => {
    const features = createFeatures([
      {
        key: 'off',
        enabled: false,
        // A rule that would match if it ran. The reason proves it did not.
        rules: [{ id: 'always', when: [] }],
      },
    ]);

    const decision = features.resolve().off;

    expect(decision.enabled).toBe(false);
    expect(decision.reason).toBe('explicitly-off');
    expect(decision.rules).toBeUndefined();
  });

  it('resolves on when enabled and no rules are present', () => {
    const features = createFeatures([{ key: 'plain', enabled: true }]);

    expect(features.resolve().plain).toMatchObject({
      enabled: true,
      reason: 'default-on',
    });
  });

  it('ORs the rules: one matching rule is enough', () => {
    const features = createFeatures([
      {
        key: 'either',
        enabled: true,
        rules: [
          { id: 'eu', when: [{ field: 'region', op: 'eq', value: 'eu' }] },
          { id: 'beta', when: [{ field: 'beta', op: 'eq', value: true }] },
        ],
      },
    ]);

    const decision = features.resolve({ beta: true }).either;

    expect(decision.enabled).toBe(true);
    expect(decision.reason).toBe('rule-match');
    expect(decision.rule).toBe('beta');
  });

  it('ANDs the conditions within one rule', () => {
    const features = createFeatures([
      {
        key: 'both',
        enabled: true,
        rules: [
          {
            id: 'eu-beta',
            when: [
              { field: 'region', op: 'eq', value: 'eu' },
              { field: 'beta', op: 'eq', value: true },
            ],
          },
        ],
      },
    ]);

    expect(features.resolve({ region: 'eu', beta: true }).both.enabled).toBe(
      true,
    );
    expect(features.resolve({ region: 'eu' }).both.enabled).toBe(false);
  });

  it('is not first-match: a later rule matches even when an earlier one fails', () => {
    const features = createFeatures([
      {
        key: 'late',
        enabled: true,
        rules: [
          { id: 'first', when: [{ field: 'region', op: 'eq', value: 'us' }] },
          { id: 'second', when: [{ field: 'region', op: 'eq', value: 'eu' }] },
        ],
      },
    ]);

    expect(features.resolve({ region: 'eu' }).late).toMatchObject({
      enabled: true,
      rule: 'second',
    });
  });

  it('reports a per-rule breakdown naming the failed condition', () => {
    const features = createFeatures([
      {
        key: 'windowed',
        enabled: true,
        rules: [
          {
            id: 'window-q4',
            when: [{ field: 'now', op: 'after', value: WINDOW }],
          },
        ],
      },
    ]);

    const decision = features.resolve({
      now: new Date('2026-09-01T00:00:00Z'),
    }).windowed;

    expect(decision).toMatchObject({
      enabled: false,
      reason: 'no-rule-matched',
    });
    expect(decision.rules).toEqual([
      {
        rule: 'window-q4',
        matched: false,
        failed: { field: 'now', op: 'after', value: WINDOW },
      },
    ]);
  });

  it('buckets a rollout on the context field the rule names', () => {
    const features = createFeatures([
      {
        key: 'checkout-v2',
        enabled: true,
        rules: [{ id: 'ramp', rollout: { percent: 100, by: 'accountId' } }],
      },
    ]);

    expect(features.resolve({ accountId: 'acct-1' })['checkout-v2']).toMatchObject(
      { enabled: true, rule: 'ramp' },
    );
    // No bucketing field in the context: the rule cannot be evaluated, so it
    // does not match.
    expect(features.resolve()['checkout-v2']).toMatchObject({
      enabled: false,
      reason: 'no-rule-matched',
    });
  });

  it('ANDs a rollout with the rule conditions', () => {
    const features = createFeatures([
      {
        key: 'gated',
        enabled: true,
        rules: [
          {
            id: 'eu-ramp',
            when: [{ field: 'region', op: 'eq', value: 'eu' }],
            rollout: { percent: 100, by: 'accountId' },
          },
        ],
      },
    ]);

    expect(
      features.resolve({ region: 'eu', accountId: 'acct-1' }).gated.enabled,
    ).toBe(true);
    expect(
      features.resolve({ region: 'us', accountId: 'acct-1' }).gated.enabled,
    ).toBe(false);
  });

  it('defaults the bucketing seed to the feature key', () => {
    // Same rollout, same user, two features: the cohorts must differ. A shared
    // seed would make every 5% rollout contain the same users.
    const definitions = (key: string): FeatureDefinition[] => [
      { key, enabled: true, rules: [{ rollout: { percent: 5 } }] },
    ];
    const a = createFeatures(definitions('checkout-v2'));
    const b = createFeatures(definitions('payments-v3'));

    const differing = Array.from({ length: 500 }, (_, i) => `user-${i}`).filter(
      (targetingKey) =>
        a.isEnabled('checkout-v2', { targetingKey }) !==
        b.isEnabled('payments-v3', { targetingKey }),
    );

    expect(differing.length).toBeGreaterThan(0);
  });

  it('correlates two features deliberately when they share an explicit seed', () => {
    const seed = 'q4-cohort';
    const a = createFeatures([
      { key: 'a', enabled: true, rules: [{ rollout: { percent: 5, seed } }] },
    ]);
    const b = createFeatures([
      { key: 'b', enabled: true, rules: [{ rollout: { percent: 5, seed } }] },
    ]);

    for (let i = 0; i < 200; i++) {
      const targetingKey = `user-${i}`;
      expect(a.isEnabled('a', { targetingKey })).toBe(
        b.isEnabled('b', { targetingKey }),
      );
    }
  });
});

describe('cascade', () => {
  it('cascades transitively down a five-level chain', () => {
    const features = createFeatures(chain());

    expect(enabledOf(features.resolve())).toEqual({
      a: true,
      b: true,
      c: true,
      d: true,
      e: true,
    });

    features.toggle('a', false);

    // All five, not just b. A cascade that reads each parent's stored
    // `enabled` rather than its resolved decision turns b off and leaves c, d
    // and e on, because only a's stored value changed.
    expect(enabledOf(features.resolve())).toEqual({
      a: false,
      b: false,
      c: false,
      d: false,
      e: false,
    });
  });

  it('names the immediate parent and the root cause at every depth', () => {
    const features = createFeatures(chain());
    features.toggle('a', false);

    const decisions = features.resolve();

    expect(decisions.e).toMatchObject({
      enabled: false,
      reason: 'dependency-off',
      blockedBy: 'd',
      cause: { key: 'a', reason: 'explicitly-off' },
    });
    expect(decisions.c).toMatchObject({
      blockedBy: 'b',
      cause: { key: 'a', reason: 'explicitly-off' },
    });
  });

  it('carries the rule through the root cause when a parent is off by a rule', () => {
    const features = createFeatures([
      {
        key: 'payments-v3',
        enabled: true,
        rules: [
          {
            id: 'window-q4',
            when: [{ field: 'now', op: 'after', value: WINDOW }],
          },
        ],
      },
      { key: 'checkout-v2', enabled: true, dependsOn: ['payments-v3'] },
      { key: 'checkout-express', enabled: true, dependsOn: ['checkout-v2'] },
    ]);

    const decisions = features.resolve({
      now: new Date('2026-09-01T00:00:00Z'),
    });

    expect(decisions['checkout-express']).toMatchObject({
      enabled: false,
      reason: 'dependency-off',
      blockedBy: 'checkout-v2',
      cause: {
        key: 'payments-v3',
        reason: 'no-rule-matched',
        rule: 'window-q4',
      },
    });
  });

  it('does not run a dependant rules once a parent is off', () => {
    const features = createFeatures([
      { key: 'parent', enabled: false },
      {
        key: 'child',
        enabled: true,
        dependsOn: ['parent'],
        rules: [{ id: 'always', when: [] }],
      },
    ]);

    const decision = features.resolve().child;

    expect(decision.reason).toBe('dependency-off');
    expect(decision.rules).toBeUndefined();
  });

  it('cascades from a parent inside a rollout, so the rollout does not leak', () => {
    const features = createFeatures([
      {
        key: 'payments-v3',
        enabled: true,
        rules: [{ id: 'ramp', rollout: { percent: 25 } }],
      },
      { key: 'checkout-v2', enabled: true, dependsOn: ['payments-v3'] },
    ]);

    const users = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
    const parentOn = users.filter((targetingKey) =>
      features.isEnabled('payments-v3', { targetingKey }),
    );
    const childOn = users.filter((targetingKey) =>
      features.isEnabled('checkout-v2', { targetingKey }),
    );

    expect(childOn).toEqual(parentOn);
    expect(parentOn.length).toBeGreaterThan(0);
    expect(parentOn.length).toBeLessThan(users.length);
  });

  it('blocks downwards only: a dependant being off leaves its parent on', () => {
    const features = createFeatures([
      { key: 'parent', enabled: true },
      { key: 'child', enabled: false, dependsOn: ['parent'] },
    ]);

    expect(features.resolve().parent.enabled).toBe(true);
  });
});

describe('the store holds intent', () => {
  it('leaves the config byte-identical across a resolve that cascades', () => {
    const definitions = chain();
    definitions[0] = { key: 'a', enabled: false };
    const before = JSON.stringify(definitions);

    const features = createFeatures(definitions);
    const decisions = features.resolve();

    expect(decisions.e.reason).toBe('dependency-off');
    expect(JSON.stringify(definitions)).toBe(before);
    expect(JSON.stringify(features.config)).toBe(before);
  });

  it('restores a dependant when a window reopens, with no write in between', () => {
    const definitions: FeatureDefinition<'parent' | 'child'>[] = [
      {
        key: 'parent',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [
              { field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' },
              { field: 'now', op: 'before', value: '2026-11-01T00:00:00Z' },
            ],
          },
        ],
      },
      { key: 'child', enabled: true, dependsOn: ['parent'] },
    ];
    const features = createFeatures(definitions);
    const snapshot = JSON.stringify(definitions);
    const childAt = (iso: string) =>
      features.resolve({ now: new Date(iso) }).child.enabled;

    expect(childAt('2026-10-15T00:00:00Z')).toBe(true);
    expect(childAt('2026-11-15T00:00:00Z')).toBe(false);
    // Same config, later clock, and the window is open again.
    expect(childAt('2026-10-15T00:00:00Z')).toBe(true);

    expect(JSON.stringify(definitions)).toBe(snapshot);
    expect(JSON.stringify(features.config)).toBe(snapshot);
    // `enabled` is the maintainer's intent, and a window closing is not the
    // maintainer. Nothing but `toggle` and an edit to the configuration writes
    // it.
    expect(features.definition('child')?.enabled).toBe(true);
  });

  it('refuses to mutate the stored definitions in place', () => {
    const features = createFeatures([{ key: 'a', enabled: true }]);
    const stored = features.definition('a') as FeatureDefinition;

    expect(Object.isFrozen(stored)).toBe(true);
    expect(() => {
      (stored as { enabled: boolean }).enabled = false;
    }).toThrow(TypeError);
  });
});

describe('toggle', () => {
  it('reports the transitive dependants that will go off with a parent', () => {
    const features = createFeatures(chain());

    const result = features.toggle('a', false);

    expect(result).toEqual({
      ok: true,
      key: 'a',
      enabled: false,
      willDisable: ['b', 'c', 'd', 'e'],
    });
  });

  it('omits a dependant that is already off for its own reason', () => {
    const features = createFeatures([
      { key: 'parent', enabled: true },
      { key: 'live', enabled: true, dependsOn: ['parent'] },
      { key: 'already-off', enabled: false, dependsOn: ['parent'] },
    ]);

    expect(features.toggle('parent', false)).toMatchObject({
      willDisable: ['live'],
    });
  });

  it('reports nothing to disable when enabling', () => {
    const features = createFeatures([
      { key: 'parent', enabled: false },
      { key: 'child', enabled: true, dependsOn: ['parent'] },
    ]);

    expect(features.toggle('parent', true)).toMatchObject({ willDisable: [] });
    expect(features.resolve().child.enabled).toBe(true);
  });

  it('returns a structured failure for an unknown feature rather than throwing', () => {
    const features = createFeatures([{ key: 'a', enabled: true }]);

    expect(features.toggle('nope' as 'a', false)).toEqual({
      ok: false,
      key: 'nope',
      error: 'unknown-feature',
    });
  });

  it('replaces the definition instead of mutating it', () => {
    const definitions: FeatureDefinition[] = [{ key: 'a', enabled: true }];
    const features = createFeatures(definitions);

    features.toggle('a', false);

    expect(definitions[0]?.enabled).toBe(true);
    expect(features.definition('a')?.enabled).toBe(false);
  });
});

describe('plan', () => {
  it('resolves a context-free feature and defers one needing context', () => {
    const features = createFeatures([
      { key: 'plain', enabled: true },
      {
        key: 'targeted',
        enabled: true,
        rules: [{ rollout: { percent: 25, by: 'targetingKey' } }],
      },
    ]);

    const plan = features.plan();

    expect(plan.plain).toMatchObject({ resolved: true, needs: [] });
    expect(plan.targeted).toMatchObject({
      resolved: 'deferred',
      needs: ['targetingKey'],
    });
  });

  it('defers exactly the rules needing context and no others', () => {
    const features = createFeatures([
      {
        key: 'mixed',
        enabled: true,
        rules: [
          { id: 'region', when: [{ field: 'region', op: 'eq', value: 'eu' }] },
          { id: 'plan', when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
        ],
      },
    ]);

    expect(features.plan({ region: 'us' }).mixed).toMatchObject({
      // `region` was supplied and did not match; `plan` was not supplied, so it
      // is the only thing still outstanding.
      resolved: 'deferred',
      needs: ['plan'],
    });
  });

  it('stops deferring once a context-free rule matches', () => {
    const features = createFeatures([
      {
        key: 'mixed',
        enabled: true,
        rules: [
          { id: 'region', when: [{ field: 'region', op: 'eq', value: 'eu' }] },
          { id: 'targeted', rollout: { percent: 25 } },
        ],
      },
    ]);

    expect(features.plan({ region: 'eu' }).mixed).toMatchObject({
      resolved: true,
      needs: [],
    });
  });

  it('defers a time window unless the feature opts into freezing it', () => {
    const definitions = (freezeTimeAtBuild: boolean): FeatureDefinition[] => [
      {
        key: 'windowed',
        enabled: true,
        freezeTimeAtBuild,
        rules: [
          { id: 'window', when: [{ field: 'now', op: 'after', value: WINDOW }] },
        ],
      },
    ];
    const now = new Date('2026-10-15T00:00:00Z');

    expect(createFeatures(definitions(false)).plan({ now }).windowed).toMatchObject({
      resolved: 'deferred',
      needs: ['now'],
    });
    expect(createFeatures(definitions(true)).plan({ now }).windowed).toMatchObject({
      resolved: true,
    });
  });

  it('resolves a feature off at build time without deferring it', () => {
    const features = createFeatures([
      { key: 'off', enabled: false, rules: [{ rollout: { percent: 50 } }] },
    ]);

    expect(features.plan().off).toMatchObject({ resolved: false, needs: [] });
  });

  it('defers a dependant whose parent is deferred, carrying its needs', () => {
    const features = createFeatures([
      {
        key: 'parent',
        enabled: true,
        rules: [{ rollout: { percent: 25, by: 'accountId' } }],
      },
      { key: 'child', enabled: true, dependsOn: ['parent'] },
    ]);

    expect(features.plan().child).toMatchObject({
      resolved: 'deferred',
      needs: ['accountId'],
    });
  });

  it('resolves a dependant off at build time when its parent is off', () => {
    const features = createFeatures([
      { key: 'parent', enabled: false },
      {
        key: 'child',
        enabled: true,
        dependsOn: ['parent'],
        rules: [{ rollout: { percent: 25 } }],
      },
    ]);

    expect(features.plan().child).toMatchObject({
      resolved: false,
      needs: [],
    });
  });
});
