# @evanion/react-widget examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## Map a CMS `type` to a component

### Core Concept: The Typed Region

<!-- #region region-markup -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string; price: number }) => (
  <h3>
    {props.title}, {props.price} kr
  </h3>
);

// 1. Create a typed widget set from the component map
const { Widgets, defineItems } = createWidgets({
  components: { listing: ListingCard },
});

// 2. Define items with compile-time prop checking
const shelf = defineItems([
  {
    id: 'brass',
    type: 'listing',
    props: { title: 'Brass: Birmingham', price: 649 },
  },
]);

// 3. Render the region
const html = renderToStaticMarkup(<Widgets items={shelf} />); // -> '<section><div data-widget-id="brass" data-widget-type="listing"><h3>Brass: Birmingham, 649 kr</h3></div></section>'
```

<!-- #endregion region-markup -->

## Typing Items Held in a Variable

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

## Nesting Widgets

<!-- #region nesting -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
const Showcase = (props: { title: string; children?: React.ReactNode }) => (
  <div>
    <h2>{props.title}</h2>
    {props.children}
  </div>
);

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

const html = renderToStaticMarkup(<Widgets items={tonight} />); // -> '<section><div data-widget-id="tonight" data-widget-type="showcase"><div><h2>On the table tonight</h2><div data-widget-id="hive" data-widget-type="listing"><h3>Hive</h3></div></div></div></section>'
```

<!-- #endregion nesting -->

<!-- #region nesting-rejected -->

```tsx @import.meta.vitest
const Showcase = (props: { title: string; children?: React.ReactNode }) => (
  <div>
    <h2>{props.title}</h2>
    {props.children}
  </div>
);

const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;

const { defineItems } = createWidgets({
  components: { showcase: Showcase, listing: ListingCard },
});
// ---cut---
defineItems([
  {
    id: 'azul',
    type: 'listing',
    props: { title: 'Azul' },
    // @ts-expect-error ListingCard declares no children, so nothing nests under it
    children: [{ id: 'hive', type: 'listing', props: { title: 'Hive' } }],
  },
]);
```

<!-- #endregion nesting-rejected -->

## Ingestion Validation

<!-- #region validate-payload -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/react-widget';

const payload: unknown = JSON.parse(
  '[{"id":"root","type":"listing","props":{"title":"Root"}},{"id":"raffle","type":"raffle","props":{}}]',
);

const problems = validateItems(payload, ['listing', 'booking']); // -> [{ index: 1, id: 'raffle', type: 'raffle', message: 'unknown widget type' }]
```

<!-- #endregion validate-payload -->

<!-- #region validate-nested -->

```ts @import.meta.vitest
import { validateItems } from '@evanion/react-widget';

const payload: unknown = JSON.parse(
  '[{"id":"tonight","type":"showcase","props":{"title":"On the table tonight"},"children":[{"id":"hive","type":"listing","props":{"title":"Hive"}},{"id":"raffle","type":"raffle","props":{}}]}]',
);

const problems = validateItems(payload, ['showcase', 'listing']); // -> [{ index: 1, id: 'raffle', type: 'raffle', message: 'unknown widget type' }]
```

<!-- #endregion validate-nested -->

<!-- #region validate-bound -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
const { validateItems } = createWidgets({
  components: { listing: ListingCard },
});

const payload: unknown = [
  { id: 'root', type: 'listing', props: { title: ' ' } },
];

const problems = validateItems(payload, { listing: ['title'] }); // -> [{ index: 0, id: 'root', type: 'listing', message: 'missing field title' }]
```

<!-- #endregion validate-bound -->

<!-- #region render-validated -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
import type { WidgetItem } from '@evanion/react-widget';

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

<!-- #region skipped-item -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
const { Widgets } = createWidgets({ components: { listing: ListingCard } });

const payload = JSON.parse(
  '[{"id":"raffle","type":"raffle","props":{}},{"id":"root","type":"listing","props":{"title":"Root"}}]',
);

const html = renderToStaticMarkup(<Widgets items={payload} />); // -> '<section><div data-widget-id="root" data-widget-type="listing"><h3>Root</h3></div></section>'
```

<!-- #endregion skipped-item -->

## Custom Chrome

<!-- #region chrome -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
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

## Dynamic Overrides

<!-- #region overrides -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
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

## Placement with `meta`

<!-- #region meta-grid -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
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

## Page-Level Data with `ctx`

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

## Optimizing Suspense

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

## Error Boundaries

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

## Large Regions

<!-- #region content-visibility -->

```tsx @import.meta.vitest
const ListingCard = (props: { title: string }) => <h3>{props.title}</h3>;
// ---cut---
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
