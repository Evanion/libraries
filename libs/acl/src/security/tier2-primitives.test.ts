/**
 * Tier 2: the library supplies the primitive and the consumer must use it.
 *
 * Each test asserts twice — that the primitive is there and correct, and, where
 * one exists, that the idiom it replaces is visibly wrong against the same
 * decision. The second assertion is the point of the tier: a primitive nobody
 * reaches for defends nothing.
 */

import { describe, expect, it } from 'vitest';

import { pickAllowedFields } from '../fields.js';
import { always, foreign, permission, when } from './fixtures.js';
import type { FieldDecision } from '../types.js';

describe('SEC-101 a write is narrowed by the decision, not by the deny list (CWE-915)', () => {
  // #region sec-101
  /** The hand-rolled filter `pickAllowedFields` exists to replace. */
  const naiveFilter = (
    decision: FieldDecision,
    proposed: Record<string, unknown>,
  ): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(proposed).filter(
        ([key]) => decision.fields[key] !== 'denied',
      ),
    );

  const access = () =>
    foreign([
      permission('account', 'update', {
        rules: [always],
        fields: {
          fields: ['*', '!role'],
          membership: { targets: ['none', 'library'] },
        },
      }),
    ]);

  const decisionFor = (proposed: Record<string, unknown>): FieldDecision =>
    access().canFields(
      { id: 'u1' },
      'account',
      'update',
      { id: 'u1', membership: 'none' },
      'write',
      proposed,
    );

  it('shows the hand-rolled deny-list filter writing what the decision refused', () => {
    const proposed = { '*': 'everything', name: 'Grace', membership: 'staff' };
    const decision = decisionFor(proposed);

    expect(decision.fields['membership']).toBe('denied');
    // `*` is syntax and names no field, so the decision holds no entry for it,
    // and a filter keeping every key not marked 'denied' keeps it.
    expect(naiveFilter(decision, proposed)).toEqual({
      '*': 'everything',
      name: 'Grace',
    });
    expect(pickAllowedFields(decision, proposed)).toEqual({ name: 'Grace' });
  });
  // #endregion sec-101

  it('keeps only what the decision marked allowed', () => {
    const proposed = { name: 'Grace', role: 'owner', membership: 'library' };

    expect(pickAllowedFields(decisionFor(proposed), proposed)).toEqual({
      name: 'Grace',
      membership: 'library',
    });
  });

  it('withholds a field the decision could not settle', () => {
    // `membership` has a `targets` config and no proposed value, so it is
    // unevaluable rather than denied.
    const proposed = { name: 'Grace' };
    const decision = access().canFields(
      { id: 'u1' },
      'account',
      'update',
      { id: 'u1', membership: 'none' },
      'write',
      proposed,
    );

    expect(decision.fields['membership']).toBe('unevaluable');
    expect(pickAllowedFields(decision, proposed)).toEqual({ name: 'Grace' });
  });

  it('withholds a key the decision does not carry', () => {
    const proposed = { '*': 'everything', name: 'Grace' };

    expect(pickAllowedFields(decisionFor(proposed), proposed)).toEqual({
      name: 'Grace',
    });
  });

  it('refuses to narrow a write the action does not allow', () => {
    const denied = foreign([
      permission('account', 'update', {
        rules: [when({ field: 'subject.role', op: 'eq', value: 'owner' })],
        fields: { fields: ['*'] },
      }),
    ]);
    const proposed = { name: 'Grace' };
    const decision = denied.canFields(
      { id: 'u1', role: 'nobody' },
      'account',
      'update',
      {},
      'write',
      proposed,
    );

    // Every field reads as writable; the action is what refuses.
    expect(decision.fields['name']).toBe('allowed');
    expect(naiveFilter(decision, proposed)).toEqual({ name: 'Grace' });
    expect(() => pickAllowedFields(decision, proposed)).toThrow();
  });
});

describe('SEC-102 a per-field config restricts that field and no other (CWE-915)', () => {
  // #region sec-102
  const configOnly = () =>
    foreign([
      permission('account', 'update', {
        rules: [always],
        fields: { role: { targets: ['customer'] } },
      }),
    ]);

  it('leaves every unnamed key writable when only a config is given', () => {
    const proposed = { role: 'owner', isOwner: true, credit: 500 };
    const decision = configOnly().canFields(
      { id: 'u1' },
      'account',
      'update',
      { id: 'u1' },
      'write',
      proposed,
    );

    expect(decision.fields['role']).toBe('denied');
    expect(decision.fields['isOwner']).toBe('allowed');
    expect(pickAllowedFields(decision, proposed)).toEqual({
      isOwner: true,
      credit: 500,
    });
  });
  // #endregion sec-102

  const listed = () =>
    foreign([
      permission('account', 'update', {
        rules: [always],
        fields: { fields: ['name', 'role'], role: { targets: ['customer'] } },
      }),
    ]);

  it('closes the write once a name list states the writable set', () => {
    const proposed = { name: 'Grace', isOwner: true, credit: 500 };
    const decision = listed().canFields(
      { id: 'u1' },
      'account',
      'update',
      { id: 'u1' },
      'write',
      proposed,
    );

    expect(decision.fields['isOwner']).toBe('denied');
    expect(pickAllowedFields(decision, proposed)).toEqual({ name: 'Grace' });
  });
});

