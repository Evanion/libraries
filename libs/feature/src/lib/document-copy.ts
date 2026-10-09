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
 * How far along `rules[i].when[j]` the walk has come.
 *
 * `root` is the value `documentCopy` was handed, `rules` is that value's
 * `rules` member, `rule` is an element of it, `when` is that element's `when`
 * member and `condition` is an element of it. `off` is every other position,
 * and a walk that reaches `off` stays there, so a condition's own members are
 * `off` and an object nested under one is no condition itself.
 *
 * The walk carries the place rather than matching the pointer it built, because
 * the memo in `walk` is keyed on it. A pattern over the pointer answers for the
 * object the walk stands at and says nothing about the place a second pointer
 * reached the same object at.
 */
type Place = 'root' | 'rules' | 'rule' | 'when' | 'condition' | 'off';

/** The place a named member of an object standing at `place` sits at. */
function memberPlace(place: Place, name: string): Place {
  if (place === 'root' && name === 'rules') return 'rules';
  if (place === 'rule' && name === 'when') return 'when';
  return 'off';
}

/**
 * The place an element of an array standing at `place` sits at.
 *
 * An array element is the only step that advances the chain, so `rules` and
 * `when` both have to be arrays for a condition to be reached. `types.ts`
 * declares `Rule[]` and `Condition[]`, and `validateConditions` at
 * `conditions.ts:97` reads both as arrays, so the members of the object
 * `JSON.parse` hands back for `{"rules":{"0":...}}` are no rules and a `Date`
 * under one is refused.
 */
function elementPlace(place: Place): Place {
  if (place === 'rules') return 'rule';
  if (place === 'when') return 'condition';
  return 'off';
}

/**
 * Whether the object at this place is the condition § 8 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` lets a `Date` reach.
 *
 * That section keeps `Instant` on `FeatureDefinition` with its `Date` member,
 * "because `new Date('2026-10-01')` in a literal is what an author writes and
 * `conditions.ts` already handles it", and `types.ts:22` types the member
 * `string | number | Date`. `toEpoch` reads a `Date` and an ISO string to one
 * epoch, so the two forms decide `before` and `after` alike, and
 * `serializeConfig` converts the `Date` to its ISO string on the way out.
 *
 * The place decides as much as the operator does. `serializeConfig` reaches a
 * condition through `documentRule` at `serialize.ts:193`, so
 * `/rules/<i>/when/<j>/value` is the one pointer whose `Date` it converts, and
 * `serialized` at `serialize.ts:89` refuses a `Date` at every other pointer and
 * names it. A `Date` this walk kept at any other pointer builds a store
 * `serializeConfig` then refuses, naming that pointer: a variant value spelled
 * `{ op: 'after', value: <Date> }` is no condition, and the plain `Date` at the
 * same variant value is refused here already.
 *
 * The two construction paths and `unreadable`'s attribution loop each hand this
 * walk one `FeatureDefinition`, and `envelopeOf` hands it the document's own
 * members with `features` deleted, so a condition a rule holds is what reaches
 * the place above.
 *
 * The gate reads no `field`. `WindowCondition` declares `field: 'now'`, and
 * `validateConditions` at `conditions.ts:111`, `ruleId` at `rule-id.ts:57` and
 * `documentCondition` at `serialize.ts:181` each read the operator and none of
 * them reads the field, so a condition whose field is another string is a
 * window to every reader in the library and is one here too.
 */
function boundary(value: object, place: Place): boolean {
  if (place !== 'condition') return false;
  const op = (value as { op?: unknown }).op;
  return op === 'before' || op === 'after';
}

/** What the walk has written, one map per place a value can stand at. */
type Written = Record<Place, Map<object, unknown>>;

