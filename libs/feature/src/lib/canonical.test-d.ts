import { describe, expectTypeOf, it } from 'vitest';
import { canonical, canonicalDocument } from './canonical.js';
import { canonical as publishedCanonical } from '../index.js';

describe('canonical', () => {
  it('returns a string for the four values JSON.stringify writes no text for', () => {
    // `JSON.stringify` answers `undefined` for `undefined`, a function and a
    // symbol, and throws for a `bigint`, while its own declaration promises a
    // `string`. Every one of the four reaches a branch here, so the declared
    // return holds for all of them.
    expectTypeOf(canonical(undefined)).toEqualTypeOf<string>();
    expectTypeOf(canonical(10n)).toEqualTypeOf<string>();
    expectTypeOf(canonical(Symbol('tier'))).toEqualTypeOf<string>();
    expectTypeOf(canonical(() => 1)).toEqualTypeOf<string>();
  });

  it('returns a string and not a literal a caller could switch on', () => {
    expectTypeOf(canonical).returns.toEqualTypeOf<string>();
  });

  it('takes a value of every type, so no caller narrows before the call', () => {
    expectTypeOf(canonical).parameters.toEqualTypeOf<[unknown]>();
  });

  it('takes one parameter, so no caller passes a replacer or an indent', () => {
    // @ts-expect-error -- the text is the function's own, and a second
    // argument would let two callers write two texts for one value and
    // disagree over a digest taken on either side of a transport.
    canonical({ tier: 'gold' }, 2);

    expectTypeOf(canonical).parameters.toEqualTypeOf<[unknown]>();
  });

  it('is published at the entry point at the type the module declares', () => {
    expectTypeOf(publishedCanonical).toEqualTypeOf(canonical);
  });
});

describe('canonicalDocument', () => {
  it('declares the signature canonical declares, so one call site swaps one for the other', () => {
    // The two differ at a non-finite number and nowhere in the types, which is
    // what lets `configDigest` read one text and `ruleId` the other over the
    // same value.
    expectTypeOf(canonicalDocument).toEqualTypeOf(canonical);
  });
});
