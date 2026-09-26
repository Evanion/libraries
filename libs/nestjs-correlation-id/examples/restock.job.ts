/**
 * A queue consumer in Baize's `orders` service: work with no incoming request
 * behind it, which opens its own correlation context.
 *
 * Cited by the jobs page and the API reference as `region=restock-job`.
 * `src/examples.spec.ts` runs it with and without a carried id and asserts the
 * header the `stock` service receives in each case.
 */
// #region restock-job
import { Inject, Injectable } from '@nestjs/common';
import {
  CORRELATION_CONFIG_TOKEN,
  CorrelationService,
  type CorrelationConfig,
} from '@evanion/nestjs-correlation-id';
import { StockClient } from './stock.client.js';

export interface RestockMessage {
  game: string;
  correlationId?: string;
}

@Injectable()
export class RestockJob {
  constructor(
    private readonly correlation: CorrelationService,
    @Inject(CORRELATION_CONFIG_TOKEN)
    private readonly config: CorrelationConfig,
    private readonly stock: StockClient,
  ) {}

  handle(message: RestockMessage) {
    const carried = message.correlationId;
    const id =
      carried && this.config.validate?.(carried)
        ? carried
        : this.correlation.generate();

    return this.correlation.run(id, () => this.stock.level(message.game));
  }
}
// #endregion restock-job
