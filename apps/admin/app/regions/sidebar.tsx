import { NavLink } from 'react-router';
import { createWidgets } from '@evanion/react-widget';
import type { WidgetItemComponent } from '@evanion/react-widget';
import type { ReactNode } from 'react';
import { useRestock } from '../providers.js';
import {
  Action,
  AvailabilityPill,
  Hairline,
  Quiet,
  ground,
  space,
  typeScale,
} from '../ui/baize.js';
import type { Availability } from '../ui/baize.js';

/**
 * The sidebar, as a widget region.
 *
 * The second small region, and the one that shows a region's chrome is a
 * property of the region rather than of the library: a vertical rail stacks its
 * items and rules between groups, where the nav bar lays them along one axis and
 * the dashboard places them on a grid. Three registries, three chromes, one
 * renderer.
 */

function Heading({ label }: { label: string }) {
  return (
    <h2
      style={{
        margin: 0,
        fontSize: typeScale.micro,
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: ground.moss,
      }}
    >
      {label}
    </h2>
  );
}

function Link({ label, to }: { label: string; to: string }) {
  return (
    <NavLink to={to} end className="rail-link">
      {label}
    </NavLink>
  );
}

/**
 * A vertical figure list.
 *
 * Not `StatLine`: that primitive sets figures across a row so they align down a
 * column of rows, and a 180px rail has no room for a row. Same tabular figures,
 * different axis.
 */
function FigureList({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl style={{ margin: 0, display: 'grid', gap: space[2] }}>
      {rows.map((row) => (
        <div
          key={row.label}
          style={{ display: 'flex', justifyContent: 'space-between' }}
        >
          <dt>
            <Quiet tone="moss">{row.label}</Quiet>
          </dt>
          <dd style={{ margin: 0, fontSize: typeScale.body }}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Availability states with a title count, as pills down the rail. */
function ShelfStates({
  counts,
}: {
  counts: { state: Availability; titles: number }[];
}) {
  return (
    <div style={{ display: 'grid', gap: space[2] }}>
      {counts.map(({ state, titles }) => (
        <div
          key={state}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: space[2],
          }}
        >
          <AvailabilityPill state={state} />
          <span>{titles}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The restock basket, the one widget in any region that holds client state.
 *
 * It reads the cart through `useRestock`, which is app context. That is the app's
 * own client component used as a widget component -- the library neither knows
 * nor needs to: `createWidgets` takes any component, and nothing about a
 * stateful one reaches back into the package. Keeping the state here is also why
 * the rail's own markup stays free of it.
 */
function Basket() {
  const restock = useRestock();
  const lines = Object.entries(restock.lines);

  return (
    <div style={{ display: 'grid', gap: space[2] }}>
      {lines.length === 0 ? (
        <Quiet tone="moss">
          Nothing to reorder. Add copies from a title page.
        </Quiet>
      ) : (
        <>
          {lines.map(([urn, quantity]) => (
            <div
              key={urn}
              style={{ display: 'flex', justifyContent: 'space-between' }}
            >
              <Quiet>{urn.replace('urn:game:', '')}</Quiet>
              <span>{quantity}</span>
            </div>
          ))}
          <Action onClick={restock.clear}>Clear {restock.units} copies</Action>
        </>
      )}
    </div>
  );
}

/**
 * Stacks a rail item, and rules above it when `meta.group` says a new group
 * starts here.
 *
 * The rule belongs to the sequence, not to the widget: whether `ShelfStates`
 * needs a line above it depends on what was configured before it, which is
 * exactly the kind of fact `meta` carries.
 */
const RailSlot: WidgetItemComponent = ({ children, meta, ...attributes }) => (
  <div {...attributes} style={{ display: 'grid', gap: space[3] }}>
    {meta?.['group'] === 'start' ? <Hairline /> : null}
    {children}
  </div>
);

const Rail = ({ children }: { children?: ReactNode }) => (
  <aside
    aria-label="Shop summary"
    style={{ display: 'grid', gap: space[4], alignContent: 'start' }}
  >
    {children}
  </aside>
);

export const { Widgets: Sidebar, defineItems: defineSidebarItems } =
  createWidgets({
    components: {
      heading: Heading,
      link: Link,
      figures: FigureList,
      states: ShelfStates,
      basket: Basket,
    },
    chrome: { wrapper: Rail, item: RailSlot },
  });
