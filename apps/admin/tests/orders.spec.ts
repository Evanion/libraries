import { describe, expect, it } from 'vitest';
import { orderTotals, ordersFromTelemetry } from '../app/orders.js';
import type { TelemetryEvent } from '../app/shop-api.server.js';

/**
 * shop-api keeps no orders, so the back office rebuilds them from its event
 * sink. These cases pin the reconstruction against the shapes that endpoint
 * really emits, including the ones a `Record<string, unknown>` payload lets
 * through.
 */

let nextId = 1;

function event(
  source: string,
  type: string,
  correlationId: string | undefined,
  data?: Record<string, unknown>,
): TelemetryEvent {
  return {
    id: nextId++,
    timestamp: '2026-09-12T09:41:07.000Z',
    ...(correlationId !== undefined && { correlationId }),
    source,
    type,
    ...(data !== undefined && { data }),
  };
}

const cart = { items: [{ urn: 'urn:game:azul', quantity: 2 }] };

describe('ordersFromTelemetry', () => {
  it('pairs an order with the inventory checks recorded under its id', () => {
    const orders = ordersFromTelemetry([
      event('orders', 'order.requested', 'req-1', cart),
      event('inventory', 'inventory.checked', 'req-1', { quantity: 25 }),
      event('orders', 'order.confirmed', 'req-1', { urn: 'urn:order:8f2c1a' }),
    ]);

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      urn: 'urn:order:8f2c1a',
      correlationId: 'req-1',
      units: 2,
      outcome: 'confirmed',
      inventoryChecks: 1,
    });
  });

  it('keeps two concurrent requests apart', () => {
    const orders = ordersFromTelemetry([
      event('orders', 'order.requested', 'req-1', cart),
      event('orders', 'order.requested', 'req-2', cart),
      event('inventory', 'inventory.checked', 'req-2'),
      event('orders', 'order.confirmed', 'req-1', { urn: 'urn:order:aaa' }),
    ]);

    expect(orders.map((order) => order.correlationId)).toEqual([
      'req-2',
      'req-1',
    ]);
    expect(
      orders.find((o) => o.correlationId === 'req-1')?.inventoryChecks,
    ).toBe(0);
    expect(orders.find((o) => o.correlationId === 'req-2')?.outcome).toBe(
      'in flight',
    );
  });

  it('records why an order was rejected', () => {
    const [order] = ordersFromTelemetry([
      event('orders', 'order.requested', 'req-1', cart),
      event('orders', 'order.rejected', 'req-1', {
        reason: 'insufficient_stock',
        urns: ['urn:game:brass-birmingham'],
      }),
    ]);

    expect(order?.outcome).toBe('rejected');
    expect(order?.reason).toBe('insufficient_stock');
  });

  it('drops a malformed cart line rather than the order', () => {
    const [order] = ordersFromTelemetry([
      event('orders', 'order.requested', 'req-1', {
        items: [
          { urn: 'urn:game:azul', quantity: 2 },
          { urn: 'urn:game:azul' },
          null,
          'nonsense',
        ],
      }),
    ]);

    expect(order?.lines).toEqual([{ urn: 'urn:game:azul', quantity: 2 }]);
    expect(order?.units).toBe(2);
  });

  it('ignores an event recorded outside a correlation context', () => {
    expect(
      ordersFromTelemetry([
        event('orders', 'order.requested', undefined, cart),
      ]),
    ).toEqual([]);
  });

  it('ignores a confirmation whose request fell out of the sink', () => {
    expect(
      ordersFromTelemetry([
        event('orders', 'order.confirmed', 'req-old', { urn: 'urn:order:old' }),
      ]),
    ).toEqual([]);
  });
});

describe('orderTotals', () => {
  it('counts units from confirmed orders only', () => {
    const orders = ordersFromTelemetry([
      event('orders', 'order.requested', 'req-1', cart),
      event('orders', 'order.confirmed', 'req-1', { urn: 'urn:order:a' }),
      event('orders', 'order.requested', 'req-2', cart),
      event('orders', 'order.rejected', 'req-2', { reason: 'unknown_game' }),
    ]);

    expect(orderTotals(orders)).toEqual({
      orders: 2,
      unitsSold: 2,
      rejected: 1,
      inventoryChecks: 0,
    });
  });
});
