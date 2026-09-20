import { defineMiddleware } from 'astro:middleware';
import { readCart } from './lib/cart.js';
import { policyAccess } from './lib/policy.js';
import { CORRELATION_HEADER, ShopApi } from './lib/shop-api.js';
import { readSubject } from './lib/subject.js';

/**
 * Opens the per-request context every page reads off `Astro.locals`: who is
 * asking, the matrix their permissions are decided on, one `ShopApi` carrying
 * this page view's correlation id, and the cart.
 *
 * Middleware rather than a helper each page calls, because the correlation id
 * has to be one value for the whole page view -- several blocks on the landing
 * page call the API, and an id minted per call would trace nothing. The subject
 * and the matrix are resolved once here for the same reason in the other
 * direction: a page that resolved its own would be free to resolve a different
 * one from the page beside it.
 *
 * The subject is read before the `ShopApi` is built, because the client states
 * it on every outbound call.
 *
 * `policyAccess` awaits a fetch only when this process holds no document or the
 * revalidation window has expired. Every other request reads the document
 * already adopted at module scope, so no decision on a page waits on the
 * network.
 *
 * This runs per request only because the app is server-rendered. Under a
 * prerendered build it would run once at build time, which is the reason
 * astro.config.mjs sets `output: 'server'`.
 */
// #region open-context
export const onRequest = defineMiddleware(async (context, next) => {
  const subject = readSubject(context.cookies);

  context.locals.subject = subject;
  context.locals.api = ShopApi.forRequest(context.request, subject);
  context.locals.cart = readCart(context.cookies);
  context.locals.access = await policyAccess(context.locals.api);

  const response = await next();

  // Echoed on the way out so the id is readable with `curl -I` as well as in
  // the page, which is what makes the hop observable without a browser.
  response.headers.set(CORRELATION_HEADER, context.locals.api.correlationId);
  return response;
});
// #endregion open-context
