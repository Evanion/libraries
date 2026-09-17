[![npm version](https://img.shields.io/npm/v/@evanion/widget)](https://www.npmjs.com/package/@evanion/widget)
[![npm downloads](https://img.shields.io/npm/dm/@evanion/widget)](https://www.npmjs.com/package/@evanion/widget)
[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# Widget

The framework-free half of a widget region: the item shape, the registry, and
the validator. It renders nothing. A renderer is one package per framework, and
each of them depends on this one:

| Package                 | Renders                      |
| ----------------------- | ---------------------------- |
| `@evanion/react-widget` | React, Server Components too |
| `@evanion/astro-widget` | Astro, at build time         |

Install a renderer, not this. Every type below is re-exported from each of them,
so a consumer who never names this package never installs it by hand.

## What a widget region is

A page described as data: a list of items, each naming a component by `type` and
carrying the props it takes. The renderer resolves the type against a registry
and renders it.

<!-- #region shape -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/widget';
import type { AnyWidgetItem } from '@evanion/widget';

const page: AnyWidgetItem[] = [
  {
    id: 'brass-birmingham',
    type: 'listing',
    props: { title: 'Brass: Birmingham', complexity: 4 },
    meta: { span: 2 },
  },
  {
    id: 'tonight',
    type: 'shelf',
    props: { heading: 'On the table tonight' },
    children: [{ id: 'root', type: 'listing', props: { title: 'Root' } }],
  },
];

const problems = validateItems(page, ['listing', 'shelf']);

problems; // -> []
```

<!-- #endregion shape -->

The same array renders through every adapter and produces the same sequence of
widgets.

## Why this package exists

Two renderers held two copies of these rules under two vocabularies, and the
same prototype-chain bug had to be fixed in both. A third renderer would have
been a third copy. The rules are the part that does not differ between
frameworks; resolving a type to a component and putting children somewhere is
the part that does.

Nothing here imports a framework, so it also runs where no renderer does: a
webhook that checks a CMS payload on its way in, a build script, a test.

## Installation

```bash
npm install @evanion/widget
```

Or with yarn:

```bash
yarn add @evanion/widget
```

Or with pnpm:

```bash
pnpm add @evanion/widget
```

## The item

```ts
interface AnyWidgetItem<Type extends string = string, Props = object> {
  id: string;
  type: Type;
  props: Props;
  meta?: WidgetMeta;
  children?: AnyWidgetItem[];
}
```

`id` is required. It is the key a renderer lists the item under, the identity in
a warning about a stale type, and what the duplicate-sibling check is about. A
CMS with no per-section id has to supply one; an index-derived value is fine as
long as it is stable across renders.

`props` is a named field rather than "every key the renderer does not claim".
The renderer's own fields would otherwise be reserved words in the CMS's
vocabulary, and adding one later would take a prop away from every payload
already written.

It is required, and `validateItems` reports an item without it. A widget's data
lives under that key and nowhere else, so an item missing it is one whose props
the payload put somewhere no renderer reads — which is what a payload written
against a flat item shape looks like, and what a renderer would draw as an empty
widget with nothing logged.

`meta` is placement: which column, what span, whether a rule sits above it. It
goes to the region's chrome and never into the widget's own props, because where
a widget sits is not something the widget should know.

`children` is nested items. What a renderer does with them is the runtime's
business — React renders them as the component's `children`, while an Astro
component receives child content through `<slot />` and is handed them as data
to open its own region over.

## `defineWidgets(registry)`

Returns the registry unchanged, typed as the literal object passed in.

<!-- #region registry -->

```ts @import.meta.vitest
import { defineWidgets, validateItems } from '@evanion/widget';

// Whatever your renderer resolves a type to. The core reads the keys and never
// calls a value, so a stand-in is enough to show what the keys do.
const Listing = () => null;
const Shelf = () => null;

const registry = defineWidgets({ listing: Listing, shelf: Shelf });

const problems = validateItems(
  [{ id: 'root', type: 'listing', props: { title: 'Root' } }],
  registry,
);

problems; // -> []
```

<!-- #endregion registry -->

Annotating the same object as `WidgetRegistry` would widen its keys to `string`,
and the key union is what an editor completes on and what a renderer types a
component against.

## `validateItems(items, known, required?)`

Checks a list against the set of known types and returns `WidgetProblem[]`.
Problems rather than an exception, and accumulated rather than short-circuited,
so a caller can print all of them at once.

<!-- #region unknown -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/widget';

const problems = validateItems(
  [{ id: 'root', type: 'listting', props: { title: 'Root' } }],
  ['listing', 'shelf'],
);

problems; // -> [{ index: 0, id: 'root', type: 'listting', message: 'unknown widget type' }]
```

<!-- #endregion unknown -->

`known` is a registry or a plain list of names, so a CI script can validate a
payload without importing components it will never render.

`required` maps a type to the props that must be present and non-blank, where
blank means `undefined`, `null` or whitespace only — which is what a CMS text
field that was opened and left empty arrives as.

<!-- #region required -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/widget';

const problems = validateItems(
  [{ id: 'root', type: 'listing', props: { title: '   ' } }],
  ['listing'],
  { listing: ['title'] },
);

problems; // -> [{ index: 0, id: 'root', type: 'listing', message: 'missing field title' }]
```

<!-- #endregion required -->

`required` takes plain strings for its keys, so a widget type misspelled there
is a map entry nothing ever reads rather than a compile error.

One pass reports every problem it finds, in the order it walks the list, and it
walks `children` as it goes:

<!-- #region sweep -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/widget';

const payload = [
  { id: 'root', type: 'listing' },
  { id: 'root', type: 'listing', props: { title: 'Root' } },
  {
    id: 'tonight',
    type: 'shelf',
    props: {},
    children: [{ id: 'hive', type: 'listting', props: {} }],
  },
];

const problems = validateItems(payload, ['listing', 'shelf']).map(
  (problem) => problem.message,
);

problems; // -> ['props is not an object', 'duplicate sibling id', 'unknown widget type']
```

<!-- #endregion sweep -->

`index` is the item's position in its own sibling list, so the nested item above
reports index 0 rather than 3. An id repeated at two depths is fine; a renderer
scopes its keys per list, and only a repeat between siblings is a collision.

No renderer calls this. Each one stays defensive — an item it cannot render is
skipped and warned about — and validation is the loud gate you run at ingestion
or build time.

A type is looked up as an own key of the registry, so a CMS item typed
`constructor`, `toString` or `__proto__` is unknown rather than resolving to
something off `Object.prototype`.

## The warning an adapter prints

A renderer that meets an item it cannot draw skips it and warns. The warning
text is built here, so the same stale CMS type reads the same way whether React
or Astro drew the page:

<!-- #region warning -->

```ts @import.meta.vitest
import { ERROR_MESSAGES } from '@evanion/widget';

const warning = ERROR_MESSAGES.UNKNOWN_WIDGET('listting', 'root');

warning; // -> 'Unknown widget type "listting" for widget ID "root". Skipping render.'
```

<!-- #endregion warning -->

`warnOnce` prints each distinct message once per process and prints nothing
when `NODE_ENV` is `production`. Every message carries the offending item's
`type` and `id`, which is what makes the text a usable key: a second bad item
is still reported.

## Exports

`defineWidgets`, `validateItems`, `warnOnce`, `resetWarnings`,
`ERROR_MESSAGES`, `VALIDATION_MESSAGES`, and the types `AnyWidgetItem`,
`WidgetRegistry`, `WidgetMeta`, `WidgetProblem`, `KnownWidgetTypes`.

`warnOnce` and `resetWarnings` are there for the adapters, which are separate
packages and cannot reach a module this one does not publish. A consumer has no
reason to call either.

## License

MIT
