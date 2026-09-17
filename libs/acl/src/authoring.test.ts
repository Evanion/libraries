import { describe, expect, it } from 'vitest';

import { policy } from './authoring.js';
import { hydratePolicy } from './hydrate-policy.js';
import { AclConfigError, UnknownFieldError } from './errors.js';
import type { Matrix, MatrixSchema } from './types.js';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };
type Media = { ownerId: string; bytes: number };

const subject: Subject = { id: 's1', roles: ['editor'] };

describe('authoring', () => {
  it('flattens the chain to a canonical matrix', () => {
    const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p
        .allow('update', p.eq('object.authorId', 'subject.id'))
        .allow('publish', p.contains('subject.roles', 'editor')),
    );

    expect(access.matrix).toEqual({
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
        },
        {
          key: 'comment.publish',
          object: 'comment',
          action: 'publish',
          rules: [
            {
              when: [
                { field: 'subject.roles', op: 'contains', value: 'editor' },
              ],
            },
          ],
        },
      ],
    });
  });

  it('a document with no version and no schema omits both keys', () => {
    const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p.allow('update', p.always),
    );
    expect(Object.keys(access.matrix)).toEqual(['permissions']);
    expect(JSON.stringify(access.matrix)).not.toContain('version');
    expect(access.matrix.version).toBeUndefined();
    expect(access.matrix.schema).toBeUndefined();
  });

  it('a version and a schema go into the document, not around it', () => {
    const schema: MatrixSchema = {
      subject: { fields: { id: 'string', roles: 'string[]' } },
      objects: {
        comment: { fields: { authorId: 'string', status: 'string' } },
      },
    };
    const access = policy<Subject>({
      version: 'orders@7+veto@41',
      schema,
    })
      .for<'comment', Comment>('comment', (p) =>
        p.allow('update', p.eq('object.authorId', 'subject.id')),
      )
      .build();
    expect(access.matrix.version).toBe('orders@7+veto@41');
    expect(access.matrix.schema).toEqual(schema);
    expect(access.version).toBe('orders@7+veto@41');
    // The whole document crosses an SSR boundary on its own, with nothing
    // assembled around it.
    const crossed = hydratePolicy(
      JSON.parse(JSON.stringify(access.matrix)) as Matrix,
    );
    expect(crossed.matrix).toEqual(access.matrix);
    expect(crossed.version).toBe('orders@7+veto@41');
  });

  it('a schema in the document binds the conditions the builder emitted', () => {
    expect(() =>
      policy<Subject>({
        schema: {
          objects: { comment: { fields: { authorId: 'string' } } },
        },
      })
        .for<'comment', Comment>('comment', (p) =>
          // `status` is a Comment field, so TypeScript accepts the path; the
          // schema does not declare it, so construction refuses the
          // document.
          p.allow('read', p.eq('object.status', 'published')),
        )
        .build(),
    ).toThrow(UnknownFieldError);
  });

  it('every permission key is its object and action joined', () => {
    const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p.allow('update', p.always).deny('delete', p.always),
    );
    for (const permission of access.matrix.permissions) {
      expect(permission.key).toBe(`${permission.object}.${permission.action}`);
    }
  });

  it('or produces one rule per branch and and produces one rule', () => {
    const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p
        .allow(
          'update',
          p.or(
            p.eq('object.authorId', 'subject.id'),
            p.contains('subject.roles', 'editor'),
          ),
        )
        .allow(
          'read',
          p.and(
            p.eq('object.status', 'published'),
            p.contains('subject.roles', 'editor'),
          ),
        ),
    );
    expect(access.matrix.permissions[0]!.rules).toHaveLength(2);
    expect(access.matrix.permissions[1]!.rules).toHaveLength(1);
    expect(access.matrix.permissions[1]!.rules![0]!.when).toHaveLength(2);
  });

  it('a nested or distributes into one rule per branch', () => {
    const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p.allow(
        'update',
        p.and(
          p.contains('subject.roles', 'editor'),
          p.or(
            p.eq('object.status', 'draft'),
            p.eq('object.authorId', 'subject.id'),
          ),
        ),
      ),
    );
    expect(access.matrix.permissions[0]!.rules).toHaveLength(2);
    for (const rule of access.matrix.permissions[0]!.rules!) {
      expect(rule.when).toHaveLength(2);
    }
  });

  it('several conditions on one allow are one AND-ed rule', () => {
    const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p.allow(
        'update',
        p.eq('object.status', 'draft'),
        p.contains('subject.roles', 'editor'),
      ),
    );
    expect(access.matrix.permissions[0]!.rules).toHaveLength(1);
    expect(access.matrix.permissions[0]!.rules![0]!.when).toHaveLength(2);
  });

  it('always flattens to one rule with an empty when', () => {
    const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p.allow('create', p.always),
    );
    expect(access.matrix.permissions[0]!.rules).toEqual([{ when: [] }]);
  });

  it('every op has a helper', () => {
    const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p.allow(
        'read',
        p.ne('object.status', 'published'),
        p.in('object.status', ['draft']),
        p.notIn('object.status', ['published']),
        p.after('now', '2026-10-01T00:00:00Z'),
        p.before('now', '2027-01-01T00:00:00Z'),
      ),
    );
    const when = access.matrix.permissions[0]!.rules![0]!.when!;
    expect(when.map((condition) => condition.op)).toEqual([
      'ne',
      'in',
      'not-in',
      'after',
      'before',
    ]);
  });

  it('a path operand becomes a path and a literal becomes a value', () => {
    const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p
        .allow('update', p.eq('object.authorId', 'subject.id'))
        .allow('read', p.eq('object.status', 'published')),
    );
    expect(access.matrix.permissions[0]!.rules![0]!.when![0]).toEqual({
      field: 'object.authorId',
      op: 'eq',
      path: 'subject.id',
    });
    expect(access.matrix.permissions[1]!.rules![0]!.when![0]).toEqual({
      field: 'object.status',
      op: 'eq',
      value: 'published',
    });
  });

  it('deny authoring produces denyRules', () => {
    const access = policy<Subject>()
      .for<'comment', Comment>('comment', (p) =>
        p
          .allow('delete', p.contains('subject.roles', 'editor'))
          .deny('delete', p.eq('object.status', 'published')),
      )
      .build();
    expect(access.matrix.permissions).toHaveLength(1);
    expect(access.matrix.permissions[0]!.denyRules).toHaveLength(1);
    expect(
      access.can(subject, 'comment', 'delete', {
        authorId: 's1',
        status: 'published',
      }),
    ).toMatchObject({ allowed: false, reason: 'denied' });
  });

  it('fields attaches to the action most recently declared', () => {
    const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p
        .allow('update', p.always)
        .fields({
          status: { transitions: { draft: ['published'], published: [] } },
        })
        .allow('read', p.always)
        .fields(['*', '!status']),
    );
    expect(access.matrix.permissions[0]!.fields).toHaveProperty('status');
    expect(access.matrix.permissions[1]!.fields).toEqual({
      fields: ['*', '!status'],
    });
  });

  it('fields before any action is refused', () => {
    expect(() =>
      policy<Subject>().for<'comment', Comment>('comment', (p) =>
        p.fields(['*']),
      ),
    ).toThrow(AclConfigError);
  });

  it('chained for calls accumulate every kind', () => {
    const access = policy<Subject>()
      .for<'comment', Comment>('comment', (p) =>
        p.allow('update', p.eq('object.authorId', 'subject.id')),
      )
      .for<'media', Media>('media', (p) =>
        p.allow('read', p.eq('object.ownerId', 'subject.id')),
      )
      .build();
    expect(
      access.matrix.permissions.map((permission) => permission.key),
    ).toEqual(['comment.update', 'media.read']);
    expect(
      access.can(subject, 'media', 'read', { ownerId: 's1', bytes: 1 }).allowed,
    ).toBe(true);
  });

  it('a bound kind decides what the key form decides', () => {
    const access = policy<Subject>()
      .for<'media', Media>('media', (p) =>
        p.allow('read', p.eq('object.ownerId', 'subject.id')),
      )
      .build();
    const media = access.object('media');
    expect(media.can(subject, 'read', { ownerId: 's1', bytes: 1 })).toEqual(
      access.can(subject, 'media', 'read', { ownerId: 's1', bytes: 1 }),
    );
  });
});

