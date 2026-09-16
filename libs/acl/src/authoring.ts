import { createPolicy, type Access } from './create-policy.js';
import type {
  Condition,
  FieldRules,
  MatrixSchema,
  Permission,
  Rule,
} from './types.js';

/** A condition that is always true; serializes to an empty `when` array. */
export const always: readonly [] = [];

/**
 * What `permit` accepts for one permission: a single condition, a flat list of
 * conditions (one rule), or a nested list of condition-lists (several rules,
 * OR-ed — what `or(...)` produces).
 */
export type RuleSpec =
  Condition | readonly Condition[] | readonly (readonly Condition[])[];

function asRules(specs: readonly RuleSpec[]): readonly Rule[] {
  const rules: Rule[] = [];
  for (const spec of specs) {
    const value = spec as
      Condition | readonly Condition[] | readonly (readonly Condition[])[];
    if (Array.isArray(value) && Array.isArray(value[0])) {
      // A nested list (from `or(...)`) becomes separate rules.
      for (const inner of value as readonly (readonly Condition[])[]) {
        rules.push({ when: inner });
      }
    } else if (Array.isArray(value)) {
      // A flat list (from `and(...)`) is one rule with several conditions.
      rules.push({ when: value as readonly Condition[] });
    } else {
      rules.push({ when: [value as Condition] });
    }
  }
  return rules;
}

/** AND: conditions in one rule. */
export function and(...conditions: readonly Condition[]): readonly Condition[] {
  return conditions;
}

/** OR: each argument becomes its own rule. */
export function or(
  ...conditions: readonly Condition[]
): readonly (readonly Condition[])[] {
  return conditions.map((condition) => [condition]);
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
export function permit(...specs: RuleSpec[]): PermitBuilder {
  const rules = asRules(specs);
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
 * const access = policy({
 *   comment: {
 *     update: permit(eq('object.authorId', 'subject.id')),
 *   },
 * });
 * ```
 */
export function policy(
  config: PolicyConfig,
  options: { version?: string | number; schema?: MatrixSchema } = {},
): Access {
  const permissions: Permission[] = [];
  for (const [object, actions] of Object.entries(config)) {
    for (const [action, builder] of Object.entries(actions)) {
      permissions.push({
        key: `${object}.${action}`,
        object,
        action,
        rules: builder.rules,
        fields: builder.fieldRules,
      });
    }
  }
  // Both go into the document the builder flattens to rather than into
  // construction options, so `JSON.stringify(access.matrix)` emits everything a
  // foreign producer would emit.
  return createPolicy({ ...options, permissions });
}
