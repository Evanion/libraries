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
isolated.

Then forward the id on outgoing HTTP calls by passing `withCorrelation()` to
`HttpModule.registerAsync`.

```ts
import { HttpModule } from '@nestjs/axios';
import { withCorrelation } from '@evanion/nestjs-correlation-id';

@Module({
  imports: [HttpModule.registerAsync(withCorrelation())],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

Use `HttpService` as usual in `UsersService` and `UsersController`. It stays a
singleton: the correlation header is attached by an axios request interceptor
that reads the current context when the request is made.

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
a context yourself:

```ts
await this.correlationService.run(this.correlationService.generate(), () =>
  this.processJob(job),
);
```

## Configuration

`CorrelationModule.forRoot()` accepts a `CorrelationConfig`, exported from the
package root. Every field is optional.

```ts
import {
  CorrelationModule,
  type CorrelationConfig,
} from '@evanion/nestjs-correlation-id';

const config: Partial<CorrelationConfig> = {
  header: 'X-Request-Id', // defaults to 'X-Correlation-Id'
  generator: () => myId(), // defaults to node:crypto randomUUID
  validate: (id) => id.startsWith('req-'), // defaults to a strict token check
};

CorrelationModule.forRoot(config);
```

An incoming id that `validate` accepts is reused as-is; `generator` runs only
when the request carried none, or carried one that was rejected. The id also
goes out on the response under the configured header, in the configured casing.

`validate` defaults to `DEFAULT_CORRELATION_ID_VALIDATOR`: 1 to 128 characters
of `[\w.:-]`. An accepted id reaches a response header and the application's
logs, both line-oriented sinks, so a validator that lets CR or LF through
accepts response splitting and log forging. Widen it deliberately.

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
