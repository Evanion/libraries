import { DynamicModule, Module, Provider } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CORRELATION_CONFIG_TOKEN,
  CORRELATION_ID_HEADER,
  DEFAULT_CORRELATION_ID_VALIDATOR,
} from './constants.js';
import { CorrelationService } from './correlation.service.js';
// Must be `import type`: with isolatedModules and emitDecoratorMetadata,
// a type referenced in a decorated signature cannot be a value import.
import type { CorrelationConfig } from './interfaces/correlation-config.interface.js';

/**
 * Provides `CorrelationService` and the correlation configuration to the whole
 * application.
 *
 * @example
 * ```ts
 * @Module({ imports: [CorrelationModule.forRoot()] })
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(CorrelationIdMiddleware).forRoutes('*');
 *   }
 * }
 * ```
 */
@Module({})
export class CorrelationModule {
  /**
   * Fills in every unset field of `config` and returns the module, registered
   * `global: true`.
   *
   * Global because `CorrelationIdMiddleware`, `withCorrelation()` and every
   * provider that reads an id all resolve `CORRELATION_CONFIG_TOKEN` from the
   * root injector: without it each consuming module would have to import this
   * one, and `HttpModule.registerAsync(withCorrelation())` fails with
   * `Nest can't resolve dependencies of the HTTP_MODULE_OPTIONS`.
   *
   * Call it once. A second `forRoot()` registers a second configuration
   * provider under the same token, and the last import wins.
   */
  static forRoot(config?: Partial<CorrelationConfig>): DynamicModule {
    const correlationConfigProvider: Provider = {
      provide: CORRELATION_CONFIG_TOKEN,
      useValue: {
        ...config,
        header: config?.header || CORRELATION_ID_HEADER,
        generator: config?.generator || randomUUID,
        validate: config?.validate || DEFAULT_CORRELATION_ID_VALIDATOR,
      },
    };
    return {
      global: true,
      module: CorrelationModule,
      providers: [correlationConfigProvider, CorrelationService],
      exports: [correlationConfigProvider, CorrelationService],
    };
  }
}
