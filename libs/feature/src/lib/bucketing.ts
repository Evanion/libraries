/**
 * Deterministic rollout bucketing.
 *
 * Three properties are required of this, and all three come from how the bucket
 * is derived rather than from how it is compared:
 *
 * 1. Stable. The bucket is a pure hash of the (seed, value) pair. No randomness,
 *    no clock, no process state, so it agrees across evaluations and processes.
 * 2. Decorrelated across features. The seed defaults to the feature key, so the
 *    same user hashes to an unrelated bucket per feature. Seeding with a
 *    constant is what puts a user in every rollout or none.
 * 3. Monotonic in the percentage. The bucket does not depend on the percentage
 *    at all; the percentage is only a threshold on it. Raising a percentage can
 *    therefore only add members, never move one out.
 *
 * GrowthBook's pre-v2 `hashFnv32a(value + seed) % 1000` fails (2) for two
 * separate reasons -- it is the implementation
 * `docs/specs/2026-09-11-feature-toggles.md`, "Rollout bucketing", names as the
 * one to avoid -- and this departs from it on both:
 *
 * - Concatenating value and seed with no unambiguous boundary makes the pairs
 *   ('ab', 'c') and ('a', 'bc') the same input, so flags whose keys share a
 *   prefix share buckets. The seed is length-prefixed here, which is
 *   unambiguous for every possible input -- no separator character can be,
 *   since any separator may itself occur in a key or a targeting value.
 * - FNV-1a has weak avalanche in its low bits, and a modulus reads exactly
 *   those. MurmurHash3's finalisation mixes the whole word, and the bucket is
 *   taken from all 32 bits rather than a modulus, which is also what makes the
 *   granularity (2^32 buckets) fine enough that a percentage change adds
 *   buckets instead of reshuffling them.
 *
 * MurmurHash3 over a normalised 32-bit space is Unleash's approach
 * (`normalizedValue(groupId, stickiness)`), with `groupId` defaulting to the
 * flag name -- the same defaulting as `seed` here.
 */

const TWO_32 = 0x100000000;

const C1 = 0xcc9e2d51;
const C2 = 0x1b873593;

function rotl32(value: number, shift: number): number {
  return (value << shift) | (value >>> (32 - shift));
}

/** Encodes the pair so that no two distinct pairs produce the same string. */
function encodePair(seed: string, value: string): string {
  return `${seed.length}:${seed}${value}`;
}

/**
 * The UTF-8 bytes of `input`, walked here instead of asked of a host global.
 *
 * `bucketOf` and `configDigest` both hash these bytes, and a Swift or Kotlin
 * port has to produce the same ones. An encoder written out in the source is a
 * specification an implementer reads; `TextEncoder` specifies whatever the
 * runtime does, and the runtimes disagree on a lone surrogate.
 *
 * `murmur3` then asks its host for arithmetic and string indexing alone, which
 * two specs require. `docs/specs/2026-09-23-feature-hydration.md` decision 11
 * puts `bucketOf` on a JavaScript engine with no DOM, Hermes included, and
 * `docs/specs/2026-09-23-feature-config-distribution.md` § 8 holds
 * `configDigest` to a host that provides `JSON` and nothing else.
 *
 * An unpaired surrogate encodes as U+FFFD, which is the replacement the
 * Encoding Standard's UTF-8 encoder writes for one, so the bytes agree with
 * `TextEncoder` for every possible input.
 */
export function utf8(input: string): number[] {
  const bytes: number[] = [];

  for (let i = 0; i < input.length; i += 1) {
    let point = input.charCodeAt(i);

    if (point >= 0xd800 && point <= 0xdbff) {
      // `charCodeAt` past the end is NaN, which fails both comparisons and
      // leaves a high surrogate at the end of the string unpaired.
      const low = input.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        point = 0x10000 + (point - 0xd800) * 0x400 + (low - 0xdc00);
        i += 1;
      } else {
        point = 0xfffd;
      }
    } else if (point >= 0xdc00 && point <= 0xdfff) {
      point = 0xfffd;
    }

    if (point < 0x80) {
      bytes.push(point);
    } else if (point < 0x800) {
      bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    } else if (point < 0x10000) {
      bytes.push(
        0xe0 | (point >> 12),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    }
  }

  return bytes;
}

/**
 * MurmurHash3, x86 32-bit, over `bytes`. Returns an unsigned 32-bit integer.
 * `Math.imul` is used throughout because a 32-bit product does not fit a
 * float64 mantissa.
 *
 * The bytes are a parameter because `configDigest` hashes one document under the
 * four seeds of `digest.ts`, and every seed reads the same bytes. It calls `utf8`
 * once and this four times, so the walk runs once per digest. A document of 2000
 * features with one rule each canonicalises to 209,794 characters: the four
 * hashes cost 5.7ms from the string, 2.0ms from one byte array, and the string
 * form allocates four arrays of one element per byte where the byte form
 * allocates one.
 */
export function murmur3Bytes(bytes: readonly number[], seed = 0): number {
  const blocks = bytes.length & ~3;

  let hash = seed >>> 0;

  for (let i = 0; i < blocks; i += 4) {
    let k =
      (bytes[i] as number) |
      ((bytes[i + 1] as number) << 8) |
      ((bytes[i + 2] as number) << 16) |
      ((bytes[i + 3] as number) << 24);

    k = Math.imul(k, C1);
    k = rotl32(k, 15);
    k = Math.imul(k, C2);

    hash ^= k;
    hash = rotl32(hash, 13);
    hash = (Math.imul(hash, 5) + 0xe6546b64) | 0;
  }

  // The reference implementation writes the tail as a fallthrough switch.
  // `noFallthroughCasesInSwitch` is on here, so it is spelled as the loop it is.
  const remaining = bytes.length & 3;
  if (remaining > 0) {
    let tail = 0;
    for (let i = remaining - 1; i >= 0; i--) {
      tail ^= (bytes[blocks + i] as number) << (8 * i);
    }
    tail = Math.imul(tail, C1);
    tail = rotl32(tail, 15);
    tail = Math.imul(tail, C2);
    hash ^= tail;
  }

  hash ^= bytes.length;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return hash >>> 0;
}

/** MurmurHash3, x86 32-bit, over the UTF-8 bytes of `input`. */
export function murmur3(input: string, seed = 0): number {
  return murmur3Bytes(utf8(input), seed);
}

/**
 * The bucket `value` falls in for a rollout seeded with `seed`, in [0, 1).
 *
 * 2^32 buckets, and independent of any percentage, which is what makes raising
 * one purely additive.
 */
export function bucketOf(value: string, seed: string): number {
  return murmur3(encodePair(seed, value)) / TWO_32;
}

/**
 * Whether `bucket` is inside a `percent` rollout.
 *
 * Strictly below the threshold, so 0% includes nobody; every bucket is below 1,
 * so 100% includes everybody.
 *
 * The threshold lives here and not in `inRollout` because `evaluateRule`
 * reports the bucket on `RuleOutcome.rollout.bucket` and needs the comparison
 * against a bucket it already holds. Two copies of the comparison are two
 * places a port can be told different things.
 */
export function admits(bucket: number, percent: number): boolean {
  if (!(percent > 0)) return false;
  if (percent >= 100) return true;
  return bucket * 100 < percent;
}

/** Whether `value` is inside a `percent` rollout seeded with `seed`. */
export function inRollout(
  value: string,
  percent: number,
  seed: string,
): boolean {
  return admits(bucketOf(value, seed), percent);
}
