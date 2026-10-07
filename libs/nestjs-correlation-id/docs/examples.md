# @evanion/nestjs-correlation-id examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## The Solution: Transparent Correlation Context

### Core Concept: One ID per Request

<!-- #region core-concept -->

```ts @import.meta.vitest
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../examples/app.module.js';

const app = await NestFactory.create(AppModule, { logger: false });
await app.listen(0, '127.0.0.1');
const url = await app.getUrl();

const traced = await fetch(url, {
  headers: { 'X-Correlation-Id': 'storefront-4f1c9a' },
});
const fresh = await fetch(url);
await app.close();

traced.headers.get('X-Correlation-Id'); // -> 'storefront-4f1c9a'
fresh.headers.get('X-Correlation-Id')?.length; // -> 36
```

<!-- #endregion core-concept -->

<!-- #region log-the-id -->

```ts @import.meta.vitest
import { CorrelationService } from '@evanion/nestjs-correlation-id';

const lines: string[] = [];
const logger = { log: (line: string) => lines.push(line) };

class OrdersService {
  constructor(
    private readonly correlationService: CorrelationService,
    private readonly logger: { log(line: string): void },
  ) {}

  place(order: string) {
    const id = this.correlationService.getCorrelationId();
    this.logger.log(`Placing ${order} for request ${id}`);
  }
}

const correlation = new CorrelationService({
  header: 'X-Correlation-Id',
  generator: () => crypto.randomUUID(),
});
const orders = new OrdersService(correlation, logger);

correlation.run('storefront-4f1c9a', () => orders.place('order-2026-0042'));
orders.place('order-2026-0043');

lines; // -> ['Placing order-2026-0042 for request storefront-4f1c9a', 'Placing order-2026-0043 for request undefined']
```

<!-- #endregion log-the-id -->

### Isolated Between Concurrent Requests

<!-- #region concurrent -->

```ts @import.meta.vitest
import { CorrelationService } from '@evanion/nestjs-correlation-id';

// In an application Nest builds the service, and you inject it. Built by hand
// it takes a configuration object. The service calls only its generator, and
// the header is there because the configuration's type requires one.
const correlation = new CorrelationService({
  header: 'X-Correlation-Id',
  generator: () => crypto.randomUUID(),
});

// A handler that awaits before it reads the id, as a database call would.
const handler = async () => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return correlation.getCorrelationId();
};

const [first, second] = await Promise.all([
  correlation.run('storefront-4f1c9a', handler),
  correlation.run('storefront-9d2e71', handler),
]);

first; // -> 'storefront-4f1c9a'
second; // -> 'storefront-9d2e71'
correlation.getCorrelationId(); // -> undefined
```

<!-- #endregion concurrent -->

### What the Middleware Does With a Request

<!-- #region middleware-by-hand -->

```ts @import.meta.vitest
import {
  CorrelationIdMiddleware,
  CorrelationService,
} from '@evanion/nestjs-correlation-id';

const config = { header: 'X-Correlation-Id', generator: () => 'orders-0f3a2b' };
const correlation = new CorrelationService(config);
// The middleware opens its contexts on the service it is given.
const middleware = new CorrelationIdMiddleware(correlation, config);

// The middleware reads the request's headers and writes the id with setHeader.
// It leaves a response header that something earlier already set, so it asks
// getHeader first, and this stub answers that nothing did. `as never` lets the
// stubs stand in for Node's full IncomingMessage and ServerResponse.
const response = { getHeader: () => undefined, setHeader: () => undefined };
const handle = (headers: Record<string, string>) => {
  let handled: string | undefined;
  middleware.use({ headers } as never, response as never, () => {
    handled = correlation.getCorrelationId();
  });
  return handled;
};

handle({ 'x-correlation-id': 'storefront-4f1c9a' }); // -> 'storefront-4f1c9a'
handle({}); // -> 'orders-0f3a2b'
correlation.getCorrelationId(); // -> undefined
```

<!-- #endregion middleware-by-hand -->

## Beyond the Basics

### Forwarding the ID to Other Services

<!-- #region forward-hop -->

```ts @import.meta.vitest
/// <reference types="node" />
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpModule, HttpService } from '@nestjs/axios';
import { NestFactory } from '@nestjs/core';
import { firstValueFrom } from 'rxjs';
import {
  CorrelationModule,
  CorrelationService,
  withCorrelation,
} from '@evanion/nestjs-correlation-id';

// Baize's stock service, answering with the correlation id it received.
const stock = createServer((request, response) => {
  response.end(request.headers['x-correlation-id'] ?? 'no id');
});
// Port 0 asks the OS for a free port, and address() reports which one.
await once(stock.listen(0), 'listening');
const { port } = stock.address() as AddressInfo;
const url = `http://127.0.0.1:${port}/stock/${encodeURIComponent('urn:game:azul')}`;

// The orders service, as a Nest application context with no HTTP server. Its
// module is a dynamic module: a plain object with `module` and `imports`, the
// shape forRoot() returns, so the test declares no decorated class.
const orders = await NestFactory.createApplicationContext(
  {
    module: class OrdersModule {},
    imports: [
      CorrelationModule.forRoot(),
      HttpModule.registerAsync(withCorrelation()),
    ],
  },
  { logger: false },
);
const http = orders.get(HttpService);
const correlation = orders.get(CorrelationService);

const inside = await correlation.run('storefront-4f1c9a', () =>
  firstValueFrom(http.get(url)),
);
const outside = await firstValueFrom(http.get(url));
await orders.close();
stock.close();

