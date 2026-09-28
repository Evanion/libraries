'use client';

import { usePathname } from 'next/navigation';
import { Search } from 'nextra/components';

/**
 * The site search, scoped to the tree the reader is in.
 *
 * One Pagefind index holds every version of every page, and each page carries a
 * `version` filter: `current` on the bare paths and on the sections with no
 * version, `next` under `/next/`, and the line's segment under `/<slug>/v<seg>/`.
 * A query with no filter would return a page once per version, so the query is
 * filtered to the reader's tree: `/next/` searches `main`, and everywhere else
 * searches the released pages, which is what a reader arriving from outside is
 * using. A superseded line searches the released pages too; its own copy of a
 * page is one link away in the switcher.
 *
 * A client component, because the layout that mounts it is rendered once for
 * every route and receives no route parameters.
 */
export default function ScopedSearch() {
  const pathname = usePathname();
  const version = pathname.startsWith('/next/') ? 'next' : 'current';

  return <Search searchOptions={{ filters: { version } }} />;
}
