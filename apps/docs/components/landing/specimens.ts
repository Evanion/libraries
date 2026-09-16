import { EmptyInputError, Luhn } from '@evanion/luhn';
import {
  createToken,
  DEFAULT_DICTIONARY,
  InvalidAlphabetError,
  type Token,
} from '@evanion/token';
import { URN, type ParsedURN } from '@evanion/urn';

/**
 * What each identifier package produces, for the card that sells it, and the
 * package itself doing the producing.
 *
 * A description says what a library is for; a specimen shows the thing. These
 * are the values the three cards open on, and the functions the cards call as
 * a reader interacts: the check character is `Luhn.generate`'s, a new token
 * is `createToken().generate()`'s, the parts of a URN are `URN.parse`'s. The
 * card cannot disagree with the package about a value it asked the package
 * for, and `specimens.test.tsx` renders each card and holds it to that.
 *
 * Shared by the server, which renders the opening values, and the client
 * islands, which render the rest; nothing here touches the filesystem.
 */

/** The text the Luhn card opens with. Its README states `foo` -> `5`. */
export const luhnBody = 'foo';

/**
 * The check character for `body` under the default dictionary, or nothing
 * when no code point of `body` is in it -- a check character over no payload
 * carries no information, and the package throws rather than pretend.
 */
export function luhnCheck(body: string): string | undefined {
  try {
    return Luhn.generate(body).checksum;
  } catch (error) {
    if (error instanceof EmptyInputError) return undefined;
    throw error;
  }
}

/** The code the Token card opens with. Its README states this value. */
export const tokenSpecimen = 'a4kp-9mxa';

/** The default token: eight characters, chunked in fours, check last. */
export const token = createToken();

/** A code as the card sets it: the body, then the check character in colour. */
export function tokenParts(value: string): { body: string; check: string } {
  return { body: value.slice(0, -1), check: value.slice(-1) };
}

/** A code's total length and the characters between its separators. */
export interface TokenShape {
  length: number;
  chunkSize: number;
}

/**
 * The shapes the Token card offers.
 *
 * `chunkSize` divides `length` in each, which the package requires: a trailing
 * chunk shorter than the rest is the thing that is hard to say. The last one
 * chunks at its own length, which is the package's way of asking for no
 * separators at all.
 */
export const tokenShapes: readonly TokenShape[] = [
  { length: 8, chunkSize: 4 },
  { length: 9, chunkSize: 3 },
  { length: 8, chunkSize: 8 },
];

/** A shape written the way the code is said: the chunks, in order. */
export function shapeLabel({ length, chunkSize }: TokenShape): string {
  return Array.from({ length: length / chunkSize }, () =>
    String(chunkSize),
  ).join('-');
}

/** An alphabet the Token card offers, and what a reader should call it. */
export interface TokenAlphabet {
  label: string;
  dictionary: string;
}

/**
 * The alphabets the Token card offers.
 *
 * The last is every lowercase letter and digit, which `createToken` refuses,
 * and the refusal is the reason the control is here: the package names the
 * characters it will not draw rather than leaving the reader to trust that it
 * avoids them.
 */
export const tokenAlphabets: readonly TokenAlphabet[] = [
  { label: 'no lookalikes', dictionary: DEFAULT_DICTIONARY },
  { label: 'hex', dictionary: '0123456789abcdef' },
  { label: 'all 36', dictionary: '0123456789abcdefghijklmnopqrstuvwxyz' },
];

/** A configuration the package accepted, or the characters it refused. */
export type TokenAttempt =
  | { kind: 'built'; token: Token }
  | { kind: 'refused'; offending: readonly string[] };

/**
 * `createToken` for the shape and the alphabet standing at those positions,
 * with its refusal caught.
 *
 * Positions rather than values, because the card holds what its two controls
 * point at; an index past either list falls back to the first entry, which is
 * the configuration the README states.
 *
 * Only `InvalidAlphabetError` is caught, because only a dictionary the card
 * offers can raise one; every shape the card offers is well formed, so a
 * shape error would be a fault in this file and is left to surface.
 */
