import { useMemo } from 'react';
import { Outlet, href } from 'react-router';
import { ComposeProvider, provider } from '@evanion/compose';
import type { Route } from './+types/shell';
import { loadPageView } from './page-view.server.js';
import {
  accessContext,
  correlationContext,
  shelfContext,
  subjectContext,
} from './page-context.js';
import {
  PolicyProvider,
  adoptMatrix,
  allows,
  useCan,
  useCapabilities,
} from './access.js';
import { operatorName } from './access.server.js';
import { availabilityCounts, shelfTotals } from './shelf.js';
import {
  CartProvider,
  SessionProvider,
  ThemeProvider,
  useSession,
} from './providers.js';
import type { Session } from './providers.js';
import { Nav, defineNavItems } from './regions/nav.js';
import { Sidebar, defineSidebarItems } from './regions/sidebar.js';
import { Text } from '@evanion/baize-ui';

/**
 * The pathless layout every page sits inside: the provider stack, the nav region
 * and the sidebar region.
 *
 * Its middleware is what makes one page view one correlation id and one shelf
 * read. Its loader turns that into the two small regions' items, so the chrome
 * is configured data like the page under it rather than markup.
 */
export const middleware: Route.MiddlewareFunction[] = [loadPageView];

export async function loader({ context }: Route.LoaderArgs) {
  const correlationId = context.get(correlationContext);
  const subject = context.get(subjectContext);
  const access = await context.get(accessContext)();
  const shelf = await context.get(shelfContext)();
  const totals = shelfTotals(shelf.rows);

  // Demo-grade, and stated here because this is where the page chrome reads it.
  // `demoSubject()` is the whole of the identity story; see `access.server.ts`.
  const session: Session = {
    operator: operatorName(subject),
    shop: 'Baize',
    correlationId,
    subject,
  };

  return {
    session,
    unavailable: shelf.unavailable,
    // `Access` is a set of closures and does not survive the loader's
    // serialization boundary. The document does, and it is an envelope carrying
    // its own version and schema, so nothing travels beside it. The tree adopts
    // its own copy and decides for itself.
    matrix: access.matrix,
    // A string instant, which the hooks key their memos on by value. A `Date` is
    // a fresh object every render and re-evaluates the matrix each time.
    now: new Date().toISOString(),
    navItems: defineNavItems([
      { id: 'mark', type: 'wordmark', props: { shop: 'Baize' } },
      {
        id: 'today',
        type: 'section',
        props: { label: 'Today', to: href('/') },
      },
      {
        id: 'orders',
        type: 'section',
        props: { label: 'Orders', to: href('/orders') },
      },
      {
        id: 'shelf',
        type: 'section',
        props: { label: 'Shelf', to: href('/shelf') },
      },
      {
        id: 'operator',
        type: 'operator',
        props: { name: session.operator },
        meta: { align: 'end' },
      },
    ]),
    sidebarItems: defineSidebarItems([
      { id: 'h-shop', type: 'heading', props: { label: 'Shop' } },
      {
        id: 'totals',
        type: 'figures',
        props: {
          rows: [
            { label: 'titles', value: String(totals.titles) },
            { label: 'units', value: String(totals.unitsOnHand) },
            {
              label: 'mean complexity',
              value: totals.meanComplexity.toFixed(1),
            },
          ],
        },
      },
      {
        id: 'h-availability',
        type: 'heading',
        props: { label: 'Availability' },
        meta: { group: 'start' },
      },
      {
        id: 'states',
        type: 'states',
        props: { counts: availabilityCounts(shelf.rows) },
      },
      {
        id: 'h-restock',
        type: 'heading',
        props: { label: 'Restock' },
        meta: { group: 'start' },
      },
      { id: 'basket', type: 'basket', props: {} },
    ]),
  };
}

// #region mount-provider
export default function Shell({ loaderData }: Route.ComponentProps) {
  const { session, matrix, navItems, sidebarItems, now, unavailable } =
    loaderData;

  // Rebuilt when the document's version changes and not per render: the parse
  // validates, deep-clones and deep-freezes. See `adoptMatrix`.
  const access = useMemo(() => adoptMatrix(matrix), [matrix]);
  const context = useMemo(() => ({ now }), [now]);

  return (
    <ComposeProvider
      providers={[
        provider(PolicyProvider, {
          access,
          subject: session.subject,
          context,
        }),
        provider(SessionProvider, { session }),
        provider(ThemeProvider, { initialDensity: 'comfortable' }),
        CartProvider,
      ]}
    >
      <Chrome
        navItems={navItems}
        sidebarItems={sidebarItems}
        unavailable={unavailable}
      />
    </ComposeProvider>
  );
}
// #endregion mount-provider

/**
 * The page chrome, inside the provider stack so it can read the matrix.
 *
 * A component of its own because the hooks read a context `Shell` mounts, and a
 * component cannot read a provider it renders. Everything it decides toggles an
 * element: the routes behind the entries it hides are URLs that still resolve,
 * and each of their loaders decides again.
 */
function Chrome({
  navItems,
  sidebarItems,
  unavailable,
}: {
  navItems: ReturnType<typeof defineNavItems>;
  sidebarItems: ReturnType<typeof defineSidebarItems>;
  unavailable?: string;
}) {
  const { subject } = useSession();
  const capabilities = useCapabilities();

  // Orders are rebuilt from the event sink, so the section is worth showing to a
  // subject the contract lets read telemetry and to nobody else.
  const readsTelemetry = allows(capabilities, 'telemetry.read');

  // `game.declare` reads the row's shop, so an action-level capability with no
  // object answers `unevaluable` for every subject. The subject's own shop is
  // the probe that asks the question the rail is really asking: does this actor
  // declare availability anywhere.
  const declaresHere = useCan('game', 'declare', {
    shop: subject.shop,
  }).allowed;

  const nav = navItems.filter((item) =>
    item.id === 'orders' ? readsTelemetry : true,
  );
  const sidebar = sidebarItems.filter((item) =>
    item.id === 'h-availability' || item.id === 'states' ? declaresHere : true,
  );

  return (
    <div className="shell">
      <Nav items={nav} />
      {unavailable ? (
        <p className="notice">
          <Text as="span" size="sm">
            shop-api is not answering ({unavailable}). Start it with{' '}
            <code>nx serve @evanion/shop-api</code> and reload.
          </Text>
        </p>
      ) : null}
      <div className="shell-body">
        <Sidebar items={sidebar} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
