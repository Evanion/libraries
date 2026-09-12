/// <reference types="astro/client" />

import type { CartLine } from './lib/cart.js';
import type { ShopApi } from './lib/shop-api.js';

/**
 * What `src/middleware.ts` puts on every request and every page reads back.
 *
 * Both are required, not optional: the middleware runs on every route, so a page
 * that found either missing would be looking at a bug rather than at a case to
 * handle.
 */
declare global {
  namespace App {
    interface Locals {
      api: ShopApi;
      cart: CartLine[];
    }
  }
}
