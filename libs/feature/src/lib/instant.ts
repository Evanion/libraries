import type { Instant } from './types.js';

/**
 * An ISO 8601 string that names one instant on every host.
 *
 * ECMA-262 § 21.4.1.15 reads a date-time string carrying no offset as local
 * time and a date-only string as UTC, so a complete date-time needs `Z` or an
 * explicit offset and a bare date needs nothing. A string outside this format
 * falls to implementation-specific parsing, which is where two engines are free
 * to disagree.
 *
 * The fraction is one or more digits where the format fixes three. Engines
 * truncate a longer one and none of them reads a zone off it, and a producer
 * emitting microseconds -- Python's `datetime.isoformat` -- writes six.
 */
const FIXED =
  /^(?:[+-]\d{6}|\d{4})(?:-\d{2}(?:-\d{2})?)?(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

/**
 * Epoch milliseconds for an instant, and `NaN` for one that names none.
 *
 * This is the single reading of `Instant` in the package. `rule-id.ts` derives
 * a rule's name from it and `conditions.ts` resolves a window against it, and a
 * second copy in either place is a rule that carries one name and answers two
 * ways.
 *
 * A string is parsed only when {@link FIXED} matches it, so a host in Tokyo and
 * a host in Los Angeles return the same number or both return `NaN`.
 * `createFeatures` rejects the strings that return `NaN` here, which leaves the
 * value for a caller reaching `evaluateCondition` or `ruleId` directly.
 */
export function instantEpoch(value: Instant): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return FIXED.test(value) ? Date.parse(value) : Number.NaN;
}
