/// <reference types="astro/client" />

import type { Access } from '@evanion/acl';
import type { BoundFeatures } from '@evanion/feature';

import type { CartLine } from './lib/cart.js';
import type { ShopApi } from './lib/shop-api.js';
import type { StorefrontSubject } from './lib/subject.js';

/**
 * What `src/middleware.ts` puts on every request and every page reads back.
 *
 * `api`, `cart` and `subject` are required, not optional: the middleware runs on
 * every route, so a page that found one missing would be looking at a bug rather
 * than at a case to handle. A visitor who has not signed in is the anonymous
 * subject, which is a subject.
 *
 * `access` is the exception. It is `undefined` until the shop-api has answered
 * with a document this app could adopt, and every decision made against
 * `undefined` refuses.
 */
/**
 * `features` is required for the reason `api` is: the middleware always binds
 * one. When the shop-api has published no document, the handle it binds turns
 * every flag off, so a page reads a flag and never tests for the handle. It
 * names no flags, because the document is the contract and this app holds no
 * type shared with the service: `BoundFeatures` with no type argument accepts
 * any string key, and a key the document does not carry resolves off.
 */
// #region locals-members
declare global {
  namespace App {
    interface Locals {
      api: ShopApi;
      cart: CartLine[];
      subject: StorefrontSubject;
      access: Access | undefined;
      features: BoundFeatures;
    }
  }
}
// #endregion locals-members
