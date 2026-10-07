import { describe, expectTypeOf, it } from 'vitest';
import type { FeatureKey } from '../lib/types.js';
import type {
  BaseFieldType,
  ConfigEnvelope,
  ConfigIssue,
  ConfigIssueCode,
  ContextSchema,
  FeatureConfig,
  FeatureSchema,
  FeatureShape,
  FieldType,
  JsonValue,
  ReloadResult,
  SerializedAttributeCondition,
  SerializedCondition,
  SerializedDefinition,
  SerializedInstant,
  SerializedRule,
  SerializedVariantSpec,
  SerializedWindowCondition,
  ValidationResult,
  ValueShape,
} from './index.js';
import type {
  BaseFieldType as CoreBaseFieldType,
  ConfigEnvelope as CoreConfigEnvelope,
  ConfigIssue as CoreConfigIssue,
  ConfigIssueCode as CoreConfigIssueCode,
  ContextSchema as CoreContextSchema,
  FeatureConfig as CoreFeatureConfig,
  FeatureSchema as CoreFeatureSchema,
  FeatureShape as CoreFeatureShape,
  FieldType as CoreFieldType,
  JsonValue as CoreJsonValue,
  ReloadResult as CoreReloadResult,
  SerializedAttributeCondition as CoreSerializedAttributeCondition,
  SerializedCondition as CoreSerializedCondition,
  SerializedDefinition as CoreSerializedDefinition,
  SerializedInstant as CoreSerializedInstant,
  SerializedRule as CoreSerializedRule,
  SerializedVariantSpec as CoreSerializedVariantSpec,
  SerializedWindowCondition as CoreSerializedWindowCondition,
  ValidationResult as CoreValidationResult,
  ValueShape as CoreValueShape,
} from '../index.js';

/**
 * `@evanion/feature/react` publishes the core's document types, not types of
 * its own that happen to look alike.
 *
 * The import list above is the first half of the claim: a name the entry stops
 * re-exporting fails this file at compile time. The identity cases are the
 * second half. A re-export is indistinguishable from a local redeclaration at
 * every structural assertion, and `toEqualTypeOf` against the core entry tells
 * the two apart, so a hand-written `FeatureConfig` carrying the six members
 * fails here.
 *
 * The authoring cases below read the entry the way a component file does. A
 * handler that reloads a store from a poller lives beside the component that
 * renders under it, and that file names these types from one specifier.
 */

describe('the twenty document types the react entry re-exports', () => {
  it('publishes the core SerializedInstant', () => {
    expectTypeOf<SerializedInstant>().toEqualTypeOf<CoreSerializedInstant>();
  });

  it('publishes the core SerializedWindowCondition', () => {
    expectTypeOf<SerializedWindowCondition>().toEqualTypeOf<CoreSerializedWindowCondition>();
  });

  it('publishes the core JsonValue', () => {
    expectTypeOf<JsonValue>().toEqualTypeOf<CoreJsonValue>();
  });

  it('publishes the core SerializedAttributeCondition', () => {
    expectTypeOf<SerializedAttributeCondition>().toEqualTypeOf<CoreSerializedAttributeCondition>();
  });

  it('publishes the core SerializedCondition', () => {
    expectTypeOf<SerializedCondition>().toEqualTypeOf<CoreSerializedCondition>();
  });

  it('publishes the core SerializedRule', () => {
    expectTypeOf<SerializedRule>().toEqualTypeOf<CoreSerializedRule>();
  });

  it('publishes the core SerializedVariantSpec', () => {
    expectTypeOf<SerializedVariantSpec>().toEqualTypeOf<CoreSerializedVariantSpec>();
  });

  it('publishes the core SerializedDefinition at its default key', () => {
    expectTypeOf<SerializedDefinition>().toEqualTypeOf<CoreSerializedDefinition>();
  });

  it('publishes the core SerializedDefinition at a key it is given', () => {
    expectTypeOf<SerializedDefinition<'cta'>>().toEqualTypeOf<
      CoreSerializedDefinition<'cta'>
    >();
  });

  it('publishes the core BaseFieldType', () => {
    expectTypeOf<BaseFieldType>().toEqualTypeOf<CoreBaseFieldType>();
  });

  it('publishes the core FieldType', () => {
    expectTypeOf<FieldType>().toEqualTypeOf<CoreFieldType>();
  });

  it('publishes the core ValueShape', () => {
    expectTypeOf<ValueShape>().toEqualTypeOf<CoreValueShape>();
  });

  it('publishes the core FeatureShape', () => {
    expectTypeOf<FeatureShape>().toEqualTypeOf<CoreFeatureShape>();
  });

  it('publishes the core ContextSchema', () => {
    expectTypeOf<ContextSchema>().toEqualTypeOf<CoreContextSchema>();
  });

  it('publishes the core FeatureSchema', () => {
    expectTypeOf<FeatureSchema>().toEqualTypeOf<CoreFeatureSchema>();
  });

  it('publishes the core FeatureConfig at its default key', () => {
    expectTypeOf<FeatureConfig>().toEqualTypeOf<CoreFeatureConfig>();
  });

  it('publishes the core FeatureConfig at a key it is given', () => {
    expectTypeOf<FeatureConfig<'cta'>>().toEqualTypeOf<
      CoreFeatureConfig<'cta'>
    >();
  });

  it('publishes the core ConfigEnvelope', () => {
    expectTypeOf<ConfigEnvelope>().toEqualTypeOf<CoreConfigEnvelope>();
  });

  it('publishes the core ConfigIssueCode', () => {
    expectTypeOf<ConfigIssueCode>().toEqualTypeOf<CoreConfigIssueCode>();
  });

  it('publishes the core ConfigIssue', () => {
    expectTypeOf<ConfigIssue>().toEqualTypeOf<CoreConfigIssue>();
  });

  it('publishes the core ValidationResult', () => {
    expectTypeOf<ValidationResult>().toEqualTypeOf<CoreValidationResult>();
  });

  it('publishes the core ReloadResult', () => {
    expectTypeOf<ReloadResult>().toEqualTypeOf<CoreReloadResult>();
  });

  it('names a type and not the escape hatch, on the document the entry exists for', () => {
    expectTypeOf<FeatureConfig>().not.toBeAny();
  });

  it('names a type and not the escape hatch, on the result a handler reads', () => {
    expectTypeOf<ReloadResult>().not.toBeAny();
  });
});

