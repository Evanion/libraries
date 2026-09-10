# react-widget: drop context, become RSC-capable

Status: approved, not implemented
Package: `@evanion/react-widget` (0.1.0 published; `adjustSemverBumpsForZeroMajorVersion` in `nx.json` makes a breaking change a 0.2.0 bump)
Closes: #25, #26, #27, #71. Reverts #24 and part of #23's approach.

## Decisions

1. Drop both React contexts: `WidgetsContext` (`widget.tsx:39`) and
   `NestedWidgetsContext` (`utils.tsx:26`).
2. Drop the injected `Output` component. Children render into the standard
   `children` prop.
3. Ship no default error boundary. Consumers add one in custom chrome.
4. Add `validateItems`, the counterpart to astro-widget's `validateBlocks`.
5. Add `meta` for #71 and `ctx` for parity with astro-widget.
6. No `'use client'`, one entry, usable from React Server Components.

## Why context has to go

React 19.2.8's `react-server` export condition provides:

```
cache cacheSignal captureOwnerStack Children cloneElement createElement createRef
forwardRef Fragment isValidElement lazy memo Profiler StrictMode Suspense use
useCallback useDebugValue useId useMemo version
```

It omits `Component`, `createContext`, `useContext`, `PureComponent` and every
stateful hook. `index.ts:1` carries `'use client'` for exactly this reason, and
its own comment says so. Removing the two `createContext` calls and the class
error boundary is what removes the directive.

`Suspense` and `memo` are available on the server and stay.

## Renderer

```tsx
// utils.tsx, internal
renderWidget(item, components, ItemWrapper, ctx): ReactNode

<ItemWrapper
  key={item.id}
  data-widget-id={item.id}
  data-widget-type={item.type}
  meta={item.meta}
>
  <Suspense fallback={suspenseFallback}>
    <Component {...item.props} ctx={ctx}>
      {(item.children ?? []).map((c) => renderWidget(c, components, ItemWrapper, ctx))}
    </Component>
  </Suspense>
</ItemWrapper>
```

Suspense sits in `renderWidget`, not in `DefaultItem`. A custom `chrome.item`
then cannot silently strip it. This is the lesson of commit 8a1efc0, which moved
the error boundary out of `DefaultItem` for the same reason, applied to the only
boundary that still exists.

The `memo(Output)` identity trick at `widget.tsx:47-52` is deleted. It existed
because `Output` was a separately mounted component reading context; direct
recursion has no such hazard. `Widgets` stays memoised.

## Public API

Before: `createWidgets(config) -> { Widgets, WidgetsProvider, useWidgets, Output, defineItems }`

After: `createWidgets(config) -> { Widgets, defineItems, validateItems }`

- `WidgetsConfig<C>`: `{ components: C; chrome?: WidgetsChrome }`. The `context`
  field at `types.ts:116` is deleted — there is no context to inject into.
- `WidgetsProps<C>`: `{ items; components?; chrome?; ctx? }`.
- `WidgetsChrome`: `{ wrapper?; item?; suspenseFallback? }`.
- `WidgetItemComponent`: gains `meta?: Record<string, unknown>`. Otherwise
  unchanged, so existing chrome keeps working.
- `WidgetItem<C>`: `props` becomes `Omit<ComponentProps<C[K]>, 'children'>`;
  gains optional `meta`; `children` is type-gated — permitted only when the
  mapped component accepts `children`, typed `never` otherwise.
- `validateItems`, `WidgetItemProblem`: new.

Removed: `WidgetsProvider`, `useWidgets`, `Output`, `WidgetOutputProps`,
`NestedWidgetsContext`, `NestedWidgets`, `WidgetsConfig.context`,
`WidgetErrorBoundary`, `DEFAULT_STYLES.ERROR`, `DEFAULT_STYLES.LOADING`,
`ERROR_MESSAGES.WIDGET_ERROR`, `ERROR_MESSAGES.WIDGET_FAILED`,
`ERROR_MESSAGES.LOADING`.

