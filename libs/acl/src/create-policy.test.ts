import { describe, expect, it } from 'vitest';

import { createPolicy } from './create-policy.js';
import {
  UnknownObjectKeyError,
  UnknownPermissionError,
} from './errors.js';
import type { Matrix } from './types.js';

const matrix: Matrix = [
  {
    key: 'comment.read',
    object: 'comment',
    action: 'read',
    rules: [
      {
        when: [
          { field: 'subject.roles', op: 'contains', value: 'editor' },
        ],
      },
    ],
  },
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
  },
];

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

  it('canFields returns a field-level decision', () => {
    const withFields = createPolicy([
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
});
