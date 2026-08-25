import { describe, it, expect } from 'vitest';

import { InvalidError, ValidationError } from './exceptions.js';
import { URN } from './urn.js';

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
        "URN contains invalid character '!' in 'u!n'",
      );
    });

    it('should throw error if NID parameter contains an invalid character', () => {
      expect(() => URN.stringify('foo', 'b?r')).toThrow(InvalidError);
      expect(() => URN.stringify('foo', 'b?r')).toThrow(
        "NID contains invalid character '?' in 'b?r'",
      );
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

    it("should parse URN and return all parts in object, but keep nid with nss if it's not the same generator", () => {
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
    });

    describe('sameNamespace', () => {
      it('should return true for URNs in the same namespace', () => {
        expect(URN.sameNamespace('urn:user:123', 'urn:user:456')).toBe(true);
        expect(
          URN.sameNamespace('custom:product:abc', 'custom:product:def'),
        ).toBe(true);
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
  });

  describe('RFC-compliant validation', () => {
    it('should allow RFC-compliant characters', () => {
      expect(() => URN.stringify('user-123', 'my-namespace')).not.toThrow();
      expect(() => URN.stringify('user_123', 'my.namespace')).not.toThrow();
      expect(() => URN.stringify('user~123', 'my.namespace')).not.toThrow();
    });

    it('should reject invalid characters', () => {
      expect(() => URN.stringify('user#123', 'namespace')).toThrow(
        InvalidError,
      );
      expect(() => URN.stringify('user@123', 'namespace')).toThrow(
        InvalidError,
      );
      expect(() => URN.stringify('user 123', 'namespace')).toThrow(
        InvalidError,
      );
      expect(() => URN.stringify('user!123', 'namespace')).toThrow(
        InvalidError,
      );
      expect(() => URN.stringify('user$123', 'namespace')).toThrow(
        InvalidError,
      );
    });
  });
  describe('malformed input', () => {
    it('should throw instead of leaking the string "undefined:" from parse', () => {
      // Previously returned { urn: 'foo', nid: undefined, nss: 'undefined:' }
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
      // Both used to parse to nid: undefined and compare equal.
      expect(URN.sameNamespace('invalid-urn', 'invalid-urn')).toBe(false);
      expect(URN.sameNamespace('', '')).toBe(false);
    });
  });

  describe('empty components', () => {
    it('should reject an empty NSS rather than emitting an unparseable URN', () => {
      // URN.stringify('') used to return 'urn:nid:', which isValidFormat rejects.
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
      expect(URN.isValid.test('')).toBe(false);
    });
  });

  describe('subclass awareness', () => {
    class TRN extends URN {
      static override readonly urn = 'trn';
      static override readonly nid = 'bar';
    }

    it('should default belongsToNamespace to the subclass scheme', () => {
      // Used to hardcode 'urn', so this returned false on any subclass.
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

      // The retained nid used to be joined with a hardcoded ':'.
      expect(DashTRN.parse('trn-baz-foo')).toEqual({
        urn: 'trn',
        nid: 'baz',
        nss: 'baz-foo',
      });
    });
  });

  describe('error hierarchy', () => {
    it('should expose InvalidError as a ValidationError', () => {
      const error = new InvalidError('NSS', 'a b', ' ');
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(Error);
      expect(error.property).toBe('NSS');
      expect(error.value).toBe('a b');
      expect(error.invalidChar).toBe(' ');
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
