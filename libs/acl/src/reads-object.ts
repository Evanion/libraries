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
