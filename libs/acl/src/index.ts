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
 *
 * `ruleId` is exported despite being internal to evaluation, because it grants
 * nothing and answers the whole of its question: what a given rule reports as
 * `Decision.rule`. A test that wants to name the rule it expects calls it
 * rather than writing the derived hash into an assertion.
 */

export { hydratePolicy } from './hydrate-policy.js';
export type {
  Access,
  AccessOptions,
  ActionOf,
  AnyObjects,
  Authorized,
  BoundKind,
  KeysOf,
  Subject,
} from './hydrate-policy.js';
export { applyDenyOverlay } from './deny-overlay.js';
export type { DenyOverlay, DenyOverlayOptions } from './deny-overlay.js';
export { parseMatrix } from './parse-matrix.js';
export { ruleId } from './rule-id.js';
export { federatedPolicies } from './federated-policies.js';
export type { FederatedAccess } from './federated-policies.js';
export { serialize } from './serialize.js';
export type { SerializeMode, SerializeOptions } from './serialize.js';
export { policy, CRUD_ACTIONS } from './authoring.js';
export type {
  Actions,
  Cond,
  Action,
  Operand,
  Ops,
  Paths,
  PermissionKeys,
  Policy,
  PolicyOptions,
  Valid,
  Visibility,
  VocabularyOf,
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
