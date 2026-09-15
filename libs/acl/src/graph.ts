import {
  DuplicatePermissionError,
  FeatureCycleError,
  UnknownDependencyError,
} from './errors.js';
import type { Permission } from './types.js';

export interface PermissionGraph {
  /** Every key, ordered so a permission always follows its dependencies. */
  readonly order: readonly string[];
  /** Transitive dependants of `key`, in dependency order. */
  dependants(key: string): readonly string[];
}

/**
 * Validates the dependency graph and returns a resolution order.
 *
 * Throws on a duplicate key, a dependency on an unconfigured permission, or a
 * cycle. All three are configuration errors, and all three are rejected here
 * rather than at evaluation.
 */
export function buildGraph(
  permissions: readonly Permission[],
): PermissionGraph {
  const parents = new Map<string, readonly string[]>();

  for (const permission of permissions) {
    if (parents.has(permission.key)) {
      throw new DuplicatePermissionError(permission.key);
    }
    parents.set(permission.key, permission.dependsOn ?? []);
  }

  for (const [key, dependsOn] of parents) {
    for (const parent of dependsOn) {
      if (!parents.has(parent)) {
        throw new UnknownDependencyError(key, parent);
      }
    }
  }

  const order: string[] = [];
  const finished = new Set<string>();
  const onPath = new Set<string>();
  const path: string[] = [];

  const visit = (key: string): void => {
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

  const position = new Map<string, number>(order.map((k, i) => [k, i]));
  const children = new Map<string, string[]>(order.map((key) => [key, []]));
  for (const [key, dependsOn] of parents) {
    for (const parent of dependsOn) children.get(parent)?.push(key);
  }

  const dependants = (key: string): readonly string[] => {
    const seen = new Set<string>();
    const queue = [...(children.get(key) ?? [])];

    while (queue.length) {
      const next = queue.shift() as string;
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
