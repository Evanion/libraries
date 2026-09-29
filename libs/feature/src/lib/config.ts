import type {
  AttributeCondition,
  DayOfWeekCondition,
  FeatureDefinition,
  FeatureKey,
  Rule,
} from './types.js';

/**
 * An `Instant` that survives JSON: an ISO 8601 string, or epoch milliseconds.
 *
 * `Instant` at `types.ts:16` admits a `Date`, which a literal in a TypeScript
 * file is what an author writes. `JSON.stringify` writes that `Date` as an ISO
 * string and `JSON.parse` hands back a string, so a document that made one hop
 * through a transport holds a different value than the one that authored it.
 * The two evaluate alike, because `toEpoch` in `conditions.ts` reads both to
 * one number, and `configDigest` over the two disagrees. A document narrows to
 * this, and `serializeConfig` converts on the way out.
 */
export type SerializedInstant = string | number;

/** A window condition as a document carries it. */
export interface SerializedWindowCondition {
  field: 'now';
  op: 'before' | 'after';
  value: SerializedInstant;
}

/** A condition as a document carries it. Only the instant narrows. */
export type SerializedCondition =
  SerializedWindowCondition | DayOfWeekCondition | AttributeCondition;

/** A rule as a document carries it, with its control-plane `id` untouched. */
export interface SerializedRule extends Omit<Rule, 'when'> {
  readonly when?: readonly SerializedCondition[];
}

/**
 * A definition as a document carries it.
 *
 * `F` defaults to `FeatureKey`, the default `FeatureConfig` carries. This type
 * is the element type of `FeatureConfig['features']`, so a helper annotated
 * with the bare form reads a definition out of a bare document, and a
 * definition keyed on a numeric enum reaches both names.
 */
export interface SerializedDefinition<
  F extends FeatureKey = FeatureKey,
> extends Omit<FeatureDefinition<F>, 'rules'> {
  readonly rules?: readonly SerializedRule[];
}

/**
 * The base of a declared context field type.
 *
 * Ported from `libs/acl/src/types.ts:157-171`. `instant` is a point in time
 * carried as an ISO 8601 string or epoch milliseconds, which is what `toEpoch`
 * at `conditions.ts:18-22` already accepts.
 */
export type BaseFieldType = 'string' | 'number' | 'boolean' | 'instant';

/**
 * One context field's declared type.
 *
 * A flat string, so the whole schema is JSON a producer in any language emits
 * by reflection. `[]` is an array of the base type, and a trailing `?` marks a
 * field a complete context may leave out.
 */
export type FieldType =
  | BaseFieldType
  | `${BaseFieldType}[]`
  | `${BaseFieldType}?`
  | `${BaseFieldType}[]?`;

/**
 * A JSON Schema 2020-12 object, fenced to the subset `validateConfig` accepts.
 *
 * The engine never reads a variant value: `valueOf` hands it to the caller
 * untouched. So this shape is what a code generator and an optional validator
 * read, and the notation is JSON Schema because quicktype and
 * openapi-generator already emit TypeScript, Swift and Kotlin from it.
 */
export type ValueShape = Readonly<Record<string, unknown>>;

/** What a schema records about one feature. */
export interface FeatureShape {
  /** Keyed by variant name, in no significant order. The document holds the order. */
  readonly variants?: Readonly<Record<string, ValueShape>>;
}

/** The context fields rules read. */
export interface ContextSchema {
  readonly fields?: Readonly<Record<string, FieldType>>;
}

/**
 * The typing contract a document states.
 *
 * Two vocabularies, because the two halves describe different things. The
 * engine reads a context field, compares it with a closed operator set, and
 * checks it against the declared type at validation. The engine reads no
 * variant value at all.
 */
export interface FeatureSchema {
  readonly context?: ContextSchema;
  readonly features?: Readonly<Record<string, FeatureShape>>;
}

