import { describe, expectTypeOf, it } from 'vitest';

import { policy } from './authoring.js';
import type { Operand, Valid } from './authoring.js';
import { createPolicy } from './create-policy.js';
import { parseMatrix } from './parse-matrix.js';
import type { Decision, Matrix } from './types.js';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };
type Media = { ownerId: string; bytes: number };

const access = policy<Subject>()
  .for<'comment', Comment>('comment', (p) =>
    p.allow('update', p.eq('object.authorId', 'subject.id')),
  )
  .for<'media', Media>('media', (p) =>
    p.allow('read', p.eq('object.ownerId', 'subject.id')),
  )
  .build();

declare const subject: Subject;
declare const comment: Comment;
declare const media: Media;
declare const projection: { authorId: string };
declare const projectedSubject: { id: string };
declare const json: Matrix;

describe('typed authoring', () => {
  it('a mistyped path names the path', () => {
    expectTypeOf<
      Valid<'object.authrId', Subject, Comment>
    >().toEqualTypeOf<"unknown path 'object.authrId' on this resource">();
    policy<Subject>().for<'comment', Comment>('comment', (p) =>
      // @ts-expect-error -- unknown path 'object.authrId' on this resource
      p.allow('update', p.eq('object.authrId', 'subject.id')),
    );
  });

  it('a path valid on one resource is rejected inside another', () => {
    expectTypeOf<
      Valid<'object.authorId', Subject, Media>
    >().toEqualTypeOf<"unknown path 'object.authorId' on this resource">();
    policy<Subject>().for<'media', Media>('media', (p) =>
      // @ts-expect-error -- authorId is a Comment field, not a Media field
      p.allow('read', p.eq('object.authorId', 'subject.id')),
    );
  });

  it('a mistyped operand is rejected as a path, not accepted as a literal', () => {
    expectTypeOf<
      Operand<'subject.idd', Subject, Comment>
    >().toEqualTypeOf<"unknown path 'subject.idd' on this resource">();
    policy<Subject>().for<'comment', Comment>('comment', (p) =>
      // @ts-expect-error -- unknown path 'subject.idd' on this resource
      p.allow('update', p.eq('object.authorId', 'subject.idd')),
    );
  });

  it('an operand that is not path-shaped passes through as a literal', () => {
    expectTypeOf<
      Operand<'published', Subject, Comment>
    >().toEqualTypeOf<'published'>();
    policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p.allow('read', p.eq('object.status', 'published')),
    );
  });

  it('every op checks its field path', () => {
    policy<Subject>().for<'comment', Comment>('comment', (p) =>
      p.allow(
        'read',
        // @ts-expect-error -- unknown path 'object.staus' on this resource
        p.ne('object.staus', 'published'),
        // @ts-expect-error -- unknown path 'subject.role' on this resource
        p.contains('subject.role', 'editor'),
        // @ts-expect-error -- unknown path 'object.staus' on this resource
        p.in('object.staus', ['draft']),
        // @ts-expect-error -- unknown path 'object.staus' on this resource
        p.notIn('object.staus', ['draft']),
      ),
    );
  });

  it('an unknown object kind is rejected against the key union', () => {
    // @ts-expect-error -- 'commnt' is not a configured key
    access.can(subject, 'commnt', 'update', comment);
  });

  it('an object of the wrong kind is rejected against the key type', () => {
    // @ts-expect-error -- Media is not the object type of 'comment'
    access.can(subject, 'comment', 'update', media);
    // @ts-expect-error -- Comment is not the object type of 'media'
    access.canMany(subject, 'media', 'read', [comment]);
    // @ts-expect-error -- Media is not the object type of 'comment'
    access.canFields(subject, 'comment', 'update', media, 'read');
    // @ts-expect-error -- 'commnt' is not a configured key
    access.object('commnt');
  });

  it('a configured key with its own object type compiles', () => {
    expectTypeOf(
      access.can(subject, 'comment', 'update', comment).allowed,
    ).toEqualTypeOf<boolean>();
    expectTypeOf(
      access.object('media').can(subject, 'read', media).allowed,
    ).toEqualTypeOf<boolean>();
  });

  it('the subject is the one named once, on every entry point', () => {
    // @ts-expect-error -- a bag of attributes is not the named Subject
    access.can({ id: 's1' }, 'comment', 'update', comment);
  });

  it('a projected subject is refused on every entry point', () => {
    // @ts-expect-error -- the subject is resolved whole by the app
    access.can(projectedSubject, 'comment', 'update', comment);
    // @ts-expect-error -- the subject is resolved whole by the app
    access.canMany(projectedSubject, 'comment', 'update', [comment]);
    // @ts-expect-error -- the subject is resolved whole by the app
    access.canFields(projectedSubject, 'comment', 'update', comment, 'read');
    // @ts-expect-error -- the subject is resolved whole by the app
    access.object('comment').can(projectedSubject, 'update', comment);
  });

  it('a projection of the object compiles at every entry point', () => {
    access.can(subject, 'comment', 'update', {});
    access.can(subject, 'comment', 'update', { authorId: 's1' });
    access.canMany(subject, 'comment', 'update', [{ authorId: 's1' }, {}]);
    access.canFields(subject, 'comment', 'update', { authorId: 's1' }, 'read');
    access.object('comment').can(subject, 'update', {});
    access.object('comment').canMany(subject, 'update', [{}]);
    access.object('comment').canFields(subject, 'update', {}, 'read');
  });

  it('a projection typed elsewhere compiles, and the field names stay checked', () => {
    access.can(subject, 'comment', 'update', projection);
    // @ts-expect-error -- 'authorIdd' is not a Comment field
    access.can(subject, 'comment', 'update', { authorIdd: 's1' });
    // @ts-expect-error -- 'statuss' is not a Comment field
    access.can(subject, 'comment', 'update', { authorId: 's1', statuss: 'x' });
    // @ts-expect-error -- 'draft' is the Comment field's type, 'x' is not
    access.can(subject, 'comment', 'update', { status: 'x' });
  });

  it('a bound handle carries the key map the builder accumulated', () => {
    const bound = access.authorize(subject);
    expectTypeOf(
      bound.can('comment', 'update', comment).allowed,
    ).toEqualTypeOf<boolean>();
    // @ts-expect-error -- 'commnt' is not a configured key
    bound.can('commnt', 'update', comment);
    // @ts-expect-error -- Media is not the object type of 'comment'
    bound.can('comment', 'update', media);
    // @ts-expect-error -- 'authorIdd' is not a Comment field
    bound.canMany('comment', 'update', [{ authorIdd: 's1' }]);
  });

  it('a document arriving at runtime accepts any key and any bag', () => {
    const foreign = parseMatrix(json);
    foreign.can({ anything: 1 }, 'whatever', 'at-all', { any: 'bag' });
    foreign.authorize({ anything: 1 }).can('whatever', 'at-all', { any: 1 });
    createPolicy(json).can({ anything: 1 }, 'whatever', 'at-all');
  });

  it('a partial call still answers with a Decision, gated on a boolean', () => {
    expectTypeOf(
      access.can(subject, 'comment', 'update', {}),
    ).toEqualTypeOf<Decision>();
    expectTypeOf<Decision['allowed']>().toEqualTypeOf<boolean>();
    expectTypeOf(
      access.can(subject, 'comment', 'update', { authorId: 's1' }).allowed,
    ).toEqualTypeOf<boolean>();
    expectTypeOf(
      access.canFields(subject, 'comment', 'update', {}, 'read').allowed,
    ).toEqualTypeOf<boolean>();
  });
});
