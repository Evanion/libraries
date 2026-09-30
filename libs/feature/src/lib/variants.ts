import { bucketOf } from './bucketing.js';
import {
  DuplicateVariantError,
  FeatureConfigError,
  UnknownVariantError,
} from './errors.js';
import { DEFAULT_ROLLOUT_FIELD } from './fields.js';
import type { ConfigIssueCode } from './config.js';
import type {
  EvaluationContext,
  FeatureDefinition,
  FeatureKey,
  Rule,
  VariantSpec,
} from './types.js';

/**
 * One defect in a feature's variants, with the code and the member it reports.
 *
 * The code is built where the error is built. `variantErrors` raises a bare
 * `FeatureConfigError` for every defect below that no error class names, so the
 * text it wrote is all a reader of the error object has to separate them by, and
 * each of those messages interpolates the feature key and the variant name a
 * document author chose. A feature keyed `mixes two orderings` would classify as
 * a partial order declaration under a reader that matched on the text, and a
 * caller switching on the code acts on the defect the code names.
 *
 * `member` is the member of the definition the defect sits on, which
 * `collectIssues` writes into the issue's JSON pointer. `variantBy` and
 * `variantSeed` sit beside `variants` on the definition, so a defect naming one
 * of them points an operator at the member they edit.
 */
export interface VariantDefect {
  readonly error: FeatureConfigError;
  readonly code: ConfigIssueCode;
  readonly member: VariantMember;
}

/** A member of a definition a variant defect reports against. */
export type VariantMember = 'variants' | 'rules' | 'variantBy' | 'variantSeed';

/**
 * What the checker reads the variant order off.
 *
 * `createFeatures` reads a TypeScript literal, where the array in the source
 * file is the order its author wrote, so a variant declaring no `order` takes
 * its index and the document is the literal. A served document reaches a holder
 * through a store and a code generator, either of which may permute the array
 * while every member it carries stays the same, so § 3 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` has the checker refuse
 * one whose variants declare no order at all.
 *
 * `variantSeed` and `variantBy` are named in that same paragraph and carry the
 * same rule. § 3 is written for the case where a publisher emitted a member and
 * a negotiation layer stripped it, and the GrowthBook failure it cites is a
 * stripped `hashVersion`. `serializeConfig` writes both members on every
 * definition carrying variants, so a served document that arrives without one
 * lost it in transit, and `assignVariant` would bucket on
 * `DEFAULT_ROLLOUT_FIELD` and the seed `variantSeedOf` composes while the
 * publisher bucketed on what it wrote. So this check refuses a served document
 * missing either one, and `arrayIsOrder` exempts the literal `createFeatures`
 * reads, where the author who omitted the member is the party the default
 * answers.
 */
export interface VariantCheckOptions {
  /** Whether the array order of `variants` is the order assignment walks. */
  readonly arrayIsOrder?: boolean;
  /**
   * Whether `rules` is an array the pin walk may read `rule.variant` off.
   *
   * `collectIssues` passes `false` for a definition whose `rules` member arrived
   * as something other than an array, which it has already reported as
   * `unknown-member`. The pins are the only check in `variantErrors` that reads
   * `rules`, and § 7 of
   * `docs/specs/2026-09-23-feature-config-distribution.md` has the checker
   * report every issue it finds, so the name, the weight, the order, the total
   * and the two bucketing members are still checked over a `variants` array the
   * shape walk read. An operator who fixes `rules` and re-polls meets no issue
   * that was in the document all along.
   */
  readonly rulePins?: boolean;
}

/** What a holder does with a stripped member, for the message that refuses it. */
const FILLS: Readonly<Record<'variantBy' | 'variantSeed', string>> = {
  variantBy: 'buckets every subject on another context field',
  variantSeed: 'hashes every subject against another seed',
};

/** A defect and its code, for the checks that raise a bare error. */
function bare(
  code: ConfigIssueCode,
  member: VariantMember,
  message: string,
): VariantDefect {
  return { error: new FeatureConfigError(message), code, member };
}

