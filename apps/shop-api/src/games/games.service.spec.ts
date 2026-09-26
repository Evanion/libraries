import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { buildShopAccess } from '../acl/shop.policy.js';
import {
  ANONYMOUS_SUBJECT,
  type ShopSubject,
} from '../acl/shop-subject.model.js';
import type { SubjectService } from '../acl/subject.service.js';
import { GamesService } from './games.service.js';

/** A SubjectService answering with one subject for every call. */
const subjectsStub = (subject?: ShopSubject): SubjectService =>
  ({ current: () => subject }) as unknown as SubjectService;

/**
 * A service deciding on the app's real matrix.
 *
 * The matrix is the one the app boots with, so a rule that stops saying what
 * this file claims fails here rather than in production.
 */
const serviceFor = (subject?: ShopSubject) =>
  new GamesService(subjectsStub(subject), buildShopAccess());

const STOCKHOLM_OPERATOR: ShopSubject = {
  id: 'staff:ada',
  roles: ['operator'],
  shop: 'stockholm',
};

const STOCKHOLM_MANAGER: ShopSubject = {
  id: 'staff:bo',
  roles: ['manager'],
  shop: 'stockholm',
};

/** A title the Stockholm shop lists, and one the Gothenburg shop lists. */
const STOCKHOLM_TITLE = 'urn:game:wingspan';
const GOTHENBURG_TITLE = 'urn:game:gloomhaven';

describe('GamesService', () => {
  it('lists every game in the catalogue', () => {
    const service = serviceFor(ANONYMOUS_SUBJECT);

    const games = service.findAll();

    expect(games.length).toBeGreaterThan(0);
    expect(games[0]).toHaveProperty('urn');
    expect(games[0]).toHaveProperty('title');
  });

  it('finds a game by its urn', () => {
    const service = serviceFor(ANONYMOUS_SUBJECT);
    const first = service.findAll().at(0);
    if (!first) throw new Error('expected at least one game in the catalogue');

    const found = service.findByUrn(first.urn);

    expect(found).toEqual(first);
  });

  it('throws NotFoundException for an unknown urn', () => {
    const service = serviceFor(ANONYMOUS_SUBJECT);

    expect(() => service.findByUrn('urn:game:does-not-exist')).toThrow(
      NotFoundException,
    );
  });

  describe('declare', () => {
    // #region declare-on-the-row
    it('lets an operator change a title their own shop lists', () => {
      const service = serviceFor(STOCKHOLM_OPERATOR);

      const game = service.declare(STOCKHOLM_TITLE, {
        availability: 'preorder',
      });

      expect(game.availability).toBe('preorder');
      expect(service.findByUrn(STOCKHOLM_TITLE).availability).toBe('preorder');
    });

    it('refuses the same operator on a title another shop lists', () => {
      const service = serviceFor(STOCKHOLM_OPERATOR);

      expect(() =>
        service.declare(GOTHENBURG_TITLE, { availability: 'preorder' }),
      ).toThrow(ForbiddenException);
    });
    // #endregion declare-on-the-row

    it('refuses an anonymous subject', () => {
      const service = serviceFor(ANONYMOUS_SUBJECT);

      expect(() =>
        service.declare(STOCKHOLM_TITLE, { availability: 'preorder' }),
      ).toThrow(ForbiddenException);
    });

    it('refuses a price an operator proposes', () => {
      const service = serviceFor(STOCKHOLM_OPERATOR);

      expect(() => service.declare(STOCKHOLM_TITLE, { price: 1 })).toThrow(
        ForbiddenException,
      );
    });

    it('writes a price a manager of the same shop proposes', () => {
      const service = serviceFor(STOCKHOLM_MANAGER);

      const game = service.declare(STOCKHOLM_TITLE, { price: 49900 });

      expect(game.price).toBe(49900);
    });

    it('refuses an availability the catalogue has no state for', () => {
      const service = serviceFor(STOCKHOLM_OPERATOR);

      expect(() =>
        service.declare(STOCKHOLM_TITLE, {
          availability: 'on-fire' as never,
        }),
      ).toThrow(BadRequestException);
    });
  });
});
