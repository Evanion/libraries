import { validateConditions } from './conditions.js';
import { instantEpoch } from './instant.js';
import { decide, planFeature } from './evaluate.js';
import { buildGraph } from './graph.js';
import { bucketingStated } from './variants.js';
import type { FeatureGraph } from './graph.js';
import { collectIssues } from './validate.js';
import type { Checkable } from './validate.js';
import { unreadable, unreadableText } from './unreadable.js';
import { FeatureConfigError } from './errors.js';
import { createEmitter } from './observe.js';
import type {
  FeatureEvent,
  FeatureOptions,
  FrozenWhenObserved,
  UnobservedOptions,
} from './observe.js';
import type { ConfigEnvelope, FeatureConfig, ReloadResult } from './config.js';
import type { DecisionSet, SnapshotOptions } from './decision-set.js';
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
 *
 * Read this type off `createFeatures`, and name it in an annotation only where
 * a declaration demands one. `const store = createFeatures([...])` carries a
 * settled `Frozen`, and `resolve` then answers one form. The annotation `const
 * store: Features<Flags> = createFeatures([...])` leaves `Frozen` at its
 * `boolean` default, `resolve` answers the union of both forms, and that union
 * assigns to neither `Decisions<Flags>` nor `DeepReadonly<Decisions<Flags>>`,
 * because `DeepReadonly` maps the `Date` a rule outcome can carry to a
 * `ReadonlyDate`. A declaration that must name the type carries the second
 * parameter with it: `Features<Flags, false>` for a store built with no
 * observer, `Features<Flags, true>` for one built with an observer. A function
 * taking either store names both parameters and stays generic over `Frozen`.
 */
export interface Features<
  S extends Record<keyof S, VariantInfo | never>,
  Frozen extends boolean = boolean,
