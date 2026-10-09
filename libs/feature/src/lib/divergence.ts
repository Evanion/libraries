import type { FeatureKey } from './types.js';

/** One side of a comparison, at the members a report names. */
export interface DivergenceSide {
  version?: string | number;
  enabled?: boolean;
  variant?: string;
  source?: 'weighted' | 'pinned' | 'sticky' | 'fallback';
}

/**
 * What a process could not reproduce, and why. Output only.
 *
 * Nothing in the library reads a report back, which is the invariant
 * `reason-is-output-only.spec.ts` already holds for `reason`. A report names
 * the feature at `key` when one feature is at fault, and the context field at
 * `field` on a `'missing-field'` report.
 */
export interface DivergenceReport<F extends FeatureKey = string> {
  kind: 'config-version' | 'unversioned' | 'missing-field' | 'decision-differs';
  key?: F;
  field?: string;
  shipped?: DivergenceSide;
  local?: DivergenceSide;
  /** One sentence naming the cause and the fix. */
  message: string;
}

/** What a caller installs to hear about divergence. */
export type DivergenceObserver<F extends FeatureKey = string> = (
  report: DivergenceReport<F>,
) => void;

/**
 * Calls `observer` and discards whatever it throws.
 *
 * An observer that takes down a render is worse than the divergence it was
 * reporting, so the raise stops here and the caller carries on with the
 * decisions it already computed.
 */
export function reportDivergence<F extends FeatureKey>(
  observer: DivergenceObserver<F> | undefined,
  report: DivergenceReport<F>,
): void {
  if (!observer) return;
  try {
    observer(report);
  } catch {
    return;
  }
}
