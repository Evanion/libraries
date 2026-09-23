/**
 * `@evanion/feature` -- dependency-aware feature toggles.
 *
 * This entry is the core and imports no framework. It is what the API and the
 * build-time pass use. The React provider and hooks live on `@evanion/feature/react`.
 */
export { createFeatures } from './lib/features.js';
export type { Features } from './lib/features.js';

export { bucketOf, inRollout, murmur3 } from './lib/bucketing.js';
export { assignVariant, variantSeedOf } from './lib/variants.js';
export type { VariantAssignment } from './lib/variants.js';
export { evaluateCondition } from './lib/conditions.js';
export { canonical } from './lib/canonical.js';
export { ruleId } from './lib/rule-id.js';
export { DEFAULT_ROLLOUT_FIELD } from './lib/evaluate.js';

export {
  DuplicateFeatureError,
  DuplicateVariantError,
  FeatureConfigError,
  FeatureCycleError,
  UnknownDependencyError,
  UnknownVariantError,
} from './lib/errors.js';

export type {
  AttributeCondition,
  Cause,
  Condition,
  DayOfWeekCondition,
  Decision,
  Decisions,
  EvaluationContext,
  FeatureDefinition,
  FeatureKey,
  Instant,
  Plan,
  PlanEntry,
  Reason,
  RolloutSpec,
  Rule,
  RuleOutcome,
  ToggleResult,
  VariantSpec,
  Weekday,
  WindowCondition,
} from './lib/types.js';
