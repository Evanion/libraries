/**
 * The seeded generator the property tests draw from.
 *
 * Seeded, so a counterexample is a number a reader can put back rather than a
 * rerun that may or may not reach the same case.
 */

/** mulberry32: a small seeded PRNG. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Gen {
  constructor(private readonly next: () => number) {}

  int(bound: number): number {
    return Math.floor(this.next() * bound);
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  pick<T>(values: readonly T[]): T {
    return values[this.int(values.length)] as T;
  }

  list<T>(max: number, make: (index: number) => T): T[] {
    return Array.from({ length: this.int(max + 1) }, (_, i) => make(i));
  }
}