> {
  /** Every key, in the order the definitions were supplied. */
  readonly keys: readonly (keyof S & FeatureKey)[];
  /**
   * The installed document's version, lifted for convenience.
   *
   * `undefined` for a store built from a literal. A `toggle` leaves it alone: a
   * toggle is a local write against a store whose truth is elsewhere, and the
   * member names the document a publisher served, which is the document the
   * next poll compares against.
   */
  readonly version: string | number | undefined;
  /**
   * The installed document's envelope, without its payload.
   *
   * It carries no `digest`, which `configDigest` is the one writer of.
   * `serializeConfig` defaults to this envelope, and a caller re-serving a
   * document it toggled passes its own.
   *
   * It is a deeply frozen copy of the installed document's members, so a poller
   * that polls again onto the buffer it parsed moves neither what the store
   * reports it is holding nor what `serializeConfig` writes.
   */
  readonly envelope: ConfigEnvelope;
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
   * Every decision for one context, with the configuration version and the
   * instant that produced them.
   *
   * `resolve` answers the decisions alone, and a consumer in another process
   * cannot recover either member from them. A set states both, so a server
   * states the instant once and no application passes `now` by hand.
   *
   * It is the one entry point that refuses a context. `DecisionSet.now` is an
   * ISO 8601 string and an invalid `Date` describes no instant, so a
   * `context.now` holding one raises a `FeatureConfigError`. `resolve`, `plan`
   * and `toggle` carry that `Date` into the decision and stay total.
   */
  snapshot(
    context?: EvaluationContext,
    options?: SnapshotOptions,
  ): DecisionSet<S, Frozen>;
  /**
   * Writes intent, and reports which dependants go off with it.
   *
   * Dependencies cascade one way only, so there is no upward blocking -- but the
   * information that blocking existed to provide is kept: a UI can confirm
   * before applying, a script can ignore it.
   *
   * A reload discards this write. The store's truth is the configuration
   * source, and a toggle is a local write against it. An operator who wants a
   * durable toggle writes the row and lets the poller bring it back. A reload a
   * context getter runs inside this call is that same discard: the write goes
   * onto the document the store holds when it lands, and `unknown-feature`
   * answers a document that no longer declares the key.
   *
   * `version` and `envelope` keep naming the installed document, so a caller
   * that serves what it toggled passes `serializeConfig` an envelope of its
   * own rather than labelling its write with the publisher's version.
   */
  toggle(
    key: keyof S & FeatureKey,
    enabled: boolean,
    context?: EvaluationContext,
  ): FrozenWhenObserved<Frozen, ToggleResult<keyof S & FeatureKey>>;
  /**
   * Validates a candidate whole and installs it, or keeps the current document
   * and reports why.
   *
   * The refusal reports every issue the checker found and leaves every stored
   * reference where it was, so a store that refuses a candidate keeps
   * answering from the document it holds. The success names the keys whose
   * stored intent differs, and it names no key whose resolved answer moved
   * because the clock moved.
   */
  reload(config: FeatureConfig<keyof S & FeatureKey>): ReloadResult;
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
 * What `createFeatures` accepts: a bare array, or the document an envelope
 * carries.
 *
 * A literal has no version, no schema and no freshness claim, and an author
 * writing four flags in a file owes none of them. A process whose poller
 * already fetched a document hands that document over without unwrapping it.
 */
export type DefinitionsOrConfig<K extends FeatureKey = FeatureKey> =
  readonly FeatureDefinition<K>[] | FeatureConfig<K>;

/**
 * The definitions inside whichever form a caller passed.
 *
 * `InferSchema` reads variant names off a definitions array and constrains its
 * own parameter to one, so `InferSchema<D>` stops compiling the moment `D` may
 * be a document: `D extends DefinitionsOrConfig` fails that constraint. This
 * recovers the array, and every place the current signatures write
 * `InferSchema<D>` writes `InferSchema<DefinitionsOf<D>>` instead.
 */
export type DefinitionsOf<D> =
  D extends readonly FeatureDefinition<FeatureKey>[]
    ? D
    : D extends {
          features: infer F extends readonly FeatureDefinition<FeatureKey>[];
        }
      ? F
      : never;

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
 * Whether two stored definitions state the same intent.
 *
 * `canonical` would answer this in one line and recurses without a guard, and a
 * variant value that holds itself reaches this walk, because `structuredClone`
 * carries a cycle through. The pair map is what terminates: an object the walk
 * is already inside is equal exactly when its counterpart is the object it was
 * paired with.
 *
 * The map is scoped to the path, and the entry drops once the subtree compares
 * equal. A definition holding one object at two keys would otherwise pair it
 * with whatever sits at the first key and then refuse the structurally equal
 * object at the second, and `changed` would name a key nothing changed about.
 * Reference sharing is not part of the intent.
 *
 */
function sameIntent(
  a: unknown,
  b: unknown,
  seen = new Map<object, unknown>(),
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  // The prototype gate, before any walk over the keys. A `Date`, a `Set`, a
  // `Map`, a `RegExp` and an `ArrayBuffer` keep what they hold in internal
  // slots, so `Object.keys` reads nothing off any of them and a key walk alone
  // calls any two of them equal and calls each of them equal to `{}`.
  // `structuredClone` carries all of them into the store and
  // `VariantSpec.value` is `unknown`, so without this gate a candidate
  // installs a variant value the diff never looked at.
  const prototype: unknown = Object.getPrototypeOf(a);
  if (prototype !== Object.getPrototypeOf(b)) return false;

  if (a instanceof Date) return a.getTime() === (b as Date).getTime();
  if (a instanceof RegExp) {
    return a.source === (b as RegExp).source && a.flags === (b as RegExp).flags;
  }

  const paired = seen.get(a);
  if (paired !== undefined) return paired === b;
  seen.set(a, b);

  const equal = sameMembers(a, b, prototype, seen);
  seen.delete(a);
  return equal;
}

/**
 * Whether two objects of one prototype hold the same members.
 *
 * It runs with the pair already registered, so a `Set` that holds itself and a
 * property that points back at its own object both terminate in the pair map.
 *
 * A `Set` and a `Map` state their insertion order, `structuredClone` carries
 * it, and the application reads it back off the value `valueOf` hands over, so
 * two of them state one intent when their entries agree in the order they
 * iterate. A reordered set states a different one and `changed` names the key,
 * which is the answer a holder can act on.
 *
 * An object the walk above has no reading for -- an `ArrayBuffer`, a
 * `DataView`, an `Error` -- holds an intent this cannot compare, so it compares
 * equal to nothing and `changed` names its key on every reload.
 *
 * `undefined` properties are skipped, so an absent key and a key written as
 * `undefined` state one intent, which is the rule `canonical.ts:21-22` states
 * for the same reason.
 */
function sameMembers(
  a: object,
  b: object,
  prototype: unknown,
  seen: Map<object, unknown>,
): boolean {
  if (a instanceof Set)
    return sameIntent([...a], [...(b as Set<unknown>)], seen);
  if (a instanceof Map) {
    return sameIntent([...a], [...(b as Map<unknown, unknown>)], seen);
  }
  if (
    prototype !== Object.prototype &&
    prototype !== null &&
    !Array.isArray(a)
  ) {
    return false;
  }

  const own = (value: object): string[] =>
    Object.keys(value).filter(
      (key) => (value as Record<string, unknown>)[key] !== undefined,
    );
  const left = own(a);
  if (left.length !== own(b).length) return false;

  return left.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      sameIntent(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        seen,
      ),
  );
}

