# @evanion/astro-widget

**Move your UI layout into the data layer and render it with Astro, with props checked by validateItems before an Astro build.**

By describing your UI as data rather than hard-coding conditional logic, you eliminate the fragile `if` statements typically used to manage complex layouts. `@evanion/astro-widget` brings this approach to the Astro ecosystem, shifting the layout logic to the server—during `astro build` for static pages or on each request for on-demand pages—to ship only HTML and zero client-side JavaScript to the browser.

To see how the library ensures your layout data is correct before it reaches the page, consider this example of validating a widget region:

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

## Capabilities of @evanion/astro-widget

The package allows you to build structured, content-heavy pages without the overhead of client-side layout engines:

- **Zero Layout JS**: No client-side JavaScript is required to decide which component renders an item.
- **Tiny Bundles**: By keeping layout logic on the server, the amount of code shipped to the user is reduced.
- **CI Safety**: Use `validateItems` as a "loud gate" in your CI pipeline to catch CMS errors before they reach production.
- **Universal Data**: Share layouts between a static Astro site and a dynamic React app by using the same item array as `@evanion/react-widget`.

## Requirements and Installation

`@evanion/astro-widget` is ESM only and requires Node 22.12 or newer. It requires Astro `^7.3.4` as a peer dependency and includes `@evanion/widget` as a pinned, re-exported dependency.

```bash
npm install @evanion/astro-widget
```

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/astro-widget](https://docs.evanion.com/astro-widget/)**

## License

MIT
