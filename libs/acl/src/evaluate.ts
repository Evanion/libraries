import { evaluateResolved, resolveContext } from './conditions.js';
import type { ResolvedContext } from './conditions.js';
import type { Decision, EvaluationContext, Permission, Rule } from './types.js';

function ruleId(rule: Rule, index: number): string {
  return rule.id ?? `#${index}`;
}

/**
 * How one rule stands: matched, a definite miss, held up by a clock that does
 * not parse, or unevaluable for the object paths it could not read.
 */
type RuleOutcome =
  | { state: 'matched'; rule: string }
  | { state: 'not-matched'; rule: string }
  | { state: 'unusable-clock'; rule: string }
  | { state: 'unevaluable'; rule: string; missing: readonly string[] };

/**
 * A rule's `when` conditions are AND-ed, so one condition that definitely fails
 * decides the rule however many of the others are unusable or unevaluable: no
 * reading of the absent paths and no clock could make the AND hold.
 *
 * Short of that, an unusable clock outranks an unevaluable path, because it is
 * the one the caller cannot repair by fetching.
 */
function ruleMatches(
  rule: Rule,
  index: number,
  ctx: ResolvedContext,
): RuleOutcome {
  const id = ruleId(rule, index);
  const missing: string[] = [];
  let clockUnusable = false;
  for (const condition of rule.when ?? []) {
    const outcome = evaluateResolved(condition, ctx);
    if (outcome.state === 'fails') return { state: 'not-matched', rule: id };
    if (outcome.state === 'unusable-clock') clockUnusable = true;
    if (outcome.state === 'unevaluable') missing.push(...outcome.missing);
  }
  if (clockUnusable) return { state: 'unusable-clock', rule: id };
  if (missing.length > 0) return { state: 'unevaluable', rule: id, missing };
  return { state: 'matched', rule: id };
}

/**
 * How one side of a permission stands: its rules are OR-ed, so a match decides
 * the side. With no match, one rule left unevaluable leaves the side
 * unevaluable — the absent paths could still have made it match.
 *
 * `rule` names the first unevaluable rule; `missing` unions the paths of all of
 * them, so one refetch settles the side rather than one rule at a time.
 *
 * A rule held up by an unusable clock leaves the side `unusable-clock`, and that
 * outranks an unevaluable rule for the same reason it does inside a rule: a
 * refetch does not settle it.
 */
type SideOutcome =
  | { state: 'matched'; rule: string }
  | { state: 'fails' }
  | { state: 'unusable-clock'; rule: string }
  | { state: 'unevaluable'; rule: string; missing: readonly string[] };

function sideOutcome(
  rules: readonly Rule[] | undefined,
  ctx: ResolvedContext,
): SideOutcome {
  const missing = new Set<string>();
  let first: string | undefined;
  let clockRule: string | undefined;

  for (const [index, rule] of (rules ?? []).entries()) {
    const outcome = ruleMatches(rule, index, ctx);
    if (outcome.state === 'matched') {
      return { state: 'matched', rule: outcome.rule };
    }
    if (outcome.state === 'unusable-clock') {
      clockRule ??= outcome.rule;
    }
    if (outcome.state === 'unevaluable') {
      first ??= outcome.rule;
      for (const path of outcome.missing) missing.add(path);
    }
  }

  if (clockRule !== undefined) {
    return { state: 'unusable-clock', rule: clockRule };
  }
  if (first !== undefined) {
    return { state: 'unevaluable', rule: first, missing: [...missing] };
  }
  return { state: 'fails' };
}

/**
 * Decides one permission. Pure in `(permission, ctx)`.
 *
 * A definite outcome beats an undecided one; among definite outcomes, deny beats
 * allow. A deny the engine could not decide only ever subtracts, so it can never
 * turn a definite no-allow into something repairable.
 *
 * Every step reads `permission.rules`, `permission.denyRules` and the context,
 * so one decision is answerable from the permission a reader has in hand.
 *
 * Precedence, defined once:
 * 1. a deny rule matches -> denied
 * 2. the allow side definitely fails -> no-rule-matched
 * 3. the deny side reads an unusable clock -> unusable-clock, naming the rule
 * 4. the deny side is unevaluable -> unevaluable, naming the deny rule
 * 5. an allow rule matches -> allow
 * 6. the allow side reads an unusable clock -> unusable-clock
 * 7. the allow side is unevaluable -> unevaluable, naming the paths it missed
 *
 * Seven branches and no eighth. Step 2 is the only `no-rule-matched` there is,
 * because `sideOutcome` answers `fails` for every allow side that definitely
 * matched nothing, and the four states it can answer with are each named above.
 * Step 7 is the last return, reached with `unevaluable` as the one allow state
 * the steps above have not already answered.
 *
 * Steps 3 and 4 sit above step 5 because a deny the engine could not decide
 * outranks an allow that matched: the side whose job is to refuse has to be
 * decided before a grant is handed out.
 *
 * Step 2 sits above both because allow is required: a definite "no allow rule
 * matched" cannot be repaired by fetching the object, and reporting
 * `unevaluable` there would tell a UI to refetch and re-ask forever. Every one
 * of these branches is `allowed: false`, so none leaks.
 */
export function decideResolved(
  permission: Permission,
  ctx: ResolvedContext,
): Decision {
  const deny = sideOutcome(permission.denyRules, ctx);
  if (deny.state === 'matched') {
    return {
      key: permission.key,
      allowed: false,
      reason: 'denied',
      rule: deny.rule,
    };
  }

  const allow = sideOutcome(permission.rules, ctx);
  if (allow.state === 'fails') {
    return { key: permission.key, allowed: false, reason: 'no-rule-matched' };
  }

  if (deny.state === 'unusable-clock') {
    // The rule whose job is to refuse is gated on a clock that does not parse.
    // No instant is available to decide it, so the permission refuses.
    return {
      key: permission.key,
      allowed: false,
      reason: 'unusable-clock',
      rule: deny.rule,
    };
  }

  if (deny.state === 'unevaluable') {
    // The rule whose job is to refuse could not be read. Both sides' paths go
    // out together so one refetch settles the permission.
    const missing = new Set(deny.missing);
    if (allow.state === 'unevaluable') {
      for (const path of allow.missing) missing.add(path);
    }
    return {
      key: permission.key,
      allowed: false,
      reason: 'unevaluable',
      rule: deny.rule,
      missing: [...missing],
    };
  }

  if (allow.state === 'matched') {
    return {
      key: permission.key,
      allowed: true,
      reason: 'allow',
      rule: allow.rule,
    };
  }

  if (allow.state === 'unusable-clock') {
    return {
      key: permission.key,
      allowed: false,
      reason: 'unusable-clock',
      rule: allow.rule,
    };
  }

  return {
    key: permission.key,
    allowed: false,
    reason: 'unevaluable',
    missing: allow.missing,
  };
}

/**
 * Decides one permission against a caller's context, settling the clock first.
 *
 * `capabilities` decides many permissions against one context, so the entry
 * point settles once and calls `decideResolved` per permission.
 *
 * Internal. It answers for the permission handed to it and checks nothing about
 * the document that permission came from, so a caller holding a node the gate
 * never saw gets a decision over unvalidated rules. `access.can` is the guard
 * an application holds.
 */
export function decide(
  permission: Permission,
  ctx: EvaluationContext,
): Decision {
  return decideResolved(permission, resolveContext(ctx));
}
