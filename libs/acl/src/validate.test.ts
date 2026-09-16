import { describe, expect, it } from 'vitest';

import {
  BangInAllowListError,
  DenyWithoutBaselineError,
  TargetsTransitionsConflictError,
} from './errors.js';
import { validateMatrix } from './validate.js';
import type { Matrix } from './types.js';

describe('validateMatrix', () => {
  it('rejects a bang without a baseline', () => {
    const matrix: Matrix = [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        fields: { fields: ['!status'] },
      },
    ];
    expect(() => validateMatrix(matrix)).toThrow(DenyWithoutBaselineError);
  });

  it('rejects a bang mixed into an explicit allow-list', () => {
    const matrix: Matrix = [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        fields: { fields: ['body', '!status'] },
      },
    ];
    expect(() => validateMatrix(matrix)).toThrow(BangInAllowListError);
  });

  it('rejects targets and transitions on the same field', () => {
    const matrix: Matrix = [
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        fields: {
          status: {
            targets: ['published'],
            transitions: { draft: ['published'] },
          },
        },
      },
    ];
    expect(() => validateMatrix(matrix)).toThrow(
      TargetsTransitionsConflictError,
    );
  });

  it('rejects an unknown condition op', () => {
    const matrix: Matrix = [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        rules: [
          { when: [{ field: 'subject.id', op: 'wat' as never, value: 1 }] },
        ],
      },
    ];
    expect(() => validateMatrix(matrix)).toThrow(Error);
  });

  it('rejects a condition field outside the namespaces', () => {
    const matrix: Matrix = [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        rules: [{ when: [{ field: 'foo.bar', op: 'eq', value: 1 }] }],
      },
    ];
    expect(() => validateMatrix(matrix)).toThrow(Error);
  });

  it('accepts a valid matrix', () => {
    const matrix: Matrix = [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        fields: { fields: ['*', '!status'] },
      },
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        fields: { status: { transitions: { draft: ['published'] } } },
      },
    ];
    expect(() => validateMatrix(matrix)).not.toThrow();
  });
});
