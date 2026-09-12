import {
  CorrelationIdMiddleware,
  CorrelationModule,
} from '@evanion/nestjs-correlation-id';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { GamesModule } from '../games/games.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';

/**
 * The application's root module and DI graph entry point.
 *
 * CorrelationModule and TelemetryModule are both declared `global` where they
 * are defined, so importing them once here is what makes CorrelationService and
 * TelemetryService injectable throughout the feature modules without any of
 * those modules importing either one.
 */
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
    // Every route, because the middleware is what opens the AsyncLocalStorage
    // context CorrelationService reads from. A route it does not cover gets no
    // context, and getCorrelationId() returns undefined there.
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
