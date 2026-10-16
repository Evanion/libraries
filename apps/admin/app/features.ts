import {
  createFeatures,
  parseFeatureConfig,
  serializeConfig,
} from '@evanion/feature';
import { createFeatureContext } from '@evanion/react-feature';
import type {
  BoundFeatures,
  EvaluationContext,
  FeatureConfig,
  Features,
} from '@evanion/feature';
import type { AdminSubject } from './access.js';

/**
 * What the back office resolves flags with, on both sides of the render.
 *
 * Deliberately not a `.server` module, for the reason `access.ts` gives. The
 * React Router server resolves the flags to decide again in an action, the
 * browser resolves the same document to toggle a control, and both name the
 * same keys, so the vocabulary lives in one module that either runtime may
 * import. The fetch that obtains the document is the server's alone and lives
 * in `features.server.ts`.
 *
 * A flag here decides which control the tree draws and which write the action
 * accepts. It does not decide who may write: that is `access.ts`.
 */

/**
 * The flags this app asks about, and the variants each one splits across.
 *
 * Both are plain on/off, so each maps to `never`. The type is this app's own,
 * for the reason the response types in `shop-api.server.ts` are: the document is
 * the contract and no package exists to share a shape. A key this map does not
 * name is a compile error at the call site.
 */
export interface AdminFlags {
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
  /** The definitions, which a holder installs with `parseFeatureConfig`. */
  config: FeatureConfig<keyof AdminFlags>;
}

/**
 * The flags of one request: the handle every reader decides through, and the
 * document the browser rebuilds its own store from.
 *
 * `BoundFeatures` is a set of closures over a frozen document. It never crosses
 * to the browser. What crosses is `config`, and the set `flags.snapshot()`
 * resolves.
 */
export interface PageFeatures {
  flags: BoundFeatures<AdminFlags>;
  config: FeatureConfig<keyof AdminFlags>;
}

/**
 * The store a holder with no document resolves on: every flag is off.
 *
 * It is the fallback for a request that could not reach shop-api, and the
 * store the bound provider is created from. The factory needs a value to take
 * its type parameter from, and the document this app resolves on arrives per
 * request, so the binding value is the one that turns everything off. A tree
 * mounted without a document shows no flagged control.
 */
export const NO_FEATURES: Features<AdminFlags> = createFeatures<AdminFlags>([
  { key: 'new-checkout', enabled: false },
  { key: 'express-pickup', enabled: false },
]);

/**
 * The evaluation context a subject resolves under.
 *
 * `targetingKey` is what the rollout buckets on, and `roles` is what the
 * `staff` rule reads. The browser builds the same context from the subject the
 * shell loader sent it, so the provider's check of the shipped set compares
 * like with like.
 */
export function featureContext(subject: AdminSubject): EvaluationContext {
  return { targetingKey: subject.id, roles: subject.roles };
}

/**
 * The document installed as a store, reused across requests while its version
 * holds.
 *
 * `parseFeatureConfig` validates the document and freezes a copy, which is work
 * a request does not change. A `Features` holds definitions and no actor, so
 * one store is safe across requests and across users: every read takes its
 * context as an argument. The version keys it, with the `!==` comparison
 * shop-api's document is written around. A document that states no version is
 * parsed every time.
 */
// #region adopt-features
let adopted:
  { version: string | number; features: Features<AdminFlags> } | undefined;

/**
 * Installs a document that arrived over the wire.
 *
 * `parseFeatureConfig` reports a refusal and throws nothing, so this raises it:
 * a document this app cannot install fails the render, and the render does not
 * quietly run with every flag off.
 */
export function adoptFeatures(
  config: FeatureConfig<keyof AdminFlags>,
): Features<AdminFlags> {
  const { version } = config;
  if (version !== undefined && adopted?.version === version) {
    return adopted.features;
  }
  const parsed = parseFeatureConfig<AdminFlags>(config);
  if (!parsed.ok) {
    throw new Error(
      `GET /features returned a document this app cannot install: ${parsed.issues
        .map((issue) => issue.code)
        .join(', ')}`,
    );
  }
  if (version !== undefined) adopted = { version, features: parsed.features };
  return parsed.features;
}
// #endregion adopt-features

/**
 * The flags of one request, bound to its subject.
 *
 * `for` reads the clock once, so every reader of the handle decides at one
 * instant and the set the shell ships states the instant the loaders decided
 * at.
 */
// #region page-features
export function pageFeatures(
  config: FeatureConfig<keyof AdminFlags>,
  subject: AdminSubject,
): PageFeatures {
  const flags = adoptFeatures(config).for(featureContext(subject));
  return { flags, config };
}
// #endregion page-features

/**
 * The page features a request that could not reach shop-api runs on: every flag
 * is off.
 */
export function noFeatures(subject: AdminSubject): PageFeatures {
  return pageFeatures(serializeConfig(NO_FEATURES), subject);
}

/**
 * The provider and hooks the component tree reads, bound to this app's flags.
 *
 * Every decision these hooks reach toggles an element. The loaders and the
 * actions resolve again on the server and are the only place a flag stops a
 * write.
 */
// #region bound-hooks
export const { FeatureProvider, useFeatureEnabled } =
  createFeatureContext(NO_FEATURES);
// #endregion bound-hooks