describe('a component file authors a document through the react entry', () => {
  it('takes a document that configures no features', () => {
    const document = { version: 1, features: [] } satisfies FeatureConfig;

    expectTypeOf(document.features).toBeArray();
  });

  it('takes a document that configures one feature', () => {
    const document = {
      features: [{ key: 'cta', enabled: true }],
    } satisfies FeatureConfig<'cta'>;
    const read = (config: FeatureConfig<'cta'>) => config.features[0];

    expectTypeOf(document.features).toExtend<
      readonly SerializedDefinition<'cta'>[]
    >();
    expectTypeOf(read).returns.toEqualTypeOf<
      SerializedDefinition<'cta'> | undefined
    >();
  });

  it('takes two definitions under one key, which validateConfig calls duplicate-feature', () => {
    const document = {
      features: [
        { key: 'cta', enabled: true },
        { key: 'cta', enabled: false },
      ],
    } satisfies FeatureConfig<'cta'>;

    expectTypeOf(document.features).toBeArray();
  });

  it('keys a document on a numeric enum, which the default parameter admits', () => {
    const read = (config: FeatureConfig) => config.features.length;
    const numeric = {
      features: [{ key: 1, enabled: true }],
    } satisfies FeatureConfig<1 | 2>;

    expectTypeOf(read).toBeCallableWith(numeric);
  });

  it('refuses a seventh member, the way the core envelope does', () => {
    const document = {
      features: [],
      // @ts-expect-error -- the envelope carries six members and no more.
      ttl: 60,
    } satisfies FeatureConfig;

    expectTypeOf(document.features).toBeArray();
  });

  it('refuses a definition keyed outside the parameter it was given', () => {
    const document = {
      // @ts-expect-error -- `nav` is not a key this document declares.
      features: [{ key: 'nav', enabled: true }],
    } satisfies FeatureConfig<'cta'>;

    expectTypeOf(document.features).toBeArray();
  });

  it('refuses a Date at a window instant, which digests as a string it is not', () => {
    const document = {
      features: [
        {
          key: 'cta',
          enabled: true,
          // @ts-expect-error -- a serialized instant is a string or a number.
          rules: [{ when: [{ field: 'now', op: 'after', value: new Date() }] }],
        },
      ],
    } satisfies FeatureConfig<'cta'>;

    expectTypeOf(document.features).toBeArray();
  });

  it('takes a staleness window of zero, which a publisher serving no cache writes', () => {
    const document = { maxStale: 0, features: [] } satisfies FeatureConfig;

    expectTypeOf(document.maxStale).toBeNumber();
  });

  it('takes the largest staleness window a number carries exactly', () => {
    const document = {
      maxStale: Number.MAX_SAFE_INTEGER,
      features: [],
    } satisfies FeatureConfig;

    expectTypeOf(document.maxStale).toBeNumber();
  });

  it('takes a version of zero and a version of the empty string, which it only compares', () => {
    const numbered = { version: 0, features: [] } satisfies FeatureConfig;
    const named = { version: '', features: [] } satisfies FeatureConfig;

    expectTypeOf([numbered.version, named.version]).toEqualTypeOf<
      (string | number)[]
    >();
  });

  it('refuses a version it could not compare with !==', () => {
    const document = {
      // @ts-expect-error -- a version is a string or a number.
      version: true,
      features: [],
    } satisfies FeatureConfig;

    expectTypeOf(document.features).toBeArray();
  });

  it('takes an inline schema naming no version, which validateConfig calls missing-schema-version', () => {
    const document = {
      schema: { context: { fields: { tier: 'string' } } },
      features: [],
    } satisfies FeatureConfig;

    expectTypeOf(document.schema).toExtend<FeatureSchema>();
  });

  it('takes a schema version with no inline schema, which § 5 declares legal', () => {
    const document = {
      schemaVersion: '2026-09-29',
      features: [],
    } satisfies FeatureConfig;

    expectTypeOf(document.schemaVersion).toBeString();
  });

  it('takes a digest covering other bytes, which a holder calls digest-mismatch', () => {
    const document = {
      digest: '0'.repeat(32),
      features: [],
    } satisfies FeatureConfig;

    expectTypeOf(document.digest).toBeString();
  });
});

