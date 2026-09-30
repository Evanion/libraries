import { describe, expect, it } from 'vitest';
import { FeatureCycleError, UnknownDependencyError } from './errors.js';
import { buildGraph, graphErrors } from './graph.js';
import type { FeatureKey } from './types.js';

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

  it('rejects a numeric key beside the string that spells it', () => {
    // `resolveAll` builds its record with `Object.fromEntries`, which writes 1
    // and '1' to one property, so one of the two features gets no decision. The
    // type argument is the union `FeatureKey` declares, which is what admits the
    // two spellings: `F` is inferred from the first element otherwise.
    expect(() =>
      buildGraph<FeatureKey>([
        { key: 1, enabled: true },
        { key: '1', enabled: true },
      ]),
    ).toThrow(/duplicate/i);
  });
});

describe('graphErrors', () => {
  it('reads a node carrying a key and no dependsOn', () => {
    expect(graphErrors([{ key: 'a' }, { key: 'b', dependsOn: ['a'] }])).toEqual(
      [],
    );
  });

  it('reads a node whose dependsOn the shape walk could not read as no edges', () => {
    expect(graphErrors([{ key: 'a', dependsOn: undefined }])).toEqual([]);
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
