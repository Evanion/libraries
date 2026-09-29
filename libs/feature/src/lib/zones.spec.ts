import { describe, expect, it } from 'vitest';
import { everywhere, inZone } from './zones.js';

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
