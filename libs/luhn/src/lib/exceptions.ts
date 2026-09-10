/**
 * Base class for every error this library throws.
 *
 * Catch this to handle any validation failure:
 *
 * ```ts
 * try {
 *   Luhn.generate(input);
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     // the dictionary in use is not usable
 *   }
 * }
 * ```
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when the dictionary in use has an odd number of characters. Luhn
 * mod-N needs an even N, otherwise the doubling step is not a bijection over
 * the dictionary and the check character carries no information.
 */
export class InvalidDictionaryError extends ValidationError {
  constructor(dictionary: string) {
    super(
      `Luhn directory is of invalid length (${dictionary.length}). The directory length needs to be even`,
    );
    this.name = 'InvalidError';
    this.dictionary = dictionary;
  }

  /** The dictionary that was rejected. */
  readonly dictionary: string;
}