/**
 * The canonical configuration document: an envelope over a list of definitions.
 *
 * There is no bare-array form, for the reason `Matrix` at
 * `libs/acl/src/types.ts:220-234` gives: a foreign producer emitting JSON
 * states the version and the schema, and one document crosses a boundary
 * without a wrapper assembled at the call site.
 *
 * `F` defaults to `FeatureKey`. An entry point that reads a whole document
 * names the bare `FeatureConfig`, and a document keyed on a numeric enum
 * reaches that parameter only while the default admits a number.
 */
export interface FeatureConfig<F extends FeatureKey = FeatureKey> {
  /**
   * Compared with `!==`. Opaque and unordered.
   *
   * A consumer that could order two versions would act on the order, and both
   * available actions are wrong. Declining a lower version blocks a rollback,
   * which is the operation an operator reaches for at 3am. Accepting only a
   * higher version breaks a control plane serving two shards whose counters
   * diverged. A consumer holding a version different from the one it wants
   * fetches the document that version names.
   */
  readonly version?: string | number;
  /** `configDigest` of this document. A holder that finds one verifies it. */
  readonly digest?: string;
  /** The typing contract, inline. A document may name `schemaVersion` alone. */
  readonly schema?: FeatureSchema;
  /** The schema's own version. A publisher never rewrites a schema at a value. */
  readonly schemaVersion?: string;
  /**
   * How long the publisher believes a holder may keep this document, in
   * milliseconds. Advisory, and no entry point in this library reads it.
   *
   * The party that fetches is the party that acts on it. A binding in
   * `@evanion/feature-source` holds the poller, knows the fetch instant because
   * it performed the fetch, and shortens its interval, logs, refuses to start
   * or serves a fallback document. This library holds no clock authority.
   */
  readonly maxStale?: number;
  readonly features: readonly SerializedDefinition<F>[];
}

/**
 * The envelope without its payload, which a serializer writes around a store.
 *
 * `digest` is not a member. A document's `digest` is always `configDigest` of
 * that same document, so a serializer that copied one from its caller would
 * emit a document whose digest covers other bytes. Every holder recomputes it,
 * disagrees, reports `digest-mismatch` and refuses the whole document, and no
 * holder recovers on its own. `configDigest` is the one writer of the member.
 */
export type ConfigEnvelope = Omit<FeatureConfig, 'features' | 'digest'>;

/** What `validateConfig` found wrong. One code per class of defect. */
export type ConfigIssueCode =
  | 'duplicate-feature'
  | 'unknown-dependency'
  | 'cycle'
  | 'duplicate-variant'
  | 'unknown-variant'
  | 'invalid-weight'
  | 'empty-variants'
  | 'zero-weights'
  | 'duplicate-rule-id'
  | 'duplicate-variant-order'
  | 'invalid-variant-order'
  | 'invalid-instant'
  | 'unknown-context-field'
  | 'field-type-mismatch'
  | 'unfenced-schema'
  | 'missing-schema-version'
  | 'unknown-member'
  | 'digest-mismatch';

/**
 * One defect `validateConfig` found, with enough detail to name the row.
 */
export interface ConfigIssue {
  code: ConfigIssueCode;
  /** The same text the thrown counterpart carries, where one exists. */
  message: string;
  /** The feature the issue is about, when it is about one. */
  key?: FeatureKey;
  /** A JSON pointer into the document, so a UI highlights the row. */
  path?: string;
}

/**
 * What `validateConfig` decided. The refusal carries every issue it found.
 */
export type ValidationResult =
  { ok: true } | { ok: false; issues: readonly ConfigIssue[] };

/**
 * What a reload did.
 *
 * Both arms carry `version`, and on both arms it names the document that is
 * installed now. A refusal keeps the previous document, so its `version` is the
 * one that stayed and `rejected` is the one that did not arrive.
 */
export type ReloadResult =
  | {
      ok: true;
      version: string | number | undefined;
      previousVersion: string | number | undefined;
      /** Keys whose stored intent differs from the previous document. */
      changed: readonly FeatureKey[];
    }
  | {
      ok: false;
      /** The version that stayed installed. */
      version: string | number | undefined;
      /** The candidate's version, so a log names what was refused. */
      rejected: string | number | undefined;
      issues: readonly ConfigIssue[];
    };
