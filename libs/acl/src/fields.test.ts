import { describe, expect, it } from 'vitest';

import { decideFields } from './fields.js';
import type { EvaluationContext, FieldRules, Permission } from './types.js';

const ctx: EvaluationContext = {
  subject: { id: 's1', roles: ['editor'] },
  object: { authorId: 's1', status: 'draft' },
  now: new Date('2026-01-01T00:00:00Z'),
};

function perm(key: string, fields?: FieldRules): Permission {
  const [object, action] = key.split('.');
  return { key, object: object ?? '', action: action ?? '', fields };
}

describe('decideFields', () => {
  it('an allow-list allows only the listed fields', () => {
    const p = perm('comment.update', { fields: ['body', 'title'] });
    const d = decideFields(p, ctx, 'write');
    expect(d.fields['body']).toBe('allowed');
    expect(d.fields['title']).toBe('allowed');
    expect(d.fields['status']).toBe('denied');
  });

  it('a bang list denies the denied field', () => {
    const p = perm('comment.read', { fields: ['*', '!status'] });
    const d = decideFields(p, ctx, 'read');
    expect(d.fields['status']).toBe('denied');
    expect(d.fields['authorId']).toBe('allowed');
  });

  it('targets allows a proposed value from the allow-list', () => {
    const p = perm('comment.update', { status: { targets: ['published'] } });
    expect(
      decideFields(p, ctx, 'write', { status: 'published' }).fields['status'],
    ).toBe('allowed');
    expect(
      decideFields(p, ctx, 'write', { status: 'draft' }).fields['status'],
    ).toBe('denied');
  });

  it('targets without a proposed value is unevaluable', () => {
    const p = perm('comment.update', { status: { targets: ['published'] } });
    expect(decideFields(p, ctx, 'write').fields['status']).toBe('unevaluable');
  });

  it('transitions checks the current->proposed edge', () => {
    const p = perm('comment.update', {
      status: { transitions: { draft: ['published'], published: [] } },
    });
    expect(
      decideFields(p, ctx, 'write', { status: 'published' }).fields['status'],
    ).toBe('allowed');
    expect(
      decideFields(p, ctx, 'write', { status: 'draft' }).fields['status'],
    ).toBe('denied');
  });

  it('transitions without the current value is unevaluable', () => {
    const p = perm('comment.update', {
      status: { transitions: { draft: ['published'] } },
    });
    const partial: EvaluationContext = { subject: { id: 's1' }, object: {} };
    expect(
      decideFields(p, partial, 'write', { status: 'published' }).fields[
        'status'
      ],
    ).toBe('unevaluable');
  });

  it('read axis ignores targets/transitions (projection only)', () => {
    const p = perm('comment.read', { status: { targets: ['published'] } });
    const d = decideFields(p, ctx, 'read');
    expect(d.fields['status']).toBe('allowed');
  });

  it('top-level allowed is true only when every field is allowed', () => {
    const p = perm('comment.update', {
      fields: ['body', 'title'],
      status: { targets: ['published'] },
    });
    const d = decideFields(p, ctx, 'write', { status: 'draft' });
    expect(d.allowed).toBe(false);
  });
});
