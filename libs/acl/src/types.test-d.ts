import { describe, expectTypeOf, it } from 'vitest';

import type { Access, AccessOptions } from './create-policy.js';
import type {
  Condition,
  Decision,
  EvaluationContext,
  FieldDecision,
  FieldState,
  FieldType,
  Instant,
  Matrix,
  MatrixSchema,
  ObjectSchema,
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

  it('the matrix is an envelope over a flat permission list', () => {
    expectTypeOf<Matrix['permissions']>().toEqualTypeOf<
      readonly Permission[]
    >();
    expectTypeOf<Matrix['version']>().toEqualTypeOf<
      string | number | undefined
    >();
    expectTypeOf<Matrix['schema']>().toEqualTypeOf<MatrixSchema | undefined>();
  });

  it('a version is a string or a number on both the document and the access object', () => {
    expectTypeOf<Access['version']>().toEqualTypeOf<Matrix['version']>();
    expectTypeOf<AccessOptions['version']>().toEqualTypeOf<Matrix['version']>();
  });

  it('a declared field type carries its array and optional suffixes', () => {
    expectTypeOf<'string'>().toMatchTypeOf<FieldType>();
    expectTypeOf<'instant[]?'>().toMatchTypeOf<FieldType>();
    expectTypeOf<ObjectSchema['fields']>().toEqualTypeOf<
      Readonly<Record<string, FieldType>> | undefined
    >();
  });

  it('a context clock takes every instant form a condition value takes', () => {
    expectTypeOf<EvaluationContext['now']>().toEqualTypeOf<
      Instant | undefined
    >();
  });

  it('every entry point takes the same instant as the context', () => {
    expectTypeOf<Parameters<Access['can']>[4]>().toEqualTypeOf<
      Instant | undefined
    >();
    expectTypeOf<Parameters<Access['canMany']>[4]>().toEqualTypeOf<
      Instant | undefined
    >();
    expectTypeOf<Parameters<Access['canFields']>[6]>().toEqualTypeOf<
      Instant | undefined
    >();
    expectTypeOf<Parameters<Access['capabilities']>[1]>().toEqualTypeOf<
      Instant | undefined
    >();
    expectTypeOf<Parameters<Access['authorize']>[1]>().toEqualTypeOf<
      { now?: Instant } | undefined
    >();
  });
});
