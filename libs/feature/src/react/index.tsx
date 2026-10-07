'use client';

/**
 * The React adapter: a provider and hooks over an already-built store.
 *
 * This is its own entry (`@evanion/feature/react`) and its own module for one
 * reason: `'use client'` is a per-module directive, and a bundle is one module.
 * `@evanion/react-widget` hit the same constraint from the other side -- its
 * answer was to have no client code at all, while this layer genuinely is client
 * code -- so the package is emitted file-per-file by `tsc` and the core entry
 * stays free of both the directive and any React import.
 *
 * Evaluation itself lives in the core. Nothing here decides anything.
 */

import { createContext, useContext, useMemo } from 'react';
import type { Context, ReactElement, ReactNode } from 'react';
import type { Features } from '../lib/features.js';
import type { DeepReadonly, FrozenWhenObserved } from '../lib/observe.js';
import type {
  Decision,
  Decisions,
  EvaluationContext,
  FeatureKey,
  Schema,
  VariantInfo,
} from '../lib/types.js';

/**
 * The document types, re-exported so a component file imports one specifier.
 *
 * A React application that holds a store and reloads it from a poller writes
 * the handler beside the component, and that file names `ReloadResult` and
 * `FeatureConfig`. Types only: `serializeConfig`, `configDigest`,
 * `validateConfig` and `parseFeatureConfig` stay on the core entry, because a
 * component calling one of them holds configuration in a render tree and
 * reaches for the core.
 */
export type {
  BaseFieldType,
  ConfigEnvelope,
  ConfigIssue,
  ConfigIssueCode,
  ContextSchema,
  FeatureConfig,
  FeatureSchema,
  FeatureShape,
  FieldType,
  JsonValue,
  ReloadResult,
  SerializedAttributeCondition,
  SerializedCondition,
  SerializedDefinition,
  SerializedInstant,
  SerializedRule,
  SerializedVariantSpec,
  SerializedWindowCondition,
  ValidationResult,
  ValueShape,
} from '../lib/config.js';

/**
 * What a provider publishes, at the erased types.
 *
 * Every `Decision<'cta', 'control' | 'blue', { label: string }>` assigns to
 * `Decision<FeatureKey>` because `key`, `variant`, `value`, `blockedBy` and
 * `cause` all sit in output position. A React context fixes its type when the
 * context is created and cannot hold the schema a provider was given, so a
 * provider widens to this once and the bound hooks narrow back.
 *
 * `Decision<FeatureKey>` and not `Decision`: the parameter defaults to `string`
 * while its constraint admits a number, so a store keyed on a numeric enum
 * produces a `Decision<7>` whose `key` does not assign to `Decision`'s. The
 * widening only holds at the constraint.
 */
export type AnyDecisions = Readonly<Record<FeatureKey, Decision<FeatureKey>>>;

interface FeatureContextValue {
  decisions: AnyDecisions;
}

/**
 * Reads what `resolve` answered at the erased type.
 *
 * A store carrying an observer answers the deeply readonly form of
 * `Decisions<S>`, and `DeepReadonly` does not reduce over a schema the compiler
 * has not resolved, so neither form assigns to {@link AnyDecisions} on its own.
 * Both hold one decision per key, and the context reads those decisions and
 * writes none of them.
 */
function erased<S extends Record<keyof S, VariantInfo | never>>(
  resolved: Decisions<S> | DeepReadonly<Decisions<S>>,
): AnyDecisions {
  return resolved as AnyDecisions;
}

const SharedContext = createContext<FeatureContextValue | null>(null);

function useContextValue(
  context: Context<FeatureContextValue | null>,
): FeatureContextValue {
  const value = useContext(context);
  if (!value) {
    throw new Error(
      'useFeatures must be called inside a <FeatureProvider> (from @evanion/feature/react)',
    );
  }
  return value;
}

/**
 * One decision, or a throw naming the key.
 *
 * A bare index walks the prototype chain, so a key of `constructor` or
 * `toString` resolves to a function off `Object.prototype` and passes the
 * configured check below as a decision object. This asks the own-property
 * question first.
 *
 * A silent `false` would make a typo indistinguishable from a feature that is
 * off, which is the failure mode flag systems are worst at.
 */
function requireDecision(
  decisions: AnyDecisions,
  key: FeatureKey,
): Decision<FeatureKey> {
  const decision = Object.prototype.hasOwnProperty.call(decisions, key)
    ? decisions[key]
    : undefined;
  if (!decision) {
    throw new Error(
      `feature "${String(key)}" is not configured in this <FeatureProvider>`,
    );
  }
  return decision;
}

export interface FeatureProviderProps<
  S extends Record<keyof S, VariantInfo | never> = Schema,
