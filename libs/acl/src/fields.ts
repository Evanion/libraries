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

/**
 * Writes one own data property, keyed by a field name that comes from data.
 * `__proto__` is a field name like any other here, and plain assignment would
 * hand it to the prototype setter instead of the map.
 */
function put<T>(bag: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(bag, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/**
 * Whether a token names a field. `*` is the baseline and `!name` an exclusion:
 * authoring syntax that carries no field of its own, wherever it turns up —
 * including as a literal key of the object or of a proposed write.
 */
function isFieldName(token: string): boolean {
  return token !== '*' && !token.startsWith('!');
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
  // Only an own property of the write is a proposed value.
  const next =
    proposed && hasOwn(proposed, field) ? proposed[field] : undefined;

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
  // The current value is attacker-controlled data, so only an own property of
  // the transitions map is an edge. A prototype member names no edge.
  const edges = hasOwn(config.transitions, String(current))
    ? config.transitions[current as string]
    : undefined;
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
  //
  // A write also considers every key of `proposed`. A key the caller intends to
  // write is decided by the same allow-list logic as every other field, so a key
  // that exists nowhere but the write still carries a state a caller can gate
  // on. The read axis is a projection of the object and takes no write, so
  // `proposed` names nothing it decides.
  //
  // `*` and `!name` are authoring syntax for a baseline and an exclusion. They
  // are not field names, so they never key the decision maps, whichever source
  // they arrive from.
  const objectFields = ctx.object ? Object.keys(ctx.object) : [];
  const proposedFields =
    axis === 'write' && proposed ? Object.keys(proposed) : [];
  const ruleFields = Object.keys(rules).filter((k) => k !== 'fields');
  const allFields = [
    ...new Set(
      [
        ...objectFields,
        ...proposedFields,
        ...ruleFields,
        ...(names ?? []),
      ].filter(isFieldName),
    ),
  ];

  const fields: FieldOutcome['fields'] = {};
  const reasons: FieldOutcome['reasons'] = {};

  for (const field of allFields) {
    // Only an own rule key configures a field; a field named after a prototype
    // member carries no config.
    const config = hasOwn(rules, field)
      ? (rules[field] as FieldConfig | undefined)
      : undefined;

    if (axis === 'read') {
      // Read is projection only. Per-field `targets`/`transitions` configs are
      // write concepts and do not restrict reads; only the name allow-list /
      // bang list denies a read field.
      const isAllowed = names ? allowed(field, names) : true;
      put(fields, field, isAllowed ? 'allowed' : 'denied');
      put(reasons, field, isAllowed ? 'allow' : 'not-listed');
      continue;
    }

    // write axis
    if (config && ('targets' in config || 'transitions' in config)) {
      const { state, reason } = decideConfig(field, config, ctx, proposed);
      put(fields, field, state);
      put(reasons, field, reason);
      continue;
    }

    if (names) {
      const isAllowed = allowed(field, names);
      put(fields, field, isAllowed ? 'allowed' : 'denied');
      put(reasons, field, isAllowed ? 'allow' : 'not-listed');
    } else {
      // No name list, no config: not restricted on write.
      put(fields, field, 'allowed');
      put(reasons, field, 'allow');
    }
  }

  const allowedAll = Object.values(fields).every((s) => s === 'allowed');
  return { allowed: allowedAll, fields, reasons };
}
