import { describe, expect, it } from 'vitest';
import { FeatureCycleError, UnknownDependencyError } from './errors.js';
import { buildGraph } from './graph.js';

const def = (key: string, dependsOn: string[] = []) => ({
  key,
  enabled: true,
  dependsOn,
});

describe('buildGraph', () => {
  it('orders every feature after the features it depends on', () => {
    const { order } = buildGraph([def('c', ['b']), def('a'), def('b', ['a'])]);

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('orders a diamond so both parents precede the child', () => {
    const { order } = buildGraph([
      def('child', ['left', 'right']),
      def('left', ['root']),
      def('right', ['root']),
      def('root'),
    ]);

    expect(order.indexOf('root')).toBeLessThan(order.indexOf('left'));
    expect(order.indexOf('root')).toBeLessThan(order.indexOf('right'));
    expect(order.indexOf('left')).toBeLessThan(order.indexOf('child'));
    expect(order.indexOf('right')).toBeLessThan(order.indexOf('child'));
  });

  it('rejects a cycle at construction, with the path in the message', () => {
    let error: unknown;
    try {
      buildGraph([def('a', ['c']), def('b', ['a']), def('c', ['b'])]);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(FeatureCycleError);
    const cycle = error as FeatureCycleError;
    expect(cycle.path[0]).toBe(cycle.path[cycle.path.length - 1]);
    expect(new Set(cycle.path)).toEqual(new Set(['a', 'b', 'c']));
    for (const key of ['a', 'b', 'c']) {
      expect(cycle.message).toContain(key);
    }
    expect(cycle.message).toContain('->');
  });

  it('rejects a feature that depends on itself', () => {
    expect(() => buildGraph([def('a', ['a'])])).toThrow(FeatureCycleError);
  });

  it('rejects a dependency on a feature that does not exist', () => {
    expect(() => buildGraph([def('a', ['missing'])])).toThrow(
      UnknownDependencyError,
    );
  });

  it('rejects a duplicate key', () => {
    expect(() => buildGraph([def('a'), def('a')])).toThrow(/duplicate/i);
  });

  it('indexes dependants transitively, in dependency order', () => {
    const { dependants } = buildGraph([
      def('a'),
      def('b', ['a']),
      def('c', ['b']),
      def('d', ['c']),
      def('unrelated'),
    ]);

    expect(dependants('a')).toEqual(['b', 'c', 'd']);
    expect(dependants('c')).toEqual(['d']);
    expect(dependants('d')).toEqual([]);
    expect(dependants('unrelated')).toEqual([]);
  });
});