describe('the schema vocabulary a component file reads off the react entry', () => {
  it('declares a field as a flat string a producer in any language emits', () => {
    const schema = {
      fields: { tier: 'string', seats: 'number[]', trialEndsAt: 'instant?' },
    } satisfies ContextSchema;

    expectTypeOf(schema.fields.tier).toExtend<FieldType>();
  });

  it('takes an array of a base type that a complete context may leave out', () => {
    expectTypeOf<'instant[]?'>().toExtend<FieldType>();
  });

  it('refuses the two marks in the other order', () => {
    // @ts-expect-error -- the array mark comes before the optional mark.
    const field: FieldType = 'string?[]';

    expectTypeOf(field).toExtend<FieldType>();
  });

  it('refuses a base type the engine compares nothing with', () => {
    // @ts-expect-error -- `date` is not one of the four base types.
    const field: FieldType = 'date';

    expectTypeOf(field).toExtend<FieldType>();
  });

  it('takes a schema that declares no fields and no features', () => {
    const schema = {} satisfies FeatureSchema;

    expectTypeOf(schema).toExtend<FeatureSchema>();
  });

  it('takes a combinator validateConfig calls unfenced-schema, because the shape is JSON', () => {
    const shape = {
      allOf: [{ type: 'object' }],
    } satisfies ValueShape;

    expectTypeOf(shape).toExtend<ValueShape>();
  });

  it('records one variant shape under the feature that declares it', () => {
    const feature = {
      variants: { blue: { type: 'object', properties: { label: {} } } },
    } satisfies FeatureShape;

    expectTypeOf(feature.variants.blue).toExtend<ValueShape>();
  });
});