inside.data; // -> 'storefront-4f1c9a'
outside.data; // -> 'no id'
```

<!-- #endregion forward-hop -->

### Manual Contexts for Background Jobs

<!-- #region outside-a-request -->

```ts @import.meta.vitest
import { NestFactory } from '@nestjs/core';
import {
  CorrelationModule,
  CorrelationService,
} from '@evanion/nestjs-correlation-id';

const worker = await NestFactory.createApplicationContext(
  CorrelationModule.forRoot({ generator: () => 'orders-7c41d2' }),
  { logger: false },
);
const correlation = worker.get(CorrelationService);

const generated = correlation.run(correlation.generate(), () =>
  correlation.getCorrelationId(),
);

let replaced: string | undefined;
correlation.run('orders-0f3a2b', () => {
  correlation.setCorrelationId('storefront-4f1c9a');
  replaced = correlation.getCorrelationId();
});

let refused = '';
try {
  correlation.setCorrelationId('storefront-4f1c9a');
} catch (error) {
  refused = (error as Error).message;
}
await worker.close();

generated; // -> 'orders-7c41d2'
replaced; // -> 'storefront-4f1c9a'
refused; // -> 'setCorrelationId() was called outside a correlation context. Apply CorrelationIdMiddleware, or wrap the work in CorrelationService.run().'
```

<!-- #endregion outside-a-request -->

<!-- #region restock-by-hand -->

```ts @import.meta.vitest
import {
  CorrelationService,
  DEFAULT_CORRELATION_ID_VALIDATOR,
} from '@evanion/nestjs-correlation-id';
import { RestockJob } from '../examples/restock.job.js';

const config = {
  header: 'X-Correlation-Id',
  generator: () => 'orders-7c41d2',
  validate: DEFAULT_CORRELATION_ID_VALIDATOR,
};
const correlation = new CorrelationService(config);

// Stands in for StockClient and records the id each call runs under, the id
// StockModule's HttpService sends to stock. `as never` lets it stand in for the
// class, which also holds an HttpService.
const sent: (string | undefined)[] = [];
const stock = {
  level: async (game: string) => {
    sent.push(correlation.getCorrelationId());
    return { game, available: 3 };
  },
};
const job = new RestockJob(correlation, config, stock as never);

await job.handle({ game: 'urn:game:azul', correlationId: 'storefront-4f1c9a' });
await job.handle({ game: 'urn:game:azul' });
await job.handle({ game: 'urn:game:azul', correlationId: 'storefront 4f1c9a' });

sent; // -> ['storefront-4f1c9a', 'orders-7c41d2', 'orders-7c41d2']
```

<!-- #endregion restock-by-hand -->

### Custom Validation and Configuration

<!-- #region configure -->

```ts @import.meta.vitest
import { NestFactory } from '@nestjs/core';
import {
  CORRELATION_CONFIG_TOKEN,
  CorrelationModule,
  type CorrelationConfig,
} from '@evanion/nestjs-correlation-id';

const orders = await NestFactory.createApplicationContext(
  CorrelationModule.forRoot({
    header: 'X-Request-Id',
    generator: () => `orders-${crypto.randomUUID().slice(0, 6)}`,
    validate: (value) => /^(storefront|orders|stock)-[0-9a-f]{6}$/.test(value),
  }),
  { logger: false },
);
const config = orders.get<CorrelationConfig>(CORRELATION_CONFIG_TOKEN);
await orders.close();

config.header; // -> 'X-Request-Id'
config.validate?.('storefront-4f1c9a'); // -> true
config.validate?.('storefront-4f1c9a, orders-0f3a2b'); // -> false
config.validate?.(config.generator()); // -> true
```

<!-- #endregion configure -->

<!-- #region validator -->

```ts @import.meta.vitest
import { DEFAULT_CORRELATION_ID_VALIDATOR } from '@evanion/nestjs-correlation-id';

DEFAULT_CORRELATION_ID_VALIDATOR('storefront-4f1c9a'); // -> true
DEFAULT_CORRELATION_ID_VALIDATOR('0f3a2b7c-41d2-4e3a-9f55-2c1d4e6a8b90'); // -> true
DEFAULT_CORRELATION_ID_VALIDATOR('storefront-4f1c9a, orders-0f3a2b'); // -> false
DEFAULT_CORRELATION_ID_VALIDATOR('orders-0f3a2b\r\nX-Admin: 1'); // -> false
DEFAULT_CORRELATION_ID_VALIDATOR('a'.repeat(129)); // -> false
```

<!-- #endregion validator -->

<!-- #region correlation-id-header -->

```ts @import.meta.vitest
import { CORRELATION_ID_HEADER } from '@evanion/nestjs-correlation-id';

CORRELATION_ID_HEADER; // -> 'X-Correlation-Id'
```

<!-- #endregion correlation-id-header -->

<!-- #region correlation-config-token -->

```ts @import.meta.vitest
import { CORRELATION_CONFIG_TOKEN } from '@evanion/nestjs-correlation-id';

CORRELATION_CONFIG_TOKEN; // -> '@evanion/nestjs-correlation-id:CORRELATION_CONFIG'
```

<!-- #endregion correlation-config-token -->

<!-- #region correlation-axios-interceptor -->

```ts @import.meta.vitest
import { CORRELATION_AXIOS_INTERCEPTOR } from '@evanion/nestjs-correlation-id';

CORRELATION_AXIOS_INTERCEPTOR; // -> '@evanion/nestjs-correlation-id:AXIOS_INTERCEPTOR'
```

<!-- #endregion correlation-axios-interceptor -->
