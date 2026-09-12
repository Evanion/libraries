import { Injectable, NotFoundException } from '@nestjs/common';
import { ExpansionURN } from '../domain/expansion.urn.js';
import { GameURN } from '../domain/game.urn.js';
import type { Stock } from './stock.model.js';

/**
 * In-memory stock levels, keyed by game and expansion urn. No persistence.
 *
 * Written out rather than derived from GAMES_CATALOGUE: stock is a shelf fact
 * and the catalogue is what the shop sells, so a derivation would make every
 * quantity a function of the listing and there would be nothing left for
 * `/inventory/:urn` to report. Every urn a cart can hold needs an entry here --
 * OrdersService rejects a line whose urn has none.
 */
const STOCK: ReadonlyMap<string, number> = new Map([
  [GameURN.stringify('wingspan'), 12],
  [ExpansionURN.forGame('wingspan', 'europe'), 8],
  [ExpansionURN.forGame('wingspan', 'oceania'), 4],
  [GameURN.stringify('brass-birmingham'), 0],
  [GameURN.stringify('gloomhaven'), 3],
  [ExpansionURN.forGame('gloomhaven', 'forgotten-circles'), 5],
  [GameURN.stringify('azul'), 25],
  [GameURN.stringify('viticulture'), 7],
  [ExpansionURN.forGame('viticulture', 'tuscany'), 2],
  [GameURN.stringify('dominion'), 18],
  [ExpansionURN.forGame('dominion', 'intrigue'), 11],
  [ExpansionURN.forGame('dominion', 'seaside'), 6],
  [GameURN.stringify('root'), 0],
  [ExpansionURN.forGame('root', 'riverfolk'), 3],
  [GameURN.stringify('ark-nova'), 0],
  [GameURN.stringify('flamme-rouge'), 9],
  [GameURN.stringify('crokinole'), 2],
  [GameURN.stringify('spirit-island'), 6],
  [ExpansionURN.forGame('spirit-island', 'jagged-earth'), 1],
  [GameURN.stringify('agricola'), 0],
]);

/** Read-only accessor over the static STOCK map. */
@Injectable()
export class InventoryService {
  /**
   * The stock record for one game urn.
   *
   * @throws {NotFoundException} when the urn has no record, which Nest renders
   * as a 404. InventoryClient translates that 404 back into a
   * `NotFoundException` on the calling side of the HTTP hop.
   */
  getStock(urn: string): Stock {
    const quantity = STOCK.get(urn);
    if (quantity === undefined) {
      throw new NotFoundException(`No stock record for ${urn}`);
    }
    return { urn, quantity };
  }
}
