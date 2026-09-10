export const CORRELATION_ID_HEADER = 'X-Correlation-Id';
export const CORRELATION_CONFIG_TOKEN = 'CORRELATION_CONFIG';
export const DEFAULT_CORRELATION_ID_VALIDATOR = (value: string): boolean =>
  /^[\w.:-]{1,128}$/.test(value);

