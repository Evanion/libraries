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
          when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }],
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
          when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }],
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
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
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

  it('deny wins over a dependency that resolved off', () => {
    const perm = p({
      key: 'comment.publish',
      dependsOn: ['comment.update'],
      rules: [
        {
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
        },
      ],
      denyRules: [
        { when: [{ field: 'object.status', op: 'eq', value: 'published' }] },
      ],
    });
    const parentOff = new Map<string, Decision>([
      [
        'comment.update',
        {
          key: 'comment.update',
          allowed: false,
          reason: 'no-rule-matched',
        },
      ],
    ]);
    const ctx2 = { ...ctx, object: { authorId: 's1', status: 'published' } };
    expect(decide(perm, ctx2, parentOff)).toMatchObject({
      allowed: false,
      reason: 'denied',
    });
  });

  it('the conditions of one rule are AND-ed', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          when: [
            { field: 'subject.roles', op: 'contains', value: 'editor' },
            { field: 'object.status', op: 'eq', value: 'published' },
          ],
        },
      ],
    });
    expect(decide(perm, ctx, resolved)).toMatchObject({
      allowed: false,
      reason: 'no-rule-matched',
    });
  });

  it('an object condition comparing against a literal is unevaluable with no instance', () => {
    const perm = p({
      key: 'comment.create',
      rules: [
        { when: [{ field: 'object.status', op: 'eq', value: 'published' }] },
      ],
    });
    const noObj: EvaluationContext = { subject: { id: 's1' } };
    expect(decide(perm, noObj, resolved)).toMatchObject({
      allowed: false,
      reason: 'unevaluable',
      missing: ['object.status'],
    });
  });

  it('a rule whose subject branch already failed is no-rule-matched, not unevaluable', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          when: [
            { field: 'subject.roles', op: 'contains', value: 'editor' },
            { field: 'object.authorId', op: 'eq', path: 'subject.id' },
          ],
        },
      ],
    });
    const reader: EvaluationContext = {
      subject: { id: 's1', roles: ['reader'] },
    };
    expect(decide(perm, reader, resolved)).toMatchObject({
      allowed: false,
      reason: 'no-rule-matched',
    });
  });

  it('unevaluable ranks below a matching allow rule', () => {
    const perm = p({
      key: 'comment.create',
      rules: [
        {
          id: 'unevaluable',
          when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }],
        },
        {
          id: 'editor',
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
        },
      ],
    });
    const noObj: EvaluationContext = {
      subject: { id: 's1', roles: ['editor'] },
    };
    expect(decide(perm, noObj, resolved)).toMatchObject({
      allowed: true,
      reason: 'allow',
      rule: 'editor',
    });
  });

  it('unevaluable ranks above no-rule-matched', () => {
    const perm = p({
      key: 'comment.create',
      rules: [
        {
          id: 'admin',
          when: [{ field: 'subject.roles', op: 'contains', value: 'admin' }],
        },
        {
          id: 'author',
          when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }],
        },
      ],
    });
    const noObj: EvaluationContext = {
      subject: { id: 's1', roles: ['editor'] },
    };
    expect(decide(perm, noObj, resolved)).toMatchObject({
      allowed: false,
      reason: 'unevaluable',
      missing: ['object.authorId'],
    });
  });

  it('a projection lacking the path a rule reads is unevaluable, not no-rule-matched', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }],
        },
      ],
    });
    const projection: EvaluationContext = {
      subject: { id: 's1' },
      object: { status: 'draft' },
    };
    expect(decide(perm, projection, resolved)).toMatchObject({
      allowed: false,
      reason: 'unevaluable',
      missing: ['object.authorId'],
    });
  });

  it('an absent subject path is a definite deny, not unevaluable', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
        },
      ],
    });
    const roleless: EvaluationContext = { subject: { id: 's1' }, object: {} };
    expect(decide(perm, roleless, resolved)).toMatchObject({
      allowed: false,
      reason: 'no-rule-matched',
    });
  });

  it('a negative operator over an absent object path is unevaluable, not an allow', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          when: [{ field: 'object.status', op: 'ne', value: 'published' }],
        },
        {
          when: [{ field: 'object.status', op: 'not-in', value: ['archived'] }],
        },
      ],
    });
    const projection: EvaluationContext = {
      subject: { id: 's1' },
      object: { authorId: 's1' },
    };
    expect(decide(perm, projection, resolved)).toMatchObject({
      allowed: false,
      reason: 'unevaluable',
      missing: ['object.status'],
    });
  });

  it('a definitely-false condition decides the rule however it is ordered against an unevaluable one', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          when: [
            { field: 'object.authorId', op: 'eq', path: 'subject.id' },
            { field: 'subject.roles', op: 'contains', value: 'editor' },
          ],
        },
      ],
    });
    const reader: EvaluationContext = {
      subject: { id: 's1', roles: ['reader'] },
      object: { status: 'draft' },
    };
    expect(decide(perm, reader, resolved)).toMatchObject({
      allowed: false,
      reason: 'no-rule-matched',
    });
  });

  it('missing names a literal-comparand object condition', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          when: [
            { field: 'subject.roles', op: 'contains', value: 'editor' },
            { field: 'object.status', op: 'eq', value: 'published' },
          ],
        },
      ],
    });
    const projection: EvaluationContext = {
      subject: { id: 's1', roles: ['editor'] },
      object: { authorId: 's1' },
    };
    expect(decide(perm, projection, resolved)).toMatchObject({
      allowed: false,
      reason: 'unevaluable',
      missing: ['object.status'],
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
          when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }],
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
          when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }],
        },
      ],
    });
    const noObj: EvaluationContext = {
      subject: { id: 's1', roles: ['admin'] },
    };
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
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
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
  it('an unevaluable deny outranks a matching allow', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          id: 'editor',
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
        },
      ],
      denyRules: [
        {
          id: 'locked',
          when: [{ field: 'object.locked', op: 'eq', value: true }],
        },
      ],
    });
    const partial: EvaluationContext = { ...ctx, object: { authorId: 's1' } };
    expect(decide(perm, partial, resolved)).toMatchObject({
      allowed: false,
      reason: 'unevaluable',
      rule: 'locked',
      missing: ['object.locked'],
    });
  });

  it('a deny that definitely fails leaves the matching allow standing', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          id: 'editor',
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
        },
      ],
      denyRules: [
        {
          id: 'locked',
          when: [{ field: 'object.locked', op: 'eq', value: true }],
        },
      ],
    });
    const full: EvaluationContext = {
      ...ctx,
      object: { authorId: 's1', locked: false },
    };
    expect(decide(perm, full, resolved)).toMatchObject({
      allowed: true,
      reason: 'allow',
      rule: 'editor',
    });
  });

  it('a definitely failing allow outranks an unevaluable deny', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          id: 'admin',
          when: [{ field: 'subject.roles', op: 'contains', value: 'admin' }],
        },
      ],
      denyRules: [
        {
          id: 'locked',
          when: [{ field: 'object.locked', op: 'eq', value: true }],
        },
      ],
    });
    const partial: EvaluationContext = { ...ctx, object: { authorId: 's1' } };
    const decision = decide(perm, partial, resolved);
    expect(decision).toMatchObject({
      allowed: false,
      reason: 'no-rule-matched',
    });
    expect(decision.missing).toBeUndefined();
  });

  it('two unevaluable sides report the union of their paths', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          id: 'author',
          when: [
            { field: 'object.authorId', op: 'eq', path: 'subject.id' },
            { field: 'object.locked', op: 'eq', value: false },
          ],
        },
      ],
      denyRules: [
        {
          id: 'locked',
          when: [
            { field: 'object.locked', op: 'eq', value: true },
            { field: 'object.lockedBy', op: 'ne', path: 'subject.id' },
          ],
        },
      ],
    });
    const partial: EvaluationContext = { ...ctx, object: { status: 'draft' } };
    const decision = decide(perm, partial, resolved);
    expect(decision).toMatchObject({ allowed: false, reason: 'unevaluable' });
    expect([...(decision.missing ?? [])].sort()).toEqual([
      'object.authorId',
      'object.locked',
      'object.lockedBy',
    ]);
  });

  it('a matching deny outranks an unevaluable one', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          id: 'editor',
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
        },
      ],
      denyRules: [
        {
          id: 'locked',
          when: [{ field: 'object.locked', op: 'eq', value: true }],
        },
        {
          id: 'draft',
          when: [{ field: 'object.status', op: 'eq', value: 'draft' }],
        },
      ],
    });
    const partial: EvaluationContext = { ...ctx, object: { status: 'draft' } };
    expect(decide(perm, partial, resolved)).toMatchObject({
      allowed: false,
      reason: 'denied',
      rule: 'draft',
    });
  });

  it('a definitely off parent outranks the child an unevaluable deny would leave unevaluable', () => {
    const parent: Permission = p({ key: 'article.update' });
    const child = p({
      key: 'article.publish',
      dependsOn: ['article.update'],
      rules: [
        {
          id: 'editor',
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
        },
      ],
      denyRules: [
        {
          id: 'locked',
          when: [{ field: 'object.locked', op: 'eq', value: true }],
        },
      ],
    });
    const partial: EvaluationContext = { ...ctx, object: { authorId: 's1' } };
    const withParent = new Map<string, Decision>([
      ['article.update', decide(parent, partial, resolved)],
    ]);
    expect(decide(child, partial, withParent)).toMatchObject({
      allowed: false,
      reason: 'dependency-off',
      blockedBy: 'article.update',
      cause: { key: 'article.update', reason: 'no-rule-matched' },
    });
  });

  it('a cause carries the paths that would settle an unevaluable parent', () => {
    const parent = p({
      key: 'article.update',
      rules: [
        {
          id: 'editor',
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
        },
      ],
      denyRules: [
        {
          id: 'locked',
          when: [{ field: 'object.locked', op: 'eq', value: true }],
        },
      ],
    });
    const child = p({
      key: 'article.publish',
      dependsOn: ['article.update'],
      rules: [
        {
          id: 'editor',
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
        },
      ],
    });
    const partial: EvaluationContext = { ...ctx, object: { authorId: 's1' } };
    const withParent = new Map<string, Decision>([
      ['article.update', decide(parent, partial, resolved)],
    ]);
    expect(decide(child, partial, withParent)).toMatchObject({
      allowed: false,
      reason: 'dependency-off',
      cause: {
        key: 'article.update',
        reason: 'unevaluable',
        rule: 'locked',
        missing: ['object.locked'],
      },
    });
  });

  it('an object-scoped deny with no instance is unevaluable, not an allow', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          id: 'editor',
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
        },
      ],
      denyRules: [
        {
          id: 'locked',
          when: [{ field: 'object.locked', op: 'eq', value: true }],
        },
      ],
    });
    const noObj: EvaluationContext = {
      subject: { id: 's1', roles: ['editor'] },
      now: ctx.now,
    };
    expect(decide(perm, noObj, resolved)).toMatchObject({
      allowed: false,
      reason: 'unevaluable',
      rule: 'locked',
      missing: ['object.locked'],
    });
  });

  it('a deny reading an absent subject path is a definite miss, not unevaluable', () => {
    const perm = p({
      key: 'comment.update',
      rules: [
        {
          id: 'editor',
          when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
        },
      ],
      denyRules: [
        {
          id: 'banned',
          when: [{ field: 'subject.banned', op: 'eq', value: true }],
        },
        {
          id: 'draft',
          when: [{ field: 'object.status', op: 'eq', value: 'draft' }],
        },
      ],
    });
    const decision = decide(perm, ctx, resolved);
    expect(decision).toMatchObject({
      allowed: false,
      reason: 'denied',
      rule: 'draft',
    });
    expect(decision.missing).toBeUndefined();
  });
});