describe('a projection through the typed path', () => {
  const access = policy<Subject>()
    .for<'comment', Comment>('comment', (p) =>
      p
        .allow('update', p.eq('object.authorId', 'subject.id'))
        .deny('update', p.eq('object.status', 'published')),
    )
    .build();
  const untyped = hydratePolicy(access.matrix);

  it('answers what the untyped path answers for the same projection', () => {
    const projections: readonly Partial<Comment>[] = [
      {},
      { authorId: 's1' },
      { status: 'draft' },
    ];
    for (const object of projections)
      expect(access.can(subject, 'comment', 'update', object)).toEqual(
        untyped.can(subject, 'comment', 'update', object),
      );
  });

  it('names the paths it could not read', () => {
    const decision = access.can(subject, 'comment', 'update', {});
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('unevaluable');
    expect(decision.missing).toEqual(
      expect.arrayContaining(['object.authorId', 'object.status']),
    );
  });

  it('settles once the projection carries what missing named', () => {
    const settled = access.can(subject, 'comment', 'update', {
      authorId: 's1',
      status: 'draft',
    });
    expect(settled.allowed).toBe(true);
  });

  it('answers per row through canMany', () => {
    expect(
      access
        .canMany(subject, 'comment', 'update', [
          { authorId: 's1', status: 'draft' },
          { authorId: 's2', status: 'draft' },
          {},
        ])
        .map((decision) => decision.reason),
    ).toEqual(['allow', 'no-rule-matched', 'unevaluable']);
  });

  it('keys canFields by what the projection carries', () => {
    const decision = access.canFields(
      subject,
      'comment',
      'update',
      { authorId: 's1' },
      'read',
    );
    expect(Object.keys(decision.fields)).toEqual(['authorId']);
    expect(decision.action.reason).toBe('unevaluable');
  });
});

