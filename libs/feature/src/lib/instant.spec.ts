import { describe, expect, it, vi } from 'vitest';
import { instantEpoch } from './instant.js';
import type { Instant } from './types.js';
import { everywhere } from './zones.js';

/** What `Date.parse` answers while {@link readings} holds it. */
const ANY_INSTANT = 1767225600000;

/** The three readings a string the module refuses gets. */
const REFUSED = [Number.NaN, Number.NaN, Number.NaN];

/**
 * What `instantEpoch` answers for a string in three zones, with the engine's
 * reading of it replaced by a number.
 *
 * `instantEpoch` ends in `Date.parse`, and V8 answers `NaN` for most of the
 * strings the shape refuses, so a bare `toBeNaN` holds whether the module
 * refused the string or the engine did. Such a case stays green once the
 * matching alternative is deleted from the shape, which is the branch it was
 * written to hold. Under a `Date.parse` answering a number for anything, `NaN`
 * is left to come from the shape or from the day check, and deleting either
 * one turns the case red.
 *
 * `new Date(string)` runs the engine's parser without reading the `Date.parse`
 * property, so the day check reads the length of a month here the way it does
 * in production. That reading is UTC for every string the shape admits, and
 * the host's zone for a string a widened shape lets through, which is why the
 * three zones are here: they hold the case to one verdict wherever it runs.
 *
 * A refusal the engine owns -- the two ends of the range a `Date` holds -- is
 * asserted through `instantEpoch` instead, and says so.
 */
function readings(value: string): number[] {
  const parse = vi.spyOn(Date, 'parse').mockReturnValue(ANY_INSTANT);

  try {
    return everywhere(() => instantEpoch(value));
  } finally {
    parse.mockRestore();
  }
}