/** The six maps a walk starts with. */
function written(): Written {
  return {
    root: new Map<object, unknown>(),
    rules: new Map<object, unknown>(),
    rule: new Map<object, unknown>(),
    when: new Map<object, unknown>(),
    condition: new Map<object, unknown>(),
    off: new Map<object, unknown>(),
  };
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
 * One level of the copy, with the pointer and the place it reached and the
 * walk's two memos.
 *
 * `open` holds the chain this call sits under and `done` holds what the walk has
 * already written, which are two different questions. A value holding itself is
 * in `open` and the refusal names the pointer the walk closed at. A value two
 * pointers reach is written once and the second pointer reads `done`: a diamond
 * 26 levels deep holds 53 objects and fans out to 2^26 copies without the memo,
 * and `canonical` at `canonical.ts:58` and `serialized` at `serialize.ts:134`
 * memoize the same graph for the same reason. `structuredClone` preserves the
 * sharing and `deepFreeze` memoizes over it, so this copier agrees with the
 * three readers around it and the store holds one object where the caller held
 * one.
 *
 * `done` is keyed on the place as well as the object, because `boundary` reads
 * the place. One condition object a definition holds at `rules[0].when[0]` and
 * again at `variants[0].value` is two copies: the first keeps its `Date` and
 * the second is refused, which is what § 8 decides for each of those two
 * pointers. A single memo over both would hand the second pointer the copy the
 * first one wrote, and the order the definition lists `rules` and `variants` in
 * would then decide whether the whole definition is refused. Within one place
 * the copy is the same whichever pointer reached the object, so the memo still
 * collapses the diamond.
 *
 * Each member is written with `Object.defineProperty`, because a document
 * carrying a member named `__proto__` hands `JSON.parse` an own member and an
 * assignment through it would set the copy's prototype.
 *
 * The array branch writes into an array literal and not into what `held.map`
 * returns. `Array.prototype.map` constructs its result through
 * ArraySpeciesCreate, so it hands back an instance of an author's `Array`
 * subclass and hands back no array at all for a source whose
 * `constructor[Symbol.species]` returns something else. `carried` below never
 * sees either, because `Array.isArray` accepted the source first, so the
 * prototype of an array is replaced here rather than refused there, which is
 * what `structuredClone` does with both. Setting `length` and skipping an index
 * the source does not hold keeps a hole in a sparse array a hole, which is what
 * `structuredClone` does too and what `map` did.
 *
 * The recursion is one frame per level. A value nested deeper than the stack
 * holds raises the host's `RangeError` out of here, which `unreadableText`
 * carries the way it carries `structuredClone`'s.
 */
function walk(
  value: unknown,
  at: string,
  place: Place,
  open: WeakSet<object>,
  done: Written,
): unknown {
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
  if (open.has(held)) throw refuse(at, 'cycle');
  const kept = done[place];
  if (kept.has(held)) return kept.get(held);
  open.add(held);
  try {
    if (Array.isArray(held)) {
      const source = held as readonly unknown[];
      const inside = elementPlace(place);
      const elements: unknown[] = [];
      elements.length = source.length;
      for (let index = 0; index < source.length; index += 1) {
        if (!(index in source)) continue;
        elements[index] = walk(
          source[index],
          `${at}/${String(index)}`,
          inside,
          open,
          done,
        );
      }
      kept.set(held, elements);
      return elements;
    }
    if (!carried(held)) throw refuse(at, named(held));

    const copy: Record<string, unknown> = {};
    const window = boundary(held, place);
    for (const [member, element] of Object.entries(held)) {
      const pointer = `${at}/${escaped(member)}`;
      Object.defineProperty(copy, member, {
        value:
          window && member === 'value' && element instanceof Date
            ? new Date(element.getTime())
            : walk(element, pointer, memberPlace(place, member), open, done),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    kept.set(held, copy);
    return copy;
  } finally {
    open.delete(held);
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
 * JSON a publisher served. `boundary` above is the one pointer where those two
 * disagree: § 8 of `docs/specs/2026-09-23-feature-config-distribution.md` decides
 * a `WindowCondition.value` keeps its `Date`, and a literal whose rule opens a
 * window builds a store on every host because of it.
 */
export function documentCopy<T>(value: T): T {
  return walk(value, '', 'root', new WeakSet<object>(), written()) as T;
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
