<h1 align="center">Nest.js Correlation ID middleware</h1>

<h3 align="center">Transparently include correlation IDs in all requests</h3>

<div align="center">
  <a href="https://nestjs.com" target="_blank">
    <img src="https://img.shields.io/badge/built%20with-NestJs-red.svg" alt="Built with NestJS">
  </a>
</div>

### Requirements

|            |             |
| ---------- | ----------- |
| **NestJS** | 12          |
| **Node**   | 20 or newer |

Ships ESM only, matching NestJS 12. There is no CommonJS build, so
`require('@evanion/nestjs-correlation-id')` will not work — use `import`.

One build means one module graph and one `CorrelationService` class object, so
injecting by class token is always safe. The dual build this package used to
ship could hand Nest two unrelated copies of the same class.

The middleware is typed against `node:http`'s `IncomingMessage` and
`ServerResponse` and reads and writes raw headers, so it works under
`@nestjs/platform-express` and `@nestjs/platform-fastify` alike. `express` is
not a peer dependency.

`@nestjs/axios` is an optional peer dependency, needed only if you use
[`withCorrelation`](#how-to-use). It is a
type-only import, so it is not pulled in at runtime.

This package has no runtime dependencies beyond `tslib`.

### Why?

When debugging an issue in your applications logs, it helps to be able to follow a specific request up and down your whole stack. This is usually done by including a `correlation-id` (aka `Request-id`) header in all your requests, and forwarding the same id across all your microservices.

### Installation

```bash
yarn add @evanion/nestjs-correlation-id
```

```bash
npm install @evanion/nestjs-correlation-id
```

### How to use

Add the middleware to your `AppModule`

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

### Working outside a request

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

### Configuration

`CorrelationModule.forRoot()` accepts a `CorrelationConfig`, exported from the
package root.

```ts
import {
  CorrelationModule,
  type CorrelationConfig,
} from '@evanion/nestjs-correlation-id';

const config: Partial<CorrelationConfig> = {
  header: 'X-Request-Id', // defaults to 'X-Correlation-Id'
  generator: () => myId(), // defaults to node:crypto randomUUID
};

CorrelationModule.forRoot(config);
```

### Customize

You can easily customize the header and ID by including a config when you register the module

```ts
@Module({
  imports: [CorrelationModule.forRoot({
    header: string
    generator: () => string
  })]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

#### Add `correlationId` to logs

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

`getCorrelationId()` is synchronous — it never returned a promise — and gives
`undefined` when there is no correlation context, so apply this after
`CorrelationIdMiddleware`, which is what opens one.

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

See the [specs on GitHub](https://github.com/Evanion/libraries/tree/main/nest/correlation-id/src)
for fully worked examples, including an end-to-end one that stands up a real
Nest application.

## Change Log

See [Changelog](CHANGELOG.md) for more information.

## Contributing

Contributions welcome! See [Contributing](https://github.com/Evanion/libraries/blob/main/CONTRIBUTING.md).

## Author

**Mikael Pettersson (Evanion on [Discord](https://discord.gg/G7Qnnhy))**

## License

Licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
