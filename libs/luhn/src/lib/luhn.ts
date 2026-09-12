import { EmptyInputError, InvalidDictionaryError } from './exceptions.js';

/**
 * 36 lowercase alphanumerics, the dictionary `createLuhn()` uses when the
 * caller supplies none.
 *
 * It contains no case pairs, which is what makes case folding sound over it:
 * folding maps uppercase input onto a dictionary entry instead of onto a
 * second entry that is already taken.
 */
export const DEFAULT_DICTIONARY = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * 62 characters, digits followed by `Aa Bb Cc …`. Case-sensitive only: its
 * case pairs make it invalid under `caseInsensitive`.
 *
 * The alternating order is load-bearing — it decides which index each letter
 * occupies, and therefore every check character the dictionary produces.
 */
export const ALTERNATING_CASE_DICTIONARY =
  '0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';

/** The filtered phrase and its check character. */
export interface GenerateResult {
  /** `input` with every code point outside the dictionary removed. */
  phrase: string;
  /** The check character, drawn from the dictionary. */
  checksum: string;
  /** How many code points of `input` were dropped. */
  filtered: number;
}

/** The filtered phrase and whether its last character checks out. */
export interface ValidateResult {
  /** `input` with every code point outside the dictionary removed. */
  phrase: string;
  isValid: boolean;
  /** How many code points of `input` were dropped. */
  filtered: number;
}

export interface LuhnOptions {
  /**
   * The alphabet. Must be a string of an even number of distinct code points,
   * at least two, and must contain no case pairs when `caseInsensitive` is on.
   *
   * Defaults to {@link DEFAULT_DICTIONARY}.
   */
  dictionary?: string;
  /**
   * Fold input to lowercase before looking it up, so `FOO` and `foo` check the
   * same.
   *
   * Defaults to `true` when `dictionary` is omitted and `false` when it is
   * given: the default dictionary is chosen to support folding, a
   * caller-supplied one has to say whether it does.
   */
  caseInsensitive?: boolean;
}

/** A dictionary with `generate` and `validate` bound to it. */
export interface Luhn {
  readonly dictionary: string;
  /** The modulus: the number of code points in the dictionary. */
  readonly n: number;
  readonly caseInsensitive: boolean;
  /**
   * Whether `byte % n` draws uniformly from the dictionary, which holds when
   * `n` divides 256.
   *
   * It says nothing about the quality of the bytes. This library does not
   * generate random values; the flag exists so a caller that does can reject a
   * dictionary that would bias its output.
   */
  readonly uniformOverBytes: boolean;

  /**
   * Computes the check character for `input`.
   *
   * @throws {EmptyInputError} when no code point of `input` is in the
   * dictionary.
   */
  generate(input: string): GenerateResult;

  /**
   * Checks `input`, whose last dictionary code point is the check character.
   *
   * Fewer than two surviving code points is not valid: a check character over
   * no payload carries no information.
   */
  validate(input: string): ValidateResult;
}

/**
 * Validates `dictionary` and returns its code points.
 *
 * Iteration is by code point rather than by UTF-16 unit, so an astral
 * dictionary counts and indexes as the caller wrote it; `split('')` halves
 * every surrogate pair.
 */
const codePointsOf = (
  dictionary: string,
  caseInsensitive: boolean,
): string[] => {
  if (typeof dictionary !== 'string') {
    throw new InvalidDictionaryError('not-a-string', dictionary, []);
  }

  const chars = [...dictionary];

  if (chars.length < 2) {
    throw new InvalidDictionaryError('too-short', dictionary, []);
  }

  if (chars.length % 2 !== 0) {
    throw new InvalidDictionaryError('odd-length', dictionary, []);
  }

  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const char of chars) {
    if (seen.has(char)) repeated.add(char);
    seen.add(char);
  }
  if (repeated.size > 0) {
    throw new InvalidDictionaryError('duplicate', dictionary, [...repeated]);
  }

  if (caseInsensitive) {
    const byFold = new Map<string, string[]>();
    for (const char of chars) {
      const fold = char.toLowerCase();
      byFold.set(fold, [...(byFold.get(fold) ?? []), char]);
    }
    const pairs = [...byFold.values()]
      .filter((group) => group.length > 1)
      .map((group) => group.join(''));
    if (pairs.length > 0) {
      throw new InvalidDictionaryError('case-pairs', dictionary, pairs);
    }
  }

  return chars;
};

