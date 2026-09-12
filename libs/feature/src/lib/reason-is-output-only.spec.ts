import { describe, expect, it } from 'vitest';
import { decide } from './evaluate.js';
import { createFeatures } from './features.js';
import { buildGraph } from './graph.js';
import type { Decision, EvaluationContext, FeatureDefinition } from './types.js';

/**
 * The invariant from `docs/specs/2026-09-11-feature-toggles.md`, "Result":
 * `reason` is output only. The cascade reads `enabled` from a parent's result
 * and nothing else, so deleting every explanation field must change no decision
 * anywhere.
 *
 * Asserting that the engine "does not branch on reason" by reading the source is
 * not a test. This runs the real per-feature decision function over the real
 * dependency order, with every explanation field deleted from each parent result
 * before the next feature sees it, and requires the decisions to come out
 * identical. Anything that consulted `reason`, `rule`, `rules`, `blockedBy` or
 * `cause` to decide `enabled` would diverge here -- a comparison against a
 * deleted field is false, so a cascade keyed on `reason === 'explicitly-off'`
 * would stop cascading and this would fail.
 */

/** A parent result with every explanation field removed. */
function stripExplanation(decision: Decision): Decision {
  return { key: decision.key, enabled: decision.enabled } as Decision;
}

/** The engine's own loop, run with reason-blind parent results. */
function resolveReasonBlind(
  definitions: readonly FeatureDefinition[],
  context: EvaluationContext = {},
): Record<string, boolean> {
  const graph = buildGraph(definitions);
  const byKey = new Map(definitions.map((d) => [d.key, d]));
  const resolved = new Map<string, Decision>();
  const enabled: Record<string, boolean> = {};

  for (const key of graph.order) {
    const decision = decide(
      byKey.get(key) as FeatureDefinition,
      { now: new Date('2026-09-01T00:00:00Z'), ...context },
      resolved,
    );
    enabled[key] = decision.enabled;
    resolved.set(key, stripExplanation(decision));
  }

  return enabled;
}

function enabledOf(definitions: readonly FeatureDefinition[], context: EvaluationContext = {}) {
  const decisions = createFeatures(definitions).resolve({
    now: new Date('2026-09-01T00:00:00Z'),
    ...context,
  });

  return Object.fromEntries(
    Object.entries(decisions).map(([key, decision]) => [key, decision.enabled]),
  );
}

const CONFIGS: Record<string, readonly FeatureDefinition[]> = {
  'chain off at the root': [
    { key: 'a', enabled: false },
    { key: 'b', enabled: true, dependsOn: ['a'] },
    { key: 'c', enabled: true, dependsOn: ['b'] },
    { key: 'd', enabled: true, dependsOn: ['c'] },
    { key: 'e', enabled: true, dependsOn: ['d'] },
  ],
  'chain off by an unmatched rule': [
    {
      key: 'a',
      enabled: true,
      rules: [
        {
          id: 'window',
          when: [{ field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' }],
        },
      ],
    },
    { key: 'b', enabled: true, dependsOn: ['a'] },
    { key: 'c', enabled: true, dependsOn: ['b'] },
    { key: 'd', enabled: true, dependsOn: ['c'] },
  ],
  'chain off by a rollout': [
    { key: 'a', enabled: true, rules: [{ rollout: { percent: 0 } }] },
    { key: 'b', enabled: true, dependsOn: ['a'] },
    { key: 'c', enabled: true, dependsOn: ['b'] },
  ],
  'diamond with one arm off': [
    { key: 'root', enabled: true },
    { key: 'left', enabled: false, dependsOn: ['root'] },
    { key: 'right', enabled: true, dependsOn: ['root'] },
    { key: 'child', enabled: true, dependsOn: ['left', 'right'] },
    { key: 'grandchild', enabled: true, dependsOn: ['child'] },
  ],
  'everything on': [
    { key: 'a', enabled: true },
    { key: 'b', enabled: true, dependsOn: ['a'] },
    { key: 'c', enabled: true, dependsOn: ['a', 'b'] },
  ],
};

describe('reason is output only', () => {
  for (const [name, definitions] of Object.entries(CONFIGS)) {
    it(`decides identically with every reason deleted: ${name}`, () => {
      expect(resolveReasonBlind(definitions)).toEqual(enabledOf(definitions));
    });
  }

  it('treats every kind of parent "off" the same way', () => {
    // explicitly-off, no-rule-matched and dependency-off are three different
    // reasons and must make no difference to the dependant's decision.
    type Key = 'child' | 'parent' | 'grandparent';
    const child = (parents: readonly FeatureDefinition<Key>[]) =>
      createFeatures<Key>([
        ...parents,
        { key: 'child', enabled: true, dependsOn: ['parent'] },
      ]).resolve({ now: new Date('2026-09-01T00:00:00Z') }).child;

    const byExplicit = child([{ key: 'parent', enabled: false }]);
    const byRule = child([
      {
        key: 'parent',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [{ field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' }],
          },
        ],
      },
    ]);
    const byCascade = child([
      { key: 'grandparent', enabled: false },
      { key: 'parent', enabled: true, dependsOn: ['grandparent'] },
    ]);

    for (const decision of [byExplicit, byRule, byCascade]) {
      expect(decision.enabled).toBe(false);
      expect(decision.reason).toBe('dependency-off');
      expect(decision.blockedBy).toBe('parent');
    }
    // The only difference between the three is the root cause, which is
    // explanation.
    expect(byExplicit.cause?.key).toBe('parent');
    expect(byRule.cause?.rule).toBe('window');
    expect(byCascade.cause?.key).toBe('grandparent');
  });
});
