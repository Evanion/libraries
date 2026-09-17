'use client';

/**
 * The React adapter: a provider and hooks over an already-built access matrix.
 *
 * Evaluation lives in `@evanion/acl`. Nothing here decides anything;
 * this layer supplies the context and reads decisions. It serves both an
 * RSC-style graph and a traditional Node server/client split from one surface.
 */

import { createContext, useContext, useMemo } from 'react';
import type { Context, ReactElement, ReactNode } from 'react';
import type { Access, ActionOf, AnyObjects, Subject } from '@evanion/acl';
import type { Decision, FieldDecision, Instant } from '@evanion/acl';

export type { Access, Subject } from '@evanion/acl';
export type {
  ActionOf,
  AnyObjects,
  Condition,
  Decision,
  EvaluationContext,
  FieldDecision,
  FieldReason,
  FieldState,
  FieldType,
  Instant,
  Matrix,
  MatrixSchema,
  ObjectSchema,
  Permission,
  Reason,
} from '@evanion/acl';

/**
 * What a provider publishes, at the erased types the engine takes.
 *
 * `Access<Sub, R>` is checked at the provider's prop and at the hooks that read
 * it. Between the two it is carried as the wide instantiation, because a React
 * context fixes its type when the context is created and cannot hold the
 * parameters a provider was given.
 */
interface PolicyContextValue {
  access: Access;
  subject: Subject;
  now: Instant;
}

const SharedContext = createContext<PolicyContextValue | null>(null);

/**
 * Props of the shared provider.
 *
 * `Keys` is the permission-key union the access object carries, and it is read
 * off the prop rather than named at the call site. The default is the open
 * union a rehydrated document carries, so `PolicyProviderProps` with no type
 * argument is the erased form, and a policy whose keys are declared reaches the
 * same prop.
 */
export interface PolicyProviderProps<Keys extends string = string> {
  access: Access<Subject, AnyObjects, Keys>;
  subject: Subject;
  /**
   * The evaluation context. Only `now` is read here; the subject is passed
   * separately. Pass a stable reference so memoisation on identity holds.
   *
   * A string or number `now` is compared by value in the hook memo keys, so an
   * instant that crossed JSON holds its memo across renders where a `Date` -- a
   * fresh object every render -- does not.
   */
  context?: { now?: Instant };
  children?: ReactNode;
}

export function PolicyProvider<Keys extends string = string>({
  access,
  subject,
  context,
  children,
}: PolicyProviderProps<Keys>) {
  const value = useMemo<PolicyContextValue>(
    () => ({
      access: access as Access,
      subject,
      now: context?.now ?? new Date(),
    }),
    [access, subject, context],
  );
  return (
    <SharedContext.Provider value={value}>{children}</SharedContext.Provider>
  );
}

function usePolicyValue(
  context: Context<PolicyContextValue | null>,
): PolicyContextValue {
  const value = useContext(context);
  if (!value) {
    throw new Error(
      'useCan must be called inside a <PolicyProvider> (from @evanion/react-acl)',
    );
  }
  return value;
}

function useDecision(
  value: PolicyContextValue,
  key: string,
  action: string,
  object?: Record<string, unknown>,
): Decision {
  const { access, subject, now } = value;
  return useMemo(
    () => access.can(subject, key, action, object, now),
    // object identity is part of the memo key; a changed instance must not
    // return a stale decision.
    [access, subject, key, action, object, now],
  );
}

function useDecisions(
  value: PolicyContextValue,
  key: string,
  action: string,
  objects: readonly Record<string, unknown>[],
): Decision[] {
  const { access, subject, now } = value;
  return useMemo(
    () => access.canMany(subject, key, action, objects, now),
    [access, subject, key, action, objects, now],
  );
}

function useFieldDecision(
  value: PolicyContextValue,
  key: string,
  action: string,
  object: Record<string, unknown>,
  axis: 'read' | 'write',
  proposed?: Record<string, unknown>,
): FieldDecision {
  const { access, subject, now } = value;
  return useMemo(
    () => access.canFields(subject, key, action, object, axis, proposed, now),
    [access, subject, key, action, object, axis, proposed, now],
  );
}

function useEveryDecision(value: PolicyContextValue): Record<string, Decision> {
  const { access, subject, now } = value;
  return useMemo(
    () => access.capabilities(subject, now),
    [access, subject, now],
  );
}

/**
 * One decision. `object` is the instance, optional for the create case; an
 * object-dependent rule with no instance yields an `unevaluable` decision.
 */
export function useCan(
  key: string,
  action: string,
  object?: Record<string, unknown>,
): Decision {
  return useDecision(usePolicyValue(SharedContext), key, action, object);
}

/** A bulk decision array for a list, parallel to the input. */
export function useCanMany(
  key: string,
  action: string,
  objects: readonly Record<string, unknown>[],
): Decision[] {
  return useDecisions(usePolicyValue(SharedContext), key, action, objects);
}

/** The field-level decision for one action on one axis. */
export function useCanFields(
  key: string,
  action: string,
  object: Record<string, unknown>,
  axis: 'read' | 'write',
  proposed?: Record<string, unknown>,
): FieldDecision {
  return useFieldDecision(
    usePolicyValue(SharedContext),
    key,
    action,
    object,
    axis,
    proposed,
  );
}

/** Every action-level decision for the current subject (no object). */
export function useCapabilities(): Record<string, Decision> {
  return useEveryDecision(usePolicyValue(SharedContext));
}

