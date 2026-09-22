/**
 * Tier 1: the library prevents it.
 *
 * Every test here is an attack attempt whose only acceptable outcomes are a
 * refusal at construction or a decision that does not grant. A name states what
 * must hold. The register in `libs/acl/SECURITY.md` carries one entry per
 * `SEC-` identifier below; adding a class is an entry plus a test.
 */

import { describe, expect, it } from 'vitest';

import {
  AclConfigError,
  ActionNotAllowedError,
  InvalidConditionError,
  InvalidMatrixError,
  InvalidRuleError,
  KeyMismatchError,
  UnknownPermissionError,
} from '../errors.js';
import { hydratePolicy } from '../hydrate-policy.js';
import { pickAllowedFields } from '../fields.js';
import { parseMatrix } from '../parse-matrix.js';
import { ruleId } from '../rule-id.js';
import {
  always,
  countingSubject,
  foreign,
  fromJson,
  local,
  permission,
  raw,
  rawMatrix,
  when,
} from './fixtures.js';
import { Gen, rng } from './generator.js';
import type { Condition, Permission } from '../types.js';

describe('SEC-001 mass assignment through an undecided key (CWE-915)', () => {
  const editable = () =>
    foreign([
      permission('user', 'update', {
        rules: [always],
        fields: { fields: ['*', '!role'] },
      }),
    ]);

  // #region sec-001
  it('decides a key that exists only in the proposed write', () => {
    const decision = editable().canFields(
      { id: 'u1' },
      'user',
      'update',
      { id: 'u1', name: 'Ada' },
      'write',
      { name: 'Grace', role: 'admin' },
    );

    expect(decision.fields['role']).toBe('denied');
    expect(decision.allowed).toBe(false);
  });
  // #endregion sec-001

  it('withholds the excluded key from the narrowed write', () => {
    const access = editable();
    const proposed = { name: 'Grace', role: 'admin' };
    const decision = access.canFields(
      { id: 'u1' },
      'user',
      'update',
      { id: 'u1' },
      'write',
      proposed,
    );

    expect(pickAllowedFields(decision, proposed)).toEqual({ name: 'Grace' });
  });
});

describe('SEC-002 an unconditional grant must be written as one (CWE-1188)', () => {
  const withWhen = (node: Record<string, unknown>) =>
    foreign([
      raw({
        key: 'post.read',
        object: 'post',
        action: 'read',
        rules: [node],
      }),
    ]);

  // #region sec-002
  it('refuses a rule with no when', () => {
    expect(() => withWhen({})).toThrow(InvalidRuleError);
  });
  // #endregion sec-002

  it('refuses a null when', () => {
    expect(() => withWhen({ when: null })).toThrow(InvalidRuleError);
  });

  it('refuses a when that is not a list of conditions', () => {
    expect(() => withWhen({ when: { field: 'subject.id' } })).toThrow(
      InvalidRuleError,
    );
    expect(() => withWhen({ when: 'always' })).toThrow(InvalidRuleError);
  });

  it('refuses a deny rule with no when', () => {
    expect(() =>
      foreign([
        raw({
          key: 'post.read',
          object: 'post',
          action: 'read',
          rules: [always],
          denyRules: [{}],
        }),
      ]),
    ).toThrow(InvalidRuleError);
  });
});

describe('SEC-003 a permission is reachable only under its own key (CWE-566)', () => {
  // #region sec-003
  it('refuses a key that disagrees with object and action', () => {
    expect(() =>
      foreign([
        raw({
          key: 'post.read',
          object: 'post',
          action: 'delete',
          rules: [always],
        }),
      ]),
    ).toThrow(KeyMismatchError);
  });
  // #endregion sec-003

  it('refuses a delimiter in an object kind or an action', () => {
    expect(() =>
      foreign([
        raw({
          key: 'a.b.read',
          object: 'a.b',
          action: 'read',
          rules: [always],
        }),
      ]),
    ).toThrow(AclConfigError);
    expect(() =>
      foreign([
        raw({
          key: 'a.b.read',
          object: 'a',
          action: 'b.read',
          rules: [always],
        }),
      ]),
    ).toThrow(AclConfigError);
  });
});

