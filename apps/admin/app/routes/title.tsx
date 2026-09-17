import {
  AvailabilityPill,
  Button,
  MechanismTag,
  Panel,
  SectionHeader,
  Stat,
  StatLine,
  TagRow,
  Text,
  Title as BaizeTitle,
  ComplexityRamp,
} from '@evanion/baize-ui';
import { Form, Link, href, isRouteErrorResponse } from 'react-router';
import { pickAllowedFields } from '@evanion/acl';
import type { Route } from './+types/title';
import {
  accessContext,
  correlationContext,
  shelfContext,
  subjectContext,
} from '../page-context.js';
import { useCan } from '../access.js';
import { clearShelfPolicy, setShelfPolicy } from '../shelf-policy.server.js';
import { ShopApiUnavailable, listGames } from '../shop-api.server.js';
import { useRestock } from '../providers.js';
import {
  AVAILABILITY_STATES,
  availabilityToken,
  catalogueAvailability,
  complexityStop,
  complexityTierName,
  formatComplexity,
  type Availability,
} from '../ui/catalogue.js';

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: loaderData ? `${loaderData.row.title} · Baize` : 'Baize' },
];

export async function loader({ context, params }: Route.LoaderArgs) {
  const shelf = await context.get(shelfContext)();
  const row = shelf.rows.find((candidate) => candidate.urn === params.urn);

  if (!row) {
    // A thrown Response is what the route's own ErrorBoundary renders. The
    // alternative -- returning `{ row: null }` -- makes every component below
    // handle a state that is really a 404.
    throw new Response(`No title ${params.urn} on the shelf`, { status: 404 });
  }

  return { row };
}

/**
 * Declares or clears the title's availability.
 *
 * A `<Form method="post">` and an action, not a click handler calling fetch: the
 * form works before hydration, React Router revalidates every loader on the page
 * once the action returns, and the shelf totals in the sidebar update without
 * this route knowing the sidebar exists.
 *
 * This is where the back office enforces. The component below hides the form
 * from a subject the contract refuses, and the URL the form posts to is still
 * there for anyone who types it, so the decision the tree reached carries
 * nothing into this function: the action resolves the subject again, reads the
 * row again, and decides again on the server's own copy of the matrix. A
 * refusal returns and writes nothing.
 */
export async function action({ context, request, params }: Route.ActionArgs) {
  const subject = context.get(subjectContext);
  const correlationId = context.get(correlationContext);
  const access = await context.get(accessContext)();
  const urn = params.urn;

  // The catalogue directly rather than through `shelfContext`, which joins the
  // catalogue to the availability table this action is about to write. Filling
  // that memo here would hand every revalidating loader the pre-write shelf.
  let games;
  try {
    games = await listGames(correlationId, subject);
  } catch (error) {
    if (!(error instanceof ShopApiUnavailable)) throw error;
    return {
      refused: true,
      error: `The catalogue is unreadable (${error.message}), so no decision can be reached and nothing was written.`,
    };
  }

  const game = games.find((candidate) => candidate.urn === urn);
  if (!game) {
    throw new Response(`No title ${urn} on the shelf`, { status: 404 });
  }

  const form = await request.formData();
  const intent = form.get('intent');

  if (intent === 'clear') {
    const decision = access.can(subject, 'game', 'declare', game);
    if (!decision.allowed) return refusal(decision.reason);
    clearShelfPolicy(urn);
    return { declared: null };
  }

  const state = form.get('availability');
  if (
    typeof state !== 'string' ||
    !AVAILABILITY_STATES.includes(state as Availability)
  ) {
    return { error: `Not an availability state: ${String(state)}` };
  }

  // The whole submitted bag reaches the write axis, which is the shape a form
  // post has: every `name` attribute the browser was willing to send arrives in
  // it, including names this form never drew. `availability` is restated in the
  // catalogue's vocabulary, because that is what the matrix's `targets` list
  // holds.
  const proposed = {
    ...Object.fromEntries(form),
    availability: catalogueAvailability(state as Availability),
  };

  // #region action-decides
  const decision = access.canFields(
    subject,
    'game',
    'declare',
    game,
    'write',
    proposed,
  );
  if (!decision.action.allowed) return refusal(decision.action.reason);

  // Only what the decision marks allowed. Filtering the bag by hand on
  // `!== 'denied'` would write the unevaluable fields and every key the decision
  // does not carry, which is the mass-assignment shape a submitted form has.
  const writable = pickAllowedFields(decision, proposed);
  if (typeof writable['availability'] !== 'string') {
    return {
      refused: true,
      error:
        'The contract does not allow this title’s availability to be written.',
    };
  }

  setShelfPolicy(urn, state as Availability);
  return { declared: state as Availability };
  // #endregion action-decides
}

