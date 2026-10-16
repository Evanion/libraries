import { noFeatures, pageFeatures } from './features.js';
import type { AdminSubject } from './access.js';
import type { PageFeatures } from './features.js';
import { ShopApiUnavailable, getFeatures } from './shop-api.server.js';

/**
 * The server half of the back office's feature flags: where the document comes
 * from, and who it is resolved for.
 *
 * `.server.ts`, so the fetch stays out of the browser bundle. The vocabulary
 * both runtimes share sits in `features.ts`.
 */

/**
 * Fetches shop-api's feature document and binds it to the request's subject.
 *
 * The fetch is the only network call the flags make here, and it obtains the
 * definitions rather than an answer. Every decision after it is a function call
 * over the frozen copy, on the server and in the browser alike.
 *
 * A shop-api that cannot be reached yields {@link noFeatures}, which turns every
 * flag off. The back office then draws the controls that need no flag and
 * hides the ones that do, which is what the shelf and the contract reads
 * already do when the API is down.
 */
// #region read-features
export async function readFeatures(
  correlationId: string,
  subject: AdminSubject,
): Promise<PageFeatures> {
  try {
    const document = await getFeatures(correlationId, subject);
    return pageFeatures(document.config, subject);
  } catch (error) {
    if (!(error instanceof ShopApiUnavailable)) throw error;
    return noFeatures(subject);
  }
}
// #endregion read-features
