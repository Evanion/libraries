import type {
  EvaluationContext,
  FieldConfig,
  FieldOutcome,
  FieldReason,
  FieldRules,
  FieldState,
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

/**
 * One field's write decision under a `targets` or `transitions` config, with the
 * reason it landed there.
 *
 * The two undecidable causes are distinct, and a `transitions` field can hit
 * both at once. A missing current value outranks a missing proposed one: a
 * complete object is the first thing the caller has to supply, and the edge
 * cannot be read from either end without it.
 */
function decideConfig(
  field: string,
  config: FieldConfig,
  ctx: EvaluationContext,
  proposed?: Record<string, unknown>,
): { state: FieldState; reason: FieldReason } {
  const next = proposed?.[field];

  if ('targets' in config) {
    if (next === undefined) {
      return { state: 'unevaluable', reason: 'proposed-required' };
    }
    return (config.targets as readonly unknown[]).includes(next)
      ? { state: 'allowed', reason: 'allow' }
      : { state: 'denied', reason: 'targets-failed' };
  }

  // transitions: read the current value off the object, check the edge.
  const object = ctx.object;
  const current =
    object && hasOwn(object, field)
      ? (object as Record<string, unknown>)[field]
      : undefined;
  if (current === undefined) {
    return { state: 'unevaluable', reason: 'missing-field' };
  }
  if (next === undefined) {
    return { state: 'unevaluable', reason: 'proposed-required' };
  }
  const edges = config.transitions[current as string];
  if (!Array.isArray(edges)) {
    return { state: 'denied', reason: 'transition-failed' };
  }
  return edges.includes(next)
    ? { state: 'allowed', reason: 'allow' }
    : { state: 'denied', reason: 'transition-failed' };
}

/**
 * The field-level decision for one permission on one axis.
 *
 * Read is projection only: targets/transitions (write concepts) do not apply,
 * so a read field is allowed unless denied by the name list. Write applies the
 * per-field config. Missing data yields `unevaluable`, never a silent allow or
 * deny.
 *
 * Field rules are leaf-level and never cascade, so this answers the fields
 * alone. The action-level gate is composed on top at the entry point, which is
 * what makes the returned `allowed` a field-only claim.
 */
export function decideFields(
  permission: Permission,
  ctx: EvaluationContext,
  axis: 'read' | 'write',
  proposed?: Record<string, unknown>,
): FieldOutcome {
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

  const fields: FieldOutcome['fields'] = {};
  const reasons: FieldOutcome['reasons'] = {};

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
      const { state, reason } = decideConfig(field, config, ctx, proposed);
      fields[field] = state;
      reasons[field] = reason;
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
