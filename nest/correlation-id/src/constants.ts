export const CORRELATION_ID_HEADER = 'X-Correlation-Id';
/**
 * Namespaced because the provider is registered in a `global: true` module: a
 * bare 'CORRELATION_CONFIG' would collide silently with any other package that
 * happened to pick the same string. Deliberately a string and not a Symbol --
 * a bare `Symbol()` is not stable across duplicate copies of a module, which
 * would reintroduce exactly the hazard the single ESM build removes.
 */
export const CORRELATION_CONFIG_TOKEN =
  '@evanion/nestjs-correlation-id:CORRELATION_CONFIG';
/**
 * Token of the provider that attaches the outgoing-request interceptor to the
 * axios instance `withCorrelation` configures. Nothing injects it; it exists so
 * Nest instantiates the factory that registers the interceptor.
 */
export const CORRELATION_AXIOS_INTERCEPTOR =
  '@evanion/nestjs-correlation-id:AXIOS_INTERCEPTOR';
export const DEFAULT_CORRELATION_ID_VALIDATOR = (value: string): boolean =>
  /^[\w.:-]{1,128}$/.test(value);
