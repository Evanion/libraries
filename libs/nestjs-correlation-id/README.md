# @evanion/nestjs-correlation-id

**Transparent request tracing across your NestJS microservices.**

Stop hunting through fragmented logs across multiple services to find a single request's path. `@evanion/nestjs-correlation-id` attaches a correlation ID to every incoming request and sends it on every call made through an `HttpService` registered with `withCorrelation()`, so every service the request reaches can write the same ID into its log lines.

## The Problem: The "Log Fragment" Nightmare

In a microservices architecture, a single user action might trigger a chain of five different service calls. When an error occurs in the third service, you're forced to:

1. Search for a timestamp in Service A.
2. Guess which request in Service B matches that timestamp.
3. Hope that Service C's logs haven't rotated yet.

Without a single, shared ID that travels with the request, debugging distributed systems is like trying to solve a puzzle with pieces from three different boxes.

## The Solution: Transparent Correlation Context

`@evanion/nestjs-correlation-id` uses `AsyncLocalStorage` to open a request-scoped context. Once the middleware is applied, the correlation ID is available anywhere in the request chain—guards, interceptors, controllers, and services—without ever having to pass it as a function argument.

### Core Concept: Trace a Request Effortlessly

To demonstrate how IDs are tracked, `CorrelationService.run` opens the context that the middleware normally opens for a request. A service called inside this block reads the ID with `getCorrelationId()`, while a call outside any context reads `undefined`. This block runs in the package's test suite; the `// ->` comments show the resulting log lines.

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

## Key Features

- 🔄 **Forwarding**: an `HttpService` registered with `withCorrelation()` sends the current ID on every outgoing call through an Axios interceptor.
- 🧵 **Context-Aware**: Powered by `AsyncLocalStorage`, so IDs remain isolated between concurrent requests and survive `await` boundaries.
- 🛡️ **Compatibility**: the middleware runs on NestJS's default Express platform, which is the platform the package's tests start.
- ⚙️ **Fully Configurable**: Customize your header name (`X-Correlation-Id`), ID generator, and validation logic.
- 📦 **Footprint**: `tslib` is the only runtime dependency. `@nestjs/common` 12 is a peer dependency, and `@nestjs/axios` 12 is an optional one for forwarding. The package is ESM only and needs Node 20 or newer.

## Installation

```bash
npm install @evanion/nestjs-correlation-id
```

## Documentation

For the full API reference and integration guides, visit our documentation site:

👉 **[docs.evanion.com/nestjs-correlation-id](https://docs.evanion.com/nestjs-correlation-id/)**

## License

MIT
