import { describe, expect, it } from 'vitest';

import { ruleId } from './rule-id.js';
import type { Rule } from './types.js';

const owner: Rule = {
  when: [{ field: 'subject.id', op: 'eq', path: 'object.ownerId' }],
};

describe('ruleId', () => {
  it('returns the author id when the rule carries one', () => {
    expect(ruleId({ ...owner, id: 'owner-edits-own' }, 'allow')).toBe(
      'owner-edits-own',
    );
  });

  it('derives the same id wherever the rule sits in the side', () => {
    const other: Rule = {
      when: [{ field: 'subject.role', op: 'eq', value: 'admin' }],
    };
    const before = [owner, other];
    const after = [other, owner];
    expect(ruleId(before[0]!, 'allow')).toBe(ruleId(after[1]!, 'allow'));
  });

  it('derives the same id for a rule whose keys arrived in another order', () => {
    const reordered: Rule = {
      when: [{ op: 'eq', path: 'object.ownerId', field: 'subject.id' }],
    };
    expect(ruleId(reordered, 'allow')).toBe(ruleId(owner, 'allow'));
  });

  it('separates the two sides, so an allow and a deny never share an id', () => {
    expect(ruleId(owner, 'allow')).not.toBe(ruleId(owner, 'deny'));
  });

  it('separates two rules that differ only in the value they compare', () => {
    const a: Rule = { when: [{ field: 'subject.role', op: 'eq', value: 'a' }] };
    const b: Rule = { when: [{ field: 'subject.role', op: 'eq', value: 'b' }] };
    expect(ruleId(a, 'allow')).not.toBe(ruleId(b, 'allow'));
  });

  it('separates a literal value from a path comparison', () => {
    const value: Rule = {
      when: [{ field: 'subject.id', op: 'eq', value: 'object.ownerId' }],
    };
    expect(ruleId(value, 'allow')).not.toBe(ruleId(owner, 'allow'));
  });

  it('gives the unconditional rule a stable id', () => {
    expect(ruleId({}, 'allow')).toBe(ruleId({ when: [] }, 'allow'));
  });

  it('names the side and eight hex digits', () => {
    expect(ruleId(owner, 'deny')).toMatch(/^deny-[0-9a-f]{8}$/);
  });
});
