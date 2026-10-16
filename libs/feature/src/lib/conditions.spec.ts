import { describe, expect, it } from 'vitest';
import {
  conditionFields,
  evaluateCondition,
  validateConditions,
} from './conditions.js';
import { FeatureConfigError } from './errors.js';
import { ruleFields } from './evaluate.js';
import type {
  Condition,
  EvaluationContext,
  FeatureDefinition,
  Instant,
  Rule,
  Weekday,
} from './types.js';
import { everywhere, inZone } from './zones.js';

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
      // `createFeatures` refuses such a number, so this window reaches an
      // evaluation only through a caller holding the condition itself.
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

    it('answers for a context that crossed JSON what it answers for the one it came from', () => {
      // `JSON.stringify` writes a `Date` as its ISO 8601 string and
      // `JSON.parse` gives the string back, so a context that crossed an RSC
      // payload, an island's props, a response body or a cookie carries `now`
      // as text. `contextEpoch` reads the three forms an `Instant` takes, so
      // the window resolves off the string the way it resolves off the `Date`
      // the string was written from.
      const condition: Condition = {
        field: 'now',
        op: 'after',
        value: '2026-01-01T00:00:00Z',
      };
      const held = at('2026-06-01T00:00:00Z');
      const wire = JSON.parse(JSON.stringify(held)) as EvaluationContext;

      expect(wire.now).toBe('2026-06-01T00:00:00.000Z');
      expect(evaluateCondition(condition, wire)).toBe(
        evaluateCondition(condition, held),
      );
      expect(evaluateCondition(condition, wire)).toBe(true);
    });

    it('reads an instant stated as epoch milliseconds', () => {
      const condition: Condition = {
        field: 'now',
        op: 'after',
        value: '2026-01-01T00:00:00Z',
      };

      expect(
        evaluateCondition(condition, {
          now: Date.parse('2026-06-01T00:00:00Z'),
        }),
      ).toBe(true);
    });

    it('does not hold for a now naming no instant, in any form', () => {
      const condition: Condition = {
        field: 'now',
        op: 'after',
        value: '2026-01-01T00:00:00Z',
      };
      const unusable: Instant[] = [
        'the first of June',
        '2026-06-01T00:00:00',
        Number.NaN,
        8_640_000_000_000_001,
        new Date('nonsense'),
      ];

      for (const now of unusable) {
        expect(evaluateCondition(condition, { now })).toBe(false);
      }
    });
  });

  describe('day-of-week', () => {
    // 2026-10-01T03:00Z is Thursday in UTC and still Wednesday in New York.
    // UTC day-of-week is wrong for every business rule anyone writes, which is
    // why the zone is required rather than defaulted.
    const instant = at('2026-10-01T03:00:00Z');

    it('reads the weekday off a context that crossed JSON', () => {
      const condition: Condition = {
        field: 'now',
        op: 'day-of-week',
        zone: 'America/New_York',
        value: ['wed'],
      };
      const wire = JSON.parse(JSON.stringify(instant)) as EvaluationContext;

      expect(evaluateCondition(condition, wire)).toBe(
        evaluateCondition(condition, instant),
      );
      expect(evaluateCondition(condition, wire)).toBe(true);
    });

    it('does not hold for an epoch number outside the range a Date holds', () => {
      // `Intl.DateTimeFormat.format` raises `RangeError` for an invalid
      // `Date`, so the guard refuses the number before the weekday is read
      // and the condition answers the way every unevaluable one does.
      const condition: Condition = {
        field: 'now',
        op: 'day-of-week',
        zone: 'America/New_York',
        value: ['wed'],
      };

      expect(evaluateCondition(condition, { now: 8_640_000_000_000_001 })).toBe(
        false,
      );
    });

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

    it('holds on no day for a list with no days in it', () => {
      // A control plane clearing the column writes the empty list, and the
      // type takes it.
      expect(
        evaluateCondition(
          { field: 'now', op: 'day-of-week', zone: 'UTC', value: [] },
          instant,
        ),
      ).toBe(false);
    });

    it('reaches each of the seven names the Weekday union declares', () => {
      // `weekdayIn` reads `Intl`'s `weekday: 'short'` output back against the
      // seven lower-case names and answers `undefined` for anything else, and
      // `evaluateCondition` turns that into the same `false` a day outside the
      // list gets. A runtime spelling those names any other way switches every
      // day-of-week rule off and reports nothing, so the week is walked here
      // and each name has to be the one that holds.
      const week: readonly (readonly [string, Weekday])[] = [
        ['2026-03-01T12:00:00Z', 'sun'],
        ['2026-03-02T12:00:00Z', 'mon'],
        ['2026-03-03T12:00:00Z', 'tue'],
        ['2026-03-04T12:00:00Z', 'wed'],
        ['2026-03-05T12:00:00Z', 'thu'],
        ['2026-03-06T12:00:00Z', 'fri'],
        ['2026-03-07T12:00:00Z', 'sat'],
      ];

      const held = week.map(([iso, day]) =>
        evaluateCondition(
          { field: 'now', op: 'day-of-week', zone: 'UTC', value: [day] },
          at(iso),
        ),
      );

      expect(held).toEqual(week.map(() => true));
    });

    it('answers one day in every host zone, since the condition names its own', () => {
      // The day-of-week counterpart of the window cases above. `weekdayIn`
      // hands the zone to `Intl` and reads nothing off the host, and this
      // instant is noon Thursday in Tokyo wherever the process runs.
      const condition: Condition = {
        field: 'now',
        op: 'day-of-week',
        zone: 'Asia/Tokyo',
        value: ['thu'],
      };

      expect(everywhere(() => evaluateCondition(condition, instant))).toEqual([
        true,
        true,
        true,
      ]);
    });

    it('reads the daylight-saving rules of the zone it names, not one offset', () => {
      // Both instants carry `Z` and both sit at half past midnight in New
      // York. The first falls under EST, five hours behind UTC, which puts it
      // on the Saturday; the second falls under EDT, four hours behind, which
      // puts it on the Sunday. One offset read off the zone answers one of the
      // two wrong, whichever offset it reads.
      const sundays: Condition = {
        field: 'now',
        op: 'day-of-week',
        zone: 'America/New_York',
        value: ['sun'],
      };

      expect(evaluateCondition(sundays, at('2026-03-08T04:30:00Z'))).toBe(
        false,
      );
      expect(evaluateCondition(sundays, at('2026-03-15T04:30:00Z'))).toBe(true);
    });

    it('raises the host error for a zone this runtime formats nothing by', () => {
      // `Intl.DateTimeFormat` raises `RangeError: Invalid time zone specified`
      // for a name the runtime has no zone for. `createFeatures` and
      // `validateConfig` refuse such a zone where the configuration is
      // supplied, which is what keeps the raise out of `resolve`, and
      // `validate.spec.ts` holds both. A caller holding a condition of their
      // own has passed neither gate, so the raise is what reaches them.
      const condition: Condition = {
        field: 'now',
        op: 'day-of-week',
        zone: 'Europe/Stockolm',
        value: ['wed'],
      };

      expect(() => evaluateCondition(condition, instant)).toThrow(RangeError);
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

    it('does not hold for an in or a not-in whose value is not the list', () => {
      // `AttributeCondition.value` is `unknown`, so a hand-written condition
      // takes a bare string where the operator reads a list and a document
      // parsed out of JSON carries whatever a control plane wrote.
      // `validateConfig` reports it there; here neither operator has a list to
      // read, so neither holds, the negative one included. Each value is the
      // one `String.prototype.includes` answers the opposite of its assertion
      // for: 'pro' contains 'pro' and 'enterprise' does not, so an operator
      // reading the string as the list holds on both lines.
      expect(
        evaluateCondition({ field: 'plan', op: 'in', value: 'pro' }, context),
      ).toBe(false);
      expect(
        evaluateCondition(
          { field: 'plan', op: 'not-in', value: 'enterprise' },
          context,
        ),
      ).toBe(false);
    });

    it('does not hold for a contains whose context member is not an array', () => {
      // `contains` reads the context member as the list and the condition's
      // value as one member of it, which is the opposite of `in`. The string
      // 'pro' carries an `includes` of its own, and this reads neither that
      // method nor the substring it would answer for.
      expect(
        evaluateCondition(
          { field: 'plan', op: 'contains', value: 'p' },
          context,
        ),
      ).toBe(false);
      expect(
        evaluateCondition(
          { field: 'plan', op: 'contains', value: 'pro' },
          context,
        ),
      ).toBe(false);
    });

    it('compares a contains against the members and not into them', () => {
      // `includes` is `===` over the array's own members, so a member that is
      // itself an array matches by identity and a second array holding the
      // same strings does not.
      const regions = ['eu'];
      const nested = { regions: [regions] };

      expect(
        evaluateCondition(
          { field: 'regions', op: 'contains', value: regions },
          nested,
        ),
      ).toBe(true);
      expect(
        evaluateCondition(
          { field: 'regions', op: 'contains', value: ['eu'] },
          nested,
        ),
      ).toBe(false);
    });

    it('does not hold on a field the context carries with no value', () => {
      // The field is the context's own, so the prototype guard passes and the
      // value is what is missing. `ne` answering true here would switch a
      // feature on for the contexts carrying the least information, which is
      // the reading an absent field already gets.
      const unset = { plan: undefined };

      expect(
        evaluateCondition({ field: 'plan', op: 'eq', value: 'pro' }, unset),
      ).toBe(false);
      expect(
        evaluateCondition({ field: 'plan', op: 'ne', value: 'pro' }, unset),
      ).toBe(false);
      expect(
        evaluateCondition({ field: 'plan', op: 'not-in', value: [] }, unset),
      ).toBe(false);
    });

    it('compares null as a value the context carries', () => {
      // `null` is not `undefined`, and `JSON.parse` writes it for a column a
      // control plane cleared. It reaches the comparison and `eq` against
      // `null` holds, which is the one way a condition asks whether a field
      // was cleared.
      const cleared = { plan: null };

      expect(
        evaluateCondition({ field: 'plan', op: 'eq', value: null }, cleared),
      ).toBe(true);
      expect(
        evaluateCondition({ field: 'plan', op: 'ne', value: null }, cleared),
      ).toBe(false);
    });

    it('compares NaN against itself as two values that differ', () => {
      // `===` over NaN is false both ways, so `eq` does not hold and `ne`
      // does. A numeric context field computed from a parse that failed
      // carries it, and the field is present, so the reading an unevaluable
      // condition gets does not apply.
      const unparsed = { seats: Number.NaN };

      expect(
        evaluateCondition(
          { field: 'seats', op: 'eq', value: Number.NaN },
          unparsed,
        ),
      ).toBe(false);
      expect(
        evaluateCondition(
          { field: 'seats', op: 'ne', value: Number.NaN },
          unparsed,
        ),
      ).toBe(true);
    });

    it('does not coerce a number to the string that names it', () => {
      // A query string and a form body carry every field as text, so the
      // number 10 and the string '10' meet in one context field often.
      expect(
        evaluateCondition({ field: 'seats', op: 'eq', value: '10' }, context),
      ).toBe(false);
      expect(
        evaluateCondition({ field: 'seats', op: 'in', value: ['10'] }, context),
      ).toBe(false);
    });

    it('does not hold for an operator the union does not declare', () => {
      // A document parsed out of JSON carries whatever its control plane
      // wrote, and `validateConfig` reports the operator there. A store built
      // past that gate reaches the switch, which ends at its default, so the
      // condition answers false rather than raising out of a call `errors.ts`
      // promises is total.
      const greater = {
        field: 'seats',
        op: 'gt',
        value: 5,
      } as unknown as Condition;

      expect(evaluateCondition(greater, context)).toBe(false);
    });
  });

  it('reads the condition and the context and writes into neither', () => {
    // A snapshot tool asks this question over a store's own rules and a
    // request's own context, and holds both afterwards. The two are the
    // caller's objects, so an engine that memoised an answer onto either one
    // would be editing a configuration a reader still owns.
    const condition: Condition = {
      field: 'regions',
      op: 'contains',
      value: 'eu',
    };
    const context = {
      regions: ['eu', 'us'],
      now: new Date('2026-10-01T03:00:00Z'),
    };
    evaluateCondition(condition, context);

    expect(condition).toEqual({
      field: 'regions',
      op: 'contains',
      value: 'eu',
    });
    expect(context).toEqual({
      regions: ['eu', 'us'],
      now: new Date('2026-10-01T03:00:00Z'),
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

describe('ruleFields', () => {
  it('names every context field a rule reads, sorted and deduplicated', () => {
    const rule: Rule = {
      id: 'weekend-members',
      when: [
        { field: 'tier', op: 'eq', value: 'member' },
        {
          field: 'now',
          op: 'day-of-week',
          zone: 'Europe/Stockholm',
          value: ['sat', 'sun'],
        },
      ],
      rollout: { percent: 25, by: 'customerId' },
    };

    expect(ruleFields(rule)).toEqual(['customerId', 'now', 'tier']);
  });

  it('names the default rollout field for a rollout that declares no `by`', () => {
    const rule: Rule = { id: 'a-quarter', rollout: { percent: 25 } };

    expect(ruleFields(rule)).toEqual(['targetingKey']);
  });

  it('names one field for two conditions reading the same one', () => {
    const rule: Rule = {
      id: 'members-only',
      when: [
        { field: 'tier', op: 'ne', value: 'guest' },
        { field: 'tier', op: 'in', value: ['member', 'owner'] },
      ],
    };

    expect(ruleFields(rule)).toEqual(['tier']);
  });

  it('names nothing for a rule with no conditions and no rollout', () => {
    expect(ruleFields({ id: 'always' })).toEqual([]);
  });

  it('names one field for a rollout bucketing on a field a condition reads', () => {
    // The conditions and the rollout are two sources, and the set is what
    // merges them. A list deduplicated inside `when` alone answers
    // `['tier', 'tier']` here.
    const rule: Rule = {
      id: 'a-quarter-of-the-members',
      when: [{ field: 'tier', op: 'eq', value: 'member' }],
      rollout: { percent: 25, by: 'tier' },
    };

    expect(ruleFields(rule)).toEqual(['tier']);
  });

  it('names one field for a rollout defaulting onto a field a condition reads', () => {
    const rule: Rule = {
      id: 'the-keyed-quarter',
      when: [{ field: 'targetingKey', op: 'ne', value: '' }],
      rollout: { percent: 25 },
    };

    expect(ruleFields(rule)).toEqual(['targetingKey']);
  });

  it('sorts across the two sources and not within either one', () => {
    // `zip` comes off a condition and `ageBand` off the rollout, so a sort
    // applied to each source on its own answers `['zip', 'ageBand']`.
    const rule: Rule = {
      id: 'the-southern-band',
      when: [{ field: 'zip', op: 'eq', value: '21000' }],
      rollout: { percent: 50, by: 'ageBand' },
    };

    expect(ruleFields(rule)).toEqual(['ageBand', 'zip']);
  });

  it('names nothing for a rule whose `when` is an empty list', () => {
    // A list with no conditions matches on nothing, which the type takes and
    // a control plane emits for a rule an operator cleared.
    expect(ruleFields({ id: 'cleared', when: [] })).toEqual([]);
  });

  it('names the default rollout field for an empty `when` beside a rollout', () => {
    const rule: Rule = {
      id: 'cleared-but-ramped',
      when: [],
      rollout: { percent: 25 },
    };

    expect(ruleFields(rule)).toEqual(['targetingKey']);
  });

  it('names the empty field a rollout bucketing on it asks for', () => {
    // `by: ''` is a string, so the type takes it and the default never
    // applies: `''` is not nullish. `evaluateRule` reads `context['']`, finds
    // nothing and does not match, and this list is what names the field that
    // was missing. Answering `targetingKey` here would name a field the rule
    // never read.
    const rule: Rule = {
      id: 'nameless-bucket',
      rollout: { percent: 25, by: '' },
    };

    expect(ruleFields(rule)).toEqual(['']);
  });

  it('names `now` for a window, which is the field a window reads', () => {
    const rule: Rule = {
      id: 'the-q4-window',
      when: [
        { field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' },
        { field: 'now', op: 'before', value: '2027-01-01T00:00:00Z' },
      ],
    };

    expect(ruleFields(rule)).toEqual(['now']);
  });

  it('answers a list of its own, so a caller reordering it alters no rule', () => {
    const rule: Rule = {
      id: 'the-southern-quarter',
      when: [{ field: 'zip', op: 'eq', value: '21000' }],
      rollout: { percent: 25, by: 'customerId' },
    };

    (ruleFields(rule) as string[]).reverse();

    expect(ruleFields(rule)).toEqual(['customerId', 'zip']);
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
      '2026-01-01T09:00:00+0900',
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

  it('refuses a string whose shape is ISO 8601 and whose date is not a date', () => {
    // Each of these reaches V8's legacy heuristic parser, which reads it in the
    // host's zone, so the check has to refuse it on the shape alone rather than
    // on `Date.parse` answering `NaN`.
    const unusable = ['-000000-01-01', '0001-13', '0001-13-01', '0001-01-32'];

    for (const value of unusable) {
      expect(() =>
        validateConditions(featureWith({ field: 'now', op: 'after', value })),
      ).toThrow(FeatureConfigError);
    }
  });

  it('refuses a day the month it is written under does not have', () => {
    // These name one instant on every engine, the first of the next month, so
    // no disagreement between hosts refuses them. The author wrote April and
    // would get May.
    const overflowing = ['2026-04-31', '2026-02-29', '2026-06-31'];

    for (const value of overflowing) {
      expect(() =>
        validateConditions(featureWith({ field: 'now', op: 'after', value })),
      ).toThrow(FeatureConfigError);
    }
  });

  it('names the Date constructor in the message, which does not fix the string', () => {
    // The nearest edit to the refused string is `new Date` of it, and a `Date`
    // reaches the check with the constructing host's zone already applied.
    expect(() =>
      validateConditions(
        featureWith({
          field: 'now',
          op: 'after',
          value: '2026-01-01T00:00:00',
        }),
      ),
    ).toThrow(/new Date/);
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

  it('refuses the number NaN, whichever way the window faces', () => {
    // `Date.parse` of a string naming no instant answers NaN, so a config
    // pipeline reading a boundary out of the environment writes one for an
    // unset variable. The window matches at no moment and reports nothing.
    expect(() =>
      validateConditions(
        featureWith({ field: 'now', op: 'after', value: Number.NaN }),
      ),
    ).toThrow(FeatureConfigError);
    expect(() =>
      validateConditions(
        featureWith({ field: 'now', op: 'before', value: Number.NaN }),
      ),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a number outside the range a Date holds', () => {
    // The string naming the same moment is refused, and a `before` boundary
    // above the range holds at every instant while an `after` boundary holds
    // at none.
    const outside: readonly Instant[] = [
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      8640000000000001,
      -8640000000000001,
    ];

    for (const value of outside) {
      expect(() =>
        validateConditions(featureWith({ field: 'now', op: 'before', value })),
      ).toThrow(FeatureConfigError);
    }
  });

  it('accepts each end of the range a Date holds', () => {
    for (const value of [8640000000000000, -8640000000000000]) {
      expect(() =>
        validateConditions(featureWith({ field: 'now', op: 'after', value })),
      ).not.toThrow();
    }
  });

  it('refuses a Date that holds no instant', () => {
    expect(() =>
      validateConditions(
        featureWith({ field: 'now', op: 'after', value: new Date('nonsense') }),
      ),
    ).toThrow(FeatureConfigError);
  });

  it('accepts a Date built from a string whose zone its own host decided', () => {
    // A `Date` carries an instant and nothing of the string it was built from,
    // so `new Date('2026-01-01T00:00:00')` has already taken the constructing
    // host's zone and no reading here recovers it.
    expect(() =>
      validateConditions(
        featureWith({
          field: 'now',
          op: 'after',
          value: new Date('2026-01-01T00:00:00'),
        }),
      ),
    ).not.toThrow();
  });

  it('accepts a window value of no type an instant takes', () => {
    // A document parsed out of JSON is untyped. The check polices the types
    // `Instant` declares; what the library owes for a value outside them is
    // the answer an unevaluable condition gets, on the evaluation path.
    const outside: readonly unknown[] = [null, {}, true, ['2026-01-01']];

    for (const value of outside) {
      expect(() =>
        validateConditions(
          featureWith({ field: 'now', op: 'after', value: value as Instant }),
        ),
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
