import {
  FieldTypeMismatchError,
  InvalidSchemaError,
  UnknownFieldError,
} from './errors.js';
import type {
  Condition,
  MatrixSchema,
  ObjectSchema,
  Permission,
  Rule,
} from './types.js';

/** The bases a `FieldType` is built from. */
const BASE_TYPES = new Set(['string', 'number', 'boolean', 'instant']);

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A parsed `FieldType`: its base, whether it is an array, whether it is optional. */
interface Declared {
  base: string;
  array: boolean;
  optional: boolean;
}

/**
 * Parses a declared field type, or undefined when the string is not one.
 *
 * The suffixes read right to left: `string[]?` is an optional array of strings.
 */
function parseFieldType(type: string): Declared | undefined {
  let rest = type;
  let optional = false;
  if (rest.endsWith('?')) {
    optional = true;
    rest = rest.slice(0, -1);
  }
  let array = false;
  if (rest.endsWith('[]')) {
    array = true;
    rest = rest.slice(0, -2);
  }
  if (!BASE_TYPES.has(rest)) return undefined;
  return { base: rest, array, optional };
}

const TYPE_FORMS =
  'is not a field type: one of "string", "number", "boolean", "instant", with an optional "[]" and an optional trailing "?"';

function assertObjectSchema(where: string, schema: unknown): void {
  if (!isNode(schema)) {
    throw new InvalidSchemaError(where, 'is not an object');
  }
  const fields = schema['fields'];
  if (fields !== undefined) {
    if (!isNode(fields)) {
      throw new InvalidSchemaError(`${where}.fields`, 'is not an object');
    }
    for (const [name, type] of Object.entries(fields)) {
      if (typeof type !== 'string' || parseFieldType(type) === undefined) {
        throw new InvalidSchemaError(`${where}.fields.${name}`, TYPE_FORMS);
      }
    }
  }
  const relations = schema['relations'];
  if (relations !== undefined) {
    if (!isNode(relations)) {
      throw new InvalidSchemaError(`${where}.relations`, 'is not an object');
    }
    for (const [name, kind] of Object.entries(relations)) {
      if (typeof kind !== 'string' || kind.length === 0) {
        throw new InvalidSchemaError(
          `${where}.relations.${name}`,
          'is not an object kind',
        );
      }
      if (isNode(fields) && Object.hasOwn(fields, name)) {
        throw new InvalidSchemaError(
          `${where}.relations.${name}`,
          'is also declared as a field: one name resolves to one member',
        );
      }
    }
  }
}

/**
 * Validates a `schema`'s own shape.
 *
 * Structural before semantic, like the rest of the gate: nothing reads a
 * declared type until every declared type is known to be one.
 */
export function assertSchemaShape(schema: unknown): void {
  if (!isNode(schema)) {
    throw new InvalidSchemaError('schema', 'is not an object');
  }
  const subject = schema['subject'];
  if (subject !== undefined) assertObjectSchema('schema.subject', subject);
  const objects = schema['objects'];
  if (objects !== undefined) {
    if (!isNode(objects)) {
      throw new InvalidSchemaError('schema.objects', 'is not an object');
    }
    for (const [kind, declared] of Object.entries(objects)) {
      assertObjectSchema(`schema.objects.${kind}`, declared);
    }
  }
}

/** What a condition path names in the schema. */
type Lookup =
  /** The scope this path names is not declared, so nothing about it is checked. */
  | { state: 'unchecked' }
  | { state: 'declared'; type: Declared }
  | { state: 'unknown' }
  | { state: 'relation'; kind: string };

/** The settled clock, as a type: `readPath` reads `now` as epoch milliseconds. */
const CLOCK: Declared = { base: 'number', array: false, optional: false };

function objectSchemaFor(
  schema: MatrixSchema,
  objectKind: string,
  scope: string,
): ObjectSchema | undefined {
  if (scope === 'subject') return schema.subject;
  const objects = schema.objects;
  if (!objects || !Object.hasOwn(objects, objectKind)) return undefined;
  return objects[objectKind];
}

function lookupPath(
  schema: MatrixSchema,
  objectKind: string,
  path: string,
): Lookup {
  if (path === 'now') return { state: 'declared', type: CLOCK };
  const dot = path.indexOf('.');
  const scope = path.slice(0, dot);
  const name = path.slice(dot + 1);
  const declared = objectSchemaFor(schema, objectKind, scope);
  if (declared === undefined) return { state: 'unchecked' };

  const relations = declared.relations;
  if (relations && Object.hasOwn(relations, name)) {
    return { state: 'relation', kind: relations[name] as string };
  }
  const fields = declared.fields;
  if (!fields || !Object.hasOwn(fields, name)) return { state: 'unknown' };
  // Shape validation already accepted every declared type.
  return {
    state: 'declared',
    type: parseFieldType(fields[name] as string) as Declared,
  };
}

/**
 * Whether a literal can be the value a declared field holds.
 *
 * `null` fits every base: a declared field that is present and `null` is
 * present, so `eq` against `null` is a test an author may mean.
 */
function literalFits(base: string, value: unknown): boolean {
  if (value === null) return true;
  switch (base) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return (
        typeof value === 'string' ||
        typeof value === 'number' ||
        value instanceof Date
      );
  }
}

