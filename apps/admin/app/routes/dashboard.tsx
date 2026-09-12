import type { Route } from './+types/dashboard';
import { correlationContext, shelfContext } from '../page-context.js';
import { ordersFromTelemetry, orderTotals } from '../orders.js';
import { availabilityCounts, shelfTotals } from '../shelf.js';
import { ShopApiUnavailable, listTelemetry } from '../shop-api.server.js';
import { Dashboard, defineDashboardItems } from '../regions/dashboard.js';
import { Panel, PanelTitle, Quiet, StatLine } from '../ui/baize.js';

export const meta: Route.MetaFunction = () => [{ title: 'Today · Baize' }];

/**
 * Stock and orders are live numbers a merchant acts on, so a cached document is
 * worse than a slow one.
 */
export const headers: Route.HeadersFunction = () => ({
  'Cache-Control': 'no-store',
});

export async function loader({ context }: Route.LoaderArgs) {
  const correlationId = context.get(correlationContext);
  const shelf = await context.get(shelfContext)();

  // Two reads of the same sink: every order, and only what this page view
  // produced. Filtering server-side keeps the trail to the handful of events
  // that share this id instead of shipping 500 and narrowing in the browser.
  const [events, trail] = await Promise.all([
    listTelemetry(correlationId).catch(emptyOnUnavailable),
    listTelemetry(correlationId, correlationId).catch(emptyOnUnavailable),
  ]);

  const orders = ordersFromTelemetry(events);
  const totals = orderTotals(orders);
  const shelfSums = shelfTotals(shelf.rows);

  return {
    figures: [
      { label: 'orders', value: String(totals.orders) },
      { label: 'units sold', value: String(totals.unitsSold) },
      { label: 'units on hand', value: String(shelfSums.unitsOnHand) },
      { label: 'mean weight', value: shelfSums.meanWeight.toFixed(1) },
      {
        label: 'empty shelves',
        value: `${shelfSums.emptyShelves} of ${shelfSums.titles}`,
      },
    ],
    items: defineDashboardItems([
      {
        id: 'stock',
        type: 'stock',
        props: {
          rows: shelf.rows.map((row) => ({
            urn: row.urn,
            title: row.title,
            mechanism: row.mechanisms[0] ?? 'uncategorised',
            quantity: row.quantity,
            weight: row.weight,
            availability: row.availability,
          })),
        },
        meta: { column: 1, columnSpan: 7 },
      },
      {
        id: 'shelf',
        type: 'shelf',
        props: { counts: availabilityCounts(shelf.rows) },
        meta: { column: 8, columnSpan: 5 },
      },
      {
        id: 'orders',
        type: 'orders',
        props: {
          orders: orders.slice(0, 6).map((order) => ({
            ...(order.urn !== undefined && { urn: order.urn }),
            correlationId: order.correlationId,
            units: order.units,
            outcome: order.outcome,
            inventoryChecks: order.inventoryChecks,
          })),
        },
        meta: { column: 1, columnSpan: 5 },
      },
      {
        id: 'trail',
        type: 'trail',
        props: {
          correlationId,
          events: trail.map((event) => ({
            at: event.timestamp,
            source: event.source,
            type: event.type,
          })),
        },
        meta: { column: 6, columnSpan: 7 },
      },
      {
        // No meta, deliberately: an unplaced item spans the grid. A dashboard
        // assembled from a configuration will have items nobody positioned, and
        // the fallback is what keeps them visible.
        id: 'memo',
        type: 'memo',
        props: {
          body:
            'Brass: Birmingham is on a reprint and the distributor will not quote ' +
            'a date. Gloomhaven stays listed as out of print until the second ' +
            'edition ships. Azul carries the floor — keep twenty on the shelf.',
        },
        children: [
          {
            id: 'memo-targets',
            type: 'figures',
            props: {
              figures: [
                { label: 'floor, Azul', value: '20' },
                { label: 'reorder at', value: '6' },
                { label: 'open rejects', value: String(totals.rejected) },
              ],
            },
          },
        ],
      },
    ]),
    unavailable: shelf.unavailable,
    asOf: new Date().toISOString().slice(0, 16).replace('T', ' '),
    shop: 'Baize',
  };
}

/** An unreachable API leaves the page standing with nothing in it to read. */
function emptyOnUnavailable(error: unknown): never[] {
  if (error instanceof ShopApiUnavailable) return [];
  throw error;
}

export default function Today({ loaderData }: Route.ComponentProps) {
  const { figures, items, unavailable, asOf, shop } = loaderData;

  if (unavailable) {
    return (
      <Panel>
        <PanelTitle>Nothing to show yet</PanelTitle>
        <p style={{ margin: 0 }}>
          <Quiet>
            The dashboard reads the catalogue, stock and the event sink from
            shop-api. Start it and this page fills in.
          </Quiet>
        </p>
      </Panel>
    );
  }

  return (
    <>
      <header className="page-head">
        <StatLine label="Today at Baize" figures={figures} />
      </header>
      <Dashboard items={items} ctx={{ shop, asOf }} />
    </>
  );
}
