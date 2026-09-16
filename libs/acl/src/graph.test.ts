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

  it('walks a dependency chain deeper than a call stack', () => {
    const depth = 20000;
    // Deepest first, so the walk descends the whole chain before it settles
    // anything: the order a matrix arrives in is the foreign author's choice.
    const matrix: Permission[] = [];
    for (let i = depth - 1; i >= 0; i--) {
      matrix.push(perm(`k${i}.a`, i === 0 ? [] : [`k${i - 1}.a`]));
    }

    const graph = buildGraph(matrix);
    expect(graph.order).toHaveLength(depth);
    expect(graph.order[0]).toBe('k0.a');
    expect(graph.dependants('k0.a')).toHaveLength(depth - 1);
  });

  it('reports a cycle closed at the bottom of a deep chain', () => {
    const depth = 20000;
    const matrix: Permission[] = [];
    for (let i = depth - 1; i >= 0; i--) {
      matrix.push(
        perm(`k${i}.a`, [i === 0 ? `k${depth - 1}.a` : `k${i - 1}.a`]),
      );
    }
    expect(() => buildGraph(matrix)).toThrow(FeatureCycleError);
  });
});
