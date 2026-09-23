import { InvalidDictionaryError } from '@evanion/luhn';
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

const token = createToken();
const alphabet = [...DEFAULT_DICTIONARY];

/**
 * 30 code points, none of them confusable, and 256 % 30 === 16. It isolates
 * the uniformity constraint from the other two.
 */
const NON_UNIFORM_DICTIONARY = '0123456789abcdefghjkmnpqrstuvx';

/** Strips the separators from a generated `value`, leaving the raw code. */
const raw = (value: string): string => value.split(DEFAULT_SEPARATOR).join('');

/**
 * The check character `body` must carry, found by asking the instance which
 * candidate checks out.
 *
 * Recomputing Luhn's fold here would only test a second copy of it; probing
 * `validate` tests the instance under test, and there are only `n` candidates.
 */
const checkCharacterFor = (body: string): string => {
  const instance = createToken({ length: body.length + 1 });
  const found = alphabet.find(
    (candidate) => instance.validate(body + candidate).valid,
  );

  if (found === undefined) {
    throw new Error(`no check character checks out for ${body}`);
  }
  return found;
};

/** `body` with its check character appended, unchunked. */
const codeFor = (body: string): string => body + checkCharacterFor(body);

describe('createToken', () => {
  describe('the constructed instance', () => {
    it('exposes the configuration it was given', () => {
      expect(token.dictionary).toBe(DEFAULT_DICTIONARY);
      expect(token.n).toBe(32);
      expect(token.length).toBe(DEFAULT_LENGTH);
      expect(token.chunkSize).toBe(DEFAULT_CHUNK_SIZE);
      expect(token.separator).toBe(DEFAULT_SEPARATOR);
    });

    it('reports usable entropy excluding the check character', () => {
      expect(token.entropyBits).toBe(35);
      expect(createToken({ length: 12 }).entropyBits).toBe(55);
    });

    it('is frozen', () => {
      expect(Object.isFrozen(token)).toBe(true);
      expect(() => {
        (token as { length: number }).length = 99;
      }).toThrow(TypeError);
    });
  });

  describe('the default dictionary', () => {
    it('is 32 distinct lowercase code points', () => {
      expect(alphabet).toHaveLength(32);
      expect(new Set(alphabet).size).toBe(32);
      expect(DEFAULT_DICTIONARY).toBe(DEFAULT_DICTIONARY.toLowerCase());
    });

    it('excludes every confusable character', () => {
      for (const char of CONFUSABLE_CHARACTERS) {
        expect(DEFAULT_DICTIONARY).not.toContain(char);
      }
    });

    it('divides 256, so byte % n is unbiased', () => {
      expect(256 % alphabet.length).toBe(0);
    });
  });
});

