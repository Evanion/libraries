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
> = `${URN}:${NID}:${NSS}`;

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
   * Returned in its original case, with percent-triplets intact.
   *
   * When the parsed scheme differs from the parsing class's own `urn`, the
   * whole original identifier is retained here; when only the NID differs, the
   * NID is retained here. Either way the namespace is not silently lost.
   */
  nss: string;
}
