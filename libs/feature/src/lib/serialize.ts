import { FeatureConfigError } from './errors.js';
import type { Features } from './features.js';
import type {
  ConfigEnvelope,
  FeatureConfig,
  SerializedDefinition,
} from './config.js';
import type { FeatureKey, VariantInfo, VariantSpec } from './types.js';

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
 * A value that holds itself reaches this walk, because `structuredClone` at
 * `features.ts:391` carries a cycle through. JSON carries none, so this throws
 * and names the path. The store is the caller's own configuration, and
 * `errors.ts:3-11` already puts a configuration error at the call that supplied
 * it.
 */
function serialized(
  value: unknown,
  path: string,
  open: WeakSet<object>,
): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === null || typeof value !== 'object') return value;
  if (open.has(value)) {
    throw new FeatureConfigError(
      `the value at ${path} holds itself, and JSON carries no cycle`,
    );
  }
  open.add(value);
  const written = Array.isArray(value)
    ? value.map((each, at) => serialized(each, `${path}/${String(at)}`, open))
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
 * @throws {FeatureConfigError} when a variant value holds itself.
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
