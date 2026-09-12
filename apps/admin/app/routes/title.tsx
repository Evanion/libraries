import { Form, Link, href, isRouteErrorResponse } from 'react-router';
import type { Route } from './+types/title';
import { shelfContext } from '../page-context.js';
import { clearShelfPolicy, setShelfPolicy } from '../shelf-policy.server.js';
import { useRestock } from '../providers.js';
import {
  Action,
  AvailabilityPill,
  GameTitle,
  Hairline,
  Identifier,
  MechanismTag,
  Panel,
  PanelTitle,
  Quiet,
  StatLine,
  WeightMeter,
  availabilityHues,
  space,
} from '../ui/baize.js';
import type { Availability } from '../ui/baize.js';

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: loaderData ? `${loaderData.row.title} · Baize` : 'Baize' },
];

const STATES = Object.keys(availabilityHues) as Availability[];

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
  if (typeof state !== 'string' || !STATES.includes(state as Availability)) {
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
      <p className="page-note">
        <Link to={href('/shelf')} className="row-link">
          <Quiet>Back to the shelf</Quiet>
        </Link>
      </p>

      <Panel>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            gap: space[4],
          }}
        >
          <span style={{ display: 'grid', gap: space[2] }}>
            <GameTitle title={row.title} mechanism={mechanism} />
            <span style={{ display: 'flex', gap: space[2], flexWrap: 'wrap' }}>
              {row.mechanisms.map((name) => (
                <MechanismTag key={name} mechanism={name} />
              ))}
            </span>
          </span>
          <AvailabilityPill state={row.availability} />
        </header>

        <div style={{ padding: `${space[5]} 0` }}>
          <Hairline />
        </div>

        <StatLine
          scale="row"
          label={`${row.title} at a glance`}
          figures={[
            { label: 'players', value: row.players },
            { label: 'playtime', value: row.playtime },
            { label: 'weight', value: row.weight.toFixed(1) },
            { label: 'on hand', value: String(row.quantity) },
          ]}
        />

        <p style={{ margin: `${space[5]} 0 0` }}>
          <Identifier>{row.urn}</Identifier>
          {'  '}
          <WeightMeter weight={row.weight} />
        </p>
      </Panel>

      <div className="title-actions">
        <Panel>
          <PanelTitle>Availability</PanelTitle>
          <p style={{ margin: `0 0 ${space[4]}` }}>
            <Quiet>
              {row.declared
                ? 'Set by hand. Clearing it returns the title to what stock implies.'
                : 'Derived from stock. Declaring a state overrides it.'}
            </Quiet>
          </p>

          <Form method="post" className="availability-form">
            <label htmlFor="availability">
              <Quiet>State</Quiet>
            </label>
            <select
              id="availability"
              name="availability"
              defaultValue={row.availability}
              className="select"
            >
              {STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <Action
              type="submit"
              name="intent"
              value="declare"
              variant="primary"
            >
              Save state
            </Action>
            <Action type="submit" name="intent" value="clear">
              Clear
            </Action>
          </Form>

          {actionData && 'error' in actionData ? (
            <p style={{ margin: `${space[3]} 0 0` }}>
              <Quiet>{actionData.error}</Quiet>
            </p>
          ) : null}
          {actionData && 'declared' in actionData ? (
            <p style={{ margin: `${space[3]} 0 0` }}>
              <Quiet>
                {actionData.declared
                  ? `Saved as ${actionData.declared}.`
                  : 'Cleared. Stock decides now.'}
              </Quiet>
            </p>
          ) : null}
        </Panel>

        <Panel>
          <PanelTitle>Restock</PanelTitle>
          <p style={{ margin: `0 0 ${space[4]}` }}>
            <Quiet>
              A working list for the buyer. It is not sent anywhere — shop-api
              has no purchasing endpoint — so it lives in the browser and resets
              on reload.
            </Quiet>
          </p>
          <div style={{ display: 'flex', gap: space[2] }}>
            <Action onClick={() => restock.add(row.urn, 6)}>Add 6</Action>
            <Action onClick={() => restock.add(row.urn, -6)}>Remove 6</Action>
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
    <Panel>
      <PanelTitle>
        {notFound ? 'Not on the shelf' : 'Could not load title'}
      </PanelTitle>
      <p style={{ margin: `0 0 ${space[4]}` }}>
        <Quiet>
          {notFound
            ? `Baize carries no ${params.urn}.`
            : 'Something failed while reading this title.'}
        </Quiet>
      </p>
      <Link to={href('/shelf')} className="row-link">
        <Quiet>See what is on the shelf</Quiet>
      </Link>
    </Panel>
  );
}
