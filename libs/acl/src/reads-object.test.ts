import { describe, expect, it } from 'vitest';

import { hydratePolicy } from './hydrate-policy.js';
import { InvalidConditionError, UnknownPermissionError } from './errors.js';
import type { Condition, Matrix, Permission } from './types.js';

function access(...permissions: Permission[]) {
  return hydratePolicy({ permissions });
}

function allow(key: string, ...when: Condition[]): Permission {
  const [object, action] = key.split('.');
  return {
    key,
    object: object ?? '',
    action: action ?? '',
    rules: [{ when }],
  };
}

function deny(key: string, ...when: Condition[]): Permission {
  const [object, action] = key.split('.');
  return {
    key,
    object: object ?? '',
    action: action ?? '',
    rules: [{ when: [] }],
    denyRules: [{ when }],
  };
}

describe('readsObject', () => {
  it('is false for a permission that reads only the subject', () => {
    const a = access(
      allow('article.read', {
        field: 'subject.role',
        op: 'eq',
        value: 'staff',
      }),
    );
    expect(a.readsObject('article', 'read')).toBe(false);
  });

  it('is false for an unconditional permission', () => {
    expect(access(allow('article.read')).readsObject('article', 'read')).toBe(
      false,
    );
  });

  it('is false for a permission gated only on the clock', () => {
    const a = access(
      allow('article.read', {
        field: 'now',
        op: 'before',
        value: '2030-01-01T00:00:00Z',
      }),
    );
    expect(a.readsObject('article', 'read')).toBe(false);
  });

  it('is true for an allow rule naming an object path', () => {
    const a = access(
      allow('article.update', {
        field: 'object.authorId',
        op: 'eq',
        value: 's1',
      }),
    );
    expect(a.readsObject('article', 'update')).toBe(true);
  });

  it('is true when the only object-dependence is in a deny rule', () => {
    // A deny that cannot be read outranks a matching allow, so the permission
    // is no more decidable without the row than an object-dependent allow is.
    const a = access(
      deny('article.update', {
        field: 'object.locked',
        op: 'eq',
        value: true,
      }),
    );
    expect(a.readsObject('article', 'update')).toBe(true);
  });

  it('is true when the object path is the comparand rather than the field', () => {
    const a = access(
      allow('article.update', {
        field: 'subject.id',
        op: 'eq',
        path: 'object.authorId',
      }),
    );
    expect(a.readsObject('article', 'update')).toBe(true);
  });

  it('is true for a comparand on ne as well as eq', () => {
    const a = access(
      allow('article.update', {
        field: 'subject.id',
        op: 'ne',
        path: 'object.authorId',
      }),
    );
    expect(a.readsObject('article', 'update')).toBe(true);
  });

  it('never sees a path on an operator that does not compare one', () => {
    // `path` is an eq/ne form, and a document carrying one anywhere else is
    // refused at construction. So `readsObject` reading `path` on exactly the
    // two operators the engine reads it on cannot disagree with the engine:
    // there is no constructed policy where the other case exists.
    expect(() =>
      access(
        allow('article.update', {
          field: 'subject.role',
          op: 'in',
          path: 'object.authorId',
          value: ['staff'],
        } as Condition),
      ),
    ).toThrow(InvalidConditionError);
  });

  it('answers for one permission whatever the rest of the document reads', () => {
    // Every permission answers from its own rules. A document where another
    // permission reads the row says nothing about this one.
    const a = access(
      allow('article.update', {
        field: 'object.authorId',
        op: 'eq',
        value: 's1',
      }),
      allow('article.publish', {
        field: 'subject.role',
        op: 'eq',
        value: 'editor',
      }),
    );
    expect(a.readsObject('article', 'update')).toBe(true);
    expect(a.readsObject('article', 'publish')).toBe(false);
  });

  it('matches what the permission actually decides without an object', () => {
    // The claim `readsObject` makes, held against the engine: a permission it
    // calls object-dependent decides `unevaluable` with no row, and one it does
    // not reaches a definite answer.
    const a = access(
      allow('article.read', {
        field: 'subject.role',
        op: 'eq',
        value: 'staff',
      }),
      deny('article.update', {
        field: 'object.locked',
        op: 'eq',
        value: true,
      }),
    );
    const subject = { role: 'staff' };
    for (const action of ['read', 'update']) {
      const decision = a.can(subject, 'article', action);
      expect(decision.reason === 'unevaluable').toBe(
        a.readsObject('article', action),
      );
    }
  });

  it('answers false for an unknown action in closed mode', () => {
    const matrix: Matrix = { permissions: [allow('article.read')] };
    const a = hydratePolicy(matrix, { closed: true });
    expect(a.readsObject('article', 'destroy')).toBe(false);
  });

  it('throws on an unknown action in open mode, as can does', () => {
    const a = access(allow('article.read'));
    expect(() => a.readsObject('article', 'destroy')).toThrow(
      UnknownPermissionError,
    );
  });
});
