/**
 * The kind of object an action applies to. A string key in the matrix.
 */
export type ObjectKey = string;

/** The name of an action a subject can take on an object. */
export type Action = string;

/**
 * An instant, for a `now` condition or a context clock. A string is parsed as
 * ISO 8601, a number as epoch milliseconds. The string and number forms survive
 * a JSON round trip, so an SSR payload carries one unchanged.
 *
 * A condition boundary must parse: `validateMatrix` refuses a `before`/`after`
 * value that does not. A context clock that does not parse is not an error
 * either — it refuses. Every permission whose decision reads it lands on
 * `unusable-clock`.
 */
export type Instant = string | number | Date;

/**
 * The result of a field-level decision: allowed, denied, or not evaluable.
 *
 * `unevaluable` is a write-axis state. Read is projection only -- the name
 * allow-list is the whole of it, and a name either is on the list or is not --
 * so a read decision's map holds `allowed` and `denied` and nothing else. The
 * type stays three-valued because `axis` is a runtime argument: narrowing the
 * read path would mean a type parameter on `FieldDecision` and an overload pair
 * on every entry point, and it would still widen back wherever a caller passes
 * an `axis` it computed.
 */
export type FieldState = 'allowed' | 'denied' | 'unevaluable';

/**
 * Why a field decision landed where it did. Output only.
 *
 * Every member is emitted, so an exhaustive switch over this union has no
 * unreachable arm. A refusal is `not-listed`, `targets-failed` or
 * `transition-failed`; the reason names which rule refused, and `FieldState`
 * carries the plain `denied`.
 */
export type FieldReason =
  | 'allow'
  | 'not-listed'
  | 'targets-failed'
  | 'transition-failed'
  | 'missing-field'
  | 'proposed-required';

/**
 * A condition over the namespaced context.
 *
 * `now` is a time window. Any other field is `subject.*` or `object.*`, compared
 * against a literal `value` or — for `eq`/`ne` — against another `path`.
 */
export type Condition =
  | { field: 'now'; op: 'before' | 'after'; value: Instant }
  | {
      field: string;
      op: 'eq' | 'ne' | 'in' | 'not-in' | 'contains';
      path?: string;
      value?: unknown;
    };

/**
 * How one condition stands against a context.
 *
 * `unevaluable` names the `object.*` paths that did not read, so a permission
 * can report them as `missing`. Rule matching is AND-ed over these: a `fails`
 * decides the rule whatever else is unevaluable.
 *
 * `unusable-clock` is the third non-answer: the condition reads the clock and
 * the clock does not parse. It names no paths, because no fetch repairs it.
 */
export type ConditionOutcome =
  | { state: 'holds' }
  | { state: 'fails' }
  | { state: 'unusable-clock' }
  | { state: 'unevaluable'; missing: readonly string[] };

/** The namespaced evaluation context. */
export interface EvaluationContext {
  subject: Record<string, unknown>;
  object?: Record<string, unknown>;
  /**
   * The clock instant the `now` conditions read. Any `Instant` form, so a
   * context that crossed JSON needs no conversion at the call site. It is settled to a
   * single epoch once per entry point, before any condition is evaluated.
   */
  now?: Instant;
}

/**
 * A field value rule: either an allow-list of proposed values, or a state
 * machine over the current value. Never both.
 */
export type FieldConfig =
  | { targets: readonly unknown[] }
  | { transitions: Record<string, readonly unknown[]> };

/**
 * The field rules attached to an action's permission.
 *
 * `fields` holds the name allow-list / bang entries (`['*', '!status']` or
 * `['body', 'title']`). Every other key is a field name mapped to a
 * `FieldConfig` for the write axis.
 *
 * A field named `fields` therefore carries no config: the key is taken. It can
 * still be allowed or denied by name through the allow-list, which is what a
 * read-axis field needs in any case. A document that gives `fields` a config is
 * refused at construction with an `InvalidPermissionError` naming the clash.
 */
export interface FieldRules {
  fields?: readonly string[];
  [field: string]: readonly string[] | FieldConfig | undefined;
}

/** One activation rule for a permission: an AND-ed set of conditions. */
export interface Rule {
  id?: string;
  when?: readonly Condition[];
}

/** One permission: allows and/or denies, plus optional field rules. */
export interface Permission {
  key: string;
  object: ObjectKey;
  action: Action;
  /** Allow rules, OR-ed. */
  rules?: readonly Rule[];
  /** Deny rules, OR-ed. A matched deny wins over an allow. */
  denyRules?: readonly Rule[];
  /** Field-level rules, write and/or read axis. */
  fields?: FieldRules;
  /**
   * Whether this permission ships in a reduced serialization.
   *
   * Absent is `internal`. An older document, a foreign producer that emits no
   * such field, and an author who forgot all read the same way, and none of the
   * three publishes anything. `serialize(access, 'reduced')` keeps a `public`
   * permission whole and strips the field from the copy it emits, so a contract
   * carries no marking and its own reduced serialization is empty.
   */
  visibility?: 'public' | 'internal';
}