/**
 * Validates `options.dictionary` and returns a frozen object carrying it, its
 * lookup tables, and the two operations bound to them.
 *
 * Everything a dictionary has to satisfy is checked here, once. Nothing is
 * checked at use, so an accepted instance cannot produce a token its own
 * `validate` rejects.
 *
 * @throws {InvalidDictionaryError} when the dictionary fails a constraint.
 *
 * @example
 * ```ts @import.meta.vitest
 * const luhn = createLuhn({ dictionary: '0123456789' });
 * luhn.generate('7992739871'); // -> { phrase: '7992739871', checksum: '3', filtered: 0 }
 * ```
 */
export function createLuhn(options: LuhnOptions = {}): Luhn {
  const dictionary = options.dictionary ?? DEFAULT_DICTIONARY;
  const caseInsensitive =
    options.caseInsensitive ?? options.dictionary === undefined;

  const chars = codePointsOf(dictionary, caseInsensitive);
  const n = chars.length;
  const indexOf = new Map(chars.map((char, index) => [char, index]));

  /**
   * Splits `input` into the dictionary indices it contains, in order, plus the
   * phrase they spell and the count of what was dropped.
   *
   * Folding is applied per code point so that each code point of `input` is
   * either one index or one drop, which is what makes `filtered` a count of
   * the caller's own input.
   */
  const scan = (input: string) => {
    const indices: number[] = [];
    let phrase = '';
    let filtered = 0;

    for (const char of input) {
      const key = caseInsensitive ? char.toLowerCase() : char;
      const index = indexOf.get(key);
      if (index === undefined) {
        filtered++;
        continue;
      }
      indices.push(index);
      phrase += key;
    }

    return { indices, phrase, filtered };
  };

  /**
   * Luhn's fold, right to left: double every other index, then add the tens
   * digit to the units digit — `floor(a / n) + (a % n)` over a dictionary of
   * `n` code points.
   *
   * `factor` starts at 2 when a check character is about to be appended and at
   * 1 when one is already present, which is what puts the doubling on the same
   * positions in both directions.
   */
  const fold = (indices: readonly number[], startFactor: 1 | 2): number => {
    let factor = startFactor;
    let sum = 0;

    for (let position = indices.length - 1; position >= 0; position--) {
      const addend = factor * (indices[position] as number);
      factor = factor === 2 ? 1 : 2;
      sum += Math.floor(addend / n) + (addend % n);
    }

    return sum;
  };

  const generate = (input: string): GenerateResult => {
    const { indices, phrase, filtered } = scan(input);

    if (indices.length < 1) {
      throw new EmptyInputError(
        `Luhn cannot generate a check character over an input with no dictionary code points (received ${JSON.stringify(input)}).`,
      );
    }

    const remainder = fold(indices, 2) % n;

    return {
      phrase,
      checksum: chars[(n - remainder) % n] as string,
      filtered,
    };
  };

  const validate = (input: string): ValidateResult => {
    const { indices, phrase, filtered } = scan(input);

    return {
      phrase,
      isValid: indices.length >= 2 && fold(indices, 1) % n === 0,
      filtered,
    };
  };

  return Object.freeze({
    dictionary,
    n,
    caseInsensitive,
    uniformOverBytes: 256 % n === 0,
    generate,
    validate,
  });
}

/**
 * `createLuhn()`: the 36 lowercase alphanumerics, folding case.
 *
 * Frozen, so `Luhn.dictionary = x` — the 1.x and 2.x way to configure this
 * library — throws a `TypeError` in a module rather than being accepted and
 * ignored. Build a second instance with `createLuhn` instead.
 */
/*
 * `Luhn` names the interface in type space and the default instance in value
 * space, so `const luhn: Luhn = Luhn` resolves both. no-redeclare's
 * ignoreDeclarationMerge option covers interface/class and interface/interface
 * merges, not interface/variable.
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Luhn: Luhn = createLuhn();
