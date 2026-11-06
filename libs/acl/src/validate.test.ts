import { describe, expect, it } from 'vitest';

import {
  AclConfigError,
  DenyWithoutBaselineError,
  DuplicatePermissionError,
  DuplicateRuleIdError,
  InvalidConditionError,
  InvalidMatrixError,
  InvalidPermissionError,
  InvalidRuleError,
  KeyMismatchError,
  TargetsTransitionsConflictError,
} from './errors.js';
import { policy } from './authoring.js';
import { hydratePolicy } from './hydrate-policy.js';
import { collectIssues, validateAll, validateMatrix } from './validate.js';
import { Gen, rng } from './security/generator.js';
import { matrix as junkMatrix } from './security/matrix-generator.js';
import type { Matrix } from './types.js';

const perm = (action: string, extra: object = {}) => ({
  key: `comment.${action}`,
  object: 'comment',
  action,
  ...extra,
});

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

  describe('field paths', () => {
    type FieldsArg = string[] | Record<string, unknown>;
    const matrixOf = (fields: FieldsArg, action = 'read'): Matrix => ({
      permissions: [
        {
          key: `order.${action}`,
          object: 'order',
          action,
          fields: (Array.isArray(fields)
            ? { fields }
            : fields) as unknown as Matrix['permissions'][number]['fields'],
        },
      ],
    });
    /** Every construction path a path list reaches. */
    const builds: [string, (fields: FieldsArg) => unknown][] = [
      ['validateMatrix', (fields) => validateMatrix(matrixOf(fields))],
      ['hydratePolicy', (fields) => hydratePolicy(matrixOf(fields))],
      [
        'policy().build',
        (fields) =>
          policy<{ id: string }, { order: Record<string, unknown> }>()
            .for('order', (p) =>
              p.allow('read', p.always).fields(fields as never),
            )
            .build(),
      ],
    ];
    const caught = (
      build: (fields: FieldsArg) => unknown,
      fields: FieldsArg,
    ) => {
      try {
        build(fields);
      } catch (error) {
        return error;
      }
      return undefined;
    };

    describe.each(builds)('through %s', (_, build) => {
      it.each([
        [['*', '!address.street']],
        [['id', 'address', '!address.street']],
        [['id', 'address.city']],
        [['a\\.b']],
        [{ 'address.country': { targets: ['SE'] } }],
        [['*', 'title']],
        [['address', 'address.city']],
        [['*', '!address.street', '!address.street']],
      ] as [FieldsArg][])('accepts %j', (fields) => {
        expect(caught(build, fields)).toBeUndefined();
      });

      it('accepts a config on the same path as an exclusion', () => {
        expect(
          caught(build, {
            fields: ['*', '!status'],
            status: { targets: ['x'] },
          }),
        ).toBeUndefined();
      });

      it.each([
        ['a..b', 'fields.fields[0]'],
        ['.a', 'fields.fields[0]'],
        ['a.', 'fields.fields[0]'],
        ['a\\', 'fields.fields[0]'],
        ['a.__proto__', 'fields.fields[0]'],
        ['a.*', 'fields.fields[0]'],
        ['a.!b', 'fields.fields[0]'],
        ['!a..b', 'fields.fields[0]'],
      ])('refuses the entry %j', (entry, field) => {
        const error = caught(build, [entry]);

        expect(error).toBeInstanceOf(InvalidPermissionError);
        expect((error as InvalidPermissionError).key).toBe('order.read');
        expect((error as InvalidPermissionError).field).toBe(field);
      });

      it.each([['a..b'], ['a.'], ['a.__proto__'], ['a.*'], ['a\\']])(
        'refuses the config key %j',
        (name) => {
          const error = caught(build, { [name]: { targets: ['x'] } });

          expect(error).toBeInstanceOf(InvalidPermissionError);
          expect((error as InvalidPermissionError).field).toBe(
            `fields.${name}`,
          );
        },
      );

      it.each([[['id', '!address.street']], [['!a']], [['body', '!status']]])(
        'refuses an exclusion with no baseline: %j',
        (fields) => {
          const error = caught(build, fields);

          expect(error).toBeInstanceOf(DenyWithoutBaselineError);
          expect((error as DenyWithoutBaselineError).key).toBe('order.read');
        },
      );

      it.each([
        [['a', '!a'], '"!a"', '"a"'],
        [['*', '!address', 'address.city'], '"address.city"', '"!address"'],
      ])(
        'refuses contradictory entries %j, naming both',
        (fields, ...named) => {
          const error = caught(build, fields);

          expect(error).toBeInstanceOf(InvalidPermissionError);
          expect((error as InvalidPermissionError).key).toBe('order.read');
          for (const name of named) {
            expect((error as Error).message).toContain(name);
          }
        },
      );

      it('refuses a config under an excluded ancestor, naming both', () => {
        const error = caught(build, {
          fields: ['*', '!address'],
          'address.country': { targets: ['SE'] },
        });

        expect(error).toBeInstanceOf(InvalidPermissionError);
        expect((error as InvalidPermissionError).field).toBe(
          'fields.address.country',
        );
        expect((error as Error).message).toContain('"!address"');
      });

      it('refuses a config with a list entry below it, naming both', () => {
        const error = caught(build, {
          fields: ['*', '!address.city'],
          address: { targets: ['x'] },
        });

        expect(error).toBeInstanceOf(InvalidPermissionError);
        expect((error as Error).message).toContain('"address"');
        expect((error as Error).message).toContain('"!address.city"');
      });

      it('refuses a config with another config below it, naming both', () => {
        const error = caught(build, {
          address: { targets: ['x'] },
          'address.country': { targets: ['SE'] },
        });

        expect(error).toBeInstanceOf(InvalidPermissionError);
        expect((error as Error).message).toContain('"address"');
        expect((error as Error).message).toContain('"address.country"');
      });

      it('accepts a path of 32 segments and refuses one of 33', () => {
        const path = (n: number) =>
          Array.from({ length: n }, () => 'a').join('.');

        expect(caught(build, ['*', `!${path(32)}`])).toBeUndefined();
        const error = caught(build, ['*', `!${path(33)}`]);
        expect(error).toBeInstanceOf(InvalidPermissionError);
        expect((error as InvalidPermissionError).field).toBe(
          'fields.fields[1]',
        );
        expect(
          caught(build, { [path(33)]: { targets: ['x'] } }),
        ).toBeInstanceOf(InvalidPermissionError);
      });
    });
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

  it('rejects two rules of one side carrying the same id', () => {
    const matrix: Matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'read',
          rules: [
            { id: 'owner', when: [] },
            { id: 'owner', when: [] },
          ],
        },
      ],
    };

    expect(() => validateMatrix(matrix)).toThrow(DuplicateRuleIdError);
  });

  it('rejects an allow rule and a deny rule sharing an id', () => {
    const matrix: Matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'read',
          rules: [{ id: 'probation', when: [] }],
          denyRules: [{ id: 'probation', when: [] }],
        },
      ],
    };

    expect(() => validateMatrix(matrix)).toThrow(DuplicateRuleIdError);
  });

  it('accepts one id per permission across two permissions', () => {
    const matrix: Matrix = {
      permissions: [
        {
          key: 'comment.read',
          object: 'comment',
          action: 'read',
          rules: [{ id: 'owner', when: [] }],
        },
        {
          key: 'comment.update',
          object: 'comment',
          action: 'update',
          rules: [{ id: 'owner', when: [] }],
        },
      ],
    };

    expect(() => validateMatrix(matrix)).not.toThrow();
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

  it('rejects a member the canonical permission does not carry', () => {
    for (const member of ['dependsOn', 'requires', 'enabled']) {
      const matrix = {
        permissions: [
          {
            key: 'comment.read',
            object: 'comment',
            action: 'read',
            [member]: ['comment.write'],
          },
        ],
      } as unknown as Matrix;
      expect(() => validateMatrix(matrix)).toThrow(InvalidPermissionError);
    }
  });

  it('rejects a visibility that is neither public nor internal', () => {
    for (const visibility of ['PUBLIC', 'exposed', '', 42, null]) {
      const matrix = {
        permissions: [
          {
            key: 'comment.read',
            object: 'comment',
            action: 'read',
            visibility,
          },
        ],
      } as unknown as Matrix;
      expect(() => validateMatrix(matrix)).toThrow(InvalidPermissionError);
    }
  });

  it('accepts both markings and an absent one', () => {
    for (const visibility of ['public', 'internal', undefined]) {
      const matrix = {
        permissions: [
          {
            key: 'comment.read',
            object: 'comment',
            action: 'read',
            visibility,
          },
        ],
      } as unknown as Matrix;
      expect(() => validateMatrix(matrix)).not.toThrow();
    }
  });

  it('rejects a maxStale that is not a span of milliseconds', () => {
    for (const maxStale of ['60000', -1, Number.NaN, Infinity, null, {}]) {
      const matrix = {
        maxStale,
        permissions: [
          { key: 'comment.read', object: 'comment', action: 'read' },
        ],
      } as unknown as Matrix;
      expect(() => validateMatrix(matrix)).toThrow(InvalidMatrixError);
    }
  });

  it('rejects two permissions under one key', () => {
    const node = { key: 'comment.read', object: 'comment', action: 'read' };

    expect(() => validateMatrix({ permissions: [node, node] })).toThrow(
      DuplicatePermissionError,
    );
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

  it('rejects a config on a field named "fields", naming the clash', () => {
    const matrix = {
      permissions: [
        {
          key: 'comment.update',
          object: 'comment',
          action: 'update',
          fields: { fields: { targets: ['a'] } },
        },
      ],
    } as unknown as Matrix;

    expect(() => validateMatrix(matrix)).toThrow(
      /no field may be called "fields"/,
    );
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

describe('collectIssues', () => {
  it('returns nothing for a valid matrix', () => {
    expect(collectIssues({ permissions: [perm('read')] })).toEqual([]);
  });

  it('sets code to the class name and path to a pointer', () => {
    const [issue] = collectIssues({
      permissions: [perm('read', { fields: { fields: ['ok', 7] } })],
    } as unknown as Matrix);

    expect(issue).toBeInstanceOf(InvalidPermissionError);
    expect(issue?.code).toBe('InvalidPermissionError');
    expect(issue?.path).toBe('/permissions/0/fields/fields/1');
    expect(issue?.permissionKey).toBe('comment.read');
  });

  it('reports three faults in three permissions in document order', () => {
    const matrix = {
      permissions: [
        perm('read', { visibility: 'secret' }),
        perm('update', { rules: 5 }),
        { key: 'comment.delete', object: 'comment', action: 'remove' },
      ],
    } as unknown as Matrix;

    const issues = collectIssues(matrix);

    expect(issues.map((i) => [i.code, i.path, i.permissionKey])).toEqual([
      ['InvalidPermissionError', '/permissions/0/visibility', 'comment.read'],
      ['InvalidPermissionError', '/permissions/1/rules', 'comment.update'],
      ['KeyMismatchError', '/permissions/2/key', 'comment.delete'],
    ]);
    let caught: unknown;
    try {
      validateMatrix(matrix);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidPermissionError);
    expect((caught as Error).message).toBe(
      'permission "comment.read": "visibility" is neither "public" nor "internal"',
    );
  });

  it('throws the first fault when a later permission has a schema fault', () => {
    const matrix = {
      schema: { objects: { comment: { fields: { status: 'string' } } } },
      permissions: [
        perm('read', { visibility: 'x' }),
        perm('update', {
          rules: [{ when: [{ field: 'object.ghost', op: 'eq', value: 'a' }] }],
        }),
      ],
    } as unknown as Matrix;

    expect(collectIssues(matrix).map((i) => i.code)).toEqual([
      'InvalidPermissionError',
      'UnknownFieldError',
    ]);
    expect(() => validateMatrix(matrix)).toThrow(
      'permission "comment.read": "visibility" is neither "public" nor "internal"',
    );
  });

  it('reports one issue when permissions is not an array', () => {
    const issues = collectIssues({
      version: {},
      maxStale: -1,
      permissions: 'x',
    } as unknown as Matrix);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toBeInstanceOf(InvalidMatrixError);
    expect(issues[0]?.path).toBe('/permissions');
  });

  it('reports a document that is not an object at the root', () => {
    const issues = collectIssues(null);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('');
  });

  it('checks rules in a permission whose fields are malformed', () => {
    const issues = collectIssues({
      permissions: [
        perm('read', {
          fields: 'nope',
          rules: [{ id: 'r' }],
        }),
      ],
    } as unknown as Matrix);

    expect(issues.map((i) => [i.code, i.path])).toEqual([
      ['InvalidRuleError', '/permissions/0/rules/0'],
      ['InvalidPermissionError', '/permissions/0/fields'],
    ]);
  });

  it('keeps checking after a bad field list', () => {
    const issues = collectIssues({
      permissions: [
        perm('read', {
          fields: { fields: 'x', status: { targets: 'y' } },
        }),
      ],
    } as unknown as Matrix);

    expect(issues.map((i) => i.path)).toEqual([
      '/permissions/0/fields/fields',
      '/permissions/0/fields/status/targets',
    ]);
  });

  it('gives a condition of invalid shape no schema issue', () => {
    const matrix = {
      schema: { objects: { comment: { fields: { status: 'string' } } } },
      permissions: [
        perm('read', {
          rules: [
            {
              when: [
                { field: 'object.nope', op: 'eq', value: 'a', path: 'b' },
                { field: 'object.ghost', op: 'eq', value: 'a' },
              ],
            },
          ],
        }),
      ],
    } as unknown as Matrix;

    const issues = collectIssues(matrix);

    expect(issues.map((i) => [i.code, i.path])).toEqual([
      ['InvalidConditionError', '/permissions/0/rules/0/when/0'],
      ['UnknownFieldError', '/permissions/0/rules/0/when/1'],
    ]);
  });

  it('skips the schema pass when the schema itself is malformed', () => {
    const issues = collectIssues({
      schema: { objects: { comment: { fields: { status: 'strng' } } } },
      permissions: [
        perm('read', {
          rules: [
            {
              when: [{ field: 'object.status', op: 'eq', value: 'a' }],
            },
          ],
        }),
      ],
    } as unknown as Matrix);

    expect(issues.map((i) => [i.code, i.path])).toEqual([
      ['InvalidSchemaError', '/schema/objects/comment/fields/status'],
    ]);
  });

  it('escapes / and ~ in a pointer segment', () => {
    const [issue] = collectIssues({
      permissions: [perm('read', { fields: { 'a/b~c': 5 } })],
    } as unknown as Matrix);

    expect(issue?.path).toBe('/permissions/0/fields/a~1b~0c');
  });

  it('reports every duplicate key and rule id', () => {
    const issues = collectIssues({
      permissions: [
        perm('read', {
          rules: [
            { id: 'a', when: [] },
            { id: 'a', when: [] },
          ],
        }),
        perm('read'),
      ],
    } as unknown as Matrix);

    expect(issues.map((i) => [i.code, i.path])).toEqual([
      ['DuplicateRuleIdError', '/permissions/0/rules/1/id'],
      ['DuplicatePermissionError', '/permissions/1/key'],
    ]);
  });

  it('reports the nested-path refusals with the permission key', () => {
    const issues = collectIssues({
      permissions: [
        perm('read', { fields: { fields: ['!a.b'] } }),
        perm('update', {
          fields: { fields: ['*'], 'a.b': { targets: [] }, a: { targets: [] } },
        }),
      ],
    } as unknown as Matrix);

    expect(issues.map((i) => [i.code, i.path, i.permissionKey])).toEqual([
      [
        'DenyWithoutBaselineError',
        '/permissions/0/fields/fields/0',
        'comment.read',
      ],
      ['InvalidPermissionError', '/permissions/1/fields/a.b', 'comment.update'],
    ]);
  });

  it('reports freshness faults given the options', () => {
    const matrix: Matrix = { permissions: [perm('read')] };

    expect(collectIssues(matrix)).toEqual([]);
    expect(collectIssues(matrix, { fetchedAt: 1 }).map((i) => i.code)).toEqual([
      'MissingFreshnessBudgetError',
    ]);
    expect(
      collectIssues(
        { ...matrix, maxStale: 5 },
        {
          fetchedAt: 'nope',
          maxStale: -1,
        },
      ).map((i) => [i.code, (i as { field?: string }).field]),
    ).toEqual([
      ['InvalidFreshnessError', 'fetchedAt'],
      ['InvalidFreshnessError', 'maxStale'],
    ]);
    expect(collectIssues({ ...matrix, maxStale: 5 }, { fetchedAt: 1 })).toEqual(
      [],
    );
  });
});

describe('collectIssues past a fault', () => {
  const circular: unknown[] = [];
  circular.push(circular);
  const first = perm('read', { visibility: 'x' });
  const doc = (condition: unknown, schema?: object) =>
    ({
      ...(schema ? { schema } : {}),
      permissions: [first, perm('update', { rules: [{ when: [condition] }] })],
    }) as unknown as Matrix;
  const firstMessage =
    'permission "comment.read": "visibility" is neither "public" nor "internal"';
  const numberSchema = { objects: { comment: { fields: { n: 'number' } } } };
  const stringSchema = {
    objects: { comment: { fields: { status: 'string' } } },
  };

  const cases: [string, Matrix][] = [
    [
      'a bigint comparand against a string field',
      doc({ field: 'object.status', op: 'eq', value: 10n }, stringSchema),
    ],
    ['a bigint op', doc({ field: 'object.status', op: 10n, value: 1 })],
    ['a bigint path', doc({ field: 'object.status', op: 'eq', path: 10n })],
    [
      'a circular list against a number field',
      doc({ field: 'object.n', op: 'in', value: [circular] }, numberSchema),
    ],
    [
      'a circular contains comparand',
      doc(
        { field: 'object.n', op: 'contains', value: circular },
        { objects: { comment: { fields: { n: 'number[]' } } } },
      ),
    ],
  ];

  it.each(cases)('survives %s', (_name, matrix) => {
    expect(() => collectIssues(matrix)).not.toThrow();
    expect(() => validateMatrix(matrix)).toThrow(firstMessage);
    expect(() =>
      hydratePolicy(matrix as unknown as Parameters<typeof hydratePolicy>[0]),
    ).toThrow(firstMessage);
  });

  it("names a bigint in the message of a later permission's fault", () => {
    const [issue] = collectIssues(
      doc({ field: 'object.status', op: 10n, value: 1 }),
    ).slice(1);

    expect(issue?.message).toContain('has an unknown op 10n');
  });
});

describe('collectIssues over a hostile document', () => {
  const first = perm('read', { visibility: 'x' });
  const firstMessage =
    'permission "comment.read": "visibility" is neither "public" nor "internal"';
  const later = (value: unknown, field = 'now') =>
    ({
      permissions: [
        first,
        perm('update', { rules: [{ when: [{ field, op: 'before', value }] }] }),
      ],
    }) as unknown as Matrix;
  const only = (value: unknown) =>
    ({
      permissions: [
        perm('update', {
          rules: [{ when: [{ field: 'now', op: 'before', value }] }],
        }),
      ],
    }) as unknown as Matrix;

  const revoked = (() => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    return proxy;
  })();
  const throwing = {
    get [Symbol.toPrimitive]() {
      throw new Error('boom');
    },
    get toString() {
      throw new Error('boom');
    },
  };
  const hostile: [string, unknown][] = [
    ['a Date prototype with no Date slot', Object.create(Date.prototype)],
    ['a revoked proxy', revoked],
    ['a throwing getter', throwing],
  ];

  it.each(hostile)('keeps the earlier fault with %s later', (_name, value) => {
    expect(() => collectIssues(later(value))).not.toThrow();
    expect(() => validateMatrix(later(value))).toThrow(firstMessage);
  });

  it('reports a Date-less Date as an instant that does not parse', () => {
    const [issue] = collectIssues(only(Object.create(Date.prototype)));

    expect(issue).toBeInstanceOf(InvalidConditionError);
    expect(issue?.message).toContain('does not parse');
  });

  it.each([
    ['a revoked proxy', revoked],
    ['a throwing getter', throwing],
  ])('reports %s as a node that could not be read', (_name, value) => {
    const issues = collectIssues(only(value));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toBeInstanceOf(AclConfigError);
  });

  it('reports a permission whose member getter throws, and goes on', () => {
    const bad = perm('read');
    Object.defineProperty(bad, 'rules', {
      enumerable: true,
      get(): unknown {
        throw new Error('boom');
      },
    });
    const issues = collectIssues({
      permissions: [bad, perm('update', { visibility: 'x' })],
    } as unknown as Matrix);

    expect(issues.map((i) => [i.code, i.path])).toEqual([
      ['InvalidMatrixError', '/permissions/0'],
      ['InvalidPermissionError', '/permissions/1/visibility'],
    ]);
    expect(issues[0]?.message).toBe(
      'invalid matrix: permission [0] "comment.read" could not be read',
    );
    expect(issues[0]?.permissionKey).toBe('comment.read');
  });

  it('reports a document that cannot be read as one issue at the root', () => {
    const issues = collectIssues(revoked);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toBeInstanceOf(InvalidMatrixError);
    expect(issues[0]?.message).toContain('could not be read');
    expect(issues[0]?.path).toBe('');
  });

  it('reads each permission once, the way a plain walk does', () => {
    const log: string[] = [];
    const traced = new Proxy(
      { key: 'zz.read', object: 'zz', action: 'read', visibility: 'x' },
      {
        get(target, name, receiver) {
          log.push(String(name));
          return Reflect.get(target, name, receiver);
        },
      },
    );

    collectIssues({ permissions: [traced] } as unknown as Matrix);

    expect(log.filter((name) => name === 'key')).toHaveLength(1);
  });

  it('collects the permissions after an element that throws when read', () => {
    const permissions: unknown[] = [perm('read')];
    Object.defineProperty(permissions, '1', {
      enumerable: true,
      get(): unknown {
        throw new Error('boom');
      },
    });
    permissions.push(perm('delete', { visibility: 'x' }));

    const issues = collectIssues({ permissions } as unknown as Matrix);

    expect(issues.map((i) => [i.code, i.path])).toEqual([
      ['InvalidMatrixError', '/permissions/1'],
      ['InvalidPermissionError', '/permissions/2/visibility'],
    ]);
    expect(issues[0]?.message).toBe(
      'invalid matrix: permission [1] could not be read',
    );
  });
});

describe('validateAll', () => {
  const faulty = {
    permissions: [
      perm('read', { visibility: 'x' }),
      perm('update', { rules: [{ when: [{ field: 'now', op: 'nope' }] }] }),
    ],
  } as unknown as Matrix;

  it('returns [] for a valid document', () => {
    expect(
      validateAll({ permissions: [perm('read'), perm('update')] }),
    ).toEqual([]);
  });

  it.each([
    ['null', null],
    ['a number', 42],
    ['permissions that is a string', { permissions: 'x' }],
  ])('returns one issue for %s and does not throw', (_name, value) => {
    expect(() => validateAll(value)).not.toThrow();
    expect(validateAll(value)).toHaveLength(1);
  });

  it.each([
    [{ '': { targets: [1] } }, 'fields[""]'],
    [{ '': 'x' }, 'fields[""]'],
    [{ '': { targets: 'x' } }, 'fields[""].targets'],
  ])('names an empty config key as a location', (fields, where) => {
    const issues = validateAll({
      permissions: [{ ...perm('update'), rules: [{ when: [] }], fields }],
    });

    expect(issues.map((issue) => issue.message)).toContainEqual(
      expect.stringContaining(`"${where}" `),
    );
    for (const issue of issues) {
      expect(issue.message).not.toContain('"fields."');
    }
  });

  it('lists every fault, in document order', () => {
    expect(validateAll(faulty).map((i) => [i.code, i.path])).toEqual([
      ['InvalidPermissionError', '/permissions/0/visibility'],
      ['InvalidConditionError', '/permissions/1/rules/0/when/0'],
    ]);
  });

  it('returns plain objects that survive a JSON round trip', () => {
    const issues = validateAll(faulty);

    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(Object.getPrototypeOf(issue)).toBe(Object.prototype);
      expect(JSON.parse(JSON.stringify(issue))).toEqual(issue);
    }
    expect(issues[0]).toEqual({
      code: 'InvalidPermissionError',
      message: expect.any(String),
      path: '/permissions/0/visibility',
      permissionKey: 'comment.read',
    });
  });

  it('omits permissionKey on an issue outside a permission', () => {
    const [issue] = validateAll(null);

    expect(issue && 'permissionKey' in issue).toBe(false);
  });

  it('reports a fetchedAt with no budget as MissingFreshnessBudgetError', () => {
    const issues = validateAll(
      { permissions: [perm('read')] },
      { fetchedAt: Date.now() },
    );

    expect(issues.map((i) => i.code)).toEqual(['MissingFreshnessBudgetError']);
  });

  it('reports a local maxStale that is not a duration', () => {
    const issues = validateAll(
      { permissions: [perm('read')], maxStale: 1000 },
      { fetchedAt: Date.now(), maxStale: -1 },
    );

    expect(issues.map((i) => i.code)).toEqual(['InvalidFreshnessError']);
  });

  it('reports an unreadable permission once when a schema is present', () => {
    const bad = perm('read');
    Object.defineProperty(bad, 'rules', {
      enumerable: true,
      get(): unknown {
        throw new Error('boom');
      },
    });
    const issues = collectIssues({
      schema: { objects: { comment: { fields: { n: 'number' } } } },
      permissions: [bad],
    } as unknown as Matrix);

    expect(issues.map((i) => i.path)).toEqual(['/permissions/0']);
  });

  it('reports a value the copy cannot clone, then the rest of the document', () => {
    const issues = validateAll({
      permissions: [
        perm('read', { rules: [{ id: 'r', when: [], extra: () => 1 }] }),
        perm('update', { visibility: 'x' }),
      ],
    });

    expect(issues.map((i) => i.path)).toEqual([
      '/permissions/0',
      '/permissions/1/visibility',
    ]);
    expect(issues[0]?.message).toContain('cannot be cloned');
  });

  it('keeps the clone refusals when a later permission cannot be read', () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    const issues = validateAll({
      permissions: [perm('read', { extra: () => 1 }), proxy],
    });

    expect(issues.map((i) => i.path)).toEqual([
      '/permissions/0',
      '/permissions/1',
    ]);
    expect(issues[0]?.message).toContain('cannot be cloned');
  });

  it('reports a permission with a throwing getter once', () => {
    const bad = perm('read');
    Object.defineProperty(bad, 'rules', {
      enumerable: true,
      get(): unknown {
        throw new Error('boom');
      },
    });
    const issues = validateAll({ permissions: [bad] });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('/permissions/0');
  });

  it('names the permission in a clone refusal', () => {
    const [issue] = validateAll({
      permissions: [perm('read', { extra: () => 1 })],
    });

    expect(issue?.permissionKey).toBe('comment.read');
  });

  it('lets the version option override the document version', () => {
    const doc = { version: {}, permissions: [] };

    expect(validateAll(doc)).toHaveLength(1);
    expect(validateAll(doc, { version: 'v' })).toEqual([]);
    expect(() => hydratePolicy(doc as never, { version: 'v' })).not.toThrow();
  });

  it('reports an option that cannot be read as a fault of that option', () => {
    const options = {
      get fetchedAt(): number {
        throw new Error('boom');
      },
    };
    const issues = validateAll({ permissions: [] }, options as never);

    expect(issues.map((i) => [i.code, i.path])).toEqual([
      ['InvalidFreshnessError', ''],
    ]);
    expect(issues[0]?.message).toContain('options');
    expect(validateAll({ permissions: [] }, null as never)).toHaveLength(1);
  });

  it('reports a fetchedAt that cannot become an instant as a fault of fetchedAt', () => {
    const issues = validateAll(
      { permissions: [], maxStale: 1 },
      { fetchedAt: Object.create(Date.prototype) },
    );

    expect(issues.map((i) => i.code)).toEqual(['InvalidFreshnessError']);
    expect(issues[0]?.message).toContain('fetchedAt');
  });

  it('leaves the caller document unfrozen', () => {
    const doc = { permissions: [perm('read')] };
    validateAll(doc);

    expect(Object.isFrozen(doc)).toBe(false);
    expect(Object.isFrozen(doc.permissions[0])).toBe(false);
  });

  it('does not throw on a document that cannot be read', () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();

    expect(() => validateAll(proxy)).not.toThrow();
    expect(validateAll(proxy)).toHaveLength(1);
  });

  it('is empty exactly when hydratePolicy constructs, over 2,000 junk documents', () => {
    let clean = 0;
    let refused = 0;

    for (let seed = 1; seed <= 2000; seed++) {
      const candidate = junkMatrix(new Gen(rng(seed)));
      let issues: ReturnType<typeof validateAll> = [];

      expect(() => {
        issues = validateAll(candidate);
      }, `seed ${seed}`).not.toThrow();

      let thrown: unknown;
      try {
        hydratePolicy(candidate);
      } catch (error) {
        thrown = error;
      }

      if (thrown === undefined) {
        expect(issues, `seed ${seed}`).toEqual([]);
        clean++;
      } else {
        expect(thrown, `seed ${seed}`).toBeInstanceOf(AclConfigError);
        expect(issues[0]?.code, `seed ${seed}`).toBe(
          (thrown as AclConfigError).name,
        );
        refused++;
      }
    }
    expect(clean).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
  });
});
