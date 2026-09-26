import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createServer, get, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { AppModule } from '../examples/app.module.js';
import { OrdersController } from '../examples/orders.controller.js';
import { RestockJob } from '../examples/restock.job.js';
import { StockClient } from '../examples/stock.client.js';
import { StockModule } from '../examples/stock.module.js';

/**
 * What `apps/docs/content/nestjs-correlation-id/` shows a reader is what this
 * suite runs.
 *
 * The pages cite `libs/nestjs-correlation-id/examples/*.ts` by region, so a
 * page renders the source of a module this file boots. A region that stops
 * compiling, stops resolving, or starts disagreeing with the sentence above it
 * on the page fails here rather than on the page.
 *
 * The examples carry decorators, which a README doctest cannot: the doctest
 * plugin transforms each README block with no tsconfig, so a decorator reaches
 * the runtime untransformed. The README regions carry the `// -> value` claims
 * that need no decorator, and this file holds the rest.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Baize's `stock` service: records the correlation header of every call. */
class Stock {
  private server?: Server;
  readonly received: (string | undefined)[] = [];
  url = '';

  async start() {
    const server = createServer((req, res) => {
      const header = req.headers['x-correlation-id'];
      this.received.push(Array.isArray(header) ? header.join(', ') : header);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ game: 'urn:game:azul', available: 3 }));
    });
    this.server = server;
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    this.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  last() {
    return this.received.at(-1);
  }

  async stop() {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }
}

/** The `orders` service, assembled from the modules the pages show. */
@Module({
  imports: [AppModule, StockModule],
  controllers: [OrdersController],
  providers: [RestockJob],
})
class OrdersService {}

const request = (
  url: string,
  headers: Record<string, string> = {},
): Promise<{ header: string | undefined; body: unknown }> =>
  new Promise((resolve, reject) => {
    get(url, { headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () =>
        resolve({
          header: res.headers['x-correlation-id'] as string | undefined,
          body: JSON.parse(body),
        }),
      );
    }).on('error', reject);
  });

describe('the orders service the pages build', () => {
  const stock = new Stock();
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    await stock.start();
    process.env['STOCK_URL'] = stock.url;
    app = await NestFactory.create(OrdersService, { logger: false });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
    await stock.stop();
    delete process.env['STOCK_URL'];
  });

  it('hands the handler the id the storefront sent', async () => {
    const { header, body } = await request(`${base}/orders/order-2026-0042`, {
      'X-Correlation-Id': 'storefront-4f1c9a',
    });

    expect(body).toEqual({
      order: 'order-2026-0042',
      correlationId: 'storefront-4f1c9a',
    });
    expect(header).toBe('storefront-4f1c9a');
  });

  it('mints a UUID for a request that carries no id, and returns it', async () => {
    const { header, body } = await request(`${base}/orders/order-2026-0042`);
    const { correlationId } = body as { correlationId: string };

    expect(correlationId).toMatch(UUID);
    expect(header).toBe(correlationId);
  });

  it('forwards the carried id to the stock service from a job', async () => {
    const level = await app
      .get(RestockJob)
      .handle({ game: 'urn:game:azul', correlationId: 'storefront-4f1c9a' });

    expect(level).toEqual({ game: 'urn:game:azul', available: 3 });
    expect(stock.last()).toBe('storefront-4f1c9a');
  });

  it('mints an id for a job that carries none', async () => {
    await app.get(RestockJob).handle({ game: 'urn:game:azul' });

    expect(stock.last()).toMatch(UUID);
  });

  it('replaces a carried id the validator rejects', async () => {
    await app
      .get(RestockJob)
      .handle({ game: 'urn:game:azul', correlationId: 'storefront 4f1c9a' });

    expect(stock.last()).toMatch(UUID);
  });

  it('sends no correlation header from outside a context', async () => {
    await app.get(StockClient).level('urn:game:azul');

    expect(stock.last()).toBeUndefined();
  });
});
