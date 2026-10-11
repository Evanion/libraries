import { describe, expectTypeOf, it } from 'vitest';
import { ruleId } from './rule-id.js';
import { ruleId as publishedRuleId } from '../index.js';
import type { SerializedRule } from './config.js';
import type { Rule } from './types.js';

describe('ruleId', () => {
  it('returns a string and not a literal a caller could switch on', () => {
    expectTypeOf(ruleId).returns.toEqualTypeOf<string>();
  });

  it('takes the live rule a store holds, and one of them', () => {
    expectTypeOf(ruleId).parameters.toEqualTypeOf<[Rule]>();
  });

  it('takes a rule a document carries, whose instants are the narrower pair', () => {
    // `SerializedWindowCondition` fences its boundary to an ISO string or
    // epoch milliseconds, and a live `WindowCondition` admits a `Date` on top
    // of those, so a rule read straight off a parsed document reaches this
    // function without a conversion.
    const serialized: SerializedRule = {
      when: [{ field: 'now', op: 'after', value: '2026-10-01T00:00:00.000Z' }],
    };

    expectTypeOf(ruleId(serialized)).toEqualTypeOf<string>();
  });

  it('takes a rule whose only member is a ramp, which matches on nothing', () => {
    expectTypeOf(
      ruleId({ rollout: { percent: 10, by: 'customerId' } }),
    ).toEqualTypeOf<string>();
  });

  it('refuses a rule list written where one rule belongs', () => {
    // @ts-expect-error -- the derivation names one rule, and a definition's
    // list reaches it one element at a time the way `evaluate.ts` walks it.
    ruleId([{ when: [{ field: 'tier', op: 'eq', value: 'gold' }] }]);

    expectTypeOf(ruleId).parameter(0).toEqualTypeOf<Rule>();
  });

  it('refuses a condition written where the rule holding it belongs', () => {
    // @ts-expect-error -- a condition shares no member with a rule, so the
    // weak type check catches the call a caller meant to wrap in a `when`.
    ruleId({ field: 'tier', op: 'eq', value: 'gold' });

    expectTypeOf(ruleId).parameter(0).toEqualTypeOf<Rule>();
  });

  it('is published at the entry point at the type the module declares', () => {
    expectTypeOf(publishedRuleId).toEqualTypeOf(ruleId);
  });
});
