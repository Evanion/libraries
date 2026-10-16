import { cache } from 'react';
import {
  parseFeatureConfig,
  type BoundFeatures,
  type FeatureConfig,
  type Features,
} from '@evanion/feature';

import { fetchJson } from './shop-api';
import { currentSubject } from './subject';

/**
 * The flags this app asks about, and the variants each one splits across.
 *
 * Both are plain on/off, so each maps to `never`. This is this app's own type
 * for the reason the response types in `shop-api.ts` are: the document is the
 * contract, and a key the document does not carry resolves off rather than
 * compiling. A key missing from this map is a compile error at the call site.
 */
export interface ShopFlags {
  'new-checkout': never;
  'express-pickup': never;
}

/**
 * The body `GET /api/features` answers with. shop-api's `FeaturesDocument`, as
 * this app's own type.
 */
export interface FeaturesDocument {
  /** What a holder compares against the version it already has, with `!==`. */
  version: string | number | undefined;
  /** The definitions, which this app installs with `parseFeatureConfig`. */
  config: FeatureConfig<keyof ShopFlags>;
}

/** The store over a document, and the document it was built from. */
export interface AdoptedFeatures {
  features: Features<ShopFlags>;
  /** Kept so the layout can hand the client the document it builds from. */
  config: FeatureConfig<keyof ShopFlags>;
}

/**
 * The last document this process adopted, and the store over it.
 *
 * `parseFeatureConfig` validates the document and freezes a copy, so a render
 * that parses is a render whose first read waits on that work. Holding the
 * store across requests takes it off every render after the first.
 *
 * Sharing one store between requests and between visitors is safe because a
 * `Features` holds definitions and no actor: every read takes the context as an
 * argument, so nothing about one page view is retained in here. The version is
 * the key, so a document shop-api republishes under a new version replaces this
 * one on the next page view.
 */
let adopted:
  { version: string | number | undefined; value: AdoptedFeatures } | undefined;

/**
 * The store over `document`, parsed only when the version moved.
 *
 * `parseFeatureConfig` reports and throws nothing, so the refusal is raised
 * here: a document this app cannot install fails the render, and the render
 * does not quietly run with every flag off.
 */
function adopt(document: FeaturesDocument): AdoptedFeatures {
  if (adopted && adopted.version === document.version) return adopted.value;
  const parsed = parseFeatureConfig<ShopFlags>(document.config);
  if (!parsed.ok) {
    throw new Error(
      `GET /features returned a document this app cannot install: ${parsed.issues
        .map((issue) => issue.code)
        .join(', ')}`,
    );
  }
  const value = { features: parsed.features, config: document.config };
  adopted = { version: document.version, value };
  return value;
}

/**
 * shop-api's feature document, fetched once for the page view and adopted
 * locally.
 *
 * `cache` is what makes it once. The layout and every widget that reads a flag
 * each ask for the store; one `GET /api/features` answers all of them. Two
 * concurrent page views each get their own fetch, which a module-level promise
 * would not give them.
 *
 * Every read after this point is local. An unreachable shop-api throws here and
 * the render fails, the way `currentAccess` fails: a page rendered with every
 * flag off would show the visitor the old checkout and count them as an
 * exposure of the control.
 */
export const store = cache(async (): Promise<AdoptedFeatures> =>
  adopt(await fetchJson<FeaturesDocument>('/features')),
);

/**
 * The store bound to this page view's subject and one clock instant.
 *
 * Bound once so every reader decides for the same visitor at the same instant,
 * and so the set the layout ships states the instant the widgets decided at.
 * The targeting key is the subject's id, which is what the rollout buckets on,
 * and the roles are what the `staff` rule reads.
 */
// #region per-request-features
export const currentFeatures = cache(
  async (): Promise<BoundFeatures<ShopFlags>> => {
    const [{ features }, shopper] = await Promise.all([
      store(),
      currentSubject(),
    ]);
    return features.for({ targetingKey: shopper.id, roles: shopper.roles });
  },
);
// #endregion per-request-features
