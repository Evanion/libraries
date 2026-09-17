import {
  CorrelationIdMiddleware,
  CorrelationModule,
} from '@evanion/nestjs-correlation-id';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AclModule } from '../acl/acl.module.js';
import { SubjectMiddleware } from '../acl/subject.middleware.js';
import { GamesModule } from '../games/games.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';

/**
 * The application's root module and DI graph entry point.
 *
 * CorrelationModule, AclModule and TelemetryModule are all declared `global`
 * where they are defined, so importing them once here is what makes
 * CorrelationService, SubjectService, the built matrix and TelemetryService
 * injectable throughout the feature modules without any of those modules
 * importing any of the three.
 */
@Module({
  imports: [
    CorrelationModule.forRoot(),
    AclModule.forRoot(),
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
    //
    // SubjectMiddleware covers every route for the same reason, and it runs
    // ahead of the guards, which is what lets AclGuard read the subject.
    consumer.apply(CorrelationIdMiddleware, SubjectMiddleware).forRoutes('*');
  }
}
