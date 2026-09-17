import { EmptyInputError, Luhn } from '@evanion/luhn';
import { createToken, DEFAULT_DICTIONARY, type Token } from '@evanion/token';
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
 * Both are accepted, and the control is here to move the entropy the caption
 * reports. An alphabet the package refuses was offered here once and taken
 * out: a control that breaks the card teaches the reader that the demo is
 * broken, whatever the caption under it says. What the package will not draw
 * from belongs in the prose, where it can be read rather than triggered.
 */
export const tokenAlphabets: readonly TokenAlphabet[] = [
  { label: 'no lookalikes', dictionary: DEFAULT_DICTIONARY },
  { label: 'hex', dictionary: '0123456789abcdef' },
];

/**
 * `createToken` for the shape and the alphabet standing at those positions.
 *
 * Positions rather than values, because the card holds what its two controls
 * point at; an index past either list falls back to the first entry, which is
 * the configuration the README states.
 *
 * Nothing is caught. Every combination the card offers is one `createToken`
 * accepts, so a throw here is a fault in this file rather than a configuration
 * a reader reached, and it should surface as one. What the package refuses is
 * documented on `token/alphabet`, where it can be read rather than triggered.
 */
export function buildToken(shape: number, alphabet: number): Token {
  const { length, chunkSize } =
    tokenShapes[shape] ?? (tokenShapes[0] as TokenShape);
  const { dictionary } =
    tokenAlphabets[alphabet] ?? (tokenAlphabets[0] as TokenAlphabet);

  return createToken({ length, chunkSize, dictionary });
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
 * A name is not an address: it says which thing you mean and nothing about
 * where to get it, so something has to go and find it. These three each speak
 * to a different point in that trip -- where to look, which version to hand
 * back, which part of it to open -- and each sentence says who reads it and
 * when, because that is the only thing separating them.
 *
 * Each is explained against a web address, which every reader already has. The
 * RFC's own names are `name` and go in the heading, because a reader searching
 * for `r-component` has to land here; the sentence under it is what tells them
 * what it is.
 */
export const urnComponents: readonly UrnComponent[] = [
  {
    key: 'rComponent',
    label: 'resolver',
    delimiter: '?+',
    value: 'dir=eu',
    name: 'r-component',
    line: 'Where to go looking. This one is for the lookup service, not the thing being looked up -- which catalogue to ask, which mirror to use. It is spent on the way there, and the thing you get back never sees it.',
  },
  {
    key: 'qComponent',
    label: 'resource',
    delimiter: '?=',
    value: 'v=2',
    name: 'q-component',
    line: 'Which version to hand back. This one reaches the thing itself, once it has been found: the second edition rather than the first, the short view rather than the full one. It is the query string of a web address.',
  },
  {
    key: 'fComponent',
    label: 'fragment',
    delimiter: '#',
    value: 'avatar',
    name: 'f-component',
    line: 'Which part to open. Nothing on the network reads this one -- you already have the whole thing, and this says where to jump inside it. It is the `#section` at the end of a web address, and it behaves the same way.',
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
