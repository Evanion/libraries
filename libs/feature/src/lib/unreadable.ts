import type { ConfigIssue, SerializedDefinition } from './config.js';
import type { FeatureKey } from './types.js';

/**
 * A raise out of the construction path, as the issue that reports it.
 *
 * Two walks inside `createFeatures` enter the values a definition carries and
 * the checker declares nothing about. `structuredClone` has no serialization
 * for a function or a symbol and raises a `DOMException` over either, it
 * recurses once per level so a value nested deeper than the stack holds raises
 * `RangeError`, and `deepFreeze` hands `Object.freeze` a typed array holding
 * elements, which raises a `TypeError`.
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
 * So the two entry points that promise a report ask it here. `reload` runs the
 * same clone over a candidate it accepted, and § 7 answers a candidate with a
 * result either way.
 *
 * The raise names the definition: the walk copies each one and reports the
 * first that answers the way the construction path did, which carries the key
 * and the pointer every other refusal at a definition carries. A raise no copy
 * reproduces is the freeze, or a member the checker read off the document, and
 * the issue then carries the raise's own text, which is the only part of it
 * that says anything about the value.
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
export function unreadable(
  raise: unknown,
  features: readonly unknown[],
): readonly ConfigIssue[] {
  const text = unreadableText(raise);
  for (const [at, definition] of features.entries()) {
    try {
      structuredClone(definition);
      continue;
    } catch {
      // The checker passed before the construction path ran, so every
      // definition it read is an object declaring a key.
      const { key } = definition as SerializedDefinition<FeatureKey>;
      return [
        {
          code: 'unknown-member',
          message: `feature "${String(key)}" carries a value no copy of the definition holds: ${text}`,
          key,
          path: `/features/${String(at)}`,
        },
      ];
    }
  }
  return [{ code: 'unknown-member', message: text }];
}

/**
 * The text a raise out of a copy carries.
 *
 * `createFeatures` throws where `reload` and `parseFeatureConfig` report, so
 * the message a caller reads off the error and the message a caller reads off
 * the issue come from here and say the same thing about the same value.
 *
 * A `DOMException` is an `Error` and carries the leaf in its own message. A
 * raise that is no `Error` is whatever a host threw, and `String` is all that
 * can be asked of it.
 */
export function unreadableText(raise: unknown): string {
  return raise instanceof Error ? raise.message : String(raise);
}
