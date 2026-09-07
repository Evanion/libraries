import type { HttpModuleOptions } from '@nestjs/axios';
import { CORRELATION_CONFIG_TOKEN } from './constants.js';
import type { CorrelationConfig } from './interfaces/correlation-config.interface.js';
import { CorrelationModule } from './correlation.module.js';
import { CorrelationService } from './correlation.service.js';

export const withCorrelation = (config?: HttpModuleOptions) => ({
  imports: [CorrelationModule],
  useFactory: async (
    correlationService: CorrelationService,
    correlationConfig: CorrelationConfig,
  ) => ({
    ...config,
    headers: {
      ...(config?.headers && config.headers),
      [correlationConfig.header]: correlationService.getCorrelationId(),
    },
  }),
  inject: [CorrelationService, CORRELATION_CONFIG_TOKEN],
});
