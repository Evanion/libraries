import { decide, planFeature } from './evaluate.js';
import { buildGraph } from './graph.js';
import { validateVariants } from './variants.js';
import { createEmitter } from './observe.js';
import type {
  FeatureEvent,
  FeatureOptions,
  FrozenWhenObserved,
  ObservedOptions,
} from './observe.js';
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
export interface Features<
  S extends Record<keyof S, VariantInfo | never>,
  Frozen extends boolean = boolean,
> {
  /** Every key, in the order the definitions were supplied. */
  readonly keys: readonly (keyof S & FeatureKey)[];
  /** The stored intent, deeply frozen, in the order it was supplied. */
  readonly config: readonly FeatureDefinition<keyof S & FeatureKey>[];
  definition(
    key: keyof S & FeatureKey,
  ): FeatureDefinition<keyof S & FeatureKey> | undefined;
  /** Transitive dependants of `key`, in dependency order. */
  dependants(key: keyof S & FeatureKey): readonly (keyof S & FeatureKey)[];
  /**
   * Resolves every feature for one context. Writes nothing.
   *
   * A store carrying an observer answers the deeply readonly form, because it
   * freezes the record before it emits it and hands the caller that same
   * object. A store carrying none answers the mutable form and freezes
   * nothing.
   */
  resolve(
    context?: EvaluationContext,
  ): FrozenWhenObserved<Frozen, Decisions<S>>;
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
  plan(context?: EvaluationContext): FrozenWhenObserved<Frozen, Plan<S>>;
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
  ): FrozenWhenObserved<Frozen, ToggleResult<keyof S & FeatureKey>>;
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

/**
 * The mutators a `Date` carries.
 *
 * Each one writes the instant in the internal slot, which `Object.freeze` does
 * not cover, and each one has a name starting with `set`. `ReadonlyDate` in
 * `observe.ts` removes the same set at the type level.
 */
const DATE_MUTATORS = Object.getOwnPropertyNames(Date.prototype).filter(
  (name) => name.startsWith('set'),
);

/** The mutators a `Map` carries. They write the internal entry list. */
const MAP_MUTATORS = ['set', 'delete', 'clear'];

/** The mutators a `Set` carries. They write the internal entry list. */
const SET_MUTATORS = ['add', 'delete', 'clear'];

/**
 * Replaces a built-in's mutators with own properties that throw, then the
 * caller freezes the object.
 *
 * `Object.freeze` locks an object's own properties and covers no internal slot.
 * A frozen `Date` still answers `setTime`, and a frozen `Map` still answers
 * `set`, because each of those methods lives on the prototype and writes
 * storage that no property describes. An own property shadows the prototype
 * method, and the freeze that follows makes the shadow permanent.
 *
 * The replacement throws a `TypeError`, which is what a write to a frozen
 * property throws under the strict mode every module runs in.
 */
