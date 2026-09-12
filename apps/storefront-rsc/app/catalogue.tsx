/**
 * The widget this app exists for: an async Server Component that fetches its
 * own data.
 *
 * Nothing hands it a catalogue. It is handed `heading`, which is presentation,
 * and it awaits the rest itself -- the call the widget package's redesign was
 * for. Under Next's App Router this function body runs on the server only: the
 * `await` below resolves before any HTML is flushed, the games reach the
 * browser already rendered, and neither the fetch nor the response is part of
 * the client bundle.
 *
 * No `'use client'` anywhere in this file or in `@evanion/react-widget`. The
 * package is importable here because it touches nothing React omits under its
 * `react-server` export condition -- no createContext, useContext, Component
 * or stateful hook. `catalogue.server.test.tsx` runs this component under that
 * condition, and `scripts/verify-packaging.mjs` holds the package to it.
 *
 * Types are this app's own, per the demo spec: the API is the contract and no
 * package exists to share response shapes.
 */

/** One catalogue entry, as `GET /games` returns it. */
interface Game {
  /** Entity identity, e.g. `urn:game:wingspan`. */
  urn: string;
  title: string;
  mechanisms: string[];
  players: string;
  playtime: string;
  /** Complexity, 1 (light) to 5 (heavy). */
  weight: number;
}

/** Stock for one game, as `GET /inventory/:urn` returns it. */
interface Stock {
  urn: string;
  quantity: number;
}

/**
 * Where `apps/shop-api` listens, including its global `api` prefix.
 *
 * Read from the environment so the demo can point at a shop-api on another
 * port, and defaulted so `nx serve shop-api` plus `nx dev storefront-rsc` is the
 * whole setup.
 */
const SHOP_API = process.env.SHOP_API_URL ?? 'http://localhost:3000/api';

/**
 * `cache: 'no-store'` on every request: stock changes, and a cached response
 * would let the page claim a game is available after it has sold out. It is
 * also what keeps this route out of the build -- a fetch Next cannot cache
 * makes the page dynamic, so `next build` never calls shop-api and the build
 * does not need it running.
 */
async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${SHOP_API}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`GET ${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

/** The segments of the weight ramp, drawn as filled or empty. */
const WEIGHT_STEPS = [1, 2, 3, 4, 5];

export async function Catalogue({ heading }: { heading: string }) {
  const games = await fetchJson<Game[]>('/games');
  const entries = await Promise.all(
    games.map(async (game) => ({
      ...game,
      // The urn is one path segment containing colons. They are legal there
      // unencoded, but Express decodes the parameter either way, so encoding
      // is the form that also survives an nss with a reserved character in it.
      quantity: (
        await fetchJson<Stock>(`/inventory/${encodeURIComponent(game.urn)}`)
      ).quantity,
    })),
  );

  return (
    <section aria-labelledby="catalogue-heading">
      <h2 className="heading" id="catalogue-heading">
        {heading}
      </h2>
      <ul className="catalogue">
        {entries.map((entry) => (
          <li className="card" key={entry.urn}>
            <div className="card-head">
              <h3 className="title">{entry.title}</h3>
              {/* shop-api reports a quantity, not an availability state, so
                  this says only what a quantity can say. */}
              <span className="pill">
                {entry.quantity > 0 ? 'in stock' : 'out of stock'}
              </span>
            </div>
            <p className="tags">
              {entry.mechanisms.map((mechanism) => (
                <span className="chip" key={mechanism}>
                  {mechanism}
                </span>
              ))}
            </p>
            {/* Label before value in the markup, as a description list
                requires; the CSS reverses the pair so the figure leads. */}
            <dl className="stats">
              <div>
                <dt>players</dt>
                <dd>{entry.players}</dd>
              </div>
              <div>
                <dt>playtime</dt>
                <dd>{entry.playtime}</dd>
              </div>
              <div>
                <dt>weight</dt>
                <dd>
                  {entry.weight.toFixed(1)}
                  <span className="of"> / 5</span>
                </dd>
              </div>
            </dl>
            {/* Weight is ordinal, so it reads as a ramp rather than as one of
                five colours. The figure above it carries the same value, so
                this is decoration. */}
            <p aria-hidden="true" className="ramp">
              {WEIGHT_STEPS.map((step) => (
                <span
                  data-filled={step <= Math.round(entry.weight)}
                  key={step}
                />
              ))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
