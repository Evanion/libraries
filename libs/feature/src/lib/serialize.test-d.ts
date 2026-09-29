import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';
import { serializeConfig } from './serialize.js';
import { serializeConfig as publishedSerializeConfig } from '../index.js';
import type { Features } from './features.js';
import type {
  ConfigEnvelope,
  FeatureConfig,
  SerializedDefinition,
  SerializedInstant,
} from './config.js';

const defs = [
  { key: 'checkout', enabled: true },
  {
    key: 'cta',
    enabled: true,
    dependsOn: ['checkout'],
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
] as const;

type Flags = {
  checkout: never;
  cta: { variant: 'control' | 'blue'; value: { label: string } };
};

describe('serializeConfig', () => {
  it('keys the document on the keys the store inferred', () => {
    const document = serializeConfig(createFeatures(defs));

    expectTypeOf(document).toEqualTypeOf<FeatureConfig<'checkout' | 'cta'>>();
  });

  it('keys the document on a numeric key, which a JSON object key is not', () => {
    const document = serializeConfig(
      createFeatures([
        { key: 7, enabled: true },
        { key: 9, enabled: true },
      ] as const),
    );

    expectTypeOf(document.features[0]?.key).toEqualTypeOf<7 | 9 | undefined>();
  });

  it('narrows a definition to the keys the store holds', () => {
    const document = serializeConfig(createFeatures(defs));

    expectTypeOf(document.features[0]).toEqualTypeOf<
      SerializedDefinition<'checkout' | 'cta'> | undefined
    >();
  });

  it('leaves a variant value unknown, which a generated interface reaches', () => {
    const document = serializeConfig(createFeatures(defs));

    expectTypeOf(
      document.features[0]?.variants?.[0]?.value,
    ).toEqualTypeOf<unknown>();
  });

  it('narrows a window condition to an instant JSON carries', () => {
    const document = serializeConfig(createFeatures(defs));
    const condition = document.features[0]?.rules?.[0]?.when?.[0];

    expectTypeOf(condition)
      .extract<{ op: 'before' | 'after' }>()
      .toEqualTypeOf<{
        field: 'now';
        op: 'before' | 'after';
        value: SerializedInstant;
      }>();
  });

  it('takes the envelope as an optional second parameter', () => {
    expectTypeOf(serializeConfig<Flags>)
      .parameter(1)
      .toEqualTypeOf<ConfigEnvelope | undefined>();
  });

  it('refuses a digest at the envelope, which configDigest alone writes', () => {
    const features = createFeatures(defs);

    serializeConfig(features, {
      version: 41,
      // @ts-expect-error -- a serializer copying a digest emits a document
      // whose digest covers the bytes of an earlier one.
      digest: 'd9f1c0a4',
    });

    expectTypeOf(serializeConfig(features, { version: 41 })).toEqualTypeOf<
      FeatureConfig<'checkout' | 'cta'>
    >();
  });

  it('refuses a whole document at the envelope', () => {
    const features = createFeatures(defs);
    const document: FeatureConfig = { version: 41, features: [] };

    // @ts-expect-error -- a fetched document assigned whole carries both the
    // digest and the payload of the document before it.
    serializeConfig(features, document);

    expectTypeOf(serializeConfig(features)).toExtend<FeatureConfig>();
  });

  it('reads a store built with an observer and one built without', () => {
    const observed: Features<Flags, true> = createFeatures(defs, {
      observe: () => undefined,
    });
    const plain: Features<Flags, false> = createFeatures<Flags>(defs);
    const either: Features<Flags> = plain;

    expectTypeOf(serializeConfig(observed)).toEqualTypeOf<
      FeatureConfig<'checkout' | 'cta'>
    >();
    expectTypeOf(serializeConfig(plain)).toEqualTypeOf<
      FeatureConfig<'checkout' | 'cta'>
    >();
    expectTypeOf(serializeConfig(either)).toEqualTypeOf<
      FeatureConfig<'checkout' | 'cta'>
    >();
  });

  it('reads a store typed from a hand-written schema', () => {
    const features: Features<Flags, false> = createFeatures<Flags>([
      { key: 'checkout', enabled: true },
    ]);

    expectTypeOf(serializeConfig(features).features[0]?.key).toEqualTypeOf<
      'checkout' | 'cta' | undefined
    >();
  });

  it('refuses a value that is not a store', () => {
    // @ts-expect-error -- the serializer reads `config` off a store, and an
    // empty object carries no definitions to write.
    serializeConfig({});

    expectTypeOf(serializeConfig).parameter(0).not.toEqualTypeOf<object>();
  });

  it('is published at the entry point at the type the module declares', () => {
    expectTypeOf(publishedSerializeConfig).toEqualTypeOf(serializeConfig);
  });
});
