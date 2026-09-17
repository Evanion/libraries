import { AclConfigError } from './errors.js';
import {
  createPolicy,
  type Access,
  type Authorized,
  type Subject as SubjectBag,
} from './create-policy.js';
import type {
  Condition,
  Decision,
  FieldDecision,
  FieldRules,
  Instant,
  Matrix,
  Permission,
} from './types.js';

/** The namespaced paths one level deep into `T`, prefixed with `P`. */
export type Paths<T, P extends string> = {
  [K in keyof T & string]: `${P}.${K}`;
}[keyof T & string];

/**
 * `S` when it names a path on this resource, and an error message otherwise.
 *
 * The failure branch is the parameter type, so the compiler's message names the
 * offending path instead of reporting an opaque assignability mismatch.
 */
export type Valid<S extends string, Sub, Obj> = S extends
  Paths<Sub, 'subject'> | Paths<Obj, 'object'> | 'now'
  ? S
  : `unknown path '${S}' on this resource`;

/**
 * An operand shaped like a namespaced path is validated as one; anything else is
 * a literal value and passes through untouched. The shape is the only
 * discriminator there is, and it is load-bearing: without it a mistyped
 * `'subject.idd'` is indistinguishable from a deliberate string literal and the
 * condition compares a field against that text.
 */
export type Operand<B, Sub, Obj> = B extends
  `subject.${string}` | `object.${string}` | 'now'
  ? Valid<B & string, Sub, Obj>
  : B;

type Node =
  | { kind: 'condition'; condition: Condition }
  | { kind: 'and'; parts: readonly Node[] }
  | { kind: 'or'; parts: readonly Node[] };

/** An opaque condition tree. Built by the helpers, flattened by the builder. */
export interface Cond {
  readonly node: Node;
}

function cond(condition: Condition): Cond {
  return { node: { kind: 'condition', condition } };
}

/**
 * The comparand half of a condition. The same path/literal discriminator the
 * types apply, applied to the value.
 */
function operand(value: unknown): { path: string } | { value: unknown } {
  return typeof value === 'string' &&
    (value === 'now' ||
      value.startsWith('subject.') ||
      value.startsWith('object.'))
    ? { path: value }
    : { value };
}

/** Disjunctive normal form: one branch per rule, AND-ed conditions inside. */
function toBranches(node: Node): readonly (readonly Condition[])[] {
  if (node.kind === 'condition') return [[node.condition]];
  if (node.kind === 'or') return node.parts.flatMap(toBranches);
  return node.parts.reduce<readonly (readonly Condition[])[]>(
    (prefixes, part) =>
      toBranches(part).flatMap((branch) =>
        prefixes.map((prefix) => [...prefix, ...branch]),
      ),
    [[]],
  );
}

/** The conditions of one `allow`/`deny` call, AND-ed and flattened to rules. */
function toRules(
  conditions: readonly Cond[],
): { when: readonly Condition[] }[] {
  const node: Node = { kind: 'and', parts: conditions.map((c) => c.node) };
  return toBranches(node).map((when) => ({ when }));
}

/** The condition helpers, bound to one subject type and one object type. */
export interface Ops<Sub, Obj> {
  eq<A extends string, B>(
    field: Valid<A, Sub, Obj>,
    operand: Operand<B, Sub, Obj>,
  ): Cond;
  ne<A extends string, B>(
    field: Valid<A, Sub, Obj>,
    operand: Operand<B, Sub, Obj>,
  ): Cond;
  in<A extends string>(
    field: Valid<A, Sub, Obj>,
    values: readonly unknown[],
  ): Cond;
  /** `not-in` is not an identifier; the helper is `notIn` and the op is not-in. */
  notIn<A extends string>(
    field: Valid<A, Sub, Obj>,
    values: readonly unknown[],
  ): Cond;
  contains<A extends string>(field: Valid<A, Sub, Obj>, value: unknown): Cond;
  before(field: 'now', instant: Instant): Cond;
  after(field: 'now', instant: Instant): Cond;
  and(...conditions: Cond[]): Cond;
  or(...conditions: Cond[]): Cond;
  /** Always true. Flattens to one rule with an empty `when`. */
  readonly always: Cond;
}

/** The block parameter: the ops, plus the chained action declarations. */
export interface Actions<Sub, Obj> extends Ops<Sub, Obj> {
  allow(action: string, ...conditions: Cond[]): Actions<Sub, Obj>;
  deny(action: string, ...conditions: Cond[]): Actions<Sub, Obj>;
  /** Field rules for the action most recently declared in the chain. */
  fields(rules: readonly string[] | FieldRules): Actions<Sub, Obj>;
}

