import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';

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
