[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# @evanion/baize-ui

The Baize design system: the tokens as TypeScript, a stateless React component
set, and one stylesheet. Private to this repository — four apps render the same
design, and this is the one place its values live.

Private means private: `npm install @evanion/baize-ui` does not work and nothing
outside this workspace can consume it. It is not on
[docs.evanion.com](https://docs.evanion.com), which documents packages a reader
can install. This file is the manual, and it is written for whoever is working in
this repository.

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

Nothing in the `/tokens` graph imports React: a build script, a Nest response or
a test that needs the availability hue should not pull a renderer in behind it.

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
  <Stat figure="Midweight" label="complexity 2.4 / 5">
    <ComplexityRamp label="complexity 2.4 of 5" stop={3} />
  </Stat>
</StatLine>
```

The en dash in `1–5`, the unit in `40–70 min` and the thousands separator in a
price are locale decisions, and they belong where the request context is. A
component that took a game object would be one step from fetching, because the
next request is for the field the object does not carry yet.

## Where the boundary sits

| Out                                           | Why                                                             |
| --------------------------------------------- | --------------------------------------------------------------- |
| Disclosure, tabs, quantity stepper, toggle    | needs state; the app writes it and styles it with these classes |
| Navigation, breadcrumbs, search               | needs a router                                                  |
| Two-column detail, filter sidebar, page shell | one app's page layout, and its widths are that app's            |
| A row with a column template                  | the hairline is shared and the template never is                |
| Cart, order row, checkout                     | domain vocabulary, not design vocabulary                        |

## Using it

There is nothing to install. Add it to an app's dependencies as a workspace
package and the three entries resolve.

```json
{
  "dependencies": {
    "@evanion/baize-ui": "*"
  }
}
```

The workspace resolves `@evanion/*` imports straight to TypeScript source through
the `@evanion/source` export condition, so nothing has to be built before an app
typechecks against it. `styles.css` is the exception: it resolves to
`dist/styles.css`, so `nx build baize-ui` has to have run before an app's own
build can find it. Nx's project graph handles that ordering.

### The stylesheet goes in once

```ts
import '@evanion/baize-ui/styles.css';
```

In the app's root — `app/layout.tsx` under Next, the root layout under Astro, the
entry module under Vite. Once, not per component: the components ship class names
and no CSS of their own, and importing it twice is two copies of the same custom
properties.

The stylesheet carries the generated custom-property block and the component
classes. It expects to sit on a `--baize-ink` ground; give the page that
background, or the components render over whatever the host's is.

### In a React app

```tsx
import { Card, CardGrid, CardGridCell, Title } from '@evanion/baize-ui';

export function Catalogue({ games }: { games: Game[] }) {
  return (
    <CardGrid as="ul" label="Games">
      {games.map((game) => (
        <CardGridCell as="li" key={game.slug}>
          <Card head={<Title complexity={game.stop}>{game.title}</Title>}>
            …
          </Card>
        </CardGridCell>
      ))}
    </CardGrid>
  );
}
```

That component can be a Server Component. Nothing in the library reaches for an
API the `react-server` condition omits — no hook, no context, no effect — so the
whole set is importable from the server graph.

Formatting happens at the call site, because the library takes already-formatted
strings:

```tsx
<Stat
  figure={`${game.minPlayers}–${game.maxPlayers}`}
  label="players"
/>
<Figure>{currency.format(price)}</Figure>
```

### In an Astro app

`apps/storefront` renders no React at all. Its components emit the library's
class names from frontmatter, resolved through the same functions the React
components use:

```astro
---
import { classNames, hueClass, modifier } from '@evanion/baize-ui/tokens';

interface Props {
  mechanism?: import('@evanion/baize-ui/tokens').Mechanism;
}

const { mechanism } = Astro.props;
---

<span class={classNames('baize-chip', mechanism && hueClass(mechanism))}>
  <slot />
</span>
```

Resolving the class rather than writing `baize-hue-worker-placement` as a literal
is the point: a literal is a second copy of the stylesheet's naming convention,
and it drifts the first time a token is renamed.

`modifier('baize-button', 'variant', 'primary')` produces
`baize-button--variant-primary`, which is how a template reaches the variant
classes the React components get from their `cva` recipes.

### Stateful primitives

Write them in the app, in the app's own `'use client'` file, styled with these
classes:

```tsx
'use client';

import { useState } from 'react';
import { Button, Panel } from '@evanion/baize-ui';

export function Filters({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Panel heading="Filters">
      <Button variant="quiet" onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Show'}
      </Button>
      {open ? children : null}
    </Panel>
  );
}
```

`Button` and `Panel` stay stateless; the disclosure is the app's. There is no
`./client` entry to put it in, and there is not going to be one.

### In a test or a build script

```ts
import { availability, complexityTier } from '@evanion/baize-ui/tokens';
```

The `/tokens` entry imports no React, so a Vitest run, a Nest response or a build
script can read a value without pulling a renderer in behind it.

That is what makes the tokens usable as data:

```ts
const tier = complexityTier(game.weight);

return {
  title: game.title,
  complexity: tier.name,
  complexityStop: tier.stop,
};
```

An API can serialise the tier name and the stop, and the front end renders the
colour from the stop rather than from a hex the API invented.

## Components

| Export                               | Why                                                          |
| ------------------------------------ | ------------------------------------------------------------ |
| `Title`, `Text`, `Figure`            | the two families, the tracking-by-size rule, tabular figures |
| `Title`'s `complexity` prop          | the colour ladder, bound where a reader identifies a game    |
| `Card`, `Panel`, `SectionHeader`     | the 12px radius and the two grounds, one definition          |
| `Button`, `ButtonLink`               | the 6px radius and the ink/parchment inversion               |
| `Chip`, `TagRow`, `MechanismTag`     | the 3px radius; `Chip` is the one place a mechanism is hued  |
| `AvailabilityPill`                   | a state, which is not a ladder, so it keeps its own colours  |
| `StatLine`, `Stat`, `ComplexityRamp` | the design's hero and structural device                      |
| `CardGrid`, `CardGridCell`           | the card's own bed, at the width two apps agreed on          |
| `BoxArtPlaceholder`                  | a gradient where the photograph of the box will go           |

Every one of them renders class names that `@evanion/baize-ui/styles.css`
defines. Nothing here holds state.

### `Title`

```tsx
<Title as="h1" size="xl" complexity={3}>
  Wingspan
</Title>
```

| Prop         | Type                                     | Default | Notes                             |
| ------------ | ---------------------------------------- | ------- | --------------------------------- |
| `as`         | `'h1' \| 'h2' \| 'h3' \| 'h4' \| 'span'` | `'h2'`  | heading level, or `span`          |
| `size`       | `'sm' \| 'md' \| 'lg' \| 'xl'`           | `'md'`  | tracked tighter as it gets larger |
| `complexity` | `ComplexityStop` (1–5)                   | none    | takes that stop's ramp colour     |

The heading level is document structure and belongs to the page, not to the
component: the same game title is an `h1` on its own page and an `h3` in a grid.
The union is closed, so a title cannot be made into an arbitrary element.

This is where the complexity ladder binds. The design makes the title the place a
reader identifies a game by colour, and the one thing the ladder carries is
complexity — so the binding lives in one component and takes one ordinal value.
There is no `mechanism` prop: a game's title must not be coloured by its
category.

Omit `complexity` and the title is `chalk`. A heading that names no game sits on
no rung.

### `Text`

```tsx
<Text tone="lichen" size="base" measured>
  A competitive bird-collection engine builder.
</Text>
```

| Prop       | Type                                     | Default    |
| ---------- | ---------------------------------------- | ---------- |
| `as`       | `'p' \| 'span' \| 'div' \| 'dd' \| 'dt'` | `'p'`      |
| `tone`     | `'chalk' \| 'lichen' \| 'moss'`          | `'lichen'` |
| `size`     | `'xs' \| 'sm' \| 'base' \| 'md'`         | `'base'`   |
| `measured` | `boolean`                                | `false`    |

`measured` holds the passage to the prose measure, which is one width — a passage
either sits inside it or does not, so it is a boolean rather than a scale.

### `Figure`

```tsx
<Figure size="lg">$45.00</Figure>
```

A number set in tabular figures, so a column of them aligns. `children` is typed
`string`, not `number`: the en dash in `1–5`, the thousands separator and the
currency all depend on a request context this library does not have.

It exists as a component rather than as a paragraph because the design makes
numeric alignment a requirement — `font-variant-numeric` set in one app and
forgotten in another is exactly the drift the library is for. A price, a quantity
and a stat figure are all this.

### `Card`

```tsx
<Card
  head={<Title complexity={4}>Brass: Birmingham</Title>}
  foot={<ButtonLink href="/games/brass">Details</ButtonLink>}
>
  <Text>…</Text>
</Card>
```

The 12px-radius surface on `felt`. One definition of the radius, the border and
the elevation.

`head` is a slot rather than a `title` string, because what goes in it is a
`Title` the app may have wrapped in its own link. `foot` is pinned to the card's
foot however tall the body is, so a row of cards has one baseline at the bottom.

### `Panel`

```tsx
<Panel heading="Filters">…</Panel>
```

A recessed surface: the same radius as a card, a ground mixed back towards `ink`,
and no elevation. What a sidebar block and a dashboard tile are.

### `SectionHeader`

```tsx
<SectionHeader
  heading={<Title as="h2">In stock</Title>}
  aside={<Text size="sm">24 titles</Text>}
/>
```

A heading with something opposite it, baseline-aligned, with the section's space
below.

It is not page chrome: it carries no nav, no width and no landmark, so each app's
shell still owns those.

### `Button` and `ButtonLink`

```tsx
<Button variant="primary" onClick={addToCart}>Add to cart</Button>
<ButtonLink href="/checkout" variant="standard">Checkout</ButtonLink>
```

| Prop            | `Button`                                                   | `ButtonLink` |
| --------------- | ---------------------------------------------------------- | ------------ |
| `variant`       | `'primary' \| 'standard' \| 'quiet'`, default `'standard'` | same         |
| `onClick`       | yes                                                        | no           |
| `type`          | `'button' \| 'submit' \| 'reset'`, default `'button'`      | no           |
| `disabled`      | yes                                                        | no           |
| `name`, `value` | yes                                                        | no           |
| `href`          | no                                                         | required     |

Two components rather than one polymorphic `as` prop, because the two differ in
more than their tag: a link has no disabled state and no handler, and a
`<button>` inside a navigation is the accessibility defect this split avoids.

`primary` inverts ink and parchment. There is no brand button, because the design
has no house colour — the catalogue supplies every saturated pixel, and a button
is not catalogue.

Taking an `onClick` is not state: the component renders the handler and owns
nothing. `name` and `value` are submission, which is how a form with two submits
tells them apart before hydration.

`href` is a resolved string, not a route object. This library imports no router,
and the app that has one has already turned its route into a URL by the time it
renders.

### `Chip`

```tsx
<Chip mechanism="workerPlacement">worker placement</Chip>
```

The 3px-radius chip: a tint and a hairline mixed from the current colour. The one
place a mechanism still carries its hue — a chip on the category index labels the
mechanism itself, where there is no game and so no ladder for it to compete with.

### `MechanismTag`

```tsx
<MechanismTag label="co-op" />
```

A mechanism name in the secondary text colour. It takes no mechanism token and
paints no hue.

Mechanism is categorical and the colour ladder is ordinal; the design spends its
one saturated colour per card on the ordinal one. A component that could be
handed a hue is a component somebody hands one, so this one cannot be.

`label` is what the catalogue spells — `co-op` rather than `cooperative`.

### `AvailabilityPill`

```tsx
<AvailabilityPill availability="reprintPending" label="reprint pending" />
```

A dot in the state colour, then the label. The dot is decoration and is drawn by
the stylesheet, so the label is the whole accessible name and a reader who cannot
see the colour loses nothing.

### `TagRow`

A wrapping row of chips or tags, on the chip gap.

### `StatLine`, `Stat` and `ComplexityRamp`

```tsx
<StatLine size="lg" label="Wingspan at a glance">
  <Stat figure="1–5" label="players" />
  <Stat figure="40–70 min" label="playtime" />
  <Stat figure="Midweight" label="complexity 2.4 / 5">
    <ComplexityRamp label="complexity 2.4 of 5" stop={3} />
  </Stat>
</StatLine>
```

The design's hero and structural device. It leads rather than sitting beneath a
photograph, because those three figures are how anyone identifies a game at a
glance.

Columns are sized to their content rather than split into equal thirds, which is
what stops a playtime range from wrapping at narrow widths. `size` is `'base'` or
`'lg'`; `lg` is what the line takes when it leads a page rather than a card.

`label` names the group for a screen reader and gives the element `role="group"`.
Without it there is no role.

`Stat` puts the figure above its label, and the figure first in the document, so
a screen reader reaches the value before the word. Both are already-worded
strings.

`ComplexityRamp` is five pips, filled up to the stop, each filled pip in its own
ramp colour. Per-pip colour rather than one colour for the filled run: the ramp
is sequential, and a bar that lightens left to right reads as a scale where a
uniform bar reads as a count. They are the same five colours the title above is
set in, so the ladder on a card is one statement made twice rather than two
channels to reconcile.

Its `label` is the accessible name, already worded and already formatted — the
ramp is a graphic with `role="img"`, so it is the only thing a screen reader
gets.

### `CardGrid` and `CardGridCell`

```tsx
<CardGrid as="ul" label="Games">
  {games.map((game) => (
    <CardGridCell as="li" key={game.slug} wide={game.featured}>
      <Card>…</Card>
    </CardGridCell>
  ))}
</CardGrid>
```

As many 17rem columns as fit, on the card gap. `wide` takes two columns where the
grid is wide enough for them — a featured entry, and the one layout decision a
cell makes.

The cell stretches its child to full height, so a row of cards has one baseline
at its foot.

This is in the library rather than in each app because two apps built it
independently and landed on the same `minmax(17rem, 1fr)` and the same 1rem gap.
What is still the app's: which cards, in which order, and what sits around the
grid.

### `BoxArtPlaceholder`

```tsx
<BoxArtPlaceholder label="Brass: Birmingham" palette="soot" />
```

A blurred gradient where a photograph of the box will go, in roughly the box's
own colours, so a catalogue with no photography reads as a shelf of different
games rather than a grid of identical tiles.

With no `palette` the tile paints a neutral gradient — felt lit from the top left
— which is what every entry looks like before an app maps any of them.

With no `label` the tile is `aria-hidden`, because a gradient standing in for a
picture of a box has nothing to say about the box.

CSS-only. The softness is the falloff on layered radial gradients, not a
`filter: blur()` — a blur would cost a compositing layer per tile, and on a grid
of twenty tiles that is twenty layers for an effect the gradient already has.

Which game gets which palette is catalogue data and belongs to the app:

```ts
const BOX_ART = { 'brass-birmingham': 'soot', azul: 'cobalt' } as const;
```

See [Box-art palettes](#box-art-palettes) for why a palette is not a third
informational colour system.

## Tokens

```ts
import {
  complexity,
  complexityTier,
  ground,
  mechanism,
} from '@evanion/baize-ui/tokens';

ground.felt; // '#142521'
mechanism.areaControl; // '#C98BE0'
complexity[3]; // '#C5A96A'
complexityTier(2.4).name; // 'Midweight'
```

### Two forms, one source

`src/tokens/*.ts` is the source. `src/tokens.generated.css` is written from it by
`npx nx run baize-ui:generate-tokens`, committed, and compared byte for byte in
`src/tokens-generated.test.ts`.

Both forms exist because a stylesheet cannot be type-checked —
`var(--baize-chlak)` compiles, renders nothing, and inherits whatever the parent
had — and a TypeScript object cannot be read from an `.astro` style block. The
test is what keeps them identical.

Naming follows one rule: a token name is kebab-cased for its custom property, and
the same kebab-casing produces the class that reads it.
`mechanism.workerPlacement` is `--baize-mechanism-worker-placement` and
`baize-hue-worker-placement`.

### The ground

Six values, chromatic rather than tinted black, because the subject is baize.

| Token    | Value     | Role                                |
| -------- | --------- | ----------------------------------- |
| `ink`    | `#0C1714` | page                                |
| `felt`   | `#142521` | panels, cards, anything raised      |
| `rule`   | `#2A3F39` | hairlines                           |
| `chalk`  | `#F2EDE3` | primary text — warm, rulebook paper |
| `lichen` | `#8FA69E` | secondary text                      |
| `moss`   | `#5E736C` | tertiary text                       |

The foundation — ground, type, radii, spacing, tracking, elevation — is
`--baize-*` with no domain vocabulary in it, so an app that sells nothing can
consume it and reference neither informational colour system.

There is no house colour. The catalogue supplies every saturated pixel, a primary
action inverts ink and parchment, and a test fails any token named like a brand,
an accent or a theme colour.

### Complexity: ordinal

```ts
complexity; // { 1: '#908B75', 2: '#A89B72', 3: '#C5A96A', 4: '#E4B665', 5: '#FEC57E' }
```

The only saturated informational ramp in the system. Complexity is ordinal, so
the ramp is sequential: lightness and chroma both rise with the stop, and the hue
turns from olive towards amber as they do. One direction, three channels agreeing
— a Gateway title is a quiet dust colour against the felt and a Brain-burner's is
hot brass, and the order reads without a legend.

Amber rather than green or blue, because felt is a green table and the
availability pills are green, blue and grey-green. The warm family is the one
nothing else on a card occupies.

Every stop is held to `COMPLEXITY_CONTRAST_FLOOR`, 4.5:1 against `felt` — WCAG AA
for normal text, because the ladder paints a game's title, and a card title at
18px bold is 13.5pt, under the 14pt-bold threshold the 3:1 large-text allowance
needs.

```ts
complexityTier(2.4); // { stop: 3, name: 'Midweight', floor: 2 }
complexityTier(4.5); // { stop: 5, name: 'Brain-burner', floor: 3.9 }
```

The tier carries what the colour carries, which is what keeps the ladder out of
WCAG 1.4.1: a reader who sees no hue difference still reads `Gateway` and
`Brain-burner`. The words are BoardGameGeek's vocabulary for rules overhead,
because a bare `2.4 / 5` means nothing to a shopper who has not learnt the scale.

`complexityTier` is total and clamped at both ends. A rating off the scale, or no
rating at all, is better shown as the nearest tier than as a thrown error in the
middle of a card grid; an app that distinguishes unrated from Gateway checks the
rating before asking.

The five cutoffs come from the catalogue's own distribution rather than from
cutting 1–5 into fifths — even fifths put nine of twelve titles into two tiers
and left the top and bottom stops unused, and a ramp with three colours in it
does not demonstrate a ramp.

### Mechanism: categorical

```ts
mechanism.engineBuilding; // '#E9B24C'
mechanism.other; // '#C0B39A'
```

Nine hues, one per mechanism family. Categorical rather than ordinal: no
mechanism outranks another, so the hues are spread around the wheel at a roughly
even lightness instead of forming a ramp.

`other` is the hue for a mechanism with no entry — warm grey, and the only
unsaturated value in the scale, so an unmapped mechanism reads as uncategorised
rather than as a ninth category.

The vocabulary is what the catalogue contains, not a fixed nine. A mechanism the
catalogue starts carrying is a new entry in the token module, reviewed against
`MECHANISM_CONTRAST_FLOOR`, and renders as `other` until then.

Only `Chip` paints a mechanism hue. See [`MechanismTag`](#mechanismtag) for why.

### Platform: recognised, not learned

```ts
platform.react; // '#58C4DC'
platformOnLight.react; // '#1B6E80'
```

The colour a platform is already known by, for a chip that names the stack a
package runs in: React, Astro, NestJS, and `universal` for a package that
imports no framework, which takes TypeScript's blue. Two ends like the
categorical scale, because a brand colour is tuned for its own site and none of
the four clears 4.5:1 on both grounds as published.

Separate from `categorical` on purpose. A categorical hue is an identity the
app assigns and a reader learns on the page; a platform hue is one the reader
arrives knowing. `<Chip platform="react">` is the only thing that paints one.

### Availability: state

```ts
availability.inStock; // '#7FB88C'
availability.preorder; // '#8FA8D8'
availability.reprintPending; // '#C9A15E'
availability.outOfPrint; // '#8FA69E'
```

Four state colours, and a state pill is the only place they appear. They sit at a
lower chroma than the mechanism hues and are read through a dot and a label,
which is what keeps the two systems apart where their hue families meet on one
card.

`outOfPrint` is `lichen` rather than `moss`: moss is the tertiary text colour and
reaches only 3.15:1 on felt, under the floor for the pill's own label.

Each is held to `AVAILABILITY_CONTRAST_FLOOR`, and a test computes the ratio for
every value and fails naming the one that drops under it.

### Box-art palettes

```ts
boxArt.soot; // { from: '#C8922F', via: '#4A3B2A', to: '#1A1714' }
```

Twelve palettes, three stops each, ordered light to dark. They approximate the
colours a real box is printed in.

They are not a third informational colour system, and two rules keep it that way,
both tested:

- No palette is named after a mechanism or an availability state, so no reader
  can learn that this gradient means co-op. They are named after pigments and
  materials — `soot`, `garnet`, `cobalt`, `terracotta`, `oak`, `loam`.
- The `--baize-box-art-*` properties are referenced only inside the
  `.baize-box-art` rules, never as a text or border colour.

A game whose box matches nothing here is a new palette in the token module,
reviewed the way a new mechanism hue is, and falls back to the neutral gradient
until then.

### Type, geometry, motion

```ts
type.title; // "'Bricolage Grotesque', 'Arial Narrow', ui-sans-serif, sans-serif"
type.text; // "'Public Sans', ui-sans-serif, system-ui, sans-serif"
```

Fonts are named, not shipped. Each app loads them its own way — `next/font` in
the Next apps, Astro's font handling in the storefront, a Vite-resolved
`@font-face` in admin — and a library shipping `@font-face` with its own URLs
would fight all three. Nothing here can observe what an app loaded.

| Group       | Members                                            |
| ----------- | -------------------------------------------------- |
| `text`      | `xs sm base md lg xl 2xl`, `0.75rem` to `3.375rem` |
| `tracking`  | `tight snug normal loose`, `-0.03em` to `0.04em`   |
| `leading`   | `tight snug normal` — display, headings, prose     |
| `radius`    | `chip: 3px`, `button: 6px`, `card: 12px`           |
| `space`     | eight steps, `0.25rem` to `4rem`                   |
| `measure`   | `'64ch'`                                           |
| `elevation` | `card`, `raised`                                   |
| `motion`    | `duration: '120ms'`, `easing: cubic-bezier(…)`     |

The scale is in rem so that it follows the reader's own font size. One of the two
apps that built a scale built it in px, which does not.

Tracking runs opposite by size: negative on heavy display type, where the default
spacing reads loose, and positive on small uppercase labels, where it reads
cramped.

Radii are by role rather than one radius everywhere, because the role is what a
reader recognises a chip by before reading it.

Elevation is a black shadow plus a tinted glow at 4%. The glow is what keeps a
raised surface on a chromatic ground from reading as a grey card dropped onto
green.

Motion is interaction-only: one duration and one easing, spent on hover and focus
and on nothing that moves by itself. `styles.css` drops both under
`prefers-reduced-motion`.

### Class-name resolvers

```ts
import { classNames, hueClass, stateClass } from '@evanion/baize-ui/tokens';

hueClass('workerPlacement'); // 'baize-hue-worker-placement'
stateClass('reprintPending'); // 'baize-state-reprint-pending'
classNames('baize-title', hueClass('economic')); // 'baize-title baize-hue-economic'
```

| Function                      | Produces                                        |
| ----------------------------- | ----------------------------------------------- |
| `hueClass(mechanism)`         | `baize-hue-…`, binding `--baize-hue`            |
| `ladderClass(stop)`           | `baize-ladder-…`, binding `--baize-ladder`      |
| `stateClass(availability)`    | `baize-state-…`, binding `--baize-state`        |
| `paletteClass(palette)`       | `baize-palette-…`, binding the three stops      |
| `modifier(base, name, value)` | `base--name-value`, a component's variant class |
| `classNames(...)`             | joins, dropping what did not apply              |

These live on the React-free entry because the consumer that needs them most
renders no React. `apps/storefront` is pure Astro: its components emit these
class names from frontmatter, and a template with a literal
`baize-hue-worker-placement` in it would be a second copy of the stylesheet's
naming convention, drifting the moment a token is renamed.

One class per token rather than a modifier per component, so the stylesheet stays
at one rule per mechanism rather than one per mechanism per component. A title, a
chip and a tag all want the same hue.

`classNames` exists because the alternative in an `.astro` template is a ternary
per optional class inside a `class` attribute, which is where a stray `undefined`
ends up in the rendered markup.

## Looking at it

`src/visual-check.html` renders every primitive, every mechanism hue, every
availability state, the complexity ladder on a title and on its ramp, and all
twelve gradients against the real stylesheet. Build first, then open it:

```sh
npx nx build baize-ui
open libs/baize-ui/src/visual-check.html
```

It is excluded from the packed files: it is a page for a reviewer, not part of
the package.

After editing anything under `src/tokens/`:

```sh
npx nx run baize-ui:generate-tokens
```

`src/tokens.generated.css` is committed, and `tokens-generated.test.ts` renders
it again and compares byte for byte. Editing the token module without
regenerating fails that test; editing the generated file by hand fails it too.
