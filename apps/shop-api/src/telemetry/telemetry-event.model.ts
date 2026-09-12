/** One recorded observability event. `source` and `type` identify what
 * produced it; `data` is a free-form payload specific to that type. */
export interface TelemetryEvent {
  id: number;
  timestamp: string;
  /** Undefined when recorded outside a correlation context. */
  correlationId: string | undefined;
  source: string;
  type: string;
  data?: Record<string, unknown>;
}
