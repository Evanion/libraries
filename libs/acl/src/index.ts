/**
 * `@evanion/acl` -- a declarative, serializable access-control
 * matrix evaluated locally on whatever JS runtime is running.
 *
 * This entry is the universal core and imports no framework. The React
 * provider and hooks live in `@evanion/react-acl`.
 *
 * The engine's per-node functions -- `decide`, `decideFields`,
 * `evaluateCondition` -- are not exported. Each one answers a fragment of a
 * decision and leaves the rest to the caller: `decide` takes a permission node
 * the gate never checked, `decideFields` returns an `allowed` that ignores the
 * action-level gate, and a single condition outcome is not a decision.
 * `hydratePolicy` and `parseMatrix` compose them, and one of those two is the
 * entry point.
 */

export { hydratePolicy } from './hydrate-policy.js';
export type {
  Access,
  AccessOptions,
  AnyObjects,
  Authorized,
  BoundKind,
  Subject,
} from './hydrate-policy.js';
export { applyDenyOverlay } from './deny-overlay.js';
export type { DenyOverlay, DenyOverlayOptions } from './deny-overlay.js';
export { parseMatrix } from './parse-matrix.js';
export { federatedPolicies } from './federated-policies.js';
export type { FederatedAccess } from './federated-policies.js';
export { serialize } from './serialize.js';
export type { SerializeMode, SerializeOptions } from './serialize.js';
export { policy } from './authoring.js';
export type {
  Actions,
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
  FieldTypeMismatchError,
  InvalidConditionError,
  InvalidFreshnessError,
  InvalidMatrixError,
  InvalidPermissionError,
  InvalidRuleError,
  InvalidSchemaError,
  KeyMismatchError,
  MissingFreshnessBudgetError,
  MissingVetoSchemaError,
  OriginCollisionError,
  TargetsTransitionsConflictError,
  UnknownFieldError,
  UnknownObjectKeyError,
  UnknownPermissionError,
  UnpublishedVetoableError,
  UnvetoablePermissionError,
} from './errors.js';

export type {
  Action,
  BaseFieldType,
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
