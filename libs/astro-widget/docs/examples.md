# @evanion/astro-widget examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## The Solution: Zero-JS Build-Time Rendering

### Core Concept: The Static Region

<!-- #region overview -->

```ts @import.meta.vitest
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Widgets from '@evanion/astro-widget/components/Widgets.astro';

import { registry } from '../examples/src/registry';

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

## Rendering a Page from CMS Data

<!-- #region first-render -->

```ts @import.meta.vitest
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

import BrassBirmingham from '../examples/src/pages/brass-birmingham.astro';

const container = await AstroContainer.create();
const html = await container.renderToString(BrassBirmingham);

html; // -> '<main><header><h1>Brass: Birmingham</h1><p>2-4 players</p></header><p class="price">649 kr</p></main>'
```

<!-- #endregion first-render -->

## Validation: The "Loud Gate"

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

```ts @import.meta.vitest
await import('../examples/scripts/check-content');
```

<!-- #region known-types -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

import { items } from '../examples/src/data/brass-birmingham';
import { registry } from '../examples/src/registry';

Object.keys(registry); // -> ['listing-header', 'price-box']
validateItems(items, registry); // -> []
validateItems(items, ['listing-header', 'price-box']); // -> []
```

<!-- #endregion known-types -->

### Required Props

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

<!-- #region not-a-list -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

validateItems({ items: [] }, ['listing-header']); // -> [{ index: -1, id: '-', type: '-', message: 'items is not a list' }]
```

<!-- #endregion not-a-list -->

### Nested Registries

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

<!-- #region ctx-and-chrome -->

```ts @import.meta.vitest
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Widgets from '@evanion/astro-widget/components/Widgets.astro';

import Section from '../examples/src/chrome/Section.astro';
import Stock from '../examples/src/widgets/Stock.astro';

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

<!-- #region nested -->

```ts @import.meta.vitest
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Widgets from '@evanion/astro-widget/components/Widgets.astro';

import GameGrid from '../examples/src/widgets/GameGrid.astro';

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

<!-- #region skip-unknown -->

```ts @import.meta.vitest
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Widgets from '@evanion/astro-widget/components/Widgets.astro';
import { ERROR_MESSAGES } from '@evanion/astro-widget';

import { registry } from '../examples/src/registry';

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
