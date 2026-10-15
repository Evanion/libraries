import { describe, expectTypeOf, it } from 'vitest';

import { adoptDecisions } from './adopt.js';
import type { AdoptOptions } from './adopt.js';
import type { DecisionSet } from './decision-set.js';
import type { DivergenceObserver, DivergenceReport } from './divergence.js';
import { createFeatures } from './features.js';
import type { DeepReadonly } from './observe.js';
import { serializeConfig } from './serialize.js';
import type { Decision, FeatureDefinition } from './types.js';

const definitions = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
  { key: 'banner', enabled: false },
] as const;

const features = createFeatures(definitions);

/** Definitions a control plane reads off rows, typed no narrower than the type. */
const wide: FeatureDefinition[] = [{ key: 'checkout-cta', enabled: true }];

describe('adoptDecisions', () => {
  it('takes a store built from a document and a set parsed off the wire', () => {
    const fromDocument = createFeatures(serializeConfig(createFeatures(wide)));
    const parsed = JSON.parse('{}') as DecisionSet;

    const adopted = adoptDecisions(fromDocument, parsed);

    expectTypeOf(adopted['checkout-cta']).toMatchTypeOf<
      Decision<string> | DeepReadonly<Decision<string>> | undefined
    >();
  });

  it('takes an observed store and the frozen set it snapshots', () => {
    const observed = createFeatures(definitions, { observe: () => undefined });

    const adopted = adoptDecisions(observed, observed.snapshot());

    expectTypeOf(adopted.cta.variant).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('answers no variant for a feature that declares none', () => {
    const adopted = adoptDecisions(features, undefined);

    expectTypeOf(adopted.banner).not.toHaveProperty('variant');
  });

  it('takes an observer written for every key', () => {
    const wide: DivergenceObserver = (report) => {
      expectTypeOf(report.key).toEqualTypeOf<string | undefined>();
    };

    adoptDecisions(features, undefined, { onDivergence: wide });
  });

  it('refuses an observer written for a key the store does not hold', () => {
    const narrow = (report: DivergenceReport<'promo'>): void => {
      void report;
    };

    // @ts-expect-error -- the store reports `cta` and `banner`, and this
    // observer accepts `promo` only.
    adoptDecisions(features, undefined, { onDivergence: narrow });
  });

  it('refuses a compare answer that is not a boolean', () => {
    // @ts-expect-error -- `compare` is a boolean the caller states.
    adoptDecisions(features, undefined, { compare: 'development' });
  });

  it('refuses a context that is not a record', () => {
    // @ts-expect-error -- a context is a record of fields, not a key.
    adoptDecisions(features, undefined, { context: 'u-1' });
  });

  it('refuses a context whose now is not a Date', () => {
    adoptDecisions(features, undefined, {
      // @ts-expect-error -- `now` is a `Date`, and the ISO string a set
      // carries is what `adoptDecisions` parses itself.
      context: { now: '2026-01-01T00:00:00Z' },
    });
  });

  it('refuses a store in the place of the set', () => {
    // @ts-expect-error -- the second argument is a set, not a store.
    adoptDecisions(features, features);
  });
});

describe('AdoptOptions', () => {
  it('defaults its key parameter to every key', () => {
    expectTypeOf<AdoptOptions['onDivergence']>().toEqualTypeOf<
      DivergenceObserver<string> | undefined
    >();
  });

  it('narrows the observer to the keys it is given', () => {
    expectTypeOf<
      Parameters<NonNullable<AdoptOptions<'cta'>['onDivergence']>>[0]['key']
    >().toEqualTypeOf<'cta' | undefined>();
  });

  it('holds every member optional', () => {
    expectTypeOf<Record<never, never>>().toMatchTypeOf<AdoptOptions>();
    expectTypeOf<AdoptOptions['compare']>().toEqualTypeOf<
      boolean | undefined
    >();
  });
});
