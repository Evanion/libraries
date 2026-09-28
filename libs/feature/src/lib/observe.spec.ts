import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmitter } from './observe.js';
import type { FeatureEvent } from './observe.js';

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
    const emit = createEmitter({
      observe: () => {
        throw new Error('transport down');
      },
      onObserveError,
    });

    expect(() => emit(event)).not.toThrow();
    expect(onObserveError).toHaveBeenCalledTimes(1);
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

  it('hands the caller its value when the observer and the handler both throw', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const emit = createEmitter({
      observe: () => {
        throw new Error('transport down');
      },
      onObserveError: () => {
        throw new Error('logger down');
      },
    });
    const decide = () => {
      const decision = { ok: true };
      emit(event);
      return decision;
    };

    expect(decide()).toEqual({ ok: true });
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

  it('warns again for a second distinct failure', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const messages = ['transport down', 'transport down', 'quota exceeded'];
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
