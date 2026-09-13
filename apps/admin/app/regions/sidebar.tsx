import { AvailabilityPill, Button, Figure, Text } from '@evanion/baize-ui';
import { NavLink } from 'react-router';
import { createWidgets } from '@evanion/react-widget';
import type { WidgetItemComponent } from '@evanion/react-widget';
import type { ReactNode } from 'react';
import { useRestock } from '../providers.js';
import { availabilityToken, type Availability } from '../ui/catalogue.js';

/**
 * The sidebar, as a widget region.
 *
 * The second small region, and the one that shows a region's chrome is a
 * property of the region rather than of the library: a vertical rail stacks its
 * items and rules between groups, where the nav bar lays them along one axis and
 * the dashboard places them on a grid. Three registries, three chromes, one
 * renderer.
 */

/**
 * A rail heading.
 *
 * The library's panel heading class, because that is what the design calls this
 * treatment -- a small tracked label over a block -- and the rail's blocks are
 * panels without a border.
 */
function Heading({ label }: { label: string }) {
  return <h2 className="baize-panel__heading">{label}</h2>;
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
 * column of rows, and a 200px rail has no room for a row. Same tabular figures
 * through the same `Figure`, different axis.
 */
function FigureList({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="stack">
      {rows.map((row) => (
        <div className="pair" key={row.label}>
          <dt>
            <Text as="span" size="sm" tone="moss">
              {row.label}
            </Text>
          </dt>
          <Figure as="dd" size="base">
            {row.value}
          </Figure>
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
    <div className="stack">
      {counts.map(({ state, titles }) => (
        <div className="pair" key={state}>
          <AvailabilityPill
            availability={availabilityToken(state)}
            label={state}
          />
          <Figure size="base">{String(titles)}</Figure>
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
 *
 * `@evanion/baize-ui` is on the other side of the same line. Its `Button` renders
 * the handler this widget hands it and owns nothing, which is how a stateless
 * library serves a stateful widget.
 */
function Basket() {
  const restock = useRestock();
  const lines = Object.entries(restock.lines);

  return (
    <div className="stack">
      {lines.length === 0 ? (
        <Text size="sm" tone="moss">
          Nothing to reorder. Add copies from a title page.
        </Text>
      ) : (
        <>
          {lines.map(([urn, quantity]) => (
            <div className="pair" key={urn}>
              <Text as="span" size="sm">
                {urn.replace('urn:game:', '')}
              </Text>
              <Figure size="base">{String(quantity)}</Figure>
            </div>
          ))}
          <Button onClick={restock.clear} variant="quiet">
            Clear {restock.units} copies
          </Button>
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
  <div {...attributes} className="stack">
    {meta?.['group'] === 'start' ? <hr className="hairline" /> : null}
    {children}
  </div>
);

const Rail = ({ children }: { children?: ReactNode }) => (
  <aside aria-label="Shop summary" className="stack stack--wide">
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
