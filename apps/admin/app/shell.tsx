import { useMemo } from 'react';
import { Outlet, href } from 'react-router';
import { ComposeProvider, provider } from '@evanion/compose';
import type { Route } from './+types/shell';
import { loadFeatures, loadPageView } from './page-view.server.js';
import {
  accessContext,
  correlationContext,
  featuresContext,
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
import type { AdminSubject } from './access.js';
import { operatorName } from './access.server.js';
import { FeatureProvider, adoptFeatures, featureContext } from './features.js';
import type { AdminFlags } from './features.js';
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
import type { ReactNode } from 'react';
import type { DecisionSet, FeatureConfig } from '@evanion/feature';

/**
 * The pathless layout every page sits inside: the provider stack, the nav region
 * and the sidebar region.
 *
 * Its middleware is what makes one page view one correlation id and one shelf
 * read. Its loader turns that into the two small regions' items, so the chrome
 * is configured data like the page under it rather than markup.
 */
export const middleware: Route.MiddlewareFunction[] = [
  loadPageView,
  loadFeatures,
];

export async function loader({ context }: Route.LoaderArgs) {
  const correlationId = context.get(correlationContext);
  const subject = context.get(subjectContext);
  const access = await context.get(accessContext)();
  const shelf = await context.get(shelfContext)();
  const { flags, config } = await context.get(featuresContext)();
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
    // #region ship-the-set
    // The document and the set resolved from it, both plain data. The handle
    // stays here: it is closures over a frozen document. The browser installs
    // its own store from the document, and the set states the instant the
    // loaders decided at, so what the tree draws is what the server decided.
    features: { config, decisions: flags.snapshot() },
    // #endregion ship-the-set
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
  const {
    session,
    matrix,
    navItems,
    sidebarItems,
    now,
    unavailable,
    features,
  } = loaderData;

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
        // React Router types loader data through its serialization mapping,
        // which writes `unknown` members as `undefined`. The value is the set
        // the loader returned, so the mount restates the shipped type.
        provider(Flags, {
          features: features as ShippedFeatures,
          subject: session.subject,
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

/** What the shell loader ships: the document, and the set resolved from it. */
interface ShippedFeatures {
  config: FeatureConfig<keyof AdminFlags>;
  decisions: DecisionSet<AdminFlags>;
}

/**
 * Mounts the feature provider over the tree.
 *
 * The loader sent the document and the set, and this installs its own store
 * from the document, because a `Features` is closures over a frozen document
 * and cannot cross the loader's serialization boundary. The provider
 * re-resolves the shipped set to check it, so the context carries the same
 * `targetingKey` and `roles` the server resolved under.
 */
// #region mount-features
function Flags({
  features,
  subject,
  children,
}: {
  features: ShippedFeatures;
  subject: AdminSubject;
  children?: ReactNode;
}) {
  const store = useMemo(
    () => adoptFeatures(features.config),
    [features.config],
  );
  const context = useMemo(() => featureContext(subject), [subject]);

  return (
    <FeatureProvider
      features={store}
      context={context}
      decisions={features.decisions}
    >
      {children}
    </FeatureProvider>
  );
}
// #endregion mount-features

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
