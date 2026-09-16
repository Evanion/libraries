import { evaluateCondition } from './conditions.js';
import type {
  Cause,
  Decision,
  EvaluationContext,
  Permission,
  Rule,
} from './types.js';

function ruleId(rule: Rule, index: number): string {
  return rule.id ?? `#${index}`;
}

/**
 * How one rule stands: matched, a definite miss, or undecidable for the object
 * paths it could not read.
 */
type RuleOutcome =
  | { state: 'matched'; rule: string }
  | { state: 'not-matched'; rule: string }
  | { state: 'undecidable'; rule: string; missing: readonly string[] };

/**
 * A rule's `when` conditions are AND-ed, so one condition that definitely fails
 * decides the rule however many of the others are undecidable: no reading of the
 * absent paths could make the AND hold.
 */
function ruleMatches(
  rule: Rule,
  index: number,
  ctx: EvaluationContext,
): RuleOutcome {
  const id = ruleId(rule, index);
  const missing: string[] = [];
  for (const condition of rule.when ?? []) {
    const outcome = evaluateCondition(condition, ctx);
    if (outcome.state === 'fails') return { state: 'not-matched', rule: id };
    if (outcome.state === 'undecidable') missing.push(...outcome.missing);
  }
  if (missing.length > 0) return { state: 'undecidable', rule: id, missing };
  return { state: 'matched', rule: id };
}

function rulesAllow(
  permission: Permission,
  ctx: EvaluationContext,
): { decision: Decision } | { unevaluable: Decision } {
  const rules = permission.rules ?? [];
  const missing = new Set<string>();

  for (const [index, rule] of rules.entries()) {
    const outcome = ruleMatches(rule, index, ctx);
    if (outcome.state === 'matched') {
      return {
        decision: {
          key: permission.key,
          allowed: true,
          reason: 'allow',
          rule: outcome.rule,
        },
      };
    }
    if (outcome.state === 'undecidable') {
      for (const path of outcome.missing) missing.add(path);
    }
  }

  // No rule matched, and at least one could not be decided for the paths it
  // reads. The permission is unevaluable rather than a definite deny, whether
  // the object is absent entirely or carries only a projection of its fields.
  if (missing.size > 0) {
    return {
      unevaluable: {
        key: permission.key,
        allowed: false,
        reason: 'unevaluable',
        missing: [...missing],
      },
    };
  }

  return {
    decision: {
      key: permission.key,
      allowed: false,
      reason: 'no-rule-matched',
    },
  };
}

function blockingParent(
  permission: Permission,
  resolved: ReadonlyMap<string, { readonly allowed: boolean }>,
): string | undefined {
  for (const parent of permission.dependsOn ?? []) {
    const decision = resolved.get(parent);
    if (!decision || !decision.allowed) return parent;
  }
  return undefined;
}

function rootCause(
  parent: string,
  resolved: ReadonlyMap<string, Decision>,
): Cause {
  let at = parent;
  const seen = new Set<string>([at]);
  for (;;) {
    const decision = resolved.get(at);
    if (
      !decision ||
      decision.reason !== 'dependency-off' ||
      decision.blockedBy === undefined
    ) {
      const cause: Cause = {
        key: at,
        reason: decision?.reason ?? 'no-rule-matched',
      };
      if (decision?.rule) cause.rule = decision.rule;
      return cause;
    }
    at = decision.blockedBy;
    if (seen.has(at)) return { key: at, reason: decision.reason };
    seen.add(at);
  }
}

/**
 * Decides one permission. Pure in `(permission, ctx, resolved)`.
 *
 * Precedence, defined once:
 * 1. deny rule matches -> denied
 * 2. dependency resolved off -> dependency-off
 * 3. allow rule matches -> allow
 * 4. a rule undecidable for lack of an instance or of the paths it reads ->
 *    unevaluable
 * 5. no rule matched -> no-rule-matched
 *
 * A deny rule that is undecidable does not deny: step 1 asks whether a deny
 * matched.
 */
export function decide(
  permission: Permission,
  ctx: EvaluationContext,
  resolved: ReadonlyMap<string, Decision>,
): Decision {
  for (const [index, deny] of (permission.denyRules ?? []).entries()) {
    const outcome = ruleMatches(deny, index, ctx);
    if (outcome.state === 'matched') {
      return {
        key: permission.key,
        allowed: false,
        reason: 'denied',
        rule: outcome.rule,
      };
    }
  }

  const blocked = blockingParent(permission, resolved);
  if (blocked !== undefined) {
    return {
      key: permission.key,
      allowed: false,
      reason: 'dependency-off',
      blockedBy: blocked,
      cause: rootCause(blocked, resolved),
    };
  }

  const allow = rulesAllow(permission, ctx);
  if ('unevaluable' in allow) return allow.unevaluable;
  return allow.decision;
}
