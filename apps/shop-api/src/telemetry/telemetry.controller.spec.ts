import { CorrelationService } from '@evanion/nestjs-correlation-id';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { TelemetryController } from './telemetry.controller.js';
import { TelemetryService } from './telemetry.service.js';

describe('TelemetryController', () => {
  const buildController = async (correlationId: string | undefined) => {
    const module = await Test.createTestingModule({
      controllers: [TelemetryController],
      providers: [
        TelemetryService,
        {
          provide: CorrelationService,
          useValue: { getCorrelationId: () => correlationId },
        },
      ],
    }).compile();
    return {
      controller: module.get(TelemetryController),
      telemetry: module.get(TelemetryService),
    };
  };

  it('returns every recorded event when no correlationId filter is given', async () => {
    const { controller, telemetry } = await buildController('id-a');
    telemetry.record('orders', 'order.requested');
    telemetry.record('inventory', 'inventory.checked');

    expect(controller.list()).toHaveLength(2);
  });

  it('filters to one correlationId when given', async () => {
    const { controller, telemetry } = await buildController('id-a');
    telemetry.record('orders', 'order.requested');

    const events = controller.list('id-a');

    expect(events).toHaveLength(1);
    expect(events[0]?.correlationId).toBe('id-a');
  });
});
