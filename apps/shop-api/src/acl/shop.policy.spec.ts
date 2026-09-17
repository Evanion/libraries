import { serialize } from '@evanion/acl';
import { describe, expect, it } from 'vitest';
import { GAMES_CATALOGUE } from '../games/games.catalogue.js';
import { buildShopAccess, SHOP_MATRIX_VERSION } from './shop.policy.js';
import { ANONYMOUS_SUBJECT, type ShopSubject } from './shop-subject.model.js';

const OPERATOR: ShopSubject = {
  id: 'staff:ada',
  roles: ['operator'],
  shop: 'stockholm',
};

const MANAGER: ShopSubject = {
  id: 'staff:bo',
  roles: ['manager'],
  shop: 'stockholm',
};

const titleOf = (shop: string) => {
  const game = GAMES_CATALOGUE.find((candidate) => candidate.shop === shop);
  if (!game) throw new Error(`the catalogue lists no title for ${shop}`);
  return game;
};

const STOCKHOLM_TITLE = titleOf('stockholm');
const GOTHENBURG_TITLE = titleOf('gothenburg');

describe('the shop-api access matrix', () => {
  const access = buildShopAccess();

  it('states the version the frontends compare against', () => {
    expect(access.version).toBe(SHOP_MATRIX_VERSION);
  });

  it('covers four object kinds in one document', () => {
    const kinds = new Set(access.matrix.permissions.map((p) => p.object));

    expect([...kinds].sort()).toEqual([
      'game',
      'inventory',
      'order',
      'telemetry',
    ]);
  });

  it('lets an operator declare on a title their own shop lists', () => {
    const decision = access.can(OPERATOR, 'game', 'declare', STOCKHOLM_TITLE);

    expect(decision.allowed).toBe(true);
  });

  it('refuses the same operator on a title another shop lists', () => {
    const decision = access.can(OPERATOR, 'game', 'declare', GOTHENBURG_TITLE);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('no-rule-matched');
  });

  it('refuses an anonymous subject on every write', () => {
    expect(
      access.can(ANONYMOUS_SUBJECT, 'game', 'declare', STOCKHOLM_TITLE).allowed,
    ).toBe(false);
    expect(
      access.can(ANONYMOUS_SUBJECT, 'game', 'reprice', STOCKHOLM_TITLE).allowed,
    ).toBe(false);
  });

  it('refuses price on the write axis an operator holds', () => {
    const decision = access.canFields(
      OPERATOR,
      'game',
      'declare',
      STOCKHOLM_TITLE,
      'write',
      { price: 1 },
    );

    expect(decision.action.allowed).toBe(true);
    expect(decision.fields['price']).toBe('denied');
    expect(decision.reasons['price']).toBe('not-listed');
  });

  it('allows price on the write axis a manager holds', () => {
    const decision = access.canFields(
      MANAGER,
      'game',
      'reprice',
      STOCKHOLM_TITLE,
      'write',
      { price: 1 },
    );

    expect(decision.action.allowed).toBe(true);
    expect(decision.fields['price']).toBe('allowed');
  });

  it('refuses an availability the catalogue has no state for', () => {
    const decision = access.canFields(
      OPERATOR,
      'game',
      'declare',
      STOCKHOLM_TITLE,
      'write',
      { availability: 'on-fire' as never },
    );

    expect(decision.fields['availability']).toBe('denied');
    expect(decision.reasons['availability']).toBe('targets-failed');
  });

  it('allows a customer to create an order and refuses an operator', () => {
    expect(access.can(ANONYMOUS_SUBJECT, 'order', 'create').allowed).toBe(true);
    expect(access.can(OPERATOR, 'order', 'create').allowed).toBe(false);
  });

  it('allows a manager to read telemetry and refuses a customer', () => {
    expect(access.can(MANAGER, 'telemetry', 'read').allowed).toBe(true);
    expect(access.can(ANONYMOUS_SUBJECT, 'telemetry', 'read').allowed).toBe(
      false,
    );
  });

  /**
   * AclGuard passes a permission it cannot decide and refuses one it can. This
   * is the fact it reads to tell the two apart, so the document has to keep
   * answering what the guard was written against.
   */
  it('says which permissions need the row', () => {
    expect(access.readsObject('game', 'declare')).toBe(true);
    expect(access.readsObject('game', 'reprice')).toBe(true);
    expect(access.readsObject('order', 'create')).toBe(false);
    expect(access.readsObject('telemetry', 'read')).toBe(false);
  });

  describe('the published contract', () => {
    const contract = serialize(access, 'reduced');

    it('leaves the internal permissions inside the process', () => {
      const keys = contract.permissions.map((p) => p.key);

      expect(keys).not.toContain('inventory.read');
      expect(keys).toContain('game.declare');
    });

    it('carries no visibility marking', () => {
      expect(
        contract.permissions.every((p) => p.visibility === undefined),
      ).toBe(true);
    });

    it('drops the schema entry of a kind it published nothing for', () => {
      expect(contract.schema?.objects).not.toHaveProperty('inventory');
      expect(contract.schema?.objects).toHaveProperty('game');
      // The subject ships whole: every published rule checks `subject.*`
      // conditions against it.
      expect(contract.schema?.subject?.fields).toHaveProperty('roles');
    });
  });
});
