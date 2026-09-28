import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFeatures } from './features.js';
import { createEmitter } from './observe.js';
import type { FeatureEvent } from './observe.js';
import type { ToggleResult } from './types.js';

const event: FeatureEvent = {
  type: 'toggle',
  at: new Date(0),
  result: { ok: false, key: 'cta', error: 'unknown-feature' },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createEmitter', () => {
  it('returns a function that does nothing when no observer is installed', () => {
    const emit = createEmitter({});

    expect(() => emit(event)).not.toThrow();
  });

  it('calls the observer with the event', () => {
    const observe = vi.fn();
    const emit = createEmitter({ observe });

    emit(event);

    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(event);
  });

  it('returns before an async observer settles and lets it settle after', async () => {
    let started = false;
    let settled = false;
    const emit = createEmitter({
      observe: async () => {
        started = true;
        await Promise.resolve();
        settled = true;
      },
    });

    emit(event);

    expect(started).toBe(true);
    expect(settled).toBe(false);

    await Promise.resolve();
    await Promise.resolve();

    expect(settled).toBe(true);
  });

  it('swallows a synchronous throw and reports it', () => {
    const onObserveError = vi.fn();
    const thrown = new Error('transport down');
    const emit = createEmitter({
      observe: () => {
        throw thrown;
      },
      onObserveError,
    });

    expect(() => emit(event)).not.toThrow();
    expect(onObserveError).toHaveBeenCalledTimes(1);
    expect(onObserveError.mock.calls[0]?.[0]).toBe(thrown);
    expect(onObserveError.mock.calls[0]?.[1]).toBe(event);
  });

  it('swallows a rejected promise and reports it', async () => {
    const onObserveError = vi.fn();
    const emit = createEmitter({
      observe: () => Promise.reject(new Error('transport down')),
      onObserveError,
    });

    emit(event);
    await Promise.resolve();
    await Promise.resolve();

    expect(onObserveError).toHaveBeenCalledTimes(1);
  });

  it('warns and does not rethrow when onObserveError throws on the sync path', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onObserveError = vi.fn(() => {
      throw new Error('logger down');
    });
    const emit = createEmitter({
      observe: () => {
        throw new Error('transport down');
      },
      onObserveError,
    });

    expect(() => emit(event)).not.toThrow();
    expect(onObserveError).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('onObserveError threw');
    expect(warn.mock.calls[0]?.[1]).toEqual(new Error('logger down'));
    expect(warn.mock.calls[0]?.[2]).toEqual(new Error('transport down'));
  });

  it('warns and leaves no unhandled rejection when onObserveError throws on the async path', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', record);
    const emit = createEmitter({
      observe: () => Promise.reject(new Error('transport down')),
      onObserveError: () => {
        throw new Error('logger down');
      },
    });

    emit(event);
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', record);

    expect(unhandled).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns once across several failures when no handler is supplied', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const emit = createEmitter({
      observe: () => {
        throw new Error('transport down');
      },
    });

    emit(event);
    emit(event);
    emit(event);

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns once per distinct failure message when no handler is supplied', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const messages = [
      'connection refused',
      'connection refused',
      'payload too large',
    ];
    let call = 0;
    const emit = createEmitter({
      observe: () => {
        throw new Error(messages[call++]);
      },
    });

    emit(event);
    emit(event);
    emit(event);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]?.[1]).toEqual(new Error('connection refused'));
    expect(warn.mock.calls[1]?.[1]).toEqual(new Error('payload too large'));
  });

  it('warns and leaves no unhandled rejection when onObserveError rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', record);
    const emit = createEmitter({
      observe: () => {
        throw new Error('transport down');
      },
      onObserveError: async () => {
        await Promise.resolve();
        throw new Error('audit post failed');
      },
    });

    expect(() => emit(event)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', record);

    expect(unhandled).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('onObserveError threw');
    expect(warn.mock.calls[0]?.[1]).toEqual(new Error('audit post failed'));
    expect(warn.mock.calls[0]?.[2]).toEqual(new Error('transport down'));
  });

  it('swallows an error that has no primitive conversion', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const hostile = Object.create(null) as object;
    const emit = createEmitter({
      observe: () => {
        throw hostile;
      },
    });

    expect(() => emit(event)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]).toBe(hostile);
  });

  it('swallows an error whose message getter throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const hostile = new Error('transport down');
    Object.defineProperty(hostile, 'message', {
      get() {
        throw new Error('message getter down');
      },
    });
    const emit = createEmitter({
      observe: () => {
        throw hostile;
      },
    });

    expect(() => emit(event)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]).toBe(hostile);
  });

  it('stops warning once twenty distinct failures have warned', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let call = 0;
    const emit = createEmitter({
      observe: () => {
        throw new Error(`request ${call++} failed`);
      },
    });

    for (let i = 0; i < 200; i++) emit(event);

    expect(warn).toHaveBeenCalledTimes(21);
    expect(warn.mock.calls[20]?.[0]).toContain(
      'The engine stops warning about this emitter',
    );
  });

  it('reports every distinct failure to onObserveError past the warning limit', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onObserveError = vi.fn();
    let call = 0;
    const emit = createEmitter({
      observe: () => {
        throw new Error(`request ${call++} failed`);
      },
      onObserveError,
    });

    for (let i = 0; i < 200; i++) emit(event);

    expect(onObserveError).toHaveBeenCalledTimes(200);
  });

  it('warns in a runtime that defines no process global', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const emit = createEmitter({
      observe: () => {
        throw new Error('transport down');
      },
    });
    vi.stubGlobal('process', undefined);

    try {
      expect(() => emit(event)).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stays silent in production when no handler is supplied', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const emit = createEmitter({
      observe: () => {
        throw new Error('transport down');
      },
    });

    try {
      emit(event);
    } finally {
      process.env.NODE_ENV = previous;
    }

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('resolve and isEnabled', () => {
  const defs = [
    { key: 'cta', enabled: true },
    { key: 'nav', enabled: true },
  ] as const;

  it('emits one resolve event carrying every decision', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    const decisions = features.resolve({ targetingKey: 'u1' });

    expect(observe).toHaveBeenCalledTimes(1);
    const event = observe.mock.calls[0]?.[0];
    expect(event.type).toBe('resolve');
    expect(Object.keys(event.decisions)).toEqual(['cta', 'nav']);
    // The event reports the record the caller received, so an auditor reading
    // the event stream reads what the application acted on.
    expect(event.decisions).toBe(decisions);
  });

  it('emits one is-enabled event naming the key the caller asked for', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    const enabled = features.isEnabled('cta', { targetingKey: 'u1' });

    expect(observe).toHaveBeenCalledTimes(1);
    const event = observe.mock.calls[0]?.[0];
    expect(event.type).toBe('is-enabled');
    expect(event.key).toBe('cta');
    expect(event.decision.key).toBe('cta');
    expect(event.decision.enabled).toBe(enabled);
  });

  it('reports a disabled feature as the caller saw it', () => {
    const observe = vi.fn();
    const features = createFeatures(
      [
        { key: 'cta', enabled: true },
        { key: 'nav', enabled: false },
      ] as const,
      { observe },
    );

    const enabled = features.isEnabled('nav', { targetingKey: 'u1' });

    expect(enabled).toBe(false);
    expect(observe.mock.calls[0]?.[0].decision.enabled).toBe(false);
  });

  it('answers what the store decided when an observer rewrites the decision', () => {
    let attempts = 0;
    let refused = false;
    const features = createFeatures(defs, {
      observe: (event) => {
        if (event.type !== 'is-enabled') return;
        attempts += 1;
        try {
          (event.decision as { enabled: boolean }).enabled = false;
        } catch {
          refused = true;
        }
      },
    });

    const enabled = features.isEnabled('cta', { targetingKey: 'u1' });

    // The count is what makes the boolean a contract. An `isEnabled` that
    // emitted nothing would answer `true` as well, so this case proves the
    // observer ran and tried to rewrite the decision the answer came off.
    expect(attempts).toBe(1);
    expect(refused).toBe(true);
    expect(enabled).toBe(true);
  });

  it('hands the observer the frozen record resolve returns', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    const decisions = features.resolve({ targetingKey: 'u1' });

    expect(Object.isFrozen(decisions)).toBe(true);
    expect(Object.isFrozen(decisions.cta)).toBe(true);
    expect(observe.mock.calls[0]?.[0].decisions).toBe(decisions);
  });

  it('answers the record the store decided when an observer rewrites it', () => {
    let attempts = 0;
    let refused = false;
    const features = createFeatures(defs, {
      observe: (event) => {
        if (event.type !== 'resolve') return;
        attempts += 1;
        try {
          (event.decisions.cta as { enabled: boolean }).enabled = false;
        } catch {
          refused = true;
        }
      },
    });

    const decisions = features.resolve({ targetingKey: 'u1' });

    expect(attempts).toBe(1);
    expect(refused).toBe(true);
    expect(decisions.cta.enabled).toBe(true);
  });

  it('hands the observer a frozen decision on an is-enabled event', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    features.isEnabled('cta', { targetingKey: 'u1' });

    const event = observe.mock.calls[0]?.[0];

    // `Object.isFrozen` answers `true` for `undefined`, so the presence check
    // carries the weight here. An event that dropped its decision would pass
    // the freeze assertion on its own.
    expect(event.decision).toBeDefined();
    expect(Object.isFrozen(event.decision)).toBe(true);
  });

  it('leaves the record unfrozen when nobody is observing', () => {
    const features = createFeatures(defs);

    const decisions = features.resolve({ targetingKey: 'u1' });

    // The freeze makes the event's readonly type true for a JavaScript
    // observer. A store with nobody observing freezes nothing.
    expect(Object.isFrozen(decisions)).toBe(false);
  });

  it('carries the instant the caller supplied', () => {
    const observe = vi.fn();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const features = createFeatures(defs, { observe });

    features.resolve({ targetingKey: 'u1', now });

    expect(observe.mock.calls[0]?.[0].at.getTime()).toBe(now.getTime());
  });

  it('copies the instant the caller supplied', () => {
    const observe = vi.fn();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const features = createFeatures(defs, { observe });

    features.resolve({ targetingKey: 'u1', now });

    // An observer holding the caller's own `Date` could call `setTime` on it
    // and move every later rule that reads `now`.
    expect(observe.mock.calls[0]?.[0].at).not.toBe(now);
  });

  it('carries the bucketing field as the subject', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    features.resolve({ targetingKey: 'u1' });

    expect(observe.mock.calls[0]?.[0].subject).toBe('u1');
  });

  it('carries the field correlateBy names', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, {
      observe,
      correlateBy: 'pseudonym',
    });

    features.resolve({ targetingKey: 'u1', pseudonym: 'p1' });

    expect(observe.mock.calls[0]?.[0].subject).toBe('p1');
  });

  it('carries no subject for a field holding an object', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe, correlateBy: 'account' });

    features.resolve({ targetingKey: 'u1', account: { id: 'a1' } });

    // The key is absent, not present holding `undefined`. A consumer that
    // branches on `'subject' in event` reads the same answer as one that
    // reads the field.
    expect(observe.mock.calls[0]?.[0]).not.toHaveProperty('subject');
  });

  it('carries the version the application configured', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe, version: '2026-01-01' });

    features.resolve({ targetingKey: 'u1' });

    expect(observe.mock.calls[0]?.[0].version).toBe('2026-01-01');
  });

  it('carries no version when the application configured none', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    features.resolve({ targetingKey: 'u1' });

    // The key is absent, not present holding `undefined`, for the same reason
    // an absent subject carries no key.
    expect(observe.mock.calls[0]?.[0]).not.toHaveProperty('version');
  });

  it('carries the instant, the subject and the version on an is-enabled event', () => {
    const observe = vi.fn();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const features = createFeatures(defs, { observe, version: '2026-01-01' });

    features.isEnabled('cta', { targetingKey: 'u1', now });

    // `is-enabled` carries the envelope `resolve` carries. The cases above
    // pin it on one entry point, and a cast sits on both emits, so an edit
    // that dropped the envelope from this one would compile.
    const event = observe.mock.calls[0]?.[0];

    expect(event.at.getTime()).toBe(now.getTime());
    expect(event.at).not.toBe(now);
    expect(event.subject).toBe('u1');
    expect(event.version).toBe('2026-01-01');
  });

  it('carries the field correlateBy names on an is-enabled event', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, {
      observe,
      correlateBy: 'pseudonym',
    });

    features.isEnabled('cta', { targetingKey: 'u1', pseudonym: 'p1' });

    expect(observe.mock.calls[0]?.[0].subject).toBe('p1');
  });

  it('carries no subject on an is-enabled event for a field holding an object', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe, correlateBy: 'account' });

    features.isEnabled('cta', { targetingKey: 'u1', account: { id: 'a1' } });

    expect(observe.mock.calls[0]?.[0]).not.toHaveProperty('subject');
  });

  it('carries no version on an is-enabled event when none is configured', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    features.isEnabled('cta', { targetingKey: 'u1' });

    expect(observe.mock.calls[0]?.[0]).not.toHaveProperty('version');
  });

  it('emits nothing from the resolution isEnabled runs internally', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    features.isEnabled('cta', { targetingKey: 'u1' });

    // One event, not two. A resolve event here would tell an auditor the
    // application asked about every feature when it asked about one.
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls[0]?.[0].type).toBe('is-enabled');
  });

  it('emits nothing for a key nobody configured', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });
    // The cast is the JavaScript caller. A TypeScript caller cannot name a key
    // the definitions never declared.
    const ask = features.isEnabled as (key: string) => boolean;

    const enabled = ask('ghost');

    // `FeatureEvent` declares `decision` on every `is-enabled` event, and this
    // call resolved none. An event carrying `undefined` there would break the
    // first observer that reads `event.decision.key`.
    expect(enabled).toBe(false);
    expect(observe).not.toHaveBeenCalled();
  });

  it('builds no event when nobody is observing', () => {
    let reads = 0;
    const features = createFeatures(defs, {
      get version() {
        reads += 1;
        return '1.0.0';
      },
    });

    features.resolve({ targetingKey: 'u1' });
    features.isEnabled('cta', { targetingKey: 'u1' });

    // `envelope` is the only reader of `version`, and an entry point calls it
    // to build an event. A store with nobody observing builds none, so nothing
    // reads the field.
    expect(reads).toBe(0);
  });
});

