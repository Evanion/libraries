import { describe, expect, it } from 'vitest';

import {
  InvalidAlphabetError,
  InvalidShapeError,
  TokenError,
} from './exceptions.js';

const SHAPE = { length: 8, chunkSize: 4, separator: '-' };

describe('TokenError', () => {
  it('should be an Error', () => {
    const error = new TokenError('boom');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('boom');
    expect(error.name).toBe('TokenError');
  });
});

describe('InvalidAlphabetError', () => {
  it('should be a TokenError carrying a name matching the class', () => {
    const error = new InvalidAlphabetError('non-uniform', 'abcdef');

    expect(error).toBeInstanceOf(TokenError);
    expect(error.name).toBe('InvalidAlphabetError');
    expect(error.constructor.name).toBe('InvalidAlphabetError');
  });

  it('should carry the reason, the dictionary and the offending code points', () => {
    const error = new InvalidAlphabetError('confusable', 'abcilo', [
      'i',
      'l',
      'o',
    ]);

    expect(error.reason).toBe('confusable');
    expect(error.dictionary).toBe('abcilo');
    expect(error.offending).toEqual(['i', 'l', 'o']);
  });

  it('should default offending to empty, for the constraints no character owns', () => {
    expect(new InvalidAlphabetError('non-uniform', 'abcdef').offending).toEqual(
      [],
    );
  });

  it('should name the offending code points in the message', () => {
    expect(
      new InvalidAlphabetError('confusable', 'abcilo', ['i', 'l']).message,
    ).toContain('"i", "l"');
    expect(
      new InvalidAlphabetError('unfolded', 'ABCDEF', ['A']).message,
    ).toContain('"A"');
  });

  it('should count the dictionary by code point in the non-uniform message', () => {
    // 6 code points written as 12 UTF-16 units: the message reports what a
    // reader would count, not what `String#length` returns.
    expect(
      new InvalidAlphabetError('non-uniform', '😀😁😂😃😄😅').message,
    ).toContain('6 does not');
  });
});

describe('InvalidShapeError', () => {
  it('should be a TokenError carrying a name matching the class', () => {
    const error = new InvalidShapeError('length', SHAPE);

    expect(error).toBeInstanceOf(TokenError);
    expect(error.name).toBe('InvalidShapeError');
    expect(error.constructor.name).toBe('InvalidShapeError');
  });

  it('should carry all three shape values, not only the one it names', () => {
    const error = new InvalidShapeError('chunk-size-indivisible', {
      length: 6,
      chunkSize: 4,
      separator: '/',
    });

    expect(error.reason).toBe('chunk-size-indivisible');
    expect(error.length).toBe(6);
    expect(error.chunkSize).toBe(4);
    expect(error.separator).toBe('/');
  });

  it('should describe each reason distinctly', () => {
    const messages = (
      [
        'length',
        'chunk-size',
        'chunk-size-indivisible',
        'separator-empty',
        'separator-in-dictionary',
      ] as const
    ).map((reason) => new InvalidShapeError(reason, SHAPE).message);

    expect(new Set(messages).size).toBe(messages.length);
    for (const message of messages) expect(message.length).toBeGreaterThan(0);
  });
});