/**
 * One definition with every window boundary read to the instant it names.
 *
 * Decision 12 has a `WindowCondition.value` travel as an ISO string, so a store
 * built from a literal holds the `Date` an author wrote and every candidate a
 * publisher serves holds the string `serializeConfig` wrote for it. `toEpoch`
 * at `conditions.ts:18-22` reads both to one epoch, so the two decide the window
 * alike and state one intent. Without this the first reload after any
 * serialization names every windowed feature, and a poller that invalidates a
 * cache on `changed` invalidates on every poll.
 *
 * Only `before` and `after` convert, which is the pair `documentCondition`
 * converts and the pair `AttributeCondition.op` excludes. `evaluateCondition`
 * runs every other operator over `===`, so a `Date` and its ISO string decide
 * an attribute rule two ways and state two intents.
 *
 * A boundary this reads to `NaN` compares equal to nothing, including the same
 * unreadable value on the other side. Only a store built by `createFeatures`
 * carries one: `whenIssues` runs for a served document alone, so every
 * candidate that reaches the diff names an instant at every boundary, and a
 * store holding one that does not states an intent the candidate changed.
 */
function windowsRead(
  definition: FeatureDefinition<FeatureKey>,
): FeatureDefinition<FeatureKey> {
  const rules = definition.rules;
  if (!rules) return definition;

  return {
    ...definition,
    rules: rules.map((rule) => {
      const when = rule.when;
      if (!when) return rule;

      return {
        ...rule,
        when: when.map((condition) => {
          if (condition.op !== 'before' && condition.op !== 'after') {
            return condition;
          }
          return { ...condition, value: instantEpoch(condition.value) };
        }),
      };
    }),
  };
}

/**
 * One definition read the way both sides of the diff state it.
 *
 * A document and the store it was serialized from state one intent through two
 * shapes. `windowsRead` settles the boundary a `Date` and an ISO string state
 * alike, and `bucketingStated` settles the three members `serializeConfig`
 * writes out and a literal leaves implicit. Without the second one, the first
 * reload of a serialized document names every key declaring variants, because
 * the candidate carries a per-variant `order`, a `variantBy` and a
 * `variantSeed` the held definition never wrote, and that is the poll-on-every-
 * poll invalidation `windowsRead` exists to prevent.
 *
 * Making an implicit default explicit is not a difference in intent. The
 * candidate could not omit the three in any case: `collectIssues` runs over a
 * served document without `arrayIsOrder`, so a missing `order` is
 * `invalid-variant-order` and the two absent bucketing members are two more
 * issues.
 */
function intentRead(
  definition: FeatureDefinition<FeatureKey>,
): FeatureDefinition<FeatureKey> {
  return bucketingStated(windowsRead(definition));
}

/**
 * The keys whose stored intent differs between two documents, in the order the
 * candidate declares them, with a key the candidate drops reported after them.
 *
 * It diffs intent. It never diffs a resolved value. Decision 5 of
 * `docs/specs/2026-09-11-feature-toggles.md` says the store holds intent and
 * resolution is computed on read and never written back, so a reload replaces
 * intent and computes nothing. A feature whose window expired between two
 * documents appears here only when the document changed.
 */
function changedKeys(
  before: readonly FeatureDefinition<FeatureKey>[],
  after: readonly FeatureDefinition<FeatureKey>[],
): readonly FeatureKey[] {
  const previous = new Map(
    before.map((definition) => [definition.key, definition]),
  );
  const changed: FeatureKey[] = [];

  for (const definition of after) {
    const held = previous.get(definition.key);
    if (
      held === undefined ||
      !sameIntent(intentRead(held), intentRead(definition))
    ) {
      changed.push(definition.key);
    }
    previous.delete(definition.key);
  }

  for (const key of previous.keys()) changed.push(key);

  return changed;
}

