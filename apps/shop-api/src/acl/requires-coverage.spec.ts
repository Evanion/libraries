import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { GamesController } from '../games/games.controller.js';
import { InventoryController } from '../inventory/inventory.controller.js';
import { OrdersController } from '../orders/orders.controller.js';
import { TelemetryController } from '../telemetry/telemetry.controller.js';
import { REQUIRES_PERMISSION } from './acl.constants.js';
import type { RequiredPermission } from './requires.decorator.js';
import { SHOP_MATRIX } from './shop.policy.js';

/**
 * Every controller carrying a `@Requires`. Listed rather than discovered,
 * because a controller this file forgets is a route nothing here holds to the
 * matrix, and a glob that silently matched nothing would read as a pass.
 */
const CONTROLLERS = [
  GamesController,
  InventoryController,
  OrdersController,
  TelemetryController,
];

/** The permission each decorated handler names, with where it was found. */
function required(): { where: string; permission: RequiredPermission }[] {
  return CONTROLLERS.flatMap((controller) => {
    const prototype = controller.prototype as unknown as Record<
      string,
      unknown
    >;

    return Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .flatMap((name) => {
        const permission = Reflect.getMetadata(
          REQUIRES_PERMISSION,
          prototype[name] as object,
        ) as RequiredPermission | undefined;

        return permission
          ? [{ where: `${controller.name}.${name}`, permission }]
          : [];
      });
  });
}

describe('the routes that name a permission', () => {
  /**
   * `buildShopAccess` hydrates in open mode, where `can` throws
   * `UnknownPermissionError` for a key the document does not carry and Nest
   * renders that as a 500. A typo in `@Requires` is therefore a server error on
   * a live route, and no type checks it: `action` is a plain string because the
   * matrix holds actions as data.
   *
   * Closed mode would answer `denied` instead, which reads safer and is worse:
   * the typo would refuse every caller forever and never report itself. So the
   * document stays open, the throw stays loud, and this test is what moves the
   * failure from a request to a build.
   */
  it('name a permission the matrix carries', () => {
    // A `Permission` carries the composite in `key` (`game.read`) and the kind
    // alone in `object`. `@Requires` names the two halves, so the decorator's
    // pair is joined to compare.
    const carried = new Set(
      SHOP_MATRIX.permissions.map((permission) => permission.key),
    );

    const missing = required()
      .filter(
        ({ permission }) =>
          !carried.has(`${permission.key}.${permission.action}`),
      )
      .map(
        ({ where, permission }) =>
          `${where} requires ${permission.key}.${permission.action}`,
      );

    expect(missing).toEqual([]);
  });

  it('cover every controller this file lists', () => {
    expect(required().length).toBeGreaterThanOrEqual(CONTROLLERS.length);
  });
});
