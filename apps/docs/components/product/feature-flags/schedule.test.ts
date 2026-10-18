import { describe, expect, it } from 'vitest';
import { LAUNCH, checkoutAt, instantAt, scheduleStore } from './schedule';

describe('the schedule scene', () => {
  it('maps minutes after 06:00 to the instant', () => {
    expect(instantAt(0).toISOString()).toBe('2026-11-02T06:00:00.000Z');
    expect(instantAt(180).toISOString()).toBe(LAUNCH.replace('Z', '.000Z'));
  });
  it('is off before the launch instant and off at it and on from the next minute', () => {
    expect(checkoutAt(180).enabled).toBe(false);
    expect(checkoutAt(181).enabled).toBe(true);
    expect(checkoutAt(182).enabled).toBe(true);
  });
  it('gives the same answer from a second store at the same instant', () => {
    const now = instantAt(200);
    expect(scheduleStore().resolve({ now })['new-checkout'].enabled).toBe(
      scheduleStore().resolve({ now })['new-checkout'].enabled,
    );
  });
});
