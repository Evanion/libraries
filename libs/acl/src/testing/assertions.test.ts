import { describe, expect, it } from 'vitest';

import type { Decision, FieldDecision } from '../types.js';

import {
  assertAllowed,
  assertFieldState,
  assertRefused,
  explainDecision,
  explainFieldDecision,
} from './assertions.js';
import { AclAssertionError } from './errors.js';

const allowed: Decision = {
  key: 'comment.update',
  allowed: true,
  reason: 'allow',
  rule: 'author',
};

const denied: Decision = {
  key: 'comment.update',
  allowed: false,
  reason: 'denied',
  rule: 'locked',
};

const unevaluable: Decision = {
  key: 'comment.update',
  allowed: false,
  reason: 'unevaluable',
  rule: 'author',
  missing: ['object.authorId', 'object.status'],
};

const stale: Decision = {
  key: 'comment.update',
  allowed: false,
  reason: 'stale-contract',
};

describe('explainDecision', () => {
  it('names the key, the outcome, the reason and the rule', () => {
    expect(explainDecision(allowed)).toBe(
      '"comment.update" allowed with reason "allow", from rule "author"',
    );
  });

  it('names every missing path', () => {
    expect(explainDecision(unevaluable)).toBe(
      '"comment.update" refused with reason "unevaluable", from rule "author", missing object.authorId, object.status',
    );
  });

  it('names no rule where none decided', () => {
    expect(explainDecision(stale)).toBe(
      '"comment.update" refused with reason "stale-contract"',
    );
  });
});

describe('assertAllowed', () => {
  it('returns the decision it was given', () => {
    expect(assertAllowed(allowed)).toBe(allowed);
  });

  it('throws an AclAssertionError on a refusal', () => {
    expect(() => assertAllowed(denied)).toThrow(AclAssertionError);
  });

  it('names why the refusal happened', () => {
    expect(() => assertAllowed(denied)).toThrow(
      'expected "comment.update" to be allowed; "comment.update" refused with reason "denied", from rule "locked"',
    );
  });

  it('names the missing paths, which is what repairs an unevaluable', () => {
    expect(() => assertAllowed(unevaluable)).toThrow(
      /missing object\.authorId, object\.status/,
    );
  });

  it("prefixes the caller's label", () => {
    expect(() => assertAllowed(denied, 'the refund button')).toThrow(
      /^the refund button: expected/,
    );
  });
});

describe('assertRefused', () => {
  it('returns the decision when it refuses for any reason', () => {
    expect(assertRefused(denied)).toBe(denied);
  });

  it('returns the decision when it refuses for the named reason', () => {
    expect(assertRefused(stale, 'stale-contract')).toBe(stale);
  });

  it('throws when the decision allows', () => {
    expect(() => assertRefused(allowed)).toThrow(
      'expected "comment.update" to be refused; "comment.update" allowed with reason "allow", from rule "author"',
    );
  });

  it('throws when the refusal is a different one', () => {
    expect(() => assertRefused(denied, 'stale-contract')).toThrow(
      'expected "comment.update" to be refused with reason "stale-contract"; "comment.update" refused with reason "denied", from rule "locked"',
    );
  });

  it("prefixes the caller's label", () => {
    expect(() =>
      assertRefused(allowed, undefined, 'the refund button'),
    ).toThrow(/^the refund button: expected/);
  });
});

const fieldDecision: FieldDecision = {
  allowed: false,
  action: allowed,
  fields: { body: 'allowed', status: 'denied' },
  reasons: { body: 'allow', status: 'not-listed' },
};

describe('explainFieldDecision', () => {
  it('names the action decision and every field beside its reason', () => {
    expect(explainFieldDecision(fieldDecision)).toBe(
      '"comment.update" allowed with reason "allow", from rule "author"; body: allowed (allow), status: denied (not-listed)',
    );
  });

  it('says so when the permission configures no fields', () => {
    expect(
      explainFieldDecision({
        allowed: true,
        action: allowed,
        fields: {},
        reasons: {},
      }),
    ).toMatch(/; no fields$/);
  });
});

describe('assertFieldState', () => {
  it('returns the decision when the field is in the named state', () => {
    expect(assertFieldState(fieldDecision, 'body', 'allowed')).toBe(
      fieldDecision,
    );
  });

  it('names the state it found and the reason for it', () => {
    expect(() => assertFieldState(fieldDecision, 'status', 'allowed')).toThrow(
      'expected field "status" of "comment.update" to be "allowed", and it is "denied" (not-listed)',
    );
  });

  it('reports a field the decision carries no entry for apart', () => {
    expect(() => assertFieldState(fieldDecision, 'price', 'allowed')).toThrow(
      '"comment.update" has no field "price": it carries body, status',
    );
  });

  it('says so when the decision carries no fields at all', () => {
    expect(() =>
      assertFieldState(
        { allowed: true, action: allowed, fields: {}, reasons: {} },
        'price',
        'allowed',
      ),
    ).toThrow('it carries no fields');
  });

  it("prefixes the caller's label", () => {
    expect(() =>
      assertFieldState(fieldDecision, 'status', 'allowed', 'the body editor'),
    ).toThrow(/^the body editor: expected field/);
  });
});
