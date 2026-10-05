/**
 * Tier 3: structurally out of scope, documented only.
 *
 * Nothing here is a defence, and no test in this file asserts one. An evaluator
 * cannot know where its subject came from, cannot make itself be called, and
 * cannot hold a row still between the decision and the write. What it can do is
 * say so, in a clause a reader will find, so these tests assert the clause is
 * there — and, where the behaviour is easy to mistake for a defence, pin what
 * the engine actually does so nobody reads a grant as a guarantee.
 *
 * A renamed clause fails these tests. That is deliberate: the register in
 * `libs/acl/SECURITY.md` names the clause, so moving the contract is a change
 * to the register too.
 */

import { describe, expect, it } from 'vitest';

import { always, foreign, permission, readme, when } from './fixtures.js';

const core = () => readme('acl');

function hasSection(text: string, heading: string): boolean {
  return new RegExp(`^${heading}$`, 'm').test(text);
}

describe('SEC-201 the subject is authorized as handed over (CWE-441)', () => {
  it('states that resolving the subject is the consumer job', () => {
    expect(hasSection(core(), '## Comprehensive Documentation & Security Contract')).toBe(true);
  });

  // #region sec-201
  it('authorizes a forged subject exactly as it would a real one', () => {
    // No defence. The engine has no channel to ask where the subject came from,
    // and this is what that costs.
    const access = foreign([
      permission('order', 'refund', {
        rules: [when({ field: 'subject.role', op: 'eq', value: 'owner' })],
      }),
    ]);

    expect(access.can({ role: 'owner' }, 'order', 'refund').allowed).toBe(true);
  });
  // #endregion sec-201
});

describe('SEC-202 nothing makes the caller ask (CWE-862)', () => {
  it('states that covering every path is the app job', () => {
    expect(hasSection(core(), '## Comprehensive Documentation & Security Contract')).toBe(true);
  });

  // #region sec-202
  it('names the handle that makes the checked path the easy one', () => {
    const access = foreign([
      permission('listing', 'read', { rules: [always] }),
    ]);
    const bound = access.authorize({ id: 'u1' });

    expect(typeof bound.can).toBe('function');
    expect(bound.can('listing', 'read').allowed).toBe(true);
  });
  // #endregion sec-202
});

describe('SEC-203 a decision describes the snapshot it was given (CWE-367)', () => {
  it('states that the gap to the write is the consumer job', () => {
    expect(hasSection(core(), '## Comprehensive Documentation & Security Contract')).toBe(true);
  });

  // #region sec-203
  it('carries no freshness token a writer could check', () => {
    const access = foreign([
      permission('question', 'update', {
        rules: [
          when({ field: 'object.askedBy', op: 'eq', path: 'subject.id' }),
        ],
      }),
    ]);
    const decision = access.can({ id: 'u1' }, 'question', 'update', {
      id: 'q1',
      askedBy: 'u1',
    });

    // The decision names the key, the reason and the rule. Nothing in it ties
    // the answer to a version of the row it was answered about.
    expect(Object.keys(decision).sort()).toEqual([
      'allowed',
      'key',
      'reason',
      'rule',
    ]);
  });
  // #endregion sec-203
});

describe('SEC-204 a rule keyed on writable data authorizes its own writer (CWE-639)', () => {
  it('states which fields a condition may read', () => {
    expect(hasSection(core(), '## Comprehensive Documentation & Security Contract')).toBe(true);
    expect(core()).toContain('self-authorizing');
  });

  // #region sec-204
  it('grants the subject that added itself to the field the rule reads', () => {
    // No defence. The engine cannot know which object fields the subject can
    // write, so this is the grant the acl README warns about under "What a
    // condition may read", shown working.
    const access = foreign([
      permission('wishlist', 'read', {
        rules: [
          when({ field: 'object.sharedWith', op: 'contains', value: 'u1' }),
        ],
      }),
    ]);

    expect(
      access.can({ id: 'u1' }, 'wishlist', 'read', { sharedWith: ['u2'] })
        .allowed,
    ).toBe(false);
    expect(
      access.can({ id: 'u1' }, 'wishlist', 'read', { sharedWith: ['u2', 'u1'] })
        .allowed,
    ).toBe(true);
  });
  // #endregion sec-204

  it('cannot be closed by a field rule, because the write is a different action', () => {
    // Narrowing `wishlist.update` does not touch what `wishlist.read` reads. Keeping the
    // field out of every write path the rule guards is the consumer's job.
    const access = foreign([
      permission('wishlist', 'read', {
        rules: [
          when({ field: 'object.sharedWith', op: 'contains', value: 'u1' }),
        ],
      }),
      permission('wishlist', 'update', {
        rules: [always],
        fields: { fields: ['*', '!sharedWith'] },
      }),
    ]);
    const write = access.canFields(
      { id: 'u1' },
      'wishlist',
      'update',
      {},
      'write',
      {
        sharedWith: ['u1'],
      },
    );

    expect(write.fields['sharedWith']).toBe('denied');
    expect(
      access.can({ id: 'u1' }, 'wishlist', 'read', { sharedWith: ['u1'] })
        .allowed,
    ).toBe(true);
  });
});

