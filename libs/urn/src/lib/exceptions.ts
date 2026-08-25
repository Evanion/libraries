/**
 * Base class for every error this library throws.
 *
 * Catch this to handle any validation failure:
 *
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
 * Thrown when a URN component is empty or contains characters outside the
 * permitted set.
 */
export class InvalidError extends ValidationError {
  constructor(property: string, value: string, invalidChar?: string) {
    super(InvalidError.buildMessage(property, value, invalidChar));
    this.name = 'InvalidError';
    this.property = property;
    this.value = value;
    this.invalidChar = invalidChar;
  }

  private static buildMessage(
    property: string,
    value: string,
    invalidChar?: string,
  ): string {
    if (value === '') {
      return `${property} must not be empty`;
    }
    if (invalidChar) {
      return `${property} contains invalid character '${invalidChar}' in '${value}'`;
    }
    return `${property} contains invalid characters in '${value}'`;
  }

  /** Which component failed: `'URN'`, `'NID'` or `'NSS'`. */
  readonly property: string;
  /** The offending component value. */
  readonly value: string;
  /** The first disallowed character, when one could be identified. */
  readonly invalidChar?: string;
}
