import {
  FieldTypeMismatchError,
  InvalidSchemaError,
  UnknownFieldError,
} from './errors.js';
import { inPermission, throwFirst } from './issues.js';
import type { Report, Segment } from './issues.js';
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

/**
 * Checks one object schema's shape. A schema that is not an object has no
 * members to check. `fields` and `relations` are independent, except that a
 * relation shares its name with a field only when `fields` is an object.
 */
function assertObjectSchema(
  report: Report,
  where: string,
  at: readonly Segment[],
  schema: unknown,
): void {
  if (!isNode(schema)) {
    report(new InvalidSchemaError(where, 'is not an object'), at);
    return;
  }
  const fields = schema['fields'];
  if (fields !== undefined) {
    if (!isNode(fields)) {
      report(new InvalidSchemaError(`${where}.fields`, 'is not an object'), [
        ...at,
        'fields',
      ]);
    } else {
      for (const [name, type] of Object.entries(fields)) {
        if (typeof type !== 'string' || parseFieldType(type) === undefined) {
          report(
            new InvalidSchemaError(`${where}.fields.${name}`, TYPE_FORMS),
            [...at, 'fields', name],
          );
        }
      }
    }
  }
  const relations = schema['relations'];
  if (relations !== undefined) {
    if (!isNode(relations)) {
      report(new InvalidSchemaError(`${where}.relations`, 'is not an object'), [
        ...at,
        'relations',
      ]);
      return;
    }
    for (const [name, kind] of Object.entries(relations)) {
      const here = [...at, 'relations', name];
      if (typeof kind !== 'string' || kind.length === 0) {
        report(
          new InvalidSchemaError(
            `${where}.relations.${name}`,
            'is not an object kind',
          ),
          here,
        );
        continue;
      }
      if (isNode(fields) && Object.hasOwn(fields, name)) {
        report(
          new InvalidSchemaError(
            `${where}.relations.${name}`,
            'is also declared as a field: one name resolves to one member',
          ),
          here,
        );
      }
    }
  }
}

/**
 * Validates a `schema`'s own shape, reporting every fault, and answers whether
 * there were none.
 *
 * Structural before semantic, like the rest of the gate: nothing reads a
 * declared type until every declared type is known to be one, so a caller runs
 * `assertSchemaFit` only on a schema this accepts. A schema that is not an
 * object has no `subject` or `objects` to check; a `subject` or one entry of
 * `objects` that is not an object has no members to check.
 */
export function assertSchemaShape(schema: unknown, report: Report): boolean {
  let clean = true;
  const noting: Report = (error, path, permissionKey) => {
    clean = false;
    report(error, path, permissionKey);
  };
  if (!isNode(schema)) {
    noting(new InvalidSchemaError('schema', 'is not an object'), ['schema']);
    return false;
  }
  const subject = schema['subject'];
  if (subject !== undefined) {
    assertObjectSchema(
      noting,
      'schema.subject',
      ['schema', 'subject'],
      subject,
    );
  }
  const objects = schema['objects'];
  if (objects !== undefined) {
    if (!isNode(objects)) {
      noting(new InvalidSchemaError('schema.objects', 'is not an object'), [
        'schema',
        'objects',
      ]);
      return false;
    }
    for (const [kind, declared] of Object.entries(objects)) {
      assertObjectSchema(
        noting,
        `schema.objects.${kind}`,
        ['schema', 'objects', kind],
        declared,
      );
    }
  }
  return clean;
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
  report: Report,
  at: readonly Segment[],
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
    report(
      new UnknownFieldError(
        key,
        where,
        field,
        'names a field the schema does not declare',
      ),
      at,
    );
    return;
  }
  if (found.state === 'relation') {
    report(
      new UnknownFieldError(
        key,
        where,
        field,
        `names the relation to "${found.kind}": a condition reads one field of one scope, and a relation is not a value it compares`,
      ),
      at,
    );
    return;
  }

  const self = found.type;
  const op = condition.op;

  if (op === 'contains') {
    if (!self.array) {
      report(
        new FieldTypeMismatchError(
          key,
          where,
          field,
          `is declared ${describe(self)}: contains tests an array for one element`,
        ),
        at,
      );
      return;
    }
    if (!literalFits(self.base, condition.value)) {
      report(
        new FieldTypeMismatchError(
          key,
          where,
          field,
          `holds ${self.base} elements, and contains compares it against ${JSON.stringify(condition.value)}`,
        ),
        at,
      );
      return;
    }
    return;
  }

  if (self.array) {
    report(
      new FieldTypeMismatchError(
        key,
        where,
        field,
        `is declared ${describe(self)}, and ${op} compares by identity, which no two arrays satisfy: an array field is tested with contains`,
      ),
      at,
    );
    return;
  }

  if (op === 'in' || op === 'not-in') {
    for (const [index, element] of (condition.value as unknown[]).entries()) {
      if (literalFits(self.base, element)) continue;
      report(
        new FieldTypeMismatchError(
          key,
          where,
          field,
          `is declared ${self.base}, and ${op} lists ${JSON.stringify(element)} at [${index}]`,
        ),
        at,
      );
      return;
    }
    return;
  }

  const comparand = condition.path;
  if (comparand === undefined) {
    if (literalFits(self.base, condition.value)) return;
    report(
      new FieldTypeMismatchError(
        key,
        where,
        field,
        `is declared ${self.base}, and ${op} compares it against ${JSON.stringify(condition.value)}`,
      ),
      at,
    );
    return;
  }

  const other = lookupPath(schema, permission.object, comparand);
  if (other.state === 'unchecked') return;
  if (other.state === 'unknown') {
    report(
      new UnknownFieldError(
        key,
        where,
        field,
        `compares against "${comparand}", which the schema does not declare`,
      ),
      at,
    );
    return;
  }
  if (other.state === 'relation') {
    report(
      new UnknownFieldError(
        key,
        where,
        field,
        `compares against the relation "${comparand}", which is not a value`,
      ),
      at,
    );
    return;
  }
  if (typesAgree(self, other.type)) return;
  report(
    new FieldTypeMismatchError(
      key,
      where,
      field,
      `is declared ${describe(self)} and compares against "${comparand}", declared ${describe(other.type)}`,
    ),
    at,
  );
}

