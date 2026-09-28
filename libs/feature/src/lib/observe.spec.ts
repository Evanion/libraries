import { describe, expect, it, vi } from 'vitest';
import { createEmitter } from './observe.js';
import type { FeatureEvent } from './observe.js';

const event: FeatureEvent = {
  type: 'toggle',
  at: new Date(0),
  result: { ok: false, key: 'cta', error: 'unknown-feature' },
};

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

  it('returns before an async observer settles', async () => {
    let settled = false;
    const emit = createEmitter({
      observe: async () => {
        await Promise.resolve();
        settled = true;
      },
    });

    emit(event);

    expect(settled).toBe(false);
    await Promise.resolve();
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

  it('hands the caller its value whatever the observer does', () => {
    const emit = createEmitter({
      observe: () => {
        throw new Error('transport down');
      },
      onObserveError: vi.fn(),
    });
    const value = { ok: true };

    emit(event);

    expect(value).toEqual({ ok: true });
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
    warn.mockRestore();
  });
});
