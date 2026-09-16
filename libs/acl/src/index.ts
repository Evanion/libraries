/**
 * `@evanion/acl` -- a declarative, serializable access-control
 * matrix evaluated locally on whatever JS runtime is running.
 *
 * This entry is the universal core and imports no framework. The React
 * provider and hooks live in `@evanion/react-acl`.
 */

export { createPolicy } from './create-policy.js';
export type {
  Access,
  AccessOptions,
  Authorized,
  Subject,
} from './create-policy.js';
export { parseMatrix } from './parse-matrix.js';
export { policy, permit, always, and, or, eq, contains } from './authoring.js';
export type { PermitBuilder, PolicyConfig } from './authoring.js';
export { evaluateCondition } from './conditions.js';
export { decide } from './evaluate.js';
export { decideFields, pickAllowedFields } from './fields.js';

export {
  AclConfigError,
  ActionNotAllowedError,
  BangInAllowListError,
  DenyWithoutBaselineError,
  DuplicatePermissionError,
  FeatureCycleError,
  InvalidConditionError,
  InvalidMatrixError,
  InvalidPermissionError,
  InvalidRuleError,
  KeyMismatchError,
  TargetsTransitionsConflictError,
  UnknownDependencyError,
  UnknownObjectKeyError,
  UnknownPermissionError,
} from './errors.js';

export type {
  Action,
  Cause,
  Condition,
  ConditionOutcome,
  Decision,
  EvaluationContext,
  FieldConfig,
  FieldDecision,
  FieldOutcome,
  FieldReason,
  FieldRules,
  FieldState,
  Instant,
  Matrix,
  ObjectKey,
  Permission,
  Reason,
  Rule,
} from './types.js';
