import { SetMetadata } from '@nestjs/common';
import { REQUIRES_PERMISSION } from './acl.constants.js';
import type { ShopObjects } from './shop.policy.js';

/** The permission one route names, as `AclGuard` reads it back. */
export interface RequiredPermission {
  key: keyof ShopObjects & string;
  action: string;
}

/**
 * Names the permission `AclGuard` decides before the handler runs.
 *
 * `key` is checked against `ShopObjects`, so a route naming a kind the matrix
 * does not carry fails to compile. `action` stays a string, because the matrix
 * holds actions as data and nothing types them here.
 *
 * So a typo in `action` compiles. `buildShopAccess` hydrates in open mode,
 * where `can` throws `UnknownPermissionError` for a permission the document
 * does not carry, and Nest renders that as a 500 on a live route.
 * `requires-coverage.spec.ts` is what moves that failure to a build: it reads
 * this metadata off every controller and holds each pair to `SHOP_MATRIX`.
 *
 * A route that carries no `@Requires` is not decided by the guard at all. Such
 * a route either needs no subject, or decides in its service on the row.
 */
// #region requires-decorator
export const Requires = (key: RequiredPermission['key'], action: string) =>
  SetMetadata<string, RequiredPermission>(REQUIRES_PERMISSION, { key, action });
// #endregion requires-decorator
