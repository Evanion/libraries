import { describe, expect, it } from 'vitest';
import { configDigest } from './digest.js';
import {
  DuplicateFeatureError,
  DuplicateVariantError,
  FeatureConfigError,
  FeatureCycleError,
  UnknownDependencyError,
  UnknownVariantError,
} from './errors.js';
import { createFeatures, type Definitions } from './features.js';
import { serializeConfig } from './serialize.js';
import { validateConfig } from './validate.js';
import type { FeatureConfig } from './config.js';
import type {
  Decision,
  EvaluationContext,
  FeatureDefinition,
  FeatureKey,
} from './types.js';
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

/**
 * The configurations `plan()` is held against `resolve()` over.
 *
 * `planFeature` walks every feature, so the walk has to agree with `resolve`
 * for more than the features declaring variants. One entry per shape that
 * reaches a different branch of it: a segment rule ahead of an unconditional
 * one, a rollout behind a segment, a rule pinning a variant, a chain whose
 * parent settles its own enablement, a chain whose parent leaves it open, a
 * parent deferred on its split alone, a window a feature freezes, the same
 * window it does not, and a feature turned off with a dependant under it.
 */
const SHAPES: Record<string, Definitions> = {
  segments: [
    {
      key: 'cta',
      enabled: true,
      rules: [
        {
          id: 'eu-pro',
          when: [
            { field: 'plan', op: 'eq', value: 'pro' },
            { field: 'region', op: 'eq', value: 'eu' },
          ],
        },
        { id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] },
        { id: 'everyone', when: [] },
      ],
    },
  ],
  'ramped segment': [
    {
      key: 'ramp',
      enabled: true,
      rules: [
        {
          id: 'pro-ramp',
          when: [{ field: 'plan', op: 'eq', value: 'pro' }],
          rollout: { percent: 50, by: 'targetingKey' },
        },
        { id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] },
      ],
    },
  ],
  'pinned variants': [
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50, value: { label: 'Get it' } },
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
        { id: 'everyone', when: [] },
      ],
    },
  ],
  'settled parent': [
    {
      key: 'banner',
      enabled: true,
      rules: [{ id: 'pro', when: [{ field: 'plan', op: 'eq', value: 'pro' }] }],
    },
    {
      key: 'cta',
      enabled: true,
      dependsOn: ['banner'],
      rules: [{ id: 'eu', when: [{ field: 'region', op: 'eq', value: 'eu' }] }],
    },
  ],
  'open parent': [
    {
      key: 'banner',
      enabled: true,
      rules: [
        { id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] },
      ],
    },
    {
      key: 'cta',
      enabled: true,
      dependsOn: ['banner'],
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
        },
      ],
    },
  ],
  'split-deferred parent': [
    {
      key: 'banner',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    },
    {
      key: 'cta',
      enabled: true,
      dependsOn: ['banner'],
      rules: [
        { id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] },
      ],
    },
  ],
  'frozen window': [
    {
      key: 'promo',
      enabled: true,
      freezeTimeAtBuild: true,
      rules: [
        {
          id: 'launch',
          when: [
            { field: 'now', op: 'after', value: WINDOW },
            { field: 'plan', op: 'eq', value: 'pro' },
          ],
        },
        { id: 'everyone', when: [] },
      ],
    },
  ],
  'live window': [
    {
      key: 'promo',
      enabled: true,
      rules: [
        {
          id: 'launch',
          when: [
            { field: 'now', op: 'after', value: WINDOW },
            { field: 'plan', op: 'eq', value: 'pro' },
          ],
        },
        { id: 'everyone', when: [] },
      ],
    },
  ],
  'off parent': [
    { key: 'banner', enabled: false },
    {
      key: 'cta',
      enabled: true,
      dependsOn: ['banner'],
      rules: [{ id: 'eu', when: [{ field: 'region', op: 'eq', value: 'eu' }] }],
    },
  ],
};

/** Every combination of the five fields the shapes above read. */
const REQUESTS: readonly EvaluationContext[] = Object.entries({
  targetingKey: ['u1', 'u2'],
  plan: ['free', 'pro'],
  role: ['staff', 'viewer'],
  region: ['eu', 'us'],
  now: [new Date('2026-09-01T00:00:00Z'), new Date('2026-10-15T00:00:00Z')],
}).reduce<EvaluationContext[]>(
  (contexts, [field, values]) =>
    contexts.flatMap((context) =>
      values.map((value) => ({ ...context, [field]: value })),
    ),
  [{}],
);

/**
 * What each plan is denied of the request it is held against.
 *
 * `now` is never denied. A plan that reads it off the clock plans another
 * instant than the request resolves at, and the two are then entitled to
 * disagree.
 */
const WITHHELD: readonly (readonly string[])[] = [
  [],
  ['region'],
  ['region', 'role'],
  ['targetingKey'],
  ['plan', 'region'],
  ['role', 'targetingKey', 'region'],
  ['targetingKey', 'plan', 'role', 'region'],
];

