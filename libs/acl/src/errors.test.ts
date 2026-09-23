import { describe, expect, it } from 'vitest';

import {
  AclConfigError,
  ActionNotAllowedError,
  DenyWithoutBaselineError,
  DuplicatePermissionError,
  InvalidConditionError,
  InvalidFreshnessError,
  InvalidMatrixError,
  MissingFreshnessBudgetError,
  InvalidPermissionError,
  InvalidRuleError,
  KeyMismatchError,
  TargetsTransitionsConflictError,
  UnknownObjectKeyError,
  UnknownPermissionError,
  UnpublishedVetoableError,
} from './errors.js';

describe('errors', () => {
  it('every configuration error extends AclConfigError', () => {
    const cases: (() => Error)[] = [
      () => new DenyWithoutBaselineError('!status'),
      () => new DuplicatePermissionError('x'),
      () => new TargetsTransitionsConflictError('status'),
      () => new UnknownObjectKeyError('unknown'),
      () => new UnknownPermissionError('comment.red'),
      () => new KeyMismatchError('comment.read', 'comment', 'delete'),
      () => new UnpublishedVetoableError('ledger.reconcile'),
      () => new MissingFreshnessBudgetError(),
      () => new InvalidFreshnessError('fetchedAt', 'is not an instant'),
      () => new InvalidMatrixError('a matrix is an array of permissions'),
      () => new InvalidPermissionError('comment.read', 'fields', 'is bad'),
      () => new InvalidRuleError('comment.read', 'rules[0]', 'is bad'),
      () =>
        new InvalidConditionError(
          'comment.read',
          'rules[0].when[0]',
          'subject.id',
          'is bad',
        ),
    ];

    for (const make of cases) {
      const err = make();
      expect(err).toBeInstanceOf(AclConfigError);
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('an unknown permission error names the key', () => {
    const err = new UnknownPermissionError('comment.red');

    expect(err.key).toBe('comment.red');
    expect(err.message).toContain('comment.red');
  });

  it('an unknown object key error names the key', () => {
    const err = new UnknownObjectKeyError('unknown');

    expect(err.key).toBe('unknown');
    expect(err.message).toContain('unknown');
  });

  it('a deny-without-baseline error names the field', () => {
    const err = new DenyWithoutBaselineError('!status');

    expect(err.message).toContain('!status');
  });

  it('a targets/transitions conflict error names the field', () => {
    const err = new TargetsTransitionsConflictError('status');

    expect(err.message).toContain('status');
  });

  it('an action-not-allowed error carries the key and the reason', () => {
    const err = new ActionNotAllowedError('user.update', 'no-rule-matched');

    expect(err.key).toBe('user.update');
    expect(err.reason).toBe('no-rule-matched');
    expect(err.message).toContain('user.update');
    expect(err).not.toBeInstanceOf(AclConfigError);
  });

  it('a key mismatch error names all three parts', () => {
    const err = new KeyMismatchError('comment.read', 'comment', 'delete');

    expect(err.key).toBe('comment.read');
    expect(err.object).toBe('comment');
    expect(err.action).toBe('delete');
    expect(err.message).toContain('comment.read');
    expect(err.message).toContain('comment.delete');
  });

  it('a shape error names the permission key and the offending field', () => {
    const cases = [
      new InvalidPermissionError('comment.read', 'fields', 'is not an object'),
      new InvalidRuleError('comment.read', 'rules[0]', 'has no when'),
      new InvalidConditionError(
        'comment.read',
        'rules[0].when[0]',
        'subject.id',
        'nests below its scope',
      ),
    ];

    for (const err of cases) {
      expect(err.key).toBe('comment.read');
      expect(err.message).toContain('comment.read');
      expect(err.message).toContain(err.field);
    }
  });
});
