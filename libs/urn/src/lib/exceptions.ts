/**
 * Base class for every error this library throws. Catch it to handle any
 * validation failure without naming the subclasses.
 *
 * `@evanion/luhn` exports an unrelated `LuhnError` hierarchy, so the two
 * packages' errors never share a base in a consumer's `catch`.
 *
 * @example
 * ```ts
 * try {
 *   URN.parse(input);
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     // malformed input
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
 * Thrown when a URN component is empty, contains a character outside its
 * role's permitted set, or breaks a structural rule of its role's grammar
 * (a length bound, a leading hyphen, a truncated percent-triplet).
 */
export class InvalidError extends ValidationError {
  constructor(
    property: string,
    value: string,
    invalidChar?: string,
    reason?: string,
  ) {
    super(InvalidError.buildMessage(property, value, invalidChar, reason));
    this.name = 'InvalidError';
    this.property = property;
    this.value = value;
    this.invalidChar = invalidChar;
    this.reason = reason;
  }

  private static buildMessage(
    property: string,
    value: string,
    invalidChar?: string,
    reason?: string,
  ): string {
    if (value === '') {
      return `${property} must not be empty`;
    }
    if (invalidChar) {
      return `${property} contains invalid character '${invalidChar}' in '${value}'`;
    }
    if (reason) {
      return `${property} is invalid in '${value}': ${reason}`;
    }
    return `${property} contains invalid characters in '${value}'`;
  }

  /** Which component failed: `'URN'`, `'NID'` or `'NSS'`. */
  readonly property: string;
  /** The offending component value. */
  readonly value: string;
  /** The first disallowed character, when one could be identified. */
  readonly invalidChar?: string;
  /**
   * Why the component failed when no single character is at fault: every
   * character is permitted for the role, but the value breaks a structural
   * rule such as the NID length bounds.
   */
  readonly reason?: string;
}
