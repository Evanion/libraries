import { describe, expect, it } from 'vitest';

/**
 * Runs `read` with the process reporting `zone` as its timezone.
 *
 * Node reads `process.env.TZ` on every `Date` construction, so a case can ask
 * what a host in Los Angeles would answer without running a second process.
 *
 * That holds while the suite runs in a child process, which is Vitest's `forks`
 * pool. A worker thread gets its own copy of the environment and V8 keeps the
 * zone the thread started in, so under `pool: 'threads'` the assignment is a
 * no-op: every three-zone case across the package reads one zone three times
 * and passes, and the determinism the cases are about goes untested. So the
 * host is asked which zone it now reports and a reading other than `zone`
 * throws, which is also what a zone name the host does not know gets.
 */
export function inZone<T>(zone: string, read: () => T): T {
  const original = process.env.TZ;
  process.env.TZ = zone;
  try {
    const reported = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (reported !== zone) {
      throw new Error(
        `the host reports ${String(reported)} after being asked for ${zone}, so nothing read under it reads the zone it names`,
      );
    }
    return read();
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
}

/** The answer in three zones spread far enough apart to cross a day boundary. */
export const everywhere = <T>(read: () => T): T[] =>
  ['UTC', 'Asia/Tokyo', 'America/Los_Angeles'].map((zone) =>
    inZone(zone, read),
  );

describe('inZone', () => {
  it('reads one offsetless date-time as three instants in the three zones', () => {
    // The control every other three-zone case in the package rests on. A
    // harness that changed no zone would answer one number three times here,
    // and each of those cases would run three times in one zone and pass.
    const readings = everywhere(() =>
      new Date('2026-01-01T00:00:00').getTime(),
    );

    expect(new Set(readings).size).toBe(3);
  });

  it('refuses a zone the host does not report back', () => {
    expect(() => inZone('Mars/Phobos', () => 0)).toThrow(/Mars\/Phobos/);
  });

  it('restores the zone the process was started in', () => {
    const started = process.env.TZ;
    inZone('Asia/Tokyo', () => 0);

    expect(process.env.TZ).toBe(started);
    expect(() => inZone('Mars/Phobos', () => 0)).toThrow();
    expect(process.env.TZ).toBe(started);
  });
});
