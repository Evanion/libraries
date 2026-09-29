import { FeatureConfigError } from './errors.js';
import type { Features } from './features.js';
import type {
  ConfigEnvelope,
  FeatureConfig,
  SerializedDefinition,
} from './config.js';
import type { FeatureKey, VariantInfo, VariantSpec } from './types.js';

/** The name a refusal calls a value by, read off the constructor it carries. */
function nameOf(value: object): string {
  const named = value as { readonly constructor?: { readonly name?: string } };
  return named.constructor?.name ?? 'value of that prototype';
}

/**
 * Every `Date` written as its ISO string, through arrays and nested objects.
 *
 * A `Date` reaches three places in one definition. A `WindowCondition.value`
 * carries one because `Instant` admits it, an `AttributeCondition.value` is
 * `unknown` and carries whatever an author wrote, and a variant `value` is
 * arbitrary JSON the application renders. All three break a round trip the same
 * way, so this walks the whole definition and converts wherever it lands.
 *
 * `undefined` properties drop, which is what `canonical.ts:46` does and what
 * keeps an absent key agreeing with a key written as `undefined`.
 *
 * What the walk admits past that is JSON's own data model: a string, a finite
 * number, a boolean, `null`, an array, and an object whose prototype is
 * `Object.prototype` or `null`. Every other leaf throws and names the path,
 * because each one breaks § 8's two promises without saying so.
 *
 * A `Map`, a `Set` and a `RegExp` keep what they hold in internal slots, and an
 * `Error` keeps its message and its stack as non-enumerable members, so
 * `Object.entries` reads nothing off any of them and the document carries `{}`
 * while the store carries the payload. The publisher and the holder then digest
 * the same `{}` and agree on a document that lost it.
 *
 * The prototype rule is what refuses those four, and it refuses anything else
 * whose prototype JSON has no notion of. That costs nothing a caller wanted:
 * `SerializedVariantSpec.value` is `unknown` for the interfaces § 4's schemas
 * generate, a generator emits an interface over a plain object, and
 * `structuredClone` hands a class instance back as a plain object before the
 * walk ever sees it.
 *
 * A `bigint` reaches the document untouched and the publisher's own
 * `JSON.stringify` throws a `TypeError` naming no feature. `NaN`, `Infinity`
 * and `-Infinity` become `null` on the first transport hop, and `canonical`
 * routes a non-finite number through `JSON.stringify` too, so both sides digest
 * `null` and agree while the two stores hold different values. An `undefined`
 * array element does it the other way: `canonical` writes the text `undefined`
 * where JSON writes `null`, so the digests disagree and the holder refuses the
 * whole document. A hole in a sparse array is that element, materialized by
 * `Array.from` so the walk meets it. An invalid `Date` makes `toISOString`
 * raise a bare `RangeError` naming neither the path nor the feature, which is
 * the one JSON writes as `null`.
 *
 * A value that holds itself reaches this walk as well. JSON carries no cycle,
 * so this throws and names the path.
 *
 * `structuredClone` at `features.ts:391` carries every one of them into the
 * store and `deepFreeze` seals them, so every one of them reaches here. A
 * function and a symbol do not, because `structuredClone` raises
 * `DataCloneError` on both, and the branch that names a `bigint` names those
 * two for a store some other path builds. The store is the caller's own
 * configuration, and `errors.ts:3-11` already puts a configuration error at the
 * call that supplied it.
 */
function serialized(
  value: unknown,
  path: string,
  open: WeakSet<object>,
): unknown {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new FeatureConfigError(
        `the Date at ${path} names no instant, and JSON carries no invalid Date`,
      );
    }
    return value.toISOString();
  }
  if (value === null) return value;
  if (typeof value !== 'object') {
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) return value;
      throw new FeatureConfigError(
        `the number at ${path} is ${String(value)}, and JSON carries no non-finite number`,
      );
    }
    if (value === undefined) {
      throw new FeatureConfigError(
        `the element at ${path} is undefined, and JSON carries no undefined element`,
      );
    }
    throw new FeatureConfigError(
      `the value at ${path} is a ${typeof value}, and JSON carries no ${typeof value}`,
    );
  }
  const array = Array.isArray(value);
  if (!array) {
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      const name = nameOf(value);
      throw new FeatureConfigError(
        `the value at ${path} is a ${name}, and JSON carries no ${name}`,
      );
    }
  }
  if (open.has(value)) {
    throw new FeatureConfigError(
      `the value at ${path} holds itself, and JSON carries no cycle`,
    );
  }
  open.add(value);
  const written = array
    ? Array.from(value as readonly unknown[], (each, at) =>
        serialized(each, `${path}/${String(at)}`, open),
      )
    : Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, each]) => each !== undefined)
          .map(([key, each]) => [
            key,
            serialized(each, `${path}/${key}`, open),
          ]),
      );
  open.delete(value);
  return written;
}

/**
 * Every variant with an explicit `order`, in the array order the store holds.
 *
 * `validateVariants` refuses a partial declaration, so either every variant
 * carries an order or none does, and the array index is the walk position when
 * none does. A control plane rebuilding this feature from rows with no
 * `ORDER BY` then hands the variants back permuted and assigns identically,
 * which is what decision 11 of the variants spec asks the envelope to carry.
 */
function ordered(variants: readonly VariantSpec[]): readonly VariantSpec[] {
  return variants.map((variant, at) => ({
    ...variant,
    order: variant.order ?? at,
  }));
}

/**
 * The store's configuration as one document.
 *
 * It takes no mode. It writes every definition, every rule with the `id` its
 * author or its control plane gave it, and every variant with its name, weight,
 * order and value. A round trip back through `parseFeatureConfig` produces the
 * document it started from.
 *
 * The entry point earns its place twice. `configDigest` is defined over the
 * serialized form, so something has to produce that form from a live store, and
 * a control plane that built its store from rows serializes it to serve it.
 *
 * @throws {FeatureConfigError} when a value holds itself, or when a leaf JSON
 * cannot carry reaches the walk. The message names the path to it.
 */
export function serializeConfig<S extends Record<keyof S, VariantInfo | never>>(
  features: Features<S, boolean>,
  envelope: ConfigEnvelope = {},
): FeatureConfig<keyof S & FeatureKey> {
  const written = features.config.map((definition, at) => {
    const body = serialized(
      definition.variants
        ? { ...definition, variants: ordered(definition.variants) }
        : definition,
      `/features/${String(at)}`,
      new WeakSet<object>(),
    );
    return body as SerializedDefinition<keyof S & FeatureKey>;
  });

  return { ...envelope, features: written };
}
