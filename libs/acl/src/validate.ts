import {
  BangInAllowListError,
  DenyWithoutBaselineError,
  InvalidConditionError,
  InvalidMatrixError,
  InvalidPermissionError,
  InvalidRuleError,
  KeyMismatchError,
  TargetsTransitionsConflictError,
} from './errors.js';
import { toEpoch } from './conditions.js';
import { assertSchemaFit, assertSchemaShape } from './schema.js';
import type {
  Condition,
  FieldConfig,
  Matrix,
  MatrixSchema,
  Permission,
} from './types.js';

/** The operators that compare a namespaced path against a literal or a path. */
const VALUE_OPS = new Set(['eq', 'ne', 'in', 'not-in', 'contains']);

/** The operators that compare the settled clock against a boundary instant. */
const TIME_OPS = new Set(['before', 'after']);

/** The scopes a condition path may name, besides the bare clock. */
const SCOPES = new Set(['subject', 'object']);

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Whether a condition operand is supplied. A key that is present and `undefined`
 * counts as absent: it is what a JSON round trip leaves behind, and what an
 * operand-less condition would compare against.
 */
function supplied(node: Node, key: string): boolean {
  return Object.hasOwn(node, key) && node[key] !== undefined;
}

/**
 * Why a path does not resolve, or undefined when it does.
 *
 * `readPath` splits a path on its first dot and reads the remainder as a single
 * own key, so exactly one dot after a known scope is the whole resolvable set. A
 * bare `now` reads the settled clock.
 */
function pathFault(path: unknown): string | undefined {
  if (typeof path !== 'string') return 'must be a string';
  if (path === 'now') return undefined;
  const dot = path.indexOf('.');
  if (dot === -1) {
    return 'must be "now" or a scoped path ("subject.<field>", "object.<field>")';
  }
  if (!SCOPES.has(path.slice(0, dot))) {
    return 'names no known scope: must be "subject.*", "object.*" or "now"';
  }
  const field = path.slice(dot + 1);
  if (field.length === 0) return 'names no field after its scope';
  if (field.includes('.')) {
    return 'nests below its scope: a path reads one field of a scope, so at most one dot is resolvable';
  }
  return undefined;
}

/**
 * Validates one condition's shape, namespaces and operator/value pairing.
 *
 * An operand the engine would ignore is refused rather than dropped: a `path` on
 * an operator that compares against a literal, or a `value` alongside a `path`,
 * is config whose author expects it to decide something.
 */
function assertCondition(
  key: string,
  where: string,
  condition: Condition,
): void {
  if (!isNode(condition)) {
    throw new InvalidConditionError(key, where, where, 'is not an object');
  }
  const node = condition as Node;
  const field = node['field'];
  const named = typeof field === 'string' ? field : where;

  if (!isNonEmptyString(field)) {
    throw new InvalidConditionError(
      key,
      where,
      named,
      'has no field: a condition names the path it reads',
    );
  }

  const op = node['op'];
  if (typeof op !== 'string' || (!VALUE_OPS.has(op) && !TIME_OPS.has(op))) {
    throw new InvalidConditionError(
      key,
      where,
      named,
      `has an unknown op ${JSON.stringify(op)}`,
    );
  }

  if (field === 'now' || TIME_OPS.has(op)) {
    if (field !== 'now' || !TIME_OPS.has(op)) {
      throw new InvalidConditionError(
        key,
        where,
        named,
        'pairs a clock with a comparison: "now" supports before/after, and before/after read "now"',
      );
    }
    if (supplied(node, 'path')) {
      throw new InvalidConditionError(
        key,
        where,
        named,
        'carries a path: a time condition compares the clock against a literal instant',
      );
    }
    const value = node['value'];
    const instant =
      typeof value === 'string' ||
      typeof value === 'number' ||
      value instanceof Date;
    if (!instant) {
      throw new InvalidConditionError(
        key,
        where,
        named,
        'needs an instant value: an ISO string, epoch milliseconds, or a Date',
      );
    }
    // The boundary comes from the document and is settled once, here. A window
    // whose edge is not a point in time states nothing a decision could read,
    // and the document is the party that can fix it.
    if (Number.isNaN(toEpoch(value))) {
      throw new InvalidConditionError(
        key,
        where,
        named,
        `carries an instant that does not parse: ${JSON.stringify(String(value))}`,
      );
    }
    return;
  }

  const fieldFault = pathFault(field);
  if (fieldFault) {
    throw new InvalidConditionError(key, where, named, fieldFault);
  }

  const hasPath = supplied(node, 'path');
  const hasValue = supplied(node, 'value');

  if (op === 'eq' || op === 'ne') {
    if (hasPath === hasValue) {
      throw new InvalidConditionError(
        key,
        where,
        named,
        hasPath
          ? 'carries both a path and a value: an equality compares against exactly one comparand'
          : 'carries no comparand: an equality needs a path or a value',
      );
    }
    if (hasPath) {
      const fault = pathFault(node['path']);
      if (fault) {
        throw new InvalidConditionError(
          key,
          where,
          named,
          `has a path ${JSON.stringify(node['path'])} that ${fault}`,
        );
      }
    }
    return;
  }

  if (hasPath) {
    throw new InvalidConditionError(
      key,
      where,
      named,
      `carries a path: only eq and ne compare against a path, ${op} compares against a value`,
    );
  }

  if (op === 'in' || op === 'not-in') {
    if (!Array.isArray(node['value'])) {
      throw new InvalidConditionError(
        key,
        where,
        named,
        `needs an array value: ${op} tests membership of a list`,
      );
    }
    return;
  }

  if (!hasValue) {
    throw new InvalidConditionError(
      key,
      where,
      named,
      'needs a value: contains tests the field for one element',
    );
  }
}

