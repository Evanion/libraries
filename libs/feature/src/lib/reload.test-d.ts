import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';
import { serializeConfig } from './serialize.js';
import type { ConfigEnvelope, FeatureConfig, ReloadResult } from './config.js';

const defs = [{ key: 'cta', enabled: true }] as const;

describe('reload', () => {
  it('returns a discriminated result', () => {
    const features = createFeatures(defs);
    const result = features.reload({
      features: [{ key: 'cta', enabled: true }],
    });

    if (result.ok) {
      expectTypeOf(result.changed).toExtend<readonly (string | number)[]>();
    } else {
      expectTypeOf(result.rejected).toEqualTypeOf<
        string | number | undefined
      >();
    }
  });

  it('lifts the version as an opaque value', () => {
    const features = createFeatures(defs);

    expectTypeOf(features.version).toEqualTypeOf<string | number | undefined>();
  });

  it('refuses a candidate naming a key the store does not declare', () => {
    const features = createFeatures(defs);

    features.reload({
      // @ts-expect-error -- 'nope' is not a key this store declares.
      features: [{ key: 'nope', enabled: true }],
    });
  });
});

describe('reload, the document it takes', () => {
  it('takes the document the same store serialized', () => {
    const features = createFeatures(defs);

    expectTypeOf(features.reload).parameter(0).toExtend<FeatureConfig<'cta'>>();
    expectTypeOf(features.reload).toBeCallableWith(serializeConfig(features));
  });

  it('refuses a Date where a document carries an instant', () => {
    const features = createFeatures(defs);

    features.reload({
      features: [
        {
          key: 'cta',
          enabled: true,
          rules: [
            {
              when: [
                {
                  field: 'now',
                  op: 'after',
                  // @ts-expect-error -- a serialized instant is a string or a number.
                  value: new Date(),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('refuses an envelope member the document does not declare', () => {
    const features = createFeatures(defs);

    features.reload({
      features: [{ key: 'cta', enabled: true }],
      // @ts-expect-error -- the envelope carries six members and this is not one.
      hashVersion: 2,
    });
  });

  it('takes a numeric key from a store keyed on one', () => {
    const features = createFeatures([{ key: 1, enabled: true }] as const);

    expectTypeOf(features.reload).toBeCallableWith({
      features: [{ key: 1, enabled: false }],
    });
  });

  it('takes a key the named schema declares and refuses one it does not', () => {
    interface Flags {
      cta: { variant: 'control' | 'blue'; value: { label: string } };
    }
    const features = createFeatures<Flags>(JSON.parse('[]'));

    features.reload({ features: [{ key: 'cta', enabled: true }] });
    features.reload({
      // @ts-expect-error -- 'nope' is not a key this schema declares.
      features: [{ key: 'nope', enabled: true }],
    });
  });
});

describe('reload, the result it answers with', () => {
  it('answers the result type the package exports', () => {
    const features = createFeatures(defs);

    expectTypeOf(features.reload).returns.toEqualTypeOf<ReloadResult>();
  });

  it('declares no changed on the refusal and no issues on the success', () => {
    const features = createFeatures(defs);
    const result = features.reload({
      features: [{ key: 'cta', enabled: true }],
    });

    if (result.ok) {
      expectTypeOf(result.previousVersion).toEqualTypeOf<
        string | number | undefined
      >();
      expectTypeOf(result).not.toHaveProperty('issues');
    } else {
      expectTypeOf(result).not.toHaveProperty('changed');
    }
  });

  it('hands back a changed array a caller cannot write to', () => {
    const features = createFeatures(defs);
    const result = features.reload({
      features: [{ key: 'cta', enabled: true }],
    });

    if (result.ok) {
      // @ts-expect-error -- `changed` is readonly, so a caller edits no copy of it.
      result.changed.push('cta');
    }
  });
});

describe('the members a reload writes', () => {
  it('declares version and envelope as readonly', () => {
    const features = createFeatures(defs);

    // @ts-expect-error -- a reload is the writer of the installed version.
    features.version = 1;
    // @ts-expect-error -- a reload is the writer of the installed envelope.
    features.envelope = {};
  });

  it('declares an envelope that carries no payload', () => {
    const features = createFeatures(defs);

    expectTypeOf(features.envelope).toEqualTypeOf<ConfigEnvelope>();
    expectTypeOf(features.envelope).not.toHaveProperty('features');
  });

  it('fences the envelope digest to the one function that writes it', () => {
    expectTypeOf<ConfigEnvelope['digest']>().toEqualTypeOf<undefined>();
  });
});
