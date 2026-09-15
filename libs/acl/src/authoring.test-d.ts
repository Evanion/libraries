import { describe, expectTypeOf, it } from 'vitest';

import { eq, permit, policy } from './authoring.js';
import type { Access } from './create-policy.js';

describe('typed authoring', () => {
  it('policy returns an Access-like object', () => {
    const access = policy({
      comment: { update: permit(eq('object.authorId', 'subject.id')) },
    });
    expectTypeOf(access).toMatchTypeOf<Partial<Access>>();
  });

  it('eq returns a condition', () => {
    const cond = eq('object.authorId', 'subject.id');
    expectTypeOf(cond).toMatchTypeOf<{ field: string; op: string }>();
  });

  it('permit returns a builder with rules', () => {
    const builder = permit(eq('object.authorId', 'subject.id'));
    expectTypeOf(builder.rules).toMatchTypeOf<
      readonly { when?: readonly { field: string }[] }[]
    >();
  });
});
