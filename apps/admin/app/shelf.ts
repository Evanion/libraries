import type { Availability } from './ui/catalogue.js';
import type { Game, Stock } from './shop-api.server.js';

/**
 * Availability the shop has set by hand, keyed by game urn.
 *
 * shop-api models quantity and nothing else, so `preorder`, `reprint pending`
 * and `out of print` have nowhere to come from but the back office -- they are
 * decisions a merchant makes, not facts about the warehouse. Partial on purpose:
 * a title absent from it takes the derived state.
 */
export type ShelfPolicy = Readonly<Record<string, Availability>>;

/**
 * What the shop tells a customer about a title.
 *
 * Zero stock with no policy entry becomes `preorder` rather than something
 * terminal: a live title the shop still lists is one it intends to restock, and
 * `out of print` is a decision, not a consequence of an empty shelf.
 */
export function availabilityOf(
  urn: string,
  quantity: number,
  policy: ShelfPolicy,
): Availability {
  return policy[urn] ?? (quantity > 0 ? 'in stock' : 'preorder');
}

/** A catalogue entry joined to its stock level and its shelf state. */
export interface ShelfRow {
  urn: string;
  title: string;
  mechanisms: string[];
  players: string;
  playtime: string;
  complexity: number;
  quantity: number;
  availability: Availability;
  /** True when a merchant set the availability rather than stock implying it. */
  declared: boolean;
}

/**
 * Joins the catalogue to stock, in catalogue order.
 *
 * A game with no stock record is carried at zero rather than dropped. The two
 * endpoints are separate and can disagree; a title silently missing from the
 * shelf view is the one failure a merchant would not notice.
 */
export function buildShelf(
  games: Game[],
  stock: Stock[],
  policy: ShelfPolicy,
): ShelfRow[] {
  const quantities = new Map(stock.map((entry) => [entry.urn, entry.quantity]));

  return games.map((game) => {
    const quantity = quantities.get(game.urn) ?? 0;
    return {
      urn: game.urn,
      title: game.title,
      mechanisms: game.mechanisms,
      players: game.players,
      playtime: game.playtime,
      complexity: game.complexity,
      quantity,
      availability: availabilityOf(game.urn, quantity, policy),
      declared: policy[game.urn] !== undefined,
    };
  });
}

/** The figures the dashboard's leading stat line is built from. */
export interface ShelfTotals {
  titles: number;
  unitsOnHand: number;
  emptyShelves: number;
  meanComplexity: number;
}

/**
 * Totals across the shelf.
 *
 * `meanComplexity` counts each title once, whatever its stock: it describes what the shop chooses to
 * carry, which is the question a buyer is asking, not what happens to be on the
 * shelf this morning.
 */
export function shelfTotals(rows: ShelfRow[]): ShelfTotals {
  return {
    titles: rows.length,
    unitsOnHand: rows.reduce((total, row) => total + row.quantity, 0),
    emptyShelves: rows.filter((row) => row.quantity === 0).length,
    meanComplexity:
      rows.length === 0
        ? 0
        : rows.reduce((total, row) => total + row.complexity, 0) / rows.length,
  };
}

/** How many titles sit in each availability state. */
export function availabilityCounts(
  rows: ShelfRow[],
): { state: Availability; titles: number }[] {
  const states: Availability[] = [
    'in stock',
    'preorder',
    'reprint pending',
    'out of print',
  ];
  return states.map((state) => ({
    state,
    titles: rows.filter((row) => row.availability === state).length,
  }));
}
