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
      const parsed = parsePath(formatPath(segments));

      expect(parsed).toEqual(segments);
    }
  });

  it('formats an empty segment to a path parsePath refuses', () => {
    expect(formatPath([''])).toBe('');
    expect(parsePath(formatPath(['']))).toBeUndefined();
  });
});

describe('pathFault', () => {
  it.each(['id', 'address.street', 'a\\.b'])('accepts %j', (path) => {
    expect(pathFault(path)).toBeUndefined();
  });

  it.each(['', 'a..b', '.a', 'a.', 'a\\', 'a\\x'])(
    'names malformed path %j',
    (path) => {
      expect(pathFault(path)).toContain('not a well-formed path');
    },
  );

  it.each(['__proto__', 'a.__proto__'])(
    'names the __proto__ segment in %j',
    (path) => {
      expect(pathFault(path)).toContain('"__proto__" segment');
    },
  );

  it.each(['*', 'a.*'])('names the * segment in %j', (path) => {
    expect(pathFault(path)).toContain('"*" segment');
  });

  it.each(['!b', 'a.!b'])('names the leading ! in %j', (path) => {
    expect(pathFault(path)).toContain('segment starting with "!"');
  });

  it('quotes the path with JSON escaping', () => {
    expect(pathFault('a\\')).toContain(JSON.stringify('a\\'));
  });
});
