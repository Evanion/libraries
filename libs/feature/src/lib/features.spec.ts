import { describe, expect, it } from 'vitest';
import {
  DuplicateVariantError,
  FeatureConfigError,
  FeatureCycleError,
} from './errors.js';
import { createFeatures, type Definitions } from './features.js';
import type { Decision, FeatureDefinition } from './types.js';
import { everywhere } from './zones.js';

const WINDOW = '2026-10-01T00:00:00Z';

/**
 * A -> B -> C -> D -> E. Five levels: two would prove nothing about cascading.
 *
 * Typed on a literal key union, which is how a consumer gets exact decision
 * records -- `decisions.e` is a `Decision`, not `Decision | undefined`.
 */
type Link = 'a' | 'b' | 'c' | 'd' | 'e';

const chain = (): [FeatureDefinition<Link>, ...FeatureDefinition<Link>[]] => [
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

  it('refuses a configuration whose variants share a name', () => {
    expect(() =>
      createFeatures([
        {
          key: 'k',
          enabled: true,
          variants: [
            { name: 'a', weight: 1 },
            { name: 'a', weight: 1 },
          ],
        },
      ]),
    ).toThrow(DuplicateVariantError);
  });

  it('refuses a window condition whose string names no instant', () => {
    expect(() =>
      createFeatures([
        {
          key: 'k',
          enabled: true,
          rules: [
            {
              when: [
                { field: 'now', op: 'after', value: '2026-01-01T00:00:00' },
              ],
            },
          ],
        },
      ]),
    ).toThrow(FeatureConfigError);
  });

  it('accepts a window condition written as a date with no time', () => {
    expect(() =>
      createFeatures([
        {
          key: 'k',
          enabled: true,
          rules: [
            { when: [{ field: 'now', op: 'after', value: '2026-01-01' }] },
          ],
        },
      ]),
    ).not.toThrow();
  });

  it('refuses a window condition naming a day past the end of its month', () => {
    // `2026-04-31` builds as 1 May under ECMA-262's MakeDay, so a generator
    // computing "last day of April" one too far would ship a launch that opens
    // a day late and reports nothing.
    expect(() =>
      createFeatures([
        {
          key: 'launch',
          enabled: true,
          rules: [
            { when: [{ field: 'now', op: 'after', value: '2026-04-31' }] },
          ],
        },
      ]),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a window whose string names no instant in a feature past the first', () => {
    expect(() =>
      createFeatures([
        { key: 'first', enabled: true },
        {
          key: 'second',
          enabled: true,
          rules: [
            {
              when: [{ field: 'now', op: 'before', value: '2026-06-01T12:00' }],
            },
          ],
        },
      ]),
    ).toThrow(/feature "second"/);
  });

  it('refuses a window whose string names no instant in a rule past the first', () => {
    expect(() =>
      createFeatures([
        {
          key: 'k',
          enabled: true,
          rules: [
            { when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
            {
              when: [
                { field: 'now', op: 'after', value: '2026-01-01T00:00:00' },
              ],
            },
          ],
        },
      ]),
    ).toThrow(FeatureConfigError);
  });

  it('accepts every window value that names one instant', () => {
    const values = [
      '2026-01-01T00:00:00Z',
      '2026-01-01T09:00:00+09:00',
      '2026-01-01T09:00:00+0900',
      '2026-01-01',
      1767225600000,
      new Date(1767225600000),
    ];

    for (const value of values) {
      expect(() =>
        createFeatures([
          {
            key: 'k',
            enabled: true,
            rules: [{ when: [{ field: 'now', op: 'after', value }] }],
          },
        ]),
      ).not.toThrow();
    }
  });

  it('builds a window whose value is of no type an instant takes, and answers false', () => {
    // A document read off the wire is untyped, and the construction check
    // polices the three types `Instant` declares. `null` is junk either way;
    // what the library owes for it is the answer an unevaluable condition
    // gets, and not a TypeError out of the evaluation path.
    const document = JSON.parse(
      '[{"key":"k","enabled":true,"rules":[{"when":[{"field":"now","op":"after","value":null}]}]}]',
    ) as Definitions<'k'>;

    const features = createFeatures(document);

    expect(features.isEnabled('k', { now: new Date(WINDOW) })).toBe(false);
    expect(features.resolve({ now: new Date(WINDOW) }).k.reason).toBe(
      'no-rule-matched',
    );
  });

  it('refuses a window bounded by a number no Date can hold', () => {
    // A `before` boundary above every instant a `Date` holds is a window
    // nothing falls outside, and the flag is on at every moment.
    expect(() =>
      createFeatures([
        {
          key: 'launch',
          enabled: true,
          rules: [
            {
              when: [
                { field: 'now', op: 'before', value: Number.POSITIVE_INFINITY },
              ],
            },
          ],
        },
      ]),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a window bounded by the number NaN', () => {
    // `Date.parse(process.env.LAUNCH_AT ?? '')` writes NaN when the variable is
    // unset. The rule matches at no instant and no decision says why, so the
    // flag is off forever and nothing reports it.
    expect(() =>
      createFeatures([
        {
          key: 'launch',
          enabled: true,
          rules: [{ when: [{ field: 'now', op: 'after', value: Number.NaN }] }],
        },
      ]),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a window whose string is ISO 8601 in shape and names no date', () => {
    expect(() =>
      createFeatures([
        {
          key: 'k',
          enabled: true,
          rules: [
            {
              when: [{ field: 'now', op: 'before', value: '-000000-01-01' }],
            },
          ],
        },
      ]),
    ).toThrow(FeatureConfigError);
  });

  it('resolves one decision under one rule id in every zone', () => {
    // The whole point of refusing the offsetless string: a store built from the
    // same document answers the same thing, under the same rule name, wherever
    // it runs. A fresh store per zone, because a rule object memoizes its id.
    const storeOf = () =>
      createFeatures([
        {
          key: 'launch',
          enabled: true,
          rules: [
            {
              when: [
                { field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' },
              ],
            },
          ],
        },
      ]);
    const now = new Date('2026-01-01T02:00:00Z');

    const answers = everywhere(() => {
      const decision = storeOf().resolve({ now }).launch;
      return `${decision.enabled} ${decision.reason} ${decision.rule}`;
    });

    expect(answers[0]).toMatch(/^true rule-match rule-[0-9a-f]{8}$/);
    expect(new Set(answers).size).toBe(1);
  });

  it('opens a window at the instant its string names', () => {
    const features = createFeatures([
      {
        key: 'launch',
        enabled: true,
        rules: [
          {
            when: [
              { field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' },
            ],
          },
        ],
      },
    ]);

    expect(
      features.isEnabled('launch', {
        now: new Date('2025-12-31T23:59:59.999Z'),
      }),
    ).toBe(false);
    expect(
      features.isEnabled('launch', {
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toBe(false);
    expect(
      features.isEnabled('launch', {
        now: new Date('2026-01-01T00:00:00.001Z'),
      }),
    ).toBe(true);
  });

  it('opens a window written as a date at UTC midnight in every zone', () => {
    const answers = everywhere(() => {
      const features = createFeatures([
        {
          key: 'launch',
          enabled: true,
          rules: [
            { when: [{ field: 'now', op: 'after', value: '2026-01-01' }] },
          ],
        },
      ]);
      return [
        features.isEnabled('launch', { now: new Date('2025-12-31T23:00:00Z') }),
        features.isEnabled('launch', { now: new Date('2026-01-01T01:00:00Z') }),
      ];
    });

    expect(answers).toEqual([
      [false, true],
      [false, true],
      [false, true],
    ]);
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

    expect(
      features.resolve({ accountId: 'acct-1' })['checkout-v2'],
    ).toMatchObject({ enabled: true, rule: 'ramp' });
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
    const definitions = <const K extends string>(key: K): Definitions<K> => [
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

  it('names a rule by its content when a rule is inserted above it', () => {
    const before = createFeatures([
      {
        key: 'k',
        enabled: true,
        rules: [{ when: [{ field: 'role', op: 'eq', value: 'staff' }] }],
      },
    ]);
    const after = createFeatures([
      {
        key: 'k',
        enabled: true,
        rules: [
          { when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
          { when: [{ field: 'role', op: 'eq', value: 'staff' }] },
        ],
      },
    ]);

    const beforeId = before.resolve({ role: 'staff' }).k.rule;
    const afterId = after.resolve({ role: 'staff' }).k.rule;

    expect(beforeId).toMatch(/^rule-[0-9a-f]{8}$/);
    expect(afterId).toBe(beforeId);
  });

  it('resolves a rule condition holding a BigInt value', () => {
    const features = createFeatures([
      {
        key: 'k',
        enabled: true,
        rules: [{ when: [{ field: 'accountId', op: 'eq', value: 10n }] }],
      },
    ]);

    expect(features.resolve({ accountId: 10n }).k.enabled).toBe(true);
  });

  it('names every rule in a breakdown by its content', () => {
    const features = createFeatures([
      {
        key: 'k',
        enabled: true,
        rules: [
          { when: [{ field: 'role', op: 'eq', value: 'staff' }] },
          { id: 'named', when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
        ],
      },
    ]);

    const decision = features.resolve({ role: 'customer', plan: 'free' }).k;

    expect(decision.reason).toBe('no-rule-matched');
    expect(decision.rules?.[0]?.rule).toMatch(/^rule-[0-9a-f]{8}$/);
    expect(decision.rules?.[1]?.rule).toBe('named');
  });

  it('assigns a variant to a feature that is on with no rules', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50, value: { label: 'Get it' } },
        ],
      },
    ]);

    const decision = features.resolve({ targetingKey: 'user-1' }).cta;

    expect(decision.enabled).toBe(true);
    expect(decision.reason).toBe('default-on');
    expect(['control', 'blue']).toContain(decision.variant);
    expect(decision.assignment?.source).toBe('weighted');
    expect(decision.assignment?.by).toBe('targetingKey');
  });

  it("carries the assigned variant's value", () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'only', weight: 1, value: { label: 'Buy' } }],
      },
    ]);

    const decision = features.resolve({ targetingKey: 'user-1' }).cta;

    expect(decision.variant).toBe('only');
    expect(decision.value).toEqual({ label: 'Buy' });
  });

  it('carries no value for a variant declaring none', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'only', weight: 1 }],
      },
    ]);

    expect(features.resolve({ targetingKey: 'u' }).cta.value).toBeUndefined();
  });

  it('assigns a variant when a rule matched without pinning one', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [{ rollout: { percent: 100 } }],
      },
    ]);

    const decision = features.resolve({ targetingKey: 'user-1' }).cta;

    expect(decision.reason).toBe('rule-match');
    expect(decision.assignment?.source).toBe('weighted');
    expect(['control', 'blue']).toContain(decision.variant);
  });

  it('takes the variant a matching rule pins', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 99 },
          { name: 'blue', weight: 1 },
        ],
        rules: [
          {
            when: [{ field: 'group', op: 'eq', value: 'staff' }],
            variant: 'blue',
          },
          { rollout: { percent: 100 } },
        ],
      },
    ]);

    const decision = features.resolve({
      targetingKey: 'user-1',
      group: 'staff',
    }).cta;

    expect(decision.variant).toBe('blue');
    expect(decision.assignment?.source).toBe('pinned');
    expect(decision.assignment?.rule).toMatch(/^rule-[0-9a-f]{8}$/);
  });

  it('lets a pin beat a prior assignment the context carries', () => {
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
            when: [{ field: 'group', op: 'eq', value: 'staff' }],
            variant: 'blue',
          },
        ],
      },
    ]);

    const decision = features.resolve({
      targetingKey: 'user-1',
      group: 'staff',
      stickyVariants: { cta: 'control' },
    }).cta;

    expect(decision.variant).toBe('blue');
    expect(decision.assignment?.source).toBe('pinned');
  });

  it('carries no variant on any of the three off paths', () => {
    const variants = [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ];
    const features = createFeatures([
      { key: 'parent', enabled: false },
      { key: 'child', enabled: true, dependsOn: ['parent'], variants },
      { key: 'killed', enabled: false, variants },
      {
        key: 'unmatched',
        enabled: true,
        variants,
        rules: [{ when: [{ field: 'role', op: 'eq', value: 'staff' }] }],
      },
    ]);

    const decisions = features.resolve({
      targetingKey: 'user-1',
      role: 'customer',
    });

    for (const key of ['child', 'killed', 'unmatched'] as const) {
      expect(decisions[key].enabled).toBe(false);
      expect(decisions[key].variant).toBeUndefined();
      expect(decisions[key].value).toBeUndefined();
      expect(decisions[key].assignment).toBeUndefined();
    }

    expect(decisions.killed.reason).toBe('explicitly-off');
    expect(decisions.child.reason).toBe('dependency-off');
    expect(decisions.unmatched.reason).toBe('no-rule-matched');
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
    const definitions = [
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
    ] as const satisfies Definitions<'parent' | 'child'>;
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
    const definitions = [
      { key: 'a', enabled: true },
    ] as const satisfies Definitions<'a'>;
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
    const definitions = (
      freezeTimeAtBuild: boolean,
    ): Definitions<'windowed'> => [
      {
        key: 'windowed',
        enabled: true,
        freezeTimeAtBuild,
        rules: [
          {
            id: 'window',
            when: [{ field: 'now', op: 'after', value: WINDOW }],
          },
        ],
      },
    ];
    const now = new Date('2026-10-15T00:00:00Z');

    expect(
      createFeatures(definitions(false)).plan({ now }).windowed,
    ).toMatchObject({
      resolved: 'deferred',
      needs: ['now'],
    });
    expect(
      createFeatures(definitions(true)).plan({ now }).windowed,
    ).toMatchObject({
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

  it('settles a dependant whose parent defers only its own split', () => {
    const features = createFeatures([
      {
        key: 'p',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
      { key: 'c', enabled: true, dependsOn: ['p'] },
    ]);

    const entry = features.plan().c;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.enabled).toBe(true);
  });

  it('defers a dependant whose parent defers for its own rules', () => {
    const features = createFeatures([
      {
        key: 'p',
        enabled: true,
        rules: [{ when: [{ field: 'region', op: 'eq', value: 'eu' }] }],
      },
      { key: 'c', enabled: true, dependsOn: ['p'] },
    ]);

    const entry = features.plan().c;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['region']);
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

  it('defers a feature whose enablement is settled and whose variant is not', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ]);

    const entry = features.plan().cta;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['targetingKey']);
    expect(entry.decision?.enabled).toBe(true);
    expect(entry.decision?.reason).toBe('default-on');
    expect(entry.decision?.variant).toBeUndefined();
  });

  it('attaches no variant to a decision on a deferred entry', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ]);

    const entry = features.plan().cta;

    expect(entry.decision?.variant).toBeUndefined();
    expect(entry.decision?.value).toBeUndefined();
    expect(entry.decision?.assignment).toBeUndefined();
  });

  it('needs the field variantBy names', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variantBy: 'accountId',
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ]);

    expect(features.plan().cta.needs).toEqual(['accountId']);
  });

  it('attaches no decision when a rule needs the field the variant needs', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [{ rollout: { percent: 50 } }],
      },
    ]);

    const entry = features.plan().cta;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['targetingKey']);
    expect(entry.decision).toBeUndefined();
  });

  it('attaches no decision when a rule needs a field and the variant needs another', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [{ when: [{ field: 'region', op: 'eq', value: 'eu' }] }],
      },
    ]);

    const entry = features.plan().cta;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['region', 'targetingKey']);
    expect(entry.decision).toBeUndefined();
  });

  it('attaches a decision when a rule resolved and only the split waits', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [{ when: [{ field: 'region', op: 'eq', value: 'eu' }] }],
      },
    ]);

    const entry = features.plan({ region: 'eu' }).cta;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['targetingKey']);
    expect(entry.decision?.enabled).toBe(true);
    expect(entry.decision?.reason).toBe('rule-match');
    expect(entry.decision?.variant).toBeUndefined();
  });

  it('settles the split at build time when a rule pins the variant', () => {
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
            when: [{ field: 'region', op: 'eq', value: 'eu' }],
            variant: 'blue',
          },
        ],
      },
    ]);

    const entry = features.plan({ region: 'eu' }).cta;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.variant).toBe('blue');
    expect(entry.decision?.assignment?.source).toBe('pinned');
  });

  it('settles the split at build time from a prior assignment', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ]);

    const entry = features.plan({ stickyVariants: { cta: 'blue' } }).cta;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.variant).toBe('blue');
    expect(entry.decision?.assignment?.source).toBe('sticky');
  });

  it('settles the split at build time when the context buckets it', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ]);

    const entry = features.plan({ targetingKey: 'user-1' }).cta;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.assignment?.source).toBe('weighted');
  });

  it('defers the split when nothing settles it', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ]);

    const entry = features.plan().cta;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['targetingKey']);
    expect(entry.decision?.enabled).toBe(true);
    expect(entry.decision?.variant).toBeUndefined();
  });

  it('defers when an earlier rule it could not evaluate might have won', () => {
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
            when: [{ field: 'region', op: 'eq', value: 'eu' }],
            variant: 'blue',
          },
          { when: [], variant: 'control' },
        ],
      },
    ]);

    const entry = features.plan({ targetingKey: 'u1' }).cta;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['region']);
  });

  it("agrees with resolve once the skipped rule's field arrives", () => {
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
            when: [{ field: 'region', op: 'eq', value: 'eu' }],
            variant: 'blue',
          },
          { when: [], variant: 'control' },
        ],
      },
    ]);

    const planned = features.plan({ targetingKey: 'u1', region: 'eu' }).cta;
    const resolved = features.resolve({ targetingKey: 'u1', region: 'eu' }).cta;

    expect(planned.resolved).toBe(true);
    expect(planned.decision?.variant).toBe('blue');
    expect(planned.decision?.variant).toBe(resolved.variant);
    expect(planned.decision?.rule).toBe(resolved.rule);
  });

  it('settles a later match when the context already refuted the earlier rule', () => {
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
            when: [
              { field: 'plan', op: 'eq', value: 'pro' },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
            variant: 'blue',
          },
          { when: [], variant: 'control' },
        ],
      },
    ]);

    const entry = features.plan({ targetingKey: 'u1', plan: 'free' }).cta;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.variant).toBe('control');
  });

  it('agrees with resolve for either value of the field the refuted rule missed', () => {
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
            when: [
              { field: 'plan', op: 'eq', value: 'pro' },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
            variant: 'blue',
          },
          { when: [], variant: 'control' },
        ],
      },
    ]);
    const planned = features.plan({ targetingKey: 'u1', plan: 'free' }).cta;

    for (const region of ['eu', 'us']) {
      const resolved = features.resolve({
        targetingKey: 'u1',
        plan: 'free',
        region,
      }).cta;
      expect(planned.decision?.enabled).toBe(resolved.enabled);
      expect(planned.decision?.variant).toBe(resolved.variant);
      expect(planned.decision?.rule).toBe(resolved.rule);
    }
  });

  it('defers an earlier rule the context has not refuted', () => {
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
            when: [
              { field: 'plan', op: 'eq', value: 'pro' },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
            variant: 'blue',
          },
          { when: [], variant: 'control' },
        ],
      },
    ]);

    const entry = features.plan({ targetingKey: 'u1', plan: 'pro' }).cta;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['region']);
  });

  it('refutes a rollout rule whose conditions the context already ruled out', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'pro-ramp',
            when: [{ field: 'plan', op: 'eq', value: 'pro' }],
            rollout: { percent: 50 },
          },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'free' }).promo;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.rule).toBe('everyone');
  });

  it('settles off when the context refuted every rule it could not evaluate', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'eu-pro',
            when: [
              { field: 'region', op: 'eq', value: 'eu' },
              { field: 'plan', op: 'eq', value: 'pro' },
            ],
          },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'free' }).promo;

    expect(entry.resolved).toBe(false);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.reason).toBe('no-rule-matched');
  });

  it('blames the condition the context refuted, not the one it could not read', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'eu-pro',
            when: [
              { field: 'region', op: 'eq', value: 'eu' },
              { field: 'plan', op: 'eq', value: 'pro' },
            ],
          },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'free' }).promo;

    expect(entry.decision?.rules?.[0]?.failed).toEqual({
      field: 'plan',
      op: 'eq',
      value: 'pro',
    });
  });

  it('still settles a feature whose first rule matched', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [
          { when: [], variant: 'blue' },
          { when: [{ field: 'region', op: 'eq', value: 'eu' }] },
        ],
      },
    ]);

    const entry = features.plan({ targetingKey: 'u1' }).cta;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.variant).toBe('blue');
  });

  it('resolves a feature whose variant a build-time context settles', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ]);

    const entry = features.plan({ targetingKey: 'user-1' }).cta;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.variant).toBeDefined();
  });

  it('resolves a feature that is off without needing a bucketing field', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: false,
        variants: [{ name: 'control', weight: 1 }],
      },
    ]);

    const entry = features.plan().cta;

    expect(entry.resolved).toBe(false);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.enabled).toBe(false);
  });

  it('refutes a rule on an ne condition the context already fails', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'not-gold',
            when: [
              { field: 'tier', op: 'ne', value: 'gold' },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
          },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({ tier: 'gold' }).promo;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.rule).toBe('everyone');
  });

  it('refutes a rule on a not-in condition the context already fails', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'paid',
            when: [
              { field: 'plan', op: 'not-in', value: ['free', 'trial'] },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
          },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'trial' }).promo;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.rule).toBe('everyone');
  });

  it('refutes a rule on a contains condition the context already fails', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'admins',
            when: [
              { field: 'roles', op: 'contains', value: 'admin' },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
          },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({ roles: ['viewer'] }).promo;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.rule).toBe('everyone');
  });

  it('refutes an in condition whose value is not a list', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'paid',
            when: [
              { field: 'plan', op: 'in', value: 'pro' },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
          },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'pro' }).promo;

    // A condition's `value` is `unknown`, so a bare string is legal for the
    // type. `in` holds for a list membership and nothing else, so this rule
    // matches no context and the plan may walk past it.
    expect(entry.resolved).toBe(true);
    expect(entry.decision?.rule).toBe('everyone');
  });

  it('blames the first condition it could evaluate, not a later one', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'eu-pro-gold',
            when: [
              { field: 'region', op: 'eq', value: 'eu' },
              { field: 'plan', op: 'eq', value: 'pro' },
              { field: 'tier', op: 'eq', value: 'gold' },
            ],
          },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'free', tier: 'silver' }).promo;

    expect(entry.decision?.rules).toHaveLength(1);
    expect(entry.decision?.rules?.[0]?.failed).toEqual({
      field: 'plan',
      op: 'eq',
      value: 'pro',
    });
  });

  it('carries one breakdown entry per rule when two rules are identical', () => {
    const shared = [
      { field: 'region', op: 'eq', value: 'eu' },
      { field: 'plan', op: 'eq', value: 'pro' },
    ] as const;
    const features = createFeatures([
      { key: 'promo', enabled: true, rules: [{ when: shared }, { when: shared }] },
    ]);

    const entry = features.plan({ plan: 'free' }).promo;

    expect(entry.resolved).toBe(false);
    expect(entry.decision?.rules).toHaveLength(2);
    expect(entry.decision?.rules?.[0]).toEqual(entry.decision?.rules?.[1]);
    expect(entry.decision?.rules?.[0]?.failed).toEqual({
      field: 'plan',
      op: 'eq',
      value: 'pro',
    });
  });

  it('settles a window rule the context refuted on a field other than now', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'launch-pro',
            when: [
              { field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' },
              { field: 'plan', op: 'eq', value: 'pro' },
            ],
          },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'free' }).promo;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.rule).toBe('everyone');
  });

  it('defers the same window rule on now when the context refutes nothing', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'launch-pro',
            when: [
              { field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' },
              { field: 'plan', op: 'eq', value: 'pro' },
            ],
          },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'pro' }).promo;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['now']);
  });

  it('walks past a rule the context refuted however wide its rollout', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'pro-ramp',
            when: [{ field: 'plan', op: 'eq', value: 'pro' }],
            rollout: { percent: 100 },
          },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'free' }).promo;

    expect(entry.resolved).toBe(true);
    expect(entry.needs).toEqual([]);
    expect(entry.decision?.rule).toBe('everyone');
  });

  it('defers a rule it cannot evaluate even when its rollout admits nobody', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'staff-ramp',
            when: [{ field: 'role', op: 'eq', value: 'staff' }],
            rollout: { percent: 0 },
          },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({ targetingKey: 'u1' }).promo;

    // The rollout is a conjunct the walk does not read: only a `when`
    // condition refutes a rule, so the outstanding `role` still defers this.
    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['role']);
  });

  it('defers a field the context carries as undefined', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          { id: 'pro', when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({ plan: undefined }).promo;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['plan']);
  });

  it('sorts and deduplicates the needs of the rules it could not decide', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          { id: 'org', when: [{ field: 'org', op: 'eq', value: 'acme' }] },
          { id: 'pro', when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
          {
            id: 'adult-org',
            when: [
              { field: 'age', op: 'eq', value: 18 },
              { field: 'org', op: 'eq', value: 'globex' },
            ],
          },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'free' }).promo;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['age', 'org']);
  });

  it('cascades off to a dependant whose parent refutation settled off', () => {
    const features = createFeatures([
      {
        key: 'parent',
        enabled: true,
        rules: [
          {
            id: 'eu-pro',
            when: [
              { field: 'region', op: 'eq', value: 'eu' },
              { field: 'plan', op: 'eq', value: 'pro' },
            ],
          },
        ],
      },
      { key: 'child', enabled: true, dependsOn: ['parent'] },
    ]);

    const planned = features.plan({ plan: 'free' });

    expect(planned.parent.resolved).toBe(false);
    expect(planned.child.resolved).toBe(false);
    expect(planned.child.needs).toEqual([]);
    expect(planned.child.decision?.reason).toBe('dependency-off');
    expect(planned.child.decision?.cause).toEqual({
      key: 'parent',
      reason: 'no-rule-matched',
      rule: 'eu-pro',
    });
  });

  it("leaves a dependant's needs to the parent while the parent is unresolved", () => {
    const features = createFeatures([
      {
        key: 'parent',
        enabled: true,
        rules: [{ id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] }],
      },
      {
        key: 'child',
        enabled: true,
        dependsOn: ['parent'],
        rules: [
          {
            id: 'eu-pro',
            when: [
              { field: 'region', op: 'eq', value: 'eu' },
              { field: 'plan', op: 'eq', value: 'pro' },
            ],
          },
        ],
      },
    ]);

    const planned = features.plan({ plan: 'free' });

    expect(planned.parent.needs).toEqual(['role']);
    expect(planned.child.needs).toEqual(['role']);
  });

  it('defers only the bucketing field once refutation settled enablement', () => {
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
            id: 'eu-pro',
            when: [
              { field: 'region', op: 'eq', value: 'eu' },
              { field: 'plan', op: 'eq', value: 'pro' },
            ],
          },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'free' }).cta;

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['targetingKey']);
    expect(entry.decision?.enabled).toBe(true);
    expect(entry.decision?.variant).toBeUndefined();
  });

  it('agrees with resolve for every value of the fields the plan lacked', () => {
    const definitions = [
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [
          {
            id: 'eu-pro',
            when: [
              { field: 'plan', op: 'eq', value: 'pro' },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
            variant: 'blue',
          },
          { id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] },
          { id: 'everyone', when: [] },
        ],
      },
    ] as const;
    const features = createFeatures(definitions);
    const known = { targetingKey: 'u1', plan: 'free', role: 'viewer' };
    const planned = features.plan(known).cta;

    for (const region of ['eu', 'us', 'apac', '']) {
      expect(planned.decision).toEqual(features.resolve({ ...known, region }).cta);
    }
  });
});

