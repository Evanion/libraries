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

  // An explicit stack rather than recursion: `dependsOn` comes from the matrix,
  // so the walk is as deep as a foreign matrix says, and the depth a runtime
  // gives a call stack is not the depth a matrix may declare. Each frame holds
  // the key and how far through its parents the walk has got.
  const visit = (root: string): void => {
    if (finished.has(root)) return;
    const stack: { key: string; at: number }[] = [{ key: root, at: 0 }];
    onPath.add(root);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1] as { key: string; at: number };
      const dependsOn = parents.get(frame.key) ?? [];

      if (frame.at < dependsOn.length) {
        const parent = dependsOn[frame.at++] as string;
        if (finished.has(parent)) continue;
        if (onPath.has(parent)) {
          // Trim the walk to the cycle itself and close it, so the message
          // shows the edge that closes the loop rather than the route taken to
          // reach it.
          const start = stack.findIndex((f) => f.key === parent);
          throw new FeatureCycleError([
            ...stack.slice(start).map((f) => f.key),
            parent,
          ]);
        }
        onPath.add(parent);
        stack.push({ key: parent, at: 0 });
        continue;
      }

      stack.pop();
      onPath.delete(frame.key);
      finished.add(frame.key);
      order.push(frame.key);
    }
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
      // Pushed one at a time: a spread is an argument list, and a matrix wide
      // enough makes that list longer than a call accepts.
      for (const child of children.get(next) ?? []) queue.push(child);
    }

    return [...seen].sort(
      (a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0),
    );
  };

  return { order, dependants };
}
