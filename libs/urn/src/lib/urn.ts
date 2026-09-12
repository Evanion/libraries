import { InvalidError, ValidationError } from './exceptions.js';
import { ParsedURN, URNComponents, URNParts } from './types.js';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** RFC 3986 3.1: `scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )`. */
const SCHEME_GRAMMAR = /^[A-Za-z][A-Za-z0-9+.-]*$/;
const SCHEME_CHAR = /^[A-Za-z0-9+.-]$/;

/** RFC 8141 2: `NID = (alphanum) 0*30(ldh) (alphanum)`. */
const NID_WRITE_GRAMMAR = /^[A-Za-z0-9][A-Za-z0-9-]{0,30}[A-Za-z0-9]$/;
/** The same, with RFC 2141's floor of one character. See {@link URN.parse}. */
const NID_READ_GRAMMAR = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,30}[A-Za-z0-9])?$/;
const NID_CHAR = /^[A-Za-z0-9-]$/;

/**
 * RFC 8141 2: `NSS = pchar *(pchar / "/")`, where RFC 3986 3.3 defines
 * `pchar = unreserved / pct-encoded / sub-delims / ":" / "@"`.
 */
const NSS_GRAMMAR =
  /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/]|%[0-9A-Fa-f]{2})*$/;
/** Every character a valid NSS may contain, `%` included, for diagnostics. */
const NSS_CHAR = /^[A-Za-z0-9\-._~!$&'()*+,;=:@/%]$/;

/**
 * RFC 8141 2.3: `r-component = pchar *(pchar / "/" / "?")`, and the
 * q-component is the same production. `?` is legal inside both; `#` is not,
 * since it introduces the f-component.
 */
const RQ_COMPONENT_GRAMMAR =
  /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9A-Fa-f]{2})*$/;

/**
 * RFC 8141 2.3: `f-component = fragment`, which RFC 3986 3.5 defines as
 * `*(pchar / "/" / "?")` -- the same set, with no first-character rule and no
 * minimum length.
 */
const F_COMPONENT_GRAMMAR =
  /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9A-Fa-f]{2})*$/;

