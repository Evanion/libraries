import { createFeatures } from '@evanion/feature';

/** The instant the new checkout launches. */
export const LAUNCH = '2026-11-02T09:00:00Z';
const START = Date.parse('2026-11-02T06:00:00Z');

/** The instant `minutes` after 06:00 UTC on launch day. */
export function instantAt(minutes: number): Date {
  return new Date(START + minutes * 60_000);
}

/** The document: the new checkout turns on after the launch instant, for everyone. */
export function scheduleStore() {
  return createFeatures([
    {
      key: 'new-checkout',
      enabled: true,
      rules: [
        { id: 'launch', when: [{ field: 'now', op: 'after', value: LAUNCH }] },
      ],
    },
  ]);
}

/** The new checkout's decision at `minutes` after 06:00. */
export function checkoutAt(minutes: number) {
  return scheduleStore().resolve({ now: instantAt(minutes) })['new-checkout'];
}
