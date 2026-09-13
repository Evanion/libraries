# @evanion/baize-ui

The Baize design system: the tokens as TypeScript, a stateless React component
set, and one stylesheet. Private to this repository — four apps render the same
design, and this is the one place its values live.

Spec: [`docs/specs/2026-09-12-baize-ui.md`](../../docs/specs/2026-09-12-baize-ui.md).
The visual design it implements: [`docs/specs/2026-09-10-demo-apps.md`](../../docs/specs/2026-09-10-demo-apps.md).

## Three entries

| Entry                          | Contents                                          | Consumers                                       |
| ------------------------------ | ------------------------------------------------- | ----------------------------------------------- |
| `@evanion/baize-ui`            | the components, stateless, no CSS import          | every app that renders React                    |
| `@evanion/baize-ui/tokens`     | the token values and their types, no React import | tests, build scripts, any JS that needs a value |
| `@evanion/baize-ui/styles.css` | the custom properties and the component classes   | every app, imported once in its root            |

The components ship class names only. Import the stylesheet once, in the app's
root:

```ts
import '@evanion/baize-ui/styles.css';
```

A CSS import inside the package's own module graph resolves under Next and does
not resolve uniformly under Astro, plain Vite SSR or a bare `node` import, which
is why it is a separate entry.

## Stateless

Every component takes props and returns elements. No hook of any kind, no state,
no context, no effect, no `await`, no `'use client'`. Astro, React Router SSR,
Next App Router and Nextra all render them identically, and a Server Component
can import them because nothing here reaches for an API the `react-server`
condition omits.

A primitive that needs client state — a disclosure, a tab set, a quantity
stepper, a theme toggle — belongs to the app that needs it, written in that app's
own `'use client'` file and styled with these classes. There is no `./client`
entry and there is not going to be one: the moment it exists, statelessness has
an exception and the next stateful component has a precedent instead of a
boundary.

## Props are already-formatted values

Strings for anything displayed, enum members for anything that selects a token,
`ReactNode` for slots. No `Intl` anywhere in the library, and nothing taking a
`Date` or a number it would have to render.

```tsx
<StatLine label="Wingspan at a glance">
  <Stat figure="1–5" label="players" />
  <Stat figure="40–70 min" label="playtime" />
  <Stat figure="2.4 / 5" label="weight">
    <WeightRamp label="weight 2.4 of 5" stop={3} />
  </Stat>
</StatLine>
```

The en dash in `1–5`, the unit in `40–70 min` and the thousands separator in a
price are locale decisions, and they belong where the request context is. A
component that took a game object would be one step from fetching, because the
next request is for the field the object does not carry yet.

## What is in it

| Export                           | Why                                                          |
| -------------------------------- | ------------------------------------------------------------ |
| `Title`, `Text`, `Figure`        | the two families, the tracking-by-size rule, tabular figures |
| `Card`, `Panel`, `SectionHeader` | the 12px radius and the two grounds, one definition          |
| `Button`, `ButtonLink`           | the 6px radius and the ink/parchment inversion               |
| `Chip`, `TagRow`, `MechanismTag` | the 3px radius and the mechanism hue binding                 |
| `AvailabilityPill`               | the other informational colour system                        |
| `StatLine`, `Stat`, `WeightRamp` | the design's hero and structural device                      |
| `CardGrid`, `CardGridCell`       | the card's own bed, at the width two apps agreed on          |
| `BoxArtPlaceholder`              | a gradient where the photograph of the box will go           |

What is out, and where it goes instead:

| Out                                           | Why                                                             |
| --------------------------------------------- | --------------------------------------------------------------- |
| Disclosure, tabs, quantity stepper, toggle    | needs state; the app writes it and styles it with these classes |
| Navigation, breadcrumbs, search               | needs a router                                                  |
| Two-column detail, filter sidebar, page shell | one app's page layout, and its widths are that app's            |
| A row with a column template                  | the hairline is shared and the template never is                |
| Cart, order row, checkout                     | domain vocabulary, not design vocabulary                        |

## Tokens

`src/tokens/*.ts` is the source. `src/tokens.generated.css` is written from it by
`npx nx run baize-ui:generate-tokens`, committed, and compared byte for byte in
`src/tokens-generated.test.ts`. A stylesheet cannot be type-checked —
`var(--baize-chlak)` compiles, renders nothing, and inherits whatever the parent
had — and a TypeScript object cannot be read from an `.astro` style block, so
both forms exist and a test keeps them identical.

```ts
import { ground, mechanism, weight } from '@evanion/baize-ui/tokens';

ground.felt; // '#142521'
mechanism.areaControl; // '#C98BE0'
weight[3]; // '#8AA096'
```

A consumer that renders no React resolves its class names from the same entry,
rather than spelling the stylesheet's naming convention out a second time:

```ts
import { classNames, hueClass, stateClass } from '@evanion/baize-ui/tokens';

hueClass('workerPlacement'); // 'baize-hue-worker-placement'
stateClass('reprintPending'); // 'baize-state-reprint-pending'
classNames('baize-title', hueClass('economic')); // 'baize-title baize-hue-economic'
```

`apps/storefront` is pure Astro and is the reason these sit here: its `.astro`
components emit the library's class names from frontmatter, and a literal
`baize-hue-worker-placement` in a template is a copy of a convention that drifts
the first time a token is renamed.

The foundation — ground, type, radii, spacing, tracking, elevation — is
`--baize-*` with no domain vocabulary in it. The two informational colour systems
are namespaced as `--baize-mechanism-*` and `--baize-availability-*`, so an app
that sells nothing can consume the foundation and reference neither.

There is no house colour. The catalogue supplies every saturated pixel, a primary
action inverts ink and parchment, and a test fails any token named like a brand,
an accent or a theme colour.

Fonts are named, not shipped. `type.title` and `type.text` say which families the
design asks for; each app loads them its own way, because a library shipping
`@font-face` with its own URLs would fight `next/font`, Astro's font handling and
a Vite-resolved stylesheet all at once.

## Box-art placeholders

A blurred gradient standing in for a photograph of the box, in roughly the box's
own colours, so a catalogue with no photography reads as a shelf of different
games rather than a grid of identical tiles.

```tsx
<BoxArtPlaceholder label="Brass: Birmingham" palette="soot" />
```

The palette is a token name and the mapping is catalogue data, which the app
owns:

```ts
const BOX_ART = { 'brass-birmingham': 'soot', azul: 'cobalt' } as const;
```

Palettes are named after pigments and materials, never after games or mechanisms,
and they are not a third informational colour system: a palette says nothing a
reader has to decode, the same way a photograph says nothing. With no palette the
tile paints a neutral gradient, which is what every entry looks like before an app
maps any of them.

## Looking at it

`src/visual-check.html` renders every primitive, every mechanism hue, every
availability state, the weight ramp and all twelve gradients against the real
stylesheet. Build first, then open it:

```sh
npx nx build baize-ui
open libs/baize-ui/src/visual-check.html
```

It is excluded from the packed files: it is a page for a reviewer, not part of the
package.