> {
  features: Features<S>;
  /**
   * The evaluation context. Resolution is memoised on this object's identity, so
   * pass a stable reference -- an object literal written inline re-resolves on
   * every render.
   *
   * Leaving `now` out means "the clock at the moment this context was first
   * resolved". A component tree that must agree with a server render should pass
   * `now` explicitly.
   */
  context?: EvaluationContext;
  /**
   * Decisions resolved elsewhere -- a server render, or the build-time snapshot
   * from `plan()`. Supplied decisions are used as they are; `features` and
   * `context` are then only a fallback for what the snapshot does not cover.
   *
   * Both forms are accepted, because a store carrying an observer answers the
   * deeply readonly one. The provider reads these decisions and writes none of
   * them.
   */
  decisions?: Decisions<S> | DeepReadonly<Decisions<S>>;
  children?: ReactNode;
}

export function FeatureProvider<
  S extends Record<keyof S, VariantInfo | never>,
>({ features, context, decisions, children }: FeatureProviderProps<S>) {
  const value = useMemo<FeatureContextValue>(
    () => ({ decisions: erased(decisions ?? features.resolve(context)) }),
    [features, context, decisions],
  );

  return (
    <SharedContext.Provider value={value}>{children}</SharedContext.Provider>
  );
}

/** Every resolved decision, at the erased types. */
export function useFeatures(): AnyDecisions {
  return useContextValue(SharedContext).decisions;
}

/**
 * One feature's decision, explanation included.
 *
 * Throws for a key that is not configured. {@link createFeatureContext} binds
 * this hook to one store's keys, so a component under a bound provider names a
 * key the compiler checks.
 */
export function useFeature(key: FeatureKey): Decision<FeatureKey> {
  return requireDecision(useFeatures(), key);
}

/** One feature's decision as a boolean. */
export function useFeatureEnabled(key: FeatureKey): boolean {
  return useFeature(key).enabled;
}

/**
 * One feature's assigned variant and its value.
 *
 * A reader over the decision `useFeature` already returns. Both are absent for
 * a feature that resolved off and for a feature declaring no variants, so
 * calling code handles off before it switches on a name.
 *
 * Throws for a key the provider does not carry, which `useFeature` does for the
 * same reason: a silent `undefined` would make a typo indistinguishable from a
 * feature nobody assigned.
 */
export function useVariant(
  key: FeatureKey,
): Pick<Decision, 'variant' | 'value'> {
  const decision = useFeature(key);
  return { variant: decision.variant, value: decision.value };
}

/**
 * Props of the provider {@link createFeatureContext} returns.
 *
 * `features` is optional here and required on {@link FeatureProvider}: the
 * factory already holds a store, and a mount that supplies the context alone is
 * the common one. Pass it to resolve a different store with the same schema --
 * a per-tenant configuration, or the copy a browser rebuilt from JSON.
 *
 * `Frozen` comes from the factory's own store, and a substituted store carries
 * the same parameter. The hooks type their decisions off the factory's answer,
 * so a store that freezes what it resolves under a factory built from a store
 * that freezes nothing would publish frozen decisions to hooks promising the
 * mutable form. The parameter here turns that mount into a compile error.
 */
export interface BoundFeatureProviderProps<
  S extends Record<keyof S, VariantInfo | never>,
  Frozen extends boolean = boolean,
> {
  features?: Features<S, Frozen>;
  context?: EvaluationContext;
  decisions?: Decisions<S> | DeepReadonly<Decisions<S>>;
  children?: ReactNode;
}

/**
 * What {@link FeatureContext.useVariant} answers for one key.
 *
 * The `[S[K]] extends [never]` guard is what keeps a variant-free feature
 * honest. `never` is a subtype of every type, so the `infer` branch alone would
 * read `variant` off a decision that dropped the property and infer `unknown`.
 * The tuple wrap suppresses distribution and asks the question the branch
 * means to ask. Both fields come off `Decisions<S>[K]`, so this and the
 * decision for the same key cannot drift apart.
 */
export type BoundVariant<
  S extends Record<keyof S, VariantInfo | never>,
  K extends keyof S,
> = [S[K]] extends [never]
  ? { variant?: undefined; value?: undefined }
  : Decisions<S>[K] extends { variant?: infer V; value?: infer T }
    ? { variant?: V; value?: T }
    : never;

/**
 * A provider and hooks bound to one store's schema.
 *
 * Each hook names `keyof S`, so a misspelled key is a compile error and the
 * variant a reader switches on is the union that store declares.
 *
 * `Frozen` carries the store's own answer. A store built with no observer
 * freezes nothing and its hooks answer the mutable decisions, a store built
 * with one answers the deeply readonly form, and a store whose observation the
 * compiler cannot settle answers the union of the two.
 */
export interface FeatureContext<
  S extends Record<keyof S, VariantInfo | never>,
  Frozen extends boolean = boolean,
> {
  FeatureProvider(props: BoundFeatureProviderProps<S, Frozen>): ReactElement;
  useFeatures(): FrozenWhenObserved<Frozen, Decisions<S>>;
  useFeature<K extends keyof S & FeatureKey>(
    key: K,
  ): FrozenWhenObserved<Frozen, Decisions<S>[K]>;
  useFeatureEnabled<K extends keyof S & FeatureKey>(key: K): boolean;
  useVariant<K extends keyof S & FeatureKey>(key: K): BoundVariant<S, K>;
}