function sealMutators(
  value: object,
  type: string,
  methods: readonly string[],
): void {
  for (const method of methods) {
    Object.defineProperty(value, method, {
      value: () => {
        throw new TypeError(
          `@evanion/feature: ${type}.${method} was called on a frozen value. The store hands out the object it holds, and a caller changes no outcome.`,
        );
      },
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
}

/**
 * Freezes a value and everything it holds.
 *
 * A `Date` keeps its instant in an internal slot, and a `Map` or a `Set` keeps
 * its entries in one, so this seals their mutators before the freeze. The store
 * clones its configuration once at construction and then hands the same objects
 * to every caller, so a variant value that a caller could still write would
 * corrupt the configuration every later caller reads.
 *
 * A value that is already frozen was sealed on the way there, so this returns
 * it untouched. That guard keeps {@link sealMutators} from redefining a
 * property it made non-configurable.
 *
 * The freeze happens after the walk, so an object that holds itself is still
 * unfrozen when the walk reaches it a second time. `walked` records every
 * object the walk entered, and a second visit returns at once. A variant value
 * that points back at itself survives `structuredClone`, so a configuration
 * carrying one reaches this function.
 */
function deepFreeze<T>(value: T, walked = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (walked.has(value)) return value;
  walked.add(value);
  if (value instanceof Date) {
    sealMutators(value, 'Date', DATE_MUTATORS);
    return Object.freeze(value);
  }
  if (value instanceof Map) {
    for (const [key, held] of value) {
      deepFreeze(key, walked);
      deepFreeze(held, walked);
    }
    sealMutators(value, 'Map', MAP_MUTATORS);
    return Object.freeze(value);
  }
  if (value instanceof Set) {
    for (const held of value) deepFreeze(held, walked);
    sealMutators(value, 'Set', SET_MUTATORS);
    return Object.freeze(value);
  }
  for (const nested of Object.values(value)) deepFreeze(nested, walked);
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
 * The options decide the return types. A call that passes an object literal
 * holding `observe` answers a store whose `resolve`, `plan` and `toggle` return
 * the deeply readonly form, because such a store freezes what it emits and
 * answers with that same object. A call that passes no observer answers the
 * mutable form. The inferring form reads that off the options type parameter
 * `O`, and the form that names a schema takes one signature per case, because
 * TypeScript infers no type argument once a caller supplies one and `O` would
 * come from its default. A caller who holds the options in a variable annotated
 * `FeatureOptions<S>` installs an observer the compiler cannot see, so that call
 * answers the mutable form and the freeze still happens at runtime.
 *
 * The signature count stops at three. TypeScript elaborates every candidate for
 * a failed call while a signature list holds three or fewer, and reports one
 * candidate against the argument nodes once the list holds more, which put the
 * error for a misspelled option on the definitions array.
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
/**
 * `O` carries the options a caller wrote at the call site, and the return type
 * reads `observe` off it. The `Record<Exclude<...>, never>` half of the
 * constraint is what keeps a misspelled option an error: a type parameter
 * inferred from an object literal takes the literal's own type, so the
 * compiler runs no excess property check against the constraint's first half.
 */
export function createFeatures<
  const D extends Definitions,
  O extends FeatureOptions<AsSchema<InferSchema<D>>> &
    Record<
      Exclude<keyof O, keyof FeatureOptions<AsSchema<InferSchema<D>>>>,
      never
    >,
>(
  definitions: D,
  options?: O,
): Features<
  AsSchema<InferSchema<D>>,
  O extends { observe: object } ? true : false
>;
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
  options: ObservedOptions<S>,
): Features<S, true>;
/** The same store over a named schema, built without an observer. */
export function createFeatures<S extends Record<keyof S, VariantInfo | never>>(
  definitions: readonly FeatureDefinition<
    NoInfer<Extract<keyof S, FeatureKey>>
  >[],
  options?: FeatureOptions<S>,
): Features<S, false>;
export function createFeatures(
  definitions: readonly FeatureDefinition<FeatureKey>[],
  given: object = {},
): Features<Record<FeatureKey, VariantInfo>, boolean> {
  // The three signatures above are what a caller sees, and this one is checked
  // against each of them with its type parameters erased. An erased
  // `ObservedOptions<S>` relates to no options type that declares `observe`,
  // so this parameter declares none and the body reads the options at the
  // erased schema.
  const options = given as FeatureOptions<Record<FeatureKey, VariantInfo>>;
  // Cloned so the store cannot be edited behind its own back, then frozen so an
  // attempt to do so fails loudly instead of silently diverging from what was
  // resolved. The freeze covers the array as well as each definition in it, and
  // `toggle` replaces the whole array on a write.
  let config: readonly FeatureDefinition<FeatureKey>[] = Object.freeze(
    definitions.map((definition) => deepFreeze(structuredClone(definition))),
  );
  for (const definition of config) validateVariants(definition);
  const graph = buildGraph(config);
  const index = new Map<FeatureKey, number>(config.map((d, i) => [d.key, i]));
  const keys: readonly FeatureKey[] = Object.freeze(
    config.map((definition) => definition.key),
  );

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
   * so it freezes nothing.
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

    const partition = frozenWhenObserved(
      Object.fromEntries(plans) as Plan<Record<FeatureKey, VariantInfo>>,
    );

    if (observed) {
      emit({
        type: 'plan',
        ...envelope(evaluationContext),
        plan: partition,
      } as FeatureEvent<Record<FeatureKey, VariantInfo>>);
    }

    return partition;
  };

  const toggle = (
    key: FeatureKey,
    enabled: boolean,
    context?: EvaluationContext,
  ): ToggleResult<FeatureKey> => {
    // One context for both sides of the comparison, so `willDisable` is not an
    // artefact of the clock moving between the two evaluations. The refused
    // write reads its instant off the same context.
    const evaluationContext = withNow(context);

    // Reports the write and answers the caller with the same object. An
    // auditor receives the refused write as well as the accepted one, so both
    // exits below go through here.
    const reported = (result: ToggleResult<FeatureKey>) => {
      const answer = frozenWhenObserved(result);

      if (observed) {
        emit({
          type: 'toggle',
          ...envelope(evaluationContext),
          result: answer,
        } as FeatureEvent<Record<FeatureKey, VariantInfo>>);
      }

      return answer;
    };

    const at = index.get(key);
    const current = at === undefined ? undefined : config[at];
    if (at === undefined || !current) {
      return reported({ ok: false, key, error: 'unknown-feature' });
    }

    // The two resolutions below go through `resolveAll`, which reports
    // nothing. An observer holding `before` could write `enabled` to `false`
    // on a dependant and `willDisable` would come back short, which is the
    // list an operator reads before pulling a kill switch. Both resolutions
    // still run.
    const before = resolveAll(evaluationContext);

    const next = [...config];
    next[at] = deepFreeze({ ...current, enabled });
    config = Object.freeze(next);

    const after = resolveAll(evaluationContext);
    const willDisable = graph
      .dependants(key)
      .filter(
        (dependant) =>
          (before[dependant]?.enabled ?? false) &&
          !(after[dependant]?.enabled ?? false),
      );

    return reported({ ok: true, key, enabled, willDisable });
  };

  return {
    keys,
    get config() {
      // This getter hands out the store's own array. `Object.freeze` covers
      // that array at construction and covers the new array `toggle` builds on
      // every write, so a push or a slot assignment through this getter throws
      // and `definition`, `resolve`, `plan` and `toggle` keep reading what the
      // store was configured with. Two reads between writes return the same
      // reference, so a caller can key a memo on it, and a read after a write
      // returns the array the store now holds.
      return config;
    },
    definition: definitionOf,
    dependants: graph.dependants,
    // Every event is cast. The engine holds the loose record of `Decision` and
    // the event type holds the schema-mapped `Decisions<S>`, and `FeatureKey`
    // admits a number where a mapped key is a string. The two readers below
    // are cast for an unrelated reason, which their own comment gives.
    //
    // Both emits sit behind `observed`. JavaScript evaluates an argument
    // before the call whatever the callee does, so an unguarded `emit` would
    // build an envelope and an event object that nothing reads.
    resolve: (context) => {
      const evaluationContext = withNow(context);
      const decisions = frozenWhenObserved(resolveAll(evaluationContext));

      if (observed) {
        emit({
          type: 'resolve',
          ...envelope(evaluationContext),
          decisions,
        } as FeatureEvent<Record<FeatureKey, VariantInfo>>);
      }

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

      // A key nobody configured resolves to no decision, and `FeatureEvent`
      // declares `decision` present on every `is-enabled` event. The engine
      // emits nothing for such a call, so no observer receives an event whose
      // own type says the missing member is there. The caller receives
      // `false`.
      if (observed && decision !== undefined) {
        emit({
          type: 'is-enabled',
          ...envelope(evaluationContext),
          key,
          decision,
        } as FeatureEvent<Record<FeatureKey, VariantInfo>>);
      }

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
