import { describe, expect, it } from 'vitest';

import { EmptyInputError, InvalidDictionaryError } from './exceptions.js';
import {
  ALTERNATING_CASE_DICTIONARY,
  DEFAULT_DICTIONARY,
  Luhn,
  createLuhn,
} from './luhn.js';

/**
 * Every worked example in README.md and in the doc comments, as an assertion.
 *
 * 2.0.0 changed the arithmetic and left the documented numbers at their 1.x
 * values, so the docs were wrong for two releases with nothing failing. A
 * number that appears in prose appears here too, and CI is what keeps the two
 * the same.
 */
describe('the documented examples', () => {
  describe('README: quick start', () => {
    it('createToken', () => {
      const randomString = 'justarandomstringofletters';
      const { checksum } = Luhn.generate(randomString);

      expect(`${randomString}-${checksum}`).toBe(
        'justarandomstringofletters-k',
      );
    });
  });

  describe('README: generate a checksum', () => {
    it('Luhn.generate("foo")', () => {
      expect(Luhn.generate('foo')).toEqual({
        phrase: 'foo',
        checksum: '5',
        filtered: 0,
      });
    });

    it('Luhn.generate("FoO")', () => {
      expect(Luhn.generate('FoO')).toEqual({
        phrase: 'foo',
        checksum: '5',
        filtered: 0,
      });
    });

    it('Luhn.generate("") throws', () => {
      expect(() => Luhn.generate('')).toThrow(EmptyInputError);
    });
  });

  describe('README: filtering', () => {
    it('Luhn.generate("foo-baz")', () => {
      expect(Luhn.generate('foo-baz')).toEqual({
        phrase: 'foobaz',
        checksum: 'p',
        filtered: 1,
      });
    });

    it('Luhn.generate("fooö-baz")', () => {
      expect(Luhn.generate('fooö-baz')).toEqual({
        phrase: 'foobaz',
        checksum: 'p',
        filtered: 2,
      });
    });
  });

  describe('README: validate a string', () => {
    it('Luhn.validate("foo5")', () => {
      expect(Luhn.validate('foo5')).toEqual({
        phrase: 'foo5',
        isValid: true,
        filtered: 0,
      });
    });

    it('Luhn.validate("FOO5")', () => {
      expect(Luhn.validate('FOO5')).toEqual({
        phrase: 'foo5',
        isValid: true,
        filtered: 0,
      });
    });

    it('Luhn.validate("FoO-ö5")', () => {
      expect(Luhn.validate('FoO-ö5')).toEqual({
        phrase: 'foo5',
        isValid: true,
        filtered: 2,
      });
    });

    it('Luhn.validate("bar5")', () => {
      expect(Luhn.validate('bar5')).toEqual({
        phrase: 'bar5',
        isValid: false,
        filtered: 0,
      });
    });

    it('Luhn.validate("") and friends', () => {
      expect(Luhn.validate('')).toEqual({
        phrase: '',
        isValid: false,
        filtered: 0,
      });
      expect(Luhn.validate('!!!!0')).toEqual({
        phrase: '0',
        isValid: false,
        filtered: 4,
      });
    });
  });

  describe('README: the dictionary', () => {
    it('the default', () => {
      expect(Luhn.dictionary).toBe('0123456789abcdefghijklmnopqrstuvwxyz');
      expect(Luhn.n).toBe(36);
      expect(Luhn.caseInsensitive).toBe(true);
      expect(Luhn.uniformOverBytes).toBe(false);
    });

    it('a custom dictionary', () => {
      const hex = createLuhn({ dictionary: '0123456789abcdef' });

      expect(hex.generate('cafe')).toEqual({
        phrase: 'cafe',
        checksum: '3',
        filtered: 0,
      });
      expect(hex.validate('cafe3').isValid).toBe(true);
    });

    it('an odd dictionary is rejected at construction', () => {
      expect(() => createLuhn({ dictionary: 'abc' })).toThrow(
        InvalidDictionaryError,
      );
    });

    it('a duplicate code point is rejected at construction', () => {
      expect(() => createLuhn({ dictionary: 'aabbccdd' })).toThrow(
        /repeated/,
      );
    });
  });

  describe('README: case sensitivity', () => {
    it('the alternating-case dictionary', () => {
      const sensitive = createLuhn({
        dictionary: ALTERNATING_CASE_DICTIONARY,
      });

      expect(sensitive.caseInsensitive).toBe(false);
      expect(sensitive.generate('FoO')).toEqual({
        phrase: 'FoO',
        checksum: 'K',
        filtered: 0,
      });
      expect(sensitive.validate('FoOK').isValid).toBe(true);
      expect(sensitive.validate('fook').isValid).toBe(false);
    });

    it('folding over a dictionary with case pairs is rejected', () => {
      expect(() =>
        createLuhn({
          dictionary: ALTERNATING_CASE_DICTIONARY,
          caseInsensitive: true,
        }),
      ).toThrow(/case pairs/);
    });
  });

  describe('README: mod-10', () => {
    const digits = createLuhn({ dictionary: '0123456789' });

    it('generates the textbook check digit', () => {
      expect(digits.generate('7992739871').checksum).toBe('3');
    });

    it('validates a card number', () => {
      expect(digits.validate('4539578763621486').isValid).toBe(true);
      expect(digits.validate('79927398710').isValid).toBe(false);
    });
  });

  describe('README: modulo bias', () => {
    it('the default dictionary is not uniform over bytes', () => {
      expect(Luhn.uniformOverBytes).toBe(false);
      expect(256 % Luhn.n).toBe(4);
    });

    it('a 32-character dictionary is', () => {
      expect(
        createLuhn({ dictionary: '0123456789abcdefghjkmnpqrstuvxyz' })
          .uniformOverBytes,
      ).toBe(true);
    });
  });

  describe('README: migration', () => {
    it('assignment to the default instance throws', () => {
      expect(() => {
        (Luhn as { dictionary: string }).dictionary = DEFAULT_DICTIONARY;
      }).toThrow(TypeError);
    });

    it('destructuring works', () => {
      const { generate } = Luhn;

      expect(generate('foo').checksum).toBe('5');
    });
  });

  describe('doc comments', () => {
    it('createLuhn', () => {
      const luhn = createLuhn({ dictionary: '0123456789' });

      expect(luhn.generate('7992739871')).toEqual({
        phrase: '7992739871',
        checksum: '3',
        filtered: 0,
      });
    });
  });
});
