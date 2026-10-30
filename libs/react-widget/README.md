# @evanion/react-widget

**Decide what a view shows in your logic layer.**

Views with optional sections often fill with `{flag && <Section />}` branches. `@evanion/react-widget` moves those decisions into a plain function that returns a list of items. The view renders that list without branching, and the logic function remains ordinary TypeScript that you can unit test without rendering. These sections can be decided by a feature flag, a user's role, the record's state, tenant settings, or a CMS.

<!-- #region region-markup -->

```tsx @import.meta.vitest
const Summary = (props: { number: string }) => <h2>Order {props.number}</h2>;
const Returns = (props: { daysLeft: number }) => (
  <p>Return within {props.daysLeft} days</p>
);
const StaffNotes = (props: { note: string }) => <aside>{props.note}</aside>;

const { Widgets, defineItems } = createWidgets({
  components: { summary: Summary, returns: Returns, notes: StaffNotes },
});

interface Order {
  number: string;
  daysLeft: number;
  note: string;
}

// The logic layer decides which sections the view shows, and in what order.
function sectionsFor(
  order: Order,
  flags: { returns: boolean },
  staff: boolean,
) {
  const shown: Record<string, boolean> = {
    returns: flags.returns,
    notes: staff,
  };
  return defineItems([
    { id: 'summary', type: 'summary', props: { number: order.number } },
    { id: 'returns', type: 'returns', props: { daysLeft: order.daysLeft } },
    { id: 'notes', type: 'notes', props: { note: order.note } },
  ]).filter((item) => shown[item.id] ?? true);
}

const order = { number: '1042', daysLeft: 14, note: 'Box was dented' };

// Testable as data, without rendering.
sectionsFor(order, { returns: false }, true).map((item) => item.id); // -> ['summary', 'notes']

// The view renders whatever the logic decided.
const customer = sectionsFor(order, { returns: true }, false);
const html = renderToStaticMarkup(<Widgets items={customer} />); // -> '<section><div data-widget-id="summary" data-widget-type="summary"><h2>Order 1042</h2></div><div data-widget-id="returns" data-widget-type="returns"><p>Return within 14 days</p></div></section>'
```

<!-- #endregion region-markup -->

## Capabilities of @evanion/react-widget

- **Logic-Layer Composition**: Flags, roles and record state pick the sections in a function; the view only renders the result.
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

👉 **[libs.evanion.com/docs/react-widget](https://libs.evanion.com/docs/react-widget/)**

## License

MIT
