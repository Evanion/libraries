import { describe, it, expect, vi } from 'vitest';
import type { Provider } from '@nestjs/common';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import {
  CORRELATION_AXIOS_INTERCEPTOR,
  CORRELATION_CONFIG_TOKEN,
  CORRELATION_ID_HEADER,
} from './constants.js';
import { CorrelationService } from './correlation.service.js';
import { withCorrelation } from './withCorrelation.function.js';

type FactoryProviderLike = {
  provide: unknown;
  useFactory: (...args: never[]) => unknown;
  inject?: unknown[];
};

const interceptorProvider = (providers?: Provider[]): FactoryProviderLike => {
  const provider = (providers ?? []).find(
    (p) =>
      typeof p === 'object' &&
      'provide' in p &&
      p.provide === CORRELATION_AXIOS_INTERCEPTOR,
  );
  if (!provider) throw new Error('no interceptor provider registered');
  return provider as FactoryProviderLike;
};

/** Just enough of an axios instance to capture the registered interceptor. */
function mockAxios() {
  let onRequest:
    | ((c: InternalAxiosRequestConfig) => InternalAxiosRequestConfig)
    | undefined;
  const instance = {
    interceptors: {
      request: {
        use: vi.fn((fn: typeof onRequest) => {
          onRequest = fn;
          return 0;
        }),
      },
    },
  } as unknown as AxiosInstance;

  const send = () => {
    const headers = new Map<string, string>();
    const config = {
      headers: {
        set: (name: string, value: string) => headers.set(name, value),
      },
    } as unknown as InternalAxiosRequestConfig;
    if (!onRequest) throw new Error('no request interceptor registered');
    onRequest(config);
    return headers;
  };

  return { instance, send };
}

const service = (config = { header: CORRELATION_ID_HEADER, generator: () => 'gen' }) =>
  new CorrelationService(config);

describe('withCorrelation', () => {
  it('declares no dependencies for the options factory, so nothing turns HttpService request-scoped', () => {
    const options = withCorrelation();
    expect(options.inject ?? []).toEqual([]);
  });

  it('does not import CorrelationModule, which carries no providers of its own', () => {
    expect(withCorrelation().imports).toBeUndefined();
  });

  it('passes the caller options through untouched, baking in no correlation id', async () => {
    const options = withCorrelation({ baseURL: 'https://example.test', headers: { Authorization: 'Bearer token' } });
    const result = await options.useFactory?.();
    expect(result).toEqual({
      baseURL: 'https://example.test',
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('returns options even when none were given', async () => {
    expect(await withCorrelation().useFactory?.()).toEqual({});
  });

  it('reads the correlation id at request time, not at construction time', () => {
    const correlationService = service();
    const { instance, send } = mockAxios();
    const provider = interceptorProvider(withCorrelation().extraProviders);

    provider.useFactory(...([instance, correlationService, { header: 'X-Request-Id', generator: () => 'gen' }] as never[]));

    const first = correlationService.run('REQ-1', send);
    const second = correlationService.run('REQ-2', send);

    expect(first.get('X-Request-Id')).toBe('REQ-1');
    expect(second.get('X-Request-Id')).toBe('REQ-2');
  });

  it('uses the configured header name', () => {
    const correlationService = service();
    const { instance, send } = mockAxios();
    const provider = interceptorProvider(withCorrelation().extraProviders);
    provider.useFactory(...([instance, correlationService, { header: CORRELATION_ID_HEADER, generator: () => 'gen' }] as never[]));

    const headers = correlationService.run('REQ-3', send);
    expect(headers.get(CORRELATION_ID_HEADER)).toBe('REQ-3');
    expect(headers.has('X-Request-Id')).toBe(false);
  });

  it('sends no correlation header when the call is made outside a correlation context', () => {
    const correlationService = service();
    const { instance, send } = mockAxios();
    const provider = interceptorProvider(withCorrelation().extraProviders);
    provider.useFactory(...([instance, correlationService, { header: CORRELATION_ID_HEADER, generator: () => 'gen' }] as never[]));

    expect(send().size).toBe(0);
  });

  it('injects the axios instance, the service and the config into the interceptor provider', () => {
    const provider = interceptorProvider(withCorrelation().extraProviders);
    expect(provider.inject).toEqual([
      'AXIOS_INSTANCE_TOKEN',
      CorrelationService,
      CORRELATION_CONFIG_TOKEN,
    ]);
  });
});
