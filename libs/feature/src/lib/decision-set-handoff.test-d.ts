import { describe, expectTypeOf, it } from 'vitest';

import { createFeatures } from './features.js';
import { resolvePlan } from './resolve-plan.js';
import type { DecisionSet, SnapshotOptions } from './decision-set.js';
import type { DivergenceObserver, DivergenceReport } from './divergence.js';
import type { DeepReadonly } from './observe.js';
import type { Decisions } from './types.js';

/**
 * The generic surface the handoff crosses.
 *
 * `snapshot.test-d.ts` reads the set a store answers. A consumer declares the
 * parameter it receives, and a prop typed `DecisionSet<S>` takes the set from
 * an observed store and from an unobserved one alike, which is what
 * `FeatureProviderProps.decisions` in `@evanion/react-feature` relies on.
 */

/** The schema one split implies. */
type Split = { cta: { variant: 'control' | 'blue'; value: never } };

/** A schema whose features are keyed on numbers. */
type Numbered = { 7: never; 11: never };

const definitions = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
] as const;

describe('DecisionSet', () => {
  it('reads the frozen form of the decisions for a frozen set', () => {
    expectTypeOf<DecisionSet<Split, true>['decisions']>().toEqualTypeOf<
      DeepReadonly<Decisions<Split>>
    >();
  });

  it('reads the decisions themselves for a set nothing froze', () => {
    expectTypeOf<DecisionSet<Split, false>['decisions']>().toEqualTypeOf<
      Decisions<Split>
    >();
  });

  it('takes the set an observed store answers where either freeze goes', () => {
    expectTypeOf<DecisionSet<Split, true>>().toExtend<DecisionSet<Split>>();
  });

  it('takes the set an unobserved store answers where either freeze goes', () => {
    expectTypeOf<DecisionSet<Split, false>>().toExtend<DecisionSet<Split>>();
  });

  it('refuses the frozen form where a mutable set is declared', () => {
    expectTypeOf<DecisionSet<Split, true>>().not.toExtend<
      DecisionSet<Split, false>
    >();
  });

  it('refuses a write to the version a set states', () => {
    const set: DecisionSet<Split> = {
      version: 'v1',
      now: '2026-11-01T00:00:00.000Z',
      origin: 'render',
      decisions: {} as Decisions<Split>,
    };

    expectTypeOf<DecisionSet<Split>['version']>().toEqualTypeOf<
      string | number | undefined
    >();
    // @ts-expect-error `version` is readonly
    set.version = 'v2';
  });

  it('refuses a write to the decisions member a set holds', () => {
    const set = createFeatures(definitions).snapshot();

    // @ts-expect-error `decisions` is readonly
    set.decisions = {} as never;
    expectTypeOf(set.decisions).not.toBeNever();
  });

  it('refuses a member the type never declared', () => {
    const set: DecisionSet<Split> = {
      now: '2026-11-01T00:00:00.000Z',
      origin: 'render',
      decisions: {} as Decisions<Split>,
      // @ts-expect-error `digest` is no member of a decision set
      digest: 'sha256-0',
    };

    expectTypeOf(set).toEqualTypeOf<DecisionSet<Split>>();
  });

  it('requires the instant, the origin and the decisions', () => {
    // @ts-expect-error a set states its instant, its origin and its decisions
    const set: DecisionSet<Split> = { version: 'v1' };

    expectTypeOf(set).toEqualTypeOf<DecisionSet<Split>>();
  });

  it('keys the decisions on a schema whose features are numbers', () => {
    expectTypeOf<keyof DecisionSet<Numbered>['decisions']>().toEqualTypeOf<
      7 | 11
    >();
  });
});

describe('SnapshotOptions', () => {
  it('refuses a write to the origin an options object states', () => {
    const options: SnapshotOptions = { origin: 'build' };

    // @ts-expect-error `origin` is readonly
    options.origin = 'render';
    expectTypeOf(options.origin).not.toBeNever();
  });

  it('takes an empty object, every member being optional', () => {
    expectTypeOf<Record<string, never>>().toExtend<SnapshotOptions>();
  });
});

describe('DivergenceObserver', () => {
  it('takes an async observer, a void answer admitting any answer', () => {
    expectTypeOf<
      (report: DivergenceReport) => Promise<void>
    >().toExtend<DivergenceObserver>();
  });

  it('takes an async observer where a store narrows the key', () => {
    const observer: DivergenceObserver<'cta'> = async () => {
      await Promise.resolve();
    };

    expectTypeOf(observer).toExtend<DivergenceObserver<'cta'>>();
  });

  it('takes an async observer on resolvePlan, which discards its rejection', () => {
    const features = createFeatures(definitions);

    expectTypeOf(
      resolvePlan(
        features,
        features.plan(),
        {},
        {
          onDivergence: async () => {
            await Promise.resolve();
          },
        },
      ),
    ).not.toBeNever();
  });
});

describe('the instant a set hands resolvePlan', () => {
  it('takes the instant a set states once a Date carries it', () => {
    const features = createFeatures(definitions);
    const set = features.snapshot();

    expectTypeOf(
      resolvePlan(features, features.plan(), {}, { now: new Date(set.now) }).cta
        .variant,
    ).toEqualTypeOf<'control' | 'blue' | undefined>();
  });

  it('refuses the instant a set states where a Date is declared', () => {
    const features = createFeatures(definitions);
    const set = features.snapshot();

    expectTypeOf(
      // @ts-expect-error a set states its instant as a string and `now` is a `Date`
      resolvePlan(features, features.plan(), {}, { now: set.now }),
    ).not.toBeNever();
  });

  it('narrows the observer of a typed store to the keys the store holds', () => {
    const features = createFeatures(definitions);
    const observer: DivergenceObserver<'cta'> = () => undefined;

    expectTypeOf(
      resolvePlan(features, features.plan(), {}, { onDivergence: observer }),
    ).not.toBeNever();
  });

  it('refuses an observer written for a key the store does not hold', () => {
    const features = createFeatures(definitions);
    const observer: DivergenceObserver<'hero'> = () => undefined;

    expectTypeOf(
      // @ts-expect-error the store holds `cta` and the observer reads `hero`
      resolvePlan(features, features.plan(), {}, { onDivergence: observer }),
    ).not.toBeNever();
  });
});