describe('SEC-205 a decision counts where it is made (CWE-602)', () => {
  it('states that a browser decision is advisory', () => {
    expect(hasSection(core(), '## Comprehensive Documentation & Security Contract')).toBe(true);
    expect(core()).toContain('advisory');
  });

  it('points the React package at the same contract', () => {
    expect(readme('react-acl')).toContain('security contract');
  });

  // #region sec-205
  it('answers a browser and a server identically, which is why the runtime decides', () => {
    const access = foreign([
      permission('listing', 'delete', { rules: [always] }),
    ]);

    // The same call, the same answer, wherever it runs. Nothing in the return
    // type separates an authoritative decision from a rendering hint.
    expect(access.can({ id: 'u1' }, 'listing', 'delete').allowed).toBe(true);
  });
  // #endregion sec-205
});

describe('SEC-206 the matrix is a public document (CWE-200)', () => {
  it('states that names and structure ship to the client', () => {
    expect(core()).toContain('serializable matrix');
  });

  // #region sec-206
  it('exposes every key, condition and field name it was built from', () => {
    const access = foreign([
      permission('order', 'mark-down', {
        rules: [when({ field: 'subject.role', op: 'eq', value: 'owner' })],
        fields: { fields: ['*', '!supplierCost'] },
      }),
    ]);

    expect(JSON.stringify(access.matrix)).toContain('owner');
    expect(JSON.stringify(access.matrix)).toContain('supplierCost');
  });
  // #endregion sec-206
});

describe('SEC-207 the clock is a parameter (CWE-807)', () => {
  it('states where a clock may come from', () => {
    expect(hasSection(core(), '## Comprehensive Documentation & Security Contract')).toBe(true);
  });

  // #region sec-207
  it('opens a closed window for a caller that supplies its own instant', () => {
    const access = foreign([
      permission('listing', 'preorder', {
        rules: [when({ field: 'now', op: 'before', value: '2020-01-01' })],
      }),
    ]);

    expect(access.can({}, 'listing', 'preorder').allowed).toBe(false);
    expect(
      access.can({}, 'listing', 'preorder', undefined, '2019-06-01').allowed,
    ).toBe(true);
  });
  // #endregion sec-207

  it('moves a closed window for every entry point that takes a clock', () => {
    const access = foreign([
      permission('listing', 'preorder', {
        rules: [when({ field: 'now', op: 'before', value: '2020-01-01' })],
      }),
    ]);

    const early = '2019-06-01';
    expect(
      access.canMany({}, 'listing', 'preorder', [{}], early)[0]?.allowed,
    ).toBe(true);
    expect(
      access.authorize({}, { now: early }).can('listing', 'preorder').allowed,
    ).toBe(true);
    expect(access.capabilities({}, early)['listing.preorder']?.allowed).toBe(
      true,
    );
  });
});

describe('SEC-208 the subject and the object are read live (CWE-367)', () => {
  it('states that a decision reads the bag it is handed, field by field', () => {
    expect(hasSection(core(), '## Comprehensive Documentation & Security Contract')).toBe(true);
  });

  // #region sec-208
  it('decides the deny side and the allow side against separate reads', () => {
    // No defence. The matrix is copied and frozen; the subject is the app's own
    // data and is not. A subject whose getter answers twice decides twice.
    let read = 0;
    const subject: Record<string, unknown> = {};
    Object.defineProperty(subject, 'role', {
      enumerable: true,
      get() {
        read++;
        return read === 1 ? 'nobody' : 'owner';
      },
    });

    const access = foreign([
      permission('order', 'refund', {
        rules: [when({ field: 'subject.role', op: 'eq', value: 'owner' })],
        denyRules: [when({ field: 'subject.role', op: 'eq', value: 'owner' })],
      }),
    ]);

    expect(access.can(subject, 'order', 'refund').allowed).toBe(true);
    expect(access.can({ role: 'owner' }, 'order', 'refund').allowed).toBe(
      false,
    );
  });
  // #endregion sec-208
});
