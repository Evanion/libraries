import { describe, expect, it } from 'vitest';

import {
  AclConfigError,
  BangInAllowListError,
  DenyWithoutBaselineError,
  InvalidConditionError,
  InvalidMatrixError,
  InvalidPermissionError,
  InvalidRuleError,
  KeyMismatchError,
  TargetsTransitionsConflictError,
} from './errors.js';
import { validateMatrix } from './validate.js';
import type { Matrix } from './types.js';

/** A one-permission matrix carrying `when` verbatim, however malformed. */
function withWhen(when: unknown): Matrix {
  return {
    permissions: [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        rules: [{ id: 'r', when }],
      },
    ],
  } as unknown as Matrix;
}

/** A one-permission matrix whose single deny rule holds `condition`. */
function withCondition(condition: unknown): Matrix {
  return {
    permissions: [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        denyRules: [{ id: 'd', when: [condition] }],
      },
    ],
  } as unknown as Matrix;
}

describe('validateMatrix', () => {
  it('rejects a bang without a baseline', () => {
    const matrix: Matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'read',
          fields: { fields: ['!status'] },
        },
      ],
    };
    expect(() => validateMatrix(matrix)).toThrow(DenyWithoutBaselineError);
  });

  it('rejects a bang mixed into an explicit allow-list', () => {
    const matrix: Matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'read',
          fields: { fields: ['body', '!status'] },
        },
      ],
    };
    expect(() => validateMatrix(matrix)).toThrow(BangInAllowListError);
  });

  it('rejects targets and transitions on the same field', () => {
    const matrix: Matrix = {
      permissions: [
        {
          key: 'comment.update',
          object: 'comment',
          action: 'update',
          fields: {
            status: {
              targets: ['published'],
              transitions: { draft: ['published'] },
            },
          },
        },
      ],
    };
    expect(() => validateMatrix(matrix)).toThrow(
      TargetsTransitionsConflictError,
    );
  });

  it('rejects an unknown condition op', () => {
    const matrix: Matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'read',
          rules: [
            { when: [{ field: 'subject.id', op: 'wat' as never, value: 1 }] },
          ],
        },
      ],
    };
    expect(() => validateMatrix(matrix)).toThrow(Error);
  });

  it('rejects a condition field outside the namespaces', () => {
    const matrix: Matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'read',
          rules: [{ when: [{ field: 'foo.bar', op: 'eq', value: 1 }] }],
        },
      ],
    };
    expect(() => validateMatrix(matrix)).toThrow(Error);
  });

  it('rejects a rule whose when is not an array', () => {
    for (const when of [null, {}, 'xx', 42, true]) {
      expect(() => validateMatrix(withWhen(when))).toThrow(InvalidRuleError);
    }
  });

  it('rejects a rule with no when at all', () => {
    const matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'read',
          rules: [{ id: 'r' }],
        },
      ],
    } as unknown as Matrix;
    expect(() => validateMatrix(matrix)).toThrow(InvalidRuleError);
  });

  it('accepts an empty when as the unconditional form', () => {
    expect(() => validateMatrix(withWhen([]))).not.toThrow();
  });

  it('rejects a condition that is not an object', () => {
    for (const condition of [null, 'subject.id', 42, ['subject.id']]) {
      expect(() => validateMatrix(withCondition(condition))).toThrow(
        InvalidConditionError,
      );
    }
  });

  it('rejects a key that disagrees with its object and action', () => {
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
    expect(() => validateMatrix(matrix)).toThrow(KeyMismatchError);
  });

  it('rejects the key delimiter inside an object kind or an action', () => {
    const collide: [string, string][] = [
      ['a.b', 'c'],
      ['a', 'b.c'],
    ];
    for (const [object, action] of collide) {
      const matrix: Matrix = {
        permissions: [
          { key: `${object}.${action}`, object, action, rules: [] },
        ],
      };
      expect(() => validateMatrix(matrix)).toThrow(InvalidPermissionError);
    }
  });

  it('accepts an object kind namespaced by origin', () => {
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
    expect(() => validateMatrix(matrix)).not.toThrow();
  });

  it('rejects a condition path nested below its scope', () => {
    expect(() =>
      validateMatrix(
        withCondition({
          field: 'subject.profile.banned',
          op: 'eq',
          value: true,
        }),
      ),
    ).toThrow(InvalidConditionError);
  });

  it('rejects a condition field with no scope at all', () => {
    for (const field of ['subject', 'subject.', 'roles']) {
      expect(() =>
        validateMatrix(withCondition({ field, op: 'eq', value: 1 })),
      ).toThrow(InvalidConditionError);
    }
  });

  it('rejects a comparand path outside the namespaces', () => {
    for (const path of ['bogus.scope', 'subject.a.b', 'subject', 42]) {
      expect(() =>
        validateMatrix(
          withCondition({ field: 'subject.role', op: 'eq', path }),
        ),
      ).toThrow(InvalidConditionError);
    }
  });

  it('rejects a non-array value for in and not-in', () => {
    for (const op of ['in', 'not-in']) {
      expect(() =>
        validateMatrix(
          withCondition({ field: 'subject.role', op, value: 'admin' }),
        ),
      ).toThrow(InvalidConditionError);
      expect(() =>
        validateMatrix(
          withCondition({ field: 'subject.role', op, value: ['admin'] }),
        ),
      ).not.toThrow();
    }
  });

  it('rejects a contains with no value', () => {
    expect(() =>
      validateMatrix(withCondition({ field: 'subject.roles', op: 'contains' })),
    ).toThrow(InvalidConditionError);
  });

  it('rejects an equality with no comparand or with both', () => {
    for (const op of ['eq', 'ne']) {
      expect(() =>
        validateMatrix(withCondition({ field: 'subject.role', op })),
      ).toThrow(InvalidConditionError);
      expect(() =>
        validateMatrix(
          withCondition({
            field: 'subject.role',
            op,
            value: 'a',
            path: 'object.role',
          }),
        ),
      ).toThrow(InvalidConditionError);
    }
  });

  it('rejects a path on an operator that compares against a value', () => {
    for (const op of ['in', 'not-in', 'contains']) {
      expect(() =>
        validateMatrix(
          withCondition({ field: 'subject.role', op, path: 'object.role' }),
        ),
      ).toThrow(InvalidConditionError);
    }
  });

  it('rejects a time condition that is not a clock against an instant', () => {
    const cases: unknown[] = [
      { field: 'now', op: 'eq', value: 1 },
      { field: 'subject.at', op: 'before', value: 1 },
      { field: 'now', op: 'before' },
      { field: 'now', op: 'after', value: null },
      { field: 'now', op: 'before', value: 1, path: 'object.at' },
    ];
    for (const condition of cases) {
      expect(() => validateMatrix(withCondition(condition))).toThrow(
        InvalidConditionError,
      );
    }
  });

  it('accepts a time condition in every instant form', () => {
    for (const value of ['2026-01-01T00:00:00Z', 0, new Date()]) {
      expect(() =>
        validateMatrix(withCondition({ field: 'now', op: 'before', value })),
      ).not.toThrow();
    }
  });

  it('rejects a dependsOn that is not a list of keys', () => {
    for (const dependsOn of ['comment.read', 42, [null], [''], [{}]]) {
      const matrix = {
        permissions: [
          { key: 'comment.read', object: 'comment', action: 'read', dependsOn },
        ],
      } as unknown as Matrix;
      expect(() => validateMatrix(matrix)).toThrow(InvalidPermissionError);
    }
  });

  it('rejects anything that is not an envelope around a permission array', () => {
    const cases: unknown[] = [
      null,
      undefined,
      {},
      'x',
      42,
      // The bare array is the old form; there is one shape, not two.
      [],
      [{ key: 'comment.read', object: 'comment', action: 'read' }],
      { permissions: null },
      { permissions: 'comment.read' },
      { permissions: {} },
      { permissions: [null] },
      { permissions: [42] },
    ];
    for (const matrix of cases) {
      expect(() => validateMatrix(matrix as unknown as Matrix)).toThrow(
        InvalidMatrixError,
      );
    }
  });

  it('accepts an envelope holding no permissions', () => {
    expect(() => validateMatrix({ permissions: [] })).not.toThrow();
  });

  it('rejects a rules or denyRules that is not an array', () => {
    const matrix = {
      permissions: [
        { key: 'comment.read', object: 'comment', action: 'read', rules: {} },
      ],
    } as unknown as Matrix;
    expect(() => validateMatrix(matrix)).toThrow(InvalidPermissionError);
  });

  it('rejects field rules that are not the documented shape', () => {
    const cases: unknown[] = [
      { fields: 'body' },
      { fields: [42] },
      { status: 'nope' },
      { status: { targets: 'published' } },
      { status: { transitions: { draft: 'published' } } },
    ];
    for (const fields of cases) {
      const matrix = {
        permissions: [
          { key: 'comment.read', object: 'comment', action: 'read', fields },
        ],
      } as unknown as Matrix;
      expect(() => validateMatrix(matrix)).toThrow(InvalidPermissionError);
    }
  });

  it('every rejection names the permission key and the offending field', () => {
    const cases: [Matrix, string][] = [
      [
        withCondition({ field: 'subject.a.b', op: 'eq', value: 1 }),
        'subject.a.b',
      ],
      [
        withCondition({ field: 'subject.role', op: 'in', value: 'x' }),
        'subject.role',
      ],
      [withWhen(null), 'rules[0]'],
    ];
    for (const [matrix, field] of cases) {
      let caught: unknown;
      try {
        validateMatrix(matrix);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(AclConfigError);
      expect((caught as Error).message).toContain('comment.read');
      expect((caught as Error).message).toContain(field);
    }
  });

  it('accepts a valid matrix', () => {
    const matrix: Matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'read',
          fields: { fields: ['*', '!status'] },
        },
        {
          key: 'comment.update',
          object: 'comment',
          action: 'update',
          fields: { status: { transitions: { draft: ['published'] } } },
        },
      ],
    };
    expect(() => validateMatrix(matrix)).not.toThrow();
  });
});
