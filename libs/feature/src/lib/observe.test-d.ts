import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';
import type {
  DeepReadonly as EntryDeepReadonly,
  ReadonlyDate as EntryReadonlyDate,
} from '../index.js';
import type {
  DeepReadonly,
  FeatureEvent,
  FeatureOptions,
  ReadonlyDate,
} from './observe.js';

const defs = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
] as const;

type Flags = {
  cta: { variant: 'control' | 'blue'; value: { label: string } };
};

type Event = FeatureEvent<Flags>;
type Branch<T extends Event['type']> = Extract<Event, { type: T }>;

describe('the options parameter', () => {
  it('leaves inference alone', () => {
    const features = createFeatures(defs, { observe: () => undefined });

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('takes an observer returning nothing and one returning a promise', () => {
    createFeatures(defs, { observe: () => undefined });
    createFeatures(defs, { observe: async () => undefined });
  });
});

describe('FeatureEvent, discriminating on type', () => {
  it('gives each branch its own payload', () => {
    expectTypeOf<
      Branch<'resolve'>['decisions']['cta']['key']
    >().toEqualTypeOf<'cta'>();
    expectTypeOf<Branch<'is-enabled'>['key']>().toEqualTypeOf<'cta'>();
    expectTypeOf<Branch<'plan'>['plan']['cta']['resolved']>().toEqualTypeOf<
      boolean | 'deferred'
    >();
    expectTypeOf<Branch<'toggle'>['result']>().toEqualTypeOf<
      | {
          readonly ok: true;
          readonly key: 'cta';
          readonly enabled: boolean;
          readonly willDisable: readonly 'cta'[];
        }
      | {
          readonly ok: false;
          readonly key: 'cta';
          readonly error: 'unknown-feature';
        }
    >();
  });

  it('keeps a payload off the branches that do not carry it', () => {
    // @ts-expect-error a toggle event carries no decisions
    type NoDecisions = Branch<'toggle'>['decisions'];
    // @ts-expect-error a resolve event carries no single decision
    type NoDecision = Branch<'resolve'>['decision'];

    expectTypeOf<NoDecisions>().toBeAny();
    expectTypeOf<NoDecision>().toBeAny();
  });
});

describe('FeatureEvent, narrowing the one decision isEnabled reports', () => {
  it('reads the variant names the schema declares', () => {
    expectTypeOf<Branch<'is-enabled'>['decision']['variant']>().toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('reads the value type the schema declares', () => {
    expectTypeOf<Branch<'is-enabled'>['decision']['value']>().toEqualTypeOf<
      { readonly label: string } | undefined
    >();
  });
});

describe('FeatureEvent, refusing a write', () => {
  it('refuses a write to a decision', (): void => {
    const write = (event: Branch<'resolve'>) => {
      // @ts-expect-error an observer reads a decision and never writes one
      event.decisions.cta.enabled = false;
      // @ts-expect-error an observer reads a variant and never writes one
      event.decisions.cta.variant = 'blue';
    };

    expectTypeOf(write).toBeFunction();
  });

  it('refuses a write to a plan entry', (): void => {
    const write = (event: Branch<'plan'>) => {
      // @ts-expect-error an observer reads a plan entry and never writes one
      event.plan.cta.resolved = false;
    };

    expectTypeOf(write).toBeFunction();
  });

  it('refuses a write to the toggle result', (): void => {
    const write = (event: Branch<'toggle'>) => {
      // @ts-expect-error an observer reads the result and never writes one
      event.result.key = 'cta';
    };

    expectTypeOf(write).toBeFunction();
  });

  it('carries no mutator on the instant', (): void => {
    const write = (event: Event) => {
      // @ts-expect-error the instant an event carries drops every Date mutator
      event.at.setTime(0);
    };

    expectTypeOf(write).toBeFunction();
  });
});

interface InterfaceFlags {
  cta: { variant: 'control' | 'blue'; value: { label: string } };
  banner: { variant: 'off' | 'on' };
}

describe('FeatureEvent and FeatureOptions, over a schema written as an interface', () => {
  it('names both types over an interface the consumer hand-wrote', () => {
    const observe = (event: FeatureEvent<InterfaceFlags>): void => {
      if (event.type === 'is-enabled') expectTypeOf(event.key).not.toBeNever();
    };
    const options: FeatureOptions<InterfaceFlags> = { observe };

    expectTypeOf(options.observe).toEqualTypeOf<
      | ((event: FeatureEvent<InterfaceFlags>) => void | Promise<unknown>)
      | undefined
    >();
  });
});

describe('FeatureEvent, pairing an is-enabled key with its own decision', () => {
  it('narrows the decision when the consumer narrows the key', () => {
    const read = (
      event: Extract<FeatureEvent<InterfaceFlags>, { type: 'is-enabled' }>,
    ) => {
      if (event.key === 'cta') {
        expectTypeOf(event.decision.variant).toEqualTypeOf<
          'control' | 'blue' | undefined
        >();
        expectTypeOf(event.decision.value).toEqualTypeOf<
          { readonly label: string } | undefined
        >();
        return;
      }

      expectTypeOf(event.key).toEqualTypeOf<'banner'>();
      expectTypeOf(event.decision.variant).toEqualTypeOf<
        'off' | 'on' | undefined
      >();
    };

    expectTypeOf(read).toBeFunction();
  });

  it('refuses a decision belonging to another feature', () => {
    const banner = {
      type: 'is-enabled',
      at: new Date(),
      key: 'banner',
      decision: {
        key: 'banner',
        enabled: true,
        reason: 'default-on',
        variant: 'on',
      },
    } as const;

    // @ts-expect-error the cta key never pairs with the banner decision
    const mismatched: Extract<
      FeatureEvent<InterfaceFlags>,
      { type: 'is-enabled' }
    > = {
      ...banner,
      key: 'cta',
    };

    expectTypeOf(mismatched).not.toBeNever();
  });

  it('accepts the decision the key owns', () => {
    const paired: Extract<
      FeatureEvent<InterfaceFlags>,
      { type: 'is-enabled' }
    > = {
      type: 'is-enabled',
      at: new Date(),
      key: 'banner',
      decision: {
        key: 'banner',
        enabled: true,
        reason: 'default-on',
        variant: 'on',
      },
    };

    expectTypeOf(paired.decision.variant).toEqualTypeOf<
      'off' | 'on' | undefined
    >();
  });
});

describe('the observer the inferring overload installs', () => {
  it('types the event against the schema createFeatures inferred from defs', () => {
    createFeatures(defs, {
      observe: (event) => {
        if (event.type !== 'is-enabled') return;

        expectTypeOf(event.key).toEqualTypeOf<'cta'>();
        expectTypeOf(event.decision.variant).toEqualTypeOf<
          'control' | 'blue' | undefined
        >();
      },
    });
  });

  it('types the error reporter against the same schema', () => {
    createFeatures(defs, {
      onObserveError: (_error, event) => {
        expectTypeOf(event.type).toEqualTypeOf<
          'resolve' | 'is-enabled' | 'plan' | 'toggle'
        >();
        if (event.type !== 'is-enabled') return;

        expectTypeOf(event.key).toEqualTypeOf<'cta'>();
        expectTypeOf(event.decision.variant).toEqualTypeOf<
          'control' | 'blue' | undefined
        >();
      },
    });
  });
});

describe('the package entry, over the types a FeatureEvent member is typed with', () => {
  it('exports the instant type an event carries', () => {
    expectTypeOf<EntryReadonlyDate>().toEqualTypeOf<ReadonlyDate>();
  });

  it('exports the readonly mapping every payload runs through', () => {
    expectTypeOf<EntryDeepReadonly<{ a: { b: number } }>>().toEqualTypeOf<
      DeepReadonly<{ a: { b: number } }>
    >();
  });
});