/**
 * One object kind bound to a handle, so the key is named once.
 *
 * Every object parameter takes `Partial<Obj>`. A caller holding a projection —
 * a list row carrying `{ id, ownerId }` — is the case `unevaluable` and
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
 * The document-level facts the builder emits alongside the permissions.
 *
 * They are document fields rather than construction options, so
 * `JSON.stringify(access.matrix)` from the typed path emits everything a foreign
 * producer emits. They sit on `policy()` rather than on a terminal method because
 * neither is a per-kind fact: `.for()` exists to accumulate the key -> object-type
 * map, and a version and a schema are known before the first block is written.
 *
 * A `schema` is passed by hand. The builder holds `Obj` at the type level only,
 * and a `MatrixSchema` is runtime JSON, so no schema can be derived from
 * `.for<'comment', Comment>()`. A typed author already has the field-existence
 * guarantee from TypeScript; passing a schema is what carries that guarantee
 * across the wire to a consumer that adopts the emitted JSON with `parseMatrix`.
 */
export type PolicyOptions = Pick<Matrix, 'version' | 'schema'>;

/**
 * The typed builder. `R` accumulates the key -> object-type map one `.for()` at
 * a time, and every query checks its key and its object against it.
 *
 * Queries take `Partial<R[K]>` for the object, so a projection is an argument
 * and the field names stay checked. The subject stays complete; see
 * `BoundKind`.
 */
export interface Policy<Sub, R> {
  for<K extends string, Obj>(
    key: K,
    build: (p: Actions<Sub, Obj>) => unknown,
  ): Policy<Sub, R & Record<K, Obj>>;
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
  authorize(subject: Sub, options?: { now?: Instant }): Authorized;
  object<K extends keyof R & string>(key: K): BoundKind<Sub, R[K]>;
  readsObject<K extends keyof R & string>(key: K, action: string): boolean;
  readonly matrix: Access['matrix'];
  readonly version: Access['version'];
  readonly schema: Access['schema'];
}

interface Draft {
  action: string;
  rules: { when: readonly Condition[] }[];
  denyRules: { when: readonly Condition[] }[];
  fields?: FieldRules;
}

/**
 * The chain handed to one `.for()` block. Types are erased here: the block
 * parameter carries them, and the runtime only needs the drafts.
 */
function blockBuilder(
  kind: string,
  drafts: Draft[],
): Actions<unknown, unknown> {
  let current: Draft | undefined;

  const draftFor = (action: string): Draft => {
    const existing = drafts.find((draft) => draft.action === action);
    if (existing) return existing;
    const draft: Draft = { action, rules: [], denyRules: [] };
    drafts.push(draft);
    return draft;
  };

  const attachTo = (what: string): Draft => {
    if (current) return current;
    throw new AclConfigError(
      `"${kind}" calls ${what}() before any allow() or deny(): ${what} attaches to the action most recently declared in the chain`,
    );
  };

  const ops: Ops<unknown, unknown> = {
    eq: (field, value) =>
      cond({ field, op: 'eq', ...operand(value) } as Condition),
    ne: (field, value) =>
      cond({ field, op: 'ne', ...operand(value) } as Condition),
    in: (field, values) =>
      cond({ field, op: 'in', value: values } as Condition),
    notIn: (field, values) =>
      cond({ field, op: 'not-in', value: values } as Condition),
    contains: (field, value) =>
      cond({ field, op: 'contains', value } as Condition),
    before: (field, instant) => cond({ field, op: 'before', value: instant }),
    after: (field, instant) => cond({ field, op: 'after', value: instant }),
    and: (...conditions) => ({
      node: { kind: 'and', parts: conditions.map((c) => c.node) },
    }),
    or: (...conditions) => ({
      node: { kind: 'or', parts: conditions.map((c) => c.node) },
    }),
    always: { node: { kind: 'and', parts: [] } },
  };

  const chain: Actions<unknown, unknown> = {
    ...ops,
    allow(action, ...conditions) {
      current = draftFor(action);
      current.rules.push(...toRules(conditions));
      return chain;
    },
    deny(action, ...conditions) {
      current = draftFor(action);
      current.denyRules.push(...toRules(conditions));
      return chain;
    },
    fields(rules) {
      attachTo('fields').fields = Array.isArray(rules)
        ? { fields: rules }
        : (rules as FieldRules);
      return chain;
    },
  };

  return chain;
}

/**
 * The canonical permission for one draft. The key is joined from the object kind
 * and the action here and nowhere else, which is what satisfies `KeyMismatchError`
 * by construction.
 *
 * An empty `rules` or `denyRules` is omitted rather than emitted as `[]`,
 * because the canonical document a foreign backend produces omits them and
 * `JSON.stringify` of the two must match.
 */
function toPermission(kind: string, draft: Draft): Permission {
  return {
    key: `${kind}.${draft.action}`,
    object: kind,
    action: draft.action,
    ...(draft.rules.length > 0 ? { rules: draft.rules } : {}),
    ...(draft.denyRules.length > 0 ? { denyRules: draft.denyRules } : {}),
    ...(draft.fields ? { fields: draft.fields } : {}),
  };
}

