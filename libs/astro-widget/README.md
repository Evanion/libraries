# @evanion/astro-widget

**Zero-JS widget regions for Astro, rendered on the server.**

Stop shipping client-side bundles for layouts that don't change after the page is rendered. `@evanion/astro-widget` renders complex, CMS-driven widget regions when Astro renders the page, during `astro build` for a static page, and ships only HTML to the browser.

## The Problem: The "Runtime Layout" Tax

When a React or Vue app renders a layout only in the browser, the browser has to:

1. Download the JavaScript bundle.
2. Execute the layout logic.
3. Map the data to components and render them.

This "runtime tax" results in larger bundles, a slower Time to Interactive (TTI), and an empty region on screen until the bundle has run. For content-heavy pages (like a product listing or a blog), this is an unnecessary cost.

## The Solution: Zero-JS Build-Time Rendering

`@evanion/astro-widget` shifts the layout logic from the browser to Astro's own render. It uses the same item shape as [`@evanion/react-widget`](https://www.npmjs.com/package/@evanion/react-widget), and `Widgets.astro` renders each widget into HTML when Astro renders the page, with no component code sent to the browser: once during `astro build` for a static page, and on each request for a page Astro renders on demand.

The result: your users get a fully rendered, structured page, with **zero JavaScript** sent for the layout logic.

