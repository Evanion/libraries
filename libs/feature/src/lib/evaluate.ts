import { inRollout } from './bucketing.js';
import { conditionFields, evaluateCondition } from './conditions.js';
import type {
  Cause,
  Decision,
  EvaluationContext,
  FeatureDefinition,
  FeatureKey,
  PlanEntry,
  Rule,
  RuleOutcome,
} from './types.js';

/** The default context field a rollout buckets on. */
export const DEFAULT_ROLLOUT_FIELD = 'targetingKey';

function ruleId(rule: Rule, index: number): string {
  return rule.id ?? `#${index}`;
}

function rolloutField(rule: Rule): string {
  return rule.rollout?.by ?? DEFAULT_ROLLOUT_FIELD;
}

function rolloutSeed<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  rule: Rule,
): string {
  return rule.rollout?.seed ?? definition.seed ?? String(definition.key);
}

/** The context fields a rule reads, sorted and deduplicated. */
export function ruleFields(rule: Rule): readonly string[] {
  const fields = new Set<string>();
  for (const condition of rule.when ?? []) {
    for (const field of conditionFields(condition)) fields.add(field);
  }
  if (rule.rollout) fields.add(rolloutField(rule));
  return [...fields].sort();
}

/**
 * Evaluates one rule. Conditions are AND-ed, and a rollout is one more
 * conjunct -- a rule with both matches only for a context that satisfies the
 * conditions *and* falls in the bucket range.
 */
export function evaluateRule<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  rule: Rule,
  index: number,
  context: EvaluationContext,
): RuleOutcome {
  const id = ruleId(rule, index);

  for (const condition of rule.when ?? []) {
    if (!evaluateCondition(condition, context)) {
      return { rule: id, matched: false, failed: condition };
    }
  }

  const rollout = rule.rollout;
  if (!rollout) return { rule: id, matched: true };

  const by = rolloutField(rule);
  const value = context[by];
  if (typeof value !== 'string' && typeof value !== 'number') {
    // No bucketing value, so the rollout cannot be evaluated and does not
    // match. Defaulting it to "in" would ramp a rollout to everyone whose
    // context happens to be incomplete.
    return {
      rule: id,
      matched: false,
      rollout: { percent: rollout.percent, by, member: false },
    };
  }

  const member = inRollout(
    String(value),
    rollout.percent,
    rolloutSeed(definition, rule),
  );

  return {
    rule: id,
    matched: member,
    rollout: { percent: rollout.percent, by, member },
  };
}

/**
 * The first parent that resolved off, or `undefined`.
 *
 * The parameter type is the narrowest thing the cascade is allowed to see: an
 * `enabled` flag and nothing else. That `reason` is output only is enforced here
 * by the type system, not only by convention.
 */
function blockingParent<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  resolved: ReadonlyMap<F, { readonly enabled: boolean }>,
): F | undefined {
  for (const parent of definition.dependsOn ?? []) {
    const decision = resolved.get(parent);
    // An unresolved parent cannot happen for a validated graph evaluated in
    // dependency order, and is treated as blocking rather than ignored.
    if (!decision || !decision.enabled) return parent;
  }
  return undefined;
}

/**
 * Walks to the first ancestor that is off for a reason of its own.
 *
 * Explanation only. A UI wants the root cause; a graph view wants the edge, so
 * both are reported.
 */
function rootCause<F extends FeatureKey>(
  parent: F,
  resolved: ReadonlyMap<F, Decision<F>>,
): Cause<F> {
  let at = parent;
  const seen = new Set<F>([at]);

  for (;;) {
    const decision = resolved.get(at);
    if (!decision) return { key: at, reason: 'explicitly-off' };
    if (decision.reason !== 'dependency-off' || decision.blockedBy === undefined) {
      const cause: Cause<F> = { key: at, reason: decision.reason };
      // The rule is named when there is exactly one to name: the matching rule,
      // or the single rule that failed. With several rules and none matching
      // there is no one rule to blame, and the full breakdown is on the
      // ancestor's own decision.
      const rule =
        decision.rule ??
        (decision.rules?.length === 1 ? decision.rules[0]?.rule : undefined);
      if (rule !== undefined) cause.rule = rule;
      return cause;
    }
    at = decision.blockedBy;
    // The graph is acyclic, so this cannot loop; the guard keeps a malformed
    // decision map from hanging a caller rather than trusting that.
    if (seen.has(at)) return { key: at, reason: decision.reason };
    seen.add(at);
  }
}

