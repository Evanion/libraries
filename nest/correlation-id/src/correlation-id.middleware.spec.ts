import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CorrelationIdMiddleware } from './correlation-id.middleware.js';
import { CorrelationService } from './correlation.service.js';
import { CorrelationConfig } from './interfaces/correlation-config.interface.js';

const HEADER = 'X-Correlation-Id';

const config: CorrelationConfig = {
  header: HEADER,
  generator: () => '12345',
};

function mockService(existing = 'test123') {
  return {
    getCorrelationId: vi.fn(() => existing),
    setCorrelationId: vi.fn(),
  } as unknown as CorrelationService;
}

function mockReqRes(incoming?: string) {
  const req = {
    get: vi.fn((name: string) =>
      name.toLowerCase() === HEADER.toLowerCase() ? incoming : undefined,
    ),
    headers: {} as Record<string, unknown>,
  };
  const res = {
    get: vi.fn(() => undefined),
    set: vi.fn(),
    headers: {} as Record<string, unknown>,
  };
  return { req, res };
}

describe('CorrelationIdMiddleware', () => {
  let service: CorrelationService;
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    service = mockService();
    middleware = new CorrelationIdMiddleware(service, config);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('sets the correlation id on the request under the canonical lower-case key', () => {
    const { req, res } = mockReqRes(undefined);
    middleware.use(req as never, res as never, vi.fn());
    expect(req.headers['x-correlation-id']).toBe('test123');
    expect(Object.keys(req.headers)).not.toContain(HEADER);
  });

  it('sets the correlation id on the response using the configured header casing', () => {
    const { req, res } = mockReqRes('test123');
    middleware.use(req as never, res as never, vi.fn());
    expect(res.set).toHaveBeenCalledWith(HEADER, 'test123');
  });

  it('stores the correlation id on the service', () => {
    const { req, res } = mockReqRes('test123');
    middleware.use(req as never, res as never, vi.fn());
    expect(service.setCorrelationId).toHaveBeenCalledWith('test123');
  });

  it('prefers an incoming correlation id and does not duplicate the header key', () => {
    const { req, res } = mockReqRes('from-caller');
    middleware.use(req as never, res as never, vi.fn());
    expect(service.setCorrelationId).toHaveBeenCalledWith('from-caller');
    expect(res.set).toHaveBeenCalledWith(HEADER, 'from-caller');
    expect(Object.keys(req.headers)).not.toContain(HEADER);
  });

  it('calls next exactly once', () => {
    const { req, res } = mockReqRes('test123');
    const next = vi.fn();
    middleware.use(req as never, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a correlation id already on the response', () => {
    const { req } = mockReqRes('test123');
    const res = {
      get: vi.fn(() => 'already-set'),
      set: vi.fn(),
      headers: {} as Record<string, unknown>,
    };
    middleware.use(req as never, res as never, vi.fn());
    expect(res.set).not.toHaveBeenCalled();
  });
});