/**
 * Every configuration defect in a feature's variants, in the order a reader
 * meets them.
 *
 * Every case below is a configuration error with no sensible evaluation result.
 * A set with two names cannot answer which one a pin meant, a set whose weights
 * are all zero or whose total overflows has no band to assign into, and a
 * partial `order` declaration mixes two orderings and reads as a typo either
 * way.
 *
 * `validateVariants` throws the first of these and `collectIssues` reports all
 * of them, so one object produces the message both paths carry.
 *
 * Two checks stay conditional on what came before. An empty set ends the walk,
 * because the names a pin is held against are the names this array declares and
 * an empty one would refuse every pin a reader has not been told to look at.
 * A refused weight ends the total, because a share the checker already named is
 * the member an author edits and the sum over the rest describes no second
 * defect.
 *
 * Two checks read the document a store served and not the literal an author
 * wrote, and `arrayIsOrder` is what separates them: the missing `order` above,
 * and the `variantBy` and `variantSeed` § 3 has travel whole.
 *
 * Every variant and every rule arrives as the object its type declares.
 * `collectIssues` refuses a document whose `variants` is not an array of objects
 * before it reaches this function, and turns `rulePins` off where `rules` is the
 * member it could not read.
 */
export function variantErrors<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  options: VariantCheckOptions = {},
): readonly VariantDefect[] {
  const found: VariantDefect[] = [];
  const key = String(definition.key);
  const variants = definition.variants;
  const pins: readonly Rule[] =
    options.rulePins === false ? [] : (definition.rules ?? []);
  if (!variants) {
    for (const rule of pins) {
      if (rule.variant !== undefined) {
        found.push({
          error: new UnknownVariantError(key, rule.variant),
          code: 'unknown-variant',
          member: 'rules',
        });
      }
    }
    return found;
  }

  if (variants.length === 0) {
    found.push(
      bare(
        'empty-variants',
        'variants',
        `feature "${key}" declares an empty variants array, which leaves no variant to assign`,
      ),
    );
    return found;
  }

  const names = new Set<string>();
  const orders = new Set<number>();
  let declaredOrders = 0;
  let total = 0;
  let unusableWeight = false;

  for (const variant of variants) {
    if (names.has(variant.name)) {
      found.push({
        error: new DuplicateVariantError(key, variant.name),
        code: 'duplicate-variant',
        member: 'variants',
      });
    }
    names.add(variant.name);

    if (!Number.isFinite(variant.weight) || variant.weight < 0) {
      found.push(
        bare(
          'invalid-weight',
          'variants',
          `feature "${key}" gives the variant "${variant.name}" the weight ${String(variant.weight)}, which is not a usable share`,
        ),
      );
      unusableWeight = true;
    } else {
      total += variant.weight;
    }

    if (variant.order !== undefined) {
      declaredOrders += 1;
      if (!Number.isInteger(variant.order) || variant.order < 0) {
        found.push(
          bare(
            'invalid-variant-order',
            'variants',
            `feature "${key}" gives the variant "${variant.name}" the order ${String(variant.order)}, which is not a non-negative integer`,
          ),
        );
      } else if (orders.has(variant.order)) {
        found.push(
          bare(
            'duplicate-variant-order',
            'variants',
            `feature "${key}" gives two variants the order ${String(variant.order)}, which leaves the walk between them undefined`,
          ),
        );
      }
      orders.add(variant.order);
    }
  }

  if (!unusableWeight) {
    if (total <= 0) {
      found.push(
        bare(
          'zero-weights',
          'variants',
          `feature "${key}" gives every variant the weight zero, which leaves no variant to assign`,
        ),
      );
    }
    if (!Number.isFinite(total)) {
      found.push(
        bare(
          'zero-weights',
          'variants',
          `feature "${key}" gives its variants a weight total of ${String(total)}, which overflows and leaves no usable share`,
        ),
      );
    }
  }

  if (declaredOrders === 0 && options.arrayIsOrder !== true) {
    // The spec's 18 codes name no missing member, and this is the same thing an
    // operator fixes as the partial declaration below: the orders the document
    // carries are not the ones the walk needs.
    //
    // A one-variant set is refused too, although its single ordering assigns
    // what any permutation of it assigns. § 3 states the rule over the member
    // and not over the array length, and a publisher that omits `order` at
    // length one has its whole document refused the day an author adds a second
    // variant. `serializeConfig` writes an order on every variant it emits, so
    // no document this package produces meets this refusal.
    found.push(
      bare(
        'invalid-variant-order',
        'variants',
        `feature "${key}" declares an order on none of its ${String(variants.length)} variants, which leaves the walk to an array order a store may permute`,
      ),
    );
  } else if (declaredOrders > 0 && declaredOrders !== variants.length) {
    found.push(
      bare(
        'invalid-variant-order',
        'variants',
        `feature "${key}" declares an order on ${String(declaredOrders)} of its ${String(variants.length)} variants, which mixes two orderings`,
      ),
    );
  }

  if (options.arrayIsOrder !== true) {
    // `unknown-member`, because the 18 codes of § 7 name no missing member and
    // § 3 gives that code to a member whose value this holder cannot read. A
    // document carrying no readable `variantBy` carries no bucketing field, and
    // an operator fixes the same member either way.
    for (const member of ['variantBy', 'variantSeed'] as const) {
      if (typeof definition[member] === 'string') continue;
      found.push(
        bare(
          'unknown-member',
          member,
          `feature "${key}" declares variants and no "${member}" this checker can read, and a holder that fills the gap ${FILLS[member]}`,
        ),
      );
    }
  }

  for (const rule of pins) {
    if (rule.variant !== undefined && !names.has(rule.variant)) {
      found.push({
        error: new UnknownVariantError(key, rule.variant),
        code: 'unknown-variant',
        member: 'rules',
      });
    }
  }

  return found;
}

