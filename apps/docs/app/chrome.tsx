import { Footer, Layout, Navbar, ThemeSwitch } from 'nextra-theme-docs';
import type { ComponentProps, ReactNode } from 'react';
import ScopedSearch from '../components/ScopedSearch';

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

export interface ChromeProps {
  /** The page map the sidebar, the breadcrumbs and the page links read. */
  pageMap: ComponentProps<typeof Layout>['pageMap'];
  children: ReactNode;
}

/**
 * The docs chrome: the navbar, the sidebar, the search and the footer.
 *
 * One component, mounted by three route groups with a page map each. `(home)`
 * and `(site)` hand it the released tree and the pages with no version, with a
 * release line's folder in its section's place on that line's pages; `(next)`
 * hands it the tree under `/next/`. The theme builds the sidebar from whatever
 * page map it is given and has no notion of a second tree, so a reader under
 * `/next/` would otherwise be shown the released sidebar and taken out of
 * `main` by the first link they followed in it.
 */
export default function Chrome({ pageMap, children }: ChromeProps) {
  return (
    <Layout
      navbar={navbar}
      search={<ScopedSearch />}
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/Evanion/libraries/tree/main/apps/docs"
      footer={footer}
    >
      {children}
    </Layout>
  );
}
