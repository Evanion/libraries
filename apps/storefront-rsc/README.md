# storefront-rsc

The Baize shop rendered by Next App Router, as a Server Component.

`apps/storefront` is the shop. This app exists to prove one claim: that a widget
can be an async Server Component fetching its own data, with no `'use client'`
anywhere in `@evanion/react-widget`. It is one page with one widget region and
stays that way on purpose — anything more belongs in `apps/storefront` or
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

## The region

One page, one region, three widgets, each an `async function` awaiting its own
endpoint. Their items in `app/widgets.tsx` carry a heading or a urn and no data.

| widget              | fetches                                                  |
| ------------------- | -------------------------------------------------------- |
| `app/spotlight.tsx` | `GET /games/:urn` and `GET /inventory/:urn`, in parallel |
| `app/catalogue.tsx` | `GET /games`, then `GET /inventory/:urn` per game        |
| `app/activity.tsx`  | `GET /telemetry`                                         |

## What holds the claim up

- `app/region.server.test.tsx` runs all three components under React's
  `react-server` export condition, where `createContext`, `useState` and
  `Component` do not exist, and asserts the fetches happen during render, that
  each widget sits in its own `<Suspense>` boundary, and that no widget's
  requests wait on another's.
- `scripts/verify-packaging.mjs` asserts the published `@evanion/react-widget`
  carries no client directive and imports no client-only React API.
- The page's HTML arrives with the data in it; the client bundle carries neither
  the data nor the fetches.
