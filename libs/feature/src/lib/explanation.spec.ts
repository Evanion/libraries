import { describe, expect, it } from 'vitest';

import { createFeatures } from './features.js';
import type { FeatureDefinition } from './types.js';

/**
 * What a decision's explanation members report, and what a toggle answers.
 *
 * `features.spec.ts` holds the precedence rules and the cascade. This file
 * holds the claims the API reference makes about `Reason`, `Cause`,
 * `ToggleResult` and `PlanEntry` themselves: which member each reason writes,
 * when `Cause` names a rule and when it names none, the order `willDisable`
 * lists its dependants in, and the sort `needs` carries.
 *
 * Every instant is written out. A fixture reading the host clock resolves a
 * window one way on the machine that wrote it and the other way six weeks
 * later.
 */

/** The store the five reasons are read off, one feature per reason. */
const SHOP = (): [FeatureDefinition<Key>, ...FeatureDefinition<Key>[]] => [
  { key: 'new-checkout', enabled: true },
  {
    key: 'express-pickup',
    enabled: true,
    rules: [{ id: 'eu', when: [{ field: 'region', op: 'eq', value: 'eu' }] }],
  },
  { key: 'demo-night-booking', enabled: false },
  {
    key: 'gift-wrap',
    enabled: true,
    rules: [
      { id: 'staff', when: [{ field: 'group', op: 'eq', value: 'staff' }] },
    ],
  },
  { key: 'wrap-preview', enabled: true, dependsOn: ['demo-night-booking'] },
];

type Key =
  | 'new-checkout'
  | 'express-pickup'
  | 'demo-night-booking'
  | 'gift-wrap'
  | 'wrap-preview';

