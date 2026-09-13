# @evanion/react-widget

Render dynamic, type-safe React widget regions from structured data. Built for
CMS-driven layouts, dashboards and configurable sidebars.

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
  the type checker

## Installation

```bash
npm install @evanion/react-widget
```

## Quick start

```tsx
import { createWidgets } from '@evanion/react-widget';

const NewsTeaser = ({ title, body }: { title: string; body: string }) => (
  <article>
    <h3>{title}</h3>
    <p>{body}</p>
  </article>
);

const UserSidebar = ({
  username,
  messages,
}: {
  username: string;
  messages: number;
}) => (
  <div>
    <span>{username}</span>
    <span>{messages} messages</span>
  </div>
);

// Call once, at module scope.
const { Widgets } = createWidgets({
  components: { news: NewsTeaser, userInfo: UserSidebar },
  chrome: {
    wrapper: ({ children }) => <aside className="sidebar">{children}</aside>,
  },
});

export default function Page() {
  return (
    <Widgets
      items={[
        {
          id: 'u1',
          type: 'userInfo',
          props: { username: 'Evanion', messages: 5 },
        },
        { id: 'n1', type: 'news', props: { title: 'Hello', body: '…' } },
      ]}
    />
  );
}
```

That page can be a Server Component. The package uses only React APIs that exist
under the `react-server` export condition -- `createElement`, `Suspense`,
`memo` -- so nothing here forces your widgets into the client bundle.

## Typing your items

`createWidgets` infers the allowed `type` values and each item's `props` from the
component map.

```tsx
const { Widgets, defineItems } = createWidgets({
  components: { news: NewsTeaser, weather: WeatherCard },
});

const items = defineItems([
  { id: '1', type: 'news', props: { title: 'Hello', body: '…' } },
  { id: '2', type: 'nope', props: {} }, // ✗ not in the map
  { id: '3', type: 'weather', props: { celsius: 'warm' } }, // ✗ celsius is a number
]);
```

`defineItems` is an identity function that exists purely to supply the
contextual type. A bare `const items = [{ type: 'news', ... }]` widens `type` to
`string`, which cannot narrow to the map's keys, and the check is silently lost.
Writing the array inline in JSX works too -- that is already contextually typed.

## Nesting

Nested items render as the parent component's `children`.

```tsx
const Card = ({ title, children }: PropsWithChildren<{ title: string }>) => (
  <section>
    <h3>{title}</h3>
    {children}
  </section>
);

const { Widgets } = createWidgets({ components: { card: Card, text: Text } });

<Widgets
  items={[
    {
      id: 'c1',
      type: 'card',
      props: { title: 'My card' },
      children: [{ id: 't1', type: 'text', props: { content: 'Nested' } }],
    },
  ]}
/>;
```

`children` is type-gated: it is permitted only when the mapped component
actually accepts `children`, and typed `never` otherwise. Nesting under a widget
that would drop the child items is a compile error rather than content that
silently disappears.

## `meta`: placing a widget without telling it where it is

A dashboard grid, a masonry board or a CMS page with per-block spans needs
placement data. That data belongs to the wrapper, not to the widget -- a widget
renders the same at column 1 and at column 7.

`meta` is handed to `chrome.item` and is never spread into the widget's props.

```tsx
type GridMeta = { column: number; columnSpan?: number };

const GridItem: WidgetItemComponent<GridMeta> = ({
  children,
  meta,
  ...rest
}) => (
  <div
    {...rest}
    style={{ gridColumn: `${meta?.column} / span ${meta?.columnSpan}` }}
  >
    {children}
  </div>
);

const { Widgets } = createWidgets({
  components: { chart: Chart },
  chrome: { item: GridItem },
});

<Widgets
  items={[
    {
      id: 'today',
      type: 'chart',
      props: { metric: 'revenue' },
      meta: { column: 1, columnSpan: 4 },
      // meta: { colunm: 1 }  ← compile error: not a key GridItem reads
    },
  ]}
/>;
```

### Typing `meta`

Annotate `chrome.item` with the vocabulary it reads and every item's `meta` is
checked against it, at the top level and inside `children`. Without that, a
misspelled key compiles and the item is placed by whatever fallback the chrome
applies -- a layout that looks deliberate.

