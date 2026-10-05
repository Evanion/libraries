# @evanion/astro-widget

**Build-time, zero-JS widget regions for Astro.**

Stop shipping heavy client-side bundles for layouts that don't change after the page is built. `@evanion/astro-widget` allows you to render complex, CMS-driven widget regions during the Astro build process, shipping only pure HTML to the browser.

## The Problem: The "Runtime Layout" Tax

When you use dynamic layouts in a traditional React or Vue app, the browser has to:
1. Download the JavaScript bundle.
2. Execute the layout logic.
3. Map the data to components and render them.

This "runtime tax" results in larger bundles, slower Time to Interactive (TTI), and a flash of unstyled content (FOUC) if not handled perfectly. For content-heavy pages (like a product listing or a blog), this is an unnecessary cost.

## The Solution: Zero-JS Build-Time Rendering

@evanion/astro-widget shifts the layout logic from the browser to the Astro build process. It uses the same item shape as the rest of the ecosystem, but instead of rendering in the browser, it renders each widget into static HTML during the build.

The result: your users get a fully rendered, structured page instantly, with **zero JavaScript** sent for the layout logic.

### Core Concept: The Static Region

```tsx @import.meta.vitest
import Widgets from '@evanion/astro-widget/components/Widgets.astro';
import { registry } from './registry';

const items = [
  {
    id: 'header',
    type: 'listing-header',
    props: { title: 'Brass: Birmingham', players: '2-4' },
  },
  { id: 'price', type: 'price-box', props: { price: '649 kr' } },
];

// Rendered at build time; ships only pure HTML to the browser.
<Widgets items={items} registry={registry} />
```

### Structural Rules (The "Loud Gate")
To prevent CMS errors from crashing your build, you can run `validateItems` as a "loud gate" in your CI pipeline.

<!-- #region structural-rules -->
```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const items = [
  { id: 'faulty', type: 'unknown-type', props: {} },
];

const known = ['listing-header', 'price-box'];
validateItems(items, known);
// problems contains the error for 'unknown-type'
```
<!-- #endregion structural-rules -->


### Why this is better:
- 🚀 **Instant Load**: No client-side JS is required to figure out which component to render.
- 📉 **Tiny Bundles**: Layout logic stays on the server, reducing the amount of code shipped to the user.
- 🛡️ **Safe-by-Default**: Because it's a build-time process, you can run a "loud gate" via `validateItems` in your CI pipeline to catch CMS errors before they ever reach production.
- 🧩 **Universal Data**: Uses the same item array as `@evanion/react-widget`, allowing you to share layouts between a static Astro site and a dynamic React app.

## Installation

```bash
npm install @evanion/astro-widget
```

Astro `^7.3.4` is a peer dependency.

## Beyond the Basics

Static rendering doesn't mean static logic. Our documentation covers how to handle complex layouts in Astro:

- **Nested Regions**: How to build widgets that render their own nested `<Widgets />` regions.

<!-- #region nested-index -->
```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const items = [
  {
    id: 'grid',
    type: 'game-grid',
    props: { title: 'Stats' },
    children: [
      { id: 'u1', type: 'unknown-type', props: {} },
    ],
  },
];

validateItems(items, ['game-grid']);
```
<!-- #endregion nested-index -->

- **Build-Time Validation**: Setting up a CI script to fail the build if a CMS payload contains unknown types or missing fields.

<!-- #region not-a-list -->
```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const items = { id: 'not-a-list', type: 'game-grid' };

validateItems(items, ['game-grid']);
```
<!-- #endregion not-a-list -->

- **The Container API**: Using `experimental_AstroContainer` to render widgets outside of a standard `.astro` page.

<!-- #region nested-registry -->
```ts @import.meta.vitest
import { validateItems } from '@evanion/astro-widget';

const items = [
  {
    id: 'grid',
    type: 'game-grid',
    props: { title: 'Stats' },
    children: [
      { id: 'u1', type: 'game-card', props: { label: 'L', value: '1' } },
    ],
  },
];

validateItems(items, { 'game-grid': {}, 'game-card': {} });
```
<!-- #endregion nested-registry -->

- **Comparison with React**: Understanding the architectural differences between build-time and runtime rendering.

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/astro-widget](https://docs.evanion.com/astro-widget)**

## License
MIT
