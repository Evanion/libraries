# @evanion/ui

**Native elements, one layered stylesheet, and React components with no state.**

`@evanion/ui` is a small UI core for admin consoles and dashboards. The components render native elements (`<button>`, `<input>`, `<table>`, `<dialog>`) and hold no state, call no hook and read no context. They render the same markup under server rendering, in a single-page app and in a React Server Component. The stylesheet sets every colour through tokens, so a product theme redefines those tokens and the components follow.

<!-- #region flag-row -->

```tsx @import.meta.vitest
// A flag row: the switch submits its own form, so it works before any
// JavaScript has loaded. Props are already-formatted strings.
const row = renderToStaticMarkup(
  <form method="post">
    <input type="hidden" name="enabled" value="false" />
    <Switch checked label="checkout-v2" />
    <Badge tone="positive">On</Badge>
  </form>,
);

row; // -> '<form method="post"><input type="hidden" name="enabled" value="false"/><button type="submit" role="switch" aria-checked="true" aria-label="checkout-v2" class="switch"></button><span class="badge" data-tone="positive">On</span></form>'
```

<!-- #endregion flag-row -->

## Capabilities

- **Stateless components**: no hook, state, context or effect. They import nothing from React beyond what JSX compiles to, and a test resolves them under the `react-server` condition to prove it.
- **Formatted props**: every displayed value is a string the caller formatted. The package uses no `Intl` and holds no message catalogue, so the app decides locale and wording.
- **Native behaviour**: a `Switch` is a submit button with `role="switch"`, a `Dialog` opens through invoker commands (`command` and `commandfor`), and a `Field` shows invalid state through `:user-invalid`. None of them needs client JavaScript.
- **Cascade layers**: the stylesheet declares `reset, tokens, base, layout, components` in that order. A theme in unlayered CSS beats every layer without `!important`.
- **No preset at runtime**: the published CSS holds plain values. A consumer needs no PostCSS plugin and no Open Props, and the token names do not collide with Open Props if the app loads it anyway.
- **Requirements**: React 18 or 19 as a peer dependency. ESM only, Node 20 or newer.

## Installation

```bash
npm install @evanion/ui
```

## Entries

| Entry                    | Contents                                                                     |
| ------------------------ | ---------------------------------------------------------------------------- |
| `@evanion/ui`            | the components; no CSS import                                                |
| `@evanion/ui/styles.css` | the reset, the tokens with a neutral theme, the shell, the component classes |
| `@evanion/ui/client`     | `enableCopy()`, the copy behaviour, in plain DOM                             |

Import the stylesheet once, in the app's root, and your theme after it:

```ts
import '@evanion/ui/styles.css';
import './theme.css';
```

The components import no CSS. Next resolves a CSS import inside a package, and plain Vite SSR, Astro and a bare Node import do not, so the stylesheet is its own entry.

## Components

| Component                 | Renders                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Button`, `ButtonLink`    | `<button type="button">` or `<a>` with `class="button"`; `variant="primary"` inverts ink and ground             |
| `Field`                   | a label, an input, a hint and an error, wired with `aria-describedby` and `aria-invalid`; takes a required `id` |
| `Switch`                  | `<button type="submit" role="switch" aria-checked>`, one form per switch                                        |
| `Badge`                   | a chip with an optional `tone`                                                                                  |
| `Card`                    | a `<section>` named by its `title`                                                                              |
| `PageHeader`              | the page's `<h1>`, a description and actions                                                                    |
| `EmptyState`              | a dashed box for an empty list                                                                                  |
| `Alert`                   | a toned message; `role="alert"` for `negative` and `warning`, `role="status"` otherwise                         |
| `CopyValue`               | a value in mono with a copy button, optionally shortened to its start and end                                   |
| `CodeBlock`               | preformatted code with an optional label and copy button                                                        |
| `CopyButton`              | the copy button `CopyValue` and `CodeBlock` use                                                                 |
| `Dialog`, `dialogCommand` | a native modal `<dialog>` and the attributes that open and close it                                             |

`Field` takes `id` because a stateless component cannot call `useId`. The hint is `<id>-hint` and the error `<id>-error`.

The data table, the shell and two layout helpers are classes only:

| Class                                                                     | Use                                                                                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `.app-shell`, `.app-header`, `.app-nav`, `.app-main`, `.app-footer`       | a grid shell: header across the top, nav beside main, footer under; the nav becomes a row under 48rem                |
| `.widget`                                                                 | `display: contents`, for a wrapper between the shell and its areas                                                   |
| `.data-table`                                                             | a native `<table>`; rows stack when `.app-main` is under 36rem, and a cell's `data-label` replaces the hidden header |
| `.stack`, `.card-grid`, `.form`, `.form-row`, `.mono`, `.visually-hidden` | layout and text helpers                                                                                              |

A shell with a tone (`<div class="app-shell" data-tone="warning">`) rules its header in that tone, which is how a console marks a production page.

### Dialog

```tsx
<Button {...dialogCommand('invite')}>Invite</Button>
<Dialog id="invite" title="Invite a member" closeLabel="Close">
  <form method="post">…</form>
