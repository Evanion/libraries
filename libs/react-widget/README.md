# @evanion/react-widget

**Type-safe, dynamic React widget regions from structured data.**

Stop fighting with `any` types and runtime crashes when rendering CMS-driven layouts. `@evanion/react-widget` allows you to map structured JSON data to React components with compile-time prop safety, ensuring that your dynamic dashboards, sidebars, and landing pages are robust and maintainable.

The item shape, the registry and the validator come from [`@evanion/widget`](https://www.npmjs.com/package/@evanion/widget), which this package pins exactly and re-exports, so installing this one package is enough. [`@evanion/astro-widget`](https://www.npmjs.com/package/@evanion/astro-widget) renders the same items in Astro, at build time.

## Map a CMS `type` to a component

When your UI is driven by a CMS or a database, you typically map a `type` string (like `"listing"`) to a component. This creates two risks:

1. **Runtime Surprises**: A CMS editor changes a field name or misses a required prop, and your component crashes the entire page because it expected a string but got `undefined`.
2. **Implicit Contracts**: The "contract" between the data and the component exists only in the editor's head, making it impossible for developers to know exactly what props a widget needs without digging through the code.

`@evanion/react-widget` creates a strict link between your component map and your data. TypeScript accepts an item of type `"listing"` only when it carries the props the `ListingCard` component declares. Data that never met the compiler, such as a CMS payload, goes through `validateItems` instead.

### Core Concept: The Typed Region

The examples in this README leave out three imports: `import * as React from 'react'`, `import { renderToStaticMarkup, renderToString } from 'react-dom/server'` and `import { createWidgets, DefaultItem, DefaultWrapper } from '@evanion/react-widget'`. The string in the `// ->` comment is the markup the region produced. The docs site renders a block that has a `// ---cut---` line from that line down, and the lines above it declare what the block needs to compile:

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

The `<section>` is the region's default wrapper, and the `<div>` around each widget carries the item's `id` and `type`, so a widget is findable in the DOM without rendering the attributes itself. Items render in the order the array reads.

Call `createWidgets` once, at module scope. It returns a new `Widgets` component on every call, so calling it inside a component remounts the region on every render.

### What the package checks

- **Compile-Time Safety**: Mismatched props, unknown widget types, and `children` on a component that does not accept them are caught by TypeScript during development, not by users in production.
- **Server Component Ready**: Designed for the modern React era. It's importable from a React Server Component (RSC) without needing a `'use client'` boundary, because it uses only `createElement`, `Suspense` and `memo`. A widget can be an async Server Component that fetches its own data.
- **Recursive Nesting**: Naturally supports nested widgets (e.g., a "Showcase" widget containing multiple "Listing" widgets) with full type-safety for children.
- **Placement vs. Content**: Separates layout metadata (`meta`) from component props, so your widgets don't need to know where they are positioned on the page.

## Installation

```bash
npm install @evanion/react-widget
```

React 18 or 19 is the only peer dependency. The package needs Node 20 or newer and ships as an ES module only, with no CommonJS build.

## Beyond the Basics

Creating a basic list is simple, but production layouts often require more control. The sections below cover the advanced patterns, including:

- **Custom Chrome**: Replacing the default `<section>` and `<div>` wrappers with your own custom layout components.
- **Optimizing Suspense**: Managing `<Suspense>` boundaries to prevent a single slow widget from blocking the entire page render.
- **Dynamic Overrides**: Overriding a widget component on a per-instance basis for special "featured" items.
- **Ingestion Validation**: Using `validateItems` to check untrusted CMS payloads before they reach your components.

For the guided walkthrough, visit the documentation site:

👉 **[docs.evanion.com/react-widget](https://docs.evanion.com/react-widget)**

## Typing Items Held in a Variable

An array written inline in `<Widgets items={…}>` is checked against the component map. An array held in a variable is not: TypeScript widens its `type` to `string`, which cannot narrow to the map's keys, so `Widgets` refuses it. `defineItems` is an identity function that supplies the type:

<!-- #region typed-items -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string; price: number }) => (
  <h3>
    {props.title}, {props.price} kr
  </h3>
);

const { Widgets, defineItems } = createWidgets({
  components: { listing: ListingCard },
});

const shelf = defineItems([
  { id: 'root', type: 'listing', props: { title: 'Root', price: 499 } },
]);

// @ts-expect-error 'raffle' is not a key of the component map
defineItems([{ id: 'raffle', type: 'raffle', props: {} }]);

const html = renderToStaticMarkup(<Widgets items={shelf} />); // -> '<section><div data-widget-id="root" data-widget-type="listing"><h3>Root, 499 kr</h3></div></section>'
```

<!-- #endregion typed-items -->

A component that declares no props takes `props: {}`, typed `Record<string, never>`, so an unexpected key is a compile error there too.

## Nesting Widgets

An item's `children` field holds nested items, and `Widgets` renders them as the parent component's `children` prop:

<!-- #region nesting -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
const Showcase = (props: { title: string; children?: React.ReactNode }) => (
  <div>
    <h2>{props.title}</h2>
    {props.children}
  </div>
);

const { Widgets, defineItems } = createWidgets({
  components: { showcase: Showcase, listing: ListingCard },
});

const tonight = defineItems([
  {
    id: 'tonight',
    type: 'showcase',
    props: { title: 'On the table tonight' },
    children: [{ id: 'hive', type: 'listing', props: { title: 'Hive' } }],
  },
]);

const html = renderToStaticMarkup(<Widgets items={tonight} />); // -> '<section><div data-widget-id="tonight" data-widget-type="showcase"><div><h2>On the table tonight</h2><div data-widget-id="hive" data-widget-type="listing"><h3>Hive</h3></div></div></div></section>'
```

<!-- #endregion nesting -->

`children` is permitted only when the mapped component declares a `children` prop, and typed `never` otherwise. Nesting under a widget that would drop the child items is a compile error:

<!-- #region nesting-rejected -->

```tsx @import.meta.vitest
const Showcase = (props: { title: string; children?: React.ReactNode }) => (
  <div>
    <h2>{props.title}</h2>
    {props.children}
  </div>
);

const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;

const { defineItems } = createWidgets({
  components: { showcase: Showcase, listing: ListingCard },
});
// ---cut---
defineItems([
  {
    id: 'azul',
    type: 'listing',
    props: { title: 'Azul' },
    // @ts-expect-error ListingCard declares no children, so nothing nests under it
    children: [{ id: 'hive', type: 'listing', props: { title: 'Hive' } }],
  },
]);
```

<!-- #endregion nesting-rejected -->

`Widgets` uses each item's `id` as its React key, and React keys each sibling list separately, so an `id` has to be unique among its siblings only.

## Ingestion Validation

`WidgetItem<C>` checks items at compile time. `validateItems` checks the data that never met the type checker: a CMS payload, a webhook body, a fixture on disk. The standalone export takes a list of type names, so a CI script imports no React component:

<!-- #region validate-payload -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/react-widget';

const payload: unknown = JSON.parse(
  '[{"id":"root","type":"listing","props":{"title":"Root"}},{"id":"raffle","type":"raffle","props":{}}]',
);

const problems = validateItems(payload, ['listing', 'booking']); // -> [{ index: 1, id: 'raffle', type: 'raffle', message: 'unknown widget type' }]
```

<!-- #endregion validate-payload -->

`validateItems` returns problems and never throws. It reports every problem, not only the first, and recurses into `children`. It reports a non-list root, a non-object item, a non-string `id` or `type`, an unknown `type`, missing or non-object `props`, non-list `children`, and duplicate sibling `id`s.

A nested item's `index` counts within its own sibling list, so the `id` is what finds it:

<!-- #region validate-nested -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/react-widget';

const payload: unknown = JSON.parse(
  '[{"id":"tonight","type":"showcase","props":{"title":"On the table tonight"},"children":[{"id":"hive","type":"listing","props":{"title":"Hive"}},{"id":"raffle","type":"raffle","props":{}}]}]',
);

const problems = validateItems(payload, ['showcase', 'listing']); // -> [{ index: 1, id: 'raffle', type: 'raffle', message: 'unknown widget type' }]
```

<!-- #endregion validate-nested -->

`createWidgets` returns a second form, bound to the component map, so it takes no list of names. Its optional argument maps a widget type to the props that must be present and non-blank, where blank means `undefined`, `null` or whitespace only. That is what a CMS text field that was opened and left empty arrives as:

<!-- #region validate-bound -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
const { validateItems } = createWidgets({
  components: { listing: ListingCard },
});

const payload: unknown = [
  { id: 'root', type: 'listing', props: { title: ' ' } },
];

const problems = validateItems(payload, { listing: ['title'] }); // -> [{ index: 0, id: 'root', type: 'listing', message: 'missing field title' }]
```

<!-- #endregion validate-bound -->

The standalone export takes the same map as its third argument. Neither form checks the names in the map against the component, so a misspelt name is reported as missing on every item of that type.

`validateItems` returns a list, not a type guard, so a payload that passes is still `unknown`. Cast it to the item type once the list is empty, and render no items for a payload that fails:

<!-- #region render-validated -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
import type { WidgetItem } from '@evanion/react-widget';

const components = { listing: ListingCard };

const { Widgets, validateItems } = createWidgets({ components });

function checked(payload: unknown): WidgetItem<typeof components>[] {
  const problems = validateItems(payload, { listing: ['title'] });

  return problems.length === 0
    ? (payload as WidgetItem<typeof components>[])
    : [];
}

const published: unknown = JSON.parse(
  '[{"id":"root","type":"listing","props":{"title":"Root"}}]',
);

const blank: unknown = JSON.parse(
  '[{"id":"root","type":"listing","props":{"title":" "}}]',
);

const shelf = renderToStaticMarkup(<Widgets items={checked(published)} />); // -> '<section><div data-widget-id="root" data-widget-type="listing"><h3>Root</h3></div></section>'
const gap = renderToStaticMarkup(<Widgets items={checked(blank)} />); // -> '<section></section>'
```

<!-- #endregion render-validated -->

The cast asserts the prop types, which `validateItems` does not check: a `title` of `42` passes it, because `42` is not blank. The `required` map guarantees that the props a widget cannot render without are there.

A component map declared on its own, so that `createWidgets`, an item type and a standalone `validateItems` share it, goes through `defineWidgets`, which returns it with its keys kept literal. The same stale type then fails the compile and the payload check:

<!-- #region define-widgets -->

```ts @import.meta.vitest
import { defineWidgets, validateItems } from '@evanion/react-widget';
import type { WidgetItem } from '@evanion/react-widget';

const ListingCard = (props: { title: string }) => props.title;

const components = defineWidgets({ listing: ListingCard });

// @ts-expect-error 'raffle' is not a key of components
const stale: WidgetItem<typeof components>['type'] = 'raffle';

const payload: unknown = [{ id: 'raffle', type: 'raffle', props: {} }];

const problems = validateItems(payload, components); // -> [{ index: 0, id: 'raffle', type: 'raffle', message: 'unknown widget type' }]
```

<!-- #endregion define-widgets -->

`Widgets` calls neither form. The renderer follows a "fail-soft" strategy: it skips an item it cannot render, warns in development, and renders the rest of the region:

<!-- #region skipped-item -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
const { Widgets } = createWidgets({ components: { listing: ListingCard } });

const payload = JSON.parse(
  '[{"id":"raffle","type":"raffle","props":{}},{"id":"root","type":"listing","props":{"title":"Root"}}]',
);

const html = renderToStaticMarkup(<Widgets items={payload} />); // -> '<section><div data-widget-id="root" data-widget-type="listing"><h3>Root</h3></div></section>'
```

<!-- #endregion skipped-item -->

The warning reads `Unknown widget type "raffle" for widget ID "raffle". Skipping render.` Each message is logged once per process, so a stale `type` reports once, not on every re-render and again on hydration. Nothing is logged when `NODE_ENV` is `production`.

## Custom Chrome

A widget set has two wrappers. `chrome.wrapper` goes around the whole region and receives the region's items beside its `children`. `chrome.item` goes around each widget and receives `data-widget-id`, `data-widget-type` and `meta`. The defaults, `DefaultWrapper` and `DefaultItem`, are exported, so a custom chrome can wrap one:

<!-- #region chrome -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
const { Widgets, defineItems } = createWidgets({
  components: { listing: ListingCard },
  chrome: {
    wrapper: (props) => <DefaultWrapper {...props} aria-label="New in" />,
    item: (props) => <DefaultItem {...props} className="slot" />,
  },
});

const shelf = defineItems([
  { id: 'azul', type: 'listing', props: { title: 'Azul' } },
]);

const html = renderToStaticMarkup(<Widgets items={shelf} />); // -> '<section aria-label="New in"><div data-widget-id="azul" data-widget-type="listing" class="slot"><h3>Azul</h3></div></section>'
```

<!-- #endregion chrome -->

Keep the `data-widget-*` attributes on the element. CMS click-to-edit overlays, analytics and E2E selectors key off them. `DefaultWrapper` drops `items` and `DefaultItem` drops `meta`, because React warns about an unknown attribute for each prop that reaches the DOM.

## Dynamic Overrides

`<Widgets>` takes `components` and `chrome` of its own, merged over the factory's. `components` is a shallow merge of the two maps. `chrome` is resolved field by field, so overriding `wrapper` keeps the factory's `item`:

<!-- #region overrides -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
const FeaturedListing = (props: { title: string }) => <h2>{props.title}</h2>;

const { Widgets, defineItems } = createWidgets({
  components: { listing: ListingCard },
});

const shelf = defineItems([
  { id: 'wingspan', type: 'listing', props: { title: 'Wingspan' } },
]);

const page = (
  <Widgets items={shelf} components={{ listing: FeaturedListing }} />
);

const html = renderToStaticMarkup(page); // -> '<section><div data-widget-id="wingspan" data-widget-type="listing"><h2>Wingspan</h2></div></section>'
```

<!-- #endregion overrides -->

## Placement with `meta`

A grid of listings needs placement data, and that data belongs to the item chrome: a widget renders the same at column 1 and at column 7. `meta` is handed to `chrome.item` and is never spread into the widget's props. Annotate `chrome.item` with the vocabulary it reads and every item's `meta` is checked against it, at the top level and inside `children`:

<!-- #region meta-grid -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
import type { WidgetItemComponent } from '@evanion/react-widget';

type GridMeta = { column: number; span?: number };

const GridCell: WidgetItemComponent<GridMeta> = ({
  children,
  meta,
  ...rest
}) => (
  <div
    {...rest}
    style={{
      gridColumn: `${meta?.column ?? 'auto'} / span ${meta?.span ?? 1}`,
    }}
  >
    {children}
  </div>
);

const { Widgets, defineItems } = createWidgets({
  components: { listing: ListingCard },
  chrome: { item: GridCell },
});

const grid = defineItems([
  {
    id: 'root',
    type: 'listing',
    props: { title: 'Root' },
    meta: { column: 2, span: 2 },
  },
  // @ts-expect-error GridCell reads `column`, and `col` is not a key of GridMeta
  { id: 'hive', type: 'listing', props: { title: 'Hive' }, meta: { col: 1 } },
]);

const html = renderToStaticMarkup(<Widgets items={grid} />); // -> '<section><div data-widget-id="root" data-widget-type="listing" style="grid-column:2 / span 2"><h3>Root</h3></div><div data-widget-id="hive" data-widget-type="listing" style="grid-column:auto / span 1"><h3>Hive</h3></div></section>'
```

<!-- #endregion meta-grid -->

There is no type argument to pass. `createWidgets` infers the vocabulary from the `chrome.item` it is given, through an annotated component, a plain function with an annotated parameter object, or a `memo()`-wrapped one. A set with no `chrome.item`, or an unannotated one, accepts any object as `meta`. `meta` is optional on every item, so a chrome that reads a key still writes a fallback for the item that omits it.

## Page-Level Data with `ctx`

Every widget receives `ctx` as a prop, from `<Widgets ctx={…}>`. It exists in place of a context provider, because React's `react-server` condition has no `createContext`:

<!-- #region ctx -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string; ctx: { currency: string } }) => (
  <h3>
    {props.title}, {props.ctx.currency}
  </h3>
);

