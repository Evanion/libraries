import { decide, planFeature } from './evaluate.js';
import { buildGraph } from './graph.js';
import { validateVariants } from './variants.js';
import { createEmitter } from './observe.js';
import type { FeatureEvent, FeatureOptions } from './observe.js';
import type {
  Decision,
  Decisions,
  EvaluationContext,
  FeatureDefinition,
  FeatureKey,
  InferSchema,
  Plan,
  PlanEntry,
  ToggleResult,
  VariantInfo,
} from './types.js';

/**
 * The store. It holds intent -- `enabled`, dependencies and rules -- and nothing
 * evaluated.
 *
 * The only writers are `toggle` and editing the configuration. `resolve` and
 * `plan` are pure functions of `(config, context, now)`. Writing a resolved
 * value back would put entries in an audit log that nobody performed, make the
 * store disagree between a process that slept through a window boundary and one
 * that did not, and destroy the distinction between "someone turned this off"
 * and "the system turned it off" -- the one an operator needs at 3am.
 */
export interface Features<S extends Record<keyof S, VariantInfo | never>> {
  /** Every key, in the order the definitions were supplied. */
  readonly keys: readonly (keyof S & FeatureKey)[];
  /** The stored intent, deeply frozen, in the order it was supplied. */
  readonly config: readonly FeatureDefinition<keyof S & FeatureKey>[];
  definition(
    key: keyof S & FeatureKey,
  ): FeatureDefinition<keyof S & FeatureKey> | undefined;
  /** Transitive dependants of `key`, in dependency order. */
  dependants(key: keyof S & FeatureKey): readonly (keyof S & FeatureKey)[];
  /** Resolves every feature for one context. Writes nothing. */
  resolve(context?: EvaluationContext): Decisions<S>;
  isEnabled(key: keyof S & FeatureKey, context?: EvaluationContext): boolean;
  /**
   * The assigned variant, or `undefined` for a feature that resolved off.
   *
   * The type comes off `Decisions<S>[K]`, so a reader of `variantOf` sees what
   * the decision for that key carries and the two cannot drift apart. A feature
   * declaring no variants needs no guard here: `DecisionOf` drops `variant` for
   * that case, `infer V` off an absent optional property answers `never`, and
   * `never | undefined` is `undefined`.
   */
  variantOf<K extends keyof S>(
    key: K,
    context?: EvaluationContext,
  ): Decisions<S>[K] extends { variant?: infer V } ? V | undefined : undefined;
  /** The assigned variant's configured value, when it declares one. */
  valueOf<K extends keyof S>(
    key: K,
    context?: EvaluationContext,
  ): Decisions<S>[K] extends { value?: infer T } ? T | undefined : undefined;
  /**
   * Partitions every feature into resolvable now and deferred, for build-time
   * evaluation. One engine, not a second code path: the resolvable cases go
   * through the same `decide` as `resolve`.
   */
  plan(context?: EvaluationContext): Plan<S>;
  /**
   * Writes intent, and reports which dependants go off with it.
   *
   * Dependencies cascade one way only, so there is no upward blocking -- but the
   * information that blocking existed to provide is kept: a UI can confirm
   * before applying, a script can ignore it.
   */
  toggle(
    key: keyof S & FeatureKey,
    enabled: boolean,
    context?: EvaluationContext,
  ): ToggleResult<keyof S & FeatureKey>;
}

/**
 * The configuration `createFeatures` takes: one definition per feature, keyed on
 * `K`.
 *
 * Name this type in a `satisfies` clause, not in an annotation. `const
 * definitions = [...] as const satisfies Definitions<K>` checks the literal
 * against this type and leaves the variable the literal's own type, so the
 * inferring overload reads the variant names off it. The annotation `const
 * definitions: Definitions<K> = [...]` gives the variable this type itself, and
 * this type declares `variants` optionally, so `InferSchema` reads no names off
 * it and `variantOf` widens to `string | undefined`. A caller who wants the
 * union back either moves to `satisfies` or names a schema, which the second
 * overload narrows for them.
 */
export type Definitions<K extends FeatureKey = FeatureKey> =
  readonly FeatureDefinition<K>[];

/**
 * A schema in the form a generic accepts.
 *
 * `Features` constrains its parameter self-referentially. The compiler cannot
 * prove that `InferSchema<D>` satisfies that constraint before a call resolves:
 * `InferSchema` remaps its keys, and `D` is a bare type parameter. This copy
 * tests every entry against `VariantInfo`, which is the test the constraint
 * applies, and the constraint then holds. Each entry keeps the type it had,
 * including the `never` that a feature declaring no variants maps to.
 */
export type AsSchema<T> = {
  [K in keyof T]: T[K] extends VariantInfo ? T[K] : never;
};

/**
 * The context field an event reads its subject identifier off when the
 * application names none. It is the field the engine already buckets on.
 */
const DEFAULT_CORRELATE_FIELD = 'targetingKey';

/**
 * A context whose instant the engine has settled.
 *
 * `withNow` fills `now` once per entry point call, and every resolution and
 * every event downstream of that call reads the instant off this type. A
 * function taking this type cannot be handed a context whose clock nobody read.
 */
