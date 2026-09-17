import { parseMatrix, type Access } from '@evanion/acl';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { GAMES_CATALOGUE } from '../games/games.catalogue.js';
import { ACL_ACCESS } from './acl.constants.js';
import { PolicyController } from './policy.controller.js';
import {
  buildShopAccess,
  SHOP_MATRIX_VERSION,
  type ShopObjects,
} from './shop.policy.js';
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

const controllerOver = async () => {
  const module = await Test.createTestingModule({
    controllers: [PolicyController],
    providers: [{ provide: ACL_ACCESS, useValue: buildShopAccess() }],
  }).compile();
  return module.get(PolicyController);
};

/**
 * The evaluator a frontend builds out of the fetched bytes.
 *
 * `parseMatrix` answers the foreign-document evaluator, whose subject and
 * object parameters are open bags, because a JSON document carries no types. A
 * frontend written in TypeScript names its own shapes over it exactly like
 * this, and the cast is where that claim is made.
 */
const adopt = (matrix: unknown): Access<ShopSubject, ShopObjects> =>
  parseMatrix(matrix as never) as unknown as Access<ShopSubject, ShopObjects>;

/** The document as it reaches a browser: through JSON, and nothing else. */
const overTheWire = (controller: PolicyController) =>
  adopt(JSON.parse(JSON.stringify(controller.read().matrix)));

describe('PolicyController', () => {
  it('states the version alongside the document', async () => {
    const controller = await controllerOver();

    const published = controller.read();

    expect(published.version).toBe(SHOP_MATRIX_VERSION);
    expect(published.matrix.version).toBe(SHOP_MATRIX_VERSION);
  });

  it('serves a document parseMatrix accepts', async () => {
    const controller = await controllerOver();

    expect(() => overTheWire(controller)).not.toThrow();
  });

  /**
   * The load-bearing test of the whole arrangement.
   *
   * A frontend fetches this document once, adopts it, and decides locally from
   * then on. Those decisions are worth rendering only if they land where the
   * server's own decisions land, so this asks both evaluators the same
   * questions and compares the answers. A published rule that stops agreeing
   * with the server's copy fails here.
   */
  it('decides what the server decides, from the served bytes alone', async () => {
    const controller = await controllerOver();
    const server = buildShopAccess();
    const browser = overTheWire(controller);

    const agree = <K extends keyof ShopObjects & string>(
      subject: ShopSubject,
      key: K,
      action: string,
      object?: Partial<ShopObjects[K]>,
    ) => {
      const here = server.can(subject, key, action, object);
      const there = browser.can(subject, key, action, object);
      expect({ at: `${key}.${action}/${subject.id}`, ...there }).toEqual({
        at: `${key}.${action}/${subject.id}`,
        ...here,
      });
      return here.allowed;
    };

    expect(agree(OPERATOR, 'game', 'declare', STOCKHOLM_TITLE)).toBe(true);
    expect(agree(OPERATOR, 'game', 'declare', GOTHENBURG_TITLE)).toBe(false);
    expect(agree(MANAGER, 'game', 'reprice', STOCKHOLM_TITLE)).toBe(true);
    expect(agree(OPERATOR, 'game', 'reprice', STOCKHOLM_TITLE)).toBe(false);
    expect(agree(ANONYMOUS_SUBJECT, 'game', 'declare', STOCKHOLM_TITLE)).toBe(
      false,
    );
    expect(agree(ANONYMOUS_SUBJECT, 'game', 'read', STOCKHOLM_TITLE)).toBe(
      true,
    );
    expect(agree(ANONYMOUS_SUBJECT, 'order', 'create')).toBe(true);
    expect(agree(OPERATOR, 'order', 'create')).toBe(false);
    expect(agree(MANAGER, 'telemetry', 'read')).toBe(true);
    expect(agree(ANONYMOUS_SUBJECT, 'telemetry', 'read')).toBe(false);
  });

  it('agrees on the field axis as well', async () => {
    const controller = await controllerOver();
    const server = buildShopAccess();
    const browser = overTheWire(controller);
    const proposed = { price: 1, availability: 'preorder' } as const;

    for (const [subject, action] of [
      [OPERATOR, 'declare'],
      [MANAGER, 'reprice'],
    ] as const) {
      const here = server.canFields(
        subject,
        'game',
        action,
        STOCKHOLM_TITLE,
        'write',
        proposed,
      );
      const there = browser.canFields(
        subject,
        'game',
        action,
        STOCKHOLM_TITLE,
        'write',
        proposed,
      );

      expect(there.fields).toEqual(here.fields);
      expect(there.reasons).toEqual(here.reasons);
    }
  });

  /**
   * A browser holding the contract asks about a key the contract left out and
   * gets a refusal rather than a throw. `parseMatrix` constructs in closed
   * mode, which is what makes a reduced document safe to hand out.
   */
  it('refuses an internal key at a holder of the contract', async () => {
    const controller = await controllerOver();
    const browser = overTheWire(controller);

    const decision = browser.can(ANONYMOUS_SUBJECT, 'inventory', 'read');

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('unknown-action');
  });
});
