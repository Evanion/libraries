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
  ComplexityRamp,
} from '@evanion/baize-ui';

import { authorized } from './access';
import { fetchJson, urnPath, type Game, type Stock } from './shop-api';
import {
  availabilityLabel,
  availabilityToken,
  boxArtPalette,
  boxArtPhotoUrl,
  complexityStop,
  complexityTierName,
  formatComplexity,
  formatPrice,
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
 *
 * `game.read` gates the card and `game.reprice` the staff line inside it. The
 * reprice decision waits for the row, because the matrix compares the title's
 * shop against the subject's and neither this component nor shop-api's guard can
 * answer that without the row in hand.
 */
export async function Spotlight({ urn }: { urn: string }) {
  // #region decide-on-the-row
  const may = await authorized();
  if (!may.can('game', 'read').allowed) return null;

  const [game, stock] = await Promise.all([
    fetchJson<Game>(`/games/${urnPath(urn)}`),
    fetchJson<Stock>(`/inventory/${urnPath(urn)}`),
  ]);
  const mayReprice = may.can('game', 'reprice', game).allowed;
  // #endregion decide-on-the-row

  return (
    <section aria-label={game.title} className="spotlight">
      {/* The pin is the library's card anatomy and needs a containing block.
          Here the art is beside the card rather than inside it, so the block is
          this app's. */}
      <div className="spotlight__art">
        <BoxArtPlaceholder
          palette={boxArtPalette(game.urn)}
          photo={boxArtPhotoUrl(game.urn)}
          seed={game.urn}
        />
        <div className="baize-card__pin">
          <AvailabilityPill
            availability={availabilityToken(game.availability)}
            label={availabilityLabel(game.availability)}
          />
        </div>
      </div>
      <Card
        foot={
          <Text as="span" size="sm" tone="moss">
            {stock.quantity > 0
              ? `${stock.quantity} on the shelf`
              : 'none on the shelf'}
          </Text>
        }
        head={
          <>
            <Title
              as="h2"
              complexity={complexityStop(game.complexity)}
              size="lg"
            >
              {game.title}
            </Title>
            <Figure size="lg">{formatPrice(game.price)}</Figure>
          </>
        }
      >
        <TagRow>
          {game.mechanisms.map((mechanism) => (
            <MechanismTag key={mechanism} label={mechanism} />
          ))}
        </TagRow>
        <StatLine label={`${game.title} at a glance`} size="lg">
          <Stat figure={game.players} label="players" />
          <Stat figure={game.playtime} label="playtime" />
          <Stat
            figure={complexityTierName(game.complexity)}
            label={`complexity ${formatComplexity(game.complexity)}`}
          >
            <ComplexityRamp
              label={`complexity ${game.complexity.toFixed(1)} of 5`}
              stop={complexityStop(game.complexity)}
            />
          </Stat>
        </StatLine>
        <Text size="sm">
          shop-api saw correlation id{' '}
          <span className="identifier">{stock.correlationId ?? 'none'}</span>{' '}
          for the stock request behind this card.
        </Text>
        {mayReprice ? (
          <Text size="sm" tone="moss">
            This title is yours to reprice.
          </Text>
        ) : null}
      </Card>
    </section>
  );
}
