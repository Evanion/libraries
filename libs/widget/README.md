# @evanion/widget

**Framework-agnostic structural validation for data-driven layouts.**

A content management system (CMS) saves a page as a list of widget items, and a renderer draws each item with the component its `type` names. When a saved type has no component, the renderer skips the item. When a required prop arrives blank, the renderer draws the widget with that field empty. In production neither throws and neither logs. `@evanion/widget` checks the saved items before they reach the renderer and reports every item it would skip or draw empty.

## Layouts as Data

`@evanion/widget` treats a page as a structured list of items. Each item names a component (`type`) and provides its configuration (`props`).

The library provides the structural "glue" (the registry and the validator) that checks a data-driven layout before it reaches the renderer. Which payload a customer or the owner gets is your application's choice; `validateItems` checks whichever one it is handed.

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

## Key Features

- 🏗️ **Data-Driven Orchestration**: Move the order and nesting of a page from your JSX into your database or CMS.
- 🛡️ **Structural Integrity**: Catch unknown types, missing required props, and duplicate IDs at the edge, before a renderer silently skips a widget or draws it empty.
- 🌍 **Framework-Agnostic**: No dependencies on React, Astro, or Vue. It handles the _structure_; you provide the _renderer_.
- 🧩 **Recursive Nesting**: Naturally supports complex, nested layouts (grids within tabs within sections) with full validation at every level.
- 🪶 **Zero Runtime Bloat**: A validator with no dependencies that runs in a build script, a webhook, or a serverless function.

## Installation

```bash
npm install @evanion/widget
```

**Note**: This is the core logic. To actually render these widgets, install the renderer for your framework:

- For React: `npm install @evanion/react-widget`
- For Astro: `npm install @evanion/astro-widget`

Each renderer pins `@evanion/widget` to an exact version and re-exports `defineWidgets`, `validateItems`, `ERROR_MESSAGES`, `VALIDATION_MESSAGES` and every type, so a project that installs a renderer imports these names from the renderer and never installs the core by hand.

The package is ESM only and needs Node 20 or newer. A CommonJS `require('@evanion/widget')` needs Node 20.19 or 22.12+, and older versions fail with `ERR_REQUIRE_ESM`.

## The Widget Item

A widget item is one block of a page. `type` names the component that draws it, and `props` carries that component's data. Here is a listing page from Baize, a board game shop: a wide listing for _Brass: Birmingham_, then a shelf holding a listing for _Wingspan_.

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

Every item follows the same contract:

- `id` is required, and must be unique among its siblings. A renderer lists the item under it, and a warning about a stale type names it. A CMS with no per-section id has to supply one; an index-derived value works as long as it is stable across renders.
- `props` is required. A widget's data lives under that key and nowhere else, so an item that carries its data at the top level is reported by `validateItems`, and a renderer would draw it empty with nothing logged.
- `meta` is optional placement data, like `span: 2`. A renderer hands it to the item chrome, the `chrome.item` component it draws around the widget, and never to the widget's own `props`.
- `children` is an optional array of nested items. React draws them as the component's `children`; an Astro component receives them as data and renders its own `<Widgets>` over them.

## Order and Nesting

`@evanion/react-widget` draws items in array order and draws each item's `children` inside it. `@evanion/astro-widget` draws them in the same order, and each parent component draws its own `children`. In both, moving an item in the array moves it, and everything nested in it, on the page. This is a staff dashboard of two rows, each holding its own items:

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

A registry maps each widget type to the component a renderer draws for it. `defineWidgets(registry)` returns the registry unchanged, typed as the literal object you passed in, so your editor completes on its keys. `validateItems` accepts it in place of a list of names:

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

Annotating the same object as `WidgetRegistry` would widen its keys to `string`, and lose the key union a renderer types its components against.

## Catching Bad Payloads with `validateItems`

`validateItems(items, known, required?)` checks a list against the set of known types and returns `WidgetProblem[]`. It never throws, and it reports every problem in one pass, so you can print all of them at once. Here the CMS saved a shelf after its type was renamed:

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

`items` is typed `unknown`, so a script passes a payload straight from `JSON.parse`, turns each problem into a log line, and fails the run when there is one. `known` can be a plain list of names, so the script never imports the components it will not render:

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

The optional `required` argument maps a type to the props that must be present and not blank. Blank means `undefined`, `null`, an empty string or whitespace only, which is what a CMS text field arrives as when an editor opened it and typed nothing:

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

The keys of `required` are plain strings, so TypeScript does not check them against your widget types: a misspelled type there is an entry nothing ever reads. An item whose type is unknown is reported once, and its required props are not checked.

### Nested Faults in One Pass

`validateItems` walks the payload depth first: an item's own problems, then its `children`, then the next sibling.

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

`index` is the item's position in its own sibling list, so the nested item above reports index 0, not 3. An id repeated at two depths is fine; a renderer scopes its keys per list, so only a repeat between siblings is a collision.

**Security note**: a type is looked up as an own key of the registry, so a CMS item typed `constructor`, `toString` or `__proto__` is reported as unknown and never resolves to something on `Object.prototype`.

No renderer calls `validateItems`. A renderer skips an item it cannot draw and warns; validation is the loud gate you run at ingestion or build time.

## Writing Your Own Renderer

A renderer that meets an item it cannot draw skips it and warns. The warning text lives in this package, so the same stale CMS type reads the same way whether React or Astro drew the page:

<!-- #region warning -->

```ts @import.meta.vitest
import { ERROR_MESSAGES } from '@evanion/widget';

const warning = ERROR_MESSAGES.UNKNOWN_WIDGET('listting', 'hive');

warning; // -> 'Unknown widget type "listting" for widget ID "hive". Skipping render.'
```

<!-- #endregion warning -->

`warnOnce` prints each distinct message once per process, and prints nothing when `NODE_ENV` is `production`. Every message carries the offending item's `type` and `id`, so a second bad item is still reported.

This renderer draws each listing as a line of text, skips the item whose type it cannot draw, and warns about it on the first render only:

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

The first `render` prints `Unknown widget type "listting" for widget ID "hive". Skipping render.` and the second prints nothing.

## Exports

`defineWidgets`, `validateItems`, `warnOnce`, `resetWarnings`, `ERROR_MESSAGES`, `VALIDATION_MESSAGES`, and the types `AnyWidgetItem`, `WidgetRegistry`, `WidgetMeta`, `WidgetProblem`, `KnownWidgetTypes`.

`warnOnce` and `resetWarnings` are for renderers, and neither published renderer re-exports them. A project that draws through a published renderer has no reason to call either.

## Documentation

The full guide, with every validation message and how each renderer handles nesting and placement, is on the documentation site:

👉 **[docs.evanion.com/widget](https://docs.evanion.com/widget)**

## License

MIT
