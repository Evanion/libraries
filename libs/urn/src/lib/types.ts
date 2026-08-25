/**
 * A URN string with known parts, for annotating literals in consumer code.
 *
 * ```ts
 * type UserUrn = IFullURN<'urn', 'user', string>;  // `urn:user:${string}`
 * const id: UserUrn = 'urn:user:123';
 * ```
 *
 * Assumes the default `:` separator. A subclass with a custom separator cannot
 * be described by this type.
 */
export type IFullURN<
  URN extends string,
  NID extends string,
  NSS extends string,
  x extends string = '',
> = `${URN}:${NID}:${NSS}${x}`;

/**
 * The object returned by `URN.parse`.
 *
 * The parts are plain strings on purpose. `parse` takes a runtime `string`, so
 * it cannot know their literal types; earlier versions declared free type
 * parameters here that the caller could set to anything, which let
 * `URN.parse<'a', 'b', 'c'>(someString)` claim a shape nothing verified.
 */
export interface ParsedURN {
  /** The scheme, e.g. `urn`. */
  urn: string;
  /** The namespace ID. */
  nid: string;
  /**
   * The namespace specific string.
   *
   * When the parsed NID differs from the parsing class's own `nid`, the NID is
   * retained here so the namespace is not silently lost.
   */
  nss: string;
}
