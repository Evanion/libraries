/**
 * The module that gives `StockClient` an `HttpService` which forwards the
 * correlation id.
 *
 * Cited by the forwarding page and the API reference as `region=forward`.
 * `src/examples.spec.ts` imports it next to `examples/app.module.ts` and
 * asserts the header the `stock` service receives.
 */
// #region forward
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { withCorrelation } from '@evanion/nestjs-correlation-id';
import { StockClient } from './stock.client.js';

@Module({
  imports: [HttpModule.registerAsync(withCorrelation({ timeout: 5000 }))],
  providers: [StockClient],
  exports: [StockClient],
})
export class StockModule {}
// #endregion forward
