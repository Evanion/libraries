import { describe, expectTypeOf, it } from 'vitest';
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
  ReloadResult,
  SerializedCondition,
  SerializedDefinition,
  SerializedInstant,
  SerializedRule,
  SerializedWindowCondition,
  ValidationResult,
  ValueShape,
} from './config.js';
import type {
  BaseFieldType as PublishedBaseFieldType,
  ConfigEnvelope as PublishedEnvelope,
  ConfigIssue as PublishedIssue,
  ConfigIssueCode as PublishedIssueCode,
  ContextSchema as PublishedContextSchema,
  FeatureConfig as PublishedConfig,
  FeatureSchema as PublishedSchema,
  FeatureShape as PublishedFeatureShape,
  FieldType as PublishedFieldType,
  ReloadResult as PublishedReloadResult,
  SerializedCondition as PublishedCondition,
  SerializedDefinition as PublishedDefinition,
  SerializedInstant as PublishedInstant,
  SerializedRule as PublishedRule,
  SerializedWindowCondition as PublishedWindowCondition,
  ValidationResult as PublishedValidationResult,
  ValueShape as PublishedValueShape,
} from '../index.js';
import type {
  DayOfWeekCondition,
  FeatureDefinition,
  FeatureKey,
  Instant,
  Rule,
  WindowCondition,
} from './types.js';

