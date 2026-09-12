import {
  CorrelationIdMiddleware,
  CorrelationModule,
} from '@evanion/nestjs-correlation-id';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { GamesModule } from '../games/games.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';

@Module({
  imports: [
    CorrelationModule.forRoot(),
    TelemetryModule,
    GamesModule,
    InventoryModule,
    OrdersModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
