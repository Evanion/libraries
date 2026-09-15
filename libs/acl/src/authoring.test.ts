import { describe, expect, it } from 'vitest';

import { always, and, contains, eq, or, permit, policy } from './authoring.js';
import type { Access } from './create-policy.js';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };

describe('authoring', () => {
  it('flattens the nested form to a canonical matrix', () => {
    const access = policy({
      comment: {
        update: permit(
          and(
            eq('object.authorId', 'subject.id'),
            contains('subject.roles', 'editor'),
          ),
        ),
        read: permit(always),
      },
    }) as Access;
    expect(access.matrix[0]).toMatchObject({
      key: 'comment.update',
      object: 'comment',
      action: 'update',
    });
    expect(access.matrix[1]).toMatchObject({
      key: 'comment.read',
      action: 'read',
    });
  });

  it('or produces separate rules', () => {
    const access = policy({
      comment: {
        update: permit(
          or(
            eq('object.authorId', 'subject.id'),
            contains('subject.roles', 'editor'),
          ),
        ),
      },
    }) as Access;
    expect((access.matrix[0]!.rules as readonly unknown[]).length).toBe(2);
  });

  it('always serializes to an empty when array', () => {
    expect(JSON.stringify({ when: always })).toBe('{"when":[]}');
  });

  it('policy produces a working access object', () => {
    const access = policy({
      comment: {
        update: permit(eq('object.authorId', 'subject.id')),
      },
    }) as Access;
    const d = access.can(
      { id: 's1' },
      'comment',
      'update',
      { authorId: 's1' },
    );
    expect(d.allowed).toBe(true);
  });

  it('fields() attaches field rules', () => {
    const access = policy({
      comment: {
        read: permit(always).fields({ fields: ['*', '!status'] }),
      },
    }) as Access;
    const fd = access.canFields(
      { id: 's1' },
      'comment',
      'read',
      { status: 'draft' },
      'read',
    );
    expect(fd.fields['status']).toBe('denied');
  });

  it('a plain eq against a literal works', () => {
    const access = policy({
      comment: {
        read: permit(eq('object.status', 'published')),
      },
    }) as Access;
    const d = access.can(
      { id: 's1' },
      'comment',
      'read',
      { status: 'published' },
    );
    expect(d.allowed).toBe(true);
  });
});
