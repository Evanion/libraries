import type { MiddlewareFunction } from 'react-router';
import { buildShelf } from './shelf.js';
import { readShelfPolicy } from './shelf-policy.server.js';
import { demoSubject, readAccess } from './access.server.js';
import type { AdminSubject } from './access.js';
import {
  accessContext,
  correlationContext,
  shelfContext,
  subjectContext,
} from './page-context.js';
import type { ShelfSnapshot } from './page-context.js';
import {
  ShopApiUnavailable,
  getStockFor,
  listGames,
  newCorrelationId,
} from './shop-api.server.js';

/**
 * What every page view needs before anything else runs: one correlation id, the
 * subject the request runs as, a way to read shop-api's contract once, and a way
 * to read the shelf exactly once.
 *
 * Declared as the shell route's `middleware`, so it runs ahead of the action and
 * the loaders that follow it. It fetches nothing itself -- see `shelfContext`
 * for why the shelf read has to be deferred into the loader phase, and
 * `accessContext` for why the contract read is deferred the same way.
 *
 * It binds the subject and it decides nothing. A decision belongs to the loader
 * or the action that acts on it, because each of those knows the object it is
 * deciding over and what a refusal there has to do.
 */
// #region bind-subject
export const loadPageView: MiddlewareFunction<Response> = async ({
  context,
}) => {
  const correlationId = newCorrelationId();
  context.set(correlationContext, correlationId);

  const subject = demoSubject();
  context.set(subjectContext, subject);

  let contract: Promise<Awaited<ReturnType<typeof readAccess>>> | undefined;
  context.set(
    accessContext,
    () => (contract ??= readAccess(correlationId, subject)),
  );

  let pending: Promise<ShelfSnapshot> | undefined;
  context.set(
    shelfContext,
    () => (pending ??= readShelf(correlationId, subject)),
  );
};
// #endregion bind-subject

/**
 * The catalogue joined to stock and to the shop's own availability declarations.
 *
 * A failure to reach shop-api comes back in the snapshot rather than thrown. A
 * thrown error would take the whole page to the error boundary, and a back office
 * whose API is down should still draw its chrome and say what is wrong -- the
 * operator's next action is to start the API, and a stack trace does not tell
 * them that.
 */
async function readShelf(
  correlationId: string,
  subject: AdminSubject,
): Promise<ShelfSnapshot> {
  try {
    const games = await listGames(correlationId, subject);
    const stock = await getStockFor(
      games.map((game) => game.urn),
      correlationId,
      subject,
    );
    return { rows: buildShelf(games, stock, readShelfPolicy()) };
  } catch (error) {
    if (!(error instanceof ShopApiUnavailable)) throw error;
    return { rows: [], unavailable: error.message };
  }
}
