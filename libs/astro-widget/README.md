[![npm version](https://img.shields.io/npm/v/@evanion/astro-widget)](https://www.npmjs.com/package/@evanion/astro-widget)
[![npm downloads](https://img.shields.io/npm/dm/@evanion/astro-widget)](https://www.npmjs.com/package/@evanion/astro-widget)
[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# @evanion/astro-widget

Render CMS-driven Astro pages from structured widget data. Rendering happens
when Astro renders the page, and nothing is shipped to the browser.

The item shape, the registry and the validator come from
[`@evanion/widget`](https://www.npmjs.com/package/@evanion/widget), which this
package pins exactly and re-exports, so installing this one is enough. The React
renderer of the same items is
[`@evanion/react-widget`](https://www.npmjs.com/package/@evanion/react-widget):
one item array renders through either and produces the same widgets in the same
order.

## Install

```bash
npm install @evanion/astro-widget
```

Astro `^7.3.4` is a peer dependency.

## What it does

`Widgets.astro` takes a list of items and a registry, and renders each
item through the component its `type` names. Every example below renders
through Astro's container API, which renders a component outside a request, so
the HTML each one claims is the HTML Astro wrote. The widgets it renders are
ordinary `.astro` files under
[`examples/src`](https://github.com/Evanion/libraries/tree/main/libs/astro-widget/examples/src),
laid out as an Astro project's `src`.

<!-- #region overview -->

```ts @import.meta.vitest
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Widgets from '@evanion/astro-widget/components/Widgets.astro';

import { registry } from './examples/src/registry';

const items = [
  {
    id: 'header',
    type: 'listing-header',
    props: { title: 'Brass: Birmingham', players: '2-4' },
  },
  { id: 'price', type: 'price-box', props: { price: '649 kr' } },
];

const container = await AstroContainer.create();
const html = await container.renderToString(Widgets, {
  props: { items, registry },
});

html; // -> '<header><h1>Brass: Birmingham</h1><p>2-4 players</p></header><p class="price">649 kr</p>'
```

<!-- #endregion overview -->

## Use

A page imports `Widgets.astro`, the registry and the items, and renders
them. [`examples/src`](https://github.com/Evanion/libraries/tree/main/libs/astro-widget/examples/src)
holds the whole project: `registry.ts` maps each type to its component,
`data/brass-birmingham.json` holds the items a CMS saved,
`data/brass-birmingham.ts` types them as `AnyWidgetItem[]`, and
`pages/brass-birmingham.astro` renders them. Rendering that page gives the
listing's HTML:

<!-- #region first-render -->

```ts @import.meta.vitest
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

import BrassBirmingham from './examples/src/pages/brass-birmingham.astro';

const container = await AstroContainer.create();
const html = await container.renderToString(BrassBirmingham);

html; // -> '<main><header><h1>Brass: Birmingham</h1><p>2-4 players</p></header><p class="price">649 kr</p></main>'
```

<!-- #endregion first-render -->

`defineWidgets` returns the object it is handed. Its whole job is the generic
parameter: annotating the same object as `WidgetRegistry` widens its keys to
`string`, and the key union is what an editor completes on.

## Data shape

An item is `id`, `type`, `props`, and optional `meta` and `children`. `props`
is spread into the widget. `meta` goes to the chrome and never to the widget.
`children` reaches the widget as a prop, and the renderer does not recurse into
it.

`id` is required, and `props` is a named field rather than "every key the
renderer does not claim for itself". A renderer's own fields would otherwise be
reserved words in the CMS's vocabulary, and adding one later would take a prop
away from every payload already written.

## Validation

`Widgets.astro` skips a type the registry does not hold, with a dev-only
`console.warn`, so a bad CMS save cannot break a render. `validateItems` is the
loud check, run at build time:

<!-- #region validate -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const items = [
  {
    id: 'header',
    type: 'listing-header',
    props: { title: 'Brass: Birmingham' },
  },
  { id: 'price', type: 'price-box', props: {} },
  { id: 'questions', type: 'answer-wall', props: {} },
];

const required = { 'listing-header': ['title'], 'price-box': ['price'] };
const problems = validateItems(
  items,
  ['listing-header', 'price-box'],
  required,
);

problems; // -> [{ index: 1, id: 'price', type: 'price-box', message: 'missing field price' }, { index: 2, id: 'questions', type: 'answer-wall', message: 'unknown widget type' }]
```

<!-- #endregion validate -->

A build script runs it over the items before `astro build`.
[`examples/scripts/check-content.ts`](https://github.com/Evanion/libraries/tree/main/libs/astro-widget/examples/scripts/check-content.ts)
is one, and throws on any problem, so
`npx tsx scripts/check-content.ts && astro build` stops before Astro runs. It takes the type names as a plain list, because a
Node process cannot import the `.astro` modules the registry holds. Importing
it runs it over the listing page's items:

```ts @import.meta.vitest
await import('./examples/scripts/check-content');
```

`validateItems` reads a registry's keys and never its values, so the registry
and the list of its names report the same thing:

<!-- #region known-types -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

import { items } from './examples/src/data/brass-birmingham';
import { registry } from './examples/src/registry';

Object.keys(registry); // -> ['listing-header', 'price-box']
validateItems(items, registry); // -> []
validateItems(items, ['listing-header', 'price-box']); // -> []
```

<!-- #endregion known-types -->

A `required` map names the props a widget type cannot render without. Blank
counts as missing, which is what a text field an editor opened and left alone
arrives as:

<!-- #region required-fields -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const blank = [
  { id: 'header', type: 'listing-header', props: { title: '   ' } },
];

validateItems(blank, ['listing-header'], { 'listing-header': ['title'] }); // -> [{ index: 0, id: 'header', type: 'listing-header', message: 'missing field title' }]
```

<!-- #endregion required-fields -->

`index` is the position within an item's own sibling list, so a problem at the
top level and one inside `children` can both report `index: 0`. `id` is what
tells them apart:

<!-- #region nested-index -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const nested = [
  {
    id: 'grid',
    type: 'game-grid',
    props: {},
    children: [{ id: 'questions', type: 'answer-wall', props: {} }],
  },
];

validateItems(nested, ['game-grid'], { 'game-grid': ['title'] }); // -> [{ index: 0, id: 'grid', type: 'game-grid', message: 'missing field title' }, { index: 0, id: 'questions', type: 'answer-wall', message: 'unknown widget type' }]
```

<!-- #endregion nested-index -->

Six structural rules run over every payload, whatever the registry holds, and
five of them fire on the one below. The sixth, `item type is not a string`,
fires on an item whose `type` is missing or not a string. Each is a save a CMS
can make and a build should not ship:

<!-- #region structural-rules -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const saved = [
  null,
  { type: 'listing-header', props: { title: 'Brass: Birmingham' } },
  { id: 'grid', type: 'game-grid', props: {}, children: 'none' },
  { id: 'grid', type: 'game-grid' },
];

const problems = validateItems(saved, ['listing-header', 'game-grid']);

problems.map((p) => [p.index, p.message]); // -> [[0, 'item is not an object'], [1, 'item id is not a string'], [2, 'children is not a list'], [3, 'duplicate sibling id'], [3, 'props is not an object']]
```

<!-- #endregion structural-rules -->

An `items` that is not a list is one problem rather than none, because a CMS
that wrote an object where the schema said array has broken the page and a
clean run would say it had not:

<!-- #region not-a-list -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

validateItems({ items: [] }, ['listing-header']); // -> [{ index: -1, id: '-', type: '-', message: 'items is not a list' }]
```

<!-- #endregion not-a-list -->

`validateItems` checks every level against the one `known` it was handed. A
nesting widget renders its children through a registry of its own, so a child
can pass the check and still be a type that widget skips. A second call checks
the children of every grid against the grid registry's names:

<!-- #region nested-registry -->

```ts @import.meta.vitest
import { validateItems, type AnyWidgetItem } from '@evanion/astro-widget';

const page: AnyWidgetItem[] = [
  {
    id: 'header',
    type: 'listing-header',
    props: { title: 'Brass: Birmingham' },
  },
  {
    id: 'grid',
    type: 'game-grid',
    props: {},
    children: [
      { id: 'azul', type: 'listing-header', props: { title: 'Azul' } },
    ],
  },
];

const required = { 'listing-header': ['title'] };
const grids = page.filter((item) => item.type === 'game-grid');

validateItems(page, ['listing-header', 'game-grid'], required); // -> []
grids.flatMap((grid) => validateItems(grid.children, ['game-card'])); // -> [{ index: 0, id: 'azul', type: 'listing-header', message: 'unknown widget type' }]
```

<!-- #endregion nested-registry -->

`VALIDATION_MESSAGES` holds every message `validateItems` returns, so a caller
sorts a report without matching on prose. A webhook can send an unknown type to
the developers and a blank field back to the editor:

<!-- #region messages -->

```ts @import.meta.vitest
import { VALIDATION_MESSAGES, validateItems } from '@evanion/astro-widget';

const saved = [
  { id: 'header', type: 'listing-header', props: { title: '' } },
  { id: 'questions', type: 'answer-wall', props: {} },
];

const problems = validateItems(saved, ['listing-header'], {
  'listing-header': ['title'],
});
const unknown = problems.filter(
  (problem) => problem.message === VALIDATION_MESSAGES.UNKNOWN_TYPE,
);
const blank = problems.filter(
  (problem) => problem.message === VALIDATION_MESSAGES.MISSING_FIELD('title'),
);

unknown.map((problem) => problem.id); // -> ['questions']
blank.map((problem) => problem.id); // -> ['header']
```

<!-- #endregion messages -->

## Chrome and `ctx`

`ctx` reaches every widget as a prop, and `chrome.item` wraps every widget.
The chrome receives the item's `type`, `id` and `meta`, never its `props`, and
it has to render `<slot />`. If it does not, Astro drops the wrapped widget with
no error and no warning.

<!-- #region ctx-and-chrome -->

```ts @import.meta.vitest
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Widgets from '@evanion/astro-widget/components/Widgets.astro';

import Section from './examples/src/chrome/Section.astro';
import Stock from './examples/src/widgets/Stock.astro';

const items = [
  {
    id: 'stock',
    type: 'stock',
    props: { copies: 3 },
    meta: { background: 'felt' },
  },
];

const container = await AstroContainer.create();
const html = await container.renderToString(Widgets, {
  props: {
    items,
    registry: { stock: Stock },
    ctx: { store: 'Gothenburg' },
    chrome: { item: Section },
  },
});

html; // -> '<section id="stock" data-widget-type="stock" class="widget bg-felt"><p>3 copies in Gothenburg</p></section>'
```

<!-- #endregion ctx-and-chrome -->

## Nesting

The renderer does not recurse. `children` on an item reaches its widget as
ordinary prop data, because an Astro component receives child content through
`<slot />` and never through a `children` prop. A widget that nests renders its
own `Widgets` over its children, as `examples/src/widgets/GameGrid.astro` does:

<!-- #region nested -->

```ts @import.meta.vitest
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Widgets from '@evanion/astro-widget/components/Widgets.astro';

import GameGrid from './examples/src/widgets/GameGrid.astro';

const items = [
  {
    id: 'also-on-the-shelf',
    type: 'game-grid',
    props: { title: 'Also on the shelf' },
    children: [
      { id: 'azul', type: 'game-card', props: { name: 'Azul' } },
      { id: 'root', type: 'game-card', props: { name: 'Root' } },
    ],
  },
];

const container = await AstroContainer.create();
const html = await container.renderToString(Widgets, {
  props: { items, registry: { 'game-grid': GameGrid } },
});

html; // -> '<section><h2>Also on the shelf</h2><article>Azul</article><article>Root</article></section>'
```

<!-- #endregion nested -->

## Unknown types

An item whose `type` is not an own key of the registry renders nothing, and in
development `console.warn` prints `ERROR_MESSAGES.UNKNOWN_WIDGET` for it once.
The rest of the page renders:

<!-- #region skip-unknown -->

```ts @import.meta.vitest
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Widgets from '@evanion/astro-widget/components/Widgets.astro';
import { ERROR_MESSAGES } from '@evanion/astro-widget';

import { registry } from './examples/src/registry';

const items = [
  { id: 'questions', type: 'answer-wall', props: {} },
  { id: 'price', type: 'price-box', props: { price: '649 kr' } },
];

const container = await AstroContainer.create();
const html = await container.renderToString(Widgets, {
  props: { items, registry },
});

html; // -> '<p class="price">649 kr</p>'
ERROR_MESSAGES.UNKNOWN_WIDGET('answer-wall', 'questions'); // -> 'Unknown widget type "answer-wall" for widget ID "questions". Skipping render.'
```

<!-- #endregion skip-unknown -->

The lookup uses `Object.prototype.hasOwnProperty`, so an item typed
`constructor`, `toString` or `__proto__` is skipped like any other unknown type
rather than resolving to a function off `Object.prototype`.

## Differences from @evanion/react-widget

|                         | react-widget                    | astro-widget                                                               |
| ----------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| Provider / `useWidgets` | yes                             | no. An Astro component has no render-time context, so use `ctx`            |
| Prop type inference     | inferred from the component map | no. An `.astro` module's type carries no props, so use `validateItems`     |
| Nested `children`       | rendered as the widget's own    | no recursion. A widget renders `<Widgets items={children} …>` itself       |
| Region chrome           | `chrome.wrapper`                | none. The element around `<Widgets>` is the region, and the page writes it |

The data is the same in both. That is the point of the split.

## Migrating from 0.2.x

Five names went, and the data moved.

| Was              | Now              |
| ---------------- | ---------------- |
| `defineBlocks`   | `defineWidgets`  |
| `validateBlocks` | `validateItems`  |
| `BlockItem`      | `AnyWidgetItem`  |
| `BlockRegistry`  | `WidgetRegistry` |
| `BlockProblem`   | `WidgetProblem`  |

The import specifiers do not change, and neither does
`@evanion/astro-widget/components/Widgets.astro`.

`WidgetProblem` gains `id`, so an exact-equality assertion on a problem object
changes. Two messages changed with it: `'unknown block type'` is now
`'unknown widget type'` and `'blocks is not a list'` is `'items is not a list'`.

### The validator checks more than it did

`validateBlocks` reported an unknown type and a missing required field, and
nothing else. `validateItems` is the one implementation both renderers share, so
it also brings the five rules the React side always had. Each of these is a new
problem on a payload that passed yesterday:

| Message                   | Raised when                                 |
| ------------------------- | ------------------------------------------- |
| `item is not an object`   | an entry is null, an array, or a primitive  |
| `item id is not a string` | `id` is missing or not a string             |
| `duplicate sibling id`    | two items in one sibling list share an `id` |
| `props is not an object`  | `props` is missing or not a plain object    |
| `children is not a list`  | `children` is present and not an array      |

`duplicate sibling id` is the one to check first. A CMS that emits a constant id
per widget type, such as `"listing-header"` on every listing header, or an
empty string where an editor left the field alone, now fails a build that passed
before. Ids only have to be unique within one sibling list, so the same id at
two depths is still fine.

`props is not an object` is the rule that catches an unmigrated payload: an item
with its props still at the top level has no `props` key at all, and without this
it would validate clean and render as an empty widget.

### The data

The item's own props move under `props`, and `id` becomes required:

```ts
const toWidgetItem = ({ type, id, children, meta, ...props }) => ({
  id: id ?? crypto.randomUUID(),
  type,
  props,
  meta,
  children: children?.map(toWidgetItem),
});
```

`id ?? …` is the awkward half. A widget item needs an id as the key, as the
identity in a warning, and as what the duplicate-sibling check is about, and a
CMS with no per-item id has to supply one. An index-derived value is fine as
long as it is stable across renders.

`chrome.item` no longer receives the item's props, only `type`, `id` and `meta`.
Under the old shape "props" meant everything the renderer did not claim, so
handing them to the chrome was nearly free; now they are the widget's data and
the chrome has no business with them.

## Licence

MIT