/**
 * Reads a bound provider's decisions at the schema the factory holds.
 *
 * This is the one place the erased value is narrowed. It holds because a bound
 * context is created inside a single {@link createFeatureContext} call and
 * written by exactly one component, whose props type every entry as one of the
 * two forms of `Decisions<S>`.
 *
 * The answer follows the store. A provider fed by a store carrying an observer
 * publishes frozen decisions, and a hook promising the mutable form there would
 * let a component write a field the runtime refuses. The compiler resolves
 * neither branch of `FrozenWhenObserved` while `Frozen` is a parameter, so the
 * cast states the answer the two branches share.
 */
function atSchema<
  S extends Record<keyof S, VariantInfo | never>,
  Frozen extends boolean,
>(decisions: AnyDecisions): FrozenWhenObserved<Frozen, Decisions<S>> {
  return decisions as unknown as FrozenWhenObserved<Frozen, Decisions<S>>;
}

/**
 * Reads one key off a bound provider's decisions, at the schema.
 *
 * `DeepReadonly<Decisions<S>>` is a conditional type the compiler cannot reduce
 * while `S` is a parameter, so nothing indexes it by `K`. Indexing first and
 * mapping the one decision answers the same type for a settled `S`.
 */
function decisionAtSchema<
  S extends Record<keyof S, VariantInfo | never>,
  K extends keyof S & FeatureKey,
  Frozen extends boolean,
>(
  decisions: AnyDecisions,
  key: K,
): FrozenWhenObserved<Frozen, Decisions<S>[K]> {
  return (decisions as Decisions<S>)[key] as unknown as FrozenWhenObserved<
    Frozen,
    Decisions<S>[K]
  >;
}

/**
 * Binds a store's schema to a provider and a set of hooks.
 *
 * `createFeatures([...])` returns a `Features<S>` whose keys and variant types the
 * definitions supplied, and the store loses all of it the moment the value
 * reaches a context: `createContext` fixes its type when the context
 * is made, and `useContext` hands a hook that fixed type whatever the provider
 * above it was given. A function that makes the context and the hooks together
 * is where `S` can be held, so this is a factory and not a generic provider.
 *
 * `S` comes from the argument. Nothing is restated at the call site, and a
 * store whose configuration arrived as JSON yields the wide hooks, which are
 * the ones {@link useFeature} and its siblings already export.
 *
 * Each call makes its own context, so two stores nest and each set of hooks
 * reads its own provider. The returned provider also publishes to the shared
 * context, so a component calling the package's own {@link useFeature}
 * underneath it reads the same decisions.
 *
 * A browser decides what a reader sees and gates nothing. A key that
 * type-checks here says the store this was built from declares it, and says
 * nothing about the decisions the provider was handed at runtime.
 *
 * @example
 * ```tsx
 * const features = createFeatures([
 *   {
 *     key: 'cta',
 *     enabled: true,
 *     variants: [
 *       { name: 'control', weight: 50 },
 *       { name: 'blue', weight: 50, value: { label: 'Get it' } },
 *     ],
 *   },
 * ]);
 *
 * const { FeatureProvider, useVariant } = createFeatureContext(features);
 *
 * <FeatureProvider context={{ targetingKey: user.id }}>…</FeatureProvider>;
 * useVariant('cta').variant;  // 'control' | 'blue' | undefined
 * ```
 */
export function createFeatureContext<
  S extends Record<keyof S, VariantInfo | never>,
  Frozen extends boolean = boolean,
>(features: Features<S, Frozen>): FeatureContext<S, Frozen> {
  const BoundContext = createContext<FeatureContextValue | null>(null);

  return {
    FeatureProvider({ features: given, context, decisions, children }) {
      const value = useMemo<FeatureContextValue>(
        () => ({
          decisions: erased(decisions ?? (given ?? features).resolve(context)),
        }),
        [given, context, decisions],
      );

      return (
        <SharedContext.Provider value={value}>
          <BoundContext.Provider value={value}>
            {children}
          </BoundContext.Provider>
        </SharedContext.Provider>
      );
    },
    useFeatures() {
      return atSchema<S, Frozen>(useContextValue(BoundContext).decisions);
    },
    useFeature(key) {
      const decisions = useContextValue(BoundContext).decisions;
      requireDecision(decisions, key);
      return decisionAtSchema<S, typeof key, Frozen>(decisions, key);
    },
    useFeatureEnabled(key) {
      return requireDecision(useContextValue(BoundContext).decisions, key)
        .enabled;
    },
    useVariant(key) {
      const decision = requireDecision(
        useContextValue(BoundContext).decisions,
        key,
      );
      // A method whose return type is conditional on an unresolved `S` has no
      // type an implementation can write. The compiler resolves neither branch
      // here, and the runtime answer is the two fields the decision carries
      // either way.
      return { variant: decision.variant, value: decision.value } as never;
    },
  };
}
