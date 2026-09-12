import { createLuhn } from '@evanion/luhn';
import { randomBytes } from 'node:crypto';

import { InvalidAlphabetError, InvalidShapeError } from './exceptions.js';

/* -------------------------------------------------------------------------
 * Defaults
 * ---------------------------------------------------------------------- */

/**
 * 32 characters: the lowercase alphanumerics without `i`, `l`, `o` and `w`.
 *
 * Each removal drops a character a person confuses with another: `i` and `l`
 * read as `1`, `o` reads as `0`, and `w` is the one English letter whose name
 * is polysyllabic and contains another letter's name — "double-u" — which is
 * what breaks it when a code is dictated.
 *
 * 32 is not an accident either. It is even and free of case pairs, so
 * `@evanion/luhn` can compute a check character over it, and it divides 256,
 * so `byte % 32` draws every character with equal probability.
 */
export const DEFAULT_DICTIONARY = '0123456789abcdefghjkmnpqrstuvxyz';

/**
 * Characters excluded from every token alphabet, matched without regard to
 * case.
 *
 * `1` and `0` survive their groups because a code is as often typed as it is
 * spoken, and a digit reads unambiguously on a keypad.
 */
export const CONFUSABLE_CHARACTERS = 'ilow';

/** Total code points in a token, the check character included. */
export const DEFAULT_LENGTH = 8;

/** Code points between separators. Divides {@link DEFAULT_LENGTH} exactly. */
export const DEFAULT_CHUNK_SIZE = 4;

/** Placed between chunks, and between a prefix and the code. */
export const DEFAULT_SEPARATOR = '-';

/* -------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------- */

export interface TokenOptions {
  /**
   * Total code points in the code, the check character included, so usable
   * entropy is `(length - 1) * log2(dictionary size)`.
   *
   * Defaults to {@link DEFAULT_LENGTH}.
   */
  length?: number;
  /**
   * Code points between separators. Must divide `length`: a trailing chunk
   * shorter than the rest is the thing that is hard to read aloud.
   *
   * Set it equal to `length` for an unchunked code. Defaults to
   * {@link DEFAULT_CHUNK_SIZE}, which does not divide every `length` — a
   * `length` that is not a multiple of 4 has to name its own `chunkSize`.
   */
  chunkSize?: number;
  /**
   * Placed between chunks, and between a prefix and the code. Must share no
   * code point with the dictionary, so that `validate` can strip it.
   *
   * Defaults to {@link DEFAULT_SEPARATOR}.
   */
  separator?: string;
  /**
   * The alphabet. Must be free of confusable characters, lowercase, and of a
   * size that both divides 256 and satisfies Luhn: even, no repeats.
   *
   * Defaults to {@link DEFAULT_DICTIONARY}.
   */
  dictionary?: string;
}

/** Options `generate` takes per call. */
export interface GenerateOptions {
  /**
   * Written ahead of the code, separated by `separator`, and left out of the
   * checksum. Compared by literal string match, which is what a caller reading
   * `value.startsWith('ORD-')` expects.
   */
  prefix?: string;
}

/** A freshly minted code, in the two forms a caller needs. */
export interface GenerateResult {
  /** The code as a person sees it: prefix, chunks and separators. */
  value: string;
  /** The payload the check character was computed over, unchunked. */
  body: string;
  /** The check character, one code point of the dictionary. */
  check: string;
  /** Echoed from the call, `undefined` when none was given. */
  prefix: string | undefined;
}

/** Why a code is not well formed. */
export type ValidateFailureReason =
  /** A code point outside the dictionary, after separators are stripped. */
  | 'outside-alphabet'
  /** The stripped code is not `length` code points long. */
  | 'wrong-length'
  /** The last code point does not check out against the ones before it. */
  | 'check-failed';

/** A code that is well formed. It does not follow that the code exists. */
export interface ValidToken {
  valid: true;
  /** The code without its check character, case folded. */
  body: string;
}

/** A code that is not well formed, and the first constraint it failed. */
export interface InvalidToken {
  valid: false;
  reason: ValidateFailureReason;
}

export type ValidateResult = ValidToken | InvalidToken;

/** A configuration with `generate` and `validate` bound to it. */
export interface Token {
  readonly dictionary: string;
  /** Code points in the dictionary. */
  readonly n: number;
  readonly length: number;
  readonly chunkSize: number;
  readonly separator: string;
  /** Usable entropy in bits: `(length - 1) * log2(n)`. */
  readonly entropyBits: number;

  /**
   * Draws a new code from `crypto.randomBytes` and appends its check
   * character.
   *
   * It never retries and never checks for collisions. Uniqueness is a database
   * constraint, not a property a generator can offer.
   */
  generate(options?: GenerateOptions): GenerateResult;

  /**
   * Reports whether `input` is a well-formed code for this configuration.
   *
   * Total, free of side effects, and cheap enough to run before every lookup —
   * which is the point of the check character. Separators are stripped first,
   * so a code typed without them, or grouped differently, still validates.
   *
   * Luhn catches every single-character substitution, and every swap of
   * adjacent characters except one pair: the first and last entries of the
   * dictionary, `0` and `z` by default. That blind spot is structural rather
   * than incidental — with `g(x) = floor(2x / n) + (2x mod n)`, a swap of
   * indices `a` and `b` goes undetected exactly when `a + g(b) ≡ b + g(a)`
   * (mod n), which for even `n` has the single non-trivial solution
   * `{0, n - 1}`. It is the textbook mod-10 `{0, 9}` case generalised.
   *
   * A prefix is not part of the code. Strip it before calling: `validate` sees
   * a leading `ORD-` as three characters outside the alphabet.
   */
  validate(input: string): ValidateResult;
}

