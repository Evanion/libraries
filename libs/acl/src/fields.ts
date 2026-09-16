import type {
  EvaluationContext,
  FieldConfig,
  FieldDecision,
  FieldRules,
  Permission,
} from './types.js';

function hasOwn(bag: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(bag, key);
}

function nameList(rules: FieldRules): readonly string[] | undefined {
  return rules['fields'] as readonly string[] | undefined;
}

function allowed(name: string, names: readonly string[]): boolean {
  if (names.includes('*')) {
    return !names.some((n) => n === `!${name}`);
  }
  return names.includes(name);
}

function decideConfig(
  field: string,
  config: FieldConfig,
  ctx: EvaluationContext,
  proposed?: Record<string, unknown>,
): 'allowed' | 'denied' | 'unevaluable' {
  const next = proposed?.[field];

  if ('targets' in config) {
    if (next === undefined) return 'unevaluable';
    return (config.targets as readonly unknown[]).includes(next)
      ? 'allowed'
      : 'denied';
  }

  // transitions: read the current value off the object, check the edge.
  const object = ctx.object;
  const current =
    object && hasOwn(object, field)
      ? (object as Record<string, unknown>)[field]
      : undefined;
  if (current === undefined) return 'unevaluable';
  if (next === undefined) return 'unevaluable';
  const edges = config.transitions[current as string];
  if (!Array.isArray(edges)) return 'denied';
  return edges.includes(next) ? 'allowed' : 'denied';
}

/**
 * The field-level decision for one permission on one axis.
 *
 * Read is projection only: targets/transitions (write concepts) do not apply,
 * so a read field is allowed unless denied by the name list. Write applies the
 * per-field config. Missing data yields `unevaluable`, never a silent allow or
 * deny.
 */
export function decideFields(
  permission: Permission,
  ctx: EvaluationContext,
  axis: 'read' | 'write',
  proposed?: Record<string, unknown>,
): FieldDecision {
  const rules = permission.fields ?? {};
  const names = nameList(rules);

  // The matrix does not know the object's shape, so we consider every field the
  // object carries, every field named in the rules, and every name in the
  // allow-list (a write allow-list names the fields that may be written).
  // `*` and `!name` are authoring syntax for a baseline and an exclusion. They
  // are not field names, so they never key the decision maps.
  const objectFields = ctx.object ? Object.keys(ctx.object) : [];
  const ruleFields = Object.keys(rules).filter((k) => k !== 'fields');
  const listed = (names ?? []).filter(
    (name) => name !== '*' && !name.startsWith('!'),
  );
  const allFields = [...new Set([...objectFields, ...ruleFields, ...listed])];

  const fields: FieldDecision['fields'] = {};
  const reasons: FieldDecision['reasons'] = {};

  for (const field of allFields) {
    const config = rules[field] as FieldConfig | undefined;

    if (axis === 'read') {
      // Read is projection only. Per-field `targets`/`transitions` configs are
      // write concepts and do not restrict reads; only the name allow-list /
      // bang list denies a read field.
      const isAllowed = names ? allowed(field, names) : true;
      fields[field] = isAllowed ? 'allowed' : 'denied';
      reasons[field] = isAllowed ? 'allow' : 'not-listed';
      continue;
    }

    // write axis
    if (config && ('targets' in config || 'transitions' in config)) {
      const state = decideConfig(field, config, ctx, proposed);
      fields[field] = state;
      reasons[field] =
        state === 'allowed'
          ? 'allow'
          : state === 'denied'
            ? 'targets' in config
              ? 'targets-failed'
              : 'transition-failed'
            : 'targets' in config
              ? 'proposed-required'
              : 'missing-field';
      continue;
    }

    if (names) {
      const isAllowed = allowed(field, names);
      fields[field] = isAllowed ? 'allowed' : 'denied';
      reasons[field] = isAllowed ? 'allow' : 'not-listed';
    } else {
      // No name list, no config: not restricted on write.
      fields[field] = 'allowed';
      reasons[field] = 'allow';
    }
  }

  const allowedAll = Object.values(fields).every((s) => s === 'allowed');
  return { allowed: allowedAll, fields, reasons };
}
