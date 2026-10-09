import type { FrozenWhenObserved } from './observe.js';
import type { Decisions, Schema, VariantInfo } from './types.js';

/** Where a decision set was produced. */
export type DecisionOrigin = 'render' | 'build';

/**
 * One subject's answers for one instant, with the configuration that produced
 * them.
 *
 * It crosses no service boundary. The process that produced it and the process
 * that consumes it are two halves of one page load, which is the line § 8 of
 * `docs/specs/2026-09-16-published-policy-contracts.md` draws between a
 * document and a decision.
 */
export interface DecisionSet<
  S extends Record<keyof S, VariantInfo | never> = Schema,
  Frozen extends boolean = boolean,
> {
  /**
   * The config version that produced these.
   *
   * Absent for a store built from a literal, which carries no version to
   * state. A consumer compares it with `!==` and orders nothing.
   */
  readonly version?: string | number;
  /** The instant they were resolved at, ISO 8601. */
  readonly now: string;
  /**
   * Where they came from.
   *
   * A `'render'` set came out of the request that produced the HTML, so its
   * instant is seconds old and every consumer reads it as the default for what
   * it resolves locally. A `'build'` set may be days old, so the consumer reads
   * its own clock for the remainder.
   */
  readonly origin: DecisionOrigin;
  readonly decisions: FrozenWhenObserved<Frozen, Decisions<S>>;
}

/** What a caller passes `Features.snapshot` beyond the context. */
export interface SnapshotOptions {
  /**
   * What the set states about where it came from. Defaults to `'render'`.
   *
   * A build pipeline that writes a set into a bundle passes `'build'`, because
   * it is the party that knows the instant it stated is not a request's.
   */
  readonly origin?: DecisionOrigin;
}
