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
 * The documented claims that an executed example cannot carry.
 *
 * Every `EXPR; // -> VALUE` line in README.md and in a doc comment is already
 * an assertion: `docExamples()` in vite.config.ts rewrites it and
 * vite-plugin-doctest runs it, so a documented value that is wrong fails the
 * suite where it is written. What is left over lands here, and it is of three
 * kinds.
 *
 * - Claims about `generate`, which draws from `crypto.randomBytes`. The
 *   documented output cannot be reproduced, so what is checked instead is that
 *   it is internally consistent: the printed `value` really is the printed
 *   `body` plus a check character that validates, chunked by the documented
 *   `chunkSize`. A made-up check character fails here, which is the whole
 *   reason this file exists -- a check character is the output of a fold over a
 *   specific alphabet in a specific order, so it cannot be read off a page.
 * - Claims a reader has to take arithmetic on trust: the entropy figures, the
 *   collision volumes, and the exact set of swaps Luhn misses.
 * - Claims about prose rather than about a value: which characters the alphabet
 *   leaves out, and which constraint rejects a dictionary.
 */
describe('the documented claims', () => {
  const token = createToken();

  /** What `createToken` threw for `dictionary`, so its fields can be read. */
  const thrownBy = (dictionary: string): unknown => {
    try {
      createToken({ dictionary });
    } catch (error) {
      return error;
    }
    return expect.unreachable('the documented call must throw');
  };

  describe('README: the generate() outputs', () => {
    it("the quick start's 'a4kp-9mxa' is body 'a4kp9mx' plus check 'a'", () => {
      expect(token.validate('a4kp9mx' + 'a').valid).toBe(true);
      expect(`${'a4kp9mx'.slice(0, 4)}-${'a4kp9mx'.slice(4)}a`).toBe(
        'a4kp-9mxa',
      );
    });

    it("the prefixed form is the same code behind 'ORD-'", () => {
      expect(['ORD', 'a4kp-9mxa'].join(DEFAULT_SEPARATOR)).toBe(
        'ORD-a4kp-9mxa',
      );
    });

    it("the short configuration's 'q7t 3n7' is body 'q7t3n' plus check '7'", () => {
      const short = createToken({ length: 6, chunkSize: 3, separator: ' ' });

      expect(short.validate('q7t 3n7')).toEqual({ valid: true, body: 'q7t3n' });
      expect(`${'q7t3n'.slice(0, 3)} ${'q7t3n'.slice(3)}7`).toBe('q7t 3n7');
    });

    it('an unchunked configuration produces no separator', () => {
      expect(createToken({ chunkSize: 8 }).generate().value).not.toContain('-');
    });
  });

  describe('README: valid is a filter, not a credential', () => {
    it('one code in n passes by construction', () => {
      const passing = [...DEFAULT_DICTIONARY].filter(
        (candidate) => token.validate(`a4kp9mx${candidate}`).valid,
      );

      expect(passing).toEqual(['a']);
      expect(token.n).toBe(32);
    });
  });

  describe('README: what the check character catches', () => {
    it('every single-character substitution, at every position', () => {
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

    it('every adjacent swap except `0` and `z`', () => {
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

    it('`0` and `z` are the first and last dictionary entries', () => {
      expect(DEFAULT_DICTIONARY.at(0)).toBe('0');
      expect(DEFAULT_DICTIONARY.at(-1)).toBe('z');
    });
  });

  describe('README: entropy', () => {
    it('35 bits is 34,359,738,368 values', () => {
      expect((DEFAULT_LENGTH - 1) * Math.log2(32)).toBe(35);
      expect(2 ** 35).toBe(34_359_738_368);
    });

    it('a 50% collision chance arrives at about 218,000 codes', () => {
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

    it('entropyBits is (length - 1) * log2(n) at every length', () => {
      for (const length of [2, 8, 12, 16]) {
        expect(createToken({ length, chunkSize: length }).entropyBits).toBe(
          (length - 1) * 5,
        );
      }
    });
  });

  describe('README: the alphabet', () => {
    it('leaves out exactly `i`, `l`, `o` and `w`', () => {
      const removed = [...'0123456789abcdefghijklmnopqrstuvwxyz'].filter(
        (char) => !DEFAULT_DICTIONARY.includes(char),
      );

      expect(removed).toEqual(['i', 'l', 'o', 'w']);
      expect(CONFUSABLE_CHARACTERS).toBe('ilow');
      expect([...DEFAULT_DICTIONARY]).toHaveLength(32);
    });

    it('the documented defaults are 8, 4 and `-`', () => {
      expect([DEFAULT_LENGTH, DEFAULT_CHUNK_SIZE, DEFAULT_SEPARATOR]).toEqual([
        8,
        4,
        '-',
      ]);
      expect([token.length, token.chunkSize, token.separator]).toEqual([
        8,
        4,
        '-',
      ]);
    });

    it('rejects the 36-character alphabet as confusable', () => {
      expect(
        thrownBy('0123456789abcdefghijklmnopqrstuvwxyz'),
      ).toBeInstanceOf(InvalidAlphabetError);
      expect(thrownBy('0123456789abcdefghijklmnopqrstuvwxyz')).toMatchObject({
        reason: 'confusable',
        offending: ['i', 'l', 'o', 'w'],
      });
    });

    it('rejects a 30-character alphabet as non-uniform', () => {
      expect(thrownBy('0123456789abcdefghjkmnpqrstuvx')).toBeInstanceOf(
        InvalidAlphabetError,
      );
      expect(thrownBy('0123456789abcdefghjkmnpqrstuvx')).toMatchObject({
        reason: 'non-uniform',
      });
      expect([...'0123456789abcdefghjkmnpqrstuvx']).toHaveLength(30);
      expect(256 % 30).not.toBe(0);
    });

    it("over-represents four of Luhn's 36 characters by 14.3%", () => {
      const luhn = createLuhn();

      expect(luhn.uniformOverBytes).toBe(false);
      expect(256 % luhn.n).toBe(4);
      // Four indices are hit by 8 of the 256 bytes, the other 32 by 7.
      expect(Math.round((8 / 7 - 1) * 1000) / 10).toBe(14.3);
    });

    it('samples the default alphabet uniformly', () => {
      expect(256 % token.n).toBe(0);
      expect(
        createLuhn({ dictionary: DEFAULT_DICTIONARY }).uniformOverBytes,
      ).toBe(true);
    });
  });

  describe('README: chunking', () => {
    it('rejects a chunkSize that does not divide length', () => {
      expect(() => createToken({ length: 6 })).toThrow(InvalidShapeError);
      expect(() => createToken({ length: 6, chunkSize: 3 })).not.toThrow();
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
});
