import { describe, expectTypeOf, it } from 'vitest';
import { validateConfig as published } from '../index.js';
import { collectIssues, validateConfig } from './validate.js';
import { graphErrors } from './graph.js';
import { validateVariants, variantErrors } from './variants.js';
import type { VariantDefect } from './variants.js';
import type { Checkable, Found } from './validate.js';
import type {
  ConfigIssue,
  ConfigIssueCode,
  FeatureConfig,
  SerializedCondition,
  ValidationResult,
} from './config.js';
import type { FeatureConfigError } from './errors.js';
import type { FeatureDefinition } from './types.js';

/**
 * A definition an author writes in TypeScript, whose window carries a `Date`.
 *
 * `FeatureConfig` refuses this and `createFeatures` holds it, which is the pair
 * `Checkable` exists to admit.
 */
const held = {
  key: 'window',
  enabled: true,
  rules: [{ when: [{ field: 'now', op: 'before', value: new Date() }] }],
} satisfies FeatureDefinition;

describe('validateConfig', () => {
  it('answers the result type the reload path answers with', () => {
    expectTypeOf(validateConfig).returns.toEqualTypeOf<ValidationResult>();
  });

  it('publishes the function the module declares', () => {
    expectTypeOf(published).toEqualTypeOf<typeof validateConfig>();
  });

  it('takes a whole document, and no bare definitions array', () => {
    expectTypeOf(validateConfig).parameter(0).toEqualTypeOf<FeatureConfig>();
    expectTypeOf<readonly FeatureDefinition[]>().not.toExtend<FeatureConfig>();
  });

  it('reads a document keyed on a narrower union than the envelope declares', () => {
    const narrow = {
      features: [{ key: 'a', enabled: true, dependsOn: ['b'] }],
    } satisfies FeatureConfig<'a' | 'b'>;

    expectTypeOf(validateConfig).toBeCallableWith(narrow);
  });

  it('reads a document keyed on a numeric enum', () => {
    const numeric = {
      features: [{ key: 7, enabled: true, dependsOn: [9] }],
    } satisfies FeatureConfig<7 | 9>;

    expectTypeOf(validateConfig).toBeCallableWith(numeric);
  });

  it('refuses a document whose window instant is a Date, which JSON loses', () => {
    expectTypeOf<{
      features: readonly [typeof held];
    }>().not.toExtend<FeatureConfig>();
    expectTypeOf<{
      field: 'now';
      op: 'before';
      value: Date;
    }>().not.toExtend<SerializedCondition>();
  });
});

describe('collectIssues', () => {
  it('reads a document and the definitions a store holds alike', () => {
    expectTypeOf<FeatureConfig>().toExtend<Checkable>();
    expectTypeOf(collectIssues).toBeCallableWith({ features: [held] });
  });

  it('takes the option the literal path reads its variant order with', () => {
    expectTypeOf(collectIssues).toBeCallableWith(
      { features: [held] },
      { arrayIsOrder: true },
    );
  });

  it('answers a list no caller appends to', () => {
    expectTypeOf(collectIssues).returns.toEqualTypeOf<readonly Found[]>();
  });

  it('pairs each issue with the error the throwing path raises for it', () => {
    expectTypeOf<Found['issue']>().toEqualTypeOf<ConfigIssue>();
    expectTypeOf<Found['error']>().toEqualTypeOf<FeatureConfigError>();
  });

  it('refuses a bare definitions array, which names no envelope member', () => {
    expectTypeOf<readonly FeatureDefinition[]>().not.toExtend<Checkable>();
  });
});

describe('graphErrors', () => {
  it('answers the errors buildGraph throws the first of', () => {
    expectTypeOf(graphErrors).returns.toEqualTypeOf<
      readonly FeatureConfigError[]
    >();
  });

  it('infers the key type off the definitions it walks', () => {
    expectTypeOf(graphErrors).toBeCallableWith([
      { key: 7, enabled: true, dependsOn: [9] },
      { key: 9, enabled: true },
    ]);
  });
});

describe('variantErrors', () => {
  it('answers each defect with the code its issue carries', () => {
    expectTypeOf(variantErrors).returns.toEqualTypeOf<
      readonly VariantDefect[]
    >();
    expectTypeOf<VariantDefect['error']>().toEqualTypeOf<FeatureConfigError>();
    expectTypeOf<VariantDefect['code']>().toEqualTypeOf<ConfigIssueCode>();
    expectTypeOf<VariantDefect['member']>().toEqualTypeOf<
      'variants' | 'rules'
    >();
  });

  it('reads one definition, where the graph reads the whole list', () => {
    expectTypeOf(variantErrors).toBeCallableWith({
      key: 9,
      enabled: true,
      variants: [{ name: 'only', weight: 1 }],
    });
  });

  it('takes the option that says the array is the variant order', () => {
    expectTypeOf(variantErrors).toBeCallableWith(
      { key: 'cta', enabled: true, variants: [{ name: 'only', weight: 1 }] },
      { arrayIsOrder: true },
    );
  });
});

describe('validateVariants', () => {
  it('answers nothing, so a caller reads the throw and not a list', () => {
    expectTypeOf(validateVariants).returns.toBeVoid();
  });
});
