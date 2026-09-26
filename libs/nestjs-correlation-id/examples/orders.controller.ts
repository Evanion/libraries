/**
 * A handler in Baize's `orders` service that reads the correlation id of the
 * request it is serving.
 *
 * Cited by the Setup article as `region=read-the-id`. `src/examples.spec.ts`
 * mounts it under `examples/app.module.ts` and asserts that the id it returns
 * is the one the caller sent.
 */
// #region read-the-id
import { Controller, Get, Logger, Param } from '@nestjs/common';
import { CorrelationService } from '@evanion/nestjs-correlation-id';

@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly correlation: CorrelationService) {}

  @Get(':order')
  find(@Param('order') order: string) {
    const correlationId = this.correlation.getCorrelationId();
    this.logger.log({ order, correlationId });
    return { order, correlationId };
  }
}
// #endregion read-the-id