type SettledContext = EvaluationContext & { now: Date };

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

/**
 * Creates a feature store from its configuration.
 *
 * The dependency graph is validated here rather than at evaluation: a cycle, a
 * dependency on a feature that does not exist and a duplicate key are all
 * configuration errors, and a cycle has no defined resolution order at all, so
 * there is nothing sensible for `resolve` to return for one. Variants are
 * validated here for the same reason: a set with two names cannot answer which
 * one a pin meant, and a set with no usable band has nothing to assign into.
 *
 * There are two ways to type the store. A call that passes an array literal
 * needs no type argument: the definitions supply the keys, the variant names
 * and each variant's value. A call whose configuration arrived as JSON, or sits
 * in a variable annotated `Definitions<K>`, has no literals for the compiler to
 * read, so the inferring overload widens every variant of such a definition to
 * `string`. A caller who wants the union back names a schema:
 * `createFeatures<MyFlags>(config)`. That form checks every definition's key
 * against `keyof MyFlags`, so a configuration that names a feature the schema
 * does not declare is an error at the call.
 *
 * @throws {FeatureCycleError} when `dependsOn` closes a loop.
 * @throws {UnknownDependencyError} when `dependsOn` names an unconfigured key.
 * @throws {DuplicateFeatureError} when two definitions share a key.
 * @throws {DuplicateVariantError} when two of a feature's variants share a name.
 * @throws {UnknownVariantError} when a rule pins a variant its feature does not declare.
 * @throws {FeatureConfigError} when a variant's weight or order is unusable, the
 * variants array is empty, or the weights have no usable total.
 *
 * @example
 * ```ts
 * const features = createFeatures([
 *   { key: 'checkout', enabled: true },
 *   { key: 'express-checkout', enabled: true, dependsOn: ['checkout'] },
 * ]);
 *
 * features.isEnabled('express-checkout'); // true
 * features.toggle('checkout', false).willDisable; // ['express-checkout']
 * ```
 */
export function createFeatures<const D extends Definitions>(
  definitions: D,
  options?: FeatureOptions<AsSchema<InferSchema<D>>>,
): Features<AsSchema<InferSchema<D>>>;
/**
 * Builds the store over a schema the caller names. Every definition's key is
 * checked against `keyof S`.
 *
 * `NoInfer` is what makes the check happen. Without it the compiler infers `S`
 * backwards out of the argument, fills every entry with `any`, and a definition
 * naming a key the schema never declared passes.
 */
