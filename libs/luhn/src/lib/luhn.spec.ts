import { describe, expect, it } from 'vitest';

import { EmptyInputError, InvalidDictionaryError } from './exceptions.js';
import {
  ALTERNATING_CASE_DICTIONARY,
  DEFAULT_DICTIONARY,
  Luhn,
  createLuhn,
} from './luhn.js';

/**
 * A seeded PRNG, so a property test that fails names a reproducible input set
 * rather than one that only existed on the run that caught it.
 */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const randomOver = (
  dictionary: string,
  length: number,
  random: () => number,
) => {
  const chars = [...dictionary];
  let out = '';
  for (let index = 0; index < length; index++) {
    out += chars[Math.floor(random() * chars.length)] as string;
  }
  return out;
};

const SAMPLES = 2000;

const instances = [
  ['default', Luhn],
  [
    'alternating case, case-sensitive',
    createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY }),
  ],
  ['digits', createLuhn({ dictionary: '0123456789' })],
  ['astral', createLuhn({ dictionary: '0123😀😁😂😃ab' })],
] as const;

describe('createLuhn', () => {
  describe('the constructed instance', () => {
    it('should expose the dictionary it was given', () => {
      const instance = createLuhn({ dictionary: '0123456789' });

      expect(instance.dictionary).toBe('0123456789');
      expect(instance.n).toBe(10);
      expect(instance.caseInsensitive).toBe(false);
      expect(instance.uniformOverBytes).toBe(false);
    });

    it('should count n by code point', () => {
      expect(createLuhn({ dictionary: '0123😀😁😂😃ab' }).n).toBe(10);
    });

    it('should report uniformOverBytes when the size divides 256', () => {
      expect(
        createLuhn({ dictionary: '0123456789abcdefghjkmnpqrstuvxyz' })
          .uniformOverBytes,
      ).toBe(true);
      expect(Luhn.uniformOverBytes).toBe(false);
    });

    it('should be frozen', () => {
      const instance = createLuhn();

      expect(Object.isFrozen(instance)).toBe(true);
    });

    it('should default to the 36 lowercase alphanumerics, folding case', () => {
      expect(Luhn.dictionary).toBe(DEFAULT_DICTIONARY);
      expect([...Luhn.dictionary]).toHaveLength(36);
      expect(Luhn.caseInsensitive).toBe(true);
    });

    it('should leave folding off for a caller-supplied dictionary', () => {
      expect(
        createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY }).caseInsensitive,
      ).toBe(false);
    });
  });

  describe('dictionary constraints', () => {
    const rejection = (options: Parameters<typeof createLuhn>[0]) => {
      try {
        createLuhn(options);
      } catch (error) {
        return error as InvalidDictionaryError;
      }
      throw new Error('expected createLuhn to throw');
    };

    it('should reject a dictionary that is not a string', () => {
      const error = rejection({
        dictionary: (() => 'abcd') as unknown as string,
      });

      expect(error).toBeInstanceOf(InvalidDictionaryError);
      expect(error.reason).toBe('not-a-string');
      expect(error.offending).toEqual([]);
      expect(error.message).toContain('function');
    });

    it('should reject a dictionary with fewer than 2 code points', () => {
      expect(rejection({ dictionary: '' }).reason).toBe('too-short');
      expect(createLuhn({ dictionary: 'ab' }).n).toBe(2);
    });

    it('should reject an odd number of code points', () => {
      const error = rejection({ dictionary: 'abc' });

      expect(error.reason).toBe('odd-length');
      expect(error.dictionary).toBe('abc');
    });

    it('should reject duplicate code points, naming the repeats', () => {
      const error = rejection({ dictionary: 'aabbccdd' });

      expect(error.reason).toBe('duplicate');
      expect(error.dictionary).toBe('aabbccdd');
      expect(error.offending).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should reject folding over a dictionary with case pairs', () => {
      const error = rejection({
        dictionary: ALTERNATING_CASE_DICTIONARY,
        caseInsensitive: true,
      });

      expect(error.reason).toBe('case-pairs');
      expect(error.dictionary).toBe(ALTERNATING_CASE_DICTIONARY);
      expect(error.offending).toContain('Aa');
      expect(error.offending).toContain('Zz');
    });

    it('should accept a dictionary with case pairs when not folding', () => {
      expect(
        createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY }).n,
      ).toBe(62);
    });

    it('should count an astral dictionary by code point, not UTF-16 unit', () => {
      expect(() => createLuhn({ dictionary: '😀😁' })).not.toThrow();
      expect(rejection({ dictionary: '😀😁😂' }).reason).toBe('odd-length');
    });
  });
});

