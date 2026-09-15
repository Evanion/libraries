import { describe, expect, it } from 'vitest';

import {
  DuplicatePermissionError,
  FeatureCycleError,
  UnknownDependencyError,
} from './errors.js';
import { buildGraph } from './graph.js';
import type { Permission } from './types.js';

function perm(key: string, dependsOn?: string[]): Permission {
  const [object, action] = key.split('.');
  return { key, object: object ?? '', action: action ?? '', dependsOn };
}

describe('buildGraph', () => {
  it('orders dependants after their parents', () => {
    const graph = buildGraph([
      perm('a.update'),
      perm('b.create', ['a.update']),
      perm('c.delete', ['b.create']),
    ]);
    const pos = new Map(graph.order.map((k, i) => [k, i]));
    expect(pos.get('a.update')!).toBeLessThan(pos.get('b.create')!);
    expect(pos.get('b.create')!).toBeLessThan(pos.get('c.delete')!);
    expect(graph.dependants('a.update')).toEqual(['b.create', 'c.delete']);
  });

  it('rejects a duplicate key', () => {
    expect(() => buildGraph([perm('a.update'), perm('a.update')])).toThrow(
      DuplicatePermissionError,
    );
  });

  it('rejects a dependency on an unknown permission', () => {
    expect(() => buildGraph([perm('a.update', ['nope.read'])])).toThrow(
      UnknownDependencyError,
    );
  });

  it('rejects a cycle with the closed path', () => {
    expect(() =>
      buildGraph([
        perm('a.update', ['c.delete']),
        perm('b.create', ['a.update']),
        perm('c.delete', ['b.create']),
      ]),
    ).toThrow(FeatureCycleError);
  });

  it('a permission with no dependsOn has no dependants', () => {
    const graph = buildGraph([perm('a.update')]);
    expect(graph.dependants('a.update')).toEqual([]);
  });
});
