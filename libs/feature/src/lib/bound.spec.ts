import { afterEach, describe, expect, it, vi } from 'vitest';

import { FeatureConfigError } from './errors.js';
import { createFeatures } from './features.js';

const LAUNCH = '2026-11-01T00:00:00.000Z';

/** A sale that opens at `LAUNCH`, and a banner with no rule. */
function shop() {
  return createFeatures([
    {
      key: 'launch-sale',
      enabled: true,
      rules: [
        {
          id: 'after-launch',
          when: [{ field: 'now', op: 'after', value: LAUNCH }],
        },
      ],
    },
    { key: 'gift-wrap', enabled: true },
  ]);
}

describe('for', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers two questions across a window boundary at the one instant it settled', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T23:59:59.000Z'));
    const features = shop();
    const handle = features.for({ targetingKey: 'cust-0042' });
    const handleBefore = handle.isEnabled('launch-sale');
    const storeBefore = features.isEnabled('launch-sale', {
      targetingKey: 'cust-0042',
    });
    vi.setSystemTime(new Date('2026-11-01T00:00:01.000Z'));
    const handleAfter = handle.isEnabled('launch-sale');
    const storeAfter = features.isEnabled('launch-sale', {
      targetingKey: 'cust-0042',
    });

    expect([handleBefore, handleAfter]).toEqual([false, false]);
    expect([storeBefore, storeAfter]).toEqual([false, true]);
  });

  it('holds an explicit context.now as its instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T00:00:00.000Z'));
    const now = new Date('2026-10-15T12:00:00.000Z');
    const handle = shop().for({ now });

    expect(handle.context.now).toBe(now);
    expect(handle.isEnabled('launch-sale')).toBe(false);
  });

  it('states the settled instant on a snapshot', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T09:00:00.000Z'));
    const handle = shop().for({ targetingKey: 'cust-0042' });
    vi.setSystemTime(new Date('2026-11-01T09:00:05.000Z'));

    expect(handle.snapshot().now).toBe('2026-11-01T09:00:00.000Z');
  });

  it('exposes the settled context with the caller’s own fields', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T09:00:00.000Z'));
    const handle = shop().for({ targetingKey: 'cust-0042', tier: 'gold' });

    expect(handle.context).toEqual({
      targetingKey: 'cust-0042',
      tier: 'gold',
      now: new Date('2026-11-01T09:00:00.000Z'),
    });
  });

  it('resolves at an invalid Date and refuses to snapshot it', () => {
    const handle = shop().for({ now: new Date(Number.NaN) });

    expect(handle.resolve()['gift-wrap'].enabled).toBe(true);
    expect(() => handle.snapshot()).toThrow(FeatureConfigError);
    expect(() => handle.snapshot()).toThrow(/context\/now/);
  });

  it('answers a toggle made on the store after the handle was built', () => {
    const features = shop();
    const handle = features.for({ targetingKey: 'cust-0042' });
    const before = handle.isEnabled('gift-wrap');
    features.toggle('gift-wrap', false);

    expect(before).toBe(true);
    expect(handle.isEnabled('gift-wrap')).toBe(false);
  });

  it('answers from the document a reload installed after the handle was built', () => {
    const features = shop();
    const handle = features.for({ targetingKey: 'cust-0042' });
    const result = features.reload({
      features: [{ key: 'launch-sale', enabled: true }],
    });

    expect(result.ok).toBe(true);
    expect(Object.keys(handle.resolve())).toEqual(['launch-sale']);
  });
});
