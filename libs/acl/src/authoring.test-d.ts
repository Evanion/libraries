import { describe, expectTypeOf, it } from 'vitest';

import { policy } from './authoring.js';
import type { Action, Operand, Valid } from './authoring.js';
import { hydratePolicy } from './hydrate-policy.js';
import type { Access, KeysOf } from './hydrate-policy.js';
import { federatedPolicies } from './federated-policies.js';
import { parseMatrix } from './parse-matrix.js';
import { serialize } from './serialize.js';
import type { Decision, Matrix } from './types.js';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };
type Media = { ownerId: string; bytes: number };

// An app declares its actor as an interface, which carries no index signature
// and is therefore not a `Subject`. Both entry points take the subject type as
// a parameter with no constraint, so the declaration form makes no difference.
interface ShopSubject {
  id: string;
  roles: string[];
}
interface ShopListing {
  sellerId: string;
}
type ShopObjects = { listing: ShopListing };

type Objects = { comment: Comment; media: Media };
/** `comment` answers for one verb outside the four; `media` names nothing. */
type Verbs = { comment: Action | 'publish' };

const access = policy<Subject, Objects, Verbs>()
  .for('comment', (p) =>
    p.allow('update', p.eq('object.authorId', 'subject.id')),
  )
  .for('media', (p) => p.allow('read', p.eq('object.ownerId', 'subject.id')))
  .build();

// The same two kinds, with every action each block declares.
const declared = policy<Subject, Objects, Verbs>()
  .for('comment', (p) =>
    p
      .allow('update', p.eq('object.authorId', 'subject.id'))
      .allow('read', p.always),
  )
  .for('media', (p) => p.allow('read', p.eq('object.ownerId', 'subject.id')))
  .build();

declare const subject: Subject;
declare const comment: Comment;
declare const media: Media;
declare const projection: { authorId: string };
declare const projectedSubject: { id: string };
declare const json: Matrix;
declare const shopSubject: ShopSubject;
declare const shopListing: ShopListing;

