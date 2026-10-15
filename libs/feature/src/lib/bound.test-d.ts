import { describe, expectTypeOf, it } from 'vitest';

import type { BoundFeatures } from './bound.js';
import type { DecisionSet } from './decision-set.js';
import { createFeatures } from './features.js';
import type { DeepReadonly } from './observe.js';
import type { Decisions, EvaluationContext, Plan, Schema } from './types.js';

describe('BoundFeatures', () => {
  it('answers the variant-name union from variantOf on a literal store', () => {
    const handle = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'blue', weight: 50 },
        ],
      },
    ] as const).for({ targetingKey: 'cust-0042' });

    expectTypeOf(handle.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('answers the deeply readonly form from resolve on a store carrying an observer', () => {
    const handle = createFeatures(
      [{ key: 'banner', enabled: false }] as const,
      {
        observe: () => undefined,
      },
    ).for();

    expectTypeOf(handle.resolve()).toEqualTypeOf<
      DeepReadonly<Decisions<{ banner: never }>>
    >();
  });

  it('carries no toggle', () => {
    const handle = createFeatures([{ key: 'banner', enabled: false }]).for();

    expectTypeOf(handle).not.toHaveProperty('toggle');
  });
});

describe('BoundFeatures, the surface the first cases leave out', () => {
  const literal = () =>
    createFeatures([
      { key: 'banner', enabled: false },
      {
        key: 'cta',
        enabled: true,
        variants: [
          { name: 'control', weight: 50, value: { label: 'Buy' } },
          { name: 'blue', weight: 50, value: { label: 'Get it' } },
        ],
      },
    ] as const);

  it('takes no context, or a context carrying the application’s own fields', () => {
    expectTypeOf(literal().for)
      .parameter(0)
      .toEqualTypeOf<EvaluationContext | undefined>();
    literal().for({ targetingKey: 'cust-0042', tier: 'gold' });
  });

  it('refuses a key the literal store does not hold', () => {
    const handle = literal().for();

    // @ts-expect-error 'gift-wrap' is not a key of this store
    handle.isEnabled('gift-wrap');
    // @ts-expect-error 'gift-wrap' is not a key of this store
    handle.variantOf('gift-wrap');
  });

  it('answers undefined from variantOf for a key declaring no variants', () => {
    expectTypeOf(
      literal().for().variantOf('banner'),
    ).toEqualTypeOf<undefined>();
  });

  it('refuses a write to the context property', () => {
    const handle = literal().for();

    // @ts-expect-error context is readonly
    handle.context = {};
  });

  it('answers the frozen plan and snapshot from a store carrying an observer', () => {
    const handle = createFeatures(
      [{ key: 'banner', enabled: false }] as const,
      { observe: () => undefined },
    ).for();

    expectTypeOf(handle.plan()).toEqualTypeOf<
      DeepReadonly<Plan<{ banner: never }>>
    >();
    expectTypeOf(handle.snapshot()).toEqualTypeOf<
      DecisionSet<{ banner: never }, true>
    >();
  });

  it('answers the mutable plan from a store with no observer', () => {
    expectTypeOf(
      createFeatures([{ key: 'banner', enabled: false }] as const)
        .for()
        .plan(),
    ).toEqualTypeOf<Plan<{ banner: never }>>();
  });

  it('defaults to the open schema and either freeze state', () => {
    expectTypeOf<BoundFeatures>().toEqualTypeOf<
      BoundFeatures<Schema, boolean>
    >();
  });
});
