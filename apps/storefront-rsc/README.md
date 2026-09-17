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

## Who the page is for

Demo-grade, and real authentication is out of scope: the actor is the JSON in a
`shop-subject` cookie, and no cookie is an anonymous shopper with the `customer`
role. A cookie rather than the `X-Shop-Subject` header shop-api itself reads,
because a browser cannot set a request header on a top-level navigation:

```js
document.cookie =
  'shop-subject=' +
  encodeURIComponent(
    '{"id":"staff:ada","roles":["manager"],"shop":"stockholm"}',
  );
```

`app/subject.ts` resolves it once per page view through React's `cache`, and
`app/access.ts` fetches `GET /policy` once per page view and adopts it with
`parseMatrix`. Every gate below is evaluated in this process against that
document, so no decision makes a network call, and `app/shop-api.ts` states the
subject on every request it sends shop-api, which decides again on its own copy.

| what                            | permission       | who the matrix grants it to  |
| ------------------------------- | ---------------- | ---------------------------- |
| the spotlight and the catalogue | `game.read`      | everyone                     |
| the activity widget             | `telemetry.read` | a manager                    |
| the "yours to reprice" line     | `game.reprice`   | a manager, in their own shop |

The catalogue spans Stockholm and Gothenburg, so a manager in one of them sees
the reprice line on some rows and not on others.

`@evanion/react-acl` is not a dependency of this app and cannot be one. Its
provider and hooks need `createContext`, which React's `react-server` build does
not export, so a server component calls `access.can` directly.

## What holds the claim up

- `app/region.server.test.tsx` runs all three components under React's
  `react-server` export condition, where `createContext`, `useState` and
  `Component` do not exist, and asserts the fetches happen during render, that
  each widget sits in its own `<Suspense>` boundary, and that no widget's
  requests wait on another's.
- `app/access.server.test.tsx` runs the same three components under the same
  condition against a served matrix, and asserts that an anonymous visitor gets
  no telemetry widget and no telemetry request, that a manager gets both, that
  one `GET /policy` serves a render mounting all three, and that
  `@evanion/react-acl` throws on `createContext` when it is evaluated here.
- `scripts/verify-packaging.mjs` asserts the published `@evanion/react-widget`
  carries no client directive and imports no client-only React API.
- The page's HTML arrives with the data in it; the client bundle carries neither
  the data nor the fetches.
