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

  it('writes a function as a string instead of returning undefined', () => {
    expect(typeof canonical(() => 1)).toBe('string');
  });

  it('writes a symbol as a string instead of returning undefined', () => {
    expect(typeof canonical(Symbol('x'))).toBe('string');
  });

  it('separates two functions with different source', () => {
    expect(canonical(() => 1)).not.toBe(canonical(() => 2));
  });
});