const { Widgets, defineItems } = createWidgets({
  components: { listing: ListingCard },
});

const shelf = defineItems([
  { id: 'root', type: 'listing', props: { title: 'Root' } },
]);

const page = <Widgets ctx={{ currency: 'SEK' }} items={shelf} />;

const html = renderToStaticMarkup(page); // -> '<section><div data-widget-id="root" data-widget-type="listing"><h3>Root, SEK</h3></div></section>'
```

<!-- #endregion ctx -->

`ctx` is the renderer's to supply, so it is omitted from an item's `props` alongside `children`. A widget may declare it required without every item repeating it. An item cannot override it: `ctx` follows the spread, and items are untrusted input. Nothing checks that `<Widgets ctx={…}>` supplies what a widget declares, because `<Widgets>` types `ctx` as `Record<string, unknown>`.

## Optimizing Suspense

By default the renderer wraps every widget in its own `<Suspense>` boundary, so one suspending widget does not block its siblings. The fallback comes from `chrome.suspenseFallback` and defaults to nothing:

<!-- #region suspense-fallback -->

```tsx @import.meta.vitest
const StockLevel = async (props: { game: string }) => {
  const count = await Promise.resolve(3);
  return (
    <p>
      {count} of {props.game} in stock
    </p>
  );
};

