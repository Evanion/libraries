# @evanion/widget

**Framework-agnostic structural validation for data-driven layouts.**

A content management system (CMS) saves a page as a list of widget items, and a renderer draws each item with the component its `type` names. When a saved type has no component, the renderer skips the item. When a required prop arrives blank, the renderer draws the widget with that field empty. In production neither throws and neither logs. `@evanion/widget` checks the saved items before they reach the renderer and reports every item it would skip or draw empty.

## Layouts as Data

`@evanion/widget` treats a page as a structured list of items. Each item names a component (`type`) and provides its configuration (`props`).

The library provides the structural "glue" (the registry and the validator) that checks a data-driven layout before it reaches the renderer. Which payload a customer or the owner gets is your application's choice; `validateItems` checks whichever one it is handed.

### Core Concept: The Validated Page

## Key Features

- 🏗️ **Data-Driven Orchestration**: Move the order and nesting of a page from your JSX into your database or CMS.
- 🛡️ **Structural Integrity**: Catch unknown types, missing required props, and duplicate IDs at the edge, before a renderer silently skips a widget or draws it empty.
- 🌍 **Framework-Agnostic**: No dependencies on React, Astro, or Vue. It handles the _structure_; you provide the _renderer_.
- 🧩 **Recursive Nesting**: Naturally supports complex, nested layouts (grids within tabs within sections) with full validation at every level.
- 🪶 **Zero Runtime Bloat**: A validator with no dependencies that runs in a build script, a webhook, or a serverless function.

## Installation

```bash
npm install @evanion/widget
```

**Note**: This is the core logic. To actually render these widgets, install the renderer for your framework:

- For React: `npm install @evanion/react-widget`
- For Astro: `npm install @evanion/astro-widget`

Each renderer pins `@evanion/widget` to an exact version and re-exports `defineWidgets`, `validateItems`, `ERROR_MESSAGES`, `VALIDATION_MESSAGES` and every type, so a project that installs a renderer imports these names from the renderer and never installs the core by hand.

The package is ESM only and needs Node 20 or newer. A CommonJS `require('@evanion/widget')` needs Node 20.19 or 22.12+, and older versions fail with `ERR_REQUIRE_ESM`.

## The Widget Item

A widget item is one block of a page. `type` names the component that draws it, and `props` carries that component's data. Here is a listing page from Baize, a board game shop: a wide listing for _Brass: Birmingham_, then a shelf holding a listing for _Wingspan_.

Every item follows the same contract:

- `id` is required, and must be unique among its siblings. A renderer lists the item under it, and a warning about a stale type names it. A CMS with no per-section id has to supply one; an index-derived value works as long as it is stable across renders.
- `props` is required. A widget's data lives under that key and nowhere else, so an item that carries its data at the top level is reported by `validateItems`, and a renderer would draw it empty with nothing logged.
- `meta` is optional placement data, like `span: 2`. A renderer hands it to the item chrome, the `chrome.item` component it draws around the widget, and never to the widget's own `props`.
- `children` is an optional array of nested items. React draws them as the component's `children`; an Astro component receives them as data and renders its own `<Widgets>` over them.

## Order and Nesting

`@evanion/react-widget` draws items in array order and draws each item's `children` inside it. `@evanion/astro-widget` draws them in the same order, and each parent component draws its own `children`. In both, moving an item in the array moves it, and everything nested in it, on the page. This is a staff dashboard of two rows, each holding its own items:

## Typing a Registry with `defineWidgets`

A registry maps each widget type to the component a renderer draws for it. `defineWidgets(registry)` returns the registry unchanged, typed as the literal object you passed in, so your editor completes on its keys. `validateItems` accepts it in place of a list of names:

Annotating the same object as `WidgetRegistry` would widen its keys to `string`, and lose the key union a renderer types its components against.

## Catching Bad Payloads with `validateItems`

`validateItems(items, known, required?)` checks a list against the set of known types and returns `WidgetProblem[]`. It never throws, and it reports every problem in one pass, so you can print all of them at once. Here the CMS saved a shelf after its type was renamed:

### Using It as a Quality Gate

`items` is typed `unknown`, so a script passes a payload straight from `JSON.parse`, turns each problem into a log line, and fails the run when there is one. `known` can be a plain list of names, so the script never imports the components it will not render:

### Enforcing Required Props

The optional `required` argument maps a type to the props that must be present and not blank. Blank means `undefined`, `null`, an empty string or whitespace only, which is what a CMS text field arrives as when an editor opened it and typed nothing:

The keys of `required` are plain strings, so TypeScript does not check them against your widget types: a misspelled type there is an entry nothing ever reads. An item whose type is unknown is reported once, and its required props are not checked.

### Nested Faults in One Pass

`validateItems` walks the payload depth first: an item's own problems, then its `children`, then the next sibling.

`index` is the item's position in its own sibling list, so the nested item above reports index 0, not 3. An id repeated at two depths is fine; a renderer scopes its keys per list, so only a repeat between siblings is a collision.

**Security note**: a type is looked up as an own key of the registry, so a CMS item typed `constructor`, `toString` or `__proto__` is reported as unknown and never resolves to something on `Object.prototype`.

No renderer calls `validateItems`. A renderer skips an item it cannot draw and warns; validation is the loud gate you run at ingestion or build time.

## Writing Your Own Renderer

A renderer that meets an item it cannot draw skips it and warns. The warning text lives in this package, so the same stale CMS type reads the same way whether React or Astro drew the page:

`warnOnce` prints each distinct message once per process, and prints nothing when `NODE_ENV` is `production`. Every message carries the offending item's `type` and `id`, so a second bad item is still reported.

This renderer draws each listing as a line of text, skips the item whose type it cannot draw, and warns about it on the first render only:

The first `render` prints `Unknown widget type "listting" for widget ID "hive". Skipping render.` and the second prints nothing.

## Exports

`defineWidgets`, `validateItems`, `warnOnce`, `resetWarnings`, `ERROR_MESSAGES`, `VALIDATION_MESSAGES`, and the types `AnyWidgetItem`, `WidgetRegistry`, `WidgetMeta`, `WidgetProblem`, `KnownWidgetTypes`.

`warnOnce` and `resetWarnings` are for renderers, and neither published renderer re-exports them. A project that draws through a published renderer has no reason to call either.

## Documentation

The full guide, with every validation message and how each renderer handles nesting and placement, is on the documentation site:

👉 **[docs.evanion.com/widget](https://docs.evanion.com/widget)**

## License

MIT
