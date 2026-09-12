import type { TelemetryEvent } from './shop-api.server.js';

/** One line of an order: a game urn and how many copies. */
export interface OrderLine {
  urn: string;
  quantity: number;
}

/** An order as the back office can see it, rebuilt from shop-api's event sink. */
export interface OrderRecord {
  /** The order urn, or undefined for an order that never reached confirmation. */
  urn?: string;
  /**
   * The correlation id of the request that placed it, which is also the key the
   * whole trail -- order events and the inventory checks they triggered -- shares.
   */
  correlationId: string;
  at: string;
  lines: OrderLine[];
  units: number;
  outcome: 'confirmed' | 'rejected' | 'in flight';
  /** Why it was rejected: `insufficient_stock` or `unknown_game`. */
  reason?: string;
  /** How many inventory lookups shop-api recorded under the same id. */
  inventoryChecks: number;
}

/**
 * Rebuilds the order list from `GET /telemetry`.
 *
 * shop-api persists nothing -- `OrdersService` returns the order and forgets it --
 * so its event sink is the only record of one, and the back office reads orders
 * the same way an operator would read a log. That also means the list is bounded
 * by the sink's retention, and an order older than the last 500 events is gone
 * rather than paged.
 *
 * Grouping on correlation id is what makes the reconstruction possible at all:
 * the inventory checks are recorded by a different module, on the far side of a
 * real HTTP hop, and the id is the only thing tying them to the order.
 */
export function ordersFromTelemetry(events: TelemetryEvent[]): OrderRecord[] {
  const byCorrelationId = new Map<string, OrderRecord>();

  for (const event of events) {
    if (event.correlationId === undefined) continue;

    if (event.source === 'inventory' && event.type === 'inventory.checked') {
      const existing = byCorrelationId.get(event.correlationId);
      if (existing) existing.inventoryChecks += 1;
      continue;
    }

    if (event.source !== 'orders') continue;

    if (event.type === 'order.requested') {
      const lines = readLines(event.data);
      byCorrelationId.set(event.correlationId, {
        correlationId: event.correlationId,
        at: event.timestamp,
        lines,
        units: lines.reduce((total, line) => total + line.quantity, 0),
        outcome: 'in flight',
        inventoryChecks: 0,
      });
      continue;
    }

    const order = byCorrelationId.get(event.correlationId);
    if (!order) continue;

    if (event.type === 'order.confirmed') {
      order.outcome = 'confirmed';
      const urn = event.data?.['urn'];
      if (typeof urn === 'string') order.urn = urn;
    }

    if (event.type === 'order.rejected') {
      order.outcome = 'rejected';
      const reason = event.data?.['reason'];
      if (typeof reason === 'string') order.reason = reason;
    }
  }

  // Newest first: a back office reads the most recent order, and the sink hands
  // events over oldest first.
  return [...byCorrelationId.values()].reverse();
}

/**
 * Cart lines out of an `order.requested` payload.
 *
 * `data` is typed `Record<string, unknown>` at the API boundary and is not
 * checked there, so every field is narrowed here. A malformed line is dropped
 * rather than thrown on: one bad event must not take the whole order list with
 * it.
 */
function readLines(data: Record<string, unknown> | undefined): OrderLine[] {
  const items = data?.['items'];
  if (!Array.isArray(items)) return [];

  return items.flatMap((item): OrderLine[] => {
    if (item === null || typeof item !== 'object') return [];
    const { urn, quantity } = item as Record<string, unknown>;
    if (typeof urn !== 'string' || typeof quantity !== 'number') return [];
    return [{ urn, quantity }];
  });
}

/** Totals for the orders stat line. */
export interface OrderTotals {
  orders: number;
  unitsSold: number;
  rejected: number;
  inventoryChecks: number;
}

export function orderTotals(orders: OrderRecord[]): OrderTotals {
  const confirmed = orders.filter((order) => order.outcome === 'confirmed');
  return {
    orders: orders.length,
    unitsSold: confirmed.reduce((total, order) => total + order.units, 0),
    rejected: orders.filter((order) => order.outcome === 'rejected').length,
    inventoryChecks: orders.reduce(
      (total, order) => total + order.inventoryChecks,
      0,
    ),
  };
}
