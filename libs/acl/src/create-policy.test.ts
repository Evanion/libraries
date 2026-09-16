import { describe, expect, it } from 'vitest';

import { createPolicy } from './create-policy.js';
import { UnknownObjectKeyError, UnknownPermissionError } from './errors.js';
import type { Instant, Matrix } from './types.js';

const matrix: Matrix = [
  {
    key: 'comment.read',
    object: 'comment',
    action: 'read',
    rules: [
      {
        when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
      },
    ],
  },
  {
    key: 'comment.update',
    object: 'comment',
    action: 'update',
    rules: [
      {
        when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }],
      },
    ],
  },
];

const editor = { id: 's1', roles: ['editor'] };

/** article.publish depends on article.update, which an editor holds. */
const cascade: Matrix = [
  {
    key: 'article.update',
    object: 'article',
    action: 'update',
    rules: [
      {
        id: 'editor',
        when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
      },
    ],
  },
  {
    key: 'article.publish',
    object: 'article',
    action: 'publish',
    dependsOn: ['article.update'],
    rules: [
      {
        id: 'editor-only',
        when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
      },
    ],
  },
];

describe('createPolicy', () => {
  it('can evaluates a single decision', () => {
    const access = createPolicy(matrix);
    const d = access.can(editor, 'comment', 'update', { authorId: 's1' });
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe('allow');
  });

  it('canMany returns a parallel decision array', () => {
    const access = createPolicy(matrix);
    const comments = [{ authorId: 's1' }, { authorId: 'OTHER' }];
    const ds = access.canMany(editor, 'comment', 'update', comments);
    expect(ds).toHaveLength(2);
    expect(ds[0]!.allowed).toBe(true);
    expect(ds[1]!.allowed).toBe(false);
  });

  it('a foreign matrix fails closed on an unknown permission', () => {
    const access = createPolicy(matrix, { closed: true });
    const d = access.can({ id: 's1' }, 'comment', 'delete');
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('unknown-action');
  });

  it('a typed (local) matrix throws on an unknown object kind', () => {
    const access = createPolicy(matrix);
    expect(() => access.can({ id: 's1' }, 'unknown', 'read')).toThrow(
      UnknownObjectKeyError,
    );
  });

  it('a typed (local) matrix throws on an unknown permission', () => {
    const access = createPolicy(matrix);
    expect(() => access.can({ id: 's1' }, 'comment', 'delete')).toThrow(
      UnknownPermissionError,
    );
  });

  it('exposes the frozen matrix and version', () => {
    const access = createPolicy(matrix, { version: 3 });
    expect(access.version).toBe(3);
    expect(Object.isFrozen(access.matrix)).toBe(true);
  });

  it('the matrix round-trips through JSON losslessly', () => {
    const access = createPolicy(matrix);
    const round = JSON.parse(JSON.stringify(access.matrix)) as Matrix;
    expect(round).toEqual(access.matrix);
  });

  it('canFields returns a field-level decision', () => {
    const withFields = createPolicy([
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        rules: [
          {
            when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
          },
        ],
        fields: { fields: ['*', '!status'] },
      },
    ]);
    const fd = withFields.canFields(
      editor,
      'comment',
      'update',
      { status: 'x' },
      'write',
    );
    expect(fd.fields['status']).toBe('denied');
  });

  it('canFields is not allowed when the action is denied', () => {
    const withFields = createPolicy([
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        rules: [
          {
            when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }],
          },
        ],
        fields: { fields: ['*'] },
      },
    ]);
    const stranger = { id: 'OTHER' };
    const fd = withFields.canFields(
      stranger,
      'comment',
      'update',
      { authorId: 's1', body: 'hi' },
      'write',
    );
    expect(fd.allowed).toBe(false);
    expect(fd.action).toMatchObject({
      key: 'comment.update',
      allowed: false,
      reason: 'no-rule-matched',
    });
    // The maps still say what would be editable once the action is unblocked.
    expect(fd.fields).toEqual({ authorId: 'allowed', body: 'allowed' });
  });

  it('canFields is not allowed when a dependency blocks the action', () => {
    const withFields = createPolicy([
      ...cascade,
      {
        key: 'article.retitle',
        object: 'article',
        action: 'retitle',
        dependsOn: ['article.update'],
        rules: [{ id: 'anyone', when: [] }],
        fields: { fields: ['*'] },
      },
    ]);
    const reader = { id: 's2', roles: ['reader'] };
    const fd = withFields.canFields(
      reader,
      'article',
      'retitle',
      { title: 't' },
      'write',
    );
    expect(fd.allowed).toBe(false);
    expect(fd.action).toMatchObject({
      reason: 'dependency-off',
      blockedBy: 'article.update',
    });
  });

  it('canFields is allowed when the action and every field are allowed', () => {
    const withFields = createPolicy([
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        rules: [
          {
            when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }],
          },
        ],
        fields: { fields: ['*'] },
      },
    ]);
    const fd = withFields.canFields(
      { id: 's1' },
      'comment',
      'update',
      { authorId: 's1' },
      'write',
    );
    expect(fd.allowed).toBe(true);
    expect(fd.action).toMatchObject({ allowed: true, reason: 'allow' });
  });

  it('canFields on an unknown action names the unknown action', () => {
    const access = createPolicy(matrix, { closed: true });
    const fd = access.canFields(editor, 'comment', 'delete', {}, 'write');
    expect(fd).toEqual({
      allowed: false,
      action: {
        key: 'comment.delete',
        allowed: false,
        reason: 'unknown-action',
      },
      fields: {},
      reasons: {},
    });
  });

  it('capabilities returns every action-level decision', () => {
    const access = createPolicy(matrix);
    const caps = access.capabilities(editor);
    expect(caps['comment.read']!.allowed).toBe(true);
    expect(caps['comment.update']!.reason).toBe('unevaluable');
  });

  it('authorize binds the subject', () => {
    const access = createPolicy(matrix);
    const forUser = access.authorize(editor);
    expect(forUser.can('comment', 'read').allowed).toBe(true);
  });

  it('can resolves the dependsOn cascade', () => {
    const access = createPolicy(cascade);
    expect(access.can(editor, 'article', 'publish')).toMatchObject({
      allowed: true,
      reason: 'allow',
      rule: 'editor-only',
    });
  });

  it('a dependency that is off blocks can, naming the real cause', () => {
    const access = createPolicy(cascade);
    const reader = { id: 's2', roles: ['reader'] };
    expect(access.can(reader, 'article', 'publish')).toMatchObject({
      allowed: false,
      reason: 'dependency-off',
      blockedBy: 'article.update',
      cause: { key: 'article.update', reason: 'no-rule-matched' },
    });
  });

  it('capabilities resolves the dependsOn cascade', () => {
    const access = createPolicy(cascade);
    const caps = access.capabilities(editor);
    expect(caps['article.publish']).toMatchObject({
      allowed: true,
      reason: 'allow',
    });
  });

  it('can and capabilities agree over a dependsOn chain', () => {
    const access = createPolicy(cascade);
    for (const subject of [editor, { id: 's2', roles: ['reader'] }]) {
      const caps = access.capabilities(subject);
      for (const permission of cascade) {
        expect(
          access.can(subject, permission.object, permission.action),
        ).toEqual(caps[permission.key]);
      }
    }
  });

  it('canMany resolves the dependsOn cascade', () => {
    const access = createPolicy(cascade);
    const ds = access.canMany(editor, 'article', 'publish', [{ id: 'a1' }]);
    expect(ds[0]).toMatchObject({ allowed: true, reason: 'allow' });
  });

  it('authorize resolves the dependsOn cascade', () => {
    const access = createPolicy(cascade);
    expect(access.authorize(editor).can('article', 'publish')).toMatchObject({
      allowed: true,
      reason: 'allow',
    });
  });
  it('capabilities reports an object-scoped deny as unevaluable and cascades it', () => {
    const objectScopedDeny: Matrix = [
      {
        key: 'article.update',
        object: 'article',
        action: 'update',
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
      },
      {
        key: 'article.publish',
        object: 'article',
        action: 'publish',
        dependsOn: ['article.update'],
        rules: [
          {
            id: 'editor',
            when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
          },
        ],
      },
    ];
    const caps = createPolicy(objectScopedDeny).capabilities(editor);
    expect(caps['article.update']).toMatchObject({
      allowed: false,
      reason: 'unevaluable',
      rule: 'locked',
      missing: ['object.locked'],
    });
    expect(caps['article.publish']).toMatchObject({
      allowed: false,
      reason: 'dependency-off',
      blockedBy: 'article.update',
      cause: {
        key: 'article.update',
        reason: 'unevaluable',
        missing: ['object.locked'],
      },
    });
  });
});

