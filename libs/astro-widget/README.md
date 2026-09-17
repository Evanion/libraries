[![npm version](https://img.shields.io/npm/v/@evanion/astro-widget)](https://www.npmjs.com/package/@evanion/astro-widget)
[![npm downloads](https://img.shields.io/npm/dm/@evanion/astro-widget)](https://www.npmjs.com/package/@evanion/astro-widget)
[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# @evanion/astro-widget

Render CMS-driven Astro sections from structured widget data. Build-time only —
no runtime, no hydration, nothing shipped to the browser.

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

Astro `>=7.3.1` is a peer dependency.

## Use

```ts
// src/registry.ts
import { defineWidgets } from '@evanion/astro-widget';
import ListingHeader from './widgets/ListingHeader.astro';
import GameGrid from './widgets/GameGrid.astro';

export const registry = defineWidgets({
  'listing-header': ListingHeader,
  'game-grid': GameGrid,
});
```

```astro
---
import Widgets from '@evanion/astro-widget/components/Widgets.astro';
import { registry } from '../registry';
import page from '../data/page.json';
---
<Widgets items={page.sections} registry={registry} ctx={{ site: 'baize.example' }} />
```

Where `page.json` is whatever your CMS writes:

```json
{
  "sections": [
    {
      "id": "header",
      "type": "listing-header",
      "props": { "title": "Brass: Birmingham" }
    }
  ]
}
```

## The registry

`defineWidgets` returns the object it is handed. Its whole job is the generic
parameter: annotating the same object as `WidgetRegistry` widens its keys to
`string`, and the key union is what an editor completes on and what
`validateItems` narrows a `required` map against.

<!-- #region registry -->

```ts @import.meta.vitest
import { defineWidgets, validateItems } from '@evanion/astro-widget';

// In a project these are `.astro` modules; the helper reads their keys and
// nothing else, so a stand-in is enough to show what it returns.
const registry = defineWidgets({
  'listing-header': () => null,
  'game-grid': () => null,
});

Object.keys(registry); // -> ['listing-header', 'game-grid']
validateItems([], Object.keys(registry)); // -> []
```

<!-- #endregion registry -->

## Data shape

```ts
interface AnyWidgetItem<Type extends string = string, Props = object> {
  id: string;
  type: Type; // must be a key in the registry
  props: Props; // spread into the component
  meta?: Record<string, unknown>; // placement, read by the chrome
  children?: AnyWidgetItem[];
}
```

`id` is required, and `props` is a named field rather than "every key the
renderer does not claim for itself". A renderer's own fields would otherwise be
reserved words in the CMS's vocabulary, and adding one later would take a prop
away from every payload already written.

## Validation

`Widgets` skips a type the registry does not hold, with a dev-only
`console.warn`, so a bad CMS save can never break a render. Catch them loudly at
build time instead:

<!-- #region validate -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const sections = [
  {
    id: 'header',
    type: 'listing-header',
    props: { title: 'Brass: Birmingham' },
  },
  { id: 'price', type: 'price-box', props: {} },
  { id: 'questions', type: 'answer-wall', props: {} },
];

const required = { 'listing-header': ['title'] };
const problems = validateItems(
  sections,
  ['listing-header', 'price-box'],
  required,
);

problems; // -> [{ index: 2, id: 'questions', type: 'answer-wall', message: 'unknown widget type' }]
```

<!-- #endregion validate -->

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

validateItems(nested, ['game-grid']); // -> [{ index: 0, id: 'questions', type: 'answer-wall', message: 'unknown widget type' }]
```

<!-- #endregion nested-index -->

The five structural rules run over every payload, whatever the registry holds.
Each one is a save a CMS can make and a build should not ship:

<!-- #region structural-rules -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const saved = [
  null,
  { type: 'listing-header', props: { title: 'Root' } },
  { id: 'grid', type: 'game-grid', props: {}, children: 'none' },
  { id: 'grid', type: 'game-grid' },
];

validateItems(saved, ['listing-header', 'game-grid']).map((p) => p.message); // -> ['item is not an object', 'item id is not a string', 'children is not a list', 'duplicate sibling id', 'props is not an object']
```

<!-- #endregion structural-rules -->

An `items` that is not a list is one problem rather than none, because a CMS
that wrote an object where the schema said array has broken the page and a
clean run would say it had not:

<!-- #region not-a-list -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

validateItems({ sections: [] }, ['listing-header']); // -> [{ index: -1, id: '-', type: '-', message: 'items is not a list' }]
```

<!-- #endregion not-a-list -->

A payload with nothing wrong reports nothing. `validateItems` returns a list,
never throws, and never short-circuits, so one run over the whole page is one
build failure with every fault in it:

<!-- #region clean-payload -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const page = [
  { id: 'header', type: 'listing-header', props: { title: 'Root' } },
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
const problems = validateItems(page, ['listing-header', 'game-grid'], required);

problems; // -> []
```

<!-- #endregion clean-payload -->

Run it over the CMS payload before the build renders it:

```js
const problems = validateItems(page.sections, registry, {
  'listing-header': ['title'],
});
if (problems.length) {
  for (const p of problems)
    console.error(`section ${p.index} (${p.id}, ${p.type}): ${p.message}`);
  process.exit(1);
}
```

`index` is scoped to whatever level of the tree it was found at: a problem in a
top-level section and a problem in one of its `children` can both report
`index: 0`, meaning different things. `id` is what tells them apart.

## Chrome

Wrap every widget without each widget reimplementing section markup:

```astro
<Widgets items={items} registry={registry} chrome={{ item: Section }} />
```

`Section` receives the item's `type`, `id` and `meta` — never its `props`, which
are the widget's own business — and **must render `<slot />`**. If it doesn't,
Astro silently drops the wrapped widget: no error, no warning, the section just
vanishes from the page.

## Nesting

The renderer does **not** recurse. `children` on an item is forwarded to its
widget as ordinary prop data, nothing more — Astro projects child content
through `<slot />`, never through a `children` prop. A widget that wants to
render its own nested sections must do so itself:

```astro
---
// GameGrid.astro
import Widgets from '@evanion/astro-widget/components/Widgets.astro';
import { registry } from '../registry';
const { children } = Astro.props;
---
<Widgets items={children} registry={registry} />
```

## Differences from @evanion/react-widget

|                         | react-widget                    | astro-widget                                                                                      |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| Provider / `useWidgets` | yes                             | **no** — build-time rendering has nothing to provide; use `ctx`                                   |
| Prop type inference     | inferred from the component map | **no** — Astro components are opaque at the type level. Use `validateItems`                       |
| Nested `children`       | rendered as the widget's own    | **no recursion** — a widget must render `<Widgets items={children} registry={registry} />` itself |
| Region chrome           | `chrome.wrapper`                | **none** — a wrapper the library supplied would be markup you did not ask for                     |

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
per section type — `"listing-header"` on every listing header — or an empty string where an
left the field alone now fails a build that passed before. Ids only have to be
unique within one sibling list, so the same id at two depths is still fine.

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

`id ?? …` is the awkward half. A widget item needs an id — as the key, as the
identity in a warning, and as what the duplicate-sibling check is about — and a
CMS with no per-section id has to supply one. An index-derived value is fine as
long as it is stable across renders.

`chrome.item` no longer receives the item's props, only `type`, `id` and `meta`.
Under the old shape "props" meant everything the renderer did not claim, so
handing them to the chrome was nearly free; now they are the widget's data and
the chrome has no business with them.

## Licence

MIT
