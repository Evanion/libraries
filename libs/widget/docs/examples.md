# @evanion/widget examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## Layouts as Data

### Core Concept: The Validated Page

```ts @import.meta.vitest
import { validateItems } from '@evanion/widget';
import type { AnyWidgetItem } from '@evanion/widget';

// The widget types the shop's renderer has a component for.
const known = ['shelf', 'listing', 'metric'];

// Two home pages the CMS serves: one to a customer, one to the owner.
const customerHome: AnyWidgetItem[] = [
  {
    id: 'tonight',
    type: 'shelf',
    props: { heading: 'On the table tonight' },
    children: [
      { id: 'wingspan', type: 'listing', props: { title: 'Wingspan' } },
    ],
  },
];

const ownerHome: AnyWidgetItem[] = [
  {
    id: 'sold',
    type: 'metric',
    props: { figure: '31', label: 'Sold', delta: '+2' },
  },
];

const problems = [
  ...validateItems(customerHome, known),
  ...validateItems(ownerHome, known),
];

// An empty list: every item names a known type and carries `props`.
problems; // -> []
```

## The Widget Item

<!-- #region shape -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/widget';
import type { AnyWidgetItem } from '@evanion/widget';

const page: AnyWidgetItem[] = [
  {
    id: 'brass-birmingham',
    type: 'listing',
    props: { title: 'Brass: Birmingham', complexity: 4 },
    meta: { span: 2 },
  },
  {
    id: 'tonight',
    type: 'shelf',
    props: { heading: 'On the table tonight' },
    children: [
      { id: 'wingspan', type: 'listing', props: { title: 'Wingspan' } },
    ],
  },
];

const problems = validateItems(page, ['listing', 'shelf']);

problems; // -> []
```

<!-- #endregion shape -->

## Order and Nesting

<!-- #region dashboard -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/widget';
import type { AnyWidgetItem } from '@evanion/widget';

const dashboard: AnyWidgetItem[] = [
  {
    id: 'week',
    type: 'columns',
    props: {},
    children: [
      {
        id: 'intake',
        type: 'metric',
        props: { figure: '38', label: 'Games in', delta: '+6' },
      },
      {
        id: 'sold',
        type: 'metric',
        props: { figure: '31', label: 'Sold', delta: '+2' },
      },
      {
        id: 'turnaround',
        type: 'metric',
        props: { figure: '2.4 d', label: 'Turnaround', delta: '−0.3' },
      },
    ],
  },
  {
    id: 'counter',
    type: 'columns',
    props: {},
    children: [
      {
        id: 'tables',
        type: 'tables',
        props: { title: 'Tonight at the tables' },
        meta: { span: 2 },
      },
      {
        id: 'reprints',
        type: 'reprints',
        props: { title: 'Reprints on order' },
      },
    ],
  },
];

const problems = validateItems(dashboard, [
  'columns',
  'metric',
  'tables',
  'reprints',
]);

problems; // -> []
```

<!-- #endregion dashboard -->

## Typing a Registry with `defineWidgets`

<!-- #region registry -->

```ts @import.meta.vitest
import { defineWidgets, validateItems } from '@evanion/widget';

// Whatever your renderer resolves a type to. The core reads the keys and never
// calls a value, so a stand-in is enough to show what the keys do.
const Listing = () => null;
const Shelf = () => null;

const registry = defineWidgets({ listing: Listing, shelf: Shelf });

const problems = validateItems(
  [{ id: 'wingspan', type: 'listing', props: { title: 'Wingspan' } }],
  registry,
);

problems; // -> []
```

<!-- #endregion registry -->

## Catching Bad Payloads with `validateItems`

<!-- #region unknown -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/widget';
import type { AnyWidgetItem } from '@evanion/widget';

// The listing page as the CMS saved it, after the shelf's type was renamed.
const page: AnyWidgetItem[] = [
  {
    id: 'brass-birmingham',
    type: 'listing',
    props: { title: 'Brass: Birmingham', complexity: 4 },
  },
  {
    id: 'tonight',
    type: 'featured-shelf',
    props: { heading: 'On the table tonight' },
  },
];

