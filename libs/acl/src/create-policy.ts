import { decideResolved } from './evaluate.js';
import { decideFields } from './fields.js';
import { buildGraph } from './graph.js';
import {
  InvalidMatrixError,
  UnknownObjectKeyError,
  UnknownPermissionError,
} from './errors.js';
import { validateMatrix } from './validate.js';
import { settleNow } from './conditions.js';
import type { ResolvedContext } from './conditions.js';
import type {
  Decision,
  FieldDecision,
  Instant,
  Matrix,
  MatrixSchema,
  Permission,
} from './types.js';

/**
 * Freezes a value and everything reachable from it.
 *
 * The walk is an explicit stack over a structure whose depth the matrix decides,
 * and a seen-set carries it over a shape that refers back to itself, which a
 * clone preserves.
 */
function deepFreeze<T>(value: T): T {
  const stack: unknown[] = [value];
  const seen = new Set<unknown>();

  while (stack.length > 0) {
    const at = stack.pop();
    if (at === null || typeof at !== 'object') continue;
    if (seen.has(at)) continue;
    seen.add(at);
    Object.freeze(at);
    if (at instanceof Date) continue;
    for (const nested of Object.values(at)) stack.push(nested);
  }

  return value;
}

/**
 * Clones one permission for the frozen matrix.
 *
 * Cloning is per permission so a value the structured clone algorithm refuses —
 * a function, a symbol, a structure nested deeper than it walks — is reported
 * against the permission holding it.
 */
function cloneNode(permission: Permission): Permission {
  try {
    return structuredClone(permission);
  } catch {
    throw new InvalidMatrixError(
      `permission "${permission.key}" holds a value that cannot be cloned: a function, a symbol, or a structure nested deeper than the clone walks`,
    );
  }
}

/**
 * Clones the declared shapes for the frozen document.
 *
 * Validation accepted a schema of strings, so the only way this refuses is a
 * getter or a proxy the caller hung off the object it passed in.
 */
function cloneSchema(schema: MatrixSchema): MatrixSchema {
  try {
    return structuredClone(schema);
  } catch {
    throw new InvalidMatrixError(
      'the schema holds a value that cannot be cloned: a function, a symbol, or a structure nested deeper than the clone walks',
    );
  }
}

/** Whether a value is shaped like a document at all, before anything reads it. */
function isEnvelope(matrix: Matrix): boolean {
  return (
    typeof matrix === 'object' && matrix !== null && !Array.isArray(matrix)
  );
}

/**
 * The frozen document, rebuilt from one read of each envelope member.
 *
 * The envelope is rebuilt rather than cloned whole, so an absent version or
 * schema stays absent through a JSON round trip instead of becoming a key
 * holding undefined. The option wins over the document's version, and the
 * winner is what freezes, so what crosses an SSR boundary is the version that
 * decided.
 *
 * Every member is read once, into this copy. Nothing downstream reads the
 * caller's object again.
 */
function rebuild(
  matrix: Matrix,
  override: string | number | undefined,
): Matrix {
  const { schema, permissions } = matrix;
  const version = override ?? matrix.version;
  return deepFreeze({
    ...(version === undefined ? {} : { version }),
    ...(schema === undefined ? {} : { schema: cloneSchema(schema) }),
    permissions: Array.isArray(permissions)
      ? permissions.map(cloneNode)
      : permissions,
  }) as Matrix;
}

/**
 * The document the engine evaluates: a frozen deep copy, validated as the copy.
 *
 * Validation and evaluation have to read the same bytes. A caller's document is
 * a live object, and an accessor or a proxy on it answers a second read however
 * it likes — a `when` that validates as a condition and clones as the empty,
 * unconditional form is an open grant the gate approved. Taking the copy first
 * and checking the copy leaves nothing between the two reads.
 *
 * A value that is not an envelope is handed to the gate as it arrived, which
 * owns the message for that and throws before anything evaluates.
 */
function adopt(
  matrix: Matrix,
  override: string | number | undefined,
): Matrix {
  const frozen = isEnvelope(matrix) ? rebuild(matrix, override) : matrix;
  validateMatrix(frozen);
  return frozen;
}

/** A subject for a single call: the actor, a plain object of attributes. */
export type Subject = Record<string, unknown>;

export interface AccessOptions {
  /**
   * Overrides the document's `version`.
   *
   * The document states the version a producer shipped. This states the version
   * the construction site is actually running, which is not the same thing
   * whenever the site composes the document with something else — a compliance
   * deny overlay merged in before construction gives an effective version
   * covering both inputs, and the authored document cannot know about it. The
   * option wins for that reason, and the frozen `access.matrix` carries the
   * winner, so what crosses an SSR boundary is the version that decided.
   *
   * A string or a number: the revalidate contract compares with `!==`, so a
   * digest or a composite (`orders@7+veto@41`) works where a number cannot.
   */
  version?: string | number;
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
  /**
   * The frozen document. It round-trips through JSON, so an SSR crossing is
   * `createPolicy(JSON.parse(JSON.stringify(access.matrix)))` with nothing
   * assembled around it.
   */
  readonly matrix: Readonly<Matrix>;
  /** The effective version: `access.matrix.version`, lifted for convenience. */
  readonly version: string | number | undefined;
  /** The declared shapes, when the document carries them. */
  readonly schema: MatrixSchema | undefined;
  can(
    subject: Subject,
    key: string,
    action: string,
    object?: Record<string, unknown>,
    now?: Instant,
  ): Decision;
  canMany(
    subject: Subject,
    key: string,
    action: string,
    objects: readonly Record<string, unknown>[],
    now?: Instant,
  ): Decision[];
  canFields(
    subject: Subject,
    key: string,
    action: string,
    object: Record<string, unknown>,
    axis: 'read' | 'write',
    proposed?: Record<string, unknown>,
    now?: Instant,
  ): FieldDecision;
  capabilities(subject: Subject, now?: Instant): Record<string, Decision>;
  authorize(subject: Subject, opts?: { now?: Instant }): Authorized;
}

