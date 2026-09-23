import { describe, expect, it } from 'vitest';

import {
  EmptyInputError,
  InvalidDictionaryError,
  LuhnError,
} from './exceptions.js';

describe('LuhnError', () => {
  it('is an Error', () => {
    const error = new LuhnError('boom');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('boom');
    expect(error.name).toBe('LuhnError');
  });
});

describe('InvalidDictionaryError', () => {
  it('carries a name matching the class', () => {
    const error = new InvalidDictionaryError('odd-length', 'abc', []);

    expect(error.name).toBe('InvalidDictionaryError');
    expect(error.constructor.name).toBe('InvalidDictionaryError');
  });

  it('is a LuhnError', () => {
    expect(new InvalidDictionaryError('odd-length', 'abc', [])).toBeInstanceOf(
      LuhnError,
    );
  });

  it('keeps the fields it was constructed with', () => {
    const error = new InvalidDictionaryError('duplicate', 'aabbccdd', [
      'a',
      'b',
      'c',
      'd',
    ]);

    expect(error.reason).toBe('duplicate');
    expect(error.dictionary).toBe('aabbccdd');
    expect(error.offending).toEqual(['a', 'b', 'c', 'd']);
  });

  it('says dictionary in the message', () => {
    const error = new InvalidDictionaryError('odd-length', 'abc', []);

    expect(error.message).toContain('dictionary');
    expect(error.message).not.toContain('directory');
  });

  it('names the offending code points in the message', () => {
    const error = new InvalidDictionaryError('duplicate', 'aabb', ['a', 'b']);

    expect(error.message).toContain('a');
    expect(error.message).toContain('b');
  });
});

describe('EmptyInputError', () => {
  it('is a LuhnError with a name matching the class', () => {
    const error = new EmptyInputError('nothing to check');

    expect(error).toBeInstanceOf(LuhnError);
    expect(error.name).toBe('EmptyInputError');
    expect(error.message).toBe('nothing to check');
  });
});