/**
 * Whether two declared types can compare equal.
 *
 * An `instant` is carried as a string or a number, so it agrees with either;
 * anything else must match base and array-ness exactly.
 */
function typesAgree(left: Declared, right: Declared): boolean {
  if (left.array !== right.array) return false;
  if (left.base === right.base) return true;
  const pair = new Set([left.base, right.base]);
  return pair.has('instant') && !pair.has('boolean');
}

function describe(type: Declared): string {
  return `${type.base}${type.array ? '[]' : ''}`;
}

/** The conditions that read a declared field: everything but the clock's. */
type ValueCondition = Extract<
  Condition,
  { op: 'eq' | 'ne' | 'in' | 'not-in' | 'contains' }
>;

/**
 * Whether a condition reads a field at all.
 *
 * `Condition` discriminates on both `field` and `op`, so an operator test alone
 * does not narrow it; this states the narrowing once.
 */
function readsField(condition: Condition): condition is ValueCondition {
  return condition.op !== 'before' && condition.op !== 'after';
}

function assertConditionFits(
  schema: MatrixSchema,
  permission: Permission,
  where: string,
  candidate: Condition,
): void {
  // A time condition reads the clock, never a declared field.
  if (!readsField(candidate)) return;
  const condition = candidate;

  const key = permission.key;
  const field = condition.field;
  const found = lookupPath(schema, permission.object, field);

  if (found.state === 'unchecked') return;
  if (found.state === 'unknown') {
    throw new UnknownFieldError(
      key,
      where,
      field,
      'names a field the schema does not declare',
    );
  }
  if (found.state === 'relation') {
    throw new UnknownFieldError(
      key,
      where,
      field,
      `names the relation to "${found.kind}": a condition reads one field of one scope, and a relation is not a value it compares`,
    );
  }

  const self = found.type;
  const op = condition.op;

  if (op === 'contains') {
    if (!self.array) {
      throw new FieldTypeMismatchError(
        key,
        where,
        field,
        `is declared ${describe(self)}: contains tests an array for one element`,
      );
    }
    if (!literalFits(self.base, condition.value)) {
      throw new FieldTypeMismatchError(
        key,
        where,
        field,
        `holds ${self.base} elements, and contains compares it against ${JSON.stringify(condition.value)}`,
      );
    }
    return;
  }

  if (self.array) {
    throw new FieldTypeMismatchError(
      key,
      where,
      field,
      `is declared ${describe(self)}, and ${op} compares by identity, which no two arrays satisfy: an array field is tested with contains`,
    );
  }

  if (op === 'in' || op === 'not-in') {
    for (const [index, element] of (condition.value as unknown[]).entries()) {
      if (literalFits(self.base, element)) continue;
      throw new FieldTypeMismatchError(
        key,
        where,
        field,
        `is declared ${self.base}, and ${op} lists ${JSON.stringify(element)} at [${index}]`,
      );
    }
    return;
  }

  const comparand = condition.path;
  if (comparand === undefined) {
    if (literalFits(self.base, condition.value)) return;
    throw new FieldTypeMismatchError(
      key,
      where,
      field,
      `is declared ${self.base}, and ${op} compares it against ${JSON.stringify(condition.value)}`,
    );
  }

  const other = lookupPath(schema, permission.object, comparand);
  if (other.state === 'unchecked') return;
  if (other.state === 'unknown') {
    throw new UnknownFieldError(
      key,
      where,
      field,
      `compares against "${comparand}", which the schema does not declare`,
    );
  }
  if (other.state === 'relation') {
    throw new UnknownFieldError(
      key,
      where,
      field,
      `compares against the relation "${comparand}", which is not a value`,
    );
  }
  if (typesAgree(self, other.type)) return;
  throw new FieldTypeMismatchError(
    key,
    where,
    field,
    `is declared ${describe(self)} and compares against "${comparand}", declared ${describe(other.type)}`,
  );
}

/**
 * Checks one rule array's conditions against a present schema.
 *
 * `where` names the array inside the document the conditions came from, so the
 * error locates a fault the way the reader reached it. `assertSchemaFit` passes
 * `rules` and `denyRules`; a deny overlay passes its own contribution and gets
 * `overlay[0].when[1]` rather than a position in a permission it did not write.
 */
export function assertRulesFit(
  schema: MatrixSchema,
  permission: Permission,
  where: string,
  rules: readonly Rule[] | undefined,
): void {
  if (rules === undefined) return;
  for (const [index, rule] of rules.entries()) {
    for (const [at, condition] of (rule.when ?? []).entries()) {
      assertConditionFits(
        schema,
        permission,
        `${where}[${index}].when[${at}]`,
        condition,
      );
    }
  }
}

/**
 * Checks every condition of every permission against a present schema.
 *
 * Runs after the per-condition structural checks, so a condition that is not
 * evaluable at all is reported as that rather than as a schema fault. Only kinds
 * `schema.objects` declares are checked, and `subject.*` paths only when
 * `schema.subject` is declared.
 */
export function assertSchemaFit(
  schema: MatrixSchema,
  permissions: readonly Permission[],
): void {
  for (const permission of permissions) {
    for (const side of ['rules', 'denyRules'] as const) {
      assertRulesFit(schema, permission, side, permission[side]);
    }
  }
}
