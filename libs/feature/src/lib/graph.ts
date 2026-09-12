import {
  DuplicateFeatureError,
  FeatureCycleError,
  UnknownDependencyError,
} from './errors.js';
import type { FeatureDefinition, FeatureKey } from './types.js';

export interface FeatureGraph<F extends FeatureKey> {
  /**
   * Every key, ordered so a feature always follows the features it depends on.
   *
   * This ordering is what makes the cascade transitive. The 2022 sketch folded
   * over the features in declaration order and read each parent's stored
   * `active` rather than its computed result, so a chain A -> B -> C never
   * cascaded past one level. Resolving in this order means a parent's result
   * always exists by the time its dependants are evaluated, for a chain of any
   * depth.
   */
  readonly order: readonly F[];
  /** Transitive dependants of `key`, in dependency order. */
  dependants(key: F): readonly F[];
}

/**
 * Validates the dependency graph and returns a resolution order.
 *
 * Throws on a duplicate key, a dependency on an unconfigured feature, or a
 * cycle. All three are configuration errors, and all three are rejected here
 * rather than at evaluation.
 */
export function buildGraph<F extends FeatureKey>(
  definitions: readonly FeatureDefinition<F>[],
): FeatureGraph<F> {
  const parents = new Map<F, readonly F[]>();

  for (const definition of definitions) {
    if (parents.has(definition.key)) {
      throw new DuplicateFeatureError(definition.key);
    }
    parents.set(definition.key, definition.dependsOn ?? []);
  }

  for (const [key, dependsOn] of parents) {
    for (const parent of dependsOn) {
      if (!parents.has(parent)) {
        throw new UnknownDependencyError(key, parent);
      }
    }
  }

  const order: F[] = [];
  const finished = new Set<F>();
  const onPath = new Set<F>();
  const path: F[] = [];

  const visit = (key: F): void => {
    if (finished.has(key)) return;
    if (onPath.has(key)) {
      // Trim the walk to the cycle itself and close it, so the message shows
      // the edge that closes the loop rather than the route taken to reach it.
      const start = path.indexOf(key);
      throw new FeatureCycleError([...path.slice(start), key]);
    }

    onPath.add(key);
    path.push(key);
    for (const parent of parents.get(key) ?? []) visit(parent);
    path.pop();
    onPath.delete(key);

    finished.add(key);
    order.push(key);
  };

  for (const key of parents.keys()) visit(key);

  const position = new Map<F, number>(order.map((key, i) => [key, i]));
  const children = new Map<F, F[]>(order.map((key) => [key, []]));
  for (const [key, dependsOn] of parents) {
    for (const parent of dependsOn) children.get(parent)?.push(key);
  }

  const dependants = (key: F): readonly F[] => {
    const seen = new Set<F>();
    const queue = [...(children.get(key) ?? [])];

    while (queue.length) {
      const next = queue.shift() as F;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(...(children.get(next) ?? []));
    }

    return [...seen].sort(
      (a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0),
    );
  };

  return { order, dependants };
}
