import { describe, expect, it } from 'vitest';

import { ActionNotAllowedError } from './errors.js';
import { decideFields, pickAllowedFields } from './fields.js';
import type {
  Decision,
  EvaluationContext,
  FieldDecision,
  FieldRules,
  FieldState,
  Permission,
} from './types.js';

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

  it('transitions with a current value and no proposed one asks for the proposed one', () => {
    const p = perm('comment.update', {
      status: { transitions: { draft: ['published'] } },
    });
    const d = decideFields(p, ctx, 'write');
    expect(d.fields['status']).toBe('unevaluable');
    expect(d.reasons['status']).toBe('proposed-required');
  });

  it('transitions with neither end asks for the object first', () => {
    const p = perm('comment.update', {
      status: { transitions: { draft: ['published'] } },
    });
    const partial: EvaluationContext = { subject: { id: 's1' }, object: {} };
    const d = decideFields(p, partial, 'write');
    expect(d.fields['status']).toBe('unevaluable');
    expect(d.reasons['status']).toBe('missing-field');
  });

  it('targets without a proposed value asks for the proposed one', () => {
    const p = perm('comment.update', { status: { targets: ['published'] } });
    expect(decideFields(p, ctx, 'write').reasons['status']).toBe(
      'proposed-required',
    );
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

  it('an unevaluable field fails the top-level allowed', () => {
    const p = perm('comment.update', {
      fields: ['*'],
      status: { targets: ['published'] },
    });
    const d = decideFields(p, ctx, 'write');
    expect(d.fields).toEqual({
      authorId: 'allowed',
      status: 'unevaluable',
    });
    expect(d.allowed).toBe(false);
  });

  it('the decision maps carry real field names, never * or !name', () => {
    const p = perm('comment.update', { fields: ['*', '!status'] });
    const d = decideFields(p, ctx, 'write');
    expect(Object.keys(d.fields)).toEqual(['authorId', 'status']);
    expect(Object.keys(d.reasons)).toEqual(['authorId', 'status']);
  });

  it('an allow-list names its fields without leaking the tokens', () => {
    const p = perm('comment.update', { fields: ['body', 'title'] });
    const d = decideFields(p, { subject: { id: 's1' } }, 'write');
    expect(Object.keys(d.fields).sort()).toEqual(['body', 'title']);
  });

  it('a bang denies a proposed key the object does not carry', () => {
    const p = perm('user.update', { fields: ['*', '!role'] });
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1', name: 'Ann' },
    };
    const d = decideFields(p, self, 'write', { name: 'Eve', role: 'admin' });
    expect(d.fields['role']).toBe('denied');
    expect(d.reasons['role']).toBe('not-listed');
    expect(d.allowed).toBe(false);
  });

  it('an allow-list denies a proposed key the object does not carry', () => {
    const p = perm('user.update', { fields: ['name'] });
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1', name: 'Ann' },
    };
    const d = decideFields(p, self, 'write', { name: 'Eve', role: 'admin' });
    expect(d.fields['role']).toBe('denied');
    expect(d.reasons['role']).toBe('not-listed');
    expect(d.allowed).toBe(false);
  });

  it('a proposed key the list allows still decides allowed', () => {
    const p = perm('user.update', { fields: ['*', '!role'] });
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1' },
    };
    const d = decideFields(p, self, 'write', { name: 'Eve' });
    expect(d.fields['name']).toBe('allowed');
    expect(d.allowed).toBe(true);
  });

  it('a proposed key is allowed when no name list restricts the action', () => {
    const p = perm('user.update');
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1' },
    };
    const d = decideFields(p, self, 'write', { name: 'Eve' });
    expect(d.fields['name']).toBe('allowed');
    expect(d.allowed).toBe(true);
  });

  it('the read axis decides the object, not a proposed write', () => {
    const p = perm('user.read', { fields: ['*', '!role'] });
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1', name: 'Ann' },
    };
    const d = decideFields(p, self, 'read', { role: 'admin' });
    expect(Object.keys(d.fields).sort()).toEqual(['id', 'name']);
  });

  it('an object carrying a * or !name key never keys the decision maps', () => {
    const p = perm('comment.update', { fields: ['*', '!status'] });
    const odd: EvaluationContext = {
      subject: { id: 's1' },
      object: { '*': 1, '!status': 2, body: 'hi' },
    };
    const d = decideFields(p, odd, 'write', { '*': 3, '!status': 4 });
    expect(Object.keys(d.fields)).toEqual(['body']);
    expect(Object.keys(d.reasons)).toEqual(['body']);
  });

  it.each(['constructor', 'toString', '__proto__', 'valueOf'])(
    'a transitions config does not resolve the prototype member %s',
    (current) => {
      const p = perm('comment.update', {
        status: { transitions: { draft: ['published'] } },
      });
      const odd: EvaluationContext = {
        subject: { id: 's1' },
        object: { status: current },
      };
      const d = decideFields(p, odd, 'write', { status: 'published' });
      expect(d.fields['status']).toBe('denied');
      expect(d.reasons['status']).toBe('transition-failed');
    },
  );
});

