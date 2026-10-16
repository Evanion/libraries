import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Public_Sans } from 'next/font/google';
import '@evanion/baize-ui/styles.css';
import './global.css';
import { FeatureShell } from './feature-shell';
import { currentFeatures, store } from './features';
import { currentSubject } from './subject';

/**
 * Both families are self-hosted: `next/font/google` downloads the files during
 * the build and serves them from this app, so the rendered page makes no
 * request to Google. Each one exposes a custom property rather than a class, and
 * global.css points the library's own family tokens at them -- the library names
 * the families and ships neither, because one shipping `@font-face` with its own
 * URLs would fight `next/font` here and Astro's font handling next door.
 */
const title = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-title',
});

const text = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-text',
});

export const metadata = {
  title: 'Baize — async Server Component widget',
  description:
    'One page rendering @evanion/react-widget as an async React Server Component that fetches its own data.',
};

/**
 * The shell of every page, and the one place the flags cross to the client.
 *
 * The set is resolved here, once per page view, from the same handle the
 * widgets read, so the HTML and the set the client receives come from one
 * instant. The layout states that instant by calling `snapshot`; no client
 * passes `now`, and the provider reads it off the set.
 *
 * What crosses is the document and the set. Both are plain data, which the
 * framework serialises on its way into the client module. The store and the
 * bound handle are closures and stay here.
 */
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [{ config }, features, shopper] = await Promise.all([
    store(),
    currentFeatures(),
    currentSubject(),
  ]);

  return (
    <html className={`${title.variable} ${text.variable}`} lang="en">
      {/* `baize-root` is how an app claims the design system's page: the ground,
          the reading family and tabular figures everywhere. The library styles a
          class rather than `body`, so it fights nothing this app sets. */}
      <body className="baize-root">
        {/* #region ship-the-set */}
        <FeatureShell
          config={config}
          decisions={features.snapshot()}
          roles={shopper.roles}
          targetingKey={shopper.id}
        >
          {children}
        </FeatureShell>
        {/* #endregion ship-the-set */}
      </body>
    </html>
  );
}
