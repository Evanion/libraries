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
});
