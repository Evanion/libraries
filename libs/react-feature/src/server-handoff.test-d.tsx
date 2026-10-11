import { describe, expectTypeOf, it } from 'vitest';

import { createFeatures } from '@evanion/feature';
import type { DecisionSet } from '@evanion/feature';
import { createFeatureContext, FeatureProvider } from './index.js';

/**
 * The type the README's landing example teaches a reader to write.
 *
 * A prop crossing into a client module arrives through `JSON.parse`, which
 * answers `any`, so the annotation on the parsed value is the only statement
 * of what came back and nothing checks it against the store. These cases are
 * that check: a schema a reader writes out by hand has to accept the set the
 * store's own `snapshot` answers, and the provider has to refuse one that
 * names a key or a variant the store does not declare. A wrong annotation
 * compiles at the `JSON.parse` and fails nowhere, so the page would teach a
 * type the library does not hold.
 */

const shelves = createFeatures([
  {
    key: 'shelf-sort',
    enabled: true,
    variants: [
      { name: 'newest', weight: 50 },
      { name: 'popular', weight: 50 },
    ],
  },
]);

/** The schema as the README writes it: one key, its two variant names. */
type Shelves = DecisionSet<{
  'shelf-sort': { variant: 'newest' | 'popular' };
}>;

/** A variant name no definition in the store declares. */
type WrongVariant = DecisionSet<{
  'shelf-sort': { variant: 'newest' | 'cheapest' };
}>;

/** The key misspelled, which is the typo the annotation invites. */
type WrongKey = DecisionSet<{
  'shelf-order': { variant: 'newest' | 'popular' };
}>;

describe('FeatureProvider', () => {
  it('takes a hand-written set at the schema the store infers', () => {
    const live = shelves.snapshot({ targetingKey: 'sam' });

    expectTypeOf(live).toExtend<Shelves>();
  });

  it('takes the hand-written set on the decisions prop', () => {
    const sent = {} as Shelves;

    expectTypeOf(
      <FeatureProvider features={shelves} decisions={sent} />,
    ).not.toBeNever();
  });

  it('refuses a hand-written set naming a variant the store does not declare', () => {
    const sent = {} as WrongVariant;

    expectTypeOf(
      // @ts-expect-error -- the store declares `newest` and `popular`, and a
      // set promising `cheapest` publishes a variant no component can read.
      <FeatureProvider features={shelves} decisions={sent} />,
    ).not.toBeNever();
  });

  it('refuses a hand-written set naming a key the store does not declare', () => {
    const sent = {} as WrongKey;

    expectTypeOf(
      // @ts-expect-error -- no feature is keyed `shelf-order`.
      <FeatureProvider features={shelves} decisions={sent} />,
    ).not.toBeNever();
  });
});

describe('createFeatureContext', () => {
  it('narrows the variant a component switches on to the names the store declares', () => {
    const bound = createFeatureContext(shelves);

    expectTypeOf(bound.useVariant('shelf-sort').variant).toEqualTypeOf<
      'newest' | 'popular' | undefined
    >();
  });

  it('refuses a misspelled key on the hook a component calls', () => {
    const bound = createFeatureContext(shelves);

    expectTypeOf(bound.useVariant)
      // @ts-expect-error -- the store declares no `shelf-order`.
      .toBeCallableWith('shelf-order');
  });
});
