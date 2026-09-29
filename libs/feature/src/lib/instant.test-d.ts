import { describe, expectTypeOf, it } from 'vitest';
import { validateConditions } from './conditions.js';
import { createFeatures } from './features.js';
import { instantEpoch } from './instant.js';
import type {
  Condition,
  FeatureDefinition,
  Instant,
  WindowCondition,
} from './types.js';

describe('Instant', () => {
  it('names the three forms a window value takes', () => {
    expectTypeOf<Instant>().toEqualTypeOf<string | number | Date>();
  });

  it('types the value of a window condition', () => {
    expectTypeOf<WindowCondition['value']>().toEqualTypeOf<Instant>();
  });

  it('keeps the value an Instant once the union is narrowed on op', () => {
    type Window = Extract<Condition, { op: 'before' | 'after' }>;

    expectTypeOf<Window['value']>().toEqualTypeOf<Instant>();
  });

  it('refuses a window on a field other than now', () => {
    // @ts-expect-error `before` belongs to the window condition, which reads
    // `now` and nothing else.
    const condition: Condition = {
      field: 'signedUpAt',
      op: 'before',
      value: '2026-01-01T00:00:00Z',
    };

    expectTypeOf(condition).toEqualTypeOf<Condition>();
  });
});

describe('instantEpoch', () => {
  it('answers a number for every form of Instant', () => {
    expectTypeOf(instantEpoch('2026-01-01T00:00:00Z')).toEqualTypeOf<number>();
    expectTypeOf(instantEpoch(1767225600000)).toEqualTypeOf<number>();
    expectTypeOf(instantEpoch(new Date())).toEqualTypeOf<number>();
  });

  it('refuses a value that is no instant', () => {
    // @ts-expect-error null is not one of the three forms.
    instantEpoch(null);
    // @ts-expect-error a boolean is not one of the three forms.
    instantEpoch(true);
    // @ts-expect-error nothing reads a list of instants.
    instantEpoch(['2026-01-01T00:00:00Z']);
  });
});

describe('validateConditions', () => {
  it('reads a definition on either kind of feature key and answers nothing', () => {
    const named: FeatureDefinition<'launch'> = { key: 'launch', enabled: true };
    const numbered: FeatureDefinition<number> = { key: 7, enabled: true };

    expectTypeOf(validateConditions(named)).toEqualTypeOf<void>();
    expectTypeOf(validateConditions(numbered)).toEqualTypeOf<void>();
  });
});

describe('createFeatures, over a window rule', () => {
  const features = createFeatures([
    {
      key: 'launch',
      enabled: true,
      rules: [
        {
          when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' }],
        },
      ],
    },
  ]);

  it('reads the key off a definition carrying a window rule', () => {
    expectTypeOf(features.isEnabled('launch')).toEqualTypeOf<boolean>();
  });

  it('refuses a key the definitions do not declare', () => {
    // @ts-expect-error nothing declares this key
    features.isEnabled('nope');
  });
});
