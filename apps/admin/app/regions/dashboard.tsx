import {
  AvailabilityPill,
  Figure,
  MechanismTag,
  Panel,
  Stat,
  StatLine,
  Text,
  Title,
  ComplexityRamp,
} from '@evanion/baize-ui';
import { createWidgets } from '@evanion/react-widget';
import type { WidgetItemComponent } from '@evanion/react-widget';
import type { ReactNode } from 'react';
import {
  availabilityToken,
  formatComplexity,
  mechanismToken,
  complexityStop,
  type Availability,
} from '../ui/catalogue.js';

/**
 * The dashboard's widget set.
 *
 * Every component here takes its data as props. Nothing fetches: on stable
 * React Router a route component is not a Server Component, it ships to the
 * browser and runs there too, so the data has to arrive from the route's loader
 * and be handed down. A widget that awaited its own data would be a lie about
 * what this app proves -- that claim belongs to `apps/storefront-rsc`, where a
 * widget really is an async Server Component.
 *
 * What it does prove: `@evanion/react-widget` renders server-side in a
 * mainstream framework with no `'use client'` in the package, no context, and no
 * class error boundary. Failures are the route module's `ErrorBoundary` now.
 *
 * Every visual primitive below comes from `@evanion/baize-ui`. This file used to
 * carry the palette, the type scale and the primitives as inline styles, and the
 * storefront carried its own copy -- the same card at two radii, the same ramp
 * running in opposite directions.
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
  complexity: number;
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

/** A record and its columns, inside a panel. */
function Row({ children }: { children: ReactNode }) {
  return <div className="panel-row">{children}</div>;
}

/** Complexity on its ramp, with the number beside it in tabular figures. */
function Complexity({ complexity }: { complexity: number }) {
  return (
    <span className="complexity-cell">
      <ComplexityRamp
        label={`complexity ${formatComplexity(complexity)} of 5`}
        stop={complexityStop(complexity)}
      />
      <Text as="span" size="sm">
        {formatComplexity(complexity)}
      </Text>
    </span>
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
    <Panel heading="Shelf">
      <div className="stack">
        {counts.map(({ state, titles }) => (
          <div className="pair" key={state}>
            <AvailabilityPill
              availability={availabilityToken(state)}
              label={state}
            />
            <Figure size="md">{String(titles)}</Figure>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Stock per title: the stat line's columns, repeated down the page. */
function StockByGame({ rows }: { rows: StockRow[]; ctx?: DashboardCtx }) {
  return (
    <Panel heading="Stock by title">
      {rows.map((row) => (
        <Row key={row.urn}>
          <span className="stack">
            <Title as="h3" mechanism={mechanismToken(row.mechanism)} size="sm">
              {row.title}
            </Title>
            <span>
              <MechanismTag
                label={row.mechanism}
                mechanism={mechanismToken(row.mechanism)}
              />
            </span>
          </span>
          <Complexity complexity={row.complexity} />
          <span className="figure-cell">
            <Figure size="md">{String(row.quantity)}</Figure>
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
      <Panel heading="Orders">
        <Text size="sm">
          No orders yet. Place one through the storefront, or post a cart to
          shop-api, and it appears here.
        </Text>
      </Panel>
    );
  }

  return (
    <Panel heading="Orders">
      {orders.map((order) => (
        <Row key={order.correlationId}>
          <Text as="span" size="sm">
            {order.urn ?? order.correlationId}
          </Text>
          <Text as="span" size="sm" tone="moss">
            {order.inventoryChecks} checks
          </Text>
          <span className="figure-cell">
            <Figure size="md">{String(order.units)}</Figure>
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
    <Panel heading="This page view">
      <Text size="sm">{correlationId}</Text>
      {events.length === 0 ? (
        <Text size="sm" tone="moss">
          shop-api recorded nothing under this id. Reads are not instrumented;
          only inventory checks and orders are.
        </Text>
      ) : (
        events.map((event, index) => (
          <Row key={`${event.at}-${index}`}>
            <Text as="span" size="sm">
              {event.type}
            </Text>
            <Text as="span" size="sm" tone="moss">
              {event.source}
            </Text>
            <Text as="span" size="sm" tone="moss">
              {event.at.slice(11, 19)}
            </Text>
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
    <Panel heading="Buyer's note">
      <Text measured>{body}</Text>
      {children}
      <Text size="sm" tone="moss">
        {ctx ? `${ctx.shop}, ${ctx.asOf}` : 'no page context'}
      </Text>
    </Panel>
  );
}

/** A small figure group inside the note, to give nesting something to render. */
function Figures({ figures }: { figures: { label: string; value: string }[] }) {
  return (
    <StatLine label="Buying targets">
      {figures.map((figure) => (
        <Stat figure={figure.value} key={figure.label} label={figure.label} />
      ))}
    </StatLine>
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
 *
 * An inline style rather than a class: the lane is read off `meta` at render time,
 * and the bed in layout.css is where the lines it resolves against are declared.
 */
const GridCell: WidgetItemComponent = ({ children, meta, ...attributes }) => (
  <div {...attributes} style={{ gridColumn: laneOf(meta) }}>
    {children}
  </div>
);

const Grid = ({ children }: { children?: ReactNode }) => (
  <section aria-label="Dashboard" className="dashboard">
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
