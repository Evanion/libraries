import { createFeatures } from './features.js';
import { collectIssues } from './validate.js';
import type { Features } from './features.js';
import type { ConfigIssue, FeatureConfig } from './config.js';
import type { FeatureOptions } from './observe.js';
import type { FeatureKey, VariantInfo } from './types.js';

/** The key an issue names, for a definition whose key a document chose. */
function keyOf(definition: unknown): FeatureKey | undefined {
  if (typeof definition !== 'object' || definition === null) return undefined;
  const key: unknown = (definition as Record<string, unknown>)['key'];
  return typeof key === 'string' || typeof key === 'number' ? key : undefined;
}

/**
 * A raise out of the construction path, as the issue that reports it.
 *
 * Two walks inside `createFeatures` enter the values a definition carries and
 * the checker declares nothing about. `structuredClone` at `features.ts:393`
 * has no serialization for a function or a symbol and raises a `DOMException`
 * over either, it recurses once per level so a value nested deeper than the
 * stack holds raises `RangeError`, and `deepFreeze` at `features.ts:225` hands
 * `Object.freeze` a typed array holding elements, which raises a `TypeError`.
 *
 * The checker is asked nothing about them. Decision 11 gives it the document
 * the publisher served and the literal an author wrote, and a question about
 * the copy would answer for the construction path alone: § 3's refusals name a
 * member a holder cannot read, and `validateConfig` reports each one at the
 * position the document carries it. A copy question in the checker also puts a
 * definition-level refusal ahead of the precise one, and `createFeatures`
 * throws the first issue, so the author of a literal whose condition value no
 * text names would read a message naming no condition.
 *
 * So this entry point asks it, where the promise that nothing is thrown lives.
 * The raise names the definition: the walk copies each one and reports the
 * first that answers the way the construction path did, which carries the key
 * and the pointer every other refusal at a definition carries. A raise no copy
 * reproduces is the freeze, and the issue then carries the raise's own text,
 * which is the only part of it that says anything about the value.
 *
 * `unknown-member` is the code. § 3 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` gives it to a holder
 * that meets a member it does not understand: it refuses the whole document,
 * drops nothing and evaluates nothing.
 *
 * The catch narrows to no constructor, for the reason `nameable` in
 * `validate.ts` narrows to none either. A control plane chooses what reaches a
 * variant value, every raise answers this question alike, and a catch keyed on
 * one class hands the next value class to a caller that was promised a report.
 */
function unreadable(
  raise: unknown,
  features: readonly unknown[],
): readonly ConfigIssue[] {
  const text = raise instanceof Error ? raise.message : String(raise);
  for (const [at, definition] of features.entries()) {
    try {
      structuredClone(definition);
      continue;
    } catch {
      const key = keyOf(definition);
      const named =
        key === undefined
          ? `the definition at /features/${String(at)}`
          : `feature "${String(key)}"`;
      return [
        {
          code: 'unknown-member',
          message: `${named} carries a value no copy of the definition holds: ${text}`,
          ...(key === undefined ? {} : { key }),
          path: `/features/${String(at)}`,
        },
      ];
    }
  }
  return [{ code: 'unknown-member', message: text }];
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
    features = createFeatures<S>(
      config.features,
      (options ?? {}) as FeatureOptions<S>,
    );
  } catch (raise) {
    return {
      ok: false,
      issues: unreadable(
        raise,
        Array.isArray(config.features) ? config.features : [],
      ),
    };
  }

  return { ok: true, features };
}
