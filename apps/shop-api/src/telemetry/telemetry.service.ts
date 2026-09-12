import { CorrelationService } from '@evanion/nestjs-correlation-id';
import { Injectable } from '@nestjs/common';
import type { TelemetryEvent } from './telemetry-event.model.js';

/**
 * A mock observability sink -- a stand-in for something like Sentry or
 * Splunk. In-memory only, no external calls, per the demo's scope.
 *
 * `record` takes no correlation id. It reads one from the
 * AsyncLocalStorage-backed CorrelationService, which is a singleton and still
 * resolves the id of whichever request is in flight, so neither this service nor
 * any of its callers has to carry the id as a parameter.
 */
@Injectable()
export class TelemetryService {
  /**
   * How many events are kept. The sink is a process-lifetime array, so it needs
   * a ceiling; past it the oldest event is dropped, and a trail older than the
   * last 500 events is gone rather than paged.
   */
  private static readonly MAX_EVENTS = 500;

  private readonly events: TelemetryEvent[] = [];
  private nextId = 1;

  constructor(private readonly correlationService: CorrelationService) {}

  /** Records one event, stamped with the correlation id currently in scope. */
  record(
    source: string,
    type: string,
    data?: Record<string, unknown>,
  ): TelemetryEvent {
    const event: TelemetryEvent = {
      id: this.nextId++,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationService.getCorrelationId(),
      source,
      type,
      ...(data !== undefined && { data }),
    };
    this.events.push(event);
    if (this.events.length > TelemetryService.MAX_EVENTS) {
      this.events.shift();
    }
    return event;
  }

  /** Every retained event, oldest first. A copy, so a caller cannot edit the sink. */
  list(): TelemetryEvent[] {
    return [...this.events];
  }

  /** The retained events of one request, which is its trail across every source. */
  forCorrelationId(correlationId: string): TelemetryEvent[] {
    return this.events.filter((event) => event.correlationId === correlationId);
  }
}
