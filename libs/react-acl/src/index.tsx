'use client';

/**
 * The React adapter: a provider and hooks over an already-built access matrix.
 *
 * Evaluation lives in `@evanion/acl`. Nothing here decides anything;
 * this layer supplies the context and reads decisions. It serves both an
 * RSC-style graph and a traditional Node server/client split from one surface.
 */

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Access, Subject } from '@evanion/acl';
import type { Decision, FieldDecision, Instant } from '@evanion/acl';

export type { Access, Subject } from '@evanion/acl';
export type {
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

interface PolicyContextValue {
  access: Access;
  subject: Subject;
  now: Instant;
}

const PolicyContext = createContext<PolicyContextValue | null>(null);

export interface PolicyProviderProps {
  access: Access;
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

export function PolicyProvider({
  access,
  subject,
  context,
  children,
}: PolicyProviderProps) {
  const value = useMemo<PolicyContextValue>(
    () => ({ access, subject, now: context?.now ?? new Date() }),
    [access, subject, context],
  );
  return (
    <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>
  );
}

function usePolicy(): PolicyContextValue {
  const value = useContext(PolicyContext);
  if (!value) {
    throw new Error(
      'useCan must be called inside a <PolicyProvider> (from @evanion/react-acl)',
    );
  }
  return value;
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
  const { access, subject, now } = usePolicy();
  return useMemo(
    () => access.can(subject, key, action, object, now),
    // object identity is part of the memo key; a changed instance must not
    // return a stale decision.
    [access, subject, key, action, object, now],
  );
}

/** A bulk decision array for a list, parallel to the input. */
export function useCanMany(
  key: string,
  action: string,
  objects: readonly Record<string, unknown>[],
): Decision[] {
  const { access, subject, now } = usePolicy();
  return useMemo(
    () => access.canMany(subject, key, action, objects, now),
    [access, subject, key, action, objects, now],
  );
}

/** The field-level decision for one action on one axis. */
export function useCanFields(
  key: string,
  action: string,
  object: Record<string, unknown>,
  axis: 'read' | 'write',
  proposed?: Record<string, unknown>,
): FieldDecision {
  const { access, subject, now } = usePolicy();
  return useMemo(
    () => access.canFields(subject, key, action, object, axis, proposed, now),
    [access, subject, key, action, object, axis, proposed, now],
  );
}

/** Every action-level decision for the current subject (no object). */
export function useCapabilities(): Record<string, Decision> {
  const { access, subject, now } = usePolicy();
  return useMemo(
    () => access.capabilities(subject, now),
    [access, subject, now],
  );
}
