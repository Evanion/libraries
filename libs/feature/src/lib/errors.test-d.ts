import { describe, expectTypeOf, it } from 'vitest';

import {
  DuplicateFeatureError as publishedDuplicateFeature,
  DuplicateVariantError as publishedDuplicateVariant,
  FeatureConfigError as publishedBase,
  FeatureCycleError as publishedCycle,
  UnknownDependencyError as publishedUnknownDependency,
  UnknownVariantError as publishedUnknownVariant,
} from '../index.js';
import {
  DuplicateFeatureError,
  DuplicateVariantError,
  FeatureConfigError,
  FeatureCycleError,
  UnknownDependencyError,
  UnknownVariantError,
} from './errors.js';
import type { FeatureKey } from './types.js';

/**
 * One member of a class with its `readonly` modifier taken off.
 *
 * `expectTypeOf` compares the stripped member against the member as declared,
 * and the two differ only where the declaration carries the modifier. A write
 * through `@ts-expect-error` would state the same thing, but TypeScript narrows
 * the property to the value the refused assignment held and every read after it
 * answers that narrowing instead of the declared type.
 */
type Mutable<T, K extends keyof T> = { -readonly [P in K]: T[P] };

/**
 * What a caller can read off a caught error without a cast.
 *
 * The reference page tells a reader to catch `FeatureConfigError` and then read
 * `path`, `key`, `dependency`, `feature` or `variant`. Which of those the
 * compiler lets them reach is the part of that instruction a runtime assertion
 * cannot state, so it is stated here.
 *
 * Two members carry a `FeatureKey` and two carry a `string`, and the split is
 * not decorative: `DuplicateVariantError.feature` holds `String(definition.key)`
 * and `UnknownDependencyError.key` holds the value the document wrote. A caller
 * comparing one of them against a numeric key it holds needs the types to say
 * which is which.
 */

describe('FeatureConfigError', () => {
  it('publishes the six classes the module declares', () => {
    expectTypeOf(publishedBase).toEqualTypeOf<typeof FeatureConfigError>();
    expectTypeOf(publishedCycle).toEqualTypeOf<typeof FeatureCycleError>();
    expectTypeOf(publishedUnknownDependency).toEqualTypeOf<
      typeof UnknownDependencyError
    >();
    expectTypeOf(publishedDuplicateFeature).toEqualTypeOf<
      typeof DuplicateFeatureError
    >();
    expectTypeOf(publishedDuplicateVariant).toEqualTypeOf<
      typeof DuplicateVariantError
    >();
    expectTypeOf(publishedUnknownVariant).toEqualTypeOf<
      typeof UnknownVariantError
    >();
  });

  it('is the one class every other five extend', () => {
    expectTypeOf<FeatureCycleError>().toExtend<FeatureConfigError>();
    expectTypeOf<UnknownDependencyError>().toExtend<FeatureConfigError>();
    expectTypeOf<DuplicateFeatureError>().toExtend<FeatureConfigError>();
    expectTypeOf<DuplicateVariantError>().toExtend<FeatureConfigError>();
    expectTypeOf<UnknownVariantError>().toExtend<FeatureConfigError>();
    expectTypeOf<FeatureConfigError>().toExtend<Error>();
  });

  it('carries no member of a subclass, so the catch block narrows before it reads', () => {
    const caught: unknown = new FeatureCycleError(['a', 'a']);

    if (!(caught instanceof FeatureConfigError)) return;
    expectTypeOf(caught).toEqualTypeOf<FeatureConfigError>();
    expectTypeOf(caught).toHaveProperty('message');
    // @ts-expect-error -- `path` belongs to `FeatureCycleError`; a caller that
    // wants it narrows to that class first.
    expectTypeOf(caught.path).toBeUnknown();
  });

  it('narrows from unknown to the subclass the walk raised', () => {
    const caught: unknown = new UnknownVariantError('cta', 'blue');

    if (!(caught instanceof UnknownVariantError)) return;
    expectTypeOf(caught).toEqualTypeOf<UnknownVariantError>();
    expectTypeOf(caught.variant).toEqualTypeOf<string>();
  });

  it('takes one message', () => {
    expectTypeOf(FeatureConfigError).toBeConstructibleWith('refused');
    expectTypeOf(FeatureConfigError).constructorParameters.toEqualTypeOf<
      [string]
    >();
  });
});

