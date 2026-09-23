import { canonical } from './canonical.js';
import type { Condition, Instant, Rule } from './types.js';

/** Epoch milliseconds, so one instant written three ways reads as one value. */
function instantText(value: Instant): string {
  if (value instanceof Date) return String(value.getTime());
  if (typeof value === 'number') return String(value);
  const parsed = Date.parse(value);
  // An unparseable string is a configuration error the conditions module
  // reports. Here it hashes as itself, so two rules holding it agree.
  return Number.isNaN(parsed) ? canonical(value) : String(parsed);
}

/** One condition as text, with its keys in a fixed order. */
function conditionText(condition: Condition): string {
  const { field, op } = condition;
  if (op === 'day-of-week') {
    return `${field}${op}${condition.zone}${canonical(condition.value)}`;
  }
  if (field === 'now') {
    return `${field}${op}${instantText(condition.value as Instant)}`;
  }
  return `${field}${op}${canonical(condition.value)}`;
}

/**
 * The rollout as text, without its percentage.
 *
 * `by` and `seed` decide which subjects a rule can reach. `percent` decides how
 * many of them it reaches now, and an operator moving it is running the same
 * rule harder. Hashing the percentage renames the rule on every ramp, and an
 * event stream from before the ramp then joins to nothing after it.
 *
 * The consequence: two rollout rules on one feature whose conditions match and
 * whose `by` and `seed` match derive one id. An author separates them with an
 * explicit `rule.id`.
 */
function rolloutText(rule: Rule): string {
  if (!rule.rollout) return '';
  const { by, seed } = rule.rollout;
  return `r${canonical({ by, seed })}`;
}

/**
 * FNV-1a, 32 bits, over text.
 *
 * Not a cryptographic digest: evaluation is synchronous and Web Crypto's
 * `digest` returns a promise. A rule id names a rule in a decision and in a
 * log, and no security property rests on the difficulty of finding a second
 * rule that hashes the same.
 *
 * `charCodeAt` walks UTF-16 code units, which fixes the cross-language
 * contract. An implementation in another language matches code units.
 */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * The id a rule carries into a `Decision`. An explicit `rule.id` wins.
 *
 * The fallback is derived from what the rule matches on, so it survives a rule
 * being inserted above it, the list being reordered, a ramp being moved, and
 * the same document being emitted by a producer in another language. A
 * positional `#0` survives none of those, and a log line holding one means
 * something different once the list moves on.
 *
 * A control plane that assigns an id at rule creation writes it as `rule.id`
 * and this derivation never runs. See
 * `docs/specs/2026-09-23-feature-config-distribution.md` decision 5.
 *
 * An author who wants a name in a log writes `id: 'staff-only'`, which reads
 * better than a hash and is what the docs recommend.
 */
export function ruleId(rule: Rule): string {
  if (rule.id !== undefined) return rule.id;
  const text = (rule.when ?? []).map(conditionText).join('') + rolloutText(rule);
  return `rule-${fnv1a(text)}`;
}
