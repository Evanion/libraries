import { decideResolved } from './evaluate.js';
import { decideFields } from './fields.js';
import {
  InvalidFreshnessError,
  InvalidMatrixError,
  MissingFreshnessBudgetError,
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
  const { schema, permissions, maxStale } = matrix;
  const version = override ?? matrix.version;
  return deepFreeze({
    ...(version === undefined ? {} : { version }),
    ...(maxStale === undefined ? {} : { maxStale }),
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
  /**
   * When this holder last validated the document's freshness.
   *
   * A successful validation is a response that confirms a version, whether or
   * not the version changed, so the instant moves on a matching version as much
   * as on a completed refetch. Measuring the budget from here and not from the
   * moment a mismatch is noticed is what expires a holder whose poll silently
   * stopped: such a holder believes it is fresh and never starts a clock.
   *
   * Supplying it obliges the document to state `maxStale`. Omitting it claims no
   * freshness, which is what every matrix authored in one process does.
   */
  fetchedAt?: Instant;
  /**
   * A shorter local ceiling on staleness, in milliseconds.
   *
   * `min` with the document's `maxStale`, so a holder may tighten the owner's
   * bound and never extend it. The owner knows how fast a revocation has to take
   * effect and a holder choosing its own bound optimises for its own
   * availability, which is the wrong party's interest.
   */
  maxStale?: number;
}

/**
 * The instant past which every decision answers `stale-contract`, settled once.
 *
 * Both halves are constant for the life of the `Access`, so the per-call check
 * is one comparison against the epoch `ctxWith` already settled. `undefined` is
 * a holder that reported no `fetchedAt` and therefore claimed no freshness.
 */
function expiryOf(matrix: Matrix, options: AccessOptions): number | undefined {
  const { fetchedAt, maxStale: local } = options;
  if (fetchedAt === undefined) return undefined;

  const validated = settleNow(fetchedAt);
  if (Number.isNaN(validated)) {
    throw new InvalidFreshnessError('fetchedAt', 'is not an instant');
  }
  if (local !== undefined && (!Number.isFinite(local) || local < 0)) {
    throw new InvalidFreshnessError(
      'maxStale',
      'is not a finite, non-negative number of milliseconds',
    );
  }
  if (matrix.maxStale === undefined) throw new MissingFreshnessBudgetError();

  return validated + Math.min(matrix.maxStale, local ?? Infinity);
}

/**
 * The default object map: any key, any bag. What a document whose shapes
 * nothing declared at the type level answers for.
 */
export type AnyObjects = Record<string, Record<string, unknown>>;

/**
 * The action half of the keys `Keys` holds for one object kind.
 *
 * A document whose keys are open answers `string`, which is the action
 * parameter every query took before a builder declared a vocabulary. A
 * document that declares `'comment.update' | 'comment.read'` answers
 * `'update' | 'read'` for `'comment'`, so the action a query names is checked
 * the same way its key is.
 *
 * An empty `Keys` is a document that declares nothing, which a policy with no
 * blocks produces, and it answers `string` for the same reason an open one
 * does.
 *
 * A kind the union holds no key for answers `string` as well. The builder
 * cannot reach that branch, since every block contributes a kind and its keys
 * together, and a caller naming `R` and `Keys` by hand over an adopted document
 * can: `parseMatrix<Sub, { device: Device }, 'telemetry.read'>` states a row
 * type for a kind it named no key for. `string` leaves that kind answerable and
 * `never` would make every query on it uncallable, which is a refusal the
 * document never asked for.
 */
export type ActionOf<Keys extends string, K extends string> = [Keys] extends [
  never,
]
  ? string
  : string extends Keys
    ? string
    : [Extract<Keys, `${K}.${string}`>] extends [never]
      ? string
      : Keys extends `${K}.${infer Act}`
        ? Act
        : never;

/**
 * One subject's decisions, bound to that subject and one clock instant.
 *
 * `R` is the key -> object-type map the `Access` it came from carries, so the
 * binding survives the member that hands it back. `Keys` is the permission-key
 * union from the same place, and `capabilities()` answers under those keys.
 * The subject is absent from both, because `authorize` already took it and
 * checked it there.
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
export interface Authorized<R = AnyObjects, Keys extends string = string> {
  can<K extends keyof R & string>(
    key: K,
    action: ActionOf<Keys, K>,
    object?: Partial<R[K]>,
  ): Decision;
  canMany<K extends keyof R & string>(
    key: K,
    action: ActionOf<Keys, K>,
    objects: readonly Partial<R[K]>[],
  ): Decision[];
  canFields<K extends keyof R & string>(
    key: K,
    action: ActionOf<Keys, K>,
    object: Partial<R[K]>,
    axis: 'read' | 'write',
    proposed?: Partial<R[K]>,
  ): FieldDecision;
  capabilities(): Record<Keys, Decision>;
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
export interface BoundKind<Sub, Obj, Act extends string = string> {
  can(
    subject: Sub,
    action: Act,
    object?: Partial<Obj>,
    now?: Instant,
  ): Decision;
  canMany(
    subject: Sub,
    action: Act,
    objects: readonly Partial<Obj>[],
    now?: Instant,
  ): Decision[];
  canFields(
    subject: Sub,
    action: Act,
    object: Partial<Obj>,
    axis: 'read' | 'write',
    proposed?: Partial<Obj>,
    now?: Instant,
  ): FieldDecision;
  /** `Access.readsObject` for this kind, with the key already bound. */
  readsObject(action: Act): boolean;
}

/**
 * The evaluator over one frozen document.
 *
 * `Sub` is the subject the matrix was written against, `R` is the key ->
 * object-type map, and `Keys` is the permission keys the document declares.
 * All three default to the open forms a JSON document carries, and at the
 * defaults `keyof R & string` is `string`, `Partial<R[K]>` is a bag of
 * unknowns and `capabilities()` answers under any key, so a foreign document
 * accepts any key, any action and any object. A typed author names them
 * through the builder, and every query checks its key, its action and its
 * object against them.
 */
export interface Access<
  Sub = Subject,
  R = AnyObjects,
  Keys extends string = string,
> {
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
    action: ActionOf<Keys, K>,
    object?: Partial<R[K]>,
    now?: Instant,
  ): Decision;
  canMany<K extends keyof R & string>(
    subject: Sub,
    key: K,
    action: ActionOf<Keys, K>,
    objects: readonly Partial<R[K]>[],
    now?: Instant,
  ): Decision[];
  canFields<K extends keyof R & string>(
    subject: Sub,
    key: K,
    action: ActionOf<Keys, K>,
    object: Partial<R[K]>,
    axis: 'read' | 'write',
    proposed?: Partial<R[K]>,
    now?: Instant,
  ): FieldDecision;
  /**
   * Every action-level decision for this subject, under the document's keys.
   *
   * The key of each entry is the permission key, `'comment.update'`. A
   * document that declares its keys answers a record typed by them, so a
   * caller reads one by name and a misspelled name is a compile error.
   */
  capabilities(subject: Sub, now?: Instant): Record<Keys, Decision>;
  authorize(subject: Sub, opts?: { now?: Instant }): Authorized<R, Keys>;
  /** A handle with one object kind bound, so the key is named once. */
  object<K extends keyof R & string>(
    key: K,
  ): BoundKind<Sub, R[K], ActionOf<Keys, K>>;
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
  readsObject<K extends keyof R & string>(
    key: K,
    action: ActionOf<Keys, K>,
  ): boolean;
}

