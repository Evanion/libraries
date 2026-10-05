# @evanion/nestjs-correlation-id

**Transparent request tracing across your NestJS microservices.**

Stop hunting through fragmented logs across multiple services to find a single request's path. `@evanion/nestjs-correlation-id` automatically attaches and forwards a unique correlation ID to every request, giving you a single, traceable thread from the edge to the database.

## The Problem: The "Log Fragment" Nightmare

In a microservices architecture, a single user action might trigger a chain of five different service calls. When an error occurs in the third service, you're forced to:
1. Search for a timestamp in Service A.
2. Guess which request in Service B matches that timestamp.
3. Hope that Service C's logs haven't rotated yet.

Without a single, shared ID that travels with the request, debugging distributed systems is like trying to solve a puzzle with pieces from three different boxes.

## The Solution: Transparent Correlation Context

`@evanion/nestjs-correlation-id` uses `AsyncLocalStorage` to open a request-scoped context. Once the middleware is applied, the correlation ID is available anywhere in the request chain—guards, interceptors, controllers, and services—without ever having to pass it as a function argument.

### Core Concept: Trace a Request Effortlessly

```ts
import { CorrelationIdMiddleware, CorrelationModule } from '@evanion/nestjs-correlation-id';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';

@Module({
  imports: [CorrelationModule.forRoot()],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Every incoming request now has a traceable ID
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

Now, any service in your app can read the current ID and add it to its logs:

```ts
constructor(private readonly correlationService: CorrelationService) {}

someMethod() {
  const id = this.correlationService.getCorrelationId();
  this.logger.log(`Processing request ${id}...`);
}
```

## Key Features

- 🌐 **Transparent Forwarding**: Automatically attaches the correlation ID to all outgoing `HttpService` calls using an Axios interceptor.
- 🧵 **Context-Aware**: Powered by `AsyncLocalStorage`, so IDs remain isolated between concurrent requests and survive `await` boundaries.
- 🛠️ **Framework Agnostic**: Works seamlessly with both Express and Fastify adapters.
- ⚙️ **Fully Configurable**: Customize your header name (`X-Correlation-Id`), ID generator, and validation logic.
- 🪶 **Zero-Weight**: No runtime dependencies beyond `tslib`.

## Installation

```bash
npm install @evanion/nestjs-correlation-id
```

Requires NestJS 12 and Node 20+.

## Beyond the Basics

Tracing is most powerful when it extends beyond the HTTP layer. Our documentation covers advanced scenarios, including:

- **Background Jobs**: How to wrap queue consumers or cron jobs in a correlation context.
- **Custom Validation**: Ensuring incoming correlation IDs follow your organization's security standards.
- **Sentry Integration**: Automatically tagging Sentry errors with the current correlation ID for instant debugging.
- **Manual Contexts**: Using `CorrelationService.run()` to create artificial contexts for scripts or tests.

For the full API reference and integration guides, visit our documentation site:

👉 **[docs.evanion.com/nestjs-correlation-id](https://docs.evanion.com/nestjs-correlation-id)**

## License
MIT
