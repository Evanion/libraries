import { URN } from '@evanion/urn';
import { GameURN } from './game.urn.js';

/**
 * Entity identity for an expansion, e.g. `urn:expansion:wingspan:europe`.
 *
 * The NSS is composite -- parent game slug, then expansion slug -- because an
 * expansion has no standalone identity. The storefront reads that composite
 * rather than writing it: an expansion row links to the game it belongs to, and
 * the parent slug comes out of the urn instead of out of a second field on the
 * API response.
 */
export class ExpansionURN extends URN {
  static override readonly nid = 'expansion';

  /**
   * The full urn of the game this expansion belongs to, or `undefined` when the
   * string is not an expansion urn of this namespace.
   *
   * Never throws: it is handed API data and a urn from a URL, and a cart link
   * is not worth a 500.
   */
  static parentGameUrn(expansionUrn: string): string | undefined {
    if (!this.belongsToNamespace(expansionUrn, this.nid)) return undefined;

    const [parentNss, ...rest] = this.parse(expansionUrn).nss.split(
      this.separator,
    );
    if (!parentNss || rest.length === 0) return undefined;

    return GameURN.stringify(parentNss);
  }
}
