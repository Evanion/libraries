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
          id: 'undecidable',
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
});
