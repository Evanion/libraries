import { defineMiddleware } from 'astro:middleware';
import { readCart } from './lib/cart.js';
import { CORRELATION_HEADER, ShopApi } from './lib/shop-api.js';

/**
 * Opens the per-request context every page reads off `Astro.locals`: one
 * `ShopApi` carrying this page view's correlation id, and the cart.
 *
 * Middleware rather than a helper each page calls, because the correlation id
 * has to be one value for the whole page view -- several blocks on the landing
 * page call the API, and an id minted per call would trace nothing.
 *
 * This runs per request only because the app is server-rendered. Under a
 * prerendered build it would run once at build time, which is the reason
 * astro.config.mjs sets `output: 'server'`.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.api = ShopApi.forRequest(context.request);
  context.locals.cart = readCart(context.cookies);

  const response = await next();

  // Echoed on the way out so the id is readable with `curl -I` as well as in
  // the page, which is what makes the hop observable without a browser.
  response.headers.set(CORRELATION_HEADER, context.locals.api.correlationId);
  return response;
});
