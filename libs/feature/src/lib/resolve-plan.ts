import { decide, withVariant } from './evaluate.js';
import { buildGraph } from './graph.js';
import { assignVariant } from './variants.js';
import { reportDivergence } from './divergence.js';
import type { DivergenceObserver } from './divergence.js';
import type { DeepReadonly } from './observe.js';
import type {
  Decision,
  Decisions,
  EvaluationContext,
  FeatureDefinition,
  FeatureKey,
  Plan,
  PlanEntry,
  VariantInfo,
} from './types.js';
import type { Features } from './features.js';

/** What a caller passes `resolvePlan` beyond the plan itself. */
export interface ResolvePlanOptions<F extends FeatureKey = string> {
  /**
   * The instant to resolve the deferred remainder at.
   *
   * A `DecisionSet` carrying `origin: 'render'` states an instant seconds old,
   * and a caller passes it here so a window boundary between the server's
   * instant and the client's call cannot move half the tree. A set carrying
   * `origin: 'build'` states one that may be days old, and that caller passes
   * nothing, so this reads the client's own clock.
   */
  now?: Date;
  onDivergence?: DivergenceObserver<F>;
}

/**
 * Turns a build-time plan plus a client context into a full decision set.
 *
 * Three rules, one per kind of entry. A boolean `resolved` carrying a decision
 * is the answer and nothing re-runs, because the build already decided and a
 * client that re-decides throws away the point of planning. A `'deferred'`
 * entry carrying no decision goes through `decide` against the client context.
 * A `'deferred'` entry carrying a decision has its enablement settled and its
 * variant outstanding, so the enablement comes off the entry and only the
 * assignment is computed; a second run of the rules against a richer client
 * context can flip enablement, which would contradict the entry.
 *
 * The walk is the dependency order, because a deferred parent puts its `needs`
 * on its dependants and a dependant resolved before its parent would read an
 * empty parent map.
 */
export function resolvePlan<S extends Record<keyof S, VariantInfo | never>>(
  features: Features<S>,
  plan: Partial<Plan<S>> | DeepReadonly<Partial<Plan<S>>>,
  context?: EvaluationContext,
  options?: ResolvePlanOptions<keyof S & FeatureKey>,
): Decisions<S> {
  const entries = plan as Record<FeatureKey, PlanEntry<FeatureKey>>;
  const observer = options?.onDivergence as
    DivergenceObserver<FeatureKey> | undefined;
  const settled: EvaluationContext = {
    ...context,
    now: context?.now ?? options?.now ?? new Date(),
  };

  const resolved = new Map<FeatureKey, Decision<FeatureKey>>();
  const held = features.config;
  const definitions = new Map<FeatureKey, FeatureDefinition<FeatureKey>>(
    held.map((definition) => [definition.key, definition]),
  );

  for (const key of buildGraph(held).order) {
    const definition = definitions.get(key);
    if (!definition) continue;
    // A bare index walks the prototype chain, so a plan keyed `constructor`
    // reads a function off `Object.prototype`.
    const entry = Object.prototype.hasOwnProperty.call(entries, key)
      ? entries[key]
      : undefined;

    // The plan does not name this feature, so nothing about it is settled.
    if (!entry) {
      resolved.set(key, decide(definition, settled, resolved));
      continue;
    }

    // Rule 1. The build settled this one and nothing re-runs.
    if (entry.resolved !== 'deferred') {
      if (entry.decision) {
        resolved.set(key, entry.decision);
        continue;
      }
      resolved.set(key, decide(definition, settled, resolved));
      continue;
    }

    for (const field of entry.needs) {
      if (settled[field] !== undefined) continue;
      reportDivergence(observer, {
        kind: 'missing-field',
        key,
        field,
        message: `feature "${String(key)}": this plan deferred on "${field}" and this context carries none, so the engine falls back. Pass ${field} in the context you hand resolvePlan.`,
      });
    }

    // Rule 3. Enablement is settled and the variant alone is outstanding.
    if (entry.decision) {
      if (!entry.decision.enabled) {
        resolved.set(key, entry.decision);
        continue;
      }
      // The enablement alone comes off the entry. A hand-assembled plan or a
      // deserialized wire payload can carry an assignment under a deferred
      // entry, and `withVariant` writes `value` only when the variant it
      // assigns declares one, so a carried `value` would outlive the variant
      // it belongs to.
      const { variant, value, assignment, ...enablement } = entry.decision;
      resolved.set(
        key,
        withVariant(enablement, assignVariant(definition, settled)),
      );
      continue;
    }

    // Rule 2. Nothing about it is settled.
    resolved.set(key, decide(definition, settled, resolved));
  }

  return Object.fromEntries(resolved) as Decisions<S>;
}
