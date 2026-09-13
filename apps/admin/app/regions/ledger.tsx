import {
  AvailabilityPill,
  Figure,
  Text,
  Title,
  ComplexityRamp,
} from '@evanion/baize-ui';
import { Link } from 'react-router';
import { createWidgets } from '@evanion/react-widget';
import type {
  WidgetItemComponent,
  WidgetsWrapperComponent,
} from '@evanion/react-widget';
import type { CSSProperties, ReactNode } from 'react';
import {
  availabilityToken,
  formatComplexity,
  mechanismToken,
  complexityStop,
  type Availability,
} from '../ui/catalogue.js';

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

/**
 * Column template for a ledger instance, read by every row in it.
 *
 * A custom property set on the table and read by `.ledger-row`, because the
 * template is the one thing that differs per instance and a row has no way to
 * learn it otherwise.
 */
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
      className={
        align === 'end' ? 'ledger-cell ledger-cell--end' : 'ledger-cell'
      }
      role="cell"
      style={span ? { gridColumn: span } : undefined}
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
        <Cell align={index === 0 ? 'start' : 'end'} key={cell}>
          <Text as="span" size="xs" tone="moss">
            {cell}
          </Text>
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
  complexity,
  quantity,
  availability,
  href,
}: {
  urn: string;
  title: string;
  mechanism: string;
  players: string;
  playtime: string;
  complexity: number;
  quantity: number;
  availability: Availability;
  href: string;
}) {
  return (
    <>
      <Cell>
        <Link to={href} className="row-link">
          <Title as="span" mechanism={mechanismToken(mechanism)} size="sm">
            {title}
          </Title>
        </Link>
        <Text size="sm" tone="moss">
          {urn}
        </Text>
      </Cell>
      <Cell align="end">
        <Text as="span" size="sm">
          {players}
        </Text>
      </Cell>
      <Cell align="end">
        <Text as="span" size="sm">
          {playtime}
        </Text>
      </Cell>
      <Cell align="end">
        <span className="complexity-cell">
          <ComplexityRamp
            label={`complexity ${formatComplexity(complexity)} of 5`}
            stop={complexityStop(complexity)}
          />
          <Text as="span" size="sm">
            {formatComplexity(complexity)}
          </Text>
        </span>
      </Cell>
      <Cell align="end">
        <AvailabilityPill
          availability={availabilityToken(availability)}
          label={availability}
        />
      </Cell>
      <Cell align="end">
        <Figure size="md">{String(quantity)}</Figure>
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
        <Text size="sm" tone="chalk">
          {urn ?? '—'}
        </Text>
        <Text size="sm" tone="moss">
          {lines.map((line) => line.urn.replace('urn:game:', '')).join(', ') ||
            'no lines recorded'}
        </Text>
      </Cell>
      <Cell align="end">
        <Text as="span" size="sm">
          {at.slice(11, 19)}
        </Text>
      </Cell>
      <Cell align="end">
        <Text as="span" size="sm">
          {correlationId}
        </Text>
      </Cell>
      <Cell align="end">
        <Text as="span" size="sm">
          {String(inventoryChecks)}
        </Text>
      </Cell>
      <Cell align="end">
        <Text
          as="span"
          size="sm"
          tone={outcome === 'confirmed' ? 'lichen' : 'moss'}
        >
          {reason ? `${outcome}: ${reason}` : outcome}
        </Text>
      </Cell>
      <Cell align="end">
        <Figure size="md">{String(units)}</Figure>
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
        <Text as="span" size="sm">
          {label}
        </Text>
        {children}
      </Cell>
      <Cell align="end">
        <Figure size="md">{value}</Figure>
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
const LedgerRow: WidgetItemComponent = ({ children, meta, ...attributes }) => (
  <div
    {...attributes}
    className={
      meta?.['emphasis'] === 'head'
        ? 'ledger-row ledger-row--head'
        : 'ledger-row'
    }
    role="row"
  >
    {children}
  </div>
);

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
