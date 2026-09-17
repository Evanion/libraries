import {
  hydratePolicy,
  policy,
  type Action,
  type Access,
  type Matrix,
  type MatrixSchema,
} from '@evanion/acl';
import { AVAILABILITIES, type Game } from '../games/game.model.js';
import type { Stock } from '../inventory/stock.model.js';
import type { TelemetryEvent } from '../telemetry/telemetry-event.model.js';
import type { ShopSubject } from './shop-subject.model.js';

/**
 * What the matrix knows about an order at the moment it is placed.
 *
 * `order.create` reads the subject alone, so the only member here is the shop
 * an order is placed against, which a later rule (a staff discount, a per-shop
 * embargo) reads without the document changing shape.
 */
export interface OrderDraft {
  shop: string;
}

/**
 * The object kind each key in this matrix decides over.
 *
 * `hydratePolicy<ShopSubject, ShopObjects>` binds it, so `access.can(subject,
 * 'game', 'declare', game)` checks both the key and the row it is given, and a
 * key nothing here names is a compile error at the call site.
 */
export interface ShopObjects {
  game: Game;
  order: OrderDraft;
  telemetry: TelemetryEvent;
  inventory: Stock;
}

/**
 * The verbs each kind answers for, where they are not the default four.
 *
 * `declare` and `reprice` are this shop's own words, so `game` names them
 * alongside `Action`. A kind left out of this map takes `Action` and
 * nothing else, which is what turns a mistyped action into a compile error at
 * the `allow` that wrote it.
 */
type ShopVerbs = { game: Action | 'declare' | 'reprice' };

/**
 * The version the three frontends compare against what they hold.
 *
 * A string rather than a number, because the revalidate contract compares with
 * `!==` and a string carries the producer alongside the revision.
 */
export const SHOP_MATRIX_VERSION = 'shop-api@1';

/**
 * The shapes every condition in this matrix is checked against.
 *
 * It is stated by hand: the builder holds `Game` and `ShopSubject` at the type
 * level only, and a `MatrixSchema` is runtime JSON, so nothing derives one from
 * `.for('game', …)`. Stating it is what carries the field guarantee across
 * the wire, because a frontend adopts this document with `parseMatrix` and has
 * no TypeScript view of the server's rows.
 */
const SHOP_SCHEMA: MatrixSchema = {
  subject: {
    fields: { id: 'string', roles: 'string[]', shop: 'string' },
  },
  objects: {
    game: {
      fields: {
        urn: 'string',
        title: 'string',
        mechanisms: 'string[]',
        players: 'string',
        playtime: 'string',
        complexity: 'number',
        price: 'number',
        availability: 'string',
        shop: 'string',
      },
    },
    order: { fields: { shop: 'string' } },
    telemetry: {
      fields: {
        id: 'number',
        timestamp: 'instant',
        correlationId: 'string?',
        source: 'string',
        type: 'string',
      },
    },
    inventory: { fields: { urn: 'string', quantity: 'number' } },
  },
};

/**
 * The whole access matrix of this service, in one document.
 *
 * One document over four kinds rather than one document per kind: a subject
 * asks `capabilities()` once, a frontend fetches once, and a rule that reads
 * two kinds has somewhere to live. `game` carries the ownership axis, `order`
 * and `telemetry` carry role gates, and `inventory` carries the permission this
 * app's own loopback hop re-evaluates.
 *
 * `declare` changes what the shop says about a title, and `reprice` changes
 * what it costs. They are two actions and not one action with two field lists,
 * because a field allow-list is a property of a permission and a permission
 * carries no conditions per field: an operator who may set `availability` and a
 * manager who may also set `price` are therefore two permissions, and a manager
 * holds both.
 */
// #region shop-matrix
const SHOP_POLICY = policy<ShopSubject, ShopObjects, ShopVerbs>({
  version: SHOP_MATRIX_VERSION,
  schema: SHOP_SCHEMA,
})
  .for('game', (p) =>
    p
      .allow('read', p.always)
      .visibility('public')
      // The operator grant and the manager grant are separate rules, so a
      // reader strikes one out without touching the other.
      .allow(
        'declare',
        p.contains('subject.roles', 'operator'),
        p.eq('object.shop', 'subject.shop'),
      )
      .allow(
        'declare',
        p.contains('subject.roles', 'manager'),
        p.eq('object.shop', 'subject.shop'),
      )
      .fields({
        fields: ['availability'],
        availability: { targets: [...AVAILABILITIES] },
      })
      .visibility('public')
      .allow(
        'reprice',
        p.contains('subject.roles', 'manager'),
        p.eq('object.shop', 'subject.shop'),
      )
      .fields({
        fields: ['availability', 'price'],
        availability: { targets: [...AVAILABILITIES] },
      })
      .visibility('public'),
  )
  .for('order', (p) =>
    p
      .allow('create', p.contains('subject.roles', 'customer'))
      .visibility('public'),
  )
  .for('telemetry', (p) =>
    p
      .allow('read', p.contains('subject.roles', 'manager'))
      .visibility('public'),
  )
  // No marking, so `serialize(access, 'reduced')` drops it: the browsers never
  // ask about stock, and a contract carrying a rule nobody evaluates is a
  // larger surface for nothing.
  .for('inventory', (p) => p.allow('read', p.always));
// #endregion shop-matrix

/**
 * The document this app decides on.
 *
 * Exported so a test can construct a second evaluator over the same bytes and
 * compare its decisions against the served contract.
 */
export const SHOP_MATRIX: Matrix = SHOP_POLICY.matrix;

/**
 * Builds the evaluator `AclModule.forRoot()` binds to `ACL_ACCESS`.
 *
 * Construction validates the document, so an unknown field, a type the schema
 * disagrees with, or two permissions sharing a key fails at boot rather than at
 * the first request. It runs once per process; the frozen document it returns
 * is evaluated against every subject.
 */
// #region build-shop-access
export function buildShopAccess(): Access<ShopSubject, ShopObjects> {
  return hydratePolicy<ShopSubject, ShopObjects>(SHOP_MATRIX);
}
// #endregion build-shop-access
