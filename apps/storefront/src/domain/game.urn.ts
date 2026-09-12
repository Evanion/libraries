import { URN } from '@evanion/urn';

/**
 * Entity identity for a catalogue game, e.g. `urn:game:wingspan`.
 *
 * Declared here and not imported from `apps/shop-api`: the two apps share an
 * HTTP contract, not a module graph. What they do share is `@evanion/urn`, so
 * both sides mint and read the same strings from the same grammar.
 *
 * The storefront's use is the read path -- `/g/[urn]` takes a urn straight off
 * the URL, and `GameURN.belongsToNamespace` is what distinguishes a game urn
 * from an expansion's before the API is called at all.
 */
export class GameURN extends URN {
  static override readonly nid = 'game';
}
