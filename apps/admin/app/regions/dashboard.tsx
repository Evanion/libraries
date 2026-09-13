import { createWidgets } from '@evanion/react-widget';
import type { WidgetItemComponent } from '@evanion/react-widget';
import type { ReactNode } from 'react';
import type { Availability } from '../ui/baize.js';
import {
  AvailabilityPill,
  GameTitle,
  Identifier,
  MechanismTag,
  Panel,
  PanelTitle,
  Quiet,
  StatLine,
  WeightMeter,
  ground,
  space,
  typeScale,
} from '../ui/baize.js';

/**
 * The dashboard's widget set.
 *
 * Every component here takes its data as props. Nothing fetches: on stable
 * React Router a route component is not a Server Component, it ships to the
 * browser and runs there too, so the data has to arrive from the route's loader
 * and be handed down. A widget that awaited its own data would be a lie about
 * what this app proves -- that claim belongs to `apps/rsc-example`, where a
 * widget really is an async Server Component.
 *
 * What it does prove: `@evanion/react-widget` renders server-side in a
 * mainstream framework with no `'use client'` in the package, no context, and no
 * class error boundary. Failures are the route module's `ErrorBoundary` now.
 */

/** Page-level data handed to every widget as `ctx`, not repeated in each item. */
export interface DashboardCtx {
  shop: string;
  asOf: string;
}

/** One row of the stock widget, flattened to what the widget draws. */
export interface StockRow {
  urn: string;
  title: string;
  mechanism: string;
  quantity: number;
  weight: number;
  availability: Availability;
}

/** One row of the order widget. */
export interface OrderRow {
  urn?: string;
  correlationId: string;
  units: number;
  outcome: 'confirmed' | 'rejected' | 'in flight';
  inventoryChecks: number;
}

/** One row of the trail widget. */
export interface TrailRow {
  at: string;
  source: string;
  type: string;
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        alignItems: 'center',
        gap: space[4],
        padding: `${space[2]} 0`,
        borderTop: `1px solid ${ground.rule}`,
      }}
    >
      {children}
    </div>
  );
}

