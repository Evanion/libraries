import type { ObjectKey } from './types.js';

/** Base class for every error this library throws. All raised at construction. */
export class AuthorizationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationConfigError';
  }
}

/** A dependency cycle. Rejected because resolution order is undefined. */
export class FeatureCycleError extends AuthorizationConfigError {
  readonly path: readonly string[];
  constructor(path: readonly string[]) {
    super(`permission dependency cycle: ${path.join(' -> ')}`);
    this.name = 'FeatureCycleError';
    this.path = path;
  }
}

/** A `dependsOn` naming a permission that is not configured. */
export class UnknownDependencyError extends AuthorizationConfigError {
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
export class DuplicatePermissionError extends AuthorizationConfigError {
  readonly key: string;
  constructor(key: string) {
    super(`duplicate permission key "${key}"`);
    this.name = 'DuplicatePermissionError';
    this.key = key;
  }
}

/** A `!` entry in `fields()` has no `*` baseline. */
export class DenyWithoutBaselineError extends AuthorizationConfigError {
  constructor(field: string) {
    super(
      `field "${field}" has no baseline: a deny entry requires a '*' baseline (or an explicit allow-list) to say what is allowed`,
    );
    this.name = 'DenyWithoutBaselineError';
  }
}

/** A `!` entry mixed into an explicit allow-list. */
export class BangInAllowListError extends AuthorizationConfigError {
  constructor(field: string) {
    super(
      `field "${field}" is denied inside an explicit allow-list, which already denies anything not listed`,
    );
    this.name = 'BangInAllowListError';
  }
}

/** Both `targets` and `transitions` on one field. */
export class TargetsTransitionsConflictError extends AuthorizationConfigError {
  constructor(field: string) {
    super(
      `field "${field}" configures both targets and transitions, which are mutually exclusive`,
    );
    this.name = 'TargetsTransitionsConflictError';
  }
}

/** An unknown object kind at runtime on a typed (local) matrix. */
export class UnknownObjectKeyError extends AuthorizationConfigError {
  readonly key: ObjectKey;
  constructor(key: ObjectKey) {
    super(`object kind "${key}" is not configured in this matrix`);
    this.name = 'UnknownObjectKeyError';
    this.key = key;
  }
}

/** An unknown permission key at runtime on a typed (local) matrix. */
export class UnknownPermissionError extends AuthorizationConfigError {
  readonly key: string;
  constructor(key: string) {
    super(`permission "${key}" is not configured in this matrix`);
    this.name = 'UnknownPermissionError';
    this.key = key;
  }
}
