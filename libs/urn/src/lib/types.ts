/**
 * A URN string with known parts, for annotating literals in consumer code.
 *
 * Assumes the default `:` separator. A subclass with a custom separator cannot
 * be described by this type.
 *
 * @example
 * ```ts
 * type UserUrn = IFullURN<'urn', 'user', string>; // `urn:user:${string}`
 * const id: UserUrn = 'urn:user:123';
 * ```
 */
export type IFullURN<
  URN extends string,
  NID extends string,
  NSS extends string,
> = `${URN}:${NID}:${NSS}`;

/**
 * The three optional components RFC 8141 2.3 allows after the NSS.
 *
 * Each is carried in its wire form, without its introducing delimiter and
 * without any percent-decoding. RFC 8141 3.1 excludes all three from
 * URN-equivalence, so `URN.equals` ignores them.
 *
 * @example
 * ```ts @import.meta.vitest
 * import { URN } from '@evanion/urn';
 *
 * class ExampleURN extends URN {
 *   static override readonly nid = 'example';
 * }
 *
 * ExampleURN.parse('urn:example:foo?+r?=q#f'); // -> { urn: 'urn', nid: 'example', nss: 'foo', rComponent: 'r', qComponent: 'q', fComponent: 'f' }
 * ```
 */
export interface URNComponents {
  /**
   * The r-component, introduced by `?+`: parameters meant for the resolution
   * service. RFC 8141 2.3.1.
   */
  rComponent?: string;
  /**
   * The q-component, introduced by `?=`: parameters meant for the named
   * resource. RFC 8141 2.3.2.
   */
  qComponent?: string;
  /**
   * The f-component, introduced by `#`: a secondary resource within the named
   * one. RFC 8141 2.3.3. Unlike the other two it may be the empty string, so
   * `urn:example:foo#` parses to `fComponent: ''` and round-trips.
   */
  fComponent?: string;
}

/**
 * The object returned by `URN.parse`.
 *
 * The parts are plain strings, and deliberately not type parameters. `parse`
 * takes a runtime `string`, so it cannot know their literal types; free type
 * parameters here would let `URN.parse<'a', 'b', 'c'>(someString)` assert a
 * shape nothing verifies.
 *
 * The three component keys are absent rather than `undefined` when the URN
 * carries no components, so such a URN parses to exactly `{ urn, nid, nss }`.
 */
export interface ParsedURN extends URNComponents {
  /** The scheme, e.g. `urn`. */
  urn: string;
  /** The namespace ID. */
  nid: string;
  /**
   * The namespace specific string.
   *
   * Returned in its original case, with percent-triplets intact and with any
   * r-, q- or f-component split off into its own field.
   *
   * When the parsed scheme differs from the parsing class's own `urn`, the
   * whole original identifier is retained here; when only the NID differs, the
   * NID is retained here. Either way the namespace is not silently lost.
   */
  nss: string;
}

/**
 * The object form of `URN.stringify`'s arguments.
 *
 * The keys match {@link ParsedURN}, so a parsed URN can be handed straight
 * back: `URN.stringify(URN.parse(x))` returns `x` for a URN in the parsing
 * class's own namespace. The scheme and the NID are optional and fall back to
 * the class's own, which is what makes `{ nss }` alone valid.
 */
export interface URNParts extends URNComponents {
  /** The scheme. Defaults to the class's own `urn`. */
  urn?: string;
  /** The namespace ID. Defaults to the class's own `nid`. */
  nid?: string;
  /** The namespace specific string. */
  nss: string;
}
