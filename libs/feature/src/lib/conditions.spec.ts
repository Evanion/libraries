import { describe, expect, it } from 'vitest';
import { conditionFields, evaluateCondition } from './conditions.js';
import type { Condition } from './types.js';

const at = (iso: string) => ({ now: new Date(iso) });

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

    it('does not hold when the field is absent from the context', () => {
      expect(
        evaluateCondition({ field: 'plan', op: 'eq', value: 'pro' }, {})
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
    expect(
      conditionFields({ field: 'now', op: 'before', value: 0 }),
    ).toEqual(['now']);
    expect(conditionFields({ field: 'plan', op: 'eq', value: 'pro' })).toEqual([
      'plan',
    ]);
  });
});
