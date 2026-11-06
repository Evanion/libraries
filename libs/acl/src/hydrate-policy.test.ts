import { describe, expect, it, vi } from 'vitest';

import { hydratePolicy } from './hydrate-policy.js';
import {
  DuplicatePermissionError,
  InvalidMatrixError,
  InvalidPermissionError,
  UnknownObjectKeyError,
  UnknownPermissionError,
} from './errors.js';
import { pickAllowedFields } from './fields.js';
import { parseMatrix } from './parse-matrix.js';
import { Gen, rng } from './security/generator.js';
import {
  ACTIONS,
  context,
  KEYS,
  matrix as generatedMatrix,
} from './security/matrix-generator.js';
import type { Access } from './hydrate-policy.js';
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

describe('hydratePolicy', () => {
  it('can evaluates a single decision', () => {
    const access = hydratePolicy(matrix);
    const d = access.can(editor, 'comment', 'update', { authorId: 's1' });

    expect(d.allowed).toBe(true);
    expect(d.reason).toBe('allow');
  });

  it('canMany returns a parallel decision array', () => {
    const access = hydratePolicy(matrix);
    const comments = [{ authorId: 's1' }, { authorId: 'OTHER' }];
    const ds = access.canMany(editor, 'comment', 'update', comments);

    expect(ds).toHaveLength(2);
    expect(ds[0]!.allowed).toBe(true);
    expect(ds[1]!.allowed).toBe(false);
  });

  it('a foreign matrix fails closed on an unknown permission', () => {
    const access = hydratePolicy(matrix, { closed: true });
    const d = access.can({ id: 's1' }, 'comment', 'delete');

    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('unknown-action');
  });

  it('a typed (local) matrix throws on an unknown object kind', () => {
    const access = hydratePolicy(matrix);

    expect(() => access.can({ id: 's1' }, 'unknown', 'read')).toThrow(
      UnknownObjectKeyError,
    );
  });

  it('a typed (local) matrix throws on an unknown permission', () => {
    const access = hydratePolicy(matrix);

    expect(() => access.can({ id: 's1' }, 'comment', 'delete')).toThrow(
      UnknownPermissionError,
    );
  });

  it('exposes the frozen matrix and version', () => {
    const access = hydratePolicy(matrix, { version: 3 });

    expect(access.version).toBe(3);
    expect(Object.isFrozen(access.matrix)).toBe(true);
  });

  it('the matrix round-trips through JSON losslessly', () => {
    const access = hydratePolicy(matrix);
    const round = JSON.parse(JSON.stringify(access.matrix)) as Matrix;

    expect(round).toEqual(access.matrix);
  });

  describe('version', () => {
    it('is absent from the document when neither source states one', () => {
      const access = hydratePolicy(matrix);

      expect(access.version).toBeUndefined();
      expect(Object.hasOwn(access.matrix, 'version')).toBe(false);
    });

    it('comes from the document', () => {
      const access = hydratePolicy({ ...matrix, version: 'orders@7' });

      expect(access.version).toBe('orders@7');
      expect(access.matrix.version).toBe('orders@7');
    });

    it('comes from the options when the document states none', () => {
      const access = hydratePolicy(matrix, { version: 7 });

      expect(access.version).toBe(7);
      expect(access.matrix.version).toBe(7);
    });

    it('takes the option over the document, and the document carries it', () => {
      const access = hydratePolicy(
        { ...matrix, version: 'orders@7' },
        { version: 'orders@7+veto@41' },
      );

      expect(access.version).toBe('orders@7+veto@41');
      // The frozen document carries the winner, so the version that decided is
      // the version that crosses an SSR boundary.
      expect(access.matrix.version).toBe('orders@7+veto@41');
      expect(hydratePolicy(access.matrix).version).toBe('orders@7+veto@41');
    });

    it('is refused when the document states something that is neither', () => {
      expect(() =>
        hydratePolicy({ ...matrix, version: {} } as unknown as Matrix),
      ).toThrow(InvalidMatrixError);
    });
  });

  it('canFields returns a field-level decision', () => {
    const withFields = hydratePolicy({
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
    const withFields = hydratePolicy({
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
    const withFields = hydratePolicy({
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
    const selfService = hydratePolicy({
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
    const access = hydratePolicy(matrix, { closed: true });
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
    const access = hydratePolicy(matrix);
    const caps = access.capabilities(editor);

    expect(caps['comment.read']!.allowed).toBe(true);
    expect(caps['comment.update']!.reason).toBe('unevaluable');
  });

  it('authorize binds the subject', () => {
    const access = hydratePolicy(matrix);
    const forUser = access.authorize(editor);

    expect(forUser.can('comment', 'read').allowed).toBe(true);
  });

  it('refuses a document that states a member a permission does not have', () => {
    expect(() =>
      hydratePolicy({
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
      expect(() => hydratePolicy(duplicate(first))).toThrow(
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
  const access = hydratePolicy(timed);
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
        hydratePolicy(timed).can(editor, 'comment', 'update', {}, now).reason,
      ).toBe('unusable-clock');
    }
  });

  it('defaults an omitted now to the wall clock', () => {
    expect(answers(undefined).can).toBe(true);
  });
});

describe('explain', () => {
  const owner = hydratePolicy({
    permissions: [
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        rules: [
          {
            id: 'owner',
            when: [{ field: 'object.ownerId', op: 'eq', path: 'subject.id' }],
          },
        ],
        denyRules: [
          {
            id: 'suspended',
            when: [
              { field: 'subject.roles', op: 'contains', value: 'suspended' },
            ],
          },
        ],
      },
    ],
  });

  it('reports the allow rule that held beside the deny that decided', () => {
    const explanation = owner.explain(
      { id: 's1', roles: ['suspended'] },
      'comment',
      'update',
      { ownerId: 's1' },
    );

    expect(explanation.decision.reason).toBe('denied');
    expect(explanation.step).toBe(1);
    expect(explanation.deny[0]).toMatchObject({
      rule: explanation.decision.rule,
      state: 'matched',
    });
    expect(explanation.allow[0]?.state).toBe('matched');
    expect(explanation.allow[0]?.conditions[0]?.state).toBe('holds');
  });

  it('names the object path an omitted object leaves unread', () => {
    const explanation = owner.explain(
      { id: 's1', roles: [] },
      'comment',
      'update',
    );

    expect(explanation.decision.reason).toBe('unevaluable');
    expect(explanation.step).toBe(7);
    expect(explanation.allow[0]?.state).toBe('unevaluable');
    expect(explanation.allow[0]?.conditions[0]).toMatchObject({
      state: 'unevaluable',
      missing: ['object.ownerId'],
    });
  });

  it('reports every condition of a rule whose first one fails', () => {
    const access = hydratePolicy({
      permissions: [
        {
          key: 'post.read',
          object: 'post',
          action: 'read',
          rules: [
            {
              when: [
                { field: 'subject.roles', op: 'contains', value: 'editor' },
                { field: 'object.status', op: 'eq', value: 'draft' },
              ],
            },
          ],
        },
      ],
    });

    const explanation = access.explain({ roles: [] }, 'post', 'read');

    expect(explanation.allow[0]?.state).toBe('not-matched');
    expect(
      explanation.allow[0]?.conditions.map((entry) => entry.state),
    ).toEqual(['fails', 'unevaluable']);
    expect(explanation.step).toBe(2);
  });

  it('keeps the condition as the document stores it', () => {
    const explanation = owner.explain(
      { id: 's1', roles: [] },
      'comment',
      'update',
      { ownerId: 's1' },
    );

    expect(explanation.allow[0]?.conditions[0]?.condition).toEqual({
      field: 'object.ownerId',
      op: 'eq',
      path: 'subject.id',
    });
  });

  it('answers an unknown action with empty lists and no step', () => {
    const access = hydratePolicy(matrix, { closed: true });

    const explanation = access.explain(editor, 'comment', 'archive');

    expect(explanation.decision.reason).toBe('unknown-action');
    expect(explanation.deny).toEqual([]);
    expect(explanation.allow).toEqual([]);
    expect(explanation).not.toHaveProperty('step');
  });

  it('answers a stale document with empty lists and no step', () => {
    const access = hydratePolicy(
      { ...matrix, maxStale: 1000 },
      { fetchedAt: 0 },
    );

    const explanation = access.explain(
      editor,
      'comment',
      'read',
      undefined,
      5000,
    );

    expect(explanation.decision.reason).toBe('stale-contract');
    expect(explanation.deny).toEqual([]);
    expect(explanation.allow).toEqual([]);
    expect(explanation).not.toHaveProperty('step');
  });

  it('carries no value read from the subject or the object', () => {
    const access = hydratePolicy({
      permissions: [
        {
          key: 'doc.read',
          object: 'doc',
          action: 'read',
          rules: [
            {
              when: [
                { field: 'subject.secret', op: 'eq', path: 'object.label' },
              ],
            },
          ],
        },
      ],
    });

    const explanation = access.explain(
      { secret: 'SUBJECT-SECRET' },
      'doc',
      'read',
      { label: 'OBJECT-LABEL' },
    );
    const text = JSON.stringify(explanation);

    expect(text).not.toContain('SUBJECT-SECRET');
    expect(text).not.toContain('OBJECT-LABEL');
  });

  it('binds the clock and the subject in the bound forms', () => {
    const subject = { id: 's1', roles: [] };
    const object = { ownerId: 's1' };

    expect(
      owner.authorize(subject).explain('comment', 'update', object),
    ).toEqual(owner.explain(subject, 'comment', 'update', object));
    expect(owner.object('comment').explain(subject, 'update', object)).toEqual(
      owner.explain(subject, 'comment', 'update', object),
    );
  });

  const clockRule = {
    when: [{ field: 'now', op: 'before', value: '2030-01-01T00:00:00Z' }],
  };
  const unreadRule = { when: [{ field: 'object.x', op: 'eq', value: 1 }] };
  const always = { when: [] };

  it.each([
    { step: 3, deny: [clockRule], allow: [always], reason: 'unusable-clock' },
    { step: 4, deny: [unreadRule], allow: [always], reason: 'unevaluable' },
    { step: 5, deny: [], allow: [always], reason: 'allow' },
    { step: 6, deny: [], allow: [clockRule], reason: 'unusable-clock' },
  ])('reports step $step', ({ step, deny, allow, reason }) => {
    const access = hydratePolicy({
      permissions: [
        {
          key: 'doc.read',
          object: 'doc',
          action: 'read',
          rules: allow,
          denyRules: deny,
        },
      ],
    } as Matrix);

    const explanation = access.explain({}, 'doc', 'read', undefined, 'nope');

    expect(explanation.decision.reason).toBe(reason);
    expect(explanation.step).toBe(step);
  });

  it('decides what can decides, over 2,000 generated matrices and contexts', () => {
    let compared = 0;

    for (let seed = 1; seed <= 2000; seed++) {
      const gen = new Gen(rng(seed));
      let access: Access;
      try {
        access = parseMatrix(generatedMatrix(gen));
      } catch {
        continue;
      }
      const permissions = access.matrix.permissions;
      for (let round = 0; round < 3; round++) {
        const { subject, object, now } = context(gen);
        const known = permissions.length > 0 && gen.bool(0.8);
        const target = known ? gen.pick(permissions) : undefined;
        const key = target?.object ?? gen.pick(KEYS);
        const action = target?.action ?? gen.pick(ACTIONS);
        const clock = now as never;

        const asked = (): unknown => {
          try {
            return access.can(subject, key, action, object, clock);
          } catch (error) {
            return error;
          }
        };
        const explained = (): unknown => {
          try {
            return access.explain(subject, key, action, object, clock).decision;
          } catch (error) {
            return error;
          }
        };
        const expected = asked();
        const actual = explained();
        if (expected instanceof Error) {
          expect(actual, `seed ${seed}`).toBeInstanceOf(expected.constructor);
        } else {
          expect(actual, `seed ${seed}`).toEqual(expected);
          compared++;
        }
      }
    }

    expect(compared).toBeGreaterThan(200);
  });
});

describe('canEach', () => {
  const documents = hydratePolicy({
    permissions: [
      {
        key: 'document.delete',
        object: 'document',
        action: 'delete',
        rules: [
          {
            id: 'admin',
            when: [{ field: 'subject.roles', op: 'contains', value: 'admin' }],
          },
          {
            id: 'owner',
            when: [{ field: 'object.ownerId', op: 'eq', path: 'subject.id' }],
          },
        ],
      },
    ],
  });
  const admin = { id: 'a1', roles: ['admin'] };
  const owner = { id: 'o1', roles: [] };
  const stranger = { id: 'x1', roles: [] };
  const row = { ownerId: 'o1' };

  it('answers each subject as can does', () => {
    const subjects = [admin, owner, stranger];
    const decisions = documents.canEach(subjects, 'document', 'delete', row);

    expect(decisions.map((decision) => decision.reason)).toEqual([
      'allow',
      'allow',
      'no-rule-matched',
    ]);
    expect(decisions).toEqual(
      subjects.map((subject) =>
        documents.can(subject, 'document', 'delete', row),
      ),
    );
  });

  it('answers unevaluable with missing for an owner rule when the object is omitted', () => {
    const [, ownerDecision] = documents.canEach(
      [admin, owner],
      'document',
      'delete',
    );

    expect(ownerDecision).toMatchObject({
      allowed: false,
      reason: 'unevaluable',
      missing: ['object.ownerId'],
    });
  });

  it('settles one clock for every subject', () => {
    const access = hydratePolicy(timed);
    const subjects = [editor, { id: 's2', roles: [] }];

    expect(
      access
        .canEach(subjects, 'comment', 'update', {}, OPEN)
        .map((decision) => decision.allowed),
    ).toEqual([true, true]);
    expect(
      access
        .canEach(subjects, 'comment', 'update', {}, SHUT)
        .map((decision) => decision.allowed),
    ).toEqual([false, false]);

    const now = vi.spyOn(Date, 'now');
    try {
      access.canEach(subjects, 'comment', 'update', {});
      expect(now).toHaveBeenCalledTimes(1);
    } finally {
      now.mockRestore();
    }
  });

  it('answers unknown-action for every subject', () => {
    const access = hydratePolicy(matrix, { closed: true });
    const decisions = access.canEach(
      [editor, { id: 's2' }],
      'comment',
      'delete',
    );

    expect(decisions.map((decision) => decision.reason)).toEqual([
      'unknown-action',
      'unknown-action',
    ]);
    expect(decisions[0]?.key).toBe('comment.delete');
  });

  it('answers stale-contract for every subject on a stale document', () => {
    const access = hydratePolicy(
      { ...matrix, maxStale: 1000 },
      { fetchedAt: 0 },
    );
    const decisions = access.canEach(
      [editor, { id: 's2' }],
      'comment',
      'update',
      { authorId: 's1' },
      5000,
    );

    expect(decisions.map((decision) => decision.reason)).toEqual([
      'stale-contract',
      'stale-contract',
    ]);
  });

  it('answers an empty list with an empty list', () => {
    expect(documents.canEach([], 'document', 'delete', row)).toEqual([]);
  });

  it('is on the bound kind with the key already named', () => {
    expect(
      documents.object('document').canEach([admin, stranger], 'delete', row),
    ).toEqual(documents.canEach([admin, stranger], 'document', 'delete', row));
  });
});