</Dialog>
```

`dialogCommand(id)` returns `{ commandfor: id, command: 'show-modal' }`. Invoker commands are Baseline since December 2025. `closedBy="any"` (the default) adds a backdrop click to Escape where the browser supports `closedby`.

## Copying

`CopyValue`, `CodeBlock` and `CopyButton` render a button carrying `data-copy` and a live region beside it. They hold no state. `enableCopy()` from `@evanion/ui/client` makes those buttons work: one delegated click listener writes the clipboard, sets `data-copied` on the button for 1.5s (the stylesheet swaps the label) and writes the copied label into the live region so a screen reader hears it.

```ts
// entry.client.tsx under React Router, or main.tsx in a SPA
import { enableCopy } from '@evanion/ui/client';

enableCopy();
```

Why a DOM helper and not a client component: a `'use client'` copy button is a hydration boundary in every page that shows a key, and its state lives in React, so a server-rendered page copies nothing until hydration finishes. The helper keeps every component stateless, adds one listener per page, and covers buttons added later. Before the helper runs, a click on the value selects all of it (`user-select: all`), so a reader can still copy by hand.

## Theming

`styles.css` ships a neutral theme: grey chrome with no hue, system fonts, and green, red and amber for the three default tones. A product theme redefines the tokens on `:root` in unlayered CSS. Every token uses `light-dark()`, so set both halves.

```css
/* theme.css */
:root {
  --font-ui: 'Geist Variable', system-ui, sans-serif;
  --font-code: 'Geist Mono Variable', ui-monospace, monospace;
  --color-canvas: light-dark(oklch(97.5% 0.004 250), oklch(17% 0.014 250));
  /* … */
}
```

| Group   | Tokens                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type    | `--font-ui`, `--font-code`, `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--weight-normal`, `--weight-medium`, `--weight-bold`, `--tracking-display`, `--tracking-label` |
| Ground  | `--color-canvas`, `--color-surface`, `--color-surface-muted`, `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-muted`, `--color-text-faint`                            |
| Actions | `--color-primary`, `--color-primary-contrast`, `--color-focus`, `--color-switch-thumb`, `--color-backdrop`                                                                                     |
| Tones   | `--tone-neutral`, `--tone-positive`, `--tone-negative`, `--tone-warning`, each with a `-surface` pair                                                                                          |
| Space   | `--space-1` to `--space-6`                                                                                                                                                                     |
| Shape   | `--radius-chip` (3px), `--radius-control` (6px), `--radius-card` (12px), `--radius-pill`, `--shadow-card`, `--shadow-popover`                                                                  |
| Motion  | `--ease-standard`, `--duration-quick`                                                                                                                                                          |
| Layout  | `--shell-nav-width`, `--control-height`                                                                                                                                                        |

No font files ship with the package. A theme that wants a webfont loads it and names it in `--font-ui` or `--font-code`.

### Tones

Colour carries data and nothing else. An element with `data-tone="<name>"` reads two properties, `--tone` and `--tone-surface`, and the stylesheet maps `positive`, `negative`, `warning` and `neutral` onto them. A theme adds its own tone with two tokens and one rule:

```css
:root {
  --tone-production: light-dark(oklch(58% 0.15 65), oklch(80% 0.15 75));
  --tone-production-surface: light-dark(oklch(95% 0.05 80), oklch(30% 0.07 70));
}

[data-tone='production'] {
  --tone: var(--tone-production);
  --tone-surface: var(--tone-production-surface);
}
```

`<Badge tone="production">` then renders in amber. `Tone` in TypeScript accepts any string and suggests the four built-in names.

## License

MIT
