import type {
  HttpModuleAsyncOptions,
  HttpModuleOptions,
} from '@nestjs/axios';
import type { AxiosInstance } from 'axios';
import {
  CORRELATION_AXIOS_INTERCEPTOR,
  CORRELATION_CONFIG_TOKEN,
} from './constants.js';
import { CorrelationService } from './correlation.service.js';
import type { CorrelationConfig } from './interfaces/correlation-config.interface.js';

/**
 * @nestjs/axios' own token for the axios instance HttpModule creates. It is a
 * plain string and is not re-exported from the package root, so it is inlined
 * here -- which also keeps @nestjs/axios a type-only import, and therefore
 * genuinely optional at runtime.
 */
const AXIOS_INSTANCE_TOKEN = 'AXIOS_INSTANCE_TOKEN';

/**
 * Options for `HttpModule.registerAsync` that forward the current correlation
 * id on every outgoing request.
 *
 * Requires `CorrelationModule.forRoot()` somewhere in the application. It is a
 * global module, so importing it once in the root module is enough; without it
 * Nest fails with `Nest can't resolve dependencies of the HTTP_MODULE_OPTIONS`.
 *
 * The id is read by an axios request interceptor at the moment the request is
 * made, not baked into the options object at factory time: that keeps
 * `CorrelationService` a singleton, so `HttpService` -- and every provider
 * holding it -- stays a singleton too.
 */
export const withCorrelation = (
  config?: HttpModuleOptions,
): HttpModuleAsyncOptions => ({
  useFactory: () => ({ ...config }),
  extraProviders: [
    {
      provide: CORRELATION_AXIOS_INTERCEPTOR,
      useFactory: (
        axiosInstance: AxiosInstance,
        correlationService: CorrelationService,
        correlationConfig: CorrelationConfig,
      ) =>
        axiosInstance.interceptors.request.use((request) => {
          const correlationId = correlationService.getCorrelationId();
          if (correlationId !== undefined) {
            request.headers.set(correlationConfig.header, correlationId);
          }
          return request;
        }),
      inject: [
        AXIOS_INSTANCE_TOKEN,
        CorrelationService,
        CORRELATION_CONFIG_TOKEN,
      ],
    },
  ],
});
