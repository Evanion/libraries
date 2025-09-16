import { InvalidError } from './exceptions';
import { ParsedURN } from './types';

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
   * Parses a URN and returns it's constituent parts
   * @param urnString
   * @returns object that contains the parts of the URN
   */
  static parse<INSS extends string, INID extends string, IURN extends string>(
    urnString: string
  ): ParsedURN<IURN, INID, INSS> {
    const [urn, nid, ...nss] = urnString.split(this.separator) as [
      IURN,
      INID,
      ...[INSS]
    ];

    if (nid !== this.nid)
      return {
        urn,
        nid,
        nss: `${nid}:${nss.join(this.separator)}` as `${INID}:${INSS}`,
      };

    return {
      urn,
      nid,
      nss: nss.join(this.separator) as INSS,
    };
  }
  /**
   * Takes a namespace specific string (ie object ID) and returns a URN.
   * @param urn Schema
   * @param nid Namespace ID
   * @param nss Namespace specific string
   * @returns generated URN
   */
  static stringify(nss: string, nid = this.nid, urn = this.urn) {
    if (!this.isValid.test(urn)) {
      const invalidChar = this.findInvalidChar(urn);
      throw new InvalidError('URN', urn, invalidChar);
    }
    if (!this.isValid.test(nid)) {
      const invalidChar = this.findInvalidChar(nid);
      throw new InvalidError('NID', nid, invalidChar);
    }
    if (!this.isValid.test(nss)) {
      const invalidChar = this.findInvalidChar(nss);
      throw new InvalidError('NSS', nss, invalidChar);
    }

    if (nss.startsWith(`${nid}${this.separator}`))
      return `${urn}${this.separator}${nss}`;

    return `${urn}${this.separator}${nid}${this.separator}${nss}`;
  }

  /**
   * Checks that a string contains only RFC-compliant URN characters
   * Allows: alphanumeric, hyphens, underscores, dots, tildes, and colons
   * But excludes characters that are not allowed in URN components
   */
  static readonly isValid = /^[a-z0-9\-._~:]*$/i;

  /**
   * Helper method to find the first invalid character in a string
   * @param str The string to check
   * @returns The first invalid character or undefined if all characters are valid
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
   * Extracts just the identifier (NSS) from a URN string
   * @param urnString The URN string to extract from
   * @returns The namespace-specific string (identifier)
   */
  static extractId(urnString: string): string {
    const parts = urnString.split(this.separator);
    if (parts.length < 3) {
      throw new Error('Invalid URN format');
    }
    // Return everything after the first two parts (urn:nid:)
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
   * @param expectedUrn The expected URN scheme (optional, defaults to 'urn')
   * @returns true if the URN belongs to the specified namespace
   */
  static belongsToNamespace(
    urnString: string,
    expectedNid: string,
    expectedUrn = 'urn'
  ): boolean {
    try {
      const parsed = this.parse(urnString);
      return parsed.urn === expectedUrn && parsed.nid === expectedNid;
    } catch {
      return false;
    }
  }
}