describe('variantOf', () => {
  it('reads the assigned variant off a resolved feature', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50, value: { label: 'Get it' } },
        ],
      },
    ]);
    const subjects = Array.from({ length: 40 }, (_, i) => `user-${i}`);

    const variants = subjects.map((targetingKey) => {
      const variant = features.variantOf('cta', { targetingKey });

      // Tied to the decision `resolve` computes for the same context. A reader
      // that answered with the feature's first declared name, ignoring the
      // assignment, passes a membership check and fails this one.
      expect(variant).toBe(features.resolve({ targetingKey }).cta.variant);
      return variant;
    });

    expect(new Set(variants)).toEqual(new Set(['control', 'blue']));
  });

  it('reads no variant off a feature that resolved off', () => {
    const features = createFeatures([
      { key: 'cta', enabled: false, variants: [{ name: 'only', weight: 1 }] },
    ]);

    expect(features.variantOf('cta', { targetingKey: 'u' })).toBeUndefined();
  });
});

describe('valueOf', () => {
  it("reads the assigned variant's value", () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50, value: { label: 'Buy' } },
          { name: 'blue', weight: 50, value: { label: 'Get it' } },
        ],
      },
    ]);
    const subjects = Array.from({ length: 40 }, (_, i) => `user-${i}`);

    const values = subjects.map((targetingKey) => {
      const value = features.valueOf('cta', { targetingKey });

      expect(value).toEqual(features.resolve({ targetingKey }).cta.value);
      return value?.label;
    });

    expect(new Set(values)).toEqual(new Set(['Buy', 'Get it']));
  });

  it('reads no value off a feature that resolved off', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: false,
        variants: [{ name: 'only', weight: 1, value: { label: 'Buy' } }],
      },
    ]);

    expect(features.valueOf('cta', { targetingKey: 'u' })).toBeUndefined();
  });
});
