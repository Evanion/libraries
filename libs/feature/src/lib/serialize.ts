import { FeatureConfigError } from './errors.js';
import { DEFAULT_ROLLOUT_FIELD } from './fields.js';
import { bucketingPosition, variantSeedOf } from './variants.js';
import type { Features } from './features.js';
import type {
  ConfigEnvelope,
  FeatureConfig,
  SerializedDefinition,
} from './config.js';
import type {
  FeatureDefinition,
  FeatureKey,
  Rule,
  VariantInfo,
  VariantSpec,
} from './types.js';

/** The name a refusal calls a value by, read off the constructor it carries. */
function nameOf(value: object): string {
  const named = value as { readonly constructor?: { readonly name?: string } };
  return named.constructor?.name ?? 'value of that prototype';
}

/** `a` or `an`, so a refusal naming an `Error` reads as a sentence. */
function article(name: string): string {
  return /^[aeiou]/i.test(name) ? 'an' : 'a';
}

/**
 * JSON's own data model, through arrays and nested objects.
 *
 * What the walk admits is a string, a finite number, a boolean, `null`, an
 * array, and an object whose prototype is `Object.prototype` or `null`. Every
 * other leaf throws and names the path, because each one breaks § 8's two
 * promises without saying so.
 *
 * `undefined` properties drop, which is what `canonical.ts:46` does and what
 * keeps an absent key agreeing with a key written as `undefined`.
 *
 * A `Date` is one of the leaves this refuses, and `documentCondition` is the one
 * place a `Date` converts. `evaluateCondition` compares an
 * `AttributeCondition.value` with `===`, and `valueOf` hands a variant value to
 * the application untouched, so a `Date` in either member and the ISO string a
 * holder receives are two values that behave differently. `canonical` writes
 * both as one text, so § 2 reads the two digests as a proof that the two
 * processes hold one configuration while they resolve apart. `config.ts`'s
 * `JsonValue` states the rule for the condition value and this walk enforces it
 * for the whole definition.
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
 * tags a non-finite number at `canonical.ts:31-45`, so the publisher's text and
 * the holder's disagree and the holder refuses the whole document over a digest
 * mismatch that names no member. An `undefined` array element does the same:
 * `canonical` writes the text `undefined` where JSON writes `null`. A hole in a
 * sparse array is that element, materialized by `Array.from` so the walk meets
 * it. The refusal here names the path instead.
 *
 * A value that holds itself reaches this walk as well. JSON carries no cycle,
 * so this throws and names the path. `open` holds the path the walk stands on
 * and `done` holds what the walk has already written, which are two different
 * questions. A value two paths reach is written once and the second path reads
 * the memo: a diamond 26 levels deep holds 53 objects and fans out to 2^26
 * copies without it, and that fanned-out copy is the document a control plane
 * would serve. `structuredClone` preserves the sharing and `deepFreeze`
 * memoizes the same way, so this pass agrees with the two beside it.
 *
 * `structuredClone` at `features.ts:391` carries every refused leaf into the
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
  done: Map<object, unknown>,
): unknown {
  if (value instanceof Date) {
    throw new FeatureConfigError(
      `the value at ${path} is a Date, and a document carries an instant as an ISO 8601 string or as epoch milliseconds`,
    );
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
        `the value at ${path} is ${article(name)} ${name}, and JSON carries no ${name}`,
      );
    }
  }
  if (open.has(value)) {
    throw new FeatureConfigError(
      `the value at ${path} holds itself, and JSON carries no cycle`,
    );
  }
  if (done.has(value)) return done.get(value);
  open.add(value);
  const written = array
    ? Array.from(value as readonly unknown[], (each, at) =>
        serialized(each, `${path}/${String(at)}`, open, done),
      )
    : Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, each]) => each !== undefined)
          .map(([key, each]) => [
            key,
            serialized(each, `${path}/${key}`, open, done),
          ]),
      );
  open.delete(value);
  done.set(value, written);
  return written;
}

/**
 * One condition as the document carries it.
 *
 * A `WindowCondition.value` is the one member of a definition a `Date` reaches
 * legally, and decision 12 has it travel as an ISO string. The two forms decide
 * the window alike, because `toEpoch` at `conditions.ts:18-22` reads both to one
 * epoch, so the publisher holding the `Date` and the holder holding the string
 * answer `before` and `after` the same way. A value that already round-trips
 * travels as the store holds it, which is the second call § 8 names for this
 * entry point: a control plane that built its store from rows serializes it to
 * serve it, and the document it serves equals the document it read.
 *
 * Every other condition value keeps its `Date` and `serialized` refuses it. The
 * operators there are `eq`, `ne`, `in`, `not-in` and `contains`, and
 * `evaluateCondition` runs each one over `===`, so the publisher comparing a
 * `Date` and the holder comparing the ISO string decide one rule two ways over
 * two documents that digest alike. An author who wants that comparison writes
 * the ISO string in the definition, and then the two processes hold one value.
 *
 * The parameter is `unknown` because `createFeatures` reads `dependsOn` and
 * `rule.variant` and reads no condition, and its inferring overload takes the
 * `any` that `JSON.parse` returns. A store a holder built from a served document
 * therefore carries whatever a control plane put at this position. This hands
 * every value it does not convert to `serialized`, which admits what JSON
 * carries and names the path to what it does not, and § 7 gives the shape itself
 * to `validateConfig`.
 */
