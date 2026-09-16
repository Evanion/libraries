import { describe, expect, it } from 'vitest';

import { evaluateCondition } from './conditions.js';
import type { Condition, EvaluationContext } from './types.js';

const ctx: EvaluationContext = {
  subject: { id: 's1', roles: ['editor'] },
  object: { authorId: 's1', status: 'draft' },
  now: new Date('2026-01-01T00:00:00Z'),
};

describe('evaluateCondition', () => {
  it('eq compares subject and object across scopes', () => {
    const c: Condition = {
      field: 'object.authorId',
      op: 'eq',
      path: 'subject.id',
    };
    expect(evaluateCondition(c, ctx)).toBe(true);
    expect(
      evaluateCondition(c, {
        ...ctx,
        object: { authorId: 'OTHER' },
      }),
    ).toBe(false);
  });

  it('eq supports a literal value', () => {
    expect(
      evaluateCondition(
        { field: 'object.status', op: 'eq', value: 'published' },
        ctx,
      ),
    ).toBe(false);
    expect(
      evaluateCondition(
        { field: 'object.status', op: 'eq', value: 'draft' },
        ctx,
      ),
    ).toBe(true);
  });

  it('contains checks an array field', () => {
    expect(
      evaluateCondition(
        { field: 'subject.roles', op: 'contains', value: 'editor' },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: 'subject.roles', op: 'contains', value: 'admin' },
        ctx,
      ),
    ).toBe(false);
  });

  it('in and not-in check membership', () => {
    expect(
      evaluateCondition(
        { field: 'object.status', op: 'in', value: ['published', 'draft'] },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: 'object.status', op: 'not-in', value: ['archived'] },
        ctx,
      ),
    ).toBe(true);
  });

  it('before and after compare now against an instant', () => {
    expect(
      evaluateCondition(
        { field: 'now', op: 'after', value: '2020-01-01T00:00:00Z' },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: 'now', op: 'before', value: '2020-01-01T00:00:00Z' },
        ctx,
      ),
    ).toBe(false);
  });

  it('an absent field never holds, including negative operators', () => {
    const absent: EvaluationContext = { subject: { id: 'x' } };
    expect(
      evaluateCondition(
        { field: 'subject.missing', op: 'eq', value: 1 },
        absent,
      ),
    ).toBe(false);
    expect(
      evaluateCondition(
        { field: 'subject.missing', op: 'ne', value: 1 },
        absent,
      ),
    ).toBe(false);
  });

  it('never resolves prototype-chain fields', () => {
    const hostile: EvaluationContext = {
      subject: { id: 's1' },
      object: Object.create({ status: 'x' }),
    };
    expect(
      evaluateCondition(
        { field: 'object.status', op: 'eq', value: 'x' },
        hostile,
      ),
    ).toBe(false);
    expect(
      evaluateCondition({ field: 'object.toString', op: 'eq', value: 1 }, ctx),
    ).toBe(false);
  });

  it('an absent object instance makes object-dependent conditions not hold', () => {
    const noObj: EvaluationContext = { subject: { id: 's1' } };
    expect(
      evaluateCondition(
        { field: 'object.authorId', op: 'eq', path: 'subject.id' },
        noObj,
      ),
    ).toBe(false);
  });
});
