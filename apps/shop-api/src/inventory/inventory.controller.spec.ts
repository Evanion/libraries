import { CorrelationService } from '@evanion/nestjs-correlation-id';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { GameURN } from '../domain/game.urn.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

describe('InventoryController', () => {
  const buildController = async (correlationId: string | undefined) => {
    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        InventoryService,
        TelemetryService,
        {
          provide: CorrelationService,
          useValue: { getCorrelationId: () => correlationId },
        },
      ],
    }).compile();
    return {
      controller: module.get(InventoryController),
      telemetry: module.get(TelemetryService),
    };
  };

  it('returns the stock level with the current correlation id', async () => {
    const { controller } = await buildController('req-1');
    const urn = GameURN.stringify('wingspan');

    const result = controller.getStock(urn);

    expect(result.urn).toBe(urn);
    expect(result.correlationId).toBe('req-1');
  });

  it('records an inventory.checked telemetry event stamped with the request id', async () => {
    const { controller, telemetry } = await buildController('req-2');
    const urn = GameURN.stringify('wingspan');

    controller.getStock(urn);

    const events = telemetry.forCorrelationId('req-2');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: 'inventory',
      type: 'inventory.checked',
      correlationId: 'req-2',
    });
  });
});
