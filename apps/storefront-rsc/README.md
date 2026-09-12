# storefront-rsc

The Baize shop rendered by Next App Router, as a Server Component.

`apps/storefront` is the shop. This app exists to prove one claim: that a widget
can be an async Server Component fetching its own data, with no `'use client'`
anywhere in `@evanion/react-widget`. It is one page with one widget and stays
that way on purpose — anything more belongs in `apps/storefront` or
`apps/admin`.

The claim is this app's alone. On stable React Router a route component always
ships to and runs on the client, so `apps/admin` cannot make it; Next App Router
RSC has been stable since Next 13, which is why the demonstration lives here.

## Running it

```sh
npx nx serve shop-api      # the catalogue, on :3000
npx nx dev storefront-rsc  # this app, on :4200
```

`SHOP_API_URL` overrides where the widget looks for shop-api. It defaults to
`http://localhost:3000/api`.

## What holds the claim up

- `app/catalogue.tsx` is an `async function` that awaits `GET /games` and
  `GET /inventory/:urn` itself. Its item in `app/widgets.ts` carries a heading
  and no catalogue data.
- `app/catalogue.server.test.tsx` runs that component under React's
  `react-server` export condition, where `createContext`, `useState` and
  `Component` do not exist, and asserts the fetches happen during render.
- `scripts/verify-packaging.mjs` asserts the published `@evanion/react-widget`
  carries no client directive and no context.
- The page's HTML arrives with the catalogue in it; the client bundle carries
  neither the data nor the fetch.
