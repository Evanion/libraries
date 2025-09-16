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
        'URN contains invalid characters'
      );
    });

    it('should throw error if NID parameter contains an invalid character', () => {
      expect(() => URN.stringify('foo', 'b?r')).toThrow(InvalidError);
      expect(() => URN.stringify('foo', 'b?r')).toThrow(
        'NID contains invalid characters'
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
});
