# @evanion/react-widget

**Move your UI layout into the data layer to eliminate conditional rendering logic, with props checked at compile time.**

By describing your UI as data rather than hard-coding conditional logic, you eliminate the fragile mapping of type strings to components that often leads to runtime crashes when data is missing. `@evanion/react-widget` brings this approach to the React ecosystem, ensuring your dynamic dashboards and landing pages are robust by checking component props at compile time.

<!-- #region region-markup -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string; price: number }) => (
  <h3>
    {props.title}, {props.price} kr
  </h3>
);

// 1. Create a typed widget set from the component map
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
const html = renderToStaticMarkup(<Widgets items={shelf} />); // -> '<section><div data-widget-id="brass" data-widget-type="listing"><h3>Brass: Birmingham, 649 kr</h3></div></section>'
```

<!-- #endregion region-markup -->

## Capabilities of @evanion/react-widget

- **Compile-Time Safety**: TypeScript catches mismatched props or unknown widget types during development.
- **Server Component Ready**: Importable from a React Server Component (RSC) without requiring a `'use client'` boundary.
- **Recursive Nesting**: Supports nested widgets (such as a "Shelf" containing "Listing" widgets) with full type-safety for children.
- **Placement vs. Content**: Separates layout metadata (`meta`) from component props.
- **Dependency-Light**: Requires only React 18 or 19 as a peer dependency. The package is ESM only and requires Node 20 or newer.

## Installation

```bash
npm install @evanion/react-widget
```

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/react-widget](https://docs.evanion.com/react-widget/)**

## License

MIT
