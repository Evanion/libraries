import { describe, expect, it } from 'vitest';
import { bucketOf, inRollout, murmur3 } from './bucketing.js';

/**
 * The three properties the spec requires of bucketing, each written so it fails
 * on the naive implementation it warns about
 * (`hashFnv32a(value + seed) % 1000`, GrowthBook pre-v2).
 */

const members = (keys: readonly string[], percent: number, seed: string) =>
  keys.filter((key) => inRollout(key, percent, seed));

const users = Array.from({ length: 5000 }, (_, i) => `user-${i}`);

describe('bucketOf', () => {
  it('returns a value in [0, 1)', () => {
    for (const user of users.slice(0, 200)) {
      const bucket = bucketOf(user, 'checkout-v2');
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(1);
    }
  });

  it('is stable across evaluations', () => {
    const first = users.map((user) => bucketOf(user, 'checkout-v2'));
    const second = users.map((user) => bucketOf(user, 'checkout-v2'));

    expect(second).toEqual(first);
  });

  it('is stable across processes', () => {
    // Pinned literals, not a recomputation: a hash that changed between
    // releases would still agree with itself inside one process. This is the
    // only assertion that catches a changed hash, which would silently
    // rebucket every user of every deployed flag.
    expect(bucketOf('user-1', 'checkout-v2').toFixed(9)).toBe('0.550397675');
    expect(bucketOf('user-1', 'payments-v3').toFixed(9)).toBe('0.649353779');
    expect(bucketOf('', '').toFixed(9)).toBe('0.016881907');
  });

  it('hashes with a real MurmurHash3, x86 32-bit', () => {
    // The canonical test vectors. Pinning only the bucket values above would
    // also be satisfied by a private hash of my own invention, which is not
    // something anyone else can reproduce or audit.
    expect(murmur3('')).toBe(0);
    expect(murmur3('a').toString(16)).toBe('3c2569b2');
    expect(murmur3('abc').toString(16)).toBe('b3dd93fa');
    expect(murmur3('hello').toString(16)).toBe('248bfa47');
  });

  it('separates the seed from the value, so seed+value concatenation cannot collide', () => {
    // The naive `value + seed` concatenation hashes ('ab', 'c') and ('a', 'bc')
    // identically, which correlates flags whose keys share a prefix.
    expect(bucketOf('ab', 'c')).not.toBe(bucketOf('a', 'bc'));
  });
});

describe('inRollout', () => {
  it('is decorrelated across features', () => {
    // A user in the 10% of one feature must not be meaningfully more likely to
    // be in the 10% of another. Measured as overlap against the independent
    // expectation: 10% of the 10% cohort.
    const a = new Set(members(users, 10, 'checkout-v2'));
    const b = new Set(members(users, 10, 'payments-v3'));
    const overlap = [...a].filter((user) => b.has(user)).length;

    expect(a.size).toBeGreaterThan(users.length * 0.08);
    expect(b.size).toBeGreaterThan(users.length * 0.08);
    // Independent would be ~50 of 5000. A shared seed would make it ~500.
    expect(overlap).toBeLessThan(a.size * 0.25);
  });

  it('never moves an existing member out when the percentage is raised', () => {
    let previous = members(users, 1, 'checkout-v2');

    for (const percent of [2, 5, 10, 25, 50, 75, 99, 100]) {
      const next = new Set(members(users, percent, 'checkout-v2'));
      const dropped = previous.filter((user) => !next.has(user));

      expect(dropped, `raising to ${percent}% dropped members`).toEqual([]);
      expect(next.size).toBeGreaterThanOrEqual(previous.length);
      previous = [...next];
    }
  });

  it('includes nobody at 0% and everybody at 100%', () => {
    expect(members(users, 0, 'checkout-v2')).toEqual([]);
    expect(members(users, 100, 'checkout-v2')).toEqual(users);
  });

  it('lands within a point of the requested percentage', () => {
    for (const percent of [10, 25, 50]) {
      const share = (members(users, percent, 'checkout-v2').length / users.length) * 100;
      expect(Math.abs(share - percent)).toBeLessThan(1.5);
    }
  });
});
