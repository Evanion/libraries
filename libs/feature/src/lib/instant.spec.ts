import { describe, expect, it } from 'vitest';
import { instantEpoch } from './instant.js';

/**
 * Runs `read` with the process reporting `zone` as its timezone.
 *
 * Node reads `process.env.TZ` on every `Date` construction, so a case can ask
 * what a host in Los Angeles would answer without running a second process.
 */
function inZone<T>(zone: string, read: () => T): T {
  const original = process.env.TZ;
  process.env.TZ = zone;
  try {
    return read();
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
}

/** The answer in three zones spread far enough apart to cross a day boundary. */
const everywhere = <T>(read: () => T): T[] =>
  ['UTC', 'Asia/Tokyo', 'America/Los_Angeles'].map((zone) =>
    inZone(zone, read),
  );

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

  it('refuses an offset written without its colon', () => {
    // `+0100` sits outside the format ECMA-262 fixes, so what it means is the
    // engine's to decide.
    expect(instantEpoch('2026-01-01T00:00:00+0100')).toBeNaN();
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

  it('carries a day past the end of its month into the next one', () => {
    // 30 February sits inside the 01-31 day range the format fixes, and
    // ECMA-262's MakeDay carries the overflow, so this is 2 March on every
    // engine rather than a string the check can refuse.
    expect(everywhere(() => instantEpoch('2026-02-30T00:00:00Z'))).toEqual([
      1772409600000, 1772409600000, 1772409600000,
    ]);
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
