import type { Condition, Rule } from './types.js';

/**
 * JSON with object keys in sorted order, so two producers that emit the same
 * rule with their keys in different orders agree on the text.
 *
 * Array order is left alone. `in: ['a', 'b']` and `in: ['b', 'a']` test the
 * same membership but hash differently, which is correct for an identifier: it
 * names the rule as it was written, and a document that reorders a list is a
 * document that changed.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, each]) => each !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, each]) => `${JSON.stringify(key)}:${canonical(each)}`).join(',')}}`;
}

/** One condition as text, with the four keys in a fixed order. */
function conditionText(condition: Condition): string {
  const { field, op } = condition;
  const path = 'path' in condition ? condition.path : undefined;
  const operand =
    path === undefined ? `v${canonical(condition.value)}` : `p${path}`;
  return `${field}${op}${operand}`;
}

/**
 * FNV-1a, 32 bits, over the rule's canonical text.
 *
 * Not a cryptographic digest: `can` is synchronous and Web Crypto's `digest`
 * returns a promise. A rule id names a rule in a decision and in a log, and no
 * security property rests on the difficulty of finding a second rule that
 * hashes the same.
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
 * The fallback is derived from the rule's conditions and the side it sits on,
 * so it survives a rule being inserted above it, the two sides being reordered,
 * and the same document being emitted by a producer in another language. A
 * positional `#0` survives none of those, and a log line holding one means
 * nothing once the document moves on.
 *
 * Two rules on one side with identical conditions derive the same id. They
 * decide identically, so a decision naming either names the rule that decided.
 *
 * An author who wants a name in the audit log writes `id: 'owner-edits-own'`,
 * which reads better than a hash and is what the docs recommend.
 */
export function ruleId(rule: Rule, side: 'allow' | 'deny'): string {
  if (rule.id !== undefined) return rule.id;
  const text = (rule.when ?? []).map(conditionText).join('');
  return `${side}-${fnv1a(text)}`;
}
