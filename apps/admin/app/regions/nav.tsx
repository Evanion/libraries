import { NavLink } from 'react-router';
import { createWidgets } from '@evanion/react-widget';
import type { WidgetItemComponent } from '@evanion/react-widget';
import type { ReactNode } from 'react';
import { Quiet, fonts, ground, space, typeScale } from '../ui/baize.js';

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

function Wordmark({ shop }: { shop: string }) {
  return (
    <span
      style={{
        fontFamily: fonts.display,
        fontSize: typeScale.lead,
        fontWeight: 700,
        fontStretch: '80%',
        letterSpacing: '0.02em',
      }}
    >
      {shop}
    </span>
  );
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
  return <Quiet tone="moss">{name}</Quiet>;
}

/**
 * Places a nav item along the bar from its `meta`.
 *
 * `align: 'end'` is the whole of the placement vocabulary a single-axis region
 * needs, and it is page data rather than widget data -- `Section` has no opinion
 * about which end of the bar it sits at.
 */
const BarSlot: WidgetItemComponent = ({ children, meta, ...attributes }) => (
  <div
    {...attributes}
    style={{
      display: 'flex',
      alignItems: 'center',
      marginInlineStart: meta?.['align'] === 'end' ? 'auto' : undefined,
    }}
  >
    {children}
  </div>
);

const Bar = ({ children }: { children?: ReactNode }) => (
  <nav
    aria-label="Sections"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: space[5],
      padding: `${space[3]} 0`,
      borderBottom: `1px solid ${ground.rule}`,
    }}
  >
    {children}
  </nav>
);

export const { Widgets: Nav, defineItems: defineNavItems } = createWidgets({
  components: { wordmark: Wordmark, section: Section, operator: Operator },
  chrome: { wrapper: Bar, item: BarSlot },
});
