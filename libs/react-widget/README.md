# @evanion/react-widget

**Type-safe, dynamic React widget regions from structured data.**

Stop fighting with `any` types and runtime crashes when rendering CMS-driven layouts. `@evanion/react-widget` allows you to map structured JSON data to React components with compile-time prop safety, ensuring that your dynamic dashboards, sidebars, and landing pages are robust and maintainable.

## The Problem: The "Untyped Layout" Fragility

When your UI is driven by a CMS or a database, you typically map a `type` string (like `"listing"`) to a component. This creates several risks:
1. **Runtime Surprises**: A CMS editor changes a field name or misses a required prop, and your component crashes the entire page because it expected a string but got `undefined`.
2. **Implicit Contracts**: The "contract" between the data and the component exists only in the editor's head, making it impossible for developers to know exactly what props a widget needs without digging through the code.
3. **Component Over-Fetching**: Passing a generic "props" object to every component makes it hard to track which data is actually required for a specific layout.

## The Solution: Type-Safe Widget Regions

`@evanion/react-widget` creates a strict link between your component map and your data. By using a shared registry, the library ensures that an item of type `"listing"` is only rendered if it carries the exact props the `ListingCard` component expects.

### Core Concept: The Typed Region

```tsx @import.meta.vitest
import { createWidgets } from '@evanion/react-widget';

const ListingCard = (props: { title: string; price: number }) => (
  <h3>{props.title}, {props.price} kr</h3>
);

// 1. Create a typed registry
const { Widgets, defineItems } = createWidgets({
  components: { listing: ListingCard },
});

// 2. Define items with compile-time prop checking
const shelf = defineItems([
  {
    id: 'brass',
    type: 'listing',
    props: { title: 'Brass: Birmingham', price: 649 },
  },
]);

// 3. Render the region
const html = renderToStaticMarkup(<Widgets items={shelf} />);
```

### Why this is better:
- 🎯 **Compile-Time Safety**: Mismatched props or unknown widget types are caught by TypeScript during development, not by users in production.
- ⚡ **Server Component Ready**: Designed for the modern React era. It's importable from a React Server Component (RSC) without needing a `'use client'` boundary.
- 🧩 **Recursive Nesting**: Naturally supports nested widgets (e.g., a "Shelf" widget containing multiple "Listing" widgets) with full type-safety for children.
- 🎨 **Placement vs. Content**: Separates layout metadata (`meta`) from component props, so your widgets don't need to know where they are positioned on the page.

## Installation

```bash
npm install @evanion/react-widget
```

## Beyond the Basics

Creating a basic list is simple, but production layouts often require more control. Our documentation covers advanced patterns, including:

- **Custom Chrome**: Replacing the default `<section>` and `<div>` wrappers with your own custom layout components.
- **Optimizing Suspense**: Managing `<Suspense>` boundaries to prevent a single slow widget from blocking the entire page render.
- **Dynamic Overrides**: Overriding a widget component on a per-instance basis for special "featured" items.
- **Ingestion Validation**: Using `validateItems` to sanitize untrusted CMS payloads before they reach your components.

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/react-widget](https://docs.evanion.com/react-widget)**

## License
MIT