describe('FeatureConfig', () => {
  it('takes the six members and nothing else', () => {
    expectTypeOf<keyof FeatureConfig>().toEqualTypeOf<
      | 'version'
      | 'digest'
      | 'schema'
      | 'schemaVersion'
      | 'maxStale'
      | 'features'
    >();
  });

  it('keys its definitions on the parameter it was given', () => {
    type Keyed = FeatureConfig<'cta' | 'checkout'>;

    expectTypeOf<Keyed['features'][number]['key']>().toEqualTypeOf<
      'cta' | 'checkout'
    >();
  });

  it('carries a serialized definition where a store carries a live one', () => {
    expectTypeOf<SerializedDefinition<'cta'>>().toExtend<
      FeatureDefinition<'cta'>
    >();
  });

  it('refuses a Date in a window condition', () => {
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

  it('refuses a seventh member', () => {
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

  it('requires the feature list, which is the one member a document must carry', () => {
    // @ts-expect-error -- a document with no `features` configures nothing.
    const document: FeatureConfig = { version: 1 };

    expectTypeOf(document).toExtend<FeatureConfig>();
  });

  it('takes a document that configures no features', () => {
    const document = { version: 1, features: [] } satisfies FeatureConfig;

    expectTypeOf(document.features).toBeArray();
  });

  it('keys a document on a numeric enum', () => {
    expectTypeOf<
      FeatureConfig<1 | 2>['features'][number]['key']
    >().toEqualTypeOf<1 | 2>();
  });

  it('compares a version it never orders, so a string and a number both carry one', () => {
    expectTypeOf<FeatureConfig['version']>().toEqualTypeOf<
      string | number | undefined
    >();
  });

  it('carries the advisory staleness window in milliseconds', () => {
    expectTypeOf<FeatureConfig['maxStale']>().toEqualTypeOf<
      number | undefined
    >();
  });

  it('refuses a staleness window written as a duration string', () => {
    const document = {
      // @ts-expect-error -- `maxStale` is milliseconds, not a duration string.
      maxStale: '5m',
      features: [],
    } satisfies FeatureConfig;

    expectTypeOf(document.features).toBeArray();
  });

  it('refuses a schema version written as a number', () => {
    const document = {
      // @ts-expect-error -- a schema version is an opaque string.
      schemaVersion: 3,
      features: [],
    } satisfies FeatureConfig;

    expectTypeOf(document.features).toBeArray();
  });

  it('names a schema version with no inline schema', () => {
    const document = {
      schemaVersion: '3',
      features: [],
    } satisfies FeatureConfig;

    expectTypeOf(document.schemaVersion).toExtend<string>();
  });
});

describe('ValidationResult', () => {
  it('discriminates on ok', () => {
    const read = (result: ValidationResult): readonly ConfigIssue[] =>
      result.ok ? [] : result.issues;

    expectTypeOf(read).toBeCallableWith({ ok: true });
  });

  it('hands back no issue list on the arm that found nothing wrong', () => {
    expectTypeOf<Extract<ValidationResult, { ok: true }>>().not.toHaveProperty(
      'issues',
    );
  });

  it('reports every issue it found, not the first', () => {
    expectTypeOf<
      Extract<ValidationResult, { ok: false }>['issues']
    >().toEqualTypeOf<readonly ConfigIssue[]>();
  });

  it('takes a refusal carrying one issue', () => {
    const result = {
      ok: false,
      issues: [{ code: 'unknown-member', message: 'ttl' }],
    } satisfies ValidationResult;

    expectTypeOf(result.issues).toBeArray();
  });
});

describe('ReloadResult', () => {
  it('carries the installed version on both arms', () => {
    const read = (result: ReloadResult) => result.version;

    expectTypeOf(read).returns.toEqualTypeOf<string | number | undefined>();
  });

  it('carries the candidate version only on the refusal', () => {
    const read = (result: ReloadResult) =>
      result.ok ? result.changed : result.rejected;

    expectTypeOf(read).toBeCallableWith({
      ok: false,
      version: 1,
      rejected: 2,
      issues: [],
    });
  });

  it('names the previous version on the arm that installed a document', () => {
    expectTypeOf<Extract<ReloadResult, { ok: true }>>().toHaveProperty(
      'previousVersion',
    );
  });

  it('carries no changed list on a refusal, because nothing moved', () => {
    expectTypeOf<Extract<ReloadResult, { ok: false }>>().not.toHaveProperty(
      'changed',
    );
  });

  it('carries no issue list on a success', () => {
    expectTypeOf<Extract<ReloadResult, { ok: true }>>().not.toHaveProperty(
      'issues',
    );
  });

  it('names changed keys on the keys a store admits', () => {
    expectTypeOf<
      Extract<ReloadResult, { ok: true }>['changed']
    >().toEqualTypeOf<readonly FeatureKey[]>();
  });

  it('takes an empty changed list, which reinstalling the same document produces', () => {
    const result = {
      ok: true,
      version: 7,
      previousVersion: 7,
      changed: [],
    } satisfies ReloadResult;

    expectTypeOf(result.changed).toBeArray();
  });

  it('takes an undefined version on both sides, which a document naming none produces', () => {
    const result = {
      ok: true,
      version: undefined,
      previousVersion: undefined,
      changed: ['cta'],
    } satisfies ReloadResult;

    expectTypeOf(result.version).toEqualTypeOf<undefined>();
  });
});

describe('ConfigEnvelope', () => {
  it('drops the payload and keeps the five members that describe it', () => {
    expectTypeOf<keyof ConfigEnvelope>().toEqualTypeOf<
      'version' | 'digest' | 'schema' | 'schemaVersion' | 'maxStale'
    >();
  });

  it('leaves every member optional, so a serializer writes a bare envelope', () => {
    const envelope = {} satisfies ConfigEnvelope;

    expectTypeOf(envelope).toExtend<ConfigEnvelope>();
  });
});

describe('SerializedInstant', () => {
  it('is an ISO string or epoch milliseconds', () => {
    expectTypeOf<SerializedInstant>().toEqualTypeOf<string | number>();
  });

  it('refuses the Date a live instant admits', () => {
    expectTypeOf<Date>().not.toExtend<SerializedInstant>();
  });

  it('is narrower than the instant a store holds', () => {
    expectTypeOf<SerializedInstant>().toExtend<Instant>();
  });
});

describe('SerializedWindowCondition', () => {
  it('fences the field to now', () => {
    expectTypeOf<SerializedWindowCondition['field']>().toEqualTypeOf<'now'>();
  });

  it('fences the operator to the two window comparisons', () => {
    expectTypeOf<SerializedWindowCondition['op']>().toEqualTypeOf<
      'before' | 'after'
    >();
  });

  it('refuses the live window condition a store holds', () => {
    expectTypeOf<WindowCondition>().not.toExtend<SerializedWindowCondition>();
  });
});

describe('SerializedCondition', () => {
  it('takes a day-of-week condition unchanged', () => {
    expectTypeOf<DayOfWeekCondition>().toExtend<SerializedCondition>();
  });

  it('refuses a live window condition', () => {
    expectTypeOf<WindowCondition>().not.toExtend<SerializedCondition>();
  });

  it('lets a Date through an attribute value, which only the serializer converts', () => {
    const condition = {
      field: 'signedUpAt',
      op: 'eq',
      value: new Date(),
    } satisfies SerializedCondition;

    expectTypeOf(condition.value).toEqualTypeOf<Date>();
  });
});

describe('SerializedRule', () => {
  it('emits an authored id untouched', () => {
    expectTypeOf<SerializedRule['id']>().toEqualTypeOf<string | undefined>();
  });

  it('keeps every member a live rule declares', () => {
    expectTypeOf<keyof SerializedRule>().toEqualTypeOf<keyof Rule>();
  });

  it('is a rule a live store could hold', () => {
    expectTypeOf<SerializedRule>().toExtend<Rule>();
  });

  it('refuses a live rule, whose conditions admit a Date', () => {
    expectTypeOf<Rule>().not.toExtend<SerializedRule>();
  });
});

describe('SerializedDefinition', () => {
  it('keeps every member a live definition declares', () => {
    expectTypeOf<keyof SerializedDefinition<'cta'>>().toEqualTypeOf<
      keyof FeatureDefinition<'cta'>
    >();
  });

  it('carries the rollout seed', () => {
    expectTypeOf<SerializedDefinition<'cta'>['seed']>().toEqualTypeOf<
      string | undefined
    >();
  });

  it('carries the variant bucketing field', () => {
    expectTypeOf<SerializedDefinition<'cta'>['variantBy']>().toEqualTypeOf<
      string | undefined
    >();
  });

  it('carries the variant bucketing seed', () => {
    expectTypeOf<SerializedDefinition<'cta'>['variantSeed']>().toEqualTypeOf<
      string | undefined
    >();
  });

  it('carries the build-time freeze opt-in', () => {
    expectTypeOf<
      SerializedDefinition<'cta'>['freezeTimeAtBuild']
    >().toEqualTypeOf<boolean | undefined>();
  });

  it('carries a variant order a control plane wrote', () => {
    expectTypeOf<
      NonNullable<SerializedDefinition<'cta'>['variants']>[number]['order']
    >().toEqualTypeOf<number | undefined>();
  });

  it('refuses a live definition, whose rules admit a Date', () => {
    expectTypeOf<FeatureDefinition<'cta'>>().not.toExtend<
      SerializedDefinition<'cta'>
    >();
  });
});

describe('BaseFieldType', () => {
  it('names the four types a context field carries', () => {
    expectTypeOf<BaseFieldType>().toEqualTypeOf<
      'string' | 'number' | 'boolean' | 'instant'
    >();
  });
});

describe('FieldType', () => {
  it('spells the sixteen flat strings and nothing else', () => {
    expectTypeOf<FieldType>().toEqualTypeOf<
      | 'string'
      | 'number'
      | 'boolean'
      | 'instant'
      | 'string[]'
      | 'number[]'
      | 'boolean[]'
      | 'instant[]'
      | 'string?'
      | 'number?'
      | 'boolean?'
      | 'instant?'
      | 'string[]?'
      | 'number[]?'
      | 'boolean[]?'
      | 'instant[]?'
    >();
  });

  it('refuses a base name it does not declare', () => {
    expectTypeOf<'date'>().not.toExtend<FieldType>();
  });

  it('refuses the optional mark ahead of the array mark', () => {
    expectTypeOf<'string?[]'>().not.toExtend<FieldType>();
  });

  it('refuses an array of arrays', () => {
    expectTypeOf<'string[][]'>().not.toExtend<FieldType>();
  });

  it('refuses a base name in the wrong case', () => {
    expectTypeOf<'String'>().not.toExtend<FieldType>();
  });

  it('refuses the empty string', () => {
    expectTypeOf<''>().not.toExtend<FieldType>();
  });
});

describe('ValueShape', () => {
  it('takes a keyword the fence refuses, which validation reports and the type cannot', () => {
    const shape = { allOf: [{ type: 'string' }] } satisfies ValueShape;

    expectTypeOf(shape).toExtend<ValueShape>();
  });

  it('refuses a bare value where a schema object belongs', () => {
    expectTypeOf<string>().not.toExtend<ValueShape>();
  });

  it('refuses an array where a schema object belongs', () => {
    expectTypeOf<readonly unknown[]>().not.toExtend<ValueShape>();
  });
});

describe('FeatureShape', () => {
  it('keys its value shapes by variant name', () => {
    const shape = {
      variants: { control: { type: 'object' } },
    } satisfies FeatureShape;

    expectTypeOf(shape.variants.control).toExtend<ValueShape>();
  });

  it('takes a feature that declares no variants', () => {
    const shape = {} satisfies FeatureShape;

    expectTypeOf(shape).toExtend<FeatureShape>();
  });
});

describe('ContextSchema', () => {
  it('declares each field as one flat string', () => {
    expectTypeOf<
      NonNullable<ContextSchema['fields']>[string]
    >().toEqualTypeOf<FieldType>();
  });

  it('admits a field named after a prototype member, so validation owns the lookup', () => {
    expectTypeOf<
      NonNullable<ContextSchema['fields']>[
        'constructor' | 'toString' | 'valueOf']
    >().toEqualTypeOf<FieldType>();
  });

  it('refuses a prototype member name written as a bare literal', () => {
    const schema = {
      fields: {
        // @ts-expect-error -- TypeScript reads the contextual type of
        // `constructor` off Object.prototype, never off the index signature.
        // The literal widens to `string` and the assignment fails. The same
        // happens for `toString` and `valueOf`, and an annotated binding does
        // not help: only an assertion on the value compiles.
        constructor: 'string',
      },
    } satisfies ContextSchema;

    expectTypeOf(schema.fields).toExtend<object>();
  });

  it('carries a field named after a prototype member when the value asserts its type', () => {
    const schema = {
      fields: { constructor: 'string' as FieldType },
    } satisfies ContextSchema;

    expectTypeOf(schema.fields.constructor).toEqualTypeOf<FieldType>();
  });
});

describe('FeatureSchema', () => {
  it('indexes its feature shapes by string, so a numeric key arrives stringified', () => {
    expectTypeOf<NonNullable<FeatureSchema['features']>>().toEqualTypeOf<
      Readonly<Record<string, FeatureShape>>
    >();
  });

  it('admits a feature named after a prototype member', () => {
    expectTypeOf<
      NonNullable<FeatureSchema['features']>['constructor' | 'toString']
    >().toEqualTypeOf<FeatureShape>();
  });

  it('takes a document that declares a context and no feature shapes', () => {
    const schema = {
      context: { fields: { plan: 'string' } },
    } satisfies FeatureSchema;

    expectTypeOf(schema.context.fields.plan).toExtend<FieldType>();
  });
});

describe('ConfigIssueCode', () => {
  it('names eighteen codes and no nineteenth', () => {
    expectTypeOf<ConfigIssueCode>().toEqualTypeOf<
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
      | 'digest-mismatch'
    >();
  });

  it('refuses a code no decision declares', () => {
    expectTypeOf<'stale-document'>().not.toExtend<ConfigIssueCode>();
  });
});

describe('ConfigIssue', () => {
  it('names the feature on the keys a store admits', () => {
    expectTypeOf<ConfigIssue['key']>().toEqualTypeOf<FeatureKey | undefined>();
  });

  it('requires a code and the message the thrown counterpart carries', () => {
    const issue = {
      code: 'cycle',
      message: 'cta -> nav -> cta',
    } satisfies ConfigIssue;

    expectTypeOf(issue).toExtend<ConfigIssue>();
  });

  it('points at the row with a JSON pointer', () => {
    expectTypeOf<ConfigIssue['path']>().toEqualTypeOf<string | undefined>();
  });
});

describe('the published surface', () => {
  it('publishes the envelope config.ts declares', () => {
    expectTypeOf<PublishedConfig<'cta'>>().toEqualTypeOf<
      FeatureConfig<'cta'>
    >();
  });

  it('publishes the envelope without its payload', () => {
    expectTypeOf<PublishedEnvelope>().toEqualTypeOf<ConfigEnvelope>();
  });

  it('publishes the serialized instant', () => {
    expectTypeOf<PublishedInstant>().toEqualTypeOf<SerializedInstant>();
  });

  it('publishes the serialized window condition', () => {
    expectTypeOf<PublishedWindowCondition>().toEqualTypeOf<SerializedWindowCondition>();
  });

  it('publishes the serialized condition', () => {
    expectTypeOf<PublishedCondition>().toEqualTypeOf<SerializedCondition>();
  });

  it('publishes the serialized rule', () => {
    expectTypeOf<PublishedRule>().toEqualTypeOf<SerializedRule>();
  });

  it('publishes the serialized definition', () => {
    expectTypeOf<PublishedDefinition<'cta'>>().toEqualTypeOf<
      SerializedDefinition<'cta'>
    >();
  });

  it('publishes the schema vocabulary', () => {
    expectTypeOf<PublishedSchema>().toEqualTypeOf<FeatureSchema>();
  });

  it('publishes the context schema', () => {
    expectTypeOf<PublishedContextSchema>().toEqualTypeOf<ContextSchema>();
  });

  it('publishes the feature shape', () => {
    expectTypeOf<PublishedFeatureShape>().toEqualTypeOf<FeatureShape>();
  });

  it('publishes the value shape', () => {
    expectTypeOf<PublishedValueShape>().toEqualTypeOf<ValueShape>();
  });

  it('publishes the base field type', () => {
    expectTypeOf<PublishedBaseFieldType>().toEqualTypeOf<BaseFieldType>();
  });

  it('publishes the field type', () => {
    expectTypeOf<PublishedFieldType>().toEqualTypeOf<FieldType>();
  });

  it('publishes the issue code union', () => {
    expectTypeOf<PublishedIssueCode>().toEqualTypeOf<ConfigIssueCode>();
  });

  it('publishes the issue', () => {
    expectTypeOf<PublishedIssue>().toEqualTypeOf<ConfigIssue>();
  });

  it('publishes the validation result', () => {
    expectTypeOf<PublishedValidationResult>().toEqualTypeOf<ValidationResult>();
  });

  it('publishes the reload result', () => {
    expectTypeOf<PublishedReloadResult>().toEqualTypeOf<ReloadResult>();
  });
});
