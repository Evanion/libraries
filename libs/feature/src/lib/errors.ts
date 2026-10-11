import type { FeatureKey } from './types.js';

/**
 * `FeatureConfigError` is the base class for every error that
 * `@evanion/feature` throws. While the five classes extending it are raised
 * exclusively by `createFeatures`, `FeatureConfigError` itself is raised by
 * `createFeatures` as well as by `snapshot`, when `context.now` holds a `Date`
 * that names no instant, and by `serializeConfig`, when the configuration
 * holds a value the wire format cannot carry. The functions `resolve`, `plan`,
 * and `toggle` raise none of them.
 *
 * To ensure a store a caller holds cannot fail mid-evaluation,
 * `@evanion/feature` enforces constraints over a configuration where it is
 * supplied rather than where it is read. This mirrors the split between
 * `createLuhn`/`createToken` and their operations in `@evanion/luhn` and
 * `@evanion/token`. The two raises occurring outside of construction read an
 * argument the call itself supplies: `snapshot` reads the context it is
 * handed, and `serializeConfig` answers what a JSON document can carry rather
 * than what the store resolved under.
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

/** Two variants of one feature share a name, so a pin names both. */
export class DuplicateVariantError extends FeatureConfigError {
  readonly feature: string;
  readonly variant: string;

  constructor(feature: string, variant: string) {
    super(`feature "${feature}" declares the variant "${variant}" twice`);
    this.name = 'DuplicateVariantError';
    this.feature = feature;
    this.variant = variant;
  }
}

/** A rule pins a variant its feature does not declare. */
export class UnknownVariantError extends FeatureConfigError {
  readonly feature: string;
  readonly variant: string;

  constructor(feature: string, variant: string) {
    super(
      `feature "${feature}" has a rule pinning "${variant}", which it does not declare`,
    );
    this.name = 'UnknownVariantError';
    this.feature = feature;
    this.variant = variant;
  }
}