export function createFeatures<S extends Record<keyof S, VariantInfo | never>>(
  definitions: readonly FeatureDefinition<
    NoInfer<Extract<keyof S, FeatureKey>>
  >[],
  options?: FeatureOptions<S>,
): Features<S>;
export function createFeatures(
  definitions: readonly FeatureDefinition<FeatureKey>[],
  options: FeatureOptions<Record<FeatureKey, VariantInfo>> = {},
): Features<Record<FeatureKey, VariantInfo>> {
  // Cloned so the store cannot be edited behind its own back, then frozen so an
  // attempt to do so fails loudly instead of silently diverging from what was
  // resolved.
  const config: FeatureDefinition<FeatureKey>[] = definitions.map(
    (definition) => deepFreeze(structuredClone(definition)),
  );
  for (const definition of config) validateVariants(definition);
  const graph = buildGraph(config);
  const index = new Map<FeatureKey, number>(config.map((d, i) => [d.key, i]));
  const keys = config.map((definition) => definition.key);

  const definitionOf = (
    key: FeatureKey,
  ): FeatureDefinition<FeatureKey> | undefined => {
    const at = index.get(key);
    return at === undefined ? undefined : config[at];
  };

  const emit = createEmitter(options);
  const observed = options.observe !== undefined;
  const correlateBy = options.correlateBy ?? DEFAULT_CORRELATE_FIELD;

  /**
   * Freezes what an entry point emits and returns, when an application
   * installed an observer.
   *
   * An entry point emits the same object it answers with, so a write inside an
   * observer would change what the application acts on. A frozen object refuses
   * that write. A store with nobody observing hands the object to nobody else,
   * so it pays no freezing cost.
   */
  const frozenWhenObserved = <T>(value: T): T =>
    observed ? deepFreeze(value) : value;

  const withNow = (context: EvaluationContext = {}): SettledContext => ({
    ...context,
    now: context.now ?? new Date(),
  });

  /**
   * Reads the subject identifier an event carries.
   *
   * The engine copies the value out of the correlation field when it is a
   * string or a number, and carries nothing for a value of any other type. A
   * primitive copy holds no reference into the caller's context, so an observer
   * that writes to `event.subject` writes to its own event object.
   */
  const subjectOf = (
    context: EvaluationContext,
  ): string | number | undefined => {
    const value = context[correlateBy];
    if (typeof value === 'string' || typeof value === 'number') return value;
    return undefined;
  };

  /**
   * The members every event carries, whatever entry point reports it.
   *
   * `at` copies the settled context's instant, so an event names the instant its
   * own decisions resolved under and the engine reads the clock once per call.
   * The copy holds no handle on a `Date` the caller still owns, so an observer
   * that calls `setTime` on `event.at` moves its own copy and nothing else.
   */
  const envelope = (context: SettledContext) => {
    const subject = subjectOf(context);
    return {
      at: new Date(context.now),
      ...(subject === undefined ? {} : { subject }),
      ...(options.version === undefined ? {} : { version: options.version }),
    };
  };

  // The internal resolution. It reports nothing, and every public entry point
  // that needs a resolved set wraps it and emits its own event. `isEnabled`
  // asked about one feature, so the resolution it runs to answer that stays
  // silent and `isEnabled` reports the one decision the caller received.
  //
  // The body's own view of a resolved set: one loose `Decision` per key. The
  // public `resolve` casts this to the schema-mapped form once, and the two
  // readers take their fields off it, where every `Decision` field is present.
  const resolveAll = (
    context: SettledContext,
  ): Record<FeatureKey, Decision<FeatureKey>> => {
    const resolved = new Map<FeatureKey, Decision<FeatureKey>>();

    // `graph.order`, not `keys`: see FeatureGraph.order for why the cascade
    // needs it.
    for (const key of graph.order) {
      const definition = definitionOf(key);
      if (!definition) continue;
      resolved.set(key, decide(definition, context, resolved));
    }

    // A record cannot be built incrementally without a cast; the keys are
    // exactly `keys`, which the definitions supplied.
    return Object.fromEntries(resolved) as Record<
      FeatureKey,
      Decision<FeatureKey>
    >;
  };

  const plan = (
    context?: EvaluationContext,
  ): Plan<Record<FeatureKey, VariantInfo>> => {
    const evaluationContext = withNow(context);
    const plans = new Map<FeatureKey, PlanEntry<FeatureKey>>();
    const resolved = new Map<FeatureKey, Decision<FeatureKey>>();

    for (const key of graph.order) {
      const definition = definitionOf(key);
      if (!definition) continue;
      const entry = planFeature(definition, evaluationContext, plans, resolved);
      plans.set(key, entry);
      if (entry.decision) resolved.set(key, entry.decision);
    }

    return Object.fromEntries(plans) as Plan<Record<FeatureKey, VariantInfo>>;
  };

  const toggle = (
    key: FeatureKey,
    enabled: boolean,
    context?: EvaluationContext,
  ): ToggleResult<FeatureKey> => {
    const at = index.get(key);
    const current = at === undefined ? undefined : config[at];
    if (at === undefined || !current) {
      return { ok: false, key, error: 'unknown-feature' };
    }

    // One context for both sides of the comparison, so `willDisable` is not an
    // artefact of the clock moving between the two evaluations.
    const evaluationContext = withNow(context);
    const before = resolveAll(evaluationContext);

    config[at] = deepFreeze({ ...current, enabled });

    const after = resolveAll(evaluationContext);
    const willDisable = graph
      .dependants(key)
      .filter(
        (dependant) =>
          (before[dependant]?.enabled ?? false) &&
          !(after[dependant]?.enabled ?? false),
      );

    return { ok: true, key, enabled, willDisable };
  };

  return {
    keys,
    get config() {
      return config as readonly FeatureDefinition<FeatureKey>[];
    },
    definition: definitionOf,
    dependants: graph.dependants,
    // Every event is cast, for the same reason both readers below are. The
    // engine holds the loose record and the event type holds the schema-mapped
    // form, `FeatureKey` admits a number where a mapped key is a string, and
    // the decision an unknown key reads is `undefined`. A TypeScript caller
    // cannot name an unknown key, and `isEnabled` answers `false` for one.
    resolve: (context) => {
      const evaluationContext = withNow(context);
      const decisions = frozenWhenObserved(resolveAll(evaluationContext));

      emit({
        type: 'resolve',
        ...envelope(evaluationContext),
        decisions,
      } as FeatureEvent<Record<FeatureKey, VariantInfo>>);

      return decisions as Decisions<Record<FeatureKey, VariantInfo>>;
    },
    isEnabled: (key, context) => {
      const evaluationContext = withNow(context);
      const decision = frozenWhenObserved(resolveAll(evaluationContext))[key];
      // Read before the emit. `emit` calls a synchronous observer before it
      // returns, and the observer holds the same decision object this answer
      // comes off. The freeze refuses an observer's write, and this local
      // answers the caller whether or not the freeze is installed.
      const enabled = decision?.enabled ?? false;

      emit({
        type: 'is-enabled',
        ...envelope(evaluationContext),
        key,
        decision,
      } as FeatureEvent<Record<FeatureKey, VariantInfo>>);

      return enabled;
    },
    // Both returns are cast. A generic method whose return type is conditional
    // has no type an implementation can write: the compiler resolves neither
    // conditional for an unresolved `K`, and the runtime answer is the field
    // the decision carries either way.
    variantOf: (key, context) =>
      resolveAll(withNow(context))[key]?.variant as never,
    valueOf: (key, context) =>
      resolveAll(withNow(context))[key]?.value as never,
    plan,
    toggle,
  };
}
