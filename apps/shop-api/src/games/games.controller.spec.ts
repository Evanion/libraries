import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { ACL_ACCESS } from '../acl/acl.constants.js';
import { buildShopAccess } from '../acl/shop.policy.js';
import {
  ANONYMOUS_SUBJECT,
  type ShopSubject,
} from '../acl/shop-subject.model.js';
import { SubjectService } from '../acl/subject.service.js';
import { GameURN } from '../domain/game.urn.js';
import { GamesController } from './games.controller.js';
import { GamesService } from './games.service.js';

/**
 * The controller over the app's real matrix, with one subject stubbed.
 *
 * `useValue` on the class token is the idiom this app uses for a
 * request-context fake, and the matrix is the real one, so a rule that stops
 * saying what these tests claim fails here.
 */
// #region controller-for
const controllerFor = async (subject: ShopSubject) => {
  const module = await Test.createTestingModule({
    controllers: [GamesController],
    providers: [
      GamesService,
      { provide: ACL_ACCESS, useValue: buildShopAccess() },
      { provide: SubjectService, useValue: { current: () => subject } },
    ],
  }).compile();
  return module.get(GamesController);
};
// #endregion controller-for

describe('GamesController', () => {
  it('lists every game', async () => {
    const controller = await controllerFor(ANONYMOUS_SUBJECT);

    const games = controller.findAll();

    expect(games.length).toBeGreaterThan(0);
  });

  it('gets one game by urn', async () => {
    const controller = await controllerFor(ANONYMOUS_SUBJECT);
    const urn = GameURN.stringify('wingspan');

    const game = controller.findOne(urn);

    expect(game.urn).toBe(urn);
  });

  it('applies a declaration an operator of the listing shop makes', async () => {
    const controller = await controllerFor({
      id: 'staff:ada',
      roles: ['operator'],
      shop: 'stockholm',
    });
    const urn = GameURN.stringify('wingspan');

    const game = controller.declare(urn, { availability: 'out-of-print' });

    expect(game.availability).toBe('out-of-print');
  });
});
