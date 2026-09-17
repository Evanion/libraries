/// <reference types="astro/client" />

import type { Access } from '@evanion/acl';

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
declare global {
  namespace App {
    interface Locals {
      api: ShopApi;
      cart: CartLine[];
      subject: StorefrontSubject;
      access: Access | undefined;
    }
  }
}