const { Widgets, defineItems } = createWidgets({
  components: { stock: StockLevel },
  chrome: { suspenseFallback: <p>Counting stock</p> },
});

const stock = defineItems([
  { id: 'root-stock', type: 'stock', props: { game: 'Root' } },
]);

const html = renderToStaticMarkup(<Widgets items={stock} />); // -> '<section><div data-widget-id="root-stock" data-widget-type="stock"><p>Counting stock</p></div></section>'
```

<!-- #endregion suspense-fallback -->

The boundary lives in the renderer, not in the item chrome, so replacing `chrome.item` cannot silently remove it.

React's streaming SSR outlines any boundary it has not finished by the time the shell passes `progressiveChunkSize`, 12,800 bytes by default, **whether or not anything in it suspended**. The content goes into a trailing `<div hidden>` and an inline `<script>$RC(…)</script>` moves it into place. A client that does not run inline scripts, because scripts are off or a Content-Security-Policy rejects inline script without a nonce, never sees outlined content. Measured over 150 synchronous items of about 1,000 bytes each:

| `chrome.suspense` | bytes   | deferred boundaries | rows in the shell |
| ----------------- | ------- | ------------------- | ----------------- |
| `per-item`        | 139,233 | 145                 | 5 of 150          |
| `none`            | 122,069 | 0                   | 150 of 150        |

For a region whose widgets are all synchronous, set `chrome.suspense: 'none'`. `renderToString` writes a `<!--$-->` marker pair for each boundary, which shows where they went:

<!-- #region suspense-none -->

```tsx @import.meta.vitest
const Row = (props: { title: string }) => <p>{props.title}</p>;

