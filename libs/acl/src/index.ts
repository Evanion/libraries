/**
 * `@evanion/acl` -- a declarative, serializable access-control
 * matrix evaluated locally on whatever JS runtime is running.
 *
 * This entry is the universal core and imports no framework. The React
 * provider and hooks live in `@evanion/react-acl`.
 *
 * The engine's per-node functions -- `decide`, `decideFields`,
 * `evaluateCondition` -- are not exported. Each one answers a fragment of a
 * decision and leaves the rest to the caller: `decide` reads a resolved-parent
 * map only `createPolicy` builds, `decideFields` returns an `allowed` that
 * ignores the action-level gate, and a single condition outcome is not a
 * decision. `createPolicy` and `parseMatrix` compose them, and one of those two
 * is the entry point.
 */

export { createPolicy } from './create-policy.js';
export type {
  Access,
  AccessOptions,
  Authorized,
  Subject,
} from './create-policy.js';
export { applyDenyOverlay } from './deny-overlay.js';
export type { DenyOverlay, DenyOverlayOptions } from './deny-overlay.js';
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
export { pickAllowedFields } from './fields.js';

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
  MissingVetoSchemaError,
  TargetsTransitionsConflictError,
  UnknownDependencyError,
  UnknownFieldError,
  UnknownObjectKeyError,
  UnknownPermissionError,
  UnvetoablePermissionError,
} from './errors.js';

export type {
  Action,
  BaseFieldType,
  Cause,
  Condition,
  Decision,
  EvaluationContext,
  FieldConfig,
  FieldDecision,
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
