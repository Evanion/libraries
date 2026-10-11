import { describe, expectTypeOf, it } from 'vitest';

import { DEFAULT_ROLLOUT_FIELD, ruleFields } from './evaluate.js';
import {
  DEFAULT_ROLLOUT_FIELD as publishedDefaultRolloutField,
  ruleFields as publishedRuleFields,
} from '../index.js';
import type { Rule } from './types.js';

/**
 * The field list a rule reads, at the type a caller holds it as.
 *
 * `@evanion/react-feature`'s hydration asks this question through the package
 * specifier, so the entry's `ruleFields` has to be this declaration and not a
 * second one beside it. `conditions.spec.ts` holds the values.
 */
describe('ruleFields', () => {
  it('takes one rule and nothing else', () => {
    expectTypeOf(ruleFields).parameters.toEqualTypeOf<[Rule]>();
  });

  it('answers a readonly list of field names', () => {
    expectTypeOf(ruleFields).returns.toEqualTypeOf<readonly string[]>();
  });

  it('answers a list a caller cannot write into', () => {
    const fields = ruleFields({ id: 'always' });

    // @ts-expect-error -- the answer is the engine's reading of the rule, and
    // a caller appending to it would be stating a field the rule never read.
    fields.push('tier');
  });

  it('is the declaration the entry publishes', () => {
    expectTypeOf(publishedRuleFields).toEqualTypeOf<typeof ruleFields>();
  });
});

describe('DEFAULT_ROLLOUT_FIELD', () => {
  it('is the literal a rollout declaring no `by` buckets on', () => {
    expectTypeOf<
      typeof DEFAULT_ROLLOUT_FIELD
    >().toEqualTypeOf<'targetingKey'>();
  });

  it('is the declaration the entry publishes', () => {
    // The type form on both sides. `expectTypeOf(value)` infers through a
    // parameter that widens a string literal, so the value form reads this
    // constant as `string` and passes whatever it is asserted against.
    expectTypeOf<typeof publishedDefaultRolloutField>().toEqualTypeOf<
      typeof DEFAULT_ROLLOUT_FIELD
    >();
  });
});
