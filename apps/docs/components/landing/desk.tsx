import { Figure, Text, Title } from '@evanion/baize-ui';
import { createWidgets, type WidgetItemComponent } from '@evanion/react-widget';
import type { ReactNode } from 'react';

/**
 * The widget set the "Rendering from data" demo renders with: a workshop's
 * dashboard, composed from a list of items.
 *
 * Four types, one of them a container. `columns` takes nested items and lays
 * them side by side, which is the shape a flat list of components cannot
 * describe and the reason this is a library rather than an afternoon's
 * `items.map`. The other three are blocks a developer wrote once -- a figure, a
 * job table, an order table -- and the data decides which ones the page has,
 * where they sit and how wide they are.
 *
 * Small enough that a reader holds the whole map in their head while moving
 * items around, and real: this is `createWidgets` from the published package.
 *
 * No `'use client'` and no state. `DataDemo` is the client component; this
 * module is what it and the server render with, so the markup a reader sees
 * before hydration is the markup after.
 */

/** What the demo's item chrome reads off `meta`: how many columns to take. */
export interface DeskMeta {
  span?: 1 | 2;
}

function Metric({
  figure,
  label,
  delta,
}: {
  figure: string;
  label: string;
  delta: string;
}) {
  return (
    <div className="landing-desk__metric">
      <Figure size="lg">{figure}</Figure>
      <Text as="span" size="xs">
        {label}
      </Text>
      <span className="landing-desk__delta">{delta}</span>
    </div>
  );
}

/** A titled block with a table in it: the shape both content widgets take. */
function Board({
  title,
  head,
  rows,
}: {
  title: string;
  head: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  return (
    <div className="landing-desk__board">
      <Title as="h4" size="sm">
        {title}
      </Title>
      <table className="landing-desk__table">
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, at) => (
                <td key={at}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Jobs({ title }: { title: string }) {
  return (
    <Board
      title={title}
      head={['Customer', 'Bike', 'Work', 'State']}
      rows={[
        ['Hanna Lind', 'Crescent Elit', 'Wheel true', 'On the stand'],
        ['Otto Ruane', 'Monark cargo', 'Brake bleed', 'On the stand'],
        ['Sigrid Vall', 'Pelago Stavanger', 'Full service', 'Ready'],
        [
          'Emil Norrby',
          'Bianchi Via Nirone',
          'Gear index',
          'Waiting on a part',
        ],
      ]}
    />
  );
}

function Parts({ title }: { title: string }) {
  return (
    <Board
      title={title}
      head={['Part', 'Due']}
      rows={[
        ['Shimano BR-M6100 pads', 'Tuesday'],
        ['Rear wheel, 36h, 700c', 'Thursday'],
        ['Gates belt, 113t', 'Next week'],
      ]}
    />
  );
}

/**
 * A row of nested items, each as wide as its own `meta` says.
 *
 * The container reads nothing off its children and the children know nothing
 * about the row: the chrome around each nested item turns its `meta.span` into
 * a track count, so moving an item out of this row and into another one carries
 * its width with it.
 */
function Columns({ children }: { children?: ReactNode }) {
  return <div className="landing-desk__columns">{children}</div>;
}

const Cell: WidgetItemComponent<DeskMeta> = ({ children, meta, ...rest }) => (
  <div
    {...rest}
    className="landing-desk__cell"
    style={{ '--desk-span': meta?.span ?? 1 } as React.CSSProperties}
  >
    {children}
  </div>
);

function Stage({ children }: { children?: ReactNode }) {
  return <div className="landing-desk__stage">{children}</div>;
}

export const { Widgets, defineItems } = createWidgets({
  components: { columns: Columns, metric: Metric, jobs: Jobs, parts: Parts },
  chrome: { item: Cell, wrapper: Stage, suspense: 'none' },
});

/**
 * The page the demo opens on: a figures row, then a wide job board beside a
 * narrower order board.
 *
 * Two top-level items, each holding its own. Moving one of them moves the whole
 * block, which is the thing worth seeing; moving `stands` past `parts` swaps
 * which side of the desk is wide, because `meta.span` travels with the item.
 */
export const deskItems = defineItems([
  {
    id: 'week',
    type: 'columns',
    props: {},
    children: [
      {
        id: 'intake',
        type: 'metric',
        props: { figure: '38', label: 'Bikes in', delta: '+6' },
      },
      {
        id: 'collected',
        type: 'metric',
        props: { figure: '31', label: 'Collected', delta: '+2' },
      },
      {
        id: 'turnaround',
        type: 'metric',
        props: { figure: '2.4 d', label: 'Turnaround', delta: '−0.3' },
      },
    ],
  },
  {
    id: 'desk',
    type: 'columns',
    props: {},
    children: [
      {
        id: 'stands',
        type: 'jobs',
        props: { title: 'On the stands' },
        meta: { span: 2 },
      },
      {
        id: 'parts',
        type: 'parts',
        props: { title: 'Parts on order' },
      },
    ],
  },
]);
