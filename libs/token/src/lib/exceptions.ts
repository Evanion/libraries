/**
 * Every error this library throws is raised by `createToken`. `generate` and
 * `validate` are total: an accepted configuration cannot fail at use.
 */

const codePointList = (offending: readonly string[]): string =>
  offending.map((entry) => JSON.stringify(entry)).join(', ');

/**
 * Base class for every error this library throws.
 *
 * ```ts
 * try {
 *   createToken(options);
 * } catch (error) {
 *   if (error instanceof TokenError) {
 *     // the configuration is unusable
 *   }
 * }
 * ```
 *
 * A dictionary that fails one of Luhn's own constraints throws
 * `InvalidDictionaryError` from `@evanion/luhn` instead, which does not extend
 * this class. Catch `Error` to cover both.
 */
export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

/** Which of token's own dictionary constraints the alphabet failed. */
export type InvalidDictionaryReason = 'confusable' | 'unfolded' | 'non-uniform';

const dictionaryMessage = (
  reason: InvalidDictionaryReason,
  dictionary: string,
  offending: readonly string[],
): string => {
  switch (reason) {
    case 'confusable':
      return `Token dictionary must not contain characters that are confused when read or heard; found: ${codePointList(offending)}.`;
    case 'unfolded':
      return `Token dictionary must be lowercase, or case folding makes the entry unreachable; found: ${codePointList(offending)}.`;
    case 'non-uniform':
      return `Token dictionary must contain a number of code points that divides 256, so that every character is equally likely; ${[...dictionary].length} does not.`;
  }
};

/**
 * Thrown by `createToken` for the dictionary constraints token owns:
 * legibility, reachability under case folding, and uniform sampling from a
 * random byte.
 *
 * The remaining constraints — even length, no duplicates, no case pairs — are
 * Luhn's, and `@evanion/luhn` reports them as its own `InvalidDictionaryError`.
 *
 * One class carrying a `reason` rather than one class per constraint, so a
 * caller that only wants to know whether an alphabet is acceptable writes one
 * `catch` arm.
 */
export class InvalidAlphabetError extends TokenError {
  readonly reason: InvalidDictionaryReason;
  readonly dictionary: string;
  /**
   * The code points the constraint named, empty for `non-uniform`, which is a
   * property of the dictionary's size rather than of any one character.
   */
  readonly offending: readonly string[];

  constructor(
    reason: InvalidDictionaryReason,
    dictionary: string,
    offending: readonly string[] = [],
  ) {
    super(dictionaryMessage(reason, dictionary, offending));
    this.name = 'InvalidAlphabetError';
    this.reason = reason;
    this.dictionary = dictionary;
    this.offending = offending;
  }
}

/** Which of the three shape options `createToken` rejected, and why. */
export type InvalidShapeReason =
  | 'length'
  | 'chunk-size'
  | 'chunk-size-indivisible'
  | 'separator-empty'
  | 'separator-in-dictionary';

const shapeMessage = (
  reason: InvalidShapeReason,
  shape: TokenShape,
): string => {
  switch (reason) {
    case 'length':
      return `Token length must be an integer of at least 2 — one payload character and one check character — received ${shape.length}.`;
    case 'chunk-size':
      return `Token chunkSize must be an integer of at least 1, received ${shape.chunkSize}.`;
    case 'chunk-size-indivisible':
      return `Token chunkSize must divide length, or the last chunk is shorter than the rest; ${shape.chunkSize} does not divide ${shape.length}.`;
    case 'separator-empty':
      return 'Token separator must be a non-empty string; set chunkSize to length for an unchunked token.';
    case 'separator-in-dictionary':
      return `Token separator must share no code point with the dictionary, or validate cannot strip it; ${JSON.stringify(shape.separator)} does.`;
  }
};

/** The three options that decide how a token is laid out, as supplied. */
export interface TokenShape {
  length: number;
  chunkSize: number;
  separator: string;
}

/**
 * Thrown by `createToken` when `length`, `chunkSize` or `separator` cannot
 * describe a token.
 *
 * It carries all three rather than only the offending one: the constraints are
 * relations between them, so the value that has to change is not always the
 * value the `reason` names.
 */
export class InvalidShapeError extends TokenError {
  readonly reason: InvalidShapeReason;
  readonly length: number;
  readonly chunkSize: number;
  readonly separator: string;

  constructor(reason: InvalidShapeReason, shape: TokenShape) {
    super(shapeMessage(reason, shape));
    this.name = 'InvalidShapeError';
    this.reason = reason;
    this.length = shape.length;
    this.chunkSize = shape.chunkSize;
    this.separator = shape.separator;
  }
}
