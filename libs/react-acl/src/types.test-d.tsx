import { describe, it, expectTypeOf } from 'vitest';
import { hydratePolicy, policy } from '@evanion/acl';
import {
  createPolicyContext,
  PolicyProvider,
  useCan,
  useCanFields,
  useCanMany,
  useCapabilities,
} from './index.js';
import type {
  Access,
  Decision,
  FieldDecision,
  Instant,
  Matrix,
  PolicyProviderProps,
  Subject,
} from './index.js';

const access: Access = hydratePolicy({
  permissions: [
    {
      key: 'comment.update',
      object: 'comment',
      action: 'update',
      rules: [
        { when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] },
      ],
    },
  ],
});

const subject: Subject = { id: 'u1', roles: ['editor'] };

describe('the provider', () => {
  it('takes the access object and the subject', () => {
    expectTypeOf<PolicyProviderProps['access']>().toEqualTypeOf<Access>();
    expectTypeOf<PolicyProviderProps['subject']>().toEqualTypeOf<Subject>();
  });

  it('reads only `now` off the context, in any instant form', () => {
    expectTypeOf<PolicyProviderProps['context']>().toEqualTypeOf<
      { now?: Instant } | undefined
    >();
  });

  it('accepts a hydrated `now` that never was a Date', () => {
    const iso = (
      <PolicyProvider
        access={access}
        subject={subject}
        context={{ now: '2026-01-01T00:00:00Z' }}
      />
    );
    const epoch = (
      <PolicyProvider
        access={access}
        subject={subject}
        context={{ now: Date.parse('2026-01-01T00:00:00Z') }}
      />
    );
    void [iso, epoch];
  });

  it('requires both the access object and the subject', () => {
    // @ts-expect-error a provider without an access object has nothing to decide with
    const noAccess = <PolicyProvider subject={subject} />;
    // @ts-expect-error a provider without a subject has nobody to decide about
    const noSubject = <PolicyProvider access={access} />;
    void [noAccess, noSubject];
  });

  it('rejects a context key it does not read', () => {
    const wrong = (
      <PolicyProvider
        access={access}
        subject={subject}
        // @ts-expect-error `subject` is a prop of its own; a subject buried in
        // the context would be ignored rather than used
        context={{ subject }}
      />
    );
    void wrong;
  });
});

describe('the hooks', () => {
  it('returns one decision from useCan', () => {
    expectTypeOf(useCan).returns.toEqualTypeOf<Decision>();
    expectTypeOf(useCan).parameters.toEqualTypeOf<
      [string, string, (Record<string, unknown> | undefined)?]
    >();
  });

  it('returns a decision array from useCanMany, parallel to the input', () => {
    expectTypeOf(useCanMany).returns.toEqualTypeOf<Decision[]>();
    expectTypeOf(useCanMany).parameters.toEqualTypeOf<
      [string, string, readonly Record<string, unknown>[]]
    >();
  });

  it('returns a field decision from useCanFields', () => {
    expectTypeOf(useCanFields).returns.toEqualTypeOf<FieldDecision>();
  });

  it('closes the axis of useCanFields to the two it evaluates', () => {
    expectTypeOf<Parameters<typeof useCanFields>[3]>().toEqualTypeOf<
      'read' | 'write'
    >();

    // @ts-expect-error 'delete' is not an axis; field rules carry a read and a
    // write side and nothing else
    useCanFields('comment', 'update', {}, 'delete');
  });

  it('requires an object for the field decision, unlike useCan', () => {
    useCan('comment', 'update');
    // @ts-expect-error field rules are evaluated against an instance
    useCanFields('comment', 'update');
  });

  it('returns every decision keyed by permission from useCapabilities', () => {
    expectTypeOf(useCapabilities).returns.toEqualTypeOf<
      Record<string, Decision>
    >();
    expectTypeOf(useCapabilities).parameters.toEqualTypeOf<[]>();
  });
});

interface Shopper extends Subject {
  tier: 'bronze' | 'gold';
}

interface Listing {
  id: string;
  sellerId: string;
  price: number;
}

type ShopObjects = { listing: Listing };

const shop = policy<Shopper, ShopObjects>()
  .for('listing', (p) =>
    p.allow('update', p.eq('object.sellerId', 'subject.id')),
  )
  .build();

const shopper: Shopper = { id: 'u1', roles: ['seller'], tier: 'gold' };

