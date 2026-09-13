import baizeHref from '@evanion/baize-ui/styles.css?url';
import { Panel, Text } from '@evanion/baize-ui';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from 'react-router';
import type { Route } from './+types/root';
import layoutHref from './layout.css?url';
import { baizeFontLinks } from './ui/catalogue.js';

export const meta: Route.MetaFunction = () => [
  { title: 'Baize back office' },
  {
    name: 'description',
    content: 'Stock, orders and shelf state for the Baize games shop.',
  },
];

/**
 * Two stylesheets and two font families.
 *
 * The design system comes first and the app's layout second, because the layout
 * reads the library's custom properties and overriding order is the only thing
 * that decides which declaration of a shared selector wins.
 *
 * Both go through `links` as real `<link>` elements rather than a bare
 * `import './layout.css'`, so the document's first paint has them: a side-effect
 * import is injected by the client bundle, which is a frame late on a
 * server-rendered page. `?url` is how Vite hands back the built asset's path
 * instead of inlining the stylesheet into the module graph.
 */
export const links: Route.LinksFunction = () => [
  ...baizeFontLinks,
  { rel: 'stylesheet', href: baizeHref },
  { rel: 'stylesheet', href: layoutHref },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      {/* `baize-root` is how an app claims the design system's page: the ground,
          the reading family and tabular figures everywhere. The library styles a
          class rather than `body`, so it fights nothing this app sets. */}
      <body className="baize-root">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

/**
 * The app's outermost failure surface.
 *
 * `@evanion/react-widget` ships no error boundary of its own -- a class
 * component cannot exist in a package importable from a Server Component -- so
 * this is where a widget that throws during render is caught. A route that can
 * say something more useful about its own failure exports its own.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const detail = isRouteErrorResponse(error)
    ? error.statusText || error.data
    : error instanceof Error
      ? error.message
      : 'Unknown error';

  return (
    <main className="shell">
      <Panel heading={status === 404 ? 'No such page' : 'Something broke'}>
        <Text>{String(detail)}</Text>
      </Panel>
    </main>
  );
}
