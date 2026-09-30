[![npm version](https://img.shields.io/npm/v/@evanion/react-widget)](https://www.npmjs.com/package/@evanion/react-widget)
[![npm downloads](https://img.shields.io/npm/dm/@evanion/react-widget)](https://www.npmjs.com/package/@evanion/react-widget)
[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# @evanion/react-widget

Render dynamic, type-safe React widget regions from structured data. Built for
CMS-driven layouts, dashboards and configurable sidebars.

Full documentation:
[docs.evanion.com/react-widget](https://docs.evanion.com/react-widget). The item
shape, the registry and the validator come from
[`@evanion/widget`](https://www.npmjs.com/package/@evanion/widget), which this
package pins exactly and re-exports, so installing this one is enough. The Astro
renderer of the same items, for build-time sections with no runtime, is
[`@evanion/astro-widget`](https://www.npmjs.com/package/@evanion/astro-widget).

## Features

- **Type-safe**: `createWidgets` infers from your component map, so an unknown
  widget `type`, mismatched `props`, or `children` on a component that does not
  accept them is a compile error rather than a runtime surprise
- **Server-component ready**: no `'use client'`, no context, no class
  components. Importable from a React Server Component, and a widget can be an
  async Server Component that fetches its own data
- **Composable chrome**: wrapper, per-item wrapper, a Suspense fallback, and
  per-region control over whether there is a boundary at all
- **Placement without prop leakage**: `meta` reaches the item chrome and never
  the widget
- **Validation for untrusted data**: `validateItems` for payloads that never met
  the type checker, with an optional map of props each type must supply
- **One item shape across runtimes**: the same array renders through
  `@evanion/astro-widget` and produces the same widgets in the same order

## Installation

```bash
npm install @evanion/react-widget
```

## One component map, one item array, one region

The examples in this README leave out three imports:
`import * as React from 'react'`,
`import { renderToStaticMarkup, renderToString } from 'react-dom/server'` and
`import { createWidgets, DefaultItem, DefaultWrapper } from '@evanion/react-widget'`.

`components` maps a `type` to a component, an item says which component to render
and with what props, and `Widgets` renders one against the other. The string
below is the markup it produced:

<!-- #region region-markup -->

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
  {
    id: 'brass',
    type: 'listing',
    props: { title: 'Brass: Birmingham', price: 649 },
  },
]);

const html = renderToStaticMarkup(<Widgets items={shelf} />); // -> '<section><div data-widget-id="brass" data-widget-type="listing"><h3>Brass: Birmingham, 649 kr</h3></div></section>'
```

<!-- #endregion region-markup -->

The `section` is the region's default wrapper, and `chrome.wrapper` replaces it.
Inside it the renderer puts each widget in an element carrying the item's `id` and
`type`, so a widget is findable in the DOM without the widget rendering the
attributes itself. Add a second item and it renders after the first, in the order
the array reads. `defineItems` types the array against the component map, which
the next section explains.

Call `createWidgets` once, at module scope. It returns a new `Widgets` component
on every call, so calling it inside a component remounts the region on every
render.

That page can be a Server Component. The package uses only React APIs that exist
under the `react-server` export condition -- `createElement`, `Suspense`,
`memo` -- so nothing here forces your widgets into the client bundle.

## Typing your items

`createWidgets` infers the allowed `type` values and each item's `props` from the
component map. `defineItems` hands that type to an array held in a variable:

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

A bare `const shelf = [{ type: 'listing', ... }]` widens `type` to `string`,
which cannot narrow to the map's keys, so `Widgets` refuses it. `defineItems` is
an identity function that exists to supply the contextual type. An array written
inline in JSX is already contextually typed and needs neither.

## Nesting

Nested items render as the parent component's `children`:

<!-- #region nesting -->

```tsx @import.meta.vitest
const Showcase = (props: { title: string; children?: React.ReactNode }) => (
  <div>
    <h2>{props.title}</h2>
    {props.children}
  </div>
);

const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;

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

defineItems([
  // @ts-expect-error ListingCard renders no children, so nothing nests under it
  { id: 'azul', type: 'listing', props: { title: 'Azul' }, children: [] },
]);

const html = renderToStaticMarkup(<Widgets items={tonight} />); // -> '<section><div data-widget-id="tonight" data-widget-type="showcase"><div><h2>On the table tonight</h2><div data-widget-id="hive" data-widget-type="listing"><h3>Hive</h3></div></div></div></section>'
```

<!-- #endregion nesting -->

`children` is type-gated: it is permitted only when the mapped component
actually accepts `children`, and typed `never` otherwise. Nesting under a widget
that would drop the child items is a compile error rather than content that
silently disappears.

## `validateItems`

`WidgetItem<C>` checks items at compile time. `validateItems` checks the data
that never met the type checker -- a CMS payload, a webhook body, a fixture on
disk. The standalone export takes a list of type names, so a CI script imports
no React component:

<!-- #region validate-payload -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/react-widget';

const payload: unknown = JSON.parse(
  '[{"id":"root","type":"listing","props":{"title":"Root"}},{"id":"raffle","type":"raffle","props":{}}]',
);

const problems = validateItems(payload, ['listing', 'booking']); // -> [{ index: 1, id: 'raffle', type: 'raffle', message: 'unknown widget type' }]
```

<!-- #endregion validate-payload -->

It returns problems and never throws, accumulates rather than stopping at the
first, and recurses into `children`. It reports: a non-list root, a non-object
item, a non-string `id` or `type`, an unknown `type`, missing or non-object
`props`, non-list `children`, and duplicate sibling `id`s.

A nested item's `index` counts within its own sibling list, so the `id` is what
finds it:

<!-- #region validate-nested -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/react-widget';

const payload: unknown = JSON.parse(
  '[{"id":"tonight","type":"showcase","props":{"title":"On the table tonight"},"children":[{"id":"hive","type":"listing","props":{"title":"Hive"}},{"id":"raffle","type":"raffle","props":{}}]}]',
);

const problems = validateItems(payload, ['showcase', 'listing']); // -> [{ index: 1, id: 'raffle', type: 'raffle', message: 'unknown widget type' }]
```

<!-- #endregion validate-nested -->

`createWidgets` returns a second form, bound to the component map, so it takes
no list of names. Its optional argument maps a widget type to the props that
must be present and non-blank, where blank means `undefined`, `null` or
whitespace only -- which is what a CMS text field that was opened and left empty
arrives as:

<!-- #region validate-bound -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;

const { validateItems } = createWidgets({
  components: { listing: ListingCard },
});

const payload: unknown = [
  { id: 'root', type: 'listing', props: { title: ' ' } },
];

const problems = validateItems(payload, { listing: ['title'] }); // -> [{ index: 0, id: 'root', type: 'listing', message: 'missing field title' }]
```

<!-- #endregion validate-bound -->

The standalone export takes the same map as its third argument.

`validateItems` returns a list, not a type guard, so a payload that passes is
still `unknown`. Cast it to the item type once the list is empty, and render no
items for a payload that fails:

<!-- #region render-validated -->

```tsx @import.meta.vitest
import type { WidgetItem } from '@evanion/react-widget';

const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;

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

The cast asserts the prop types, which `validateItems` does not check: a `title`
of `42` passes it, because `42` is not blank. The `required` map is what guarantees the props a widget
cannot render without.

A component map declared on its own, so that `createWidgets`, an item type and a
standalone `validateItems` share it, goes through `defineWidgets`, which returns
it with its keys kept literal. The same stale type then fails the compile and
the payload check:

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

`Widgets` does not call either form. The renderer stays defensive instead: an
item it cannot render is skipped with a development-only `console.warn`, and the
rest of the region renders:

<!-- #region skipped-item -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;

const { Widgets } = createWidgets({ components: { listing: ListingCard } });

const payload = JSON.parse(
  '[{"id":"raffle","type":"raffle","props":{}},{"id":"root","type":"listing","props":{"title":"Root"}}]',
);

const html = renderToStaticMarkup(<Widgets items={payload} />); // -> '<section><div data-widget-id="root" data-widget-type="listing"><h3>Root</h3></div></section>'
```

<!-- #endregion skipped-item -->

The warning reads `Unknown widget type "raffle" for widget ID "raffle".
Skipping render.` Each message is logged once per process, so a stale `type`
reports once instead of on every re-render and again on hydration. Nothing is
logged when `NODE_ENV` is `production`.

## Chrome

A widget set has two wrappers. `chrome.wrapper` goes around the whole region and
receives the region's items beside its `children`. `chrome.item` goes around each
widget and receives `data-widget-id`, `data-widget-type` and `meta`. The
defaults, `DefaultWrapper` and `DefaultItem`, are exported, so a custom chrome
can wrap one:

<!-- #region chrome -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;

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

Keep the `data-widget-*` attributes on the element. CMS click-to-edit overlays,
analytics and E2E selectors key off them.

`<Widgets>` takes `components` and `chrome` of its own, merged over the
factory's. `components` is a shallow merge of the two maps; `chrome` is resolved
field by field, so overriding `wrapper` keeps the factory's `item`:

<!-- #region overrides -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
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

## `meta`: placing a widget without telling it where it is

A grid of listings needs placement data, and that data belongs to the item
chrome: a widget renders the same at column 1 and at column 7. `meta` is handed
to `chrome.item` and is never spread into the widget's props. Annotate
`chrome.item` with the vocabulary it reads and every item's `meta` is checked
against it, at the top level and inside `children`:

<!-- #region meta-grid -->

```tsx @import.meta.vitest
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

const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;

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

There is no type argument to pass. `createWidgets` infers the vocabulary from
the `chrome.item` it is given, through an annotated component, a plain function
with an annotated parameter object, or a `memo()`-wrapped one. A set with no
`chrome.item`, or an unannotated one, leaves `meta` as any object.

Typing `meta` removes the typo, not the narrowing: `meta` is optional on every
item, so a chrome that needs a key still writes a fallback for the item that
omits it. `hive` above compiles only under the `@ts-expect-error`, and renders
through the `auto` fallback.

## `ctx`: page-level data for every widget

Every widget receives `ctx` as a prop, from `<Widgets ctx={…}>`. This is the
counterpart to `@evanion/astro-widget`'s `ctx`, and it exists instead of a
context provider: React's `react-server` condition has no `createContext`.

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

`ctx` is the renderer's to supply, so it is omitted from an item's `props`
alongside `children`. A widget may declare it required without every item having
to repeat a value `<Widgets>` is going to pass anyway, and an item cannot
override it -- `ctx` follows the spread, and items are untrusted input.

## Suspense

By default the renderer wraps every widget in its own `<Suspense>` boundary, so
one suspending widget does not block its siblings. The fallback comes from
`chrome.suspenseFallback` and defaults to nothing:

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

The boundary lives in the renderer rather than in the item chrome, so replacing
`chrome.item` cannot silently remove it. There is no default skeleton: a region
is a grid of cards for one consumer and a table of rows for the next, and one
generic placeholder would be wrong in both.

### Synchronous regions: `chrome.suspense`

A boundary costs more than its markers when the region is large. React's
streaming SSR outlines any boundary it has not finished by the time the shell
passes `progressiveChunkSize` -- 12,800 bytes by default -- **whether or not
anything in it suspended**. The content is written to a trailing `<div hidden>`
and an inline `<script>$RC(…)</script>` moves it into place.

Measured over 150 synchronous items of ~1,000 bytes each, streamed with the
default chunk size:

| `chrome.suspense` | bytes   | deferred boundaries | rows in the shell |
| ----------------- | ------- | ------------------- | ----------------- |
| `per-item`        | 139,233 | 145                 | 5 of 150          |
| `none`            | 122,069 | 0                   | 150 of 150        |

So for a region whose widgets are all synchronous, say so. `renderToString`
writes a `<!--$-->` marker pair for each boundary, which shows where they went:

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

**A client that does not run the inline scripts never sees outlined content.**
It is in the HTML, inside `<div hidden>`, and `$RC` is what moves it. That
covers scripts disabled and a Content-Security-Policy that rejects inline
script without a nonce. Anything reading the HTML in document order -- a text
extraction, a reader-mode pass, a diffing snapshot test, `curl | sed` -- sees
placeholders where the content should be and the content at the bottom in
completion order.

There is no detection and no heuristic. An `async function` component and
`React.lazy` are recognisable at runtime; a component calling `use(promise)` is
not, `memo()` hides both, and an `async function` downlevelled below ES2017
becomes a plain function. Guessing wrong would drop the boundary from a widget
that does suspend, which is worse than paying for one that does not. Under
`none`, a widget that suspends anyway suspends whatever boundary is above the
region -- put your own `<Suspense>` around `<Widgets>` if that should be the
region rather than the page.

The host has a knob too: `progressiveChunkSize` on `renderToPipeableStream`
takes the deferral to zero, and `renderToString` never defers at all. That is
the framework's `entry.server` to set, not the library's.

## Error boundaries

The package ships none. React error boundaries require a class component, which
React does not expose under the `react-server` condition, so a default boundary
would put a `'use client'` directive on the whole package.

Add your own in a custom `chrome.item`, in your own `'use client'` file:

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

Pass it as `chrome: { item: SafeItem }`. The boundary is then client code and
the widgets inside it are not.

## Large regions

The renderer renders every item, and there is no windowing option. For
server-rendered content, put `content-visibility: auto` on the item chrome. The
browser skips layout and paint for off-screen items, and every one of them stays
in the HTML:

<!-- #region content-visibility -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;

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

For a client-side list long enough to matter, virtualize in your own
`'use client'` `chrome.wrapper`. The wrapper receives `items` beside `children`,
positionally aligned, so it can measure and window by item.

## API

### `createWidgets(config)`

`config`:

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

`createWidgets`, `validateItems`, `defineWidgets`, `DefaultWrapper`,
`DefaultItem`, `ERROR_MESSAGES`, `VALIDATION_MESSAGES`, and the types
`WidgetItem`, `AnyWidgetItem`, `WidgetDataProps`, `WidgetRegistry`,
`WidgetsConfig`, `WidgetsProps`, `WidgetsChrome`, `WidgetChildren`,
`WidgetItemComponent`, `WidgetsWrapperComponent`, `WidgetProblem`,
`WidgetMeta`, `KnownWidgetTypes`, `RenderableWidgetItem`, `AnyWidgetComponent`.

`validateItems`, `defineWidgets`, `AnyWidgetItem`, `WidgetRegistry`,
`WidgetProblem`, `WidgetMeta`, `KnownWidgetTypes`, `ERROR_MESSAGES` and
`VALIDATION_MESSAGES` come from `@evanion/widget` and are re-exported here, so
a consumer who never names the core never installs it by hand.

`props` on a widget whose component declares no props is `Record<string, never>`
rather than `{}`, so an unexpected key is a compile error there too.

## Migrating from 0.2.x

The item shape, the props and the data are unchanged. Three type names moved to
`@evanion/widget` and are re-exported from here under the names the whole family
uses.

| Was                  | Now                                  |
| -------------------- | ------------------------------------ |
| `WidgetComponentMap` | `WidgetRegistry<AnyWidgetComponent>` |
| `WidgetItemProblem`  | `WidgetProblem`                      |
| `WidgetProps`        | `AnyWidgetItem`                      |

`WidgetProps` and `WidgetsProps` differed by one character and meant different
things -- the loose item, and the component's props. `AnyWidgetItem` is the
untyped counterpart to `WidgetItem`, which is what it always was.

`chrome.wrapper` now receives an `items` prop beside its children. It is
optional, so an existing wrapper keeps compiling; a wrapper that spreads its
props onto a DOM element has to drop it, the way `DefaultWrapper` does.

## Migrating from 0.1.x

| Removed                                                  | Replacement                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `'use client'`                                           | none needed; the package is importable from an RSC                           |
| `WidgetsProvider`, `useWidgets`, `WidgetsConfig.context` | call `createWidgets` once at module scope                                    |
| the injected `Output` prop and `<Output/>`               | read `children`                                                              |
| `WidgetOutputProps`                                      | none needed                                                                  |
| the default `WidgetErrorBoundary`                        | your own boundary in a custom `chrome.item`, in your own `'use client'` file |
| `DEFAULT_STYLES.LOADING`                                 | `chrome.suspenseFallback`                                                    |

`renderWidget` and `NestedWidgetsContext` are no longer exported: the nesting
mechanism is internal.

## License

MIT. See LICENSE.