describe('the built matrix against the hand-written one', () => {
  const built = policy<Subject>({ version: 3 })
    .for<'comment', Comment>('comment', (p) =>
      p
        .allow(
          'update',
          p.or(
            p.eq('object.authorId', 'subject.id'),
            p.contains('subject.roles', 'editor'),
          ),
        )
        .fields(['*', '!status'])
        .allow('publish', p.contains('subject.roles', 'editor'))
        .deny('publish', p.eq('object.status', 'published')),
    )
    .for<'media', Media>('media', (p) => p.allow('read', p.always))
    .build();

  const hand: Matrix = {
    version: 3,
    permissions: [
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        rules: [
          {
            when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }],
          },
          {
            when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
          },
        ],
        fields: { fields: ['*', '!status'] },
      },
      {
        key: 'comment.publish',
        object: 'comment',
        action: 'publish',
        rules: [
          {
            when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
          },
        ],
        denyRules: [
          { when: [{ field: 'object.status', op: 'eq', value: 'published' }] },
        ],
      },
      {
        key: 'media.read',
        object: 'media',
        action: 'read',
        rules: [{ when: [] }],
      },
    ],
  };

  const written = hydratePolicy(hand);
  const comment: Comment = { authorId: 's1', status: 'published' };

  it('emits the same document', () => {
    expect(built.matrix).toEqual(written.matrix);
    expect(JSON.stringify(built.matrix)).toBe(JSON.stringify(written.matrix));
  });

  it('emits the envelope the hand-written document states', () => {
    // The envelope omits an absent `schema` and `media.read` omits its absent
    // `denyRules`; the two omissions have to compose for the byte comparison
    // above to mean anything.
    expect(Object.keys(built.matrix)).toEqual(['version', 'permissions']);
    expect(Object.keys(built.matrix.permissions[2]!)).toEqual([
      'key',
      'object',
      'action',
      'rules',
    ]);
  });

  it('survives a JSON round trip unchanged', () => {
    expect(JSON.parse(JSON.stringify(built.matrix))).toEqual(built.matrix);
  });

  it('decides identically through can', () => {
    expect(built.can(subject, 'comment', 'publish', comment)).toEqual(
      written.can(subject, 'comment', 'publish', comment),
    );
    expect(
      built.can({ id: 'x', roles: [] }, 'comment', 'update', comment),
    ).toEqual(
      written.can({ id: 'x', roles: [] }, 'comment', 'update', comment),
    );
  });

  it('decides identically through canFields', () => {
    expect(
      built.canFields(subject, 'comment', 'update', comment, 'read'),
    ).toEqual(written.canFields(subject, 'comment', 'update', comment, 'read'));
  });

  it('decides identically through capabilities', () => {
    expect(built.capabilities(subject)).toEqual(written.capabilities(subject));
  });
});
