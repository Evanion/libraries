import type { ReactNode } from 'react';
import { href } from 'react-router';
import type { Route } from './+types/shelf';
import { shelfContext } from '../page-context.js';
import { shelfTotals } from '../shelf.js';
import { Ledger, defineLedgerItems, ledgerColumns } from '../regions/ledger.js';
import { Panel, Stat, StatLine, Text, Title } from '@evanion/baize-ui';

export const meta: Route.MetaFunction = () => [{ title: 'Shelf · Baize' }];

/** The shelf table's column template. See `OrdersTable` for why it is here. */
const ShelfTable = ({ children }: { children?: ReactNode }) => (
  <div
    role="table"
    aria-label="Shelf"
    style={ledgerColumns('minmax(0, 2fr) auto auto auto auto auto')}
  >
    {children}
  </div>
);

/**
 * Reads the shelf through the memo the shell's middleware installed, so this
 * route and its parent share one catalogue read per request.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const shelf = await context.get(shelfContext)();
  const totals = shelfTotals(shelf.rows);

  return {
    unavailable: shelf.unavailable,
    figures: [
      { label: 'titles', value: String(totals.titles) },
      { label: 'units on hand', value: String(totals.unitsOnHand) },
      { label: 'empty shelves', value: String(totals.emptyShelves) },
      { label: 'mean weight', value: totals.meanWeight.toFixed(1) },
    ],
    items: defineLedgerItems([
      {
        id: 'head',
        type: 'head',
        props: {
          cells: [
            'title',
            'players',
            'playtime',
            'weight',
            'availability',
            'on hand',
          ],
        },
        meta: { emphasis: 'head' },
      },
      ...shelf.rows.map((row) => ({
        id: row.urn,
        type: 'shelfRow' as const,
        props: {
          urn: row.urn,
          title: row.title,
          mechanism: row.mechanisms[0] ?? 'uncategorised',
          players: row.players,
          playtime: row.playtime,
          weight: row.weight,
          quantity: row.quantity,
          availability: row.availability,
          href: href('/shelf/:urn', { urn: row.urn }),
        },
      })),
      {
        id: 'total',
        type: 'total',
        props: {
          label: `${totals.titles} titles carried`,
          value: String(totals.unitsOnHand),
        },
        meta: { emphasis: 'total' },
      },
    ]),
  };
}

export default function Shelf({ loaderData }: Route.ComponentProps) {
  const { figures, items, unavailable } = loaderData;

  if (unavailable) {
    return (
      <Panel heading="No catalogue">
        <Text measured>
          The shelf is the catalogue joined to stock, both from shop-api. Start
          it and this page fills in.
        </Text>
      </Panel>
    );
  }

  return (
    <>
      <header className="page-head">
        <Title as="h1" size="lg">
          Shelf
        </Title>
        <StatLine label="Shelf totals">
          {figures.map((figure) => (
            <Stat
              figure={figure.value}
              key={figure.label}
              label={figure.label}
            />
          ))}
        </StatLine>
      </header>
      <Ledger items={items} chrome={{ wrapper: ShelfTable }} />
    </>
  );
}
