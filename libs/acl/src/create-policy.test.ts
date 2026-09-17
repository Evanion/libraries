import { describe, expect, it } from 'vitest';

import { createPolicy } from './create-policy.js';
import {
  DuplicatePermissionError,
  InvalidMatrixError,
  InvalidPermissionError,
  UnknownObjectKeyError,
  UnknownPermissionError,
} from './errors.js';
import { pickAllowedFields } from './fields.js';
import { parseMatrix } from './parse-matrix.js';
import type { Instant, Matrix, Permission } from './types.js';

const matrix: Matrix = {
  permissions: [
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
  ],
};

const editor = { id: 's1', roles: ['editor'] };

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

  describe('version', () => {
    it('is absent from the document when neither source states one', () => {
      const access = createPolicy(matrix);
      expect(access.version).toBeUndefined();
      expect(Object.hasOwn(access.matrix, 'version')).toBe(false);
    });

    it('comes from the document', () => {
      const access = createPolicy({ ...matrix, version: 'orders@7' });
      expect(access.version).toBe('orders@7');
      expect(access.matrix.version).toBe('orders@7');
    });

    it('comes from the options when the document states none', () => {
      const access = createPolicy(matrix, { version: 7 });
      expect(access.version).toBe(7);
      expect(access.matrix.version).toBe(7);
    });

    it('takes the option over the document, and the document carries it', () => {
      const access = createPolicy(
        { ...matrix, version: 'orders@7' },
        { version: 'orders@7+veto@41' },
      );
      expect(access.version).toBe('orders@7+veto@41');
      // The frozen document carries the winner, so the version that decided is
      // the version that crosses an SSR boundary.
      expect(access.matrix.version).toBe('orders@7+veto@41');
      expect(createPolicy(access.matrix).version).toBe('orders@7+veto@41');
    });

    it('is refused when the document states something that is neither', () => {
      expect(() =>
        createPolicy({ ...matrix, version: {} } as unknown as Matrix),
      ).toThrow(InvalidMatrixError);
    });
  });

  it('canFields returns a field-level decision', () => {
    const withFields = createPolicy({
      permissions: [
        {
          key: 'comment.update',
          object: 'comment',
          action: 'update',
          rules: [
            {
              when: [
                { field: 'subject.roles', op: 'contains', value: 'editor' },
              ],
            },
          ],
          fields: { fields: ['*', '!status'] },
        },
      ],
    });
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
    const withFields = createPolicy({
      permissions: [
        {
          key: 'comment.update',
          object: 'comment',
          action: 'update',
          rules: [
            {
              when: [
                { field: 'object.authorId', op: 'eq', path: 'subject.id' },
              ],
            },
          ],
          fields: { fields: ['*'] },
        },
      ],
    });
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

  it('canFields is allowed when the action and every field are allowed', () => {
    const withFields = createPolicy({
      permissions: [
        {
          key: 'comment.update',
          object: 'comment',
          action: 'update',
          rules: [
            {
              when: [
                { field: 'object.authorId', op: 'eq', path: 'subject.id' },
              ],
            },
          ],
          fields: { fields: ['*'] },
        },
      ],
    });
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

  it('canFields decides a proposed key the object does not carry', () => {
    const selfService = createPolicy({
      permissions: [
        {
          key: 'user.update',
          object: 'user',
          action: 'update',
          rules: [
            { when: [{ field: 'object.id', op: 'eq', path: 'subject.id' }] },
          ],
          fields: { fields: ['*', '!role'] },
        },
      ],
    });
    const current = { id: 'u1', name: 'Ann' };
    const proposed = { name: 'Eve', role: 'admin' };
    const fd = selfService.canFields(
      { id: 'u1' },
      'user',
      'update',
      current,
      'write',
      proposed,
    );
    expect(fd.action.allowed).toBe(true);
    expect(fd.fields['role']).toBe('denied');
    expect(fd.allowed).toBe(false);
    expect(pickAllowedFields(fd, proposed)).toEqual({ name: 'Eve' });
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

  it('refuses a document that states a member a permission does not have', () => {
    expect(() =>
      createPolicy({
        permissions: [
          {
            key: 'article.publish',
            object: 'article',
            action: 'publish',
            rules: [{ when: [] }],
            dependsOn: ['article.update'],
          } as unknown as Permission,
        ],
      }),
    ).toThrow(InvalidPermissionError);
  });

  it('refuses two permissions under one key, in either order', () => {
    const duplicate = (first: boolean): Matrix => ({
      permissions: [
        {
          key: 'article.publish',
          object: 'article',
          action: 'publish',
          rules: first ? [{ when: [] }] : [],
        },
        {
          key: 'article.publish',
          object: 'article',
          action: 'publish',
          rules: first ? [] : [{ when: [] }],
        },
      ],
    });
    for (const first of [true, false]) {
      expect(() => createPolicy(duplicate(first))).toThrow(
        DuplicatePermissionError,
      );
      expect(() => parseMatrix(duplicate(first))).toThrow(
        DuplicatePermissionError,
      );
    }
  });
});

/** Open from 2026-01-01; the clock decides every entry point below. */
const timed: Matrix = {
  permissions: [
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
  ],
};

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
    // The whole list, named rather than derived: `null`, `NaN`, an
    // `Invalid Date` and a string that is not a date. Only the last is a
    // string, so narrowing `Instant` to `Date | number` would leave three of
    // the four standing and delete no state.
    const unusable: Instant[] = [
      null as unknown as Instant,
      Number.NaN,
      new Date('not a date'),
      'not a date',
    ];
    for (const now of unusable) {
      expect(() => answers(now)).not.toThrow();
      expect(answers(now)).toEqual({
        can: false,
        canMany: [false],
        canFields: false,
        capabilities: false,
        authorize: false,
      });
      expect(
        createPolicy(timed).can(editor, 'comment', 'update', {}, now).reason,
      ).toBe('unusable-clock');
    }
  });

  it('defaults an omitted now to the wall clock', () => {
    expect(answers(undefined).can).toBe(true);
  });
});
