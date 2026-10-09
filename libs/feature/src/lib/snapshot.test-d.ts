import { describe, expectTypeOf, it } from 'vitest';

import { createFeatures } from './features.js';
import type {
  DecisionOrigin,
  DecisionSet,
  SnapshotOptions,
} from './decision-set.js';
import type { EvaluationContext, Schema } from './types.js';

describe('Features.snapshot', () => {
  const unobserved = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 50 },
        { name: 'blue', weight: 50 },
      ],
    },
  ] as const);

  it('answers a set over the schema the definitions supplied', () => {
    expectTypeOf(unobserved.snapshot().decisions.cta.variant).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('states the instant as a string and the origin as its two values', () => {
    expectTypeOf(unobserved.snapshot().now).toEqualTypeOf<string>();
    expectTypeOf(unobserved.snapshot().origin).toEqualTypeOf<
      'render' | 'build'
    >();
  });

  it('answers the frozen form for a store carrying an observer', () => {
    const observed = createFeatures(
      [{ key: 'banner', enabled: false }] as const,
      { observe: () => undefined },
    );

    expectTypeOf(observed.snapshot()).toExtend<
      DecisionSet<{ banner: never }, true>
    >();
  });
  it('answers a mutable set for a store carrying no observer', () => {
    const decisions = unobserved.snapshot().decisions;
    decisions.cta.enabled = false;

    expectTypeOf(decisions.cta.enabled).toEqualTypeOf<boolean>();
  });

  it('refuses a write to a decision a store carrying an observer answers', () => {
    const observed = createFeatures([{ key: 'banner', enabled: false }], {
      observe: () => undefined,
    });
    const decisions = observed.snapshot().decisions;

    // @ts-expect-error the observed form is deeply readonly
    decisions.banner.enabled = true;
    expectTypeOf(decisions.banner.enabled).toEqualTypeOf<boolean>();
  });

  it('refuses a write to the instant and the origin a set states', () => {
    const set = unobserved.snapshot();

    // @ts-expect-error `now` is readonly
    set.now = '2026-10-09T00:00:00.000Z';
    // @ts-expect-error `origin` is readonly
    set.origin = 'build';
    expectTypeOf(set.now).toEqualTypeOf<string>();
  });

  it('types the version as a string, a number or nothing', () => {
    expectTypeOf(unobserved.snapshot().version).toEqualTypeOf<
      string | number | undefined
    >();
  });

  it('names the two origins a set may state', () => {
    expectTypeOf<DecisionOrigin>().toEqualTypeOf<'render' | 'build'>();
  });

  it('types the origin an options object may carry', () => {
    expectTypeOf<SnapshotOptions['origin']>().toEqualTypeOf<
      DecisionOrigin | undefined
    >();
  });

  it('refuses an origin neither value names', () => {
    // @ts-expect-error 'ci' is no origin
    unobserved.snapshot({}, { origin: 'ci' });

    expectTypeOf(unobserved.snapshot({}, { origin: 'build' })).not.toBeNever();
  });

  it('refuses an options member the type never declared', () => {
    // @ts-expect-error `when` is no member of SnapshotOptions
    unobserved.snapshot({}, { origin: 'build', when: 1 });

    expectTypeOf(unobserved.snapshot({}, {})).not.toBeNever();
  });

  it('defaults its parameters to any schema and either freeze', () => {
    expectTypeOf<DecisionSet>().toEqualTypeOf<DecisionSet<Schema, boolean>>();
  });

  it('takes the context and the options each on its own', () => {
    expectTypeOf(unobserved.snapshot).parameters.toEqualTypeOf<
      [EvaluationContext?, SnapshotOptions?]
    >();
  });

  it('keys the decisions on the features the definitions named', () => {
    const set = unobserved.snapshot();

    // @ts-expect-error no definition named `absent`
    expectTypeOf(set.decisions.absent);
    expectTypeOf(set.decisions).toHaveProperty('cta');
  });
});
