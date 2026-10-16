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
import { FeaturesService } from '../features/features.service.js';
import {
  buildShopFeatures,
  SHOP_DEFINITIONS,
} from '../features/shop.features.js';
import { GamesService } from './games.service.js';

/** A SubjectService answering with one subject for every call. */
const subjectsStub = (subject?: ShopSubject): SubjectService =>
  ({ current: () => subject }) as unknown as SubjectService;

/**
 * The shop's definitions with `new-checkout` switched off, which turns off
 * `express-pickup` for everyone through its dependency.
 */
const CHECKOUT_OFF = SHOP_DEFINITIONS.map((definition) =>
  definition.key === 'new-checkout'
    ? { ...definition, enabled: false }
    : definition,
);

/**
 * A service deciding on the app's real matrix and the app's real definitions.
 *
 * Both are the ones the app boots with, so a rule that stops saying what this
 * file claims fails here rather than in production.
 */
const serviceFor = (subject?: ShopSubject, definitions = SHOP_DEFINITIONS) => {
  const subjects = subjectsStub(subject);
  const features = new FeaturesService(
    buildShopFeatures(definitions),
    subjects,
  );
  return new GamesService(subjects, buildShopAccess(), features);
};

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

  describe('the express pickup flag', () => {
    // #region flag-on-the-row-spec
    it('marks an in-stock row when the flag is on for the subject', () => {
      const service = serviceFor(STOCKHOLM_OPERATOR);

      const row = service.findByUrn(STOCKHOLM_TITLE);

      expect(row.expressPickup).toBe(true);
    });

    it('leaves the member off the row when the flag is off', () => {
      const service = serviceFor(STOCKHOLM_OPERATOR, CHECKOUT_OFF);

      const row = service.findByUrn(STOCKHOLM_TITLE);

      expect(row).not.toHaveProperty('expressPickup');
    });
    // #endregion flag-on-the-row-spec

    it('decides every row of a listing for the same subject', () => {
      const service = serviceFor(STOCKHOLM_OPERATOR);

      const rows = service.findAll();

      expect(rows.every((row) => 'expressPickup' in row)).toBe(true);
    });
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
