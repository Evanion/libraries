import { InvalidError, ValidationError } from './exceptions.js';
import { ParsedURN } from './types.js';

export class URN {
  /**
   * separator between the different parts of the URN
   */
  static readonly separator: string = ':';

  /**
   * URN schema; The first part of the URN
   */
  static readonly urn: string = 'urn';

  /**
   * namespace ID
   * identifies the resource type
   */
  static readonly nid: string = 'nid';

  /**
   * Parses a URN and returns it's constituent parts.
   *
   * When the parsed NID differs from this class's own `nid`, the NID is kept as
   * part of the returned `nss` -- so a subclass reading a URN from a foreign
   * namespace does not silently lose that namespace.
   *
   * @param urnString The URN string to parse
   * @returns object that contains the parts of the URN
   * @throws {ValidationError} if the string is not a well-formed URN
   */
  static parse(urnString: string): ParsedURN {
    const [urn, nid, ...rest] = urnString.split(this.separator);

    // The undefined checks are what narrow urn and nid to string under
    // noUncheckedIndexedAccess. They are also the real guard: destructuring a
    // short split is exactly how this method used to produce the literal string
    // "undefined:".
    if (
      urn === undefined ||
      nid === undefined ||
      !this.isValidFormat(urnString)
    ) {
      throw new ValidationError(
        `Invalid URN format: '${urnString}'. Expected at least three non-empty parts separated by '${this.separator}', e.g. '${this.urn}${this.separator}${this.nid}${this.separator}id'.`,
      );
    }

    const nss = rest.join(this.separator);

    if (nid !== this.nid)
      return { urn, nid, nss: `${nid}${this.separator}${nss}` };

    return { urn, nid, nss };
  }

  /**
   * Takes a namespace specific string (ie object ID) and returns a URN.
   * @param urn Schema
   * @param nid Namespace ID
   * @param nss Namespace specific string
   * @returns generated URN
   * @throws {InvalidError} if any component is empty or contains a disallowed character
   *
   * Returns a plain `string` rather than a template-literal type: `separator`
   * is a static that subclasses may override, so any `${urn}:${nid}:${nss}`
   * type would be wrong for them.
   */
  static stringify(nss: string, nid = this.nid, urn = this.urn): string {
    this.assertValidComponent('URN', urn);
    this.assertValidComponent('NID', nid);
    this.assertValidComponent('NSS', nss);

    if (nss.startsWith(`${nid}${this.separator}`))
      return `${urn}${this.separator}${nss}`;

    return `${urn}${this.separator}${nid}${this.separator}${nss}`;
  }

  /**
   * Checks that a string contains only RFC-compliant URN characters.
   * Allows: alphanumeric, hyphens, underscores, dots, tildes, and colons.
   *
   * Requires at least one character -- an empty component would otherwise
   * produce a URN that `isValidFormat` rejects.
   */
  static readonly isValid = /^[a-z0-9\-._~:]+$/i;

  /**
   * Throws a descriptive {@link InvalidError} if a component is not valid.
   */
  private static assertValidComponent(property: string, value: string): void {
    if (!this.isValid.test(value)) {
      throw new InvalidError(property, value, this.findInvalidChar(value));
    }
  }

  /**
   * Helper method to find the first invalid character in a string
   * @param str The string to check
   * @returns The first invalid character, or undefined if there is none
   *   (which is the case for an empty string)
   */
  private static findInvalidChar(str: string): string | undefined {
    for (const char of str) {
      if (!this.isValid.test(char)) {
        return char;
      }
    }
    return undefined;
  }

  /**
   * Checks if a string is a valid URN format (has the correct structure)
   * @param urnString The string to validate
   * @returns true if the string has valid URN structure
   */
  static isValidFormat(urnString: string): boolean {
    const parts = urnString.split(this.separator);
    return parts.length >= 3 && parts.every((part) => part.length > 0);
  }

  /**
   * Extracts just the identifier from a URN string: everything after the
   * scheme and the NID.
   *
   * This is deliberately *structural* and differs from `parse(urnString).nss`
   * on a foreign namespace. `parse` keeps a non-matching NID attached to the
   * `nss` so the namespace is not silently lost, whereas `extractId` always
   * drops it:
   *
   * ```ts
   * URN.parse('urn:user:123').nss   // 'user:123' -- base class nid is 'nid'
   * URN.extractId('urn:user:123')   // '123'
   * ```
   *
   * Reach for `parse` when the namespace matters, and `extractId` when you
   * only want the trailing identifier.
   *
   * @param urnString The URN string to extract from
   * @returns The identifier portion
   * @throws {ValidationError} if the string is not a well-formed URN
   */
  static extractId(urnString: string): string {
    if (!this.isValidFormat(urnString)) {
      throw new ValidationError(
        `Invalid URN format: '${urnString}'. Expected at least three non-empty parts separated by '${this.separator}'.`,
      );
    }
    const parts = urnString.split(this.separator);
    // Everything after the scheme and the NID.
    return parts.slice(2).join(this.separator);
  }

  /**
   * Checks if two URNs are in the same namespace (same URN scheme and NID)
   * @param urn1 First URN string
   * @param urn2 Second URN string
   * @returns true if both URNs have the same scheme and namespace ID
   */
  static sameNamespace(urn1: string, urn2: string): boolean {
    try {
      const parsed1 = this.parse(urn1);
      const parsed2 = this.parse(urn2);
      return parsed1.urn === parsed2.urn && parsed1.nid === parsed2.nid;
    } catch {
      return false;
    }
  }

  /**
   * Checks if a URN belongs to a specific namespace
   * @param urnString The URN string to check
   * @param expectedNid The expected namespace ID
   * @param expectedUrn The expected URN scheme; defaults to this class's own scheme
   * @returns true if the URN belongs to the specified namespace
   */
  static belongsToNamespace(
    urnString: string,
    expectedNid: string,
    expectedUrn: string = this.urn,
  ): boolean {
    try {
      const parsed = this.parse(urnString);
      return parsed.urn === expectedUrn && parsed.nid === expectedNid;
    } catch {
      return false;
    }
  }
}
