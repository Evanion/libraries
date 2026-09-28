import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';
import type { FeatureEvent } from './observe.js';

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
