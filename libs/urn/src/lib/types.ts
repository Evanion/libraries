/**
 * A full URN that might contain additional components or fragment.
 */
export type IFullURN<
  URN extends string,
  NID extends string,
  NSS extends string,
  x extends string = ''
> = `${URN}:${NID}:${NSS}${x}`;

/**
 * A basic URN that doesn't include ANY additional components or fragments.
 */
export type IBasicURN<
  URN extends string,
  NID extends string,
  NSS extends string
> = IFullURN<URN, NID, NSS>;

/**
 * The object that is returned when a URN is parsed
 */
export interface ParsedURN<
  URN extends string,
  NID extends string,
  NSS extends string
> {
  /**
   * The Schema
   */
  urn: URN;
  /**
   * The Namespace ID
   */
  nid: NID;
  /**
   * The Namespace Specific String
   */
  nss: NSS | `${NID}:${NSS}`;
}
