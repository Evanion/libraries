import {
  DuplicateVariantError,
  FeatureConfigError,
  UnknownVariantError,
} from './errors.js';
import type { FeatureDefinition, FeatureKey } from './types.js';

/**
 * Checks a feature's variants at construction, where the dependency graph is
 * already checked.
 *
 * Every case below is a configuration error with no sensible evaluation result.
 * A set with two names cannot answer which one a pin meant, a set whose weights
 * are all zero has no band to assign into, and a partial `order` declaration
 * mixes two orderings and reads as a typo either way.
 *
 * @throws {DuplicateVariantError} when two variants share a name.
 * @throws {UnknownVariantError} when a rule pins a variant nobody declared.
 * @throws {FeatureConfigError} for an unusable weight, an unusable order, or an
 * empty set.
 */
export function validateVariants<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
): void {
  const key = String(definition.key);
  const variants = definition.variants;
  if (!variants) return;

  if (variants.length === 0) {
    throw new FeatureConfigError(
      `feature "${key}" declares an empty variants array, which leaves no variant to assign`,
    );
  }

  const names = new Set<string>();
  const orders = new Set<number>();
  let declaredOrders = 0;
  let total = 0;

  for (const variant of variants) {
    if (names.has(variant.name)) {
      throw new DuplicateVariantError(key, variant.name);
    }
    names.add(variant.name);

    if (!Number.isFinite(variant.weight) || variant.weight < 0) {
      throw new FeatureConfigError(
        `feature "${key}" gives the variant "${variant.name}" the weight ${String(variant.weight)}, which is not a usable share`,
      );
    }
    total += variant.weight;

    if (variant.order !== undefined) {
      declaredOrders += 1;
      if (!Number.isInteger(variant.order) || variant.order < 0) {
        throw new FeatureConfigError(
          `feature "${key}" gives the variant "${variant.name}" the order ${String(variant.order)}, which is not a non-negative integer`,
        );
      }
      if (orders.has(variant.order)) {
        throw new FeatureConfigError(
          `feature "${key}" gives two variants the order ${String(variant.order)}, which leaves the walk between them undefined`,
        );
      }
      orders.add(variant.order);
    }
  }

  if (total <= 0) {
    throw new FeatureConfigError(
      `feature "${key}" gives every variant the weight zero, which leaves no variant to assign`,
    );
  }

  if (declaredOrders > 0 && declaredOrders !== variants.length) {
    throw new FeatureConfigError(
      `feature "${key}" declares an order on ${String(declaredOrders)} of its ${String(variants.length)} variants, which mixes two orderings`,
    );
  }

  for (const rule of definition.rules ?? []) {
    if (rule.variant !== undefined && !names.has(rule.variant)) {
      throw new UnknownVariantError(key, rule.variant);
    }
  }
}
