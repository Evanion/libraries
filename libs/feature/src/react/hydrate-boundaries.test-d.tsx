import type { ReactElement } from 'react';
import { describe, expectTypeOf, it } from 'vitest';

import { createFeatures } from '../lib/features.js';
import { createFeatureContext, FeatureProvider } from './index.js';
import type { VersionMismatchPolicy } from './index.js';

/**
 * What the compiler accepts at the provider's three hydration props.
 *
 * `types.test-d.tsx` holds the two mounts the react page documents. This file
 * holds what each prop refuses: the bare decision record the prop took before
 * this shape landed, a policy outside the union, and a set built at another
 * store's schema.
 */

const definitions = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
  { key: 'banner', enabled: false },
] as const;

const features = createFeatures(definitions);
const other = createFeatures([{ key: 'promo', enabled: true }] as const);

describe('FeatureProvider', () => {
  it('refuses the bare decision record the prop took before', () => {
    const element: ReactElement = (
      <FeatureProvider
        features={features}
        // @ts-expect-error -- the prop takes the set `snapshot` answers, which
        // states the version and the instant a bare record does not carry.
        decisions={features.resolve({ targetingKey: 'u1' })}
      />
    );

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });

  it('refuses a set built at another store schema', () => {
    const element: ReactElement = (
      <FeatureProvider
        features={features}
        // @ts-expect-error -- no feature is keyed `promo`.
        decisions={other.snapshot()}
      />
    );

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });

  it('refuses a policy the union does not carry', () => {
    const element: ReactElement = (
      <FeatureProvider
        features={features}
        // @ts-expect-error -- the union holds two values and `reload` is not
        // one of them.
        onVersionMismatch="reload"
      />
    );

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });

  it('takes either policy the union carries', () => {
    const shipped: ReactElement = (
      <FeatureProvider features={features} onVersionMismatch="use-shipped" />
    );
    const resolved: ReactElement = (
      <FeatureProvider features={features} onVersionMismatch="re-resolve" />
    );

    expectTypeOf(shipped).toEqualTypeOf<ReactElement>();
    expectTypeOf(resolved).toEqualTypeOf<ReactElement>();
  });

  it('narrows a report key to the keys the store holds', () => {
    const element: ReactElement = (
      <FeatureProvider
        features={features}
        onDivergence={(report) => {
          expectTypeOf(report.key).toEqualTypeOf<
            'cta' | 'banner' | undefined
          >();
        }}
      />
    );

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });
});

describe('createFeatureContext', () => {
  it('narrows a report key on the bound provider too', () => {
    const bound = createFeatureContext(features);

    const element: ReactElement = (
      <bound.FeatureProvider
        onDivergence={(report) => {
          expectTypeOf(report.key).toEqualTypeOf<
            'cta' | 'banner' | undefined
          >();
        }}
      />
    );

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });

  it('refuses a bare decision record on the bound provider', () => {
    const bound = createFeatureContext(features);

    const element: ReactElement = (
      // @ts-expect-error -- the prop takes the set `snapshot` answers.
      <bound.FeatureProvider decisions={features.resolve()} />
    );

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });

  it('takes a set a store that freezes nothing produced, under a factory whose store freezes', () => {
    // Only one of the two mismatched sets is an error, for the reason the
    // `features` pair in `types.test-d.tsx` carries: TypeScript widens a
    // mutable `Decisions<S>` into `DeepReadonly<Decisions<S>>`, so this set
    // satisfies the frozen slot and the bound hooks type as readonly a map
    // nothing froze.
    const watched = createFeatures(definitions, { observe: () => undefined });
    const bound = createFeatureContext(watched);

    const element: ReactElement = (
      <bound.FeatureProvider decisions={features.snapshot()} />
    );

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });

  it('refuses a frozen set under a factory whose store freezes nothing', () => {
    const watched = createFeatures(definitions, { observe: () => undefined });
    const bound = createFeatureContext(features);

    const element: ReactElement = (
      // @ts-expect-error -- the bound hooks promise the mutable form and this
      // set carries frozen decisions.
      <bound.FeatureProvider decisions={watched.snapshot()} />
    );

    expectTypeOf(element).toEqualTypeOf<ReactElement>();
  });
});

describe('the policy union', () => {
  it('holds the two values and no third', () => {
    expectTypeOf<VersionMismatchPolicy>().toEqualTypeOf<
      'use-shipped' | 're-resolve'
    >();
  });
});
