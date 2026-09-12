import { Link } from 'react-router';
import { createWidgets } from '@evanion/react-widget';
import type {
  WidgetItemComponent,
  WidgetsWrapperComponent,
} from '@evanion/react-widget';
import type { CSSProperties, ReactNode } from 'react';
import type { Availability } from '../ui/baize.js';
import {
  AvailabilityPill,
  GameTitle,
  Identifier,
  Quiet,
  WeightMeter,
  ground,
  space,
  typeScale,
} from '../ui/baize.js';

/**
 * The ledger: the large region, one item per record.
 *
 * Where the nav and the rail hold five or six items, this one holds as many
 * records as the shop has -- every order in shop-api's sink, every title on the
 * shelf. That is the size distinction #5 is about, and it is why the chrome seam
 * matters: a region that grows past a few hundred items needs its wrapper
 * replaced with a windowed one, and nothing else about it changes.
 *
 * Both tables share this registry and swap `chrome.wrapper` per instance, because
 * the column template is the only thing that differs between them. The orders
 * view and the shelf view are the same region rendered twice, not two regions.
 */

/** Column template for a ledger instance, read by every row in it. */
export function ledgerColumns(template: string): CSSProperties {
  return { ['--ledger-columns' as string]: template };
}

function Cell({
  children,
  align = 'start',
  span,
}: {
  children?: ReactNode;
  align?: 'start' | 'end';
  /** Grid span, for a cell that covers the record columns rather than one of them. */
  span?: string;
}) {
  return (
    <span
      role="cell"
      style={{ justifySelf: align, minWidth: 0, gridColumn: span }}
    >
      {children}
    </span>
  );
}

/** Column headings. One item, so the heading row is configured like any other. */
function Head({ cells }: { cells: string[] }) {
  return (
    <>
      {cells.map((cell, index) => (
        <Cell key={cell} align={index === 0 ? 'start' : 'end'}>
          <span
            style={{
              color: ground.moss,
              fontSize: typeScale.micro,
              letterSpacing: '0.04em',
            }}
          >
            {cell}
          </span>
        </Cell>
      ))}
    </>
  );
}

/** One title on the shelf. The title links to its own page. */
function ShelfRow({
  urn,
  title,
  mechanism,
  players,
  playtime,
  weight,
  quantity,
  availability,
  href,
}: {
  urn: string;
  title: string;
  mechanism: string;
  players: string;
  playtime: string;
  weight: number;
  quantity: number;
  availability: Availability;
  href: string;
}) {
  return (
    <>
      <Cell>
        <Link to={href} className="row-link">
          <GameTitle title={title} mechanism={mechanism} size="lead" />
        </Link>
        <br />
        <Identifier>{urn}</Identifier>
      </Cell>
      <Cell align="end">
        <Quiet>{players}</Quiet>
      </Cell>
      <Cell align="end">
        <Quiet>{playtime}</Quiet>
      </Cell>
      <Cell align="end">
        <WeightMeter weight={weight} />
      </Cell>
      <Cell align="end">
        <AvailabilityPill state={availability} />
      </Cell>
      <Cell align="end">
        <span style={{ fontSize: typeScale.figure, fontWeight: 300 }}>
          {quantity}
        </span>
      </Cell>
    </>
  );
}

/** One order, as rebuilt from the event sink. */
function OrderRow({
  urn,
  correlationId,
  at,
  lines,
  units,
  outcome,
  reason,
  inventoryChecks,
}: {
  urn?: string;
  correlationId: string;
  at: string;
  lines: { urn: string; quantity: number }[];
  units: number;
  outcome: 'confirmed' | 'rejected' | 'in flight';
  reason?: string;
  inventoryChecks: number;
}) {
  return (
    <>
      <Cell>
        <Identifier>{urn ?? '—'}</Identifier>
        <br />
        <Quiet tone="moss">
          {lines.map((line) => line.urn.replace('urn:game:', '')).join(', ') ||
            'no lines recorded'}
        </Quiet>
      </Cell>
      <Cell align="end">
        <Quiet>{at.slice(11, 19)}</Quiet>
      </Cell>
      <Cell align="end">
        <Identifier>{correlationId}</Identifier>
      </Cell>
      <Cell align="end">
        <Quiet>{inventoryChecks}</Quiet>
      </Cell>
      <Cell align="end">
        <Quiet tone={outcome === 'confirmed' ? 'lichen' : 'moss'}>
          {reason ? `${outcome}: ${reason}` : outcome}
        </Quiet>
      </Cell>
      <Cell align="end">
        <span style={{ fontSize: typeScale.figure, fontWeight: 300 }}>
          {units}
        </span>
      </Cell>
    </>
  );
}

/** A closing total row. Nested items render inside it. */
function Total({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <>
      <Cell span="1 / -2">
        <Quiet>{label}</Quiet>
        {children}
      </Cell>
      <Cell align="end">
        <span style={{ fontSize: typeScale.figure }}>{value}</span>
      </Cell>
    </>
  );
}

/**
 * A row.
 *
 * `meta.emphasis` marks the heading and total rows, which are rows of the table
 * and not a separate structure -- so they are configured items like the records
 * between them, and how they are drawn is page data.
 */
const LedgerRow: WidgetItemComponent = ({ children, meta, ...attributes }) => {
  const emphasis = meta?.['emphasis'];
  return (
    <div
      {...attributes}
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: 'var(--ledger-columns)',
        alignItems: 'center',
        gap: space[4],
        padding: `${space[3]} 0`,
        borderTop: emphasis === 'head' ? 'none' : `1px solid ${ground.rule}`,
        borderBottom:
          emphasis === 'head' ? `1px solid ${ground.rule}` : undefined,
      }}
    >
      {children}
    </div>
  );
};

/**
 * The default bed. Each route replaces it with one carrying its own column
 * template, which is the per-instance `chrome` override doing the only job the
 * two tables need it for.
 */
const Rows: WidgetsWrapperComponent = ({ children }) => (
  <div role="table" style={ledgerColumns('1fr auto')}>
    {children}
  </div>
);

export const { Widgets: Ledger, defineItems: defineLedgerItems } =
  createWidgets({
    components: {
      head: Head,
      shelfRow: ShelfRow,
      orderRow: OrderRow,
      total: Total,
    },
    chrome: { wrapper: Rows, item: LedgerRow },
  });
