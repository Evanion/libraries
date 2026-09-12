/**
 * `@evanion/feature` -- dependency-aware feature toggles.
 *
 * This entry is the core and imports no framework. It is what the API and the
 * build-time pass use. The React provider and hooks live on `@evanion/feature/react`.
 */
export { createFeatures } from './lib/features.js';
export type { Features } from './lib/features.js';

export { bucketOf, inRollout, murmur3 } from './lib/bucketing.js';
export { evaluateCondition } from './lib/conditions.js';
export { DEFAULT_ROLLOUT_FIELD } from './lib/evaluate.js';

export {
  DuplicateFeatureError,
  FeatureConfigError,
  FeatureCycleError,
  UnknownDependencyError,
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
  Weekday,
  WindowCondition,
} from './lib/types.js';
