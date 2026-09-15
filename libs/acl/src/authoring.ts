import { createPolicy, type Access, type Subject } from './create-policy.js';
import type { Condition, FieldRules, Permission } from './types.js';

/** A condition that is always true; serializes to an empty `when` array. */
export const always: readonly [] = [];

export type ConditionOrGroup = Condition | readonly Condition[];

/**
 * A dotted path into the object scope, validated against `O`.
 *
 * Strict: with a concrete `O` only real fields type-check. The default
 * `O = Record<string, unknown>` widens to `object.${string}`, which is how the
 * untyped string-key form keeps working.
 */
type ObjectPath<O extends object> = `object.${Extract<keyof O, string>}`;

/**
 * A condition whose `object.*` field is checked against `O` and whose `path`
 * (when object-scoped) is checked against `O` as well.
 */
export interface TypedCondition<O extends object> extends Condition {
  field: ObjectPath<O>;
  path?: string;
}

function asRules(
  groups: readonly ConditionOrGroup[],
): { when: readonly Condition[] }[] {
  const rules: { when: readonly Condition[] }[] = [];
  for (const group of groups) {
    if (Array.isArray(group)) {
      if (group.length && Array.isArray(group[0])) {
        for (const inner of group as readonly (readonly Condition[])[]) {
          rules.push({ when: inner });
        }
      } else {
        rules.push({ when: group });
      }
    } else {
      rules.push({ when: [group] });
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
export function or(...groups: ConditionOrGroup[]): readonly ConditionOrGroup[] {
  return groups;
}

/**
 * Equality between two scopes or a scope and a literal.
 *
 * Provide the object type `O` (and optionally subject type `S`) to have the
 * `object.*` / `subject.*` paths checked against them. Without the generics it
 * degrades to the untyped string-key form.
 */
export function eq<O extends object = Record<string, unknown>>(
  field: ObjectPath<O>,
  other: string | unknown,
): Condition {
  return typeof other === 'string' && other.includes('.')
    ? { field, op: 'eq', path: other }
    : { field, op: 'eq', value: other };
}

/** `contains` on an array field. Provide `O` to check the field path. */
export function contains<O extends object = Record<string, unknown>>(
  field: ObjectPath<O>,
  value: unknown,
): Condition {
  return { field, op: 'contains', value };
}

/** A permit builder; `O` is the object type its conditions are checked against. */
export interface PermitBuilder<O extends object = Record<string, unknown>> {
  rules: readonly { when: readonly Condition[] }[];
  fields(fieldRules: FieldRules): PermitBuilder<O>;
}

/** Build one permission's allow rules. Provide `O` to check object paths. */
export function permit<O extends object = Record<string, unknown>>(
  ...conditions: readonly TypedCondition<O>[]
): PermitBuilder<O> {
  const base: { rules: { when: readonly Condition[] }[]; fields?: FieldRules } =
    { rules: asRules(conditions), fields: undefined };
  return {
    get rules() {
      return base.rules;
    },
    fields(fieldRules) {
      base.fields = fieldRules;
      return this;
    },
  };
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
export function policy<S extends object = Record<string, unknown>>(
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
        rules: builder.rules as readonly Permission['rules'][number][],
        fields: builder.fields,
      });
    }
  }
  return createPolicy(matrix, options);
}