/** Every character an r-, q- or f-component may contain, for diagnostics. */
const COMPONENT_CHAR = /^[A-Za-z0-9\-._~!$&'()*+,;=:@/?%]$/;

/** Characters that never need percent-encoding: RFC 3986 2.3 `unreserved`. */
const UNRESERVED = /^[A-Za-z0-9\-._~]$/;

/**
 * A URN, as defined by RFC 8141, with one deliberate deviation: RFC 8141
 * requires the literal scheme `urn`, and this class allows any scheme through
 * the overridable {@link URN.urn} static.
 *
 * The RFC claim is scoped to the default `:` separator. A subclass that
 * overrides {@link URN.separator} gets separator-derived exclusion for the
 * scheme and the NID instead of the RFC grammars, and is not RFC 8141
 * conformant. The NSS keeps the RFC grammar under every separator.
 *
 * The optional r-, q- and f-components of RFC 8141 2.3 are split off the tail
 * before the separator split, and are parsed under every separator except one
 * that itself contains `?` or `#` -- such a separator is indistinguishable
 * from a component delimiter, so the whole tail stays in the NSS there.
 *
 * Every static reads `this`, so they cannot be destructured the way
 * `JSON.stringify` can: `const { stringify } = URN` then `stringify('a')`
 * throws a `TypeError`, because the default parameter `nid = this.nid` runs
 * with `this` undefined. Call them on the class.
 */
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
   * The grammar the scheme must match.
   *
   * RFC 3986 3.1 under the default separator; a separator-excluding character
   * class otherwise.
   */
  static get schemeGrammar(): RegExp {
    return this.separator === ':' ? SCHEME_GRAMMAR : this.genericGrammar;
  }

  /**
   * The grammar the NID must match on the **write** path.
   *
   * RFC 8141 2 under the default separator -- alphanumerics and `-`, two to
   * thirty-two characters, no leading or trailing `-`. A separator-excluding
   * character class with no length bounds otherwise.
   */
  static get nidGrammar(): RegExp {
    return this.separator === ':' ? NID_WRITE_GRAMMAR : this.genericGrammar;
  }

  /**
   * The grammar the NSS must match, on both paths and under every separator.
   *
   * RFC 8141 2 `pchar *(pchar / "/")`. The NSS never needs separator
   * exclusion: `parse` splits on the separator and rejoins the tail, which is
   * lossless, so the NSS cannot structurally collide with it.
   */
  static get nssGrammar(): RegExp {
    return NSS_GRAMMAR;
  }

  /**
   * The grammar the r-component must match: RFC 8141 2.3.1
   * `pchar *(pchar / "/" / "?")`.
   *
   * A bare `?` is allowed inside it; a `#` is not, because `#` introduces the
   * f-component.
   */
  static get rComponentGrammar(): RegExp {
    return RQ_COMPONENT_GRAMMAR;
  }

  /**
   * The grammar the q-component must match: RFC 8141 2.3.2, the same
   * production as {@link rComponentGrammar}.
   */
  static get qComponentGrammar(): RegExp {
    return RQ_COMPONENT_GRAMMAR;
  }

  /**
   * The grammar the f-component must match: RFC 8141 2.3.3 `fragment`, per
   * RFC 3986 3.5.
   *
   * This is the one component grammar that accepts the empty string, so a URN
   * ending in a bare `#` is well-formed.
   */
  static get fComponentGrammar(): RegExp {
    return F_COMPONENT_GRAMMAR;
  }

  /**
   * The grammar the NID must match on the **read** path: {@link nidGrammar}
   * with a floor of one character.
   *
   * RFC 2141 2 defined `NID ::= <let-num> [ 1,31<let-num-hyp> ]`, permitting a
   * one-character NID, and RFC 8141 Appendix B keeps every URN that was valid
   * under the earlier specification valid. The charset is not relaxed: RFC 2141
   * never permitted `_`, `.` or `~` either.
   */
  protected static get nidReadGrammar(): RegExp {
    return this.separator === ':' ? NID_READ_GRAMMAR : this.genericGrammar;
  }

  /**
   * Fallback grammar for the scheme and the NID under a custom separator:
   * a generic character class with the separator excluded by lookahead, which
   * works even when the separator is alphanumeric.
   */
  private static get genericGrammar(): RegExp {
    return new RegExp(
      `^(?:(?!${escapeRegex(this.separator)})[A-Za-z0-9._~-])+$`,
    );
  }

  /**
   * Whether `?+`, `?=` and `#` are read as component delimiters.
   *
   * False only for a separator that contains one of the delimiter characters,
   * where a delimiter and a separator cannot be told apart. Such a subclass
   * keeps the whole tail as its NSS and rejects components on write.
   */
  private static get parsesComponents(): boolean {
    return !this.separator.includes('?') && !this.separator.includes('#');
  }

  private static get genericChar(): RegExp {
    return new RegExp(
      `^(?:(?!${escapeRegex(this.separator)})[A-Za-z0-9._~-])$`,
    );
  }

  /**
   * Parses a URN and returns its constituent parts.
   *
   * The parts are returned in their original case; nothing is normalised and
   * no percent-triplet is decoded, because RFC 8141 3.1 requires that
   * percent-encoded octets stay opaque for equivalence purposes. Use
   * {@link equals} to compare two URNs, and {@link decodeNss} to decode.
   *
   * When the parsed scheme differs from this class's own `urn`, the whole
   * original identifier is kept as the returned `nss`; when only the NID
   * differs, the NID is kept as part of the `nss`. Either way a subclass
   * reading a URN from a foreign namespace does not silently lose it. Both
   * comparisons are case-folded, since RFC 8141 3.1 makes the scheme and the
   * NID case-insensitive.
   *
   * An r-, q- or f-component (RFC 8141 2.3) is returned in its own field and
   * never folded into the `nss`, whichever namespace the URN belongs to. A URN
   * that carries none parses to exactly `{ urn, nid, nss }`: the component
   * keys are absent rather than `undefined`.
   *
   * The read path is lenient in exactly one respect: it accepts a
   * one-character NID, which RFC 2141 permitted. See {@link nidReadGrammar}.
   *
   * ```ts
   * URN.parse('urn:example:weather?=lat=39#today');
   * // { urn: 'urn', nid: 'example', nss: 'weather',
   * //   qComponent: 'lat=39', fComponent: 'today' }
   * ```
   *
   * @param urnString The URN string to parse
   * @returns object that contains the parts of the URN
   * @throws {ValidationError} if the string is not a well-formed URN
   */
  static parse(urnString: string): ParsedURN {
    const { urn, nid, nss, components } = this.splitParts(urnString);

    if (!this.sameToken(urn, this.urn))
      return {
        urn,
        nid,
        nss: `${urn}${this.separator}${nid}${this.separator}${nss}`,
        ...components,
      };

    if (!this.sameToken(nid, this.nid))
      return { urn, nid, nss: `${nid}${this.separator}${nss}`, ...components };

    return { urn, nid, nss, ...components };
  }

  /**
   * Takes the parts of a URN and returns the URN string.
   *
   * ```ts
   * URN.stringify('123', 'user');                       // 'urn:user:123'
   * URN.stringify({ nss: '123', nid: 'user' });         // 'urn:user:123'
   * URN.stringify({ nss: 'weather', nid: 'example', qComponent: 'lat=39' });
   * // 'urn:example:weather?=lat=39'
   * ```
   *
   * `stringify` operates on the wire form. It does not percent-encode: an NSS
   * that is not already encoded, such as one containing a literal space, is
   * rejected. Encode with {@link encodeNss} first if you need to.
   *
   * Returns a plain `string` rather than a template-literal type: `separator`
   * is a static that subclasses may override, so any `${urn}:${nid}:${nss}`
   * type would be wrong for them.
   *
   * @param parts The parts of the URN, keyed as {@link parse} returns them
   * @returns generated URN
   * @throws {InvalidError} if any part is empty or breaks its grammar
   */
  static stringify(parts: URNParts): string;
  /**
   * The positional form. Its arguments are in the reverse order of `parse`'s
   * return shape, so `stringify(...Object.values(parse(x)))` is wrong and
   * silently produces a URN with the scheme and the NSS swapped. The object
   * overload keys the parts by name and carries the r-, q- and f-components,
   * which this form cannot express, so `stringify(parse(x))` returns `x` for a
   * URN in this class's own namespace.
   *
   * @param nss Namespace specific string
   * @param nid Namespace ID
   * @param urn Schema
   */
  static stringify(nss: string, nid?: string, urn?: string): string;
  // The defaults sit in the parameter list so the positional overload can fall
  // back to the calling class's own statics. That is also what makes every
  // static unbound: `this` is read before the body runs.
  static stringify(
    nssOrParts: string | URNParts,
    nid = this.nid,
    urn = this.urn,
  ): string {
    const parts: URNParts =
      typeof nssOrParts === 'string'
        ? { nss: nssOrParts, nid, urn }
        : nssOrParts;
    const scheme = parts.urn ?? this.urn;
    const namespace = parts.nid ?? this.nid;

    this.assertScheme(scheme);
    this.assertNid(namespace, this.nidGrammar);
    this.assertNss(parts.nss);
    this.assertComponents(parts);

    return (
      `${scheme}${this.separator}${namespace}${this.separator}${parts.nss}` +
      this.stringifyComponents(parts)
    );
  }

  /**
   * Checks if a string is a valid URN.
   *
   * Delegates to {@link parse}, so the read path and this predicate cannot
   * drift apart.
   *
   * @param urnString The string to validate
   * @returns true if the string parses
   */
  static isValidFormat(urnString: string): boolean {
    try {
      this.parse(urnString);
      return true;
    } catch {
      return false;
    }
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
   * Any r-, q- or f-component is dropped: they address a resolution service, a
   * resource's parameters and a secondary resource, none of which are part of
   * the identifier.
   *
   * @param urnString The URN string to extract from
   * @returns The identifier portion
   * @throws {ValidationError} if the string is not a well-formed URN
   */
  static extractId(urnString: string): string {
    return this.splitParts(urnString).nss;
  }

  /**
   * Checks if two URNs are in the same namespace (same URN scheme and NID).
   *
   * The scheme and the NID are compared case-insensitively, per RFC 8141 3.1.
   *
   * @param urn1 First URN string
   * @param urn2 Second URN string
   * @returns true if both URNs have the same scheme and namespace ID
   */
  static sameNamespace(urn1: string, urn2: string): boolean {
    try {
      const a = this.splitParts(urn1);
      const b = this.splitParts(urn2);
      return this.sameToken(a.urn, b.urn) && this.sameToken(a.nid, b.nid);
    } catch {
      return false;
    }
  }

  /**
   * Checks if a URN belongs to a specific namespace.
   *
   * The scheme and the NID are compared case-insensitively, per RFC 8141 3.1.
   *
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
      const parsed = this.splitParts(urnString);
      return (
        this.sameToken(parsed.urn, expectedUrn) &&
        this.sameToken(parsed.nid, expectedNid)
      );
    } catch {
      return false;
    }
  }

  /**
   * URN equivalence, as defined by RFC 8141 3.1.
   *
   * The scheme and the NID are compared case-insensitively. The NSS is
   * compared character for character, except that the hex digits of a
   * percent-triplet are canonicalised to uppercase -- a percent-encoded octet
   * is never decoded, so `%2C` and `,` are *not* equivalent.
   *
   * Returns `false` for malformed input rather than throwing.
   */
  static equals(a: string, b: string): boolean {
    try {
      const left = this.splitParts(a);
      const right = this.splitParts(b);
      return (
        this.sameToken(left.urn, right.urn) &&
        this.sameToken(left.nid, right.nid) &&
        canonicaliseTriplets(left.nss) === canonicaliseTriplets(right.nss)
      );
    } catch {
      return false;
    }
  }

  /**
   * Splits a URN into its three raw parts and validates each against its
   * role's read grammar. Unlike {@link parse} it never folds a foreign scheme
   * or NID into the NSS, which is what the comparison methods need.
   */
  private static splitParts(urnString: string): {
    urn: string;
    nid: string;
    nss: string;
    components: URNComponents;
  } {
    const { assignedName, components } = this.splitComponents(urnString);
    const [urn, nid, ...rest] = assignedName.split(this.separator);

    // The undefined checks are what narrow urn and nid to string under
    // noUncheckedIndexedAccess. They are also the real guard: without them, a
    // short split silently produces the literal string "undefined:" instead of
    // throwing.
    if (urn === undefined || nid === undefined || rest.length === 0) {
      throw new ValidationError(
        `Invalid URN format: '${urnString}'. Expected at least three non-empty parts separated by '${this.separator}', e.g. '${this.urn}${this.separator}${this.nid}${this.separator}id'.`,
      );
    }

    const nss = rest.join(this.separator);

    this.assertScheme(urn);
    this.assertNid(nid, this.nidReadGrammar);
    this.assertNss(nss);
    this.assertComponents(components);

    return { urn, nid, nss, components };
  }

  /**
   * Splits the r-, q- and f-components off the tail of a URN, leaving the
   * assigned name (`scheme : NID : NSS`) behind.
   *
   * The delimiters cannot be confused with the assigned name, because `pchar`
   * -- and so the NSS -- contains neither `?` nor `#`. The order is fixed by
   * RFC 8141 2.3: the f-component comes off first, because `#` terminates the
   * r- and q-components while both of those may contain a bare `?`; then the
   * first `?` of what is left introduces either the r-component (`?+`) or the
   * q-component (`?=`); an r-component runs to the first following `?=`.
   *
   * A separator containing `?` or `#` is indistinguishable from a component
   * delimiter, so a subclass using one gets no components and keeps the whole
   * tail as its NSS.
   */
  private static splitComponents(urnString: string): {
    assignedName: string;
    components: URNComponents;
  } {
    const components: URNComponents = {};
    if (!this.parsesComponents) return { assignedName: urnString, components };

    let assignedName = urnString;

    const hash = assignedName.indexOf('#');
    if (hash !== -1) {
      components.fComponent = assignedName.slice(hash + 1);
      assignedName = assignedName.slice(0, hash);
    }

    const question = assignedName.indexOf('?');
    if (question === -1) return { assignedName, components };

    const introducer = assignedName.slice(question, question + 2);
    const tail = assignedName.slice(question + 2);
    assignedName = assignedName.slice(0, question);

    if (introducer === '?+') {
      const q = tail.indexOf('?=');
      if (q === -1) {
        components.rComponent = tail;
      } else {
        components.rComponent = tail.slice(0, q);
        components.qComponent = tail.slice(q + 2);
      }
    } else if (introducer === '?=') {
      components.qComponent = tail;
    } else {
      throw new ValidationError(
        `Invalid URN format: '${urnString}'. A '?' may only appear as '?+' or '?=', introducing an r- or q-component.`,
      );
    }

    return { assignedName, components };
  }

  /** Validates whichever of the three optional components are present. */
  private static assertComponents(components: URNComponents): void {
    const { rComponent, qComponent, fComponent } = components;
    if (
      rComponent === undefined &&
      qComponent === undefined &&
      fComponent === undefined
    )
      return;

    if (!this.parsesComponents)
      throw new InvalidError(
        'COMPONENT',
        this.separator,
        undefined,
        "a separator containing '?' or '#' cannot be told apart from a component delimiter",
      );

    if (rComponent !== undefined)
      this.assertComponent('R-COMPONENT', rComponent, this.rComponentGrammar);
    if (qComponent !== undefined)
      this.assertComponent('Q-COMPONENT', qComponent, this.qComponentGrammar);
    if (fComponent !== undefined)
      this.assertComponent('F-COMPONENT', fComponent, this.fComponentGrammar);
  }

  private static assertComponent(
    property: string,
    value: string,
    grammar: RegExp,
  ): void {
    if (grammar.test(value)) return;
    if (value === '') throw new InvalidError(property, value);

    this.reject(
      property,
      value,
      COMPONENT_CHAR,
      value.includes('%')
        ? 'contains a malformed percent-encoded octet'
        : "must not start with '/' or '?'",
    );
  }

  /** Re-attaches the components to an assigned name, with their delimiters. */
  private static stringifyComponents(components: URNComponents): string {
    const { rComponent, qComponent, fComponent } = components;
    return (
      (rComponent === undefined ? '' : `?+${rComponent}`) +
      (qComponent === undefined ? '' : `?=${qComponent}`) +
      (fComponent === undefined ? '' : `#${fComponent}`)
    );
  }

  /** Case-folded token comparison, per RFC 8141 3.1. */
  private static sameToken(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
  }

  private static assertScheme(value: string): void {
    if (value === '') throw new InvalidError('URN', value);
    if (value.includes(this.separator))
      throw new InvalidError('URN', value, this.separator);
    if (this.schemeGrammar.test(value)) return;

    const charClass = this.separator === ':' ? SCHEME_CHAR : this.genericChar;
    this.reject('URN', value, charClass, 'must start with a letter');
  }

  private static assertNid(value: string, grammar: RegExp): void {
    if (value === '') throw new InvalidError('NID', value);
    if (value.includes(this.separator))
      throw new InvalidError('NID', value, this.separator);
    if (grammar.test(value)) return;

    const charClass = this.separator === ':' ? NID_CHAR : this.genericChar;
    this.reject('NID', value, charClass, describeNidFailure(value, grammar));
  }

  /**
   * The NSS carries no separator guard. Split-then-rejoin on the same
   * delimiter is lossless for the tail, so an NSS containing the separator
   * still round-trips -- which is what makes `stringify('user:42')` legal.
   */
  private static assertNss(value: string): void {
    // The NSS is the one part with no class-level fallback, so a caller
    // outside TypeScript can leave it off entirely. Without this guard the
    // grammar would test the string `'undefined'` and pass it.
    if (typeof value !== 'string') throw new InvalidError('NSS', '');
    if (value === '') throw new InvalidError('NSS', value);
    if (this.nssGrammar.test(value)) return;

    this.reject('NSS', value, NSS_CHAR, describeNssFailure(value));
  }

  /**
   * Throws an {@link InvalidError} naming the first character outside the
   * role's set, or the structural reason when every character is permitted.
   */
  private static reject(
    property: string,
    value: string,
    charClass: RegExp,
    reason?: string,
  ): never {
    const invalidChar = [...value].find((char) => !charClass.test(char));
    throw new InvalidError(
      property,
      value,
      invalidChar,
      invalidChar === undefined ? reason : undefined,
    );
  }
}

function describeNidFailure(value: string, grammar: RegExp): string {
  if (value.startsWith('-') || value.endsWith('-'))
    return "must not start or end with '-'";
  if (grammar === NID_WRITE_GRAMMAR && value.length < 2)
    return 'must be at least 2 characters long';
  if (value.length > 32) return 'must be at most 32 characters long';
  return 'does not match the namespace identifier grammar';
}

function describeNssFailure(value: string): string {
  if (value.includes('%')) return 'contains a malformed percent-encoded octet';
  if (value.startsWith('/')) return "must not start with '/'";
  return 'does not match the namespace specific string grammar';
}

/** Uppercases the hex digits of every percent-triplet, per RFC 8141 3.1. */
function canonicaliseTriplets(value: string): string {
  return value.replace(/%[0-9A-Fa-f]{2}/g, (triplet) => triplet.toUpperCase());
}

/**
 * Percent-encodes an arbitrary string into a valid NSS.
 *
 * Everything outside RFC 3986's `unreserved` set is encoded as UTF-8
 * percent-triplets with uppercase hex, so the result is safe in any position
 * of an NSS. Neither `stringify` nor `parse` calls this: encoding is an
 * explicit, separate step, so a value can never be double-encoded by accident.
 */
export function encodeNss(raw: string): string {
  let encoded = '';
  for (const char of raw) {
    if (UNRESERVED.test(char)) {
      encoded += char;
      continue;
    }
    for (const byte of new TextEncoder().encode(char)) {
      encoded += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return encoded;
}

/**
 * Decodes the percent-triplets in an NSS back to the raw string.
 *
 * @throws {ValidationError} if the input contains a malformed or truncated
 *   percent sequence.
 */
export function decodeNss(encoded: string): string {
  if (/%(?![0-9A-Fa-f]{2})/.test(encoded)) {
    throw new ValidationError(
      `Malformed percent-encoding in '${encoded}': '%' must be followed by two hex digits.`,
    );
  }
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new ValidationError(
      `Malformed percent-encoding in '${encoded}': not a valid UTF-8 sequence.`,
    );
  }
}
