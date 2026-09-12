import type { CorrelationService } from '@evanion/nestjs-correlation-id';
import { describe, expect, it } from 'vitest';
import { TelemetryService } from './telemetry.service.js';

/** A correlation service stub whose id can change between calls. */
const correlationServiceStub = (
  getId: () => string | undefined,
): CorrelationService => ({ getCorrelationId: getId }) as CorrelationService;

describe('TelemetryService', () => {
  it('stamps a recorded event with the current correlation id', () => {
    const telemetry = new TelemetryService(
      correlationServiceStub(() => 'abc-123'),
    );

    const event = telemetry.record('orders', 'order.requested', { foo: 1 });

    expect(event.correlationId).toBe('abc-123');
    expect(event.source).toBe('orders');
    expect(event.type).toBe('order.requested');
    expect(event.data).toEqual({ foo: 1 });
  });

  it('lists recorded events in the order they were recorded', () => {
    const telemetry = new TelemetryService(
      correlationServiceStub(() => 'abc-123'),
    );

    telemetry.record('orders', 'order.requested');
    telemetry.record('inventory', 'inventory.checked');

    const events = telemetry.list();

    expect(events.map((e) => e.type)).toEqual([
      'order.requested',
      'inventory.checked',
    ]);
  });

  it('filters events down to one correlation id', () => {
    let currentId = 'id-a';
    const telemetry = new TelemetryService(
      correlationServiceStub(() => currentId),
    );

    telemetry.record('orders', 'order.requested');
    currentId = 'id-b';
    telemetry.record('orders', 'order.requested');

    const events = telemetry.forCorrelationId('id-a');

    expect(events).toHaveLength(1);
    expect(events[0]?.correlationId).toBe('id-a');
  });

  it('records an event with no correlation id when outside a context', () => {
    const telemetry = new TelemetryService(
      correlationServiceStub(() => undefined),
    );

    const event = telemetry.record('orders', 'order.requested');

    expect(event.correlationId).toBeUndefined();
  });
});
