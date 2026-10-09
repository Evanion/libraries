import { describe, expectTypeOf, it } from 'vitest';

import { createFeatures } from './features.js';
import { resolvePlan } from './resolve-plan.js';
import type { FeatureConfig } from './config.js';
import type { AsSchema } from './features.js';
import type {
  Decision,
  EvaluationContext,
  InferSchema,
  Plan,
  PlanEntry,
} from './types.js';

/**
 * The types a conformance fixture reads off disk arrives with.
 *
 * `conformance.spec.ts` hands `resolvePlan` a plan parsed out of
 * `conformance/plan-decisions.json` and a store built from the document beside
 * it. Neither carries a literal key, because `JSON.parse` answers the declared
 * type and the declared type is `FeatureConfig`. These cases pin what that
 * costs the reader, so a change to `InferSchema` or to `Plan` that makes the
 * fixture path stop compiling fails here, where the claim is written, rather
 * than inside a case about a document.
 */

/** The schema a served document infers: one entry per key, keyed on `string`. */
type Served = AsSchema<InferSchema<FeatureConfig['features']>>;

declare const config: FeatureConfig;
declare const fixturePlan: Partial<Plan<Served>>;
declare const fixtureContext: EvaluationContext;

describe('resolvePlan', () => {
  it('finishes a plan a fixture read off disk against a served document', () => {
    const decisions = resolvePlan(
      createFeatures(config),
      fixturePlan,
      fixtureContext,
    );

    expectTypeOf(decisions).toExtend<Record<string, Decision<string>>>();
  });

  it('answers an entry or nothing at every key a parsed plan names', () => {
    expectTypeOf(fixturePlan['checkout']).toExtend<
      PlanEntry<string> | undefined
    >();
    expectTypeOf(fixturePlan['checkout']).extract<undefined>().not.toBeNever();
  });

  it('declares the variant of a served document as an open string', () => {
    const decisions = resolvePlan(createFeatures(config), fixturePlan);

    // A document read at runtime carries no literal variant names, so the
    // fixture cannot be held to one by the compiler. Every case that names
    // `'bold'` or `'control'` is therefore a runtime assertion, which is why
    // `conformance.spec.ts` compares the published decisions as data.
    expectTypeOf(decisions['launch-banner']?.variant).toExtend<
      string | undefined
    >();
  });

  it('refuses a fixture instant that arrives as the string the file holds', () => {
    expectTypeOf(
      resolvePlan(createFeatures(config), fixturePlan, {
        // @ts-expect-error -- `now` is a `Date`; a fixture states ISO 8601.
        now: '2026-06-01T12:05:00.000Z',
      }),
    ).not.toBeNever();
  });
});
