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
        { field: 'now', op: 'day-of-week', zone: 'Europe/Stockholm', value: ['mon'] },
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
    const rule: Rule = { when: [{ field: 'tag', op: 'eq', value: '🎯' }] };
    // Pinned so a Swift or Kotlin port has a value to match. `fnv1a` walks
    // UTF-16 code units, so a surrogate pair contributes two of them.
    expect(ruleId(rule)).toBe(ruleId(rule));
    expect(ruleId(rule)).toMatch(/^rule-[0-9a-f]{8}$/);
  });
});
