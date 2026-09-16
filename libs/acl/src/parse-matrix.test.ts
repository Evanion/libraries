import { describe, expect, it } from 'vitest';

import { parseMatrix } from './parse-matrix.js';
import type { Matrix } from './types.js';

const json: Matrix = [
  {
    key: 'comment.read',
    object: 'comment',
    action: 'read',
    rules: [
      {
        when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
      },
    ],
  },
];

describe('parseMatrix', () => {
  it('adopts a foreign matrix and fails closed', () => {
    const access = parseMatrix(json);
    const d = access.can({ id: 's1' }, 'comment', 'delete');
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('unknown-action');
  });

  it('validates the matrix shape on adoption', () => {
    expect(() =>
      parseMatrix([{ key: 'no.object.key' }] as unknown as Matrix),
    ).toThrow();
  });

  it('exposes the adopted version', () => {
    const access = parseMatrix(json, { version: 7 });
    expect(access.version).toBe(7);
  });

  it('round-trips through JSON', () => {
    const access = parseMatrix(json);
    const round = JSON.parse(JSON.stringify(access.matrix)) as Matrix;
    expect(round).toEqual(access.matrix);
  });

  it('a valid permission evaluates locally', () => {
    const access = parseMatrix(json);
    const d = access.can({ id: 's1', roles: ['editor'] }, 'comment', 'read');
    expect(d.allowed).toBe(true);
  });
});
