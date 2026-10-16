import type { APIContext, MiddlewareNext } from 'astro';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { featuresResponse } from './lib/__fixtures__/shop-features.js';
import { policyResponse } from './lib/__fixtures__/shop-policy.js';
import { resetFeatureCache } from './lib/features.js';
import { mayPlaceOrder, resetPolicyCache } from './lib/policy.js';
import { CORRELATION_HEADER, SHOP_SUBJECT_HEADER } from './lib/shop-api.js';
import {
  ANONYMOUS_SUBJECT,
  CUSTOMER_SUBJECT,
  SUBJECT_COOKIE,
} from './lib/subject.js';
import { onRequest } from './middleware.js';

/**
 * The per-request context every page decides on.
 *
 * It runs in the Astro vitest project because `astro:middleware` is a virtual
 * module Astro's own vite plugin provides, and `vitest.config.ts` deliberately
 * does not carry that plugin.
 */

/** A context carrying one cookie value, shaped as the middleware reads it. */
function contextWith(cookie: string | undefined): APIContext {
  return {
    request: new Request('http://storefront.test/cart'),
    cookies: {
      get(name: string) {
        if (name !== SUBJECT_COOKIE || cookie === undefined) return undefined;
        return { json: () => JSON.parse(cookie) as unknown };
      },
    },
    locals: {},
  } as unknown as APIContext;
}

const next: MiddlewareNext = () => Promise.resolve(new Response('ok'));

/** Answers each document the middleware reads, by the path it asked for. */
function documentFor(input: Parameters<typeof fetch>[0]): Response {
  return String(input).endsWith('/features')
    ? featuresResponse('shop-api@1', 100)
    : policyResponse();
}

beforeEach(() => {
  resetPolicyCache();
  resetFeatureCache();
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
    Promise.resolve(documentFor(input)),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the storefront middleware', () => {
  it('runs a visitor with no cookie as anonymous, and refuses them an order', async () => {
    const context = contextWith(undefined);

    await onRequest(context, next);

    expect(context.locals.subject).toEqual(ANONYMOUS_SUBJECT);
    expect(mayPlaceOrder(context.locals.access, context.locals.subject)).toBe(
      false,
    );
  });

  it('runs a signed-in customer as one, and allows them an order', async () => {
    const context = contextWith(JSON.stringify(CUSTOMER_SUBJECT));

    await onRequest(context, next);

    expect(context.locals.subject).toEqual(CUSTOMER_SUBJECT);
    expect(mayPlaceOrder(context.locals.access, context.locals.subject)).toBe(
      true,
    );
  });

  it('runs a malformed subject cookie as anonymous rather than throwing', async () => {
    const context = contextWith('{not json');

    await expect(onRequest(context, next)).resolves.toBeInstanceOf(Response);

    expect(context.locals.subject).toEqual(ANONYMOUS_SUBJECT);
    expect(mayPlaceOrder(context.locals.access, context.locals.subject)).toBe(
      false,
    );
  });

  it('fetches each document once, whatever the second request is', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);

    await onRequest(contextWith(undefined), next);
    await onRequest(contextWith(JSON.stringify(CUSTOMER_SUBJECT)), next);

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      'http://localhost:3000/api/policy',
      'http://localhost:3000/api/features',
    ]);
  });

  it('binds the flags to the subject of the request', async () => {
    const context = contextWith(JSON.stringify(CUSTOMER_SUBJECT));

    await onRequest(context, next);

    expect(context.locals.features.context.targetingKey).toBe(
      CUSTOMER_SUBJECT.id,
    );
    expect(context.locals.features.isEnabled('express-pickup')).toBe(true);
  });

  it('draws a page with every flag off when the shop-api has no document', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('refused'));
    const context = contextWith(undefined);

    await onRequest(context, next);

    expect(context.locals.features.isEnabled('express-pickup')).toBe(false);
  });

  it('states the subject on every outbound call', async () => {
    const context = contextWith(JSON.stringify(CUSTOMER_SUBJECT));
    await onRequest(context, next);

    await context.locals.api.games();

    const fetchMock = vi.mocked(globalThis.fetch);
    const [, init] =
      fetchMock.mock.calls[fetchMock.mock.calls.length - 1] ?? [];
    const headers = init?.headers as Record<string, string>;
    expect(JSON.parse(headers[SHOP_SUBJECT_HEADER] ?? 'null')).toEqual(
      CUSTOMER_SUBJECT,
    );
  });

  it('echoes the correlation id on the way out', async () => {
    const context = contextWith(undefined);

    const response = await onRequest(context, next);

    expect((response as Response).headers.get(CORRELATION_HEADER)).toBe(
      context.locals.api.correlationId,
    );
  });
});
