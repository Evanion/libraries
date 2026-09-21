import { expect, it } from 'vitest';
import { diffMatrix } from '../index.js';
import { contractDrift } from './drift.js';
import type { Matrix } from '../types.js';

const m = (version: string, extra = false): Matrix => ({
  version,
  permissions: [
    {
      key: 'doc.read',
      object: 'doc',
      action: 'read',
      rules: extra
        ? [
            { when: [{ field: 'subject.role', op: 'eq', value: 'admin' }] },
            { when: [] },
          ]
        : [{ when: [{ field: 'subject.role', op: 'eq', value: 'admin' }] }],
    },
  ],
});

/**
 * The seam and the diff ship in one package and were written apart. Nothing
 * else holds them together: `contractDrift` takes any differ, so a change to
 * `diffMatrix`'s signature would pass every other test in the suite and fail a
 * consumer who wired the two the way the documentation says to.
 */
it('accepts the real diffMatrix at the seam', () => {
  const report = contractDrift({
    pinned: m('v1'),
    fetched: m('v2', true),
    diff: diffMatrix,
  });
  // `report.diff` must be typed as the real MatrixDiff, not `never`.
  expect(report.diff?.findings.map((f) => f.kind)).toEqual(['granted']);
  expect(report.diff?.unchanged).toBe(false);
});
