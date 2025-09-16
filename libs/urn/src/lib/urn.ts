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
    if (!this.isValid.test(urn)) throw new InvalidError('URN');
    if (!this.isValid.test(nid)) throw new InvalidError('NID');

    if (nss.startsWith(`${nid}${this.separator}`))
      return `${urn}${this.separator}${nss}`;

    return `${urn}${this.separator}${nid}${this.separator}${nss}`;
  }

  /**
   * Checks that a string only contains characters A-Z and 0-9 (case insensitive)
   */
  static readonly isValid = /^[a-z0-9]*$/i;
}
