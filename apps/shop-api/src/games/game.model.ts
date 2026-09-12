/** One entry of the games catalogue, as returned by every games/inventory endpoint. */
export interface Game {
  /** Entity identity, e.g. `urn:game:wingspan`. */
  urn: string;
  title: string;
  mechanisms: string[];
  players: string;
  playtime: string;
  /** Complexity, 1 (light) to 5 (heavy). */
  weight: number;
}