/**
 * Validates one rule's shape.
 *
 * `when` must be present. An empty `when` is the unconditional form, so a rule
 * that arrives without the key is indistinguishable from one an author wrote as
 * `always` — and the two cases differ by an unconditional grant. Requiring the
 * key separates them, and costs nothing across a JSON boundary, where `[]`
 * survives and `undefined` does not.
 */
function assertRule(key: string, where: string, rule: unknown): void {
  if (!isNode(rule)) {
    throw new InvalidRuleError(key, where, 'is not an object');
  }
  const id = rule['id'];
  if (id !== undefined && typeof id !== 'string') {
    throw new InvalidRuleError(key, where, 'has an id that is not a string');
  }
  const when = rule['when'];
  if (!Array.isArray(when)) {
    throw new InvalidRuleError(
      key,
      where,
      Object.hasOwn(rule, 'when') && when !== undefined
        ? 'has a when that is not an array'
        : 'has no when: an unconditional rule states it as an empty when array',
    );
  }
  for (const [index, condition] of when.entries()) {
    assertCondition(key, `${where}.when[${index}]`, condition as Condition);
  }
}

function assertRules(key: string, side: string, rules: unknown): void {
  if (rules === undefined) return;
  if (!Array.isArray(rules)) {
    throw new InvalidPermissionError(key, side, 'is not an array');
  }
  for (const [index, rule] of rules.entries()) {
    assertRule(key, `${side}[${index}]`, rule);
  }
}

function assertDependsOn(key: string, dependsOn: unknown): void {
  if (dependsOn === undefined) return;
  if (!Array.isArray(dependsOn)) {
    throw new InvalidPermissionError(key, 'dependsOn', 'is not an array');
  }
  for (const [index, dependency] of dependsOn.entries()) {
    if (!isNonEmptyString(dependency)) {
      throw new InvalidPermissionError(
        key,
        `dependsOn[${index}]`,
        'is not a permission key',
      );
    }
  }
}

function assertFieldConfig(key: string, field: string, config: unknown): void {
  if (!isNode(config)) {
    throw new InvalidPermissionError(
      key,
      `fields.${field}`,
      'is not a field config',
    );
  }
  if ('targets' in config && 'transitions' in config) {
    throw new TargetsTransitionsConflictError(field);
  }
  const { targets, transitions } = config as Partial<FieldConfig> & Node;
  if (targets !== undefined && !Array.isArray(targets)) {
    throw new InvalidPermissionError(
      key,
      `fields.${field}.targets`,
      'is not an array',
    );
  }
  if (transitions !== undefined) {
    if (!isNode(transitions)) {
      throw new InvalidPermissionError(
        key,
        `fields.${field}.transitions`,
        'is not an object',
      );
    }
    for (const [from, to] of Object.entries(transitions)) {
      if (!Array.isArray(to)) {
        throw new InvalidPermissionError(
          key,
          `fields.${field}.transitions.${from}`,
          'is not an array',
        );
      }
    }
  }
}

