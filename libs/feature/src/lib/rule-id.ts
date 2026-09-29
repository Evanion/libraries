import { canonical } from './canonical.js';
import { instantEpoch } from './instant.js';
import type { Condition, Instant, Rule } from './types.js';

/**
 * Epoch milliseconds, so one instant written three ways reads as one value.
 *
 * A string that names no instant is hashed as text instead, so that two hosts
 * reading it against their own zones still derive one id. `createFeatures`
 * rejects such a string, and this path is what a caller reaching `ruleId`
 * directly gets.
 */
function instantText(value: Instant): string {
  const epoch = instantEpoch(value);
  if (!Number.isNaN(epoch)) return String(epoch);
  return typeof value === 'string' ? canonical(value) : String(epoch);
}

/** A string with its length in front, so no two distinct parts share a text. */
function part(text: string): string {
  return `${text.length}:${text}`;
}

/**
 * One condition as text, with its keys in a fixed order.
 *
 * Every variable-length part carries its length, `op` included. A field is
 * an arbitrary string abutting the operator, so `{ field: 'usernot-', op:
 * 'in' }` and `{ field: 'user', op: 'not-in' }` write one text without a
 * prefix there, and those two conditions are opposite predicates.
 *
 * `op` itself is a member of a union that is prefix-free today -- `'eq'`
 * cannot be mistaken for the start of `'in'` or `'not-in'` -- but nothing
 * enforces that, and the union is a type authors extend. Adding `'eq-ci'`
 * would silently collide with `'eq'` at the exact boundary this function
 * writes, so `op` is length-prefixed too rather than trusted to stay
 * prefix-free. `encodePair` in `bucketing.ts` length-prefixes for the same
 * reason.
 */
function conditionText(condition: Condition): string {
  const { field, op } = condition;
  if (op === 'day-of-week') {
    return `${part(field)}${part(op)}${part(condition.zone)}${canonical(condition.value)}`;
  }
  if (op === 'before' || op === 'after') {
    return `${part(field)}${part(op)}${instantText(condition.value)}`;
  }
  return `${part(field)}${part(op)}${canonical(condition.value)}`;
}

/**
 * The rollout as text, without its percentage.
 *
 * `by` and `seed` decide which subjects a rule can reach. `percent` decides how
 * many of them it reaches now, and an operator moving it is running the same
 * rule harder. A hash over the percentage renames the rule on every ramp, and
 * an event stream from before the ramp then joins to nothing after it.
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
 * Caches a rule's derived id by the identity of the `Rule` object.
 *
 * `createFeatures` runs `structuredClone` and then `deepFreeze` on every
 * definition, so a `Rule` reached through a store is immutable and keeps one
 * identity for the store's lifetime; recomputing its derived id on every
 * evaluation recanonicalises the same frozen conditions every time. A
 * `WeakMap` holds no rule alive on its own, so a discarded store's rules --
 * and their entries here -- are collected with it rather than leaking for the
 * life of the module.
 */
const derivedIds = new WeakMap<Rule, string>();

/**
 * The id a rule carries into a `Decision`. An explicit `rule.id` wins.
 *
 * The fallback is derived from what the rule matches on, so it survives a rule
 * being inserted above it, the list being reordered, a ramp being moved, and
 * the same document being emitted by a producer in another language. A
 * positional `#0` holds through none of those, and a log line holding one
 * means something different once the list moves on.
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

  const cached = derivedIds.get(rule);
  if (cached !== undefined) return cached;

  const conditions = (rule.when ?? []).map(conditionText).map(part).join('');
  const id = `rule-${fnv1a(conditions + rolloutText(rule))}`;
  derivedIds.set(rule, id);
  return id;
}
