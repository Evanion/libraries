import { describe, expect, it } from 'vitest';

import { InvalidDictionaryError } from './exceptions.js';
import { Luhn } from './luhn.js';

describe('Luhn', () => {
  describe('generate', () => {
    it('should generate a check character', () => {
      expect(Luhn.generate('justarandomstringofletters').checksum).toBe('e');
    });

    it('should filter out characters not in the dictionary', () => {
      expect(Luhn.generate('just-a-random-string-of-letters')).toEqual({
        phrase: 'justarandomstringofletters',
        checksum: 'e',
      });
    });

    it('should not be case sensitive by default', () => {
      expect(Luhn.generate('justARandomStringOfLetters').checksum).toBe('e');
    });

    it('should be case sensitive when asked', () => {
      expect(Luhn.generate('JUSTARANDOMSTRINGOFLETTERS', true).checksum).toBe(
        '0',
      );
    });
  });

  describe('validate', () => {
    it('should validate a string carrying its check character', () => {
      expect(Luhn.validate('justarandomstringofletterse').isValid).toBe(true);
    });

    it('should not be case sensitive by default', () => {
      expect(Luhn.validate('JUSTARANDOMSTRINGOFLETTERSe').isValid).toBe(true);
    });

    it('should be case sensitive when asked', () => {
      expect(Luhn.validate('JUSTARANDOMSTRINGOFLETTERS0', true).isValid).toBe(
        true,
      );
    });
  });

  describe('subclassing', () => {
    it('should let a subclass turn case sensitivity on globally', () => {
      class SensitiveLuhn extends Luhn {
        static override readonly sensitive = true;
      }

      expect(
        SensitiveLuhn.generate('justARandomStringOfLetters').checksum,
      ).toBe('J');
      expect(
        SensitiveLuhn.validate('justARandomStringOfLettersJ').isValid,
      ).toBe(true);
    });

    it('should let a subclass replace the dictionary', () => {
      class CustomLuhn extends Luhn {
        static override dictionary = 'abcdefghijklmnopqrstuvwxyz';
      }

      expect(Luhn.generate('justARandomStringOfLetters123').checksum).toBe('S');
      expect(
        CustomLuhn.generate('justARandomStringOfLetters123').checksum,
      ).toBe('v');

      expect(
        CustomLuhn.validate('justARandomStringOfLetters123v').isValid,
      ).toBe(true);
      expect(CustomLuhn.validate('justARandomStringOfLettersk').isValid).toBe(
        false,
      );
    });

    it('should reject a dictionary of odd length', () => {
      class TestLuhn extends Luhn {
        static override dictionary = 'abcfo';
      }

      expect(() => TestLuhn.generate('ab')).toThrow(InvalidDictionaryError);
    });
  });
});
