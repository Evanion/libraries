# `admin` — the Baize back office

Stock, orders and shelf state for the Baize games shop, on React Router 8 in
framework mode with server rendering.

## What it demonstrates

`@evanion/react-widget` rendering **on the server**, in a mainstream framework,
with no `'use client'` in the package, no context provider, and no class error
boundary. The whole interface is built from widget regions whose items come from
route loaders.

```
$ curl -s http://localhost:4300/ | grep -o 'data-widget-type="[a-z]*"' | sort | uniq -c
   1 data-widget-type="basket"
   2 data-widget-type="figures"
   3 data-widget-type="heading"
   1 data-widget-type="memo"
   1 data-widget-type="operator"
   1 data-widget-type="orders"
   3 data-widget-type="section"
   1 data-widget-type="shelf"
   1 data-widget-type="states"
   1 data-widget-type="stock"
   1 data-widget-type="trail"
   1 data-widget-type="wordmark"
```

The package is reached through its exports map, which resolves to the built
`dist/`, not to the TypeScript source — `tsconfig.base.json`'s
`customConditions: ["@evanion/source"]` applies to typechecking only. So this app
is a consumer of the published artefact, and `tests/server-render.spec.tsx`
asserts that artefact carries no client directive and no `createContext`.

## What it does not demonstrate

**A widget fetching its own data.** On stable React Router a route component is
not a Server Component: it ships to the browser and runs there as well as on the
server, so data has to come from a loader and be handed down as props. Every
widget here takes its data as props and awaits nothing.

The self-fetching async widget is `apps/rsc-example`, on the Next App Router.

## Regions

Four widget regions, each with its own registry and its own chrome.

| region      | where                       | items              | wrapper            | item chrome                   |
| ----------- | --------------------------- | ------------------ | ------------------ | ----------------------------- |
| `nav`       | `app/regions/nav.tsx`       | 5                  | one-axis bar       | `meta.align`                  |
| `sidebar`   | `app/regions/sidebar.tsx`   | 6                  | vertical rail      | `meta.group` rules a gap      |
| `dashboard` | `app/regions/dashboard.tsx` | 5, one nested      | 12-column grid     | `meta.column` / `columnSpan`  |
| `ledger`    | `app/regions/ledger.tsx`    | 2 + one per record | per-instance table | `meta.emphasis`, `role="row"` |

The ledger is rendered twice — by `/orders` and by `/shelf` — with a different
column template each time, supplied as a per-instance `chrome.wrapper` override.
With the event sink full it carries 150 order rows.

## Running it

The app reads everything from `apps/shop-api`, so start that first.

```sh
nx serve @evanion/shop-api     # http://localhost:3000/api
nx dev admin                   # http://localhost:4200
```

`SHOP_API_URL` overrides where the client looks. With the API down every page
still renders its chrome and says what to start.

Orders are rebuilt from shop-api's telemetry sink, because shop-api persists
nothing. To see rows, place some:

```sh
curl -X POST http://localhost:3000/api/orders -H 'content-type: application/json' \
  -d '{"items":[{"urn":"urn:game:azul","quantity":2}]}'
```

## Route modules

`app/routes.ts` declares the tree with `layout()`, `index()`, `route()` and
`prefix()`. Exports in use: `loader`, `action`, `middleware`, `meta`, `links`,
`headers`, `ErrorBoundary`, and the default component — which receives
`loaderData` and `actionData` as props, typed by `react-router typegen`. There is
no `useLoaderData` in the app.

`nx typecheck admin` depends on a `typegen` target, because `./+types/<route>`
imports resolve into `.react-router/types` and a typecheck run without them
checks nothing.

## Design

Tokens and shared primitives are all in `app/ui/baize.tsx` — palette, type scale,
radii, the availability pills, the complexity ladder, and the stat line. They are destined for a shared UI library that `apps/storefront`,
`apps/rsc-example` and `apps/docs` will also consume, so the file is
self-contained and nothing outside it defines a colour, radius or type size.

`app/layout.css` holds this app's own layout and references those tokens as CSS
custom properties.
