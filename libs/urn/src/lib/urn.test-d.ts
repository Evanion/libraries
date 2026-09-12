import { describe, it, expectTypeOf } from 'vitest';
import { decodeNss, encodeNss, URN } from './urn.js';
import { InvalidError, ValidationError } from './exceptions.js';
import type { IFullURN, ParsedURN, URNComponents, URNParts } from './types.js';

describe('urn types', () => {
  it('parses to plain strings rather than caller-asserted literals', () => {
    const parsed = URN.parse('urn:user:123');
    expectTypeOf(parsed).toEqualTypeOf<ParsedURN>();
    expectTypeOf(parsed.urn).toEqualTypeOf<string>();
    expectTypeOf(parsed.nid).toEqualTypeOf<string>();
    expectTypeOf(parsed.nss).toEqualTypeOf<string>();
  });

  it('does not let a caller assert the parsed shape', () => {
    // parse takes no type arguments: accepting them would let a caller assert
    // a shape nothing verifies, which the runtime does not guarantee.
    // @ts-expect-error parse takes no type arguments
    URN.parse<'urn', 'user', '123'>('urn:user:123');
  });

  it('returns a string from stringify', () => {
    expectTypeOf(URN.stringify('123')).toEqualTypeOf<string>();
  });

  it('types the r-, q- and f-components as optional strings', () => {
    const parsed = URN.parse('urn:example:foo?+r?=q#f');
    expectTypeOf(parsed.rComponent).toEqualTypeOf<string | undefined>();
    expectTypeOf(parsed.qComponent).toEqualTypeOf<string | undefined>();
    expectTypeOf(parsed.fComponent).toEqualTypeOf<string | undefined>();
    expectTypeOf<ParsedURN>().toMatchTypeOf<URNComponents>();
  });

  it('accepts a parsed URN as stringify input', () => {
    // The object overload is what makes parse and stringify inverses: the
    // positional form takes its arguments in the opposite order.
    expectTypeOf(URN.stringify(URN.parse('urn:a:b'))).toEqualTypeOf<string>();
    expectTypeOf(URN.stringify({ nss: 'b' })).toEqualTypeOf<string>();
    expectTypeOf<ParsedURN>().toMatchTypeOf<URNParts>();
  });

  it('requires an nss in the object form', () => {
    // @ts-expect-error the NSS is the one part with no class-level default
    URN.stringify({ nid: 'example' });
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
    expectTypeOf(URN.equals('urn:a:b', 'urn:a:b')).toEqualTypeOf<boolean>();
  });

  it('types the role-scoped grammars as regexes', () => {
    expectTypeOf(URN.schemeGrammar).toEqualTypeOf<RegExp>();
    expectTypeOf(URN.nidGrammar).toEqualTypeOf<RegExp>();
    expectTypeOf(URN.nssGrammar).toEqualTypeOf<RegExp>();
    expectTypeOf(URN.rComponentGrammar).toEqualTypeOf<RegExp>();
    expectTypeOf(URN.qComponentGrammar).toEqualTypeOf<RegExp>();
    expectTypeOf(URN.fComponentGrammar).toEqualTypeOf<RegExp>();
  });

  it('no longer exposes a single flat isValid regex', () => {
    // @ts-expect-error isValid was replaced by the three grammar getters
    void URN.isValid;
  });

  it('types the percent-encoding helpers as string to string', () => {
    expectTypeOf(encodeNss).toEqualTypeOf<(raw: string) => string>();
    expectTypeOf(decodeNss).toEqualTypeOf<(encoded: string) => string>();
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

    // @ts-expect-error IFullURN takes three type parameters, not four
    const dead: IFullURN<'urn', 'user', string, ''> = 'urn:user:123';
    void dead;

    // @ts-expect-error wrong namespace for this URN type
    const bad: IFullURN<'urn', 'user', string> = 'urn:order:123';
    void bad;
  });

  it('lets a subclass call inherited statics without a cast', () => {
    class TRN extends URN {
      static override readonly urn = 'trn';
      static override readonly nid = 'bar';
    }

    // Guards inherited statics from requiring a cast to `typeof URN`: free
    // type parameters on parse would otherwise break variance for subclasses.
    expectTypeOf(TRN.stringify('foo')).toEqualTypeOf<string>();
    expectTypeOf(TRN.parse('trn:bar:foo')).toEqualTypeOf<ParsedURN>();
    expectTypeOf(
      TRN.belongsToNamespace('trn:bar:foo', 'bar'),
    ).toEqualTypeOf<boolean>();
    expectTypeOf(TRN.nidGrammar).toEqualTypeOf<RegExp>();
  });
});
