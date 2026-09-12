import { decide, planFeature } from './evaluate.js';
import { buildGraph } from './graph.js';
import type {
  Decision,
  Decisions,
  EvaluationContext,
  FeatureDefinition,
  FeatureKey,
  Plan,
  PlanEntry,
  ToggleResult,
} from './types.js';

/**
 * The store. It holds intent -- `enabled`, dependencies and rules -- and nothing
 * evaluated.
 *
 * The only writers are `toggle` and editing the configuration. `resolve` and
 * `plan` are pure functions of `(config, context, now)`. Writing a resolved
 * value back would put entries in an audit log that nobody performed, make the
 * store disagree between a process that slept through a window boundary and one
 * that did not, and destroy the distinction between "someone turned this off"
 * and "the system turned it off" -- the one an operator needs at 3am.
 */
export interface Features<F extends FeatureKey = string> {
  /** Every key, in the order the definitions were supplied. */
  readonly keys: readonly F[];
  /** The stored intent, deeply frozen, in the order it was supplied. */
  readonly config: readonly FeatureDefinition<F>[];
  definition(key: F): FeatureDefinition<F> | undefined;
  /** Transitive dependants of `key`, in dependency order. */
  dependants(key: F): readonly F[];
  /** Resolves every feature for one context. Writes nothing. */
  resolve(context?: EvaluationContext): Decisions<F>;
  isEnabled(key: F, context?: EvaluationContext): boolean;
  /**
   * Partitions every feature into resolvable now and deferred, for build-time
   * evaluation. One engine, not a second code path: the resolvable cases go
   * through the same `decide` as `resolve`.
   */
  plan(context?: EvaluationContext): Plan<F>;
  /**
   * Writes intent, and reports which dependants go off with it.
   *
   * Dependencies cascade one way only, so there is no upward blocking -- but the
   * information that blocking existed to provide is kept: a UI can confirm
   * before applying, a script can ignore it.
   */
  toggle(key: F, enabled: boolean, context?: EvaluationContext): ToggleResult<F>;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

/**
 * Creates a feature store from its configuration.
 *
 * Validates the dependency graph here rather than at evaluation: a cycle, a
 * dependency on a feature that does not exist and a duplicate key are all
 * configuration errors, and a cycle has no defined resolution order at all.
 * Checking at use is the mistake `@evanion/luhn` made with its alphabet.
 */
export function createFeatures<F extends FeatureKey>(
  definitions: readonly FeatureDefinition<F>[],
): Features<F> {
  // Cloned so the store cannot be edited behind its own back, then frozen so an
  // attempt to do so fails loudly instead of silently diverging from what was
  // resolved.
  const config: FeatureDefinition<F>[] = definitions.map((definition) =>
    deepFreeze(structuredClone(definition)),
  );
  const graph = buildGraph(config);
  const index = new Map<F, number>(config.map((d, i) => [d.key, i]));
  const keys = config.map((definition) => definition.key);

  const definitionOf = (key: F): FeatureDefinition<F> | undefined => {
    const at = index.get(key);
    return at === undefined ? undefined : config[at];
  };

  const withNow = (context: EvaluationContext = {}): EvaluationContext => ({
    ...context,
    now: context.now ?? new Date(),
  });

  const resolve = (context?: EvaluationContext): Decisions<F> => {
    const evaluationContext = withNow(context);
    const resolved = new Map<F, Decision<F>>();

    // Dependency order, so a parent's *resolved* value exists before any
    // dependant reads it. This is what makes the cascade transitive through a
    // chain of any depth.
    for (const key of graph.order) {
      const definition = definitionOf(key);
      if (!definition) continue;
      resolved.set(key, decide(definition, evaluationContext, resolved));
    }

    // Record<F, ...> cannot be built incrementally without a cast; the keys are
    // exactly `keys`, which are F by construction.
    return Object.fromEntries(resolved) as Decisions<F>;
  };

  const plan = (context?: EvaluationContext): Plan<F> => {
    const evaluationContext = withNow(context);
    const plans = new Map<F, PlanEntry<F>>();
    const resolved = new Map<F, Decision<F>>();

    for (const key of graph.order) {
      const definition = definitionOf(key);
      if (!definition) continue;
      const entry = planFeature(
        definition,
        evaluationContext,
        plans,
        resolved,
      );
      plans.set(key, entry);
      if (entry.decision) resolved.set(key, entry.decision);
    }

    return Object.fromEntries(plans) as Plan<F>;
  };

  const toggle = (
    key: F,
    enabled: boolean,
    context?: EvaluationContext,
  ): ToggleResult<F> => {
    const at = index.get(key);
    const current = at === undefined ? undefined : config[at];
    if (at === undefined || !current) {
      return { ok: false, key, error: 'unknown-feature' };
    }

    // One context for both sides of the comparison, so `willDisable` is not an
    // artefact of the clock moving between the two evaluations.
    const evaluationContext = withNow(context);
    const before = resolve(evaluationContext);

    config[at] = deepFreeze({ ...current, enabled });

    const after = resolve(evaluationContext);
    const willDisable = graph
      .dependants(key)
      .filter(
        (dependant) =>
          before[dependant].enabled && !after[dependant].enabled,
      );

    return { ok: true, key, enabled, willDisable };
  };

  return {
    keys,
    get config() {
      return config as readonly FeatureDefinition<F>[];
    },
    definition: definitionOf,
    dependants: graph.dependants,
    resolve,
    isEnabled: (key, context) => resolve(context)[key]?.enabled ?? false,
    plan,
    toggle,
  };
}