/**
 * Reports one rule array's conditions that do not fit a present schema.
 *
 * `where` names the array inside the document the conditions came from, and
 * `base` is its pointer. A rule whose `when` is not an array, and a condition
 * `usable` rejects, have no field to read and are skipped. `validateMatrix`
 * passes the conditions its shape pass accepted.
 */
function collectRulesFit(
  report: Report,
  schema: MatrixSchema,
  permission: Permission,
  where: string,
  base: readonly Segment[],
  rules: unknown,
  usable: (condition: unknown) => boolean,
): void {
  if (!Array.isArray(rules)) return;
  for (const [index, rule] of (rules as unknown[]).entries()) {
    if (!isNode(rule) || !Array.isArray(rule['when'])) continue;
    for (const [at, condition] of (rule['when'] as unknown[]).entries()) {
      if (!usable(condition)) continue;
      assertConditionFits(
        report,
        [...base, index, 'when', at],
        schema,
        permission,
        `${where}[${index}].when[${at}]`,
        condition as Condition,
      );
    }
  }
}

/**
 * Checks one rule array's conditions against a present schema, and throws the
 * first that does not fit.
 *
 * `where` names the array inside the document the conditions came from, so the
 * error locates a fault the way the reader reached it. A deny overlay passes its
 * own contribution and gets `overlay[0].when[1]` rather than a position in a
 * permission it did not write. The rules passed `assertRules`.
 */
export function assertRulesFit(
  schema: MatrixSchema,
  permission: Permission,
  where: string,
  rules: readonly Rule[] | undefined,
): void {
  throwFirst((report) => {
    collectRulesFit(
      report,
      schema,
      permission,
      where,
      [where],
      rules,
      () => true,
    );
  });
}

/**
 * Reports every condition of every permission that does not fit a present
 * schema.
 *
 * Runs after the per-condition structural checks, so a condition that is not
 * evaluable at all is reported as that rather than as a schema fault: `usable`
 * says which conditions passed them. A permission with no key or no object kind
 * is skipped, as it names nothing to look up. Only kinds `schema.objects`
 * declares are checked, and `subject.*` paths only when `schema.subject` is
 * declared. `schema` must have passed `assertSchemaShape`.
 */
export function assertSchemaFit(
  schema: MatrixSchema,
  permissions: readonly unknown[],
  report: Report,
  usable: (condition: unknown) => boolean,
): void {
  for (const [index, permission] of permissions.entries()) {
    if (
      !isNode(permission) ||
      typeof permission['key'] !== 'string' ||
      typeof permission['object'] !== 'string' ||
      permission['object'].length === 0
    ) {
      continue;
    }
    const scoped = inPermission(report, permission['key']);
    for (const side of ['rules', 'denyRules'] as const) {
      collectRulesFit(
        scoped,
        schema,
        permission as unknown as Permission,
        side,
        ['permissions', index, side],
        permission[side],
        usable,
      );
    }
  }
}
