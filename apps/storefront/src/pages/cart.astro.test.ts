import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { policyResponse } from '../lib/__fixtures__/shop-policy.js';
import { policyAccess, resetPolicyCache } from '../lib/policy.js';
import { ShopApi, type Game } from '../lib/shop-api.js';
import {
  ANONYMOUS_SUBJECT,
  CUSTOMER_SUBJECT,
  type StorefrontSubject,
} from '../lib/subject.js';
import Cart from './cart.astro';

/**
 * The storefront's only write path, decided server-side.
 *
 * `/cart` takes the four intents the shop has, and the page renders on the
 * server, so this handler is what a script posting with curl reaches. The
 * assertion that matters is the negative one: a refused subject leaves no order
 * behind, whatever the buttons on the page said.
 */

const CATALOGUE: Game[] = [
  {
    urn: 'urn:game:azul',
    title: 'Azul',
    mechanisms: ['tile placement'],
    players: '2-4',
    playtime: '30-45 min',
    complexity: 1.8,
    price: 39900,
    availability: 'in-stock',
    shop: 'gothenburg',
    expansions: [],
  },
];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Answers the three endpoints this page reaches, and records every request, so
 * a test can assert that `POST /orders` was among them or was not.
 */
function shopApiStub() {
  const calls: { url: string; method: string }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET' });

    if (url.endsWith('/policy')) return Promise.resolve(policyResponse());
    if (url.endsWith('/games')) return Promise.resolve(json(CATALOGUE));
    return Promise.resolve(
      json({
        urn: 'urn:order:0001',
        items: [{ urn: 'urn:game:azul', quantity: 1 }],
        inventoryCorrelationIds: [],
      }),
    );
  });

  return calls;
}

/** The locals the middleware would have put on this request. */
async function localsFor(subject: StorefrontSubject) {
  const api = new ShopApi('page-view-1', 'http://api.test/api', subject);
  return {
    api,
    cart: [{ urn: 'urn:game:azul', quantity: 1 }],
    subject,
    access: await policyAccess(api),
  };
}

/** The page's response to one checkout POST. */
async function checkout(subject: StorefrontSubject): Promise<Response> {
  const container = await AstroContainer.create();
  const body = new FormData();
  body.set('intent', 'checkout');

  return container.renderToResponse(Cart, {
    routeType: 'page',
    request: new Request('http://storefront.test/cart', {
      method: 'POST',
      body,
    }),
    locals: await localsFor(subject),
  });
}

beforeEach(() => {
  resetPolicyCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /cart', () => {
  // #region post-refused
  it('refuses an anonymous visitor and places no order', async () => {
    const calls = shopApiStub();

    const response = await checkout(ANONYMOUS_SUBJECT);
    const html = await response.text();

    expect(response.status).toBe(403);
    expect(html).toContain('data-refused="order.create"');
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });
  // #endregion post-refused

  it('places the order for a signed-in customer', async () => {
    const calls = shopApiStub();

    const response = await checkout(CUSTOMER_SUBJECT);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('urn:order:0001');
    expect(
      calls.some(
        (call) => call.method === 'POST' && call.url.endsWith('/orders'),
      ),
    ).toBe(true);
  });

  it('refuses a cart edit as well, because a cart is the draft of an order', async () => {
    const calls = shopApiStub();
    const container = await AstroContainer.create();
    const body = new FormData();
    body.set('intent', 'add');
    body.set('urn', 'urn:game:azul');

    const response = await container.renderToResponse(Cart, {
      routeType: 'page',
      request: new Request('http://storefront.test/cart', {
        method: 'POST',
        body,
      }),
      locals: await localsFor(ANONYMOUS_SUBJECT),
    });

    // A refusal and not a 303: nothing was written, so there is nothing to
    // redirect the shopper to go and read.
    expect(response.status).toBe(403);
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });
});
