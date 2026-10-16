import { contextEpoch } from './instant.js';
import type { DecisionSet, SnapshotOptions } from './decision-set.js';
import type { Features } from './features.js';
import type { FrozenWhenObserved } from './observe.js';
import type {
  Decisions,
  EvaluationContext,
  FeatureKey,
  Plan,
  Schema,
  VariantInfo,
} from './types.js';

/**
 * One context's answers, with the instant settled once.
 *
 * `features.for(context)` returns it. Every method asks the store the question
 * the same-named member of `Features` asks, with the context and the instant
 * already supplied, so a service deep in a call graph holds this and names no
 * context at its call sites. `@evanion/acl`'s `authorize(subject)` binds a
 * subject the same way at `libs/acl/src/hydrate-policy.ts:275`.
 *
 * It carries no `toggle`, because a toggle writes intent for every caller and
 * asks nothing about one context.
 *
 * It memoises nothing. A `toggle` or a `reload` between two calls on one handle
 * is visible through the second, because the store's truth is the store's and a
 * handle that cached decisions would answer from a document the store no longer
 * holds.
 */
export interface BoundFeatures<
  S extends Record<keyof S, VariantInfo | never> = Schema,
  Frozen extends boolean = boolean,
> {
  /** The context every method resolves against, with `now` settled. */
  readonly context: EvaluationContext;
  /** What `Features.resolve` answers for the bound context. */
  resolve(): FrozenWhenObserved<Frozen, Decisions<S>>;
  /** What `Features.isEnabled` answers for the bound context. */
  isEnabled(key: keyof S & FeatureKey): boolean;
  /** What `Features.variantOf` answers for the bound context. */
  variantOf<K extends keyof S>(
    key: K,
  ): Decisions<S>[K] extends { variant?: infer V } ? V | undefined : undefined;
  /** What `Features.valueOf` answers for the bound context. */
  valueOf<K extends keyof S>(
    key: K,
  ): Decisions<S>[K] extends { value?: infer T } ? T | undefined : undefined;
  /** What `Features.plan` answers for the bound context. */
  plan(): FrozenWhenObserved<Frozen, Plan<S>>;
  /** What `Features.snapshot` answers for the bound context. */
  snapshot(options?: SnapshotOptions): DecisionSet<S, Frozen>;
}

/**
 * Binds `features` to `context`, reading `context.now ?? new Date()` once.
 *
 * An explicit `now` wins, the precedence `resolve` has. An invalid `Date` is
 * kept as given, and a `now` naming no instant in another form settles to one,
 * so `snapshot` on the handle raises the refusal `Features.snapshot` raises for
 * it.
 */
export function boundFeatures<
  S extends Record<keyof S, VariantInfo | never>,
  Frozen extends boolean,
>(
  features: Features<S, Frozen>,
  context?: EvaluationContext,
): BoundFeatures<S, Frozen> {
  const settled: EvaluationContext = {
    ...context,
    now:
      context?.now === undefined
        ? new Date()
        : new Date(contextEpoch(context.now)),
  };

  return {
    context: settled,
    resolve: () => features.resolve(settled),
    isEnabled: (key) => features.isEnabled(key, settled),
    variantOf: (key) => features.variantOf(key, settled),
    valueOf: (key) => features.valueOf(key, settled),
    plan: () => features.plan(settled),
    snapshot: (options) => features.snapshot(settled, options),
  };
}