describe('generate', () => {
  it('returns the code in both its chunked and unchunked forms', () => {
    const { value, body, check, prefix } = token.generate();

    expect(body).toHaveLength(DEFAULT_LENGTH - 1);
    expect(check).toHaveLength(1);
    expect(value).toBe(
      `${body.slice(0, 4)}${DEFAULT_SEPARATOR}${body.slice(4)}${check}`,
    );
    expect(prefix).toBeUndefined();
  });

  it('draws every character from the dictionary', () => {
    const { body, check } = token.generate();

    for (const char of body + check) {
      expect(DEFAULT_DICTIONARY).toContain(char);
    }
  });

  it('writes the prefix ahead of the code, separated', () => {
    const { value, body, check, prefix } = token.generate({ prefix: 'ORD' });

    expect(prefix).toBe('ORD');
    expect(value.startsWith('ORD-')).toBe(true);
    expect(raw(value.slice('ORD-'.length))).toBe(body + check);
  });

  it('emits one chunk when chunkSize equals length', () => {
    const { value } = createToken({ chunkSize: DEFAULT_LENGTH }).generate();

    expect(value).not.toContain(DEFAULT_SEPARATOR);
    expect(value).toHaveLength(DEFAULT_LENGTH);
  });

  it('chunks a longer code evenly', () => {
    const long = createToken({ length: 12, chunkSize: 3 });

    const widths = long
      .generate()
      .value.split(DEFAULT_SEPARATOR)
      .map((chunk) => chunk.length);

    expect(widths).toEqual([3, 3, 3, 3]);
  });

  it('produces a code its own validate accepts, over 10,000 draws', () => {
    const rejected: string[] = [];

    for (let draw = 0; draw < 10_000; draw++) {
      const { value } = token.generate();
      if (!token.validate(value).valid) rejected.push(value);
    }

    expect(rejected).toEqual([]);
  });

  it('computes the check character from the body alone', () => {
    // The prefix sits outside the checksum, so one body carries one check
    // character no matter what is written in front of it.
    for (const prefix of ['ORD', 'INVOICE-2026', '']) {
      for (let draw = 0; draw < 200; draw++) {
        const { body, check, value } = token.generate({ prefix });

        expect(check).toBe(checkCharacterFor(body));
        expect(value.endsWith(check)).toBe(true);
        expect(token.validate(body + check)).toEqual({ valid: true, body });
      }
    }
  });
});

describe('the check character', () => {
  it('catches a single-character substitution anywhere in the code', () => {
    const accepted: string[] = [];

    for (let draw = 0; draw < 500; draw++) {
      const code = raw(token.generate().value);

      for (let at = 0; at < code.length; at++) {
        for (const replacement of alphabet) {
          if (replacement === code[at]) continue;

          const mutated = code.slice(0, at) + replacement + code.slice(at + 1);
          if (token.validate(mutated).valid) accepted.push(mutated);
        }
      }
    }

    expect(accepted).toEqual([]);
  });

  it('catches every adjacent transposition but the one pair it cannot', () => {
    const missed = new Set<string>();

    for (let draw = 0; draw < 2_000; draw++) {
      const code = raw(token.generate().value);

      for (let at = 0; at + 1 < code.length; at++) {
        const left = code[at] as string;
        const right = code[at + 1] as string;
        if (left === right) continue;

        const swapped = code.slice(0, at) + right + left + code.slice(at + 2);
        if (token.validate(swapped).valid) {
          missed.add([left, right].sort().join(''));
        }
      }
    }

    expect([...missed].filter((pair) => pair !== '0z')).toEqual([]);
  });

  it('misses a swap of the first and last dictionary entries', () => {
    // A fixed vector: at 1 pair in C(32, 2) = 496 per adjacent slot, a random
    // body would essentially never place `0` beside `z`, and a negative case
    // that never fires is worse than no case at all.
    for (const body of ['0zabcde', 'a0zbcde', 'abc0zde', 'abcde0z']) {
      const code = codeFor(body);
      const at = body.indexOf('0z');
      const swapped = code.slice(0, at) + 'z0' + code.slice(at + 2);

      expect(swapped).not.toBe(code);
      expect(token.validate(code)).toEqual({ valid: true, body });
      expect(token.validate(swapped).valid).toBe(true);
    }
  });

  it('misses that pair in either order', () => {
    // The blind spot is a property of the two dictionary indices, not of which
    // one comes first.
    const body = 'az0bcde';
    const code = codeFor(body);
    const at = body.indexOf('z0');

    expect(
      token.validate(code.slice(0, at) + '0z' + code.slice(at + 2)).valid,
    ).toBe(true);
  });
});

