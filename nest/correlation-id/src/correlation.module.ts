import { DynamicModule, Module, Provider } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CORRELATION_CONFIG_TOKEN, CORRELATION_ID_HEADER } from './constants.js';
import { CorrelationService } from './correlation.service.js';
// Must be `import type`: with isolatedModules and emitDecoratorMetadata,
// a type referenced in a decorated signature cannot be a value import.
import type { CorrelationConfig } from './interfaces/correlation-config.interface.js';

@Module({})
export class CorrelationModule {
  static forRoot(config?: Partial<CorrelationConfig>): DynamicModule {
    const correlationConfigProvider: Provider = {
      provide: CORRELATION_CONFIG_TOKEN,
      useValue: {
        ...config,
        header: config?.header || CORRELATION_ID_HEADER,
        generator: config?.generator || randomUUID,
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
