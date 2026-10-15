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

/** A sale gated on a launch instant and a tier, and a CTA with valued variants. */
const STOREFRONT = [
  {
    key: 'launch-sale',
    enabled: true,
    rules: [
      {
        id: 'gold-after-launch',
        when: [
          { field: 'now', op: 'after', value: LAUNCH },
          { field: 'tier', op: 'eq', value: 'gold' },
        ],
      },
    ],
  },
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50, value: { label: 'Buy' } },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
] as const;

function storefront() {
  return createFeatures(STOREFRONT);
}

function observedStorefront(
  observe: (event: { type: string; at: { toISOString(): string } }) => void,
) {
  return createFeatures(STOREFRONT, { observe });
}

describe('for, inputs the first cases leave out', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the clock once when called with no context', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T23:59:59.000Z'));
    const handle = shop().for();
    vi.setSystemTime(new Date('2026-11-01T00:00:01.000Z'));

    expect(handle.context).toEqual({
      now: new Date('2026-10-31T23:59:59.000Z'),
    });
    expect(handle.isEnabled('launch-sale')).toBe(false);
  });

  it('reads the clock when the context names now as undefined', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T09:00:00.000Z'));
    const handle = shop().for({ now: undefined, targetingKey: 'cust-0042' });

    expect(handle.context.now).toEqual(new Date('2026-11-01T09:00:00.000Z'));
    expect(handle.isEnabled('launch-sale')).toBe(true);
  });

  it('holds its own copy of the context, so a later write to the caller’s object moves nothing', () => {
    const now = new Date('2026-11-01T09:00:00.000Z');
    const context: Record<string, unknown> = { now, tier: 'gold' };
    const handle = storefront().for(context);
    context['tier'] = 'bronze';
    context['now'] = new Date('2026-10-01T00:00:00.000Z');

    expect(handle.context).toEqual({ now, tier: 'gold' });
    expect(handle.isEnabled('launch-sale')).toBe(true);
  });

  it('answers every method with what the store answers at the settled context', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T09:00:00.000Z'));
    const features = storefront();
    // cust-0001 buckets to 'blue'. A context with no targetingKey falls back
    // to 'control', so a method that dropped the bound context answers
    // differently.
    const handle = features.for({ targetingKey: 'cust-0001', tier: 'gold' });
    // The store's own default instant moves past the handle's, so a method
    // that dropped the settled context would answer at the later clock.
    vi.setSystemTime(new Date('2027-01-01T00:00:00.000Z'));
    const at = handle.context;

    expect(handle.resolve()['checkout-cta'].assignment?.source).toBe(
      'weighted',
    );
    expect(handle.variantOf('checkout-cta')).toBe('blue');
    expect(handle.valueOf('checkout-cta')).toEqual({ label: 'Get it' });

    expect(handle.resolve()).toEqual(features.resolve(at));
    expect(handle.isEnabled('launch-sale')).toBe(
      features.isEnabled('launch-sale', at),
    );
    expect(handle.variantOf('checkout-cta')).toBe(
      features.variantOf('checkout-cta', at),
    );
    expect(handle.valueOf('checkout-cta')).toEqual(
      features.valueOf('checkout-cta', at),
    );
    expect(handle.plan()).toEqual(features.plan(at));
    expect(handle.snapshot()).toEqual(features.snapshot(at));
    expect(handle.snapshot().now).toBe('2026-11-01T09:00:00.000Z');
  });

  it('passes snapshot options through to the store', () => {
    const handle = shop().for({ now: new Date('2026-11-01T09:00:00.000Z') });

    expect(handle.snapshot({ origin: 'build' }).origin).toBe('build');
    expect(handle.snapshot().origin).toBe('render');
  });

  it('answers an unknown key the way the store does', () => {
    const features = shop();
    const handle = features.for({ now: new Date('2026-11-01T09:00:00.000Z') });
    const key = 'no-such-flag' as 'gift-wrap';

    expect(handle.isEnabled(key)).toBe(false);
    expect(handle.variantOf(key)).toBeUndefined();
    expect(handle.valueOf(key)).toBeUndefined();
  });

  it('answers a key a reload added after the handle was built', () => {
    const features = shop();
    const handle = features.for({ now: new Date('2026-11-01T09:00:00.000Z') });
    // A served document may name a key the compiled schema does not.
    const result = features.reload({
      features: [
        { key: 'launch-sale', enabled: true },
        { key: 'gift-wrap', enabled: true },
        { key: 'gift-note', enabled: true },
      ],
    } as never);

    expect(result.ok).toBe(true);
    expect(handle.isEnabled('gift-note' as 'gift-wrap')).toBe(true);
  });

  it('keeps two handles from one store at their own instants', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T23:59:59.000Z'));
    const features = shop();
    const before = features.for({ targetingKey: 'cust-0042' });
    vi.setSystemTime(new Date('2026-11-01T00:00:01.000Z'));
    const after = features.for({ targetingKey: 'cust-0042' });

    expect(before.isEnabled('launch-sale')).toBe(false);
    expect(after.isEnabled('launch-sale')).toBe(true);
  });

  it('reports the settled instant on every event an observer receives', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T09:00:00.000Z'));
    const events: { type: string; at: string }[] = [];
    const handle = observedStorefront((event) =>
      events.push({ type: event.type, at: event.at.toISOString() }),
    ).for({
      targetingKey: 'cust-0042',
    });
    vi.setSystemTime(new Date('2026-11-01T09:00:05.000Z'));
    handle.resolve();
    handle.isEnabled('launch-sale');
    handle.plan();

    expect(events.map((event) => event.type)).toEqual([
      'resolve',
      'is-enabled',
      'plan',
    ]);
    for (const event of events) {
      expect(event.at).toBe('2026-11-01T09:00:00.000Z');
    }
  });
});