const perItem = createWidgets({ components: { row: Row } });

const none = createWidgets({
  components: { row: Row },
  chrome: { suspense: 'none' },
});

const rows = perItem.defineItems([
  { id: 'hive', type: 'row', props: { title: 'Hive' } },
]);

const bounded = renderToString(<perItem.Widgets items={rows} />); // -> '<section><div data-widget-id="hive" data-widget-type="row"><!--$--><p>Hive</p><!--/$--></div></section>'
const flat = renderToString(<none.Widgets items={rows} />); // -> '<section><div data-widget-id="hive" data-widget-type="row"><p>Hive</p></div></section>'
```

<!-- #endregion suspense-none -->

The renderer does not detect which widgets suspend. A component calling `use(promise)` looks synchronous at runtime, `memo()` hides an async component, and an `async function` downlevelled below ES2017 becomes a plain function. Under `none`, a widget that suspends anyway suspends the nearest boundary above the region. Put your own `<Suspense>` around `<Widgets>` to stop it there.

## Error Boundaries

The package ships none. React error boundaries require a class component, which React does not expose under the `react-server` condition, so a default boundary would put a `'use client'` directive on the whole package. Add your own in a custom `chrome.item`, in your own `'use client'` file:

<!-- #region error-boundary -->

```tsx @import.meta.vitest
'use client';

