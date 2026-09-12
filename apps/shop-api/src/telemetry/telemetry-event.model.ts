export interface TelemetryEvent {
  id: number;
  timestamp: string;
  /** Undefined when recorded outside a correlation context. */
  correlationId: string | undefined;
  source: string;
  type: string;
  data?: Record<string, unknown>;
}
