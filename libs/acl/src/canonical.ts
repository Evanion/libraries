/**
 * Canonical text for a value, with object keys in sorted order.
 *
 * Two documents differing only in key order or in whitespace state one policy.
 * A comparison that called them different is noise, and a `version` derived
 * from a digest of the bytes would change when nothing did. Both read this.
 *
 * Array order is preserved. `in: ['a', 'b']` and `in: ['b', 'a']` test the same
 * membership, but sorting them here would claim a semantic equality this
 * function does not generally have, and a document that reorders a list is a
 * document somebody edited.
 *
 * `undefined` properties are dropped, so an absent key and a key written as
 * `undefined` agree. A JSON document carries no `undefined`, and a document
 * built in memory can.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, each]) => each !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, each]) => `${JSON.stringify(key)}:${canonical(each)}`).join(',')}}`;
}