class ItemBoundary extends React.Component<
  { children?: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (
      <p>This listing failed to load.</p>
    ) : (
      this.props.children
    );
  }
}

const SafeItem = (props: React.ComponentProps<typeof DefaultItem>) => (
  <DefaultItem {...props}>
    <ItemBoundary>{props.children}</ItemBoundary>
  </DefaultItem>
);
```

<!-- #endregion error-boundary -->

Pass it as `chrome: { item: SafeItem }`. The boundary is then client code and the widgets inside it are not.

## Large Regions

The renderer renders every item, and there is no windowing option. For server-rendered content, put `content-visibility: auto` on the item chrome. The browser skips layout and paint for off-screen items, and every one of them stays in the HTML:

<!-- #region content-visibility -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
const { Widgets, defineItems } = createWidgets({
  components: { listing: ListingCard },
  chrome: {
    item: (props) => (
      <DefaultItem
        {...props}
        style={{
          contentVisibility: 'auto',
          containIntrinsicSize: 'auto 240px',
        }}
      />
    ),
  },
});

const shelf = defineItems([
  { id: 'crokinole', type: 'listing', props: { title: 'Crokinole' } },
]);

const html = renderToStaticMarkup(<Widgets items={shelf} />); // -> '<section><div data-widget-id="crokinole" data-widget-type="listing" style="content-visibility:auto;contain-intrinsic-size:auto 240px"><h3>Crokinole</h3></div></section>'
```

