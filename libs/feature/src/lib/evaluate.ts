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
    // A deferred parent that carries a `decision` settled its own enablement
    // and deferred only its split; the cascade below reads that enablement
    // off `resolved` and needs nothing further from it. A deferred parent
    // with no `decision` left its own enablement unresolved, and that need
    // carries to every dependant.
    if (parentPlan.resolved === 'deferred' && !parentPlan.decision) {
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

  if (deferredNeeds.size === 0) {
    for (const rule of rules) {
      const missing = ruleFields(rule).filter((field) => !available.has(field));
      if (missing.length) {
        for (const field of missing) ruleNeeds.add(field);
        continue;
      }
      if (evaluateRule(definition, rule, context).matched) {
        // `decide` evaluates rules in order and stops at the first match, so
        // this loop stops here too. A rule after this one never runs, and a
        // need that rule would have logged never reaches `ruleNeeds`.
        break;
      }
    }
  }

  const variantField = definition.variantBy ?? DEFAULT_ROLLOUT_FIELD;
  const declaresVariants =
    definition.variants !== undefined && definition.variants.length > 0;

  // This block settles enablement only when every rule the loop looked at
  // resolved cleanly, leaving `ruleNeeds` empty. `decide` evaluates rules in
  // order and stops at the first match, so a rule the loop above skipped for
  // a missing field could still out-rank a rule that matched after it; a
  // match by itself does not settle anything while `ruleNeeds` is non-empty.
  // Once `ruleNeeds` is empty, `decide` already knows what settles the split,
  // so this block calls it once, reads `settled.assignment.source` to tell a
  // settled split from a fallback, and takes `resolved` from
  // `settled.enabled`.
  if (deferredNeeds.size === 0 && ruleNeeds.size === 0) {
    const settled = decide(definition, context, resolved);
    // `'fallback'` is the one source that means the context left the split
    // unsettled: `assignVariant` found no usable bucketing value and handed
    // back the control as a placeholder. Every other source settles the
    // split, and a feature that resolved off carries no assignment at all,
    // because it never calls `assignVariant`.
    if (settled.assignment?.source !== 'fallback') {
      return { key, resolved: settled.enabled, needs: [], decision: settled };
    }
    // The bucketing field decides the split, and this context does not carry
    // it. `decide` computed the control only as a placeholder for the
    // fallback path. This entry drops that placeholder and reports
    // enablement only. A later request that supplies the field settles the
    // split.
    const { variant, value, assignment, ...enablement } = settled;
    return {
      key,
      resolved: 'deferred',
      needs: [variantField],
      decision: enablement as Decision<F>,
    };
  }

  // A parent left a need here, or a rule did, so enablement itself is still
  // unresolved. `decide` cannot safely run against the incomplete context
  // this plan had, so this branch lists the variant field as outstanding
  // only when the context is missing it, without attaching a decision.
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
