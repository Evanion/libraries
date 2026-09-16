import { evaluateCondition } from './conditions.js';
import type {
  Cause,
  Condition,
  Decision,
  EvaluationContext,
  Permission,
  Rule,
} from './types.js';

function ruleId(rule: Rule, index: number): string {
  return rule.id ?? `#${index}`;
}

/**
 * The object-scope paths one condition reads. A condition is object-dependent
 * through either operand: the field it reads or the path it compares against.
 * A literal comparand (`{ field: 'object.status', value: 'published' }`) is as
 * object-dependent as a path comparand.
 */
function objectPaths(condition: Condition): readonly string[] {
  const paths: string[] = [];
  if (condition.field.startsWith('object.')) paths.push(condition.field);
  if ('path' in condition && condition.path?.startsWith('object.')) {
    paths.push(condition.path);
  }
  return paths;
}

/**
 * The object paths a rule cannot decide without an instance.
 *
 * Empty when an object-independent condition of the same `when` is already
 * false: the conditions are AND-ed, so no object could make the rule hold, and
 * the rule is a definite miss rather than an undecidable one.
 */
function undecidablePaths(
  rule: Rule,
  ctx: EvaluationContext,
): readonly string[] {
  const missing: string[] = [];
  for (const condition of rule.when ?? []) {
    const paths = objectPaths(condition);
    if (paths.length === 0) {
      if (!evaluateCondition(condition, ctx)) return [];
      continue;
    }
    missing.push(...paths);
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

  // No rule matched. A rule whose object-independent conditions all hold and
  // whose remaining conditions read an absent object is undecidable, so the
  // permission is unevaluable for the create case rather than a definite deny.
  if (ctx.object === undefined) {
    const missing = [
      ...new Set(rules.flatMap((rule) => undecidablePaths(rule, ctx))),
    ];
    if (missing.length > 0) {
      return {
        unevaluable: {
          key: permission.key,
          allowed: false,
          reason: 'unevaluable',
          missing,
        },
      };
    }
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