function documentCondition(condition: unknown, path: string): unknown {
  if (typeof condition !== 'object' || condition === null) return condition;
  const op: unknown = (condition as { readonly op?: unknown }).op;
  if (op !== 'before' && op !== 'after') return condition;
  const value: unknown = (condition as { readonly value?: unknown }).value;
  if (!(value instanceof Date)) return condition;
  if (Number.isNaN(value.getTime())) {
    throw new FeatureConfigError(
      `the Date at ${path}/value names no instant, and JSON carries no invalid Date`,
    );
  }
  return { ...condition, value: value.toISOString() };
}

/**
 * One rule as the document carries it, with its `id` and its rollout untouched.
 *
 * A `when` that is no array reaches `serialized` whole, for the reason
 * `documentCondition` states: nothing between `JSON.parse` and here reads a
 * rule's conditions, so a foreign document decides this value's shape.
 */
function documentRule(rule: Rule, path: string): unknown {
  const when: unknown = rule.when;
  if (!Array.isArray(when)) return rule;
  return {
    ...rule,
    when: (when as readonly unknown[]).map((condition, at) =>
      documentCondition(condition, `${path}/when/${String(at)}`),
    ),
  };
}

/**
 * Every variant with an explicit `order`, in the array order the store holds.
 *
 * `validateVariants` refuses a partial declaration, so either every variant
 * carries an order or none does, and `bucketingPosition` supplies the walk
 * position when none does. A control plane rebuilding this feature from rows
 * with no `ORDER BY` then hands the variants back permuted and assigns
 * identically, which is what decision 11 of the variants spec asks the envelope
 * to carry.
 */
function ordered(variants: readonly VariantSpec[]): readonly VariantSpec[] {
  return variants.map((variant, at) => ({
    ...variant,
    order: bucketingPosition(variant, at),
  }));
}

/**
 * One definition as the document carries it, before the walk writes its leaves.
 *
 * It materializes the three bucketing parameters a store leaves implicit. § 3
 * names four members that travel whole or the document is refused: a variant
 * `weight`, which `VariantSpec` requires of every author, and
 * `VariantSpec.order`, `variantBy` and `variantSeed`, which a definition may
 * leave out. A holder meeting one of those three absent fills it from
 * `bucketingPosition`, from `DEFAULT_ROLLOUT_FIELD` and from `variantSeedOf`,
 * and § 3 is written against exactly that: a holder that fills the gap with a
 * default computes a different assignment and reports nothing while it does.
 * Two of the three derive from members the document carries, so a holder today
 * agrees with the publisher, and a document that states the assignment holds
 * against two changes it otherwise would not. A Swift or Kotlin implementation
 * reads the three values off the cross-process fixture rather than out of this
 * source, and a release that moves `DEFAULT_ROLLOUT_FIELD` or the `:variant`
 * suffix reassigns nobody holding a document written before it.
 *
 * `seed`, `rollout.by` and `rollout.seed` stay as the store holds them, and
 * `rule-id.ts:68-72` is the reason. `ruleId` derives a rule's name from
 * `canonical({ by, seed })` for a rule that declares no `id`, so a serializer
 * writing either rollout member's default renames every derived rule in the
 * document and orphans every event already attached to it, which is the failure
 * § 2 puts the id mechanism in place to prevent.
 *
 * `rollout.seed` reaches its default from `seed` or from `key`, and the document
 * carries both, so a holder derives the seed the publisher derived. `rollout.by`
 * has no such member: `rolloutField` at `evaluate.ts:20-22` falls to
 * `DEFAULT_ROLLOUT_FIELD`, a constant in `fields.ts`, so a holder on a release
 * that moved it buckets a rollout on another context field while `configDigest`
 * reports one version on both sides. Decision 6 names `order`, a variant
 * `weight`, `variantSeed` and `variantBy`, and it leaves this member open.
 */
function documentDefinition<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  path: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = { ...definition };

  const rules = definition.rules;
  if (rules) {
    body['rules'] = rules.map((rule, at) =>
      documentRule(rule, `${path}/rules/${String(at)}`),
    );
  }

  const variants = definition.variants;
  if (variants) {
    body['variants'] = ordered(variants);
    body['variantBy'] = definition.variantBy ?? DEFAULT_ROLLOUT_FIELD;
    body['variantSeed'] = variantSeedOf(definition);
  }

  return body;
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
 * The envelope goes through the same walk as the definitions. `maxStale` and
 * `version` are declared `number` and `string | number`, so `Infinity` and `NaN`
 * sit at both in-type, and `schema` is an open `Record<string, unknown>` at each
 * `ValueShape`. A document emitting one of those carries `null` to its holder
 * while the publisher still holds the number, and no later check finds the
 * difference: `configDigest` reads `canonicalDocument`, which writes a
 * non-finite number the way JSON carries it, so the publisher's digest and the
 * holder's agree over two values that disagree. The walk refuses it here and
 * names the member, at `/maxStale`.
 *
 * @throws {FeatureConfigError} when a value holds itself, or when a leaf JSON
 * cannot carry reaches the walk. A `Date` outside a window condition is one of
 * those leaves, and a non-finite `maxStale` is another. The message names the
 * path to it.
 */
export function serializeConfig<S extends Record<keyof S, VariantInfo | never>>(
  features: Features<S, boolean>,
  envelope: ConfigEnvelope = {},
): FeatureConfig<keyof S & FeatureKey> {
  const around = serialized(
    envelope,
    '',
    new WeakSet<object>(),
    new Map<object, unknown>(),
  ) as ConfigEnvelope;

  const written = features.config.map((definition, at) => {
    const path = `/features/${String(at)}`;
    const body = serialized(
      documentDefinition(definition, path),
      path,
      new WeakSet<object>(),
      new Map<object, unknown>(),
    );
    return body as SerializedDefinition<keyof S & FeatureKey>;
  });

  return { ...around, features: written };
}