function assertFieldRules(key: string, rules: unknown): void {
  if (rules === undefined) return;
  if (!isNode(rules)) {
    throw new InvalidPermissionError(key, 'fields', 'is not an object');
  }

  const names = rules['fields'];
  if (names !== undefined) {
    // `fields` is the allow-list key, so it is the one name a field cannot
    // have: a field called `fields` has nowhere to put its `targets` or
    // `transitions`. Naming that here, rather than only the type mismatch,
    // is the whole statement of the limit a foreign producer gets.
    if (!Array.isArray(names)) {
      throw new InvalidPermissionError(
        key,
        'fields.fields',
        'is not an array: "fields" is the name allow-list, so no field may be called "fields"',
      );
    }
    for (const [index, name] of names.entries()) {
      if (!isNonEmptyString(name)) {
        throw new InvalidPermissionError(
          key,
          `fields.fields[${index}]`,
          'is not a field name',
        );
      }
      if (!name.startsWith('!')) continue;
      // A deny entry requires a '*' baseline; and a deny mixed into an
      // explicit allow-list (which already denies anything not listed) is
      // refused. Both leave the intended allow-set undefined.
      if (names.includes('*')) continue;
      if (names.length > 1) {
        throw new BangInAllowListError(name);
      }
      throw new DenyWithoutBaselineError(name);
    }
  }

  for (const [field, config] of Object.entries(rules)) {
    if (field === 'fields') continue;
    if (config === undefined) continue;
    assertFieldConfig(key, field, config);
  }
}

const ENVELOPE = 'a matrix is an envelope: { version?, schema?, permissions }';

/**
 * Validates a canonical matrix document: the envelope, then its permissions'
 * shape, rules and field configs, then its conditions against a present schema.
 * The dependency graph is validated separately by `buildGraph`.
 *
 * This is the whole gate between a foreign matrix and the engine: every entry
 * point passes through it, and everything it accepts evaluates without throwing.
 * Every rejection is an `AclConfigError` naming the permission key and the
 * offending field.
 *
 * The schema pass runs last, so a condition that is not evaluable at all is
 * reported as that rather than as a schema fault.
 */
export function validateMatrix(matrix: Matrix): void {
  if (!isNode(matrix)) {
    throw new InvalidMatrixError(ENVELOPE);
  }

  const node = matrix as Node;
  const permissions = node['permissions'];
  if (!Array.isArray(permissions)) {
    throw new InvalidMatrixError(`"permissions" is not an array: ${ENVELOPE}`);
  }

  const version = node['version'];
  if (
    version !== undefined &&
    typeof version !== 'string' &&
    typeof version !== 'number'
  ) {
    throw new InvalidMatrixError('"version" is neither a string nor a number');
  }

  const schema = node['schema'];
  if (schema !== undefined) assertSchemaShape(schema);

  for (const [index, permission] of permissions.entries()) {
    if (!isNode(permission)) {
      throw new InvalidMatrixError(`permission [${index}] is not an object`);
    }
    const { key, object, action } = permission as Partial<Permission> & Node;
    if (!isNonEmptyString(key)) {
      throw new InvalidMatrixError(`permission [${index}] has no key`);
    }
    if (!isNonEmptyString(object)) {
      throw new InvalidPermissionError(key, 'object', 'is not an object kind');
    }
    if (!isNonEmptyString(action)) {
      throw new InvalidPermissionError(key, 'action', 'is not an action');
    }
    // A key is built by joining the two parts on a dot, and that join is
    // reversible only while neither part carries one: `{ object: 'a.b',
    // action: 'c' }` and `{ object: 'a', action: 'b.c' }` are two permissions
    // with one key. An object kind namespaced by origin is spelled with a
    // colon -- `orders:invoice.read` -- which stays legal.
    if (object.includes('.')) {
      throw new InvalidPermissionError(
        key,
        'object',
        'carries the key delimiter ".": an object kind namespaced by origin is spelled "origin:kind"',
      );
    }
    if (action.includes('.')) {
      throw new InvalidPermissionError(
        key,
        'action',
        'carries the key delimiter "."',
      );
    }
    if (key !== `${object}.${action}`) {
      throw new KeyMismatchError(key, object, action);
    }

    assertRules(key, 'rules', permission['rules']);
    assertRules(key, 'denyRules', permission['denyRules']);
    assertDependsOn(key, permission['dependsOn']);
    assertFieldRules(key, permission['fields']);
  }

  if (schema !== undefined) {
    assertSchemaFit(
      schema as MatrixSchema,
      permissions as readonly Permission[],
    );
  }
}
