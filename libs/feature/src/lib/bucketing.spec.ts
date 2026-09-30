import { describe, expect, it } from 'vitest';
import {
  bucketOf,
  inRollout,
  murmur3,
  murmur3Bytes,
  utf8,
} from './bucketing.js';

/**
 * The three properties `docs/specs/2026-09-11-feature-toggles.md`, "Rollout
 * bucketing", requires: stable, decorrelated across features, and monotonic in
 * the percentage.
 *
 * Each case is written so that it fails on the implementation that section
 * names as the one to avoid -- GrowthBook's pre-v2
 * `hashFnv32a(value + seed) % 1000` -- rather than merely passing on this one.
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
    // Pinned literals rather than a recomputation. A bucket is only useful if
    // it agrees across processes and versions, and a changed hash still agrees
    // with itself inside one process, so nothing but a pinned value catches it
    // -- and a changed hash rebuckets every user of every deployed flag.
    expect(bucketOf('user-1', 'checkout-v2').toFixed(9)).toBe('0.550397675');
    expect(bucketOf('user-1', 'payments-v3').toFixed(9)).toBe('0.649353779');
    expect(bucketOf('', '').toFixed(9)).toBe('0.016881907');
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
      const share =
        (members(users, percent, 'checkout-v2').length / users.length) * 100;
      expect(Math.abs(share - percent)).toBeLessThan(1.5);
    }
  });

  it('splits a rollout cohort across variants near the declared weights', () => {
    // The regression guard for seed separation. Sharing one seed puts every
    // member of a 20% rollout in the lowest 20% of the variant space, so a
    // 50/50 split would hand all of them the control.
    const key = 'cta';
    const inRolloutKeys: string[] = [];
    for (let i = 0; i < 20000; i += 1) {
      const subject = `user-${String(i)}`;
      if (inRollout(subject, 20, key)) inRolloutKeys.push(subject);
    }

    expect(inRolloutKeys.length).toBeGreaterThan(3000);

    let lower = 0;
    for (const subject of inRolloutKeys) {
      if (bucketOf(subject, `${key}:variant`) < 0.5) lower += 1;
    }

    const share = lower / inRolloutKeys.length;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
  });
});

describe('murmur3', () => {
  it('hashes with a real MurmurHash3, x86 32-bit', () => {
    // MurmurHash3's canonical test vectors, from the reference
    // implementation's own smhasher suite. The pinned buckets above are also
    // satisfied by any private hash; these say which hash it is, so another
    // implementation can reproduce a bucket without running this code.
    expect(murmur3('')).toBe(0);
    expect(murmur3('a').toString(16)).toBe('3c2569b2');
    expect(murmur3('abc').toString(16)).toBe('b3dd93fa');
    expect(murmur3('hello').toString(16)).toBe('248bfa47');
  });

  it('hashes the UTF-8 bytes of text outside ASCII', () => {
    // Pinned against the Encoding Standard's UTF-8 encoder, which the walk in
    // `utf8` reproduces: two bytes for U+00E9, nine for the three Japanese
    // characters, and four for the one code point a surrogate pair spells. A
    // targeting value in any script buckets the same in a port that matches
    // these.
    expect(murmur3('\u00e9').toString(16)).toBe('10110787');
    expect(murmur3('\u65e5\u672c\u8a9e').toString(16)).toBe('a5a47297');
    expect(murmur3('\ud83c\udf89').toString(16)).toBe('1feb8b56');
    expect(murmur3('a\ud83c\udf89b').toString(16)).toBe('cb287d58');
  });

  it('encodes an unpaired surrogate as U+FFFD', () => {
    // UTF-8 carries no lone surrogate and the Encoding Standard's encoder
    // writes the replacement character for one, at the end of a string as well
    // as in the middle.
    expect(murmur3('\ud800')).toBe(murmur3('\ufffd'));
    expect(murmur3('\udfff')).toBe(murmur3('\ufffd'));
    expect(murmur3('\ud800a')).toBe(murmur3('\ufffda'));
  });

  it('encodes a surrogate pair as one code point', () => {
    // A walk that read the two halves separately would write two replacements
    // and hash every emoji in a targeting value to the same bucket.
    expect(murmur3('\ud83c\udf89')).not.toBe(murmur3('\ufffd\ufffd'));
  });

  it('hashes with TextEncoder deleted from globalThis', () => {
    // `docs/specs/2026-09-23-feature-hydration.md` decision 11 puts `bucketOf`
    // on any JavaScript engine, Hermes included, where the Encoding API is a
    // global nothing promises.
    const bucket = bucketOf('user-1', 'checkout');
    const encoder = globalThis.TextEncoder;
    Reflect.deleteProperty(globalThis, 'TextEncoder');

    try {
      expect(murmur3('hello').toString(16)).toBe('248bfa47');
      expect(bucketOf('user-1', 'checkout')).toBe(bucket);
    } finally {
      Reflect.set(globalThis, 'TextEncoder', encoder);
    }
  });
});

describe('utf8', () => {
  it('agrees with TextEncoder on every code point', () => {
    // The Encoding Standard's UTF-8 encoder is what this walk states in source,
    // and `bucketOf` and `configDigest` commit its bytes to a Swift or Kotlin
    // port. One string per byte width leaves the three width branches untested
    // at their boundaries: widening `point < 0x800` to `<=` writes U+0800 as
    // two bytes, and no pinned hash in this file or in `digest.spec.ts` reads a
    // code point that branch decides.
    const reference = new TextEncoder();
    const disagreements: string[] = [];

    for (let point = 0; point <= 0x10ffff; point += 1) {
      const text = String.fromCodePoint(point);
      const theirs = reference.encode(text);
      const ours = utf8(text);
      const agrees =
        ours.length === theirs.length &&
        ours.every((byte, index) => byte === theirs[index]);
      if (!agrees) disagreements.push(`U+${point.toString(16)}`);
    }

    expect(disagreements).toEqual([]);
  });

  it('writes the byte width every branch boundary takes', () => {
    // The first and last code point each branch decides. A comparison written
    // `<=` where the source writes `<` moves one of these across a width, and
    // every bucket for every value holding it moves with it.
    expect(utf8('\u0000')).toEqual([0x00]);
    expect(utf8('\u007f')).toEqual([0x7f]);
    expect(utf8('\u0080')).toEqual([0xc2, 0x80]);
    expect(utf8('\u07ff')).toEqual([0xdf, 0xbf]);
    expect(utf8('\u0800')).toEqual([0xe0, 0xa0, 0x80]);
    expect(utf8('\uffff')).toEqual([0xef, 0xbf, 0xbf]);
    expect(utf8('\u{10000}')).toEqual([0xf0, 0x90, 0x80, 0x80]);
    expect(utf8('\u{10ffff}')).toEqual([0xf4, 0x8f, 0xbf, 0xbf]);
  });

  it('writes an unpaired surrogate as the three bytes of U+FFFD', () => {
    expect(utf8('\ud800')).toEqual([0xef, 0xbf, 0xbd]);
    expect(utf8('\udfff')).toEqual([0xef, 0xbf, 0xbd]);
  });
});

describe('murmur3Bytes', () => {
  it('hashes a byte array the way murmur3 hashes the text it encodes', () => {
    for (const text of [
      '',
      'a',
      'abc',
      'hello',
      '\u00e9',
      '\u65e5\u672c\u8a9e',
      '\ud83c\udf89',
      'a\ud83c\udf89b',
    ]) {
      expect(murmur3Bytes(utf8(text))).toBe(murmur3(text));
    }
  });

  it('hashes one byte array under each seed the digest widens with', () => {
    // `configDigest` encodes the canonical text once and calls this once per
    // seed, so the four words of a digest read one array.
    const bytes = utf8('hello');

    for (const seed of [0x00000000, 0x9747b28c, 0x2f1e3d4c, 0xb7e15163]) {
      expect(murmur3Bytes(bytes, seed)).toBe(murmur3('hello', seed));
    }
  });

  it('leaves the array it reads untouched', () => {
    const bytes = utf8('hello');

    murmur3Bytes(bytes, 0x9747b28c);

    expect(bytes).toEqual(utf8('hello'));
  });

  it('reads a tail of one, two and three bytes past the last block', () => {
    // The tail loop stands where the reference implementation writes a
    // fallthrough switch, and a length that is not a multiple of four is the
    // only input that reaches it.
    expect(murmur3Bytes([0x61, 0x62, 0x63, 0x64, 0x65])).toBe(murmur3('abcde'));
    expect(murmur3Bytes([0x61, 0x62, 0x63, 0x64, 0x65, 0x66])).toBe(
      murmur3('abcdef'),
    );
    expect(murmur3Bytes([0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67])).toBe(
      murmur3('abcdefg'),
    );
  });
});
