import { describe, expect, it } from 'vitest';

import { formatPath, parsePath, pathFault } from './field-path.js';
import { Gen, rng } from './security/generator.js';

describe('parsePath', () => {
  it('splits on dots', () => {
    expect(parsePath('address.street')).toEqual(['address', 'street']);
  });

  it('reads an escaped dot as part of the segment', () => {
    expect(parsePath('a\\.b')).toEqual(['a.b']);
  });

  it('reads an escaped backslash, then splits on the next dot', () => {
    expect(parsePath('a\\\\.b')).toEqual(['a\\', 'b']);
  });

  it.each(['', 'a..b', '.a', 'a.', 'a\\', 'a\\x'])(
    'returns undefined for %j',
    (path) => {
      expect(parsePath(path)).toBeUndefined();
    },
  );
});

describe('formatPath', () => {
  it('escapes dots and backslashes and joins with dots', () => {
    expect(formatPath(['a.b', 'c\\d'])).toBe('a\\.b.c\\\\d');
  });

  it('round-trips generated segment lists', () => {
    const gen = new Gen(rng(1));
    const alphabet = ['a', 'b', 'Z', '0', '.', '\\', '!', '*', '_'];
    for (let i = 0; i < 500; i++) {
      const segments = Array.from({ length: 1 + gen.int(4) }, () =>
        Array.from({ length: 1 + gen.int(5) }, () => gen.pick(alphabet)).join(
          '',
        ),
      );
      expect(parsePath(formatPath(segments))).toEqual(segments);
    }
  });
});

describe('pathFault', () => {
  it.each(['id', 'address.street', 'a\\.b'])('accepts %j', (path) => {
    expect(pathFault(path)).toBeUndefined();
  });

  it.each([
    '',
    'a..b',
    '.a',
    'a.',
    'a\\',
    'a\\x',
    '__proto__',
    'a.__proto__',
    '*',
    'a.*',
    '!b',
    'a.!b',
  ])('refuses %j with a sentence', (path) => {
    expect(pathFault(path)).toEqual(expect.any(String));
  });
});
