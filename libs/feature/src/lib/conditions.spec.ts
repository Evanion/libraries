import { describe, expect, it } from 'vitest';
import {
  conditionFields,
  evaluateCondition,
  validateConditions,
} from './conditions.js';
import { FeatureConfigError } from './errors.js';
import type { Condition, FeatureDefinition, Instant } from './types.js';

const at = (iso: string) => ({ now: new Date(iso) });

/**
 * Runs `read` with the process reporting `zone` as its timezone.
 *
 * Node reads `process.env.TZ` on every `Date` construction, so a case can ask
 * what a host in Los Angeles would answer without running a second process.
 */
function inZone<T>(zone: string, read: () => T): T {
  const original = process.env.TZ;
  process.env.TZ = zone;
  try {
    return read();
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
}

/** The answer in three zones spread far enough apart to cross a day boundary. */
const everywhere = <T>(read: () => T): T[] =>
  ['UTC', 'Asia/Tokyo', 'America/Los_Angeles'].map((zone) =>
    inZone(zone, read),
  );

describe('evaluateCondition', () => {
  describe('window', () => {
    const before: Condition = {
      field: 'now',
      op: 'before',
      value: '2026-10-01T00:00:00Z',
    };

    it('holds strictly before the instant', () => {
      expect(evaluateCondition(before, at('2026-09-30T23:59:59Z'))).toBe(true);
      expect(evaluateCondition(before, at('2026-10-01T00:00:00Z'))).toBe(false);
      expect(evaluateCondition(before, at('2026-10-02T00:00:00Z'))).toBe(false);
    });

    it('holds strictly after the instant', () => {
      const after: Condition = {
        field: 'now',
        op: 'after',
        value: '2026-10-01T00:00:00Z',
      };

      expect(evaluateCondition(after, at('2026-10-01T00:00:01Z'))).toBe(true);
      expect(evaluateCondition(after, at('2026-10-01T00:00:00Z'))).toBe(false);
    });

    it('accepts epoch milliseconds and a Date', () => {
      const value = Date.UTC(2026, 9, 1);

      expect(
        evaluateCondition(
          { field: 'now', op: 'before', value },
          at('2026-09-30T00:00:00Z'),
        ),
      ).toBe(true);
      expect(
        evaluateCondition(
          { field: 'now', op: 'before', value: new Date(value) },
          at('2026-09-30T00:00:00Z'),
        ),
      ).toBe(true);
    });

    it('answers an offsetless instant string the same in every zone', () => {
      // ECMA-262 reads a date-time string with no offset as local time, so
      // `Date.parse` puts this boundary an hour before `now` in Tokyo and
      // eight hours after it in Los Angeles. The condition names no instant,
      // and an answer that follows the host is one rule id with three answers.
      const condition: Condition = {
        field: 'now',
        op: 'after',
        value: '2026-01-01T00:00:00',
      };
      const now = at('2026-01-01T02:00:00Z');

      const answers = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles'].map((zone) =>
        inZone(zone, () => evaluateCondition(condition, now)),
      );

      expect(answers).toEqual([false, false, false]);
    });

    it('answers an instant string carrying Z the same in every zone', () => {
      // The counterpart of the case above. `now` sits after the boundary, so a
      // reading that answered false for every window would pass that case and
      // fail this one.
      const condition: Condition = {
        field: 'now',
        op: 'after',
        value: '2026-01-01T00:00:00Z',
      };
      const now = at('2026-01-01T02:00:00Z');

      expect(everywhere(() => evaluateCondition(condition, now))).toEqual([
        true,
        true,
        true,
      ]);
    });

    it('answers a date with no time the same in every zone', () => {
      // ECMA-262 fixes a date-only string to UTC. Read as local time it would
      // sit 8 hours after `now` in Los Angeles and an hour before it in Tokyo.
      const condition: Condition = {
        field: 'now',
        op: 'after',
        value: '2026-01-01',
      };
      const now = at('2026-01-01T02:00:00Z');

      expect(everywhere(() => evaluateCondition(condition, now))).toEqual([
        true,
        true,
        true,
      ]);
    });

    it('holds neither side at the instant itself', () => {
      const value = '2026-10-01T00:00:00Z';
      const now = at('2026-10-01T00:00:00Z');

      expect(
        evaluateCondition({ field: 'now', op: 'before', value }, now),
      ).toBe(false);
      expect(evaluateCondition({ field: 'now', op: 'after', value }, now)).toBe(
        false,
      );
    });

    it('does not hold when the boundary is a Date or a number naming no instant', () => {
      const now = at('2026-10-01T00:00:00Z');
      const unusable: readonly Instant[] = [new Date('nonsense'), Number.NaN];

      for (const value of unusable) {
        expect(
          evaluateCondition({ field: 'now', op: 'after', value }, now),
        ).toBe(false);
        expect(
          evaluateCondition({ field: 'now', op: 'before', value }, now),
        ).toBe(false);
      }
    });

    it('puts every instant inside a window bounded by infinity', () => {
      // `validateConditions` reads the string forms only, so a number naming no
      // moment is built into a store and answers here.
      const now = at('2026-10-01T00:00:00Z');
      const value = Number.POSITIVE_INFINITY;

      expect(
        evaluateCondition({ field: 'now', op: 'before', value }, now),
      ).toBe(true);
      expect(evaluateCondition({ field: 'now', op: 'after', value }, now)).toBe(
        false,
      );
    });

    it('does not hold when the context carries no usable now', () => {
      const condition: Condition = {
        field: 'now',
        op: 'after',
        value: '2026-01-01T00:00:00Z',
      };

      expect(evaluateCondition(condition, {})).toBe(false);
      expect(evaluateCondition(condition, { now: new Date('nonsense') })).toBe(
        false,
      );
    });

    it('does not hold when the instant cannot be parsed', () => {
      expect(
        evaluateCondition(
          { field: 'now', op: 'before', value: 'not-a-date' },
          at('2026-09-30T00:00:00Z'),
        ),
      ).toBe(false);
    });
  });

  describe('day-of-week', () => {
    // 2026-10-01T03:00Z is Thursday in UTC and still Wednesday in New York.
    // UTC day-of-week is wrong for every business rule anyone writes, which is
    // why the zone is required rather than defaulted.
    const instant = at('2026-10-01T03:00:00Z');

    it('reads the weekday in the zone the condition names', () => {
      const condition = (zone: string): Condition => ({
        field: 'now',
        op: 'day-of-week',
        zone,
        value: ['wed'],
      });

      expect(evaluateCondition(condition('America/New_York'), instant)).toBe(
        true,
      );
      expect(evaluateCondition(condition('UTC'), instant)).toBe(false);
      expect(evaluateCondition(condition('Europe/Stockholm'), instant)).toBe(
        false,
      );
    });

    it('matches any of the listed days', () => {
      expect(
        evaluateCondition(
          {
            field: 'now',
            op: 'day-of-week',
            zone: 'UTC',
            value: ['mon', 'thu'],
          },
          instant,
        ),
      ).toBe(true);
    });
  });

  describe('attributes', () => {
    const context = { plan: 'pro', regions: ['eu', 'us'], seats: 10 };

    it('compares with eq and ne', () => {
      expect(
        evaluateCondition({ field: 'plan', op: 'eq', value: 'pro' }, context),
      ).toBe(true);
      expect(
        evaluateCondition({ field: 'plan', op: 'ne', value: 'pro' }, context),
      ).toBe(false);
    });

    it('compares with in and not-in', () => {
      expect(
        evaluateCondition(
          { field: 'plan', op: 'in', value: ['pro', 'team'] },
          context,
        ),
      ).toBe(true);
      expect(
        evaluateCondition(
          { field: 'plan', op: 'not-in', value: ['pro', 'team'] },
          context,
        ),
      ).toBe(false);
    });

    it('tests membership of an array-valued attribute with contains', () => {
      expect(
        evaluateCondition(
          { field: 'regions', op: 'contains', value: 'eu' },
          context,
        ),
      ).toBe(true);
      expect(
        evaluateCondition(
          { field: 'regions', op: 'contains', value: 'apac' },
          context,
        ),
      ).toBe(false);
    });

    it.each([
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      '__proto__',
    ])('does not read the inherited context field %s', (field) => {
      expect(evaluateCondition({ field, op: 'eq', value: 'pro' }, {})).toBe(
        false,
      );
      expect(evaluateCondition({ field, op: 'ne', value: 'pro' }, {})).toBe(
        false,
      );
      expect(evaluateCondition({ field, op: 'not-in', value: [] }, {})).toBe(
        false,
      );
    });

    it('does not hold when the field is absent from the context', () => {
      expect(
        evaluateCondition({ field: 'plan', op: 'eq', value: 'pro' }, {}),
      ).toBe(false);
      expect(
        evaluateCondition({ field: 'plan', op: 'ne', value: 'pro' }, {}),
      ).toBe(false);
      expect(
        evaluateCondition({ field: 'plan', op: 'not-in', value: [] }, {}),
      ).toBe(false);
    });
  });
});

