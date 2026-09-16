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
export { policy } from './authoring.js';
export type {
  Actions,
  BoundKind,
  Cond,
  Operand,
  Ops,
  Paths,
  Policy,
  PolicyOptions,
  Valid,
} from './authoring.js';
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
  FieldTypeMismatchError,
  InvalidConditionError,
  InvalidMatrixError,
  InvalidPermissionError,
  InvalidRuleError,
  InvalidSchemaError,
  KeyMismatchError,
  TargetsTransitionsConflictError,
  UnknownDependencyError,
  UnknownFieldError,
  UnknownObjectKeyError,
  UnknownPermissionError,
} from './errors.js';

export type {
  Action,
  BaseFieldType,
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
  FieldType,
  Instant,
  Matrix,
  MatrixSchema,
  ObjectKey,
  ObjectSchema,
  Permission,
  Reason,
  Rule,
} from './types.js';
