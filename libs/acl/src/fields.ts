import { ActionNotAllowedError } from './errors.js';
import type {
  EvaluationContext,
  FieldConfig,
  FieldDecision,
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
 *
 * `__proto__` names no field either. `JSON.parse` yields it as an own key, and
 * a decision that carried it would let `pickAllowedFields` hand back a value
 * that `Object.assign` writes through the prototype setter rather than onto the
 * row. A name that cannot survive being applied is not a writable field.
 */
function isFieldName(token: string): boolean {
  return token !== '*' && token !== '__proto__' && !token.startsWith('!');
}

/**
 * The transitions key a stored value names, or undefined when it names none.
 *
 * A state machine is keyed by the strings a serializer produces, so only a
 * primitive names an edge. Every other value — an object, an array, a symbol —
 * is a shape the machine was not written for.
 */
function edgeName(current: unknown): string | undefined {
  switch (typeof current) {
    case 'string':
      return current;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(current);
    default:
      return current === null ? 'null' : undefined;
  }
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
  // the transitions map is an edge. A prototype member names no edge, and a
  // value that is not a primitive names no edge at all: coercing an object with
  // a null prototype, a hostile `toString`, or a symbol throws, and a decision
  // is not allowed to throw.
  const edge = edgeName(current);
  const edges =
    edge !== undefined && hasOwn(config.transitions, edge)
      ? config.transitions[edge]
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

/**
 * The subset of a proposed write the decision allows: every key whose state is
 * `allowed`, and nothing else. This is the value to write.
 *
 * A key the decision does not carry is not written. Only `allowed` passes, so
 * `denied` and `unevaluable` are both withheld, and so is a key that reached the
 * decision under a different `proposed` object.
 *
 * Throws `ActionNotAllowedError` when the action is refused, because no field of
 * a refused action is writable and an empty object would read as a lawful write
 * of nothing. A field the action allows but the rules deny is a partial write,
 * which is what filtering is for, so a `false` top-level `allowed` from the
 * field maps alone returns the allowed subset.
 */
export function pickAllowedFields<T extends Record<string, unknown>>(
  decision: FieldDecision,
  proposed: T,
): Partial<T> {
  if (!decision.action.allowed) {
    throw new ActionNotAllowedError(
      decision.action.key,
      decision.action.reason,
    );
  }
  const writable: Record<string, unknown> = {};
  for (const field of Object.keys(proposed)) {
    if (!hasOwn(decision.fields, field)) continue;
    if (decision.fields[field] !== 'allowed') continue;
    put(writable, field, proposed[field]);
  }
  return writable as Partial<T>;
}
