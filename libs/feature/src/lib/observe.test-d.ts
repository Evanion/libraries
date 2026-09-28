import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';
import type { Features } from './features.js';
import type { Decisions, FeatureDefinition } from './types.js';
import type {
  DeepReadonly as EntryDeepReadonly,
  ReadonlyDate as EntryReadonlyDate,
} from '../index.js';
import type {
  DeepReadonly,
  FeatureEvent,
  FeatureOptions,
  ReadonlyDate,
  UnobservedOptions,
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

describe('FeatureEvent, reporting the result a toggle returned', () => {
  it('carries the refused write the flat members cannot express', () => {
    const read = (event: Branch<'toggle'>) => {
      if (event.result.ok) {
        expectTypeOf(event.result.enabled).toEqualTypeOf<boolean>();
        expectTypeOf(event.result.willDisable).toEqualTypeOf<
          readonly 'cta'[]
        >();
        return;
      }

      expectTypeOf(event.result.error).toEqualTypeOf<'unknown-feature'>();
    };

    expectTypeOf(read).toBeFunction();
  });

  it('keeps the result members off the event itself', () => {
    const read = (event: Branch<'toggle'>) => {
      // @ts-expect-error a toggle event reports enabled under result
      const enabled: boolean = event.enabled;
      // @ts-expect-error a toggle event reports willDisable under result
      const willDisable: readonly 'cta'[] = event.willDisable;

      return [enabled, willDisable] as const;
    };

    expectTypeOf(read).toBeFunction();
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

describe('what an entry point answers, over the freeze the store applies', () => {
  it('refuses a write into what an observed store answered', (): void => {
    const features = createFeatures(defs, { observe: () => undefined });

    // @ts-expect-error an observed store freezes the record it answers
    features.resolve().cta.enabled = false;
    // @ts-expect-error an observed store freezes the partition it answers
    features.plan().cta.resolved = false;
    // @ts-expect-error an observed store freezes the result it answers
    features.toggle('cta', false).key = 'cta';

    expectTypeOf(features.resolve().cta.variant).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('accepts a write into what an unobserved store answered', (): void => {
    const features = createFeatures(defs);

    features.resolve().cta.enabled = false;
    features.plan().cta.resolved = false;
    features.toggle('cta', false).key = 'cta';

    expectTypeOf(features.resolve().cta.enabled).toEqualTypeOf<boolean>();
  });

  it('carries the same distinction on the overload that names a schema', (): void => {
    const config: FeatureDefinition<'cta'>[] = [{ key: 'cta', enabled: true }];
    const observed = createFeatures<Flags>(config, {
      observe: () => undefined,
    });
    const plain = createFeatures<Flags>(config);

    // The schema the caller named, not one read off an array type that carries
    // no literals. A call that fell through to the inferring overload would
    // widen this to `string | undefined`.
    expectTypeOf(observed.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();

    // @ts-expect-error an observed store freezes the record it answers
    observed.resolve().cta.enabled = false;
    plain.resolve().cta.enabled = false;

    expectTypeOf(plain.resolve().cta.enabled).toEqualTypeOf<boolean>();
  });

  it('freezes what a wrapper forwarding an optional observer builds', (): void => {
    const build = (observe?: (event: FeatureEvent<Flags>) => void) =>
      createFeatures(defs, { observe });
    const features = build(() => undefined);

    // `observe` here is typed `Fn | undefined`, which proves no absence. The
    // runtime installs the observer the wrapper was called with and freezes
    // what `resolve` answers, so the compiler refuses the write.
    // @ts-expect-error the options prove no absent observer, so the store is frozen
    features.resolve().cta.enabled = false;

    expectTypeOf(features.resolve().cta.variant).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('freezes what options annotated FeatureOptions build', (): void => {
    const config: FeatureDefinition<'cta'>[] = [{ key: 'cta', enabled: true }];
    const options: FeatureOptions<Flags> = { observe: () => undefined };
    const features = createFeatures<Flags>(config, options);

    // @ts-expect-error the options prove no absent observer, so the store is frozen
    features.resolve().cta.enabled = false;

    expectTypeOf(features.resolve().cta.variant).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('leaves options that prove no observer on the mutable form', (): void => {
    const config: FeatureDefinition<'cta'>[] = [{ key: 'cta', enabled: true }];
    const options = {
      correlateBy: 'tenant',
    } satisfies UnobservedOptions<Flags>;
    const features = createFeatures<Flags>(config, options);

    features.resolve().cta.enabled = false;

    expectTypeOf(features.resolve().cta.enabled).toEqualTypeOf<boolean>();
  });

  it('answers both forms for a store whose observation is open', (): void => {
    const read = (features: Features<Flags>) => features.resolve();

    expectTypeOf(read).returns.toEqualTypeOf<
      Decisions<Flags> | DeepReadonly<Decisions<Flags>>
    >();
  });

  it('assigns to neither form under an annotation that leaves Frozen open', (): void => {
    const config: FeatureDefinition<'cta'>[] = [{ key: 'cta', enabled: true }];
    const open: Features<Flags> = createFeatures<Flags>(config);
    const settled: Features<Flags, false> = createFeatures<Flags>(config);

    // `Features<Flags>` leaves `Frozen` at `boolean`, so `resolve` answers the
    // union of both forms. `DeepReadonly` maps the `Date` a rule outcome can
    // carry to a `ReadonlyDate`, and that one field is what keeps the frozen
    // member out of `Decisions<Flags>`. The api page tells a caller to take the
    // type off `createFeatures`, and to name the second parameter where a
    // declaration demands the type itself.
    // @ts-expect-error the open annotation answers a union neither form accepts
    const wide: Decisions<Flags> = open.resolve();
    const narrow: Decisions<Flags> = settled.resolve();

    expectTypeOf(wide).toEqualTypeOf<Decisions<Flags>>();
    expectTypeOf(narrow).toEqualTypeOf<Decisions<Flags>>();
  });
});

describe('what the compiler says about a misconfigured call', () => {
  it('reports the call and leaves the definitions argument alone', (): void => {
    // TypeScript elaborates every candidate while a call carries three
    // overloads or fewer, and reports one candidate's failure against the
    // argument nodes once a call carries more. A fourth signature moved the
    // error for a misspelled option onto the definitions array, where it named
    // `FeatureDefinition<never>` and sent the caller to the wrong argument.
    // This directive sits on the options argument, so an error that moves onto
    // the definitions fails the case twice: once unexpected there, once unused
    // here.
    const store = createFeatures(
      [
        { key: 'cta', enabled: true, dependsOn: ['nav'] },
        { key: 'nav', enabled: true, description: 'the navigation bar' },
      ] as const,
      // @ts-expect-error the options object names a member the type does not declare
      { observe: () => undefined, onObserveErrors: () => undefined },
    );

    expectTypeOf(store).not.toBeAny();
  });
});