/**
 * The envelope a store installs for a document: its members, cloned, frozen,
 * and carrying neither the payload nor the digest.
 *
 * `ConfigEnvelope` fences `digest` to `never` and `configDigest` is the one
 * writer of the member. `serializeConfig` defaults its envelope to the
 * installed one and spreads it into the document it writes, so a digest kept
 * here covers the bytes a publisher served and is emitted again over whatever
 * the store holds after the next toggle, where every holder reports
 * `digest-mismatch` and refuses the whole document. A candidate handed to
 * `collectIssues` keeps its digest, because that is the member a holder
 * verifies.
 *
 * The clone and the freeze are what the definitions get, for the same reason. A
 * shallow copy leaves `schema` the caller's own object, so a poller that reuses
 * its parsed buffer moves the schema the store reports it is holding and
 * `serializeConfig` emits the move, and an unfrozen envelope takes a write
 * through the `envelope` getter that carries `version` with it.
 *
 * `structuredClone` raises `DataCloneError` for a leaf it cannot carry, which
 * `reload` answers with an `unknown-member` issue and the construction path
 * rethrows as a `FeatureConfigError` carrying the same text.
 */
function envelopeOf(document: FeatureConfig<FeatureKey>): ConfigEnvelope {
  const members: Record<string, unknown> = { ...document };
  delete members['features'];
  delete members['digest'];

  return deepFreeze(structuredClone(members)) as ConfigEnvelope;
}

/**
 * Whether the caller handed over a document and not a bare array.
 *
 * `Array.isArray` is declared `arg is any[]` and narrows no union whose array
 * arm is `readonly FeatureDefinition<K>[]`, so the false branch of a direct
 * test keeps the whole union.
 */
