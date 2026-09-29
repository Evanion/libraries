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
 * Every field carries its range and not only its digit count. A string that
 * matches the shape and names no calendar date still reaches `Date.parse`,
 * where V8's ISO parser refuses it and V8's legacy heuristic parser reads it in
 * the host's zone, so `'0001-13-01'` answers three numbers in three zones and
 * `ruleId` derives three names for the one rule. The day range is 01-31, which
 * is the range the format fixes, and {@link namesCalendarDay} holds the day to
 * the length of the month it is written under.
 *
 * The hour 24 is held to the midnight closing the day. The grammar admits
 * `24:01`, `MakeTime` gives it a number, and V8 answers `NaN` for it.
 *
 * The negative zero year names no year, and the grammar excludes it.
 *
 * The fraction is one or more digits where the format fixes three. Engines
 * truncate a longer one and none of them reads a zone off it, and a producer
 * emitting microseconds -- Python's `datetime.isoformat` -- writes six.
 */
const FIXED =
  /^(?:\d{4}|\+\d{6}|-(?!000000)\d{6})(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?(?:T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?|24:00(?::00(?:\.0+)?)?)(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/;

/**
 * The trailing offset of a date-time written in ISO 8601 basic form, split into
 * its hour and its minute.
 *
 * ISO 8601 writes `+0100` for the offset ECMA-262's format writes `+01:00`, and
 * a producer that emits the basic form is common: `strftime('%z')` in Python,
 * `time.RFC822Z` in Go and `SimpleDateFormat("Z")` in Java all write it. The
 * colon goes back in before {@link FIXED} reads the string, so `Date.parse`
 * meets the form ECMA-262 fixes and no engine's heuristic parser decides what
 * the offset meant.
 */
const BASIC_OFFSET = /^(.*T.*)([+-](?:[01]\d|2[0-3]))([0-5]\d)$/;

/** The date of an instant, extended years included, up to its day field. */
const CALENDAR_DAY = /^[+-]?\d{4,6}-\d\d-\d\d/;

/**
 * Whether the day of a date is a day the month it is written under has.
 *
 * `MakeDay` carries an overflowing day into the next month on every engine, so
 * `'2026-04-31'` names one instant on every host and the shape has nothing to
 * refuse it for. The author still gets 1 May out of a string naming April, with
 * no error anywhere, and `'2026-04-31'` and `'2026-05-01'` derive one `ruleId`,
 * because a window's name comes from the epoch.
 *
 * The length of the month is read back off `Date` rather than written here as a
 * second leap-year rule. A date with no time is fixed to UTC, so the reading is
 * the same on every host, and an engine whose parser refuses the date outright
 * answers `NaN`, whose day field matches no day either.
 *
 * A string carrying no day field -- `'2026'`, `'2026-01'` -- has no day to
 * hold.
 */
function namesCalendarDay(value: string): boolean {
  const date = CALENDAR_DAY.exec(value)?.[0];
  if (date === undefined) return true;

  return new Date(date).getUTCDate() === Number(date.slice(-2));
}

/**
 * Epoch milliseconds for an instant, and `NaN` for one that names none.
 *
 * This is the single reading of `Instant` in the package. `rule-id.ts` derives
 * a rule's name from it and `conditions.ts` resolves a window against it, and a
 * second copy in either place is a rule that carries one name and answers two
 * ways.
 *
 * A string is parsed only once {@link FIXED} matches it and its day names a day
 * of its month, so a host in Tokyo and a host in Los Angeles return the same
 * number or both return `NaN`. `createFeatures` rejects every value that
 * answers `NaN` here and every number outside the range a `Date` holds, which
 * leaves those values for a caller reaching `evaluateCondition` or `ruleId`
 * directly.
 *
 * A `Date` is returned as its own instant. It carries no record of the string
 * it was built from, so `new Date('2026-01-01T00:00:00')` has already taken the
 * constructing host's zone before this function sees it.
 *
 * A value of no other type names no instant. `Instant` says there is no such
 * value, and a document parsed out of JSON carries whatever it carries:
 * `validateConditions` polices the three declared types, so a `null`, an
 * object, a boolean or an array is built into a store and arrives here. Answering `NaN`
 * for it is what `evaluateCondition` turns into `false`, which is the answer
 * every unevaluable condition gets.
 */
export function instantEpoch(value: Instant): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;

  const fixed = value.replace(BASIC_OFFSET, '$1$2:$3');
  if (!FIXED.test(fixed) || !namesCalendarDay(fixed)) return Number.NaN;

  return Date.parse(fixed);
}
