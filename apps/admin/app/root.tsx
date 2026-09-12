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
import {
  Panel,
  PanelTitle,
  Quiet,
  baizeFontLinks,
  baizeTokensCss,
} from './ui/baize.js';

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
 * The app's own layout rules go through `links` as a real `<link>` rather than a
 * bare `import './layout.css'`, so the document's first paint has them: a
 * side-effect import is injected by the client bundle, which is a frame late on
 * a server-rendered page.
 */
export const links: Route.LinksFunction = () => [
  ...baizeFontLinks,
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
        {/* The token system, inlined ahead of the stylesheet link so no element
            ever paints before the custom properties it reads exist. */}
        <style>{baizeTokensCss}</style>
      </head>
      <body>
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
      <Panel>
        <PanelTitle>
          {status === 404 ? 'No such page' : 'Something broke'}
        </PanelTitle>
        <p style={{ margin: 0 }}>
          <Quiet>{String(detail)}</Quiet>
        </p>
      </Panel>
    </main>
  );
}
