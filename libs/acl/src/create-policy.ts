import { decide } from './evaluate.js';
import { decideFields } from './fields.js';
import { buildGraph } from './graph.js';
import { UnknownObjectKeyError, UnknownPermissionError } from './errors.js';
import { validateMatrix } from './validate.js';
import type {
  Decision,
  EvaluationContext,
  FieldDecision,
  Matrix,
  Permission,
} from './types.js';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

/** A subject for a single call: the actor, a plain object of attributes. */
export type Subject = Record<string, unknown>;

export interface AccessOptions {
  /** The matrix version, surfaced for the fetch-and-revalidate contract. */
  version?: number;
  /**
   * Fail closed on unknown permissions/objects (the foreign/untrusted mode).
   * Defaults to false: a local matrix throws on an unknown key.
   */
  closed?: boolean;
}

export interface Authorized {
  can(key: string, action: string, object?: Record<string, unknown>): Decision;
  canMany(
    key: string,
    action: string,
    objects: readonly Record<string, unknown>[],
  ): Decision[];
  canFields(
    key: string,
    action: string,
    object: Record<string, unknown>,
    axis: 'read' | 'write',
    proposed?: Record<string, unknown>,
  ): FieldDecision;
  capabilities(): Record<string, Decision>;
}

export interface Access {
  readonly matrix: Readonly<Matrix>;
  readonly version: number | undefined;
  can(
    subject: Subject,
    key: string,
    action: string,
    object?: Record<string, unknown>,
    now?: Date,
  ): Decision;
  canMany(
    subject: Subject,
    key: string,
    action: string,
    objects: readonly Record<string, unknown>[],
    now?: Date,
  ): Decision[];
  canFields(
    subject: Subject,
    key: string,
    action: string,
    object: Record<string, unknown>,
    axis: 'read' | 'write',
    proposed?: Record<string, unknown>,
    now?: Date,
  ): FieldDecision;
  capabilities(subject: Subject, now?: Date): Record<string, Decision>;
  authorize(subject: Subject, opts?: { now?: Date }): Authorized;
}

function buildIndex(matrix: Matrix): Map<string, Permission> {
  const index = new Map<string, Permission>();
  for (const permission of matrix) index.set(permission.key, permission);
  return index;
}

function resolve(
  index: Map<string, Permission>,
  order: readonly string[],
  ctx: EvaluationContext,
): Map<string, Decision> {
  const resolved = new Map<string, Decision>();
  for (const key of order) {
    const permission = index.get(key);
    if (!permission) continue;
    resolved.set(key, decide(permission, ctx, resolved));
  }
  return resolved;
}

export function createPolicy(
  matrix: Matrix,
  options: AccessOptions = {},
): Access {
  validateMatrix(matrix);
  const frozen = deepFreeze(structuredClone(matrix)) as Matrix;
  const graph = buildGraph(frozen);
  const index = buildIndex(frozen);
  const closed = options.closed ?? false;
  const version = options.version;

  const objectFor = (key: string): void => {
    if (closed) return;
    if (!frozen.some((p) => p.object === key)) {
      throw new UnknownObjectKeyError(key);
    }
  };

  const permissionFor = (
    key: string,
    action: string,
  ): Permission | undefined => {
    const permission = index.get(`${key}.${action}`);
    if (permission) return permission;
    if (closed) return undefined;
    throw new UnknownPermissionError(`${key}.${action}`);
  };

  const ctxWith = (
    subject: Subject,
    object: Record<string, unknown> | undefined,
    now: Date | undefined,
  ): EvaluationContext => ({
    subject,
    object,
    now: now ?? new Date(),
  });

  const can = (
    subject: Subject,
    key: string,
    action: string,
    object?: Record<string, unknown>,
    now?: Date,
  ): Decision => {
    objectFor(key);
    const permission = permissionFor(key, action);
    if (!permission) {
      return {
        key: `${key}.${action}`,
        allowed: false,
        reason: 'unknown-action',
      };
    }
    return decide(permission, ctxWith(subject, object, now), new Map());
  };

  const canMany = (
    subject: Subject,
    key: string,
    action: string,
    objects: readonly Record<string, unknown>[],
    now?: Date,
  ): Decision[] => {
    objectFor(key);
    const permission = permissionFor(key, action);
    if (!permission) {
      return objects.map(() => ({
        key: `${key}.${action}`,
        allowed: false,
        reason: 'unknown-action',
      }));
    }
    return objects.map((object) =>
      decide(permission, ctxWith(subject, object, now), new Map()),
    );
  };

  const canFields = (
    subject: Subject,
    key: string,
    action: string,
    object: Record<string, unknown>,
    axis: 'read' | 'write',
    proposed?: Record<string, unknown>,
    now?: Date,
  ): FieldDecision => {
    objectFor(key);
    const permission = permissionFor(key, action);
    if (!permission) return { allowed: false, fields: {}, reasons: {} };
    return decideFields(permission, ctxWith(subject, object, now), axis, proposed);
  };

  const capabilities = (
    subject: Subject,
    now?: Date,
  ): Record<string, Decision> => {
    const ctx = ctxWith(subject, undefined, now);
    const resolved = resolve(index, graph.order, ctx);
    return Object.fromEntries(resolved);
  };

  const authorize = (
    subject: Subject,
    opts?: { now?: Date },
  ): Authorized => {
    const now = opts?.now ?? new Date();
    return {
      can: (key, action, object) => can(subject, key, action, object, now),
      canMany: (key, action, objects) =>
        canMany(subject, key, action, objects, now),
      canFields: (key, action, object, axis, proposed) =>
        canFields(subject, key, action, object, axis, proposed, now),
      capabilities: () => capabilities(subject, now),
    };
  };

  return {
    get matrix() {
      return frozen;
    },
    get version() {
      return version;
    },
    can,
    canMany,
    canFields,
    capabilities,
    authorize,
  };
}
