import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Controller,
  Get,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { createServer, get, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { CorrelationIdMiddleware } from './correlation-id.middleware.js';
import { CorrelationModule } from './correlation.module.js';
import { CorrelationService } from './correlation.service.js';
import { withCorrelation } from './withCorrelation.function.js';

const HEADER = 'X-Request-Id';

/** Records the raw headers of every request it receives. */
class Upstream {
  private server?: Server;
  readonly received: string[][] = [];
  url = '';

  async start() {
    const server = createServer((req, res) => {
      this.received.push([...req.rawHeaders]);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
    this.server = server;
    await new Promise<void>((resolve) => server.listen(0, resolve));
    this.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  }

  headerOf(index: number, name: string): string | undefined {
    const raw = this.received[index] ?? [];
    for (let i = 0; i < raw.length; i += 2) {
      if (raw[i]?.toLowerCase() === name.toLowerCase()) return raw[i + 1];
    }
    return undefined;
  }

  rawNameOf(index: number, name: string): string | undefined {
    const raw = this.received[index] ?? [];
    for (let i = 0; i < raw.length; i += 2) {
      if (raw[i]?.toLowerCase() === name.toLowerCase()) return raw[i];
    }
    return undefined;
  }

  async stop() {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }
}

const upstream = new Upstream();

/**
 * A singleton holding HttpService, and the probe for the scope invariant
 * `withCorrelation()` has to preserve.
 *
 * Nest propagates request scope upward: a provider injecting a request-scoped
 * provider becomes request-scoped itself, and so does every provider holding
 * it. A request-scoped provider is constructed per request and never receives
 * `onModuleInit`, so both counters stay at 1 for any number of requests exactly
 * as long as nothing on the path from `HttpService` to `CorrelationService` is
 * request-scoped.
 */
@Injectable()
class Downstream implements OnModuleInit {
  static constructed = 0;
  static initialised = 0;

  constructor(private readonly http: HttpService) {
    Downstream.constructed += 1;
  }

  onModuleInit() {
    Downstream.initialised += 1;
  }

  call() {
    return firstValueFrom(this.http.get(upstream.url));
  }
}

@Controller()
class TestController {
  constructor(
    private readonly correlation: CorrelationService,
    private readonly downstream: Downstream,
  ) {}

  @Get('id')
  id() {
    return { id: this.correlation.getCorrelationId() };
  }

  @Get('slow')
  async slow() {
    const before = this.correlation.getCorrelationId();
    await delay(25);
    return { before, after: this.correlation.getCorrelationId() };
  }

  @Get('forward')
  async forward() {
    await this.downstream.call();
    return { ok: true };
  }
}

@Module({
  imports: [
    CorrelationModule.forRoot({ header: HEADER }),
    HttpModule.registerAsync(withCorrelation()),
  ],
  controllers: [TestController],
  providers: [Downstream],
})
class TestAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

/**
 * node:http rather than fetch: the Headers API lower-cases every name, so it
 * cannot see what casing actually went out on the wire.
 */
const request = (
  url: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; rawHeaders: string[]; body: string }> =>
  new Promise((resolve, reject) => {
    get(url, { headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          rawHeaders: [...res.rawHeaders],
          body,
        }),
      );
    }).on('error', reject);
  });

const responseHeaderName = (
  rawHeaders: string[],
  name: string,
): string | undefined => {
  for (let i = 0; i < rawHeaders.length; i += 2) {
    if (rawHeaders[i]?.toLowerCase() === name.toLowerCase())
      return rawHeaders[i];
  }
  return undefined;
};

const responseHeader = (
  rawHeaders: string[],
  name: string,
): string | undefined => {
  for (let i = 0; i < rawHeaders.length; i += 2) {
    if (rawHeaders[i]?.toLowerCase() === name.toLowerCase())
      return rawHeaders[i + 1];
  }
  return undefined;
};

describe('correlation id end to end', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    await upstream.start();
    app = await NestFactory.create(TestAppModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
    await upstream.stop();
  });

  it('echoes the incoming id back on the response', async () => {
    const { body, rawHeaders } = await request(`${base}/id`, {
      [HEADER]: 'from-caller',
    });
    expect(JSON.parse(body)).toEqual({ id: 'from-caller' });
    expect(responseHeader(rawHeaders, HEADER)).toBe('from-caller');
  });

  it('puts the configured header casing on the wire', async () => {
    const { rawHeaders } = await request(`${base}/id`, {
      [HEADER]: 'from-caller',
    });
    expect(responseHeaderName(rawHeaders, HEADER)).toBe(HEADER);
  });

  it('generates an id when the caller sends none', async () => {
    const { body, rawHeaders } = await request(`${base}/id`);
    const { id } = JSON.parse(body) as { id: string };
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(responseHeader(rawHeaders, HEADER)).toBe(id);
  });

  it('replaces an id the validator rejects', async () => {
    const { body } = await request(`${base}/id`, {
      [HEADER]: 'contains spaces',
    });
    expect(JSON.parse(body).id).not.toBe('contains spaces');
  });

  it('keeps overlapping requests isolated across an await', async () => {
    const ids = ['req-a', 'req-b', 'req-c', 'req-d'];
    const results = await Promise.all(
      ids.map((id) => request(`${base}/slow`, { [HEADER]: id })),
    );
    expect(results.map((r) => JSON.parse(r.body))).toEqual(
      ids.map((id) => ({ before: id, after: id })),
    );
  });

  it('forwards the current id to outgoing http calls, with the configured casing', async () => {
    const before = upstream.received.length;
    await request(`${base}/forward`, { [HEADER]: 'outgoing-1' });
    expect(upstream.headerOf(before, HEADER)).toBe('outgoing-1');
    expect(upstream.rawNameOf(before, HEADER)).toBe(HEADER);
  });

  it('forwards each request its own id, not the one the instance was built with', async () => {
    const before = upstream.received.length;
    await request(`${base}/forward`, { [HEADER]: 'outgoing-2' });
    await request(`${base}/forward`, { [HEADER]: 'outgoing-3' });
    expect([
      upstream.headerOf(before, HEADER),
      upstream.headerOf(before + 1, HEADER),
    ]).toEqual(['outgoing-2', 'outgoing-3']);
  });

  it('constructs a singleton holding HttpService exactly once across requests', async () => {
    await request(`${base}/forward`);
    await request(`${base}/forward`);
    expect(Downstream.constructed).toBe(1);
  });

  it('calls onModuleInit on a singleton holding HttpService', () => {
    expect(Downstream.initialised).toBe(1);
  });
});
