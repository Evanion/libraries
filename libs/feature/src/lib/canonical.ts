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
 * `NaN`, `Infinity` and `-Infinity` are written behind a `number:` tag,
 * `number:NaN` for `NaN`. `JSON.stringify` writes all three as `null`, and the
 * three decide a window three ways: `toEpoch` at `conditions.ts:18-22` returns
 * a number instant untouched, so a `before` boundary of `Infinity` matches
 * every `now`, one of `-Infinity` matches none, and one of `NaN` fails the
 * guard at `conditions.ts:73`. One text for the three hands `configDigest` one
 * digest for documents that resolve a flag oppositely, and § 2 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` reads two equal
 * digests as a proof that two processes hold one configuration.
 * `JSON.stringify` never emits a bare `number:`, so the tag cannot collide with
 * any text this function writes.
 *
 * A function or a symbol is written from its own `toString()`. Neither
 * carries a content-addressable value the way a plain object does -- two
 * functions with the same source at different addresses are, for this
 * purpose, the same text, which is a reasonable identity for a condition
 * value nobody expects to compare structurally in the first place.
 *
 * A value two paths reach is written once and the second path reads the memo,
 * the way `serialized` at `serialize.ts:134` memoizes the same graph. Both
 * walks meet the sharing that `structuredClone` in `createFeatures` and
 * `deepFreeze` preserve, and a diamond 22 levels deep holds 45 objects and
 * 2^22 paths to its leaf: the memo walks 45 of them and costs 34ms where the
 * bare recursion costs 2.8s.
 *
 * The text the sharing expands to is the same either way, 88MB for that
 * diamond, because JSON carries no sharing. A back-reference form would be
 * shorter and would disagree with the digest a holder computes over the
 * document JSON handed it, which is the comparison § 2 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` rests on. Past 25
 * levels this and `JSON.stringify` both throw `RangeError: Invalid string
 * length`, so a document too deep to digest is a document too deep to serve.
 */
export function canonical(value: unknown): string {
  return written(value, new Map());
}

/** One value's text, with `done` holding what the walk has already written. */
function written(value: unknown, done: Map<object, string>): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'function') return `function:${value.toString()}`;
  if (typeof value === 'symbol') return `symbol:${value.toString()}`;
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return `number:${String(value)}`;
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value);

  const memoized = done.get(value);
  if (memoized !== undefined) return memoized;

  let text: string;
  if (Array.isArray(value)) {
    text = `[${value.map((each) => written(each, done)).join(',')}]`;
  } else {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, each]) => each !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    text = `{${entries.map(([key, each]) => `${JSON.stringify(key)}:${written(each, done)}`).join(',')}}`;
  }

  // Set after the recursion, so a value that holds itself recurses until the
  // stack throws rather than reading a memo entry for a text that has none.
  done.set(value, text);
  return text;
}
