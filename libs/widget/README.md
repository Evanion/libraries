# @evanion/widget

**Framework-agnostic structural validation for data-driven layouts.**

Stop hard-coding complex UI layouts with endless `if` statements and conditional rendering. `@evanion/widget` allows you to move the "what" and "where" of your UI into the data layer, transforming your components into a flexible system of widgets that can be reconfigured per user, per role, or per region without changing a single line of code.

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

This approach is fragile, hard to test, and requires a full deployment every time a business requirement changes. It turns your layout logic into a tangled web of "if-this-then-that."

## The Solution: Layouts as Data

Instead of hard-coding the layout, `@evanion/widget` treats your UI as a structured list of items. Each item names a component (`type`) and provides its configuration (`props`). 

The library provides the structural "glue"—the registry and the validator—that ensures your data-driven layout is sound before it ever hits the renderer. This allows you to serve completely different layouts to different users by simply changing the JSON payload.

### Core Concept: The Validated Region

```ts @import.meta.vitest
import { validateItems } from '@evanion/widget';
import type { AnyWidgetItem } from '@evanion/widget';

// A layout defined in the data layer
const userDashboard: AnyWidgetItem[] = [
  {
    id: 'welcome',
    type: 'greeting',
    props: { name: 'Alex' },
  },
  {
    id: 'main-stats',
    type: 'metrics-grid',
    props: { source: 'sales-api' },
    children: [
      { id: 'leads', type: 'metric', props: { label: 'New Leads', value: '12' } },
      { id: 'conversion', type: 'metric', props: { label: 'Rate', value: '3.2%' } },
    ],
  },
];

// Validate the payload against your known widget types
const problems = validateItems(userDashboard, ['greeting', 'metrics-grid', 'metric']);

// If problems is empty, the layout is structurally sound and ready to render.
problems; // -> []
```

## Key Features

- 🏗️ **Data-Driven Orchestration**: Move the logic of "who sees what" from your JSX into your database or CMS.
- 🛡️ **Structural Integrity**: Catch unknown types, missing required props, and duplicate IDs at the edge, preventing "invisible" components or runtime crashes.
- 🌍 **Framework-Agnostic**: No dependencies on React, Astro, or Vue. It handles the *structure*; you provide the *renderer*.
- 🧩 **Recursive Nesting**: Naturally supports complex, nested layouts (grids within tabs within sections) with full validation at every level.
- 🪶 **Zero Runtime Bloat**: A lightweight validator that runs in a build script, a webhook, or a serverless function.

## Installation

```bash
npm install @evanion/widget
```

**Note**: This is the core logic. To actually render these widgets, install the renderer for your framework:
- For React: `npm install @evanion/react-widget`
- For Astro: `npm install @evanion/astro-widget`

## Beyond the Basics

Defining a list is the first step. Our documentation covers how to build a professional widget ecosystem:

- **The Registry Pattern**: Using `defineWidgets` to create a type-safe map of your components.
- **Required Field Mapping**: Ensuring that a "Metric" widget always has a label and a value before it's allowed on the page.
- **Meta-Data Placement**: Using the `meta` field to handle layout concerns (like grid spans) without polluting your component props.
- **Handling Stale Types**: Gracefully managing the transition when a widget type is renamed in your data layer.

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/widget](https://docs.evanion.com/widget)**

## License
MIT
