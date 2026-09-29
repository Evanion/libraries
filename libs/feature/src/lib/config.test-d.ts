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
  JsonValue as PublishedJsonValue,
  ReloadResult as PublishedReloadResult,
  SerializedAttributeCondition as PublishedAttributeCondition,
  SerializedCondition as PublishedCondition,
  SerializedDefinition as PublishedDefinition,
  SerializedInstant as PublishedInstant,
  SerializedRule as PublishedRule,
  SerializedVariantSpec as PublishedVariantSpec,
  SerializedWindowCondition as PublishedWindowCondition,
  ValidationResult as PublishedValidationResult,
  ValueShape as PublishedValueShape,
} from '../index.js';
import type {
  AttributeCondition,
  DayOfWeekCondition,
  FeatureDefinition,
  FeatureKey,
  Instant,
  Rule,
  VariantSpec,
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

  it('holds every member readonly, so a holder cannot edit what it digested', () => {
    expectTypeOf<FeatureConfig<'cta'>>().toEqualTypeOf<{
      readonly version?: string | number;
      readonly digest?: string;
      readonly schema?: FeatureSchema;
      readonly schemaVersion?: string;
      readonly maxStale?: number;
      readonly features: readonly SerializedDefinition<'cta'>[];
    }>();
  });

  it('refuses a write to the feature list, which the digest covers', () => {
    const document: FeatureConfig = { features: [] };

    // @ts-expect-error -- a holder that rewrote the list would answer from a
    // document no other process holds while reporting the digest of the one it
    // received.
    document.features = [];

    expectTypeOf(document.features).toEqualTypeOf<
      readonly SerializedDefinition[]
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

  it('defaults its key parameter to every key a store admits', () => {
    expectTypeOf<
      FeatureConfig['features'][number]['key']
    >().toEqualTypeOf<FeatureKey>();
  });

  it('hands a numeric-keyed document to a signature naming the bare envelope', () => {
    const read = (config: FeatureConfig) => config.features.length;
    const numeric = {
      features: [{ key: 1, enabled: true }],
    } satisfies FeatureConfig<1 | 2>;

    expectTypeOf(read).toBeCallableWith(numeric);
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

  it('reports every issue a refusal found, not the first', () => {
    expectTypeOf<
      Extract<ReloadResult, { ok: false }>['issues']
    >().toEqualTypeOf<readonly ConfigIssue[]>();
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
  it('drops the payload and keeps the four members that describe it', () => {
    expectTypeOf<keyof ConfigEnvelope>().toEqualTypeOf<
      'version' | 'digest' | 'schema' | 'schemaVersion' | 'maxStale'
    >();
  });

  it('holds its digest at the one type no caller can produce a value of', () => {
    expectTypeOf<ConfigEnvelope['digest']>().toEqualTypeOf<undefined>();
  });

  it('refuses a whole document, which carries a digest over other bytes', () => {
    const write = (envelope: ConfigEnvelope): ConfigEnvelope => envelope;
    const document: FeatureConfig = {
      version: 41,
      digest: 'd9f1c0a4',
      features: [],
    };

    // @ts-expect-error -- a fetched document assigned whole would hand the
    // serializer the digest of the document before it.
    write(document);

    expectTypeOf(write).parameter(0).toEqualTypeOf<ConfigEnvelope>();
  });

  it('drops the digest, which configDigest writes over the emitted bytes', () => {
    const envelope = {
      version: 41,
      // @ts-expect-error -- a caller handing a serializer a cached digest emits
      // a document whose digest covers the bytes of an earlier one.
      digest: 'd9f1c0a4',
    } satisfies ConfigEnvelope;

    expectTypeOf(envelope.version).toExtend<number>();
  });

  it('leaves every member optional, so a serializer writes a bare envelope', () => {
    const envelope = {} satisfies ConfigEnvelope;

    expectTypeOf(envelope).toExtend<ConfigEnvelope>();
  });

  it('refuses a write to the version and to the digest a serializer never sets', () => {
    const envelope: ConfigEnvelope = {};

    // @ts-expect-error -- the envelope a serializer received describes the
    // document it is about to emit.
    envelope.version = 41;
    // @ts-expect-error -- `configDigest` is the one writer of the member.
    envelope.digest = undefined;

    expectTypeOf<Pick<ConfigEnvelope, 'version' | 'digest'>>().toEqualTypeOf<{
      readonly version?: string | number;
      readonly digest?: never;
    }>();
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

  it('carries its instant in the two forms a document holds', () => {
    expectTypeOf<
      SerializedWindowCondition['value']
    >().toEqualTypeOf<SerializedInstant>();
  });

  it('takes epoch milliseconds, which a producer with no ISO formatter writes', () => {
    const condition = {
      field: 'now',
      op: 'before',
      value: 1767225600000,
    } satisfies SerializedWindowCondition;

    expectTypeOf(condition.value).toEqualTypeOf<number>();
  });

  it('refuses the live window condition a store holds', () => {
    expectTypeOf<WindowCondition>().not.toExtend<SerializedWindowCondition>();
  });
});

describe('JsonValue', () => {
  it('takes the five things JSON writes', () => {
    expectTypeOf<
      string | number | boolean | null | readonly JsonValue[]
    >().toExtend<JsonValue>();
  });

  it('refuses the Date a live store admits, which JSON has no form for', () => {
    expectTypeOf<Date>().not.toExtend<JsonValue>();
  });

  it('refuses a Date nested inside an object a document carries', () => {
    expectTypeOf<{ endsAt: Date }>().not.toExtend<JsonValue>();
  });

  it('refuses a Date nested inside an array a document carries', () => {
    expectTypeOf<readonly Date[]>().not.toExtend<JsonValue>();
  });

  it('takes an object whose members are themselves JSON', () => {
    const value = {
      endsAt: '2026-12-24T00:00:00.000Z',
      tiers: [1, 2],
    } satisfies JsonValue;

    expectTypeOf(value.tiers).toEqualTypeOf<number[]>();
  });

  it('refuses a member written as undefined, which canonical erases the way JSON does', () => {
    // @ts-expect-error -- `canonical.ts:46` filters the member out and
    // `JSON.stringify` omits it, so the process that wrote it holds a key no
    // other process holds and `configDigest` reports the two agree.
    const value = { endsAt: undefined } satisfies JsonValue;

    expectTypeOf(value.endsAt).toEqualTypeOf<undefined>();
  });

  it('refuses a member whose type admits undefined, which is how an absent one arrives', () => {
    const readTier = (): string | undefined => undefined;

    // @ts-expect-error -- `'tier' in value` answers true in the publisher and
    // false in every process that fetched the document.
    const value = { tier: readTier() } satisfies JsonValue;

    expectTypeOf(value.tier).toEqualTypeOf<string | undefined>();
  });

  it('takes a type whose members are optional, which carries no member at all when absent', () => {
    type Sale = { label?: string };

    expectTypeOf<Sale>().toExtend<JsonValue>();
  });

  it('refuses a value annotated with an interface, which is why a variant value carries unknown', () => {
    interface Sale {
      label: string;
    }

    expectTypeOf<Sale>().not.toExtend<JsonValue>();
  });
});

describe('SerializedAttributeCondition', () => {
  it('carries the JSON an evaluator compares the context against', () => {
    expectTypeOf<
      SerializedAttributeCondition['value']
    >().toEqualTypeOf<JsonValue>();
  });

  it('keeps every member a live attribute condition declares', () => {
    expectTypeOf<keyof SerializedAttributeCondition>().toEqualTypeOf<
      keyof AttributeCondition
    >();
  });

  it('is an attribute condition a live store could hold', () => {
    expectTypeOf<SerializedAttributeCondition>().toExtend<AttributeCondition>();
  });

  it('refuses a live attribute condition, whose value admits a Date', () => {
    expectTypeOf<AttributeCondition>().not.toExtend<SerializedAttributeCondition>();
  });

  it('refuses a write to the value, which the digest covers', () => {
    const condition: SerializedAttributeCondition = {
      field: 'plan',
      op: 'eq',
      value: 'pro',
    };

    // @ts-expect-error -- a rewritten condition decides differently from the
    // document every other process holds under the same digest.
    condition.value = 'free';

    expectTypeOf<Pick<SerializedAttributeCondition, 'value'>>().toEqualTypeOf<{
      readonly value: JsonValue;
    }>();
  });
});

describe('SerializedCondition', () => {
  it('takes a serialized window condition, the arm this vocabulary exists for', () => {
    expectTypeOf<SerializedWindowCondition>().toExtend<SerializedCondition>();
  });

  it('takes a window condition a document carries as an ISO string', () => {
    const document = {
      features: [
        {
          key: 'cta',
          enabled: true,
          rules: [
            {
              when: [
                { field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' },
              ],
            },
          ],
        },
      ],
    } satisfies FeatureConfig<'cta'>;

    expectTypeOf(document.features).toBeArray();
  });

  it('takes a day-of-week condition unchanged', () => {
    expectTypeOf<DayOfWeekCondition>().toExtend<SerializedCondition>();
  });

  it('refuses a live window condition', () => {
    expectTypeOf<WindowCondition>().not.toExtend<SerializedCondition>();
  });

  it('takes the JSON an attribute value carries', () => {
    const condition = {
      field: 'plan',
      op: 'in',
      value: ['pro', 'team'],
    } satisfies SerializedCondition;

    expectTypeOf(condition.value).toEqualTypeOf<string[]>();
  });

  it('refuses a Date in an attribute value, which digests as the string it is not', () => {
    const condition = {
      field: 'signedUpAt',
      op: 'eq',
      // @ts-expect-error -- `canonical` writes this `Date` as the ISO string a
      // parsed document holds, so a process holding the object and a process
      // holding the string agree on the digest and disagree under `===`.
      value: new Date('2026-10-01T00:00:00Z'),
    } satisfies SerializedCondition;

    expectTypeOf(condition.field).toEqualTypeOf<string>();
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

  it('leaves its conditions optional, so no rules means on', () => {
    expectTypeOf<SerializedRule['when']>().toEqualTypeOf<
      readonly SerializedCondition[] | undefined
    >();
  });

  it('takes a rule that ramps a percentage and matches on nothing', () => {
    const rule = { rollout: { percent: 50 } } satisfies SerializedRule;

    expectTypeOf(rule.rollout.percent).toEqualTypeOf<number>();
  });

  it('refuses a live rule, whose conditions admit a Date', () => {
    expectTypeOf<Rule>().not.toExtend<SerializedRule>();
  });

  it('refuses a write to its condition list', () => {
    const rule: SerializedRule = { when: [] };

    // @ts-expect-error -- a rewritten rule matches differently from the
    // document every other process holds under the same digest.
    rule.when = [];

    expectTypeOf<Pick<SerializedRule, 'when'>>().toEqualTypeOf<{
      readonly when?: readonly SerializedCondition[];
    }>();
  });
});

describe('SerializedVariantSpec', () => {
  it('carries the value a caller reads off valueOf, which the engine never reads', () => {
    expectTypeOf<SerializedVariantSpec['value']>().toEqualTypeOf<unknown>();
  });

  it('keeps every member a live variant declares', () => {
    expectTypeOf<keyof SerializedVariantSpec>().toEqualTypeOf<
      keyof VariantSpec
    >();
  });

  it('is a variant a live store could hold', () => {
    expectTypeOf<SerializedVariantSpec>().toExtend<VariantSpec>();
  });

  it('takes a live variant, whose value serializeConfig converts on the way out', () => {
    expectTypeOf<VariantSpec>().toExtend<SerializedVariantSpec>();
  });

  it('takes a value typed by the interface a generator emits from the schema', () => {
    interface SaleValue {
      label: string;
      discount: number;
    }

    const sale = { label: 'Get it', discount: 20 } as SaleValue;
    const variant = {
      name: 'sale',
      weight: 100,
      value: sale,
    } satisfies SerializedVariantSpec;

    expectTypeOf(variant.value).toEqualTypeOf<SaleValue>();
  });

  it('refuses a write to the value, which the digest covers', () => {
    const variant: SerializedVariantSpec = { name: 'sale', weight: 100 };

    // @ts-expect-error -- `valueOf` would answer one thing here and another in
    // every process holding the document this digest names.
    variant.value = { label: 'Get it' };

    expectTypeOf<Pick<SerializedVariantSpec, 'value'>>().toEqualTypeOf<{
      readonly value?: unknown;
    }>();
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

  it('carries a variant value the engine hands to its caller unread', () => {
    expectTypeOf<
      NonNullable<SerializedDefinition<'cta'>['variants']>[number]['value']
    >().toEqualTypeOf<unknown>();
  });

  it('refuses a write to its rules and its variants', () => {
    const definition: SerializedDefinition<'cta'> = {
      key: 'cta',
      enabled: true,
    };

    // @ts-expect-error -- a rewritten definition decides differently from the
    // document every other process holds under the same digest.
    definition.rules = [];
    // @ts-expect-error -- the same digest would cover a variant set this
    // process no longer holds.
    definition.variants = [];

    expectTypeOf<
      Pick<SerializedDefinition<'cta'>, 'rules' | 'variants'>
    >().toEqualTypeOf<{
      readonly rules?: readonly SerializedRule[];
      readonly variants?: readonly SerializedVariantSpec[];
    }>();
  });

  it('refuses a live definition, whose rules admit a Date', () => {
    expectTypeOf<FeatureDefinition<'cta'>>().not.toExtend<
      SerializedDefinition<'cta'>
    >();
  });

  it('defaults its key parameter to every key a store admits', () => {
    expectTypeOf<SerializedDefinition['key']>().toEqualTypeOf<FeatureKey>();
  });

  it('holds a definition the bare envelope carries', () => {
    expectTypeOf<
      FeatureConfig['features'][number]
    >().toExtend<SerializedDefinition>();
  });

  it('takes a definition keyed on a number, as the bare envelope does', () => {
    const definition = { key: 1, enabled: true } satisfies SerializedDefinition;

    expectTypeOf(definition).toExtend<SerializedDefinition>();
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

  it('refuses a write to its variant shapes', () => {
    const shape: FeatureShape = {};

    // @ts-expect-error -- a schema is immutable at its `schemaVersion`, and a
    // holder that rewrote one would validate against a shape no publisher
    // serves.
    shape.variants = {};

    expectTypeOf<Readonly<FeatureShape>>().toEqualTypeOf<FeatureShape>();
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

  it('refuses a write to its field declarations', () => {
    const schema: ContextSchema = {};

    // @ts-expect-error -- a schema is immutable at its `schemaVersion`, and a
    // rewritten field type validates a context against a declaration no
    // publisher serves.
    schema.fields = {};

    expectTypeOf<Readonly<ContextSchema>>().toEqualTypeOf<ContextSchema>();
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

  it('declares a shape for a feature the document does not carry, which a schema immutable at its version outlives', () => {
    const document = {
      schemaVersion: 's7',
      schema: { features: { cta: {}, nav: {} } },
      features: [{ key: 'cta', enabled: true }],
    } satisfies FeatureConfig<'cta'>;

    expectTypeOf(document.schema.features.nav).toExtend<FeatureShape>();
  });

  it('names its context vocabulary, which a code generator reads field types off', () => {
    expectTypeOf<FeatureSchema['context']>().toEqualTypeOf<
      ContextSchema | undefined
    >();
  });

  it('takes a document that declares a context and no feature shapes', () => {
    const schema = {
      context: { fields: { plan: 'string' } },
    } satisfies FeatureSchema;

    expectTypeOf(schema.context.fields.plan).toExtend<FieldType>();
  });

  it('refuses a write to either vocabulary', () => {
    const schema: FeatureSchema = {};

    // @ts-expect-error -- a schema is immutable at its `schemaVersion`.
    schema.context = {};
    // @ts-expect-error -- the same rule covers the shapes a generator read.
    schema.features = {};

    expectTypeOf<Readonly<FeatureSchema>>().toEqualTypeOf<FeatureSchema>();
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

  it('carries the closed code union, so a nineteenth code reaches no issue', () => {
    expectTypeOf<ConfigIssue['code']>().toEqualTypeOf<ConfigIssueCode>();
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

  it('publishes the serialized attribute condition', () => {
    expectTypeOf<PublishedAttributeCondition>().toEqualTypeOf<SerializedAttributeCondition>();
  });

  it('publishes the JSON a document carries at an uninterpreted member', () => {
    expectTypeOf<PublishedJsonValue>().toEqualTypeOf<JsonValue>();
  });

  it('publishes the serialized variant', () => {
    expectTypeOf<PublishedVariantSpec>().toEqualTypeOf<SerializedVariantSpec>();
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
