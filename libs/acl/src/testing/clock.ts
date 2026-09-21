import { settleNow } from '../conditions.js';
import {
  InvalidFreshnessError,
  MissingFreshnessBudgetError,
} from '../errors.js';
import type { AccessOptions } from '../hydrate-policy.js';
import type { Instant, Matrix } from '../types.js';

/** What a holder reports about its own freshness, as a test states it. */
export interface FixtureClockOptions {
  /**
   * The instant this holder last validated the document. Defaults to the wall
   * clock, settled once when the clock is made.
   */
  fetchedAt?: Instant;
  /** A local ceiling on staleness, in milliseconds, `min`-ed with the document's. */
  maxStale?: number;
}

/**
 * The two instants that bracket a document's freshness budget, and the options
 * that produced them.
 */
export interface FixtureClock {
  /** The validation instant, as epoch milliseconds. */
  readonly fetchedAt: number;
  /** `min(matrix.maxStale, options.maxStale)`, in milliseconds. */
  readonly budget: number;
  /** `fetchedAt + budget`. The engine refuses strictly past this. */
  readonly expiresAt: number;
  /** The last instant every key still decides on. Equals `expiresAt`. */
  readonly fresh: number;
  /** The first instant every key answers `stale-contract`. */
  readonly stale: number;
  /**
   * The `AccessOptions` this clock describes, for `hydratePolicy` or
   * `parseMatrix`. The same two numbers the instants were derived from, so the
   * holder and the test cannot disagree about the budget.
   */
  readonly options: AccessOptions;
  /** An arbitrary instant, `ms` after the validation instant. */
  at(ms: number): number;
}

/**
 * The freshness boundary of a document, computed the way the engine computes it.
 *
 * `stale-contract` is the refusal a consumer's UI meets in production and never
 * in development, because a document authored in-process reports no `fetchedAt`
 * and runs under no bound. Reaching it in a test means passing an instant past
 * `fetchedAt + min(matrix.maxStale, options.maxStale)`, which every entry point
 * already accepts as its last argument. This states that instant by name.
 *
 * The two bounds are exact. `hydratePolicy` refuses on `settled > expiresAt`, so
 * `fresh` is the last instant that decides and `stale` is the first that does
 * not, and a test naming both covers the boundary rather than a point near it.
 *
 * Every argument is validated as `hydratePolicy` validates it, so a document
 * stating no `maxStale` raises `MissingFreshnessBudgetError` here instead of at
 * the construction the test was about to write.
 */
export function fixtureClock(
  matrix: Matrix,
  options: FixtureClockOptions = {},
): FixtureClock {
  const fetchedAt = settleNow(options.fetchedAt);
  if (Number.isNaN(fetchedAt)) {
    throw new InvalidFreshnessError('fetchedAt', 'is not an instant');
  }

  const local = options.maxStale;
  if (local !== undefined && (!Number.isFinite(local) || local < 0)) {
    throw new InvalidFreshnessError(
      'maxStale',
      'is not a finite, non-negative number of milliseconds',
    );
  }

  if (matrix.maxStale === undefined) throw new MissingFreshnessBudgetError();

  const budget = Math.min(matrix.maxStale, local ?? Infinity);
  const expiresAt = fetchedAt + budget;

  return {
    fetchedAt,
    budget,
    expiresAt,
    fresh: expiresAt,
    stale: expiresAt + 1,
    options:
      local === undefined ? { fetchedAt } : { fetchedAt, maxStale: local },
    at: (ms: number) => fetchedAt + ms,
  };
}
