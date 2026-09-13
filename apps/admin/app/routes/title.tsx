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
import type { Route } from './+types/title';
import { shelfContext } from '../page-context.js';
import { clearShelfPolicy, setShelfPolicy } from '../shelf-policy.server.js';
import { useRestock } from '../providers.js';
import {
  AVAILABILITY_STATES,
  availabilityToken,
  formatComplexity,
  mechanismToken,
  complexityStop,
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
 */
export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData();
  const urn = params.urn;
  const intent = form.get('intent');

  if (intent === 'clear') {
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

  setShelfPolicy(urn, state as Availability);
  return { declared: state as Availability };
}

export default function Title({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { row } = loaderData;
  const restock = useRestock();
  const mechanism = row.mechanisms[0] ?? 'uncategorised';

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
                mechanism={mechanismToken(mechanism)}
                size="lg"
              >
                {row.title}
              </BaizeTitle>
              <TagRow>
                {row.mechanisms.map((name) => (
                  <MechanismTag
                    key={name}
                    label={name}
                    mechanism={mechanismToken(name)}
                  />
                ))}
              </TagRow>
            </div>
          }
        />

        <StatLine label={`${row.title} at a glance`} size="lg">
          <Stat figure={row.players} label="players" />
          <Stat figure={row.playtime} label="playtime" />
          <Stat figure={formatComplexity(row.complexity)} label="complexity">
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

          {/* One form, two submits. The pair the browser sends for whichever was
              pressed is what the action reads, which is why the library's button
              carries a `name` and a `value` and no handler. */}
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