/**
 * The permission keys an `Access` carries, lifted back out of its type.
 *
 * A producer that authored its policy with the builder publishes the union its
 * blocks accumulated: `export type ShopPermissions = KeysOf<typeof access>`. A
 * consumer in the same build imports that and hands it to `parseMatrix`, so the
 * two sides agree by construction and a key the producer renames breaks the
 * consumer's compile.
 *
 * The boundary: this reads a TypeScript type, so it reaches only a consumer
 * that compiles against the producer's source. A consumer in another
 * repository, which is the topology the published-contract pages teach, holds
 * the document and no types at all, and states the union it expects by hand as
 * the third argument of `parseMatrix`. Both are assertions about a document
 * neither side validated at the type level; one is kept honest by the compiler
 * and the other by the reader.
 */
export type KeysOf<A> =
  A extends Access<never, never, infer Keys> ? Keys : never;

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
 * `Sub`, `R` and `Keys` are the compile-time surface; the engine underneath
 * takes plain bags and string keys, so the body is written against the erased
 * form and cast once at the end. Naming none of them is the foreign path, where
 * the defaults make every signature the untyped one.
 *
 * A holder that reports `fetchedAt` gets a freshness budget out of the
 * document's `maxStale`. Past `fetchedAt + min(maxStale, options.maxStale)`,
 * `can`, `canMany`, `canFields` and `capabilities` answer `stale-contract` for
 * every key. `readsObject` keeps answering, because whether a permission names
 * an `object.*` path is a fact about the document and no claim about the
 * present.
 */
export function hydratePolicy<
  Sub = Subject,
  R = AnyObjects,
  Keys extends string = string,
>(matrix: Matrix, options: AccessOptions = {}): Access<Sub, R, Keys> {
  const frozen = adopt(matrix, options.version);
  const permissions = frozen.permissions;
  const index = buildIndex(permissions);
  const closed = options.closed ?? false;
  const expiresAt = expiryOf(frozen, options);

  /**
   * Whether the document has run out of budget at this settled instant.
   *
   * A `now` that does not parse is NaN and the comparison is false, so the call
   * proceeds and lands on `unusable-clock` at every permission that reads the
   * clock. An unusable clock cannot judge staleness either.
   */
  const stale = (settled: number): boolean =>
    expiresAt !== undefined && settled > expiresAt;

  const staleDecision = (key: string): Decision => ({
    key,
    allowed: false,
    reason: 'stale-contract',
  });

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
    // Ahead of the key lookup: a document past its budget carries no claim
    // about the present, and that includes its claim about which keys it holds.
    const ctx = ctxWith(subject, object, now);
    if (stale(ctx.now)) return staleDecision(`${key}.${action}`);
    objectFor(key);
    const permission = permissionFor(key, action);
    if (!permission) {
      return {
        key: `${key}.${action}`,
        allowed: false,
        reason: 'unknown-action',
      };
    }
    return decideResolved(permission, ctx);
  };

  const canMany = (
    subject: Subject,
    key: string,
    action: string,
    objects: readonly Record<string, unknown>[],
    now?: Instant,
  ): Decision[] => {
    // One clock for the whole list: the objects differ, the instant does not.
    const settled = ctxWith(subject, undefined, now).now;
    if (stale(settled)) {
      return objects.map(() => staleDecision(`${key}.${action}`));
    }
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
    const ctx = ctxWith(subject, object, now);
    if (stale(ctx.now)) {
      return {
        allowed: false,
        action: staleDecision(`${key}.${action}`),
        fields: {},
        reasons: {},
      };
    }
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
        stale(ctx.now)
          ? staleDecision(permission.key)
          : decideResolved(permission, ctx),
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

  return access as unknown as Access<Sub, R, Keys>;
}