describe('conditionFields', () => {
  it('names the context field a condition reads', () => {
    expect(conditionFields({ field: 'now', op: 'before', value: 0 })).toEqual([
      'now',
    ]);
    expect(conditionFields({ field: 'plan', op: 'eq', value: 'pro' })).toEqual([
      'plan',
    ]);
  });
});

describe('validateConditions', () => {
  /** A one-rule feature whose rule carries `when`. */
  const featureWith = (
    ...when: Condition[]
  ): FeatureDefinition<string | number> => ({
    key: 'k',
    enabled: true,
    rules: [{ when }],
  });

  it('refuses a date-time carrying no offset, whichever way the window faces', () => {
    const value = '2026-01-01T00:00:00';

    expect(() =>
      validateConditions(featureWith({ field: 'now', op: 'after', value })),
    ).toThrow(FeatureConfigError);
    expect(() =>
      validateConditions(featureWith({ field: 'now', op: 'before', value })),
    ).toThrow(FeatureConfigError);
  });

  it('names the feature, the operator and the string it refused', () => {
    const definition = featureWith({
      field: 'now',
      op: 'before',
      value: '2026-01-01T00:00:00',
    });

    expect(() => validateConditions(definition)).toThrow(
      /feature "k".*"before".*"2026-01-01T00:00:00"/,
    );
  });

  it('names a numeric feature key', () => {
    const definition: FeatureDefinition<string | number> = {
      key: 7,
      enabled: true,
      rules: [{ when: [{ field: 'now', op: 'after', value: 'whenever' }] }],
    };

    expect(() => validateConditions(definition)).toThrow(/feature "7"/);
  });

  it('reads every rule, not only the first', () => {
    const definition: FeatureDefinition<string | number> = {
      key: 'k',
      enabled: true,
      rules: [
        { when: [{ field: 'now', op: 'after', value: '2026-01-01' }] },
        { rollout: { percent: 10 } },
        { when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00' }] },
      ],
    };

    expect(() => validateConditions(definition)).toThrow(FeatureConfigError);
  });

  it('reads every condition in a rule, not only the first', () => {
    const definition = featureWith(
      { field: 'plan', op: 'eq', value: 'pro' },
      { field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' },
      { field: 'now', op: 'before', value: '2026-06-01T12:00:00' },
    );

    expect(() => validateConditions(definition)).toThrow(
      /"2026-06-01T12:00:00"/,
    );
  });

  it('refuses each of two rules carrying the same unusable string', () => {
    const when: Condition = {
      field: 'now',
      op: 'after',
      value: '2026-01-01T00:00:00',
    };

    expect(() =>
      validateConditions({
        key: 'k',
        enabled: true,
        rules: [{ when: [when] }, { when: [when] }],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('accepts a definition carrying no rules and a rule carrying no conditions', () => {
    expect(() => validateConditions({ key: 'k', enabled: true })).not.toThrow();
    expect(() =>
      validateConditions({ key: 'k', enabled: true, rules: [] }),
    ).not.toThrow();
    expect(() =>
      validateConditions({ key: 'k', enabled: true, rules: [{}] }),
    ).not.toThrow();
    expect(() =>
      validateConditions({ key: 'k', enabled: true, rules: [{ when: [] }] }),
    ).not.toThrow();
  });

  it('accepts every string form that names one instant', () => {
    const named = [
      '2026-01-01T00:00:00Z',
      '2026-01-01T09:00:00+09:00',
      '2026-01-01T00:00Z',
      '2026-01-01',
      '2026-01',
      '2026',
    ];

    for (const value of named) {
      expect(() =>
        validateConditions(featureWith({ field: 'now', op: 'after', value })),
      ).not.toThrow();
    }
  });

  it('refuses a string outside the range a Date holds', () => {
    const value = '+275760-09-13T00:00:00.001Z';

    expect(() =>
      validateConditions(featureWith({ field: 'now', op: 'after', value })),
    ).toThrow(FeatureConfigError);
  });

  it('accepts epoch milliseconds and a Date', () => {
    expect(() =>
      validateConditions(
        featureWith({ field: 'now', op: 'after', value: 1767225600000 }),
      ),
    ).not.toThrow();
    expect(() =>
      validateConditions(
        featureWith({
          field: 'now',
          op: 'before',
          value: new Date(1767225600000),
        }),
      ),
    ).not.toThrow();
  });

  it('accepts a Date and a number naming no instant, which it reads no strings from', () => {
    // The check reads the string forms only. A caller who wrote
    // `new Date('2026-01-01T00:00:00')` in a config module hands the store an
    // instant its own zone decided, and this builds.
    const unusable: readonly Instant[] = [
      new Date('nonsense'),
      new Date('2026-01-01T00:00:00'),
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ];

    for (const value of unusable) {
      expect(() =>
        validateConditions(featureWith({ field: 'now', op: 'after', value })),
      ).not.toThrow();
    }
  });

  it('leaves a string an attribute condition compares against alone', () => {
    const definition = featureWith({
      field: 'signedUpAt',
      op: 'eq',
      value: '2026-01-01T00:00:00',
    });

    expect(() => validateConditions(definition)).not.toThrow();
  });

  it('leaves a day-of-week condition alone', () => {
    const definition = featureWith({
      field: 'now',
      op: 'day-of-week',
      zone: 'Europe/Stockholm',
      value: ['mon'],
    });

    expect(() => validateConditions(definition)).not.toThrow();
  });
});
