import { describe, expect, it, vi } from 'vitest';

import {
  escapeField,
  formatPath,
  parsePath,
  pathFault,
  readPath,
} from './field-path.js';

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
    let seed = 1;
    const next = (n: number): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    };
    const alphabet = ['a', 'b', 'Z', '0', '.', '\\', '!', '*', '_'];

    for (let i = 0; i < 500; i++) {
      const segments = Array.from({ length: 1 + next(4) }, () =>
        Array.from(
          { length: 1 + next(5) },
          () => alphabet[next(alphabet.length)],
        ).join(''),
      );

      expect(parsePath(formatPath(segments))).toEqual(segments);
    }
  });

  it('formats an empty segment to a path parsePath refuses', () => {
    expect(formatPath([''])).toBe('');
    expect(parsePath(formatPath(['']))).toBeUndefined();
  });
});

describe('escapeField', () => {
  it('escapes a dot', () => {
    expect(escapeField('a.b')).toBe('a\\.b');
  });

  it('escapes a backslash', () => {
    expect(escapeField('a\\b')).toBe('a\\\\b');
  });

  it('leaves a plain name alone', () => {
    expect(escapeField('plan')).toBe('plan');
  });
});

describe('pathFault', () => {
  it.each(['id', 'address.street', 'a\\.b', 'now'])('accepts %j', (path) => {
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

  it.each(['*', 'a.*', '!b', 'a.!b'])('accepts %j as a field name', (path) => {
    expect(pathFault(path)).toBeUndefined();
  });

  it.each(['a.constructor', 'a.prototype', 'constructor', 'prototype'])(
    'refuses the %j segment',
    (path) => {
      expect(pathFault(path)).toBeDefined();
    },
  );

  it('accepts a name that merely contains constructor', () => {
    expect(pathFault('constructors.prototypes')).toBeUndefined();
  });

  it('accepts 32 segments and refuses 33', () => {
    const segments = (n: number): string =>
      Array.from({ length: n }, () => 'a').join('.');

    expect(pathFault(segments(32))).toBeUndefined();
    expect(pathFault(segments(33))).toContain('32');
  });

  it('quotes the path with JSON escaping', () => {
    expect(pathFault('a\\')).toContain(JSON.stringify('a\\'));
  });
});

describe('readPath', () => {
  it('reads a nested own data property', () => {
    expect(readPath({ subject: { id: 'u' } }, 'subject.id')).toEqual({
      present: true,
      value: 'u',
    });
  });

  it('reads the top-level now', () => {
    const now = new Date(0);

    expect(readPath({ now }, 'now')).toEqual({ present: true, value: now });
  });

  it('reads an escaped flat key', () => {
    expect(readPath({ 'a.b': 1 }, 'a\\.b')).toEqual({
      present: true,
      value: 1,
    });
  });

  it('keeps a flat dotted key and a nested path apart', () => {
    const bag = { 'subject.id': 'x', subject: { id: 'y' } };

    expect(readPath(bag, 'subject.id').value).toBe('y');
    expect(readPath(bag, 'subject\\.id').value).toBe('x');
  });

  it('reads undefined as present', () => {
    expect(readPath({ a: undefined }, 'a')).toEqual({
      present: true,
      value: undefined,
    });
  });

  it('reads null as present', () => {
    expect(readPath({ a: null }, 'a')).toEqual({ present: true, value: null });
  });

  it('reads a value off a null-prototype parent', () => {
    const parent = Object.assign(Object.create(null), { id: 1 });

    expect(readPath({ subject: parent }, 'subject.id').present).toBe(true);
  });

  it('reads an array value at the last segment', () => {
    expect(readPath({ a: [1] }, 'a').value).toEqual([1]);
  });

  it.each([
    ['a missing segment', { subject: {} }, 'subject.id'],
    ['a missing top-level key', {}, 'subject'],
    ['a null parent', { subject: null }, 'subject.id'],
    ['a primitive parent', { subject: 'x' }, 'subject.id'],
    ['an array parent', { subject: ['x'] }, 'subject.0'],
    ['a Date parent', { subject: new Date(0) }, 'subject.getTime'],
    ['a Map parent', { subject: new Map([['id', 1]]) }, 'subject.size'],
    [
      'a class instance parent',
      {
        subject: new (class {
          id = 1;
        })(),
      },
      'subject.id',
    ],
    ['an inherited property', { a: Object.create({ b: 1 }) }, 'a.b'],
    ['a prototype member', { a: {} }, 'a.toString'],
    ['a malformed path', { a: 1 }, 'a..b'],
    ['an empty path', { a: 1 }, ''],
    ['a __proto__ segment', { a: {} }, 'a.__proto__'],
  ])('is absent for %s', (_name, bag, path) => {
    expect(readPath(bag, path)).toEqual({ present: false });
  });

  it.each([null, undefined, 'x', 1])('is absent when the bag is %j', (bag) => {
    expect(readPath(bag, 'a').present).toBe(false);
  });

  it('reads a top-level getter, calling it once', () => {
    const getter = vi.fn(() => 'x');
    const bag = {
      get id() {
        return getter();
      },
    };

    expect(readPath(bag, 'id')).toEqual({ present: true, value: 'x' });
    expect(getter).toHaveBeenCalledTimes(1);
  });

  it('is absent when a top-level getter throws', () => {
    const bag = {
      get id(): string {
        throw new Error('boom');
      },
    };

    expect(readPath(bag, 'id').present).toBe(false);
  });

  it('is absent for a nested getter and never calls it', () => {
    const getter = vi.fn(() => 'x');
    const bag = {
      subject: {
        get id() {
          return getter();
        },
      },
    };

    expect(readPath(bag, 'subject.id').present).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it('reads an own prop of a class-instance, array or prototyped context', () => {
    const instance = new (class {
      id = 1;
    })();
    const array = Object.assign([], { id: 2 });
    const prototyped = Object.assign(Object.create({ x: 0 }), { id: 3 });

    expect(readPath(instance, 'id').value).toBe(1);
    expect(readPath(array, 'id').value).toBe(2);
    expect(readPath(prototyped, 'id').value).toBe(3);
    expect(readPath(prototyped, 'x').present).toBe(false);
  });

  it('is absent beneath a nested getter and never calls it', () => {
    const getter = vi.fn(() => ({ id: 1 }));
    const bag = {
      a: {
        get subject() {
          return getter();
        },
      },
    };

    expect(readPath(bag, 'a.subject.id').present).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it('is absent for a revoked proxy at a segment and does not throw', () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();

    expect(readPath({ subject: proxy }, 'subject.id').present).toBe(false);
    expect(readPath({ subject: proxy }, 'subject').present).toBe(true);
    expect(readPath(proxy, 'subject').present).toBe(false);
  });

  it('is absent for a proxy whose traps throw and does not throw', () => {
    const trap = (): never => {
      throw new Error('trap');
    };
    const hostile = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: trap,
        getPrototypeOf: trap,
        get: trap,
        has: trap,
        ownKeys: trap,
      },
    );

    expect(readPath({ subject: hostile }, 'subject.id').present).toBe(false);
    expect(readPath(hostile, 'subject').present).toBe(false);
  });

  it('reads through a cycle, bounded by the segment cap', () => {
    const loop: Record<string, unknown> = { x: 1 };
    loop['self'] = loop;

    expect(readPath({ x: 1, self: loop }, 'self.x')).toEqual({
      present: true,
      value: 1,
    });
    expect(readPath(loop, 'self.self.self.x').value).toBe(1);
    expect(readPath(loop, 'self.self.y').present).toBe(false);
  });

  it('is absent for a path over the segment cap', () => {
    const path = Array.from({ length: 33 }, () => 'a').join('.');
    const deep = Array.from({ length: 33 }).reduce<unknown>(
      (inner) => ({ a: inner }),
      1,
    );

    expect(readPath(deep, path).present).toBe(false);
  });
});
