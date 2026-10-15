import { describe, expectTypeOf, it } from 'vitest';

import { adoptDecisions } from './adopt.js';
import type { AdoptOptions, VersionMismatchPolicy } from './adopt.js';
import { createFeatures } from './features.js';
import type { DeepReadonly } from './observe.js';
import type { Decisions } from './types.js';

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
const other = createFeatures([{ key: 'promo', enabled: true }] as const);

describe('adoptDecisions', () => {
  it('answers the variant union the definitions declare', () => {
    const adopted = adoptDecisions(features, features.snapshot());

    expectTypeOf(adopted.cta.variant).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('answers either form of the decision record', () => {
    type S = typeof features extends { resolve(): Decisions<infer T> }
      ? T
      : never;

    expectTypeOf(adoptDecisions(features, undefined)).toEqualTypeOf<
      Decisions<S> | DeepReadonly<Decisions<S>>
    >();
  });

  it('refuses a set built at another store schema', () => {
    // @ts-expect-error -- no feature is keyed `promo`.
    adoptDecisions(features, other.snapshot());
  });

  it('refuses the bare decision record a resolve answers', () => {
    // @ts-expect-error -- the set states the version and the instant a bare
    // record does not carry.
    adoptDecisions(features, features.resolve());
  });

  it('narrows a report key to the keys the store holds', () => {
    adoptDecisions(features, undefined, {
      onDivergence: (report) => {
        expectTypeOf(report.key).toEqualTypeOf<'cta' | 'banner' | undefined>();
      },
    });
  });

  it('refuses a policy the union does not carry', () => {
    // @ts-expect-error -- the union holds two values and `reload` is not one.
    adoptDecisions(features, undefined, { onVersionMismatch: 'reload' });
  });
});

describe('the policy union', () => {
  it('holds the two values and no third', () => {
    expectTypeOf<VersionMismatchPolicy>().toEqualTypeOf<
      'use-shipped' | 're-resolve'
    >();
  });

  it('is the type AdoptOptions takes', () => {
    expectTypeOf<AdoptOptions['onVersionMismatch']>().toEqualTypeOf<
      VersionMismatchPolicy | undefined
    >();
  });
});
