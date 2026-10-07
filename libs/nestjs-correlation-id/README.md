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

Now, any service in your app can read the current ID and add it to its logs. In an application Nest builds the service and injects the logger. Here both are built by hand, and the logger is a stand-in that keeps each line it is given:

The second call ran outside any correlation context, where `getCorrelationId()` returns `undefined`. `CorrelationIdMiddleware` opens the context, so read the ID in a handler, a guard, or a middleware applied after it.

### Isolated Between Concurrent Requests

Each request gets its own context, and the ID survives every `await` inside it. Two handlers awaiting at the same time each read their own:

### What the Middleware Does With a Request

The middleware reuses the caller's ID when it passes `validate`, and asks the generator for a new one when the request carried none or one that failed. Built by hand, this is what a handler reads for a request that carries an ID, for one that carries none, and outside any request:

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

The interceptor reads the context when each request is made, so `HttpService` stays a singleton. Outside a context, a call carries no correlation header.

`withCorrelation()` needs `CorrelationModule.forRoot()` somewhere in the application. It is a global module, so once in the root module is enough. Without it, Nest fails at boot with `Nest can't resolve dependencies of the @evanion/nestjs-correlation-id:AXIOS_INTERCEPTOR (AXIOS_INSTANCE_TOKEN, ?, @evanion/nestjs-correlation-id:CORRELATION_CONFIG)`.

### Manual Contexts for Background Jobs

Queue consumers, cron jobs and scripts have no request behind them, so no middleware opens a context. Open one yourself with `run`, and replace the ID inside one with `setCorrelationId`. Outside a context, `setCorrelationId` throws:

`examples/restock.job.ts` is a queue consumer that runs its work under the ID its message carried, or a generated one when the message carried none or one that fails `validate`. Built by hand around a stand-in for the client it calls, this is the ID each of three messages runs under:

### Custom Validation and Configuration

`CorrelationModule.forRoot()` accepts a `Partial<CorrelationConfig>` and fills in every field it is not given, so the configuration it provides under `CORRELATION_CONFIG_TOKEN` is always complete. Call it once: a second `forRoot()` creates a second `CorrelationService`, and a provider holding the copy the middleware did not use reads `undefined` inside every request.

An incoming ID that `validate` accepts is reused as-is, and it reaches every log line whose logger reads `getCorrelationId()`. `validate` defaults to `DEFAULT_CORRELATION_ID_VALIDATOR`: 1 to 128 characters of `[\w.:-]`. Node rejects a carriage return (CR) or line feed (LF) in a header in both directions, so over HTTP the CR and LF refusal never fires. It covers an ID from another source, such as a queue message, where a CR or LF forges a log line. Widen it deliberately.

The header `forRoot()` falls back to is exported from the package root:

So is the token the resolved configuration is provided under:

And the token of the provider `withCorrelation()` registers:

For the full API reference and integration guides, visit our documentation site:

👉 **[docs.evanion.com/nestjs-correlation-id](https://docs.evanion.com/nestjs-correlation-id)**

## License

MIT
