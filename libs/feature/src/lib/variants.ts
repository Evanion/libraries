import {
  DuplicateVariantError,
  FeatureConfigError,
  UnknownVariantError,
} from './errors.js';
import type { FeatureDefinition, FeatureKey, VariantSpec } from './types.js';

/**
 * Checks a feature's variants at construction, where the dependency graph is
 * already checked.
 *
 * Every case below is a configuration error with no sensible evaluation result.
 * A set with two names cannot answer which one a pin meant, a set whose weights
 * are all zero or whose total overflows has no band to assign into, and a
 * partial `order` declaration mixes two orderings and reads as a typo either
 * way.
 *
 * @throws {DuplicateVariantError} when two variants share a name.
 * @throws {UnknownVariantError} when a rule pins a variant nobody declared.
 * @throws {FeatureConfigError} for an unusable weight, an unusable order, an
 * empty set, or a weight total that is zero or not finite.
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
  if (!Number.isFinite(total)) {
    throw new FeatureConfigError(
      `feature "${key}" gives its variants a weight total of ${String(total)}, which overflows and leaves no usable share`,
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

/**
 * The variants in the order assignment walks them.
 *
 * `order` decides the walk and the array index supplies it when an author left
 * it out, so a document whose array a serializer permuted assigns identically
 * once a control plane has written an explicit order. `validateVariants`
 * refuses a partial declaration, so either every variant carries one or none
 * does.
 *
 * The returned array is a copy. A caller's configuration is frozen and this
 * function sorts.
 */
export function bucketingOrder(
  variants: readonly VariantSpec[],
): readonly VariantSpec[] {
  return [...variants]
    .map((variant, index) => ({ variant, at: variant.order ?? index }))
    .sort((a, b) => a.at - b.at)
    .map((each) => each.variant);
}

/**
 * The variant a bucket falls to.
 *
 * Weights are normalised across the set and laid out as cumulative bands over
 * [0, 1) in bucketing order. A bucket landing exactly on a boundary falls in
 * the upper band, which is the same rule `inRollout` uses when it compares
 * strictly below its threshold.
 *
 * One property of rollout bucketing does not carry over. A rollout percentage
 * is monotonic, so raising it only admits more subjects and moves none out. A
 * weight is a band boundary, so moving one reassigns every subject above it.
 * Walking in `order` bounds the damage: an author appending a variant and
 * taking its weight from the previously-last one moves subjects only between
 * those two bands.
 *
 * `validateVariants` has already refused an empty set and a set weighted
 * entirely zero, so the final variant is always reachable and the loop always
 * returns.
 */
export function assignWeighted(
  variants: readonly VariantSpec[],
  bucket: number,
): VariantSpec {
  const ordered = bucketingOrder(variants);
  const total = ordered.reduce((sum, each) => sum + each.weight, 0);

  let ceiling = 0;
  for (const variant of ordered) {
    ceiling += variant.weight / total;
    // Strictly below, so a variant weighted zero widens no band and a bucket
    // on a boundary belongs to the band above it.
    if (bucket < ceiling) return variant;
  }

  // Floating point can leave the final ceiling a hair under 1. The last band
  // owns whatever is left.
  return ordered[ordered.length - 1] as VariantSpec;
}

/**
 * The seed a feature's variant assignment buckets on.
 *
 * The default appends to whatever the rollout seeds on, so the two buckets are
 * independent. Hashing the same pair for both puts every member of a 20%
 * rollout in the lowest 20% of the variant space, so a 50/50 split hands all of
 * them the control and the experiment measures nothing. Unleash seeds a rollout
 * with 0 and a variant with 86028157, and PostHog salts one with `""` and the
 * other with `"variant"`, for this reason.
 */
export function variantSeedOf<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
): string {
  if (definition.variantSeed !== undefined) return definition.variantSeed;
  return `${definition.seed ?? String(definition.key)}:variant`;
}
