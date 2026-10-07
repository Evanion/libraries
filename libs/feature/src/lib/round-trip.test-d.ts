import { describe, expectTypeOf, it } from 'vitest';
import { configDigest } from './digest.js';
import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';
import type { Features } from './features.js';

interface Flags {
  cta: { variant: 'control' | 'blue'; value: { label: string } };
  checkout: never;
}

const defs = [
  { key: 'checkout', enabled: true },
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50, order: 0, value: { label: 'Buy' } },
      { name: 'blue', weight: 50, order: 1, value: { label: 'Get it' } },
    ],
  },
] as const;

describe('the trip from a store to a document and back', () => {
  it('hands the serialized document to the parser with no cast', () => {
    const document = serializeConfig(createFeatures(defs));

    expectTypeOf(parseFeatureConfig(document)).not.toBeNever();
  });

  it('keys the document on the keys the store it came from holds', () => {
    const document = serializeConfig(createFeatures(defs));

    expectTypeOf(document).toEqualTypeOf<FeatureConfig<'checkout' | 'cta'>>();
  });

  it('answers the store at the schema the caller named on the way back', () => {
    const result = parseFeatureConfig<Flags>(
      serializeConfig(createFeatures(defs)),
    );

    if (result.ok) {
      expectTypeOf(result.features).toEqualTypeOf<Features<Flags, boolean>>();
    }
  });

  it('re-serializes to a document keyed on the schema, not on FeatureKey', () => {
    const result = parseFeatureConfig<Flags>({ features: [] });

    if (result.ok) {
      expectTypeOf(serializeConfig(result.features)).toEqualTypeOf<
        FeatureConfig<'cta' | 'checkout'>
      >();
    }
  });

  it('closes the trip over a document whose keys no literal named', () => {
    const arrived = JSON.parse('{"features":[]}') as FeatureConfig;
    const result = parseFeatureConfig(arrived);

    if (result.ok) {
      expectTypeOf(serializeConfig(result.features)).toEqualTypeOf<
        FeatureConfig<string | number>
      >();
    }
  });

  it('refuses a document carrying a key the named schema does not declare', () => {
    const other = serializeConfig(
      createFeatures([{ key: 'nav', enabled: true }] as const),
    );

    // @ts-expect-error -- the document is keyed on 'nav' and the schema declares
    // 'cta' and 'checkout', so the trip does not close over the two together.
    parseFeatureConfig<Flags>(other);

    expectTypeOf(other).toEqualTypeOf<FeatureConfig<'nav'>>();
  });

  it('digests the document the trip produced', () => {
    const result = parseFeatureConfig<Flags>({ features: [] });

    if (result.ok) {
      expectTypeOf(
        configDigest(serializeConfig(result.features)),
      ).toEqualTypeOf<string>();
    }
  });

  it('carries the advisory duration out as the number it took in', () => {
    const document = serializeConfig(createFeatures(defs));

    expectTypeOf(document.maxStale).toEqualTypeOf<number | undefined>();
  });

  it('declares no digest on the document it writes back', () => {
    const document = serializeConfig(createFeatures(defs));

    expectTypeOf(document.digest).toEqualTypeOf<string | undefined>();
    expectTypeOf(
      createFeatures(defs).envelope.digest,
    ).toEqualTypeOf<undefined>();
  });
});
