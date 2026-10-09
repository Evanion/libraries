import { FeatureConfigError } from './errors.js';

/**
 * One reference token of a JSON pointer, escaped the way RFC 6901 reads it.
 *
 * `escaped` in `validate.ts` writes the same two replacements for the same
 * reason, and the order matters there for the reason it matters here: `~` is
 * replaced first, because replacing `/` first writes `~1` and the `~` pass
 * after it writes that as `~01`, which resolves to the literal text `~1`.
 */
function escaped(member: string): string {
  return member.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Whether this object is one a document carries.
 *
 * `JSON.parse` builds an object off `Object.prototype` and an array, and
 * nothing else. A `Date`, a `Map`, a `RegExp`, a typed array and an author's
 * own class each answer with another prototype, and the refusal below names the
 * constructor so a reader sees which one arrived. A null prototype is the
 * answer of an object an author built with `Object.create(null)`, whose members
 * are the members a document holds.
 */
function carried(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

/**
 * Whether this object is the condition § 8 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` lets a `Date` reach.
 *
 * That section keeps `Instant` on `FeatureDefinition` with its `Date` member,
 * "because `new Date('2026-10-01')` in a literal is what an author writes and
 * `conditions.ts` already handles it", and `types.ts:22` types the member
 * `string | number | Date`. `toEpoch` reads a `Date` and an ISO string to one
 * epoch, so the two forms decide `before` and `after` alike, and
 * `serializeConfig` converts the `Date` to its ISO string on the way out.
 *
 * `documentCondition` at `serialize.ts:179` reads the same two operators off
 * the same member for the same reason. Neither reader asks whether the object
 * around them is a `Condition`, so a variant value shaped `{ op: 'after', value:
 * <Date> }` carries its `Date` here. `structuredClone` carries that value too,
 * which is the answer this agreeing with it is worth more than a narrower test.
 */
function boundary(value: object): boolean {
  const op = (value as { op?: unknown }).op;
  return op === 'before' || op === 'after';
}

/** The constructor's name, for the refusal that names what arrived. */
function named(value: object): string {
  const name = (value as { constructor?: { name?: unknown } }).constructor
    ?.name;
  return typeof name === 'string' && name.length > 0 ? name : 'object';
}

/** The refusal `errors.ts` promises every reader of a supplied configuration. */
function refuse(at: string, noun: string): FeatureConfigError {
  return new FeatureConfigError(
    `"${at}" carries a ${noun}, and a document carries none`,
  );
}

/**
 * One level of the copy, with the pointer it reached and the walk's ancestors.
 *
 * The ancestors are the chain this call sits under and not every object the
 * walk has met, so a subtree two pointers share is copied twice and a value
 * holding itself is refused. A document is JSON and JSON states no sharing, so
 * the duplicate reproduces the bytes a publisher served; a cycle reaches no
 * document at all, and the refusal names the pointer the walk closed at.
 *
 * Each member is written with `Object.defineProperty`, because a document
 * carrying a member named `__proto__` hands `JSON.parse` an own member and an
 * assignment through it would set the copy's prototype.
 *
 * The recursion is one frame per level. A value nested deeper than the stack
 * holds raises the host's `RangeError` out of here, which `unreadableText`
 * carries the way it carries `structuredClone`'s.
 */
function walk(value: unknown, at: string, ancestors: WeakSet<object>): unknown {
  if (value === null) return null;
  const kind = typeof value;
  if (
    kind === 'string' ||
    kind === 'number' ||
    kind === 'boolean' ||
    kind === 'undefined'
  ) {
    return value;
  }
  if (kind !== 'object') throw refuse(at, kind);

  const held = value as object;
  if (ancestors.has(held)) throw refuse(at, 'cycle');
  ancestors.add(held);
  try {
    if (Array.isArray(held)) {
      return (held as readonly unknown[]).map((element, index) =>
        walk(element, `${at}/${String(index)}`, ancestors),
      );
    }
    if (!carried(held)) throw refuse(at, named(held));

    const copy: Record<string, unknown> = {};
    const window = boundary(held);
    for (const [member, element] of Object.entries(held)) {
      const pointer = `${at}/${escaped(member)}`;
      Object.defineProperty(copy, member, {
        value:
          window && member === 'value' && element instanceof Date
            ? new Date(element.getTime())
            : walk(element, pointer, ancestors),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return copy;
  } finally {
    ancestors.delete(held);
  }
}

/**
 * A copy of a configuration value, built from `JSON`-shaped members alone.
 * Raises `FeatureConfigError` naming the path for a member no document carries.
 *
 * § 8 of `docs/specs/2026-09-23-feature-config-distribution.md` runs a holder
 * on a native client embedding a JavaScript engine with no DOM, which provides
 * `JSON` and no `structuredClone`. The construction paths copy what a caller
 * supplied before they install it, so a host with no such global builds no
 * store at all without this walk.
 *
 * `JSON.parse(JSON.stringify(value))` is the shorter copy and it answers two
 * questions wrong. It loses the pointer a refusal has to name, and it turns a
 * `Date` into a string the engine then compares against an `Instant` it did not
 * receive. So the walk is explicit, and the path it carries is relative to the
 * value the caller handed over.
 *
 * `configCopier` hands this to the literal path as well as the document path, so
 * the value it walks is a `FeatureDefinition` an author wrote and not only the
 * JSON a publisher served. `boundary` above is the one member where those two
 * disagree: § 8 of `docs/specs/2026-09-23-feature-config-distribution.md` decides
 * a `WindowCondition.value` keeps its `Date`, and a literal whose rule opens a
 * window builds a store on every host because of it.
 */
export function documentCopy<T>(value: T): T {
  return walk(value, '', new WeakSet<object>()) as T;
}

/**
 * The copier a construction path runs on this host.
 *
 * One copier per host and not one per entry point. `features.spec.ts` holds
 * `createFeatures` and `reload` to the same text for the same bytes, and two
 * copiers over one document give two texts.
 *
 * `structuredClone` wherever the host defines it, which keeps every answer a
 * browser, Node and a worker already give: the diff `reload` reports reads a
 * `Date`, a `Set`, a `Map`, a `RegExp` and an `ArrayBuffer` off a variant value
 * that `documentCopy` refuses.
 */
export function configCopier(): <T>(value: T) => T {
  return typeof globalThis.structuredClone === 'function'
    ? globalThis.structuredClone
    : documentCopy;
}