// The widget types the shop's renderer has a component for.
const known = ['listing', 'shelf'];

const problems = validateItems(page, known);

problems; // -> [{ index: 1, id: 'tonight', type: 'featured-shelf', message: 'unknown widget type' }]
```

<!-- #endregion unknown -->

### Using It as a Quality Gate

<!-- #region gate -->

```ts @import.meta.vitest
/// <reference types="node" />
import { validateItems } from '@evanion/widget';

// The listing page as the CMS saved it, after an editor renamed the shelf's type.
const saved: unknown = JSON.parse(`[
  { "id": "brass-birmingham", "type": "listing", "props": { "title": "Brass: Birmingham" } },
  { "id": "tonight", "type": "featured-shelf", "props": { "heading": "On the table tonight" } }
]`);

// The widget types the shop's renderer has a component for.
const known = ['listing', 'shelf'];

const report = validateItems(saved, known).map(
  (problem) => `${problem.id} (${problem.type}): ${problem.message}`,
);

report; // -> ['tonight (featured-shelf): unknown widget type']

for (const line of report) console.error(line);
if (report.length > 0) process.exitCode = 1;

process.exitCode; // -> 1
```

<!-- #endregion gate -->

### Enforcing Required Props

<!-- #region required -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/widget';

const problems = validateItems(
  [{ id: 'wingspan', type: 'listing', props: { title: '   ' } }],
  ['listing'],
  { listing: ['title'] },
);

problems; // -> [{ index: 0, id: 'wingspan', type: 'listing', message: 'missing field title' }]
```

<!-- #endregion required -->

### Nested Faults in One Pass

<!-- #region sweep -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/widget';

const payload = [
  { id: 'wingspan', type: 'listing' },
  { id: 'wingspan', type: 'listing', props: { title: 'Wingspan' } },
  {
    id: 'tonight',
    type: 'shelf',
    props: {},
    children: [{ id: 'hive', type: 'listting', props: { title: 'Hive' } }],
  },
];

const problems = validateItems(payload, ['listing', 'shelf']).map(
  ({ index, message }) => ({ index, message }),
);

problems; // -> [{ index: 0, message: 'props is not an object' }, { index: 1, message: 'duplicate sibling id' }, { index: 0, message: 'unknown widget type' }]
```

<!-- #endregion sweep -->

## Writing Your Own Renderer

<!-- #region warning -->

```ts @import.meta.vitest
import { ERROR_MESSAGES } from '@evanion/widget';

const warning = ERROR_MESSAGES.UNKNOWN_WIDGET('listting', 'hive');

warning; // -> 'Unknown widget type "listting" for widget ID "hive". Skipping render.'
```

<!-- #endregion warning -->

<!-- #region renderer -->

```ts @import.meta.vitest
import { ERROR_MESSAGES, resetWarnings, warnOnce } from '@evanion/widget';
import type { AnyWidgetItem, WidgetRegistry } from '@evanion/widget';

type Listing = AnyWidgetItem<string, { title?: string }>;

const registry: WidgetRegistry<(props: { title?: string }) => string> = {
  listing: (props) => `Listing: ${props.title}`,
};

function render(items: Listing[]): string[] {
  return items.flatMap((item) => {
    // An own key only: a CMS type of `constructor` is unknown.
    const draw = Object.prototype.hasOwnProperty.call(registry, item.type)
      ? registry[item.type]
      : undefined;

    if (draw === undefined) {
      warnOnce(ERROR_MESSAGES.UNKNOWN_WIDGET(item.type, item.id));
      return [];
    }
    return [draw(item.props)];
  });
}

// The set of printed messages lives as long as the process, so a renderer's
// tests clear it before each case.
resetWarnings();

const page: Listing[] = [
  { id: 'wingspan', type: 'listing', props: { title: 'Wingspan' } },
  { id: 'hive', type: 'listting', props: { title: 'Hive' } },
];

render(page); // -> ['Listing: Wingspan']
render(page); // -> ['Listing: Wingspan']
```

<!-- #endregion renderer -->
