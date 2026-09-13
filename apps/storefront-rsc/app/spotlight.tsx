import {
  AvailabilityPill,
  BoxArtPlaceholder,
  Card,
  Figure,
  MechanismTag,
  Stat,
  StatLine,
  TagRow,
  Text,
  Title,
  WeightRamp,
} from '@evanion/baize-ui';

import { fetchJson, urnPath, type Game, type Stock } from './shop-api';
import {
  availabilityLabel,
  availabilityToken,
  boxArtPalette,
  formatPrice,
  formatWeight,
  mechanismToken,
  weightStop,
} from './tokens';

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
    <section aria-label={game.title} className="spotlight">
      <BoxArtPlaceholder label={game.title} palette={boxArtPalette(game.urn)} />
      <Card
        foot={
          <>
            <Figure size="lg">{formatPrice(game.price)}</Figure>
            <Text as="span" size="sm" tone="moss">
              {stock.quantity > 0
                ? `${stock.quantity} on the shelf`
                : 'none on the shelf'}
            </Text>
          </>
        }
        head={
          <>
            <Title
              as="h2"
              mechanism={mechanismToken(game.mechanisms[0])}
              size="lg"
            >
              {game.title}
            </Title>
            <AvailabilityPill
              availability={availabilityToken(game.availability)}
              label={availabilityLabel(game.availability)}
            />
          </>
        }
      >
        <TagRow>
          {game.mechanisms.map((mechanism) => (
            <MechanismTag
              key={mechanism}
              label={mechanism}
              mechanism={mechanismToken(mechanism)}
            />
          ))}
        </TagRow>
        <StatLine label={`${game.title} at a glance`} size="lg">
          <Stat figure={game.players} label="players" />
          <Stat figure={game.playtime} label="playtime" />
          <Stat figure={formatWeight(game.weight)} label="weight">
            <WeightRamp
              label={`weight ${game.weight.toFixed(1)} of 5`}
              stop={weightStop(game.weight)}
            />
          </Stat>
        </StatLine>
        <Text size="sm">
          shop-api saw correlation id{' '}
          <span className="identifier">{stock.correlationId ?? 'none'}</span>{' '}
          for the stock request behind this card.
        </Text>
      </Card>
    </section>
  );
}
