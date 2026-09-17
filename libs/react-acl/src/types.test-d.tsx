import { describe, it, expectTypeOf } from 'vitest';
import { hydratePolicy } from '@evanion/acl';
import {
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
