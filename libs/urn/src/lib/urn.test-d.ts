import { describe, it, expectTypeOf } from 'vitest';
import { URN } from './urn.js';
import { InvalidError, ValidationError } from './exceptions.js';
import type { IFullURN, ParsedURN } from './types.js';

describe('urn types', () => {
  it('parses to plain strings rather than caller-asserted literals', () => {
    const parsed = URN.parse('urn:user:123');
    expectTypeOf(parsed).toEqualTypeOf<ParsedURN>();
    expectTypeOf(parsed.urn).toEqualTypeOf<string>();
    expectTypeOf(parsed.nid).toEqualTypeOf<string>();
    expectTypeOf(parsed.nss).toEqualTypeOf<string>();
  });

  it('does not let a caller assert the parsed shape', () => {
    // parse used to declare three free type parameters that nothing verified,
    // so this claimed a shape the runtime never guaranteed.
    // @ts-expect-error parse takes no type arguments
    URN.parse<'urn', 'user', '123'>('urn:user:123');
  });

  it('returns a string from stringify', () => {
    expectTypeOf(URN.stringify('123')).toEqualTypeOf<string>();
  });

  it('types the predicates as booleans', () => {
    expectTypeOf(URN.isValidFormat('urn:a:b')).toEqualTypeOf<boolean>();
    expectTypeOf(
      URN.sameNamespace('urn:a:b', 'urn:a:c'),
    ).toEqualTypeOf<boolean>();
    expectTypeOf(
      URN.belongsToNamespace('urn:a:b', 'a'),
    ).toEqualTypeOf<boolean>();
    expectTypeOf(URN.extractId('urn:a:b')).toEqualTypeOf<string>();
  });

  it('keeps InvalidError assignable to ValidationError', () => {
    expectTypeOf<InvalidError>().toMatchTypeOf<ValidationError>();
    expectTypeOf<InvalidError['property']>().toEqualTypeOf<string>();
    expectTypeOf<InvalidError['value']>().toEqualTypeOf<string>();
    expectTypeOf<InvalidError['invalidChar']>().toEqualTypeOf<
      string | undefined
    >();
  });

  it('describes a URN literal with IFullURN', () => {
    expectTypeOf<
      IFullURN<'urn', 'user', string>
    >().toEqualTypeOf<`urn:user:${string}`>();

    const ok: IFullURN<'urn', 'user', string> = 'urn:user:123';
    expectTypeOf(ok).toMatchTypeOf<string>();

    // @ts-expect-error wrong namespace for this URN type
    const bad: IFullURN<'urn', 'user', string> = 'urn:order:123';
    void bad;
  });

  it('lets a subclass call inherited statics without a cast', () => {
    class TRN extends URN {
      static override readonly urn = 'trn';
      static override readonly nid = 'bar';
    }

    // These used to require `(TRN as typeof URN)` because the free type
    // parameters on parse broke static inheritance.
    expectTypeOf(TRN.stringify('foo')).toEqualTypeOf<string>();
    expectTypeOf(TRN.parse('trn:bar:foo')).toEqualTypeOf<ParsedURN>();
    expectTypeOf(
      TRN.belongsToNamespace('trn:bar:foo', 'bar'),
    ).toEqualTypeOf<boolean>();
  });
});
