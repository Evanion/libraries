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

```ts
import { defineWidgets, validateItems } from '@evanion/widget';
import type { AnyWidgetItem } from '@evanion/widget';

const registry = defineWidgets({ hero: Hero, prose: Prose });

const items: AnyWidgetItem[] = [
  {
    id: 'top',
    type: 'hero',
    props: { heading: 'Hello' },
    meta: { width: 'full' },
  },
  { id: 'about', type: 'prose', props: { body: '…' } },
];

validateItems(items, registry, { hero: ['heading'] }); // -> []
```

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
  meta?: Record<string, unknown>;
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

`meta` is placement: which column, what span, whether a rule sits above it. It
goes to the region's chrome and never into the widget's own props, because where
a widget sits is not something the widget should know.

`children` is nested items. What a renderer does with them is the runtime's
business — React renders them as the component's `children`, while an Astro
component receives child content through `<slot />` and is handed them as data
to open its own region over.

## `defineWidgets(registry)`

Returns the registry unchanged, typed as the literal object passed in.

```ts
const registry = defineWidgets({ hero: Hero, text: Text });
//    ^? { hero: typeof Hero; text: typeof Text }
```

Annotating the same object as `WidgetRegistry` would widen its keys to `string`,
and the key union is what an editor completes on and what a `required` map is
checked against.

## `validateItems(items, known, required?)`

Checks a list against the set of known types and returns `WidgetProblem[]`.
Problems rather than an exception, and accumulated rather than short-circuited,
so a caller can print all of them at once.

```ts
validateItems([{ id: 'a', type: 'nope', props: {} }], ['news']);
// -> [{ index: 0, id: 'a', type: 'nope', message: 'unknown widget type' }]
```

`known` is a registry or a plain list of names, so a CI script can validate a
payload without importing components it will never render.

`required` maps a type to the props that must be present and non-blank, where
blank means `undefined`, `null` or whitespace only — which is what a CMS text
field that was opened and left empty arrives as.

```ts
validateItems([{ id: 'a', type: 'hero', props: {} }], registry, {
  hero: ['heading'],
});
// -> [{ index: 0, id: 'a', type: 'hero', message: 'missing field heading' }]
```

No renderer calls this. Each one stays defensive — an item it cannot render is
skipped and warned about — and validation is the loud gate you run at ingestion
or build time.

A type is looked up as an own key of the registry, so a CMS item typed
`constructor`, `toString` or `__proto__` is unknown rather than resolving to
something off `Object.prototype`.

## Exports

`defineWidgets`, `validateItems`, `warnOnce`, `resetWarnings`,
`ERROR_MESSAGES`, `VALIDATION_MESSAGES`, and the types `AnyWidgetItem`,
`WidgetRegistry`, `WidgetMeta`, `WidgetProblem`, `KnownWidgetTypes`.

`warnOnce` and `resetWarnings` are there for the adapters, which are separate
packages and cannot reach a module this one does not publish. A consumer has no
reason to call either.

## License

MIT
