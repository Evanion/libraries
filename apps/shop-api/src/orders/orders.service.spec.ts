import type { CorrelationService } from '@evanion/nestjs-correlation-id';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import type { InventoryClient } from './inventory-client.service.js';
import { OrdersService } from './orders.service.js';

type Stock = { urn: string; quantity: number; correlationId?: string };

const inventoryClientStub = (
  byUrn: Record<string, Stock | Error>,
): InventoryClient =>
  ({
    getStock: async (urn: string) => {
      const result = byUrn[urn];
      if (result === undefined) throw new NotFoundException(urn);
      if (result instanceof Error) throw result;
      return result;
    },
  }) as InventoryClient;

const correlationServiceStub = (id: string | undefined): CorrelationService =>
  ({ getCorrelationId: () => id }) as CorrelationService;

const buildService = (
  byUrn: Record<string, Stock | Error>,
  correlationId: string | undefined = 'outer-id',
) => {
  const telemetry = new TelemetryService(correlationServiceStub(correlationId));
  const service = new OrdersService(
    inventoryClientStub(byUrn),
    telemetry,
    correlationServiceStub(correlationId),
  );
  return { service, telemetry };
};

describe('OrdersService', () => {
  it('rejects an empty cart', async () => {
    const { service } = buildService({});

    await expect(service.createOrder({ items: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('confirms an order urn when every item has enough stock', async () => {
    const { service } = buildService({
      'urn:game:wingspan': { urn: 'urn:game:wingspan', quantity: 5, correlationId: 'outer-id' },
    });

    const result = await service.createOrder({
      items: [{ urn: 'urn:game:wingspan', quantity: 2 }],
    });

    expect(result.urn).toMatch(/^urn:order:[0-9a-f]+$/);
  });

  it('carries the outer request correlation id on the result', async () => {
    const { service } = buildService(
      {
        'urn:game:wingspan': { urn: 'urn:game:wingspan', quantity: 5, correlationId: 'outer-id' },
      },
      'outer-id',
    );

    const result = await service.createOrder({
      items: [{ urn: 'urn:game:wingspan', quantity: 1 }],
    });

    expect(result.correlationId).toBe('outer-id');
  });

  it('carries the correlation id the inventory hop reported back', async () => {
    const { service } = buildService(
      {
        'urn:game:wingspan': { urn: 'urn:game:wingspan', quantity: 5, correlationId: 'outer-id' },
      },
      'outer-id',
    );

    const result = await service.createOrder({
      items: [{ urn: 'urn:game:wingspan', quantity: 1 }],
    });

    expect(result.inventoryCorrelationIds).toEqual(['outer-id']);
  });

  it('rejects a cart item that exceeds stock', async () => {
    const { service } = buildService({
      'urn:game:wingspan': { urn: 'urn:game:wingspan', quantity: 1 },
    });

    await expect(
      service.createOrder({ items: [{ urn: 'urn:game:wingspan', quantity: 5 }] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a cart item for a game with no inventory record, as a bad request', async () => {
    const { service } = buildService({});

    await expect(
      service.createOrder({ items: [{ urn: 'urn:game:unknown', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records order.requested then order.confirmed telemetry, in order', async () => {
    const { service, telemetry } = buildService({
      'urn:game:wingspan': { urn: 'urn:game:wingspan', quantity: 5 },
    });

    await service.createOrder({ items: [{ urn: 'urn:game:wingspan', quantity: 1 }] });

    expect(telemetry.list().map((e) => e.type)).toEqual([
      'order.requested',
      'order.confirmed',
    ]);
  });

  it('records order.rejected telemetry when stock is insufficient', async () => {
    const { service, telemetry } = buildService({
      'urn:game:wingspan': { urn: 'urn:game:wingspan', quantity: 1 },
    });

    await expect(
      service.createOrder({ items: [{ urn: 'urn:game:wingspan', quantity: 5 }] }),
    ).rejects.toThrow();

    expect(telemetry.list().map((e) => e.type)).toEqual([
      'order.requested',
      'order.rejected',
    ]);
  });
});
