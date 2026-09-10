export const CORRELATION_ID_HEADER = 'X-Correlation-Id';
export const CORRELATION_CONFIG_TOKEN = 'CORRELATION_CONFIG';
/**
 * Token of the provider that attaches the outgoing-request interceptor to the
 * axios instance `withCorrelation` configures. Nothing injects it; it exists so
 * Nest instantiates the factory that registers the interceptor.
 */
export const CORRELATION_AXIOS_INTERCEPTOR =
  '@evanion/nestjs-correlation-id:AXIOS_INTERCEPTOR';
export const DEFAULT_CORRELATION_ID_VALIDATOR = (value: string): boolean =>
  /^[\w.:-]{1,128}$/.test(value);
