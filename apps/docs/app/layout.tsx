import { Footer, Layout, Navbar, ThemeSwitch } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import { Bricolage_Grotesque, Public_Sans } from 'next/font/google';
import 'nextra-theme-docs/style.css';
import './global.css';
import { PropsWithChildren } from 'react';
import { baizeBackground, baizeColor } from './baize-theme';

/**
 * The two families `@evanion/baize-ui` names and does not ship, self-hosted: the
 * files are downloaded during the build and served from this site, so a rendered
 * page makes no request to Google. Each exposes a custom property, and global.css
 * points the library's own family tokens at them.
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
  title: {
    default: 'Evanion Libraries',
    template: '%s | Evanion Libraries',
  },
  description: 'Documentation for the Evanion open source libraries.',
  metadataBase: new URL('https://docs.evanion.com'),
};

/**
 * The theme switch is in the navbar rather than in the sidebar's footer,
 * where the theme puts it, because the landing page has no sidebar and a
 * reader there still needs it. One control for the whole site; global.css
 * hides the sidebar's copy so a docs page does not show two.
 */
const navbar = (
  <Navbar
    logo={<b>Evanion Libraries</b>}
    projectLink="https://github.com/Evanion/libraries"
  >
    <ThemeSwitch lite />
  </Navbar>
);
const footer = (
  <Footer>MIT {new Date().getFullYear()} © Mikael Pettersson.</Footer>
);

/**
 * The shell every docs page renders inside: Nextra's theme layout, built from
 * the page map the MDX files produce.
 *
 * The theme stylesheet is imported ahead of `global.css`, because global.css is
 * what remaps the theme's own variables onto Baize tokens and the later
 * declaration of a custom property is the one that applies.
 *
 * `async` because the sidebar comes from `getPageMap()`, which reads the page map
 * Nextra compiles from `content/`. Under `output: 'export'` that happens once, at
 * build time.
 */
export default async function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      className={`${title.variable} ${text.variable}`}
      lang="en"
      // nextra-theme-docs reads `dir` to place its sidebar and breadcrumbs; it
      // has no default, so an unset value leaves both unplaced.
      dir="ltr"
      // next-themes, which the theme uses, writes the colour-scheme class onto
      // this element from a blocking script before React hydrates. Without this
      // the class the client sees never matches the server's markup.
      suppressHydrationWarning
    >
      {/* The ground and the accent reach the theme here rather than through CSS:
          `Head` writes both into an inline `<style>` in the document, which wins
          over any stylesheet link. Both are derived from the library's tokens. */}
      <Head backgroundColor={baizeBackground} color={baizeColor} />
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