describe('plan and toggle', () => {
  const defs = [
    { key: 'parent', enabled: true },
    { key: 'child', enabled: true, dependsOn: ['parent'] },
  ] as const;

  it('emits one plan event carrying the partition', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    features.plan({ targetingKey: 'u1' });

    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls[0]?.[0].type).toBe('plan');
  });

  it('emits one toggle event and nothing from its two resolutions', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    features.toggle('parent', false, { targetingKey: 'u1' });

    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls[0]?.[0].type).toBe('toggle');
  });
  it('still reports which dependants a toggle will disable', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    const result = features.toggle('parent', false, { targetingKey: 'u1' });

    // The two resolutions toggle compares are silent, and they still run. A
    // change that silenced them by skipping them would empty this list.
    expect(result.ok).toBe(true);
    expect(result.ok && result.willDisable).toEqual(['child']);
  });

  it('reports the same willDisable with no observer installed', () => {
    const observed = createFeatures(defs, { observe: vi.fn() });
    const plain = createFeatures(defs);

    const a = observed.toggle('parent', false, { targetingKey: 'u1' });
    const b = plain.toggle('parent', false, { targetingKey: 'u1' });

    expect(a).toEqual(b);
  });

  it('emits one event for a key nobody configured', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });
    // The cast is the JavaScript caller. A TypeScript caller cannot name a key
    // the definitions never declared.
    const write = features.toggle as (
      key: string,
      enabled: boolean,
    ) => ToggleResult<string>;

    const result = write('ghost', false);

    // An auditor wants the refused write as much as the accepted one.
    expect(result).toEqual({
      ok: false,
      key: 'ghost',
      error: 'unknown-feature',
    });
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls[0]?.[0]).toMatchObject({
      type: 'toggle',
      result: { ok: false, key: 'ghost', error: 'unknown-feature' },
    });
  });
});
