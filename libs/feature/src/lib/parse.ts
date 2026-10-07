import { createFeatures } from './features.js';
import { collectIssues } from './validate.js';
import type { Features } from './features.js';
import type { ConfigIssue, FeatureConfig } from './config.js';
import type { FeatureOptions } from './observe.js';
import type { FeatureKey, VariantInfo } from './types.js';

/**
 * A raise out of a construction path the checker cannot ask about, as the issue
 * that reports it.
 *
 * The checker asks about the copy. `cloneIssues` in `validate.ts` runs
 * `structuredClone` over every definition, so a value nested deeper than the
 * stack holds and a value `structuredClone` has no serialization for are both
 * issues `collectIssues` reports, and the refusal below never sees them. § 7 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` and Decision 11 put
 * both entry points behind that one checker, and a refusal this function
 * manufactured would be one `validateConfig` never reported about the same
 * document.
 *
 * What is left is `deepFreeze` at `features.ts:225`, which the checker cannot
 * run: it is private to `features.ts` and `collectIssues` is what `features.ts`
 * imports. `Object.freeze` raises a `TypeError` over a typed array holding
 * elements, so a definition carrying one at a variant value refuses here and
 * passes the checker. No document a transport carried holds one, because JSON
 * has no text for a typed array, so the gap is a caller handing this entry
 * point a literal.
 *
 * `unknown-member` is the code. § 3 gives it to a holder that meets a member it
 * does not understand: it refuses the whole document, drops nothing and
 * evaluates nothing. The message carries the raise's own text, which is the
 * only part of this that says anything about the value.
 *
 * The catch narrows to no constructor, for the reason `nameable` at
 * `validate.ts:1086` narrows to none either. This entry point answers a
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
  // `digestIssues` hands the whole document to `configDigest` and catches what
  // the canonicaliser raises, and `cloneIssues` catches what the copy raises,
  // so each walk that enters a value reports its own raise. This catch answers
  // a raise out of a walk that declared none.
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
  // keeps one store shape in the package. It runs the checker above before it
  // copies anything, so every issue it reports is one the checker reported and
  // the catch answers the freeze alone.
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
