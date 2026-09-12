/**
 * The header `CorrelationModule.forRoot()` reads and writes when the caller
 * names none.
 *
 * No correlation header is registered with IANA, so there is no canonical
 * spelling to defer to; `X-Correlation-Id` and `X-Request-Id` are the two in
 * common use. The casing here is what goes out on the wire: Node lowercases
 * incoming header names, so the configured casing only ever affects the
 * response.
 */
export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/**
 * Injection token for the resolved `CorrelationConfig`.
 *
 * Namespaced because the provider is registered in a `global: true` module: a
 * bare `'CORRELATION_CONFIG'` collides silently with any other package that
 * picks the same string. A string and not a Symbol: a `Symbol()` is identity-
 * based, so two copies of this module would mint two tokens and Nest would
 * fail to resolve one of them.
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

/**
 * Accepts an incoming id of 1 to 128 word characters, dots, colons and hyphens,
 * and rejects everything else — in particular CR and LF.
 *
 * An id that passes is echoed into the response header and carried into
 * whatever the application logs, so it is attacker-controlled text in two sinks
 * that are line-oriented. Restricting it to an RFC 9110 token subset is what
 * keeps a header value from splitting a response or forging a log line, and the
 * 128-character cap bounds what a single request can append to every log line
 * it touches. A UUID, the shape `forRoot()` generates by default, is 36.
 *
 * @example
 * ```ts
 * DEFAULT_CORRELATION_ID_VALIDATOR('018f3a2b-7c41-7e3a-9f55-2c1d4e6a8b90'); // true
 * DEFAULT_CORRELATION_ID_VALIDATOR('abc\r\nX-Admin: 1'); // false
 * ```
 */
export const DEFAULT_CORRELATION_ID_VALIDATOR = (value: string): boolean =>
  /^[\w.:-]{1,128}$/.test(value);