const allowedAction: Decision = {
  key: 'user.update',
  allowed: true,
  reason: 'allow',
};

function decisionOf(
  fields: Record<string, FieldState>,
  action: Decision = allowedAction,
): FieldDecision {
  return {
    allowed:
      action.allowed && Object.values(fields).every((s) => s === 'allowed'),
    action,
    fields,
    reasons: {},
  };
}

describe('pickAllowedFields', () => {
  it('keeps the allowed keys and drops every other state', () => {
    const d = decisionOf({
      name: 'allowed',
      role: 'denied',
      status: 'unevaluable',
    });
    expect(
      pickAllowedFields(d, { name: 'Eve', role: 'admin', status: 'x' }),
    ).toEqual({ name: 'Eve' });
  });

  it('drops a key the decision never decided', () => {
    const d = decisionOf({ name: 'allowed' });
    expect(pickAllowedFields(d, { name: 'Eve', role: 'admin' })).toEqual({
      name: 'Eve',
    });
  });

  it('narrows a real decision to the writable half', () => {
    const p = perm('user.update', { fields: ['*', '!role'] });
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1', name: 'Ann' },
    };
    const proposed = { name: 'Eve', role: 'admin' };
    const outcome = decideFields(p, self, 'write', proposed);
    const d: FieldDecision = { ...outcome, action: allowedAction };
    expect(pickAllowedFields(d, proposed)).toEqual({ name: 'Eve' });
  });

  it('throws when the action is refused', () => {
    const d = decisionOf(
      { name: 'allowed' },
      { key: 'user.update', allowed: false, reason: 'no-rule-matched' },
    );
    expect(() => pickAllowedFields(d, { name: 'Eve' })).toThrow(
      ActionNotAllowedError,
    );
  });

  it('returns the allowed subset when only a field is denied', () => {
    const d = decisionOf({ name: 'allowed', role: 'denied' });
    expect(d.allowed).toBe(false);
    expect(pickAllowedFields(d, { name: 'Eve', role: 'admin' })).toEqual({
      name: 'Eve',
    });
  });

  it('returns only keys the decision marks allowed, over generated input', () => {
    // A deterministic sweep: the invariant is a property of the output, not of
    // any one shape, and the names include the prototype members a field map
    // keyed by data can carry.
    const states: readonly FieldState[] = ['allowed', 'denied', 'unevaluable'];
    const names = [
      'id',
      'name',
      'role',
      '__proto__',
      'constructor',
      'toString',
    ];
    let seed = 1;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    const define = (bag: object, key: string, value: unknown) =>
      Object.defineProperty(bag, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });

    for (let run = 0; run < 500; run += 1) {
      const fields: Record<string, FieldState> = {};
      const proposed: Record<string, unknown> = {};
      for (const name of names) {
        if (next() % 3 !== 0) {
          define(fields, name, states[next() % states.length] as FieldState);
        }
        if (next() % 2 === 0) define(proposed, name, run);
      }
      const picked = pickAllowedFields(decisionOf(fields), proposed);
      for (const key of Object.keys(picked)) {
        expect(Object.getOwnPropertyDescriptor(fields, key)?.value).toBe(
          'allowed',
        );
        expect(Object.getOwnPropertyDescriptor(proposed, key)?.value).toBe(run);
      }
    }
  });
});
