# @evanion/astro-widget

**Zero-JS widget regions for Astro, rendered on the server.**

Stop shipping heavy client-side bundles for layouts that don't change after the page is built. `@evanion/astro-widget` renders CMS-driven widget regions when Astro renders the page—during `astro build` for a static page and on each request for a page Astro renders on demand—and ships only HTML to the browser.

## The Problem: The "Runtime Layout" Tax

When you use dynamic layouts in a traditional React or Vue app, the browser has to:

1. Download the JavaScript bundle.
2. Execute the layout logic.
3. Map the data to components and render them.

This "runtime tax" results in larger bundles and slower Time to Interactive (TTI). For content-heavy pages (like a product listing or a blog), this is an unnecessary cost.

## The Solution: Zero-JS Server Rendering

`@evanion/astro-widget` shifts the layout logic from the browser to Astro's render. It uses the same item shape as the rest of the ecosystem, but instead of rendering in the browser, it renders each widget into HTML on the server.

The result: your users get a fully rendered, structured page, with **zero JavaScript** sent for the layout logic.

### Core Concept: The Static Region

To render these regions, a page writes `<Widgets items={items} registry={registry} />`. Before a payload reaches it, `validateItems` checks the saved items against the widget types the registry knows and the fields each one requires, returning one problem per item a render would skip or draw empty. The following block runs in the package's test suite, with `// ->` indicating the returned value.

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

## Key Features

- 🚀 **No Layout JS**: No client-side JavaScript decides which component renders an item.
- 📉 **Tiny Bundles**: Layout logic stays on the server, reducing the amount of code shipped to the user.
- 🛡️ **Safe-by-Default**: You can run a "loud gate" via `validateItems` in your CI pipeline to catch CMS errors before they ever reach production.
- 🧩 **Universal Data**: Uses the same item array as `@evanion/react-widget`, allowing you to share layouts between a static Astro site and a dynamic React app.
- 📦 **Lightweight**: Astro `^7.3.4` is the only peer dependency, and `@evanion/widget` is pinned as a dependency and re-exported. The package is ESM only and needs Node 22.12 or newer.

## Installation

```bash
npm install @evanion/astro-widget
```

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/astro-widget](https://docs.evanion.com/astro-widget/)**

## License

MIT
