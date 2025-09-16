import { describe, it, expect } from 'vitest';

import { InvalidError } from './exceptions';
import { URN } from './urn';

describe('URN', () => {
  describe('stringify', () => {
    it('should stringify basic URN', () => {
      expect(URN.stringify('foo')).toBe('urn:nid:foo');
    });

    it('should stringify with custom nid', () => {
      expect(URN.stringify('foo', 'bar')).toBe('urn:bar:foo');
    });

    it('should not duplicate nid', () => {
      expect(URN.stringify('bar:foo', 'bar')).toBe('urn:bar:foo');
    });

    it('should throw error if URN parameter contains an invalid character', () => {
      expect(() => URN.stringify('foo', 'bar', 'u!n')).toThrow(InvalidError);
      expect(() => URN.stringify('foo', 'bar', 'u!n')).toThrow(
        "URN contains invalid character '!' in 'u!n'"
      );
    });

    it('should throw error if NID parameter contains an invalid character', () => {
      expect(() => URN.stringify('foo', 'b?r')).toThrow(InvalidError);
      expect(() => URN.stringify('foo', 'b?r')).toThrow(
        "NID contains invalid character '?' in 'b?r'"
      );
    });
  });

  describe('class inheritance', () => {
    it('should derive from urn class', () => {
      class TRN extends URN {
        static urn = 'trn';
      }
      expect((TRN as typeof URN).stringify('foo', 'bar')).toBe('trn:bar:foo');
    });

    it('should derive from urn class and set separator', () => {
      class TRN extends URN {
        static readonly urn = 'trn';
        static readonly separator = '-';
      }
      expect((TRN as typeof URN).stringify('foo', 'bar')).toBe('trn-bar-foo');
    });

    it('should derive from urn class and set nid', () => {
      class TRN extends URN {
        static urn = 'trn';
      }

      class BarTRN extends TRN {
        static readonly nid = 'bar';
      }
      expect((BarTRN as typeof URN).stringify('foo')).toBe('trn:bar:foo');
    });
  });

  describe('parse', () => {
    it('should parse URN and return all parts in object', () => {
      class BarTRN extends URN {
        static urn = 'trn';
        static readonly nid = 'bar';
      }

      expect((BarTRN as typeof URN).parse('trn:bar:foo')).toEqual({
        urn: 'trn',
        nid: 'bar',
        nss: 'foo',
      });
    });

    it("should parse URN and return all parts in object, but keep nid with nss if it's not the same generator", () => {
      class BarTRN extends URN {
        static urn = 'trn';
        static readonly nid = 'bar';
      }

      expect((BarTRN as typeof URN).parse('trn:baz:foo')).toEqual({
        urn: 'trn',
        nid: 'baz',
        nss: 'baz:foo',
      });
    });
  });

  describe('utility methods', () => {
    describe('isValidFormat', () => {
      it('should return true for valid URN format', () => {
        expect(URN.isValidFormat('urn:user:123')).toBe(true);
        expect(URN.isValidFormat('custom:product:abc-123')).toBe(true);
        expect(URN.isValidFormat('my-scheme:namespace:id_with-dots')).toBe(
          true
        );
      });

      it('should return false for invalid URN format', () => {
        expect(URN.isValidFormat('urn:user')).toBe(false); // Missing NSS
        expect(URN.isValidFormat('user:123')).toBe(false); // Missing URN scheme
        expect(URN.isValidFormat('urn::123')).toBe(false); // Empty NID
        expect(URN.isValidFormat('')).toBe(false); // Empty string
      });
    });

    describe('extractId', () => {
      it('should extract the identifier from a URN', () => {
        expect(URN.extractId('urn:user:123')).toBe('123');
        expect(URN.extractId('custom:product:abc-123')).toBe('abc-123');
        expect(URN.extractId('my-scheme:namespace:id_with-dots')).toBe(
          'id_with-dots'
        );
      });

      it('should handle URNs with namespace in NSS', () => {
        expect(URN.extractId('urn:user:other:123')).toBe('other:123');
      });
    });

    describe('sameNamespace', () => {
      it('should return true for URNs in the same namespace', () => {
        expect(URN.sameNamespace('urn:user:123', 'urn:user:456')).toBe(true);
        expect(
          URN.sameNamespace('custom:product:abc', 'custom:product:def')
        ).toBe(true);
      });

      it('should return false for URNs in different namespaces', () => {
        expect(URN.sameNamespace('urn:user:123', 'urn:product:123')).toBe(
          false
        );
        expect(URN.sameNamespace('urn:user:123', 'custom:user:123')).toBe(
          false
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
          URN.belongsToNamespace('custom:product:abc', 'product', 'custom')
        ).toBe(true);
      });

      it('should return false when URN does not belong to specified namespace', () => {
        expect(URN.belongsToNamespace('urn:user:123', 'product')).toBe(false);
        expect(
          URN.belongsToNamespace('custom:product:abc', 'product', 'urn')
        ).toBe(false);
      });

      it('should return false for invalid URNs', () => {
        expect(URN.belongsToNamespace('invalid-urn', 'user')).toBe(false);
      });
    });
  });

  describe('RFC-compliant validation', () => {
    it('should allow RFC-compliant characters', () => {
      expect(() => URN.stringify('user-123', 'my-namespace')).not.toThrow();
      expect(() => URN.stringify('user_123', 'my.namespace')).not.toThrow();
      expect(() => URN.stringify('user~123', 'my.namespace')).not.toThrow();
    });

    it('should reject invalid characters', () => {
      expect(() => URN.stringify('user#123', 'namespace')).toThrow(
        InvalidError
      );
      expect(() => URN.stringify('user@123', 'namespace')).toThrow(
        InvalidError
      );
      expect(() => URN.stringify('user 123', 'namespace')).toThrow(
        InvalidError
      );
      expect(() => URN.stringify('user!123', 'namespace')).toThrow(
        InvalidError
      );
      expect(() => URN.stringify('user$123', 'namespace')).toThrow(
        InvalidError
      );
    });
  });
});
