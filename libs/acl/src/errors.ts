import type { ObjectKey, Reason } from './types.js';

/** Base class for the configuration errors. All raised at construction. */
export class AclConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AclConfigError';
  }
}

/** A dependency cycle. Rejected because resolution order is undefined. */
export class FeatureCycleError extends AclConfigError {
  readonly path: readonly string[];
  constructor(path: readonly string[]) {
    super(`permission dependency cycle: ${path.join(' -> ')}`);
    this.name = 'FeatureCycleError';
    this.path = path;
  }
}

/** A `dependsOn` naming a permission that is not configured. */
export class UnknownDependencyError extends AclConfigError {
  readonly key: string;
  readonly dependency: string;
  constructor(key: string, dependency: string) {
    super(
      `permission "${key}" depends on "${dependency}", which is not configured`,
    );
    this.name = 'UnknownDependencyError';
    this.key = key;
    this.dependency = dependency;
  }
}

/** Two permissions with the same key. */
export class DuplicatePermissionError extends AclConfigError {
  readonly key: string;
  constructor(key: string) {
    super(`duplicate permission key "${key}"`);
    this.name = 'DuplicatePermissionError';
    this.key = key;
  }
}

/** A `!` entry in `fields()` has no `*` baseline. */
export class DenyWithoutBaselineError extends AclConfigError {
  constructor(field: string) {
    super(
      `field "${field}" has no baseline: a deny entry requires a '*' baseline (or an explicit allow-list) to say what is allowed`,
    );
    this.name = 'DenyWithoutBaselineError';
  }
}

/** A `!` entry mixed into an explicit allow-list. */
export class BangInAllowListError extends AclConfigError {
  constructor(field: string) {
    super(
      `field "${field}" is denied inside an explicit allow-list, which already denies anything not listed`,
    );
    this.name = 'BangInAllowListError';
  }
}

/** Both `targets` and `transitions` on one field. */
export class TargetsTransitionsConflictError extends AclConfigError {
  constructor(field: string) {
    super(
      `field "${field}" configures both targets and transitions, which are mutually exclusive`,
    );
    this.name = 'TargetsTransitionsConflictError';
  }
}

/**
 * A write was narrowed against a decision whose action is refused.
 *
 * The only error this library raises outside construction. A refused action has
 * no writable field, so the narrowing has no answer to return: an empty object
 * would be indistinguishable from a lawful write of nothing.
 */
export class ActionNotAllowedError extends Error {
  readonly key: string;
  readonly reason: Reason;
  constructor(key: string, reason: Reason) {
    super(`action "${key}" is not allowed (${reason}); no field is writable`);
    this.name = 'ActionNotAllowedError';
    this.key = key;
    this.reason = reason;
  }
}

/**
 * A `key` that is not `` `${object}.${action}` ``.
 *
 * Lookup is by `key` alone, so a permission whose key disagrees with its
 * `object` and `action` answers for a pair it was never written for.
 */
export class KeyMismatchError extends AclConfigError {
  readonly key: string;
  readonly object: string;
  readonly action: string;
  constructor(key: string, object: string, action: string) {
    super(
      `permission key "${key}" is not "${object}.${action}": a key must be exactly \`\${object}.\${action}\``,
    );
    this.name = 'KeyMismatchError';
    this.key = key;
    this.object = object;
    this.action = action;
  }
}

/** A matrix envelope whose own shape is not the canonical one. */
export class InvalidMatrixError extends AclConfigError {
  constructor(detail: string) {
    super(`invalid matrix: ${detail}`);
    this.name = 'InvalidMatrixError';
  }
}

/**
 * A `schema` whose own shape is not the canonical one.
 *
 * `where` locates the fault inside the document
 * (`schema.objects.comment.fields.status`), so a producer emitting a schema by
 * reflection finds it without a line number.
 */
export class InvalidSchemaError extends AclConfigError {
  readonly where: string;
  constructor(where: string, detail: string) {
    super(`invalid matrix: "${where}" ${detail}`);
    this.name = 'InvalidSchemaError';
    this.where = where;
  }
}

/**
 * A condition naming a field the schema does not declare.
 *
 * Without a schema this is the typo class that evaluates to `undecidable`
 * forever on the foreign path, because an absent `object.*` path is a shortfall
 * the caller is told to fill in rather than a miss.
 */
export class UnknownFieldError extends AclConfigError {
  readonly key: string;
  readonly field: string;
  readonly where: string;
  constructor(key: string, where: string, field: string, detail: string) {
    super(`permission "${key}": condition ${where} on "${field}" ${detail}`);
    this.name = 'UnknownFieldError';
    this.key = key;
    this.field = field;
    this.where = where;
  }
}

/** A condition whose operator or comparand does not fit the declared type. */
export class FieldTypeMismatchError extends AclConfigError {
  readonly key: string;
  readonly field: string;
  readonly where: string;
  constructor(key: string, where: string, field: string, detail: string) {
    super(`permission "${key}": condition ${where} on "${field}" ${detail}`);
    this.name = 'FieldTypeMismatchError';
    this.key = key;
    this.field = field;
    this.where = where;
  }
}

/** A permission node whose own shape is not the canonical one. */
export class InvalidPermissionError extends AclConfigError {
  readonly key: string;
  readonly field: string;
  constructor(key: string, field: string, detail: string) {
    super(`permission "${key}": "${field}" ${detail}`);
    this.name = 'InvalidPermissionError';
    this.key = key;
    this.field = field;
  }
}

/**
 * A rule node that is not an object, or whose `when` is absent or not an array.
 *
 * `field` locates the rule inside the permission (`rules[2]`), so an author of a
 * foreign matrix can find it without a line number.
 */
export class InvalidRuleError extends AclConfigError {
  readonly key: string;
  readonly field: string;
  constructor(key: string, field: string, detail: string) {
    super(`permission "${key}": rule "${field}" ${detail}`);
    this.name = 'InvalidRuleError';
    this.key = key;
    this.field = field;
  }
}

/**
 * A condition whose shape, namespace, path depth, or operator/value pairing
 * leaves it unevaluable.
 *
 * `field` is the condition's own `field` where that is readable, and otherwise
 * the condition's position inside the permission.
 */
export class InvalidConditionError extends AclConfigError {
  readonly key: string;
  readonly field: string;
  readonly where: string;
  constructor(key: string, where: string, field: string, detail: string) {
    super(`permission "${key}": condition ${where} on "${field}" ${detail}`);
    this.name = 'InvalidConditionError';
    this.key = key;
    this.field = field;
    this.where = where;
  }
}

/** An unknown object kind at runtime on a typed (local) matrix. */
export class UnknownObjectKeyError extends AclConfigError {
  readonly key: ObjectKey;
  constructor(key: ObjectKey) {
    super(`object kind "${key}" is not configured in this matrix`);
    this.name = 'UnknownObjectKeyError';
    this.key = key;
  }
}

/** An unknown permission key at runtime on a typed (local) matrix. */
export class UnknownPermissionError extends AclConfigError {
  readonly key: string;
  constructor(key: string) {
    super(`permission "${key}" is not configured in this matrix`);
    this.name = 'UnknownPermissionError';
    this.key = key;
  }
}
