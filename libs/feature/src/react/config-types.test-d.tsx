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
 * second half, and each one pins a react alias to the core entry's declaration
 * of the same name.
 *
 * That is everything this file asserts, and the reason it asserts nothing
 * about what the declarations hold. `config.test-d.ts` holds each of them to
 * its whole shape -- `keyof FeatureConfig` exactly, every member with its
 * `readonly`, every `ReloadResult` arm through `Extract` -- and an identity
 * case here carries those assertions onto the alias a component file imports.
 * An authoring case written against the alias restates them and cannot fail on
 * its own: the mutation that reddens it reddens the core file first.
 *
 * `entry-surface.spec.tsx` holds the rest of the entry's claim. The names
 * arrive as types and never as values, and the set of them is the set the core
 * entry publishes, read off both entries rather than listed by hand.
 */

describe('the document types the react entry re-exports', () => {
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
