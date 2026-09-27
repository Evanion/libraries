'use client';

/**
 * The React adapter: a provider and three hooks over an already-built store.
 *
 * This is its own entry (`@evanion/feature/react`) and its own module for one
 * reason: `'use client'` is a per-module directive, and a bundle is one module.
 * `@evanion/react-widget` hit the same constraint from the other side -- its
 * answer was to have no client code at all, while this layer genuinely is client
 * code -- so the package is emitted file-per-file by `tsc` and the core entry
 * stays free of both the directive and any React import.
 *
 * Evaluation itself lives in the core. Nothing here decides anything.
 */

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Features } from '../lib/features.js';
import type {
  Decision,
  Decisions,
  EvaluationContext,
  FeatureKey,
  VariantInfo,
} from '../lib/types.js';

interface FeatureContextValue {
  decisions: Record<FeatureKey, Decision<FeatureKey>>;
}

const FeatureContext = createContext<FeatureContextValue | null>(null);

export interface FeatureProviderProps<
  S extends Record<keyof S, VariantInfo | never>,
> {
  features: Features<S>;
  /**
   * The evaluation context. Resolution is memoised on this object's identity, so
   * pass a stable reference -- an object literal written inline re-resolves on
   * every render.
   *
   * Leaving `now` out means "the clock at the moment this context was first
   * resolved". A component tree that must agree with a server render should pass
   * `now` explicitly.
   */
  context?: EvaluationContext;
  /**
   * Decisions resolved elsewhere -- a server render, or the build-time snapshot
   * from `plan()`. Supplied decisions are used as they are; `features` and
   * `context` are then only a fallback for what the snapshot does not cover.
   */
  decisions?: Decisions<S>;
  children?: ReactNode;
}

export function FeatureProvider<
  S extends Record<keyof S, VariantInfo | never>,
>({ features, context, decisions, children }: FeatureProviderProps<S>) {
  const value = useMemo<FeatureContextValue>(
    () => ({
      decisions: (decisions ?? features.resolve(context)) as unknown as Record<
        FeatureKey,
        Decision<FeatureKey>
      >,
    }),
    [features, context, decisions],
  );

  return (
    <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>
  );
}

/** Every resolved decision. */
export function useFeatures<F extends FeatureKey = string>(): Record<
  F,
  Decision<F>
> {
  const value = useContext(FeatureContext);
  if (!value) {
    throw new Error(
      'useFeatures must be called inside a <FeatureProvider> (from @evanion/feature/react)',
    );
  }
  return value.decisions as Record<F, Decision<F>>;
}

/**
 * One feature's decision, explanation included.
 *
 * Throws for a key that is not configured. A silent `false` would make a typo
 * indistinguishable from a feature that is off, which is the failure mode flag
 * systems are worst at.
 */
export function useFeature<F extends FeatureKey = string>(key: F): Decision<F> {
  const decisions = useFeatures<F>();
  // A bare index walks the prototype chain, so a key of `constructor` or
  // `toString` resolves to a function off `Object.prototype` and passes the
  // configured check below as a decision object.
  const decision = Object.prototype.hasOwnProperty.call(decisions, key)
    ? decisions[key]
    : undefined;
  if (!decision) {
    throw new Error(
      `feature "${String(key)}" is not configured in this <FeatureProvider>`,
    );
  }
  return decision;
}

/** One feature's decision as a boolean. */
export function useFeatureEnabled<F extends FeatureKey = string>(
  key: F,
): boolean {
  return useFeature<F>(key).enabled;
}

/**
 * One feature's assigned variant and its value.
 *
 * A reader over the decision `useFeature` already returns. Both are absent for
 * a feature that resolved off and for a feature declaring no variants, so
 * calling code handles off before it switches on a name.
 *
 * Throws for a key the provider does not carry, which `useFeature` does for the
 * same reason: a silent `undefined` would make a typo indistinguishable from a
 * feature nobody assigned.
 */
export function useVariant<F extends FeatureKey = string>(
  key: F,
): { variant?: string; value?: unknown } {
  const decision = useFeature<F>(key);
  return { variant: decision.variant, value: decision.value };
}
