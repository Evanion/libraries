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
/**
 * The application's root module and DI graph entry point.
 *
 * Composes the three feature modules (games, inventory, orders) with
 * CorrelationModule and TelemetryModule. Both of those are `global` in their
 * own definitions, so importing them once, here, is what makes
 * CorrelationService and TelemetryService injectable everywhere else in the
 * app without each feature module importing either directly.
 */
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Must run on every route: this is what opens the AsyncLocalStorage
    // context CorrelationService reads from, and everything the handler
    // awaits -- guards, interceptors, the controller -- runs inside it.
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
