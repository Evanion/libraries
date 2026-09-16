/**
 * The kind of object an action applies to. A string key in the matrix.
 */
export type ObjectKey = string;

/** The name of an action a subject can take on an object. */
export type Action = string;

/**
 * An instant, for a `now` condition or a context clock. A string is parsed as
 * ISO 8601, a number as epoch milliseconds. The string and number forms survive
 * a JSON round trip, so an SSR hydration payload carries one unchanged.
 *
 * An instant that does not parse is not an error: the `before`/`after`
 * conditions reading it fail.
 */
export type Instant = string | number | Date;

/** The result of a field-level decision: allowed, denied, or not evaluable. */
export type FieldState = 'allowed' | 'denied' | 'unevaluable';

/** Why a field decision landed where it did. Output only. */
export type FieldReason =
  | 'allow'
  | 'not-listed'
  | 'denied'
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
 */
export type ConditionOutcome =
  | { state: 'holds' }
  | { state: 'fails' }
  | { state: 'unevaluable'; missing: readonly string[] };

/** The namespaced evaluation context. */
export interface EvaluationContext {
  subject: Record<string, unknown>;
  object?: Record<string, unknown>;
  /**
   * The clock instant the `now` conditions read. Any `Instant` form, so a
   * hydrated context needs no conversion at the call site. It is settled to a
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
  /** Permissions that must resolve on for this one to resolve on. */
  dependsOn?: readonly string[];
  /** Field-level rules, write and/or read axis. */
  fields?: FieldRules;
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
  readonly permissions: readonly Permission[];
}

export type Reason =
  | 'allow'
  | 'no-rule-matched'
  | 'denied'
  | 'dependency-off'
  | 'unknown-action'
  | 'unevaluable';

/** The root cause of a cascade: the first ancestor off for a non-dependency reason. */
export interface Cause {
  key: string;
  reason: Reason;
  rule?: string;
  /** The paths to fetch when `reason` is `unevaluable`. */
  missing?: readonly string[];
}

/** One action-level decision. */
export interface Decision {
  key: string;
  allowed: boolean;
  reason: Reason;
  rule?: string;
  blockedBy?: string;
  cause?: Cause;
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
  /** The action-level decision the field maps hang off, cascade resolved. */
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