describe('a bound policy context', () => {
  it('reads the subject and the object map off the argument', () => {
    // No type argument. `Shopper` and the object map are named once, at
    // `policy()`, and this call site restates neither.
    const bound = createPolicyContext(shop);

    bound.useCan('listing', 'update', { sellerId: 'u1' });
    bound.useCanMany('listing', 'update', [{ id: 'l1' }]);
    bound.useCanFields('listing', 'update', { id: 'l1' }, 'write');
  });

  it('refuses a key the policy does not declare', () => {
    const { useCan: can } = createPolicyContext(shop);

    // @ts-expect-error 'lsiting' is not a key of this policy
    can('lsiting', 'update');
  });

  it('resolves a key the policy declares', () => {
    const { useCan: can } = createPolicyContext(shop);

    expectTypeOf(can('listing', 'update')).toEqualTypeOf<Decision>();
  });

  it('refuses a field the object does not carry', () => {
    const { useCan: can } = createPolicyContext(shop);

    // @ts-expect-error `sellerid` is not a field of Listing
    can('listing', 'update', { sellerid: 'u1' });
  });

  it('checks no field on an object declared with an index signature', () => {
    interface Loose extends Record<string, unknown> {
      id: string;
    }
    const loose = policy<Shopper, { listing: Loose }>()
      .for('listing', (p) => p.allow('update', p.always))
      .build();

    // An index signature accepts every key, so the row is unchecked. The check
    // the factory adds is over the object type the consumer wrote.
    createPolicyContext(loose).useCan('listing', 'update', { anything: 1 });
  });

  it('takes a row that carries only some of the object', () => {
    const { useCan: can } = createPolicyContext(shop);

    // A list row with two of three fields is the `unevaluable` case, not a
    // type error.
    can('listing', 'update', { id: 'l1', sellerId: 'u1' });
  });

  it('binds the subject to the one the policy names', () => {
    const { PolicyProvider: Bound } = createPolicyContext(shop);

    const ok = <Bound subject={shopper} />;
    // @ts-expect-error a subject without `tier` is not a Shopper
    const wrong = <Bound subject={{ id: 'u1', roles: [] }} />;
    void [ok, wrong];
  });

  it('takes the access as a prop or from the factory', () => {
    const { PolicyProvider: Bound } = createPolicyContext(shop);

    const implicit = <Bound subject={shopper} />;
    const explicit = <Bound access={shop} subject={shopper} />;
    void [implicit, explicit];
  });

  it('takes the wide access a rehydrated matrix produces', () => {
    const { PolicyProvider: Bound } = createPolicyContext(shop);
    const rebuilt = hydratePolicy(
      JSON.parse(JSON.stringify(shop.matrix)) as Matrix,
    );

    // The browser's copy crossed JSON and lost its parameters. It reaches the
    // prop because `Access` declares its members as methods, which compare
    // bivariantly.
    const crossed = <Bound access={rebuilt} subject={shopper} />;
    void crossed;
  });

  it('carries the keys the policy declared into every hook', () => {
    const declared = policy<Shopper, ShopObjects>()
      .for('listing', (p) =>
        p
          .allow('update', p.eq('object.sellerId', 'subject.id'))
          .allow('read', p.always),
      )
      .build();
    const bound = createPolicyContext(declared);

    bound.useCan('listing', 'update', { sellerId: 'u1' });
    // @ts-expect-error 'updte' is not an action 'listing' declares
    bound.useCan('listing', 'updte');
    // @ts-expect-error the action is checked on every hook
    bound.useCanMany('listing', 'updte', [{ id: 'l1' }]);
    // @ts-expect-error the action is checked on every hook
    bound.useCanFields('listing', 'updte', { id: 'l1' }, 'write');

    expectTypeOf(bound.useCapabilities).returns.toEqualTypeOf<
      Record<'listing.update' | 'listing.read', Decision>
    >();
    expectTypeOf(
      bound.useCapabilities()['listing.update'],
    ).toEqualTypeOf<Decision>();
    // @ts-expect-error 'updte' is not an action 'listing' declares
    void bound.useCapabilities()['listing.updte'];
    // @ts-expect-error 'lsiting' is not an object kind the policy declares
    void bound.useCapabilities()['lsiting.update'];
  });

  it('takes a policy with declared keys on the shared provider too', () => {
    const declared = policy<Shopper, ShopObjects>()
      .for('listing', (p) =>
        p.allow('update', p.eq('object.sellerId', 'subject.id')),
      )
      .build();

    const mounted = <PolicyProvider access={declared} subject={shopper} />;
    void mounted;
  });

  it('keeps every key open when the access carries no types', () => {
    const wide = createPolicyContext(hydratePolicy({ permissions: [] }));

    wide.useCan('anything', 'at-all');
    expectTypeOf(wide.useCapabilities).returns.toEqualTypeOf<
      Record<string, Decision>
    >();
  });
});
