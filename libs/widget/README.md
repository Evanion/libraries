# @evanion/widget

**Move your UI layout into the data layer to eliminate conditional rendering logic.**

When building role-based views—such as dashboards that differ for Customers, Salespeople, and Admins—code often devolves into a fragile mess of `if` statements and conditional toggles. `@evanion/widget` solves this by treating your UI as a structured list of items, moving the "what" and "where" of your layout into your database or CMS.

To see how `@evanion/widget` ensures your data-driven layout is sound before it hits the renderer, consider a scenario where a widget type has been renamed in your CMS but not yet in your code:

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

## Capabilities of @evanion/widget

The library provides the structural "glue"—the registry and the validator—to manage the following:

- **Data-Driven Orchestration**: Shift the logic of "who sees what" from JSX into your data layer.
- **Structural Integrity**: Catch unknown types, missing required props, and duplicate IDs at the edge before a renderer silently skips a widget.
- **Recursive Nesting**: Support complex, nested layouts (such as grids within tabs) with full validation at every level.
- **Framework-Agnostic Design**: Handle the structure independently of your UI framework; you provide the renderer.

## Installation

`@evanion/widget` is ESM only, requires Node 20 or newer, and has zero runtime or peer dependencies.

```bash
npm install @evanion/widget
```

To render these widgets, install the renderer for your specific framework:

- For React: `npm install @evanion/react-widget`
- For Astro: `npm install @evanion/astro-widget`

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/widget](https://docs.evanion.com/widget/)**

## License

MIT