describe('SEC-004 a deny that cannot be read does not step aside (CWE-863)', () => {
  const guarded = () =>
    foreign([
      permission('doc', 'read', {
        rules: [always],
        denyRules: [when({ field: 'object.embargoed', op: 'eq', value: true })],
      }),
    ]);

  // #region sec-004
  it('refuses when the projection lacks the field the deny reads', () => {
    const decision = guarded().can({ id: 'u1' }, 'doc', 'read', { id: 'd1' });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('unevaluable');
    expect(decision.missing).toEqual(['object.embargoed']);
  });
  // #endregion sec-004

  it('allows once the projection carries the field', () => {
    const decision = guarded().can({ id: 'u1' }, 'doc', 'read', {
      id: 'd1',
      embargoed: false,
    });

    expect(decision.allowed).toBe(true);
  });

  it('refuses a field write the deny side could not settle', () => {
    const decision = guarded().canFields(
      { id: 'u1' },
      'doc',
      'read',
      { id: 'd1' },
      'write',
      { title: 'x' },
    );

    expect(decision.allowed).toBe(false);
    expect(() => pickAllowedFields(decision, { title: 'x' })).toThrow(
      ActionNotAllowedError,
    );
  });
});

describe('SEC-005 a prototype member never decides a condition (CWE-1321)', () => {
  const probe = (field: string): Condition => ({
    field,
    op: 'eq',
    value: 'admin',
  });

  // #region sec-005
  it('reads no inherited member off the subject', () => {
    const access = foreign([
      permission('post', 'read', { rules: [when(probe('subject.toString'))] }),
    ]);

    expect(access.can({ id: 'u1' }, 'post', 'read').allowed).toBe(false);
  });
  // #endregion sec-005

  it('reads no inherited member off the object', () => {
    const access = foreign([
      permission('post', 'read', {
        rules: [when(probe('object.constructor'))],
      }),
    ]);
    const decision = access.can({ id: 'u1' }, 'post', 'read', { id: 'p1' });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('unevaluable');
  });

  it('leaves the object prototype clean after a hostile write decision', () => {
    const access = foreign([
      permission('post', 'update', {
        rules: [always],
        fields: { fields: ['*', '!role'] },
      }),
    ]);
    access.canFields(
      fromJson('{"__proto__": {"polluted": "yes"}}'),
      'post',
      'update',
      fromJson('{"__proto__": {"polluted": "yes"}, "title": "x"}'),
      'write',
      fromJson('{"__proto__": {"polluted": "yes"}, "title": "y"}'),
    );

    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('SEC-006 a prototype member names no transition edge (CWE-1321)', () => {
  const machine = () =>
    foreign([
      permission('post', 'update', {
        rules: [always],
        fields: { status: { transitions: { draft: ['published'] } } },
      }),
    ]);

  // #region sec-006
  it('denies a current value that names an inherited member', () => {
    for (const current of ['toString', 'constructor', '__proto__']) {
      const decision = machine().canFields(
        { id: 'u1' },
        'post',
        'update',
        { status: current },
        'write',
        { status: 'published' },
      );

      expect(decision.fields['status']).toBe('denied');
      expect(decision.reasons['status']).toBe('transition-failed');
    }
  });
  // #endregion sec-006
});

describe('SEC-007 a narrowed write never carries a prototype setter (CWE-1321)', () => {
  const access = () =>
    foreign([
      permission('user', 'update', {
        rules: [always],
        fields: { fields: ['*', '!role'] },
      }),
    ]);

  // #region sec-007
  it('carries no __proto__ key into the decision', () => {
    const proposed = fromJson(
      '{"__proto__": {"isAdmin": true}, "name": "Grace"}',
    );
    const decision = access().canFields(
      { id: 'u1' },
      'user',
      'update',
      {},
      'write',
      proposed,
    );

    expect(Object.hasOwn(decision.fields, '__proto__')).toBe(false);
  });
  // #endregion sec-007

  it('applies to a row without moving its prototype', () => {
    const proposed = fromJson(
      '{"__proto__": {"isAdmin": true}, "name": "Grace"}',
    );
    const decision = access().canFields(
      { id: 'u1' },
      'user',
      'update',
      {},
      'write',
      proposed,
    );
    const writable = pickAllowedFields(decision, proposed);

    const row: Record<string, unknown> = { id: 'u1' };
    Object.assign(row, writable);

    expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
    expect((row as { isAdmin?: unknown }).isAdmin).toBeUndefined();
    expect(row).toEqual({ id: 'u1', name: 'Grace' });
  });

  it('carries no __proto__ key even where a schema declares one', () => {
    // A schema is binding over the conditions and states nothing about the
    // writable set, so declaring the name does not make it a field.
    const declared = foreign(
      [
        permission('user', 'update', {
          rules: [always],
          fields: { fields: ['*', '!role'] },
        }),
      ],
      undefined,
      {
        schema: {
          objects: {
            user: fromJson(
              '{"fields": {"__proto__": "string", "name": "string"}}',
            ),
          },
        },
      },
    );
    const proposed = fromJson(
      '{"__proto__": {"isAdmin": true}, "name": "Grace"}',
    );
    const decision = declared.canFields(
      { id: 'u1' },
      'user',
      'update',
      {},
      'write',
      proposed,
    );

    expect(Object.keys(decision.fields)).toEqual(['name']);
    expect(pickAllowedFields(decision, proposed)).toEqual({ name: 'Grace' });
  });

  it('reads a declared __proto__ path as data, never as a prototype', () => {
    // The schema makes the condition constructible; `readPath` is own-property
    // guarded, so the value it reads is whatever the bag carries under that
    // own key and nothing off the chain.
    const access = foreign(
      [
        permission('user', 'read', {
          rules: [when({ field: 'object.__proto__', op: 'eq', value: 'yes' })],
        }),
      ],
      undefined,
      {
        schema: {
          objects: { user: fromJson('{"fields": {"__proto__": "string"}}') },
        },
      },
    );

    expect(access.can({}, 'user', 'read', { name: 'Ada' }).reason).toBe(
      'unevaluable',
    );
    expect(
      access.can({}, 'user', 'read', fromJson('{"__proto__": "yes"}')).allowed,
    ).toBe(true);
    expect(({} as Record<string, unknown>)['isAdmin']).toBeUndefined();
  });
});

describe('SEC-008 authoring tokens never key a decision (CWE-915)', () => {
  const access = () =>
    foreign([
      permission('user', 'update', {
        rules: [always],
        fields: { fields: ['*', '!role'] },
      }),
    ]);

  // #region sec-008
  it('drops a proposed key spelled as a baseline or an exclusion', () => {
    const proposed = { '*': 'everything', '!role': 'admin', name: 'Grace' };
    const decision = access().canFields(
      { id: 'u1' },
      'user',
      'update',
      {},
      'write',
      proposed,
    );

    expect(Object.keys(decision.fields)).toEqual(['name']);
    expect(pickAllowedFields(decision, proposed)).toEqual({ name: 'Grace' });
  });
  // #endregion sec-008

  it('drops an object key spelled as a baseline or an exclusion', () => {
    const decision = access().canFields(
      { id: 'u1' },
      'user',
      'update',
      { '*': 1, '!role': 2, name: 'Ada' },
      'read',
    );

    expect(Object.keys(decision.fields)).toEqual(['name']);
  });
});

describe('SEC-009 an operand the engine would ignore is refused (CWE-20)', () => {
  const cases: readonly (readonly [string, Record<string, unknown>])[] = [
    [
      'a membership test without a list',
      { field: 'subject.roles', op: 'in', value: 'admin' },
    ],
    [
      'a membership test over an object',
      { field: 'subject.roles', op: 'not-in', value: { admin: true } },
    ],
    [
      'an equality with two comparands',
      { field: 'subject.id', op: 'eq', path: 'object.ownerId', value: 'u1' },
    ],
    ['an equality with no comparand', { field: 'subject.id', op: 'eq' }],
    [
      'a path on an operator that reads a literal',
      { field: 'subject.roles', op: 'contains', path: 'subject.id' },
    ],
    [
      'a containment test with no value',
      { field: 'subject.roles', op: 'contains' },
    ],
    ['a clock read by a value operator', { field: 'now', op: 'eq', value: 1 }],
    [
      'a value path read by a clock operator',
      { field: 'subject.at', op: 'before', value: 1 },
    ],
    [
      'a clock boundary that is not an instant',
      { field: 'now', op: 'before', value: { at: 1 } },
    ],
    [
      'a path below its scope',
      { field: 'subject.profile.role', op: 'eq', value: 'admin' },
    ],
    [
      'a path naming no scope',
      { field: 'session.role', op: 'eq', value: 'admin' },
    ],
    [
      'a comparand path naming no scope',
      { field: 'subject.id', op: 'eq', path: 'window.id' },
    ],
    [
      'a condition that is not an object',
      { field: 'subject.id', op: 'eq', value: 'u1' },
    ],
  ];

  for (const [name, condition] of cases.slice(0, -1)) {
    it(`refuses ${name}`, () => {
      expect(() =>
        foreign([
          permission('post', 'read', {
            rules: [when(condition as unknown as Condition)],
          }),
        ]),
      ).toThrow(InvalidConditionError);
    });
  }

  // #region sec-009
  it('refuses a condition that is not an object', () => {
    for (const node of [null, 'subject.id', 42, []]) {
      expect(() =>
        foreign([
          raw({
            key: 'post.read',
            object: 'post',
            action: 'read',
            rules: [{ when: [node] }],
          }),
        ]),
      ).toThrow(InvalidConditionError);
    }
  });
  // #endregion sec-009
});

describe('SEC-010 nothing is allowed without a rule that says so (CWE-276)', () => {
  // #region sec-010
  it('refuses a permission with no rules at all', () => {
    const access = foreign([permission('post', 'read')]);

    expect(access.can({ id: 'u1' }, 'post', 'read').allowed).toBe(false);
    expect(access.can({ id: 'u1' }, 'post', 'read').reason).toBe(
      'no-rule-matched',
    );
  });
  // #endregion sec-010

  it('refuses a permission whose rule list is empty', () => {
    const access = foreign([permission('post', 'read', { rules: [] })]);

    expect(access.can({ id: 'u1' }, 'post', 'read').allowed).toBe(false);
  });

  it('refuses every action of an object kind the matrix does not name', () => {
    const access = foreign([permission('post', 'read', { rules: [always] })]);

    expect(access.can({ id: 'u1' }, 'invoice', 'read').allowed).toBe(false);
    expect(access.can({ id: 'u1' }, 'post', 'delete').reason).toBe(
      'unknown-action',
    );
  });
});

describe('SEC-011 an unknown key never reads as a grant (CWE-276)', () => {
  // #region sec-011
  it('answers a foreign matrix with a refusal', () => {
    const access = foreign([permission('post', 'read', { rules: [always] })]);
    const decision = access.can({ id: 'u1' }, 'anything', 'at-all');

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('unknown-action');
  });
  // #endregion sec-011

  it('answers an authored matrix with a throw', () => {
    const access = local([permission('post', 'read', { rules: [always] })]);

    expect(() => access.can({ id: 'u1' }, 'post', 'delete')).toThrow(
      UnknownPermissionError,
    );
  });

  it('answers a narrowed write against an unknown key with no writable field', () => {
    const access = foreign([permission('post', 'read', { rules: [always] })]);
    const decision = access.canFields(
      { id: 'u1' },
      'post',
      'delete',
      {},
      'write',
      { title: 'x' },
    );

    expect(() => pickAllowedFields(decision, { title: 'x' })).toThrow(
      ActionNotAllowedError,
    );
  });
});

describe('SEC-012 the evaluated matrix is beyond the caller reach (CWE-913)', () => {
  // #region sec-012
  it('ignores a mutation of the matrix the caller passed in', () => {
    const source: Permission[] = [permission('post', 'read', { rules: [] })];
    const access = foreign(source);

    (source[0] as { rules: unknown }).rules = [always];

    expect(access.can({ id: 'u1' }, 'post', 'read').allowed).toBe(false);
  });
  // #endregion sec-012

  it('refuses a mutation of the matrix it exposes', () => {
    const access = foreign([permission('post', 'read', { rules: [] })]);
    const exposed = access.matrix.permissions[0] as { rules?: unknown };

    expect(() => {
      exposed.rules = [always];
    }).toThrow(TypeError);
    expect(Object.isFrozen(access.matrix)).toBe(true);
    expect(access.can({ id: 'u1' }, 'post', 'read').allowed).toBe(false);
  });
});

describe('SEC-013 validation binds the copy that is evaluated (CWE-367)', () => {
  /** A property that answers the first read one way and every later one another. */
  function twoFaced<T>(first: T, then: T): { get(): T } {
    let read = 0;
    return {
      get: () => (read++ === 0 ? first : then),
    };
  }

  // #region sec-013
  it('cannot turn a conditional rule into an unconditional one', () => {
    const face = twoFaced<readonly Condition[]>(
      [{ field: 'subject.role', op: 'eq', value: 'admin' }],
      [],
    );
    const access = local([
      permission('post', 'read', {
        rules: [
          {
            get when() {
              return face.get();
            },
          },
        ],
      }),
    ]);

    expect(access.can({ role: 'nobody' }, 'post', 'read').allowed).toBe(false);
  });
  // #endregion sec-013

  it('cannot widen a field allow-list after it is checked', () => {
    const face = twoFaced<readonly string[]>(['title'], ['*']);
    const access = local([
      permission('post', 'update', {
        rules: [always],
        fields: {
          get fields() {
            return face.get();
          },
        },
      }),
    ]);
    const decision = access.canFields(
      { id: 'u1' },
      'post',
      'update',
      {},
      'write',
      { role: 'admin' },
    );

    expect(decision.fields['role']).toBe('denied');
  });

  it('cannot move a permission to an object kind that was never checked', () => {
    const face = twoFaced('comment', 'post');
    const access = local([
      raw({
        key: 'comment.read',
        action: 'read',
        rules: [always],
        get object() {
          return face.get();
        },
      }),
    ]);
    const adopted = access.matrix.permissions[0] as Permission;

    expect(adopted.key).toBe(`${adopted.object}.${adopted.action}`);
    expect(access.can({}, 'comment', 'read').allowed).toBe(true);
    expect(() => access.can({}, 'post', 'read')).toThrow(AclConfigError);
  });

  it('cannot swap the whole permission list after it is checked', () => {
    const gated = permission('post', 'read', {
      rules: [when({ field: 'subject.role', op: 'eq', value: 'admin' })],
    });
    const face = twoFaced<readonly Permission[]>(
      [gated],
      [permission('post', 'read', { rules: [always] })],
    );
    const access = hydratePolicy(
      rawMatrix({
        get permissions() {
          return face.get();
        },
      }),
    );

    expect(access.can({ role: 'nobody' }, 'post', 'read').allowed).toBe(false);
    expect(access.matrix.permissions).toEqual([gated]);
  });

  it('cannot narrow a schema after its conditions are checked against it', () => {
    // The declared shapes bind the conditions, so a schema that shrinks after
    // the check leaves a matrix that was never validated against what it
    // carries.
    const face = twoFaced(
      { objects: { post: { fields: { secret: 'string' as const } } } },
      { objects: { post: { fields: { other: 'number' as const } } } },
    );
    const access = hydratePolicy(
      rawMatrix({
        permissions: [
          permission('post', 'read', {
            rules: [when({ field: 'object.secret', op: 'eq', value: 'x' })],
          }),
        ],
        get schema() {
          return face.get();
        },
      }),
    );

    expect(access.schema).toEqual({
      objects: { post: { fields: { secret: 'string' } } },
    });
  });

  it('cannot replace the version the document was frozen with', () => {
    const face = twoFaced<unknown>('v1', { evil: true });
    const access = hydratePolicy(
      rawMatrix({
        permissions: [],
        get version() {
          return face.get();
        },
      }),
    );

    expect(access.version).toBe('v1');
    expect(access.matrix.version).toBe('v1');
  });
});

describe('SEC-014 a decision never throws on the data it is given (CWE-754)', () => {
  const machine = () =>
    foreign([
      permission('post', 'update', {
        rules: [always],
        fields: { status: { transitions: { draft: ['published'] } } },
      }),
    ]);

  // #region sec-014
  const hostile: readonly (readonly [string, unknown])[] = [
    ['a value with no prototype', Object.create(null)],
    [
      'a value whose coercion throws',
      {
        toString: () => {
          throw new Error('boom');
        },
      },
    ],
    ['a symbol', Symbol('draft')],
    ['a list', ['draft']],
    ['a value that coerces to a legal edge', { toString: () => 'draft' }],
  ];

  for (const [name, current] of hostile) {
    it(`denies a transition from ${name}`, () => {
      const decision = machine().canFields(
        { id: 'u1' },
        'post',
        'update',
        { status: current },
        'write',
        { status: 'published' },
      );

      expect(decision.fields['status']).toBe('denied');
      expect(decision.reasons['status']).toBe('transition-failed');
    });
  }
  // #endregion sec-014

  it('reads a primitive current value as the edge it names', () => {
    const access = foreign([
      permission('post', 'update', {
        rules: [always],
        fields: { status: { transitions: { draft: ['published'], 1: ['2'] } } },
      }),
    ]);

    expect(
      access.canFields({}, 'post', 'update', { status: 1 }, 'write', {
        status: '2',
      }).fields['status'],
    ).toBe('allowed');
  });
});

describe('SEC-015 a matrix cannot exhaust the walk that adopts it (CWE-674)', () => {
  // #region sec-015
  it('refuses a value nested deeper than the copy walks', () => {
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let i = 0; i < 100_000; i++) {
      const next: Record<string, unknown> = {};
      deep['n'] = next;
      deep = next;
    }

    expect(() =>
      foreign([
        permission('post', 'read', {
          rules: [when({ field: 'subject.id', op: 'eq', value: root })],
        }),
      ]),
    ).toThrow(InvalidMatrixError);
  });
  // #endregion sec-015
});

describe('SEC-016 the cost of a decision is bounded by the matrix (CWE-400)', () => {
  const chainOf = (depth: number) =>
    Array.from({ length: depth }, (_, i) =>
      permission(`c${i}`, 'read', {
        rules: [when({ field: 'subject.id', op: 'eq', value: 'u1' })],
      }),
    );

  // #region sec-016
  it('reads the subject once per permission across the whole matrix', () => {
    const access = foreign(
      Array.from({ length: 2_000 }, (_, i) =>
        permission(`w${i}`, 'read', {
          rules: [when({ field: 'subject.id', op: 'eq', value: 'u1' })],
        }),
      ),
    );
    const { subject, reads, reset } = countingSubject({ id: 'u1' });
    reset();
    access.capabilities(subject);

    expect(reads()).toBe(2_000);
  });
  // #endregion sec-016

  it('reads the subject once per object in a batch, not once per pair', () => {
    const access = foreign(chainOf(3));
    const { subject, reads, reset } = countingSubject({ id: 'u1' });
    const objects = Array.from({ length: 500 }, (_, i) => ({ id: `o${i}` }));
    reset();
    access.canMany(subject, 'c2', 'read', objects);

    expect(reads()).toBe(objects.length);
  });

  it('reads the subject once however wide the list a condition tests', () => {
    const access = foreign([
      permission('post', 'read', {
        rules: [
          when({
            field: 'subject.id',
            op: 'in',
            value: Array.from({ length: 200_000 }, (_, i) => `u${i}`),
          }),
        ],
      }),
    ]);
    const { subject, reads, reset } = countingSubject({ id: 'nobody' });
    reset();

    expect(access.can(subject, 'post', 'read').allowed).toBe(false);
    expect(reads()).toBe(1);
  });
});

describe('SEC-017 a value of the wrong type is a miss, not a match (CWE-1287)', () => {
  const equals = (value: unknown) =>
    foreign([
      permission('post', 'read', {
        rules: [when({ field: 'subject.tier', op: 'eq', value })],
      }),
    ]);

  // #region sec-017
  it('does not match a string against the number it spells', () => {
    expect(equals(1).can({ tier: '1' }, 'post', 'read').allowed).toBe(false);
    expect(equals('1').can({ tier: 1 }, 'post', 'read').allowed).toBe(false);
  });
  // #endregion sec-017

  it('does not match a null against an absent attribute', () => {
    expect(equals(null).can({}, 'post', 'read').allowed).toBe(false);
    expect(equals(null).can({ tier: null }, 'post', 'read').allowed).toBe(true);
    expect(equals(null).can({ tier: undefined }, 'post', 'read').allowed).toBe(
      false,
    );
  });

  it('does not match a list against the scalar it holds', () => {
    expect(equals('gold').can({ tier: ['gold'] }, 'post', 'read').allowed).toBe(
      false,
    );
  });

  it('does not match a Date against the string that spells it', () => {
    const access = foreign([
      permission('post', 'read', {
        rules: [
          when({ field: 'object.at', op: 'eq', value: '2020-01-01T00:00:00Z' }),
        ],
      }),
    ]);

    expect(
      access.can({}, 'post', 'read', { at: new Date('2020-01-01T00:00:00Z') })
        .allowed,
    ).toBe(false);
  });

  it('tests membership of a list only against a list', () => {
    const access = foreign([
      permission('post', 'read', {
        rules: [when({ field: 'object.editors', op: 'contains', value: 'u1' })],
      }),
    ]);

    expect(access.can({}, 'post', 'read', { editors: ['u1'] }).allowed).toBe(
      true,
    );
    expect(access.can({}, 'post', 'read', { editors: 'u1' }).allowed).toBe(
      false,
    );
    expect(
      access.can({}, 'post', 'read', { editors: { u1: true } }).allowed,
    ).toBe(false);
  });

  it('reads a signed zero as the zero it equals', () => {
    expect(equals(0).can({ tier: -0 }, 'post', 'read').allowed).toBe(true);
    expect(equals(-0).can({ tier: 0 }, 'post', 'read').allowed).toBe(true);
  });
});

describe('SEC-018 a clock that does not settle decides nothing (CWE-754)', () => {
  /** Every shape a supplied clock arrives in that is not a point in time. */
  const unusable = [
    ['a string that is not a date', 'not a date'],
    ['an empty string', ''],
    ['a non-ISO string', '01/02/2020 sometime'],
    ['NaN', Number.NaN],
    ['an Invalid Date', new Date('nope')],
    ['null', null],
  ] as const;

  const allowWindow = () =>
    foreign([
      permission('sale', 'buy', {
        rules: [when({ field: 'now', op: 'before', value: '2999-01-01' })],
      }),
    ]);

  const denyWindow = () =>
    foreign([
      permission('sale', 'buy', {
        rules: [always],
        denyRules: [when({ field: 'now', op: 'after', value: '2020-01-01' })],
      }),
    ]);

  for (const [name, clock] of unusable) {
    it(`refuses a time-gated allow when the clock is ${name}`, () => {
      const decision = allowWindow().can(
        {},
        'sale',
        'buy',
        undefined,
        clock as never,
      );
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('unusable-clock');
    });

    it(`refuses a time-gated deny when the clock is ${name}`, () => {
      const decision = denyWindow().can(
        {},
        'sale',
        'buy',
        undefined,
        clock as never,
      );
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('unusable-clock');
    });
  }

  it('denies the same permission under a clock that parses', () => {
    expect(
      denyWindow().can({}, 'sale', 'buy', undefined, '2026-01-01').reason,
    ).toBe('denied');
  });

  // #region sec-018
  it('refuses the deny side ahead of an allow rule that matched', () => {
    const denied = when({ field: 'now', op: 'after', value: '2020-01-01' });
    const access = foreign([
      permission('sale', 'buy', {
        rules: [always, when({ field: 'subject.id', op: 'eq', value: 's1' })],
        denyRules: [denied],
      }),
    ]);

    const decision = access.can(
      { id: 's1' },
      'sale',
      'buy',
      undefined,
      'not a date' as never,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('unusable-clock');
    expect(decision.rule).toBe(ruleId(denied, 'deny'));
  });
  // #endregion sec-018

  it('refuses ahead of an unevaluable object path rather than asking for a refetch', () => {
    const access = foreign([
      permission('sale', 'buy', {
        rules: [always],
        denyRules: [
          when(
            { field: 'now', op: 'after', value: '2020-01-01' },
            { field: 'object.locked', op: 'eq', value: true },
          ),
        ],
      }),
    ]);

    const decision = access.can({}, 'sale', 'buy', {}, 'not a date' as never);
    expect(decision.reason).toBe('unusable-clock');
    expect(decision.missing).toBeUndefined();
  });

  it('reads the wall clock when no clock is supplied', () => {
    const open = allowWindow().can({}, 'sale', 'buy');
    expect(open.allowed).toBe(true);
    expect(open.reason).toBe('allow');
    expect(denyWindow().can({}, 'sale', 'buy').reason).toBe('denied');
  });

  it('refuses a boundary that does not parse at construction', () => {
    const build = () =>
      foreign([
        permission('sale', 'buy', {
          rules: [when({ field: 'now', op: 'before', value: 'not a date' })],
        }),
      ]);

    expect(build).toThrow(InvalidConditionError);
    expect(build).toThrow(/does not parse/);
  });

  it('refuses a boundary that does not parse inside a deny rule', () => {
    expect(() =>
      foreign([
        permission('sale', 'buy', {
          rules: [always],
          denyRules: [when({ field: 'now', op: 'after', value: '' })],
        }),
      ]),
    ).toThrow(InvalidConditionError);
  });
});

describe('SEC-020 an envelope that is not one decides nothing (CWE-20)', () => {
  const malformed: readonly (readonly [string, Record<string, unknown>])[] = [
    ['a document with no permissions', { version: 1 }],
    ['a null permissions list', { permissions: null }],
    ['a permissions object', { permissions: { 'post.read': {} } }],
    ['a permissions string', { permissions: 'post.read' }],
    [
      'a version that is neither a string nor a number',
      { permissions: [], version: {} },
    ],
    ['a version list', { permissions: [], version: [1] }],
    ['a schema that is not an object', { permissions: [], schema: 'post' }],
    ['a schema list', { permissions: [], schema: [] }],
    [
      'a declared type that is not one',
      {
        permissions: [],
        schema: { objects: { post: { fields: { at: 'timestamp' } } } },
      },
    ],
  ];

  for (const [name, node] of malformed) {
    it(`refuses ${name}`, () => {
      expect(() => parseMatrix(rawMatrix(node))).toThrow(AclConfigError);
    });
  }

  // #region sec-020
  it('refuses a bare list of permissions, which carries no envelope at all', () => {
    expect(() =>
      parseMatrix([
        permission('post', 'read', { rules: [always] }),
      ] as unknown as Parameters<typeof parseMatrix>[0]),
    ).toThrow(AclConfigError);
  });
  // #endregion sec-020

  it('refuses a condition the declared shape cannot evaluate', () => {
    expect(() =>
      foreign(
        [
          permission('post', 'read', {
            rules: [when({ field: 'object.ghost', op: 'eq', value: 'x' })],
          }),
        ],
        undefined,
        { schema: { objects: { post: { fields: { title: 'string' } } } } },
      ),
    ).toThrow(AclConfigError);
  });
});

describe('SEC-019 no hostile write escapes the decision it was narrowed against (CWE-915)', () => {
  /**
   * The keys a foreign write actually carries: authoring tokens, prototype
   * names, unicode shapes, and names long enough to be a shape of their own.
   */
  const KEYS = [
    'name',
    'role',
    '__proto__',
    'constructor',
    'prototype',
    '*',
    '!role',
    '!*',
    'ro​le',
    'róle',
    'rôle',
    'rôle',
    '',
    ' role',
    'role ',
    'ROLE',
    'a'.repeat(4096),
  ] as const;

  // #region sec-019
  it('never picks a key the decision did not mark allowed', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const gen = new Gen(rng(seed));
      // A bang entry needs the `*` baseline, so a generated list that carries
      // one carries the baseline too. The attack is the write, not the list.
      const drawn = gen
        .list(4, () => gen.pick([...KEYS, '*', '!role']))
        .filter((n) => n.length > 0);
      const names = gen.bool(0.6)
        ? drawn.some((n) => n.startsWith('!'))
          ? ['*', ...drawn]
          : drawn
        : undefined;
      const access = foreign([
        permission('user', 'update', {
          rules: [always],
          ...(names ? { fields: { fields: names } } : {}),
        }),
      ]);

      const proposed: Record<string, unknown> = {};
      for (const key of gen.list(6, () => gen.pick(KEYS))) {
        Object.defineProperty(proposed, key, {
          value: gen.pick(['x', 1, null, { isAdmin: true }]),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }

      const decision = access.canFields(
        { id: 'u1' },
        'user',
        'update',
        {},
        'write',
        proposed,
      );
      const writable = pickAllowedFields(decision, proposed);

      for (const key of Object.keys(writable)) {
        expect(decision.fields[key], `seed ${seed}: ${key}`).toBe('allowed');
        expect(key, `seed ${seed}`).not.toBe('__proto__');
        expect(key, `seed ${seed}`).not.toBe('*');
        expect(key.startsWith('!'), `seed ${seed}: ${key}`).toBe(false);
      }

      const row: Record<string, unknown> = {};
      Object.assign(row, writable);

      expect(Object.getPrototypeOf(row), `seed ${seed}`).toBe(Object.prototype);
      expect(({} as Record<string, unknown>)['isAdmin']).toBeUndefined();
    }
  });
  // #endregion sec-019
});
