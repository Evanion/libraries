import {
  AvailabilityPill,
  BoxArtPlaceholder,
  Card,
  CardGrid,
  CardGridCell,
  Figure,
  MechanismTag,
  SectionHeader,
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
 * stateful hook. `@evanion/baize-ui` is importable for the stronger reason: it
 * imports no React API beyond `createElement` and `Fragment`, which its own
 * packaging guard holds it to. `region.server.test.tsx` runs this component under
 * that condition, and `scripts/verify-packaging.mjs` holds both packages to it.
 *
 * The two legs are a waterfall on purpose and cannot be otherwise: the urns to
 * ask about come out of the first response. Inside the second leg the requests
 * are parallel.
 *
 * Two permissions decide what it renders. `game.read` is the section itself, and
 * shop-api's matrix grants it to everyone, so the gate below is a decision this
 * app makes rather than one it assumes. `game.reprice` is per row: the matrix
 * asks for the manager role and for the row's shop to match the subject's, and
 * the catalogue spans two shops, so a manager in Stockholm sees the marker on
 * the Stockholm titles and not on the Gothenburg ones.
 */
export async function Catalogue({ heading }: { heading: string }) {
  const may = await authorized();
  if (!may.can('game', 'read').allowed) return null;

  const games = await fetchJson<Game[]>('/games');
  // One call for the whole page of rows. `canMany` answers in the order it was
  // given, so the decision for a row is the decision at its index.
  const reprice = may.canMany('game', 'reprice', games);
  const entries = await Promise.all(
    games.map(async (game, index) => ({
      ...game,
      mayReprice: reprice[index]?.allowed ?? false,
      quantity: (await fetchJson<Stock>(`/inventory/${urnPath(game.urn)}`))
        .quantity,
    })),
  );

  // `aria-label` rather than `aria-labelledby`: the library's `Title` takes no
  // `id`, on the reading that document structure belongs to the page. The region
  // is named either way, and asking the library for an attribute to hang a
  // reference off would be the page pushing its own concern into it.
  return (
    <section aria-label={heading}>
      <SectionHeader
        aside={`${entries.length} titles`}
        heading={
          <Title as="h2" size="md">
            {heading}
          </Title>
        }
      />
      <CardGrid as="ul" label={heading}>
        {entries.map((entry) => (
          <CardGridCell as="li" key={entry.urn}>
            <Card
              foot={
                /* Availability is what the shop says about buying it; the
                   copies on the shelf are what inventory answered. Two facts,
                   and the pill on the art above carries the other one. */
                <>
                  <Text as="span" size="sm" tone="moss">
                    {entry.quantity > 0
                      ? `${entry.quantity} on the shelf`
                      : 'none on the shelf'}
                  </Text>
                  {/* What the matrix says this visitor may do to this row.
                      The line names the permission and opens no editor: a form
                      here would post to a Server Action, and that action is a
                      second trusted entry point which has to decide for
                      itself. */}
                  {entry.mayReprice ? (
                    <Text as="span" size="sm" tone="moss">
                      yours to reprice
                    </Text>
                  ) : null}
                </>
              }
              head={
                <>
                  <Title
                    as="h3"
                    complexity={complexityStop(entry.complexity)}
                    size="sm"
                  >
                    {entry.title}
                  </Title>
                  <Figure>{formatPrice(entry.price)}</Figure>
                </>
              }
              media={
                <BoxArtPlaceholder
                  palette={boxArtPalette(entry.urn)}
                  photo={boxArtPhotoUrl(entry.urn)}
                  seed={entry.urn}
                />
              }
              pin={
                <AvailabilityPill
                  availability={availabilityToken(entry.availability)}
                  label={availabilityLabel(entry.availability)}
                />
              }
            >
              <TagRow>
                {entry.mechanisms.map((mechanism) => (
                  <MechanismTag key={mechanism} label={mechanism} />
                ))}
              </TagRow>
              <StatLine label={`${entry.title} at a glance`}>
                <Stat figure={entry.players} label="players" />
                <Stat figure={entry.playtime} label="playtime" />
                <Stat
                  figure={complexityTierName(entry.complexity)}
                  label={`complexity ${formatComplexity(entry.complexity)}`}
                >
                  <ComplexityRamp
                    label={`complexity ${entry.complexity.toFixed(1)} of 5`}
                    stop={complexityStop(entry.complexity)}
                  />
                </Stat>
              </StatLine>
            </Card>
          </CardGridCell>
        ))}
      </CardGrid>
    </section>
  );
}