/* -------------------------------------------------------------------------
 * Construction
 * ---------------------------------------------------------------------- */

/**
 * Applies the three dictionary constraints token owns: legibility,
 * reachability under case folding, and uniform sampling from a random byte.
 *
 * Luhn's constraints — even size, no repeats, no case pairs — are checked by
 * `createLuhn`, which is why `luhn` arrives already built: `uniformOverBytes`
 * is read from it rather than recomputed here.
 */
const assertAlphabet = (
  dictionary: string,
  uniformOverBytes: boolean,
): void => {
  const chars = [...dictionary];

  const confusable = chars.filter((char) =>
    CONFUSABLE_CHARACTERS.includes(char.toLowerCase()),
  );
  if (confusable.length > 0) {
    throw new InvalidAlphabetError('confusable', dictionary, confusable);
  }

  // Input is folded to lowercase before it is looked up, so an uppercase code
  // point is an index nothing can ever reach.
  const unfolded = chars.filter((char) => char.toLowerCase() !== char);
  if (unfolded.length > 0) {
    throw new InvalidAlphabetError('unfolded', dictionary, unfolded);
  }

  if (!uniformOverBytes) {
    throw new InvalidAlphabetError('non-uniform', dictionary);
  }
};

/** Applies the constraints that relate `length`, `chunkSize` and `separator`. */
const assertShape = (
  length: number,
  chunkSize: number,
  separator: string,
  dictionary: string,
): void => {
  const shape = { length, chunkSize, separator };

  if (!Number.isInteger(length) || length < 2) {
    throw new InvalidShapeError('length', shape);
  }
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new InvalidShapeError('chunk-size', shape);
  }
  if (length % chunkSize !== 0) {
    throw new InvalidShapeError('chunk-size-indivisible', shape);
  }
  if (separator.length === 0) {
    throw new InvalidShapeError('separator-empty', shape);
  }
  if ([...separator].some((char) => dictionary.includes(char))) {
    throw new InvalidShapeError('separator-in-dictionary', shape);
  }
};

/**
 * Validates the options and returns a frozen object carrying them and the two
 * operations bound to them.
 *
 * Everything is checked here, once. Nothing is checked at use, so an accepted
 * instance cannot produce a code its own `validate` rejects.
 *
 * @throws {InvalidAlphabetError} when the dictionary is confusable, not
 * lowercase, or of a size that biases `byte % n`.
 * @throws {InvalidShapeError} when `length`, `chunkSize` and `separator`
 * cannot describe a code.
 * @throws {InvalidDictionaryError} from `@evanion/luhn`, when the dictionary
 * cannot carry a check character.
 *
 * @example
 * ```ts @import.meta.vitest
 * const token = createToken();
 *
 * token.validate('a4kp-9mxa'); // -> { valid: true, body: 'a4kp9mx' }
 * token.validate('a4kp-9mx8'); // -> { valid: false, reason: 'check-failed' }
 * ```
 */
export function createToken(options: TokenOptions = {}): Token {
  const {
    length = DEFAULT_LENGTH,
    chunkSize = DEFAULT_CHUNK_SIZE,
    separator = DEFAULT_SEPARATOR,
    dictionary = DEFAULT_DICTIONARY,
  } = options;

  // Case folding is on because a code is read off a card and typed back in,
  // and it is what puts luhn's `case-pairs` constraint in force.
  const luhn = createLuhn({ dictionary, caseInsensitive: true });

  assertAlphabet(dictionary, luhn.uniformOverBytes);
  assertShape(length, chunkSize, separator, dictionary);

  const chars = [...dictionary];
  const n = luhn.n;
  const inDictionary = new Set(chars);

  /** Groups `code` into chunks of `chunkSize`, joined by the separator. */
  const chunked = (code: string): string => {
    const points = [...code];
    const groups: string[] = [];

    for (let at = 0; at < points.length; at += chunkSize) {
      groups.push(points.slice(at, at + chunkSize).join(''));
    }

    return groups.join(separator);
  };

  /**
   * Draws `length - 1` characters uniformly.
   *
   * `byte % n` is unbiased only because `n` divides 256, which the alphabet
   * constraint guarantees. That is what lets this stay constant-time rather
   * than rejection-sampling.
   */
  const randomBody = (): string => {
    const bytes = randomBytes(length - 1);
    let body = '';

    for (const byte of bytes) {
      body += chars[byte % n] as string;
    }

    return body;
  };

  const generate = ({ prefix }: GenerateOptions = {}): GenerateResult => {
    const body = randomBody();
    const { checksum } = luhn.generate(body);
    const code = chunked(body + checksum);

    return {
      value: prefix === undefined ? code : `${prefix}${separator}${code}`,
      body,
      check: checksum,
      prefix,
    };
  };

  const validate = (input: string): ValidateResult => {
    const stripped = input.split(separator).join('').toLowerCase();
    const points = [...stripped];

    if (points.some((char) => !inDictionary.has(char))) {
      return { valid: false, reason: 'outside-alphabet' };
    }
    if (points.length !== length) {
      return { valid: false, reason: 'wrong-length' };
    }
    if (!luhn.validate(stripped).isValid) {
      return { valid: false, reason: 'check-failed' };
    }

    return { valid: true, body: points.slice(0, -1).join('') };
  };

  return Object.freeze({
    dictionary,
    n,
    length,
    chunkSize,
    separator,
    entropyBits: (length - 1) * Math.log2(n),
    generate,
    validate,
  });
}
