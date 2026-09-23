import { inRollout } from './bucketing.js';
import { conditionFields, evaluateCondition } from './conditions.js';
import { DEFAULT_ROLLOUT_FIELD } from './fields.js';
import { ruleId } from './rule-id.js';
import { assignVariant } from './variants.js';
import type { VariantAssignment } from './variants.js';
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

export { DEFAULT_ROLLOUT_FIELD } from './fields.js';

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
  context: EvaluationContext,
): RuleOutcome {
  const id = ruleId(rule);

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
    if (
      decision.reason !== 'dependency-off' ||
      decision.blockedBy === undefined
    ) {
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

/** Copies an assignment onto a decision. A feature with no variants adds nothing. */
function withVariant<F extends FeatureKey>(
  decision: Decision<F>,
  assigned: VariantAssignment | undefined,
  source: VariantAssignment['source'] | 'pinned' = assigned?.source ??
    'weighted',
  rule?: string,
): Decision<F> {
  if (!assigned) return decision;
  const assignment: Decision<F>['assignment'] = { source, by: assigned.by };
  if (assigned.bucket !== undefined && source !== 'pinned') {
    assignment.bucket = assigned.bucket;
  }
  if (rule !== undefined) assignment.rule = rule;

  const next: Decision<F> = {
    ...decision,
    variant: assigned.variant.name,
    assignment,
  };
  if (assigned.variant.value !== undefined) next.value = assigned.variant.value;
  return next;
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
    return withVariant(
      { key: definition.key, enabled: true, reason: 'default-on' },
      assignVariant(definition, context),
    );
  }

  const outcomes: RuleOutcome[] = [];
  for (const rule of rules) {
    const outcome = evaluateRule(definition, rule, context);
    if (outcome.matched) {
      const base: Decision<F> = {
        key: definition.key,
        enabled: true,
        reason: 'rule-match',
        rule: outcome.rule,
      };
      const assigned = assignVariant(definition, context);
      if (!assigned) return base;

      const pinned = rule.variant;
      if (pinned !== undefined) {
        const held = definition.variants?.find((each) => each.name === pinned);
        // `validateVariants` refused a pin naming an undeclared variant at
        // construction, so `held` is present for any configuration that built.
        if (held) {
          return withVariant(
            base,
            { ...assigned, variant: held },
            'pinned',
            outcome.rule,
          );
        }
      }

      return withVariant(base, assigned);
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
  // Fields a rule itself is missing. A rule that still needs a field leaves
  // enablement unresolved, so this loop keeps that need separate from the
  // variant's need below and never lets the two share one need count.
  const ruleNeeds = new Set<string>();
  let matched = false;

  if (deferredNeeds.size === 0) {
    for (const rule of rules) {
      const missing = ruleFields(rule).filter((field) => !available.has(field));
      if (missing.length) {
        for (const field of missing) ruleNeeds.add(field);
        continue;
      }
      if (evaluateRule(definition, rule, context).matched) {
        // Rules are OR-ed, so this match settles enablement on its own. The
        // loop breaks immediately here, and drops any need an earlier rule
        // in this pass logged: that rule no longer decides anything.
        matched = true;
        break;
      }
    }
  }

  const variantField = definition.variantBy ?? DEFAULT_ROLLOUT_FIELD;
  const declaresVariants =
    definition.variants !== undefined && definition.variants.length > 0;

  // Enablement is settled once every one of this feature's own rules has run
  // against the fields this plan had: a rule matched, or the loop finished
  // checking every rule and none did (no rules counts as the same case).
  // `decide` already knows what settles the split, so this block calls it
  // once and reads `settled.assignment` for the answer.
  if (deferredNeeds.size === 0 && (matched || ruleNeeds.size === 0)) {
    const settled = decide(definition, context, resolved);
    // `'fallback'` is the one source that means the context left the split
    // unsettled: `assignVariant` found no usable bucketing value and handed
    // back the control as a placeholder. Every other source settles the
    // split, and a feature that resolved off carries no assignment at all,
    // because it never calls `assignVariant`.
    if (settled.assignment?.source !== 'fallback') {
      return { key, resolved: settled.enabled, needs: [], decision: settled };
    }
    // The split still waits on the bucketing field. Attaching the
    // fallback-assigned control here would freeze every subject onto it, so
    // this entry reports enablement and leaves the split to the request.
    const { variant, value, assignment, ...enablement } = settled;
    return {
      key,
      resolved: 'deferred',
      needs: [variantField],
      decision: enablement as Decision<F>,
    };
  }

  // Enablement itself is still unresolved here: a parent left a need, or a
  // rule did. `decide` cannot safely run against the incomplete context this
  // plan had, so this branch lists the variant field as outstanding only when
  // the context is missing it, without attaching a decision.
  const needsVariantField = declaresVariants && !available.has(variantField);
  const needs = [
    ...new Set([
      ...deferredNeeds,
      ...ruleNeeds,
      ...(needsVariantField ? [variantField] : []),
    ]),
  ].sort();
  return { key, resolved: 'deferred', needs };
}
