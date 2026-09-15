/**
 * `@evanion/authorization` -- a declarative, serializable access-control
 * matrix evaluated locally on whatever JS runtime is running.
 *
 * This entry is the universal core and imports no framework. The React
 * provider and hooks live in `@evanion/react-authorization`.
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
export { decideFields } from './fields.js';

export {
  AuthorizationConfigError,
  BangInAllowListError,
  DenyWithoutBaselineError,
  DuplicatePermissionError,
  FeatureCycleError,
  TargetsTransitionsConflictError,
  UnknownDependencyError,
  UnknownObjectKeyError,
  UnknownPermissionError,
} from './errors.js';

export type {
  Action,
  Cause,
  Condition,
  Decision,
  EvaluationContext,
  FieldConfig,
  FieldDecision,
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
