import { describe, expectTypeOf, it } from 'vitest';

import { eq, permit, policy } from './authoring.js';
import type { Access } from './create-policy.js';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };

describe('typed authoring', () => {
  it('policy returns an Access-like object', () => {
    const access = policy<Subject>({
      comment: { update: permit<Comment>(eq('object.authorId', 'subject.id')) },
    });
    expectTypeOf(access.can).toBeFunction();
  });

  it('permit<O> rejects an inline object field that is not on O', () => {
    // @ts-expect-error -- 'object.authorIdX' is not a field of Comment
    permit<Comment>({ field: 'object.authorIdX', op: 'eq', value: 1 });
  });

  it('permit<O> accepts a valid inline object field', () => {
    const good = permit<Comment>({ field: 'object.authorId', op: 'eq', value: 1 });
    expectTypeOf(good.rules).toBeArray();
  });

  it('eq<O> rejects an object path that is not on O', () => {
    // @ts-expect-error -- 'object.authorIdX' is not a field of Comment
    const bad = eq<Comment>('object.authorIdX', 'subject.id');
    expectTypeOf(bad).toEqualTypeOf<unknown>();
  });

  it('eq<O> accepts a valid object path', () => {
    const good = eq<Comment>('object.authorId', 'subject.id');
    expectTypeOf(good).not.toBeAny();
  });
});
