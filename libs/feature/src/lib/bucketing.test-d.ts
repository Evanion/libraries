import { describe, expectTypeOf, it } from 'vitest';

import {
  DEFAULT_ROLLOUT_FIELD as publishedDefaultRolloutField,
  bucketOf as publishedBucketOf,
  inRollout as publishedInRollout,
  murmur3 as publishedMurmur3,
} from '../index.js';
import { bucketOf, inRollout, murmur3 } from './bucketing.js';
import { DEFAULT_ROLLOUT_FIELD } from './fields.js';
import type { EvaluationContext, RolloutSpec } from './types.js';

/**
 * The three bucketing primitives and the field constant, as a consumer meets
 * them before anything runs.
 *
 * The values are in `bucketing.spec.ts`. What is here is what the declarations
 * promise: text in, a number out, the seed optional on the hash and required on
 * the bucket, and a constant narrow enough to key a context literal with.
 */

describe('bucketOf', () => {
  it('takes a value and a seed, both text', () => {
    expectTypeOf(bucketOf).parameters.toEqualTypeOf<[string, string]>();
  });

  it('answers a number', () => {
    expectTypeOf(bucketOf).returns.toEqualTypeOf<number>();
  });

  it('requires the seed, which has no default to fall back on', () => {
    // @ts-expect-error -- a caller with one argument is bucketing against a
    // seed it never named, and `resolve` composes the seed from three members.
    bucketOf('cust-0101');
  });

  it('refuses a value the caller has not spelled as text', () => {
    // `assignVariant` calls `String(value)` before this, so the widening lives
    // at that call and not here. A numeric key reaching this function direct
    // would bucket apart from the store that spelled it.
    // @ts-expect-error -- a number is not a bucketing value.
    bucketOf(42, 'express-pickup');
  });
});

describe('inRollout', () => {
  it('takes a value, a percentage and a seed', () => {
    expectTypeOf(inRollout).parameters.toEqualTypeOf<
      [string, number, string]
    >();
  });

  it('answers a boolean', () => {
    expectTypeOf(inRollout).returns.toEqualTypeOf<boolean>();
  });

  it('takes the percentage a RolloutSpec declares', () => {
    const rollout: RolloutSpec = { percent: 25 };

    expectTypeOf(rollout.percent).toEqualTypeOf<number>();
    expectTypeOf(
      inRollout('cust-0101', rollout.percent, 'express-pickup'),
    ).toEqualTypeOf<boolean>();
  });
});

describe('murmur3', () => {
  it('takes text and an optional seed', () => {
    expectTypeOf(murmur3).parameters.toEqualTypeOf<
      [string, (number | undefined)?]
    >();
  });

  it('answers a number', () => {
    expectTypeOf(murmur3).returns.toEqualTypeOf<number>();
  });

  it('runs on the input alone', () => {
    expectTypeOf(murmur3('checkout-cta:variant')).toEqualTypeOf<number>();
  });
});

describe('DEFAULT_ROLLOUT_FIELD', () => {
  it('is the literal targetingKey and not a widened string', () => {
    // A consumer writes `{ [DEFAULT_ROLLOUT_FIELD]: id }` and reads the result
    // as a context. A widened declaration keys that literal on `string`, and
    // the member the store reads is no longer the one the literal wrote.
    //
    // Read off the declaration and not off the value. A const of a literal
    // type has a widening literal type, which `expectTypeOf`'s own type
    // parameter infers as `string` from the value position.
    expectTypeOf<
      typeof DEFAULT_ROLLOUT_FIELD
    >().toEqualTypeOf<'targetingKey'>();
  });

  it('keys a context literal at the field the store reads', () => {
    const context: EvaluationContext = {
      [DEFAULT_ROLLOUT_FIELD]: 'cust-0101',
    };

    expectTypeOf(context.targetingKey).toEqualTypeOf<string | undefined>();
  });
});

describe('the published declarations', () => {
  it('publishes each primitive at the declaration this file read', () => {
    // `index.ts` re-exports these three and the constant. A consumer reads the
    // package entry, and a re-export that widened or dropped one would leave
    // every assertion above passing against a declaration nobody can import.
    expectTypeOf(publishedBucketOf).toEqualTypeOf<typeof bucketOf>();
    expectTypeOf(publishedInRollout).toEqualTypeOf<typeof inRollout>();
    expectTypeOf(publishedMurmur3).toEqualTypeOf<typeof murmur3>();
    expectTypeOf<typeof publishedDefaultRolloutField>().toEqualTypeOf<
      typeof DEFAULT_ROLLOUT_FIELD
    >();
  });
});
