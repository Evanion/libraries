import { Injectable, NotFoundException } from '@nestjs/common';
import { GameURN } from '../domain/game.urn.js';
import type { Stock } from './stock.model.js';

/** In-memory stock levels, keyed by game urn. No persistence. */
const STOCK: ReadonlyMap<string, number> = new Map([
  [GameURN.stringify('wingspan'), 12],
  [GameURN.stringify('brass-birmingham'), 0],
  [GameURN.stringify('gloomhaven'), 3],
  [GameURN.stringify('azul'), 25],
]);

/** Read-only accessor over the static STOCK map. */
@Injectable()
export class InventoryService {
  /** Throws rather than returning undefined when urn has no stock record --
   * the return type is Stock, not an optional. */
  getStock(urn: string): Stock {
    const quantity = STOCK.get(urn);
    if (quantity === undefined) {
      throw new NotFoundException(`No stock record for ${urn}`);
    }
    return { urn, quantity };
  }
}