function buildIndex(
  permissions: readonly Permission[],
): Map<string, Permission> {
  const index = new Map<string, Permission>();
  for (const permission of permissions) index.set(permission.key, permission);
  return index;
}

function resolve(
  index: Map<string, Permission>,
  order: readonly string[],
  ctx: ResolvedContext,
): Map<string, Decision> {
  const resolved = new Map<string, Decision>();
  for (const key of order) {
    const permission = index.get(key);
    if (!permission) continue;
    resolved.set(key, decideResolved(permission, ctx, resolved));
  }
  return resolved;
}

/**
 * The transitive dependencies of `key` plus `key` itself, in the graph's
 * dependency order. Resolving this slice decides one permission's cascade
 * without folding over the whole matrix.
 */
function cascadeOf(
  index: Map<string, Permission>,
  order: readonly string[],
  key: string,
): readonly string[] {
  const needed = new Set<string>([key]);
  const queue = [key];
  while (queue.length) {
    const at = queue.pop() as string;
    for (const parent of index.get(at)?.dependsOn ?? []) {
      if (needed.has(parent)) continue;
      needed.add(parent);
      queue.push(parent);
    }
  }
  return order.filter((k) => needed.has(k));
}

export function createPolicy(
  matrix: Matrix,
  options: AccessOptions = {},
): Access {
  const frozen = adopt(matrix, options.version);
  const permissions = frozen.permissions;
  const graph = buildGraph(permissions);
  const index = buildIndex(permissions);
  const closed = options.closed ?? false;

  const objectFor = (key: string): void => {
    if (closed) return;
    if (!permissions.some((p) => p.object === key)) {
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

  const cascades = new Map<string, readonly string[]>();
  const cascadeFor = (key: string): readonly string[] => {
    const cached = cascades.get(key);
    if (cached) return cached;
    const slice = cascadeOf(index, graph.order, key);
    cascades.set(key, slice);
    return slice;
  };

  /**
   * One permission's decision with its `dependsOn` cascade resolved against the
   * same context, so every entry point answers what `capabilities` answers.
   */
  const decideCascaded = (
    permission: Permission,
    ctx: ResolvedContext,
  ): Decision => {
    const resolved = resolve(index, cascadeFor(permission.key), ctx);
    return resolved.get(permission.key) as Decision;
  };

  /**
   * The settled context for one call. `now` is parsed here and nowhere else, so
   * a matrix with many time conditions reads one epoch. An omitted `now` is the
   * wall clock; one that does not parse stays NaN and fails its conditions.
   */
  const ctxWith = (
    subject: Subject,
    object: Record<string, unknown> | undefined,
    now: Instant | undefined,
  ): ResolvedContext => ({
    subject,
    object,
    now: now === undefined ? Date.now() : settleNow(now),
  });

  const can = (
    subject: Subject,
    key: string,
    action: string,
    object?: Record<string, unknown>,
    now?: Instant,
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
    return decideCascaded(permission, ctxWith(subject, object, now));
  };

  const canMany = (
    subject: Subject,
    key: string,
    action: string,
    objects: readonly Record<string, unknown>[],
    now?: Instant,
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
    // One clock for the whole list: the objects differ, the instant does not.
    const settled = ctxWith(subject, undefined, now).now;
    return objects.map((object) =>
      decideCascaded(permission, { subject, object, now: settled }),
    );
  };

  const canFields = (
    subject: Subject,
    key: string,
    action: string,
    object: Record<string, unknown>,
    axis: 'read' | 'write',
    proposed?: Record<string, unknown>,
    now?: Instant,
  ): FieldDecision => {
    objectFor(key);
    const permission = permissionFor(key, action);
    if (!permission) {
      return {
        allowed: false,
        action: {
          key: `${key}.${action}`,
          allowed: false,
          reason: 'unknown-action',
        },
        fields: {},
        reasons: {},
      };
    }
    const ctx = ctxWith(subject, object, now);
    // The field maps answer "what would be editable" and are computed whatever
    // the action decides, so a caller can explain a block with the same result
    // it renders a form from. Only `allowed` is gated on the action.
    const decision = decideCascaded(permission, ctx);
    const outcome = decideFields(permission, ctx, axis, proposed);
    return {
      allowed: decision.allowed && outcome.allowed,
      action: decision,
      fields: outcome.fields,
      reasons: outcome.reasons,
    };
  };

  const capabilities = (
    subject: Subject,
    now?: Instant,
  ): Record<string, Decision> => {
    const ctx = ctxWith(subject, undefined, now);
    const resolved = resolve(index, graph.order, ctx);
    return Object.fromEntries(resolved);
  };

  const authorize = (
    subject: Subject,
    opts?: { now?: Instant },
  ): Authorized => {
    // Settled here so the bound handle carries an epoch every call reuses.
    const now = opts?.now === undefined ? Date.now() : settleNow(opts.now);
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
      return frozen.version;
    },
    get schema() {
      return frozen.schema;
    },
    can,
    canMany,
    canFields,
    capabilities,
    authorize,
  };
}
