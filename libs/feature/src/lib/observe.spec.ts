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