/**
 * The base of a declared field type.
 *
 * `instant` is a point in time carried as an ISO 8601 string or epoch
 * milliseconds, the same two forms an `Instant` survives JSON in.
 */
export type BaseFieldType = 'string' | 'number' | 'boolean' | 'instant';

/**
 * One field's declared type.
 *
 * A flat string, so the whole schema is JSON a producer in any language emits by
 * reflection. `[]` is an array of the base type. A trailing `?` marks a field
 * that may be absent from a complete instance; nullability is not an optionality
 * axis, so a declared field that is present and `null` is present.
 */
export type FieldType =
  | BaseFieldType
  | `${BaseFieldType}[]`
  | `${BaseFieldType}?`
  | `${BaseFieldType}[]?`;

/**
 * One object kind's declared shape.
 *
 * `relations` names the kinds this one points at, one hop, without nesting. A
 * condition reads one field of one scope, so a relation is not a value a
 * condition compares; it is declared for the consumers that resolve it.
 */
export interface ObjectSchema {
  readonly fields?: Readonly<Record<string, FieldType>>;
  readonly relations?: Readonly<Record<string, ObjectKey>>;
}

/**
 * The shapes a matrix's conditions are checked against.
 *
 * Optional for a producer and binding when present. Granularity is per object
 * kind: a kind `objects` does not declare is unchecked, and `subject.*` paths
 * are unchecked unless `subject` is declared.
 *
 * What a present schema checks, exactly:
 *
 * - a condition naming a field the declared kind does not declare is a
 *   construction error (`UnknownFieldError`);
 * - a condition whose operator does not fit the declared type is a construction
 *   error (`FieldTypeMismatchError`).
 *
 * What it does not check: the field names in `FieldRules` (the `fields`
 * allow-list, and the `targets`/`transitions` keys), and whether a permission
 * can decide `unevaluable` for a complete instance. Both are unchecked whether
 * or not a schema is present.
 */
export interface MatrixSchema {
  readonly subject?: ObjectSchema;
  readonly objects?: Readonly<Record<ObjectKey, ObjectSchema>>;
}

/**
 * The canonical matrix document: an envelope over a flat list of permissions.
 *
 * There is no bare-array form. `version` and `schema` belong to the document, so
 * a foreign producer emitting JSON states both, and one `access.matrix` crosses
 * an SSR boundary without a wrapper assembled at the call site.
 *
 * `version` is what the fetch-and-revalidate contract compares with `!==`, so a
 * string carries a content digest or a composite (`orders@7+veto@41`) where a
 * number cannot.
 */
export interface Matrix {
  readonly version?: string | number;
  readonly schema?: MatrixSchema;
  /**
   * How long a holder of this document may keep deciding on it, in
   * milliseconds, measured from its last successful freshness validation.
   *
   * The owner sets it as a ceiling. A holder reports the validation instant as
   * `AccessOptions.fetchedAt` and may shorten the bound with
   * `AccessOptions.maxStale`; past `fetchedAt + min(the two)` every decision
   * answers `stale-contract`. A holder that reports no `fetchedAt` claims no
   * freshness and no bound applies.
   */
  readonly maxStale?: number;
  readonly permissions: readonly Permission[];
}

/**
 * Why a decision landed where it did. Output only.
 *
 * `unevaluable` and `unusable-clock` both refuse and both mean "the engine could
 * not reach an answer", and they are two reasons because the caller's move
 * differs: `unevaluable` names paths in `missing` and one refetch settles it,
 * `unusable-clock` says the instant the call supplied does not parse and only a
 * different argument settles it.
 *
 * `stale-contract` is the third refusal with a caller's move attached, and the
 * move is a fetch of the document itself. The holder is past the freshness
 * budget `Matrix.maxStale` states, so the document carries no claim about the
 * present and every key answers this, including a key it does not hold.
 */
export type Reason =
  | 'allow'
  | 'no-rule-matched'
  | 'denied'
  | 'unknown-action'
  | 'unevaluable'
  | 'unusable-clock'
  | 'stale-contract';

/** One action-level decision. */
export interface Decision {
  key: string;
  allowed: boolean;
  reason: Reason;
  rule?: string;
  missing?: readonly string[];
}

/**
 * A decision over every field of an action.
 *
 * The field maps are computed whatever `action` says, so a caller blocked at the
 * action level still learns which fields would be editable once it is unblocked.
 */
export interface FieldDecision {
  /** True only when the action is allowed and every field is allowed. */
  allowed: boolean;
  /** The action-level decision the field maps hang off. */
  action: Decision;
  fields: Record<string, FieldState>;
  reasons: Record<string, FieldReason>;
}

/**
 * The field half of a `FieldDecision`: the maps, and whether every field is
 * allowed. Field rules are leaf-level, so the engine decides them without the
 * action decision and the two are composed at the entry point.
 */
export type FieldOutcome = Omit<FieldDecision, 'action'>;
