import { describe, it, expect, vi } from 'vitest';
import {
  CORRELATION_CONFIG_TOKEN,
  CORRELATION_ID_HEADER,
} from './constants.js';
import { CorrelationService } from './correlation.service.js';
import { withCorrelation } from './withCorrelation.function.js';

describe('withCorrelation', () => {
  function mockService(id = 'REQ-1') {
    return {
      getCorrelationId: vi.fn(() => id),
    } as unknown as CorrelationService;
  }

  it('uses the configured header name for the outbound correlation id', async () => {
    const factory = withCorrelation();
    const config = { header: 'X-Request-Id', generator: () => 'gen-id' };
    const result = await factory.useFactory(mockService('REQ-1'), config);

    expect(result.headers).toEqual({ 'X-Request-Id': 'REQ-1' });
    expect(result.headers).not.toHaveProperty(CORRELATION_ID_HEADER);
  });

  it('falls back to the default header when no custom header is configured', async () => {
    const factory = withCorrelation();
    const config = { header: CORRELATION_ID_HEADER, generator: () => 'gen-id' };
    const result = await factory.useFactory(mockService('REQ-2'), config);

    expect(result.headers).toEqual({ [CORRELATION_ID_HEADER]: 'REQ-2' });
  });

  it('merges user-supplied headers without overriding the configured key', async () => {
    const factory = withCorrelation({ headers: { Authorization: 'Bearer token' } });
    const config = { header: 'X-Request-Id', generator: () => 'gen-id' };
    const result = await factory.useFactory(mockService('REQ-3'), config);

    expect(result.headers).toEqual({
      Authorization: 'Bearer token',
      'X-Request-Id': 'REQ-3',
    });
  });

  it('declares both the service and the config token as dependencies', () => {
    const factory = withCorrelation();
    expect(factory.inject).toEqual([
      CorrelationService,
      CORRELATION_CONFIG_TOKEN,
    ]);
  });
});
