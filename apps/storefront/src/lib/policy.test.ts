import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  POLICY_REVALIDATE_MS,
  decide,
  mayPlaceOrder,
  policyAccess,
  resetPolicyCache,
} from './policy.js';
import { ShopApi } from './shop-api.js';
import { ANONYMOUS_SUBJECT, CUSTOMER_SUBJECT } from './subject.js';
import { policyResponse } from './__fixtures__/shop-policy.js';

/**
 * What the storefront holds and what it decides on it.
 *
 * The property under test is that a decision never waits on the network: the
 * document is fetched on the request that finds none held and on none of the
 * requests after it, until the revalidation window expires.
 */

const api = () => new ShopApi('page-view-1', 'http://api.test/api');

beforeEach(() => {
  resetPolicyCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the held policy', () => {
  it('fetches once and serves every request after it from the held copy', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(policyResponse()));

    const first = await policyAccess(api());
    const second = await policyAccess(api());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The same adopted object, so the second request paid neither the fetch nor
    // the validate-clone-freeze that construction runs.
    expect(second).toBe(first);
  });

  it('asks again once the revalidation window has expired', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(policyResponse()));

    await policyAccess(api());
    vi.advanceTimersByTime(POLICY_REVALIDATE_MS + 1);
    await policyAccess(api());

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('re-uses the adopted document when the revision has not moved', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(policyResponse()),
    );

    const first = await policyAccess(api());
    vi.advanceTimersByTime(POLICY_REVALIDATE_MS + 1);
    const second = await policyAccess(api());

    expect(second).toBe(first);
  });

  it('adopts the new document when the revision moves', async () => {
    vi.useFakeTimers();
    let version = 'shop-api@1';
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(policyResponse(version)),
    );

    const first = await policyAccess(api());
    version = 'shop-api@2';
    vi.advanceTimersByTime(POLICY_REVALIDATE_MS + 1);
    const second = await policyAccess(api());

    expect(second).not.toBe(first);
    expect(second?.version).toBe('shop-api@2');
  });

  it('holds nothing while the shop-api is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    expect(await policyAccess(api())).toBeUndefined();
  });

  it('keeps the held document when a later fetch fails', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(policyResponse()));

    const first = await policyAccess(api());
    fetchMock.mockRejectedValue(new Error('offline'));
    vi.advanceTimersByTime(POLICY_REVALIDATE_MS + 1);

    expect(await policyAccess(api())).toBe(first);
  });

  it('makes one fetch for renders that overlap', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(policyResponse()));

    await Promise.all([policyAccess(api()), policyAccess(api())]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('deciding on it', () => {
  it('refuses an anonymous visitor an order', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(policyResponse()),
    );
    const access = await policyAccess(api());

    expect(decide(access, ANONYMOUS_SUBJECT, 'order', 'create')).toMatchObject({
      allowed: false,
      reason: 'no-rule-matched',
    });
    expect(mayPlaceOrder(access, ANONYMOUS_SUBJECT)).toBe(false);
  });

  it('allows a signed-in customer an order', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(policyResponse()),
    );
    const access = await policyAccess(api());

    expect(mayPlaceOrder(access, CUSTOMER_SUBJECT)).toBe(true);
  });

  it('refuses when no document has been adopted', () => {
    expect(
      decide(undefined, CUSTOMER_SUBJECT, 'order', 'create'),
    ).toBeUndefined();
    expect(mayPlaceOrder(undefined, CUSTOMER_SUBJECT)).toBe(false);
  });
});
