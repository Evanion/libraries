# react-widget: virtualization for large regions

Status: investigated, recommendation is not to build the feature as framed
Package: `@evanion/react-widget` (0.2.0)
Depends on: `docs/specs/2026-09-10-react-widget-rsc.md` (implemented in #81 — no
`'use client'`, no context, `chrome.wrapper` is the region container seam)
Closes: #5
Prior art: [TanStack Virtual](https://tanstack.com/virtual/latest) 3.14.12,
[`content-visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)

## Decisions

1. The renderer stays eager. No windowing in `Widgets`, no virtualization
   option on `WidgetsConfig` or `WidgetsProps`.
2. Server-rendered, SEO-relevant page content never virtualizes.
   `content-visibility: auto` on the item chrome removes the layout cost while
   leaving every block in the HTML.
3. A dashboard region that virtualizes does it in a consumer-owned
   `'use client'` `chrome.wrapper`. The existing chrome API is sufficient and
   needs no core change to make this work.
4. No `@evanion/react-widget-virtual` package and no `./virtual` entry point.
   `@tanstack/react-virtual` stays a dependency of the application that wants
   it.
5. One core change earns its place: `chrome.wrapper` receives the region's
   items alongside its children.
6. Nested items are never virtualized. Only the top-level list of a region is.
7. Both recipes ship as documentation, with the measured crossover in the text
   so the reader can place their own region on the curve.

## What was measured

A dashboard-shaped fixture: N top-level blocks, a quarter of them sections
holding 2-4 nested children, the rest drawn from four widget types — a stat
tile (5 DOM nodes), an SVG sparkline with 60 plotted points (65 nodes), a
12x5 table (65 nodes), and a text block. Mixed heights, 90px to 340px, no
fixed size available up front. At N=200 that is 10,633 DOM nodes, mean 53 per
block.

Four render paths, each mounted into a 900x800 scroll container:

| path      | what it does                                                    |
| --------- | --------------------------------------------------------------- |
| `none`    | `chrome.wrapper` returns `null`; measures `renderWidget` alone  |
| `eager`   | today's behaviour                                               |
| `cv`      | eager, with `content-visibility: auto` on each item             |
| `virtual` | `chrome.wrapper` running `useVirtualizer` with `measureElement` |

Chrome for Testing 149.0.7827.55, Apple M1 Pro, React 19.3.0, production
builds, median of 5 cold page loads per cell. `mount` is `performance.now()`
across a `flushSync` render plus a forced layout read, so it includes style and
layout and not only React's commit. The 4x column is
`Emulation.setCPUThrottlingRate: 4`, which is roughly a mid-range laptop or a
recent phone.

### Mount, unthrottled (ms)

| N         | 10   | 25   | 50   | 100  | 200  | 400  | 800   |
| --------- | ---- | ---- | ---- | ---- | ---- | ---- | ----- |
| `none`    | 2.3  | 2.4  | 2.3  | 2.3  | 2.6  | 2.7  | 2.8   |
| `eager`   | 10.9 | 16.0 | 22.5 | 31.3 | 47.1 | 86.5 | 169.8 |
| `cv`      | 4.8  | 7.7  | 11.1 | 13.3 | 19.1 | 31.6 | 53.6  |
| `virtual` | 14.2 | 14.6 | 14.3 | 15.1 | 15.3 | 15.2 | 16.0  |

### Mount, 4x CPU throttle (ms)

| N         | 10   | 25   | 50    | 100   | 200   | 400   | 800   |
| --------- | ---- | ---- | ----- | ----- | ----- | ----- | ----- |
| `none`    | 11.2 | 13.0 | 11.0  | 10.2  | 13.4  | 13.8  | 13.9  |
| `eager`   | 55.0 | 80.9 | 105.0 | 132.8 | 222.6 | 403.0 | 776.2 |
| `cv`      | 26.3 | 36.9 | 46.6  | 62.6  | 87.0  | 143.4 | 225.1 |
| `virtual` | 78.2 | 78.5 | 77.2  | 75.4  | 67.3  | 76.2  | 78.1  |

### Re-render of the whole region, 4x throttle (ms)

New `items` array, same data, so every block re-renders.

| N         | 10  | 25   | 50   | 100  | 200  | 400  | 800  |
| --------- | --- | ---- | ---- | ---- | ---- | ---- | ---- |
| `eager`   | 7.9 | 13.9 | 16.8 | 19.2 | 32.1 | 57.4 | 89.7 |
| `cv`      | 7.2 | 12.8 | 16.4 | 21.0 | 32.2 | 58.8 | 84.2 |
| `virtual` | 4.7 | 5.3  | 4.8  | 5.4  | 5.6  | 6.6  | 7.1  |

### Scroll, per scroll event, 4x throttle (p50 ms)

| N              | 10  | 25  | 50  | 100  | 200  | 400  | 800  |
| -------------- | --- | --- | --- | ---- | ---- | ---- | ---- |
| `eager` / `cv` | 0   | 0   | 0   | 0    | 0    | 0    | 0    |
| `virtual`      | 1.2 | 4.7 | 7.7 | 12.2 | 15.8 | 14.4 | 16.4 |

### Steady-state DOM nodes

| N              | 200    | 800    |
| -------------- | ------ | ------ |
| `eager` / `cv` | 10,633 | 43,182 |
| `virtual`      | 449    | 449    |

## The crossover

The intuition in #5 is that eager rendering "starts to hurt" somewhere in the
dashboard range and that virtualization is the fix. Half of that is right. The
cost eager rendering pays is almost entirely style and layout, not React: at
N=800 unthrottled, 169.8ms of mount splits into 53.1ms of React commit and
116.7ms of layout. Virtualization removes both by not mounting the blocks.
`content-visibility` removes the layout half by leaving the blocks in the DOM
and telling the browser not to lay out what is off screen. At N=800 that is
225.1ms against 776.2ms throttled, and the layout component drops from 497ms to
6.9ms.

That makes `content-visibility` against virtual the crossover that decides
anything. It is the choice between a path that keeps the HTML and a path that
drops it.

Fitting the measured curves:

```
cv (4x)       ≈ 39ms + 0.23ms per block
virtual (4x)  ≈ 74ms flat
              → equal at N ≈ 150

cv (1x)       ≈ 5.5ms + 0.06ms per block
virtual (1x)  ≈ 15.2ms flat
              → equal at N ≈ 160
```

Two very different CPU speeds put the crossover in the same place, because both
paths scale with the same CPU. Below roughly 150 blocks a virtualizer is slower
to mount than eager rendering with `content-visibility`, and it is slower to
scroll at every size. Above 150 blocks virtualization wins on mount, and the
margin grows without bound.

For completeness, the crossover against plain eager rendering is much lower —
N≈19 unthrottled, N≈50 at 4x — but that comparison only matters if
`content-visibility` is unavailable. It is supported in Chrome 85+, Firefox
125+ and Safari 18+, and a browser without it falls back to eager rendering,
which is the current behaviour.

The second crossover is re-render frequency. A region that re-renders on every
keystroke of a filter input pays 32ms per keystroke at 200 blocks on a
throttled CPU, and `content-visibility` does not help there — it is React
commit work, and the `cv` and `eager` rows are identical. Virtualization cuts
it to 5.6ms. A region of 200 blocks that renders once and is then scrolled
should not virtualize; the same region behind a live filter should.

## SSR

This is the question that decides the shape of the answer, and the measurement
is unambiguous.

`renderToString` of the virtualized wrapper, Node 24.16, median of 5:

| N   | eager bytes | eager ms | virtual bytes | virtual ms |
| --- | ----------- | -------- | ------------- | ---------- |
| 25  | 48,013      | 3.6      | 116           | 0.2        |
| 200 | 371,025     | 28.3     | 117           | 1.7        |
| 800 | 1,481,860   | 113.2    | 118           | 4.9        |

The 117 bytes are the whole of it:

```html
<div class="viewport" style="height:800px;overflow-y:auto">
  <div style="height:44000px;position:relative"></div>
</div>
```

Zero blocks, not a partial window. `getScrollElement()` returns `null` on the
server, so the virtualizer has no viewport rect and reports an empty range. A
crawler, a reader-mode extraction, a no-JS client and a link preview all see an
empty scroller with a 44,000px spacer.

The mitigation #5 suggests — render all on the server, virtualize after
hydration — was prototyped and measured. A wrapper that renders every child on
the first client pass, so hydration matches, and flips to the virtualizer in an
effect:

| N=200, 4x throttle      | mount   | interactive | later re-render | DOM nodes |
| ----------------------- | ------- | ----------- | --------------- | --------- |
| hydrate eager           | 186.6ms | 223.4ms     | 30.4ms          | 10,633    |
| hydrate then virtualize | 191.1ms | 276.3ms     | 4.8ms           | 449       |

It pays the full eager mount, because it has to, and then 53ms more to tear
down the 10,184 nodes it just hydrated. It buys nothing at load. It buys the
steady-state numbers: re-renders drop 6x and the DOM shrinks 24x. That is a
real trade for an application with a heavy interaction loop and a hard SEO
requirement, and it is a bad trade for anything else.

Under RSC the picture does not improve. `chrome.wrapper` receives children the
renderer has already created — the `none` row measures exactly that, and it is
0.5ms for 800 blocks unthrottled, 2.7ms at 4x. Those elements are created
whether or not they mount, so a client wrapper under RSC still receives the
entire subtree in the flight payload. Virtualization at this seam saves
mounting. It never saves transfer.

The answer to #5's SSR question, then, is that it is not a switch on the
virtualization feature. It is a fork in which feature to use:

- Server-rendered content that must be in the HTML: `content-visibility: auto`.
  Full HTML, mount 2.6x cheaper at 200 blocks and 3.4x at 800, no client code,
  no hydration mismatch, no scroll cost.
- Content behind auth that does not need to be in the HTML: virtualize on the
  client, skip SSR for that region entirely.
- Content that needs both, above 150 blocks, with a hot interaction loop:
  render-all then virtualize, knowing load gets slightly worse and steady state
  gets much better.

Documenting a per-region `ssr: boolean` option on some library-owned
virtualization API would present these as three settings of one feature. They
are three different mechanisms with different costs.

## Why this is not a library feature

The virtualized wrapper that produced every `virtual` number above is 40 lines
of consumer code against the published 0.2.0 API, with no change to the
package:

```tsx
'use client';
import { useRef, useMemo, Children } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export function VirtualWrapper({ children }: { children?: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const list = useMemo(() => Children.toArray(children), [children]);

  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 220,
    overscan: 4,
  });

  return (
    <div ref={scrollRef} style={{ height: 800, overflowY: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((v) => (
          <div
            key={v.key}
            data-index={v.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              width: '100%',
              transform: `translateY(${v.start}px)`,
            }}
          >
            {list[v.index]}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Used as `<Widgets items={items} chrome={{ wrapper: VirtualWrapper }} />`. The
`'use client'` lives in the application's file, which is what the RSC spec's
packaging section requires and what the feature-toggles spec solved with a
`./react` entry. There is nothing here for the library to own. A
`@evanion/react-widget-virtual` package would be a wrapper around someone
else's hook, versioned against a peer range the consumer already controls, and
the recipe above would still have to be documented so a consumer could deviate
from it.

Measurement confirms the seam is sufficient: every `virtual` number in this
document was produced through `chrome.wrapper` with `renderWidget` untouched.

The `content-visibility` recipe is smaller still — a class on the item chrome:

```tsx
export const Item = ({ children, ...rest }: WidgetItemProps) => (
  <div {...rest} className="widget-block">
    {children}
  </div>
);
```

```css
.widget-block {
  content-visibility: auto;
  contain-intrinsic-size: auto 220px;
}
```

`contain-intrinsic-size` wants a rough average block height. Getting it wrong
costs scrollbar accuracy, not correctness — `auto` makes the browser remember
the real size once a block has been rendered once.

## The one core change

`chrome.wrapper` currently receives `{ children }`. A virtualizing wrapper
wants the items too, and works around their absence with `Children.toArray`.
That workaround has three costs:

- Keys become `Children.toArray`'s positional `.$` keys rather than the item
  ids. Identity survives reordering by position only.
- `estimateSize` cannot consult `item.meta`, which is where a CMS would put a
  known block height. A fixed 220px estimate is the only option.
- Scrolling to a block by id is impossible; the wrapper never learns the ids.

So:

```ts
export type WidgetsWrapperComponent = ComponentType<{
  children?: ReactNode;
  /**
   * The region's items, in render order, type-erased. Positionally aligned
   * with `children`, so a windowing wrapper can key and size by item.
   */
  items?: readonly RenderableWidgetItem[];
}>;
```

`Widgets` passes the array it already holds. The prop is optional, so every
existing wrapper keeps compiling, and `DefaultWrapper` ignores it. This is not
a virtualization feature; it is the region container being told what is in the
region, which is information the container abstraction should have had.

Alignment is the contract to be careful about. `renderWidget` returns `null`
for a malformed or unknown-type item while `items` still holds it, so the two
arrays would disagree exactly when the renderer is already skipping and
warning. `Widgets` must filter `items` by the same predicate the renderer uses,
or pass nothing at all rather than pass something misaligned.

## Nested items

Out of scope, and not worth revisiting. A region's nested items are its
children's children — the fixture's sections hold 2-4 each. Virtualizing them
means a scroll container inside a measured element, which makes the outer
`measureElement` observe a fixed-height box whose content changes
independently. The measured win would be a fraction of the 25% of blocks that
have children at all, against a measurement cycle that is hard to make
converge.

## Disposition of #5

Close it. The investigation's answer is that the library needs no
virtualization path.

| #5's proposal                              | Outcome                                                              |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Optional virtualization, opt-in per region | Achievable today through `chrome.wrapper`, no core change            |
| `@evanion/react-widget-virtual` package    | Not worth the maintenance surface                                    |
| TanStack Virtual as the mechanism          | Correct for >150-block dashboards; wrong for page content            |
| Variable height via `measureElement`       | Prototyped; works, and costs 12-16ms per scroll event at 200+ blocks |
| SSR: render-all then virtualize            | Measured; no load win, real steady-state win, opt-in only            |

Follow-up work, small enough for one issue each:

1. Add `items` to `WidgetsWrapperComponent` per the section above.
2. Document both recipes in the package README with the crossover number.
3. `performance.test.tsx`'s comment says "for genuinely large regions, render a
   virtualized component as a widget". That advice is now wrong in two ways —
   the seam is the wrapper rather than a widget, and below 150 blocks the
   answer is CSS. Rewrite it to point at the recipes.

## Testing

The recommendation is documentation plus one optional prop, so the testable
surface is small.

- `chrome.wrapper` receives `items` positionally aligned with the rendered
  children, asserted on a fixture containing a malformed item and an
  unknown-type item, which the renderer skips.
- A wrapper that ignores `items` renders identically to one compiled before the
  prop existed.
- `items` reaching the wrapper is the erased view: no `WidgetItem` union
  widening leaks into the wrapper's type, and TS2590 does not appear in the
  type tests.
- The README's `content-visibility` recipe renders every block into the SSR
  HTML. Assert on `renderToString` output length growing linearly with item
  count, which is the property a virtualized wrapper fails.
- The README's virtualized recipe is not tested in this repo. It depends on
  `@tanstack/react-virtual` and on layout, which jsdom does not do, and the
  package must not acquire either as a dependency to test a documented recipe.
