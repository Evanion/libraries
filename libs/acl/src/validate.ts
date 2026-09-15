import {
  BangInAllowListError,
  DenyWithoutBaselineError,
  TargetsTransitionsConflictError,
} from './errors.js';
import type { Condition, FieldConfig, FieldRules, Matrix, Permission } from './types.js';

const OPS = new Set(['eq', 'ne', 'in', 'not-in', 'contains']);

function assertCondition(condition: Condition): void {
  if (condition.field === 'now') {
    if (condition.op !== 'before' && condition.op !== 'after') {
      throw new Error(`invalid condition: now supports before/after only`);
    }
    return;
  }
  const dot = condition.field.indexOf('.');
  const scope = dot === -1 ? condition.field : condition.field.slice(0, dot);
  if (scope !== 'subject' && scope !== 'object') {
    throw new Error(
      `invalid condition field "${condition.field}": must be subject.* or object.*`,
    );
  }
  if (!OPS.has(condition.op)) {
    throw new Error(`invalid condition op "${condition.op}"`);
  }
}

function assertFieldConfig(field: string, config: FieldConfig): void {
  if ('targets' in config && 'transitions' in config) {
    throw new TargetsTransitionsConflictError(field);
  }
}

function assertFieldRules(permission: Permission): void {
  const rules = permission.fields as FieldRules | undefined;
  if (!rules) return;

  const names = rules['fields'] as readonly string[] | undefined;
  if (names) {
    for (const name of names) {
      if (name.startsWith('!')) {
        // A deny entry requires a '*' baseline; and a deny mixed into an
        // explicit allow-list (which already denies anything not listed) is
        // refused. Both leave the intended allow-set undefined.
        if (!names.includes('*')) {
          if (names.length > 1) {
            throw new BangInAllowListError(name);
          }
          throw new DenyWithoutBaselineError(name);
        }
      }
    }
  }

  for (const [field, config] of Object.entries(rules)) {
    if (field === 'fields') continue;
    if (!config) continue;
    assertFieldConfig(field, config as FieldConfig);
  }
}

/**
 * Validates a canonical matrix's rules and field configs. The dependency graph
 * is validated separately by `buildGraph`. Throws AuthorizationConfigError.
 */
export function validateMatrix(matrix: Matrix): void {
  for (const permission of matrix) {
    for (const rule of [
      ...(permission.rules ?? []),
      ...(permission.denyRules ?? []),
    ]) {
      for (const condition of rule.when ?? []) {
        assertCondition(condition);
      }
    }
    assertFieldRules(permission);
  }
}
