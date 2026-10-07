import { createFeatures } from './features.js';
import { collectIssues } from './validate.js';
import { unreadable } from './unreadable.js';
import type { Features } from './features.js';
import type { ConfigIssue, FeatureConfig } from './config.js';
import type { FeatureOptions } from './observe.js';
import type { FeatureKey, VariantInfo } from './types.js';

/**
 * Builds a store from a document. It reports, and it throws nothing.
 *
 * `createFeatures` keeps throwing, and the two entry points differ in who
 * supplied the configuration. A literal that fails validation is a programming
 * error the author reads in a stack trace at the line that wrote it. A row that
 * fails validation arrives on a poller inside a process that is serving
 * traffic, and a malformed row there reports and lets the previous document
 * keep deciding.
 *
 * `@evanion/acl` draws the line elsewhere and the divergence is deliberate.
 * `parseMatrix` at `libs/acl/src/parse-matrix.ts:43-49` throws, because an ACL
 * consumer fetches a contract at boot and a malformed contract is a deploy
 * failure the consumer wants loudly. This takes the name and refuses the throw.
 *
 * A document that arrived as JSON carries no literal, so the compiler infers no
 * variant names from it. A caller who wants the names names the schema:
 * `parseFeatureConfig<MyFlags>(document)`.
 */
export function parseFeatureConfig<
  S extends Record<keyof S, VariantInfo | never> = Record<
    FeatureKey,
    VariantInfo | never
  >,
>(
  config: FeatureConfig<Extract<keyof S, FeatureKey>>,
  options?: FeatureOptions<S>,
):
  | { ok: true; features: Features<S, boolean> }
  | { ok: false; issues: readonly ConfigIssue[] } {
  // Nothing about the document is trusted, and the checker reads its members
  // off the object the caller handed over, so a member that answers a read with
  // a raise reports here. `validateConfig` throws such a document back at its
  // caller, and this entry point promises a report.
  let refused: ReturnType<typeof collectIssues>;
  try {
    refused = collectIssues(config);
  } catch (raise) {
    return { ok: false, issues: unreadable(raise, []) };
  }

  if (refused.length > 0) {
    return { ok: false, issues: refused.map((each) => each.issue) };
  }

  // The same construction path the literal entry point takes, which is what
  // keeps one store shape in the package. The checker just passed, so every
  // typed error it answers for is answered, and the catch reports the copy and
  // the freeze.
  let features: Features<S, boolean>;
  try {
    features = createFeatures<S>(config, (options ?? {}) as FeatureOptions<S>);
  } catch (raise) {
    return {
      ok: false,
      issues: unreadable(raise, config.features),
    };
  }

  return { ok: true, features };
}
