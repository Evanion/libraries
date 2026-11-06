import { evaluateResolved, resolveContext } from './conditions.js';
import type { ResolvedContext } from './conditions.js';
import { ruleId } from './rule-id.js';
import type {
  ConditionOutcome,
  Decision,
  EvaluationContext,
  Explanation,
  Permission,
  Rule,
  RuleExplanation,
} from './types.js';

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
function settleRule(
  id: string,
  clockUnusable: boolean,
  missing: readonly string[],
): RuleOutcome {
  if (clockUnusable) return { state: 'unusable-clock', rule: id };
  if (missing.length > 0) return { state: 'unevaluable', rule: id, missing };
  return { state: 'matched', rule: id };
}

/** The deciding path: stops at the first `fails`, reading no condition past it. */
function ruleMatches(
  rule: Rule,
  side: 'allow' | 'deny',
  ctx: ResolvedContext,
): RuleOutcome {
  const id = ruleId(rule, side);
  const missing: string[] = [];
  let clockUnusable = false;
  for (const condition of rule.when ?? []) {
    const outcome = evaluateResolved(condition, ctx);
    if (outcome.state === 'fails') return { state: 'not-matched', rule: id };
    if (outcome.state === 'unusable-clock') clockUnusable = true;
    if (outcome.state === 'unevaluable') missing.push(...outcome.missing);
  }
  return settleRule(id, clockUnusable, missing);
}

