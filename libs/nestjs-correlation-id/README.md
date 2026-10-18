# @evanion/nestjs-correlation-id

**Transparent request tracing across your NestJS microservices.**

Debugging distributed systems is like solving a puzzle with pieces from three different boxes when a single user action triggers a chain of services and you are forced to hunt through fragmented logs by guessing timestamps. `@evanion/nestjs-correlation-id` solves this by attaching a correlation ID to every incoming request and forwarding it through your service chain.

To see how IDs are tracked without being passed as function arguments, the following example uses `CorrelationService.run` to simulate the request context that the middleware normally opens.

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

## Capabilities

`@evanion/nestjs-correlation-id` uses `AsyncLocalStorage` to ensure IDs remain isolated between concurrent requests and survive `await` boundaries.

- **Forwarding**: An `HttpService` registered with `withCorrelation()` sends the current ID on every outgoing call through an Axios interceptor.
- **Context-Aware**: The correlation ID is available anywhere in the request chain—guards, interceptors, controllers, and services.
- **Fully Configurable**: Customize your header name (`X-Correlation-Id`), ID generator, and validation logic.
- **Compatibility**: The middleware runs on NestJS's default Express platform.

## Requirements and Installation

The package is ESM only and requires Node 20 or newer. It uses `tslib` as its only runtime dependency, with `@nestjs/common` 12 as a peer dependency and `@nestjs/axios` 12 as an optional dependency for forwarding.

```bash
npm install @evanion/nestjs-correlation-id
```

## Documentation

For the full API reference and integration guides, visit our documentation site:

👉 **[docs.evanion.com/nestjs-correlation-id](https://docs.evanion.com/nestjs-correlation-id/)**

## License

MIT