/** How many titles sit in each availability state, as the shop's own wording. */
function ShelfPulse({
  counts,
}: {
  counts: { state: Availability; titles: number }[];
  ctx?: DashboardCtx;
}) {
  return (
    <Panel style={{ height: '100%' }}>
      <PanelTitle>Shelf</PanelTitle>
      <div style={{ display: 'grid', gap: space[2] }}>
        {counts.map(({ state, titles }) => (
          <div
            key={state}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: space[3],
            }}
          >
            <AvailabilityPill state={state} />
            <span style={{ fontSize: typeScale.figure, fontWeight: 300 }}>
              {titles}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Stock per title: the stat line's columns, repeated down the page. */
function StockByGame({ rows }: { rows: StockRow[]; ctx?: DashboardCtx }) {
  return (
    <Panel style={{ height: '100%' }}>
      <PanelTitle>Stock by title</PanelTitle>
      {rows.map((row) => (
        <Row key={row.urn}>
          <span style={{ display: 'grid', gap: space[1] }}>
            <GameTitle
              title={row.title}
              mechanism={row.mechanism}
              size="lead"
            />
            <span>
              <MechanismTag mechanism={row.mechanism} />
            </span>
          </span>
          <WeightMeter weight={row.weight} />
          <span
            style={{
              fontSize: typeScale.figure,
              fontWeight: 300,
              minWidth: '3ch',
              textAlign: 'right',
            }}
          >
            {row.quantity}
          </span>
        </Row>
      ))}
    </Panel>
  );
}

/** The most recent orders, rebuilt from shop-api's event sink. */
function OrderFeed({ orders }: { orders: OrderRow[]; ctx?: DashboardCtx }) {
  if (orders.length === 0) {
    return (
      <Panel style={{ height: '100%' }}>
        <PanelTitle>Orders</PanelTitle>
        <Quiet>
          No orders yet. Place one through the storefront, or post a cart to
          shop-api, and it appears here.
        </Quiet>
      </Panel>
    );
  }

  return (
    <Panel style={{ height: '100%' }}>
      <PanelTitle>Orders</PanelTitle>
      {orders.map((order) => (
        <Row key={order.correlationId}>
          <Identifier>{order.urn ?? order.correlationId}</Identifier>
          <Quiet tone="moss">{order.inventoryChecks} checks</Quiet>
          <span style={{ fontSize: typeScale.figure, fontWeight: 300 }}>
            {order.units}
          </span>
        </Row>
      ))}
    </Panel>
  );
}

/** What shop-api recorded under this page view's correlation id. */
function CorrelationTrail({
  events,
  correlationId,
}: {
  events: TrailRow[];
  correlationId: string;
  ctx?: DashboardCtx;
}) {
  return (
    <Panel style={{ height: '100%' }}>
      <PanelTitle>This page view</PanelTitle>
      <p style={{ margin: `0 0 ${space[3]}` }}>
        <Identifier>{correlationId}</Identifier>
      </p>
      {events.length === 0 ? (
        <Quiet>
          shop-api recorded nothing under this id. Reads are not instrumented;
          only inventory checks and orders are.
        </Quiet>
      ) : (
        events.map((event, index) => (
          <Row key={`${event.at}-${index}`}>
            <Quiet>{event.type}</Quiet>
            <Quiet tone="moss">{event.source}</Quiet>
            <Quiet tone="moss">{event.at.slice(11, 19)}</Quiet>
          </Row>
        ))
      )}
    </Panel>
  );
}

/**
 * A free-text note, and the one widget that accepts children -- so the set
 * exercises nesting, and `WidgetChildren` has something to type.
 */
function Memo({
  body,
  children,
  ctx,
}: {
  body: string;
  children?: ReactNode;
  ctx?: DashboardCtx;
}) {
  return (
    <Panel style={{ height: '100%' }}>
      <PanelTitle>Buyer's note</PanelTitle>
      <p style={{ margin: 0, maxWidth: '62ch' }}>{body}</p>
      {children}
      <p style={{ margin: `${space[3]} 0 0` }}>
        <Quiet tone="moss">
          {ctx ? `${ctx.shop}, ${ctx.asOf}` : 'no page context'}
        </Quiet>
      </p>
    </Panel>
  );
}

/** A small figure group inside the note, to give nesting something to render. */
function Figures({ figures }: { figures: { label: string; value: string }[] }) {
  return (
    <div style={{ marginTop: space[4] }}>
      <StatLine scale="row" label="Buying targets" figures={figures} />
    </div>
  );
}

/**
 * The lanes a dashboard item can sit in.
 *
 * Placement is a closed set of names rather than a start line and a width. A
 * start line and a width let two items tile the same bed and still disagree
 * about where the seam between them falls -- each row is individually valid and
 * the panels do not line up down the page. A lane resolves to grid lines the
 * bed declares once, so every item on the page shares one seam and a
 * misalignment has nowhere to come from.
 */
const lanes = ['main', 'aside', 'full'] as const;

type Lane = (typeof lanes)[number];

function laneOf(meta: Record<string, unknown> | undefined): Lane {
  const lane = meta?.['lane'];
  return lanes.includes(lane as Lane) ? (lane as Lane) : 'full';
}

/**
 * Places each widget on the dashboard grid from its `meta`.
 *
 * This is what `meta` is for: the lane is a fact about the page, not about the
 * widget, so it travels beside the props rather than in them. The renderer
 * hands `meta` to this component and spreads only `props` into the widget
 * itself, which is why `StockByGame` never sees a `lane` prop it would have to
 * accept and ignore.
 *
 * An item whose `meta` names no lane, or names one the bed does not declare,
 * takes the full width. A dashboard assembled from a CMS payload will have
 * items that were never placed, and a widget that vanishes is worse than one
 * that is too wide.
 */
const GridCell: WidgetItemComponent = ({ children, meta, ...attributes }) => (
  <div {...attributes} style={{ gridColumn: laneOf(meta) }}>
    {children}
  </div>
);

/**
 * The bed the cells are placed on, and the only place the seam is written.
 *
 * The lane names come from the `-start`/`-end` line names below: a pair of
 * lines named `main-start` and `main-end` is what makes `grid-column: main`
 * resolve. `minmax(0, ...)` rather than a bare `fr` so a panel holding a long
 * identifier cannot push its lane wider than its share.
 */
const Grid = ({ children }: { children?: ReactNode }) => (
  <section
    aria-label="Dashboard"
    style={{
      display: 'grid',
      gridTemplateColumns:
        '[full-start main-start] minmax(0, 7fr) [main-end aside-start] minmax(0, 5fr) [aside-end full-end]',
      gap: space[4],
      alignItems: 'start',
    }}
  >
    {children}
  </section>
);

export const { Widgets: Dashboard, defineItems: defineDashboardItems } =
  createWidgets({
    components: {
      shelf: ShelfPulse,
      stock: StockByGame,
      orders: OrderFeed,
      trail: CorrelationTrail,
      memo: Memo,
      figures: Figures,
    },
    chrome: { wrapper: Grid, item: GridCell },
  });
