import { PropsWithChildren } from 'react';
import Chrome from '../chrome';
import { sitePageMap } from '../page-maps';

/**
 * The docs chrome over a product page: the navbar, the search and the footer,
 * with the released tree as the page map, and no sidebar.
 *
 * A route group, so it names no URL segment: a product page sits at `/<slug>/`.
 */
export default async function ProductLayout({ children }: PropsWithChildren) {
  return <Chrome pageMap={await sitePageMap([])}>{children}</Chrome>;
}
