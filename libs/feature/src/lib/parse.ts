import { createFeatures } from './features.js';
import { collectIssues } from './validate.js';
import type { Features } from './features.js';
import type { ConfigIssue, FeatureConfig } from './config.js';
import type { FeatureOptions } from './observe.js';
import type { FeatureKey, VariantInfo } from './types.js';

/**
 * A raise out of a construction path, as the issue that reports it.
 *
 * `structuredClone` at `features.ts:393` and `canonical` at `canonical.ts:128`
 * both recurse through a value a document carries. A value nested deeper than
 * the stack holds raises `RangeError: Maximum call stack size exceeded` out of
 * either, and a value `structuredClone` has no serialization for raises a
 * `DOMException`. Neither value sits at a member the checker reads, so no walk
 * names it and the raise leaves the call that entered it.
 *
 * `unknown-member` is the code. § 3 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` gives it to a holder
 * that meets a member it does not understand: it refuses the whole document,
 * drops nothing and evaluates nothing. The message carries the raise's own
 * text, which is the only part of this that says anything about the value.
 *
 * The catch narrows to no constructor, for the reason `nameable` at
 * `validate.ts:1065` narrows to none either. This entry point answers a
 * document a poller fetched, every raise answers it alike, and a catch keyed on
 * one class hands the next value class to a caller that was promised a report.
 */
function unreadable(raise: unknown): readonly ConfigIssue[] {
  return [
    {
      code: 'unknown-member',
      message: raise instanceof Error ? raise.message : String(raise),
    },
  ];
}

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
  // The checker reads the members it declares and enters no value below them,
  // and `digestIssues` hands the whole document to `configDigest`, so a value
  // a recursive walk cannot finish raises out of this call too.
  let refused: ReturnType<typeof collectIssues>;
  try {
    refused = collectIssues(config);
  } catch (raise) {
    return { ok: false, issues: unreadable(raise) };
  }

  if (refused.length > 0) {
    return { ok: false, issues: refused.map((each) => each.issue) };
  }

  // The same construction path the literal entry point takes, which is what
  // keeps one store shape in the package. It clones every definition at
  // `features.ts:393` before its own checker runs, so it enters the values the
  // checker above declared nothing about.
  let features: Features<S, boolean>;
  try {
    features = createFeatures<S>(
      config.features,
      (options ?? {}) as FeatureOptions<S>,
    );
  } catch (raise) {
    return { ok: false, issues: unreadable(raise) };
  }

  return { ok: true, features };
}
