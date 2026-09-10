import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CorrelationIdMiddleware } from './correlation-id.middleware.js';
import { CorrelationService } from './correlation.service.js';
import type { CorrelationConfig } from './interfaces/correlation-config.interface.js';

const HEADER = 'X-Correlation-Id';

const config: CorrelationConfig = {
  header: HEADER,
  generator: () => '12345',
};

function mockService(generated = 'test123') {
  return {
    getCorrelationId: vi.fn(() => generated),
    setCorrelationId: vi.fn(),
  } as unknown as CorrelationService;
}

/**
 * Models what node:http actually gives a middleware: `req.headers` keyed by
 * lower-case name, `res.getHeader`/`res.setHeader` case-insensitive on lookup
 * but preserving the casing they were given. The old mock returned the same
 * value for every header name, which made casing untestable by construction.
 */
function mockReqRes(incoming?: string | string[]) {
  const req = {
    headers: {} as Record<string, string | string[] | undefined>,
  };
  if (incoming !== undefined) req.headers[HEADER.toLowerCase()] = incoming;

  const sent = new Map<string, { name: string; value: string }>();
  const res = {
    getHeader: vi.fn(
      (name: string) => sent.get(name.toLowerCase())?.value as string | undefined,
    ),
    setHeader: vi.fn((name: string, value: string) => {
      sent.set(name.toLowerCase(), { name, value });
    }),
  };
  return { req, res, sent };
}

const run = (
  middleware: CorrelationIdMiddleware,
  req: { headers: Record<string, string | string[] | undefined> },
  res: { getHeader: unknown; setHeader: unknown },
  next: (err?: unknown) => void = vi.fn(),
) =>
  middleware.use(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    next,
  );

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

  it('reads the incoming id from the raw lower-case header key', () => {
    const { req, res } = mockReqRes('from-caller');
    run(middleware, req, res);
    expect(service.setCorrelationId).toHaveBeenCalledWith('from-caller');
  });

  it('sets the correlation id on the request under the canonical lower-case key', () => {
    const { req, res } = mockReqRes(undefined);
    run(middleware, req, res);
    expect(req.headers['x-correlation-id']).toBe('test123');
    expect(Object.keys(req.headers)).not.toContain(HEADER);
  });

  it('sets the response header with the configured casing', () => {
    const { req, res, sent } = mockReqRes('test123');
    run(middleware, req, res);
    expect(sent.get('x-correlation-id')).toEqual({
      name: HEADER,
      value: 'test123',
    });
  });

  it('stores the correlation id on the service', () => {
    const { req, res } = mockReqRes('test123');
    run(middleware, req, res);
    expect(service.setCorrelationId).toHaveBeenCalledWith('test123');
  });

  it('falls back to a generated id when the incoming value is invalid', () => {
    const { req, res } = mockReqRes('contains spaces');
    run(middleware, req, res);
    expect(service.setCorrelationId).toHaveBeenCalledWith('test123');
  });

  it('rejects an incoming id that is too long', () => {
    const { req, res } = mockReqRes('a'.repeat(129));
    run(middleware, req, res);
    expect(service.setCorrelationId).toHaveBeenCalledWith('test123');
  });

  it('rejects comma-joined repeated headers', () => {
    const { req, res } = mockReqRes('aaa, bbb');
    run(middleware, req, res);
    expect(service.setCorrelationId).toHaveBeenCalledWith('test123');
  });

  it('rejects an array-valued header rather than picking one element', () => {
    const { req, res } = mockReqRes(['aaa', 'bbb']);
    run(middleware, req, res);
    expect(service.setCorrelationId).toHaveBeenCalledWith('test123');
  });

  it('allows a custom validator to accept values the default rejects', () => {
    const customMiddleware = new CorrelationIdMiddleware(service, {
      ...config,
      validate: () => true,
    });
    const { req, res } = mockReqRes('contains spaces');
    run(customMiddleware, req, res);
    expect(service.setCorrelationId).toHaveBeenCalledWith('contains spaces');
  });

  it('calls next exactly once', () => {
    const { req, res } = mockReqRes('test123');
    const next = vi.fn();
    run(middleware, req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a correlation id already on the response', () => {
    const { req, res } = mockReqRes('test123');
    res.setHeader(HEADER, 'already-set');
    res.setHeader.mockClear();
    run(middleware, req, res);
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
