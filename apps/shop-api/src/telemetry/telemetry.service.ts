import { CorrelationService } from '@evanion/nestjs-correlation-id';
import { Injectable } from '@nestjs/common';
import type { TelemetryEvent } from './telemetry-event.model.js';

/**
 * A mock observability sink -- a stand-in for something like Sentry or
 * Splunk. In-memory only, no external calls, per the demo's scope.
 *
 * Reads the correlation id itself, from the AsyncLocalStorage-backed
 * CorrelationService singleton, rather than having it threaded through every
 * call site. That is the property nestjs-correlation-id#31's fix provides: a
 * singleton can read the id of whichever request happens to be in flight
 * without the id being passed as a parameter.
 */
@Injectable()
export class TelemetryService {
  private static readonly MAX_EVENTS = 500;

  private readonly events: TelemetryEvent[] = [];
  private nextId = 1;

  constructor(private readonly correlationService: CorrelationService) {}

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

  list(): TelemetryEvent[] {
    return [...this.events];
  }

  forCorrelationId(correlationId: string): TelemetryEvent[] {
    return this.events.filter((event) => event.correlationId === correlationId);
  }
}