/** Open from 2026-01-01; the clock decides every entry point below. */
const timed: Matrix = [
  {
    key: 'comment.update',
    object: 'comment',
    action: 'update',
    rules: [
      {
        id: 'window',
        when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' }],
      },
    ],
    fields: { fields: ['body'] },
  },
];

const OPEN = '2026-06-01T00:00:00Z';
const SHUT = '2025-06-01T00:00:00Z';

/** Every entry point's answer for one instant, in one comparable shape. */
function answers(now: Instant | undefined) {
  const access = createPolicy(timed);
  const object = { id: 'c1', body: 'hi' };
  return {
    can: access.can(editor, 'comment', 'update', object, now).allowed,
    canMany: access
      .canMany(editor, 'comment', 'update', [object], now)
      .map((d) => d.allowed),
    canFields: access.canFields(
      editor,
      'comment',
      'update',
      object,
      'write',
      { body: 'x' },
      now,
    ).allowed,
    capabilities: access.capabilities(editor, now)['comment.update']!.allowed,
    authorize: access.authorize(editor, { now }).can('comment', 'update')
      .allowed,
  };
}

describe('the context clock', () => {
  it('takes a string, a number and a Date, and all three agree', () => {
    const epoch = Date.parse(OPEN);
    const open = [OPEN, epoch, new Date(epoch)].map(answers);
    for (const answer of open) {
      expect(answer).toEqual(answers(new Date(epoch)));
      expect(answer.can).toBe(true);
    }

    const shut = [SHUT, Date.parse(SHUT), new Date(SHUT)].map(answers);
    for (const answer of shut) {
      expect(answer).toEqual(answers(new Date(SHUT)));
      expect(answer.can).toBe(false);
    }
  });

  it('accepts a now round-tripped through JSON', () => {
    const hydrated = JSON.parse(JSON.stringify({ now: new Date(OPEN) })) as {
      now: string;
    };
    expect(answers(hydrated.now)).toEqual(answers(new Date(OPEN)));
    expect(answers(hydrated.now).can).toBe(true);
  });

  it('denies every entry point on a now that does not parse, without throwing', () => {
    for (const now of ['not a date', Number.NaN, new Date('not a date')]) {
      expect(() => answers(now)).not.toThrow();
      expect(answers(now)).toEqual({
        can: false,
        canMany: [false],
        canFields: false,
        capabilities: false,
        authorize: false,
      });
    }
  });

  it('defaults an omitted now to the wall clock', () => {
    expect(answers(undefined).can).toBe(true);
  });
});
