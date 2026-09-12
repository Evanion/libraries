import { withCorrelation } from '@evanion/nestjs-correlation-id';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { InventoryClient } from './inventory-client.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

/**
 * Wires OrdersService's HTTP dependency: InventoryClient calls the
 * /inventory endpoint through an axios instance configured by
 * withCorrelation(), so every outbound request carries the current
 * correlation id automatically.
 */
@Module({
  // withCorrelation() needs CorrelationModule.forRoot() to already be in the
  // app -- it is global, so importing it once in AppModule is enough.
  imports: [HttpModule.registerAsync(withCorrelation())],
  controllers: [OrdersController],
  providers: [OrdersService, InventoryClient],
})
export class OrdersModule {}
