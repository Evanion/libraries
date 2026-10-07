import { describe, expectTypeOf, it } from 'vitest';
import { parseFeatureConfig } from './parse.js';
import type { FeatureConfig } from './config.js';

interface Flags {
  cta: { variant: 'control' | 'blue'; value: { label: string } };
  checkout: never;
}

describe('parseFeatureConfig', () => {
  it('narrows the store on ok', () => {
    const result = parseFeatureConfig<Flags>({ features: [] });

    if (result.ok) {
      expectTypeOf(result.features.variantOf('cta')).toEqualTypeOf<
        'control' | 'blue' | undefined
      >();
    }
  });

  it('carries the issues on the other arm', () => {
    const result = parseFeatureConfig<Flags>({ features: [] });

    if (!result.ok) {
      expectTypeOf(result.issues[0]?.code).toExtend<string | undefined>();
    }
  });

  it('refuses a document naming a feature the schema does not declare', () => {
    // @ts-expect-error -- 'nope' is not a key of Flags.
    const document = {
      features: [{ key: 'nope', enabled: true }],
    } as FeatureConfig<keyof Flags>;

    expectTypeOf(document).toBeObject();
  });
});
