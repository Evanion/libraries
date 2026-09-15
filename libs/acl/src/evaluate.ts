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

/** The field paths a rule reads that sit on the object scope. */
function objectDependent(rule: Rule): readonly string[] {
  const missing: string[] = [];
  for (const condition of rule.when ?? []) {
    if (!('path' in condition)) continue;
    if (condition.field.startsWith('object.')) missing.push(condition.field);
    if (condition.path?.startsWith('object.')) missing.push(condition.path);
  }
  return missing;
}

function ruleMatches(
  rule: Rule,
  index: number,
  ctx: EvaluationContext,
):
  | { matched: true; rule: string }
  | { matched: false; rule: string; failed: string } {
  const id = ruleId(rule, index);
  for (const condition of rule.when ?? []) {
    if (!evaluateCondition(condition, ctx)) {
      return { matched: false, rule: id, failed: condition.field };
    }
  }
  return { matched: true, rule: id };
}

function rulesAllow(
  permission: Permission,
  ctx: EvaluationContext,
): { decision: Decision } | { unevaluable: Decision } {
  const rules = permission.rules ?? [];

  for (const [index, rule] of rules.entries()) {
    const outcome = ruleMatches(rule, index, ctx);
    if (outcome.matched) {
      return {
        decision: {
          key: permission.key,
          allowed: true,
          reason: 'allow',
          rule: outcome.rule,
        },
      };
    }
  }

  // Every rule depends on an absent object, and none matched: the permission
  // is unevaluable for the create case, not a definite deny.
  const allDependOnObject = rules.every((rule) => objectDependent(rule).length > 0);
  const objectMissing = ctx.object === undefined;
  if (allDependOnObject && objectMissing && rules.length > 0) {
    return {
      unevaluable: {
        key: permission.key,
        allowed: false,
        reason: 'unevaluable',
        missing: [...new Set(rules.flatMap(objectDependent))],
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
      const cause: Cause = { key: at, reason: decision?.reason ?? 'no-rule-matched' };
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
 * 4. object-dependent rules only, object absent -> unevaluable
 * 5. no rule matched -> no-rule-matched
 */
export function decide(
  permission: Permission,
  ctx: EvaluationContext,
  resolved: ReadonlyMap<string, Decision>,
): Decision {
  for (const [index, deny] of (permission.denyRules ?? []).entries()) {
    const outcome = ruleMatches(deny, index, ctx);
    if (outcome.matched) {
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