describe('generate and validate', () => {
  describe.each(instances)('over the %s instance', (_name, instance) => {
    it(`should round-trip ${SAMPLES} random inputs without a single failure`, () => {
      const random = mulberry32(1);
      const failures: string[] = [];

      for (let sample = 0; sample < SAMPLES; sample++) {
        const input = randomOver(instance.dictionary, 8, random);
        const { phrase, checksum } = instance.generate(input);
        if (!instance.validate(phrase + checksum).isValid) {
          failures.push(`${input} -> ${checksum}`);
        }
      }

      expect(failures).toEqual([]);
    });

    it('should reach every index in the dictionary as a check character', () => {
      const random = mulberry32(2);
      const seen = new Set<string>();

      for (let sample = 0; sample < SAMPLES * 5; sample++) {
        seen.add(
          instance.generate(randomOver(instance.dictionary, 6, random))
            .checksum,
        );
      }

      expect(seen.size).toBe(instance.n);
    });

    it('should detect a single substituted code point', () => {
      const random = mulberry32(3);
      const chars = [...instance.dictionary];
      let missed = 0;

      for (let sample = 0; sample < SAMPLES; sample++) {
        const { phrase, checksum } = instance.generate(
          randomOver(instance.dictionary, 8, random),
        );
        const token = [...(phrase + checksum)];
        const position = Math.floor(random() * token.length);
        const original = token[position] as string;
        let replacement = original;
        while (replacement === original) {
          replacement = chars[Math.floor(random() * chars.length)] as string;
        }
        token[position] = replacement;

        if (instance.validate(token.join('')).isValid) missed++;
      }

      expect(missed).toBe(0);
    });
  });

  describe('case folding', () => {
    it('should give mixed-case input the same result as folded input', () => {
      const random = mulberry32(4);

      for (let sample = 0; sample < SAMPLES; sample++) {
        const lower = randomOver(DEFAULT_DICTIONARY, 8, random);
        const mixed = [...lower]
          .map((char) => (random() < 0.5 ? char.toUpperCase() : char))
          .join('');

        expect(Luhn.generate(mixed)).toEqual(Luhn.generate(lower));
      }
    });

    it('should validate its own token whatever case it arrives in', () => {
      const { phrase, checksum } = Luhn.generate('justarandomstringofletters');

      expect(Luhn.validate(phrase + checksum).isValid).toBe(true);
      expect(Luhn.validate((phrase + checksum).toUpperCase()).isValid).toBe(
        true,
      );
    });
  });

  describe('mod-10 vectors', () => {
    const digits = createLuhn({ dictionary: '0123456789' });

    it.each([
      '4539578763621486',
      '79927398713',
      '4111111111111111',
      '5500005555555559',
      '6011000990139424',
    ])('should accept %s', (vector) => {
      expect(digits.validate(vector).isValid).toBe(true);
    });

    it('should reject 79927398710', () => {
      expect(digits.validate('79927398710').isValid).toBe(false);
    });

    it('should generate the textbook check digit', () => {
      expect(digits.generate('7992739871').checksum).toBe('3');
    });
  });

  describe('the input floor', () => {
    it.each(['', '!!!!', '!!!!0', 'åäö0'])(
      'should not validate %o',
      (input) => {
        expect(Luhn.validate(input).isValid).toBe(false);
      },
    );

    it('should still validate a two-code-point token', () => {
      const { phrase, checksum } = Luhn.generate('a');

      expect(Luhn.validate(phrase + checksum).isValid).toBe(true);
    });

    it.each(['', '!!!!'])('should refuse to generate over %o', (input) => {
      expect(() => Luhn.generate(input)).toThrow(EmptyInputError);
    });
  });

  describe('filtering', () => {
    it('should drop code points outside the dictionary', () => {
      const hyphenated = Luhn.generate('foo-baz');
      const accented = Luhn.generate('fooö-baz');

      expect(accented.phrase).toBe(hyphenated.phrase);
      expect(accented.checksum).toBe(hyphenated.checksum);
    });

    it('should count the dropped code points', () => {
      expect(Luhn.generate('foo-baz').filtered).toBe(1);
      expect(Luhn.generate('fooö-baz').filtered).toBe(2);
      expect(Luhn.generate('foobaz').filtered).toBe(0);
    });

    it('should count an astral code point once', () => {
      expect(Luhn.generate('foo😀baz').filtered).toBe(1);
    });

    it('should report the count from validate too', () => {
      const result = Luhn.validate('FoO-ö5');

      expect(result.phrase).toBe('foo5');
      expect(result.filtered).toBe(2);
    });
  });
});

describe('the default instance', () => {
  it('should throw on assignment to dictionary', () => {
    expect(() => {
      (Luhn as { dictionary: string }).dictionary = 'x';
    }).toThrow(TypeError);
  });

  it('should keep working when its methods are destructured', () => {
    const { generate, validate } = Luhn;
    const { phrase, checksum } = generate('foo');

    expect(validate(phrase + checksum).isValid).toBe(true);
  });
});

describe('the hazards the class removed', () => {
  it('should have no helper for a subclass to override', () => {
    const surface = Object.keys(Luhn).sort();

    expect(surface).toEqual([
      'caseInsensitive',
      'dictionary',
      'generate',
      'n',
      'uniformOverBytes',
      'validate',
    ]);
  });

  it('should carry generate and validate on the same object as the dictionary', () => {
    const other = createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY });
    const random = mulberry32(5);

    for (let sample = 0; sample < SAMPLES; sample++) {
      const input = randomOver(DEFAULT_DICTIONARY, 8, random);
      const mine = Luhn.generate(input);
      const theirs = other.generate(input);

      expect(Luhn.validate(mine.phrase + mine.checksum).isValid).toBe(true);
      expect(other.validate(theirs.phrase + theirs.checksum).isValid).toBe(
        true,
      );
    }
  });

  it('should reject the check character 2.0.1 emitted for foo', () => {
    expect(Luhn.validate('fooI').isValid).toBe(false);
  });
});