/** The same rule over outcomes `explain` already computed for every condition. */
function foldRule(
  id: string,
  outcomes: readonly ConditionOutcome[],
): RuleOutcome {
  const missing: string[] = [];
  let clockUnusable = false;
  for (const outcome of outcomes) {
    if (outcome.state === 'fails') return { state: 'not-matched', rule: id };
    if (outcome.state === 'unusable-clock') clockUnusable = true;
    if (outcome.state === 'unevaluable') missing.push(...outcome.missing);
  }
  return settleRule(id, clockUnusable, missing);
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

function settleSide(
  clockRule: string | undefined,
  first: string | undefined,
  missing: ReadonlySet<string>,
): SideOutcome {
  if (clockRule !== undefined) {
    return { state: 'unusable-clock', rule: clockRule };
  }
  if (first !== undefined) {
    return { state: 'unevaluable', rule: first, missing: [...missing] };
  }
  return { state: 'fails' };
}

/** The deciding path: stops at the first rule that matches. */
function sideOutcome(
  rules: readonly Rule[] | undefined,
  side: 'allow' | 'deny',
  ctx: ResolvedContext,
): SideOutcome {
  const missing = new Set<string>();
  let first: string | undefined;
  let clockRule: string | undefined;

  for (const rule of rules ?? []) {
    const outcome = ruleMatches(rule, side, ctx);
    if (outcome.state === 'matched') {
      return { state: 'matched', rule: outcome.rule };
    }
    if (outcome.state === 'unusable-clock') clockRule ??= outcome.rule;
    if (outcome.state === 'unevaluable') {
      first ??= outcome.rule;
      for (const path of outcome.missing) missing.add(path);
    }
  }
  return settleSide(clockRule, first, missing);
}

/** The same side over rule outcomes `explain` already computed. */
function foldSide(outcomes: readonly RuleOutcome[]): SideOutcome {
  const missing = new Set<string>();
  let first: string | undefined;
  let clockRule: string | undefined;

  for (const outcome of outcomes) {
    if (outcome.state === 'matched') {
      return { state: 'matched', rule: outcome.rule };
    }
    if (outcome.state === 'unusable-clock') clockRule ??= outcome.rule;
    if (outcome.state === 'unevaluable') {
      first ??= outcome.rule;
      for (const path of outcome.missing) missing.add(path);
    }
  }
  return settleSide(clockRule, first, missing);
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
  return precedence(
    permission,
    sideOutcome(permission.denyRules, 'deny', ctx),
    () => sideOutcome(permission.rules, 'allow', ctx),
  ).decision;
}

/** The decision and the numbered step above that produced it. */
interface Decided {
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  decision: Decision;
}

/**
 * The seven steps of `decideResolved`, over outcomes already computed.
 *
 * `allowOf` is called only past step 1, so the deciding path leaves the allow
 * side unread when a deny matched. `explain` passes a thunk over an outcome it
 * computed with every condition read.
 */
function precedence(
  permission: Permission,
  deny: SideOutcome,
  allowOf: () => SideOutcome,
): Decided {
  if (deny.state === 'matched') {
    return {
      step: 1,
      decision: {
        key: permission.key,
        allowed: false,
        reason: 'denied',
        rule: deny.rule,
      },
    };
  }

  const allow = allowOf();
  if (allow.state === 'fails') {
    return {
      step: 2,
      decision: {
        key: permission.key,
        allowed: false,
        reason: 'no-rule-matched',
      },
    };
  }

  if (deny.state === 'unusable-clock') {
    // The rule whose job is to refuse is gated on a clock that does not parse.
    // No instant is available to decide it, so the permission refuses.
    return {
      step: 3,
      decision: {
        key: permission.key,
        allowed: false,
        reason: 'unusable-clock',
        rule: deny.rule,
      },
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
      step: 4,
      decision: {
        key: permission.key,
        allowed: false,
        reason: 'unevaluable',
        rule: deny.rule,
        missing: [...missing],
      },
    };
  }

  if (allow.state === 'matched') {
    return {
      step: 5,
      decision: {
        key: permission.key,
        allowed: true,
        reason: 'allow',
        rule: allow.rule,
      },
    };
  }

  if (allow.state === 'unusable-clock') {
    return {
      step: 6,
      decision: {
        key: permission.key,
        allowed: false,
        reason: 'unusable-clock',
        rule: allow.rule,
      },
    };
  }

  return {
    step: 7,
    decision: {
      key: permission.key,
      allowed: false,
      reason: 'unevaluable',
      missing: allow.missing,
    },
  };
}

/** One rule with every condition read, and the rule's state over them. */
function explainRule(
  rule: Rule,
  side: 'allow' | 'deny',
  ctx: ResolvedContext,
): { explanation: RuleExplanation; outcome: RuleOutcome } {
  const outcomes = (rule.when ?? []).map((condition) => ({
    condition,
    outcome: evaluateResolved(condition, ctx),
  }));
  const outcome = foldRule(
    ruleId(rule, side),
    outcomes.map((entry) => entry.outcome),
  );
  return {
    outcome,
    explanation: {
      rule: outcome.rule,
      state: outcome.state,
      conditions: outcomes.map(({ condition, outcome: held }) =>
        held.state === 'unevaluable'
          ? { condition, state: held.state, missing: held.missing }
          : { condition, state: held.state },
      ),
    },
  };
}

function explainSide(
  rules: readonly Rule[] | undefined,
  side: 'allow' | 'deny',
  ctx: ResolvedContext,
): { explanations: RuleExplanation[]; outcome: SideOutcome } {
  const explained = (rules ?? []).map((rule) => explainRule(rule, side, ctx));
  return {
    explanations: explained.map((entry) => entry.explanation),
    outcome: foldSide(explained.map((entry) => entry.outcome)),
  };
}

/**
 * Explains one permission: `decideResolved`'s decision and the step that made
 * it, with every condition of every rule on both sides evaluated.
 *
 * The decision comes from `precedence`, the function `decideResolved` calls, so
 * the two cannot disagree. Only the cost differs: `decideResolved` stops at the
 * first rule that decides and `explainResolved` reads them all.
 *
 * The result holds states and the paths a condition could not read. It holds no
 * value from the subject or the object.
 */
export function explainResolved(
  permission: Permission,
  ctx: ResolvedContext,
): Explanation {
  const deny = explainSide(permission.denyRules, 'deny', ctx);
  const allow = explainSide(permission.rules, 'allow', ctx);
  const { step, decision } = precedence(
    permission,
    deny.outcome,
    () => allow.outcome,
  );
  return {
    decision,
    step,
    deny: deny.explanations,
    allow: allow.explanations,
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
