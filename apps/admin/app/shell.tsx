import { Outlet, href } from 'react-router';
import { ComposeProvider, provider } from '@evanion/compose';
import type { Route } from './+types/shell';
import { loadPageView } from './page-view.server.js';
import { correlationContext, shelfContext } from './page-context.js';
import { availabilityCounts, shelfTotals } from './shelf.js';
import { CartProvider, SessionProvider, ThemeProvider } from './providers.js';
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
  const shelf = await context.get(shelfContext)();
  const totals = shelfTotals(shelf.rows);

  const session = {
    operator: 'Ines Halvard',
    shop: 'Baize',
    correlationId,
  };

  return {
    session,
    unavailable: shelf.unavailable,
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
            { label: 'mean weight', value: totals.meanWeight.toFixed(1) },
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

export default function Shell({ loaderData }: Route.ComponentProps) {
  const { session, navItems, sidebarItems, unavailable } = loaderData;

  return (
    <ComposeProvider
      providers={[
        provider(SessionProvider, { session }),
        provider(ThemeProvider, { initialDensity: 'comfortable' }),
        CartProvider,
      ]}
    >
      <div className="shell">
        <Nav items={navItems} />
        {unavailable ? (
          <p className="notice">
            <Text as="span" size="sm">
              shop-api is not answering ({unavailable}). Start it with{' '}
              <code>nx serve @evanion/shop-api</code> and reload.
            </Text>
          </p>
        ) : null}
        <div className="shell-body">
          <Sidebar items={sidebarItems} />
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </ComposeProvider>
  );
}