describe('SEC-103 ownership is a condition the caller has to supply data for (CWE-639)', () => {
  // #region sec-103
  const owned = () =>
    foreign([
      permission('order', 'read', {
        rules: [
          when({ field: 'object.customerId', op: 'eq', path: 'subject.id' }),
        ],
      }),
    ]);

  it('refuses rather than allows when the projection omits the owner', () => {
    const decision = owned().can({ id: 'u1' }, 'order', 'read', {
      id: 'order-2026-0042',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('unevaluable');
    expect(decision.missing).toEqual(['object.customerId']);
  });
  // #endregion sec-103

  it('allows one subject only its own objects across a batch', () => {
    const orders = Array.from({ length: 50 }, (_, i) => ({
      id: `order-2026-${String(i).padStart(4, '0')}`,
      customerId: i % 5 === 0 ? 'u1' : `other${i}`,
    }));
    const decisions = owned().canMany({ id: 'u1' }, 'order', 'read', orders);

    expect(decisions.filter((d) => d.allowed)).toHaveLength(10);
    for (const [index, decision] of decisions.entries()) {
      expect(decision.allowed).toBe(orders[index]?.customerId === 'u1');
    }
  });

  it('refuses when no object is supplied at all', () => {
    expect(owned().can({ id: 'u1' }, 'order', 'read').allowed).toBe(false);
  });

  it('refuses when the subject carries no identity', () => {
    // A subject path that does not read is a definite miss, not a repairable
    // one: the app resolves the subject whole.
    const decision = owned().can({}, 'order', 'read', { customerId: 'u1' });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('no-rule-matched');
  });
});

describe('SEC-104 an unevaluable decision is a refusal with a repair (CWE-863)', () => {
  // #region sec-104
  const access = () =>
    foreign([
      permission('order', 'read', {
        rules: [
          when(
            { field: 'object.customerId', op: 'eq', path: 'subject.id' },
            { field: 'object.table', op: 'eq', path: 'subject.table' },
          ),
        ],
      }),
    ]);

  it('shows reading anything but `allowed` as the grant going wrong', () => {
    const decision = access().can({ id: 'u1', table: 3 }, 'order', 'read', {
      id: 'order-2026-0042',
    });

    // `unevaluable` is not `denied`, so a consumer gating on the reason string
    // rather than on `allowed` grants what the engine refused.
    expect(decision.reason === 'denied').toBe(false);
    expect(decision.allowed).toBe(false);
  });
  // #endregion sec-104

  it('names every path one refetch has to bring back', () => {
    const decision = access().can({ id: 'u1', table: 3 }, 'order', 'read', {
      id: 'order-2026-0042',
    });

    expect(decision.allowed).toBe(false);
    expect([...(decision.missing ?? [])].sort()).toEqual([
      'object.customerId',
      'object.table',
    ]);
  });

  it('decides once the named paths are supplied', () => {
    const decision = access().can({ id: 'u1', table: 3 }, 'order', 'read', {
      id: 'order-2026-0042',
      customerId: 'u1',
      table: 3,
    });

    expect(decision.allowed).toBe(true);
  });
});

describe('SEC-105 a field name is matched as written, byte for byte (CWE-176)', () => {
  // #region sec-105
  // Each name reads as `rôle` or `role` on screen, and its code points differ.
  const composed = 'rôle'; // ô is U+00F4
  const decomposed = 'rôle'; // o, then the combining U+0302
  const widened = 'ro​le'; // ro, a zero-width U+200B, then le
  const homoglyph = 'гole'; // Cyrillic U+0433 in place of r

  const access = () =>
    foreign([
      permission('account', 'update', {
        rules: [always],
        fields: { fields: ['*', `!${composed}`] },
      }),
    ]);

  it('treats a differently spelled name as a different field', () => {
    const proposed = {
      [decomposed]: 'owner',
      [widened]: 'owner',
      [homoglyph]: 'owner',
      ROLE: 'owner',
    };
    const decision = access().canFields(
      { id: 'u1' },
      'account',
      'update',
      {},
      'write',
      proposed,
    );

    for (const name of [decomposed, widened, homoglyph, 'ROLE']) {
      expect(decision.fields[name], name).toBe('allowed');
    }
    // The consumer's normalisation, not the engine's: a store that folds these
    // together gets four names for one column and the exclusion is a bypass.
    expect(decomposed.normalize('NFC')).toBe(composed);
  });
  // #endregion sec-105

  it('denies the exact name the exclusion spells', () => {
    const proposed = { [composed]: 'owner' };
    const decision = access().canFields(
      { id: 'u1' },
      'account',
      'update',
      {},
      'write',
      proposed,
    );

    expect(decision.fields[composed]).toBe('denied');
    expect(pickAllowedFields(decision, proposed)).toEqual({});
  });

  it('closes the spelling question with an explicit allow-list', () => {
    const listed = foreign([
      permission('account', 'update', {
        rules: [always],
        fields: { fields: ['name'] },
      }),
    ]);
    const proposed = { [decomposed]: 'owner', [widened]: 'owner', name: 'Ada' };
    const decision = listed.canFields(
      { id: 'u1' },
      'account',
      'update',
      {},
      'write',
      proposed,
    );

    expect(pickAllowedFields(decision, proposed)).toEqual({ name: 'Ada' });
  });
});

describe('SEC-106 membership and equality disagree about NaN (CWE-1077)', () => {
  // #region sec-106
  const rule = (op: 'eq' | 'in' | 'not-in') =>
    foreign([
      permission('listing', 'read', {
        rules: [
          when({
            field: 'subject.table',
            op,
            value: op === 'eq' ? Number.NaN : [Number.NaN],
          }),
        ],
      }),
    ]);

  it('never matches an equality against NaN', () => {
    expect(
      rule('eq').can({ table: Number.NaN }, 'listing', 'read').allowed,
    ).toBe(false);
  });

  it('matches a membership test against NaN', () => {
    // `includes` is SameValueZero, `===` is not. A list is the more permissive
    // operator for this one value, so a rule that means "never" is written as
    // an equality.
    expect(
      rule('in').can({ table: Number.NaN }, 'listing', 'read').allowed,
    ).toBe(true);
    expect(
      rule('not-in').can({ table: Number.NaN }, 'listing', 'read').allowed,
    ).toBe(false);
  });
  // #endregion sec-106

  it('carries no NaN across a serialised matrix', () => {
    const round = JSON.parse(
      JSON.stringify({ field: 'subject.table', op: 'in', value: [Number.NaN] }),
    ) as { value: unknown[] };

    expect(round.value).toEqual([null]);
  });
});

describe('SEC-107 a stale matrix is detectable, not self-correcting (CWE-672)', () => {
  it('surfaces the version the document was built with', () => {
    const access = foreign(
      [permission('listing', 'read', { rules: [always] })],
      undefined,
      { version: 7 },
    );

    expect(access.version).toBe(7);
    expect(access.matrix.version).toBe(7);
  });

  it('carries a digest or a composite, which a counter cannot express', () => {
    // The revalidate contract compares with `!==`, so the version a consumer
    // fails closed on can name every input that went into the document.
    const access = foreign(
      [permission('listing', 'read', { rules: [always] })],
      undefined,
      { version: 'orders@7+veto@41' },
    );

    expect(access.version).toBe('orders@7+veto@41');
  });

  it('lets the construction site state the version that actually decided', () => {
    // A site that composed the document knows something the producer did not.
    const access = foreign(
      [permission('listing', 'read', { rules: [always] })],
      { version: 'composed@9' },
      { version: 7 },
    );

    expect(access.version).toBe('composed@9');
    expect(access.matrix.version).toBe('composed@9');
  });

  // #region sec-107
  it('keeps granting what a revoked matrix granted until it is replaced', () => {
    const stale = foreign(
      [permission('listing', 'delete', { rules: [always] })],
      {
        version: 1,
      },
    );
    const current = foreign([permission('listing', 'delete', { rules: [] })], {
      version: 2,
    });

    expect(stale.can({ id: 'u1' }, 'listing', 'delete').allowed).toBe(true);
    expect(current.can({ id: 'u1' }, 'listing', 'delete').allowed).toBe(false);
    // Comparing the two versions and failing closed is the consumer's; the
    // access object holds no channel to learn it has been superseded.
    expect(stale.version).not.toBe(current.version);
  });
  // #endregion sec-107
});

describe('SEC-108 the field maps answer fields, the action answers the action (CWE-863)', () => {
  // #region sec-108
  const access = () =>
    foreign([
      permission('listing', 'update', {
        rules: [when({ field: 'subject.role', op: 'eq', value: 'bookseller' })],
        fields: { fields: ['*'] },
      }),
    ]);

  it('reports every field writable while the action is refused', () => {
    const decision = access().canFields(
      { id: 'u1', role: 'nobody' },
      'listing',
      'update',
      { id: 'l1' },
      'write',
      { title: 'x' },
    );

    // The maps answer "what would be editable", so a blocked caller can still
    // render the form. They are not the gate.
    expect(decision.fields['title']).toBe('allowed');
    expect(decision.action.allowed).toBe(false);
    expect(decision.allowed).toBe(false);
  });
  // #endregion sec-108

  it('allows only when the action and every field agree', () => {
    const decision = access().canFields(
      { id: 'u1', role: 'bookseller' },
      'listing',
      'update',
      { id: 'l1' },
      'write',
      { title: 'x' },
    );

    expect(decision.allowed).toBe(true);
  });
});
