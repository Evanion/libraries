const messageFor = (
  reason: InvalidDictionaryReason,
  dictionary: string,
  offending: readonly string[],
): string => {
  const list = offending.map((entry) => JSON.stringify(entry)).join(', ');

  switch (reason) {
    case 'not-a-string':
      return `Luhn dictionary must be a string, received ${typeof dictionary}.`;
    case 'too-short':
      return `Luhn dictionary must contain at least 2 code points, received ${[...dictionary].length}.`;
    case 'odd-length':
      return `Luhn dictionary must contain an even number of code points, received ${[...dictionary].length}.`;
    case 'duplicate':
      return `Luhn dictionary must not repeat a code point; repeated: ${list}.`;
    case 'case-pairs':
      return `Luhn dictionary must not contain case pairs when caseInsensitive is set; pairs: ${list}.`;
  }
};

/**
 * Base class for every error this library throws.
 *
 * ```ts
 * try {
 *   createLuhn({ dictionary });
 * } catch (error) {
 *   if (error instanceof LuhnError) {
 *     // the dictionary is unusable, or there was nothing to check
 *   }
 * }
 * ```
 *
 * `@evanion/urn` exports an unrelated `ValidationError`; the name here is
 * package-specific so the two never collide in a consumer's import list.
 */
export class LuhnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LuhnError';
  }
}

/** Which construction constraint the dictionary failed. */
export type InvalidDictionaryReason =
  | 'not-a-string'
  | 'too-short'
  | 'odd-length'
  | 'duplicate'
  | 'case-pairs';

/**
 * Thrown by `createLuhn` when the dictionary cannot support Luhn mod-N.
 *
 * One class carrying a `reason` rather than one class per constraint, so a
 * caller that only wants to know whether a dictionary is acceptable writes one
 * `catch` arm instead of five.
 */
export class InvalidDictionaryError extends LuhnError {
  readonly reason: InvalidDictionaryReason;
  readonly dictionary: string;
  /**
   * The code points the constraint named: the repeated ones for `duplicate`,
   * the case variants for `case-pairs`, empty for the constraints that are
   * about the dictionary as a whole.
   */
  readonly offending: readonly string[];

  constructor(
    reason: InvalidDictionaryReason,
    dictionary: string,
    offending: readonly string[],
  ) {
    super(messageFor(reason, dictionary, offending));
    this.name = 'InvalidDictionaryError';
    this.reason = reason;
    this.dictionary = dictionary;
    this.offending = offending;
  }
}

/**
 * Thrown by `generate` when no code point of the input is in the dictionary.
 *
 * A check character over no payload carries no information, and returning one
 * makes every all-filtered input produce the same result.
 */
export class EmptyInputError extends LuhnError {
  constructor(message: string) {
    super(message);
    this.name = 'EmptyInputError';
  }
}
