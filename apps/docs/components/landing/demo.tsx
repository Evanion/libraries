import { Figure, Text, Title } from '@evanion/baize-ui';
import { createWidgets, type WidgetItemComponent } from '@evanion/react-widget';

/**
 * The widget set the "Rendering from data" demo renders with.
 *
 * Three components a page is made of -- a heading, a passage, a figure -- and
 * a chrome that places each item on a two-column grid from its `meta`. Small
 * enough that a reader can hold the whole map in their head while editing the
 * items, and real: this is `createWidgets` from the published package, not a
 * mock of it.
 *
 * No `'use client'` and no state. `DataDemo` is the client component; this
 * module is what it and the server render with, and the initial items are
 * serialised on the server from the same list the preview first renders, so
 * the markup a reader sees before hydration is the markup after.
 */

function Heading({ text }: { text: string }) {
  return (
    <Title as="h4" size="md">
      {text}
    </Title>
  );
}

function Note({ body }: { body: string }) {
  return <Text size="sm">{body}</Text>;
}

function Stat({ figure, label }: { figure: string; label: string }) {
  return (
    <p className="landing-demo__stat">
      <Figure size="lg">{figure}</Figure>
      <Text as="span" size="xs">
        {label}
      </Text>
    </p>
  );
}

/** What the demo's item chrome reads off `meta`: how many columns to take. */
export interface DemoMeta {
  span?: 1 | 2;
}

const Cell: WidgetItemComponent<DemoMeta> = ({ children, meta, ...rest }) => (
  <div
    {...rest}
    className="landing-demo__cell"
    style={{ gridColumn: `span ${meta?.span ?? 1}` }}
  >
    {children}
  </div>
);

function Stage({ children }: { children?: React.ReactNode }) {
  return <div className="landing-demo__stage">{children}</div>;
}

export const { Widgets, defineItems, validateItems } = createWidgets({
  components: { heading: Heading, note: Note, stat: Stat },
  chrome: { item: Cell, wrapper: Stage, suspense: 'none' },
});

/** The component types the map knows, for the validator and the caption. */
export const demoTypes = ['heading', 'note', 'stat'] as const;

/** The items the demo starts from. */
export const demoItems = defineItems([
  {
    id: 'title',
    type: 'heading',
    props: { text: 'Opening hours' },
    meta: { span: 2 },
  },
  {
    id: 'weekdays',
    type: 'stat',
    props: { figure: '10–18', label: 'Monday to Friday' },
  },
  {
    id: 'saturday',
    type: 'stat',
    props: { figure: '11–16', label: 'Saturday' },
  },
  {
    id: 'note',
    type: 'note',
    props: {
      body: 'Four tables at the back, no charge. Ask at the counter and we will teach you the rules.',
    },
    meta: { span: 2 },
  },
]);
