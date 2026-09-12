import { fetchJson, urnPath, type Game, type Stock } from './shop-api';

/**
 * One game, in full, as an async Server Component that fetches its own data.
 *
 * It is handed a urn and goes and gets both the game and its stock. Both urls
 * are known before either request starts, so they go out together -- the
 * contrast with the catalogue widget, where the second leg has to wait for the
 * urns the first one returns.
 *
 * It also reports the correlation id shop-api saw for the stock request, which
 * is the `@evanion/nestjs-correlation-id` hop observed from the consumer's side.
 */
export async function Spotlight({ urn }: { urn: string }) {
  const [game, stock] = await Promise.all([
    fetchJson<Game>(`/games/${urnPath(urn)}`),
    fetchJson<Stock>(`/inventory/${urnPath(urn)}`),
  ]);

  return (
    <section aria-labelledby="spotlight-heading">
      <div className="card feature">
        <div className="card-head">
          <h2 className="title feature-title" id="spotlight-heading">
            {game.title}
          </h2>
          <span className="pill">
            {stock.quantity > 0 ? `${stock.quantity} in stock` : 'out of stock'}
          </span>
        </div>
        <p className="tags">
          {game.mechanisms.map((mechanism) => (
            <span className="chip" key={mechanism}>
              {mechanism}
            </span>
          ))}
        </p>
        <dl className="stats">
          <div>
            <dt>players</dt>
            <dd>{game.players}</dd>
          </div>
          <div>
            <dt>playtime</dt>
            <dd>{game.playtime}</dd>
          </div>
          <div>
            <dt>weight</dt>
            <dd>
              {game.weight.toFixed(1)}
              <span className="of"> / 5</span>
            </dd>
          </div>
          <div>
            <dt>correlation id</dt>
            <dd className="small">{stock.correlationId ?? 'none'}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