/**
 * Decides one feature, given the already-resolved decisions of everything it
 * depends on. Pure in `(definition, context, resolved)`.
 *
 * Precedence, defined once:
 *
 * 1. `enabled === false` short-circuits. Rules never run.
 * 2. A parent that resolved off short-circuits. Rules never run.
 * 3. No rules means on.
 * 4. Rules are OR-ed, and the conditions within one rule are AND-ed.
 */
export function decide<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  context: EvaluationContext,
  resolved: ReadonlyMap<F, Decision<F>>,
): Decision<F> {
  if (!definition.enabled) {
    return { key: definition.key, enabled: false, reason: 'explicitly-off' };
  }

  const blocked = blockingParent(definition, resolved);
  if (blocked !== undefined) {
    return {
      key: definition.key,
      enabled: false,
      reason: 'dependency-off',
      blockedBy: blocked,
      cause: rootCause(blocked, resolved),
    };
  }

  const rules = definition.rules ?? [];
  if (rules.length === 0) {
    return { key: definition.key, enabled: true, reason: 'default-on' };
  }

  const outcomes: RuleOutcome[] = [];
  for (const [index, rule] of rules.entries()) {
    const outcome = evaluateRule(definition, rule, index, context);
    if (outcome.matched) {
      return {
        key: definition.key,
        enabled: true,
        reason: 'rule-match',
        rule: outcome.rule,
      };
    }
    outcomes.push(outcome);
  }

  return {
    key: definition.key,
    enabled: false,
    reason: 'no-rule-matched',
    rules: outcomes,
  };
}

/**
 * Plans one feature for a partially known context.
 *
 * The line is context-free versus context-dependent: a rule whose fields are all
 * present can be decided now, and one that still needs a field cannot. `now` is
 * present only for a feature that opted into freezing its windows at build time,
 * because baking a date window into a build is a deploy-cadence decision.
 */
export function planFeature<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  context: EvaluationContext,
  plans: ReadonlyMap<F, PlanEntry<F>>,
  resolved: ReadonlyMap<F, Decision<F>>,
): PlanEntry<F> {
  const key = definition.key;

  if (!definition.enabled) {
    return {
      key,
      resolved: false,
      needs: [],
      decision: decide(definition, context, resolved),
    };
  }

  const deferredNeeds = new Set<string>();
  for (const parent of definition.dependsOn ?? []) {
    const parentPlan = plans.get(parent);
    if (!parentPlan || parentPlan.resolved === false) {
      return {
        key,
        resolved: false,
        needs: [],
        decision: decide(definition, context, resolved),
      };
    }
    if (parentPlan.resolved === 'deferred') {
      for (const need of parentPlan.needs) deferredNeeds.add(need);
    }
  }

  const available = new Set(
    Object.keys(context).filter(
      (field) => field !== 'now' && context[field] !== undefined,
    ),
  );
  if (definition.freezeTimeAtBuild) available.add('now');

  const rules = definition.rules ?? [];
  const ownNeeds = new Set<string>();

  if (deferredNeeds.size === 0) {
    for (const [index, rule] of rules.entries()) {
      const missing = ruleFields(rule).filter((field) => !available.has(field));
      if (missing.length) {
        for (const field of missing) ownNeeds.add(field);
        continue;
      }
      if (evaluateRule(definition, rule, index, context).matched) {
        return {
          key,
          resolved: true,
          needs: [],
          decision: decide(definition, context, resolved),
        };
      }
    }
  }

  const needs = [...deferredNeeds, ...ownNeeds].sort();
  if (needs.length) return { key, resolved: 'deferred', needs };

  return {
    key,
    resolved: rules.length === 0,
    needs: [],
    decision: decide(definition, context, resolved),
  };
}
