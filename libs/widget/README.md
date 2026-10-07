# @evanion/widget

**Framework-agnostic structural validation for data-driven layouts.**

Stop hard-coding complex UI layouts with endless `if` statements and conditional rendering. `@evanion/widget` allows you to move the "what" and "where" of your UI into the data layer, transforming your components into a flexible system of widgets that can be reconfigured per user, per role, or per region.

## The Problem: The "Conditional Logic" Explosion

When you build complex, role-based views—like a dashboard that looks different for a Customer, a Salesperson, and an Admin—your code quickly devolves into a mess of conditional toggles:

```tsx
return (
  <div>
    {user.role === 'customer' && <FavoritesList />}
    {user.role === 'sales' && <LeadsTable />}
    {user.role === 'admin' && <SystemHealth />}
    {hasNotification && <NotificationCenter />}
    {/* ...and 20 more of these ... */}
  </div>
);
```

This approach is fragile, hard to test, and requires a full deployment every time a business requirement changes.

## The Solution: Layouts as Data

Instead of hard-coding the layout, `@evanion/widget` treats your UI as a structured list of items. Each item names a component (`type`) and provides its configuration (`props`).

The library provides the structural "glue"—the registry and the validator—that ensures your data-driven layout is sound before it ever hits the renderer.

### Core Concept: The Validated Region

To catch items that cannot be rendered after a type change, use `validateItems`. This function compares saved items against the types your renderer supports and returns a problem for every item that would be skipped. The following example runs in the package's test suite; each `// ->` comment indicates the expression's return value.

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

## Key Features

- 🏗️ **Data-Driven Orchestration**: Move the logic of "who sees what" from your JSX into your database or CMS.
- 🛡️ **Structural Integrity**: Catch unknown types, missing required props, and duplicate IDs at the edge, before a renderer silently skips a widget or draws it empty.
- 🌍 **Framework-Agnostic**: No dependencies on React, Astro, or Vue. It handles the _structure_; you provide the _renderer_.
- 🧩 **Recursive Nesting**: Naturally supports complex, nested layouts (grids within tabs within sections) with full validation at every level.
- 📦 **Zero Dependencies**: The package has no runtime or peer dependencies, ships its own types, is ESM only, and requires Node 20 or newer.

## Installation

```bash
npm install @evanion/widget
```

**Note**: This is the core logic. To actually render these widgets, install the renderer for your framework:

- For React: `npm install @evanion/react-widget`
- For Astro: `npm install @evanion/astro-widget`

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/widget](https://docs.evanion.com/widget/)**

## License

MIT