`renderWidget` stays internal and is not re-exported (#26 point 2).

## What this dissolves

| Issue | Outcome |
| --- | --- |
| #24 `chrome.item` removes the error boundary | No default boundary exists |
| #25.1 provider value ignored | No context exists |
| #25.2 children vanish when a component skips `<Output/>` | Type-gated at compile time |
| #23, #25.3 malformed items | `validateItems` plus skip-and-warn in the renderer |

## #71: `meta`

`meta?: Record<string, unknown>` on the item, forwarded to `ItemWrapper` only,
never spread into `item.props`. Erased, with no extra generic on `createWidgets`.

Meta has no per-type shape to distribute over `keyof C` the way `props` does, so
a typed-meta generic would cost a type parameter for a feature most consumers
will not use. Passing the whole item instead would duplicate `props` and
`children` under another name, which #71 itself flags as undesirable.
`RenderableWidgetItem` stays erased; re-narrowing risks the TS2590 that the
single documented widening exists to avoid.

astro-widget needs the same change. `Widgets.astro:31` does
`const { type, id, children, ...props } = item` and then spreads `{...props}`
into both `<Item>` and `<Component>`, so placement data currently leaks into
widget props. Destructure `meta` out and pass it to `Item` only.

## `validateItems`

```ts
validateItems(items: unknown, components: WidgetComponentMap): WidgetItemProblem[]
```

Returns problems, never throws, accumulates rather than short-circuits, recurses
into `children`. Mirrors `validate-blocks.ts`.

Checks: non-array root, non-object or null item, non-string `id` or `type`,
unknown `type`, non-object `props`, non-array `children`, duplicate sibling
`id`s.

No `required` parameter. `validateBlocks` needs one because Astro components are
opaque; react-widget gets required-prop checking from `WidgetItem<C>` at compile
time. `validateItems` exists for data that bypasses the type checker.

`Widgets` does not call it. `Widgets.astro:6` sets the precedent: "validateBlocks
is the loud gate; this is the safety net." The renderer stays defensive — skip
and `console.warn`, dev-only per #26 point 4 — and validation is an explicit step
run at ingestion or build time.

Two entry points, so validation does not force importing React components into
webhook or CI scripts:

- `createWidgets` returns a `validateItems` bound to the component map.
- A standalone `validateItems(items, knownTypes: readonly string[])` is exported.

## Parity with astro-widget

`ctx?: Record<string, unknown>` is passed to every widget, matching
`Widgets.astro:13-15`.

Differences that remain, and why:

| | astro | react |
| --- | --- | --- |
| recursion | block renders `<Widgets>` itself | renderer recurses into `children` |
| `chrome.wrapper` | absent | present |
| `suspenseFallback` | n/a | present |
| typed props from registry | impossible, components are opaque | inferred |
| registry binding | per render | bound by `createWidgets` |

The recursion difference is forced by Astro's slot model. The rest are open if
parity is wanted later.

Separately: `validate-blocks.ts:18,27,35` returns Swedish message strings in a
public English-language library. Fix in the astro pass.

## Packaging

`scripts/verify-packaging.mjs:191` asserts the `'use client'` directive is
present. Invert it to assert absence, and add a grep of `dist/index.js` for
`createContext(` and `useContext(` as a permanent regression guard. The directive
check alone would not catch a context reintroduced without it.

## Disposition of existing work

| Item | Action |
| --- | --- |
| PR #65 | Drop the code. Salvage `ssr.test.tsx`'s well-formed-tree case and the malformed-item message shapes. Drop its throwing-widget case, which assumes a boundary. |
| PR #67 | Drop the README and context diffs. Salvage the dev-`NODE_ENV` guard on the unknown-widget warning and the `data-widget-*` DOM pass-through requirement. |
| 8a1efc0 | Drop the code and both test files. Keep the lesson: boundary logic belongs in `renderWidget`. |
| `context.test.tsx` | Delete. |
| `widgets.test.tsx` | Keep 1-143. Drop 144-197. |
| `widget.test.tsx`, `performance.test.tsx`, `regressions.test.tsx`, `types.test-d.tsx` | Keep. Every fixture using the `Output` prop rewrites to plain `children`. |

## Migration

| Removed | Replacement |
| --- | --- |
| `'use client'` | none; importable from RSC |
| `WidgetsProvider`, `useWidgets`, `WidgetsConfig.context` | call `createWidgets` once at module scope |
| `Output` prop and `<Output/>` | read `children` |
| `WidgetOutputProps` | none needed |
| default `WidgetErrorBoundary` | own boundary in a custom `chrome.item`, in your own `'use client'` file |
| `DEFAULT_STYLES.LOADING` | `chrome.suspenseFallback` |

## Testing (#27)

- Renders under the `react-server` condition without throwing. This is the test
  whose absence let the original directive bug through.
- `dist/index.js` contains no `createContext(` or `useContext(`.
- Nested subtree state survives a parent re-render, the property
  `regressions.test.tsx:244-272` checks, now without the `Output` identity
  mechanism.
- A custom `chrome.item` cannot remove Suspense.
- An async Server Component widget suspends and resolves.
- `validateItems` reports each check above, and reports all problems rather than
  the first.
- Type tests: `children` rejected on a component that does not accept it.