function isDocument(
  value: DefinitionsOrConfig,
): value is FeatureConfig<FeatureKey> {
  return !Array.isArray(value);
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
 * answers with that same object. A call whose options prove no observer answers
 * the mutable form. The inferring form reads that off the options type
 * parameter `O`, and the form that names a schema takes one signature per case,
 * because TypeScript infers no type argument once a caller supplies one and `O`
 * would come from its default.
 *
 * A call whose options settle neither question answers the frozen form. Options
 * held in a variable annotated `FeatureOptions<S>`, and a wrapper that forwards
 * an optional `observe` parameter, both hide the observer from the compiler and
 * both take this branch. The compiler then refuses a write into what such a
 * store answers, which the runtime refuses too once the caller does install an
 * observer. A caller who installs none reaches the mutable form by leaving
 * `observe` out of the options altogether, and `satisfies UnobservedOptions<S>`
 * on such an object checks the other members and changes that answer nowhere.
 * The same annotation on an object holding `observe: undefined` reaches the
 * mutable form only through the pair that takes a named schema, because the
 * inferring signature reads the key and never the value. A wrapper forwarding an
 * optional `observe` parameter cannot write the annotation at all, because the
 * forwarded parameter's type is not `undefined`.
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
 * variants array is empty, the weights have no usable total, a window
 * condition names an instant string that hosts read differently, or an
 * envelope member holds a value no copy of the document carries.
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
 * asks whether `O` names `observe` at all. The `Record<Exclude<...>, never>`
 * constraint is what keeps a misspelled option an error: a type parameter
 * inferred from an object literal takes the literal's own type, so the compiler
 * runs no excess property check against `FeatureOptions` on its own.
 *
 * The constraint names no member of `FeatureOptions`, and the parameter
 * intersects the two. That split is what makes the question answerable. A call
 * that passes no options infers nothing for `O`, `O` falls back to a constraint
 * naming no key, and the store answers the mutable form the runtime hands it.
 * The intersection still types the observer's `event` parameter against the
 * schema.
 *
 * Naming `observe` is the question, and the type behind the name is not, so a
 * call that cannot settle the runtime answers the frozen form. A wrapper
 * forwarding an optional callback writes `{ observe }`, and options held in a
 * variable annotated `FeatureOptions<S>` name the member too. Both answer the
 * frozen form, and the compiler then refuses the write that the runtime refuses
 * once the observer turns out to be there.
 */
export function createFeatures<
  const D extends DefinitionsOrConfig,
  O extends Record<
    Exclude<
      keyof O,
      keyof FeatureOptions<AsSchema<InferSchema<DefinitionsOf<D>>>>
    >,
    never
  >,
>(
  definitions: D,
  options?: O & FeatureOptions<AsSchema<InferSchema<DefinitionsOf<D>>>>,
): Features<
  AsSchema<InferSchema<DefinitionsOf<D>>>,
  'observe' extends keyof O ? true : false
>;
/**
 * Builds the store over a schema the caller names, with no observer the
 * compiler can see. Every definition's key is checked against `keyof S`.
 *
 * `NoInfer` is what makes the check happen. Without it the compiler infers `S`
 * backwards out of the argument, fills every entry with `any`, and a definition
 * naming a key the schema never declared passes.
 *
 * This signature comes first of the pair, and it takes the options that prove
 * no observer. Every other call falls to the one below it and answers the
 * frozen form.
 */
export function createFeatures<S extends Record<keyof S, VariantInfo | never>>(
  definitions: DefinitionsOrConfig<NoInfer<Extract<keyof S, FeatureKey>>>,
  options?: UnobservedOptions<S>,
): Features<S, false>;
/**
 * The same store over a named schema, for options that carry an observer or
 * prove nothing about one.
 */
export function createFeatures<S extends Record<keyof S, VariantInfo | never>>(
  definitions: DefinitionsOrConfig<NoInfer<Extract<keyof S, FeatureKey>>>,
  options: FeatureOptions<S>,
): Features<S, true>;
export function createFeatures(
  definitions: DefinitionsOrConfig,
  given: object = {},
): Features<Record<FeatureKey, VariantInfo>, boolean> {
  // The three signatures above are what a caller sees, and this one is checked
  // against each of them with its type parameters erased. An erased
  // `UnobservedOptions<S>` relates to no options type that declares `observe`,
  // so this parameter declares none and the body reads the options at the
  // erased schema.
  const options = given as FeatureOptions<Record<FeatureKey, VariantInfo>>;
  // A bare array is the document that carries only `features`, and the checker
  // below reads one document either way.
  const document: Checkable = isDocument(definitions)
    ? definitions
    : { features: definitions };
  // One checker answers both paths. `validateConfig` reports what this throws,
  // and the graph is checked before the variants, so a document carrying a
  // duplicate key and an unusable weight names the key.
  //
  // `arrayIsOrder` follows the form the caller passed, for the reason the
  // `VariantCheckOptions` docblock gives: the flag exempts the literal an
  // author wrote, where the array is the variant order, a variant declaring no
  // `order` takes its index, and the author who omitted `variantBy` or
  // `variantSeed` is the party the default answers. A document a poller fetched
  // is a served document, and § 3 of
  // `docs/specs/2026-09-23-feature-config-distribution.md` has every member the
  // assignment reads travel whole or the document be refused. So a document
  // is read here the way `parseFeatureConfig`, `validateConfig` and `reload`
  // read the same bytes, and two holders of one document agree on whether the
  // configuration exists.
  //
  // It runs before the walk below reads `features`, because a document is
  // untrusted JSON and its `features` member holds whatever a control plane
  // wrote. `shapeWalk` reports a document that is no object and one whose
  // `features` is no array, and `errors.ts` has every refusal out of this
  // function be a typed `FeatureConfigError`, which a `.map` over such a member
  // would raise a `TypeError` past.
  const refused = collectIssues(document, {
    arrayIsOrder: !isDocument(definitions),
  });
  if (refused[0]) throw refused[0].error;
  const supplied = document.features;
  // Cloned so the store cannot be edited behind its own back, then frozen so an
  // attempt to do so fails loudly instead of silently diverging from what was
  // resolved. The freeze covers the array as well as each definition in it, and
  // `toggle` replaces the whole array on a write.
  //
  // Inside a catch, for the reason the envelope below is inside one.
  // `collectIssues` declares nothing about a variant `value`, which
  // `SerializedVariantSpec` types `unknown`, so a function, a symbol or a
  // value nested deeper than the stack holds clears the checker and raises
  // `DataCloneError` or `RangeError` out of this walk, and `deepFreeze` hands
  // `Object.freeze` a typed array holding elements and raises `TypeError`.
  //
  // The two paths answer such a value differently, which is the split the
  // `UNCOPYABLE` docblock in `parse.spec.ts` draws. A bare array is the
  // literal an author wrote, the raise names the leaf at the authoring site,
  // and it travels. A document arrived from a publisher, `errors.ts` has every
  // refusal over a supplied configuration be a typed `FeatureConfigError`, and
  // a holder catching one to keep the document it already has catches no
  // `DOMException`. The text is the raise's own, which is the only part of it
  // that says anything about the value: `parseFeatureConfig` catches this
  // throw and keys the issue on the definition that carries the value, and
  // `reload` keys the same issue on the same definition for the same bytes.
  let config: readonly FeatureDefinition<FeatureKey>[];
  try {
    config = Object.freeze(
      supplied.map((definition) => deepFreeze(structuredClone(definition))),
    );
  } catch (raise) {
    if (!isDocument(definitions)) throw raise;
    throw new FeatureConfigError(unreadableText(raise));
  }
  // The window contract for a literal is read here. `whenIssues` inside the
  // checker answers a served document and stays behind the `arrayIsOrder` gate,
  // so a bare array reaches no other reader of the contract.
  for (const definition of config) {
    validateConditions(definition);
  }
  let graph = buildGraph(config);
  let index = new Map<FeatureKey, number>(config.map((d, i) => [d.key, i]));
  let keys: readonly FeatureKey[] = Object.freeze(
    config.map((definition) => definition.key),
  );
  /**
   * The envelope the store last installed. A bare array carries none, and a
   * document installs its own members, so `version` and `envelope` answer the
   * document this store was built from.
   *
   * Assigned before the accessors below close over it, and reassigned by
   * `reload` alone.
   *
   * The bare array's envelope is frozen as well. `envelope` hands `installed`
   * out by reference, so a write through the getter would carry a `version`
   * into a document no publisher served and `serializeConfig` would emit it.
   */
  let installed: ConfigEnvelope;
  try {
    installed = isDocument(definitions)
      ? envelopeOf(definitions)
      : Object.freeze({});
  } catch (raise) {
    // `envelopeOf` copies members the checker declares nothing about:
    // `memberIssues` names the six top-level members and `schemaIssues` fences
    // schema keywords, so a function at a fenced keyword and a symbol at
    // `maxStale` both reach the copy. `errors.ts` has every refusal out of this
    // function be a `FeatureConfigError`, and a caller catching one to keep the
    // document it already holds catches no `DOMException`. `reload` answers the
    // same document with an `unknown-member` issue carrying this same text.
    throw new FeatureConfigError(unreadableText(raise));
  }
  // The store-level lookup, which the public `definition` member answers with.
  // A caller asking for one definition wants the one the store holds now, so
  // this reads the references and binds nothing.
  const definitionOf = (
    key: FeatureKey,
  ): FeatureDefinition<FeatureKey> | undefined => {
    const at = index.get(key);
    return at === undefined ? undefined : config[at];
  };

  /**
   * One document, its graph and its index, with a lookup over the three.
   *
   * `reload` and `toggle` assign the store's references, and a walk that read
   * them through the closure would see an assignment that landed mid-walk.
   * `resolveAll` evaluates the dependency order once and looks a definition up
   * on every iteration, so a reload from a synchronous hook would put half a
   * decision set on one document and half on another. A caller holds one of
   * these and reads only what it holds, which keeps every decision in one
   * answer computed from one document.
   *
   * `toggle` names a document this way. It resolves the document it writes onto
   * and the same document carrying the write, so `willDisable` diffs one
   * document against itself and a reload that lands inside either resolution
   * moves neither side.
   */
  const viewOf = (
    held: readonly FeatureDefinition<FeatureKey>[],
    walk: FeatureGraph<FeatureKey>,
    positions: Map<FeatureKey, number>,
  ) => ({
    held,
    walk,
    positions,
    definitionAt: (
      key: FeatureKey,
    ): FeatureDefinition<FeatureKey> | undefined => {
      const position = positions.get(key);
      return position === undefined ? undefined : held[position];
    },
  });

  /** The references the store holds now, read at one instant. */
  const boundView = () => viewOf(config, graph, index);

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
  //
  // `view` defaults to the references the store holds at the call, which is
  // bound before the first statement and not in `resolve`. `resolve` calls
  // `withNow(context)` first, and `withNow` spreads the caller's context, which
  // runs every own enumerable getter on it. A binding after that call would
  // already be too late for a hook the caller hung on a context field. A caller
  // that has a document to name passes its own view, and `toggle` is the one
  // that does.
  const resolveAll = (
    context: SettledContext,
    view = boundView(),
  ): Record<FeatureKey, Decision<FeatureKey>> => {
    const { walk, definitionAt } = view;
    const resolved = new Map<FeatureKey, Decision<FeatureKey>>();

    // `walk.order`, not `keys`: see FeatureGraph.order for why the cascade
    // needs it.
    for (const key of walk.order) {
      const definition = definitionAt(key);
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
    // Bound after `withNow`, which this needs the settled context from.
    const { walk, definitionAt } = boundView();
    const plans = new Map<FeatureKey, PlanEntry<FeatureKey>>();
    const resolved = new Map<FeatureKey, Decision<FeatureKey>>();

    for (const key of walk.order) {
      const definition = definitionAt(key);
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

  const snapshot = (
    context?: EvaluationContext,
    options?: SnapshotOptions,
  ): DecisionSet<Record<FeatureKey, VariantInfo>, boolean> => {
    const evaluationContext = withNow(context);
    // A set states its instant as an ISO 8601 string, which an invalid `Date`
    // has none of: `toISOString` raises a bare `RangeError` naming neither the
    // field nor the call. The refusal names the field the caller handed in, the
    // way `documentCondition` names the path of a `Date` a document cannot
    // carry (`serialize.ts:180-184`). The check runs before the resolution, so
    // a refused call reports no event and resolves nothing.
    if (Number.isNaN(evaluationContext.now.getTime())) {
      throw new FeatureConfigError(
        'the Date at context/now names no instant, and a decision set states its instant as an ISO 8601 string',
      );
    }
    // Read before the emit below, which calls an observer synchronously. A
    // `reload` from inside that call assigns `installed` (`features.ts:1253`),
    // and `DecisionSet.version` names the configuration the set's decisions
    // resolved under, which the consumer's `!==` comparison relies on.
    const version = installed.version;
    const decisions = frozenWhenObserved(resolveAll(evaluationContext));

    if (observed) {
      emit({
        type: 'resolve',
        ...envelope(evaluationContext),
        decisions,
      } as FeatureEvent<Record<FeatureKey, VariantInfo>>);
    }

    return frozenWhenObserved({
      ...(version === undefined ? {} : { version }),
      now: evaluationContext.now.toISOString(),
      origin: options?.origin ?? 'render',
      decisions: decisions as Decisions<Record<FeatureKey, VariantInfo>>,
    });
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
    // Bound after `withNow`, which this needs the settled context from.
    const start = boundView();

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

    // The resolution that settles the caller's context. Every getter the caller
    // hung on a context field runs here -- `assignVariant` reads
    // `stickyVariants[key]` for every feature declaring variants -- so a
    // `reload` from one of them lands before the lines below pick the document
    // the write goes onto. It reports nothing, the way `resolveAll` reports
    // nothing: an observer holding this set could write `enabled` to `false` on
    // a dependant and `willDisable` would come back short, which is the list an
    // operator reads before pulling a kill switch.
    const settled = resolveAll(evaluationContext, start);

    // The document the write goes onto, read after that resolution. A reload
    // that landed inside it assigned all five references together, and the
    // write belongs on the document the store holds now: writing the bound
    // array back would put the pre-reload document under the candidate's graph,
    // index and keys, and `definitionOf` would then index the previous array
    // with the candidate's positions.
    const view = config === start.held ? start : boundView();

    const at = view.positions.get(key);
    const current = at === undefined ? undefined : view.held[at];
    if (at === undefined || !current) {
      // Either the store never held the key, or a reload inside the resolution
      // above installed a document that no longer declares it. § 6 has a reload
      // discard a local toggle, and nothing was written, so the result says so.
      // An `ok: true` here would put a toggle an auditor can read in the
      // observer's log for a write that landed on no document.
      return reported({ ok: false, key, error: 'unknown-feature' });
    }

    const next = [...view.held];
    next[at] = deepFreeze({ ...current, enabled });
    const written = Object.freeze(next);
    // Installed before the two resolutions below, which run the caller's
    // getters again. A write after them would overwrite a document a reload
    // from one of those getters installed, and § 6 has the reload win.
    // `graph`, `index` and `keys` carry over: a write moves `enabled` and
    // touches neither the key nor `dependsOn`.
    config = written;
    // `installed` is not touched. § 6 declares `version` the installed
    // document's version and `reload` the one writer of the member: a toggle
    // that dropped it would answer `previousVersion: undefined` on the next
    // install and `version: undefined` on the next refusal, over a document
    // the store is still deciding from. A process that re-serves the toggled
    // document labels it itself, which is what `serializeConfig`'s envelope
    // parameter is for, and § 6 refuses the merge that would make the store's
    // own label cover two authorities.

    // Both sides read one document: the one the write went onto, and the same
    // one carrying the write. `settled` resolved `view.held` already when no
    // reload moved it. A reload landing inside either resolution below moves
    // the store, not these two views, so `willDisable` never names a dependant
    // from one document filtered on a decision from another.
    const before =
      view === start ? settled : resolveAll(evaluationContext, view);
    const after = resolveAll(
      evaluationContext,
      viewOf(written, view.walk, view.positions),
    );

    const willDisable = view.walk
      .dependants(key)
      .filter(
        (dependant) =>
          (before[dependant]?.enabled ?? false) &&
          !(after[dependant]?.enabled ?? false),
      );

    return reported({ ok: true, key, enabled, willDisable });
  };

  /**
   * Validates a candidate whole and installs it, or keeps the current document
   * and reports why.
   *
   * The order is what makes it atomic. It checks the candidate, clones and
   * deep-freezes every definition the way construction does, builds the
   * candidate graph, and only then assigns the references the store reads. A
   * candidate that fails at any step leaves every reference where it was, and
   * the failure path touches no state at all.
   *
   * `resolveAll` binds its view of the store as its first statement and reads
   * only those locals, so an assignment during a resolution is invisible to the
   * running call: it holds the previous frozen array to the end of its walk. A
   * reload therefore never produces a decision computed half from one document
   * and half from another.
   *
   * The checker reads the candidate as a served document, which is what it is.
   * Construction passes `arrayIsOrder` because the definitions it holds are a
   * literal an author wrote, and a candidate arrived from a publisher that
   * states a variant order or states none.
   */
  const reload = (candidate: FeatureConfig<FeatureKey>): ReloadResult => {
    // The version the refusal arms name. It is read before the checker, so a
    // member that answers a read with a raise is reported under the version the
    // document states rather than taking the read down with it.
    let rejected: string | number | undefined;

    // Nothing about the candidate is trusted. The checker reads its members off
    // the object a publisher served, so a member that answers a read with a
    // raise reports here, the way `parseFeatureConfig` reports it.
    let refused: ReturnType<typeof collectIssues>;
    try {
      rejected = candidate.version;
      refused = collectIssues(candidate);
    } catch (raise) {
      return {
        ok: false,
        version: installed.version,
        rejected,
        issues: unreadable(raise, []),
      };
    }

    if (refused[0]) {
      return {
        ok: false,
        version: installed.version,
        rejected,
        issues: refused.map((each) => each.issue),
      };
    }

    // The copy, the freeze, the diff and the envelope, inside one catch.
    // `collectIssues` declares nothing about a variant `value`, which
    // `SerializedVariantSpec` types `unknown`, so a function, a symbol or a
    // value nested deeper than the stack holds clears the checker and raises
    // `DataCloneError` or `RangeError` out of the walk below. Decision 11 answers a candidate with
    // a result, and every assignment the store reads sits after this block, so
    // the report leaves the installed document deciding.
    let next: {
      config: readonly FeatureDefinition<FeatureKey>[];
      graph: FeatureGraph<FeatureKey>;
      index: Map<FeatureKey, number>;
      keys: readonly FeatureKey[];
      changed: readonly FeatureKey[];
      envelope: ConfigEnvelope;
    };
    try {
      const nextConfig = Object.freeze(
        candidate.features.map((definition) =>
          deepFreeze(
            structuredClone(definition) as FeatureDefinition<FeatureKey>,
          ),
        ),
      );
      next = {
        config: nextConfig,
        graph: buildGraph(nextConfig),
        index: new Map<FeatureKey, number>(
          nextConfig.map((definition, at) => [definition.key, at]),
        ),
        keys: Object.freeze(nextConfig.map((definition) => definition.key)),
        changed: changedKeys(config, nextConfig),
        envelope: envelopeOf(candidate),
      };
    } catch (raise) {
      return {
        ok: false,
        version: installed.version,
        rejected,
        issues: unreadable(raise, candidate.features),
      };
    }

    const previousVersion = installed.version;

    config = next.config;
    graph = next.graph;
    index = next.index;
    keys = next.keys;
    installed = next.envelope;

    return {
      ok: true,
      version: candidate.version,
      previousVersion,
      changed: next.changed,
    };
  };

  return {
    // Every reference below is read through an accessor. A value captured here
    // would keep naming the first document after a reload.
    get keys() {
      return keys;
    },
    get version() {
      return installed.version;
    },
    get envelope() {
      return installed;
    },
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
    dependants: (key) => graph.dependants(key),
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
    snapshot,
    toggle,
    reload,
  };
}
