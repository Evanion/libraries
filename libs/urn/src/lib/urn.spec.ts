import { describe, it, expect } from 'vitest';

import { InvalidError, ValidationError } from './exceptions.js';
import { decodeNss, encodeNss, URN } from './urn.js';

/**
 * Every `pchar` class plus `/`, and a percent-triplet, in one NSS. Starts with
 * a `pchar` because RFC 8141 forbids a leading `/`.
 */
const PCHAR_SOUP = "abc-._~!$&'()*+,;=:@/%C3%A9";

/** Builds a throwaway subclass so a URN can be round-tripped in its own namespace. */
function namespaceOf(urn: string, nid: string): typeof URN {
  return class extends URN {
    static override readonly urn = urn;
    static override readonly nid = nid;
  };
}

describe('URN', () => {
  describe('stringify', () => {
    it('should stringify basic URN', () => {
      expect(URN.stringify('foo')).toBe('urn:nid:foo');
    });

    it('should stringify with custom nid', () => {
      expect(URN.stringify('foo', 'bar')).toBe('urn:bar:foo');
    });

    it('should reject a scheme or NID that contains the separator', () => {
      expect(() => URN.stringify('foo', 'n:i')).toThrow(InvalidError);
      expect(() => URN.stringify('foo', 'n:i')).toThrow(
        "NID contains invalid character ':' in 'n:i'",
      );
      expect(() => URN.stringify('foo', 'nid', 'u:n')).toThrow(InvalidError);
      expect(() => URN.stringify('foo', 'nid', 'u:n')).toThrow(
        "URN contains invalid character ':' in 'u:n'",
      );
    });

    it('should accept an NSS that contains the separator', () => {
      // Split-then-rejoin on the same delimiter is lossless for the tail, so
      // the NSS can never structurally collide with the separator.
      expect(URN.stringify('a:b', 'nid')).toBe('urn:nid:a:b');
      expect(URN.parse('urn:nid:a:b').nss).toBe('a:b');
    });

    it('should no longer deduplicate an NSS that starts with the NID', () => {
      const UserURN = namespaceOf('urn', 'user');
      expect(UserURN.stringify('user:42')).toBe('urn:user:user:42');
      expect(UserURN.parse('urn:user:user:42').nss).toBe('user:42');
    });

    it('should keep a foreign namespace prefix verbatim in the NSS', () => {
      expect(URN.stringify('foo:bar', 'example')).toBe('urn:example:foo:bar');
    });

    it("should accept RFC 8141's own example NSS", () => {
      expect(URN.stringify('a123,z456', 'example')).toBe(
        'urn:example:a123,z456',
      );
    });

    it('should throw error if URN parameter contains an invalid character', () => {
      expect(() => URN.stringify('foo', 'bar', 'u!n')).toThrow(InvalidError);
      expect(() => URN.stringify('foo', 'bar', 'u!n')).toThrow(
        "URN contains invalid character '!' in 'u!n'",
      );
    });

    it('should throw error if NID parameter contains an invalid character', () => {
      expect(() => URN.stringify('foo', 'b?r')).toThrow(InvalidError);
      expect(() => URN.stringify('foo', 'b?r')).toThrow(
        "NID contains invalid character '?' in 'b?r'",
      );
    });

    it('should reject a scheme that does not start with a letter', () => {
      expect(() => URN.stringify('foo', 'bar', '1rn')).toThrow(InvalidError);
      expect(() => URN.stringify('foo', 'bar', '1rn')).toThrow(
        /URN is invalid in '1rn': must start with a letter/,
      );
    });
  });

  describe('NID grammar', () => {
    it('should accept lengths 2 through 32 on the write path', () => {
      expect(() => URN.stringify('x', 'ab')).not.toThrow();
      expect(() => URN.stringify('x', 'a'.repeat(32))).not.toThrow();
    });

    it('should reject a 1-character NID on the write path', () => {
      expect(() => URN.stringify('x', 'a')).toThrow(InvalidError);
      expect(() => URN.stringify('x', 'a')).toThrow(
        /NID is invalid in 'a': must be at least 2 characters long/,
      );
    });

    it('should reject a 33-character NID on both paths', () => {
      const long = 'a'.repeat(33);
      expect(() => URN.stringify('x', long)).toThrow(
        /NID is invalid in .*: must be at most 32 characters long/,
      );
      expect(URN.isValidFormat(`urn:${long}:x`)).toBe(false);
    });

    it('should reject a leading or trailing hyphen on both paths', () => {
      expect(() => URN.stringify('x', '-bad')).toThrow(
        /must not start or end with '-'/,
      );
      expect(() => URN.stringify('x', 'bad-')).toThrow(
        /must not start or end with '-'/,
      );
      expect(URN.isValidFormat('urn:-bad:x')).toBe(false);
      expect(URN.isValidFormat('urn:bad-:x')).toBe(false);
    });

    it("should reject '_', '.' and '~' in a NID on both paths", () => {
      for (const nid of ['my_ns', 'my.ns', 'my~ns']) {
        expect(() => URN.stringify('x', nid)).toThrow(InvalidError);
        expect(URN.isValidFormat(`urn:${nid}:x`)).toBe(false);
      }
    });

    it('should accept a 1-character NID on the read path only', () => {
      // RFC 2141 permitted a 1-character NID and RFC 8141 Appendix B keeps
      // earlier-valid URNs valid, so parse is lenient where stringify is not.
      expect(URN.parse('urn:x:1')).toEqual({
        urn: 'urn',
        nid: 'x',
        nss: 'x:1',
      });
      expect(URN.isValidFormat('urn:x:1')).toBe(true);
      expect(() => URN.stringify('1', 'x')).toThrow(InvalidError);
    });

    it('should expose the write grammar through nidGrammar', () => {
      expect(URN.nidGrammar.test('ab')).toBe(true);
      expect(URN.nidGrammar.test('a')).toBe(false);
      expect(URN.nidGrammar.test('a'.repeat(32))).toBe(true);
      expect(URN.nidGrammar.test('a'.repeat(33))).toBe(false);
      expect(URN.nidGrammar.test('')).toBe(false);
    });
  });

  describe('NSS grammar', () => {
    it('should accept the whole pchar set plus slash and percent-triplets', () => {
      expect(URN.nssGrammar.test(PCHAR_SOUP)).toBe(true);
      expect(() => URN.stringify(PCHAR_SOUP, 'example')).not.toThrow();
    });

    it('should reject a leading slash', () => {
      expect(URN.nssGrammar.test('/a')).toBe(false);
    });

    it('should reject characters outside pchar', () => {
      for (const nss of ['user#123', 'user 123', 'a?b', 'a[b', 'a"b', 'a\\b']) {
        expect(URN.nssGrammar.test(nss)).toBe(false);
        expect(() => URN.stringify(nss, 'example')).toThrow(InvalidError);
      }
    });

    it('should accept sub-delims, colon and at-sign that used to be rejected', () => {
      for (const nss of ['user@123', 'user$123', 'user!123', 'foo/bar']) {
        expect(() => URN.stringify(nss, 'example')).not.toThrow();
      }
    });

    it('should reject a malformed percent-triplet with a structural reason', () => {
      expect(() => URN.stringify('a%zz', 'example')).toThrow(
        /NSS is invalid in 'a%zz': contains a malformed percent-encoded octet/,
      );
      expect(() => URN.stringify('a%C', 'example')).toThrow(InvalidError);
    });

    it('should not encode or decode on the write path', () => {
      // stringify operates on the wire form: it validates, it never encodes.
      expect(() => URN.stringify('a b', 'example')).toThrow(InvalidError);
      expect(URN.stringify('a%20b', 'example')).toBe('urn:example:a%20b');
    });

    it('should return percent-triplets intact on the read path', () => {
      expect(URN.parse('urn:nid:a%20b').nss).toBe('a%20b');
    });
  });

  describe('scheme grammar', () => {
    it('should follow RFC 3986 under the default separator', () => {
      expect(URN.schemeGrammar.test('urn')).toBe(true);
      expect(URN.schemeGrammar.test('my-scheme')).toBe(true);
      expect(URN.schemeGrammar.test('a+b.c-d')).toBe(true);
      expect(URN.schemeGrammar.test('1rn')).toBe(false);
      expect(URN.schemeGrammar.test('')).toBe(false);
    });
  });

  describe('round-tripping', () => {
    it('should round-trip the full pchar set through stringify and parse', () => {
      const Example = namespaceOf('urn', 'example');
      expect(Example.parse(Example.stringify(PCHAR_SOUP)).nss).toBe(PCHAR_SOUP);
    });

    it('should round-trip an NSS containing the separator', () => {
      const Example = namespaceOf('urn', 'example');
      expect(Example.parse(Example.stringify('a:b:c')).nss).toBe('a:b:c');
    });

    it("should round-trip RFC 8141's own example URNs unchanged", () => {
      const cases = [
        'urn:example:a123,z456',
        'urn:example:A123,z456',
        'urn:example:a123%2Cz456',
        'urn:oasis:names:specification:docbook:dtd:xml:4.1.2',
        'urn:ietf:rfc:2648',
        'urn:isbn:0451450523',
        'urn:ISSN:0167-6423',
        'urn:nbn:de:bvb:19-146642',
      ];

      for (const original of cases) {
        const [, nid] = original.split(':') as [string, string];
        const Namespace = namespaceOf('urn', nid);
        const parsed = Namespace.parse(original);
        expect(Namespace.stringify(parsed.nss, parsed.nid, parsed.urn)).toBe(
          original,
        );
      }
    });

    it('should not be idempotent, and should say so honestly', () => {
      // stringify is not a normaliser: re-stringifying a URN nests it.
      expect(URN.stringify(URN.stringify('foo'))).toBe('urn:nid:urn:nid:foo');
    });
  });

  describe('class inheritance', () => {
    it('should derive from urn class', () => {
      class TRN extends URN {
        static override urn = 'trn';
      }
      expect(TRN.stringify('foo', 'bar')).toBe('trn:bar:foo');
    });

    it('should derive from urn class and set separator', () => {
      class TRN extends URN {
        static override readonly urn = 'trn';
        static override readonly separator = '-';
      }
      expect(TRN.stringify('foo', 'bar')).toBe('trn-bar-foo');
    });

    it('should derive from urn class and set nid', () => {
      class TRN extends URN {
        static override urn = 'trn';
      }

      class BarTRN extends TRN {
        static override readonly nid = 'bar';
      }
      expect(BarTRN.stringify('foo')).toBe('trn:bar:foo');
    });
  });

  describe('custom separator', () => {
    class Dash extends URN {
      static override readonly urn = 'trn';
      static override readonly separator = '-';
    }

    it('should exclude the separator from the scheme and the NID', () => {
      expect(Dash.nidGrammar.test('n-id')).toBe(false);
      expect(Dash.schemeGrammar.test('t-rn')).toBe(false);
      expect(() => Dash.stringify('ab', 'n-id')).toThrow(InvalidError);
      expect(() => Dash.stringify('ab', 'n-id')).toThrow(
        "NID contains invalid character '-' in 'n-id'",
      );
      expect(() => Dash.stringify('ab', 'nid', 't-rn')).toThrow(
        "URN contains invalid character '-' in 't-rn'",
      );
    });

    it('should drop the RFC length bounds for the scheme and the NID', () => {
      expect(() => Dash.stringify('ab', 'a')).not.toThrow();
      expect(() => Dash.stringify('ab', 'a'.repeat(40))).not.toThrow();
    });

    it('should keep the RFC pchar grammar for the NSS', () => {
      expect(Dash.nssGrammar.source).toBe(URN.nssGrammar.source);
      expect(Dash.stringify('a-b', 'nid')).toBe('trn-nid-a-b');
      expect(Dash.parse('trn-nid-a-b').nss).toBe('a-b');
      expect(Dash.stringify('a:b', 'nid')).toBe('trn-nid-a:b');
    });

    it('should round-trip through parse, extractId and isValidFormat', () => {
      class DashUser extends Dash {
        static override readonly nid = 'user';
      }
      expect(DashUser.stringify('a:b/c')).toBe('trn-user-a:b/c');
      expect(DashUser.parse('trn-user-a:b/c').nss).toBe('a:b/c');
      expect(DashUser.extractId('trn-user-a:b/c')).toBe('a:b/c');
      expect(DashUser.isValidFormat('trn-user-a:b/c')).toBe(true);
      expect(DashUser.isValidFormat('trn-user')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse URN and return all parts in object', () => {
      class BarTRN extends URN {
        static override urn = 'trn';
        static override readonly nid = 'bar';
      }

      expect(BarTRN.parse('trn:bar:foo')).toEqual({
        urn: 'trn',
        nid: 'bar',
        nss: 'foo',
      });
    });

    it('should retain a foreign NID in the NSS', () => {
      class BarTRN extends URN {
        static override urn = 'trn';
        static override readonly nid = 'bar';
      }

      expect(BarTRN.parse('trn:baz:foo')).toEqual({
        urn: 'trn',
        nid: 'baz',
        nss: 'baz:foo',
      });
    });

    it('should retain a foreign scheme in the NSS, verbatim', () => {
      class UserTRN extends URN {
        static override readonly urn = 'trn';
        static override readonly nid = 'user';
      }

      // The foreign scheme is kept as-is. Substituting this.urn here would
      // silently re-label the record, which is the bug in #11.
      expect(UserTRN.parse('ftp:user:1')).toEqual({
        urn: 'ftp',
        nid: 'user',
        nss: 'ftp:user:1',
      });
      expect(UserTRN.parse('trn:user:1')).toEqual({
        urn: 'trn',
        nid: 'user',
        nss: '1',
      });
    });

    it('should distinguish a foreign scheme from the class scheme', () => {
      class UserTRN extends URN {
        static override readonly urn = 'trn';
        static override readonly nid = 'user';
      }
      expect(UserTRN.parse('ftp:user:1').nss).not.toBe(
        UserTRN.parse('trn:user:1').nss,
      );
    });

    it('should return the original case', () => {
      // The scheme and NID match case-insensitively, so nothing is retained,
      // and the returned parts keep the case they were written in.
      expect(URN.parse('URN:NID:Foo')).toEqual({
        urn: 'URN',
        nid: 'NID',
        nss: 'Foo',
      });
    });

    it('should reject character-invalid input', () => {
      expect(() => URN.parse('urn:us er:hello')).toThrow(ValidationError);
      expect(() => URN.parse('urn:nid:hello world')).toThrow(ValidationError);
      expect(() => URN.parse('urn:my_ns:x')).toThrow(ValidationError);
      expect(() => URN.parse('1rn:nid:x')).toThrow(ValidationError);
    });
  });

  describe('utility methods', () => {
    describe('isValidFormat', () => {
      it('should return true for valid URN format', () => {
        expect(URN.isValidFormat('urn:user:123')).toBe(true);
        expect(URN.isValidFormat('custom:product:abc-123')).toBe(true);
        expect(URN.isValidFormat('my-scheme:namespace:id_with-dots')).toBe(
          true,
        );
      });

      it('should return false for invalid URN format', () => {
        expect(URN.isValidFormat('urn:user')).toBe(false); // Missing NSS
        expect(URN.isValidFormat('user:123')).toBe(false); // Missing URN scheme
        expect(URN.isValidFormat('urn::123')).toBe(false); // Empty NID
        expect(URN.isValidFormat('')).toBe(false); // Empty string
        expect(URN.isValidFormat('urn:us er:hello world!')).toBe(false);
        expect(URN.isValidFormat('urn:!!!:@@@')).toBe(false);
        expect(URN.isValidFormat('http://a:b')).toBe(false);
      });

      it('should agree with parse on every input', () => {
        const inputs = [
          'urn:user:123',
          'urn:example:a123,z456',
          'urn:example:foo/bar',
          'urn:x:1',
          'urn:user:',
          'urn:user',
          'urn::123',
          '',
          'urn:my_ns:x',
          'urn:-bad:x',
          `urn:${'a'.repeat(33)}:x`,
          'urn:nid:hello world',
          'urn:nid:a%zz',
          '1rn:nid:x',
        ];

        for (const input of inputs) {
          let parsed = true;
          try {
            URN.parse(input);
          } catch {
            parsed = false;
          }
          expect([input, URN.isValidFormat(input)]).toEqual([input, parsed]);
        }
      });
    });

    describe('extractId', () => {
      it('should extract the identifier from a URN', () => {
        expect(URN.extractId('urn:user:123')).toBe('123');
        expect(URN.extractId('custom:product:abc-123')).toBe('abc-123');
        expect(URN.extractId('my-scheme:namespace:id_with-dots')).toBe(
          'id_with-dots',
        );
      });

      it('should handle URNs with namespace in NSS', () => {
        expect(URN.extractId('urn:user:other:123')).toBe('other:123');
      });

      it('should throw on character-invalid input', () => {
        expect(() => URN.extractId('urn:my_ns:x')).toThrow(ValidationError);
      });
    });

    describe('sameNamespace', () => {
      it('should return true for URNs in the same namespace', () => {
        expect(URN.sameNamespace('urn:user:123', 'urn:user:456')).toBe(true);
        expect(
          URN.sameNamespace('custom:product:abc', 'custom:product:def'),
        ).toBe(true);
      });

      it('should fold the case of the scheme and the NID', () => {
        expect(URN.sameNamespace('URN:user:1', 'urn:user:1')).toBe(true);
        expect(URN.sameNamespace('urn:USER:1', 'urn:user:2')).toBe(true);
      });

      it('should return false for URNs in different namespaces', () => {
        expect(URN.sameNamespace('urn:user:123', 'urn:product:123')).toBe(
          false,
        );
        expect(URN.sameNamespace('urn:user:123', 'custom:user:123')).toBe(
          false,
        );
      });

      it('should return false for invalid URNs', () => {
        expect(URN.sameNamespace('invalid-urn', 'urn:user:123')).toBe(false);
        expect(URN.sameNamespace('urn:user:123', 'invalid-urn')).toBe(false);
      });
    });

    describe('belongsToNamespace', () => {
      it('should return true when URN belongs to specified namespace', () => {
        expect(URN.belongsToNamespace('urn:user:123', 'user')).toBe(true);
        expect(
          URN.belongsToNamespace('custom:product:abc', 'product', 'custom'),
        ).toBe(true);
      });

      it('should fold the case of the scheme and the NID', () => {
        expect(URN.belongsToNamespace('URN:user:1', 'user')).toBe(true);
        expect(URN.belongsToNamespace('urn:USER:1', 'user')).toBe(true);
        expect(URN.belongsToNamespace('urn:user:1', 'USER')).toBe(true);
      });

      it('should return false when URN does not belong to specified namespace', () => {
        expect(URN.belongsToNamespace('urn:user:123', 'product')).toBe(false);
        expect(
          URN.belongsToNamespace('custom:product:abc', 'product', 'urn'),
        ).toBe(false);
      });

      it('should return false for invalid URNs', () => {
        expect(URN.belongsToNamespace('invalid-urn', 'user')).toBe(false);
      });
    });

    describe('equals', () => {
      it('should fold the case of the scheme and the NID', () => {
        expect(URN.equals('URN:Example:a123', 'urn:example:a123')).toBe(true);
      });

      it('should compare the NSS byte for byte', () => {
        expect(URN.equals('urn:example:A123', 'urn:example:a123')).toBe(false);
      });

      it('should canonicalise percent-triplet hex digits to uppercase', () => {
        expect(
          URN.equals('urn:example:a123%2cz456', 'urn:example:a123%2Cz456'),
        ).toBe(true);
      });

      it('should not treat a percent-triplet as equal to the octet it encodes', () => {
        // RFC 8141 3.1: percent-encoded octets are not decoded for equivalence.
        expect(
          URN.equals('urn:example:a123%2Cz456', 'urn:example:a123,z456'),
        ).toBe(false);
      });

      it('should not be confused by the class own NID', () => {
        // parse folds a foreign NID into the NSS; equals must not compare that.
        expect(URN.equals('urn:user:1', 'URN:USER:1')).toBe(true);
        expect(URN.equals('urn:user:1', 'urn:user:2')).toBe(false);
      });

      it('should return false for malformed input rather than throwing', () => {
        expect(URN.equals('nope', 'urn:example:a')).toBe(false);
        expect(URN.equals('nope', 'nope')).toBe(false);
      });
    });
  });

  describe('percent-encoding helpers', () => {
    it('should encode everything outside the unreserved set', () => {
      expect(encodeNss('a b')).toBe('a%20b');
      expect(encodeNss('a/b')).toBe('a%2Fb');
      expect(encodeNss('café')).toBe('caf%C3%A9');
      expect(encodeNss('a-b._~')).toBe('a-b._~');
    });

    it('should produce an NSS the grammar accepts', () => {
      for (const raw of ['a b', 'café', 'a#b', '?', '/leading']) {
        expect(URN.nssGrammar.test(encodeNss(raw))).toBe(true);
      }
    });

    it('should round-trip through decodeNss', () => {
      for (const raw of ['a b', 'café', 'a#b?c/d', '100%', '😀']) {
        expect(decodeNss(encodeNss(raw))).toBe(raw);
      }
    });

    it('should decode triplets the library itself never produces', () => {
      expect(decodeNss('a123%2Cz456')).toBe('a123,z456');
      expect(decodeNss('a123%2cz456')).toBe('a123,z456');
    });

    it('should throw a ValidationError on a malformed percent sequence', () => {
      expect(() => decodeNss('a%zz')).toThrow(ValidationError);
      expect(() => decodeNss('a%C3')).toThrow(ValidationError);
    });
  });

  describe('malformed input', () => {
    it('should throw instead of leaking the string "undefined:" from parse', () => {
      expect(() => URN.parse('foo')).toThrow(ValidationError);
      expect(() => URN.parse('')).toThrow(ValidationError);
      expect(() => URN.parse('urn:user')).toThrow(ValidationError);
      expect(() => URN.parse('urn::123')).toThrow(ValidationError);
    });

    it('should name the offending input in the parse error', () => {
      expect(() => URN.parse('foo')).toThrow(/Invalid URN format: 'foo'/);
    });

    it('should throw a ValidationError, not a bare Error, from extractId', () => {
      expect(() => URN.extractId('urn:user')).toThrow(ValidationError);
    });

    it('should not report two identical malformed strings as the same namespace', () => {
      expect(URN.sameNamespace('invalid-urn', 'invalid-urn')).toBe(false);
      expect(URN.sameNamespace('', '')).toBe(false);
    });
  });

  describe('empty components', () => {
    it('should reject an empty NSS rather than emitting an unparseable URN', () => {
      expect(() => URN.stringify('')).toThrow(InvalidError);
      expect(() => URN.stringify('')).toThrow(/NSS must not be empty/);
    });

    it('should reject an empty NID and URN scheme', () => {
      expect(() => URN.stringify('foo', '')).toThrow(/NID must not be empty/);
      expect(() => URN.stringify('foo', 'nid', '')).toThrow(
        /URN must not be empty/,
      );
    });

    it('should not consider the empty string a valid component', () => {
      expect(URN.schemeGrammar.test('')).toBe(false);
      expect(URN.nidGrammar.test('')).toBe(false);
      expect(URN.nssGrammar.test('')).toBe(false);
    });
  });

  describe('subclass awareness', () => {
    class TRN extends URN {
      static override readonly urn = 'trn';
      static override readonly nid = 'bar';
    }

    it('should default belongsToNamespace to the subclass scheme', () => {
      expect(TRN.belongsToNamespace('trn:bar:foo', 'bar')).toBe(true);
      expect(TRN.belongsToNamespace('urn:bar:foo', 'bar')).toBe(false);
    });

    it('should still honour an explicit expectedUrn', () => {
      expect(TRN.belongsToNamespace('urn:bar:foo', 'bar', 'urn')).toBe(true);
    });

    it('should use the subclass separator when retaining a foreign nid', () => {
      class DashTRN extends URN {
        static override readonly urn = 'trn';
        static override readonly separator = '-';
        static override readonly nid = 'bar';
      }

      expect(DashTRN.parse('trn-baz-foo')).toEqual({
        urn: 'trn',
        nid: 'baz',
        nss: 'baz-foo',
      });
    });

    it('should not let the statics be destructured', () => {
      // Every static reads `this`, so unlike JSON.stringify they are unbound.
      // The failure comes from the default parameter `nid = this.nid`.
      const { stringify } = URN;
      expect(() => stringify('a')).toThrow(TypeError);
    });
  });

  describe('error hierarchy', () => {
    it('should expose InvalidError as a ValidationError', () => {
      const error = new InvalidError('NSS', 'a b', ' ');
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('InvalidError');
      expect(error.property).toBe('NSS');
      expect(error.value).toBe('a b');
      expect(error.invalidChar).toBe(' ');
    });

    it('should carry a structural reason when no single character is at fault', () => {
      try {
        URN.stringify('x', 'a');
        expect.unreachable('stringify should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidError);
        expect((error as InvalidError).invalidChar).toBeUndefined();
        expect((error as InvalidError).reason).toMatch(/at least 2 characters/);
      }
    });

    it('should fall back to a generic message when given neither', () => {
      // Not reachable from a library path; covered so the branch is not dead.
      expect(new InvalidError('NSS', 'abc').message).toBe(
        "NSS contains invalid characters in 'abc'",
      );
    });

    it('should let a single catch handle both error kinds', () => {
      const caught: string[] = [];
      for (const run of [
        () => URN.stringify('bad char'),
        () => URN.parse('nope'),
      ]) {
        try {
          run();
        } catch (error) {
          if (error instanceof ValidationError) caught.push(error.name);
        }
      }
      expect(caught).toEqual(['InvalidError', 'ValidationError']);
    });
  });
});