describe('instantEpoch', () => {
  it('reads a date-time carrying Z', () => {
    expect(instantEpoch('2026-01-01T00:00:00.000Z')).toBe(1767225600000);
  });

  it('reads a date-time carrying an explicit offset', () => {
    expect(instantEpoch('2026-01-01T09:00:00+09:00')).toBe(1767225600000);
  });

  it('reads a date with no time as UTC midnight', () => {
    // ECMA-262 fixes the date-only forms to UTC, so such a string names one
    // instant without carrying an offset.
    expect(everywhere(() => instantEpoch('2026-01-01'))).toEqual([
      1767225600000, 1767225600000, 1767225600000,
    ]);
  });

  it('reads a fraction longer than the three digits the format fixes', () => {
    expect(instantEpoch('2026-01-01T00:00:00.123456Z')).toBe(1767225600123);
  });

  it('refuses a date-time carrying no offset', () => {
    // The premise the shape rests on, pinned once. ECMA-262 reads a complete
    // date-time carrying no offset as local time, so three hosts answer three
    // numbers for the one string, and a window built on it carries three rule
    // ids.
    expect(everywhere(() => Date.parse('2026-01-01T00:00:00'))).toEqual([
      1767225600000, 1767193200000, 1767254400000,
    ]);
    expect(readings('2026-01-01T00:00:00')).toEqual(REFUSED);
  });

  it('reads an offset written without its colon', () => {
    // ISO 8601's basic form. The colon goes back in before the string is
    // parsed, so the engine never decides what `+0100` meant.
    expect(everywhere(() => instantEpoch('2026-01-01T00:00:00+0100'))).toEqual([
      1767222000000, 1767222000000, 1767222000000,
    ]);
  });

  it('reads one offset written both ways as one instant', () => {
    expect(instantEpoch('2026-01-01T00:00:00+0100')).toBe(
      instantEpoch('2026-01-01T00:00:00+01:00'),
    );
  });

  it('reads an offset written without its colon on a time carrying no seconds', () => {
    expect(instantEpoch('2026-01-01T00:00-0130')).toBe(1767231000000);
  });

  it('refuses an offset written without its colon whose hour names no zone', () => {
    expect(readings('2026-01-01T00:00:00+2400')).toEqual(REFUSED);
    expect(readings('2026-01-01T00:00:00+0160')).toEqual(REFUSED);
  });

  it('refuses a string that is not ISO 8601 at all', () => {
    expect(readings('January 1, 2026')).toEqual(REFUSED);
  });

  it('refuses an ISO-shaped string naming no calendar date', () => {
    expect(readings('2026-13-45T00:00:00Z')).toEqual(REFUSED);
  });

  it('passes epoch milliseconds through', () => {
    expect(instantEpoch(1767225600000)).toBe(1767225600000);
  });

  it('reads a Date through its own instant', () => {
    expect(instantEpoch(new Date(1767225600000))).toBe(1767225600000);
  });

  it('answers NaN for an invalid Date', () => {
    expect(instantEpoch(new Date('nonsense'))).toBeNaN();
  });
  it('reads a year on its own as UTC', () => {
    expect(everywhere(() => instantEpoch('2026'))).toEqual([
      1767225600000, 1767225600000, 1767225600000,
    ]);
  });

  it('reads a year and month as UTC', () => {
    expect(everywhere(() => instantEpoch('2026-01'))).toEqual([
      1767225600000, 1767225600000, 1767225600000,
    ]);
  });

  it('reads a year and a year-month carrying a time', () => {
    // ECMA-262 21.4.1.15 lets any of the three date forms carry a time, so the
    // month and the day are each optional in front of the `T`. The offset is
    // not: `'2026T00:00:00'` is read as local time, the same as a full date
    // written without one.
    expect(instantEpoch('2026T00:00:00Z')).toBe(1767225600000);
    expect(instantEpoch('2026-01T00:00:00Z')).toBe(1767225600000);
    expect(readings('2026T00:00:00')).toEqual(REFUSED);
  });

  it('reads a time written without seconds', () => {
    expect(instantEpoch('2026-01-01T00:00Z')).toBe(1767225600000);
  });

  it('reads the hour 24 as the midnight closing the day', () => {
    expect(instantEpoch('2026-01-01T24:00:00Z')).toBe(1767312000000);
  });

  it('reads the hour 24 carrying a fraction of zero', () => {
    // A producer writes the fraction whether or not it has one to write, and
    // `Date.parse` reads a midnight written to any number of zeroes.
    expect(instantEpoch('2026-01-01T24:00:00.000Z')).toBe(1767312000000);
    expect(instantEpoch('2026-01-01T24:00:00.0Z')).toBe(1767312000000);
    expect(instantEpoch('2026-01-01T24:00:00.000000Z')).toBe(1767312000000);
  });

  it('reads both ends of the offset range', () => {
    expect(instantEpoch('2026-01-01T00:00:00+14:00')).toBe(1767175200000);
    expect(instantEpoch('2026-01-01T00:00:00-12:00')).toBe(1767268800000);
  });

  it('reads a zero offset written either way as UTC', () => {
    expect(instantEpoch('2026-01-01T00:00:00+00:00')).toBe(1767225600000);
    expect(instantEpoch('2026-01-01T00:00:00-00:00')).toBe(1767225600000);
  });

  it('reads the largest instant a Date holds', () => {
    expect(instantEpoch('+275760-09-13T00:00:00.000Z')).toBe(8640000000000000);
  });

  it('refuses the millisecond past the largest instant a Date holds', () => {
    // The engine's refusal and not the shape's. The string is the format
    // ECMA-262 fixes, and the range a `Date` holds is what it falls outside,
    // so `Date.parse` is what has to answer it.
    expect(instantEpoch('+275760-09-13T00:00:00.001Z')).toBeNaN();
  });

  it('reads the smallest instant a Date holds', () => {
    expect(instantEpoch('-271821-04-20T00:00:00.000Z')).toBe(-8640000000000000);
  });

  it('refuses the millisecond before the smallest instant a Date holds', () => {
    // The engine's refusal, the same way round as the largest instant above.
    expect(instantEpoch('-271821-04-19T23:59:59.999Z')).toBeNaN();
  });

  it('reads the year zero, which the expanded form writes', () => {
    expect(instantEpoch('+000000-01-01T00:00:00Z')).toBe(-62167219200000);
  });

  it('refuses the negative zero year, which names no year', () => {
    expect(readings('-000000-01-01T00:00:00Z')).toEqual(REFUSED);
  });

  it('refuses a leap second', () => {
    expect(readings('2026-01-01T23:59:60Z')).toEqual(REFUSED);
  });

  it('refuses an offset naming no zone', () => {
    expect(readings('2026-01-01T00:00:00+99:00')).toEqual(REFUSED);
  });

  it('refuses a month outside the calendar', () => {
    expect(readings('2026-13-01T00:00:00Z')).toEqual(REFUSED);
  });

  it('refuses a date with no time whose month is outside the calendar', () => {
    // A date-only string keeps no `Z` to hold V8 on its ISO parser. A shape
    // that admitted month 13 would reach the legacy heuristic parser, which
    // reads the string in the host's zone.
    expect(readings('0001-13')).toEqual(REFUSED);
    expect(readings('0001-13-01')).toEqual(REFUSED);
  });

  it('refuses a date with no time whose day is outside the range the format fixes', () => {
    expect(readings('0001-01-00')).toEqual(REFUSED);
    expect(readings('0001-01-32')).toEqual(REFUSED);
  });

  it('refuses a year written to any width but the four digits the format fixes', () => {
    // A year of another width leaves the format ECMA-262 fixes, so V8 drops to
    // its legacy heuristic parser and reads the string in the host's zone:
    // '002026-01-01' answers three numbers in three zones under one rule id.
    expect(readings('002026-01-01')).toEqual(REFUSED);
    expect(readings('12026-01-01')).toEqual(REFUSED);
    expect(readings('202-01-01')).toEqual(REFUSED);
    expect(readings('002026-01-01T00:00:00Z')).toEqual(REFUSED);
    expect(readings('12026-01-01T00:00:00Z')).toEqual(REFUSED);
  });

  it('refuses an expanded year written to any width but the six digits the format fixes', () => {
    // The sign is what puts a year in the expanded form, and the expanded form
    // fixes six digits behind it. '+2026-01-01' carries four.
    expect(readings('+2026-01-01')).toEqual(REFUSED);
    expect(readings('-2026-01-01')).toEqual(REFUSED);
    expect(readings('+20260-01-01T00:00:00Z')).toEqual(REFUSED);
    expect(readings('+0002026-01-01T00:00:00Z')).toEqual(REFUSED);
  });

  it('refuses a month or a day written without its leading zero', () => {
    // The format fixes two digits for each. An unpadded one reaches V8's
    // legacy heuristic parser, which reads the whole string in the host's zone.
    expect(readings('2026-1-1')).toEqual(REFUSED);
    expect(readings('2026-01-1')).toEqual(REFUSED);
    expect(readings('2026-1-01')).toEqual(REFUSED);
    expect(readings('2026-1-01T00:00:00Z')).toEqual(REFUSED);
  });

  it('refuses the negative zero year written as a date with no time', () => {
    expect(readings('-000000-01-01')).toEqual(REFUSED);
  });

  it('refuses the hour 24 carrying anything but the midnight closing the day', () => {
    // The grammar admits `24:01` and `MakeTime` gives it a number, so an
    // engine that reads the grammar rather than V8's parser names an instant
    // for it. The shape is what settles the reading.
    expect(readings('2026-01-01T24:01:00Z')).toEqual(REFUSED);
    expect(readings('2026-01-01T24:00:01Z')).toEqual(REFUSED);
    expect(readings('2026-01-01T24:00:00.500Z')).toEqual(REFUSED);
    expect(readings('2026-01-01T24:00:00.001Z')).toEqual(REFUSED);
  });

  it('refuses a day past the end of the month it is written under', () => {
    // The 01-31 day range the format fixes says nothing about the month, and
    // ECMA-262's MakeDay carries the overflow, so 31 April would otherwise
    // reach `Date.parse` and come back as 1 May on every engine: an instant
    // the author did not write, under a rule id shared with '2026-05-01'.
    expect(readings('2026-04-31T00:00:00Z')).toEqual(REFUSED);
    expect(readings('2026-02-30T00:00:00Z')).toEqual(REFUSED);
    expect(readings('+002026-04-31T00:00:00Z')).toEqual(REFUSED);
    expect(readings('2026-04-31')).toEqual(REFUSED);
  });

  it('refuses 29 February in a year that has no 29 February', () => {
    expect(readings('2026-02-29T00:00:00Z')).toEqual(REFUSED);
    expect(readings('1900-02-29T00:00:00Z')).toEqual(REFUSED);
  });

  it('reads 29 February in a leap year', () => {
    expect(instantEpoch('2024-02-29T00:00:00Z')).toBe(1709164800000);
    expect(instantEpoch('2000-02-29T00:00:00Z')).toBe(951782400000);
  });

  it('reads the last day a month has', () => {
    expect(instantEpoch('2026-04-30T00:00:00Z')).toBe(1777507200000);
    expect(instantEpoch('2026-12-31T00:00:00Z')).toBe(1798675200000);
  });

  it('refuses a date-time written in lower case', () => {
    // `2026-01-01t00:00:00z` names one instant to V8. The format ECMA-262
    // fixes writes both letters in capitals, so the reading is the engine's.
    expect(readings('2026-01-01t00:00:00z')).toEqual(REFUSED);
  });

  it('refuses a string padded with whitespace', () => {
    expect(readings(' 2026-01-01T00:00:00Z')).toEqual(REFUSED);
    expect(readings('2026-01-01T00:00:00Z ')).toEqual(REFUSED);
    expect(readings('2026-01-01T00:00:00Z\n')).toEqual(REFUSED);
  });

  it('refuses the empty string', () => {
    expect(readings('')).toEqual(REFUSED);
  });

  it('refuses a number written as a string', () => {
    // The digits of an epoch are not an ISO 8601 date, and reading them as one
    // would give `'1767225600000'` and `1767225600000` one rule id apiece for
    // two different instants.
    expect(readings('1767225600000')).toEqual(REFUSED);
  });

  it('passes a number no Date can hold through unchanged', () => {
    // This is the single reading of `Instant`, and it reports the number it was
    // given. `validateConditions` is where such a number is refused, on the
    // range it reads back from here, so a caller reaching `evaluateCondition`
    // directly still compares against it: `conditions.spec.ts` holds both sides
    // of that comparison.
    expect(instantEpoch(8640000000000001)).toBe(8640000000000001);
    expect(instantEpoch(Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('answers NaN for a value of no type an instant takes', () => {
    // A document parsed out of JSON is untyped, and `validateConditions`
    // polices the three declared types, so a value `Instant` does not admit is
    // built into a store and reaches this function on the evaluation path.
    const outside = [null, undefined, {}, true, ['2026-01-01'], Symbol('now')];

    for (const value of outside) {
      expect(instantEpoch(value as unknown as Instant)).toBeNaN();
    }
  });

  it('answers NaN for the number NaN', () => {
    expect(instantEpoch(Number.NaN)).toBeNaN();
  });

  it('reads a Date at each end of the range', () => {
    expect(instantEpoch(new Date(8640000000000000))).toBe(8640000000000000);
    expect(instantEpoch(new Date(-8640000000000000))).toBe(-8640000000000000);
  });

  it('reads the epoch itself, which is falsy as a number', () => {
    expect(instantEpoch(0)).toBe(0);
    expect(instantEpoch(new Date(0))).toBe(0);
    expect(instantEpoch('1970-01-01T00:00:00.000Z')).toBe(0);
  });
});
