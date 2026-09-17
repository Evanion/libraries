import { describe, expect, it } from 'vitest';

import {
  InvalidConditionError,
  InvalidMatrixError,
  InvalidPermissionError,
  InvalidRuleError,
  KeyMismatchError,
} from './errors.js';
import { parseMatrix } from './parse-matrix.js';
import type { Matrix } from './types.js';

const json: Matrix = {
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
  ],
};

describe('parseMatrix', () => {
  it('adopts a foreign matrix and fails closed', () => {
    const access = parseMatrix(json);
    const d = access.can({ id: 's1' }, 'comment', 'delete');
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('unknown-action');
  });

  it('validates the matrix shape on adoption', () => {
    expect(() =>
      parseMatrix({
        permissions: [{ key: 'no.object.key' }],
      } as unknown as Matrix),
    ).toThrow();
  });

  it('exposes the adopted version', () => {
    const access = parseMatrix(json, { version: 7 });
    expect(access.version).toBe(7);
  });

  it('round-trips through JSON', () => {
    const access = parseMatrix(json);
    const round = JSON.parse(JSON.stringify(access.matrix)) as Matrix;
    expect(round).toEqual(access.matrix);
  });

  it('a valid permission evaluates locally', () => {
    const access = parseMatrix(json);
    const d = access.can({ id: 's1', roles: ['editor'] }, 'comment', 'read');
    expect(d.allowed).toBe(true);
  });

  it('refuses a rule whose when did not survive its serializer', () => {
    const cases: [unknown, unknown][] = [
      [null, InvalidRuleError],
      [undefined, InvalidRuleError],
      [{}, InvalidRuleError],
      ['xx', InvalidRuleError],
      [42, InvalidRuleError],
      [[null], InvalidConditionError],
    ];
    for (const [when, expected] of cases) {
      const matrix = {
        permissions: [
          {
            key: 'comment.read',
            object: 'comment',
            action: 'read',
            rules: [{ id: 'r', when }],
          },
        ],
      } as unknown as Matrix;
      expect(() => parseMatrix(matrix)).toThrow(expected as never);
    }
  });

  it('refuses a key that grants an action it was not written for', () => {
    const matrix: Matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'delete',
          rules: [{ id: 'anyone', when: [] }],
        },
      ],
    };
    expect(() => parseMatrix(matrix)).toThrow(KeyMismatchError);
  });

  it('refuses two permissions that would collide into one key', () => {
    const matrix: Matrix = {
      permissions: [
        { key: 'a.b.c', object: 'a.b', action: 'c', rules: [] },
        { key: 'a.b.c', object: 'a', action: 'b.c', rules: [] },
      ],
    };
    expect(() => parseMatrix(matrix)).toThrow(InvalidPermissionError);
  });

  it('adopts an object kind namespaced by origin', () => {
    const matrix: Matrix = {
      permissions: [
        {
          key: 'orders:invoice.read',
          object: 'orders:invoice',
          action: 'read',
          rules: [{ id: 'all', when: [] }],
        },
      ],
    };
    expect(parseMatrix(matrix).can({}, 'orders:invoice', 'read').allowed).toBe(
      true,
    );
  });

  it('refuses a deny rule whose condition would never read', () => {
    const deep: Matrix = {
      permissions: [
        {
          key: 'post.delete',
          object: 'post',
          action: 'delete',
          rules: [{ id: 'all', when: [] }],
          denyRules: [
            {
              id: 'banned',
              when: [
                { field: 'subject.profile.banned', op: 'eq', value: true },
              ],
            },
          ],
        },
      ],
    };
    expect(() => parseMatrix(deep)).toThrow(InvalidConditionError);

    const notIn: Matrix = {
      permissions: [
        {
          key: 'post.delete',
          object: 'post',
          action: 'delete',
          rules: [{ id: 'all', when: [] }],
          denyRules: [
            {
              id: 'd',
              when: [{ field: 'subject.role', op: 'not-in', value: 'admin' }],
            },
          ],
        },
      ],
    };
    expect(() => parseMatrix(notIn)).toThrow(InvalidConditionError);
  });

  it('refuses a value nested deeper than the clone walks', () => {
    let nested: Record<string, unknown> = {};
    for (let i = 0; i < 20000; i++) nested = { n: nested };
    const matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'read',
          rules: [
            {
              id: 'r',
              when: [{ field: 'subject.x', op: 'eq', value: nested }],
            },
          ],
        },
      ],
    } as unknown as Matrix;
    expect(() => parseMatrix(matrix)).toThrow(InvalidMatrixError);
  });

  it('freezes a matrix that refers back to itself', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    const matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'read',
          rules: [
            {
              id: 'r',
              when: [{ field: 'subject.x', op: 'eq', value: cyclic }],
            },
          ],
        },
      ],
    } as unknown as Matrix;

    const access = parseMatrix(matrix);
    expect(Object.isFrozen(access.matrix.permissions[0]?.rules?.[0])).toBe(
      true,
    );
    expect(access.can({}, 'comment', 'read').allowed).toBe(false);
  });

  it('evaluates against an interface-typed subject the caller names', () => {
    interface ShopSubject {
      id: string;
      roles: string[];
    }
    interface ShopComment {
      authorId: string;
    }

    const access = parseMatrix<ShopSubject, { comment: ShopComment }>(json);
    const editor: ShopSubject = { id: 's1', roles: ['editor'] };
    const reader: ShopSubject = { id: 's2', roles: [] };

    expect(access.can(editor, 'comment', 'read').allowed).toBe(true);
    expect(access.can(reader, 'comment', 'read').allowed).toBe(false);
  });
});
