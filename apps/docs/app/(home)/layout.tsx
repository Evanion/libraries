import { PropsWithChildren } from 'react';
import Chrome from '../chrome';
import { sitePageMap } from '../page-maps';

/**
 * The docs chrome over the landing page: the navbar, the search and the
 * footer, with the released tree as the page map the search and the mobile
 * menu read.
 *
 * A route group, so it names no URL segment and the landing page stays at `/`.
 * The content tree's chrome is `(site)/[...mdxPath]/layout.tsx`, which is given
 * the route and picks the sidebar for it; a layout here would be given none.
 */
export default async function HomeLayout({ children }: PropsWithChildren) {
  return <Chrome pageMap={await sitePageMap([])}>{children}</Chrome>;
}
