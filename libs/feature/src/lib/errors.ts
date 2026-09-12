import type { FeatureKey } from './types.js';

/**
 * Base class for every error this library throws. All of them are raised by
 * `createFeatures`; `resolve`, `plan` and `toggle` are total.
 *
 * Constraints are enforced where the configuration is supplied rather than
 * where it is read, so a store a caller holds cannot fail mid-evaluation. It is
 * the same split `@evanion/luhn` and `@evanion/token` draw between
 * `createLuhn`/`createToken` and their operations.
 */
export class FeatureConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeatureConfigError';
  }
}

/**
 * A dependency cycle. Resolution order is undefined for a cycle, so this is
 * rejected rather than broken arbitrarily.
 */
export class FeatureCycleError extends FeatureConfigError {
  /** The closed walk, ending where it starts, so the closing edge is visible. */
  readonly path: readonly FeatureKey[];

  constructor(path: readonly FeatureKey[]) {
    super(`feature dependency cycle: ${path.join(' -> ')}`);
    this.name = 'FeatureCycleError';
    this.path = path;
  }
}

/** A `dependsOn` naming a feature that is not in the configuration. */
export class UnknownDependencyError extends FeatureConfigError {
  readonly key: FeatureKey;
  readonly dependency: FeatureKey;

  constructor(key: FeatureKey, dependency: FeatureKey) {
    super(
      `feature "${String(key)}" depends on "${String(
        dependency,
      )}", which is not configured`,
    );
    this.name = 'UnknownDependencyError';
    this.key = key;
    this.dependency = dependency;
  }
}

/** Two definitions with the same key. */
export class DuplicateFeatureError extends FeatureConfigError {
  readonly key: FeatureKey;

  constructor(key: FeatureKey) {
    super(`duplicate feature key "${String(key)}"`);
    this.name = 'DuplicateFeatureError';
    this.key = key;
  }
}