There is no type argument to pass. `createWidgets` infers the vocabulary from
the `chrome.item` it is given, through an annotated component, a plain function
with an annotated parameter object, or a `memo()`-wrapped one. Naming it by hand
would mean restating the component map type as well, and a set with no
`chrome.item` has nothing that reads `meta` to check against -- there, and for
an unannotated chrome, `meta` stays any object as before.

Typing `meta` removes the typo, not the narrowing: `meta` is optional on every
item, so a chrome that needs a key still writes a fallback for the item that
omits it.

## `ctx`: page-level data for every widget

```tsx
<Widgets ctx={{ locale, currency }} items={items} />
```

Every widget receives `ctx` as a prop. This is the counterpart to
`@evanion/astro-widget`'s `ctx`, and it exists instead of a context provider:
React's `react-server` condition has no `createContext`.

`ctx` is the renderer's to supply, so it is omitted from an item's `props`
alongside `children`. A widget may declare it required without every item having
to repeat a value `<Widgets>` is going to pass anyway, and an item cannot
override it -- `ctx` follows the spread, and items are untrusted input.

## Suspense

By default the renderer wraps every widget in its own `<Suspense>` boundary, so
one suspending widget does not block its siblings. The fallback comes from
`chrome.suspenseFallback` and defaults to nothing.

```tsx
const { Widgets } = createWidgets({
  components: { report: AsyncReport },
  chrome: { suspenseFallback: <Skeleton /> },
});
```

The boundary lives in the renderer rather than in the item chrome, so replacing
`chrome.item` cannot silently remove it.

There is no default skeleton. A region is a dashboard grid for one consumer and
a table of rows for the next, and one generic placeholder would be wrong in
both. Set `suspenseFallback` if a blank space during streaming is not what you
want.

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

So for a region whose widgets are all synchronous, say so:

```tsx
const { Widgets } = createWidgets({
  components: { row: LedgerRow },
  chrome: { suspense: 'none' },
});
```

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

```tsx
'use client';

export function SafeItem({ children, ...rest }) {
  return (
    <div {...rest}>
      <ErrorBoundary fallback={<p>This widget failed.</p>}>
        {children}
      </ErrorBoundary>
    </div>
  );
}
```

## `validateItems`

`WidgetItem<C>` checks items at compile time. `validateItems` checks the data
that never met the type checker -- a CMS payload, a webhook body, a fixture on
disk.

```ts
import { validateItems } from '@evanion/react-widget';

const problems = validateItems(payload, ['news', 'weather', 'card']);
if (problems.length) {
  console.error(problems);
  process.exit(1);
}
```

It returns problems and never throws, accumulates rather than stopping at the
first, and recurses into `children`. It reports: a non-list root, a non-object
item, a non-string `id` or `type`, an unknown `type`, non-object `props`,
non-list `children`, and duplicate sibling `id`s.

Two entry points, so a CI script does not have to import React components it
will never render:

- `validateItems(items, knownTypes: readonly string[])`, exported standalone
- `createWidgets(...).validateItems(items)`, bound to the component map

`Widgets` does not call it. Validation is a loud, explicit gate you run at
ingestion or build time; the renderer underneath stays defensive, skipping a
malformed item with a dev-only `console.warn` rather than taking a page down.

The renderer warns from render, so each message is logged once per process: a
stale `type` reports once instead of on every re-render and again on hydration.
Nothing is logged when `NODE_ENV` is `production`.

## API

### `createWidgets(config)`

`config`:

| field                     | meaning                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `components`              | widget type -> component. Drives inference for the whole set                                        |
| `chrome.wrapper`          | rendered around the whole set. Defaults to `<section>`                                              |
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

`createWidgets`, `validateItems`, `DefaultWrapper`, `DefaultItem`,
`ERROR_MESSAGES`, `VALIDATION_MESSAGES`, and the types `WidgetItem`,
`WidgetProps`, `WidgetDataProps`, `WidgetComponentMap`, `WidgetsConfig`,
`WidgetsProps`, `WidgetsChrome`, `WidgetChildren`, `WidgetItemComponent`,
`WidgetsWrapperComponent`, `WidgetItemProblem`, `KnownWidgetTypes`,
`RenderableWidgetItem`, `AnyWidgetComponent`.

`props` on a widget whose component declares no props is `Record<string, never>`
rather than `{}`, so an unexpected key is a compile error there too.

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
