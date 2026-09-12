import { afterEach, describe, expect, it, vi } from 'vitest';
import { CORRELATION_HEADER, ShopApi } from './shop-api.js';

/**
 * The hop the demo exists to show: every outbound call carries this page view's
 * correlation id, and whatever the API echoes back is recorded so a page can show
 * both sides.
 */

function respond(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ShopApi', () => {
  it('sends the correlation id on every call', async () => {
    // A fresh Response per call: a body can only be read once, so one shared
    // mock value would fail on the second call rather than on the assertion.
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(respond([])));
    const api = new ShopApi('page-view-1', 'http://api.test/api');

    await api.games();
    await api.stock('urn:game:azul');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(
        (init?.headers as Record<string, string>)[CORRELATION_HEADER],
      ).toBe('page-view-1');
    }
  });

  it('records the id the api echoed back', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      respond([], { headers: { [CORRELATION_HEADER]: 'page-view-1' } }),
    );
    const api = new ShopApi('page-view-1', 'http://api.test/api');

    await api.games();

    expect(api.trace()).toEqual({
      sent: 'page-view-1',
      echoed: ['page-view-1'],
      calls: 1,
    });
  });

  it('counts one call per request, whatever the outcome', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      respond({ message: 'No game found' }, { status: 404 }),
    );
    const api = new ShopApi('page-view-1', 'http://api.test/api');

    await api.game('urn:game:missing');

    expect(api.trace().calls).toBe(1);
  });

  it('reads the api error message rather than reporting the status alone', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      respond(
        { message: 'Insufficient stock for: urn:game:root' },
        { status: 400 },
      ),
    );
    const api = new ShopApi('page-view-1', 'http://api.test/api');

    const result = await api.createOrder([
      { urn: 'urn:game:root', quantity: 1 },
    ]);

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Insufficient stock for: urn:game:root',
    });
  });

  it('reports status 0 when nothing answered at all', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('fetch failed'),
    );
    const api = new ShopApi('page-view-1', 'http://api.test/api');

    const result = await api.games();

    expect(result).toEqual({ ok: false, status: 0, error: 'fetch failed' });
  });

  it('percent-encodes a urn into the path', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(respond({}));
    const api = new ShopApi('page-view-1', 'http://api.test/api');

    await api.stock('urn:expansion:wingspan:europe');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://api.test/api/inventory/urn%3Aexpansion%3Awingspan%3Aeurope',
    );
  });
});

describe('ShopApi.forRequest', () => {
  it('continues a trace the caller started', () => {
    const request = new Request('http://storefront.test/', {
      headers: { [CORRELATION_HEADER]: 'from-curl-1' },
    });

    expect(ShopApi.forRequest(request).correlationId).toBe('from-curl-1');
  });

  it('mints an id when the caller sent none', () => {
    const request = new Request('http://storefront.test/');

    expect(ShopApi.forRequest(request).correlationId).toMatch(/^[\w-]{36}$/);
  });

  it('replaces an id that could forge a log line or split a header', () => {
    const request = new Request('http://storefront.test/', {
      headers: { [CORRELATION_HEADER]: 'abc def' },
    });

    expect(ShopApi.forRequest(request).correlationId).not.toContain(' ');
  });
});
