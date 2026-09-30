import { murmur3 } from './bucketing.js';
import { canonical } from './canonical.js';
import type { FeatureConfig } from './config.js';

/**
 * Four fixed seeds, which widen a 32-bit hash to a 128-bit digest.
 *
 * One `murmur3` word is 8 hex characters, and a comparison whose whole job is
 * to detect a difference between two documents deserves more than that. The
 * values are the murmur3 reference suite's seeds and two constants from the
 * same family, and nothing in the library derives meaning from them beyond
 * being four distinct 32-bit numbers every implementation can copy.
 */
const SEEDS: readonly number[] = [
  0x00000000, 0x9747b28c, 0x2f1e3d4c, 0xb7e15163,
];

/**
 * A hex digest over the canonical text of a document.
 *
 * `canonical` in this package sorts object keys, preserves array order, drops
 * `undefined` properties and writes a `Date` the way `JSON.stringify` writes
 * one. Two documents differing in key order or in whitespace state one
 * configuration, and a digest over raw bytes would change when nothing did.
 *
 * `digest` is removed from the input before the text is taken. `digest` is
 * always this function's answer for the document that carries it, so a digest
 * computed over a document that already held one could never be recomputed by
 * a holder, and every verification would fail.
 *
 * Two processes computing one digest from documents they fetched separately
 * have proved they hold the same configuration, which is what condition 2 of
 * the variants spec's determinism section asks for. The comparison holds across
 * a JSON hop because `serializeConfig` converts every `Date` first.
 *
 * Not a cryptographic digest. No security property rests on the difficulty of
 * finding a second document that hashes the same, and Web Crypto's `digest`
 * returns a promise, which no synchronous entry point here can await.
 */
export function configDigest(config: FeatureConfig): string {
  const body: Record<string, unknown> = { ...config };
  delete body['digest'];
  const text = canonical(body);
  return SEEDS.map((seed) =>
    murmur3(text, seed).toString(16).padStart(8, '0'),
  ).join('');
}
