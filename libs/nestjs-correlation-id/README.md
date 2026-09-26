[![npm version](https://img.shields.io/npm/v/@evanion/nestjs-correlation-id)](https://www.npmjs.com/package/@evanion/nestjs-correlation-id)
[![npm downloads](https://img.shields.io/npm/dm/@evanion/nestjs-correlation-id)](https://www.npmjs.com/package/@evanion/nestjs-correlation-id)
[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

<h1 align="center">Nest.js Correlation ID middleware</h1>

<h3 align="center">Transparently include correlation IDs in all requests</h3>

<div align="center">
  <a href="https://nestjs.com" target="_blank">
    <img src="https://img.shields.io/badge/built%20with-NestJs-red.svg" alt="Built with NestJS">
  </a>
</div>

One middleware opens an `AsyncLocalStorage` context per incoming request and
puts a correlation id in it. Everything downstream — guards, interceptors,
controllers, the promises they await — reads that id without it being threaded
through a single signature, and outgoing `HttpService` calls carry it to the
next service.

## Why

Following one request up and down a stack means finding its log lines in every
service that touched it. A `correlation-id` header (also called `request-id`),
generated at the edge and forwarded across every hop, is what makes that
possible.

## Install

```bash
npm install @evanion/nestjs-correlation-id
```

## Getting started

Register the module and apply the middleware in your `AppModule`.

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

`CorrelationIdMiddleware` opens an
[`AsyncLocalStorage`](https://nodejs.org/api/async_context.html) context for the
request. Everything downstream of it — guards, interceptors, controllers, and
anything they await — sees that request's id, and concurrent requests stay
isolated. Two handlers awaiting at the same time each read their own:

<!-- #region concurrent -->

```ts @import.meta.vitest
import { CorrelationService } from '@evanion/nestjs-correlation-id';

const correlation = new CorrelationService({
  header: 'X-Correlation-Id',
  generator: () => 'orders-0f3a2b',
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

Nest builds the service and the middleware for you. Built by hand over one
request, this is what the handler reads and what it reads outside the context:

<!-- #region one-request -->

```ts @import.meta.vitest
const config = { header: 'X-Correlation-Id', generator: () => 'mint-0f3a2b7c' };
const correlation = new CorrelationService(config);
const middleware = new CorrelationIdMiddleware(correlation, config);

// Nest hands the middleware the adapter's own request and response. These two
// carry the three members it reads: the request headers, and getHeader and
// setHeader on the response.
const request = { headers: { 'x-correlation-id': 'ORD-a4kp-9mxa' } };
const response = { getHeader: () => undefined, setHeader: () => undefined };

let handled: string | undefined;
middleware.use(request as never, response as never, () => {
  handled = correlation.getCorrelationId();
});

handled; // -> 'ORD-a4kp-9mxa'
correlation.getCorrelationId(); // -> undefined
```

<!-- #endregion one-request -->

The caller's header is the id the handler sees, because it passed `validate`. The
second line is the same service outside any context, where there is genuinely no
correlation id.

Then forward the id on outgoing HTTP calls by passing `withCorrelation()` to
`HttpModule.registerAsync`.

```ts
import { HttpModule } from '@nestjs/axios';
import { withCorrelation } from '@evanion/nestjs-correlation-id';

@Module({
  imports: [HttpModule.registerAsync(withCorrelation())],
  providers: [StockClient],
})
export class StockModule {}
```

Use `HttpService` as usual in `StockClient`. It stays a singleton: the
correlation header is attached by an axios request interceptor that reads the
current context when the request is made. Below, the `orders` service calls a
`stock` service that answers with the header it received, once inside a
correlation context and once outside one:

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
await once(stock.listen(0), 'listening');
const { port } = stock.address() as AddressInfo;
const url = `http://127.0.0.1:${port}/stock/urn:game:azul`;

// The orders service, as a Nest application context with no HTTP server.
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

`withCorrelation()` needs `CorrelationModule.forRoot()` to have been called
somewhere in the application — it is a global module, so once in the root module
is enough. Without it, Nest fails at boot with
`Nest can't resolve dependencies of the HTTP_MODULE_OPTIONS (?)`.

## Working outside a request

`CorrelationService` is a singleton, so it is injected like any other provider
and resolved with `module.get(CorrelationService)`. Outside a correlation
context `getCorrelationId()` returns `undefined`, and outgoing calls carry no
correlation header.

For work with no request behind it — queue consumers, cron jobs, scripts — open
a context yourself with `run`, and replace the id inside one with
`setCorrelationId`:

<!-- #region outside-a-request -->

```ts @import.meta.vitest
import { NestFactory } from '@nestjs/core';
import {
  CorrelationModule,
  CorrelationService,
} from '@evanion/nestjs-correlation-id';

const worker = await NestFactory.createApplicationContext(
  CorrelationModule.forRoot({ generator: () => 'restock-7c41d2' }),
  { logger: false },
);
const correlation = worker.get(CorrelationService);

const minted = correlation.run(correlation.generate(), () =>
  correlation.getCorrelationId(),
);

let replaced: string | undefined;
correlation.run('restock-7c41d2', () => {
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

minted; // -> 'restock-7c41d2'
replaced; // -> 'storefront-4f1c9a'
refused; // -> 'setCorrelationId() was called outside a correlation context. Apply CorrelationIdMiddleware, or wrap the work in CorrelationService.run().'
```

<!-- #endregion outside-a-request -->

## Configuration

`CorrelationModule.forRoot()` accepts a `Partial<CorrelationConfig>` and fills
in every field it is not given, so the configuration it provides under
`CORRELATION_CONFIG_TOKEN` is always complete:

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

An incoming id that `validate` accepts is reused as-is; `generator` runs only
when the request carried none, or carried one that was rejected. The id also
goes out on the response under the configured header, in the configured casing.

`validate` defaults to `DEFAULT_CORRELATION_ID_VALIDATOR`: 1 to 128 characters
of `[\w.:-]`. An accepted id reaches a response header and the application's
logs, both line-oriented sinks, so a validator that lets CR or LF through
accepts response splitting and log forging. Widen it deliberately.

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

The defaults `forRoot()` falls back to, and the injection tokens, are exported
from the package root:

<!-- #region constants -->

```ts @import.meta.vitest
import {
  CORRELATION_AXIOS_INTERCEPTOR,
  CORRELATION_CONFIG_TOKEN,
  CORRELATION_ID_HEADER,
} from '@evanion/nestjs-correlation-id';

CORRELATION_ID_HEADER; // -> 'X-Correlation-Id'
CORRELATION_CONFIG_TOKEN; // -> '@evanion/nestjs-correlation-id:CORRELATION_CONFIG'
CORRELATION_AXIOS_INTERCEPTOR; // -> '@evanion/nestjs-correlation-id:AXIOS_INTERCEPTOR'
```

<!-- #endregion constants -->

## Adding `correlationId` to logs

Inject `CorrelationService` wherever you build log context and read the current
id. It is a singleton, so nothing about injecting it changes the scope of the
provider holding it.

```ts
import { CorrelationService } from '@evanion/nestjs-correlation-id';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryTagMiddleware implements NestMiddleware {
  constructor(private readonly correlationService: CorrelationService) {}

  use(_req: IncomingMessage, _res: ServerResponse, next: () => void) {
    const correlationId = this.correlationService.getCorrelationId();
    if (correlationId) Sentry.setTag('correlationId', correlationId);
    next();
  }
}
```

`getCorrelationId()` is synchronous and gives `undefined` when there is no
correlation context, so apply this after `CorrelationIdMiddleware`, which is
what opens one.

```ts
@Module({
  imports: [CorrelationModule.forRoot()],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    consumer.apply(SentryTagMiddleware).forRoutes('*');
  }
}
```

To replace the id of the current context:

```ts
this.correlationService.setCorrelationId('some_correlation_id');
```

It throws outside a correlation context, rather than writing somewhere nothing
will read.

See the [specs on GitHub](https://github.com/Evanion/libraries/tree/main/libs/nestjs-correlation-id/src)
for fully worked examples, including an end-to-end one that stands up a real
Nest application.

## Requirements

|            |             |
| ---------- | ----------- |
| **NestJS** | 12          |
| **Node**   | 20 or newer |

Ships ESM only, matching NestJS 12. There is no CommonJS build, so
`require('@evanion/nestjs-correlation-id')` will not work — use `import`.

One build means one module graph and one `CorrelationService` class object, so
injecting by class token always resolves the provider the module registered.

The middleware is typed against `node:http`'s `IncomingMessage` and
`ServerResponse` and reads and writes raw headers, so it works under
`@nestjs/platform-express` and `@nestjs/platform-fastify` alike. `express` is
not a peer dependency.

`@nestjs/axios` is an optional peer dependency, needed only if you use
[`withCorrelation`](#getting-started). It is a type-only import, so it is not
pulled in at runtime.

This package has no runtime dependencies beyond `tslib`.

## Change Log

See [Changelog](CHANGELOG.md) for more information.

## Contributing

Contributions welcome! See [Contributing](https://github.com/Evanion/libraries/blob/main/CONTRIBUTING.md).

## Author

**Mikael Pettersson (Evanion on [Discord](https://discord.gg/G7Qnnhy))**

## License

Licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
