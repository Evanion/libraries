import './global.css';
import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';
import { PropsWithChildren } from 'react';

export const metadata = {
  title: {
    default: 'Evanion Libraries',
    template: '%s | Evanion Libraries',
  },
  description: 'Documentation for the Evanion open source libraries.',
  metadataBase: new URL('https://docs.evanion.com'),
};

const navbar = (
  <Navbar
    logo={<b>Evanion Libraries</b>}
    projectLink="https://github.com/Evanion/libraries"
  />
);
const footer = (
  <Footer>MIT {new Date().getFullYear()} © Mikael Pettersson.</Footer>
);

/**
 * The shell every docs page renders inside: Nextra's theme layout, built from
 * the page map the MDX files produce.
 *
 * `async` because the sidebar comes from `getPageMap()`, which reads the page map
 * Nextra compiles from `content/`. Under `output: 'export'` that happens once, at
 * build time.
 */
export default async function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      lang="en"
      // nextra-theme-docs reads `dir` to place its sidebar and breadcrumbs; it
      // has no default, so an unset value leaves both unplaced.
      dir="ltr"
      // next-themes, which the theme uses, writes the colour-scheme class onto
      // this element from a blocking script before React hydrates. Without this
      // the class the client sees never matches the server's markup.
      suppressHydrationWarning
    >
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/Evanion/libraries/tree/main/apps/docs"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
