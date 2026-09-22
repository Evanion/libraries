import { Footer, Layout, Navbar, ThemeSwitch } from 'nextra-theme-docs';
import { getPageMap } from 'nextra/page-map';
import { PropsWithChildren } from 'react';

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
 * The docs chrome: the navbar, the sidebar, the search and the footer.
 *
 * A route group, so it names no URL segment and the landing page stays at `/`
 * and the content tree at `/<section>/<page>/`. It is a group rather than the
 * root layout because a full-viewport tool has to render outside this, and in
 * the App Router the root layout is the one thing a route cannot opt out of.
 *
 * `async` because the sidebar comes from `getPageMap()`, which reads the page
 * map Nextra compiles from `content/`. Under `output: 'export'` that happens
 * once, at build time.
 */
export default async function SiteLayout({ children }: PropsWithChildren) {
  return (
    <Layout
      navbar={navbar}
      pageMap={await getPageMap()}
      docsRepositoryBase="https://github.com/Evanion/libraries/tree/main/apps/docs"
      footer={footer}
    >
      {children}
    </Layout>
  );
}
