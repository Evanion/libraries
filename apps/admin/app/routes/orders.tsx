import type { ReactNode } from 'react';
import type { Route } from './+types/orders';
import { correlationContext } from '../page-context.js';
import { ordersFromTelemetry, orderTotals } from '../orders.js';
import { ShopApiUnavailable, listTelemetry } from '../shop-api.server.js';
import { Ledger, defineLedgerItems, ledgerColumns } from '../regions/ledger.js';
import { Panel, PanelTitle, Quiet, StatLine } from '../ui/baize.js';

export const meta: Route.MetaFunction = () => [{ title: 'Orders · Baize' }];

/**
 * The orders table's own column template, handed to the ledger region as a
 * per-instance `chrome.wrapper`.
 *
 * Declared at module scope, not inside the component: a wrapper re-created each
 * render is a new component identity, and React would unmount and remount every
 * row under it on every render.
 */
const OrdersTable = ({ children }: { children?: ReactNode }) => (
  <div
    role="table"
    aria-label="Orders"
    style={ledgerColumns('minmax(0, 1fr) auto auto auto auto auto')}
  >
    {children}
  </div>
);

export async function loader({ context }: Route.LoaderArgs) {
  const correlationId = context.get(correlationContext);

  let unavailable: string | undefined;
  const events = await listTelemetry(correlationId).catch((error: unknown) => {
    if (!(error instanceof ShopApiUnavailable)) throw error;
    unavailable = error.message;
    return [];
  });

  const orders = ordersFromTelemetry(events);
  const totals = orderTotals(orders);

  return {
    unavailable,
    figures: [
      { label: 'orders', value: String(totals.orders) },
      { label: 'units sold', value: String(totals.unitsSold) },
      { label: 'rejected', value: String(totals.rejected) },
      { label: 'inventory hops', value: String(totals.inventoryChecks) },
    ],
    items: defineLedgerItems([
      {
        id: 'head',
        type: 'head',
        props: {
          cells: ['order', 'placed', 'correlation', 'hops', 'outcome', 'units'],
        },
        meta: { emphasis: 'head' },
      },
      ...orders.map((order) => ({
        id: order.correlationId,
        type: 'orderRow' as const,
        props: {
          ...(order.urn !== undefined && { urn: order.urn }),
          correlationId: order.correlationId,
          at: order.at,
          lines: order.lines,
          units: order.units,
          outcome: order.outcome,
          ...(order.reason !== undefined && { reason: order.reason }),
          inventoryChecks: order.inventoryChecks,
        },
      })),
      {
        id: 'total',
        type: 'total',
        props: {
          label: `${orders.length} orders retained by the event sink`,
          value: String(totals.unitsSold),
        },
        meta: { emphasis: 'total' },
      },
    ]),
  };
}

export default function Orders({ loaderData }: Route.ComponentProps) {
  const { figures, items, unavailable } = loaderData;

  if (unavailable) {
    return (
      <Panel>
        <PanelTitle>No order history</PanelTitle>
        <p style={{ margin: 0 }}>
          <Quiet>
            Orders are rebuilt from shop-api&rsquo;s event sink, which is not
            answering. Start it and this page fills in.
          </Quiet>
        </p>
      </Panel>
    );
  }

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Orders</h1>
        <StatLine label="Order totals" figures={figures} scale="row" />
      </header>
      <p className="page-note">
        <Quiet>
          shop-api persists nothing, so this is its event sink read back. Each
          row is one correlation id, and &ldquo;hops&rdquo; counts the inventory
          lookups recorded under it on the far side of a real HTTP call.
        </Quiet>
      </p>
      <Ledger items={items} chrome={{ wrapper: OrdersTable }} />
    </>
  );
}
