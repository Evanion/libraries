# @evanion/nestjs-correlation-id

**One correlation ID per request, across your NestJS microservices.**

Stop hunting through fragmented logs across multiple services to find a single request's path. `@evanion/nestjs-correlation-id` attaches a correlation ID to every incoming request and sends it on every call through an `HttpService` registered with `withCorrelation()`, so every service the request reaches can write the same ID into its log lines.

## The Problem: Logs in Fragments

In a microservices architecture, a single order might pass from `storefront` to `orders` to `stock`. When `stock` fails, you're forced to:

1. Search for a timestamp in `storefront`.
2. Guess which request in `orders` matches that timestamp.
3. Hope that the logs of `stock` haven't rotated yet.

Without a single, shared ID that travels with the request, nothing ties the log lines of those three services together.

## The Solution: Transparent Correlation Context

`@evanion/nestjs-correlation-id` opens an `AsyncLocalStorage` context per request, and `CorrelationService` stays a singleton. Once the middleware is applied, the correlation ID is available anywhere in the request chain—guards, interceptors, controllers, and services—without ever having to pass it as a function argument.

### Core Concept: One ID per Request

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import {
  CorrelationIdMiddleware,
  CorrelationModule,
} from '@evanion/nestjs-correlation-id';

@Module({
  imports: [CorrelationModule.forRoot()],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

The same module is `examples/app.module.ts` in this repository. Boot it and every response carries the ID back in the `X-Correlation-Id` header: the caller's own when it sent a valid one, and a fresh UUID when it sent none or one that fails `validate`.

<!-- #region core-concept -->

```ts @import.meta.vitest
import { NestFactory } from '@nestjs/core';
import { AppModule } from './examples/app.module.js';

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

Now, any service in your app can read the current ID and add it to its logs. In an application Nest builds the service and injects the logger. Here both are built by hand, and the logger is a stand-in that keeps each line it is given:

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

The second call ran outside any correlation context, where `getCorrelationId()` returns `undefined`. `CorrelationIdMiddleware` opens the context, so read the ID in a handler, a guard, or a middleware applied after it.

### Isolated Between Concurrent Requests

Each request gets its own context, and the ID survives every `await` inside it. Two handlers awaiting at the same time each read their own:

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

The middleware reuses the caller's ID when it passes `validate`, and asks the generator for a new one when the request carried none or one that failed. Built by hand, this is what a handler reads for a request that carries an ID, for one that carries none, and outside any request:

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

The ID also goes out on the response under the configured header, in the configured casing, unless something earlier already set that header.

## Key Features

- 🌐 **Transparent Forwarding**: Attaches the correlation ID to every outgoing call through an `HttpService` registered with `withCorrelation()`, using an Axios interceptor.
- 🧵 **Context-Aware**: Powered by `AsyncLocalStorage`, so IDs remain isolated between concurrent requests and survive `await` boundaries.
- 🛠️ **Express or Fastify**: The middleware reads and writes raw `node:http` headers, so it works under either Nest adapter.
- ⚙️ **Fully Configurable**: Customize your header name (default `X-Correlation-Id`), ID generator (default `randomUUID` from `node:crypto`), and validation logic.
- 🪶 **Zero-Weight**: No runtime dependencies beyond `tslib`.

## Installation

```bash
npm install @evanion/nestjs-correlation-id
```

Requires NestJS 12 and Node 20+.

The package ships ESM only, matching NestJS 12. A CommonJS project loads it through `require()` on Node 20.19, 22.12 or newer, the same way it loads NestJS 12.

The middleware reads and writes raw `node:http` headers, so `express` is not a peer dependency. `@nestjs/axios` is an optional peer dependency, needed only for `withCorrelation()`, and it needs `axios` installed beside it.

## Beyond the Basics

### Forwarding the ID to Other Services

Pass `withCorrelation()` to `HttpModule.registerAsync`, and every call through that module's `HttpService` carries the current ID to the next service. Below, the `orders` service calls a `stock` service that answers with the header it received, once inside a correlation context and once outside one:

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

The interceptor reads the context when each request is made, so `HttpService` stays a singleton. Outside a context, a call carries no correlation header.

`withCorrelation()` needs `CorrelationModule.forRoot()` somewhere in the application. It is a global module, so once in the root module is enough. Without it, Nest fails at boot with `Nest can't resolve dependencies of the @evanion/nestjs-correlation-id:AXIOS_INTERCEPTOR (AXIOS_INSTANCE_TOKEN, ?, @evanion/nestjs-correlation-id:CORRELATION_CONFIG)`.

### Manual Contexts for Background Jobs

Queue consumers, cron jobs and scripts have no request behind them, so no middleware opens a context. Open one yourself with `run`, and replace the ID inside one with `setCorrelationId`. Outside a context, `setCorrelationId` throws:

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

`examples/restock.job.ts` is a queue consumer that runs its work under the ID its message carried, or a generated one when the message carried none or one that fails `validate`. Built by hand around a stand-in for the client it calls, this is the ID each of three messages runs under:

<!-- #region restock-by-hand -->

```ts @import.meta.vitest
import {
  CorrelationService,
  DEFAULT_CORRELATION_ID_VALIDATOR,
} from '@evanion/nestjs-correlation-id';
import { RestockJob } from './examples/restock.job.js';

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

`CorrelationModule.forRoot()` accepts a `Partial<CorrelationConfig>` and fills in every field it is not given, so the configuration it provides under `CORRELATION_CONFIG_TOKEN` is always complete. Call it once: a second `forRoot()` creates a second `CorrelationService`, and a provider holding the copy the middleware did not use reads `undefined` inside every request.

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

An incoming ID that `validate` accepts is reused as-is, and it reaches every log line whose logger reads `getCorrelationId()`. `validate` defaults to `DEFAULT_CORRELATION_ID_VALIDATOR`: 1 to 128 characters of `[\w.:-]`. Node rejects a carriage return (CR) or line feed (LF) in a header in both directions, so over HTTP the CR and LF refusal never fires. It covers an ID from another source, such as a queue message, where a CR or LF forges a log line. Widen it deliberately.

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

The header `forRoot()` falls back to is exported from the package root:

<!-- #region correlation-id-header -->

```ts @import.meta.vitest
import { CORRELATION_ID_HEADER } from '@evanion/nestjs-correlation-id';

CORRELATION_ID_HEADER; // -> 'X-Correlation-Id'
```

<!-- #endregion correlation-id-header -->

So is the token the resolved configuration is provided under:

<!-- #region correlation-config-token -->

```ts @import.meta.vitest
import { CORRELATION_CONFIG_TOKEN } from '@evanion/nestjs-correlation-id';

CORRELATION_CONFIG_TOKEN; // -> '@evanion/nestjs-correlation-id:CORRELATION_CONFIG'
```

<!-- #endregion correlation-config-token -->

And the token of the provider `withCorrelation()` registers:

<!-- #region correlation-axios-interceptor -->

```ts @import.meta.vitest
import { CORRELATION_AXIOS_INTERCEPTOR } from '@evanion/nestjs-correlation-id';

CORRELATION_AXIOS_INTERCEPTOR; // -> '@evanion/nestjs-correlation-id:AXIOS_INTERCEPTOR'
```

<!-- #endregion correlation-axios-interceptor -->

For the full API reference and integration guides, visit our documentation site:

👉 **[docs.evanion.com/nestjs-correlation-id](https://docs.evanion.com/nestjs-correlation-id)**

## License

MIT
