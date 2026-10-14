import { describe, expectTypeOf, it } from 'vitest';

import type {
  DeepReadonly,
  FeatureEvent,
  FeatureOptions,
  FrozenWhenObserved,
  ReadonlyDate,
  UnobservedOptions,
} from './observe.js';
import { createFeatures } from './features.js';
import type { Decisions, FeatureKey, VariantInfo } from './types.js';

/**
 * The observation types used the way a declaration outside the library uses
 * them: with no type argument at all, and over the values a payload can hold.
 *
 * `observe.test-d.ts` names every one of these types over a schema it wrote,
 * which is the call site's view. A declaration is the other view. `FeatureEvent`,
 * `FeatureOptions` and `UnobservedOptions` each default `S` to the open form a
 * document carries, so `libs/feature/docs/examples.md` writes `FeatureEvent[]`
 * for the buffer an application drains and the API reference prints the default
 * in the signature a reader copies. Nothing held the defaults to answering
 * anything, and nothing held the three parts of `DeepReadonly`'s own cascade to
 * the mapping its docblock states.
 */

type Flags = {
  cta: { variant: 'control' | 'blue'; value: { label: string } };
};

/** What a decision's explanation can hold, which is where a `Date` appears. */
interface Payload {
  at: Date;
  rules: { failed: { field: string; value: Date } }[];
}

describe('FeatureEvent, named with no type argument', () => {
  it('keys the is-enabled member on every key a document can declare', () => {
    expectTypeOf<
      Extract<FeatureEvent, { type: 'is-enabled' }>['key']
    >().toEqualTypeOf<FeatureKey>();
  });

  it('carries the four reporting members the open form names', () => {
    expectTypeOf<FeatureEvent['type']>().toEqualTypeOf<
      'resolve' | 'is-enabled' | 'plan' | 'toggle'
    >();
  });

  it('holds an event a store built over a named schema reported', () => {
    expectTypeOf<FeatureEvent<Flags>>().toExtend<FeatureEvent>();
  });

  it('holds the event the inferring overload types an observer with', () => {
    const buffer: FeatureEvent[] = [];

    createFeatures([{ key: 'cta', enabled: true }] as const, {
      observe: (event) => {
        buffer.push(event);
      },
    });

    expectTypeOf(buffer).items.toExtend<FeatureEvent>();
  });
});

describe('FeatureOptions and UnobservedOptions, named with no type argument', () => {
  it('takes an observer over the open form of a schema', () => {
    expectTypeOf<FeatureOptions['observe']>().toEqualTypeOf<
      ((event: FeatureEvent) => void | Promise<unknown>) | undefined
    >();
  });

  it('defaults both to the schema a document with no named schema carries', () => {
    expectTypeOf<FeatureOptions>().toEqualTypeOf<
      FeatureOptions<Record<FeatureKey, VariantInfo | never>>
    >();
    expectTypeOf<UnobservedOptions>().toEqualTypeOf<
      UnobservedOptions<Record<FeatureKey, VariantInfo | never>>
    >();
  });

  it('accepts options omitting observe as proof of no observer', () => {
    expectTypeOf<{ version: string }>().toExtend<UnobservedOptions>();
  });

  it('refuses options carrying an observer as proof of no observer', () => {
    expectTypeOf<{
      observe: (event: FeatureEvent) => void;
    }>().not.toExtend<UnobservedOptions>();
  });

  it('refuses an observer the caller may or may not have passed', () => {
    expectTypeOf<{
      observe: ((event: FeatureEvent) => void) | undefined;
    }>().not.toExtend<UnobservedOptions>();
  });
});

describe('DeepReadonly, over the values an event payload carries', () => {
  it('maps a Date to the instant with no mutators', () => {
    expectTypeOf<DeepReadonly<Date>>().toEqualTypeOf<ReadonlyDate>();
  });

  it('keeps the call signature of a function it maps over', () => {
    expectTypeOf<DeepReadonly<(label: string) => number>>().toEqualTypeOf<
      (label: string) => number
    >();
  });

  it('maps every property readonly through an array of nested objects', () => {
    expectTypeOf<DeepReadonly<Payload>>().toEqualTypeOf<{
      readonly at: ReadonlyDate;
      readonly rules: readonly {
        readonly failed: {
          readonly field: string;
          readonly value: ReadonlyDate;
        };
      }[];
    }>();
  });

  it('distributes over a union the way the naked type parameter asks', () => {
    expectTypeOf<DeepReadonly<Date | string>>().toEqualTypeOf<
      ReadonlyDate | string
    >();
  });

  it('leaves a primitive, a null and an undefined as they were', () => {
    expectTypeOf<DeepReadonly<string>>().toEqualTypeOf<string>();
    expectTypeOf<DeepReadonly<null>>().toEqualTypeOf<null>();
    expectTypeOf<DeepReadonly<undefined>>().toEqualTypeOf<undefined>();
  });

  it('widens a tuple to a readonly array of what its positions held', () => {
    // The array branch reads `T extends readonly (infer E)[]`, which infers one
    // element type for every position, so the positions a tuple named are gone
    // from the mapped form. No payload the engine emits is a tuple: a decision
    // carries `rules` as an array and a variant value is the reader's own.
    expectTypeOf<DeepReadonly<[Date, string]>>().toEqualTypeOf<
      readonly (ReadonlyDate | string)[]
    >();
  });

  it('leaves a collection method on a value the reader chose callable', () => {
    // The function branch catches `Map.prototype.set` before the object branch
    // maps it, so the compiler accepts a write a reader makes through a `Map`
    // they put in a variant value. The engine refuses it at runtime, which
    // `observe.spec.ts` holds under `refuses a write through a Map the store
    // still holds`. A reader who wants the compiler to refuse it too puts a
    // plain object in the value.
    expectTypeOf<DeepReadonly<Map<string, string>>['set']>().toBeCallableWith(
      'title',
      'Bye',
    );
  });
});

describe('ReadonlyDate, over what a reader can do with the instant', () => {
  it('carries the readers of a Date and none of its writers', () => {
    expectTypeOf<ReadonlyDate>().toHaveProperty('getTime');
    expectTypeOf<ReadonlyDate>().toHaveProperty('toISOString');
    expectTypeOf<ReadonlyDate>().not.toHaveProperty('setTime');
    expectTypeOf<ReadonlyDate>().not.toHaveProperty('setUTCFullYear');
  });

  it('leaves the writers Readonly keeps, which is why the type exists', () => {
    expectTypeOf<Readonly<Date>>().toHaveProperty('setTime');
  });

  it('takes a Date and does not answer one', () => {
    expectTypeOf<Date>().toExtend<ReadonlyDate>();
    expectTypeOf<ReadonlyDate>().not.toExtend<Date>();
  });
});

describe('FrozenWhenObserved, over a Frozen the compiler settled and one it did not', () => {
  it('answers the deeply readonly form for a store that observes', () => {
    expectTypeOf<FrozenWhenObserved<true, Decisions<Flags>>>().toEqualTypeOf<
      DeepReadonly<Decisions<Flags>>
    >();
  });

  it('answers the type itself for a store that observes nothing', () => {
    expectTypeOf<FrozenWhenObserved<false, Decisions<Flags>>>().toEqualTypeOf<
      Decisions<Flags>
    >();
  });

  it('distributes to both forms when the compiler cannot settle Frozen', () => {
    expectTypeOf<FrozenWhenObserved<boolean, Decisions<Flags>>>().toEqualTypeOf<
      Decisions<Flags> | DeepReadonly<Decisions<Flags>>
    >();
  });
});
