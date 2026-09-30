[![npm version](https://img.shields.io/npm/v/@evanion/widget)](https://www.npmjs.com/package/@evanion/widget)
[![npm downloads](https://img.shields.io/npm/dm/@evanion/widget)](https://www.npmjs.com/package/@evanion/widget)
[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# Widget

The framework-free half of a widget region: the item shape, the registry, and
the validator. It renders nothing. A renderer is one package per framework, and
each of them depends on this one:

| Package                 | Renders                      |
| ----------------------- | ---------------------------- |
| `@evanion/react-widget` | React, Server Components too |
| `@evanion/astro-widget` | Astro, at build time         |

Install a renderer, not this. Every type below is re-exported from each of them,
so a consumer who never names this package never installs it by hand.

## What a widget region is

A page described as data: a list of items, each naming a component by `type` and
carrying the props it takes. The renderer resolves the type against a registry
and renders it.

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

## Why this package exists

Two renderers held two copies of these rules under two vocabularies, and the
same prototype-chain bug had to be fixed in both. A third renderer would have
been a third copy. The rules are the part that does not differ between
frameworks; resolving a type to a component and putting children somewhere is
the part that does.

Nothing here imports a framework, so it also runs where no renderer does: a
webhook that checks a CMS payload on its way in, a build script, a test.

## Installation

```bash
npm install @evanion/widget
```

Or with yarn:

```bash
yarn add @evanion/widget
```

Or with pnpm:

```bash
pnpm add @evanion/widget
```

## The item

```ts
interface AnyWidgetItem<Type extends string = string, Props = object> {
  id: string;
  type: Type;
  props: Props;
  meta?: WidgetMeta;
  children?: AnyWidgetItem[];
}
```

`id` is required. It is the key a renderer lists the item under, the identity in
a warning about a stale type, and what the duplicate-sibling check is about. A
CMS with no per-section id has to supply one; an index-derived value is fine as
long as it is stable across renders.

`props` is a named field rather than "every key the renderer does not claim".
The renderer's own fields would otherwise be reserved words in the CMS's
vocabulary, and adding one later would take a prop away from every payload
already written.

It is required, and `validateItems` reports an item without it. A widget's data
lives under that key and nowhere else, so an item missing it is one whose props
the payload put somewhere no renderer reads — which is what a payload written
against a flat item shape looks like, and what a renderer would draw as an empty
widget with nothing logged.

`meta` is placement: which column, what span, whether a rule sits above it. It
goes to the region's chrome and never into the widget's own props, because where
a widget sits is not something the widget should know.

`children` is nested items. What a renderer does with them is the runtime's
business — React renders them as the component's `children`, while an Astro
component receives child content through `<slot />` and is handed them as data
to open its own region over.

A renderer draws items in array order and draws each item's `children` inside
it, so moving an item in the array moves it, and everything nested in it, on the
page. This is a staff dashboard of two rows, each holding its own items:

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

## `defineWidgets(registry)`

Returns the registry unchanged, typed as the literal object passed in.

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

Annotating the same object as `WidgetRegistry` would widen its keys to `string`,
and the key union is what an editor completes on and what a renderer types a
component against.

## `validateItems(items, known, required?)`

Checks a list against the set of known types and returns `WidgetProblem[]`.
Problems rather than an exception, and accumulated rather than short-circuited,
so a caller can print all of them at once.

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

`known` is a registry or a plain list of names, so a CI script can validate a
payload without importing components it will never render.

`items` is typed `unknown`, so a script passes a payload straight from
`JSON.parse`, turns each problem into a line for its log, and fails the run
when there is one:

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

`required` maps a type to the props that must be present and non-blank, where
blank means `undefined`, `null` or whitespace only — which is what a CMS text
field that was opened and left empty arrives as.

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

`required` takes plain strings for its keys, so a widget type misspelled there
is a map entry nothing ever reads rather than a compile error.

One pass reports every problem it finds, in the order it walks the list, and it
walks `children` as it goes:

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

`index` is the item's position in its own sibling list, so the nested item above
reports index 0 rather than 3. An id repeated at two depths is fine; a renderer
scopes its keys per list, and only a repeat between siblings is a collision.

No renderer calls this. Each one stays defensive — an item it cannot render is
skipped and warned about — and validation is the loud gate you run at ingestion
or build time.

A type is looked up as an own key of the registry, so a CMS item typed
`constructor`, `toString` or `__proto__` is unknown rather than resolving to
something off `Object.prototype`.

## The warning an adapter prints

A renderer that meets an item it cannot draw skips it and warns. The warning
text is built here, so the same stale CMS type reads the same way whether React
or Astro drew the page:

<!-- #region warning -->

```ts @import.meta.vitest
import { ERROR_MESSAGES } from '@evanion/widget';

const warning = ERROR_MESSAGES.UNKNOWN_WIDGET('listting', 'hive');

warning; // -> 'Unknown widget type "listting" for widget ID "hive". Skipping render.'
```

<!-- #endregion warning -->

`warnOnce` prints each distinct message once per process and prints nothing
when `NODE_ENV` is `production`. Every message carries the offending item's
`type` and `id`, which is what makes the text a usable key: a second bad item
is still reported.

A renderer of your own reaches the same seam. This one draws each listing as a
line of text, skips the item whose type it cannot draw, and warns about it on
the first render only:

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

The first `render` prints `Unknown widget type "listting" for widget ID "hive".
Skipping render.` and the second prints nothing.

## Exports

`defineWidgets`, `validateItems`, `warnOnce`, `resetWarnings`,
`ERROR_MESSAGES`, `VALIDATION_MESSAGES`, and the types `AnyWidgetItem`,
`WidgetRegistry`, `WidgetMeta`, `WidgetProblem`, `KnownWidgetTypes`.

`warnOnce` and `resetWarnings` are there for the adapters, which are separate
packages and cannot reach a module this one does not publish. A consumer has no
reason to call either.

## License

MIT
