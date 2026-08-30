# @evanion/astro-widget

Render CMS-driven Astro sections from structured block data. Build-time only —
no runtime, no hydration, nothing shipped to the browser.

The Astro counterpart to [`@evanion/react-widget`](../widget).

## Install

```bash
npm install @evanion/astro-widget
```

Astro `>=5` is a peer dependency.

## Use

```ts
// src/registry.ts
import { defineBlocks } from '@evanion/astro-widget';
import Hero from './blocks/Hero.astro';
import Cards from './blocks/Cards.astro';

export const registry = defineBlocks({ hero: Hero, cards: Cards });
```

```astro
---
import Widgets from '@evanion/astro-widget/components/Widgets.astro';
import { registry } from '../registry';
import page from '../data/page.json';
---
<Widgets items={page.sections} registry={registry} ctx={{ site: 'example.com' }} />
```

Where `page.json` is whatever your CMS writes:

```json
{ "sections": [{ "type": "hero", "heading": "Hello" }] }
```

## Data shape

```ts
interface BlockItem {
  type: string;          // must be a key in the registry
  id?: string;           // optional, useful as a DOM anchor
  children?: BlockItem[];
  [key: string]: unknown; // everything else becomes props
}
```

## Validation

`Widgets` **skips unknown block types silently** so a bad CMS save can never
break a render. Catch them loudly at build time instead:

```js
import { validateBlocks } from '@evanion/astro-widget';

const problems = validateBlocks(page.sections, registry, { hero: ['heading'] });
if (problems.length) {
  for (const p of problems) console.error(`section ${p.index} (${p.type}): ${p.message}`);
  process.exit(1);
}
```

`index` is scoped to whatever level of the tree it was found at: a problem in
a top-level section and a problem in one of its `children` can both report
`index: 0`, meaning different things. Use `type` and `message` together with
`index` to disambiguate, or walk `children` yourself if you need an
unambiguous path to the offending block.

## Chrome

Wrap every block without each block reimplementing section markup:

```astro
<Widgets items={items} registry={registry} chrome={{ item: Section }} />
```

`Section` receives the block's `type` and props, and **must render
`<slot />`**. If it doesn't, Astro silently drops the wrapped block — no
error, no warning, the section just vanishes from the page.

## Nesting

The renderer does **not** recurse. `children` on a `BlockItem` is forwarded
to its block as ordinary prop data, nothing more — Astro projects child
content through `<slot />`, never through a `children` prop. A block that
wants to render its own nested sections must do so itself:

```astro
---
// Cards.astro
import Widgets from '@evanion/astro-widget/components/Widgets.astro';
import { registry } from '../registry';
const { children } = Astro.props;
---
<Widgets items={children} registry={registry} />
```

## Differences from @evanion/react-widget

| | react-widget | astro-widget |
|---|---|---|
| Provider / `useWidgets` | yes | **no** — build-time rendering has nothing to provide; use `ctx` |
| Prop type inference | inferred from the component map | **no** — Astro components are opaque at the type level. Use `validateBlocks` |
| Nested `children` | `<Output />` outlet | **no recursion** — a block must render `<Widgets items={children} registry={registry} />` itself |

## Licence

MIT
