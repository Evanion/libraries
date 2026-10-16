import type { FeatureConfig } from '@evanion/feature';

import type { FeaturesDocument } from '../shop-api.js';

/**
 * A stand-in for the document `GET /api/features` serves.
 *
 * Authored here for the reason `shop-policy.ts` gives: the storefront is an HTTP
 * client of the shop-api and imports none of its modules. What the two share is
 * the wire shape, and this is that shape -- the two definitions the service
 * publishes, with `express-pickup` depending on `new-checkout`.
 */
export const SHOP_FEATURES_VERSION = 'shop-api@1';

/** The published definitions, at whichever revision a test needs. */
export function shopFeatureConfig(
  version: string = SHOP_FEATURES_VERSION,
  percent = 25,
): FeatureConfig {
  return {
    version,
    features: [
      {
        key: 'new-checkout',
        enabled: true,
        rules: [{ id: 'ramp', rollout: { percent, by: 'targetingKey' } }],
      },
      { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
    ],
  };
}

/** The body of a `GET /features` response. */
export function featuresDocument(
  version: string = SHOP_FEATURES_VERSION,
  percent = 25,
): FeaturesDocument {
  return { version, config: shopFeatureConfig(version, percent) };
}

/** A `GET /features` response, as `fetch` would resolve it. */
export function featuresResponse(version?: string, percent?: number): Response {
  return new Response(JSON.stringify(featuresDocument(version, percent)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
