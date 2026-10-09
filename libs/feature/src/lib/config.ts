import type {
  AttributeCondition,
  DayOfWeekCondition,
  FeatureDefinition,
  FeatureKey,
  Rule,
  VariantSpec,
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

/**
 * The JSON a condition value may hold.
 *
 * `AttributeCondition.value` is `unknown`, because a store built from a literal
 * holds whatever an author wrote. One of those values reaches the next process
 * as something else while `canonical` erases the difference: a `Date`, which
 * `canonical` writes as the ISO string `JSON.parse` hands back. The publisher
 * and the holder then digest alike over two values `evaluateCondition` compares
 * with `===`, and § 2 reads two agreeing digests as a proof that two processes
 * hold one configuration. This type refuses a `Date` wherever it appears.
 *
 * An object member written as `undefined` is legal, which § 8 states:
 * `canonical.ts:46` filters the member out and `JSON.stringify` omits it, so an
 * absent key and a key written as `undefined` canonicalize to one text and
 * digest alike over bytes that agree. The member type admits `undefined` so
 * that `{ tier }` read off a nullable column and `{ tier?: string }` off a
 * generated type both reach this type, since `canonical` writes the two as the
 * same text. TypeScript strips `undefined` from an optional member when it
 * checks one against an index signature, so a fence here would admit the second
 * spelling and refuse the first.
 *
 * An array element stays fenced to `JsonValue`. `canonical` writes an
 * `undefined` element as the text `undefined` and `JSON.stringify` writes it as
 * `null`, so the publisher and the holder compute two digests over one array
 * and the holder reports `digest-mismatch`.
 *
 * The object arm is an index signature. TypeScript derives one implicitly for a
 * type alias and for an object literal, optional members included, and never
 * for an `interface`, so a value annotated with an interface does not reach
 * this type. § 4 declares every context field as a flat `FieldType`, so no
 * generator emits an interface for a condition value. A generated type lands at
 * `SerializedVariantSpec.value`, which carries `unknown` for that reason.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [member: string]: JsonValue | undefined };

/** An attribute condition as a document carries it, compared with `===`. */
export interface SerializedAttributeCondition extends Omit<
  AttributeCondition,
  'value'
> {
  readonly value: JsonValue;
}

/** A condition as a document carries it. The instant and the value narrow. */
export type SerializedCondition =
  SerializedWindowCondition | DayOfWeekCondition | SerializedAttributeCondition;

/** A rule as a document carries it, with its control-plane `id` untouched. */
export interface SerializedRule extends Omit<Rule, 'when'> {
  readonly when?: readonly SerializedCondition[];
}

/**
 * A variant as a document carries it.
 *
 * `value` stays `unknown`. § 4 picks JSON Schema for this member because
 * quicktype and openapi-generator emit TypeScript interfaces from it, and
 * TypeScript gives an interface no implicit index signature, so a `JsonValue`
 * here refuses the generated type the notation was picked to produce. § 8 puts
 * the round trip in `serializeConfig`, which converts a `Date` wherever it
 * appears, and § 7's validator checks a variant value against the shape its
 * schema declares.
 */
export interface SerializedVariantSpec extends Omit<VariantSpec, 'value'> {
  readonly value?: unknown;
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
> extends Omit<FeatureDefinition<F>, 'rules' | 'variants'> {
  readonly rules?: readonly SerializedRule[];
  readonly variants?: readonly SerializedVariantSpec[];
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
   * The party that fetches is the party that acts on it. Whatever reads the
   * document holds the poller, knows the fetch instant because it performed the
   * fetch, and shortens its interval, logs, refuses to start or serves a
   * fallback document. This library holds no clock authority.
   *
   * This library evaluates the document a caller hands it. No endpoint answers
   * which variant a subject gets, so every holder computes its own answer from
   * the rules the document carries.
   */
  readonly maxStale?: number;
  readonly features: readonly SerializedDefinition<F>[];
}

/**
 * The envelope without its payload, which a serializer writes around a store.
 *
 * `digest` is fenced to `never` rather than omitted. Omitting it drops the
 * member from the type and still admits a whole `FeatureConfig`, because
 * TypeScript refuses an extra property on a fresh object literal and nowhere
 * else. A document's `digest` is always `configDigest` of that same document,
 * so a serializer that copied one from its caller would emit a document whose
 * digest covers other bytes. Every holder recomputes it,
 * disagrees, reports `digest-mismatch` and refuses the whole document, and no
 * holder recovers on its own. `configDigest` is the one writer of the member.
 */
export type ConfigEnvelope = Omit<FeatureConfig, 'features' | 'digest'> & {
  readonly digest?: never;
};

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
