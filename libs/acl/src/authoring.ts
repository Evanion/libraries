import { AclConfigError, AmbiguousRuleIdError } from './errors.js';
import { hydratePolicy } from './hydrate-policy.js';
import type { Access, AccessOptions } from './hydrate-policy.js';
import type {
  Condition,
  FieldRules,
  Instant,
  Matrix,
  Permission,
  Rule,
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

/**
 * An opaque condition tree. Built by the helpers, flattened by the builder.
 *
 * `node` is typed `unknown` so the type is opaque in fact and not only in this
 * sentence. A caller holds a `Cond`, passes it to `allow` or `deny`, and never
 * reads it; typing the member as the tree would publish the tree's shape as
 * API, and typing it as a name this package does not export would leave a
 * member no consumer can write down.
 *
 * The second of those is what shipped. `Node` is module-private, so a
 * declaration emitting `readonly node: Node` referenced a name that resolves
 * nowhere for a consumer, and in a context that re-declares it the name binds
 * to the DOM's `Node` with no error at all.
 */
export interface Cond {
  readonly node: unknown;
}

/**
 * The tree behind a `Cond`, which only this module may read.
 *
 * One cast rather than one per call site, so the place the opacity is undone is
 * a single line somebody can find.
 */
function treeOf(condition: Cond): Node {
  return condition.node as Node;
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
function toRules(conditions: readonly Cond[]): Rule[] {
  const node: Node = { kind: 'and', parts: conditions.map(treeOf) };
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

/**
 * The block parameter: the ops, plus the chained action declarations.
 *
 * `Act` is the actions declared so far in this chain. `allow` and `deny` widen
 * it by the literal they were handed, and `.for()` reads the final union off
 * what the block returns, so the permission keys come from the calls that
 * declare them and an author writes each action once.
 *
 * `Vocab` is what those two calls may name, which is the kind's entry in the
 * vocabulary map or {@link Action}. The two parameters answer different
 * questions: `Vocab` is what this kind may do, `Act` is what this block said it
 * does, and only `Act` reaches the permission keys. A vocabulary listing
 * `'reprice'` that no block allows puts no `listing.reprice` in the keys.
 *
 * What a discovered `Act` gives up: a misspelled `p.allow('updte')` inside a
 * kind whose vocabulary is `string` is a key rather than an error, and it
 * surfaces at every site that names the key, where `caps['comment.update']` and
 * `access.can(s, 'comment', 'update')` both fail against a union carrying
 * `'comment.updte'`. A kind whose vocabulary is a union refuses the misspelling
 * here instead, at the call that wrote it.
 *
 * `fields` and `visibility` carry both parameters through untouched: each one
 * marks the action most recently declared and declares none of its own.
 */
export interface Actions<
  Sub,
  Obj,
  Act extends string = string,
  Vocab extends string = string,
> extends Ops<Sub, Obj> {
  allow<A extends Vocab>(
    action: A,
    ...conditions: Cond[]
  ): Actions<Sub, Obj, Act | A, Vocab>;
  deny<A extends Vocab>(
    action: A,
    ...conditions: Cond[]
  ): Actions<Sub, Obj, Act | A, Vocab>;
  /**
   * One allow rule, written once and attached to each action in the list.
   *
   * The document gains one ordinary permission per action, in the same flat
   * list `allow` writes into, so a reviewer reading the matrix reads every
   * action it grants. Nothing in the document stands for a set of actions, and
   * an action added to a vocabulary later widens no grant written before it.
   *
   * An action this repeats is the action `allow` already declared: the rules
   * are appended to the one draft that action has, exactly as two `allow`
   * calls for the same action are two rules. An empty list declares nothing.
   *
   * `fields` and `visibility` refuse after this call. Each marks one action,
   * and a batch leaves no single answer to which one, so the chain drops the
   * mark rather than spreading it over actions the author did not name
   * individually.
   */
  allowEach<A extends Vocab>(
    actions: readonly A[],
    ...conditions: Cond[]
  ): Actions<Sub, Obj, Act | A, Vocab>;
  /** One deny rule, attached to each action in the list. See `allowEach`. */
  denyEach<A extends Vocab>(
    actions: readonly A[],
    ...conditions: Cond[]
  ): Actions<Sub, Obj, Act | A, Vocab>;
  /**
   * Names the rule the previous `allow()` or `deny()` wrote.
   *
   * A rule states an `id` so that a `Decision` reports that name and a
   * `diffMatrix` finding keeps the rule's identity across an edit. The fallback
   * id is derived by hashing the rule's conditions, and a release that changes
   * how a condition is represented changes every derived id, so a log line or
   * an audit row holding one stops matching its rule and nothing reports that
   * it has. An author-supplied id is the one that survives.
   *
   * The name lands on one rule, and a call that emitted several is
   * {@link AmbiguousRuleIdError}: `p.allow('read', p.or(a, b))` is disjunctive
   * normal form, one rule per branch, and one name cannot name two of them. The
   * author writes one `allow()` per branch when each branch wants a name.
   *
   * ```ts
   * p.allow('update', p.eq('object.sellerId', 'subject.id')).id('owner-edits-own')
   * ```
   *
   * This refuses before any `allow()` or `deny()`, and after `allowEach()` or
   * `denyEach()`, on the rule `fields` and `visibility` follow: a batch names
   * several actions and leaves no single rule for the name to land on.
   */
  id(id: string): Actions<Sub, Obj, Act, Vocab>;
  /** Field rules for the action most recently declared in the chain. */
  fields(rules: readonly string[] | FieldRules): Actions<Sub, Obj, Act, Vocab>;
  /**
   * The publication marking for the action most recently declared in the chain.
   *
   * The argument is the `visibility` a `Permission` carries, so a block writes
   * the same two words a hand-written document writes and
   * `serialize(access, 'reduced')` reads the emitted matrix with no knowledge of
   * which path authored it. An action this is never called for emits no
   * `visibility` at all, which is the `internal` every unmarked permission
   * already means.
   */
  visibility(visibility: Visibility): Actions<Sub, Obj, Act, Vocab>;
}

/** The publication marking a permission carries, named for reuse in a block. */
export type Visibility = NonNullable<Permission['visibility']>;

/**
 * The action vocabulary a block gets when it declares none of its own.
 *
 * Four verbs, domain-neutral, and a string-literal union rather than a
 * TypeScript `enum`: an `enum` is nominal and a runtime artifact, and the
 * actions in a matrix are plain strings that survive `JSON.parse`, so a member
 * of an `enum` would compare unequal to the string the document carries.
 *
 * A domain that needs more names them per kind, in the vocabulary map
 * `policy()` takes: `{ listing: Action | 'publish' }`. A kind that answers
 * for actions no vocabulary can list opens itself with `string`.
 *
 * No wildcard member sits here. The engine resolves `${kind}.${action}` as an
 * exact lookup, so an `'all'` in this union would mint a permission that a
 * query for `'update'` never consults. Wildcard semantics are specified
 * separately, and this union stays four verbs until that spec lands.
 */
export const CRUD_ACTIONS = ['create', 'read', 'update', 'delete'] as const;

/**
 * The default action vocabulary, read off {@link CRUD_ACTIONS}.
 *
 * The list is the one declaration. A caller that wants the four at runtime
 * passes `CRUD_ACTIONS` to `allowEach`, and the type follows it, so the union
 * and the array cannot drift.
 */
export type Action = (typeof CRUD_ACTIONS)[number];

/**
 * The vocabulary one kind's block may declare from.
 *
 * A kind the map names gets that entry; `string` there is a kind whose actions
 * no union can list. A kind the map leaves out gets {@link Action}, so a
 * policy that declares no vocabulary at all still refuses a verb outside the
 * four.
 */
export type VocabularyOf<Vocabs, K extends string> = K extends keyof Vocabs
  ? Vocabs[K] extends string
    ? Vocabs[K]
    : Action
  : Action;

/**
 * The document-level facts the builder emits alongside the permissions.
 *
 * They are document fields rather than construction options, so
 * `JSON.stringify(access.matrix)` from the typed path emits everything a foreign
 * producer emits. They sit on `policy()` rather than on a terminal method because
 * neither is a per-kind fact: `.for()` exists to write one kind's rules, and a
 * version and a schema are known before the first block is written.
 *
 * A `schema` is passed by hand. The builder holds the object types at the type
 * level only, and a `MatrixSchema` is runtime JSON, so no schema can be derived
 * from `policy<Subject, Objects>()`. A typed author already has the field-existence
 * guarantee from TypeScript; passing a schema is what carries that guarantee
 * across the wire to a consumer that adopts the emitted JSON with `parseMatrix`.
 */
export type PolicyOptions = Pick<Matrix, 'version' | 'schema'>;

/**
 * The permission keys one block contributes, joined from the object kind and
 * the actions the block declared.
 *
 * An open vocabulary contributes `string`, which absorbs every other member of
 * the union it joins. A block whose body is a statement with no return, or one
 * that hands `allow` a value the compiler reads as `string`, therefore widens
 * the whole document's keys to `string`, which is the shape a document arriving
 * as JSON answers with: a key half the document cannot name is a key nothing
 * can be checked against.
 */
export type PermissionKeys<
  K extends string,
  Act extends string,
> = string extends Act ? string : `${K}.${Act}`;

/**
 * The typed builder: `for`, `matrix` and `build`, and nothing else.
 *
 * `Objects` is the kind -> row-type map the author named at `policy()`. Each
 * `.for()` looks its object type up there, so a block names its kind once, as
 * a value, and an unknown kind is a compile error against the map.
 *
 * `Vocabs` is the kind -> action-union map beside it. It sits in its own
 * parameter rather than inside `Objects`, because `Objects` is the shape a
 * consumer restates by hand as the `R` of `parseMatrix`, and a wrapper carrying
 * both halves would put the producer's authoring concern into the type every
 * consumer writes.
 *
 * `R` accumulates the kinds that actually carry a block, one `.for()` at a
 * time, and `build()` hands it to the evaluator. A kind the map declares and no
 * block writes is therefore unknown to every query, which is what the document
 * says too.
 *
 * `Keys` accumulates the permission keys the same way. Each `.for()` reads the
 * actions off what its block returns and joins them to the kind, so
 * `capabilities()` answers under the keys the blocks wrote and nothing states
 * an action twice.
 *
 * Nothing here forwards a query. `build()` calls the shared constructor once
 * and returns its result, which is the same `Access` a document arriving at
 * runtime produces.
 *
 * `matrix` stays alongside `build()` because a caller sometimes wants the
 * document without an evaluator: `applyDenyOverlay` takes a `Matrix`, so an
 * owner overlaying a typed-authored policy needs the document first.
 */
export interface Policy<
  Sub,
  Objects,
  Vocabs extends Partial<Record<keyof Objects, string>>,
  R,
  Keys extends string = string,
> {
  for<K extends keyof Objects & string, Act extends string = string>(
    key: K,
    build: (
      p: Actions<Sub, Objects[K], never, VocabularyOf<Vocabs, K>>,
    ) => Actions<Sub, Objects[K], Act, VocabularyOf<Vocabs, K>> | void,
  ): Policy<
    Sub,
    Objects,
    Vocabs,
    R & Record<K, Objects[K]>,
    Keys | PermissionKeys<K, Act>
  >;
  readonly matrix: Readonly<Matrix>;
  build(options?: AccessOptions): Access<Sub, R, Keys>;
}

interface Draft {
  action: string;
  rules: Rule[];
  denyRules: Rule[];
  fields?: FieldRules;
  visibility?: Visibility;
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
  /** Whether the last declaration in the chain named several actions at once. */
  let batched = false;
  /** The rules the last `allow`/`deny` wrote, which `id` names one of. */
  let emitted: { verb: 'allow' | 'deny'; rules: Rule[] } | undefined;

  const draftFor = (action: string): Draft => {
    const existing = drafts.find((draft) => draft.action === action);
    if (existing) return existing;
    const draft: Draft = { action, rules: [], denyRules: [] };
    drafts.push(draft);
    return draft;
  };

  const attachTo = (what: string): Draft => {
    if (current) return current;
    if (batched) {
      throw new AclConfigError(
        `"${kind}" calls ${what}() after allowEach()/denyEach(): ${what} marks one action, and a batch names several, so name the action with allow() or deny() and attach ${what} to that call`,
      );
    }
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
      node: { kind: 'and', parts: conditions.map(treeOf) },
    }),
    or: (...conditions) => ({
      node: { kind: 'or', parts: conditions.map(treeOf) },
    }),
    always: { node: { kind: 'and', parts: [] } },
  };

  const chain: Actions<unknown, unknown> = {
    ...ops,
    allow(action, ...conditions) {
      batched = false;
      current = draftFor(action);
      const rules = toRules(conditions);
      emitted = { verb: 'allow', rules };
      current.rules.push(...rules);
      return chain;
    },
    deny(action, ...conditions) {
      batched = false;
      current = draftFor(action);
      const rules = toRules(conditions);
      emitted = { verb: 'deny', rules };
      current.denyRules.push(...rules);
      return chain;
    },
    allowEach(actions, ...conditions) {
      batched = true;
      current = undefined;
      emitted = undefined;
      for (const action of actions) {
        draftFor(action).rules.push(...toRules(conditions));
      }
      return chain;
    },
    denyEach(actions, ...conditions) {
      batched = true;
      current = undefined;
      emitted = undefined;
      for (const action of actions) {
        draftFor(action).denyRules.push(...toRules(conditions));
      }
      return chain;
    },
    id(id) {
      // The rules `emitted` holds are the same objects the draft holds, so
      // naming one here names it in the document. `attachTo` raises the two
      // messages `fields` raises, for the same two positions in the chain.
      const draft = attachTo('id');
      // `current` and `emitted` move together: a chain that reached here ran an
      // allow() or a deny(), which set both. TypeScript sees them separately.
      const last = emitted ?? { verb: 'allow' as const, rules: [] };
      const [only] = last.rules;
      if (only === undefined || last.rules.length !== 1) {
        throw new AmbiguousRuleIdError(
          `${kind}.${draft.action}`,
          last.verb,
          id,
          last.rules.length,
        );
      }
      only.id = id;
      return chain;
    },
    fields(rules) {
      attachTo('fields').fields = Array.isArray(rules)
        ? { fields: rules }
        : (rules as FieldRules);
      return chain;
    },
    visibility(visibility) {
      attachTo('visibility').visibility = visibility;
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
 * `JSON.stringify` of the two must match. An undeclared `visibility` is omitted
 * for the same reason, and an absent marking reads as `internal` everywhere.
 */
function toPermission(kind: string, draft: Draft): Permission {
  return {
    key: `${kind}.${draft.action}`,
    object: kind,
    action: draft.action,
    ...(draft.rules.length > 0 ? { rules: draft.rules } : {}),
    ...(draft.denyRules.length > 0 ? { denyRules: draft.denyRules } : {}),
    ...(draft.fields ? { fields: draft.fields } : {}),
    ...(draft.visibility ? { visibility: draft.visibility } : {}),
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
 * The typed authoring path. Names the subject and the object kinds once, writes
 * one block per kind, and flattens to the canonical matrix.
 *
 * `policy<Sub, Objects, Vocabs>()` is a call returning a builder rather than
 * `policy<Sub, Objects, Vocabs>(config)` taking the config, because TypeScript
 * has no partial type-argument inference: naming a parameter in a single call
 * forces every other one to be named too. The extra call is what lets the map
 * parameters be explicit while each `.for()` names nothing and reads its object
 * type out of `Objects`, its vocabulary out of `Vocabs`, and the actions it
 * declared off the chain the block returns.
 *
 * `Vocabs` is optional, and a kind it does not name may declare the four
 * {@link Action} verbs. A domain verb is a compile error until the kind
 * names it, which is what catches `p.allow('updte')` at the call that wrote it.
 *
 * Flattening is deferred to `matrix` and `build()`, so validation runs once
 * over every block.
 *
 * @example
 * ```ts
 * type Objects = { comment: Comment; media: Media };
 * type Verbs = { comment: Action | 'publish' };
 *
 * const access = policy<Subject, Objects, Verbs>()
 *   .for('comment', (p) =>
 *     p
 *       .allow('update', p.eq('object.authorId', 'subject.id'))
 *       .allow('publish', p.contains('subject.roles', 'editor')),
 *   )
 *   .for('media', (p) => p.allow('read', p.always))
 *   .build();
 *
 * access.capabilities(subject)['comment.publish']; // a Decision
 * access.capabilities(subject)['comment.publsh']; // a compile error
 * ```
 */
export function policy<
  Sub,
  Objects,
  Vocabs extends Partial<Record<keyof Objects, string>> = Record<never, never>,
>(
  options: PolicyOptions = {},
): Policy<Sub, Objects, Vocabs, Record<never, never>, never> {
  const kinds: [string, Draft[]][] = [];

  const document = (): Matrix =>
    toMatrix(
      kinds.flatMap(([kind, drafts]) =>
        drafts.map((draft) => toPermission(kind, draft)),
      ),
      options,
    );

  const self = {
    for(key: string, build: (p: Actions<unknown, unknown>) => unknown) {
      const drafts: Draft[] = [];
      kinds.push([key, drafts]);
      build(blockBuilder(key, drafts));
      return self;
    },
    get matrix(): Readonly<Matrix> {
      return document();
    },
    build(accessOptions?: AccessOptions) {
      return hydratePolicy(document(), accessOptions);
    },
  };

  return self as unknown as Policy<
    Sub,
    Objects,
    Vocabs,
    Record<never, never>,
    never
  >;
}