<!-- #endregion content-visibility -->

For a client-side list long enough to matter, virtualize in your own `'use client'` `chrome.wrapper`. The wrapper receives `items` beside `children`, positionally aligned, so it can measure and window by item.

## API

### `createWidgets(config)`

| field                     | meaning                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `components`              | widget type -> component. Drives inference for the whole set                                        |
| `chrome.wrapper`          | rendered around the whole set. Defaults to `<section>`. Receives `items` as well as `children`      |
| `chrome.item`             | rendered around each widget. Defaults to a `<div>` carrying `data-widget-id` and `data-widget-type` |
| `chrome.suspense`         | `'per-item'` (default) or `'none'`: whether each widget gets its own `<Suspense>` boundary          |
| `chrome.suspenseFallback` | rendered while a widget suspends                                                                    |

Returns `{ Widgets, defineItems, validateItems }`.

### `<Widgets>`

| prop         | meaning                                                       |
| ------------ | ------------------------------------------------------------- |
| `items`      | the items to render                                           |
| `components` | per-instance component overrides, merged over the factory map |
| `chrome`     | per-instance chrome overrides                                 |
| `ctx`        | page-level data passed to every widget                        |

### Item shape

```ts
{
  id: string;                        // stable identity, used as the React key
  type: keyof typeof components;     // which component to render
  props: ComponentProps<That>;       // minus `children` and `ctx`
  meta?: M;                          // for chrome.item only; M comes from it
  children?: Item[];                 // only if that component accepts children
}
```

### Exports

`createWidgets`, `validateItems`, `defineWidgets`, `DefaultWrapper`, `DefaultItem`, `ERROR_MESSAGES`, `VALIDATION_MESSAGES`, and the types `WidgetItem`, `AnyWidgetItem`, `WidgetDataProps`, `WidgetRegistry`, `WidgetsConfig`, `WidgetsProps`, `WidgetsChrome`, `WidgetChildren`, `WidgetItemComponent`, `WidgetsWrapperComponent`, `WidgetSuspenseMode`, `WidgetProblem`, `WidgetMeta`, `KnownWidgetTypes`, `RenderableWidgetItem`, `AnyWidgetComponent`.

`validateItems`, `defineWidgets`, `AnyWidgetItem`, `WidgetRegistry`, `WidgetProblem`, `WidgetMeta`, `KnownWidgetTypes`, `ERROR_MESSAGES` and `VALIDATION_MESSAGES` come from `@evanion/widget` and are re-exported here.

## Migrating from 0.2.x

The item shape, the props and the data are unchanged. Three type names moved to `@evanion/widget` and are re-exported from here under the names the whole family uses.

| Was                  | Now                                  |
| -------------------- | ------------------------------------ |
| `WidgetComponentMap` | `WidgetRegistry<AnyWidgetComponent>` |
| `WidgetItemProblem`  | `WidgetProblem`                      |
| `WidgetProps`        | `AnyWidgetItem`                      |

`chrome.wrapper` now receives an `items` prop beside its children. It is optional, so an existing wrapper keeps compiling. A wrapper that spreads its props onto a DOM element has to drop it, the way `DefaultWrapper` does.

## Migrating from 0.1.x

| Removed                                                  | Replacement                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `'use client'`                                           | none needed; the package is importable from an RSC                           |
| `WidgetsProvider`, `useWidgets`, `WidgetsConfig.context` | call `createWidgets` once at module scope                                    |
| the injected `Output` prop and `<Output/>`               | read `children`                                                              |
| `WidgetOutputProps`                                      | none needed                                                                  |
| the default `WidgetErrorBoundary`                        | your own boundary in a custom `chrome.item`, in your own `'use client'` file |
| `DEFAULT_STYLES.LOADING`                                 | `chrome.suspenseFallback`                                                    |

`renderWidget` and `NestedWidgetsContext` are no longer exported: the nesting mechanism is internal.

## License

MIT. See LICENSE.
