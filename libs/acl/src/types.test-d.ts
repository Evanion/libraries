import { describe, expectTypeOf, it } from 'vitest';

import type {
  Condition,
  Decision,
  FieldDecision,
  FieldState,
  Matrix,
  Permission,
  Reason,
} from './types.js';

describe('public types', () => {
  it('permission keys are object.action strings', () => {
    expectTypeOf<Permission['key']>().toEqualTypeOf<string>();
  });

  it('a decision carries an allowed boolean and a reason', () => {
    expectTypeOf<Decision['allowed']>().toEqualTypeOf<boolean>();
    expectTypeOf<Decision['reason']>().toEqualTypeOf<Reason>();
  });

  it('field decisions are tri-state', () => {
    expectTypeOf<FieldState>().toEqualTypeOf<
      'allowed' | 'denied' | 'unevaluable'
    >();
    expectTypeOf<FieldDecision['fields']>().toEqualTypeOf<
      Record<string, FieldState>
    >();
  });

  it('a condition is either a time window or a field comparison', () => {
    expectTypeOf<Condition>().toMatchTypeOf<{
      field: string;
      op: string;
    }>();
  });

  it('the matrix is a flat permission list', () => {
    expectTypeOf<Matrix>().toEqualTypeOf<readonly Permission[]>();
  });
});