describe('uniformity', () => {
  it('draws every character within 10% of 1/n over 100,000 codes', () => {
    // 10% is about 1.5x the worst deviation measured over 100 independent runs
    // of this size, while the n = 36 alphabet below misses by ~13%. The bound
    // separates the two without being flaky.
    const counts = new Map(alphabet.map((char) => [char, 0]));
    let total = 0;

    for (let draw = 0; draw < 100_000; draw++) {
      for (const char of token.generate().body) {
        counts.set(char, (counts.get(char) as number) + 1);
        total++;
      }
    }

    const expected = total / alphabet.length;
    const worst = Math.max(
      ...[...counts.values()].map(
        (count) => Math.abs(count - expected) / expected,
      ),
    );

    expect(worst).toBeLessThanOrEqual(0.1);
  });

  it('rejects an alphabet that would bias byte % n', () => {
    expect(() => createToken({ dictionary: NON_UNIFORM_DICTIONARY })).toThrow(
      InvalidAlphabetError,
    );
    expect(() => createToken({ dictionary: NON_UNIFORM_DICTIONARY })).toThrow(
      /divides 256/,
    );
  });
});

describe('validate', () => {
  it('accepts a code however its separators are placed', () => {
    const { value, body, check } = token.generate();
    const code = body + check;
    const expected = { valid: true, body };

    expect(token.validate(value)).toEqual(expected);
    expect(token.validate(code)).toEqual(expected);
    expect(token.validate(value.replace('-', '--'))).toEqual(expected);
    expect(token.validate([...code].join('-'))).toEqual(expected);
    expect(token.validate(`-${code}-`)).toEqual(expected);
  });

  it('folds case', () => {
    const { value, body } = token.generate();

    expect(token.validate(value.toUpperCase())).toEqual({ valid: true, body });
  });

  it('reports outside-alphabet for a character not in the dictionary', () => {
    for (const intruder of ['o', 'i', 'l', 'w', '!', 'é']) {
      const { body, check } = token.generate();

      expect(token.validate(body.slice(1) + intruder + check)).toEqual({
        valid: false,
        reason: 'outside-alphabet',
      });
    }
  });

  it('reports outside-alphabet before wrong-length', () => {
    expect(token.validate('oo')).toEqual({
      valid: false,
      reason: 'outside-alphabet',
    });
  });

  it('reports wrong-length for a code of the wrong size', () => {
    const { value } = token.generate();

    expect(token.validate(value.slice(0, -1))).toEqual({
      valid: false,
      reason: 'wrong-length',
    });
    expect(token.validate(`${raw(value)}0`)).toEqual({
      valid: false,
      reason: 'wrong-length',
    });
    expect(token.validate('')).toEqual({
      valid: false,
      reason: 'wrong-length',
    });
  });

  it('reports check-failed for a well-shaped code that does not check out', () => {
    const { body, check } = token.generate();
    const wrong = alphabet.find((char) => char !== check) as string;

    expect(token.validate(body + wrong)).toEqual({
      valid: false,
      reason: 'check-failed',
    });
  });

  it('rejects a prefixed value, which the caller is to strip', () => {
    const { value } = token.generate({ prefix: 'ORD' });

    expect(token.validate(value)).toEqual({
      valid: false,
      reason: 'outside-alphabet',
    });
  });
});

