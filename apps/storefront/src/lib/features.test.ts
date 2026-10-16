import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FEATURES_REVALIDATE_MS,
  featureStore,
  resetFeatureCache,
} from './features.js';
import { ShopApi } from './shop-api.js';
import { featuresResponse } from './__fixtures__/shop-features.js';

/**
 * What the storefront holds of the shop's feature definitions and what it
 * decides on them.
 *
 * The property under test is the one `policy.test.ts` holds for the matrix: a
 * decision never waits on the network. The document is fetched on the request
 * that finds none held and on none of the requests after it, until the
 * revalidation window expires.
 */

const api = () => new ShopApi('page-view-1', 'http://api.test/api');

beforeEach(() => {
  resetFeatureCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the held feature store', () => {
  it('fetches once and serves every request after it from the held store', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(featuresResponse()));

    const first = await featureStore(api());
    const second = await featureStore(api());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://api.test/api/features',
    );
    expect(second).toBe(first);
  });

  it('asks again once the revalidation window has expired', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(featuresResponse()));

    await featureStore(api());
    vi.advanceTimersByTime(FEATURES_REVALIDATE_MS + 1);
    await featureStore(api());

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('re-uses the installed store when the version has not moved', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(featuresResponse()),
    );

    const first = await featureStore(api());
    vi.advanceTimersByTime(FEATURES_REVALIDATE_MS + 1);
    const second = await featureStore(api());

    expect(second).toBe(first);
  });

  it('installs the new document when the version moves', async () => {
    vi.useFakeTimers();
    let document = featuresResponse('shop-api@1', 100);
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(document.clone()),
    );
    const context = { targetingKey: 'customer:demo' };

    const before = await featureStore(api());
    document = featuresResponse('shop-api@2', 0);
    vi.advanceTimersByTime(FEATURES_REVALIDATE_MS + 1);
    const after = await featureStore(api());

    expect(before.isEnabled('new-checkout', context)).toBe(true);
    expect(after).not.toBe(before);
    expect(after.isEnabled('new-checkout', context)).toBe(false);
  });

  it('turns the dependant off with its parent', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(featuresResponse('shop-api@1', 0)),
    );

    const store = await featureStore(api());

    expect(store.isEnabled('express-pickup', { targetingKey: 'a' })).toBe(
      false,
    );
  });

  it('resolves every flag off while no document has been held', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('refused'));

    const store = await featureStore(api());

    expect(store.isEnabled('new-checkout', { targetingKey: 'a' })).toBe(false);
  });

  it('asks again on the next request after a failed fetch', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('refused'))
      .mockImplementation(() => Promise.resolve(featuresResponse('v', 100)));

    await featureStore(api());
    const store = await featureStore(api());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.isEnabled('new-checkout', { targetingKey: 'a' })).toBe(true);
  });

  it('keeps the held store when a later document is refused', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve(featuresResponse('v1', 100)),
      )
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              version: 'v2',
              config: { features: [{ key: 'bad key', enabled: 'yes' }] },
            }),
          ),
        ),
      );

    const first = await featureStore(api());
    vi.advanceTimersByTime(FEATURES_REVALIDATE_MS + 1);
    const second = await featureStore(api());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second).toBe(first);
  });

  it('fetches once for the requests in flight when the window expires', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(featuresResponse()));

    await Promise.all([featureStore(api()), featureStore(api())]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