/**
 * The canonical document the builder emits. The document's shape lives in this
 * function alone, so a change to `Matrix` lands in one place.
 *
 * An absent `version` or `schema` omits the key rather than holding `undefined`,
 * so the document is byte-identical to the one a foreign producer emits for the
 * same policy and a JSON round trip is exact.
 */
function toMatrix(
  permissions: readonly Permission[],
  options: PolicyOptions,
): Matrix {
  return {
    ...(options.version === undefined ? {} : { version: options.version }),
    ...(options.schema === undefined ? {} : { schema: options.schema }),
    permissions,
  };
}

/**
 * The runtime shape behind `Policy`. The generics are a compile-time surface
 * over these calls; the engine underneath takes plain bags and string keys, so
 * the runtime is written against the erased form and cast once at the end.
 */
interface ErasedPolicy {
  for(
    key: string,
    build: (p: Actions<unknown, unknown>) => unknown,
  ): ErasedPolicy;
  can(
    subject: unknown,
    key: string,
    action: string,
    object?: unknown,
    now?: Instant,
  ): Decision;
  canMany(
    subject: unknown,
    key: string,
    action: string,
    objects: readonly unknown[],
    now?: Instant,
  ): Decision[];
  canFields(
    subject: unknown,
    key: string,
    action: string,
    object: unknown,
    axis: 'read' | 'write',
    proposed?: unknown,
    now?: Instant,
  ): FieldDecision;
  capabilities(subject: unknown, now?: Instant): Record<string, Decision>;
  authorize(subject: unknown, options?: { now?: Instant }): Authorized;
  object(key: string): BoundKind<unknown, unknown>;
  readsObject(key: string, action: string): boolean;
  readonly matrix: Access['matrix'];
  readonly version: Access['version'];
  readonly schema: Access['schema'];
}

const bag = (value: unknown): SubjectBag => value as SubjectBag;
const maybeBag = (value: unknown): SubjectBag | undefined =>
  value as SubjectBag | undefined;

/**
 * The typed authoring path. Names the subject once, binds one object type per
 * `.for()` block, and flattens to the canonical matrix.
 *
 * `policy<Sub>()` is a call returning a builder rather than `policy<Sub>(config)`
 * taking the config, because TypeScript has no partial type-argument inference:
 * naming `Sub` in a single call forces every other type parameter to be named
 * too. The extra call is what lets `Sub` be explicit while each `.for()` infers
 * its own object type.
 *
 * Flattening is deferred to the first query, so validation runs once over the
 * whole matrix.
 *
 * @example
 * ```ts
 * const access = policy<Subject>().for<'comment', Comment>('comment', (p) =>
 *   p.allow('update', p.eq('object.authorId', 'subject.id')),
 * );
 * ```
 */
export function policy<Sub>(
  options: PolicyOptions = {},
): Policy<Sub, Record<never, never>> {
  const kinds: [string, Draft[]][] = [];
  let built: Access | undefined;

  const access = (): Access => {
    built ??= createPolicy(
      toMatrix(
        kinds.flatMap(([kind, drafts]) =>
          drafts.map((draft) => toPermission(kind, draft)),
        ),
        options,
      ),
    );
    return built;
  };

  const self: ErasedPolicy = {
    for(key, build) {
      const drafts: Draft[] = [];
      kinds.push([key, drafts]);
      build(blockBuilder(key, drafts));
      // A query reads the matrix the blocks so far describe, and a later block
      // adds to it, so the evaluator built before this call no longer answers
      // for the whole policy.
      built = undefined;
      return self;
    },
    can: (subject, key, action, object, now) =>
      access().can(bag(subject), key, action, maybeBag(object), now),
    canMany: (subject, key, action, objects, now) =>
      access().canMany(bag(subject), key, action, objects.map(bag), now),
    canFields: (subject, key, action, object, axis, proposed, now) =>
      access().canFields(
        bag(subject),
        key,
        action,
        bag(object),
        axis,
        maybeBag(proposed),
        now,
      ),
    capabilities: (subject, now) => access().capabilities(bag(subject), now),
    authorize: (subject, opts) => access().authorize(bag(subject), opts),
    object: (key) => ({
      can: (subject, action, object, now) =>
        self.can(subject, key, action, object, now),
      canMany: (subject, action, objects, now) =>
        self.canMany(subject, key, action, objects, now),
      canFields: (subject, action, object, axis, proposed, now) =>
        self.canFields(subject, key, action, object, axis, proposed, now),
      readsObject: (action) => self.readsObject(key, action),
    }),
    readsObject: (key, action) => access().readsObject(key, action),
    get matrix() {
      return access().matrix;
    },
    get version() {
      return access().version;
    },
    get schema() {
      return access().schema;
    },
  };

  return self as unknown as Policy<Sub, Record<never, never>>;
}
