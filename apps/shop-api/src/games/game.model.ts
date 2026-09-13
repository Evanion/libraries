/**
 * Whether a title can be bought, and why not when it cannot.
 *
 * Distinct from the stock quantity `/inventory/:urn` reports: a title can be
 * `in-stock` as a catalogue state and still be at zero copies, which is a
 * transient shelf fact rather than a change in what the shop sells.
 */
export type Availability =
  'in-stock' | 'preorder' | 'reprint-pending' | 'out-of-print';

/** An expansion of one game, identified by a composite-NSS ExpansionURN. */
export interface Expansion {
  /** Entity identity, e.g. `urn:expansion:wingspan:europe`. */
  urn: string;
  title: string;
  /** Price in minor units of the catalogue currency, SEK öre. */
  price: number;
}

/** One entry of the games catalogue, as returned by every games/inventory endpoint. */
export interface Game {
  /** Entity identity, e.g. `urn:game:wingspan`. */
  urn: string;
  title: string;
  /**
   * Mechanisms, most characteristic first.
   *
   * The order carries meaning downstream: the storefront colours a title by its
   * first mechanism, because that is the one players name a game by.
   */
  mechanisms: string[];
  players: string;
  playtime: string;
  /** Complexity, 1 (light) to 5 (heavy). */
  complexity: number;
  /** Price in minor units of the catalogue currency, SEK öre. */
  price: number;
  availability: Availability;
  expansions: Expansion[];
}