describe('FeatureCycleError', () => {
  it('answers `path` as a readonly walk of keys the caller may not edit', () => {
    expectTypeOf<FeatureCycleError['path']>().toEqualTypeOf<
      readonly FeatureKey[]
    >();
    expectTypeOf<FeatureCycleError['path']>().not.toEqualTypeOf<FeatureKey[]>();
  });

  it('declares `path` readonly, so the closed walk is not a buffer a caller edits', () => {
    expectTypeOf<Mutable<FeatureCycleError, 'path'>>().not.toEqualTypeOf<
      Pick<FeatureCycleError, 'path'>
    >();
  });

  it('takes a readonly walk, so a caller may hand it a frozen array', () => {
    const walk: readonly FeatureKey[] = Object.freeze(['a', 1, 'a']);

    expectTypeOf(FeatureCycleError).toBeConstructibleWith(walk);
    expectTypeOf(FeatureCycleError).toBeConstructibleWith([1, 2, 1]);
  });
});

describe('UnknownDependencyError', () => {
  it('answers both members at the key type a document may write', () => {
    expectTypeOf<UnknownDependencyError['key']>().toEqualTypeOf<FeatureKey>();
    expectTypeOf<
      UnknownDependencyError['dependency']
    >().toEqualTypeOf<FeatureKey>();
    expectTypeOf<FeatureKey>().toEqualTypeOf<string | number>();
  });

  it('takes a numeric key beside a string one', () => {
    expectTypeOf(UnknownDependencyError).toBeConstructibleWith(1, 'two');
    expectTypeOf(UnknownDependencyError).toBeConstructibleWith('one', 2);
  });

  it('declares both members readonly', () => {
    expectTypeOf<Mutable<UnknownDependencyError, 'key'>>().not.toEqualTypeOf<
      Pick<UnknownDependencyError, 'key'>
    >();
    expectTypeOf<
      Mutable<UnknownDependencyError, 'dependency'>
    >().not.toEqualTypeOf<Pick<UnknownDependencyError, 'dependency'>>();
  });
});

describe('DuplicateFeatureError', () => {
  it('answers `key` at the key type a document may write', () => {
    expectTypeOf<DuplicateFeatureError['key']>().toEqualTypeOf<FeatureKey>();
    expectTypeOf(DuplicateFeatureError).toBeConstructibleWith(7);
    expectTypeOf(DuplicateFeatureError).toBeConstructibleWith('seven');
  });
});

describe('DuplicateVariantError', () => {
  it('answers both members as strings, because a numeric key is spelled before it lands', () => {
    expectTypeOf<DuplicateVariantError['feature']>().toEqualTypeOf<string>();
    expectTypeOf<DuplicateVariantError['variant']>().toEqualTypeOf<string>();
    expectTypeOf<
      DuplicateVariantError['feature']
    >().not.toEqualTypeOf<FeatureKey>();
  });

  it('takes two strings, so a caller holding a numeric key spells it first', () => {
    expectTypeOf(DuplicateVariantError).toBeConstructibleWith('cta', 'control');
    expectTypeOf(DuplicateVariantError).constructorParameters.toEqualTypeOf<
      [string, string]
    >();
  });
});

describe('UnknownVariantError', () => {
  it('answers both members as strings, the way the duplicate does', () => {
    expectTypeOf<UnknownVariantError['feature']>().toEqualTypeOf<string>();
    expectTypeOf<UnknownVariantError['variant']>().toEqualTypeOf<string>();
  });

  // The two variant classes declare the same two members and `name` is `string`
  // on both, so TypeScript reads them as one type and a `switch` over `name`
  // narrows nothing. `instanceof` is what separates them in a process holding
  // one copy of the module, and the `name` string is what separates them in a
  // process holding two.
  it('carries the shape the duplicate carries, so only the class separates them in-type', () => {
    expectTypeOf<UnknownVariantError>().toEqualTypeOf<DuplicateVariantError>();
    expectTypeOf<UnknownVariantError['name']>().toEqualTypeOf<string>();
    expectTypeOf(UnknownVariantError).toBeConstructibleWith('cta', 'blue');
  });
});
