import { fetchJson, urnPath, type Game, type Stock } from './shop-api';

/**
 * The catalogue grid, as an async Server Component that fetches its own data.
 *
 * Nothing hands it a catalogue. It is handed `heading`, which is presentation,
 * and it awaits the rest itself -- the call the widget package's redesign was
 * for. Under Next's App Router this function body runs on the server only: the
 * awaits below resolve before the widget's HTML is flushed, the games reach the
 * browser already rendered, and neither the fetch nor the response is part of
 * the client bundle.
 *
 * No client directive in this file or in `@evanion/react-widget`. The package is
 * importable here because it touches nothing React omits under its
 * `react-server` export condition -- no createContext, useContext, Component or
 * stateful hook. `region.server.test.tsx` runs this component under that
 * condition, and `scripts/verify-packaging.mjs` holds the package to it.
 *
 * The two legs are a waterfall on purpose and cannot be otherwise: the urns to
 * ask about come out of the first response. Inside the second leg the requests
 * are parallel.
 */

/** The segments of the weight ramp, drawn as filled or empty. */
const WEIGHT_STEPS = [1, 2, 3, 4, 5];

export async function Catalogue({ heading }: { heading: string }) {
  const games = await fetchJson<Game[]>('/games');
  const entries = await Promise.all(
    games.map(async (game) => ({
      ...game,
      quantity: (await fetchJson<Stock>(`/inventory/${urnPath(game.urn)}`))
        .quantity,
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
