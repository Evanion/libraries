import { createLuhn } from '@evanion/luhn';
import { describe, expect, it } from 'vitest';

import { InvalidAlphabetError, InvalidShapeError } from './exceptions.js';
import {
  CONFUSABLE_CHARACTERS,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_DICTIONARY,
  DEFAULT_LENGTH,
  DEFAULT_SEPARATOR,
  createToken,
} from './token.js';

/**
 * Every worked example in README.md and in the doc comments, as an assertion.
 *
 * A check character cannot be read off a page and cannot be guessed — it is
 * the output of a fold over a specific alphabet in a specific order. A
 * documented code with a made-up check character is a lie that ships, and this
 * file is what stops it.
 *
 * `generate` is random, so the documented outputs are pinned through
 * `validate`, which is the half that is deterministic.
 */
describe('the documented examples', () => {
  const token = createToken();

  describe('README: quick start', () => {
    it("token.validate('a4kp-9mxa')", () => {
      expect(token.validate('a4kp-9mxa')).toEqual({
        valid: true,
        body: 'a4kp9mx',
      });
    });

    it('the generate() result shown alongside it', () => {
      // value 'a4kp-9mxa', body 'a4kp9mx', check 'a'.
      expect(token.validate('a4kp9mx' + 'a').valid).toBe(true);
      expect(`${'a4kp9mx'.slice(0, 4)}-${'a4kp9mx'.slice(4)}a`).toBe(
        'a4kp-9mxa',
      );
    });
  });

  describe('README: generate a code', () => {
    it("the prefixed form is 'ORD-a4kp-9mxa'", () => {
      expect(['ORD', 'a4kp-9mxa'].join(DEFAULT_SEPARATOR)).toBe(
        'ORD-a4kp-9mxa',
      );
      expect(token.validate('a4kp-9mxa').valid).toBe(true);
    });
  });

  describe('README: validate a code', () => {
    it('the four documented outcomes', () => {
      expect(token.validate('a4kp-9mxa')).toEqual({
        valid: true,
        body: 'a4kp9mx',
      });
      expect(token.validate('a4kp-9mx8')).toEqual({
        valid: false,
        reason: 'check-failed',
      });
      expect(token.validate('a4kp-9mxo')).toEqual({
        valid: false,
        reason: 'outside-alphabet',
      });
      expect(token.validate('a4kp-9mx')).toEqual({
        valid: false,
        reason: 'wrong-length',
      });
    });

    it('one code in n passes by construction', () => {
      const passing = [...DEFAULT_DICTIONARY].filter(
        (candidate) => token.validate(`a4kp9mx${candidate}`).valid,
      );

      expect(passing).toEqual(['a']);
      expect(token.n).toBe(32);
    });
  });

  describe('README: what the check character catches', () => {
    it('catches every single-character substitution', () => {
      const code = 'a4kp9mxa';

      for (let at = 0; at < code.length; at++) {
        for (const replacement of DEFAULT_DICTIONARY) {
          if (replacement === code[at]) continue;

          expect(
            token.validate(code.slice(0, at) + replacement + code.slice(at + 1))
              .valid,
          ).toBe(false);
        }
      }
    });

    it('misses a swap of `0` and `z`, and nothing else adjacent', () => {
      const missed = new Set<string>();
      const digits = [...DEFAULT_DICTIONARY];

      // Every unordered pair, placed adjacent in an otherwise fixed body.
      for (let left = 0; left < digits.length; left++) {
        for (let right = left + 1; right < digits.length; right++) {
          const body = `abc${digits[left]}${digits[right]}de`;
          const check = digits.find(
            (candidate) => token.validate(body + candidate).valid,
          ) as string;
          const swapped = `abc${digits[right]}${digits[left]}de${check}`;

          if (token.validate(swapped).valid) {
            missed.add(`${digits[left]}${digits[right]}`);
          }
        }
      }

      expect([...missed]).toEqual(['0z']);
    });

    it('the first and last dictionary entries are `0` and `z`', () => {
      expect(DEFAULT_DICTIONARY.at(0)).toBe('0');
      expect(DEFAULT_DICTIONARY.at(-1)).toBe('z');
    });
  });

  describe('README: separators are presentation', () => {
    it('a code validates however it is grouped, and in capitals', () => {
      expect(token.validate('a4kp9mxa').valid).toBe(true);
      expect(token.validate('a4-kp-9m-xa').valid).toBe(true);
      expect(token.validate('A4KP-9MXA')).toEqual({
        valid: true,
        body: 'a4kp9mx',
      });
    });

    it("the short configuration produces 'q7t 3n7'", () => {
      const short = createToken({ length: 6, chunkSize: 3, separator: ' ' });

      expect(short.validate('q7t 3n7')).toEqual({ valid: true, body: 'q7t3n' });
      expect(`${'q7t3n'.slice(0, 3)} ${'q7t3n'.slice(3)}7`).toBe('q7t 3n7');
    });
  });

  describe('README: the prefix sits outside the checksum', () => {
    it('validate rejects the prefixed value and accepts the stripped one', () => {
      const value = 'ORD-a4kp-9mxa';

      expect(token.validate(value)).toEqual({
        valid: false,
        reason: 'outside-alphabet',
      });
      expect(token.validate(value.slice('ORD-'.length))).toEqual({
        valid: true,
        body: 'a4kp9mx',
      });
    });

    it('`ORD` contains a character the alphabet excludes', () => {
      expect(DEFAULT_DICTIONARY).not.toContain('o');
      expect(CONFUSABLE_CHARACTERS).toContain('o');
    });
  });

  describe('README: entropy', () => {
    it('35 bits at the defaults', () => {
      expect(token.entropyBits).toBe(35);
      expect((DEFAULT_LENGTH - 1) * Math.log2(32)).toBe(35);
      expect(2 ** 35).toBe(34_359_738_368);
    });

    it('a 50% collision chance at about 218,000 codes', () => {
      const half = Math.sqrt(2 * Math.LN2 * 2 ** 35);

      expect(Math.round(half / 1_000) * 1_000).toBe(218_000);
    });

    it('a collision is effectively certain at 1,000,000 codes', () => {
      const certainty = 1 - Math.exp(-(1_000_000 ** 2) / (2 * 2 ** 35));

      expect(certainty).toBeGreaterThan(0.999_999);
    });

    it('five more characters buys 25 more bits', () => {
      expect(createToken({ length: 13, chunkSize: 13 }).entropyBits).toBe(60);
    });
  });

  describe('README: the alphabet', () => {
    it('the default', () => {
      expect(token.dictionary).toBe('0123456789abcdefghjkmnpqrstuvxyz');
      expect(token.n).toBe(32);
      expect(DEFAULT_DICTIONARY).toBe('0123456789abcdefghjkmnpqrstuvxyz');
      expect(CONFUSABLE_CHARACTERS).toBe('ilow');
    });

    it('the documented defaults', () => {
      expect([DEFAULT_LENGTH, DEFAULT_CHUNK_SIZE, DEFAULT_SEPARATOR]).toEqual([
        8,
        4,
        '-',
      ]);
      expect(token.length).toBe(8);
      expect(token.chunkSize).toBe(4);
      expect(token.separator).toBe('-');
    });

    it('a confusable dictionary is rejected at construction', () => {
      try {
        createToken({ dictionary: '0123456789abcdefghijklmnopqrstuvwxyz' });
        expect.unreachable('the documented call must throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidAlphabetError);
        expect(error).toMatchObject({
          reason: 'confusable',
          offending: ['i', 'l', 'o', 'w'],
        });
      }
    });

    it('a 30-character dictionary is rejected as non-uniform', () => {
      try {
        createToken({ dictionary: '0123456789abcdefghjkmnpqrstuvx' });
        expect.unreachable('the documented call must throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidAlphabetError);
        expect(error).toMatchObject({ reason: 'non-uniform' });
      }
      expect([...'0123456789abcdefghjkmnpqrstuvx']).toHaveLength(30);
      expect(256 % 30).not.toBe(0);
    });

    it("Luhn's 36-character default over-represents four characters by 14.3%", () => {
      const luhn = createLuhn();

      expect(luhn.uniformOverBytes).toBe(false);
      expect(256 % luhn.n).toBe(4);
      // Four indices are hit by 8 of the 256 bytes, the other 32 by 7.
      expect(Math.round((8 / 7 - 1) * 1000) / 10).toBe(14.3);
    });

    it('the default alphabet is uniform', () => {
      expect(256 % token.n).toBe(0);
      expect(
        createLuhn({ dictionary: DEFAULT_DICTIONARY }).uniformOverBytes,
      ).toBe(true);
    });
  });

  describe('README: chunking', () => {
    it('chunkSize must divide length', () => {
      expect(() => createToken({ length: 6 })).toThrow(InvalidShapeError);
      expect(() => createToken({ length: 6, chunkSize: 3 })).not.toThrow();
    });

    it('chunkSize equal to length produces an unchunked code', () => {
      const unchunked = createToken({ chunkSize: 8 });

      expect(unchunked.generate().value).not.toContain('-');
    });
  });

  describe('doc comments', () => {
    it('createToken', () => {
      const instance = createToken();

      expect(instance.validate('a4kp-9mxa')).toEqual({
        valid: true,
        body: 'a4kp9mx',
      });
      expect(instance.validate('a4kp-9mx8')).toEqual({
        valid: false,
        reason: 'check-failed',
      });
    });

    it('DEFAULT_DICTIONARY is the lowercase alphanumerics less `i`, `l`, `o`, `w`', () => {
      const removed = [...'0123456789abcdefghijklmnopqrstuvwxyz'].filter(
        (char) => !DEFAULT_DICTIONARY.includes(char),
      );

      expect(removed).toEqual(['i', 'l', 'o', 'w']);
      expect([...DEFAULT_DICTIONARY]).toHaveLength(32);
    });

    it('Token.entropyBits is (length - 1) * log2(n)', () => {
      for (const length of [2, 8, 12, 16]) {
        expect(createToken({ length, chunkSize: length }).entropyBits).toBe(
          (length - 1) * 5,
        );
      }
    });
  });
});
