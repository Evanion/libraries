import { isThenable } from './thenable.js';
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
 * Calls `observer` and discards whatever it raises or rejects with.
 *
 * An observer that takes down a render is worse than the divergence it was
 * reporting, so the raise stops here and the caller carries on with the
 * decisions it already computed.
 *
 * `DivergenceObserver` answers `void`, and the compiler accepts a function
 * answering anything where a `void` answer is expected, so a caller can
 * install `async (report) => { await post(report); }`. Nothing on this frame
 * catches that function's rejection, and Node terminates a process over an
 * unhandled rejection, so a thenable answer gets a rejection handler that
 * discards the reason. `createEmitter` reads an observer's answer the same way
 * and routes the failure to `onObserveError`.
 * `docs/specs/2026-09-23-feature-observation-seam.md` owns the handler that
 * gives a divergence observer the same route.
 */
export function reportDivergence<F extends FeatureKey>(
  observer: DivergenceObserver<F> | undefined,
  report: DivergenceReport<F>,
): void {
  if (!observer) return;
  try {
    const answered: unknown = observer(report);
    if (isThenable(answered)) {
      answered.then(undefined, () => {
        // The observer's rejection stops here, as its raise does.
      });
    }
  } catch {
    return;
  }
}
