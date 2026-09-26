/**
 * The resolved configuration of the correlation module, as
 * `CorrelationModule.forRoot()` builds it. Every field is filled in there, so
 * consumers of the injection token never see a partial object.
 */
export interface CorrelationConfig {
  /**
   * Header the middleware reads an incoming id from and writes the outgoing id
   * to, in the casing it goes out in. Matching against the request is
   * case-insensitive because Node lowercases incoming header names.
   */
  header: string;
  /** Mints an id when the request carried none that {@link validate} accepts. */
  generator: () => string;
  /**
   * Decides whether an incoming id is used as-is or replaced by a generated
   * one. An id that passes reaches the application's logs. Node rejects CR and
   * LF in HTTP headers, so a validator that accepts them lets an id from another
   * source, such as a queue message, forge a log line.
   *
   * Optional because `CorrelationIdMiddleware` falls back to
   * `DEFAULT_CORRELATION_ID_VALIDATOR` for a hand-built configuration without
   * one. `forRoot()` always sets it.
   */
  validate?: (value: string) => boolean;
}