describe('dictionary constraints', () => {
  it('rejects a dictionary that is valid for Luhn but confusable', () => {
    // 36 lowercase alphanumerics: even, no repeats, no case pairs, so Luhn is
    // satisfied -- and `i`, `l`, `o` and `w` are all still in it.
    try {
      createToken({ dictionary: '0123456789abcdefghijklmnopqrstuvwxyz' });
      expect.unreachable('a confusable dictionary must not be accepted');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidAlphabetError);
      expect(error).toMatchObject({
        reason: 'confusable',
        offending: ['i', 'l', 'o', 'w'],
      });
    }
  });

  it('rejects a dictionary that is unconfusable but not uniform', () => {
    try {
      createToken({ dictionary: NON_UNIFORM_DICTIONARY });
      expect.unreachable('a biased dictionary must not be accepted');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidAlphabetError);
      expect(error).toMatchObject({ reason: 'non-uniform', offending: [] });
    }
  });

  it('rejects an uppercase dictionary, which case folding cannot reach', () => {
    try {
      createToken({ dictionary: DEFAULT_DICTIONARY.toUpperCase() });
      expect.unreachable('an uppercase dictionary must not be accepted');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidAlphabetError);
      expect(error).toMatchObject({ reason: 'unfolded' });
    }
  });

  it("lets Luhn's own constraints throw", () => {
    // 31 code points: odd, so no check character is definable over it. The
    // error comes from `@evanion/luhn`, not from this package.
    expect(() =>
      createToken({ dictionary: '0123456789abcdefghjkmnpqrstuvxy' }),
    ).toThrow(InvalidDictionaryError);
    expect(() => createToken({ dictionary: '0011' })).toThrow(
      InvalidDictionaryError,
    );
    expect(() => createToken({ dictionary: '0' })).toThrow(
      InvalidDictionaryError,
    );
  });

  it('accepts a reordering of the default', () => {
    // The order decides which index each character occupies, so a reordering
    // is a different alphabet -- and an equally valid one.
    const reordered = createToken({
      dictionary: [...DEFAULT_DICTIONARY].reverse().join(''),
    });

    expect(reordered.n).toBe(32);
    expect(reordered.validate(reordered.generate().value).valid).toBe(true);
  });
});

describe('shape constraints', () => {
  const shapeReason = (options: Parameters<typeof createToken>[0]): string => {
    try {
      createToken(options);
      return 'accepted';
    } catch (error) {
      return (error as InvalidShapeError).reason;
    }
  };

  it('rejects a length that cannot carry a payload and a check', () => {
    expect(shapeReason({ length: 1, chunkSize: 1 })).toBe('length');
    expect(shapeReason({ length: 0, chunkSize: 1 })).toBe('length');
    expect(shapeReason({ length: 8.5, chunkSize: 1 })).toBe('length');
    expect(shapeReason({ length: Number.NaN, chunkSize: 1 })).toBe('length');
  });

  it('rejects a chunk size that is not a positive integer', () => {
    expect(shapeReason({ chunkSize: 0 })).toBe('chunk-size');
    expect(shapeReason({ chunkSize: -4 })).toBe('chunk-size');
    expect(shapeReason({ chunkSize: 2.5 })).toBe('chunk-size');
  });

  it('rejects a chunk size that leaves a short trailing chunk', () => {
    expect(shapeReason({ length: 6 })).toBe('chunk-size-indivisible');
    expect(shapeReason({ length: 10, chunkSize: 3 })).toBe(
      'chunk-size-indivisible',
    );
    expect(shapeReason({ length: 10, chunkSize: 5 })).toBe('accepted');
  });

  it('rejects a separator validate could not strip', () => {
    expect(shapeReason({ separator: '' })).toBe('separator-empty');
    expect(shapeReason({ separator: 'a' })).toBe('separator-in-dictionary');
    expect(shapeReason({ separator: ' - ' })).toBe('accepted');
    expect(shapeReason({ separator: '.' })).toBe('accepted');
  });

  it('carries all three shape values on the error', () => {
    try {
      createToken({ length: 6, chunkSize: 4, separator: '/' });
      expect.unreachable('6 is not a multiple of 4');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidShapeError);
      expect(error).toMatchObject({
        reason: 'chunk-size-indivisible',
        length: 6,
        chunkSize: 4,
        separator: '/',
      });
    }
  });

  it('round-trips a fully custom configuration', () => {
    const custom = createToken({
      length: 10,
      chunkSize: 5,
      separator: '.',
      dictionary: [...DEFAULT_DICTIONARY].reverse().join(''),
    });
    const { value, body } = custom.generate({ prefix: 'REF' });

    expect(value.startsWith('REF.')).toBe(true);
    expect(custom.validate(value.slice('REF.'.length))).toEqual({
      valid: true,
      body,
    });
  });
});
