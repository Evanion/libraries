import { decideResolved } from './evaluate.js';
import { decideFields } from './fields.js';
import {
  InvalidMatrixError,
  UnknownObjectKeyError,
  UnknownPermissionError,
} from './errors.js';
import { validateMatrix } from './validate.js';
import { settleNow } from './conditions.js';
import { permissionReadsObject } from './reads-object.js';
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
function adopt(matrix: Matrix, override: string | number | undefined): Matrix {
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

/**
 * The default object map: any key, any bag. What a document whose shapes
 * nothing declared at the type level answers for.
 */
export type AnyObjects = Record<string, Record<string, unknown>>;

/**
 * One subject's decisions, bound to that subject and one clock instant.
 *
 * `R` is the key -> object-type map the `Access` it came from carries, so the
 * binding survives the member that hands it back. Only `R` appears, because
 * `authorize` already took the subject and checked it there.
 *
 * Decisions only. It carries no `matrix`, `version` or `schema`, and a caller
 * that needs the document alongside the handle holds the `Access` it came from
 * -- which every such caller already imports, since that is where `authorize`
 * comes from. The matrix is one frozen document evaluated against many
 * subjects, and hanging it off a subject-bound handle would offer it as though
 * it were this subject's matrix, which is the per-subject snapshot this library
 * exists to avoid shipping.
 *
 * `readsObject` is absent for the same reason in reverse: it is a fact about
 * the document, not about this subject.
 */
export interface Authorized<R = AnyObjects> {
  can<K extends keyof R & string>(
    key: K,
    action: string,
    object?: Partial<R[K]>,
  ): Decision;
  canMany<K extends keyof R & string>(
    key: K,
    action: string,
    objects: readonly Partial<R[K]>[],
  ): Decision[];
  canFields<K extends keyof R & string>(
    key: K,
    action: string,
    object: Partial<R[K]>,
    axis: 'read' | 'write',
    proposed?: Partial<R[K]>,
  ): FieldDecision;
  capabilities(): Record<string, Decision>;
}

/**
 * One object kind bound to a handle, so the key is named once.
 *
 * Every object parameter takes `Partial<Obj>`. A caller holding a projection --
 * a list row carrying `{ id, ownerId }` -- is the case `unevaluable` and
 * `missing` answer, and the engine reads every object field through an own-key
 * guard. The subject stays complete: an absent `subject.*` path is a definite
 * miss, so a projected subject refuses with `no-rule-matched` and names nothing
 * to fetch.
 */
export interface BoundKind<Sub, Obj> {
  can(
    subject: Sub,
    action: string,
    object?: Partial<Obj>,
    now?: Instant,
  ): Decision;
  canMany(
    subject: Sub,
    action: string,
    objects: readonly Partial<Obj>[],
    now?: Instant,
  ): Decision[];
  canFields(
    subject: Sub,
    action: string,
    object: Partial<Obj>,
    axis: 'read' | 'write',
    proposed?: Partial<Obj>,
    now?: Instant,
  ): FieldDecision;
  /** `Access.readsObject` for this kind, with the key already bound. */
  readsObject(action: string): boolean;
}

/**
 * The evaluator over one frozen document.
 *
 * `Sub` is the subject the matrix was written against and `R` is the key ->
 * object-type map. Both default to the open bags a JSON document carries, and
 * at the defaults `keyof R & string` is `string` and `Partial<R[K]>` is a bag
 * of unknowns, so a foreign document accepts any key and any object. A typed
 * author names both, and every query checks its key and its object against
 * them.
 */
export interface Access<Sub = Subject, R = AnyObjects> {
  /**
   * The frozen document. It round-trips through JSON, so an SSR crossing is
   * `hydratePolicy(JSON.parse(JSON.stringify(access.matrix)))` with nothing
   * assembled around it.
   */
  readonly matrix: Readonly<Matrix>;
  /** The effective version: `access.matrix.version`, lifted for convenience. */
  readonly version: string | number | undefined;
  /** The declared shapes, when the document carries them. */
  readonly schema: MatrixSchema | undefined;
  can<K extends keyof R & string>(
    subject: Sub,
    key: K,
    action: string,
    object?: Partial<R[K]>,
    now?: Instant,
  ): Decision;
  canMany<K extends keyof R & string>(
    subject: Sub,
    key: K,
    action: string,
    objects: readonly Partial<R[K]>[],
    now?: Instant,
  ): Decision[];
  canFields<K extends keyof R & string>(
    subject: Sub,
    key: K,
    action: string,
    object: Partial<R[K]>,
    axis: 'read' | 'write',
    proposed?: Partial<R[K]>,
    now?: Instant,
  ): FieldDecision;
  capabilities(subject: Sub, now?: Instant): Record<string, Decision>;
  authorize(subject: Sub, opts?: { now?: Instant }): Authorized<R>;
  /** A handle with one object kind bound, so the key is named once. */
  object<K extends keyof R & string>(key: K): BoundKind<Sub, R[K]>;
  /**
   * Whether this permission needs the object row to reach a decision at all.
   *
   * A caller that decides before it has the row -- an HTTP guard in front of
   * the handler that loads it -- gets `unevaluable` from every object-dependent
   * permission, and `unevaluable` is not a refusal: it means fetch the object
   * and ask again. Without this, such a caller cannot tell that answer apart
   * from "this particular call happened to lack data", so it has to wave the
   * request through and trust that something downstream decides properly.
   *
   * This says which is which, from the document rather than from a call. A
   * guard on a permission that reads the object can refuse loudly, or record
   * that the real decision is owed further in, instead of hoping.
   *
   * True when any allow rule or any deny rule of this permission names an
   * `object.*` path, on either operand. Field rules are not counted: a
   * `transitions` config reads the object, but only on the `canFields` write
   * axis, where the caller holds the row already.
   *
   * Subject-independent, so it takes no subject. An unknown permission reads
   * false: it decides `unknown-action` without a row. Unknown keys behave as
   * they do for `can` -- open mode throws, `closed` mode answers.
   */
  readsObject<K extends keyof R & string>(key: K, action: string): boolean;
}

function buildIndex(
  permissions: readonly Permission[],
): Map<string, Permission> {
  const index = new Map<string, Permission>();
  for (const permission of permissions) index.set(permission.key, permission);
  return index;
}

/**
 * The evaluator over a matrix document.
 *
 * `Sub` and `R` are the compile-time surface; the engine underneath takes plain
 * bags and string keys, so the body is written against the erased form and cast
 * once at the end. Naming neither is the foreign path, where the defaults make
 * every signature the untyped one.
 */
export function createPolicy<Sub = Subject, R = AnyObjects>(
  matrix: Matrix,
  options: AccessOptions = {},
): Access<Sub, R> {
  const frozen = adopt(matrix, options.version);
  const permissions = frozen.permissions;
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

  const readsObject = (key: string, action: string): boolean => {
    objectFor(key);
    const permission = permissionFor(key, action);
    return permission ? permissionReadsObject(permission) : false;
  };

  /**
   * The settled context for one call. `now` is parsed here and nowhere else, so
   * a matrix with many time conditions reads one epoch. An omitted `now` is the
   * wall clock; one that does not parse stays NaN, and every permission whose
   * decision reads it refuses with `unusable-clock`.
   */
  const ctxWith = (
    subject: Subject,
    object: Record<string, unknown> | undefined,
    now: Instant | undefined,
  ): ResolvedContext => ({
    subject,
    object,
    now: settleNow(now),
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
    return decideResolved(permission, ctxWith(subject, object, now));
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
      decideResolved(permission, { subject, object, now: settled }),
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
    const decision = decideResolved(permission, ctx);
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
    return Object.fromEntries(
      permissions.map((permission) => [
        permission.key,
        decideResolved(permission, ctx),
      ]),
    );
  };

  const authorize = (
    subject: Subject,
    opts?: { now?: Instant },
  ): Authorized => {
    // Settled here so the bound handle carries an epoch every call reuses.
    const now = settleNow(opts?.now);
    return {
      can: (key, action, object) => can(subject, key, action, object, now),
      canMany: (key, action, objects) =>
        canMany(subject, key, action, objects, now),
      canFields: (key, action, object, axis, proposed) =>
        canFields(subject, key, action, object, axis, proposed, now),
      capabilities: () => capabilities(subject, now),
    };
  };

  const object = (
    key: string,
  ): BoundKind<Subject, Record<string, unknown>> => ({
    can: (subject, action, object, now) =>
      can(subject, key, action, object, now),
    canMany: (subject, action, objects, now) =>
      canMany(subject, key, action, objects, now),
    canFields: (subject, action, object, axis, proposed, now) =>
      canFields(subject, key, action, object, axis, proposed, now),
    readsObject: (action) => readsObject(key, action),
  });

  const access = {
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
    object,
    readsObject,
  };

  return access as unknown as Access<Sub, R>;
}
