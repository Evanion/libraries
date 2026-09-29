import { describe, expect, it } from 'vitest';
import { instantEpoch } from './instant.js';
import { everywhere } from './zones.spec.js';

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
    expect(everywhere(() => instantEpoch('2026-01-01T00:00:00'))).toEqual([
      Number.NaN,
      Number.NaN,
      Number.NaN,
    ]);
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
    expect(instantEpoch('2026-01-01T00:00:00+2400')).toBeNaN();
    expect(instantEpoch('2026-01-01T00:00:00+0160')).toBeNaN();
  });

  it('refuses a string that is not ISO 8601 at all', () => {
    expect(instantEpoch('January 1, 2026')).toBeNaN();
  });

  it('refuses an ISO-shaped string naming no calendar date', () => {
    expect(instantEpoch('2026-13-45T00:00:00Z')).toBeNaN();
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

  it('reads a time written without seconds', () => {
    expect(instantEpoch('2026-01-01T00:00Z')).toBe(1767225600000);
  });

  it('reads the hour 24 as the midnight closing the day', () => {
    expect(instantEpoch('2026-01-01T24:00:00Z')).toBe(1767312000000);
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
    expect(instantEpoch('+275760-09-13T00:00:00.001Z')).toBeNaN();
  });

  it('reads the smallest instant a Date holds', () => {
    expect(instantEpoch('-271821-04-20T00:00:00.000Z')).toBe(-8640000000000000);
  });

  it('refuses the millisecond before the smallest instant a Date holds', () => {
    expect(instantEpoch('-271821-04-19T23:59:59.999Z')).toBeNaN();
  });

  it('reads the year zero, which the expanded form writes', () => {
    expect(instantEpoch('+000000-01-01T00:00:00Z')).toBe(-62167219200000);
  });

  it('refuses the negative zero year, which names no year', () => {
    expect(instantEpoch('-000000-01-01T00:00:00Z')).toBeNaN();
  });

  it('refuses a leap second', () => {
    expect(instantEpoch('2026-01-01T23:59:60Z')).toBeNaN();
  });

  it('refuses an offset naming no zone', () => {
    expect(instantEpoch('2026-01-01T00:00:00+99:00')).toBeNaN();
  });

  it('refuses a month outside the calendar', () => {
    expect(instantEpoch('2026-13-01T00:00:00Z')).toBeNaN();
  });

  it('refuses a date with no time whose month is outside the calendar', () => {
    // A date-only string keeps no `Z` to hold V8 on its ISO parser. A shape
    // that admitted month 13 would reach the legacy heuristic parser, which
    // reads the string in the host's zone.
    expect(everywhere(() => instantEpoch('0001-13'))).toEqual([
      Number.NaN,
      Number.NaN,
      Number.NaN,
    ]);
    expect(everywhere(() => instantEpoch('0001-13-01'))).toEqual([
      Number.NaN,
      Number.NaN,
      Number.NaN,
    ]);
  });

  it('refuses a date with no time whose day is outside the range the format fixes', () => {
    expect(everywhere(() => instantEpoch('0001-01-00'))).toEqual([
      Number.NaN,
      Number.NaN,
      Number.NaN,
    ]);
    expect(everywhere(() => instantEpoch('0001-01-32'))).toEqual([
      Number.NaN,
      Number.NaN,
      Number.NaN,
    ]);
  });

  it('refuses the negative zero year written as a date with no time', () => {
    expect(everywhere(() => instantEpoch('-000000-01-01'))).toEqual([
      Number.NaN,
      Number.NaN,
      Number.NaN,
    ]);
  });

  it('refuses the hour 24 carrying anything but the midnight closing the day', () => {
    // The grammar admits `24:01` and `MakeTime` gives it a number, while V8
    // answers `NaN`, so the engines are free to disagree over it.
    expect(instantEpoch('2026-01-01T24:01:00Z')).toBeNaN();
    expect(instantEpoch('2026-01-01T24:00:01Z')).toBeNaN();
  });

  it('refuses a day past the end of the month it is written under', () => {
    // The 01-31 day range the format fixes says nothing about the month, and
    // ECMA-262's MakeDay carries the overflow, so 31 April would otherwise
    // reach `Date.parse` and come back as 1 May on every engine: an instant
    // the author did not write, under a rule id shared with '2026-05-01'.
    expect(instantEpoch('2026-04-31T00:00:00Z')).toBeNaN();
    expect(instantEpoch('2026-02-30T00:00:00Z')).toBeNaN();
    expect(instantEpoch('+002026-04-31T00:00:00Z')).toBeNaN();
    expect(everywhere(() => instantEpoch('2026-04-31'))).toEqual([
      Number.NaN,
      Number.NaN,
      Number.NaN,
    ]);
  });

  it('refuses 29 February in a year that has no 29 February', () => {
    expect(instantEpoch('2026-02-29T00:00:00Z')).toBeNaN();
    expect(instantEpoch('1900-02-29T00:00:00Z')).toBeNaN();
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
    expect(instantEpoch('2026-01-01t00:00:00z')).toBeNaN();
  });

  it('refuses a string padded with whitespace', () => {
    expect(instantEpoch(' 2026-01-01T00:00:00Z')).toBeNaN();
    expect(instantEpoch('2026-01-01T00:00:00Z ')).toBeNaN();
    expect(instantEpoch('2026-01-01T00:00:00Z\n')).toBeNaN();
  });

  it('refuses the empty string', () => {
    expect(instantEpoch('')).toBeNaN();
  });

  it('refuses a number written as a string', () => {
    // The digits of an epoch are not an ISO 8601 date, and reading them as one
    // would give `'1767225600000'` and `1767225600000` one rule id apiece for
    // two different instants.
    expect(instantEpoch('1767225600000')).toBeNaN();
  });

  it('passes a number no Date can hold through unchanged', () => {
    // A number outside a `Date`'s range is still a number, and the string
    // naming the same moment is refused. `createFeatures` reads strings only,
    // so a window written this way is built and then matches nothing.
    expect(instantEpoch(8640000000000001)).toBe(8640000000000001);
    expect(instantEpoch(Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    );
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
