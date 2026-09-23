import { describe, expect, it } from 'vitest';
import { ruleId } from './rule-id.js';
import type { Rule } from './types.js';

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
});