describe('a poller handler reads a reload result off the react entry', () => {
  it('reads the installed version with no narrowing, which is what a log line wants', () => {
    const read = (result: ReloadResult) => result.version;

    expectTypeOf(read).returns.toEqualTypeOf<string | number | undefined>();
  });

  it('takes the first install, where no document stood before this one', () => {
    const result = {
      ok: true,
      version: 1,
      previousVersion: undefined,
      changed: [],
    } satisfies ReloadResult;

    expectTypeOf(result.changed).toBeArray();
  });

  it('takes a reinstall of the one document, whose changed list is empty', () => {
    const result = {
      ok: true,
      version: 7,
      previousVersion: 7,
      changed: [],
    } satisfies ReloadResult;

    expectTypeOf(result.previousVersion).toBeNumber();
  });

  it('takes a refusal naming the candidate and every issue it found', () => {
    const result = {
      ok: false,
      version: 7,
      rejected: 8,
      issues: [
        { code: 'cycle', message: 'cta -> nav -> cta' },
        { code: 'duplicate-feature', message: 'cta', key: 'cta' },
      ],
    } satisfies ReloadResult;

    expectTypeOf(result.issues).toExtend<readonly ConfigIssue[]>();
  });

  it('takes a refusal of a document naming no version, which stays undefined', () => {
    const result = {
      ok: false,
      version: undefined,
      rejected: undefined,
      issues: [{ code: 'digest-mismatch', message: 'recomputed' }],
    } satisfies ReloadResult;

    expectTypeOf(result.rejected).toEqualTypeOf<undefined>();
  });

  it('takes a refusal carrying no issue, which no validateConfig call produces', () => {
    const result = {
      ok: false,
      version: 7,
      rejected: 8,
      issues: [],
    } satisfies ReloadResult;

    expectTypeOf(result.issues).toBeArray();
  });

  it('refuses the candidate version on the arm that installed a document', () => {
    const result = {
      ok: true,
      version: 8,
      previousVersion: 7,
      changed: [],
      // @ts-expect-error -- an install refused nothing, so it names nothing.
      rejected: 9,
    } satisfies ReloadResult;

    expectTypeOf(result.changed).toBeArray();
  });

  it('refuses a changed list on the arm that refused one, because nothing moved', () => {
    const result = {
      ok: false,
      version: 7,
      rejected: 8,
      issues: [],
      // @ts-expect-error -- a refusal installed nothing, so nothing changed.
      changed: ['cta'],
    } satisfies ReloadResult;

    expectTypeOf(result.issues).toBeArray();
  });

  it('reads the changed keys on one arm and the issues on the other, after narrowing on ok', () => {
    const handle = (result: ReloadResult) =>
      result.ok ? result.changed.length : result.issues.length;

    expectTypeOf(handle).returns.toBeNumber();
  });
});

describe('a handler reads a validation result off the react entry', () => {
  it('takes the arm that found nothing wrong', () => {
    const result = { ok: true } satisfies ValidationResult;

    expectTypeOf(result.ok).toEqualTypeOf<true>();
  });

  it('takes a refusal carrying one issue', () => {
    const result = {
      ok: false,
      issues: [{ code: 'unknown-member', message: 'ttl', path: '/ttl' }],
    } satisfies ValidationResult;
    const read = (each: Extract<ValidationResult, { ok: false }>) =>
      each.issues[0];

    expectTypeOf(result.issues).toExtend<readonly ConfigIssue[]>();
    expectTypeOf(read).returns.toEqualTypeOf<ConfigIssue | undefined>();
  });

  it('refuses an issue list on the arm that found nothing wrong', () => {
    const result = {
      ok: true,
      // @ts-expect-error -- the passing arm carries no issue list.
      issues: [],
    } satisfies ValidationResult;

    expectTypeOf(result.ok).toEqualTypeOf<true>();
  });

  it('names an issue with the feature and the pointer a UI highlights the row by', () => {
    const issue = {
      code: 'invalid-variant-order',
      message: 'cta: order 1.5 is not an integer',
      key: 'cta',
      path: '/features/0/variants/1/order',
    } satisfies ConfigIssue;

    expectTypeOf(issue.code).toExtend<ConfigIssueCode>();
  });

  it('names an issue about the whole document, which is about no feature and no row', () => {
    const issue = {
      code: 'digest-mismatch',
      message: 'the document digests to another value',
    } satisfies ConfigIssue;
    const read = (each: ConfigIssue) => [each.key, each.path] as const;

    expectTypeOf(issue).toExtend<ConfigIssue>();
    expectTypeOf(read).returns.toEqualTypeOf<
      readonly [FeatureKey | undefined, string | undefined]
    >();
  });

  it('refuses a nineteenth code, which no task in this plan adds', () => {
    // @ts-expect-error -- the eighteen codes are closed.
    const code: ConfigIssueCode = 'stale-document';

    expectTypeOf(code).toExtend<ConfigIssueCode>();
  });
});

describe('the envelope a serializer writes, read off the react entry', () => {
  it('holds its digest at the one type no caller produces a value of', () => {
    expectTypeOf<ConfigEnvelope['digest']>().toEqualTypeOf<undefined>();
  });

  it('refuses a whole document, whose digest covers other bytes', () => {
    const envelope = {
      version: 1,
      // @ts-expect-error -- the envelope carries no payload.
      features: [],
    } satisfies ConfigEnvelope;

    expectTypeOf(envelope.version).toBeNumber();
  });

  it('takes a bare envelope, which a publisher with no version scheme writes', () => {
    const envelope = {} satisfies ConfigEnvelope;

    expectTypeOf(envelope).toExtend<ConfigEnvelope>();
  });
});
