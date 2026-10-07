import { describe, expectTypeOf, it } from 'vitest';
import { parseFeatureConfig } from './parse.js';
import type { ConfigIssueCode, FeatureConfig } from './config.js';
import type { Features } from './features.js';
import type { FeatureEvent } from './observe.js';

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

describe('the arms parseFeatureConfig discriminates', () => {
  it('declares no store on the refusal', () => {
    const result = parseFeatureConfig<Flags>({ features: [] });

    if (!result.ok) {
      // @ts-expect-error -- the refusal arm carries the issues and no store.
      const store = result.features;

      expectTypeOf(store).toBeAny();
    }
  });

  it('declares no issues on the acceptance', () => {
    const result = parseFeatureConfig<Flags>({ features: [] });

    if (result.ok) {
      // @ts-expect-error -- the acceptance arm carries the store and no issues.
      const issues = result.issues;

      expectTypeOf(issues).toBeAny();
    }
  });

  it('answers the store at the schema the caller named', () => {
    const result = parseFeatureConfig<Flags>({ features: [] });

    if (result.ok) {
      expectTypeOf(result.features).toEqualTypeOf<Features<Flags, boolean>>();
    }
  });

  it('answers the variant value the named schema declares', () => {
    const result = parseFeatureConfig<Flags>({ features: [] });

    if (result.ok) {
      expectTypeOf(result.features.valueOf('cta')).toEqualTypeOf<
        { label: string } | undefined
      >();
    }
  });

  it('reports the issue codes the checker names', () => {
    const result = parseFeatureConfig<Flags>({ features: [] });

    if (!result.ok) {
      expectTypeOf(result.issues[0]?.code).toEqualTypeOf<
        ConfigIssueCode | undefined
      >();
    }
  });
});

describe('the document parseFeatureConfig takes', () => {
  it('keys on a string or a number when the caller names no schema', () => {
    const config: FeatureConfig<number> = {
      features: [{ key: 7, enabled: true }],
    };
    const result = parseFeatureConfig(config);

    expectTypeOf(
      result.ok ? result.features.isEnabled(7) : false,
    ).toEqualTypeOf<boolean>();
  });

  it('reads the keys off a document literal the caller wrote inline', () => {
    const result = parseFeatureConfig({
      features: [{ key: 'cta', enabled: true }],
    });

    expectTypeOf(result.ok ? result.features.keys : []).toEqualTypeOf<
      readonly 'cta'[]
    >();
  });

  it('refuses an advisory duration that is not a number', () => {
    const document = {
      // @ts-expect-error -- maxStale is a duration in milliseconds.
      maxStale: '5m',
      features: [],
    } satisfies FeatureConfig<keyof Flags>;

    expectTypeOf(document).toBeObject();
  });

  it('refuses a window instant a document cannot carry', () => {
    const document = {
      features: [
        {
          key: 'checkout',
          enabled: true,
          // @ts-expect-error -- a serialized instant is a string or a number.
          rules: [{ when: [{ field: 'now', op: 'after', value: new Date() }] }],
        },
      ],
    } satisfies FeatureConfig<keyof Flags>;

    expectTypeOf(document).toBeObject();
  });
});

describe('the options parseFeatureConfig takes', () => {
  it('types the event it hands the observer at the named schema', () => {
    const observe = (event: FeatureEvent<Flags>): void => {
      void event;
    };

    expectTypeOf(parseFeatureConfig<Flags>).toBeCallableWith(
      { features: [] },
      { observe },
    );
  });

  it('takes the options a store built with no observer takes', () => {
    expectTypeOf(parseFeatureConfig<Flags>).toBeCallableWith(
      { features: [] },
      { correlateBy: 'userId', version: '7' },
    );
  });
});
