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

/** The hand-rolled filter `pickAllowedFields` exists to replace. */
function naiveFilter(
  decision: FieldDecision,
  proposed: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(proposed).filter(
      ([key]) => decision.fields[key] !== 'denied',
    ),
  );
}

describe('SEC-101 a write is narrowed by the decision, not by the deny list (CWE-915)', () => {
  const access = () =>
    foreign([
      permission('user', 'update', {
        rules: [always],
        fields: {
          fields: ['*', '!role'],
          plan: { targets: ['free', 'pro'] },
        },
      }),
    ]);

  const decisionFor = (proposed: Record<string, unknown>): FieldDecision =>
    access().canFields(
      { id: 'u1' },
      'user',
      'update',
      { id: 'u1', plan: 'free' },
      'write',
      proposed,
    );

  it('keeps only what the decision marked allowed', () => {
    const proposed = { name: 'Grace', role: 'admin', plan: 'pro' };

    expect(pickAllowedFields(decisionFor(proposed), proposed)).toEqual({
      name: 'Grace',
      plan: 'pro',
    });
  });

  it('withholds a field the decision could not settle', () => {
    // `plan` has a `targets` config and no proposed value, so it is
    // unevaluable rather than denied.
    const proposed = { name: 'Grace' };
    const decision = access().canFields(
      { id: 'u1' },
      'user',
      'update',
      { id: 'u1', plan: 'free' },
      'write',
      proposed,
    );

    expect(decision.fields['plan']).toBe('unevaluable');
    expect(pickAllowedFields(decision, proposed)).toEqual({ name: 'Grace' });
  });

  it('withholds a key the decision does not carry', () => {
    const proposed = { '*': 'everything', name: 'Grace' };

    expect(pickAllowedFields(decisionFor(proposed), proposed)).toEqual({
      name: 'Grace',
    });
  });

  it('shows the hand-rolled deny-list filter writing what the decision refused', () => {
    const proposed = { '*': 'everything', name: 'Grace', plan: 'enterprise' };
    const decision = decisionFor(proposed);

    expect(decision.fields['plan']).toBe('denied');
    // The authoring token is not a field, so the decision does not carry it,
    // so `!== 'denied'` reads it as writable.
    expect(naiveFilter(decision, proposed)).toEqual({
      '*': 'everything',
      name: 'Grace',
    });
    expect(pickAllowedFields(decision, proposed)).toEqual({ name: 'Grace' });
  });

  it('refuses to narrow a write the action does not allow', () => {
    const denied = foreign([
      permission('user', 'update', {
        rules: [when({ field: 'subject.role', op: 'eq', value: 'admin' })],
        fields: { fields: ['*'] },
      }),
    ]);
    const proposed = { name: 'Grace' };
    const decision = denied.canFields(
      { id: 'u1', role: 'nobody' },
      'user',
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
  const configOnly = () =>
    foreign([
      permission('user', 'update', {
        rules: [always],
        fields: { role: { targets: ['user'] } },
      }),
    ]);

  const listed = () =>
    foreign([
      permission('user', 'update', {
        rules: [always],
        fields: { fields: ['name', 'role'], role: { targets: ['user'] } },
      }),
    ]);

  it('leaves every unnamed key writable when only a config is given', () => {
    const proposed = { role: 'admin', isAdmin: true, tenantId: 'other' };
    const decision = configOnly().canFields(
      { id: 'u1' },
      'user',
      'update',
      { id: 'u1' },
      'write',
      proposed,
    );

    expect(decision.fields['role']).toBe('denied');
    expect(decision.fields['isAdmin']).toBe('allowed');
    expect(pickAllowedFields(decision, proposed)).toEqual({
      isAdmin: true,
      tenantId: 'other',
    });
  });

  it('closes the write once a name list states the writable set', () => {
    const proposed = { name: 'Grace', isAdmin: true, tenantId: 'other' };
    const decision = listed().canFields(
      { id: 'u1' },
      'user',
      'update',
      { id: 'u1' },
      'write',
      proposed,
    );

    expect(decision.fields['isAdmin']).toBe('denied');
    expect(pickAllowedFields(decision, proposed)).toEqual({ name: 'Grace' });
  });
});

describe('SEC-103 ownership is a condition the caller has to supply data for (CWE-639)', () => {
  const owned = () =>
    foreign([
      permission('doc', 'read', {
        rules: [
          when({ field: 'object.ownerId', op: 'eq', path: 'subject.id' }),
        ],
      }),
    ]);

  it('allows one subject only its own objects across a batch', () => {
    const docs = Array.from({ length: 50 }, (_, i) => ({
      id: `d${i}`,
      ownerId: i % 5 === 0 ? 'u1' : `other${i}`,
    }));
    const decisions = owned().canMany({ id: 'u1' }, 'doc', 'read', docs);

    expect(decisions.filter((d) => d.allowed)).toHaveLength(10);
    for (const [index, decision] of decisions.entries()) {
      expect(decision.allowed).toBe(docs[index]?.ownerId === 'u1');
    }
  });

  it('refuses rather than allows when the projection omits the owner', () => {
    const decision = owned().can({ id: 'u1' }, 'doc', 'read', { id: 'd1' });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('unevaluable');
    expect(decision.missing).toEqual(['object.ownerId']);
  });

  it('refuses when no object is supplied at all', () => {
    expect(owned().can({ id: 'u1' }, 'doc', 'read').allowed).toBe(false);
  });

  it('refuses when the subject carries no identity', () => {
    // A subject path that does not read is a definite miss, not a repairable
    // one: the app resolves the subject whole.
    const decision = owned().can({}, 'doc', 'read', { ownerId: 'u1' });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('no-rule-matched');
  });
});

describe('SEC-104 an undecidable decision is a refusal with a repair (CWE-863)', () => {
  const access = () =>
    foreign([
      permission('doc', 'read', {
        rules: [
          when(
            { field: 'object.ownerId', op: 'eq', path: 'subject.id' },
            { field: 'object.teamId', op: 'eq', path: 'subject.teamId' },
          ),
        ],
      }),
    ]);

  it('names every path one refetch has to bring back', () => {
    const decision = access().can({ id: 'u1', teamId: 't1' }, 'doc', 'read', {
      id: 'd1',
    });

    expect(decision.allowed).toBe(false);
    expect([...(decision.missing ?? [])].sort()).toEqual([
      'object.ownerId',
      'object.teamId',
    ]);
  });

  it('decides once the named paths are supplied', () => {
    const decision = access().can({ id: 'u1', teamId: 't1' }, 'doc', 'read', {
      id: 'd1',
      ownerId: 'u1',
      teamId: 't1',
    });

    expect(decision.allowed).toBe(true);
  });

  it('shows reading anything but `allowed` as the grant going wrong', () => {
    const decision = access().can({ id: 'u1', teamId: 't1' }, 'doc', 'read', {
      id: 'd1',
    });

    // `unevaluable` is not `denied`, so a consumer gating on the reason string
    // rather than on `allowed` grants what the engine refused.
    expect(decision.reason === 'denied').toBe(false);
    expect(decision.allowed).toBe(false);
  });
});

describe('SEC-105 a field name is matched as written, byte for byte (CWE-176)', () => {
  const composed = 'rôle';
  const decomposed = 'rôle';
  const widened = 'ro​le';
  const homoglyph = 'гole';

  const access = () =>
    foreign([
      permission('user', 'update', {
        rules: [always],
        fields: { fields: ['*', `!${composed}`] },
      }),
    ]);

  it('denies the exact name the exclusion spells', () => {
    const proposed = { [composed]: 'admin' };
    const decision = access().canFields(
      { id: 'u1' },
      'user',
      'update',
      {},
      'write',
      proposed,
    );

    expect(decision.fields[composed]).toBe('denied');
    expect(pickAllowedFields(decision, proposed)).toEqual({});
  });

  it('treats a differently spelled name as a different field', () => {
    const proposed = {
      [decomposed]: 'admin',
      [widened]: 'admin',
      [homoglyph]: 'admin',
      ROLE: 'admin',
    };
    const decision = access().canFields(
      { id: 'u1' },
      'user',
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

  it('closes the spelling question with an explicit allow-list', () => {
    const listed = foreign([
      permission('user', 'update', {
        rules: [always],
        fields: { fields: ['name'] },
      }),
    ]);
    const proposed = { [decomposed]: 'admin', [widened]: 'admin', name: 'Ada' };
    const decision = listed.canFields(
      { id: 'u1' },
      'user',
      'update',
      {},
      'write',
      proposed,
    );

    expect(pickAllowedFields(decision, proposed)).toEqual({ name: 'Ada' });
  });
});

describe('SEC-106 membership and equality disagree about NaN (CWE-1077)', () => {
  const rule = (op: 'eq' | 'in' | 'not-in') =>
    foreign([
      permission('post', 'read', {
        rules: [
          when({
            field: 'subject.tier',
            op,
            value: op === 'eq' ? Number.NaN : [Number.NaN],
          }),
        ],
      }),
    ]);

  it('never matches an equality against NaN', () => {
    expect(rule('eq').can({ tier: Number.NaN }, 'post', 'read').allowed).toBe(
      false,
    );
  });

  it('matches a membership test against NaN', () => {
    // `includes` is SameValueZero, `===` is not. A list is the more permissive
    // operator for this one value, so a rule that means "never" is written as
    // an equality.
    expect(rule('in').can({ tier: Number.NaN }, 'post', 'read').allowed).toBe(
      true,
    );
    expect(
      rule('not-in').can({ tier: Number.NaN }, 'post', 'read').allowed,
    ).toBe(false);
  });

  it('carries no NaN across a serialised matrix', () => {
    const round = JSON.parse(
      JSON.stringify({ field: 'subject.tier', op: 'in', value: [Number.NaN] }),
    ) as { value: unknown[] };

    expect(round.value).toEqual([null]);
  });
});

describe('SEC-107 a stale matrix is detectable, not self-correcting (CWE-672)', () => {
  it('surfaces the version the matrix was built with', () => {
    const access = foreign([permission('post', 'read', { rules: [always] })], {
      version: 7,
    });

    expect(access.version).toBe(7);
  });

  it('keeps granting what a revoked matrix granted until it is replaced', () => {
    const stale = foreign([permission('post', 'delete', { rules: [always] })], {
      version: 1,
    });
    const current = foreign([permission('post', 'delete', { rules: [] })], {
      version: 2,
    });

    expect(stale.can({ id: 'u1' }, 'post', 'delete').allowed).toBe(true);
    expect(current.can({ id: 'u1' }, 'post', 'delete').allowed).toBe(false);
    // Comparing the two versions and failing closed is the consumer's; the
    // access object holds no channel to learn it has been superseded.
    expect(stale.version).not.toBe(current.version);
  });
});

describe('SEC-108 the field maps answer fields, the action answers the action (CWE-863)', () => {
  const access = () =>
    foreign([
      permission('post', 'update', {
        rules: [when({ field: 'subject.role', op: 'eq', value: 'editor' })],
        fields: { fields: ['*'] },
      }),
    ]);

  it('reports every field writable while the action is refused', () => {
    const decision = access().canFields(
      { id: 'u1', role: 'nobody' },
      'post',
      'update',
      { id: 'p1' },
      'write',
      { title: 'x' },
    );

    // The maps answer "what would be editable", so a blocked caller can still
    // render the form. They are not the gate.
    expect(decision.fields['title']).toBe('allowed');
    expect(decision.action.allowed).toBe(false);
    expect(decision.allowed).toBe(false);
  });

  it('allows only when the action and every field agree', () => {
    const decision = access().canFields(
      { id: 'u1', role: 'editor' },
      'post',
      'update',
      { id: 'p1' },
      'write',
      { title: 'x' },
    );

    expect(decision.allowed).toBe(true);
  });
});
