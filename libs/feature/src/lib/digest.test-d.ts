import { describe, expectTypeOf, it } from 'vitest';
import { configDigest } from './digest.js';
import { createFeatures } from './features.js';
import { serializeConfig } from './serialize.js';
import { configDigest as publishedConfigDigest } from '../index.js';
import type { ConfigEnvelope, FeatureConfig } from './config.js';

const defs = [
  { key: 'checkout', enabled: true },
  { key: 'express', enabled: true, dependsOn: ['checkout'] },
] as const;

describe('configDigest', () => {
  it('reads the document serializeConfig writes', () => {
    const digest = configDigest(serializeConfig(createFeatures(defs)));

    expectTypeOf(digest).toEqualTypeOf<string>();
  });

  it('returns a string rather than a literal the caller could switch on', () => {
    expectTypeOf(configDigest).returns.toEqualTypeOf<string>();
  });

  it('reads a document keyed on a narrower union than FeatureKey', () => {
    const narrowed: FeatureConfig<'checkout' | 'express'> = {
      version: 41,
      features: [{ key: 'checkout', enabled: true }],
    };

    expectTypeOf(configDigest(narrowed)).toEqualTypeOf<string>();
  });

  it('reads a document keyed on a number, which a JSON object key is not', () => {
    const numeric: FeatureConfig<7 | 9> = {
      features: [{ key: 7, enabled: true }],
    };

    expectTypeOf(configDigest(numeric)).toEqualTypeOf<string>();
  });

  it('reads a document that already carries a digest', () => {
    const carried: FeatureConfig = {
      digest: 'ddd6fe2b511b25e52af770cc85ec4284',
      features: [],
    };

    expectTypeOf(configDigest(carried)).toEqualTypeOf<string>();
  });

  it('refuses an envelope with no payload', () => {
    const envelope: ConfigEnvelope = { version: 41 };

    // @ts-expect-error -- the digest covers the features, and an envelope on
    // its own names no configuration to cover.
    configDigest(envelope);

    expectTypeOf(configDigest).parameter(0).toEqualTypeOf<FeatureConfig>();
  });

  it('refuses a bare array of definitions', () => {
    // @ts-expect-error -- § 1 gives the document no bare-array form, so a list
    // assigned whole carries no version for the digest to cover.
    configDigest([{ key: 'checkout', enabled: true }]);

    expectTypeOf(configDigest).parameter(0).not.toEqualTypeOf<object>();
  });

  it('refuses a live store, which serializeConfig converts first', () => {
    // @ts-expect-error -- the digest is defined over the serialized form, and a
    // store holds a `Date` the document narrows away.
    configDigest(createFeatures(defs));

    expectTypeOf(configDigest).parameter(0).toEqualTypeOf<FeatureConfig>();
  });

  it('takes one parameter, so no caller passes a salt', () => {
    expectTypeOf(configDigest).parameters.toEqualTypeOf<[FeatureConfig]>();
  });

  it('is published at the entry point at the type the module declares', () => {
    expectTypeOf(publishedConfigDigest).toEqualTypeOf(configDigest);
  });
});
