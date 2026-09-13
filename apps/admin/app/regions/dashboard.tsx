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
import type {
  RenderableWidgetItem,
  WidgetItemComponent,
  WidgetsWrapperComponent,
} from '@evanion/react-widget';
import { Children } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  availabilityToken,
  complexityTierName,
  formatComplexity,
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

/** Complexity on its ramp: the tier word, the number, and the five pips. */
function Complexity({ complexity }: { complexity: number }) {
  return (
    <span className="complexity-cell">
      <Text as="span" size="sm" tone="chalk">
        {complexityTierName(complexity)}
      </Text>
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
            <Title
              as="h3"
              complexity={complexityStop(row.complexity)}
              size="sm"
            >
              {row.title}
            </Title>
            <span>
              <MechanismTag label={row.mechanism} />
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

/**
 * The placement vocabulary of this region, and the whole of it.
 *
 * `createWidgets` reads this off `GridCell` below, so a dashboard item naming
 * anything else -- `lanes`, `column`, a misspelt `lane` -- is a compile error
 * rather than a panel that quietly takes the full width.
 */
export interface DashboardMeta {
  lane?: Lane;
}

function laneOf(meta: DashboardMeta | undefined): Lane {
  const lane = meta?.lane;
  // Still checked at runtime: items assembled from a CMS payload never met the
  // type checker, and `meta` is the field they are most likely to get wrong.
  return lane !== undefined && lanes.includes(lane) ? lane : 'full';
}

/**
 * Wraps one widget. It places nothing: where a panel sits is a fact about the
 * band it is in and about its neighbours, which only the bed can see.
 *
 * The annotation is still what types the whole set's `meta` -- `createWidgets`
 * reads `M` off `chrome.item` -- so a dashboard item naming anything but a lane
 * is a compile error whether or not this component reads the field.
 */
const GridCell: WidgetItemComponent<DashboardMeta> = ({
  children,
  meta: _meta,
  ...attributes
}) => (
  <div {...attributes} className="dashboard__cell">
    {children}
  </div>
);

/** A stretch of the bed: one full-width panel, or a main and aside column. */
type Band =
  | { lane: 'full'; node: ReactNode }
  | { lane: 'split'; main: ReactNode[]; aside: ReactNode[] };

/**
 * Groups the region's items into bands, preserving the order they were written
 * in.
 *
 * Consecutive `main` and `aside` items collect into one band, and a `full` item
 * closes the band it meets and stands alone. So a short aside panel and a tall
 * main panel do not have to be the same height, and the order an editor wrote
 * the items in still decides what follows what.
 */
function bandsOf(items: readonly RenderableWidgetItem[], nodes: ReactNode[]) {
  const bands: Band[] = [];

  items.forEach((item, index) => {
    const node = nodes[index];
    const lane = laneOf(item.meta as DashboardMeta | undefined);

    if (lane === 'full') {
      bands.push({ lane: 'full', node });
      return;
    }

    const open = bands.at(-1);
    if (open?.lane === 'split') open[lane].push(node);
    else
      bands.push({
        lane: 'split',
        main: lane === 'main' ? [node] : [],
        aside: lane === 'aside' ? [node] : [],
      });
  });

  return bands;
}

/**
 * The dashboard bed.
 *
 * It reads the region's items rather than only its children, which is the whole
 * reason the lane can be resolved here. Placing each panel individually made
 * every row of the grid as tall as its tallest panel: a five-line shelf summary
 * beside the stock table left most of a screen of nothing under it, and the
 * trail below it started where the stock table ended. Columns of their own let
 * each side run at its own height.
 *
 * `items` is positionally aligned with `children` -- the renderer drops a
 * skipped item from both -- so `nodes[index]` is the panel `items[index]`
 * produced.
 *
 * An inline style rather than a class: the lane names come from the bed's own
 * `-start` and `-end` line names in layout.css, and this is what resolves
 * against them.
 */
const Grid: WidgetsWrapperComponent = ({ children, items = [] }) => {
  const nodes = Children.toArray(children);

  return (
    <section aria-label="Dashboard" className="dashboard">
      {bandsOf(items, nodes).map((band, index) =>
        band.lane === 'full' ? (
          <div
            key={index}
            className="dashboard__cell"
            style={laneStyle('full')}
          >
            {band.node}
          </div>
        ) : (
          [
            band.main.length ? (
              <div
                className="dashboard__lane"
                key={`${index}-main`}
                style={laneStyle('main')}
              >
                {band.main}
              </div>
            ) : null,
            band.aside.length ? (
              <div
                className="dashboard__lane"
                key={`${index}-aside`}
                style={laneStyle('aside')}
              >
                {band.aside}
              </div>
            ) : null,
          ]
        ),
      )}
    </section>
  );
};

function laneStyle(lane: Lane): CSSProperties {
  return { gridColumn: lane };
}

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