export function buildToken(shape: number, alphabet: number): TokenAttempt {
  const { length, chunkSize } =
    tokenShapes[shape] ?? (tokenShapes[0] as TokenShape);
  const { dictionary } =
    tokenAlphabets[alphabet] ?? (tokenAlphabets[0] as TokenAlphabet);

  try {
    return {
      kind: 'built',
      token: createToken({ length, chunkSize, dictionary }),
    };
  } catch (error) {
    if (error instanceof InvalidAlphabetError) {
      return { kind: 'refused', offending: error.offending };
    }
    throw error;
  }
}

/**
 * Codes drawn before a collision is even odds, from `entropyBits`.
 *
 * The birthday bound, `sqrt(2 ln 2 * 2^bits)`, rounded to three significant
 * figures -- a collision budget is an order of magnitude, and a card that
 * reported 218,268 would be claiming a precision the bound does not have.
 */
export function collisionAt(entropyBits: number): number {
  const codes = Math.sqrt(2 * Math.LN2) * 2 ** (entropyBits / 2);
  const scale = 10 ** (Math.floor(Math.log10(codes)) - 2);
  return Math.round(codes / scale) * scale;
}

/** The identifier the URN card opens with. */
export const urnSpecimen = 'urn:user:1337';

/**
 * The card's namespace, as a subclass, which is the package's extension
 * point. With `nid` set, `parse` gives back the name without the namespace;
 * the base class, whose `nid` is a placeholder, keeps `user:` in the `nss`
 * rather than discard a namespace it was not told about.
 */
export class UserURN extends URN {
  static override readonly nid = 'user';
}

/** The parts of the specimen, from the package's own parser. */
export function urnParts(value: string): ParsedURN {
  return UserURN.parse(value);
}

/** Which of RFC 8141 2.3's optional components a card segment is. */
export type ComponentKey = 'rComponent' | 'qComponent' | 'fComponent';

/** An optional component, as the card offers and explains it. */
export interface UrnComponent {
  key: ComponentKey;
  /** What the reader presses to attach it. */
  label: string;
  /** What introduces it in the identifier. */
  delimiter: string;
  /** What the card attaches, chosen to be plausible for a user record. */
  value: string;
  /** The heading of its explanation, matching the other three parts. */
  name: string;
  /** What it is, in one sentence. */
  line: string;
}

/**
 * The three components RFC 8141 2.3 allows after the name, in the order the
 * grammar puts them.
 *
 * Each sentence is the RFC's own division of labour: the r-component is read
 * by whatever resolves the name, the q-component by the thing that resolving
 * it produces, the f-component by the client once it holds that thing. They
 * are easy to conflate and the distinction is the only reason there are three
 * of them rather than one.
 */
export const urnComponents: readonly UrnComponent[] = [
  {
    key: 'rComponent',
    label: 'resolver',
    delimiter: '?+',
    value: 'dir=eu',
    name: 'r-component',
    line: 'Parameters for whatever resolves the name: which directory to ask, which mirror. Read on the way to the record, never by the record.',
  },
  {
    key: 'qComponent',
    label: 'resource',
    delimiter: '?=',
    value: 'v=2',
    name: 'q-component',
    line: 'Parameters for the record the name resolves to, such as a version or a view. Handed on once the name has been resolved.',
  },
  {
    key: 'fComponent',
    label: 'fragment',
    delimiter: '#',
    value: 'avatar',
    name: 'f-component',
    line: 'A place inside the record, the way a fragment points into a page. The client reads it, after it has the record.',
  },
];

/**
 * The specimen carrying `attached`, written by the package.
 *
 * `stringify` places the components and their delimiters, and `extractId`
 * recovers the name from `base`, so the card never assembles an identifier by
 * concatenation -- which is the same rule the parts on the card follow in the
 * other direction.
 */
export function urnWith(
  base: string,
  attached: readonly ComponentKey[],
): string {
  return UserURN.stringify({
    nss: UserURN.extractId(base),
    ...Object.fromEntries(
      urnComponents
        .filter((component) => attached.includes(component.key))
        .map((component) => [component.key, component.value]),
    ),
  });
}

/** Whether two identifiers name the same thing, as the package judges it. */
export function urnEquals(a: string, b: string): boolean {
  return UserURN.equals(a, b);
}
