import {
  DuplicateFeatureError,
  FeatureConfigError,
  FeatureCycleError,
  UnknownDependencyError,
} from './errors.js';
import type { FeatureDefinition, FeatureKey } from './types.js';

export interface FeatureGraph<F extends FeatureKey> {
  /**
   * Every key, ordered so a feature always follows the features it depends on.
   *
   * This ordering is what makes the cascade transitive: a parent's *resolved*
   * decision exists by the time any dependant is evaluated, for a chain of any
   * depth. Evaluating in declaration order instead leaves a dependant with no
   * resolved parent to read, and falling back to the parent's stored `enabled`
   * cascades exactly one level -- `docs/specs/2026-09-11-feature-toggles.md`,
   * "Cascade".
   */
  readonly order: readonly F[];
  /** Transitive dependants of `key`, in dependency order. */
  dependants(key: F): readonly F[];
}

/**
 * Every configuration error in the dependency graph, in document order.
 *
 * `buildGraph` throws the first of these and `validateConfig` reports all of
 * them, so the two paths differ only in what they do with the list. One
 * producer of the error objects means one message for each defect, whether a
 * TypeScript author reads it in a stack trace or an operator reads it in a
 * console.
 *
 * The cycle walk records a closing edge and marks the node finished, and it
 * does not stop, so a document with two independent cycles reports both and the
 * walk still terminates.
 *
 * Every definition arrives as an object and its `dependsOn` as an array.
 * `collectIssues` refuses a document that carries either as something else
 * before it reaches this walk, which is what keeps a `dependsOn` of `"ab"` from
 * reading as two dependencies and one cycle.
 */
export function graphErrors<F extends FeatureKey>(
  definitions: readonly FeatureDefinition<F>[],
): readonly FeatureConfigError[] {
  const found: FeatureConfigError[] = [];
  const parents = new Map<F, readonly F[]>();

  for (const definition of definitions) {
    if (parents.has(definition.key)) {
      found.push(new DuplicateFeatureError(definition.key));
      continue;
    }
    parents.set(definition.key, definition.dependsOn ?? []);
  }

  for (const [key, dependsOn] of parents) {
    for (const parent of dependsOn) {
      if (!parents.has(parent)) {
        found.push(new UnknownDependencyError(key, parent));
      }
    }
  }

  const finished = new Set<F>();
  const onPath = new Set<F>();
  const path: F[] = [];

  const visit = (key: F): void => {
    if (finished.has(key)) return;
    if (onPath.has(key)) {
      // Trim the walk to the cycle itself and close it, so the message shows
      // the edge that closes the loop rather than the route taken to reach it.
      const start = path.indexOf(key);
      found.push(new FeatureCycleError([...path.slice(start), key]));
      return;
    }

    onPath.add(key);
    path.push(key);
    for (const parent of parents.get(key) ?? []) visit(parent);
    path.pop();
    onPath.delete(key);

    finished.add(key);
  };

  for (const key of parents.keys()) visit(key);

  return found;
}

/**
 * Validates the dependency graph and returns a resolution order.
 *
 * Throws on a duplicate key, a dependency on an unconfigured feature, or a
 * cycle. All three are configuration errors, and all three are rejected here
 * rather than at evaluation. `graphErrors` finds them and this function throws
 * the first, so a caller reading a stack trace and a caller reading
 * `validateConfig`'s issues read one message.
 */
export function buildGraph<F extends FeatureKey>(
  definitions: readonly FeatureDefinition<F>[],
): FeatureGraph<F> {
  const found = graphErrors(definitions);
  if (found[0]) throw found[0];

  const parents = new Map<F, readonly F[]>(
    definitions.map((definition) => [
      definition.key,
      definition.dependsOn ?? [],
    ]),
  );

  const order: F[] = [];
  const finished = new Set<F>();
  const onPath = new Set<F>();

  const visit = (key: F): void => {
    if (finished.has(key)) return;
    // `graphErrors` has already refused every cycle, so this guard fires for no
    // input `buildGraph` accepts. A caller reaching the walk another way would
    // otherwise recurse until the stack ends.
    if (onPath.has(key)) return;

    onPath.add(key);
    for (const parent of parents.get(key) ?? []) visit(parent);
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