const denied = (context: EvaluationContext, fields: readonly string[]) =>
  Object.fromEntries(
    Object.entries(context).filter(([field]) => !fields.includes(field)),
  );

/**
 * A decision without the condition its breakdown blames.
 *
 * `plan()` names one only where every request names the same one, so this is
 * what a build and a request are held to agree on.
 */
const withoutBlame = (decision: Decision<FeatureKey>) => ({
  ...decision,
  ...(decision.rules && {
    rules: decision.rules.map(({ failed, ...outcome }) => outcome),
  }),
});

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

  it('names no condition on an outcome the rollout refused', () => {
    const features = createFeatures([
      {
        key: 'ramped',
        enabled: true,
        rules: [{ id: 'ramp', rollout: { percent: 0 } }],
      },
    ]);

    const decision = features.resolve({ targetingKey: 'u1' }).ramped;

    // The rule declares no condition, so every condition held and the rollout
    // is the whole reason. `failed` is the key a UI reads to name a condition,
    // and here there is no condition to name.
    expect(decision.rules).toEqual([
      {
        rule: 'ramp',
        matched: false,
        rollout: { percent: 0, by: 'targetingKey', member: false },
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

  it("plans a dependant's own rules under a parent deferred on its split", () => {
    const features = createFeatures([
      {
        key: 'p',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
      {
        key: 'c',
        enabled: true,
        dependsOn: ['p'],
        rules: [{ when: [{ field: 'role', op: 'eq', value: 'staff' }] }],
      },
    ]);

    const plan = features.plan({});

    expect(plan.p).toMatchObject({
      resolved: 'deferred',
      needs: ['targetingKey'],
    });
    expect(plan.p.decision?.enabled).toBe(true);
    expect(plan.c.resolved).toBe('deferred');
    expect(plan.c.needs).toEqual(['role']);
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

  it('defers an unconditional rule behind one the context has not refuted', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          { id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] },
          { id: 'everyone', when: [] },
        ],
      },
    ]);

    const entry = features.plan({}).promo;

    // `everyone` matches, so the feature is on for every `role`. Which rule
    // wins is not settled: a staff request resolves on `staff`, and a decision
    // shipped naming `everyone` would contradict it. `resolved: true` promises
    // a decision the request path reproduces, so this entry defers.
    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['role']);
    for (const role of ['staff', 'viewer']) {
      expect(features.resolve({ role }).promo.enabled).toBe(true);
    }
    expect(features.resolve({ role: 'staff' }).promo.rule).toBe('staff');
    expect(features.resolve({ role: 'viewer' }).promo.rule).toBe('everyone');
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

  it('blames the refuted condition when it read every condition before it', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'pro-eu',
            when: [
              { field: 'plan', op: 'eq', value: 'pro' },
              { field: 'region', op: 'eq', value: 'eu' },
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

  it('blames no condition when it stepped over one it could not read', () => {
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

    // A request carrying `region: 'us'` fails this rule on `region`, and one
    // carrying `region: 'eu'` fails it on `plan`. The rule loses either way,
    // so the plan settles the feature and names the rule without naming a
    // condition a request would disagree with.
    expect(entry.decision?.rules).toEqual([{ rule: 'eu-pro', matched: false }]);
  });

  it('names nothing on a settled refusal that a request would name otherwise', () => {
    const refutes = { field: 'plan', op: 'eq', value: 'pro' } as const;
    const absent = { field: 'region', op: 'eq', value: 'eu' } as const;

    for (const when of [
      [refutes, absent],
      [absent, refutes],
    ]) {
      const features = createFeatures([
        { key: 'promo', enabled: true, rules: [{ id: 'eu-pro', when }] },
      ]);
      const planned = features.plan({ plan: 'free' }).promo;

      expect(planned.resolved).toBe(false);
      for (const region of ['eu', 'us', 'apac', '']) {
        const resolved = features.resolve({ plan: 'free', region }).promo;

        expect(planned.decision?.enabled).toBe(resolved.enabled);
        expect(planned.decision?.reason).toBe(resolved.reason);
        expect(planned.decision?.rules?.length).toBe(resolved.rules?.length);
        planned.decision?.rules?.forEach((outcome, index) => {
          const against = resolved.rules?.[index];
          expect(outcome.rule).toBe(against?.rule);
          expect(outcome.matched).toBe(against?.matched);
          // The plan names a condition only where every request names that
          // same one, so this holds for each region rather than for one.
          if (outcome.failed) expect(outcome.failed).toEqual(against?.failed);
        });
      }
    }
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

  it('blames the first refuted condition, not a later one', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'free-gold-web-eu',
            when: [
              { field: 'plan', op: 'eq', value: 'free' },
              { field: 'tier', op: 'eq', value: 'gold' },
              { field: 'channel', op: 'eq', value: 'web' },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
          },
        ],
      },
    ]);

    const entry = features.plan({
      plan: 'free',
      tier: 'silver',
      channel: 'app',
    }).promo;

    // `plan` holds, so the first condition the walk refutes is `tier`, and
    // `channel` refutes the rule as well. `region` sits behind both and the
    // walk never reads it.
    expect(entry.decision?.rules).toHaveLength(1);
    expect(entry.decision?.rules?.[0]?.failed).toEqual({
      field: 'tier',
      op: 'eq',
      value: 'gold',
    });
  });

  it('blames the condition a request blames when it read the ones ahead', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'silver-pro-eu',
            when: [
              { field: 'tier', op: 'eq', value: 'silver' },
              { field: 'plan', op: 'eq', value: 'pro' },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
          },
        ],
      },
    ]);
    const planned = features.plan({ tier: 'silver', plan: 'free' }).promo;

    expect(planned.decision?.rules?.[0]?.failed).toEqual({
      field: 'plan',
      op: 'eq',
      value: 'pro',
    });
    for (const region of ['eu', 'us', 'apac', '']) {
      const resolved = features.resolve({
        tier: 'silver',
        plan: 'free',
        region,
      }).promo;

      // The walk read `tier` and it held, so a request reads it the same way
      // and blames `plan` whatever `region` carries.
      expect(planned.decision?.rules?.[0]?.failed).toEqual(
        resolved.rules?.[0]?.failed,
      );
    }
  });

  // Two rules carrying the same conditions derive one id, which the checker
  // refuses: a decision naming that id names both rules. Declared ids keep the
  // rules apart and leave the conditions shared, which is what the walk reads.
  it('carries one breakdown entry per rule where two rules share their conditions', () => {
    const shared = [
      { field: 'region', op: 'eq', value: 'eu' },
      { field: 'plan', op: 'eq', value: 'pro' },
    ] as const;
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          { id: 'first', when: shared },
          { id: 'second', when: shared },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'free' }).promo;

    expect(entry.resolved).toBe(false);
    expect(entry.decision?.rules).toHaveLength(2);
    expect(entry.decision?.rules?.[0]?.matched).toBe(false);
    expect(entry.decision?.rules?.[1]?.matched).toBe(false);
    expect(entry.decision?.rules?.[0]?.failed).toEqual(
      entry.decision?.rules?.[1]?.failed,
    );
  });

  it('names a condition on one breakdown entry and not on the one beside it', () => {
    const features = createFeatures([
      {
        key: 'promo',
        enabled: true,
        rules: [
          {
            id: 'region-first',
            when: [
              { field: 'region', op: 'eq', value: 'eu' },
              { field: 'plan', op: 'eq', value: 'pro' },
            ],
          },
          {
            id: 'plan-first',
            when: [
              { field: 'plan', op: 'eq', value: 'pro' },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
          },
        ],
      },
    ]);

    const entry = features.plan({ plan: 'free' }).promo;

    // The walk steps over `region` on the first rule before `plan` refutes it,
    // so that outcome names nothing. The second rule fails on `plan` with
    // nothing stepped over ahead of it, so it names the condition. Whether an
    // outcome names a condition is a per-rule answer, and one rule stepping
    // over a field leaves the rule below it free to name its own.
    expect(entry.resolved).toBe(false);
    expect(entry.decision?.rules).toEqual([
      { rule: 'region-first', matched: false },
      {
        rule: 'plan-first',
        matched: false,
        failed: { field: 'plan', op: 'eq', value: 'pro' },
      },
    ]);
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
      {
        key: 'child',
        enabled: true,
        dependsOn: ['parent'],
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [
          { id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] },
        ],
      },
    ]);

    const planned = features.plan({ plan: 'free' });

    expect(planned.parent.resolved).toBe(false);
    expect(planned.child.resolved).toBe(false);
    // The off parent decides the child before its own rules run, so neither
    // `role` nor the child's bucketing field reaches this list.
    expect(planned.child.needs).toEqual([]);
    expect(planned.child.decision?.reason).toBe('dependency-off');
    expect(planned.child.decision?.cause).toEqual({
      key: 'parent',
      reason: 'no-rule-matched',
      rule: 'eu-pro',
    });
  });

  it('cascades off to a dependant whose own rules the plan cannot read', () => {
    const features = createFeatures([
      {
        key: 'parent',
        enabled: false,
      },
      {
        key: 'child',
        enabled: true,
        dependsOn: ['parent'],
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [
          { id: 'eu', when: [{ field: 'region', op: 'eq', value: 'eu' }] },
        ],
      },
    ]);

    const planned = features.plan({ plan: 'free' });

    expect(planned.child.resolved).toBe(false);
    expect(planned.child.needs).toEqual([]);
    expect(planned.child.decision?.reason).toBe('dependency-off');
    expect(planned.child.decision?.variant).toBeUndefined();
  });

  it("leaves a dependant's needs to the parent while the parent is unresolved", () => {
    const features = createFeatures([
      {
        key: 'parent',
        enabled: true,
        rules: [
          { id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] },
        ],
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

  it("adds a dependant's own bucketing field to what an unresolved parent needs", () => {
    const features = createFeatures([
      {
        key: 'parent',
        enabled: true,
        rules: [
          { id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] },
        ],
      },
      {
        key: 'child',
        enabled: true,
        dependsOn: ['parent'],
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [
          { id: 'eu', when: [{ field: 'region', op: 'eq', value: 'eu' }] },
        ],
      },
    ]);

    const planned = features.plan({ plan: 'free' });

    // `role` is the parent's, `targetingKey` the child's own split. `region`,
    // which only the child's rule reads, stays off the list while the parent
    // is unresolved.
    expect(planned.child.needs).toEqual(['role', 'targetingKey']);
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
      expect(planned.decision).toEqual(
        features.resolve({ ...known, region }).cta,
      );
    }
  });

  it('carries the rollout a plan refused onto its breakdown', () => {
    const features = createFeatures([
      {
        key: 'ramped',
        enabled: true,
        rules: [{ id: 'ramp', rollout: { percent: 0 } }],
      },
    ]);
    const context = { targetingKey: 'u1' };

    const entry = features.plan(context).ramped;

    expect(entry.resolved).toBe(false);
    expect(entry.decision?.rules).toEqual([
      {
        rule: 'ramp',
        matched: false,
        rollout: { percent: 0, by: 'targetingKey', member: false },
      },
    ]);
    expect(entry.decision).toEqual(features.resolve(context).ramped);
  });

  it('defers a dependant under an open parent, refuted rule and all', () => {
    const features = createFeatures([
      {
        key: 'banner',
        enabled: true,
        rules: [
          { id: 'staff', when: [{ field: 'role', op: 'eq', value: 'staff' }] },
        ],
      },
      {
        key: 'cta',
        enabled: true,
        dependsOn: ['banner'],
        rules: [
          {
            id: 'eu-pro',
            when: [
              { field: 'plan', op: 'eq', value: 'pro' },
              { field: 'region', op: 'eq', value: 'eu' },
            ],
          },
        ],
      },
    ]);
    const known = { plan: 'free' };

    const entry = features.plan(known).cta;

    // `banner` has not settled its own enablement, so `cta`'s rules never run
    // and its `needs` names what `banner` needs and nothing of its own. The
    // deferral costs a request-time evaluation and ships no wrong answer:
    // every request the plan left open answers off.
    expect(entry).toMatchObject({ resolved: 'deferred', needs: ['role'] });
    for (const role of ['staff', 'viewer']) {
      for (const region of ['eu', 'us']) {
        const decision = features.resolve({ ...known, role, region }).cta;

        expect(decision.enabled).toBe(false);
      }
    }
  });

  it('settles no feature a later request decides differently', () => {
    const seen: string[] = [];

    for (const [shape, definitions] of Object.entries(SHAPES)) {
      const features = createFeatures(definitions);

      for (const request of REQUESTS) {
        for (const fields of WITHHELD) {
          const known = denied(request, fields);
          const plan = features.plan(known);
          const decisions = features.resolve(request);

          for (const [key, entry] of Object.entries(plan)) {
            const decision = decisions[key];
            const at = `${shape}/${key} planned for ${JSON.stringify(known)}`;
            seen.push(at);

            expect(decision, `${at} resolved nothing`).toBeDefined();
            if (!decision) continue;

            if (entry.resolved === 'deferred') {
              expect(entry.needs, `${at} defers on nothing`).not.toEqual([]);
              for (const need of entry.needs) {
                expect(
                  need === 'now' || known[need] === undefined,
                  `${at} needs ${need}, which the plan carried`,
                ).toBe(true);
              }
              // A deferred entry carrying a decision settled enablement and
              // deferred the split alone, and that enablement is the request's.
              expect(entry.decision?.enabled ?? decision.enabled, at).toBe(
                decision.enabled,
              );
              continue;
            }

            const settled = entry.decision;

            expect(entry.resolved, at).toBe(decision.enabled);
            expect(entry.needs, at).toEqual([]);
            expect(settled, `${at} settled without a decision`).toBeDefined();
            expect(settled && withoutBlame(settled), at).toEqual(
              withoutBlame(decision),
            );
          }
        }
      }
    }

    expect(seen.length).toBe(2912);
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

describe('createFeatures over a document', () => {
  it('builds a store from a document and lifts its version', () => {
    const features = createFeatures({
      version: 41,
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(features.version).toBe(41);
  });

  it('throws the first issue of a document the way it throws an array one', () => {
    expect(() =>
      createFeatures({
        features: [
          { key: 'a', enabled: true },
          { key: 'a', enabled: true },
        ],
      }),
    ).toThrow(DuplicateFeatureError);
  });

  it('refuses a document carrying a member it cannot read', () => {
    expect(() =>
      createFeatures({
        features: [{ key: 'a', enabled: true }],
        hashVersion: 2,
      } as unknown as FeatureConfig),
    ).toThrow(/hashVersion/);
  });
});

describe('the version a document states', () => {
  it('lifts no version off a document that states none', () => {
    const features = createFeatures({
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);

    expect(features.version).toBeUndefined();
  });

  it('lifts the string a document states', () => {
    const features = createFeatures({
      version: '2026-09-29T00:00:00.000Z',
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);

    expect(features.version).toBe('2026-09-29T00:00:00.000Z');
  });

  /**
   * A version is opaque, so the two falsy values a `string | number` holds are
   * versions a publisher may serve. A member read through a `||` or a `??` with
   * a fallback answers the fallback for both, and the store then reports a
   * document it does not hold.
   */
  it('lifts the two versions no truth test reads', () => {
    const lifted = [0, ''].map(
      (version) =>
        createFeatures({
          version,
          features: [{ key: 'checkout', enabled: true }],
        } as FeatureConfig).version,
    );

    expect(lifted).toEqual([0, '']);
  });

  it('lifts a version at either end of the safe integer range', () => {
    const lifted = [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER].map(
      (version) =>
        createFeatures({
          version,
          features: [{ key: 'checkout', enabled: true }],
        } as FeatureConfig).version,
    );

    expect(lifted).toEqual([Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
  });

  it('lifts no version off a bare array', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.version).toBeUndefined();
  });

  it('keeps the document version through a local toggle', () => {
    const features = createFeatures({
      version: 41,
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);

    features.toggle('checkout', false);

    expect(features.version).toBe(41);
  });

  it('names the document it was built from as a reload previous version', () => {
    const features = createFeatures({
      version: 41,
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);

    const result = features.reload({
      version: 42,
      features: [{ key: 'checkout', enabled: false }],
    });

    expect(result).toEqual({
      ok: true,
      version: 42,
      previousVersion: 41,
      changed: ['checkout'],
    });
  });

  it('names the document that stayed when it refuses a reload', () => {
    const features = createFeatures({
      version: 41,
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);

    const result = features.reload({
      version: 42,
      features: [
        { key: 'checkout', enabled: true },
        { key: 'checkout', enabled: false },
      ],
    });

    expect(result.ok === false && [result.version, result.rejected]).toEqual([
      41, 42,
    ]);
  });

  /**
   * `FeatureOptions.version` labels an audit stream and the envelope's `version`
   * names a document, and neither one defaults from the other. An observer whose
   * stream version changed because a publisher shipped a document reports a
   * change the application never asked for.
   */
  it('labels no observation with the version the document states', () => {
    const seen: (string | undefined)[] = [];
    const features = createFeatures(
      {
        version: 'v5',
        features: [{ key: 'checkout', enabled: true }],
      } as FeatureConfig,
      {
        observe: (event) => {
          seen.push(event.version);
        },
      },
    );

    features.resolve();

    expect(seen).toEqual([undefined]);
  });
});

describe('the envelope a document installs', () => {
  it('installs every member a document carries and no payload', () => {
    const features = createFeatures({
      version: 'v9',
      schema: { context: { fields: { region: 'string' } } },
      schemaVersion: 's1',
      maxStale: 30_000,
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);

    expect(features.envelope).toEqual({
      version: 'v9',
      schema: { context: { fields: { region: 'string' } } },
      schemaVersion: 's1',
      maxStale: 30_000,
    });
  });

  it('installs an empty envelope for a bare array', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.envelope).toEqual({});
  });

  it('installs an advisory duration at either end of the range', () => {
    const installed = [0, Number.MAX_SAFE_INTEGER].map(
      (maxStale) =>
        createFeatures({
          maxStale,
          features: [{ key: 'checkout', enabled: true }],
        } as FeatureConfig).envelope.maxStale,
    );

    expect(installed).toEqual([0, Number.MAX_SAFE_INTEGER]);
  });

  it('decides the same answer at either end of the advisory range', () => {
    const answers = [0, Number.MAX_SAFE_INTEGER].map((maxStale) =>
      createFeatures({
        maxStale,
        features: [{ key: 'checkout', enabled: true }],
      } as FeatureConfig).isEnabled('checkout'),
    );

    expect(answers).toEqual([true, true]);
  });

  /**
   * The store decides on a copy of the definitions a document carried, and the
   * envelope is the other half of that document. A poller holds the buffer it
   * parsed and polls again onto it, and a shallow copy leaves `schema` the
   * poller's own object.
   */
  it('reports the envelope the document carried and not the one the caller holds', () => {
    const document = {
      version: 1,
      schemaVersion: 's1',
      schema: { context: { fields: { region: 'string' } } },
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig;

    const features = createFeatures(document);
    (
      document.schema as { context: { fields: Record<string, string> } }
    ).context.fields['region'] = 'number';

    expect([
      features.envelope.schema,
      serializeConfig(features).schema,
    ]).toEqual([
      { context: { fields: { region: 'string' } } },
      { context: { fields: { region: 'string' } } },
    ]);
  });

  it('hands out an envelope no holder writes through', () => {
    const features = createFeatures({
      version: 1,
      schema: { context: { fields: { region: 'string' } } },
      schemaVersion: 's1',
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);

    const written = () => {
      (features.envelope as { version?: unknown }).version = 1234;
    };

    expect(written).toThrow(TypeError);
    expect(features.version).toBe(1);
  });

  /**
   * The bare array half of the pair above. A store built from a literal
   * installs an envelope of its own, `envelope` hands it out by reference, and
   * a write through the getter would carry a `version` into a document no
   * publisher served and `serializeConfig` would emit it.
   */
  it('hands out the envelope of a bare array no holder writes through', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    const written = () => {
      (features.envelope as { version?: unknown }).version = 1234;
    };

    expect(written).toThrow(TypeError);
    expect([features.version, 'version' in serializeConfig(features)]).toEqual([
      undefined,
      false,
    ]);
  });

  it('freezes the nested members of the envelope it installs', () => {
    const features = createFeatures({
      version: 1,
      schemaVersion: 's1',
      schema: { context: { fields: { region: 'string' } } },
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);

    const written = () => {
      (
        features.envelope.schema as {
          context: { fields: Record<string, string> };
        }
      ).context.fields['region'] = 'number';
    };

    expect(written).toThrow(TypeError);
  });

  /**
   * `configDigest` is the one writer of `digest`, which `ConfigEnvelope` fences
   * to `never` and `reload` deletes off a candidate it installs. A store that
   * kept the member hands `serializeConfig` a digest covering the bytes the
   * publisher served, and the next holder refuses the document.
   */
  it('installs no digest the way a reload installs none', () => {
    const content = {
      version: 7,
      features: [{ key: 'checkout', enabled: true }],
    } satisfies FeatureConfig;

    const features = createFeatures({
      ...content,
      digest: configDigest(content),
    } as FeatureConfig);

    expect('digest' in features.envelope).toBe(false);
  });

  it('serializes a document every holder verifies after a toggle', () => {
    const content = {
      version: 7,
      features: [{ key: 'checkout', enabled: true }],
    } satisfies FeatureConfig;
    const features = createFeatures({
      ...content,
      digest: configDigest(content),
    } as FeatureConfig);

    features.toggle('checkout', false);

    expect(validateConfig(serializeConfig(features))).toEqual({ ok: true });
  });
});

describe('the definitions a document carries', () => {
  it('builds a store with no keys from a document carrying no features', () => {
    const features = createFeatures({
      version: 3,
      features: [],
    } as FeatureConfig);

    expect([features.keys, features.resolve(), features.version]).toEqual([
      [],
      {},
      3,
    ]);
  });

  it('builds a store from the one definition a document carries', () => {
    const features = createFeatures({
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);

    expect([features.keys, features.isEnabled('checkout')]).toEqual([
      ['checkout'],
      true,
    ]);
  });

  it('holds the intent a bare array of the same definitions holds', () => {
    const rows = [
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ];

    const document = createFeatures({ version: 1, features: rows });
    const array = createFeatures(rows);

    expect(document.config).toEqual(array.config);
  });

  it('decides what a bare array of the same definitions decides', () => {
    const rows = [
      { key: 'checkout', enabled: false },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
      {
        key: 'cta',
        enabled: true,
        variantBy: 'targetingKey',
        variantSeed: 'cta',
        variants: [
          { name: 'control', weight: 50, order: 1 },
          { name: 'blue', weight: 50, order: 2 },
        ],
      },
    ];
    const context = { targetingKey: 'u-1' };

    const document = createFeatures({ version: 1, features: rows });
    const array = createFeatures(rows);

    expect([
      document.isEnabled('express', context),
      document.variantOf('cta', context),
    ]).toEqual([
      array.isEnabled('express', context),
      array.variantOf('cta', context),
    ]);
  });

  it('decides on a copy of the definition the document carried', () => {
    const row = { key: 'checkout', enabled: true };
    const document: FeatureConfig = { features: [row] };

    const features = createFeatures(document);
    row.enabled = false;

    expect([features.isEnabled('checkout'), row.enabled]).toEqual([
      true,
      false,
    ]);
  });

  it('keys on the array it built and not on the one the document carried', () => {
    const rows = [{ key: 'checkout', enabled: true }];
    const document: FeatureConfig = { features: rows };

    const features = createFeatures(document);
    rows.push({ key: 'express', enabled: true });

    expect(features.keys).toEqual(['checkout']);
  });
});

describe('the documents createFeatures refuses', () => {
  it('throws the variant a document declares twice', () => {
    expect(() =>
      createFeatures({
        features: [
          {
            key: 'cta',
            enabled: true,
            variants: [
              { name: 'blue', weight: 50 },
              { name: 'blue', weight: 50 },
            ],
          },
        ],
      } as FeatureConfig),
    ).toThrow(DuplicateVariantError);
  });

  it('throws the dependency a document names and does not carry', () => {
    expect(() =>
      createFeatures({
        features: [{ key: 'express', enabled: true, dependsOn: ['checkout'] }],
      } as FeatureConfig),
    ).toThrow(UnknownDependencyError);
  });

  it('throws the cycle two definitions of a document describe', () => {
    expect(() =>
      createFeatures({
        features: [
          { key: 'a', enabled: true, dependsOn: ['b'] },
          { key: 'b', enabled: true, dependsOn: ['a'] },
        ],
      } as FeatureConfig),
    ).toThrow(FeatureCycleError);
  });

  it('throws the variant a rule of a document pins and no variant declares', () => {
    expect(() =>
      createFeatures({
        features: [
          {
            key: 'cta',
            enabled: true,
            variantBy: 'targetingKey',
            variantSeed: 'cta',
            variants: [{ name: 'blue', weight: 1, order: 1 }],
            rules: [{ variant: 'green' }],
          },
        ],
      } as FeatureConfig),
    ).toThrow(UnknownVariantError);
  });

  it('refuses a member a document states as undefined', () => {
    expect(() =>
      createFeatures({
        features: [{ key: 'checkout', enabled: true }],
        notes: undefined,
      } as unknown as FeatureConfig),
    ).toThrow(/"notes"/);
  });

  it('accepts a document carrying all six members', () => {
    const content = {
      version: 1,
      schema: { context: { fields: { region: 'string' } } },
      schemaVersion: 's1',
      maxStale: 30_000,
      features: [{ key: 'checkout', enabled: true }],
    } satisfies FeatureConfig;

    const features = createFeatures({
      ...content,
      digest: configDigest(content),
    } as FeatureConfig);

    expect(features.keys).toEqual(['checkout']);
  });

  it('refuses the digest a document states of other bytes', () => {
    expect(() =>
      createFeatures({
        version: 7,
        digest: '0'.repeat(32),
        features: [{ key: 'checkout', enabled: true }],
      } as FeatureConfig),
    ).toThrow(FeatureConfigError);
  });

  it('accepts the digest a document states of itself', () => {
    const content = {
      version: 7,
      features: [{ key: 'checkout', enabled: true }],
    } satisfies FeatureConfig;

    const features = createFeatures({
      ...content,
      digest: configDigest(content),
    } as FeatureConfig);

    expect(features.keys).toEqual(['checkout']);
  });

  it('refuses an inline schema a document states no version of', () => {
    expect(() =>
      createFeatures({
        schema: { context: { fields: { region: 'string' } } },
        features: [{ key: 'checkout', enabled: true }],
      } as FeatureConfig),
    ).toThrow(/schemaVersion/);
  });

  it('accepts a schema version a document states no inline schema with', () => {
    const features = createFeatures({
      schemaVersion: 's1',
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);

    expect(features.envelope.schemaVersion).toBe('s1');
  });

  /**
   * § 3 of `docs/specs/2026-09-23-feature-config-distribution.md` has every
   * member the assignment reads travel whole or the document be refused, and
   * `arrayIsOrder` exempts the literal an author wrote. A document that took
   * that exemption would bucket on an array order a store may permute, on
   * `DEFAULT_ROLLOUT_FIELD` and on the seed `variantSeedOf` composes, while the
   * publisher bucketed on what it wrote and nothing reported the difference.
   */
  it('refuses the three bucketing members a document omits', () => {
    const omitted = [
      {
        key: 'cta',
        enabled: true,
        variantBy: 'targetingKey',
        variantSeed: 'cta',
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
      {
        key: 'cta',
        enabled: true,
        variantSeed: 'cta',
        variants: [{ name: 'control', weight: 50, order: 1 }],
      },
      {
        key: 'cta',
        enabled: true,
        variantBy: 'targetingKey',
        variants: [{ name: 'control', weight: 50, order: 1 }],
      },
    ];

    for (const definition of omitted) {
      expect(() =>
        createFeatures({
          version: 1,
          features: [definition],
        } as unknown as FeatureConfig),
      ).toThrow(FeatureConfigError);
    }
  });

  it('accepts off a bare array the bucketing members it refuses off a document', () => {
    const rows = [
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ];

    expect(createFeatures(rows).variantOf('cta', { targetingKey: 'u-1' })).toBe(
      createFeatures(rows).variantOf('cta', { targetingKey: 'u-1' }),
    );
    expect(() =>
      createFeatures({ version: 1, features: rows } as FeatureConfig),
    ).toThrow(/order/);
  });

  it('refuses a document whose window names no instant', () => {
    expect(() =>
      createFeatures({
        version: 1,
        features: [
          {
            key: 'checkout',
            enabled: true,
            rules: [{ when: [{ field: 'now', op: 'after', value: 'nope' }] }],
          },
        ],
      } as unknown as FeatureConfig),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a document whose rule reads a field the schema does not declare', () => {
    expect(() =>
      createFeatures({
        schemaVersion: 's1',
        schema: { context: { fields: { plan: 'string' } } },
        features: [
          {
            key: 'beta',
            enabled: true,
            rules: [{ when: [{ field: 'tier', op: 'eq', value: 'pro' }] }],
          },
        ],
      } as unknown as FeatureConfig),
    ).toThrow(/tier/);
  });

  it('refuses a bucketing member a document states on a definition', () => {
    expect(() =>
      createFeatures({
        version: 1,
        features: [{ key: 'a', enabled: true, hashVersion: 2 }],
      } as unknown as FeatureConfig),
    ).toThrow(/hashVersion/);
  });

  /**
   * A document is untrusted JSON, and `errors.ts` has every refusal out of this
   * function be a `FeatureConfigError` a caller catches to keep the document it
   * already holds. A walk over `features` that ran before the checker raised
   * `TypeError` for each of these, which that caller never catches.
   */
  it('throws a typed error for every features member it cannot walk', () => {
    const unwalkable = [
      { version: 1 },
      { version: 1, features: {} },
      { version: 1, features: 'nope' },
      { version: 1, features: null },
      null,
    ];

    const thrown = unwalkable.map((document) => {
      try {
        createFeatures(document as unknown as FeatureConfig);
        return 'nothing';
      } catch (raise) {
        return raise instanceof FeatureConfigError ? 'typed' : String(raise);
      }
    });

    expect(thrown).toEqual(['typed', 'typed', 'typed', 'typed', 'typed']);
  });

  it('names the features member of a document that declares none', () => {
    expect(() =>
      createFeatures({ version: 1 } as unknown as FeatureConfig),
    ).toThrow(/"features"/);
  });

  /**
   * The envelope copy is the other walk into values the checker declares
   * nothing about. `memberIssues` names the six top-level members and
   * `schemaIssues` fences schema keywords, so `validateConfig` answers `ok` for
   * both of these documents and the copy inside `createFeatures` is where the
   * function meets the leaf. `reload` reports the same text as an
   * `unknown-member` issue, so the two paths say the same thing about the same
   * value.
   */
  it('throws a typed error for an envelope member it cannot copy', () => {
    const fenced = {
      schemaVersion: 's1',
      schema: {
        features: { cta: { variants: { blue: { type: () => 'string' } } } },
      },
      features: [{ key: 'cta', enabled: true }],
    } as unknown as FeatureConfig;

    expect(validateConfig(fenced)).toEqual({ ok: true });
    expect(() => createFeatures(fenced)).toThrow(FeatureConfigError);
    expect(() => createFeatures(fenced)).toThrow(/could not be cloned/);
  });

  it('throws a typed error for a symbol a document carries at maxStale', () => {
    const symbolic = {
      version: 1,
      maxStale: Symbol('stale'),
      features: [{ key: 'cta', enabled: true }],
    } as unknown as FeatureConfig;

    expect(validateConfig(symbolic)).toEqual({ ok: true });
    expect(() => createFeatures(symbolic)).toThrow(FeatureConfigError);
  });

  it('reports the message it throws when reload meets the same document', () => {
    const fenced = {
      schemaVersion: 's1',
      schema: {
        features: { cta: { variants: { blue: { type: () => 'string' } } } },
      },
      features: [{ key: 'cta', enabled: true }],
    } as unknown as FeatureConfig;
    const store = createFeatures({
      schemaVersion: 's1',
      features: [{ key: 'cta', enabled: true }],
    } as unknown as FeatureConfig);
    const thrown = (() => {
      try {
        createFeatures(fenced);
        return 'nothing';
      } catch (raise) {
        return raise instanceof Error ? raise.message : String(raise);
      }
    })();

    expect(store.reload(fenced)).toEqual({
      ok: false,
      issues: [{ code: 'unknown-member', message: thrown }],
    });
  });

  it('leaves the document it refused exactly as it was handed it', () => {
    const document = {
      version: 9,
      features: [{ key: 'checkout', enabled: true }],
      hashVersion: 2,
    } as unknown as FeatureConfig;
    const before = structuredClone(document);

    expect(() => createFeatures(document)).toThrow(FeatureConfigError);
    expect(document).toEqual(before);
  });
});
