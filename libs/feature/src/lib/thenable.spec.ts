import { describe, expect, it } from 'vitest';

import { isThenable } from './thenable.js';

describe('isThenable', () => {
  it('answers true for a promise', () => {
    const settled = Promise.resolve('a value');

    expect(isThenable(settled)).toBe(true);
  });

  it('answers true for an object carrying a then function', () => {
    const thenable = {
      then() {
        return undefined;
      },
    };

    expect(isThenable(thenable)).toBe(true);
  });

  it('answers false for null', () => {
    expect(isThenable(null)).toBe(false);
  });

  it('answers false for undefined', () => {
    expect(isThenable(undefined)).toBe(false);
  });

  it('answers false for a function carrying a then member', () => {
    const callable = Object.assign(() => undefined, {
      then() {
        return undefined;
      },
    });

    expect(isThenable(callable)).toBe(false);
  });

  it('answers false for an object whose then is no function', () => {
    expect(isThenable({ then: 'a string' })).toBe(false);
  });

  it('answers false for an object carrying no then at all', () => {
    expect(isThenable({ kind: 'unversioned' })).toBe(false);
  });

  it('answers false for a plain function', () => {
    expect(isThenable(() => undefined)).toBe(false);
  });

  it('answers false for a string, a number and a boolean', () => {
    expect(isThenable('a string')).toBe(false);
    expect(isThenable(0)).toBe(false);
    expect(isThenable(false)).toBe(false);
  });

  it('answers true for an object whose then came off its prototype', () => {
    class Deferred {
      then() {
        return undefined;
      }
    }

    expect(isThenable(new Deferred())).toBe(true);
  });
});
