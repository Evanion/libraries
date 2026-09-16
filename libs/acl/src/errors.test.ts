import { describe, expect, it } from 'vitest';

import {
  AclConfigError,
  ActionNotAllowedError,
  DenyWithoutBaselineError,
  DuplicatePermissionError,
  FeatureCycleError,
  TargetsTransitionsConflictError,
  UnknownDependencyError,
  UnknownObjectKeyError,
  UnknownPermissionError,
} from './errors.js';

describe('errors', () => {
  it('every configuration error extends AclConfigError', () => {
    const cases: (() => Error)[] = [
      () => new DenyWithoutBaselineError('!status'),
      () => new DuplicatePermissionError('x'),
      () => new FeatureCycleError(['a', 'b']),
      () => new TargetsTransitionsConflictError('status'),
      () => new UnknownDependencyError('b', 'a'),
      () => new UnknownObjectKeyError('unknown'),
      () => new UnknownPermissionError('comment.red'),
    ];
    for (const make of cases) {
      const err = make();
      expect(err).toBeInstanceOf(AclConfigError);
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('a cycle error carries the closed path', () => {
    const err = new FeatureCycleError(['a', 'b', 'a']);
    expect(err.path).toEqual(['a', 'b', 'a']);
    expect(err.message).toContain('a -> b -> a');
  });

  it('an unknown dependency error names both keys', () => {
    const err = new UnknownDependencyError('b', 'a');
    expect(err.key).toBe('b');
    expect(err.dependency).toBe('a');
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
});
