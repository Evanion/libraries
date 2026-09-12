import type { MiddlewareFunction } from 'react-router';
import { buildShelf } from './shelf.js';
import { readShelfPolicy } from './shelf-policy.server.js';
import { correlationContext, shelfContext } from './page-context.js';
import type { ShelfSnapshot } from './page-context.js';
import {
  ShopApiUnavailable,
  getStockFor,
  listGames,
  newCorrelationId,
} from './shop-api.server.js';

/**
 * What every page view needs before anything else runs: one correlation id, and a
 * way to read the shelf exactly once.
 *
 * Declared as the shell route's `middleware`, so it runs ahead of the action and
 * the loaders that follow it. It fetches nothing itself -- see `shelfContext` for
 * why the shelf read has to be deferred into the loader phase.
 */
export const loadPageView: MiddlewareFunction<Response> = async ({
  context,
}) => {
  const correlationId = newCorrelationId();
  context.set(correlationContext, correlationId);

  let pending: Promise<ShelfSnapshot> | undefined;
  context.set(shelfContext, () => (pending ??= readShelf(correlationId)));
};

/**
 * The catalogue joined to stock and to the shop's own availability declarations.
 *
 * A failure to reach shop-api comes back in the snapshot rather than thrown. A
 * thrown error would take the whole page to the error boundary, and a back office
 * whose API is down should still draw its chrome and say what is wrong -- the
 * operator's next action is to start the API, and a stack trace does not tell
 * them that.
 */
async function readShelf(correlationId: string): Promise<ShelfSnapshot> {
  try {
    const games = await listGames(correlationId);
    const stock = await getStockFor(
      games.map((game) => game.urn),
      correlationId,
    );
    return { rows: buildShelf(games, stock, readShelfPolicy()) };
  } catch (error) {
    if (!(error instanceof ShopApiUnavailable)) throw error;
    return { rows: [], unavailable: error.message };
  }
}