The item shape, the registry and the validator come from [`@evanion/widget`](https://www.npmjs.com/package/@evanion/widget), which this package pins to one exact version and re-exports, so installing this one is enough.

### Core Concept: The Static Region

A page writes `<Widgets items={items} registry={registry} />`. Every rendering example in this README is a test that renders through Astro's container API, which renders a component outside a request, so the HTML each one claims is the HTML Astro wrote. The widgets it renders are ordinary `.astro` files under [`examples/src`](https://github.com/Evanion/libraries/tree/main/libs/astro-widget/examples/src), laid out as an Astro project's `src`.

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

### Why this is better:

- 🚀 **Instant Load**: No client-side JS is required to figure out which component to render.
- 📉 **Tiny Bundles**: Layout logic stays on the server, reducing the amount of code shipped to the user.
- 🛡️ **Safe-by-Default**: `Widgets.astro` skips an item whose `type` the registry does not hold, so a stale type in a CMS save cannot break a render. You run `validateItems` as a "loud gate" before `astro build` to catch the same save before it reaches production.
- 🧩 **Universal Data**: Uses the same item array as `@evanion/react-widget`, allowing you to share layouts between a static Astro site and a dynamic React app. One item array renders through either and produces the same widgets in the same order.

## Installation

```bash
npm install @evanion/astro-widget
```

Astro `^7.3.4` is a peer dependency, and Astro 7 needs Node 22.12 or newer. The package is ESM-only.

## Rendering a Page from CMS Data

A page imports `Widgets.astro`, the registry and the items, and renders them. [`examples/src`](https://github.com/Evanion/libraries/tree/main/libs/astro-widget/examples/src) holds the whole project:

- `registry.ts` maps each type to its component.
- `data/brass-birmingham.json` holds the items a CMS saved, and `data/brass-birmingham.ts` types them as `AnyWidgetItem[]`.
- `pages/brass-birmingham.astro` renders them.

Rendering that page gives the listing's HTML:

<!-- #region first-render -->

```ts @import.meta.vitest
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

import BrassBirmingham from './examples/src/pages/brass-birmingham.astro';

const container = await AstroContainer.create();
const html = await container.renderToString(BrassBirmingham);

html; // -> '<main><header><h1>Brass: Birmingham</h1><p>2-4 players</p></header><p class="price">649 kr</p></main>'
```

<!-- #endregion first-render -->

`defineWidgets` returns the object it is handed. Its whole job is the generic parameter: annotating the same object as `WidgetRegistry` widens its keys to `string`, and the key union is what an editor completes on.

## The Item Shape

An item is `id`, `type`, `props`, and optional `meta` and `children`:

- `props` is spread into the widget.
- `meta` goes to the chrome and never to the widget.
- `children` reaches the widget as a prop, and the renderer does not recurse into it.

`id` is required, and `props` is a named field. If the renderer instead claimed every key it did not use for itself, its own fields would be reserved words in the CMS's vocabulary, and adding one later would take a prop away from every payload already written.

## Validation: The "Loud Gate"

`Widgets.astro` skips a type the registry does not hold, with a dev-only `console.warn`, so a bad CMS save cannot break a render. `validateItems` is the loud check, run at build time. It never throws, and it returns every problem in one call:

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

### Failing the Build

A build script runs `validateItems` over the items before `astro build`. [`examples/scripts/check-content.ts`](https://github.com/Evanion/libraries/tree/main/libs/astro-widget/examples/scripts/check-content.ts) is one, and throws on any problem, so `npx tsx scripts/check-content.ts && astro build` stops before Astro runs. It takes the type names as a plain list, because a Node process cannot import the `.astro` modules the registry holds. Importing it runs it over the listing page's items:

```ts @import.meta.vitest
await import('./examples/scripts/check-content');
```

`validateItems` reads a registry's keys and never its values, so the registry and the list of its names report the same thing:

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

### Required Props

A `required` map names the props a widget type cannot render without. Blank counts as missing, which is what a text field an editor opened and left alone arrives as:

<!-- #region required-fields -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const blank = [
  { id: 'header', type: 'listing-header', props: { title: '   ' } },
];

validateItems(blank, ['listing-header'], { 'listing-header': ['title'] }); // -> [{ index: 0, id: 'header', type: 'listing-header', message: 'missing field title' }]
```

<!-- #endregion required-fields -->

### Nested Indexing

`index` is the position within an item's own sibling list, so a problem at the top level and one inside `children` can both report `index: 0`. A problem carries no depth, so `id` tells them apart only when the CMS keeps ids unique across the whole tree:

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

### Structural Rules

Six structural rules run over every payload, whatever the registry holds, and five of them fire on the one below. The sixth, `item type is not a string`, fires on an item whose `type` is missing or not a string. Each is a save a CMS can make and a build should not ship:

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

An `items` that is not a list is one problem, because a CMS that wrote an object where the schema said array has broken the page, and a clean run would say it had not:

<!-- #region not-a-list -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

validateItems({ items: [] }, ['listing-header']); // -> [{ index: -1, id: '-', type: '-', message: 'items is not a list' }]
```

<!-- #endregion not-a-list -->

### Nested Registries

`validateItems` checks every level against the one `known` it was handed. A nesting widget renders its children through a registry of its own, so a child can pass the check and still be a type that widget skips. A second call checks the children of every grid against the grid registry's names:

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
grids.flatMap((grid) => validateItems(grid.children ?? [], ['game-card'])); // -> [{ index: 0, id: 'azul', type: 'listing-header', message: 'unknown widget type' }]
```

<!-- #endregion nested-registry -->

### Sorting a Report

`VALIDATION_MESSAGES` holds every message `validateItems` returns, so a caller sorts a report without matching on prose. A webhook can send an unknown type to the developers and a blank field back to the editor:

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

## Page Data and Chrome

`ctx` reaches every widget as a prop, and `chrome.item` wraps every widget. The chrome receives the item's `type`, `id` and `meta`, never its `props`, and it has to render `<slot />`. If it does not, Astro drops the wrapped widget with no error and no warning.

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

## Nested Regions

The renderer does not recurse. `children` on an item reaches its widget as ordinary prop data, because an Astro component receives child content through `<slot />` and never through a `children` prop. A widget that nests renders its own `Widgets` over its children, as `examples/src/widgets/GameGrid.astro` does:

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

## Unknown Types

An item whose `type` is not an own key of the registry renders nothing, and the rest of the page renders. Unless `NODE_ENV` is `production`, `console.warn` prints `ERROR_MESSAGES.UNKNOWN_WIDGET` for it, once per distinct message for the life of the process:

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

The lookup uses `Object.prototype.hasOwnProperty`, so an item typed `constructor`, `toString` or `__proto__` is skipped like any other unknown type, and never resolves to a function off `Object.prototype`.

## Comparison with React

The data is the same in `@evanion/react-widget` and here, and both hand page data to every widget as a `ctx` prop, with no provider. The renderers differ where Astro and React differ:

|                     | react-widget                    | astro-widget                                                               |
| ------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| Prop type inference | inferred from the component map | no. An `.astro` module's type carries no props, so use `validateItems`     |
| Nested `children`   | rendered as the widget's own    | no recursion. A widget renders `<Widgets items={children} …>` itself       |
| Region chrome       | `chrome.wrapper`                | none. The element around `<Widgets>` is the region, and the page writes it |

## Migrating from 0.2.x

Five names went, and the data moved.

| Was              | Now              |
| ---------------- | ---------------- |
| `defineBlocks`   | `defineWidgets`  |
| `validateBlocks` | `validateItems`  |
| `BlockItem`      | `AnyWidgetItem`  |
| `BlockRegistry`  | `WidgetRegistry` |
| `BlockProblem`   | `WidgetProblem`  |

The import specifiers do not change, and neither does `@evanion/astro-widget/components/Widgets.astro`.

`WidgetProblem` gains `id`, so an exact-equality assertion on a problem object changes. Four messages changed with it:

- `'blocks is not a list'` is now `'items is not a list'`.
- `'unknown block type'` is now `'unknown widget type'` for a string `type` the registry does not hold.
- An item with a missing or non-string `type` reported `'unknown block type'`, and now reports `'item type is not a string'`. A filter on `'unknown widget type'` no longer catches it.
- A null, array or primitive entry reported `'unknown block type'`, and now reports `'item is not an object'`.

### The Validator Checks More

`validateBlocks` reported a payload that was not a list, an unknown type and a missing required field, and nothing else. `validateItems` is the one implementation both renderers share, so it also brings five rules the React side always had. Four of them are new problems on a payload that passed before. `item is not an object` replaces the `'unknown block type'` a null, array or primitive entry used to get:

| Message                   | Raised when                                 |
| ------------------------- | ------------------------------------------- |
| `item is not an object`   | an entry is null, an array, or a primitive  |
| `item id is not a string` | `id` is missing or not a string             |
| `duplicate sibling id`    | two items in one sibling list share an `id` |
| `props is not an object`  | `props` is missing or not a plain object    |
| `children is not a list`  | `children` is present and not an array      |

Check `duplicate sibling id` first. A CMS that emits a constant id per widget type, such as `"listing-header"` on every listing header, or an empty string where an editor left the field alone, now fails a build that passed before. Ids only have to be unique within one sibling list, so the same id at two depths is still fine.

`props is not an object` catches an unmigrated payload: an item with its props still at the top level has no `props` key at all, and without this rule it would validate clean and render as an empty widget.

### Moving the Data

The item's own props move under `props`, and `id` becomes required:

```ts
const toWidgetItem =
  (parentId) =>
  ({ type, id, children, meta, ...props }, index) => {
    const itemId = id ?? `${parentId}-${index}`;
    return {
      id: itemId,
      type,
      props,
      meta,
      children: children?.map(toWidgetItem(itemId)),
    };
  };

const items = blocks.map(toWidgetItem('page'));
```

`id ?? …` is the awkward half. A widget item needs an id as the key, as the identity in a warning, and as what the duplicate-sibling check is about, and a CMS with no per-item id has to supply one. The function above derives it from the parent's id and the item's position, so the same save gets the same ids on every render.

`chrome.item` no longer receives the item's props, only `type`, `id` and `meta`. The props are the widget's data, and the chrome has no business with them.

## Beyond the Basics

Static rendering doesn't mean static logic. Our documentation covers how to handle complex layouts in Astro:

- **Nested Regions**: How to build widgets that render their own nested `<Widgets />` regions.
- **Build-Time Validation**: Setting up a CI script to fail the build if a CMS payload contains unknown types or missing fields.
- **Page Data and Chrome**: Passing page-level data to every widget through `ctx`, and wrapping every widget with `chrome.item`.
- **Comparison with React**: Understanding where an Astro component and a React component make the two renderers differ.

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/astro-widget](https://docs.evanion.com/astro-widget)**

## License

MIT
