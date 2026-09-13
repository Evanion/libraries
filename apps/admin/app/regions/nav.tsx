import { Text } from '@evanion/baize-ui';
import { NavLink } from 'react-router';
import { createWidgets } from '@evanion/react-widget';
import type { WidgetItemComponent } from '@evanion/react-widget';
import type { ReactNode } from 'react';

/**
 * The top navigation, as a widget region.
 *
 * A small region -- five items -- and configuration rather than markup: which
 * sections a shop shows in its chrome, and in what order, is the kind of thing
 * an operator changes without a deploy. Its items come from the shell route's
 * loader like every other region's.
 *
 * Its own registry and its own chrome, not the dashboard's. A nav bar's item
 * wrapper places things along one axis; a dashboard's places them on a grid.
 * Sharing one registry between the two would mean one chrome that does neither
 * well.
 */

/**
 * The shop's name.
 *
 * A class of this app's own rather than the library's `Title`: a wordmark is the
 * display family at a width and tracking no title size reaches, and the design
 * system has no wordmark because a wordmark is one shop's.
 */
function Wordmark({ shop }: { shop: string }) {
  return <span className="wordmark">{shop}</span>;
}

function Section({ label, to }: { label: string; to: string }) {
  return (
    <NavLink to={to} end className="nav-link">
      {label}
    </NavLink>
  );
}

/** The signed-in operator. Text, because there is nothing to act on here. */
function Operator({ name }: { name: string }) {
  return (
    <Text as="span" size="sm" tone="moss">
      {name}
    </Text>
  );
}

/**
 * The placement vocabulary of this region, and the whole of it.
 *
 * One key, because a single-axis bar has one placement question to answer.
 * `createWidgets` reads it off `BarSlot` below, so a nav item naming anything
 * else is a compile error.
 */
export interface NavMeta {
  align?: 'end';
}

/**
 * Places a nav item along the bar from its `meta`.
 *
 * `align: 'end'` is the whole of the placement vocabulary a single-axis region
 * needs, and it is page data rather than widget data -- `Section` has no opinion
 * about which end of the bar it sits at. An inline style rather than a class,
 * because the value comes from `meta` at render time.
 */
const BarSlot: WidgetItemComponent<NavMeta> = ({
  children,
  meta,
  ...attributes
}) => (
  <div
    {...attributes}
    className="nav-bar__slot"
    style={{
      marginInlineStart: meta?.align === 'end' ? 'auto' : undefined,
    }}
  >
    {children}
  </div>
);

const Bar = ({ children }: { children?: ReactNode }) => (
  <nav aria-label="Sections" className="nav-bar">
    {children}
  </nav>
);

export const { Widgets: Nav, defineItems: defineNavItems } = createWidgets({
  components: { wordmark: Wordmark, section: Section, operator: Operator },
  chrome: { wrapper: Bar, item: BarSlot },
});