/**
 * What a refused write answers with.
 *
 * A returned union member the component narrows, not a thrown `Response`: a
 * merchant who submitted a title another shop lists has something to act on, and
 * the page around the form is still the page they want. A refusal meaning "you
 * should not have seen this control" is the thrown case, and the form is hidden
 * from those subjects already.
 */
function refusal(reason: string) {
  return {
    refused: true,
    error: `Refused: ${reason}. Availability is declared by the shop that lists the title.`,
  };
}

export default function Title({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { row } = loaderData;
  const restock = useRestock();

  // #region tree-toggles
  // A convenience, and the whole of what this decision does: it chooses between
  // the form and a sentence. The action above decides again and is what stops a
  // write. The shop slug is the only member the rule reads, so it is the only
  // one stated.
  const mayDeclare = useCan('game', 'declare', { shop: row.shop }).allowed;
  // #endregion tree-toggles

  return (
    <>
      <div className="page-note">
        <Link to={href('/shelf')} className="row-link">
          <Text as="span" size="sm">
            Back to the shelf
          </Text>
        </Link>
      </div>

      <Panel>
        <SectionHeader
          aside={
            <AvailabilityPill
              availability={availabilityToken(row.availability)}
              label={row.availability}
            />
          }
          heading={
            <div className="stack">
              <BaizeTitle
                as="h1"
                complexity={complexityStop(row.complexity)}
                size="lg"
              >
                {row.title}
              </BaizeTitle>
              <TagRow>
                {row.mechanisms.map((name) => (
                  <MechanismTag key={name} label={name} />
                ))}
              </TagRow>
            </div>
          }
        />

        <StatLine label={`${row.title} at a glance`} size="lg">
          <Stat figure={row.players} label="players" />
          <Stat figure={row.playtime} label="playtime" />
          <Stat
            figure={complexityTierName(row.complexity)}
            label={`complexity ${formatComplexity(row.complexity)} / 5`}
          >
            <ComplexityRamp
              label={`complexity ${formatComplexity(row.complexity)} of 5`}
              stop={complexityStop(row.complexity)}
            />
          </Stat>
          <Stat figure={String(row.quantity)} label="on hand" />
        </StatLine>

        <Text size="sm" tone="moss">
          {row.urn}
        </Text>
      </Panel>

      <div className="title-actions">
        <Panel heading="Availability">
          <Text size="sm">
            {row.declared
              ? 'Set by hand. Clearing it returns the title to what stock implies.'
              : 'Derived from stock. Declaring a state overrides it.'}
          </Text>

          {mayDeclare ? null : (
            <Text size="sm" tone="moss">
              {row.shop} declares this title&rsquo;s availability.
            </Text>
          )}

          {/* One form, two submits. The pair the browser sends for whichever was
              pressed is what the action reads, which is why the library's button
              carries a `name` and a `value` and no handler. */}
          {mayDeclare ? (
            <Form method="post" className="availability-form">
              <label htmlFor="availability">
                <Text as="span" size="sm">
                  State
                </Text>
              </label>
              <select
                id="availability"
                name="availability"
                defaultValue={row.availability}
                className="select"
              >
                {AVAILABILITY_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <Button
                name="intent"
                type="submit"
                value="declare"
                variant="primary"
              >
                Save state
              </Button>
              <Button name="intent" type="submit" value="clear">
                Clear
              </Button>
            </Form>
          ) : null}

          {actionData && 'error' in actionData ? (
            <Text size="sm">{actionData.error}</Text>
          ) : null}
          {actionData && 'declared' in actionData ? (
            <Text size="sm">
              {actionData.declared
                ? `Saved as ${actionData.declared}.`
                : 'Cleared. Stock decides now.'}
            </Text>
          ) : null}
        </Panel>

        <Panel heading="Restock">
          <Text size="sm">
            A working list for the buyer. It is not sent anywhere — shop-api has
            no purchasing endpoint — so it lives in the browser and resets on
            reload.
          </Text>
          <div className="actions">
            <Button onClick={() => restock.add(row.urn, 6)}>Add 6</Button>
            <Button onClick={() => restock.add(row.urn, -6)}>Remove 6</Button>
          </div>
        </Panel>
      </div>
    </>
  );
}

/**
 * The route's own failure surface, which is more specific than the root's: the
 * one thing that goes wrong here is a urn that is not on the shelf, and the
 * useful thing to say is where the list of real ones is.
 */
export function ErrorBoundary({ error, params }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <Panel heading={notFound ? 'Not on the shelf' : 'Could not load title'}>
      <Text>
        {notFound
          ? `Baize carries no ${params.urn}.`
          : 'Something failed while reading this title.'}
      </Text>
      <Link to={href('/shelf')} className="row-link">
        <Text as="span" size="sm">
          See what is on the shelf
        </Text>
      </Link>
    </Panel>
  );
}
