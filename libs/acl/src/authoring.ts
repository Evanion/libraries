import { createPolicy, type Access } from './create-policy.js';
import type { Condition, FieldRules, Permission, Rule } from './types.js';

/** A condition that is always true; serializes to an empty `when` array. */
export const always: readonly [] = [];

export type ConditionOrGroup = Condition | readonly Condition[];

function asRules(
  groups: readonly ConditionOrGroup[],
): readonly Rule[] {
  const rules: Rule[] = [];
  for (const group of groups) {
    if (Array.isArray(group)) {
      // A nested array (from `or(...)`) becomes separate rules; a flat array
      // (from `and(...)`) is one rule with several conditions.
      if (group.length && Array.isArray(group[0])) {
        for (const inner of group as readonly (readonly Condition[])[]) {
          rules.push({ when: inner });
        }
      } else {
        rules.push({ when: group as readonly Condition[] });
      }
    } else {
      rules.push({ when: [group as Condition] });
    }
  }
  return rules;
}

/** AND: conditions in one rule. */
export function and(
  ...groups: ConditionOrGroup[]
): readonly ConditionOrGroup[] {
  return groups.flatMap((g) =>
    Array.isArray(g) && !g.some((x) => Array.isArray(x)) ? g : [g],
  );
}

/** OR: each argument becomes its own rule. */
export function or(
  ...groups: ConditionOrGroup[]
): readonly (readonly ConditionOrGroup[])[] {
  return groups.map((g) => [g]);
}

/** Equality between two scopes or a scope and a literal. */
export function eq(field: string, other: string | unknown): Condition {
  return typeof other === 'string' && other.includes('.')
    ? { field, op: 'eq', path: other }
    : { field, op: 'eq', value: other };
}

/** `contains` on an array field. */
export function contains(field: string, value: unknown): Condition {
  return { field, op: 'contains', value };
}

/**
 * A built permission. `rules` is always data; `fieldRules` is the data form of
 * field rules, set by `.fields(...)`. `fields(...)` is a method, so it never
 * reaches the matrix — `policy` reads `fieldRules` only.
 */
export interface PermitBuilder {
  readonly rules: readonly Rule[];
  fieldRules?: FieldRules;
  fields(fieldRules: FieldRules): PermitBuilder;
}

/** Build one permission's allow rules. */
export function permit(
  ...conditions: ConditionOrGroup[]
): PermitBuilder {
  const rules = asRules(conditions);
  const builder: PermitBuilder = {
    rules,
    fields(fieldRules: FieldRules): PermitBuilder {
      return { ...builder, fieldRules };
    },
  };
  return builder;
}

export interface PolicyConfig {
  [object: string]: {
    [action: string]: PermitBuilder;
  };
}

/**
 * The typed authoring path. Flattens to the canonical matrix and builds an
 * Access object.
 *
 * @example
 * ```ts
 * const access = policy<Subject>({
 *   comment: {
 *     update: permit<Comment>(eq('object.authorId', 'subject.id')),
 *   },
 * });
 * ```
 */
export function policy(
  config: PolicyConfig,
  options: { version?: number } = {},
): Access {
  const matrix: Permission[] = [];
  for (const [object, actions] of Object.entries(config)) {
    for (const [action, builder] of Object.entries(actions)) {
      matrix.push({
        key: `${object}.${action}`,
        object,
        action,
        rules: builder.rules,
        fields: builder.fieldRules,
      });
    }
  }
  return createPolicy(matrix, options);
}
