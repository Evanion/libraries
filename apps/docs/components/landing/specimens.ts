import { EmptyInputError, Luhn } from '@evanion/luhn';
import { createToken } from '@evanion/token';
import { URN } from '@evanion/urn';

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

/** The three parts of the specimen, from the package's own parser. */
export function urnParts(value: string): {
  urn: string;
  nid: string;
  nss: string;
} {
  const { urn, nid, nss } = UserURN.parse(value);
  return { urn, nid, nss };
}