/**
 * Checks a feature's variants at construction, where the dependency graph is
 * already checked.
 *
 * The definitions a caller supplies are the document, so a variant that declares
 * no `order` takes its index and this function reports nothing about it.
 *
 * @throws {DuplicateVariantError} when two variants share a name.
 * @throws {UnknownVariantError} when a rule pins a variant nobody declared.
 * @throws {FeatureConfigError} for an unusable weight, an unusable order, an
 * empty set, or a weight total that is zero or not finite.
 */
export function validateVariants<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
): void {
  const found = variantErrors(definition, { arrayIsOrder: true });
  if (found[0]) throw found[0].error;
}

/**
 * Where one variant sits in the bucketing walk.
 *
 * `order` decides it and the array index supplies it when an author left it
 * out. `bucketingOrder` sorts on this function and `serializeConfig` writes
 * what it returns into the document, so the two read one defaulting and a
 * document a control plane permutes assigns what the store assigned.
 */
export function bucketingPosition(variant: VariantSpec, index: number): number {
  return variant.order ?? index;
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
    .map((variant, index) => ({
      variant,
      at: bucketingPosition(variant, index),
    }))
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
 * An author appending a variant and taking its weight from the
 * previously-last one bounds the damage: the walk in `order` moves subjects
 * only between those two bands.
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

/** How a subject reached its variant. Output only. */
export interface VariantAssignment {
  variant: VariantSpec;
  source: 'weighted' | 'sticky' | 'fallback';
  by: string;
  /** Absent when the context carried no bucketing value. */
  bucket?: number;
}

/**
 * The variant a context gets, for a feature that resolved on.
 *
 * Three answers in order. A prior assignment the application stored wins, when
 * it names a variant this feature still declares. The weights answer next, for
 * a context carrying a usable bucketing value. The control answers last.
 *
 * The control is the honest answer for an incomplete context. The feature
 * resolved on, so calling code needs a variant to render, and the control
 * admits nobody to the experiment. `evaluateRule` refuses a rollout the same
 * way when the context carries no bucketing value, so neither ramps anybody in
 * on missing data.
 *
 * A pin from a matching rule beats all three, and `decide` applies it, because
 * only `decide` knows which rule matched.
 *
 * This definition must come from `createFeatures`, or have already passed
 * `validateVariants` on its own. A weight that is non-finite, negative, or
 * sums to zero across the set never throws here; `assignWeighted` always
 * returns the last-ordered variant. Two variants sharing an `order` never
 * throw either; the second one declared wins every tie. Every one of these
 * outcomes is deterministic and wrong.
 */
export function assignVariant<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  context: EvaluationContext,
): VariantAssignment | undefined {
  const variants = definition.variants;
  if (!variants || variants.length === 0) return undefined;

  const by = definition.variantBy ?? DEFAULT_ROLLOUT_FIELD;

  const key = String(definition.key);
  const stickyVariants = context.stickyVariants;
  // A bare index walks the prototype chain, so a feature keyed `constructor`
  // or `toString` reads a function off `Object.prototype` when no entry is
  // stored. `useFeature` in react/index.tsx guards the same read the same
  // way.
  const stored =
    stickyVariants && Object.prototype.hasOwnProperty.call(stickyVariants, key)
      ? stickyVariants[key]
      : undefined;
  if (stored !== undefined) {
    const held = variants.find((variant) => variant.name === stored);
    if (held) return { variant: held, source: 'sticky', by };
  }

  const value = context[by];
  if (typeof value !== 'string' && typeof value !== 'number') {
    const [control] = bucketingOrder(variants);
    return { variant: control as VariantSpec, source: 'fallback', by };
  }

  const bucket = bucketOf(String(value), variantSeedOf(definition));
  return {
    variant: assignWeighted(variants, bucket),
    source: 'weighted',
    by,
    bucket,
  };
}
