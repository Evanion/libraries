/**
 * The storefront's copy of the shop-api's feature definitions, and the handle
 * each request resolves them through.
 *
 * The storefront renders on the server, so a flag read here is read in a
 * trusted runtime and governs what this app renders. It decides nothing the
 * shop-api does not decide again: the service holds the same document and
 * resolves a flag itself on every request it receives.
 *
 * `parseFeatureConfig` and never `createFeatures`: the document arrived over the
 * wire from another process. `parseFeatureConfig` reports a document it refuses
 * and throws nothing, so a bad revision leaves the previous store deciding
 * instead of failing the page.
 */
import {
  createFeatures,
  parseFeatureConfig,
  type Features,
} from '@evanion/feature';

import type { ShopApi } from './shop-api.js';

/** The installed store, with the version it was installed from. */
interface HeldFeatures {
  version: string | number | undefined;
  features: Features;
}

/**
 * How long a held store is served without asking the shop-api again.
 *
 * A ceiling on how long a rollout change takes to reach this app's pages. The
 * shop-api resolves the flag again on every request it receives, so a storefront
 * a minute behind offers a control the service then refuses and grants nothing.
 */
// #region features-cache
export const FEATURES_REVALIDATE_MS = 60_000;

/** What a request resolves on while no document has been installed: every flag off. */
const NO_FEATURES: Features = createFeatures([]);

let held: HeldFeatures | undefined;
let checkedAt = 0;
let inFlight: Promise<Features> | undefined;

/**
 * The store this process decides on.
 *
 * Module scope and not per request: construction validates, deep-clones and
 * deep-freezes the document, every decision after that is a local function call
 * over the frozen copy, and the definitions are the same for every visitor. A
 * `Features` holds definitions and no actor, so one store serves every request
 * and every user. Each read takes its context as an argument, and
 * `store.for(context)` binds one.
 *
 * Two things replace what is held: a version the shop-api reports that differs
 * from the held one, and the {@link FEATURES_REVALIDATE_MS} window expiring,
 * which is what makes this app ask at all. A matching version re-uses the
 * installed store, so re-validating the same bytes on a poll is skipped.
 *
 * A fetch that fails, or a document the library refuses, leaves the held store
 * in place and the window open, so the next request asks again. With nothing
 * held the answer is a store that turns every flag off, which draws the page
 * without the controls a flag adds.
 */
export async function featureStore(api: ShopApi): Promise<Features> {
  if (held && Date.now() - checkedAt < FEATURES_REVALIDATE_MS) {
    return held.features;
  }

  // One fetch for however many renders are in flight when the window expires.
  inFlight ??= refresh(api).finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}
// #endregion features-cache

// #region features-refresh
async function refresh(api: ShopApi): Promise<Features> {
  const document = await api.features();
  if (!document.ok) return held?.features ?? NO_FEATURES;

  const { version, config } = document.value;
  if (held && version !== undefined && held.version === version) {
    checkedAt = Date.now();
    return held.features;
  }

  const parsed = parseFeatureConfig(config);
  if (!parsed.ok) return held?.features ?? NO_FEATURES;

  held = { version, features: parsed.features };
  checkedAt = Date.now();
  return parsed.features;
}
// #endregion features-refresh

/** Drops the held store, so the next call fetches. For tests. */
export function resetFeatureCache(): void {
  held = undefined;
  checkedAt = 0;
  inFlight = undefined;
}