/** The store `willDisable` is read off, declared child first. */
const chainDeclaredChildFirst = () =>
  createFeatures([
    {
      key: 'demo-night-booking',
      enabled: true,
      dependsOn: ['express-pickup'],
    },
    { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
    { key: 'new-checkout', enabled: true },
  ] as const);

describe('Reason', () => {
  it('writes default-on for a feature that is enabled and declares no rules', () => {
    const features = createFeatures(SHOP());

    const decision = features.resolve({ region: 'eu', group: 'staff' })[
      'new-checkout'
    ];

    expect(decision).toEqual({
      key: 'new-checkout',
      enabled: true,
      reason: 'default-on',
    });
  });

  it('writes rule-match and names the matching rule', () => {
    const features = createFeatures(SHOP());

    const decision = features.resolve({ region: 'eu', group: 'customer' })[
      'express-pickup'
    ];

    expect(decision).toEqual({
      key: 'express-pickup',
      enabled: true,
      reason: 'rule-match',
      rule: 'eu',
    });
  });

  it('writes explicitly-off for a definition whose enabled is false', () => {
    const features = createFeatures(SHOP());

    const decision = features.resolve({ region: 'eu', group: 'staff' })[
      'demo-night-booking'
    ];

    expect(decision).toEqual({
      key: 'demo-night-booking',
      enabled: false,
      reason: 'explicitly-off',
    });
  });

  it('writes no-rule-matched and carries the per-rule breakdown', () => {
    const features = createFeatures(SHOP());

    const decision = features.resolve({ region: 'eu', group: 'customer' })[
      'gift-wrap'
    ];

    expect(decision).toEqual({
      key: 'gift-wrap',
      enabled: false,
      reason: 'no-rule-matched',
      rules: [
        {
          rule: 'staff',
          matched: false,
          failed: { field: 'group', op: 'eq', value: 'staff' },
        },
      ],
    });
  });

  it('writes dependency-off and carries the blocking edge and the root cause', () => {
    const features = createFeatures(SHOP());

    const decision = features.resolve({ region: 'eu', group: 'staff' })[
      'wrap-preview'
    ];

    expect(decision).toEqual({
      key: 'wrap-preview',
      enabled: false,
      reason: 'dependency-off',
      blockedBy: 'demo-night-booking',
      cause: { key: 'demo-night-booking', reason: 'explicitly-off' },
    });
  });

  it('writes default-on for a definition carrying an empty rules array', () => {
    // Legal for `FeatureDefinition` and a different thing from a definition
    // whose one rule nothing matched. A reader who saw `no-rule-matched` here
    // would go looking for the rule that failed.
    const features = createFeatures([
      { key: 'new-checkout', enabled: true, rules: [] },
    ] as const);

    const decision = features.resolve()['new-checkout'];

    expect(decision).toEqual({
      key: 'new-checkout',
      enabled: true,
      reason: 'default-on',
    });
  });

  it('writes explicitly-off over dependency-off for a feature that is both', () => {
    // `enabled: false` short-circuits ahead of the cascade, so the decision
    // carries no `blockedBy` and no `cause` although a parent is off too.
    const features = createFeatures([
      { key: 'new-checkout', enabled: false },
      {
        key: 'express-pickup',
        enabled: false,
        dependsOn: ['new-checkout'],
      },
    ] as const);

    const decision = features.resolve()['express-pickup'];

    expect(decision).toEqual({
      key: 'express-pickup',
      enabled: false,
      reason: 'explicitly-off',
    });
  });
});

describe('Cause', () => {
  it('names the rule when the ancestor had exactly one and it failed', () => {
    const features = createFeatures([
      {
        key: 'new-checkout',
        enabled: true,
        rules: [
          { id: 'eu', when: [{ field: 'region', op: 'eq', value: 'eu' }] },
        ],
      },
      { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
    ] as const);

    const decision = features.resolve({ region: 'us' })['express-pickup'];

    expect(decision.cause).toEqual({
      key: 'new-checkout',
      reason: 'no-rule-matched',
      rule: 'eu',
    });
  });

  it('names no rule when the ancestor had several and none matched', () => {
    // There is no one rule to blame, and the breakdown an operator needs sits
    // on the ancestor's own decision under `rules`.
    const features = createFeatures([
      {
        key: 'new-checkout',
        enabled: true,
        rules: [
          { id: 'eu', when: [{ field: 'region', op: 'eq', value: 'eu' }] },
          {
            id: 'staff',
            when: [{ field: 'group', op: 'eq', value: 'staff' }],
          },
        ],
      },
      { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
    ] as const);

    const decisions = features.resolve({ region: 'us', group: 'customer' });
    const cause = decisions['express-pickup'].cause;

    expect(Object.keys(cause ?? {}).sort()).toEqual(['key', 'reason']);
    expect(cause).toEqual({
      key: 'new-checkout',
      reason: 'no-rule-matched',
    });
    expect(decisions['new-checkout'].rules).toHaveLength(2);
  });

  it('walks past an ancestor that is off for a dependency of its own', () => {
    const features = createFeatures([
      { key: 'new-checkout', enabled: false },
      { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
      {
        key: 'demo-night-booking',
        enabled: true,
        dependsOn: ['express-pickup'],
      },
    ] as const);

    const decision = features.resolve()['demo-night-booking'];

    expect(decision.blockedBy).toBe('express-pickup');
    expect(decision.cause).toEqual({
      key: 'new-checkout',
      reason: 'explicitly-off',
    });
  });

  it('names the first parent the declaration lists when two are off', () => {
    // `blockingParent` walks `dependsOn` in order and stops, so the edge a
    // graph view draws is the declared one and not whichever resolved first.
    const features = createFeatures([
      { key: 'new-checkout', enabled: false },
      { key: 'gift-wrap', enabled: false },
      {
        key: 'express-pickup',
        enabled: true,
        dependsOn: ['gift-wrap', 'new-checkout'],
      },
    ] as const);

    const decision = features.resolve()['express-pickup'];

    expect(decision.blockedBy).toBe('gift-wrap');
    expect(decision.cause).toEqual({
      key: 'gift-wrap',
      reason: 'explicitly-off',
    });
  });

  it('carries no cause on a feature every parent resolved on for', () => {
    const features = createFeatures([
      { key: 'new-checkout', enabled: true },
      { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
    ] as const);

    const decision = features.resolve()['express-pickup'];

    expect(decision.cause).toBeUndefined();
    expect(decision.blockedBy).toBeUndefined();
  });
});

describe('Decision', () => {
  /** One split, read three ways by the three cases below. */
  const split = () =>
    createFeatures([
      {
        key: 'checkout-cta',
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
          { id: 'everyone', when: [] },
        ],
      },
    ] as const);

  it('records the bucket on a weighted assignment and names no rule', () => {
    const features = split();

    const decision = features.resolve({
      targetingKey: 'cust-0042',
      group: 'customer',
    })['checkout-cta'];

    expect(decision.assignment?.source).toBe('weighted');
    expect(decision.assignment?.by).toBe('targetingKey');
    expect(typeof decision.assignment?.bucket).toBe('number');
    expect(Object.keys(decision.assignment ?? {}).sort()).toEqual([
      'bucket',
      'by',
      'source',
    ]);
  });

  it('records the pinning rule on a pinned assignment and no bucket', () => {
    // The bucket decided nothing here, so reporting one would read as the
    // reason the subject got this variant.
    const features = split();

    const decision = features.resolve({
      targetingKey: 'cust-0042',
      group: 'staff',
    })['checkout-cta'];

    expect(decision.variant).toBe('blue');
    expect(Object.keys(decision.assignment ?? {}).sort()).toEqual([
      'by',
      'rule',
      'source',
    ]);
    expect(decision.assignment?.rule).toBe('staff');
  });

  it('records no bucket on a fallback assignment', () => {
    // No bucketing value reached the call, so the subject took the control as
    // a placeholder and there is no bucket to name.
    const features = split();

    const decision = features.resolve({ group: 'customer' })['checkout-cta'];

    expect(decision.assignment?.source).toBe('fallback');
    expect(Object.keys(decision.assignment ?? {}).sort()).toEqual([
      'by',
      'source',
    ]);
  });
});

describe('ToggleResult', () => {
  it('lists the dependants in dependency order for definitions declared child first', () => {
    // The declaration order here is the reverse of the dependency order, so a
    // list taken off the array rather than off the graph walk would answer
    // `['demo-night-booking', 'express-pickup']`.
    const features = chainDeclaredChildFirst();

    const result = features.toggle('new-checkout', false);

    expect(result).toEqual({
      ok: true,
      key: 'new-checkout',
      enabled: false,
      willDisable: ['express-pickup', 'demo-night-booking'],
    });
  });

  it('applies the write before it answers', () => {
    const features = chainDeclaredChildFirst();

    const result = features.toggle('new-checkout', false);

    expect(result.ok).toBe(true);
    expect(features.isEnabled('new-checkout')).toBe(false);
    expect(features.isEnabled('demo-night-booking')).toBe(false);
  });

  it('lists nothing for a toggle that disables a feature already off', () => {
    // Legal for the type and a no-op for the store. Every dependant is off
    // under both documents, so none of them resolves off because of this
    // write, and an operator reading the preview is told nothing changes.
    const features = createFeatures([
      { key: 'new-checkout', enabled: false },
      { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
    ] as const);

    const result = features.toggle('new-checkout', false);

    expect(result).toEqual({
      ok: true,
      key: 'new-checkout',
      enabled: false,
      willDisable: [],
    });
  });

  it('lists nothing for a toggle on a feature nothing depends on', () => {
    const features = createFeatures([
      { key: 'new-checkout', enabled: true },
      { key: 'gift-wrap', enabled: true },
    ] as const);

    const result = features.toggle('gift-wrap', false);

    expect(result).toEqual({
      ok: true,
      key: 'gift-wrap',
      enabled: false,
      willDisable: [],
    });
  });

  it('names a dependant held on by a second parent in neither direction', () => {
    // `express-pickup` depends on both, and `gift-wrap` stays on, so the write
    // on `new-checkout` still takes it off. The list is the diff of two
    // resolutions and not the set of edges below the key.
    const features = createFeatures([
      { key: 'new-checkout', enabled: true },
      { key: 'gift-wrap', enabled: true },
      {
        key: 'express-pickup',
        enabled: true,
        dependsOn: ['new-checkout', 'gift-wrap'],
      },
    ] as const);

    const result = features.toggle('new-checkout', false);

    expect(result).toMatchObject({ willDisable: ['express-pickup'] });
  });

  it('writes nothing for a key the store does not hold', () => {
    const features = createFeatures([
      { key: 'new-checkout', enabled: true },
      { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
    ] as const);
    const held = features.config;

    const result = features.toggle('gift-wrap' as 'new-checkout', false);

    expect(result).toEqual({
      ok: false,
      key: 'gift-wrap',
      error: 'unknown-feature',
    });
    expect(features.config).toBe(held);
    expect(features.keys).toEqual(['new-checkout', 'express-pickup']);
    expect(features.isEnabled('new-checkout')).toBe(true);
    expect(features.isEnabled('express-pickup')).toBe(true);
  });

  it('writes nothing for a key naming a member of Object.prototype', () => {
    // `'constructor'` is a string and legal for the parameter, and the store
    // holds no feature by that name. A bare index on the position map would
    // walk the prototype chain and answer a function.
    const features = createFeatures([
      { key: 'new-checkout', enabled: true },
    ] as const);
    const held = features.config;

    const result = features.toggle('constructor' as 'new-checkout', false);

    expect(result).toEqual({
      ok: false,
      key: 'constructor',
      error: 'unknown-feature',
    });
    expect(features.config).toBe(held);
  });
});

describe('PlanEntry', () => {
  it('sorts the fields it still needs rather than listing them as it met them', () => {
    // The rule contributes `zone` and the split contributes `accountId`, in
    // that order, so an unsorted list answers `['zone', 'accountId']`.
    const features = createFeatures([
      {
        key: 'checkout-cta',
        enabled: true,
        variantBy: 'accountId',
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [
          { id: 'zone', when: [{ field: 'zone', op: 'eq', value: 'eu' }] },
        ],
      },
    ] as const);

    const entry = features.plan({})['checkout-cta'];

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['accountId', 'zone']);
    expect(entry.decision).toBeUndefined();
  });

  it('names each field once for a rule and a split that need the same one', () => {
    const features = createFeatures([
      {
        key: 'checkout-cta',
        enabled: true,
        variantBy: 'accountId',
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
        rules: [
          {
            id: 'account',
            when: [{ field: 'accountId', op: 'ne', value: 'anon' }],
          },
        ],
      },
    ] as const);

    const entry = features.plan({})['checkout-cta'];

    expect(entry.needs).toEqual(['accountId']);
  });

  it('carries a decision on every entry whose resolution is a boolean', () => {
    const features = createFeatures(SHOP());

    const plan = features.plan({ region: 'eu', group: 'customer' });
    const settled = Object.values(plan).filter(
      (entry) => entry.resolved !== 'deferred',
    );

    expect(settled).toHaveLength(5);
    expect(settled.every((entry) => entry.decision !== undefined)).toBe(true);
    expect(settled.every((entry) => entry.needs.length === 0)).toBe(true);
  });

  it('carries a decision on a deferred entry whose enablement alone is settled', () => {
    // So a caller cannot read the presence of a decision as proof that
    // `resolved` is a boolean. The split is outstanding and the enablement is
    // not, and the decision this entry carries names no variant.
    const features = createFeatures([
      {
        key: 'checkout-cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ] as const);

    const entry = features.plan({})['checkout-cta'];

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toEqual(['targetingKey']);
    expect(entry.decision).toEqual({
      key: 'checkout-cta',
      enabled: true,
      reason: 'default-on',
    });
  });
});
