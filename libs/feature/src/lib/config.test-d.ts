import { describe, expectTypeOf, it } from 'vitest';
import type {
  ConfigIssue,
  FeatureConfig,
  ReloadResult,
  SerializedDefinition,
  ValidationResult,
} from './config.js';
import type { FeatureDefinition } from './types.js';

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
});

describe('ValidationResult', () => {
  it('discriminates on ok', () => {
    const read = (result: ValidationResult): readonly ConfigIssue[] =>
      result.ok ? [] : result.issues;

    expectTypeOf(read).toBeCallableWith({ ok: true });
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
});
