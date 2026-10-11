import { describe, expectTypeOf, it } from 'vitest';

import { createFeatures } from './features.js';
import { resolvePlan } from './resolve-plan.js';
import type { ResolvePlanOptions } from './resolve-plan.js';
import type {
  Cause,
  Decision,
  PlanEntry,
  Reason,
  ToggleResult,
} from './types.js';

/**
 * The generic surface behind the explanation members and the toggle answer.
 *
 * `schema.test-d.ts` holds the `never` guard that `Decisions` and `Plan` map
 * each schema entry through. This file holds what each type promises on its
 * own: the members `Reason` admits, the defaults `Cause`, `PlanEntry` and
 * `ToggleResult` fall back to for a store built from JSON, and the narrowing a
 * caller reads a toggle answer through.
 */

const shop = () =>
  createFeatures([
    { key: 'new-checkout', enabled: true },
    { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  ] as const);

describe('Reason', () => {
  it('admits the five members the API reference lists and no others', () => {
    expectTypeOf<Reason>().toEqualTypeOf<
      | 'default-on'
      | 'rule-match'
      | 'explicitly-off'
      | 'no-rule-matched'
      | 'dependency-off'
    >();
  });

  it('refuses a member no decision path writes', () => {
    // @ts-expect-error -- the engine writes five reasons and this is not one.
    const reason: Reason = 'parent-off';
    expectTypeOf(reason).toEqualTypeOf<Reason>();
  });

  it('types the reason a decision carries as the whole union', () => {
    const features = shop();

    expectTypeOf(
      features.resolve()['express-pickup'].reason,
    ).toEqualTypeOf<Reason>();
  });
});

describe('Cause', () => {
  it('widens its key to the loose feature key with no argument', () => {
    expectTypeOf<Cause['key']>().toEqualTypeOf<string>();
    expectTypeOf<Cause['reason']>().toEqualTypeOf<Reason>();
  });

  it('types the rule it may name as an optional identifier', () => {
    expectTypeOf<Cause['rule']>().toEqualTypeOf<string | undefined>();
  });

  it('narrows its key to the argument a caller names', () => {
    expectTypeOf<
      Cause<'new-checkout'>['key']
    >().toEqualTypeOf<'new-checkout'>();
  });
});

describe('PlanEntry', () => {
  it('types the resolution as a boolean or the deferred marker', () => {
    expectTypeOf<PlanEntry['resolved']>().toEqualTypeOf<boolean | 'deferred'>();
  });

  it('types the outstanding fields as a readonly list of names', () => {
    expectTypeOf<PlanEntry['needs']>().toEqualTypeOf<readonly string[]>();
  });

  it('declares the decision optional on every entry, however it resolved', () => {
    // The presence of a decision is no proof that `resolved` is a boolean, so
    // no overload of the entry promises one.
    expectTypeOf<PlanEntry['decision']>().toEqualTypeOf<
      Decision<string, string, unknown> | undefined
    >();
  });

  it('refuses a resolution the engine never writes', () => {
    expectTypeOf<PlanEntry['resolved']>().not.toEqualTypeOf<
      boolean | 'deferred' | 'pending'
    >();
  });
});

describe('ToggleResult', () => {
  it('widens its key to the loose feature key with no argument', () => {
    expectTypeOf<ToggleResult['key']>().toEqualTypeOf<string>();
  });

  it('narrows the answer to the keys the store holds', () => {
    const features = shop();

    expectTypeOf(features.toggle('new-checkout', false)).toEqualTypeOf<
      ToggleResult<'new-checkout' | 'express-pickup'>
    >();
  });

  it('reaches willDisable only through the ok discriminant', () => {
    const features = shop();
    const result = features.toggle('new-checkout', false);

    // @ts-expect-error -- the refused arm carries `error` and no list.
    expectTypeOf(result.willDisable).not.toBeNever();
    if (!result.ok) return;
    expectTypeOf(result.willDisable).toEqualTypeOf<
      readonly ('new-checkout' | 'express-pickup')[]
    >();
  });

  it('reaches the error only through the ok discriminant', () => {
    const features = shop();
    const result = features.toggle('new-checkout', false);

    // @ts-expect-error -- the accepted arm carries `willDisable` and no error.
    expectTypeOf(result.error).not.toBeNever();
    if (result.ok) return;
    expectTypeOf(result.error).toEqualTypeOf<'unknown-feature'>();
  });

  it('declares the list readonly, so a caller cannot write the preview', () => {
    const features = shop();
    const result = features.toggle('new-checkout', false);

    if (!result.ok) return;
    // @ts-expect-error -- `willDisable` is a readonly array.
    result.willDisable.push('express-pickup');
    expectTypeOf(result.willDisable).not.toBeNever();
  });

  it('refuses a key the store does not hold', () => {
    const features = shop();

    expectTypeOf(
      // @ts-expect-error -- no feature is keyed `gift-wrap`.
      features.toggle('gift-wrap', false),
    ).not.toBeNever();
  });

  it('refuses a write that is not a boolean', () => {
    const features = shop();

    expectTypeOf(
      // @ts-expect-error -- `enabled` is a boolean, not a string.
      features.toggle('new-checkout', 'off'),
    ).not.toBeNever();
  });
});

describe('ResolvePlanOptions', () => {
  it('types the instant as an optional Date', () => {
    expectTypeOf<ResolvePlanOptions['now']>().toEqualTypeOf<Date | undefined>();
  });

  it('takes no member beyond the instant and the observer', () => {
    expectTypeOf<keyof ResolvePlanOptions>().toEqualTypeOf<
      'now' | 'onDivergence'
    >();
  });

  it('refuses a member no option names', () => {
    const features = shop();

    expectTypeOf(
      // @ts-expect-error -- `origin` belongs to a decision set, not to these.
      resolvePlan(features, {}, {}, { origin: 'build' }),
    ).not.toBeNever();
  });
});
