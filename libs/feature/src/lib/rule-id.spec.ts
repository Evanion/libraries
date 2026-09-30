import { describe, expect, it } from 'vitest';
import { ruleId } from './rule-id.js';
import type { Instant, Rule } from './types.js';
import { everywhere } from './zones.js';

describe('ruleId', () => {
  it('returns an explicit id unchanged', () => {
    expect(ruleId({ id: 'staff-only', when: [] })).toBe('staff-only');
  });

  it('derives the same id for one rule wherever it sits in a list', () => {
    const rule: Rule = { when: [{ field: 'role', op: 'eq', value: 'staff' }] };
    const other: Rule = { when: [{ field: 'plan', op: 'eq', value: 'pro' }] };

    const before = [rule, other].map((each) => ruleId(each));
    const after = [other, rule].map((each) => ruleId(each));

    expect(before[0]).toBe(after[1]);
    expect(before[1]).toBe(after[0]);
  });

  it('derives different ids for rules with different conditions', () => {
    const a = ruleId({ when: [{ field: 'role', op: 'eq', value: 'staff' }] });
    const b = ruleId({ when: [{ field: 'role', op: 'eq', value: 'admin' }] });

    expect(a).not.toBe(b);
  });

  it('derives the same id whatever order a producer wrote the keys in', () => {
    const a = ruleId({ when: [{ op: 'eq', value: 'staff', field: 'role' }] });
    const b = ruleId({ when: [{ field: 'role', op: 'eq', value: 'staff' }] });

    expect(a).toBe(b);
  });

  it('prefixes a derived id so a reader can tell it from an authored one', () => {
    expect(ruleId({ when: [] })).toMatch(/^rule-[0-9a-f]{8}$/);
  });

  it('leaves the id alone when an operator moves a ramp', () => {
    const at20 = ruleId({ rollout: { percent: 20 } });
    const at30 = ruleId({ rollout: { percent: 30 } });

    expect(at20).toBe(at30);
  });

  it('changes the id when the bucketing field changes', () => {
    const byDefault = ruleId({ rollout: { percent: 20 } });
    const byAccount = ruleId({ rollout: { percent: 20, by: 'accountId' } });

    expect(byDefault).not.toBe(byAccount);
  });

  it('changes the id when the rollout seed changes', () => {
    const unseeded = ruleId({ rollout: { percent: 20 } });
    const seeded = ruleId({ rollout: { percent: 20, seed: 'autumn' } });

    expect(unseeded).not.toBe(seeded);
  });

  it('separates a rule with a rollout from one without', () => {
    expect(ruleId({ rollout: { percent: 20 } })).not.toBe(ruleId({}));
  });

  it('derives one id for two rules that both match unconditionally', () => {
    expect(ruleId({})).toBe(ruleId({}));
  });

  it('reads an absent when and an empty when as the same rule', () => {
    expect(ruleId({})).toBe(ruleId({ when: [] }));
  });

  it('derives one id for one instant written three ways', () => {
    const asDate = ruleId({
      when: [{ field: 'now', op: 'after', value: new Date(1767225600000) }],
    });
    const asIso = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00.000Z' }],
    });
    const asEpoch = ruleId({
      when: [{ field: 'now', op: 'after', value: 1767225600000 }],
    });

    expect(asIso).toBe(asDate);
    expect(asEpoch).toBe(asDate);
  });

  it('separates two different instants', () => {
    const early = ruleId({
      when: [{ field: 'now', op: 'after', value: 1767225600000 }],
    });
    const late = ruleId({
      when: [{ field: 'now', op: 'after', value: 1767225600001 }],
    });

    expect(early).not.toBe(late);
  });

  it('separates a before window from an after window', () => {
    const before = ruleId({
      when: [{ field: 'now', op: 'before', value: 1767225600000 }],
    });
    const after = ruleId({
      when: [{ field: 'now', op: 'after', value: 1767225600000 }],
    });

    expect(before).not.toBe(after);
  });

  it('reads the zone of a day-of-week condition', () => {
    const stockholm = ruleId({
      when: [
        {
          field: 'now',
          op: 'day-of-week',
          zone: 'Europe/Stockholm',
          value: ['mon'],
        },
      ],
    });
    const tokyo = ruleId({
      when: [
        { field: 'now', op: 'day-of-week', zone: 'Asia/Tokyo', value: ['mon'] },
      ],
    });

    expect(stockholm).not.toBe(tokyo);
  });

  it('returns an authored id that looks derived', () => {
    expect(ruleId({ id: 'rule-deadbeef', when: [] })).toBe('rule-deadbeef');
  });

  it('derives a stable id for a non-BMP condition value', () => {
    // Pinned so a Swift or Kotlin port has a value to match. `fnv1a` walks
    // UTF-16 code units, so a surrogate pair contributes two of them.

    expect(ruleId({ when: [{ field: 'tag', op: 'eq', value: '🎯' }] })).toBe(
      'rule-b9b91345',
    );
  });

  it('separates a field ending in an operator prefix from the operator', () => {
    const a = ruleId({ when: [{ field: 'usernot-', op: 'in', value: ['x'] }] });
    const b = ruleId({ when: [{ field: 'user', op: 'not-in', value: ['x'] }] });

    expect(a).not.toBe(b);
  });

  it('separates an op from a longer op that would swallow the value boundary', () => {
    const a = ruleId({ when: [{ field: 'u', op: 'eq', value: 12 }] });
    const b = ruleId({ when: [{ field: 'u', op: 'eq1' as never, value: 2 }] });

    expect(a).not.toBe(b);
  });

  it('separates two conditions from one condition spelling both', () => {
    const two = ruleId({
      when: [
        { field: 'role', op: 'eq', value: 'staff' },
        { field: 'plan', op: 'eq', value: 'pro' },
      ],
    });
    const one = ruleId({
      when: [{ field: 'roleeq"staff"plan', op: 'eq', value: 'pro' }],
    });

    expect(two).not.toBe(one);
  });

  it('separates a zone ending in a weekday from the weekday list', () => {
    const a = ruleId({
      when: [
        {
          field: 'now',
          op: 'day-of-week',
          zone: 'Europe/Oslo',
          value: ['mon'],
        },
      ],
    });
    const b = ruleId({
      when: [
        {
          field: 'now',
          op: 'day-of-week',
          zone: 'Europe/Osl',
          value: ['omon'] as never,
        },
      ],
    });

    expect(a).not.toBe(b);
  });

  it('changes the id when two conditions swap places', () => {
    const a = ruleId({
      when: [
        { field: 'role', op: 'eq', value: 'staff' },
        { field: 'plan', op: 'eq', value: 'pro' },
      ],
    });
    const b = ruleId({
      when: [
        { field: 'plan', op: 'eq', value: 'pro' },
        { field: 'role', op: 'eq', value: 'staff' },
      ],
    });

    expect(a).not.toBe(b);
  });

  it('derives one id for an offsetless instant string on any host', () => {
    // ECMA-262 reads this as local time, so Date.parse disagrees between
    // hosts. The id must not.
    const id = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00' }],
    });

    expect(id).toBe('rule-59e8e8f5');
  });

  it('separates an offsetless instant string from the same instant in UTC', () => {
    const offsetless = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00' }],
    });
    const utc = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' }],
    });

    expect(offsetless).not.toBe(utc);
  });

  it('separates three attribute values JSON writes as one null', () => {
    // `evaluateCondition` compares an `AttributeCondition.value` with `===`, so
    // `eq: NaN` matches no context, `eq: Infinity` matches a context carrying
    // that number, and `eq: null` matches a null attribute. `JSON.stringify`
    // writes `null` for all three, so a derivation over its text would give
    // three rules matching three audiences one id. This is what the `number:`
    // tag in `canonical` is for. `configDigest` reads `canonicalDocument`
    // instead, which writes the three as `null`, because a digest compares two
    // holders across a JSON hop and this derivation reads a live store.
    const idAt = (value: unknown) =>
      ruleId({ when: [{ field: 'budget', op: 'eq', value }] });

    expect(
      new Set([
        idAt(Number.NaN),
        idAt(Number.POSITIVE_INFINITY),
        idAt(Number.NEGATIVE_INFINITY),
        idAt(null),
      ]).size,
    ).toBe(4);
  });

  it('memoizes the derived id for the same rule object', () => {
    const rule: Rule = { when: [{ field: 'role', op: 'eq', value: 'staff' }] };

    expect(ruleId(rule)).toBe(ruleId(rule));
  });

  it('does not confuse two structurally distinct rule objects sharing the cache', () => {
    const a: Rule = { when: [{ field: 'role', op: 'eq', value: 'staff' }] };
    const b: Rule = { when: [{ field: 'role', op: 'eq', value: 'admin' }] };

    const aFirst = ruleId(a);
    ruleId(b);
    const aSecond = ruleId(a);

    expect(aSecond).toBe(aFirst);
    expect(ruleId(b)).not.toBe(aFirst);
  });

  it('derives one id for a window in every zone', () => {
    // A fresh rule object per zone, because `ruleId` memoizes on identity and
    // one object reused across the three would answer from the cache.
    const idsOf = (value: Instant) =>
      everywhere(() =>
        ruleId({ when: [{ field: 'now', op: 'after', value }] }),
      );

    expect(new Set(idsOf('2026-01-01T00:00:00Z')).size).toBe(1);
    expect(new Set(idsOf('2026-01-01')).size).toBe(1);
    expect(new Set(idsOf('2026-01-01T00:00:00')).size).toBe(1);
    expect(new Set(idsOf(new Date(1767225600000))).size).toBe(1);
  });

  it('derives one id for one instant written with two offsets', () => {
    const asUtc = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00.000Z' }],
    });
    const asTokyo = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01T09:00:00+09:00' }],
    });

    expect(asTokyo).toBe(asUtc);
  });

  it('derives one id for one offset written with and without its colon', () => {
    const withColon = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00+01:00' }],
    });
    const basic = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00+0100' }],
    });

    expect(basic).toBe(withColon);
  });

  it('derives one id in every zone for a date naming no calendar date', () => {
    // The string reaches no parser that reads the host's zone, so it is hashed
    // as text and three hosts write one name for the rule.
    const idsEverywhere = everywhere(() =>
      ruleId({ when: [{ field: 'now', op: 'after', value: '0001-13-01' }] }),
    );

    expect(new Set(idsEverywhere).size).toBe(1);
  });

  it('separates a day past the end of its month from the day it would carry into', () => {
    // `2026-04-31` is refused as an instant, so it is hashed as text. Reading
    // it through `Date.parse` would give it the epoch of `2026-05-01` and both
    // rules one name in a decision's per-rule breakdown.
    const asApril = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-04-31' }],
    });
    const asMay = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-05-01' }],
    });

    expect(asApril).not.toBe(asMay);
  });

  it('derives one id for a date and the UTC midnight it names', () => {
    const asDate = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01' }],
    });
    const asInstant = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00.000Z' }],
    });

    expect(asDate).toBe(asInstant);
  });

  it('separates an epoch from a string carrying its digits', () => {
    // `'1767225600000'` names no instant and is hashed as text. Reading it as
    // one would give the two rules a single id for two different windows.
    const asNumber = ruleId({
      when: [{ field: 'now', op: 'after', value: 1767225600000 }],
    });
    const asText = ruleId({
      when: [{ field: 'now', op: 'after', value: '1767225600000' }],
    });

    expect(asText).not.toBe(asNumber);
  });

  it('separates two strings that each name no instant', () => {
    const one = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00' }],
    });
    const other = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-06-01T00:00:00' }],
    });

    expect(one).not.toBe(other);
  });

  it('separates a window from an attribute condition carrying the same text', () => {
    const window = ruleId({
      when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00' }],
    });
    const attribute = ruleId({
      when: [{ field: 'now', op: 'eq', value: '2026-01-01T00:00:00' }],
    });

    expect(attribute).not.toBe(window);
  });

  it('derives one id for the Dates and numbers that name no instant', () => {
    // Both write `NaN`, which is the reading this package has of either.
    // `canonical` writes `null` for both and would collide with a JSON-borne
    // `null`. `createFeatures` refuses both, so two rules reach one name here
    // only through a caller holding the rules themselves.
    const asDate = ruleId({
      when: [{ field: 'now', op: 'after', value: new Date('nonsense') }],
    });
    const asNumber = ruleId({
      when: [{ field: 'now', op: 'after', value: Number.NaN }],
    });

    expect(asNumber).toBe(asDate);
  });

  it('separates the values of no type an instant takes from one another', () => {
    // A document parsed out of JSON carries values `Instant` does not admit
    // into a store, and `instantEpoch` answers `NaN` for every one of them. A
    // rule id derived from that number would name every such rule the same,
    // and a decision's per-rule breakdown would name one rule twice with
    // nothing in it saying which was walked.
    const outside: readonly unknown[] = [
      null,
      undefined,
      {},
      true,
      [],
      Symbol('now'),
    ];

    const ids = outside.map((value) =>
      ruleId({
        when: [{ field: 'now', op: 'after', value: value as Instant }],
      }),
    );

    expect(new Set(ids).size).toBe(outside.length);
  });

  it('separates a value of no type an instant takes from a Date that names none', () => {
    const asNull = ruleId({
      when: [{ field: 'now', op: 'after', value: null as unknown as Instant }],
    });
    const asDate = ruleId({
      when: [{ field: 'now', op: 'after', value: new Date('nonsense') }],
    });

    expect(asNull).not.toBe(asDate);
  });
});