/**
 * Props of the provider {@link createPolicyContext} returns.
 *
 * `access` is optional here and required on {@link PolicyProvider}: the factory
 * already holds a document, and a mount that names the subject alone is the
 * common one. Pass it to decide against a different document with the same
 * shape -- a per-tenant matrix, or the copy a browser rebuilt from JSON.
 */
export interface BoundPolicyProviderProps<
  Sub,
  R,
  Keys extends string = string,
> {
  access?: Access<Sub, R, Keys>;
  subject: Sub;
  context?: { now?: Instant };
  children?: ReactNode;
}

/**
 * A provider and hooks bound to one policy's subject, object map and keys.
 *
 * `Keys` carries the permission keys the policy declares, so an action is
 * checked against the ones its object kind declares and `useCapabilities`
 * answers under those keys. A policy that leaves its actions open carries the
 * open union, where every action parameter is `string` and the capability
 * record is keyed by `string`.
 */
export interface PolicyContext<Sub, R, Keys extends string = string> {
  PolicyProvider(props: BoundPolicyProviderProps<Sub, R, Keys>): ReactElement;
  useCan<K extends keyof R & string>(
    key: K,
    action: ActionOf<Keys, K>,
    object?: Partial<R[K]>,
  ): Decision;
  useCanMany<K extends keyof R & string>(
    key: K,
    action: ActionOf<Keys, K>,
    objects: readonly Partial<R[K]>[],
  ): Decision[];
  useCanFields<K extends keyof R & string>(
    key: K,
    action: ActionOf<Keys, K>,
    object: Partial<R[K]>,
    axis: 'read' | 'write',
    proposed?: Partial<R[K]>,
  ): FieldDecision;
  /**
   * Every action-level decision for the current subject.
   *
   * Keyed by permission key, `'listing.update'`, where `R` holds object kinds,
   * `'listing'`. A policy whose blocks name their action vocabulary narrows
   * this to the keys it declares, so a reader names one and a misspelled name
   * is a compile error.
   */
  useCapabilities(): Record<Keys, Decision>;
}

/**
 * Binds a policy's subject and object map to a provider and a set of hooks.
 *
 * `policy<Shopper, ShopObjects>().for('listing', …).build()` returns an
 * `Access<Shopper, Record<'listing', Listing>>`, and the keys and rows it checks
 * are lost the moment the value reaches a context: `createContext` fixes its
 * type when the context is made, and `useContext` hands a hook that fixed type
 * whatever the provider above it was given. A function that makes the context
 * and the hooks together is where the two parameters can be held, so this is a
 * factory rather than a generic provider.
 *
 * All three parameters come from the argument. Nothing is restated at the call
 * site, and an `Access` with no parameters of its own -- what `hydratePolicy`
 * returns for a matrix that crossed JSON -- yields the wide hooks, which are
 * the ones {@link useCan} and its siblings already export.
 *
 * Each call makes its own context, so two policies nest and each set of hooks
 * reads its own provider. The returned provider also publishes to the shared
 * context, so a component calling the package's own {@link useCan} underneath it
 * reads the same decision.
 *
 * A browser decides what a reader sees and enforces nothing. A key that
 * type-checks here says the policy this was built from declares it, and says
 * nothing about the document the provider was handed at runtime.
 *
 * @example
 * ```tsx
 * const shop = policy<Shopper, { listing: Listing }>()
 *   .for('listing', (p) =>
 *     p.allow('update', p.eq('object.sellerId', 'subject.id')),
 *   )
 *   .build();
 *
 * const { PolicyProvider, useCan, useCapabilities } = createPolicyContext(shop);
 *
 * <PolicyProvider subject={shopper}>…</PolicyProvider>;
 * useCan('listing', 'update', row);  // 'lsiting' is a compile error
 * useCapabilities()['listing.update'];  // 'listing.updte' is a compile error
 * ```
 */
export function createPolicyContext<
  Sub = Subject,
  R = AnyObjects,
  Keys extends string = string,
>(access: Access<Sub, R, Keys>): PolicyContext<Sub, R, Keys> {
  const BoundContext = createContext<PolicyContextValue | null>(null);
  const bound = access as Access;

  function useBound(): PolicyContextValue {
    return usePolicyValue(BoundContext);
  }

  return {
    PolicyProvider({ access: given, subject, context, children }) {
      const value = useMemo<PolicyContextValue>(
        () => ({
          access: (given as Access | undefined) ?? bound,
          subject: subject as Subject,
          now: context?.now ?? new Date(),
        }),
        [given, subject, context],
      );
      return (
        <SharedContext.Provider value={value}>
          <BoundContext.Provider value={value}>
            {children}
          </BoundContext.Provider>
        </SharedContext.Provider>
      );
    },
    useCan(key, action, object) {
      return useDecision(
        useBound(),
        key,
        action,
        object as Record<string, unknown> | undefined,
      );
    },
    useCanMany(key, action, objects) {
      return useDecisions(
        useBound(),
        key,
        action,
        objects as readonly Record<string, unknown>[],
      );
    },
    useCanFields(key, action, object, axis, proposed) {
      return useFieldDecision(
        useBound(),
        key,
        action,
        object as Record<string, unknown>,
        axis,
        proposed as Record<string, unknown> | undefined,
      );
    },
    useCapabilities() {
      return useEveryDecision(useBound());
    },
  };
}
