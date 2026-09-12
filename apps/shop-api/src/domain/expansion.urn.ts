import { URN, ValidationError } from '@evanion/urn';
import { GameURN } from './game.urn.js';

/**
 * Entity identity for an expansion, e.g. `urn:expansion:wingspan:europe`.
 *
 * The NSS is composite -- parent game slug, then expansion slug -- because an
 * expansion has no standalone identity: "Europe" names nothing without the game
 * it expands. RFC 8141's NSS grammar admits `:`, and `parse` splits on the
 * separator then rejoins the tail, so the composite survives a round trip and
 * `nss` comes back as the whole `wingspan:europe`.
 */
export class ExpansionURN extends URN {
  static override readonly nid = 'expansion';

  /**
   * Mints the urn for `slug` as an expansion of the game `parentNss` names.
   *
   * @param parentNss The parent game's bare NSS, `wingspan`, not its full urn.
   */
  static forGame(parentNss: string, slug: string): string {
    return this.stringify(`${parentNss}${this.separator}${slug}`);
  }

  /**
   * The full urn of the game this expansion belongs to.
   *
   * @throws {ValidationError} when the string is not a well-formed urn, or when
   * its NSS is not composite and so names no parent game --
   * `urn:expansion:europe` identifies nothing this can resolve.
   */
  static parentGameUrn(expansionUrn: string): string {
    const [parentNss, ...rest] = this.parse(expansionUrn).nss.split(
      this.separator,
    );

    if (!parentNss || rest.length === 0) {
      throw new ValidationError(
        `${expansionUrn} has no parent game: its nss is not composite`,
      );
    }

    return GameURN.stringify(parentNss);
  }
}
