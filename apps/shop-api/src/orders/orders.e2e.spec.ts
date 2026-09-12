import type { INestApplication } from '@nestjs/common';
import { request as httpRequest } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * One request, resolved to its status and raw body.
 *
 * node:http rather than fetch: the Headers API lower-cases every name it is
 * given and every name it reports, so a test using it can neither send a
 * specific header casing nor observe the casing that came back.
 */
const request = (
  method: string,
  url: string,
  options: { headers?: Record<string, string>; body?: unknown } = {},
): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const req = httpRequest(
      url,
      {
        method,
        headers: {
          ...(payload && {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
          }),
          ...options.headers,
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

describe('shop-api end to end: the correlation-id hop', () => {
  let app: INestApplication;
  let base = '';
  const HEADER = 'X-Correlation-Id';
  const PORT = 34599;
  let HEADER_PREFIX = '';
  // Imported dynamically inside beforeAll, after process.env.PORT is set.
  // config.ts reads PORT at module evaluation and InventoryClient builds its
  // base URL from it, and every static import of a module is evaluated before
  // any statement of this one, so a top-level import would bake in port 3000.
  let InventoryClient: (typeof import('./inventory-client.service.js'))['InventoryClient'];
  let GameURN: (typeof import('../domain/game.urn.js'))['GameURN'];

  beforeAll(async () => {
    process.env['PORT'] = String(PORT);
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../app/app.module.js');
    const { GLOBAL_PREFIX } = await import('../config.js');
    ({ InventoryClient } = await import('./inventory-client.service.js'));
    ({ GameURN } = await import('../domain/game.urn.js'));
    HEADER_PREFIX = GLOBAL_PREFIX;

    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix(GLOBAL_PREFIX);
    await app.listen(PORT, '127.0.0.1');
    base = `http://127.0.0.1:${PORT}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('propagates the inbound correlation id through to the internal inventory call', async () => {
    const wingspan = GameURN.stringify('wingspan');
    const correlationId = 'e2e-hop-1';
    const { status, body } = await request(
      'POST',
      `${base}/${HEADER_PREFIX}/orders`,
      {
        headers: { [HEADER]: correlationId },
        body: { items: [{ urn: wingspan, quantity: 1 }] },
      },
    );

    expect(status).toBe(201);
    const result = JSON.parse(body);
    expect(result.correlationId).toBe(correlationId);
    // Proves the id crossed the real HTTP hop to the inventory endpoint and
    // came back on its response, not just that the outer request kept it.
    expect(result.inventoryCorrelationIds).toEqual([correlationId]);
  });

  it('shows the trace: querying telemetry by that id returns events from both orders and inventory', async () => {
    const wingspan = GameURN.stringify('wingspan');
    const correlationId = 'e2e-hop-2';
    await request('POST', `${base}/${HEADER_PREFIX}/orders`, {
      headers: { [HEADER]: correlationId },
      body: { items: [{ urn: wingspan, quantity: 1 }] },
    });

    const { status, body } = await request(
      'GET',
      `${base}/${HEADER_PREFIX}/telemetry?correlationId=${correlationId}`,
    );

    expect(status).toBe(200);
    const events = JSON.parse(body) as Array<{
      source: string;
      type: string;
      correlationId: string;
    }>;
    expect(events.every((e) => e.correlationId === correlationId)).toBe(true);
    expect(events.map((e) => e.source)).toEqual([
      'orders',
      'inventory',
      'orders',
    ]);
    expect(events.map((e) => e.type)).toEqual([
      'order.requested',
      'inventory.checked',
      'order.confirmed',
    ]);
  });

  /**
   * Nest propagates request scope upward through the injection graph, so one
   * request-scoped provider anywhere between `CorrelationService` and
   * `HttpService` turns InventoryClient request-scoped: a new instance per
   * request, and `onModuleInit` never called on any of them. Both counters
   * distinguish that from the singleton the app is wired for, and neither
   * changes a response, so nothing else here would notice.
   */
  describe('the provider holding HttpService stays a singleton', () => {
    it('is constructed once across several requests', async () => {
      const wingspan = GameURN.stringify('wingspan');
      await request('POST', `${base}/${HEADER_PREFIX}/orders`, {
        headers: { [HEADER]: 'e2e-singleton-a' },
        body: { items: [{ urn: wingspan, quantity: 1 }] },
      });
      await request('POST', `${base}/${HEADER_PREFIX}/orders`, {
        headers: { [HEADER]: 'e2e-singleton-b' },
        body: { items: [{ urn: wingspan, quantity: 1 }] },
      });

      expect(InventoryClient.constructed).toBe(1);
    });

    it('calls onModuleInit on that singleton', () => {
      expect(InventoryClient.initialised).toBe(1);
    });
  });
});
