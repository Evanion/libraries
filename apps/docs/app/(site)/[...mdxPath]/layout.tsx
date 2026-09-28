import { PropsWithChildren } from 'react';
import Chrome from '../../chrome';
import { sitePageMap } from '../../page-maps';

/**
 * The docs chrome over the released package sections, their release lines
 * and the sections with no version.
 *
 * In the catch-all rather than on the `(site)` group, because the sidebar
 * depends on the route: a page of a release line lists that line's pages, and
 * a group layout is not given the segments below it. The landing page is
 * `(home)`'s, with the same chrome over the whole tree.
 *
 * `async` because the sidebar comes from `getPageMap()`, which reads the page
 * map Nextra compiles from `content/`. Under `output: 'export'` that happens
 * once per page, at build time.
 */
export default async function SiteLayout({
  children,
  params,
}: PropsWithChildren<{ params: Promise<{ mdxPath: string[] }> }>) {
  return (
    <Chrome pageMap={await sitePageMap((await params).mdxPath)}>
      {children}
    </Chrome>
  );
}
