import { conditionReadsObject } from './conditions.js';
import type { Permission, Rule } from './types.js';

function rulesReadObject(rules: readonly Rule[] | undefined): boolean {
  return (rules ?? []).some((rule) =>
    (rule.when ?? []).some(conditionReadsObject),
  );
}

/**
 * Whether one permission's own conditions read the `object` scope.
 *
 * Both sides count. A deny rule that reads `object.*` decides the permission
 * exactly as an allow rule does -- an unreadable deny outranks a matching
 * allow -- so a permission whose only object-dependence is a deny still cannot
 * be decided without the row.
 *
 * Field rules are not counted. A `transitions` config reads the current value
 * off the object, but that is the `canFields` write axis, and a caller on that
 * path holds the row already. This answers the action-level question `can`
 * asks.
 */
export function permissionReadsObject(permission: Permission): boolean {
  return (
    rulesReadObject(permission.rules) || rulesReadObject(permission.denyRules)
  );
}

/**
 * Whether each permission needs the object row to reach a decision, keyed by
 * permission key.
 *
 * Transitive over `dependsOn`: a child whose parent reads `object.*` cannot be
 * decided without the row either, because the cascade evaluates the ancestor
 * against the same context and an ancestor left unevaluable carries the child
 * with it. `order` is the graph's dependency order, so every parent is settled
 * before the child reads it and one forward pass closes the transitive set.
 */
export function buildReadsObject(
  permissions: readonly Permission[],
  order: readonly string[],
): ReadonlyMap<string, boolean> {
  const index = new Map(permissions.map((p) => [p.key, p]));
  const reads = new Map<string, boolean>();
  for (const key of order) {
    const permission = index.get(key);
    if (!permission) continue;
    reads.set(
      key,
      permissionReadsObject(permission) ||
        (permission.dependsOn ?? []).some(
          (parent) => reads.get(parent) === true,
        ),
    );
  }
  return reads;
}