describe('typed authoring', () => {
  it('a mistyped path names the path', () => {
    expectTypeOf<
      Valid<'object.authrId', Subject, Comment>
    >().toEqualTypeOf<"unknown path 'object.authrId' on this resource">();
    policy<Subject, Objects, Verbs>().for('comment', (p) =>
      // @ts-expect-error -- unknown path 'object.authrId' on this resource
      p.allow('update', p.eq('object.authrId', 'subject.id')),
    );
  });

  it('a path valid on one resource is rejected inside another', () => {
    expectTypeOf<
      Valid<'object.authorId', Subject, Media>
    >().toEqualTypeOf<"unknown path 'object.authorId' on this resource">();
    policy<Subject, Objects, Verbs>().for('media', (p) =>
      // @ts-expect-error -- authorId is a Comment field, not a Media field
      p.allow('read', p.eq('object.authorId', 'subject.id')),
    );
  });

  it('a mistyped operand is rejected as a path, not accepted as a literal', () => {
    expectTypeOf<
      Operand<'subject.idd', Subject, Comment>
    >().toEqualTypeOf<"unknown path 'subject.idd' on this resource">();
    policy<Subject, Objects, Verbs>().for('comment', (p) =>
      // @ts-expect-error -- unknown path 'subject.idd' on this resource
      p.allow('update', p.eq('object.authorId', 'subject.idd')),
    );
  });

  it('an operand that is not path-shaped passes through as a literal', () => {
    expectTypeOf<
      Operand<'published', Subject, Comment>
    >().toEqualTypeOf<'published'>();
    policy<Subject, Objects, Verbs>().for('comment', (p) =>
      p.allow('read', p.eq('object.status', 'published')),
    );
  });

  it('every op checks its field path', () => {
    policy<Subject, Objects, Verbs>().for('comment', (p) =>
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

  it('an adopted document names the same two parameters the builder does', () => {
    const adopted = parseMatrix<ShopSubject, ShopObjects>(json);
    expectTypeOf(adopted).toEqualTypeOf<Access<ShopSubject, ShopObjects>>();
    expectTypeOf(
      adopted.can(shopSubject, 'listing', 'update', shopListing),
    ).toEqualTypeOf<Decision>();
    // @ts-expect-error -- 'listng' is not a key the caller named
    adopted.can(shopSubject, 'listng', 'update', shopListing);
    // @ts-expect-error -- 'sellrId' is not a ShopListing field
    adopted.can(shopSubject, 'listing', 'update', { sellrId: 's1' });
  });

  it('an interface-typed subject reaches both paths without a cast', () => {
    const authored = policy<ShopSubject, ShopObjects>()
      .for('listing', (p) =>
        p.allow('update', p.eq('object.sellerId', 'subject.id')),
      )
      .build();
    const adopted = parseMatrix<ShopSubject, ShopObjects>(json);
    const mine = authored.can(shopSubject, 'listing', 'update', shopListing);
    const theirs = adopted.can(shopSubject, 'listing', 'update', shopListing);
    expectTypeOf(mine).toEqualTypeOf(theirs);
  });

  it('a document arriving at runtime accepts any key and any bag', () => {
    const foreign = parseMatrix(json);
    foreign.can({ anything: 1 }, 'whatever', 'at-all', { any: 'bag' });
    foreign.authorize({ anything: 1 }).can('whatever', 'at-all', { any: 1 });
    hydratePolicy(json).can({ anything: 1 }, 'whatever', 'at-all');
  });

  it('a declared vocabulary types the keys capabilities answers under', () => {
    const caps = declared.capabilities(subject);
    expectTypeOf(caps).toEqualTypeOf<
      Record<'comment.update' | 'comment.read' | 'media.read', Decision>
    >();
    expectTypeOf(caps['comment.update']).toEqualTypeOf<Decision>();
    // @ts-expect-error -- 'raed' is not an action 'comment' declares
    void caps['comment.raed'];
    // @ts-expect-error -- 'commnt' is not an object kind the policy declares
    void caps['commnt.update'];
    // @ts-expect-error -- 'delete' is an action no block declares
    void caps['comment.delete'];
  });

  it('a bound handle carries the same keys', () => {
    const caps = declared.authorize(subject).capabilities();
    expectTypeOf(caps['media.read']).toEqualTypeOf<Decision>();
    // @ts-expect-error -- 'media' declares 'read' and nothing else
    void caps['media.write'];
  });

  it('the vocabulary is what the block may allow and deny', () => {
    policy<Subject, Objects, Verbs>().for('comment', (p) =>
      p
        // @ts-expect-error -- 'updte' is outside this kind's vocabulary
        .allow('updte', p.always)
        // @ts-expect-error -- 'archive' was never named in the vocabulary
        .deny('archive', p.always),
    );
  });

  it('a kind the vocabulary map omits may name the four verbs', () => {
    policy<Subject, Objects, Verbs>().for('media', (p) =>
      p.allow('read', p.always).allow('delete', p.always),
    );
    policy<Subject, Objects, Verbs>().for('media', (p) =>
      // @ts-expect-error -- 'publish' is outside Action, and media names none
      p.allow('publish', p.always),
    );
  });

  it('a kind whose vocabulary is `string` takes any action', () => {
    const open = policy<Subject, Objects, { media: string }>()
      .for('media', (p) => p.allow('transcode', p.always))
      .build();
    expectTypeOf(
      open.capabilities(subject)['media.transcode'],
    ).toEqualTypeOf<Decision>();
    // @ts-expect-error -- the keys stay narrow even where the vocabulary is open
    void open.capabilities(subject)['media.transcde'];
  });

  it('a vocabulary naming a kind the object map does not is refused', () => {
    // @ts-expect-error -- 'commnt' is not an object kind
    policy<Subject, Objects, { commnt: Action }>();
  });

  it('allowEach and denyEach declare every action they name', () => {
    const batched = policy<Subject, Objects, Verbs>()
      .for('comment', (p) =>
        p
          .allowEach(['read', 'update'], p.eq('object.authorId', 'subject.id'))
          .denyEach(['publish'], p.eq('object.status', 'published')),
      )
      .build();
    expectTypeOf(batched.capabilities(subject)).toEqualTypeOf<
      Record<'comment.read' | 'comment.update' | 'comment.publish', Decision>
    >();
    policy<Subject, Objects, Verbs>().for('comment', (p) =>
      // @ts-expect-error -- 'raed' is outside this kind's vocabulary
      p.allowEach(['read', 'raed'], p.always),
    );
  });

  it('publishes the keys it accumulated, for a consumer in the same build', () => {
    type Published = KeysOf<typeof declared>;
    expectTypeOf<Published>().toEqualTypeOf<
      'comment.update' | 'comment.read' | 'media.read'
    >();

    const adopted = parseMatrix<Subject, Objects, Published>(json);
    expectTypeOf(
      adopted.capabilities(subject)['comment.update'],
    ).toEqualTypeOf<Decision>();
    // @ts-expect-error -- not a key the producer published
    void adopted.capabilities(subject)['comment.updte'];
    // @ts-expect-error -- 'updte' is not an action the published keys carry
    adopted.can(subject, 'comment', 'updte', comment);
  });

  it('a hand-written key union reaches a consumer with no shared build', () => {
    const stated = parseMatrix<
      ShopSubject,
      ShopObjects,
      'listing.update' | 'listing.read'
    >(json);
    expectTypeOf(
      stated.capabilities(shopSubject)['listing.update'],
    ).toEqualTypeOf<Decision>();
    // @ts-expect-error -- not a key this consumer expects to find
    void stated.capabilities(shopSubject)['listing.updte'];
    stated.can(shopSubject, 'listing', 'read', shopListing);
  });

  it('a kind the stated union says nothing about stays answerable', () => {
    const partial = parseMatrix<Subject, Objects, 'comment.update'>(json);
    partial.can(subject, 'media', 'read', media);
    partial.can(subject, 'media', 'anything-at-all', media);
  });

  it('a declared vocabulary is what a query may name as its action', () => {
    expectTypeOf(
      declared.can(subject, 'comment', 'update', comment),
    ).toEqualTypeOf<Decision>();
    // @ts-expect-error -- 'updte' is not an action 'comment' declares
    declared.can(subject, 'comment', 'updte', comment);
    // @ts-expect-error -- 'update' is declared on 'comment', not on 'media'
    declared.canMany(subject, 'media', 'update', [media]);
    // @ts-expect-error -- 'raed' is not an action 'media' declares
    declared.object('media').can(subject, 'raed', media);
    // @ts-expect-error -- the action is checked on the bound handle too
    declared.authorize(subject).can('comment', 'updte', comment);
  });

  it('a block with a statement body opens the keys of its document', () => {
    // The block returns nothing, so no chain reaches `.for()` to read the
    // actions off, and a key half the document cannot name is a key nothing
    // checks.
    const loose = policy<Subject, Objects, Verbs>()
      .for('comment', (p) => {
        p.allow('update', p.always);
      })
      .for('media', (p) => p.allow('read', p.always))
      .build();
    expectTypeOf(loose.capabilities(subject)).toEqualTypeOf<
      Record<string, Decision>
    >();
    loose.can(subject, 'comment', 'anything', comment);
  });

  it('checks a vetoable key against the document being published', () => {
    const published = policy<Subject, Objects, Verbs>()
      .for('comment', (p) =>
        p
          .allow('update', p.always)
          .visibility('public')
          .allow('publish', p.always),
      )
      .build();
    expectTypeOf(
      serialize(published, 'reduced', { vetoable: ['comment.publish'] }),
    ).toEqualTypeOf<Matrix>();
    serialize(published, 'reduced', {
      vetoable: ['comment.update', 'comment.publish'],
    });
    // @ts-expect-error -- 'comment.publsh' is not a key this document carries
    serialize(published, 'reduced', { vetoable: ['comment.publsh'] });
    // @ts-expect-error -- 'media' carries no permission in this document
    serialize(published, 'reduced', { vetoable: ['media.read'] });
    serialize(published, 'reduced');
    serialize(published, 'full');
  });

  it('an adopted document takes any vetoable key it likes', () => {
    const adopted = parseMatrix(json);
    serialize(adopted, 'reduced', { vetoable: ['anything.at-all'] });
    serialize(parseMatrix<ShopSubject, ShopObjects>(json), 'reduced', {
      vetoable: ['listing.update'],
    });
  });

  it('reaches every call that takes an access, declared keys and all', () => {
    expectTypeOf(serialize(declared, 'full')).toEqualTypeOf<Matrix>();
    expectTypeOf(serialize(access, 'reduced')).toEqualTypeOf<Matrix>();
    const fleet = federatedPolicies({
      declared,
      open: access,
      foreign: parseMatrix(json),
    });
    expectTypeOf(fleet.capabilities(subject)).toEqualTypeOf<
      Record<string, Decision>
    >();
  });

  it('an adopted document keeps the open record it always answered with', () => {
    expectTypeOf(parseMatrix(json).capabilities({ anything: 1 })).toEqualTypeOf<
      Record<string, Decision>
    >();
    expectTypeOf(
      parseMatrix<ShopSubject, ShopObjects>(json).capabilities(shopSubject),
    ).toEqualTypeOf<Record<string, Decision>>();
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
