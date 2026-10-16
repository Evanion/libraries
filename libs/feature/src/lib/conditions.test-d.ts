import { describe, expectTypeOf, it } from 'vitest';

import { evaluateCondition as publishedEvaluateCondition } from '../index.js';
import { evaluateCondition } from './conditions.js';
import { createFeatures } from './features.js';
import type {
  AttributeCondition,
  Condition,
  DayOfWeekCondition,
  Decisions,
  EvaluationContext,
  FeatureDefinition,
  FeatureKey,
  Instant,
  RuleOutcome,
  VariantInfo,
  Weekday,
  WindowCondition,
} from './types.js';

/**
 * The types a caller writes a rule in, and the one call that reads a single
 * condition.
 *
 * The values are in `conditions.spec.ts`. What is here is the surface a
 * consumer meets before anything runs: which member of the union an `op`
 * narrows to, which fields a context may carry, and what a numeric feature key
 * types the store it keys.
 */

/** A numeric key union, which is the form `FeatureKey` admits beside a string. */
enum Flag {
  PreorderBanner = 1,
  TradeInKiosk = 2,
}

describe('evaluateCondition', () => {
  it('takes one condition and one context', () => {
    expectTypeOf(evaluateCondition).parameters.toEqualTypeOf<
      [Condition, EvaluationContext]
    >();
  });

  it('answers a boolean and nothing wider', () => {
    expectTypeOf(evaluateCondition).returns.toEqualTypeOf<boolean>();
  });

  it('is the declaration the entry publishes', () => {
    expectTypeOf(publishedEvaluateCondition).toEqualTypeOf<
      typeof evaluateCondition
    >();
  });

  it('refuses an operator no member of the union declares', () => {
    // @ts-expect-error `gt` belongs to no member, so the literal matches none
    // of the three. The compiler is the only gate a condition a caller built
    // by hand meets, since `createFeatures` never saw it.
    evaluateCondition({ field: 'seats', op: 'gt', value: 5 }, {});
  });

  it('refuses a context that is not an object a field can be read off', () => {
    // @ts-expect-error a condition names a field, which a string has none of.
    evaluateCondition({ field: 'plan', op: 'eq', value: 'pro' }, 'pro');
  });
});

describe('Condition', () => {
  it('closes over the three members the engine dispatches on', () => {
    expectTypeOf<Condition>().toEqualTypeOf<
      WindowCondition | DayOfWeekCondition | AttributeCondition
    >();
  });

  it('names every operator the three members declare between them', () => {
    expectTypeOf<Condition['op']>().toEqualTypeOf<
      | 'before'
      | 'after'
      | 'day-of-week'
      | 'eq'
      | 'ne'
      | 'in'
      | 'not-in'
      | 'contains'
    >();
  });

  it('narrows to the day-of-week member on its operator', () => {
    expectTypeOf<
      Extract<Condition, { op: 'day-of-week' }>
    >().toEqualTypeOf<DayOfWeekCondition>();
  });

  it('narrows to the attribute member on the five operators it declares', () => {
    expectTypeOf<
      Extract<Condition, { op: 'eq' | 'ne' | 'in' | 'not-in' | 'contains' }>
    >().toEqualTypeOf<AttributeCondition>();
  });

  it('leaves a walk over op nothing to reach, which is what closes it', () => {
    // The union is closed because `evaluateCondition` dispatches on `op` and
    // `validateConfig` holds a serialized rule to these three shapes. A fourth
    // member gives the parameter below a type at the end of the walk and the
    // return stops compiling, which is where a consumer walking a rule finds
    // out.
    const walk = (condition: Condition): never => {
      switch (condition.op) {
        case 'before':
        case 'after':
        case 'day-of-week':
        case 'eq':
        case 'ne':
        case 'in':
        case 'not-in':
        case 'contains':
          throw new Error(String(condition.field));
      }

      return condition;
    };

    expectTypeOf(walk).returns.toEqualTypeOf<never>();
  });
});

describe('WindowCondition', () => {
  it('reads now and no other field', () => {
    expectTypeOf<WindowCondition['field']>().toEqualTypeOf<'now'>();
  });

  it('faces one of the two directions a window has', () => {
    expectTypeOf<WindowCondition['op']>().toEqualTypeOf<'before' | 'after'>();
  });
});

describe('DayOfWeekCondition', () => {
  it('reads now and no other field', () => {
    expectTypeOf<DayOfWeekCondition['field']>().toEqualTypeOf<'now'>();
  });

  it('holds the days as a readonly list of the Weekday names', () => {
    expectTypeOf<DayOfWeekCondition['value']>().toEqualTypeOf<
      readonly Weekday[]
    >();
  });

  it('takes the zone as a string, which no union narrows', () => {
    // Every IANA name is a legal zone and the list belongs to the host, not to
    // this library. `createFeatures` asks the runtime whether it formats one
    // and refuses a name it does not, which is a question no type can ask.
    expectTypeOf<DayOfWeekCondition['zone']>().toEqualTypeOf<string>();
  });

  it('requires the zone, which nothing defaults', () => {
    // @ts-expect-error a condition that names no zone does not type-check. UTC
    // day-of-week is wrong for every business rule anyone writes, so there is
    // nothing to default it to.
    const condition: DayOfWeekCondition = {
      field: 'now',
      op: 'day-of-week',
      value: ['mon'],
    };

    expectTypeOf(condition).toEqualTypeOf<DayOfWeekCondition>();
  });

  it('refuses a day written in any other spelling', () => {
    const condition: DayOfWeekCondition = {
      field: 'now',
      op: 'day-of-week',
      zone: 'UTC',
      // @ts-expect-error the seven names are short and lower-case. `Intl` is
      // asked for that spelling and the engine maps no other one.
      value: ['Monday'],
    };

    expectTypeOf(condition).toEqualTypeOf<DayOfWeekCondition>();
  });
});

