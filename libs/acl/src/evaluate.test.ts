import { describe, expect, it } from 'vitest';

import { decide } from './evaluate.js';
import type { Decision, EvaluationContext, Permission } from './types.js';

const ctx: EvaluationContext = {
  subject: { id: 's1', roles: ['editor'] },
  object: { authorId: 's1', status: 'draft' },
  now: new Date('2026-01-01T00:00:00Z'),
};

function p(partial: Partial<Permission> & { key: string }): Permission {
  const [object, action] = partial.key.split('.');
  return { object: object ?? '', action: action ?? '', ...partial };
}

const resolved = new Map<string, Decision>();

describe('decide', () => {
  it('allows when a rule matches', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          when: [
            { field: 'object.authorId', op: 'eq', path: 'subject.id' },
          ],
        },
      ],
    });
    expect(decide(perm, ctx, resolved)).toMatchObject({
      allowed: true,
      reason: 'allow',
    });
  });

  it('denies when no rule matches', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          when: [
            { field: 'object.authorId', op: 'eq', path: 'subject.id' },
          ],
        },
      ],
    });
    const other = { ...ctx, object: { authorId: 'OTHER' } };
    expect(decide(perm, other, resolved)).toMatchObject({
      allowed: false,
      reason: 'no-rule-matched',
    });
  });

  it('deny wins over a concurrent allow', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          when: [
            { field: 'subject.roles', op: 'contains', value: 'editor' },
          ],
        },
      ],
      denyRules: [
        { when: [{ field: 'object.status', op: 'eq', value: 'published' }] },
      ],
    });
    const ctx2 = { ...ctx, object: { authorId: 's1', status: 'published' } };
    expect(decide(perm, ctx2, resolved)).toMatchObject({
      allowed: false,
      reason: 'denied',
    });
  });

  it('a permission with no rules denies', () => {
    const perm = p({ key: 'comment.update' });
    expect(decide(perm, ctx, resolved)).toMatchObject({
      allowed: false,
      reason: 'no-rule-matched',
    });
  });

  it('an object-dependent rule with no instance is unevaluable', () => {
    const perm = p({
      key: 'comment.create',
      rules: [
        {
          when: [
            { field: 'object.authorId', op: 'eq', path: 'subject.id' },
          ],
        },
      ],
    });
    const noObj: EvaluationContext = { subject: { id: 's1' } };
    expect(decide(perm, noObj, resolved)).toMatchObject({
      allowed: false,
      reason: 'unevaluable',
      missing: ['object.authorId'],
    });
  });

  it('a rule that mixes object-independent and object-dependent branches resolves on the independent branch', () => {
    const perm2 = p({
      key: 'comment.create',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'admin' }] },
        {
          when: [
            { field: 'object.authorId', op: 'eq', path: 'subject.id' },
          ],
        },
      ],
    });
    const noObj: EvaluationContext = { subject: { id: 's1', roles: ['admin'] } };
    expect(decide(perm2, noObj, resolved)).toMatchObject({
      allowed: true,
      reason: 'allow',
    });
  });

  it('a dependency that is off blocks the dependant', () => {
    const parent: Permission = p({ key: 'article.update' });
    const child = p({
      key: 'article.publish',
      dependsOn: ['article.update'],
      rules: [
        {
          when: [
            { field: 'subject.roles', op: 'contains', value: 'editor' },
          ],
        },
      ],
    });
    const withParent = new Map<string, Decision>([
      ['article.update', decide(parent, ctx, resolved)],
    ]);
    expect(decide(child, ctx, withParent)).toMatchObject({
      allowed: false,
      reason: 'dependency-off',
      blockedBy: 'article.update',
    });
  });
});
