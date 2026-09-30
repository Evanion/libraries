import { describe, expect, it } from 'vitest';
import { canonical } from './canonical.js';

describe('canonical', () => {
  it('sorts object keys', () => {
    expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }));
  });

  it('preserves array order', () => {
    expect(canonical(['a', 'b'])).not.toBe(canonical(['b', 'a']));
  });

  it('drops an undefined property', () => {
    expect(canonical({ a: 1, b: undefined })).toBe(canonical({ a: 1 }));
  });

  it('writes a date as its ISO string', () => {
    expect(canonical(new Date(0))).toBe('"1970-01-01T00:00:00.000Z"');
  });

  it('writes null', () => {
    expect(canonical(null)).toBe('null');
  });

  it('separates a nested object from a string that spells it', () => {
    expect(canonical({ a: { b: 1 } })).not.toBe(canonical({ a: '{"b":1}' }));
  });

  it('writes undefined as a string', () => {
    expect(canonical(undefined)).toBe('undefined');
  });

  it('writes a bigint with a trailing n', () => {
    expect(canonical(10n)).toBe('10n');
  });

  it('separates a bigint from the number of the same value', () => {
    expect(canonical(10n)).not.toBe(canonical(10));
  });

  it('writes a non-finite number behind a number tag', () => {
    expect(canonical(Number.NaN)).toBe('number:NaN');
    expect(canonical(Number.POSITIVE_INFINITY)).toBe('number:Infinity');
    expect(canonical(Number.NEGATIVE_INFINITY)).toBe('number:-Infinity');
  });

  it('separates NaN, Infinity, -Infinity and the null JSON writes for them', () => {
    // `toEpoch` at `conditions.ts:18-22` returns a number window instant
    // untouched, so a `before` boundary of `Infinity` matches every `now`, one
    // of `-Infinity` matches none, and one of `NaN` fails the guard at
    // `conditions.ts:73`. `JSON.stringify` writes one text for all three.
    const texts = new Set([
      canonical(Number.NaN),
      canonical(Number.POSITIVE_INFINITY),
      canonical(Number.NEGATIVE_INFINITY),
      canonical(null),
    ]);

    expect(texts.size).toBe(4);
  });

  it('separates a non-finite number from the string that spells its text', () => {
    expect(canonical(Number.NaN)).not.toBe(canonical('number:NaN'));
    expect(canonical(Number.POSITIVE_INFINITY)).not.toBe(
      canonical('number:Infinity'),
    );
  });

  it('writes a finite number the way JSON.stringify writes it', () => {
    expect(canonical(41)).toBe('41');
    expect(canonical(-0)).toBe('0');
    expect(canonical(1e21)).toBe('1e+21');
  });

  it('writes a function as a string instead of returning undefined', () => {
    expect(typeof canonical(() => 1)).toBe('string');
  });

  it('writes a symbol as a string instead of returning undefined', () => {
    expect(typeof canonical(Symbol('x'))).toBe('string');
  });

  it('separates two functions with different source', () => {
    expect(canonical(() => 1)).not.toBe(canonical(() => 2));
  });

  it('reads a value two paths reach once', () => {
    // A getter counts the reads. 16 levels of diamond give the leaf 2^16 paths,
    // and a walk with no memo takes every one of them, which is the cost
    // `serialized` at `serialize.ts:134` already refuses to pay on the same
    // graph.
    let reads = 0;
    const leaf = {
      get depth() {
        reads += 1;
        return 1;
      },
    };
    let held: object = leaf;
    for (let level = 0; level < 16; level += 1) held = { l: held, r: held };

    canonical(held);

    expect(reads).toBe(1);
  });

  it('writes a shared value as the copies JSON expands it into', () => {
    // The memo is a walk memo, not a back-reference in the text. A holder
    // parses the document JSON handed it, where the sharing is gone, and
    // computes the same text over it.
    const leaf = { depth: 1 };
    const shared = { l: leaf, r: leaf };

    expect(canonical(shared)).toBe(
      canonical(JSON.parse(JSON.stringify(shared)) as unknown),
    );
  });

  it('refuses a value that holds itself', () => {
    // The memo entry is written after the recursion, so a cycle reaches no
    // entry for a text it has not finished and the stack throws.
    const shape: Record<string, unknown> = {};
    shape['self'] = shape;

    expect(() => canonical(shape)).toThrow(RangeError);
  });
});