describe('Weekday', () => {
  it('names the seven days in the short lower-case spelling', () => {
    expectTypeOf<Weekday>().toEqualTypeOf<
      'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
    >();
  });
});

describe('AttributeCondition', () => {
  it('names any context field, since the context is open', () => {
    expectTypeOf<AttributeCondition['field']>().toEqualTypeOf<string>();
  });

  it('compares with one of five operators', () => {
    expectTypeOf<AttributeCondition['op']>().toEqualTypeOf<
      'eq' | 'ne' | 'in' | 'not-in' | 'contains'
    >();
  });

  it('compares against a value of any type, which a document carries', () => {
    expectTypeOf<AttributeCondition['value']>().toEqualTypeOf<unknown>();
  });
});

describe('EvaluationContext', () => {
  it('types the clock field as an instant', () => {
    expectTypeOf<EvaluationContext['now']>().toEqualTypeOf<
      Instant | undefined
    >();
  });

  it('types the default bucketing field as a string', () => {
    expectTypeOf<EvaluationContext['targetingKey']>().toEqualTypeOf<
      string | undefined
    >();
  });

  it('types the prior assignments the library reads and never writes', () => {
    expectTypeOf<EvaluationContext['stickyVariants']>().toEqualTypeOf<
      Readonly<Record<string, string>> | undefined
    >();
  });

  it('admits a field of any name, which is the field a condition reads', () => {
    expectTypeOf<EvaluationContext['tier']>().toEqualTypeOf<unknown>();
  });

  it('takes the clock field written as the string a wire format carries', () => {
    // `JSON.parse` of a serialized context hands back the ISO 8601 string, and
    // `conditions.spec.ts` holds what every window and day-of-week condition
    // then answers.
    const context: EvaluationContext = { now: '2026-06-01T00:00:00Z' };

    expectTypeOf(context).toEqualTypeOf<EvaluationContext>();
  });

  it('takes a context written as an object literal or as a type alias', () => {
    type RequestContext = { userId: string; tier: string };

    expectTypeOf<RequestContext>().toExtend<EvaluationContext>();
  });

  it('refuses a context an application declared as an interface', () => {
    // TypeScript gives an implicit index signature to an object literal type
    // and to a type alias of one, and to neither an interface nor a class. A
    // framework adapter holding the application's own request type therefore
    // spreads it into a literal at the call site, which is what
    // `features.for(context)` has to take a position on.
    interface DeclaredContext {
      userId: string;
    }

    expectTypeOf<DeclaredContext>().not.toExtend<EvaluationContext>();
  });
});

describe('RuleOutcome', () => {
  it('names the rule it reports on', () => {
    expectTypeOf<RuleOutcome['rule']>().toEqualTypeOf<string>();
  });

  it('states whether the rule matched', () => {
    expectTypeOf<RuleOutcome['matched']>().toEqualTypeOf<boolean>();
  });

  it('carries the condition that failed, where one can be named', () => {
    expectTypeOf<RuleOutcome['failed']>().toEqualTypeOf<
      Condition | undefined
    >();
  });

  it('carries the bucket the rollout read, where the context held one', () => {
    expectTypeOf<RuleOutcome['rollout']>().toEqualTypeOf<
      | {
          percent: number;
          by: string;
          bucket?: number;
          member: boolean;
        }
      | undefined
    >();
  });
});

describe('FeatureKey', () => {
  it('keys a feature on a string or on a number', () => {
    expectTypeOf<FeatureKey>().toEqualTypeOf<string | number>();
  });

  it('types the instant a window compares against as the wider union', () => {
    expectTypeOf<Instant>().toExtend<string | number | Date>();
  });

  it('defaults a definition to a string key', () => {
    expectTypeOf<FeatureDefinition>().toEqualTypeOf<
      FeatureDefinition<string>
    >();
  });

  it('takes a numeric enum member as the key of a definition', () => {
    const definition: FeatureDefinition<Flag> = {
      key: Flag.PreorderBanner,
      enabled: true,
    };

    expectTypeOf(definition.key).toEqualTypeOf<Flag>();
  });

  it('reads a numeric key union off the definitions a store was built from', () => {
    const features = createFeatures([
      { key: Flag.PreorderBanner, enabled: true },
      { key: Flag.TradeInKiosk, enabled: false },
    ] as const);

    expectTypeOf(
      features.isEnabled(Flag.PreorderBanner),
    ).toEqualTypeOf<boolean>();
  });

  it('refuses a key the numeric definitions do not declare', () => {
    const features = createFeatures([
      { key: Flag.PreorderBanner, enabled: true },
    ] as const);

    // @ts-expect-error nothing declares this key, and a numeric union narrows
    // the same way a string one does.
    features.isEnabled(Flag.TradeInKiosk);
  });

  it('carries a numeric key union into Decisions through a schema', () => {
    type NumericSchema = Record<Flag, VariantInfo | never>;

    expectTypeOf<keyof Decisions<NumericSchema>>().toEqualTypeOf<Flag>();
  });

  it('refuses the numeric key union where Decisions reads a schema', () => {
    // @ts-expect-error `Decisions<S>` constrains `S` to
    // `Record<keyof S, VariantInfo | never>`, and the key union on its own
    // states no variant for any member of it.
    type Decided = Decisions<Flag>;

    expectTypeOf<Decided>().not.toBeNever();
  });
});
