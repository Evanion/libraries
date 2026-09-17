import { describe, expect, it } from 'vitest';

import * as api from './index.js';

/**
 * The runtime exports, restated rather than derived, so adding one is a
 * deliberate edit to this list and not a side effect of a barrel edit.
 *
 * The engine's per-node functions stay off it. Each answers a fragment of a
 * decision and leaves the rest to the caller -- `decide` takes a permission
 * node the gate never checked, `decideFields` returns an `allowed` that ignores
 * the action-level gate -- so exporting one hands a consumer a guard that
 * refuses or grants on data it never supplied.
 */
const RUNTIME_EXPORTS = [
  'AclConfigError',
  'ActionNotAllowedError',
  'BangInAllowListError',
  'DenyWithoutBaselineError',
  'DuplicatePermissionError',
  'FieldTypeMismatchError',
  'InvalidConditionError',
  'InvalidMatrixError',
  'InvalidPermissionError',
  'InvalidRuleError',
  'InvalidSchemaError',
  'KeyMismatchError',
  'MissingVetoSchemaError',
  'OriginCollisionError',
  'TargetsTransitionsConflictError',
  'UnknownFieldError',
  'UnknownObjectKeyError',
  'UnknownPermissionError',
  'UnvetoablePermissionError',
  'applyDenyOverlay',
  'federatedPolicies',
  'hydratePolicy',
  'parseMatrix',
  'pickAllowedFields',
  'policy',
];

describe('the package entry', () => {
  it('exports exactly the documented runtime surface', () => {
    expect(Object.keys(api).sort()).toEqual([...RUNTIME_EXPORTS].sort());
  });

  it('does not export the engine per-node functions', () => {
    for (const name of ['decide', 'decideFields', 'evaluateCondition']) {
      expect(api).not.toHaveProperty(name);
    }
  });
});
