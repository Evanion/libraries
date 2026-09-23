/**
 * Canonical text for a value, with object keys in sorted order.
 *
 * Two documents differing only in key order or in whitespace state one
 * configuration. A rule id derived from the text of one must agree with a rule
 * id derived from the text of the other, and a producer in another language
 * emits its keys in whatever order its serializer chose.
 *
 * Array order is preserved. `in: ['a', 'b']` and `in: ['b', 'a']` test the same
 * membership, and sorting them here would claim a semantic equality this
 * function does not generally have. A document that reorders a list is a
 * document somebody edited.
 *
 * `undefined` properties are dropped, so an absent key and a key written as
 * `undefined` agree. A JSON document carries no `undefined`, and a document
 * built in memory can.
 *
 * Every input type gets its own branch, so the return type is `string` for
 * all of them, not only the ones `JSON.stringify` happens to serialize.
 * `JSON.stringify` returns `undefined` for `undefined`, a function or a
 * symbol, and throws for a `bigint`; a caller trusting the declared `string`
 * return type would fail past the type checker on any of the four.
 *
 * A `bigint` is written as its digits with a trailing `n`, `10n` for
 * `BigInt(10)`. `evaluateCondition` compares with `===`, and `10n === 10n` is
 * true while `10n === 10` is false, so a config authoring `10n` and one
 * authoring `10` must not canonicalize to the same text. `JSON.stringify`
 * never emits a bare number followed by `n`, so the tag cannot collide with
 * any number this function writes.
 *
 * A function or a symbol is written from its own `toString()`. Neither
 * carries a content-addressable value the way a plain object does -- two
 * functions with the same source at different addresses are, for this
 * purpose, the same text, which is a reasonable identity for a condition
 * value nobody expects to compare structurally in the first place.
 */
export function canonical(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'function') return `function:${value.toString()}`;
  if (typeof value === 'symbol') return `symbol:${value.toString()}`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, each]) => each !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, each]) => `${JSON.stringify(key)}:${canonical(each)}`).join(',')}}`;
}
